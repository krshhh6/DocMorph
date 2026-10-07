import { useState, useRef } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Download, FileText, RotateCcw, RotateCw, Sparkles, Upload, X, ArrowLeft, ArrowRight, Trash2, Plus, ArrowUpDown, Check, FileCheck, GripVertical, ExternalLink, Cpu } from 'lucide-react'
import { Card, Eyebrow, PrimaryButton, StatsStrip, StatusChip, TagChip } from './ui'
import { PassportFace } from './Workspace'
import { auditImageClient, detectGeminiSparkle } from '../forensicsClient'
import type { QualityReport } from '../qualityGate'


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

interface FileCardItem {
  id: string
  file: File
  name: string
  previewUrl: string
  size: string
  rotation: number
  isImage: boolean
}

interface ConvertedResult {
  url: string
  name: string
  size: string
  count: number
}

/* 01 Converter */
export function Converter() {
  const [fmt, setFmt] = useState('PDF')
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
  const [pageSize, setPageSize] = useState('A4 (297x210 mm)')
  const [margin, setMargin] = useState<'none' | 'small' | 'big'>('none')
  const [mergeAll, setMergeAll] = useState(true)
  const [files, setFiles] = useState<FileCardItem[]>([])
  const [isConverting, setIsConverting] = useState(false)
  const [convertedResult, setConvertedResult] = useState<ConvertedResult | null>(null)
  const addFilesInputRef = useRef<HTMLInputElement>(null)
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  const handleDropReorder = (fromIdx: number | null, toIdx: number) => {
    if (fromIdx === null || fromIdx === toIdx) return
    setFiles(prev => {
      const next = [...prev]
      const [movedItem] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, movedItem)
      return next
    })
    setDraggedIdx(null)
    setDragOverIdx(null)
  }

  const handleAddFiles = (fileList: FileList) => {
    const newItems: FileCardItem[] = Array.from(fileList).map(f => {
      const isImg = f.type.startsWith('image/')
      return {
        id: Math.random().toString(36).substring(7),
        file: f,
        name: f.name,
        previewUrl: isImg ? URL.createObjectURL(f) : '',
        size: f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} MB` : `${Math.round(f.size / 1024)} KB`,
        rotation: 0,
        isImage: isImg,
      }
    })
    setFiles(prev => [...prev, ...newItems])
  }

  const moveFile = (index: number, direction: -1 | 1) => {
    setFiles(prev => {
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      const temp = next[index]
      next[index] = next[target]
      next[target] = temp
      return next
    })
  }

  const rotateFile = (id: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, rotation: (f.rotation + 90) % 360 } : f))
  }

  const removeFile = (id: string) => {
    setFiles(prev => {
      const item = prev.find(f => f.id === id)
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
      return prev.filter(f => f.id !== id)
    })
  }

  const sortFiles = () => {
    setFiles(prev => [...prev].sort((a, b) => a.name.localeCompare(b.name)))
  }

  const clearAll = () => {
    files.forEach(f => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl) })
    setFiles([])
    setConvertedResult(null)
  }

  const runConversion = async () => {
    if (files.length === 0) {
      alert('Please select files first!')
      return
    }

    setIsConverting(true)
    try {
      const allImages = files.every(f => f.isImage)
      if (fmt === 'PDF' && mergeAll && allImages) {
        const formData = new FormData()
        formData.append('orientation', orientation)
        files.forEach(f => formData.append('files', f.file))

        const res = await fetch(`${BACKEND_URL}/api/merge-images-to-pdf`, {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const err = await res.text()
          throw new Error(err || 'Merge failed')
        }

        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        setConvertedResult({
          url,
          name: 'docmorph_merged.pdf',
          size: `${(blob.size / 1024).toFixed(1)} KB`,
          count: files.length,
        })
      } else {
        const first = files[0]
        const formData = new FormData()
        formData.append('file', first.file)
        formData.append('target_format', fmt)

        const res = await fetch(`${BACKEND_URL}/api/convert`, {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const err = await res.text()
          throw new Error(err || 'Conversion failed')
        }

        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const baseName = first.name.substring(0, first.name.lastIndexOf('.')) || first.name
        const outExt = fmt.toLowerCase() === 'jpg' ? 'jpg' : fmt.toLowerCase()

        setConvertedResult({
          url,
          name: `${baseName}.${outExt}`,
          size: `${(blob.size / 1024).toFixed(1)} KB`,
          count: 1,
        })
      }
    } catch (err: any) {
      alert('Conversion error: ' + err.message)
    } finally {
      setIsConverting(false)
    }
  }

  // View: Success / Dedicated Download Screen
  if (convertedResult) {
    return (
      <Card className="p-8 md:p-16 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
          <CheckCircle2 size={42} />
        </div>
        <h2 className="mt-6 text-3xl font-extrabold tracking-tight">Your {convertedResult.name.endsWith('.pdf') ? 'PDF' : 'file'} is ready!</h2>
        <p className="mt-2 text-sm text-body">
          Successfully processed {convertedResult.count} file{convertedResult.count > 1 ? 's' : ''} with DocMorph Engine.
        </p>

        <div className="mx-auto mt-6 flex max-w-sm items-center justify-between rounded-[16px] border border-line-warm bg-msurf p-4 text-left">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-card text-amber-ink">
              <FileCheck size={20} />
            </span>
            <div>
              <p className="font-semibold text-sm truncate max-w-[200px]" title={convertedResult.name}>{convertedResult.name}</p>
              <p className="font-mono text-[11px] text-muted">{convertedResult.size}</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-600">READY</span>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a
            href={convertedResult.url}
            download={convertedResult.name}
            className="inline-flex items-center gap-2 rounded-[14px] bg-red-600 px-8 py-3.5 font-bold text-white shadow-lg shadow-red-600/25 transition-all hover:bg-red-700 hover:scale-[1.02]"
          >
            <Download size={18} /> Download {convertedResult.name.endsWith('.pdf') ? 'PDF' : 'File'}
          </a>
          <button
            onClick={() => {
              URL.revokeObjectURL(convertedResult.url)
              setConvertedResult(null)
            }}
            className="inline-flex items-center gap-2 rounded-[14px] border border-line-warm bg-card px-6 py-3.5 text-sm font-semibold transition-colors hover:border-ink"
          >
            <RotateCcw size={15} /> Back to Organizer
          </button>
        </div>
      </Card>
    )
  }

  // View: No files uploaded yet (initial dropzone)
  if (files.length === 0) {
    return (
      <>
        <ToolHeader
          n="01"
          name="Universal Converter"
          title="Image & Document to PDF"
          desc="Organize, rotate and merge multiple images or documents into a single professional PDF."
          stats={[
            ['Formats', '5'],
            ['Reorder', 'Interactive'],
            ['Orientation', 'Portrait / Landscape'],
            ['Engine', 'Railway LibreOffice']
          ]}
        />
        <Card className="p-8 md:p-14">
          <div className="mx-auto max-w-xl">
            <Dropzone text="Drop images or documents here to organize & convert" onFiles={handleAddFiles} />
          </div>
        </Card>
      </>
    )
  }

  // View: Interactive iLovePDF-style Organizer & Options Panel
  return (
    <>
      <ToolHeader
        n="01"
        name="Universal Converter"
        title="Organize & Convert Files"
        desc="Drag, reorder, rotate your pages, configure page orientation and download your final PDF."
        stats={[
          ['Selected', `${files.length} Files`],
          ['Target Format', fmt],
          ['Orientation', orientation.toUpperCase()],
          ['Backend', 'Railway Online']
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left: Interactive Card Grid */}
        <Card className="flex flex-col gap-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line-warm pb-4">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-btn text-btn-ink px-3 py-1 font-mono text-xs font-semibold">
                {files.length} file{files.length > 1 ? 's' : ''}
              </span>
              <span className="font-mono text-xs text-muted">Drag & drop cards to reorder, or use arrows</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={sortFiles}
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-line-warm bg-card px-3 py-1.5 font-mono text-xs text-body hover:border-ink"
                title="Sort A to Z"
              >
                <ArrowUpDown size={13} /> Sort A-Z
              </button>
              <button
                onClick={clearAll}
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-line-warm bg-card px-3 py-1.5 font-mono text-xs text-body hover:border-danger hover:text-danger"
              >
                <Trash2 size={13} /> Clear
              </button>
              <button
                onClick={() => addFilesInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-red-600 text-white px-3.5 py-1.5 font-mono text-xs font-semibold hover:bg-red-700 shadow-sm"
              >
                <Plus size={14} /> Add more files
              </button>
              <input
                ref={addFilesInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={e => {
                  if (e.target.files) handleAddFiles(e.target.files)
                  e.target.value = ''
                }}
              />
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {files.map((item, idx) => (
              <div
                key={item.id}
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', String(idx))
                  e.dataTransfer.effectAllowed = 'move'
                  setDraggedIdx(idx)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                }}
                onDragEnter={() => {
                  if (draggedIdx !== null && draggedIdx !== idx) {
                    setDragOverIdx(idx)
                  }
                }}
                onDragLeave={() => {
                  if (dragOverIdx === idx) {
                    setDragOverIdx(null)
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  handleDropReorder(draggedIdx, idx)
                }}
                onDragEnd={() => {
                  setDraggedIdx(null)
                  setDragOverIdx(null)
                }}
                className={`group relative flex flex-col overflow-hidden rounded-[16px] border bg-card shadow-sm transition-all duration-200 cursor-grab active:cursor-grabbing select-none ${
                  draggedIdx === idx ? 'opacity-40 scale-95 border-dashed border-red-500' : ''
                } ${
                  dragOverIdx === idx ? 'ring-2 ring-red-600 scale-[1.03] border-red-600 shadow-xl z-20' : 'border-line-warm hover:shadow-md hover:border-ink'
                }`}
              >
                {/* Order Index badge & Drag Handle */}
                <div className="absolute left-2.5 top-2.5 z-10 flex items-center gap-1 rounded-full bg-black/75 px-2 py-0.5 text-white shadow backdrop-blur">
                  <GripVertical size={11} className="text-white/70" />
                  <span className="font-mono text-[10px] font-bold">
                    {idx + 1}
                  </span>
                </div>

                {/* Card Top Actions */}
                <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full bg-black/60 p-1 opacity-90 backdrop-blur transition-opacity">
                  {item.isImage && (
                    <button
                      onClick={() => rotateFile(item.id)}
                      className="grid h-6 w-6 place-items-center rounded-full text-white hover:bg-white/20"
                      title="Rotate 90°"
                    >
                      <RotateCw size={12} />
                    </button>
                  )}
                  <button
                    onClick={() => removeFile(item.id)}
                    className="grid h-6 w-6 place-items-center rounded-full text-white hover:bg-red-600"
                    title="Remove"
                  >
                    <X size={12} />
                  </button>
                </div>

                {/* Thumbnail Preview Area */}
                <div className="flex h-48 items-center justify-center overflow-hidden bg-msurf p-3">
                  {item.isImage ? (
                    <img
                      src={item.previewUrl}
                      alt={item.name}
                      style={{ transform: `rotate(${item.rotation}deg)` }}
                      className="max-h-full max-w-full rounded object-contain transition-transform duration-200"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted">
                      <FileText size={36} />
                      <span className="font-mono text-[10px] uppercase">{item.name.split('.').pop()}</span>
                    </div>
                  )}
                </div>

                {/* Card Footer with Details & Reorder Arrows */}
                <div className="flex items-center justify-between border-t border-line-warm bg-card px-3 py-2">
                  <div className="min-w-0 pr-2">
                    <p className="truncate text-xs font-semibold" title={item.name}>{item.name}</p>
                    <p className="font-mono text-[10px] text-muted">{item.size}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      disabled={idx === 0}
                      onClick={() => moveFile(idx, -1)}
                      className="grid h-6 w-6 place-items-center rounded border border-line bg-msurf text-muted hover:border-ink hover:text-ink disabled:opacity-30"
                      title="Move Left"
                    >
                      <ArrowLeft size={11} />
                    </button>
                    <button
                      disabled={idx === files.length - 1}
                      onClick={() => moveFile(idx, 1)}
                      className="grid h-6 w-6 place-items-center rounded border border-line bg-msurf text-muted hover:border-ink hover:text-ink disabled:opacity-30"
                      title="Move Right"
                    >
                      <ArrowRight size={11} />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Quick Add More Tile */}
            <div
              onClick={() => addFilesInputRef.current?.click()}
              className="flex min-h-[190px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[16px] border-2 border-dashed border-line-warm bg-msurf/50 p-6 text-center transition-all duration-200 hover:border-ink hover:bg-card"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-card shadow-sm text-body">
                <Plus size={18} />
              </span>
              <span className="text-xs font-semibold">Add more</span>
            </div>
          </div>
        </Card>

        {/* Right: Options Panel (styled just like iLovePDF) */}
        <Card className="flex flex-col justify-between gap-6 p-6">
          <div className="flex flex-col gap-6">
            <div>
              <Eyebrow className="text-amber-ink">Conversion Settings</Eyebrow>
              <h3 className="mt-1 text-xl font-bold tracking-tight">Image to {fmt} options</h3>
            </div>

            {/* Target format */}
            <div>
              <label className="mb-2 block font-mono text-[11px] uppercase tracking-wider text-muted">Output Format</label>
              <Seg options={['PDF', 'DOCX', 'PNG', 'JPG', 'WEBP']} value={fmt} onChange={setFmt} />
            </div>

            {/* Page Orientation */}
            {fmt === 'PDF' && (
              <div>
                <label className="mb-2 block font-mono text-[11px] uppercase tracking-wider text-muted">Page orientation</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setOrientation('portrait')}
                    className={`flex flex-col items-center justify-center gap-2 rounded-[14px] border p-4 transition-all ${
                      orientation === 'portrait' ? 'border-red-600 bg-red-600/5 text-red-600 font-semibold shadow-sm' : 'border-line-warm bg-card text-body hover:border-ink'
                    }`}
                  >
                    <div className="h-8 w-6 rounded border-2 border-current" />
                    <span className="text-xs">Portrait</span>
                  </button>
                  <button
                    onClick={() => setOrientation('landscape')}
                    className={`flex flex-col items-center justify-center gap-2 rounded-[14px] border p-4 transition-all ${
                      orientation === 'landscape' ? 'border-red-600 bg-red-600/5 text-red-600 font-semibold shadow-sm' : 'border-line-warm bg-card text-body hover:border-ink'
                    }`}
                  >
                    <div className="h-6 w-8 rounded border-2 border-current" />
                    <span className="text-xs">Landscape</span>
                  </button>
                </div>
              </div>
            )}

            {/* Page Size */}
            {fmt === 'PDF' && (
              <div>
                <label className="mb-2 block font-mono text-[11px] uppercase tracking-wider text-muted">Page size</label>
                <select
                  value={pageSize}
                  onChange={e => setPageSize(e.target.value)}
                  className="w-full rounded-[12px] border border-line-warm bg-msurf px-3 py-2.5 text-xs font-mono focus:border-ink focus:outline-none"
                >
                  <option value="A4 (297x210 mm)">A4 (297x210 mm)</option>
                  <option value="US Letter">US Letter (8.5x11 in)</option>
                  <option value="Fit (same as image)">Fit (same as image)</option>
                </select>
              </div>
            )}

            {/* Margin */}
            {fmt === 'PDF' && (
              <div>
                <label className="mb-2 block font-mono text-[11px] uppercase tracking-wider text-muted">Margin</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['none', 'small', 'big'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setMargin(m)}
                      className={`rounded-[10px] border py-2 text-center font-mono text-xs capitalize transition-all ${
                        margin === m ? 'border-red-600 bg-red-600/5 text-red-600 font-semibold' : 'border-line-warm bg-card text-body hover:border-ink'
                      }`}
                    >
                      {m === 'none' ? 'No margin' : m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Merge Checkbox */}
            {fmt === 'PDF' && files.length > 1 && (
              <label className="flex cursor-pointer items-center gap-3 rounded-[12px] border border-line-warm bg-msurf p-3 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={mergeAll}
                  onChange={e => setMergeAll(e.target.checked)}
                  className="h-4 w-4 rounded accent-red-600"
                />
                <span>Merge all images in one PDF file</span>
              </label>
            )}
          </div>

          {/* Big Prominent Action Button */}
          <button
            onClick={runConversion}
            disabled={isConverting}
            className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-red-600 py-4 font-bold text-white shadow-lg shadow-red-600/30 transition-all hover:bg-red-700 hover:scale-[1.01] disabled:opacity-50"
          >
            {isConverting ? (
              <span>Converting...</span>
            ) : (
              <>
                <span>Convert to {fmt}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </Card>
      </div>
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
  const [resume, setResume] = useState<File | null>(null)
  const [jobDescription, setJobDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const C = 2 * Math.PI * 70

  const analyzeResume = async () => {
    if (!resume) {
      setError('Please upload your resume first.')
      return
    }

    if (!jobDescription.trim()) {
      setError('Please enter a job description.')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', resume)
      formData.append('job_description', jobDescription)

      const response = await fetch(
        'http://localhost:8000/api/ats/analyze',
        {
          method: 'POST',
          body: formData,
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'ATS analysis failed.')
      }

      setResult(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong while analyzing the resume.'
      )
    } finally {
      setLoading(false)
    }
  }

  const score = result?.match_score ?? 0

  const missingKeywords: [string, 'High' | 'Med' | 'Low'][] =
    (result?.missing_keywords ?? []).map(
      (keyword: string, index: number) => [
        keyword,
        index < 3 ? 'High' : index < 6 ? 'Med' : 'Low',
      ]
    )

  const sev = {
    High: 'bg-danger/10 text-danger',
    Med: 'bg-warn-pale text-warn',
    Low: 'bg-msurf text-muted',
  }

  const getMatchLabel = () => {
    if (!result) return 'Waiting for scan'
    if (score >= 75) return 'Strong match'
    if (score >= 50) return 'Moderate match'
    return 'Needs improvement'
  }

  return (
    <>
      <ToolHeader
        n="03"
        name="ATS Resume Optimizer"
        title="ATS Resume Optimizer"
        desc="Score a resume against a job description and fix what an applicant tracking system would reject."
        stats={[
          ['Match Score', result ? `${score}%` : '—'],
          ['Status', result ? result.prediction : 'Not scanned'],
          [
            'Missing Keywords',
            result ? String(result.missing_keywords?.length ?? 0) : '—',
          ],
          ['Word Count', result ? String(result.word_count) : '—'],
        ]}
      />

      <Workbench
        left={
          <>
            <Panel label="Resume" />

            <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-[16px] border border-dashed border-line-warm bg-msurf p-5 text-center transition hover:border-ink">
              <Upload size={22} className="mb-2 text-muted" />

              <span className="text-sm font-medium">
                {resume ? resume.name : 'Drop resume (PDF or DOCX)'}
              </span>

              <span className="mt-1 text-xs text-muted">
                PDF, DOCX or TXT
              </span>

              <input
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={(e) => {
                  setResume(e.target.files?.[0] ?? null)
                  setResult(null)
                  setError('')
                }}
              />
            </label>

            <Panel label="Job Description" />

            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job description here..."
              className="min-h-36 rounded-[16px] border border-line-warm bg-msurf p-4 text-sm leading-relaxed text-body outline-none focus:border-ink"
            />

            {error && (
              <p className="rounded-[12px] bg-danger/10 px-4 py-3 text-sm text-danger">
                {error}
              </p>
            )}

            <PrimaryButton
              sparkle
              className="self-start"
              onClick={analyzeResume}
              disabled={loading}
            >
              {loading ? 'Analyzing Resume...' : 'Analyze Resume'}
            </PrimaryButton>
          </>
        }

        right={
          <>
            <div className="flex items-center gap-6">
              <svg
                width="160"
                height="160"
                viewBox="0 0 160 160"
                className="shrink-0 -rotate-90"
              >
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  fill="none"
                  strokeWidth="10"
                  className="stroke-line-warm"
                />

                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  fill="none"
                  strokeWidth="10"
                  stroke="#FFD061"
                  strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={C * (1 - score / 100)}
                />

                <text
                  x="80"
                  y="88"
                  textAnchor="middle"
                  transform="rotate(90 80 80)"
                  className="fill-ink font-mono text-[30px] font-medium"
                >
                  {result ? `${score}%` : '—'}
                </text>
              </svg>

              <div>
                <Eyebrow className="text-muted">
                  Match Gauge
                </Eyebrow>

                <p className="mt-2 text-xl font-bold">
                  {getMatchLabel()}
                </p>

                {result && (
                  <p className="mt-1 font-mono text-xs text-muted">
                    Prediction: {result.prediction}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Eyebrow className="mb-3 text-muted">
                Missing Keywords
              </Eyebrow>

              {missingKeywords.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {missingKeywords.map(([keyword, severity]) => (
                    <span
                      key={keyword}
                      className="inline-flex items-center gap-2 rounded-full border border-line-warm py-1 pl-3 pr-1 text-xs"
                    >
                      {keyword}

                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[9px] uppercase ${sev[severity]}`}
                      >
                        {severity}
                      </span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">
                  {result
                    ? 'No major missing keywords detected.'
                    : 'Run an analysis to see missing keywords.'}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[16px] border border-line bg-line">
              <div className="bg-card p-4">
                <Eyebrow className="text-muted">
                  Prediction
                </Eyebrow>

                <p className="mt-2 font-mono text-lg">
                  {result?.prediction ?? '—'}
                </p>
              </div>

              <div className="bg-card p-4">
                <Eyebrow className="text-muted">
                  Words
                </Eyebrow>

                <p className="mt-2 font-mono text-2xl">
                  {result?.word_count ?? '—'}
                </p>
              </div>
            </div>

            <ul className="flex flex-col divide-y divide-line rounded-[16px] border border-line">
              {[
                ['Resume uploaded', !!resume],
                ['Job description added', !!jobDescription.trim()],
                ['ATS analysis completed', !!result],
                ['Missing keywords checked', !!result],
              ].map(([text, ok]) => (
                <li
                  key={text as string}
                  className="flex items-center gap-3 px-4 py-3 text-sm"
                >
                  {ok ? (
                    <CheckCircle2 size={16} className="text-ok" />
                  ) : (
                    <AlertTriangle size={16} className="text-warn" />
                  )}

                  {text}
                </li>
              ))}
            </ul>
          </>
        }
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
  const [mode, setMode] = useState<'Video' | 'Image'>('Image')
  const [scan, setScan] = useState<'idle' | 'scanning' | 'done'>('idle')
  const [file, setFile] = useState<{ raw: File; url: string; name: string; size: string } | null>(null)
  const [frame, setFrame] = useState(62)

  // Inspection Results State
  const [result, setResult] = useState<{
    verdict: string
    verdictType: 'danger' | 'warn' | 'ok' | 'info'
    risk: number | null
    realProb: number | null
    summary: string
    caveat?: string | null
    quality?: QualityReport
    details: {
      test: string
      reading: string
      result: string
      statusType: 'danger' | 'warn' | 'ok' | 'info'
    }[]
  } | null>(null)
  const [showRawSignals, setShowRawSignals] = useState(false)

  const pick = (f?: File) => {
    if (!f) return
    if (file) URL.revokeObjectURL(file.url)
    const isVid = f.type.startsWith('video')
    setMode(isVid ? 'Video' : 'Image')
    setFile({
      raw: f,
      url: URL.createObjectURL(f),
      name: f.name,
      size: f.size > 1e6 ? `${(f.size / 1e6).toFixed(1)} MB` : `${Math.round(f.size / 1e3)} KB`
    })
    setScan('idle')
    setResult(null)
    setShowRawSignals(false)
  }

  const clear = () => {
    if (file) URL.revokeObjectURL(file.url)
    setFile(null)
    setScan('idle')
    setResult(null)
    setShowRawSignals(false)
  }

  const isVideo = mode === 'Video'
  const flagged = [18, 22, 23, 41, 58, 60, 61, 62, 63, 64, 77, 81, 82, 90]
  const C = 2 * Math.PI * 70

  const runAudit = async () => {
    if (!file) return
    setScan('scanning')
    const startTime = Date.now()
    // Random scanning duration between 3.0s and 5.0s (3000ms - 5000ms)
    const targetScanDuration = Math.floor(Math.random() * 2000) + 3000

    const waitRemainingTime = async () => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, targetScanDuration - elapsed)
      if (remaining > 0) {
        await new Promise(r => setTimeout(r, remaining))
      }
    }

    // 1. Try Backend Forensics API (localhost:8000 when local, or Railway when deployed)
    try {
      const formData = new FormData()
      formData.append('file', file.raw)

      const backendCandidates: string[] = []
      if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        backendCandidates.push('http://localhost:8000')
      }
      backendCandidates.push(BACKEND_URL)

      for (const base of backendCandidates) {
        try {
          const res = await fetch(`${base}/api/forensics/scan-image`, {
            method: 'POST',
            body: formData,
            signal: AbortSignal.timeout(6000),
          })
          if (res.ok) {
            const data = await res.json()

            // If backend missed the watermark or returned None, cross-check with client detector
            const wmRow = data.details?.find((d: any) => d.test === 'AI Watermark Scan')
            if (wmRow && (wmRow.reading === 'None' || wmRow.result === 'Clean')) {
              try {
                const img = new Image()
                img.src = file.url
                await new Promise(r => {
                  img.onload = r
                  img.onerror = r
                })
                const wmCheck = await detectGeminiSparkle(img)
                if (wmCheck.hasWatermark) {
                  wmRow.reading = 'Google Gemini Sparkle'
                  wmRow.result = 'AI Watermark Found'
                  wmRow.statusType = 'danger'
                  data.verdict = 'Confirmed AI Generated'
                  data.verdictType = 'danger'
                  data.risk = 100
                  data.realProb = 0
                  data.summary = 'Official AI provenance detected (Google Gemini Sparkle Watermark).'
                }
              } catch (_) {}
            }

            await waitRemainingTime()
            setResult({
              verdict: data.verdict,
              verdictType: data.verdictType || (data.verdict.includes('Confirmed') || data.verdict.includes('Deepfake') ? 'danger' : data.verdict.includes('Likely') ? 'warn' : data.verdict === 'Inconclusive' ? 'info' : 'ok'),
              risk: data.risk,
              realProb: data.realProb,
              summary: data.summary,
              caveat: data.caveat,
              quality: data.quality,
              details: data.details,
            })
            setScan('done')
            return
          }
        } catch (_) {
          // Continue to next candidate or client engine
        }
      }
    } catch (_) {
      // Backend not reached, fall back to in-browser algorithmic engine
    }

    // 2. Client-Side Algorithmic Forensics Engine (Runs directly in browser for Vercel/offline)
    try {
      const img = new Image()
      img.src = file.url
      await new Promise(r => {
        img.onload = r
        img.onerror = r
      })
      const clientResult = await auditImageClient(file.raw, img)
      await waitRemainingTime()
      setResult(clientResult)
      setScan('done')
    } catch (err) {
      console.error('Forensic scan error:', err)
      await waitRemainingTime()
      setScan('done')
    }
  }

  const isReduced = result?.quality?.confidence === 'reduced'
  const isInconclusive = result?.verdict === 'Inconclusive'
  const currentScore = result ? result.risk : (isVideo ? 87 : 59)
  const currentVerdict = result
    ? (result.verdictType === 'danger'
        ? ['Confirmed AI Generated', 'text-danger', 'bg-danger/10']
        : result.verdictType === 'warn'
        ? ['Likely AI Generated', 'text-warn', 'bg-warn-pale']
        : result.verdictType === 'info' || isInconclusive
        ? ['Inconclusive', 'text-muted', 'bg-msurf']
        : [isReduced ? 'Likely Real' : 'Authentic Real Photo', 'text-ok', 'bg-ok-pale'])
    : (isVideo
        ? ['Likely Manipulated', 'text-danger', 'bg-danger/10']
        : ['Awaiting Scan', 'text-muted', 'bg-msurf'])

  return (
    <>
      <ToolHeader
        n="06"
        name="Deepfake Detector"
        title="Deepfake Image & Video Detector"
        desc="Scan a photo or clip for face swaps, generator fingerprints, and image tampering with detailed forensic proof."
        stats={[
          ['Verdict', result ? result.verdict : 'Ready'],
          ['AI Risk', scan === 'done' ? (result?.risk !== null && result?.risk !== undefined ? `${result.risk}%` : '—') : '—'],
          ['Confidence', result?.quality ? (result.quality.confidence === 'high' ? 'High' : result.quality.confidence === 'reduced' ? 'Reduced' : 'Unreliable') : 'Standard'],
          ['Forensic Engine', 'Multi-Parametric v2']
        ]}
      />

      <Workbench
        left={<>
          <Panel label="Media" action={<span className="font-mono text-[10px] text-muted">{file ? `${file.name.toUpperCase()} · ${file.size}` : 'NO FILE SELECTED'}</span>} />
          <Seg options={['Image', 'Video']} value={mode} onChange={v => { if (v !== mode) clear(); setMode(v as 'Image' | 'Video') }} />
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
          <PrimaryButton sparkle onClick={runAudit} className={`self-start ${file && scan !== 'scanning' ? '' : 'pointer-events-none opacity-50'}`}>
            {scan === 'scanning' ? 'Scanning Image…' : file ? 'Scan Image' : 'Upload a file to scan'}
          </PrimaryButton>
        </>}
        right={<>
          {isInconclusive ? (
            <div className="flex flex-col gap-4 rounded-[17.6px] border border-line-warm bg-msurf/60 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-line-warm bg-card text-muted">
                    <AlertTriangle size={18} className="text-warn" />
                  </span>
                  <div>
                    <Eyebrow className="text-muted">Forensic Quality Gate</Eyebrow>
                    <h4 className="text-base font-bold text-ink">Inconclusive — Assessment Abstained</h4>
                  </div>
                </div>
                <span className="rounded-full border border-line-warm bg-card px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-muted">
                  {result.quality?.confidence === 'unreliable' ? 'Unreliable Media' : 'Uncertain Band'}
                </span>
              </div>

              <p className="text-xs leading-relaxed text-body">
                {result.summary}
              </p>

              {result.quality && result.quality.flags && result.quality.flags.length > 0 && (
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted">Hard Degradation Flags:</span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {result.quality.flags.map((f, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 rounded-full border border-line-warm bg-card px-2.5 py-1 font-mono text-[10px] text-body"
                      >
                        <span className="text-warn">⚠️</span>
                        {f.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Informational Notes */}
              {result.quality && result.quality.notes && result.quality.notes.length > 0 && (
                <div className="flex flex-col gap-1">
                  {result.quality.notes.map((note, i) => (
                    <p key={i} className="font-mono text-[10px] text-muted italic">
                      ℹ️ {note}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-warm/60 pt-3">
                <p className="font-mono text-[10px] text-muted">
                  Percentage gauge hidden to prevent false certainty on degraded media.
                </p>
                <button
                  type="button"
                  onClick={() => setShowRawSignals(prev => !prev)}
                  className="font-mono text-[11px] font-medium text-ink underline underline-offset-4 hover:text-muted cursor-pointer"
                >
                  {showRawSignals ? 'Hide raw signals' : 'Show raw signals'}
                </button>
              </div>
            </div>
          ) : (
            <div className={`flex items-center gap-6 transition-opacity duration-300 ${scan === 'done' ? '' : 'opacity-40'}`}>
              <svg width="150" height="150" viewBox="0 0 160 160" className="shrink-0 -rotate-90">
                <circle cx="80" cy="80" r="70" fill="none" strokeWidth="10" className="stroke-line-warm" />
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  fill="none"
                  strokeWidth="10"
                  stroke={currentVerdict[0].includes('Real') ? '#34D399' : '#FFD061'}
                  strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={scan === 'done' && currentScore !== null ? C * (1 - currentScore / 100) : C}
                  style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)' }}
                />
                <text x="80" y="88" textAnchor="middle" transform="rotate(90 80 80)" className="fill-ink font-mono text-[30px] font-medium">
                  {scan === 'done' && currentScore !== null ? `${currentScore}%` : '—'}
                </text>
              </svg>
              <div>
                <Eyebrow className="text-muted">AI Generated Risk</Eyebrow>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-[0.06em] ${currentVerdict[1]} ${currentVerdict[2]}`}>
                    {currentVerdict[0]}
                  </span>
                  {(isReduced || result?.caveat) && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-warn/40 bg-warn-pale px-2.5 py-0.5 font-mono text-[10px] font-medium text-warn">
                      ⚠️ Reduced confidence
                    </span>
                  )}
                </div>

                {/* Soft flags */}
                {result?.quality?.flags && result.quality.flags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {result.quality.flags.map((f, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-full border border-line-warm bg-card px-2 py-0.5 font-mono text-[10px] text-body"
                      >
                        ⚠️ {f.label}
                      </span>
                    ))}
                  </div>
                )}

                {/* Notes in small grey text, never counted against image */}
                {result?.quality?.notes && result.quality.notes.length > 0 && (
                  <div className="mt-2 flex flex-col gap-0.5">
                    {result.quality.notes.map((note, i) => (
                      <p key={i} className="font-mono text-[10px] text-muted italic">
                        ℹ️ {note}
                      </p>
                    ))}
                  </div>
                )}

                {result ? (
                  <p className="mt-2 text-xs text-body leading-relaxed">{result.summary}</p>
                ) : (
                  <p className="mt-2 text-xs text-muted">Upload an image or clip to begin inspection.</p>
                )}
              </div>
            </div>
          )}

          {/* Inspection Details Section */}
          {(!isInconclusive || showRawSignals) && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted">
                  {isInconclusive ? 'Raw Forensic Signals (Low Confidence)' : 'Inspection Details'}
                </h3>
                {result && (
                  <span className="font-mono text-[10px] text-muted">
                    {result.realProb !== null && result.risk !== null
                      ? `Real: ${result.realProb}% · AI: ${result.risk}%`
                      : 'Signals Unreliable (Abstained)'}
                  </span>
                )}
              </div>

              <div className="overflow-hidden rounded-[16px] border border-line bg-card shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-line bg-soft font-mono text-[11px] uppercase text-muted">
                      <th className="px-4 py-2.5 font-medium">Test</th>
                      <th className="px-4 py-2.5 font-medium">Reading</th>
                      <th className="px-4 py-2.5 font-medium">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {(result ? result.details : [
                      { test: 'AI Generator Check (Midjourney/DALL-E)', reading: '—', result: 'Pending', statusType: 'info' as const },
                      { test: 'Face Swap / Deepfake Check', reading: '—', result: 'Pending', statusType: 'info' as const },
                      { test: 'AI Watermark Scan', reading: '—', result: 'Pending', statusType: 'info' as const },
                      { test: 'Photo Editing & Splicing (ELA)', reading: '—', result: 'Pending', statusType: 'info' as const },
                      { test: 'Camera Lens Physics', reading: '—', result: 'Pending', statusType: 'info' as const },
                      { test: 'Camera Device Info', reading: '—', result: 'Pending', statusType: 'info' as const },
                      { test: 'AI Digital Signature (C2PA)', reading: '—', result: 'Pending', statusType: 'info' as const },
                    ]).map((row, i) => (
                      <tr key={i} className={`transition-colors hover:bg-msurf/50 ${row.statusType === 'info' ? 'opacity-75' : ''}`}>
                        <td className="px-4 py-2.5 font-medium text-body">{row.test}</td>
                        <td className="px-4 py-2.5 font-mono text-muted">{row.reading}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-medium ${
                            row.statusType === 'danger'
                              ? 'text-danger'
                              : row.statusType === 'warn'
                              ? 'text-warn'
                              : row.statusType === 'ok'
                              ? 'text-ok'
                              : 'text-muted'
                          }`}>
                            {row.statusType === 'danger' && '🚨 '}
                            {row.statusType === 'warn' && '⚠️ '}
                            {row.statusType === 'ok' && '✅ '}
                            {row.statusType === 'info' && 'ℹ️ '}
                            {row.result}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <button
            onClick={() => {
              if (!result) return
              const reportText = `DocMorph Forensic Audit Report\nFile: ${file?.name}\nVerdict: ${result.verdict}\nAI Risk: ${result.risk !== null ? `${result.risk}%` : 'Inconclusive (Abstained)'}\nSummary: ${result.summary}\n\nQuality Gate: ${result.quality?.reliable ? 'Reliable' : `Degraded (${result.quality?.reasons.join(', ')})`}\n\nDetails:\n` +
                result.details.map(d => `- ${d.test}: ${d.reading} (${d.result})`).join('\n') +
                `\n\nNotice: Results are most reliable on original, uncompressed camera files.`
              const blob = new Blob([reportText], { type: 'text/plain' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `forensic_report_${file?.name || 'scan'}.txt`
              a.click()
              URL.revokeObjectURL(url)
            }}
            className={`inline-flex items-center gap-2 self-start rounded-[12px] border border-line-warm px-4 py-2.5 text-sm font-medium transition-colors duration-200 hover:border-ink ${result ? '' : 'pointer-events-none opacity-40'}`}
          >
            <Download size={14} />
            Export Evidence Report
          </button>

          {/* Quality Disclaimer Footer */}
          <div className="mt-auto flex items-center justify-between border-t border-line pt-3 font-mono text-[11px] text-muted">
            <span>Results are most reliable on original, uncompressed camera files.</span>
            <span className="hidden sm:inline">DocMorph Forensics v2.2</span>
          </div>
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
