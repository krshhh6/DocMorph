import { useEffect, useRef } from 'react'
import { ScanFace, Clock, FileCheck2, Home, Minimize2, Smartphone, Sparkles, Sun, Moon, SquareUser, Users, Grid2X2, Menu, X } from 'lucide-react'
import { Logo } from './ui'
import LoadingScreen from './LoadingScreen'

export type PageId = 'home' | 'converter' | 'compressor' | 'ats' | 'passport' | 'summarizer' | 'deepfake' | 'history' | 'team'

export const NAV: { id: PageId; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Workspace', icon: Home },
  { id: 'converter', label: '01 Converter', icon: Smartphone },
  { id: 'compressor', label: '02 Compressor', icon: Minimize2 },
  { id: 'ats', label: '03 ATS Resume Optimizer', icon: FileCheck2 },
  { id: 'passport', label: '04 Passport Photo Studio', icon: SquareUser },
  { id: 'summarizer', label: '05 AI Summarizer', icon: Sparkles },
  { id: 'deepfake', label: '06 Deepfake Detector', icon: ScanFace },
  { id: 'history', label: '07 Processing History', icon: Clock },
  { id: 'team', label: '08 Our Team', icon: Users },
]

type Props = { page: PageId; go: (p: PageId) => void; dark: boolean; toggle: () => void }

function SidebarItem({ active, label, icon: Icon, onClick }: { active: boolean; label: string; icon: typeof Home; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={label} className={`group relative grid h-9 w-9 place-items-center rounded-[12px] transition-colors duration-200 ${active ? 'bg-strong text-page' : 'text-muted hover:bg-msurf hover:text-ink'}`}>
      <Icon size={16} strokeWidth={1.75} />
      <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-[8px] bg-[#18181b] px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:bg-zinc-100 dark:text-zinc-900">{label}</span>
    </button>
  )
}

export function Sidebar({ page, go, dark, toggle }: Props) {
  return (
    <nav className="fixed left-0 top-1/2 z-50 hidden -translate-y-1/2 flex-col items-center gap-4 rounded-r-[24px] border border-l-0 border-line-warm bg-nav px-2.5 py-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:flex">
      <button onClick={() => go('home')} className="grid h-9 w-9 place-items-center rounded-[12px] hover:bg-msurf" aria-label="DocMorph home"><Logo /></button>
      <div className="h-px w-6 bg-line-warm" />
      <div className="flex flex-col items-center gap-1.5">
        <span className="font-mono text-[8px] font-medium tracking-[0.1em] text-muted">THEME</span>
        <button onClick={toggle} aria-label="Toggle theme" className="relative h-14 w-7 rounded-full border border-line-warm bg-msurf">
          <span className={`absolute left-[3px] grid h-5 w-5 place-items-center rounded-full bg-btn text-btn-ink transition-all duration-300 ${dark ? 'top-[3px]' : 'top-[31px]'}`}>
            {dark ? <Moon size={11} /> : <Sun size={11} />}
          </span>
        </button>
      </div>
      <div className="h-px w-6 bg-line-warm" />
      <div className="flex flex-col gap-1.5">
        {NAV.map(n => <SidebarItem key={n.id} active={page === n.id} label={n.label} icon={n.icon} onClick={() => go(n.id)} />)}
      </div>
    </nav>
  )
}

export function MobileBar({ page, go, dark, toggle }: Props) {
  const picker = useRef<HTMLDialogElement>(null)
  const toolsActive = !['home', 'history', 'team'].includes(page)
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)')
    const closeOnDesktop = () => { if (desktop.matches) picker.current?.close() }
    desktop.addEventListener('change', closeOnDesktop)
    return () => desktop.removeEventListener('change', closeOnDesktop)
  }, [])
  const select = (id: PageId) => {
    picker.current?.close()
    go(id)
  }
  return (
    <>
      <header className="mobile-header lg:hidden">
        <button onClick={() => select('home')} className="mobile-brand" aria-label="DocMorph home">
          <Logo size={28} />
          <span><span className="mobile-brand-name">DOCMORPH<span className="text-amber-ink">.</span></span><span className="mobile-brand-caption">FILE STUDIO PRO</span></span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={toggle} className="mobile-icon-button" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          <button onClick={() => picker.current?.showModal()} className="mobile-icon-button mobile-menu-button" aria-label="Open navigation menu" aria-haspopup="dialog"><Menu size={20} /></button>
        </div>
      </header>
      <nav aria-label="Mobile navigation" className="mobile-nav lg:hidden">
        <button onClick={() => select('home')} aria-current={page === 'home' ? 'page' : undefined} className={`mobile-nav-tab ${page === 'home' ? 'is-active' : ''}`}><Home size={19} /><span>Home</span></button>
        <button onClick={() => picker.current?.showModal()} aria-haspopup="dialog" aria-label={toolsActive ? `Tools: ${NAV.find(item => item.id === page)?.label}` : 'Browse tools'} className={`mobile-nav-tab ${toolsActive ? 'is-active' : ''}`}><Grid2X2 size={19} /><span>Tools</span></button>
        <button onClick={() => select('history')} aria-current={page === 'history' ? 'page' : undefined} className={`mobile-nav-tab ${page === 'history' ? 'is-active' : ''}`}><Clock size={19} /><span>History</span></button>
        <button onClick={() => select('team')} aria-current={page === 'team' ? 'page' : undefined} className={`mobile-nav-tab ${page === 'team' ? 'is-active' : ''}`}><Users size={19} /><span>Team</span></button>
      </nav>
      <dialog ref={picker} className="mobile-tool-picker" aria-labelledby="mobile-tools-title" onClick={event => { if (event.target === event.currentTarget) picker.current?.close() }}>
        <div className="mobile-picker-content">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div><p className="font-mono text-[10px] uppercase tracking-widest text-amber-ink">DocMorph / File Studio</p><h2 id="mobile-tools-title" className="mt-1 text-xl font-bold">Pick your tool</h2></div>
            <button autoFocus onClick={() => picker.current?.close()} className="mobile-icon-button" aria-label="Close tool picker"><X size={20} /></button>
          </div>
          <div className="grid gap-2">
            {NAV.filter(item => !['home', 'history', 'team'].includes(item.id)).map(({ id, label, icon: Icon }) => <button key={id} onClick={() => select(id)} aria-current={page === id ? 'page' : undefined} className={`mobile-tool-option ${page === id ? 'is-active' : ''}`}><Icon size={19} /><span>{label.slice(3)}</span><span className="ml-auto font-mono text-[10px] text-muted">{label.slice(0, 2)}</span></button>)}
          </div>
          <button onClick={toggle} className="mt-4 flex min-h-12 w-full items-center justify-between rounded-xl border border-line-warm px-4 text-sm"><span>{dark ? 'Switch to light mode' : 'Switch to dark mode'}</span>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          <div className="mt-3 grid grid-cols-3 gap-2" aria-label="Workspace pages">
            {NAV.filter(item => ['home', 'history', 'team'].includes(item.id)).map(({ id, icon: Icon }) => <button key={id} onClick={() => select(id)} aria-current={page === id ? 'page' : undefined} className={`mobile-nav-tab ${page === id ? 'is-active' : ''}`}><Icon size={18} /><span>{id === 'home' ? 'Home' : id === 'history' ? 'History' : 'Team'}</span></button>)}
          </div>
        </div>
      </dialog>
    </>
  )
}

export function Splash({ leaving, onSkip }: { leaving: boolean; onSkip: () => void }) {
  return <LoadingScreen leaving={leaving} onSkip={onSkip} />
}
