import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/store'
import { Btn, Card, Icon } from './ui'
import { Link } from '../lib/router'
import {
  analyze, canIRunIt, generateBuild, money, optimizePrice,
} from '../lib/engine'
import { GAMES, GAME_INDEX } from '../data/games'
import { CATS, getPart } from '../data/parts'

interface Msg { from: 'ai' | 'me'; text: React.ReactNode }

const QUICK = [
  'Build me a $900 gaming PC',
  'What should I upgrade first?',
  'Why is my build incompatible?',
  'Can I run Fortnite?',
  'Is this PSU enough?',
  'Make this build cheaper',
]

export default function ForgeAI() {
  const app = useApp()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [msgs, setMsgs] = useState<Msg[]>([{
    from: 'ai',
    text: <>Hi, I'm <b className="grad-text">ForgeAI</b>. I can see your current build and answer questions about parts, compatibility, performance and budget. What do you need?</>,
  }])
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bodyRef.current?.scrollTo({ top: 1e6, behavior: 'smooth' }) }, [msgs, open])

  function answer(qRaw: string): React.ReactNode {
    const q = qRaw.toLowerCase()
    const a = app.analysis
    const moneyRe = q.match(/\$?\s?(\d{3,5})\s?(k)?/)

    // Budget build request
    if (/(build|create|make).*(pc|build|computer)|budget/.test(q) && moneyRe) {
      let amount = parseInt(moneyRe[1], 10)
      if (moneyRe[2] === 'k') amount *= 1000
      amount = Math.max(450, Math.min(5000, amount))
      const parts = generateBuild(amount, 'Gaming', amount >= 1500 ? '1440p' : '1080p')
      const price = analyze(parts).price
      return (
        <>
          Here's a strong ~{money(amount)} gaming configuration (estimated prices, total {money(price)}):
          <ul className="mt-2 space-y-1 text-xs">
            {(Object.entries(parts) as [keyof typeof parts, string][]).map(([cat, id]) => {
              const p = getPart(id)
              const label = CATS.find(c => c.key === cat)?.short ?? cat
              if (!p) return null
              return <li key={cat}><b>{label}:</b> {p.name} <span className="text-mute">({money(p.price)})</span></li>
            })}
          </ul>
          <div className="mt-2">
            <Link to="/wizard" className="text-neon underline text-sm">Open the Build Wizard to customize it →</Link>
          </div>
        </>
      )
    }

    if (/(upgrade|improve|what should i change)/.test(q)) {
      const up = a.upgrades.filter(u => u.fpsGain > 0).sort((x, y) => y.fpsGain - x.fpsGain)[0]
      if (!up) return <>Your build looks well-balanced already — no single upgrade stands out. Add more parts in the <Link to="/builder" className="text-neon underline">Builder</Link> for deeper analysis.</>
      return <>Start with the <b>{up.label.toLowerCase()}</b>: the <b>{up.suggested.name}</b> ({up.deltaPrice >= 0 ? '+' : ''}{money(up.deltaPrice)}) is estimated to lift average FPS by roughly <b className="text-good">{up.fpsGain > 0 ? '+' : ''}{up.fpsGain}%</b> at 1440p High. {up.why} Find it under “Improve Your Build” in the Builder.</>
    }

    if (/(incompat|compat|error|problem|fit)/.test(q)) {
      const bad = a.issues.filter(i => i.level !== 'ok')
      if (!bad.length) return <>Good news — everything in your current build passes the compatibility checks (score {a.scores.compat}/100).</>
      return <>I found {bad.length} issue{bad.length > 1 ? 's' : ''}:<ul className="mt-2 space-y-1.5">{bad.map((i, k) => (
        <li key={k}>{i.level === 'error' ? '🔴' : '🟡'} <b>{i.title}</b> — {i.detail}</li>
      ))}</ul><div className="mt-2">The Builder's Compatibility panel offers one-click fixes.</div></>
    }

    const gameHit = GAMES.find(g => q.includes(g.name.toLowerCase()) || q.includes(g.id))
    if (gameHit || /can i run/.test(q)) {
      const game = gameHit ?? GAME_INDEX.get('fortnite')!
      const v = canIRunIt(a.r.cpu, a.r.gpu, a.r.ram?.gb ?? 16, game)
      return <>{game.unreleased ? `${game.name} isn't out on PC yet, so this is a rough projection. ` : ''}<b>{v.headline}</b><div className="mt-2 text-xs text-mute">Estimated at your build's hardware · results vary by settings.</div><Link to={`/canirun?game=${game.id}`} className="text-neon underline text-sm inline-block mt-2">Full breakdown →</Link></>
    }

    if (/(psu|power|watt)/.test(q)) {
      const p = a.power
      if (!a.r.psu) return <>You haven't picked a PSU yet. Your parts draw an estimated <b>~{p.gamingW}W</b> while gaming, so I'd recommend <b>{p.recPsu}W+</b>.</>
      const head = Math.round((p.headroom ?? 0) * 100)
      return <>Your <b>{a.r.psu.name}</b> ({a.r.psu.watts}W) vs estimated peak draw of <b>~{p.peakW}W</b>: {head >= 20 ? <span className="text-good">that's comfortable</span> : head >= 10 ? <span className="text-warn">that's workable but tight</span> : <span className="text-bad">that's not enough</span>} ({head}% headroom). Recommended: {p.recPsu}W+. Estimates — verify manufacturer specs.</>
    }

    if (/(cheaper|save|reduce cost|less money)/.test(q)) {
      const opt = optimizePrice(app.build)
      if (!opt.swaps.length) return <>I couldn't find meaningful savings without hurting performance — your money is already well spent.</>
      return <>I can trim <b className="text-good">{money(opt.beforePrice - opt.afterPrice)}</b> ({money(opt.afterPrice)} total) with about <b>{Math.abs(opt.perfDelta)}%</b> performance impact:<ul className="mt-2 space-y-1 text-xs">{opt.swaps.map((s, i) => <li key={i}>• {s.label}: {s.from} → <b>{s.to}</b></li>)}</ul><Link to="/builder" className="text-neon underline text-sm inline-block mt-2">Try “Optimize Price” in the Builder →</Link></>
    }

    if (/which gpu|(gpu|graphics card).*(buy|choose|pick|recommend)/.test(q)) {
      return <>For most gamers the best-value GPU classes right now sit around the RX 7700 XT / RTX 4070 SUPER tier for 1440p. Check the <Link to="/compare" className="text-neon underline">Compare</Link> page — it shows which card wins on gaming vs value vs efficiency rather than declaring one universal winner.</>
    }

    if (/fps|performance|how many frames/.test(q)) {
      return <>Open the <Link to="/performance" className="text-neon underline">Performance Lab</Link> for per-game FPS, 1% lows and utilization estimates for your exact build. All figures are estimates that depend on settings.</>
    }

    if (/^(hi|hello|hey|yo)\b/.test(q)) return <>Hey! Ask me things like “is my PSU enough?”, “what should I upgrade?” or “build me a $1200 streaming PC”.</>

    return <>I'm a rule-based demo assistant, so I'm best at concrete questions: upgrades, saving money, can-I-run-it checks, PSU sizing, or building to a budget. All answers use estimated data.</>
  }

  const send = (text?: string) => {
    const q = (text ?? input).trim()
    if (!q) return
    setMsgs(m => [...m, { from: 'me', text: q }])
    setInput('')
    setTimeout(() => setMsgs(m => [...m, { from: 'ai', text: answer(q) }]), 350)
  }

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[70] btn-primary rounded-full w-14 h-14 flex items-center justify-center shadow-2xl cursor-pointer"
          aria-label="Open ForgeAI">
          <Icon name="sparkles" className="w-6 h-6" />
        </button>
      )}
      {open && (
        <Card className="fixed bottom-4 right-4 z-[70] w-[calc(100vw-2rem)] sm:w-[400px] h-[560px] max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden rise">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-line">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center text-[#06121a]"><Icon name="sparkles" className="w-[18px] h-[18px]" /></span>
            <div className="flex-1">
              <div className="font-display font-semibold text-sm">ForgeAI</div>
              <div className="text-[10px] text-mute flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-good blink inline-block" />Uses your current build context</div>
            </div>
            <button onClick={() => setOpen(false)} className="text-mute hover:text-ink cursor-pointer p-1"><Icon name="x" /></button>
          </div>
          <div ref={bodyRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.from === 'me' ? 'bg-gradient-to-r from-cyan-500/25 to-violet-500/25 border border-neon/30' : 'bg-surface2 border border-line'}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {msgs.length <= 1 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {QUICK.map(qk => (
                  <button key={qk} onClick={() => send(qk)} className="text-[11px] px-2.5 py-1.5 rounded-full border border-line text-mute hover:text-neon hover:border-neon/40 cursor-pointer">{qk}</button>
                ))}
              </div>
            )}
          </div>
          <div className="p-3 border-t border-line flex gap-2">
            <input className="field !py-2 text-sm" placeholder="Ask ForgeAI…" value={input}
              onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} />
            <Btn variant="primary" onClick={() => send()} aria-label="Send"><Icon name="send" className="w-4 h-4" /></Btn>
          </div>
        </Card>
      )}
    </>
  )
}
