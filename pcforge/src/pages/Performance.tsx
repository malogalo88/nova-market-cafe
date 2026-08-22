import { useMemo, useState } from 'react'
import { useApp } from '../lib/store'
import { Badge, Bar, Btn, Card, EmptyState, Icon, SectionHead } from '../components/ui'
import { MonitorMatchCard } from '../components/builder-ui'
import { GAMES, GAME_INDEX, RESOLUTIONS, SETTINGS } from '../data/games'
import { DB, getTyped } from '../data/parts'
import { analyze, avgAcrossGames, estimateFps, money } from '../lib/engine'
import type { CPU, GPU, Resolution, Setting } from '../types'

const CHART_GAMES = ['cs2', 'valorant', 'fortnite', 'apex', 'gtav', 'rdr2', 'cyberpunk']

export default function Performance() {
  const app = useApp()
  const a = app.analysis
  const [gameId, setGameId] = useState('fortnite')
  const [res, setRes] = useState<Resolution>('1080p')
  const [setting, setSetting] = useState<Setting>('High')

  // Build B quick-pick
  const [gpuB, setGpuB] = useState('rtx-4070s')
  const [cpuB, setCpuB] = useState('r5-7600')

  const game = GAME_INDEX.get(gameId)!
  const est = estimateFps(a.r.cpu, a.r.gpu, a.r.ram, game, res, setting)

  const compareRows = useMemo(() => CHART_GAMES.map(id => {
    const g = GAME_INDEX.get(id)!
    return {
      id,
      name: g.name,
      a: estimateFps(a.r.cpu, a.r.gpu, a.r.ram, g, res, 'High').avg,
      b: estimateFps(getTyped<CPU>('cpu', cpuB), getTyped<GPU>('gpu', gpuB), a.r.ram, g, res, 'High').avg,
    }
  }), [a, res, cpuB, gpuB])

  const maxFps = Math.max(...compareRows.flatMap(r => [r.a, r.b]), 1)

  // performance history across saved builds
  const history = useMemo(() => [...app.saved]
    .sort((x, y) => x.date - y.date)
    .map(sb => {
      const aa = analyze(sb.parts)
      return { name: sb.name, fps: avgAcrossGames(aa.r.cpu, aa.r.gpu, aa.r.ram, '1080p', 'High'), price: aa.price }
    }), [app.saved])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <SectionHead eyebrow="Performance Lab" title="Gaming Performance Estimator"
        sub="Estimated FPS for your current build. All numbers are estimates that depend on settings and drivers — not guarantees." />

      {/* single-game estimator */}
      <Card className="p-5 mb-6">
        <div className="grid sm:grid-cols-3 gap-2 mb-5">
          <select className="field !py-2 text-sm" value={gameId} onChange={e => setGameId(e.target.value)}>
            {GAMES.map(g => <option key={g.id} value={g.id}>{g.name}{g.unreleased ? ' (projected)' : ''}</option>)}
          </select>
          <select className="field !py-2 text-sm" value={res} onChange={e => setRes(e.target.value as Resolution)}>
            {RESOLUTIONS.map(r => <option key={r}>{r}</option>)}
          </select>
          <select className="field !py-2 text-sm" value={setting} onChange={e => setSetting(e.target.value as Setting)}>
            {SETTINGS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Big label="Average FPS" v={`~${est.avg}`} accent />
          <Big label="1% Low" v={`~${est.low1}`} />
          <Big label="Range" v={`${est.min}–${est.max}`} />
          <div className="rounded-xl bg-surface2 border border-line p-3">
            <div className="text-[10px] uppercase tracking-wider text-mute mb-2">Utilization</div>
            <div className="text-xs space-y-1.5">
              <div><div className="flex justify-between"><span className="text-cyan-300">GPU</span><span>{est.gpuUtil}%</span></div><Bar value={est.gpuUtil} max={100} tone="viol" /></div>
              <div><div className="flex justify-between"><span className="text-violet-300">CPU</span><span>{est.cpuUtil}%</span></div><Bar value={est.cpuUtil} max={100} tone="neon" /></div>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-mute mt-3">Limited by {est.limitedBy.toUpperCase()} · estimates only.</p>
      </Card>

      {/* FPS comparison */}
      <Card className="p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <h3 className="font-display font-semibold">FPS Comparison — Build A vs Build B</h3>
          <Badge tone="line">{res} · High (est.)</Badge>
        </div>
        <p className="text-xs text-mute mb-4">
          Build A is your current build ({a.r.gpu?.name ?? 'no GPU'} + {a.r.cpu?.name ?? 'no CPU'}). Pick parts for Build B to compare.
        </p>
        <div className="grid sm:grid-cols-2 gap-2 mb-6">
          <label className="text-xs text-mute flex items-center gap-2">Build B GPU
            <select className="field !py-1.5 text-xs" value={gpuB} onChange={e => setGpuB(e.target.value)}>
              {DB.gpu.map(g => <option key={g.id} value={g.id}>{g.name} · {money(g.price)}</option>)}
            </select>
          </label>
          <label className="text-xs text-mute flex items-center gap-2">Build B CPU
            <select className="field !py-1.5 text-xs" value={cpuB} onChange={e => setCpuB(e.target.value)}>
              {DB.cpu.map(c => <option key={c.id} value={c.id}>{c.name} · {money(c.price)}</option>)}
            </select>
          </label>
        </div>
        <div className="space-y-3">
          {compareRows.map(r => (
            <div key={r.id}>
              <div className="flex justify-between text-xs mb-1">
                <span>{r.name}</span>
                <span className="text-mute">
                  <b className="text-cyan-300">A ~{r.a}</b> vs <b className="text-fuchsia-300">B ~{r.b}</b>
                  <span className={`ml-2 ${r.b > r.a ? 'text-good' : r.b < r.a ? 'text-bad' : ''}`}>
                    {r.b !== r.a && `${r.b > r.a ? '+' : ''}${Math.round(((r.b - r.a) / Math.max(r.a, 1)) * 100)}%`}
                  </span>
                </span>
              </div>
              <div className="space-y-1">
                <Bar value={r.a} max={maxFps} tone="neon" />
                <Bar value={r.b} max={maxFps} tone="viol" />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <MonitorMatchCard analysis={a} />

        <Card className="p-5">
          <h3 className="font-display font-semibold mb-1">Performance History</h3>
          <p className="text-xs text-mute mb-4">How your saved builds have evolved (avg est. FPS @1080p High).</p>
          {history.length === 0
            ? <EmptyState icon="activity" title="No saved builds yet" text="Save builds over time to track performance gains here."
                action={<Btn variant="primary" size="sm" onClick={() => app.saveBuild('My Forge Build')}>Create Your First Build</Btn>} />
            : (
              <div className="space-y-3">
                {history.map((h, i) => {
                  const prev = i > 0 ? history[i - 1].fps : null
                  const delta = prev ? Math.round(((h.fps - prev) / prev) * 100) : null
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="truncate">{h.name}</span>
                        <span className="text-mute shrink-0 ml-2">
                          ~{h.fps} FPS{delta !== null && <b className={delta >= 0 ? 'text-good ml-1.5' : 'text-bad ml-1.5'}>{delta >= 0 ? '+' : ''}{delta}%</b>}
                          <span className="ml-2 opacity-70">{money(h.price)}</span>
                        </span>
                      </div>
                      <Bar value={h.fps} max={Math.max(...history.map(x => x.fps))} tone={i === history.length - 1 ? 'good' : 'neon'} />
                    </div>
                  )
                })}
              </div>
            )}
        </Card>
      </div>

      <p className="text-[11px] text-mute mt-8 flex items-center gap-1.5">
        <Icon name="info" className="w-3.5 h-3.5" />
        PCForge's FPS model is calibrated against public performance tiers but is not a benchmark database. Expected performance varies by scene, drivers and settings.
      </p>
    </div>
  )
}

function Big({ label, v, accent }: { label: string; v: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-surface2 border border-line p-3">
      <div className="text-[10px] uppercase tracking-wider text-mute">{label}</div>
      <div className={`font-display font-bold text-2xl mt-1 ${accent ? 'grad-text' : ''}`}>{v}</div>
    </div>
  )
}
