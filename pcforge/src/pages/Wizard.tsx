import { useState } from 'react'
import { useApp } from '../lib/store'
import { Badge, Btn, Card, Icon, SectionHead } from '../components/ui'
import { analyze, avgAcrossGames, generateVariants, money, type Purpose } from '../lib/engine'
import type { BuildParts, Resolution } from '../types'
import { CATS, getPart } from '../data/parts'
import { Link, navigate } from '../lib/router'

const BUDGETS = [500, 750, 1000, 1500, 2000]
const PURPOSES: Purpose[] = ['Gaming', 'Streaming', 'School', 'Programming', 'Video editing', '3D rendering', 'Everything']
const RESOS: Resolution[] = ['1080p', '1440p', '4K']

export default function Wizard() {
  const app = useApp()
  const [step, setStep] = useState(0)
  const [budget, setBudget] = useState<number | null>(null)
  const [customBudget, setCustomBudget] = useState('')
  const [purpose, setPurpose] = useState<Purpose>('Gaming')
  const [res, setRes] = useState<Resolution>('1080p')
  const [prefs, setPrefs] = useState({ wifi: false, rgb: false, quiet: false, white: false })

  const effectiveBudget = budget ?? (parseInt(customBudget, 10) || 0)
  const canNext = step === 0 ? effectiveBudget >= 400 : true
  const variants = step >= 4 && effectiveBudget >= 400
    ? generateVariants(effectiveBudget, purpose, res, prefs)
    : null

  const steps = ['Budget', 'Purpose', 'Resolution', 'Preferences', 'Your builds']

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h1 className="font-display font-bold text-2xl sm:text-3xl">Build Wizard</h1>
        <Link to="/builder" className="text-sm text-neon hover:underline inline-flex items-center gap-1">
          Advanced Mode<Icon name="sliders" className="w-4 h-4" />
        </Link>
      </div>
      <p className="text-sm text-mute mb-6">Answer a few simple questions — no spec knowledge required.</p>

      {/* progress */}
      <div className="flex gap-1.5 mb-8">
        {steps.map((s, i) => (
          <div key={s} className="flex-1">
            <div className={`h-1.5 rounded-full transition-colors ${i <= step ? 'bg-gradient-to-r from-cyan-400 to-violet-500' : 'bg-surface2'}`} />
            <div className={`text-[10px] mt-1.5 ${i <= step ? 'text-neon' : 'text-mute'}`}>{s}</div>
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="rise">
          <SectionHead title="What's your budget?" sub="Tower only — peripherals can be added later." />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {BUDGETS.map(b => (
              <button key={b} onClick={() => { setBudget(b); setCustomBudget('') }}
                className={`p-5 rounded-2xl border cursor-pointer transition-all text-left ${budget === b ? 'border-neon/60 bg-neon/10' : 'border-line hover:border-neon/30 bg-surface'}`}>
                <div className="font-display font-bold text-xl">${b.toLocaleString()}</div>
                <div className="text-xs text-mute mt-1">{b < 700 ? 'Entry level' : b < 1200 ? 'Sweet spot' : b < 2000 ? 'High refresh' : 'No compromises'}</div>
              </button>
            ))}
            <div className={`p-5 rounded-2xl border ${budget === null && customBudget ? 'border-neon/60 bg-neon/10' : 'border-line'} bg-surface`}>
              <div className="text-xs text-mute mb-2">Custom</div>
              <input className="field !py-1.5" placeholder="$ e.g. 1250" value={customBudget}
                onChange={e => { setCustomBudget(e.target.value.replace(/[^0-9]/g, '')); setBudget(null) }} />
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="rise">
          <SectionHead title="What is the PC for?" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PURPOSES.map(p => (
              <button key={p} onClick={() => setPurpose(p)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all text-sm font-medium ${purpose === p ? 'border-neon/60 bg-neon/10 text-ink' : 'border-line hover:border-neon/30 bg-surface text-mute'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="rise">
          <SectionHead title="Preferred resolution?" sub="This shifts budget toward the GPU for higher pixel counts." />
          <div className="grid grid-cols-3 gap-3">
            {RESOS.map(r => (
              <button key={r} onClick={() => setRes(r)}
                className={`p-5 rounded-2xl border cursor-pointer transition-all text-left ${res === r ? 'border-neon/60 bg-neon/10' : 'border-line hover:border-neon/30 bg-surface'}`}>
                <div className="font-display font-bold">{r}</div>
                <div className="text-xs text-mute mt-1">{{ '720p': 'Budget builds', '1080p': 'Esports & value', '1440p': 'The sweet spot', '4K': 'Maximum fidelity' }[r]}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="rise">
          <SectionHead title="Any preferences?" sub="Optional — we'll factor these into part selection." />
          <div className="space-y-2.5 max-w-md">
            {([['wifi', 'Do you need Wi-Fi?'], ['rgb', 'Do you care about RGB?'], ['quiet', 'Do you want a quiet PC?'], ['white', 'Prefer a white build?']] as const).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between p-4 rounded-2xl border border-line bg-surface cursor-pointer hover:border-neon/30 transition-colors">
                <span className="text-sm">{label}</span>
                <input type="checkbox" checked={prefs[key]} onChange={e => setPrefs(p => ({ ...p, [key]: e.target.checked }))} className="accent-cyan-400 w-4 h-4" />
              </label>
            ))}
          </div>
        </div>
      )}

      {step === 4 && variants && (
        <div className="rise space-y-4">
          <SectionHead title="Your recommended builds"
            sub={`${money(effectiveBudget)} · ${purpose} · ${res}. Prices are estimates — customize anything.`} />
          {(Object.values(variants) as { label: string; desc: string; parts: BuildParts }[]).map(v => {
            const a = analyze(v.parts)
            const fps = avgAcrossGames(a.r.cpu, a.r.gpu, a.r.ram, res === '4K' ? '1440p' : res, 'High')
            return (
              <Card key={v.label} hover className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display font-semibold text-lg">{v.label}</h3>
                      <Badge tone="neon">Score {a.scores.overall}/100</Badge>
                    </div>
                    <div className="text-xs text-mute mt-0.5">{v.desc}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display font-bold text-2xl grad-text">{money(a.price)}</div>
                    <div className="text-[11px] text-mute">≈ {fps} FPS @ {res === '4K' ? '1440p' : res} High (est.)</div>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm mb-4">
                  {CATS.filter(c => v.parts[c.key]).map(c => {
                    const p = getPart(v.parts[c.key])!
                    return (
                      <div key={c.key} className="flex justify-between gap-3 border-b border-line/50 pb-1">
                        <span className="text-mute shrink-0">{c.short}</span>
                        <span className="truncate text-right" title={p.name}>{p.name}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Btn variant="primary" size="sm" onClick={() => { app.loadParts(v.parts); app.toast(`${v.label} loaded into Builder`); navigate('/builder') }}>
                    <Icon name="edit" className="w-3.5 h-3.5" />Customize in Builder
                  </Btn>
                  <Btn size="sm" onClick={() => { app.loadParts(v.parts); const sb = app.saveBuild(`${purpose} ${money(a.price)} — ${v.label}`); navigate(`/saved`) ; void sb }}>
                    <Icon name="bookmark" className="w-3.5 h-3.5" />Save build
                  </Btn>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* nav */}
      <div className="flex justify-between mt-10">
        <Btn onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}><Icon name="chevronDown" className="w-4 h-4 rotate-90" />Back</Btn>
        {step < 4 && <Btn variant="primary" onClick={() => setStep(s => s + 1)} disabled={!canNext}>Next<Icon name="arrowRight" className="w-4 h-4" /></Btn>}
      </div>
    </div>
  )
}
