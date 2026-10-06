import { useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Card, Eyebrow } from './ui'

const members = [
  { name: 'Krishna Kant', initials: 'KK', role: 'Creator · Frontend Architecture, File Conversions & AI Forensics', description: 'The creator behind DocMorph: File Studio Pro — leading frontend architecture, universal file conversions, and AI deepfake forensics.', tags: ['Frontend Architecture', 'File Conversions', 'AI Forensics'] },
  { name: 'Sampoorn Tripathi', initials: 'ST', role: 'ATS Resume Scoring Engine & AI Summarizer', description: 'Part of the team behind DocMorph: File Studio Pro, focusing on ATS resume scoring and AI summarization pipelines.', tags: ['ATS Resume Scoring', 'AI Summarizer', 'DocMorph'] },
  { name: 'Divyam Pathak', initials: 'DP', role: 'Passport Photo Studio & Plagiarism Analyzer', description: 'Part of the team behind DocMorph: File Studio Pro, crafting the biometric passport photo studio and plagiarism analyzer.', tags: ['Passport Photo Studio', 'Plagiarism Analyzer', 'DocMorph'] },
]

export default function Team() {
  const [selected, setSelected] = useState(0)
  const member = members[selected]
  const move = (direction: number) => setSelected(current => (current + direction + members.length) % members.length)

  return (
    <Card className="team-section p-6 md:p-12">
      <div className="text-center">
        <Eyebrow className="text-muted">08 / The people behind the possibilities</Eyebrow>
        <h2 className="mt-4 text-[clamp(30px,4vw,54px)] font-bold leading-tight tracking-[-0.05em]">Small team. <span className="text-muted">Big transformations.</span></h2>
        <p className="mt-4 text-sm text-body">Different perspectives. One shared attention to detail.</p>
      </div>
      <div className="team-portraits" role="group" aria-label="Select a team member">
        {members.map((person, index) => (
          <button key={person.name} className={`team-person team-person--${index} ${selected === index ? 'team-person--active' : ''}`} onClick={() => setSelected(index)} aria-label={`View ${person.name}, ${person.role}`} aria-pressed={selected === index}>
            <span className="team-monogram" aria-hidden="true">{person.initials}<span>{person.name}</span></span>
            <span className="team-person-index" aria-hidden="true">0{index + 1}</span>
          </button>
        ))}
      </div>
      <div className="team-bio rounded-[24px] border border-line-warm bg-soft p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div key={member.name} className="team-bio-enter">
            <h3 className="text-xl font-semibold tracking-tight md:text-3xl">{member.name}</h3>
            <p className="mt-1 font-mono text-[11px] text-amber-ink">{member.role}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button className="team-step" onClick={() => move(-1)} aria-label="Previous team member"><ArrowLeft size={15} /></button>
            <button className="team-step" onClick={() => move(1)} aria-label="Next team member"><ArrowRight size={15} /></button>
          </div>
        </div>
        <div key={`bio-${selected}`} className="team-bio-enter mt-5 border-t border-line-warm pt-5" aria-live="polite" aria-atomic="true">
          <p className="text-sm leading-7 text-body">{member.description}</p>
          <div className="mt-6 flex flex-wrap gap-2">{member.tags.map(tag => <span key={tag} className="rounded-full border border-line-warm bg-card px-3 py-1.5 font-mono text-[10px] text-body">{tag}</span>)}</div>
        </div>
        <div className="mt-6 flex items-center justify-between font-mono text-[9px] tracking-widest text-muted"><span>THREE MINDS. ONE STUDIO.</span><span>0{selected + 1} / 03</span></div>
      </div>
    </Card>
  )
}
