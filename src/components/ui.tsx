import type { ReactNode } from 'react'
import { ArrowUpRight, Sparkles } from 'lucide-react'

export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-label="DocMorph">
      <path d="M10 6h18l10 10v26H10z" className="fill-btn" />
      <path d="M28 6v10h10" className="stroke-page" strokeWidth="2.5" />
      <circle cx="24" cy="29" r="7" fill="#FFD061" />
      <path d="M17 29h14" className="stroke-btn" strokeWidth="2.5" />
    </svg>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rise rounded-[24px] border border-line bg-card ${className}`}>{children}</section>
}

export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`font-mono text-[10px] uppercase tracking-[0.16em] ${className}`}>{children}</p>
}

export function PrimaryButton({ children, onClick, sparkle, className = '' }: { children: ReactNode; onClick?: () => void; sparkle?: boolean; className?: string }) {
  return (
    <button onClick={onClick} className={`inline-flex min-h-12 items-center gap-6 rounded-[12px] bg-btn px-6 text-sm font-semibold text-btn-ink transition-colors duration-200 hover:opacity-90 ${className}`}>
      <span className="flex items-center gap-2">
        {sparkle && <Sparkles size={15} className="text-amber" />}
        {children}
      </span>
      <ArrowUpRight size={16} className="text-amber" />
    </button>
  )
}

export function ArrowLink({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 border-b border-zinc-300 pb-1 text-sm font-medium text-body transition-colors duration-200 hover:border-ink hover:text-ink dark:border-zinc-700">
      {children}
      <ArrowUpRight size={13} />
    </button>
  )
}

export function TagChip({ children }: { children: ReactNode }) {
  return <span className="inline-flex rounded-full border border-line-warm px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-body">{children}</span>
}

export function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col justify-between gap-3 px-4 py-4">
      <p className="font-mono text-[9px] font-medium uppercase leading-tight tracking-[0.06em] text-muted">{label}</p>
      <p className="font-mono text-2xl font-medium tracking-tight">{value}</p>
    </div>
  )
}

export function StatsStrip({ stats }: { stats: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 divide-line border-line sm:grid-cols-4 sm:divide-x [&>*]:border-line max-sm:[&>*:nth-child(odd)]:border-r max-sm:[&>*:nth-child(-n+2)]:border-b">
      {stats.map(([l, v]) => <StatCell key={l} label={l} value={v} />)}
    </div>
  )
}

export function FeatureCard({ index, title, text, spec: [metric, unit, fill] }: { index: number; title: string; text: string; spec: [string, string, number] }) {
  return (
    <article className="rise group flex flex-col rounded-[24px] border border-line bg-card p-5 transition-colors duration-200 hover:border-ink md:p-6" style={{ ['--d' as string]: `${index * 90}ms` }}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.16em] text-muted">0{index + 1}</span>
        <Sparkles size={13} className="text-amber opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      </div>
      <p className="mt-10 font-mono text-[clamp(28px,3vw,40px)] font-medium leading-none tracking-tight">{metric}</p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.06em] text-muted">{unit}</p>
      <div className="mt-5 h-1 overflow-hidden rounded-full bg-msurf">
        <div className="bar h-full rounded-full bg-btn" style={{ ['--w' as string]: `${fill}%` }} />
      </div>
      <h3 className="mt-6 font-bold">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted">{text}</p>
    </article>
  )
}

export function ModuleCard({ n, title, sub, desc, tag, onClick }: { n: string; title: string; sub: string; desc: string; tag: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="rise flex flex-col items-start rounded-[24px] border border-line bg-card p-6 text-left transition-colors duration-200 hover:border-ink" style={{ ["--d" as string]: `${(+n - 1) % 3 * 90}ms` }}>
      <div className="flex w-full items-start justify-between">
        <span className="font-mono text-xs text-muted">{n}</span>
        <ArrowUpRight size={14} className="text-muted" />
      </div>
      <h3 className="mt-8 text-lg font-bold tracking-tight">{title}</h3>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-amber-ink">{sub}</p>
      <p className="mt-3 text-sm text-muted">{desc}</p>
      <div className="mt-5"><TagChip>{tag}</TagChip></div>
    </button>
  )
}

export function StatusChip({ status }: { status: 'Done' | 'Processing' | 'Failed' | 'Queued' }) {
  const map = {
    Done: 'bg-ok-pale text-ok',
    Processing: 'bg-warn-pale text-warn',
    Failed: 'bg-danger/10 text-danger',
    Queued: 'bg-msurf text-muted',
  }
  return <span className={`inline-flex rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] ${map[status]}`}>{status}</span>
}
