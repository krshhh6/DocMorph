import { useState, useRef } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Download, FileText, RotateCcw, Sparkles, Upload, X } from 'lucide-react'
import { Card, Eyebrow, PrimaryButton, StatsStrip, StatusChip, TagChip } from './ui'
import { PassportFace } from './Workspace'

function ToolHeader({ n, name, title, desc, stats }: { n: string; name: string; title: string; desc: string; stats: [string, string][] }) {
  return (
    <Card className="overflow-hidden">
      <div className="p-6 md:p-10">
        <Eyebrow className="text-amber-ink">{n} · {name}</Eyebrow>
        <h1 className="mt-4 text-[clamp(36px,4vw,56px)] font-extrabold leading-[1.04] tracking-[-0.045em]">{title}</h1>
        <p className="mt-3 max-w-[60ch] text-body">{desc}</p>
      </div>
      <div className="border-t border-line bg-soft"><StatsStrip stats={stats} /></div>
    </Card>
  )
}

function Workbench({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <Card className="tool-workbench grid gap-px overflow-hidden bg-line lg:grid-cols-2">
      <div className="flex flex-col gap-6 bg-page p-6 md:p-8">{left}</div>
      <div className="flex flex-col gap-6 bg-page p-6 md:p-8">{right}</div>
    </Card>
  )
}

function Panel({ label, children, action }: { label: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="tool-panel-heading flex items-center justify-between">
      <Eyebrow className="text-muted">{label}</Eyebrow>
      {action}{children}
    </div>
  )
}

const BACKEND_URL = import.meta.env.VITE_API_URL || 'https://docmorph-production.up.railway.app'

function Dropzone({ text, onFiles }: { text: string; onFiles?: (files: FileList) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    fileInputRef.current?.click()
  }

  return (
    <div
      onClick={handleClick}
      onDragOver={e => {
        e.preventDefault()
        setIsDragOver(true)
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={e => {
        e.preventDefault()
        setIsDragOver(false)
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onFiles) {
          onFiles(e.dataTransfer.files)
        }
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[17.6px] border border-dashed px-6 py-10 text-center transition-all duration-200 select-none ${
        isDragOver ? 'border-amber bg-amber/10' : 'border-line-warm bg-msurf hover:border-ink hover:bg-card'
      }`}
    >
      <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-card"><Upload size={16} /></span>
      <span className="text-sm font-semibold">{text}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">Click to browse or drag & drop · max 50 MB</span>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={e => {
          if (e.target.files && e.target.files.length > 0 && onFiles) {
            onFiles(e.target.files)
          }
          e.target.value = ''
        }}
      />
    </div>
  )
}

function Seg({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="tool-segments flex flex-wrap gap-1 rounded-[14px] border border-line-warm bg-msurf p-1">
      {options.map(o => (
        <button key={o} onClick={() => onChange(o)} className={`flex-1 rounded-[10px] px-3 py-2 font-mono text-xs transition-colors duration-200 ${value === o ? 'bg-btn text-btn-ink' : 'text-body hover:bg-card'}`}>{o}</button>
      ))}
    </div>
  )
}

interface ConvertJob {
  id: string
  file?: File
  name: string
  from: string
  to: string
  size: string
  status: 'Done' | 'Processing' | 'Queued' | 'Failed'
  downloadUrl?: string
  downloadName?: string
  error?: string
}

/* 01 Converter */
export function Converter() {
  const [fmt, setFmt] = useState('PDF')
  const [isConverting, setIsConverting] = useState(false)
  const [jobs, setJobs] = useState<ConvertJob[]>([])

  const handleFiles = (fileList: FileList) => {
    const newJobs: ConvertJob[] = Array.from(fileList).map(f => {
      const ext = f.name.split('.').pop()?.toUpperCase() || 'FILE'
      const sz = f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} MB` : `${Math.round(f.size / 1024)} KB`
      return {
        id: Math.random().toString(36).substring(7),
        file: f,
        name: f.name,
        from: ext,
        to: fmt,
        size: sz,
        status: 'Queued',
      }
    })
    setJobs(prev => [...newJobs, ...prev])
  }

  const runConversion = async () => {
    const pending = jobs.filter(j => j.status === 'Queued' && j.file)
    if (pending.length === 0) {
      alert('Please upload files to convert!')
      return
    }

    setIsConverting(true)
    for (const job of pending) {
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'Processing', to: fmt } : j))
      try {
        const formData = new FormData()
        formData.append('file', job.file!)
        formData.append('target_format', fmt)

        const res = await fetch(`${BACKEND_URL}/api/convert`, {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const errDetail = await res.text()
          throw new Error(errDetail || 'Conversion failed')
        }

        const blob = await res.blob()
        const downloadUrl = window.URL.createObjectURL(blob)
        const baseName = job.name.substring(0, job.name.lastIndexOf('.')) || job.name
        const outExt = fmt.toLowerCase() === 'jpg' ? 'jpg' : fmt.toLowerCase()
        const downloadName = `${baseName}.${outExt}`

        setJobs(prev => prev.map(j => j.id === job.id ? {
          ...j,
          status: 'Done',
          to: fmt,
          downloadUrl,
          downloadName,
        } : j))

        const a = document.createElement('a')
        a.href = downloadUrl
        a.download = downloadName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      } catch (err: any) {
        setJobs(prev => prev.map(j => j.id === job.id ? {
          ...j,
          status: 'Failed',
          error: err.message,
        } : j))
      }
    }
    setIsConverting(false)
  }

  const doneCount = jobs.filter(j => j.status === 'Done').length
  const pendingFilesCount = jobs.filter(j => j.file && j.status === 'Queued').length

  return (
    <>
      <ToolHeader
        n="01"
        name="Universal Converter"
        title="Universal Converter"
        desc="Batch-convert documents, images and PDFs directly via your cloud Python backend."
        stats={[
          ['Formats', '5'],
          ['Queue Size', `${jobs.length}`],
          ['Completed', `${doneCount} / ${jobs.length}`],
          ['Backend', 'Railway Online']
        ]}
      />
      <Workbench
        left={<>
          <Panel label="Upload" />
          <Dropzone text="Drop files to convert" onFiles={handleFiles} />
          <Panel label="Output Format" />
          <Seg options={['PDF', 'DOCX', 'PNG', 'JPG', 'WEBP']} value={fmt} onChange={setFmt} />
          <PrimaryButton onClick={runConversion} disabled={isConverting} className="self-start">
            {isConverting ? 'Converting...' : pendingFilesCount > 0 ? `Convert ${pendingFilesCount} files to ${fmt}` : `Upload files to convert to ${fmt}`}
          </PrimaryButton>
        </>}
        right={<>
          <Panel label="Conversion Queue" action={<span className="font-mono text-[10px] text-muted">{doneCount} / {jobs.length} DONE</span>} />
          <div className="overflow-x-auto rounded-[16px] border border-line">
            <table className="w-full text-sm">
              <thead className="bg-msurf font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                <tr>{['File', 'From', 'To', 'Size', 'Status', 'Action'].map(h => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted">
                      No files in queue. Click or drag & drop files on the left to start converting.
                    </td>
                  </tr>
                ) : (
                  jobs.map(job => (
                    <tr key={job.id}>
                      <td className="px-4 py-3 font-medium">
                        <span className="flex items-center gap-2">
                          <FileText size={14} className="text-muted" />
                          <span className="max-w-[140px] truncate md:max-w-[200px]" title={job.name}>{job.name}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{job.from}</td>
                      <td className="px-4 py-3 font-mono text-xs">{job.to}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{job.size}</td>
                      <td className="px-4 py-3"><StatusChip status={job.status} /></td>
                      <td className="px-4 py-3">
                        {job.downloadUrl ? (
                          <a
                            href={job.downloadUrl}
                            download={job.downloadName}
                            className="inline-flex items-center gap-1 font-mono text-xs text-amber-ink hover:underline"
                          >
                            <Download size={12} /> Save
                          </a>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>}
      />
    </>
  )
}

/* 02 Compressor */
export function Compressor() {
  const [level, setLevel] = useState(65)
  const [split, setSplit] = useState(50)
  const before = 4.7
  const after = +(before * (1 - level / 100 * 1.02)).toFixed(1)
  const reduction = Math.round((1 - Math.max(after, 0.2) / before) * 100)
  return (
    <>
      <ToolHeader n="02" name="Smart File Compressor" title="Smart File Compressor" desc="Shrink images and files with a live before/after slider and a size estimate." stats={[['Original', `${before} MB`], ['Estimated', `${Math.max(after, 0.2)} MB`], ['Reduction', `~${reduction}%`], ['Quality', level > 80 ? 'Low' : level > 50 ? 'Good' : 'High']]} />
      <Workbench
        left={<>
          <Panel label="Before / After" />
          <div className="relative aspect-[4/3] overflow-hidden rounded-[17.6px] bg-zinc-300 select-none">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,#d4d4d8_0_14px,#e4e4e7_14px_28px)]" />
            <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,#a1a1aa_0_28px,#d4d4d8_28px_56px)]" style={{ clipPath: `inset(0 0 0 ${split}%)` }} />
            <div className="absolute inset-y-0 w-0.5 bg-amber" style={{ left: `${split}%` }} />
            <span className="absolute left-3 top-3 rounded-full bg-[#18181b] px-2.5 py-1 font-mono text-[10px] text-white">BEFORE · {before} MB</span>
            <span className="absolute right-3 top-3 rounded-full bg-[#18181b] px-2.5 py-1 font-mono text-[10px] text-amber">AFTER · {Math.max(after, 0.2)} MB</span>
            <input type="range" min={0} max={100} value={split} onChange={e => setSplit(+e.target.value)} className="absolute inset-0 cursor-ew-resize opacity-0" aria-label="Before after split" />
          </div>
        </>}
        right={<>
          <Panel label="Compression Level" action={<span className="rounded-full bg-amber-pale px-2.5 py-1 font-mono text-[11px] text-amber-ink">−{reduction}% SIZE</span>} />
          <p className="font-mono text-5xl font-medium tracking-tight">{level}%</p>
          <input type="range" min={10} max={95} value={level} onChange={e => setLevel(+e.target.value)} className="range w-full" aria-label="Compression level" />
          <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
            <span>Max Quality (10%)</span><span className="text-ink">65% (Recommended)</span><span>Max Compression (95%)</span>
          </div>
          <div>
            <Eyebrow className="mb-2 text-muted">Quality Rating</Eyebrow>
            <div className="flex gap-1">{Array.from({ length: 10 }).map((_, i) => <div key={i} className={`h-2 flex-1 rounded-full ${i < Math.round(10 - level / 11) ? 'bg-btn' : 'bg-line-warm'}`} />)}</div>
          </div>
          <div className="mt-auto flex flex-wrap gap-3">
            <PrimaryButton>Compress & Download</PrimaryButton>
            <button onClick={() => { setLevel(65); setSplit(50) }} className="inline-flex items-center gap-2 rounded-[12px] border border-line-warm px-4 text-sm font-medium hover:border-ink"><RotateCcw size={14} />Reset Settings</button>
          </div>
        </>}
      />
    </>
  )
}

/* 03 ATS */
export function ATS() {
  const score = 84
  const C = 2 * Math.PI * 70
  const kws: [string, 'High' | 'Med' | 'Low'][] = [['Kubernetes', 'High'], ['Stakeholder management', 'High'], ['GraphQL', 'Med'], ['CI/CD', 'Med'], ['A/B testing', 'Low']]
  const sev = { High: 'bg-danger/10 text-danger', Med: 'bg-warn-pale text-warn', Low: 'bg-msurf text-muted' }
  return (
    <>
      <ToolHeader n="03" name="ATS Resume Optimizer" title="ATS Resume Optimizer" desc="Score a resume against a job description and fix what an applicant tracking system would reject." stats={[['Match Score', '84%'], ['Since Last Scan', '+12%'], ['Missing Keywords', '5'], ['Word Count', '482']]} />
      <Workbench
        left={<>
          <Panel label="Resume" />
          <Dropzone text="Drop resume (PDF or DOCX)" />
          <Panel label="Job Description" />
          <textarea defaultValue="Senior Product Engineer — own platform features end to end, ship with Kubernetes and GraphQL, partner with stakeholders across design and data…" className="min-h-36 rounded-[16px] border border-line-warm bg-msurf p-4 text-sm leading-relaxed text-body outline-none focus:border-ink" />
          <PrimaryButton sparkle className="self-start">Rescan Resume</PrimaryButton>
        </>}
        right={<>
          <div className="flex items-center gap-6">
            <svg width="160" height="160" viewBox="0 0 160 160" className="shrink-0 -rotate-90">
              <circle cx="80" cy="80" r="70" fill="none" strokeWidth="10" className="stroke-line-warm" />
              <circle cx="80" cy="80" r="70" fill="none" strokeWidth="10" stroke="#FFD061" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - score / 100)} />
              <text x="80" y="88" textAnchor="middle" transform="rotate(90 80 80)" className="fill-ink font-mono text-[30px] font-medium">{score}%</text>
            </svg>
            <div>
              <Eyebrow className="text-muted">Match Gauge</Eyebrow>
              <p className="mt-2 text-xl font-bold">Strong match</p>
              <p className="mt-1 font-mono text-xs text-ok">+12% after suggested fixes</p>
            </div>
          </div>
          <div>
            <Eyebrow className="mb-3 text-muted">Missing Keywords</Eyebrow>
            <div className="flex flex-wrap gap-2">{kws.map(([k, s]) => <span key={k} className="inline-flex items-center gap-2 rounded-full border border-line-warm py-1 pl-3 pr-1 text-xs">{k}<span className={`rounded-full px-2 py-0.5 font-mono text-[9px] uppercase ${sev[s]}`}>{s}</span></span>)}</div>
          </div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[16px] border border-line bg-line">
            <div className="bg-card p-4"><Eyebrow className="text-muted">Readability</Eyebrow><p className="mt-2 font-mono text-2xl">8th grade</p></div>
            <div className="bg-card p-4"><Eyebrow className="text-muted">Words</Eyebrow><p className="mt-2 font-mono text-2xl">482</p></div>
          </div>
          <ul className="flex flex-col divide-y divide-line rounded-[16px] border border-line">
            {[['Single-column layout', true], ['Standard section headings', true], ['No images or text boxes', true], ['Dates in a consistent format', false]].map(([t, ok]) => (
              <li key={t as string} className="flex items-center gap-3 px-4 py-3 text-sm">
                {ok ? <CheckCircle2 size={16} className="text-ok" /> : <AlertTriangle size={16} className="text-warn" />}{t}
              </li>
            ))}
          </ul>
        </>}
      />
    </>
  )
}

/* 04 Passport */
export function Passport() {
  const [country, setCountry] = useState('US 2×2 in')
  const [bg, setBg] = useState('#FFFFFF')
  const presets = [['Pure White', '#FFFFFF'], ['Off-White', '#F8F8F2'], ['Light Gray', '#E4E4E7'], ['Pale Blue', '#DCE8F5']]
  return (
    <>
      <ToolHeader n="04" name="Passport Photo Studio" title="Passport Photo Studio" desc="Align to ICAO guides, replace the background, export a print-ready sheet." stats={[['Compliance', '6 / 6'], ['Spec', country], ['Print Sheet', '6 photos'], ['Resolution', '300 DPI']]} />
      <Workbench
        left={<>
          <Panel label="Alignment Overlay" />
          <div className="mx-auto aspect-square w-full max-w-[420px] rounded-[17.6px] p-0" style={{ background: bg }}>
            <div className="h-full [&>div]:!bg-transparent"><PassportFace /></div>
          </div>
          <Panel label="Country Spec" />
          <Seg options={['US 2×2 in', 'UK/EU 35×45 mm', 'India 35×45 mm']} value={country} onChange={setCountry} />
        </>}
        right={<>
          <Panel label="Background" />
          <div className="flex flex-wrap gap-2">
            {presets.map(([n, c]) => (
              <button key={n} onClick={() => setBg(c)} className={`flex items-center gap-2 rounded-[12px] border px-3 py-2 text-xs font-medium transition-colors duration-200 ${bg === c ? 'border-ink' : 'border-line-warm'}`}>
                <span className="h-4 w-4 rounded-full border border-line-warm" style={{ background: c }} />{n}
              </button>
            ))}
            <button className="rounded-[12px] border border-dashed border-line-warm px-3 py-2 text-xs font-medium text-muted">Custom</button>
          </div>
          <Panel label="Compliance" />
          <ul className="flex flex-col divide-y divide-line rounded-[16px] border border-line">
            {['Head height 1–1⅜ in (25–35 mm)', 'Eyes on guide line', 'Face centered', 'Neutral expression, mouth closed', 'Even lighting, no shadows', 'Plain background'].map(t => (
              <li key={t} className="flex items-center gap-3 px-4 py-2.5 text-sm"><CheckCircle2 size={15} className="text-ok" />{t}</li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[16px] border border-line bg-line">
            <div className="bg-msurf p-4"><Eyebrow className="text-muted">Print Layout</Eyebrow><p className="mt-1.5 text-sm font-semibold">4×6 inch (6 Photos)</p></div>
            <div className="bg-msurf p-4"><Eyebrow className="text-muted">Resolution</Eyebrow><p className="mt-1.5 text-sm font-semibold">300 DPI High-Res</p></div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="inline-flex min-h-12 items-center gap-2 rounded-[12px] border border-line-warm px-5 text-sm font-semibold hover:border-ink"><Download size={14} />Download Single (2 x 2 in)</button>
            <PrimaryButton>Download Print Sheet</PrimaryButton>
          </div>
        </>}
      />
    </>
  )
}

/* 05 Summarizer */
export function Summarizer() {
  const [level, setLevel] = useState('Executive')
  const [tags, setTags] = useState(['Financials', 'Risks & Red Flags'])
  const [done, setDone] = useState(true)
  const all = ['Financials', 'Risks & Red Flags', 'Strategic Goals', 'Operations']
  const points = {
    Executive: ['Revenue up 18% YoY to $42.6M, led by enterprise renewals.', 'Gross margin compressed 3 pts on cloud costs.', 'Two vendor contracts carry auto-renew penalties in Q1.'],
    Balanced: ['Revenue up 18% YoY to $42.6M; enterprise renewals at 94%.', 'Gross margin 61% (−3 pts) — cloud spend is the main driver.', 'Headcount flat; hiring paused in Ops until Q2.', 'Two vendor contracts auto-renew with 12% uplift.'],
    Detailed: ['Revenue $42.6M (+18% YoY); enterprise 71% of mix.', 'Gross margin 61%, down from 64%; infra cost +27%.', 'Opex held at $19.1M; Ops hiring paused.', 'APAC expansion targeted for H2 with $3M budget.', 'Vendor auto-renewals: 12% uplift, 60-day notice.'],
  }[level]!
  return (
    <>
      <ToolHeader n="05" name="AI Document Summarizer" title="AI Document Summarizer" desc="Read a PDF on the left, get a structured brief on the right." stats={[['Pages', '38'], ['Read Time Saved', '42 min'], ['Takeaways', String(points.length)], ['Confidence', '98.4%']]} />
      <Workbench
        left={<>
          <Panel label="Q3-Board-Report.pdf" action={<span className="font-mono text-[10px] text-muted">PAGE 4 / 38</span>} />
          <div className="flex flex-1 flex-col gap-3 rounded-[17.6px] border border-line bg-msurf p-6 md:p-8">
            <p className="font-mono text-[10px] text-muted">SECTION 2 — FINANCIAL PERFORMANCE</p>
            <p className="text-sm leading-relaxed text-body">Total revenue for the quarter reached <mark className="rounded bg-amber-pale px-0.5 text-ink">$42.6 million, an increase of 18%</mark> compared with the same period last year. Growth was driven primarily by enterprise renewals, which closed at a 94% rate.</p>
            <p className="text-sm leading-relaxed text-body">Gross margin declined to 61% as <mark className="rounded bg-amber-pale px-0.5 text-ink">infrastructure costs rose 27%</mark> following the migration of the analytics workload. Management expects normalization in Q1.</p>
            {['92%', '80%', '88%', '64%', '90%', '72%'].map((w, i) => <div key={i} className="h-2 rounded-full bg-line-warm" style={{ width: w }} />)}
          </div>
        </>}
        right={<>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold"><Sparkles size={16} className="text-amber" />AI Executive Brief</h2>
            {done && <span className="rounded-full bg-ok-pale px-2.5 py-1 font-mono text-[10px] text-ok">98.4% CONFIDENCE</span>}
          </div>
          <Seg options={['Executive', 'Balanced', 'Detailed']} value={level} onChange={v => { setLevel(v); setDone(false) }} />
          <div className="flex flex-wrap gap-2">
            {all.map(t => {
              const on = tags.includes(t)
              return <button key={t} onClick={() => { setTags(on ? tags.filter(x => x !== t) : [...tags, t]); setDone(false) }} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[11px] transition-colors duration-200 ${on ? 'border-ink bg-btn text-btn-ink' : 'border-line-warm text-body'}`}>{t}{on && <X size={11} />}</button>
            })}
          </div>
          <PrimaryButton sparkle onClick={() => setDone(true)} className="self-start">Generate AI Summary</PrimaryButton>
          <div className={`rounded-[16px] border border-line p-5 transition-opacity duration-300 ${done ? '' : 'opacity-40'}`}>
            <div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-ok" /><Eyebrow className="text-ok">AI Distillation Complete</Eyebrow></div>
            <p className="mt-4 text-sm font-semibold">Key Takeaways</p>
            <ol className="mt-2 flex flex-col gap-2">
              {points.map((p, i) => <li key={p} className="flex gap-3 text-sm text-body"><span className="font-mono text-xs text-muted">0{i + 1}</span>{p}</li>)}
            </ol>
          </div>
        </>}
      />
    </>
  )
}

/* 06 Deepfake Detector */
export function Deepfake() {
  const [mode, setMode] = useState('Video')
  const [scan, setScan] = useState<'idle' | 'scanning' | 'done'>('idle')
  const [file, setFile] = useState<{ url: string; name: string; size: string } | null>(null)
  const pick = (f?: File) => {
    if (!f) return
    if (file) URL.revokeObjectURL(file.url)
    setMode(f.type.startsWith('video') ? 'Video' : 'Image')
    setFile({ url: URL.createObjectURL(f), name: f.name, size: f.size > 1e6 ? `${(f.size / 1e6).toFixed(1)} MB` : `${Math.round(f.size / 1e3)} KB` })
    setScan('idle')
  }
  const clear = () => { if (file) URL.revokeObjectURL(file.url); setFile(null); setScan('idle') }
  const [frame, setFrame] = useState(62)
  const isVideo = mode === 'Video'
  const score = isVideo ? 87 : 73
  const flagged = [18, 22, 23, 41, 58, 60, 61, 62, 63, 64, 77, 81, 82, 90]
  const signals: [string, number][] = isVideo
    ? [['Face-swap blending seams', 91], ['Lip-sync drift', 84], ['GAN / diffusion fingerprint', 78], ['Lighting & shadow consistency', 62], ['Metadata integrity', 35]]
    : [['Face-swap blending seams', 76], ['Skin texture uniformity', 81], ['GAN / diffusion fingerprint', 69], ['Lighting & shadow consistency', 58], ['Metadata integrity', 40]]
  const C = 2 * Math.PI * 70
  const run = () => { if (!file) return; setScan('scanning'); setTimeout(() => setScan('done'), 1800) }
  const verdict = score >= 80 ? ['Likely Manipulated', 'text-danger', 'bg-danger/10'] : score >= 50 ? ['Suspicious', 'text-warn', 'bg-warn-pale'] : ['Likely Authentic', 'text-ok', 'bg-ok-pale']
  return (
    <>
      <ToolHeader n="06" name="Deepfake Detector" title="Deepfake Image & Video Detector" desc="Scan a photo or clip for face swaps, lip-sync drift and generator fingerprints, with a frame-by-frame verdict." stats={[['Verdict', verdict[0].split(' ')[1]], ['Likelihood', `${score}%`], ['Frames Flagged', isVideo ? '14 / 96' : '—'], ['Model', 'DM-Forensic v3']]} />
      <Workbench
        left={<>
          <Panel label="Media" action={<span className="font-mono text-[10px] text-muted">{file ? `${file.name.toUpperCase()} · ${file.size}` : 'NO FILE SELECTED'}</span>} />
          <Seg options={['Video', 'Image']} value={mode} onChange={v => { if (v !== mode) clear(); setMode(v) }} />
          <label
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); pick(e.dataTransfer.files[0]) }}
            className={`relative grid aspect-video cursor-pointer place-items-center overflow-hidden rounded-[17.6px] ${file ? 'bg-[#18181b]' : 'border-2 border-dashed border-line-warm bg-msurf transition-colors duration-200 hover:border-ink'}`}
          >
            <input type="file" accept={isVideo ? 'video/*' : 'image/*'} className="hidden" onChange={e => pick(e.target.files?.[0])} />
            {!file && (
              <div className="flex flex-col items-center gap-3 px-6 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-[12px] bg-btn text-btn-ink"><Upload size={18} /></span>
                <p className="font-semibold">Upload {isVideo ? 'a video' : 'an image'}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">{isVideo ? 'MP4 · MOV · WEBM — up to 200 MB' : 'JPG · PNG · WEBP — up to 25 MB'}</p>
                <span className="text-xs text-muted">Click to browse or drag & drop</span>
              </div>
            )}
            {file && (isVideo
              ? <video src={file.url} controls className="h-full w-full object-contain" onClick={e => e.preventDefault()} />
              : <img src={file.url} alt={file.name} className="h-full w-full object-contain" />)}
            {file && scan === 'scanning' && <div className="scanline pointer-events-none absolute inset-x-0 h-0.5 bg-amber shadow-[0_0_24px_4px_rgba(255,208,97,0.6)]" />}
            {file && <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 font-mono text-[10px] text-white">{scan === 'scanning' ? 'SCANNING…' : scan === 'done' ? 'SCAN COMPLETE' : 'READY'}</span>}
            {file && (
              <button onClick={e => { e.preventDefault(); clear() }} aria-label="Remove file" className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"><X size={14} /></button>
            )}
          </label>
          {isVideo && file && (
            <div>
              <div className="mb-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.06em] text-muted"><span>Frame timeline</span><span>Frame {frame} / 96</span></div>
              <div className="relative flex h-8 gap-px overflow-hidden rounded-[8px] bg-msurf">
                {Array.from({ length: 96 }).map((_, k) => (
                  <button key={k} onClick={() => setFrame(k)} aria-label={`Frame ${k}`} className={`flex-1 transition-colors duration-200 ${scan === 'done' && flagged.includes(k) ? 'bg-danger/70' : 'bg-line-warm/60 hover:bg-line-warm'} ${k === frame ? '!bg-btn' : ''}`} />
                ))}
              </div>
            </div>
          )}
          <PrimaryButton sparkle onClick={run} className={`self-start ${file ? '' : 'pointer-events-none opacity-40'}`}>{scan === 'scanning' ? 'Scanning…' : file ? 'Run Deepfake Scan' : 'Upload a file to scan'}</PrimaryButton>
        </>}
        right={<>
          <div className={`flex items-center gap-6 transition-opacity duration-300 ${scan === 'done' ? '' : 'opacity-40'}`}>
            <svg width="150" height="150" viewBox="0 0 160 160" className="shrink-0 -rotate-90">
              <circle cx="80" cy="80" r="70" fill="none" strokeWidth="10" className="stroke-line-warm" />
              <circle cx="80" cy="80" r="70" fill="none" strokeWidth="10" stroke="#FFD061" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={scan === 'done' ? C * (1 - score / 100) : C} style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)' }} />
              <text x="80" y="88" textAnchor="middle" transform="rotate(90 80 80)" className="fill-ink font-mono text-[30px] font-medium">{scan === 'done' ? `${score}%` : '—'}</text>
            </svg>
            <div>
              <Eyebrow className="text-muted">Manipulation Likelihood</Eyebrow>
              <span className={`mt-3 inline-flex rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-[0.06em] ${verdict[1]} ${verdict[2]}`}>{verdict[0]}</span>
              <p className="mt-2 text-xs text-muted">Calibrated on 1.2M real & synthetic samples.</p>
            </div>
          </div>
          <div>
            <Eyebrow className="mb-3 text-muted">Signal Breakdown</Eyebrow>
            <ul className="flex flex-col gap-3">
              {signals.map(([n, v]) => (
                <li key={n}>
                  <div className="mb-1.5 flex justify-between text-sm"><span>{n}</span><span className="font-mono text-xs text-muted">{scan === 'done' ? `${v}%` : '—'}</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-msurf">
                    <div className={`h-full rounded-full transition-all duration-700 ${v >= 75 ? 'bg-danger' : v >= 50 ? 'bg-warn' : 'bg-ok'}`} style={{ width: scan === 'done' ? `${v}%` : '0%' }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <ul className="flex flex-col divide-y divide-line rounded-[16px] border border-line">
            {[['Blink rate within human range', true], ['C2PA content credentials present', false], ['Audio–visual phoneme match', !isVideo]].map(([t, ok]) => (
              <li key={t as string} className="flex items-center gap-3 px-4 py-2.5 text-sm">{ok ? <CheckCircle2 size={15} className="text-ok" /> : <AlertTriangle size={15} className="text-warn" />}{t}</li>
            ))}
          </ul>
          <button className="inline-flex items-center gap-2 self-start rounded-[12px] border border-line-warm px-4 py-2.5 text-sm font-medium transition-colors duration-200 hover:border-ink"><Download size={14} />Export Evidence Report</button>
        </>}
      />
    </>
  )
}

/* 07 History */
export function History() {
  const [filter, setFilter] = useState('All')
  const rows: [string, string, string, string, 'Done' | 'Processing' | 'Failed' | 'Queued', string][] = [
    ['annual-report-2026.pdf', 'Converter', '2.4 MB', '1.9 MB', 'Done', '2 min ago'],
    ['hero-photo.png', 'Compressor', '4.7 MB', '1.6 MB', 'Done', '9 min ago'],
    ['krishna-kant-resume.pdf', 'ATS Optimizer', '312 KB', '—', 'Done', '24 min ago'],
    ['passport-raw.jpg', 'Passport Studio', '3.2 MB', '1.1 MB', 'Processing', '31 min ago'],
    ['q3-board-report.pdf', 'AI Summarizer', '8.9 MB', '4 KB', 'Done', '1 h ago'],
    ['scan-0042.tiff', 'Converter', '18.4 MB', '—', 'Failed', '3 h ago'],
    ['interview-clip.mp4', 'Deepfake Detector', '42 MB', '—', 'Done', '2 h ago'],
    ['brand-guide.webp', 'Compressor', '940 KB', '—', 'Queued', 'Yesterday'],
  ]
  const tools = ['All', 'Converter', 'Compressor', 'ATS Optimizer', 'Passport Studio', 'AI Summarizer', 'Deepfake Detector']
  const shown = rows.filter(r => filter === 'All' || r[1] === filter)
  return (
    <>
      <ToolHeader n="07" name="Processing History" title="Processing History" desc="Every job, its tool, its size before and after, and how it ended." stats={[['Jobs This Week', '128'], ['Data Saved', '412 MB'], ['Success Rate', '98.2%'], ['Avg Job', '1.4s']]} />
      <Card className="flex flex-col gap-6 p-6 md:p-8">
        <div className="no-scrollbar flex gap-1 overflow-x-auto">
          {tools.map(t => <button key={t} onClick={() => setFilter(t)} className={`shrink-0 rounded-[12px] px-4 py-2 font-mono text-xs transition-colors duration-200 ${filter === t ? 'bg-btn text-btn-ink' : 'text-body hover:bg-msurf'}`}>{t}</button>)}
        </div>
        <div className="overflow-x-auto rounded-[16px] border border-line">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-msurf font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
              <tr>{['File', 'Tool', 'Before', 'After', 'Status', 'Time'].map(h => <th key={h} className="px-5 py-3 text-left font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map(([f, tool, b, a, s, time]) => (
                <tr key={f} className="transition-colors duration-200 hover:bg-msurf">
                  <td className="px-5 py-3.5 font-medium"><span className="flex items-center gap-2"><FileText size={14} className="text-muted" />{f}</span></td>
                  <td className="px-5 py-3.5"><TagChip>{tool}</TagChip></td>
                  <td className="px-5 py-3.5 font-mono text-xs text-muted">{b}</td>
                  <td className="px-5 py-3.5 font-mono text-xs">{a}</td>
                  <td className="px-5 py-3.5"><StatusChip status={s} /></td>
                  <td className="px-5 py-3.5 font-mono text-xs text-muted">{time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
