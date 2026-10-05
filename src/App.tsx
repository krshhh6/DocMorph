import { useEffect, useState } from 'react'
import Workspace from './components/Workspace'
import Team from './components/Team'
import { MobileBar, NAV, Sidebar, Splash } from './components/Shell'
import type { PageId } from './components/Shell'
import { ArrowLeft } from 'lucide-react'
import { ATS, Compressor, Converter, Deepfake, History, Passport, Summarizer } from './components/Tools'

const PAGES = { converter: Converter, compressor: Compressor, ats: ATS, passport: Passport, summarizer: Summarizer, deepfake: Deepfake, history: History, team: Team }

export default function App() {
  const [stack, setStack] = useState<PageId[]>(['home'])
  const page = stack[stack.length - 1]
  const [dark, setDark] = useState(false)
  const [splash, setSplash] = useState<'on' | 'leaving' | 'off'>('on')

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const a = setTimeout(() => setSplash('leaving'), reducedMotion ? 100 : 900)
    const b = setTimeout(() => setSplash('off'), reducedMotion ? 250 : 1150)
    return () => { clearTimeout(a); clearTimeout(b) }
  }, [page])
  // Scroll-reveal: any .rise element pops in when it enters the viewport.
  useEffect(() => {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
    const scan = () => document.querySelectorAll('.rise:not(.in)').forEach(el => io.observe(el))
    scan()
    const mo = new MutationObserver(scan)
    mo.observe(document.body, { childList: true, subtree: true })
    return () => { io.disconnect(); mo.disconnect() }
  }, [])
  useEffect(() => { document.documentElement.classList.toggle('dark', dark) }, [dark])

  const go = (p: PageId) => {
    if (p === page) return
    setSplash('on')
    setStack(s => [...s, p])
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  const back = () => {
    if (stack.length <= 1) return
    setSplash('on')
    setStack(s => s.slice(0, -1))
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  const prev = stack[stack.length - 2]
  const Tool = page === 'home' ? null : PAGES[page]
  const nav = { page, go, dark, toggle: () => setDark(d => !d) }

  return (
    <div className="min-h-screen bg-page text-ink transition-colors duration-300">
      {splash !== 'off' && <Splash key={`splash-${page}`} leaving={splash === 'leaving'} onSkip={() => setSplash('off')} />}
      <Sidebar {...nav} />
      <MobileBar {...nav} />
      <main key={`page-${page}`} className="studio-main mx-auto flex max-w-[1700px] flex-col gap-8 px-4 pb-28 pt-6 md:px-6 lg:pb-16 lg:pl-20">
        {Tool && (
          <div className="tool-navigation flex items-center justify-between">
            <button onClick={back} className="group inline-flex items-center gap-2 rounded-[12px] border border-line-warm bg-card px-4 py-2.5 font-mono text-xs uppercase tracking-[0.08em] transition-colors duration-200 hover:border-ink">
              <ArrowLeft size={14} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
              Back{prev && prev !== 'home' ? '' : ' to Workspace'}
            </button>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Workspace / {NAV.find(n => n.id === page)?.label}</span>
          </div>
        )}
        {Tool ? <Tool /> : <Workspace go={go} />}
      </main>
      <div className="grain" aria-hidden />
    </div>
  )
}
