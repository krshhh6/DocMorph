import { useEffect, useState } from 'react'
import { Logo, Eyebrow } from './ui'

const stages = ['Gathering the essentials', 'Connecting your tools', 'Making room for possibility', 'Your studio is ready']

export default function LoadingScreen({ leaving, onSkip }: { leaving: boolean; onSkip: () => void }) {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setStage(current => Math.min(current + 1, stages.length - 1)), 230)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className={`studio-loader ${leaving ? 'studio-loader--leaving' : ''}`} inert={leaving}>
      <header className="loader-header">
        <span className="flex items-center gap-2.5 text-sm font-semibold"><Logo size={25} />DocMorph<span className="loader-edition">/ FILE STUDIO PRO</span></span>
        <button className="loader-skip" onClick={onSkip}>Enter studio <span aria-hidden="true">↗</span></button>
      </header>

      <div className="loader-main">
        <Eyebrow className="loader-overline"><span className="loader-live" /> A little transformation, in progress</Eyebrow>
        <div className="loader-machine" aria-hidden="true">
          <div className="loader-orbit loader-orbit--outer" />
          <div className="loader-orbit loader-orbit--inner" />
          <span className="loader-coordinate loader-coordinate--left">INPUT / 01</span>
          <span className="loader-coordinate loader-coordinate--right">OUTPUT / ∞</span>
          <div className="loader-paper loader-paper--back" />
          <div className="loader-paper loader-paper--middle" />
          <div className="loader-paper loader-paper--front">
            <div className="loader-paper-top"><Logo size={24} /><span>DOC / 001</span></div>
            <div className="loader-paper-title" />
            <div className="loader-paper-line" /><div className="loader-paper-line" /><div className="loader-paper-line loader-paper-line--short" />
            <div className="loader-pixel-grid">{Array.from({ length: 24 }, (_, index) => <i key={index} />)}</div>
            <div className="loader-sweep" />
          </div>
          <span className="loader-format loader-format--pdf">PDF</span>
          <span className="loader-format loader-format--doc">DOCX</span>
          <span className="loader-format loader-format--jpg">JPG</span>
          <div className="loader-platform" />
        </div>
        <h1 className="loader-title">Good things.<br /><span>Taking shape.</span></h1>
        <p className="loader-description">A fresh perspective for every file.</p>
        <div className="loader-status" role="status" aria-live="polite">
          <div className="loader-track"><span /></div>
          <div className="loader-status-label"><span key={stage}>{stages[stage]}</span><span aria-hidden="true">0{stage + 1} / 04</span></div>
        </div>
      </div>

      <footer className="loader-footer"><span>BUILT FOR YOUR EVERYDAY. AND YOUR NEXT BIG THING.</span><span>BY KRISHNA KANT <span className="text-amber-ink">✳</span></span></footer>
      <div className="grain" aria-hidden="true" />
    </div>
  )
}
