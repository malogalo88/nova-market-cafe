import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../lib/store'
import { Badge, Bar, Btn, Card, Icon, SectionHead } from '../components/ui'
import { GAMES, GAME_INDEX, minReq, recReq } from '../data/games'
import { DB, getTyped } from '../data/parts'
import { canIRunIt, money } from '../lib/engine'
import { navigate } from '../lib/router'
import type { CPU, GPU, RAM } from '../types'

// ─── Can I Run It ──────────────────────────────────────────────────────────

export function CanIRunIt({ query }: { query: URLSearchParams }) {
  const app = useApp()
  const [gameId, setGameId] = useState(query.get('game') ?? 'fortnite')
  const [cpuId, setCpuId] = useState(app.build.cpu ?? 'r5-7600')
  const [gpuId, setGpuId] = useState(app.build.gpu ?? 'rtx-4060')
  const [ramGb, setRamGb] = useState(String(getTyped<RAM>('ram', app.build.ram)?.gb ?? 16))

  useEffect(() => {
    const g = query.get('game')
    if (g && GAME_INDEX.has(g)) setGameId(g)
  }, [query])

  const game = GAME_INDEX.get(gameId)!
  const cpu = getTyped<CPU>('cpu', cpuId)
  const gpu = getTyped<GPU>('gpu', gpuId)
  const v = canIRunIt(cpu, gpu, Number(ramGb), game)
  const min = minReq(game)
  const rec = recReq(game)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <SectionHead eyebrow="Hardware check" title="Can I Run It?"
        sub="Pick a game and your hardware — PCForge compares it against requirement classes and estimates FPS." />

      <Card className="p-5 mb-6">
        <div className="grid sm:grid-cols-4 gap-2">
          <select className="field !py-2 text-sm" value={gameId} onChange={e => setGameId(e.target.value)}>
            {GAMES.map(g => <option key={g.id} value={g.id}>{g.name}{g.unreleased ? ' (projected)' : ''}</option>)}
          </select>
          <select className="field !py-2 text-sm" value={cpuId} onChange={e => setCpuId(e.target.value)}>
            {DB.cpu.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="field !py-2 text-sm" value={gpuId} onChange={e => setGpuId(e.target.value)}>
            {DB.gpu.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select className="field !py-2 text-sm" value={ramGb} onChange={e => setRamGb(e.target.value)}>
            {[8, 16, 24, 32, 64].map(n => <option key={n} value={n}>{n} GB RAM</option>)}
          </select>
        </div>
      </Card>

      <Card className={`p-6 mb-6 border ${v.verdict === 'yes' ? 'border-good/40' : v.verdict === 'maybe' ? 'border-warn/40' : 'border-bad/40'}`}>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl">{v.verdict === 'yes' ? '✅' : v.verdict === 'maybe' ? '⚠️' : '❌'}</span>
          <h2 className="font-display font-bold text-xl">Can you run {game.name}?</h2>
        </div>
        <p className="text-sm text-mute">{v.headline}</p>
      </Card>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <h3 className="font-display font-semibold mb-3">Requirements class</h3>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wider text-mute"><th className="pb-2"></th><th className="pb-2">Minimum</th><th className="pb-2">Recommended</th><th className="pb-2">Yours</th></tr></thead>
            <tbody className="text-xs">
              <ReqRow label="GPU class" min={min.gpuPerf} rec={rec.gpuPerf} yours={gpu?.perf ?? 0} />
              <ReqRow label="CPU class" min={min.cpuGaming} rec={rec.cpuGaming} yours={cpu?.gaming ?? 0} />
              <ReqRow label="RAM (GB)" min={min.ramGb} rec={rec.ramGb} yours={Number(ramGb)} />
            </tbody>
          </table>
          <p className="text-[10px] text-mute mt-3">Class values are PCForge relative indices mapped from public requirement guidance.</p>
        </Card>

        <Card className="p-5">
          <h3 className="font-display font-semibold mb-3">Estimated FPS</h3>
          <div className="space-y-2.5">
            {v.rows.map(r => (
              <div key={`${r.res}-${r.setting}`}>
                <div className="flex justify-between text-xs mb-1"><span className="text-mute">{r.res} · {r.setting}</span><b>~{r.fps.avg} FPS</b></div>
                <Bar value={Math.min(r.fps.avg, 240)} max={240} tone={r.fps.avg >= 100 ? 'good' : r.fps.avg >= 60 ? 'neon' : r.fps.avg >= 30 ? 'warn' : 'bad'} />
              </div>
            ))}
          </div>
          <p className="text-[11px] text-mute mt-3">All figures are estimates — results vary by scene, drivers and settings.</p>
        </Card>
      </div>

      {game.note && (
        <Card className="p-4 text-xs text-mute flex items-start gap-2">
          <Icon name="info" className="w-4 h-4 shrink-0 mt-0.5 text-neon" />{game.note}
        </Card>
      )}
    </div>
  )
}

function ReqRow({ label, min, rec, yours }: { label: string; min: number; rec: number; yours: number }) {
  const status = yours >= rec ? ['good', 'Exceeds'] : yours >= min ? ['warn', 'Meets min'] : ['bad', 'Below']
  return (
    <tr className="border-t border-line/50">
      <td className="py-2 text-mute">{label}</td>
      <td className="py-2">{min}</td>
      <td className="py-2">{rec}</td>
      <td className="py-2 flex items-center gap-2">{yours}<Badge tone={status[0] as any}>{status[1]}</Badge></td>
    </tr>
  )
}

// ─── Analyze My PC (build check) ───────────────────────────────────────────

function fuzzyFind(text: string, pool: { id: string; name: string }[]): string | undefined {
  const t = text.toLowerCase()
  let best: { id: string; score: number } | undefined
  for (const p of pool) {
    const words = p.name.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(w => w.length > 2 && !['geforce', 'radeon', 'core', 'ryzen', 'edition'].includes(w))
    const hits = words.filter(w => t.includes(w)).length
    if (hits > 0 && (!best || hits > best.score)) best = { id: p.id, score: hits }
  }
  return best?.id
}

export function Checkup() {
  const app = useApp()
  const [text, setText] = useState('')
  const [cpuId, setCpuId] = useState('')
  const [gpuId, setGpuId] = useState('')
  const [ramGb, setRamGb] = useState('16')

  const parse = () => {
    setCpuId(fuzzyFind(text, DB.cpu) ?? '')
    setGpuId(fuzzyFind(text, DB.gpu) ?? '')
    const ramMatch = text.match(/(\d{1,3})\s*gb/i)
    if (ramMatch) setRamGb(ramMatch[1])
    app.toast(text.trim() ? 'Specs analyzed' : 'Enter your specs first', text.trim() ? 'ok' : 'warn')
  }

  const cpu = getTyped<CPU>('cpu', cpuId)
  const gpu = getTyped<GPU>('gpu', gpuId)
  const ramObj = useMemo<RAM>(() => ({
    id: 'custom', name: 'Custom RAM', brand: '', price: 0, rating: 4,
    cat: 'ram', type: 'DDR5', gb: Number(ramGb), sticks: 2, mhz: 6000, rgb: false,
  }), [ramGb])

  const weakest = useMemo(() => {
    const items: [string, number][] = [
      ['CPU', (cpu?.gaming ?? 0) * 1.2],
      ['GPU', gpu?.perf ?? 0],
      ['RAM', ramObj.gb >= 32 ? 70 : ramObj.gb >= 16 ? 55 : 25],
    ]
    items.sort((a, b) => a[1] - b[1])
    return items[0]
  }, [cpu, gpu, ramObj])

  const suggestions = useMemo(() => {
    const out: string[] = []
    if (gpu && cpu && gpu.perf > cpu.gaming * 1.35) out.push('Your GPU is much stronger than your CPU — a CPU upgrade would lift CPU-heavy games.')
    if (cpu && gpu && cpu.gaming > gpu.perf * 1.35) out.push('Your CPU outruns your GPU — the GPU is your best next upgrade for resolution and eye-candy.')
    if (Number(ramGb) <= 16) out.push('16GB or less: consider stepping up to 32GB for modern titles and multitasking.')
    if (gpu && gpu.perf < 45) out.push('The GPU sits at entry level — even one tier up transforms high-settings gameplay.')
    if (!out.length) out.push('This configuration looks balanced. Upgrade whichever component limits the games you actually play.')
    return out
  }, [cpu, gpu, ramGb])

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <SectionHead eyebrow="PC Build Check" title="Analyze My PC"
        sub="Paste your existing specifications and PCForge will identify them and estimate gaming performance." />

      <Card className="p-5 mb-6">
        <textarea className="field min-h-28 font-mono !text-xs" placeholder={'e.g.\nCPU: Ryzen 5 5600\nGPU: RTX 3060\nRAM: 16GB DDR4\nStorage: 1TB SSD'}
          value={text} onChange={e => setText(e.target.value)} />
        <div className="flex flex-wrap gap-2 mt-3">
          <Btn variant="primary" onClick={parse}><Icon name="activity" className="w-4 h-4" />Analyze</Btn>
          <Btn onClick={() => setText('')}>Clear</Btn>
        </div>
      </Card>

      <Card className="p-5 mb-6">
        <h3 className="font-display font-semibold mb-3">Your PC</h3>
        <div className="grid sm:grid-cols-3 gap-2">
          <select className="field !py-2 text-sm" value={cpuId} onChange={e => setCpuId(e.target.value)}>
            <option value="">Select CPU…</option>
            {DB.cpu.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="field !py-2 text-sm" value={gpuId} onChange={e => setGpuId(e.target.value)}>
            <option value="">Select GPU…</option>
            {DB.gpu.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select className="field !py-2 text-sm" value={ramGb} onChange={e => setRamGb(e.target.value)}>
            {[8, 16, 24, 32, 64].map(n => <option key={n} value={n}>{n} GB RAM</option>)}
          </select>
        </div>
        {(cpu || gpu) && (
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-surface2 border border-line p-3">
              <div className="text-[10px] uppercase text-mute">CPU</div>
              <div className="text-sm truncate">{cpu?.name ?? '—'}</div>
              <Bar value={cpu?.gaming ?? 0} tone="neon" className="mt-2" />
            </div>
            <div className="rounded-xl bg-surface2 border border-line p-3">
              <div className="text-[10px] uppercase text-mute">GPU</div>
              <div className="text-sm truncate">{gpu?.name ?? '—'}</div>
              <Bar value={gpu?.perf ?? 0} tone="viol" className="mt-2" />
            </div>
            <div className="rounded-xl bg-surface2 border border-line p-3">
              <div className="text-[10px] uppercase text-mute">RAM</div>
              <div className="text-sm">{ramGb} GB</div>
              <Bar value={ramObj.gb >= 32 ? 100 : ramObj.gb >= 16 ? 65 : 30} tone="good" className="mt-2" />
            </div>
          </div>
        )}
      </Card>

      {(cpu || gpu) && (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="font-display font-semibold mb-3">Estimated performance</h3>
              <div className="space-y-2">
                {GAME_INDEX.has('fortnite') && ['fortnite', 'cyberpunk'].map(id => {
                  const g = GAME_INDEX.get(id)!
                  const e = canIRunIt(cpu, gpu, Number(ramGb), g).rows[1]
                  return (
                    <div key={id} className="flex justify-between text-sm bg-surface2 border border-line rounded-lg px-3 py-2">
                      <span>{g.name} · 1080p High</span><b>~{e.fps.avg} FPS</b>
                    </div>
                  )
                })}
              </div>
              <p className="text-[11px] text-mute mt-3">Estimates only — actual results vary.</p>
            </Card>
            <Card className="p-5">
              <h3 className="font-display font-semibold mb-3">Upgrade recommendations</h3>
              <Badge tone="warn" className="mb-3">Weakest link: {weakest[0]}</Badge>
              <ul className="space-y-2 text-sm">
                {suggestions.map((s, i) => <li key={i} className="flex gap-2"><Icon name="zap" className="w-4 h-4 text-warn shrink-0 mt-0.5" />{s}</li>)}
              </ul>
              <Btn variant="primary" size="sm" className="mt-4" onClick={() => navigate('/builder')}>
                Plan upgrades in the Builder<Icon name="arrowRight" className="w-3.5 h-3.5" />
              </Btn>
            </Card>
          </div>
          <p className="text-[11px] text-mute mt-4">
            Matching is based on our sample database of {DB.cpu.length + DB.gpu.length} CPUs/GPUs. Hardware we don't recognize won't appear here — pick the closest equivalent manually. Prices shown elsewhere ({money(0)}) are samples.
          </p>
        </>
      )}
    </div>
  )
}
