import { useEffect, useState } from 'react'
import { FileCheck2, Minimize2, ScanFace, Smartphone, Sparkles, SquareUser } from 'lucide-react'
import { ArrowLink, Card, FeatureCard, Logo, ModuleCard, PrimaryButton, StatsStrip } from './ui'
import type { PageId } from './Shell'

const TABS = [
  { id: 'converter', label: '01 Converter', icon: Smartphone, title: 'Universal Converter', desc: 'Batch-convert documents, images and PDFs. Pick the output format, queue several files, track every job in the log.',
    cards: [['Batch Queue', 'Drop many files at once and send them all to one output format.'], ['Format Picker', 'PDF, DOCX, PNG, JPG and WEBP — one tap to switch.'], ['Conversion Log', 'A live status line for every file in the queue.'], ['One-Click Download', 'Grab a single result or the whole batch zipped.']] },
  { id: 'compressor', label: '02 Compressor', icon: Minimize2, title: 'Smart File Compressor', desc: 'Shrink images and files with a live before/after slider and a size estimate.',
    cards: [['Before/After Slider', 'Drag the split to compare original and compressed.'], ['Compression Level', 'Dial anywhere from 10 to 95% with a recommended stop.'], ['Estimated Size', '~66% reduction — 4.7 MB down to 1.6 MB.'], ['Quality Rating Bar', 'See perceived quality before you export.']] },
  { id: 'ats', label: '03 ATS Optimizer', icon: FileCheck2, title: 'ATS Resume Optimizer', desc: 'Score a resume against a job description and fix what an applicant tracking system would reject.',
    cards: [['Match Gauge', '84% match against the role, up +12% after fixes.'], ['Missing Keywords', 'Severity chips flag what the parser expects to find.'], ['Readability Index', '8th-grade reading level across 482 words.'], ['Formatting Checks', 'Tables, columns and headers an ATS can trip on.']] },
  { id: 'passport', label: '04 Passport Studio', icon: SquareUser, title: 'Passport Photo Studio', desc: 'Align to ICAO guides, replace the background, export a print-ready sheet.',
    cards: [['Biometric Overlay', 'Crown, eye line, chin and center guides.'], ['Country Specs', 'US 2×2 in, UK/EU 35×45 mm, India and more.'], ['Background Presets', 'Pure White, Off-White, Light Gray, Pale Blue, Custom.'], ['Print Sheet', '4×6 in sheet, 6 photos, 300 DPI.']] },
  { id: 'summarizer', label: '05 AI Summarizer', icon: Sparkles, title: 'AI Document Summarizer', desc: 'Read a PDF on the left, get a structured brief on the right.',
    cards: [['Summary Levels', 'Executive, Balanced or Detailed depth.'], ['Focus Tags', 'Financials, Risks & Red Flags, Strategic Goals, Operations.'], ['Key Takeaways', 'The five lines worth forwarding.'], ['Confidence Badge', '98.4% confidence, grounded in the source.']] },
  { id: 'deepfake', label: '06 Deepfake Detector', icon: ScanFace, title: 'Deepfake Image & Video Detector', desc: 'Scan a photo or clip for face swaps, lip-sync drift and generator fingerprints, with a frame-by-frame verdict.',
    cards: [['Authenticity Score', 'One clear verdict with a calibrated confidence.'], ['Signal Breakdown', 'Blending seams, lighting, GAN fingerprints and metadata.'], ['Frame Timeline', 'Every flagged frame in a video, marked on a scrubber.'], ['Evidence Report', 'Export a shareable PDF with heatmaps and hashes.']] },
] as const

/* [metric, unit label, fill 0-100] per feature card */
const SPECS: Record<string, [string, string, number][]> = {
  converter: [['24', 'Files per batch', 80], ['5', 'Output formats', 100], ['1:1', 'Status per file', 60], ['.zip', 'Bundled export', 90]],
  compressor: [['50/50', 'Split view', 50], ['10–95%', 'Level range', 65], ['1.6 MB', 'From 4.7 MB', 34], ['8/10', 'Quality score', 80]],
  ats: [['84%', '+12% after fixes', 84], ['5', 'Keywords missing', 40], ['8th', 'Grade · 482 words', 70], ['6/7', 'Checks passed', 86]],
  passport: [['4', 'Guide lines', 100], ['3+', 'Country presets', 60], ['5', 'Background presets', 75], ['300', 'DPI print sheet', 100]],
  deepfake: [['87%', 'Manipulation likelihood', 87], ['5', 'Forensic signals', 100], ['14', 'Frames flagged', 40], ['.pdf', 'Evidence report', 90]],
  summarizer: [['3', 'Brief depths', 66], ['4', 'Focus tags', 50], ['5', 'Takeaways', 70], ['98.4%', 'Confidence', 98]],
}

export const MODULES: [string, string, string, string, string, PageId][] = [
  ['01', 'Converter', 'Batch conversion', 'Turn any document or image into the format you need.', 'Files', 'converter'],
  ['02', 'Compressor', 'Before/after sizing', 'Smaller files without guessing at quality.', 'Media', 'compressor'],
  ['03', 'ATS Optimizer', 'Resume scoring', 'Make a resume legible to the machine that reads it first.', 'Career', 'ats'],
  ['04', 'Passport Studio', 'ICAO-ready photos', 'Compliant ID photos and printable sheets at home.', 'Identity', 'passport'],
  ['05', 'AI Summarizer', 'Document briefs', 'Long PDFs distilled into a brief you can act on.', 'AI', 'summarizer'],
  ['06', 'Deepfake Detector', 'Image & video forensics', 'Spot face swaps and synthetic media before you trust them.', 'Trust', 'deepfake'],
  ['07', 'Processing History', 'Every job logged', 'Every conversion, size and status, kept in one place.', 'History', 'history'],
]

const STEPS = [
  { n: '01', label: 'Drop', ext: 'PDF', name: 'Q3-board-report.pdf', size: 8.9, out: 'Received · 38 pages' },
  { n: '02', label: 'Convert', ext: 'DOCX', name: 'Q3-board-report.docx', size: 8.4, out: 'PDF → DOCX in 1.2s' },
  { n: '03', label: 'Compress', ext: 'DOCX', name: 'Q3-board-report.docx', size: 3.0, out: '−66% · quality 8/10' },
  { n: '04', label: 'Summarize', ext: 'BRIEF', name: 'Q3-executive-brief.md', size: 0.004, out: 'Brief ready · 98.4% confidence' },
]

/* Hero visual: one file morphing through the pipeline on a loop. */
function MorphDemo() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI(v => (v + 1) % STEPS.length), 2200)
    return () => clearInterval(t)
  }, [])
  const s = STEPS[i]
  const sizeLabel = s.size < 1 ? `${Math.round(s.size * 1000)} KB` : `${s.size.toFixed(1)} MB`
  return (
    <div className="grid h-full grid-cols-[auto_1fr] gap-6 rounded-[17.6px] bg-card p-5 md:gap-8 md:p-7">
      <ol className="relative flex flex-col justify-between py-1">
        <span className="absolute left-[5px] top-2 bottom-2 w-px bg-line-warm" />
        <span className="absolute left-[5px] top-2 w-px bg-amber transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]" style={{ height: `calc(${(i / (STEPS.length - 1)) * 100}% - 16px)` }} />
        {STEPS.map((st, k) => (
          <li key={st.n}>
            <button onClick={() => setI(k)} className="relative flex items-center gap-3 text-left">
              <span className={`h-[11px] w-[11px] rounded-full border-2 transition-colors duration-300 ${k <= i ? 'border-amber bg-amber' : 'border-line-warm bg-card'}`} />
              <span className={`font-mono text-[10px] uppercase tracking-[0.12em] transition-colors duration-300 ${k === i ? 'text-ink' : 'text-muted'}`}>{st.n} {st.label}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="flex min-w-0 flex-col justify-between gap-5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Live pipeline</span>
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ok" />{i + 1} / {STEPS.length}</span>
        </div>

        <div className="relative mx-auto aspect-[3/4] w-full max-w-[220px] rounded-[16px] border border-line bg-soft p-5 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]" style={{ transform: `scale(${s.label === 'Compress' ? 0.92 : s.label === 'Summarize' ? 0.86 : 1})` }}>
          <span className="absolute right-0 top-0 h-8 w-8 rounded-bl-[12px] border-b border-l border-line bg-msurf" />
          <p key={s.ext} className="morph-in font-mono text-[clamp(26px,3vw,36px)] font-medium tracking-tight">.{s.ext.toLowerCase()}</p>
          <div className="mt-5 flex flex-col gap-2">
            {(s.label === 'Summarize' ? ['70%', '92%', '58%'] : ['92%', '80%', '88%', '64%', '90%', '72%', '84%']).map((w, k) => (
              <div key={k + s.label} className={`h-1.5 rounded-full ${s.label === 'Summarize' && k === 0 ? 'bg-amber' : 'bg-line-warm'}`} style={{ width: w }} />
            ))}
          </div>
          <p className="absolute inset-x-5 bottom-4 truncate font-mono text-[9px] text-muted">{s.name}</p>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <p key={sizeLabel} className="morph-in font-mono text-2xl font-medium tracking-tight">{sizeLabel}</p>
            <p key={s.out} className="morph-in truncate pl-3 text-xs text-body">{s.out}</p>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-msurf">
            <div className="h-full rounded-full bg-btn transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]" style={{ width: `${Math.max((s.size / 8.9) * 100, 2)}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}

export function PassportFace({ guides = true }: { guides?: boolean }) {
  return (
    <div className="relative h-full overflow-hidden rounded-[17.6px] bg-[#eef1f5]">
      <div className="absolute bottom-0 left-1/2 h-[42%] w-[86%] -translate-x-1/2 rounded-t-[50%] bg-[#3f3f46]" />
      <div className="absolute left-1/2 top-[20%] h-[40%] w-[52%] -translate-x-1/2 rounded-[46%] bg-[#d6c3b0]" />
      <div className="absolute left-1/2 top-[16%] h-[18%] w-[56%] -translate-x-1/2 rounded-t-full bg-[#27272a]" />
      {guides && (
        <>
          <div className="absolute inset-x-3 top-[16%] border-t border-dashed border-amber" />
          <div className="absolute inset-x-3 top-[37%] border-t border-dashed border-amber" />
          <div className="absolute inset-x-3 top-[60%] border-t border-dashed border-amber" />
          <div className="absolute inset-y-3 left-1/2 border-l border-dashed border-amber" />
          <span className="absolute left-2 top-[17%] font-mono text-[8px] text-amber-ink">CROWN</span>
          <span className="absolute left-2 top-[38%] font-mono text-[8px] text-amber-ink">EYES</span>
          <span className="absolute left-2 top-[61%] font-mono text-[8px] text-amber-ink">CHIN</span>
        </>
      )}
    </div>
  )
}

export function Modules({ go }: { go: (p: PageId) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">DocMorph Platform Modules</h2>
        <p className="mt-1 max-w-[672px] text-sm text-muted">Seven tools, one workspace — every file you drop is logged, sized and ready to download.</p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {MODULES.map(([n, t, s, d, tag, id]) => <ModuleCard key={n} n={n} title={t} sub={s} desc={d} tag={tag} onClick={() => go(id)} />)}
      </div>
    </div>
  )
}

export default function Workspace({ go }: { go: (p: PageId) => void }) {
  const [tab, setTab] = useState<string>('converter')
  const t = TABS.find(x => x.id === tab)!
  return (
    <>
      <Card className="grid gap-10 p-6 md:p-12 xl:grid-cols-[1.08fr_0.92fr] xl:gap-16">
        <div className="flex flex-col justify-between gap-10">
          <div className="flex items-center gap-4">
            <Logo size={56} />
            <div className="h-8 w-px bg-line-warm" />
            <div className="font-mono text-[10px] uppercase leading-relaxed tracking-[0.16em]">
              <p className="font-medium">DocMorph · File Studio</p>
              <p className="text-muted">&nbsp;&nbsp;&nbsp;</p>
            </div>
          </div>
          <div>
            <h1 className="max-w-[16ch] text-[clamp(44px,5.85vw,84px)] font-extrabold leading-[1.04] tracking-[-0.055em]">DocMorph: Your Complete File Studio</h1>
            <p className="mt-6 max-w-[55ch] text-lg leading-[1.6] text-body">Convert, compress, summarize and optimize documents and photos in one workspace. Drop a file, pick a tool, download the result.</p>
          </div>
          <div className="flex flex-col items-start gap-6">
            <PrimaryButton onClick={() => go('converter')}>01 Converter</PrimaryButton>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <ArrowLink onClick={() => go('compressor')}>02 Compressor</ArrowLink>
              <ArrowLink onClick={() => go('ats')}>03 ATS Optimizer</ArrowLink>
              <ArrowLink onClick={() => go('passport')}>04 Passport Studio</ArrowLink>
              <ArrowLink onClick={() => go('summarizer')}>05 AI Summarizer</ArrowLink>
              <ArrowLink onClick={() => go('deepfake')}>06 Deepfake Detector</ArrowLink>
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-[16px] border border-line bg-soft">
          <div className="h-[380px] bg-card p-3 md:h-[440px]">
            <MorphDemo />
          </div>
          <div className="border-t border-line">
            <StatsStrip stats={[['ATS Match Score', '84%'], ['Avg Size Reduction', '~66%'], ['Print Export', '300 DPI'], ['Summary Confidence', '98.4%']]} />
          </div>
        </div>
      </Card>

      <div className="no-scrollbar rise flex gap-1 overflow-x-auto rounded-[16px] border border-line-warm bg-card p-1.5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-2 rounded-[12px] px-4 py-2 font-mono text-xs transition-colors duration-200 ${tab === id ? 'bg-btn font-medium text-btn-ink' : 'text-body hover:bg-msurf'}`}>
            <Icon size={14} strokeWidth={1.75} />{label}
          </button>
        ))}
      </div>

      <div key={tab} className="flex flex-col gap-6">
        <Card className="flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{t.title}</h2>
            <p className="mt-1.5 max-w-[672px] text-sm text-muted">{t.desc}</p>
          </div>
          <PrimaryButton sparkle onClick={() => go(tab as PageId)} className="shrink-0 rounded-full">Open Tool</PrimaryButton>
        </Card>
        <div className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
          {t.cards.map(([title, text], i) => <FeatureCard key={title} index={i} title={title} text={text} spec={SPECS[tab][i]} />)}
        </div>
      </div>

      <Modules go={go} />
    </>
  )
}
