import React, { useMemo, useState } from 'react'
import type { BuildParts, Cat, CompatIssue, FpsEstimate, Game, Part } from '../types'
import { CATS, DB, getPart, getTyped } from '../data/parts'
import type { CPU, Cooler, GPU, MB, Monitor, RAM, Storage } from '../types'
import { GAMES, GAME_INDEX, RESOLUTIONS, SETTINGS } from '../data/games'
import {
  analyze, avgAcrossGames, compatCheck, estimateFps, money, monitorMatch,
  optimizePrice, balanceBuild, maximizePerformance, resolve, totalPrice,
  type Analysis, type OptimizeResult,
} from '../lib/engine'
import { useApp } from '../lib/store'
import { Badge, Bar, Btn, Card, EmptyState, Icon, Modal, ScoreRing, Stars, Tip } from './ui'

// ─── Part visual ───────────────────────────────────────────────────────────

const CAT_GRAD: Record<string, string> = {
  cpu: 'from-cyan-500/25 to-blue-500/10', gpu: 'from-violet-500/25 to-fuchsia-500/10',
  mb: 'from-emerald-500/20 to-cyan-500/10', ram: 'from-sky-500/25 to-indigo-500/10',
  storage: 'from-amber-500/20 to-orange-500/10', psu: 'from-yellow-500/15 to-amber-500/5',
  cooler: 'from-cyan-400/20 to-teal-500/10', case: 'from-slate-400/20 to-slate-500/5',
  fans: 'from-pink-500/20 to-violet-500/10', os: 'from-blue-400/20 to-cyan-400/10',
  monitor: 'from-teal-400/20 to-emerald-400/10', keyboard: 'from-rose-400/20 to-pink-400/10',
  mouse: 'from-fuchsia-400/20 to-purple-400/10', headset: 'from-indigo-400/20 to-blue-400/10',
  wifi: 'from-lime-400/20 to-emerald-400/10',
}

export function PartThumb({ part, size = 'md' }: { part: Part; size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'w-9 h-9 rounded-lg', md: 'w-12 h-12 rounded-xl', lg: 'w-full aspect-[16/10] rounded-xl' }[size]
  const icon = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-14 h-14' }[size]
  return (
    <div className={`${s} shrink-0 bg-gradient-to-br ${CAT_GRAD[part.cat] ?? 'from-cyan-500/20 to-violet-500/10'} border border-line flex items-center justify-center text-neon`}>
      <Icon name={part.cat === 'gpu' ? 'chip' : part.cat} className={icon} />
    </div>
  )
}

// ─── Compatibility status of a single part vs the current build ────────────

export function partStatus(cat: Cat, id: string, build: BuildParts): 'ok' | 'warn' | 'error' | 'none' {
  const cand: BuildParts = { ...build, [cat]: id }
  const issues = compatCheck(resolve(cand))
  const relevant = issues.filter(i => i.level !== 'ok')
  const errs = relevant.filter(i => i.level === 'error').length
  return errs > 0 ? 'error' : relevant.length > 0 ? 'warn' : 'ok'
}

function StatusBadge({ status }: { status: 'ok' | 'warn' | 'error' | 'none' }) {
  if (status === 'none') return null
  const map = {
    ok: ['good', '🟢 Compatible'], warn: ['warn', '🟡 Warning'], error: ['bad', '🔴 Incompatible'],
  } as const
  const [tone, label] = map[status]
  return <Badge tone={tone}>{label}</Badge>
}

// ─── Spec chips per category ───────────────────────────────────────────────

function specChips(p: Part): string[] {
  switch (p.cat) {
    case 'cpu': { const c = p as CPU; return [`${c.socket}`, `${c.cores}C/${c.threads}T`, `${c.boost} GHz`, `${c.tdp}W`] }
    case 'gpu': { const g = p as GPU; return [`${g.vram}GB VRAM`, `${g.tdp}W`, `${g.length}mm`, g.connectors] }
    case 'mb': { const m = p as MB; return [m.socket, m.form, m.ramType, `${m.m2}× M.2`, m.wifi ? 'Wi-Fi' : 'No Wi-Fi'] }
    case 'ram': { const r = p as RAM; return [r.type, `${r.gb}GB (${r.sticks}×${r.gb / r.sticks})`, `${r.mhz} MHz`, r.rgb ? 'RGB' : ''] }
    case 'storage': { const s = p as Storage; return [s.kind, s.iface, `${s.gb >= 1000 ? s.gb / 1000 + 'TB' : s.gb + 'GB'}`, `${s.read} MB/s`] }
    case 'psu': return [`${(p as any).watts}W`, (p as any).cert, (p as any).modular ? 'Modular' : 'Non-modular']
    case 'cooler': { const c = p as Cooler; return [c.kind, c.kind === 'Air' ? `${c.heightMm}mm tall` : `${c.radiator}mm AIO`, `${c.capacity}W`, `${c.noise} dBA`] }
    case 'case': return [(p as any).supports.join('/'), `GPU ≤${(p as any).gpuMm}mm`, `Cooler ≤${(p as any).coolerMm}mm`, (p as any).color]
    case 'monitor': { const m = p as Monitor; return [m.res, `${m.hz}Hz`, `${m.size}"`, m.panel] }
    default: return [(p as any).spec ?? (p as any).note ?? ''].filter(Boolean)
  }
}

export function perfOfPart(p: Part): number | null {
  if (p.cat === 'cpu') return (p as CPU).gaming
  if (p.cat === 'gpu') return (p as GPU).perf
  return null
}

// ─── Part card ─────────────────────────────────────────────────────────────

export function PartCard({ part, inBuild, onAdd, onRemove, compact = false }: {
  part: Part; inBuild: boolean; onAdd: () => void; onRemove?: () => void; compact?: boolean
}) {
  const { build } = useApp()
  const status = useMemo(() => partStatus(part.cat, part.id, build), [part, build])
  const perf = perfOfPart(part)
  const deal = part.msrp && part.price < part.msrp * 0.97

  return (
    <Card hover className="p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        {!compact && <PartThumb part={part} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] text-mute">{part.brand}</div>
              <div className="font-medium text-sm leading-snug truncate" title={part.name}>{part.name}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-display font-bold">{money(part.price)}</div>
              {deal && <div className="text-[10px] text-good">below typical ${part.msrp}</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {specChips(part).filter(Boolean).map((s, i) => (
          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface2 border border-line text-mute">{s}</span>
        ))}
      </div>

      {perf !== null && (
        <div>
          <div className="flex justify-between text-[10px] text-mute mb-1">
            <span>{part.cat === 'cpu' ? 'Gaming performance' : 'Performance'}</span><span>{Math.round(perf)}/100</span>
          </div>
          <Bar value={perf} tone={part.cat === 'gpu' ? 'viol' : 'neon'} />
        </div>
      )}

      <div className="flex items-center justify-between mt-auto pt-1">
        <div className="flex items-center gap-2.5">
          <Stars rating={part.rating} />
          <StatusBadge status={status} />
        </div>
        {inBuild ? (
          <Btn size="sm" variant="danger" onClick={onRemove}><Icon name="check" className="w-3.5 h-3.5" />In Build</Btn>
        ) : (
          <Btn size="sm" variant="primary" onClick={onAdd}><Icon name="plus" className="w-3.5 h-3.5" />Add to Build</Btn>
        )}
      </div>
    </Card>
  )
}

export function PartCardSkeleton() {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex gap-3"><div className="skeleton w-12 h-12 rounded-xl" /><div className="flex-1 space-y-2 py-1"><div className="skeleton h-3 w-3/4" /><div className="skeleton h-3 w-1/2" /></div></div>
      <div className="skeleton h-3 w-full" /><div className="skeleton h-8 w-full" />
    </Card>
  )
}

// ─── Part picker with filters ──────────────────────────────────────────────

interface Filters {
  q: string; brands: string[]; maxPrice: number; minPerf: number; minRating: number
  sort: 'perf' | 'priceAsc' | 'priceDesc' | 'rating'; compatOnly: boolean
  socket?: string; ramType?: string; formFactor?: string; vramMin?: number; kind?: string; maxPower?: number
}

function PickerFilters({ cat, f, setF }: { cat: Cat; f: Filters; setF: (f: Filters) => void }) {
  const brands = [...new Set(DB[cat].map(p => p.brand))]
  const sockets = cat === 'cooler' ? undefined : [...new Set((DB[cat] as any[]).map(p => p.socket).filter(Boolean))] as string[]
  const patch = (p: Partial<Filters>) => setF({ ...f, ...p })
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input className="field !py-2 text-sm" placeholder={`Search ${CATS.find(c => c.key === cat)!.label.toLowerCase()}…`} value={f.q} onChange={e => patch({ q: e.target.value })} />
        <select className="field !py-2 !w-auto text-sm" value={f.sort} onChange={e => patch({ sort: e.target.value as Filters['sort'] })}>
          <option value="perf">Top performance</option><option value="priceAsc">Price ↑</option>
          <option value="priceDesc">Price ↓</option><option value="rating">Rating</option>
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-mute">
        <label className="flex items-center gap-2">Max price
          <input type="range" min={0} max={2000} step={25} value={f.maxPrice} onChange={e => patch({ maxPrice: +e.target.value })} className="accent-cyan-400 w-28" />
          <span className="text-ink w-12">{f.maxPrice >= 2000 ? 'Any' : `$${f.maxPrice}`}</span>
        </label>
        {(cat === 'cpu' || cat === 'gpu') && (
          <label className="flex items-center gap-2">Min performance
            <input type="range" min={0} max={100} step={5} value={f.minPerf} onChange={e => patch({ minPerf: +e.target.value })} className="accent-cyan-400 w-24" />
            <span className="text-ink w-7">{f.minPerf}</span>
          </label>
        )}
        <label className="flex items-center gap-2">Min rating
          <select className="field !py-1 !w-auto text-xs" value={f.minRating} onChange={e => patch({ minRating: +e.target.value })}>
            {[0, 4, 4.5].map(v => <option key={v} value={v}>{v === 0 ? 'Any' : `${v}+`}</option>)}
          </select>
        </label>
        {sockets && sockets.length > 0 && (
          <label className="flex items-center gap-2">Socket
            <select className="field !py-1 !w-auto text-xs" value={f.socket ?? ''} onChange={e => patch({ socket: e.target.value || undefined })}>
              <option value="">Any</option>{sockets.map(s => <option key={s}>{s}</option>)}
            </select>
          </label>
        )}
        {(cat === 'mb' || cat === 'ram') && (
          <label className="flex items-center gap-2">RAM type
            <select className="field !py-1 !w-auto text-xs" value={f.ramType ?? ''} onChange={e => patch({ ramType: e.target.value || undefined })}>
              <option value="">Any</option><option>DDR4</option><option>DDR5</option>
            </select>
          </label>
        )}
        {(cat === 'mb' || cat === 'case') && (
          <label className="flex items-center gap-2">Form factor
            <select className="field !py-1 !w-auto text-xs" value={f.formFactor ?? ''} onChange={e => patch({ formFactor: e.target.value || undefined })}>
              <option value="">Any</option><option>ATX</option><option>Micro-ATX</option><option>Mini-ITX</option>
            </select>
          </label>
        )}
        {cat === 'gpu' && (
          <label className="flex items-center gap-2">VRAM ≥
            <select className="field !py-1 !w-auto text-xs" value={f.vramMin ?? 0} onChange={e => patch({ vramMin: +e.target.value })}>
              {[0, 8, 12, 16, 20].map(v => <option key={v} value={v}>{v === 0 ? 'Any' : `${v}GB`}</option>)}
            </select>
          </label>
        )}
        {cat === 'storage' && (
          <label className="flex items-center gap-2">Type
            <select className="field !py-1 !w-auto text-xs" value={f.kind ?? ''} onChange={e => patch({ kind: e.target.value || undefined })}>
              <option value="">Any</option><option>NVMe SSD</option><option>SATA SSD</option><option>HDD</option>
            </select>
          </label>
        )}
        {(cat === 'cpu' || cat === 'gpu') && (
          <label className="flex items-center gap-2">Max power
            <select className="field !py-1 !w-auto text-xs" value={f.maxPower ?? 0} onChange={e => patch({ maxPower: +e.target.value || undefined })}>
              {[0, 150, 250, 350, 500].map(v => <option key={v} value={v}>{v === 0 ? 'Any' : `${v}W`}</option>)}
            </select>
          </label>
        )}
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={f.compatOnly} onChange={e => patch({ compatOnly: e.target.checked })} className="accent-cyan-400" />
          Compatible with my build only
        </label>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {brands.map(b => (
          <button key={b} onClick={() => patch({ brands: f.brands.includes(b) ? f.brands.filter(x => x !== b) : [...f.brands, b] })}
            className={`text-[11px] px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${f.brands.includes(b) ? 'border-neon/50 text-neon bg-neon/10' : 'border-line text-mute hover:text-ink'}`}>
            {b}
          </button>
        ))}
      </div>
    </div>
  )
}

export function PartPicker({ cat }: { cat: Cat }) {
  const { build, setPart, beginner } = useApp()
  const [loading, setLoading] = useState(true)
  const [f, setF] = useState<Filters>({
    q: '', brands: [], maxPrice: 2000, minPerf: 0, minRating: 0, sort: 'perf', compatOnly: false,
  })
  React.useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => setLoading(false), 320)
    return () => clearTimeout(t)
  }, [cat])

  const items = useMemo(() => {
    let list = [...DB[cat]]
    const q = f.q.trim().toLowerCase()
    if (q) list = list.filter(p => `${p.name} ${p.brand}`.toLowerCase().includes(q))
    if (f.brands.length) list = list.filter(p => f.brands.includes(p.brand))
    list = list.filter(p => p.price <= f.maxPrice && p.rating >= f.minRating)
    if (cat === 'cpu' || cat === 'gpu') list = list.filter(p => perfOfPart(p)! >= f.minPerf)
    if (f.socket) list = list.filter(p => (p as any).socket === f.socket || (p as any).sockets?.includes(f.socket))
    if (f.ramType) list = list.filter(p => (p as any).type === f.ramType || (p as any).ramType === f.ramType)
    if (f.formFactor) list = list.filter(p => (p as any).form === f.formFactor || (p as any).supports?.includes(f.formFactor))
    if (f.vramMin) list = list.filter(p => (p as any).vram >= f.vramMin!)
    if (f.kind) list = list.filter(p => (p as any).kind === f.kind)
    const maxPower = f.maxPower
    if (maxPower) list = list.filter(p => (p as any).tdp <= maxPower)
    if (f.compatOnly) list = list.filter(p => partStatus(cat, p.id, build) !== 'error')
    const perf = (p: Part) => perfOfPart(p) ?? -1
    switch (f.sort) {
      case 'perf': list.sort((a, b) => perf(b) - perf(a)); break
      case 'priceAsc': list.sort((a, b) => a.price - b.price); break
      case 'priceDesc': list.sort((a, b) => b.price - a.price); break
      case 'rating': list.sort((a, b) => b.rating - a.rating); break
    }
    return list
  }, [cat, f, build])

  const meta = CATS.find(c => c.key === cat)!
  const current = getPart(build[cat])

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h3 className="font-display font-semibold text-lg flex items-center gap-2">
          {meta.label}
          {beginner && <Tip term={<Icon name="info" className="w-3.5 h-3.5 text-mute inline" />} text={meta.tip} />}
        </h3>
        {current && <Badge tone="neon">Selected: {current.name}</Badge>}
      </div>
      <PickerFilters cat={cat} f={f} setF={setF} />
      <div className="mt-4 grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <PartCardSkeleton key={i} />)
          : items.length === 0
            ? <div className="sm:col-span-2 xl:col-span-3"><EmptyState icon="filter" title="No parts match those filters" text="Try widening the price range or clearing some filters." action={<Btn onClick={() => setF({ ...f, q: '', brands: [], maxPrice: 2000, minPerf: 0, compatOnly: false })}>Clear filters</Btn>} /></div>
            : items.map(p => (
              <PartCard key={p.id} part={p} inBuild={build[cat] === p.id}
                onAdd={() => setPart(cat, p.id)}
                onRemove={() => setPart(cat, undefined)} />
            ))}
      </div>
    </div>
  )
}

// ─── Build summary sidebar ─────────────────────────────────────────────────

export function BuildSummary({ analysis, onSave, onShare }: { analysis: Analysis; onSave: () => void; onShare: () => void }) {
  const { build, setPart, beginner } = useApp()
  const a = analysis
  const snapGame = GAME_INDEX.get('fortnite')!
  const snap: FpsEstimate = estimateFps(a.r.cpu, a.r.gpu, a.r.ram, snapGame, '1080p', 'High')

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold">Build Summary</h3>
          <Badge tone="line">Live</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Total Price" value={money(a.price)} accent />
          <Stat label="Est. Gaming Power" value={`~${a.power.gamingW}W`} hint="Estimated draw while gaming." />
          <Stat label="Recommended PSU" value={`${a.power.recPsu}W+`} hint="Includes 20–30% headroom. Verify manufacturer specs." />
          <Stat label="Performance / $" value={a.perfPerDollar ? a.perfPerDollar.toFixed(1) : '—'} hint="Estimated combined performance score per $1000." />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 p-3 rounded-xl bg-surface2 border border-line">
          <ScoreRing score={a.scores.overall} size={78} label="Build Score" />
          <div className="flex-1 space-y-1.5 text-xs">
            <MiniScore label="Compatibility" v={a.scores.compat} />
            <MiniScore label="Value" v={a.scores.value} />
            <MiniScore label="Upgradeability" v={a.scores.upgradeability} />
          </div>
        </div>
        <div className="mt-3 text-xs text-mute flex items-center justify-between">
          <span>Fortnite · 1080p High (est.)</span>
          <span className="font-display font-bold text-ink text-sm">~{snap.avg} FPS</span>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Btn variant="primary" onClick={onSave}><Icon name="bookmark" className="w-4 h-4" />Save</Btn>
          <Btn onClick={onShare}><Icon name="share" className="w-4 h-4" />Share</Btn>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-display font-semibold mb-3">Selected Parts</h3>
        <div className="space-y-1.5">
          {CATS.map(c => {
            const p = getPart(build[c.key])
            return (
              <div key={c.key} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm ${p ? 'bg-surface2 border border-line' : 'opacity-60'}`}>
                <Icon name={(c.key === 'gpu' ? 'chip' : c.key) as string} className="w-4 h-4 text-neon shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase tracking-wider text-mute">{c.short}{!c.required && ' · optional'}</div>
                  {p ? <div className="truncate text-[13px]" title={p.name}>{p.name}</div>
                    : <div className="text-[13px] italic text-mute">Not selected</div>}
                </div>
                {p && <>
                  <span className="text-xs text-mute">{money(p.price)}</span>
                  <button onClick={() => setPart(c.key, undefined)} className="text-mute hover:text-bad cursor-pointer p-1" aria-label={`Remove ${p.name}`}><Icon name="x" className="w-3.5 h-3.5" /></button>
                </>}
              </div>
            )
          })}
        </div>
        {beginner && <p className="text-[11px] text-mute mt-3">Hover dotted terms anywhere for plain-English explanations.</p>}
      </Card>
    </div>
  )
}

function Stat({ label, value, accent, hint }: { label: string; value: string; accent?: boolean; hint?: string }) {
  return (
    <div className="rounded-xl bg-surface2 border border-line p-3">
      <div className="text-[10px] uppercase tracking-wider text-mute flex items-center gap-1">
        {label}{hint && <Tip term={<Icon name="info" className="w-3 h-3 inline" />} text={hint} />}
      </div>
      <div className={`font-display font-bold text-lg mt-0.5 ${accent ? 'grad-text' : ''}`}>{value}</div>
    </div>
  )
}

function MiniScore({ label, v }: { label: string; v: number }) {
  return (
    <div>
      <div className="flex justify-between text-mute"><span>{label}</span><span className="text-ink font-medium">{v}</span></div>
      <Bar value={v} tone={v >= 80 ? 'good' : v >= 55 ? 'neon' : 'warn'} className="mt-0.5" />
    </div>
  )
}

// ─── Compatibility panel ───────────────────────────────────────────────────

export function CompatPanel({ analysis }: { analysis: Analysis }) {
  const { setPart } = useApp()
  const errs = analysis.issues.filter(i => i.level === 'error')
  const warns = analysis.issues.filter(i => i.level === 'warn')
  const oks = analysis.issues.filter(i => i.level === 'ok')
  const dot = { error: '🔴', warn: '🟡', ok: '🟢' } as const

  return (
    <div className="space-y-3">
      {oks.length > 0 && oks.map((i, k) => (
        <Card key={k} className="p-4 flex gap-3 border-good/30">
          <span className="text-lg">{dot.ok}</span>
          <div><div className="font-medium text-sm text-good">{i.title}</div><div className="text-xs text-mute mt-0.5">{i.detail}</div></div>
        </Card>
      ))}
      {[...errs, ...warns].map((i, k) => (
        <Card key={k} className={`p-4 ${i.level === 'error' ? 'border-bad/40' : 'border-warn/40'}`}>
          <div className="flex gap-3">
            <span className="text-lg">{dot[i.level]}</span>
            <div className="flex-1">
              <div className={`font-medium text-sm ${i.level === 'error' ? 'text-bad' : 'text-warn'}`}>{i.title}</div>
              <div className="text-xs text-mute mt-1 leading-relaxed">{i.detail}</div>
              {i.fixIds && i.fixCat && (
                <div className="mt-3">
                  <div className="text-[11px] font-medium text-mute mb-1.5">Fix this problem — compatible alternatives:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {i.fixIds.map(fid => {
                      const fp = getPart(fid)!
                      return (
                        <button key={fid} onClick={() => setPart(i.fixCat!, fid)}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-line hover:border-good/60 hover:text-good cursor-pointer transition-colors text-left">
                          {fp.name} · {money(fp.price)}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ─── Bottleneck panel ──────────────────────────────────────────────────────

export function BottleneckPanel({ analysis }: { analysis: Analysis }) {
  const bn = analysis.bottleneck
  const rows = [
    ['CPU', bn.cpu], ['GPU', bn.gpu], ['RAM', bn.ram], ['Storage', bn.storage],
  ] as const
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-display font-semibold">Gaming Balance</h3>
        <Badge tone="line">Estimates only</Badge>
      </div>
      <p className="text-[11px] text-mute mb-4">Indicative scores at 1080p High — not exact scientific measurements.</p>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
        {rows.map(([label, v]) => (
          <div key={label}>
            <div className="flex justify-between text-sm mb-1"><span className="text-mute">{label}</span><span className="font-display font-semibold">{v}/10</span></div>
            <Bar value={v} tone={v >= 8 ? 'good' : v >= 6 ? 'neon' : v > 0 ? 'warn' : 'bad'} />
          </div>
        ))}
      </div>
      <div className="mt-5">
        <div className="flex justify-between text-xs text-mute mb-1.5">
          <span>CPU-limited share ≈ {bn.cpuShare}%</span><span>GPU-limited share ≈ {bn.gpuShare}%</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden flex">
          <div className="bg-gradient-to-r from-cyan-500 to-cyan-300 transition-all duration-500" style={{ width: `${bn.cpuShare}%` }} />
          <div className="bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-all duration-500" style={{ width: `${bn.gpuShare}%` }} />
        </div>
        <div className="flex justify-between text-[10px] mt-1"><span className="text-cyan-300">CPU load</span><span className="text-violet-300">GPU load</span></div>
      </div>
      <p className="text-sm mt-4 p-3 rounded-xl bg-surface2 border border-line leading-relaxed">{bn.verdict}</p>
    </Card>
  )
}

// ─── FPS estimator panel ───────────────────────────────────────────────────

export function FpsPanel({ analysis }: { analysis: Analysis }) {
  const [gameId, setGameId] = useState('fortnite')
  const [res, setRes] = useState('1080p')
  const [setting, setSetting] = useState('High')
  const game = GAME_INDEX.get(gameId)!
  const est = estimateFps(analysis.r.cpu, analysis.r.gpu, analysis.r.ram, game, res as any, setting as any)

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="font-display font-semibold">Gaming Performance Estimator</h3>
        <Badge tone="viol">Estimated — not guaranteed</Badge>
      </div>
      <div className="grid sm:grid-cols-3 gap-2 mb-4">
        <select className="field !py-2 text-sm" value={gameId} onChange={e => setGameId(e.target.value)}>
          {GAMES.map(g => <option key={g.id} value={g.id}>{g.name}{g.unreleased ? ' (projected)' : ''}</option>)}
        </select>
        <select className="field !py-2 text-sm" value={res} onChange={e => setRes(e.target.value)}>
          {RESOLUTIONS.map(r => <option key={r}>{r}</option>)}
        </select>
        <select className="field !py-2 text-sm" value={setting} onChange={e => setSetting(e.target.value)}>
          {SETTINGS.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      {game.note && <p className="text-[11px] text-warn mb-3 flex items-start gap-1.5"><Icon name="alert" className="w-3.5 h-3.5 shrink-0 mt-0.5" />{game.note}</p>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <BigStat label="Average FPS" value={`~${est.avg}`} accent />
        <BigStat label="1% Low FPS" value={`~${est.low1}`} />
        <BigStat label="FPS Range" value={`${est.min}–${est.max}`} />
        <div className="rounded-xl bg-surface2 border border-line p-3">
          <div className="text-[10px] uppercase tracking-wider text-mute mb-1.5">Utilization (est.)</div>
          <div className="text-xs space-y-1">
            <div className="flex justify-between"><span className="text-cyan-300">GPU</span><span>{est.gpuUtil}%</span></div>
            <div className="flex justify-between"><span className="text-violet-300">CPU</span><span>{est.cpuUtil}%</span></div>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-mute mt-3">Limited by: <b className="text-ink">{est.limitedBy.toUpperCase()}</b>. Actual results depend on settings, drivers, and game updates.</p>
    </Card>
  )
}

function BigStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-surface2 border border-line p-3">
      <div className="text-[10px] uppercase tracking-wider text-mute">{label}</div>
      <div className={`font-display font-bold text-2xl mt-1 ${accent ? 'grad-text' : ''}`}>{value}</div>
    </div>
  )
}

// ─── Upgrades ("What should I change?") ────────────────────────────────────

export function UpgradePanel({ analysis }: { analysis: Analysis }) {
  const { setPart, toast } = useApp()
  if (!analysis.upgrades.length)
    return <EmptyState icon="shield" title="No upgrades needed right now" text="Your components are well matched — spend your budget on games instead." />
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {analysis.upgrades.map((u, i) => (
        <Card key={i} hover className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="zap" className="w-4 h-4 text-warn" />
            <span className="font-display font-semibold text-sm">{u.label}</span>
            {u.fpsGain > 0 && <Badge tone="good">≈ +{u.fpsGain}% FPS (est.)</Badge>}
          </div>
          <div className="text-xs text-mute space-y-1 mb-3">
            <div>Current: <span className="text-ink">{u.current?.name ?? 'None'}</span></div>
            <div>Suggested: <span className="text-good">{u.suggested.name}</span> ({u.deltaPrice >= 0 ? '+' : ''}{money(u.deltaPrice)})</div>
            <div className="pt-1">{u.why}</div>
          </div>
          <div className="flex gap-2">
            <Btn size="sm" variant="primary" onClick={() => { setPart(u.cat, u.suggested.id); toast(`${u.suggested.name} installed`) }}>
              <Icon name="refresh" className="w-3.5 h-3.5" />Upgrade
            </Btn>
            <Btn size="sm" onClick={() => toast('Keeping current part')}>Keep Current Part</Btn>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ─── Optimizer bar (price / performance / balance) ─────────────────────────

export function OptimizerBar({ analysis }: { analysis: Analysis }) {
  const { loadParts, toast } = useApp()
  const [result, setResult] = useState<{ title: string; r: OptimizeResult } | null>(null)

  const openResult = (title: string, r: OptimizeResult) => {
    if (!r.swaps.length) { toast('No changes needed — already optimal', 'warn'); return }
    setResult({ title, r })
  }

  return (
    <>
      <div className="grid sm:grid-cols-3 gap-2">
        <Btn onClick={() => openResult('Optimize Price', optimizePrice(currentParts(analysis)))}>
          <Icon name="dollar" className="w-4 h-4 text-good" />Optimize Price
        </Btn>
        <Btn onClick={() => openResult('Maximize Performance', maximizePerformance(currentParts(analysis)))}>
          <Icon name="zap" className="w-4 h-4 text-warn" />Maximize Performance
        </Btn>
        <Btn onClick={() => openResult('Balance My Build', balanceBuild(currentParts(analysis)))}>
          <Icon name="gauge" className="w-4 h-4 text-neon" />Balance Build
        </Btn>
      </div>

      <Modal open={!!result} onClose={() => setResult(null)} title={result?.title}>
        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-surface2 border border-line p-3">
                <div className="text-[10px] uppercase text-mute">Before</div>
                <div className="font-display font-bold">{money(result.r.beforePrice)}</div>
              </div>
              <div className="rounded-xl bg-surface2 border border-line p-3">
                <div className="text-[10px] uppercase text-mute">After</div>
                <div className="font-display font-bold grad-text">{money(result.r.afterPrice)}</div>
              </div>
              <div className="rounded-xl bg-surface2 border border-line p-3">
                <div className="text-[10px] uppercase text-mute">Perf. change (est.)</div>
                <div className={`font-display font-bold ${result.r.perfDelta >= 0 ? 'text-good' : 'text-warn'}`}>
                  {result.r.perfDelta >= 0 ? '+' : ''}{result.r.perfDelta}%
                </div>
              </div>
            </div>
            <div className="space-y-1.5 text-sm">
              {result.r.swaps.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-xs bg-surface2 border border-line rounded-lg px-3 py-2">
                  <Badge tone="line">{s.label}</Badge>
                  <span className="truncate">{s.from} → <b>{s.to}</b></span>
                  <span className={`ml-auto shrink-0 ${s.save >= 0 ? 'text-good' : 'text-warn'}`}>{s.save >= 0 ? '−' : '+'}{money(Math.abs(s.save))}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Btn variant="primary" className="flex-1" onClick={() => { loadParts(result.r.parts); setResult(null); toast('Applied to your build') }}>
                Apply changes
              </Btn>
              <Btn onClick={() => setResult(null)}>Cancel</Btn>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

function currentParts(a: Analysis): BuildParts {
  const out: BuildParts = {}
  for (const c of CATS) {
    const p = (a.r as any)[c.key]
    if (p) (out as any)[c.key] = p.id
  }
  return out
}

// ─── Visual build preview ──────────────────────────────────────────────────

export function BuildPreview() {
  const { build } = useApp()
  const [rgbOn, setRgbOn] = useState(true)
  const cs = getTyped('case', build.case)
  const gpu = getTyped<GPU>('gpu', build.gpu)
  const cooler = getTyped<Cooler>('cooler', build.cooler)
  const fans = getPart(build.fans) as any
  const dark = !(cs as any)?.color || (cs as any).color === 'Black'
  const shell = dark ? '#141b2b' : '#e6ebf4'
  const shellEdge = dark ? '#2a3550' : '#c6cfdd'
  const fanCount = Math.min(fans?.count ?? 2, 3)
  const rgb = rgbOn && ((fans?.rgb ?? true))

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-semibold">Visual Preview</h3>
        <button onClick={() => setRgbOn(r => !r)} className={`text-xs px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${rgbOn ? 'border-viol/50 text-viol' : 'border-line text-mute'}`}>
          RGB {rgbOn ? 'ON' : 'OFF'}
        </button>
      </div>
      <svg viewBox="0 0 220 260" className="mx-auto max-h-72 floaty">
        {/* case */}
        <rect x="45" y="18" width="130" height="224" rx="10" fill={shell} stroke={shellEdge} strokeWidth="2" />
        {/* glass tint */}
        <rect x="52" y="26" width="116" height="208" rx="7" fill={dark ? 'rgba(34,211,238,0.03)' : 'rgba(120,140,180,0.06)'} />
        {/* motherboard */}
        <rect x="118" y="42" width="42" height="90" rx="3" fill={dark ? '#0d1424' : '#f3f6fb'} stroke={shellEdge} strokeWidth="1" />
        {/* CPU cooler */}
        {cooler?.kind === 'AIO' ? (
          <>
            <rect x="70" y="30" width="88" height="16" rx="4" fill={dark ? '#0d1424' : '#dde4ef'} stroke={shellEdge} />
            <circle cx="114" cy="38" r="5" fill="none" stroke={rgb ? '#a78bfa' : shellEdge} strokeWidth="1.5" className={rgb ? 'fan-spin-slow' : ''} />
            <rect x="122" y="66" width="30" height="30" rx="3" fill="#0ea5e9" opacity="0.25" />
          </>
        ) : (
          <rect x="124" y="62" width="32" height="46" rx="4" fill={dark ? '#101a30' : '#dbe2ee'} stroke={shellEdge} />
        )}
        {/* GPU */}
        {gpu && (
          <>
            <rect x="86" y="128" width={Math.max(48, Math.min(76, (gpu.length / 340) * 76))} height="17" rx="3"
              fill={dark ? '#182238' : '#cbd5e4'} stroke={shellEdge} />
            <rect x="90" y="132" width="10" height="9" rx="1.5" fill={rgb ? '#22d3ee' : shellEdge} opacity={rgb ? 0.8 : 0.5} className={rgb ? 'rgb-glow' : ''} />
          </>
        )}
        {/* front fans */}
        {Array.from({ length: fanCount }).map((_, i) => (
          <g key={i} transform={`translate(68 ${58 + i * 56})`}>
            <circle r="19" fill="none" stroke={shellEdge} strokeWidth="1.5" />
            <g className={rgb ? 'fan-spin' : ''} style={{ transformOrigin: '0 0' }}>
              <path d="M0 -14 C7 -12 9 -5 4 0 C9 5 7 12 0 14 C-7 12 -9 5 -4 0 C-9 -5 -7 -12 0 -14Z"
                fill={rgb ? 'url(#rgbfan)' : (dark ? '#1f2a44' : '#b9c4d6')} opacity={rgb ? 0.85 : 1} />
            </g>
            {rgb && <circle r="19" fill="none" stroke="#a78bfa" strokeWidth="1" opacity="0.5" className="rgb-glow" />}
          </g>
        ))}
        <defs>
          <linearGradient id="rgbfan" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#22d3ee" /><stop offset="1" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
        {/* feet */}
        <rect x="60" y="242" width="24" height="6" rx="2" fill={shellEdge} />
        <rect x="136" y="242" width="24" height="6" rx="2" fill={shellEdge} />
      </svg>
      <p className="text-[11px] text-mute text-center mt-2">Illustrative preview — updates with your case, GPU, cooler and fans.</p>
    </Card>
  )
}

// ─── Smart insights report ─────────────────────────────────────────────────

export function InsightsReport({ analysis }: { analysis: Analysis }) {
  const a = analysis
  const good: string[] = []
  const consider: string[] = a.issues.filter(i => i.level === 'warn').map(i => i.title)
  if (a.scores.performance >= 75) good.push(`Strong estimated gaming performance (${a.scores.performance}/100)`)
  if (a.scores.value >= 80) good.push('Excellent value for money')
  if ((a.power.headroom ?? 0) >= 0.25) good.push(`Good PSU headroom (~${Math.round((a.power.headroom ?? 0) * 100)}%)`)
  if ((a.r.storage?.gb ?? 0) >= 1000) good.push('Plenty of fast storage')
  if (a.bottleneck.cpu >= 8 && a.bottleneck.gpu >= 8) good.push('Well-balanced CPU/GPU pairing')
  if (a.scores.upgradeability >= 75) good.push('Strong upgrade path')
  if (!consider.length && a.issues.every(i => i.level === 'ok')) consider.push('Nothing major — nice work.')

  const games = ['fortnite', 'cod', 'minecraft', 'cyberpunk'].map(id => GAME_INDEX.get(id)!)
  const nextUp = a.upgrades.filter(u => u.fpsGain > 0).sort((x, y) => y.fpsGain - x.fpsGain).slice(0, 3).map(u => u.cat)
  const order = ['gpu', 'cpu', 'ram', 'storage', 'psu']
  const ranked = order.filter(c => nextUp.includes(c as Cat)).join(' → ')

  const resVerdict =
    a.bottleneck.gpu >= 9 ? 'This build is already excellent for 1440p gaming — and can push 4K at reduced settings.'
    : a.bottleneck.gpu >= 7 ? 'This build is excellent for 1080p gaming and very capable at 1440p.'
    : a.bottleneck.gpu >= 5 ? 'This build is a solid 1080p performer; 1440p is possible with adjusted settings.'
    : 'This build targets 1080p and esports titles; upgrade the GPU for higher resolutions.'

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <h3 className="font-display font-bold text-xl">Your PC is Ready 🔥</h3>
        <Badge tone="neon">PCForge Build Score: {a.scores.overall}/100</Badge>
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-good mb-2">What you did well</div>
          <ul className="space-y-1.5 text-sm">
            {good.length ? good.map((g, i) => <li key={i} className="flex gap-2"><Icon name="check" className="w-4 h-4 text-good shrink-0 mt-0.5" />{g}</li>)
              : <li className="text-mute">Complete your core parts to see strengths.</li>}
          </ul>
          <div className="text-xs font-semibold uppercase tracking-wider text-warn mt-5 mb-2">Things to consider</div>
          <ul className="space-y-1.5 text-sm">
            {consider.map((g, i) => <li key={i} className="flex gap-2"><Icon name="alert" className="w-4 h-4 text-warn shrink-0 mt-0.5" />{g}</li>)}
          </ul>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-mute mb-2">Estimated gaming performance</div>
          <div className="space-y-1.5">
            {games.map(g => {
              const e = estimateFps(a.r.cpu, a.r.gpu, a.r.ram, g, '1080p', 'High')
              return (
                <div key={g.id} className="flex items-center justify-between text-sm bg-surface2 border border-line rounded-lg px-3 py-2">
                  <span>{g.name}</span><span className="font-display font-semibold">~{e.avg} FPS</span>
                </div>
              )
            })}
          </div>
          <div className="text-xs font-semibold uppercase tracking-wider text-mute mt-5 mb-2">Best next upgrade</div>
          <p className="text-sm">{ranked ? ranked.toUpperCase() : 'You are well balanced — no urgent upgrades.'}</p>
        </div>
      </div>
      <div className="mt-5 p-3.5 rounded-xl bg-gradient-to-r from-cyan-500/10 to-violet-500/10 border border-neon/20 text-sm font-medium">
        {resVerdict} <span className="text-mute font-normal">All figures are estimates.</span>
      </div>
    </Card>
  )
}

// ─── Monitor match card ────────────────────────────────────────────────────

export function MonitorMatchCard({ analysis }: { analysis: Analysis }) {
  const fps = avgAcrossGames(analysis.r.cpu, analysis.r.gpu, analysis.r.ram, '1080p', 'High', ['fortnite', 'cs2'])
  const { picks, advice } = monitorMatch(fps, '1080p')
  return (
    <Card className="p-5">
      <h3 className="font-display font-semibold mb-1">Monitor Matching</h3>
      <p className="text-xs text-mute mb-3">{advice}</p>
      <div className="grid sm:grid-cols-2 gap-2">
        {picks.map(m => (
          <div key={m.id} className="flex items-center gap-3 bg-surface2 border border-line rounded-xl p-3">
            <PartThumb part={m} size="sm" />
            <div className="min-w-0 text-sm"><div className="truncate">{m.name}</div><div className="text-xs text-mute">{money(m.price)}</div></div>
          </div>
        ))}
      </div>
    </Card>
  )
}
