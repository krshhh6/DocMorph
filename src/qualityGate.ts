export type Confidence = 'high' | 'reduced' | 'unreliable'
export type Source = 'whatsapp' | 'screenshot' | 'webcam' | 'unknown'

export interface Flag {
  label: string
  severity: 'hard' | 'soft' // hard => abstain, soft => reduced confidence
}

export interface QualityReport {
  confidence: Confidence
  source: Source
  jpegQuality: number | null // approximate, 1-100
  flags: Flag[]
  notes: string[] // informational only, never counted against the image
}

const STD_LUMA_SUM = 3688 // sum of the standard JPEG luminance table (quality 50)
const PINTEREST_WIDTHS = [236, 474, 564, 736]
const SCREEN_SIZES: [number, number][] = [
  [1920, 1080], [1366, 768], [1536, 864], [1440, 900], [2560, 1440],
  [1080, 2400], [1080, 2340], [1170, 2532], [1284, 2778], [1080, 1920], [750, 1334],
]

export function classifySource(name: string): Source {
  if (/whatsapp|^IMG-\d{8}-WA/i.test(name)) return 'whatsapp'
  if (/screen[\s_-]?shot|^Capture/i.test(name)) return 'screenshot'
  if (/^WIN_\d{8}_/i.test(name)) return 'webcam'
  return 'unknown'
}

// Estimate JPEG quality from the luminance quantization table (approximate).
export async function estimateJpegQuality(file: File): Promise<number | null> {
  if (!/jpe?g/i.test(file.type) && !/\.jpe?g$/i.test(file.name)) return null
  try {
    const v = new DataView(await file.arrayBuffer())
    let p = 2 // skip SOI
    while (p + 4 < v.byteLength) {
      if (v.getUint8(p) !== 0xff) {
        p++
        continue
      }
      const marker = v.getUint8(p + 1)
      if (marker === 0xda) break // start of scan, no more tables
      if (marker === 0xff || marker === 0x00) {
        p++
        continue
      }
      const len = v.getUint16(p + 2)
      if (marker === 0xdb) {
        let q = p + 4
        const end = p + 2 + len
        while (q < end) {
          const info = v.getUint8(q++)
          const wide = info >> 4 === 1
          const id = info & 15
          let sum = 0
          for (let i = 0; i < 64; i++) {
            sum += wide ? v.getUint16(q) : v.getUint8(q)
            q += wide ? 2 : 1
          }
          if (id === 0) {
            const scale = (sum / STD_LUMA_SUM) * 100
            const quality = scale > 100 ? 5000 / scale : (200 - scale) / 2
            return Math.max(1, Math.min(100, Math.round(quality)))
          }
        }
      }
      p += 2 + len
    }
  } catch {
    /* fall through */
  }
  return null
}

export async function assessInputQuality(
  img: { naturalWidth?: number; naturalHeight?: number; width: number; height: number },
  file: File,
  hasExif: boolean
): Promise<QualityReport> {
  const W = img.naturalWidth || img.width
  const H = img.naturalHeight || img.height
  const minSide = Math.min(W, H)
  const source = classifySource(file.name)
  const jpegQuality = await estimateJpegQuality(file)
  const flags: Flag[] = []
  const notes: string[] = []

  // ---- HARD flags: forensic signals are genuinely unusable ----
  const isScreenSize = SCREEN_SIZES.some(
    ([w, h]) => (W === w && H === h) || (W === h && H === w)
  )
  if (source === 'screenshot' || (isScreenSize && !hasExif && /png/i.test(file.type))) {
    flags.push({ label: 'Screenshot', severity: 'hard' })
  }

  if (!hasExif && (PINTEREST_WIDTHS.includes(W) || PINTEREST_WIDTHS.includes(H))) {
    flags.push({ label: 'Social-media resized copy', severity: 'hard' })
  }

  if (minSide < 300) {
    flags.push({ label: 'Very low resolution', severity: 'hard' })
  }

  if (jpegQuality !== null && jpegQuality < 45) {
    flags.push({ label: 'Heavily compressed', severity: 'hard' })
  }

  // ---- SOFT flags: still analyzable, but with reduced confidence ----
  if (source === 'whatsapp') {
    flags.push({ label: 'Re-compressed by WhatsApp', severity: 'soft' })
  }

  if (jpegQuality !== null && jpegQuality >= 45 && jpegQuality < 70) {
    flags.push({ label: 'Moderately compressed', severity: 'soft' })
  }

  if (minSide >= 300 && minSide < 480) {
    flags.push({ label: 'Low resolution', severity: 'soft' })
  }

  // ---- Informational only ----
  if (!hasExif) {
    notes.push('No camera metadata (normal for webcams and messaging apps).')
  }
  if (source === 'webcam') {
    notes.push('Looks like a Windows Camera capture.')
  }

  const confidence: Confidence = flags.some((f) => f.severity === 'hard')
    ? 'unreliable'
    : flags.length > 0
    ? 'reduced'
    : 'high'

  return { confidence, source, jpegQuality, flags, notes }
}

// ---- Verdict ----
export type Verdict = 'real' | 'ai' | 'inconclusive'

const BANDS = {
  high: { real: 35, ai: 65 },
  reduced: { real: 25, ai: 75 }, // stricter: need stronger evidence either way
}

export function decideVerdict(q: QualityReport, aiScore: number | null) {
  if (q.confidence === 'unreliable' || aiScore === null) {
    return { verdict: 'inconclusive' as Verdict, showScore: false, caveat: null }
  }

  const b = BANDS[q.confidence]
  const caveat = q.confidence === 'reduced' ? 'Reduced confidence' : null

  if (aiScore < b.real) return { verdict: 'real' as Verdict, showScore: true, caveat }
  if (aiScore >= b.ai) return { verdict: 'ai' as Verdict, showScore: true, caveat }
  return { verdict: 'inconclusive' as Verdict, showScore: false, caveat }
}
