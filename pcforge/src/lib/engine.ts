import type {
  BuildParts, Cat, CompatIssue, CPU, Cooler, Case, FpsEstimate, Game, GPU,
  MB, Monitor, Part, PSU, RAM, Resolution, ScoreBreakdown, Setting, Storage,
} from '../types'
import { DB, CORE_CATS, CATS, getPart, getTyped } from '../data/parts'
import { GAMES, GAME_INDEX, RES_MULT, SET_MULT, minReq, recReq } from '../data/games'

// ─── helpers ───────────────────────────────────────────────────────────────

export const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n))
export const money = (n: number) =>
  n === 0 ? 'Free' : `$${Math.round(n).toLocaleString('en-US')}`
export const FPS_CAPS: Record<string, number> = { eldenring: 60 }

export function towerPrice(p: BuildParts): number {
  return CORE_CATS.concat(['fans', 'os']).reduce((s, c) => s + (getPart((p as any)[c])?.price ?? 0), 0)
}
export function totalPrice(p: BuildParts): number {
  return (Object.keys(p) as Cat[]).reduce((s, c) => s + (getPart(p[c])?.price ?? 0), 0)
}

export interface Resolved {
  cpu?: CPU; gpu?: GPU; mb?: MB; ram?: RAM; storage?: Storage
  psu?: PSU; cooler?: Cooler; case?: Case
  fans?: ReturnType<typeof getPart>; os?: ReturnType<typeof getPart>
  monitor?: Monitor
}
export function resolve(p: BuildParts): Resolved {
  return {
    cpu: getTyped<CPU>('cpu', p.cpu),
    gpu: getTyped<GPU>('gpu', p.gpu),
    mb: getTyped<MB>('mb', p.mb),
    ram: getTyped<RAM>('ram', p.ram),
    storage: getTyped<Storage>('storage', p.storage),
    psu: getTyped<PSU>('psu', p.psu),
    cooler: getTyped<Cooler>('cooler', p.cooler),
    case: getTyped<Case>('case', p.case),
    fans: getPart(p.fans),
    os: getPart(p.os),
    monitor: getTyped<Monitor>('monitor', p.monitor),
  }
}

// ─── FPS estimation ────────────────────────────────────────────────────────
// Heuristic model calibrated against public performance tiers.
// All outputs are ESTIMATES, not benchmarks or guarantees.

const K = 0.95

export function estimateFps(
  cpu: CPU | undefined, gpu: GPU | undefined, ram: RAM | undefined,
  game: Game, res: Resolution = '1080p', setting: Setting = 'High',
): FpsEstimate {
  const rm = RES_MULT[res] ?? 1
  const sm = SET_MULT[setting] ?? 1
  const gpuFps = gpu ? (gpu.perf * rm * sm) / (game.demand * K) : 0
  const cpuCap = cpu ? (cpu.gaming * 6.0) / Math.pow(Math.max(game.cpuLoad, 0.05), 0.35) : 0
  let avg = Math.min(gpuFps, cpuCap)
  if (FPS_CAPS[game.id]) avg = Math.min(avg, FPS_CAPS[game.id])
  const limitedBy: 'cpu' | 'gpu' = cpuCap <= gpuFps ? 'cpu' : 'gpu'

  let stab = 0.74
  if (ram) {
    if (ram.sticks >= 2) stab += 0.03
    else stab -= 0.07
    const fast = ram.type === 'DDR5' ? 5600 : 3600
    const slow = ram.type === 'DDR5' ? 4800 : 3200
    if (ram.mhz >= fast) stab += 0.02
    else if (ram.mhz < slow) stab -= 0.04
  }
  if (limitedBy === 'cpu') stab -= 0.04
  stab = clamp(stab, 0.58, 0.85)

  const low1 = Math.round(avg * stab)
  return {
    avg: Math.round(avg),
    low1,
    min: Math.max(1, Math.round(low1 * 0.82)),
    max: Math.round(avg * 1.14),
    gpuUtil: clamp(Math.round((avg / Math.max(gpuFps, 1)) * 100), 1, 99),
    cpuUtil: clamp(Math.round((avg / Math.max(cpuCap, 1)) * 100), 1, 99),
    limitedBy,
  }
}

export function avgAcrossGames(
  cpu: CPU | undefined, gpu: GPU | undefined, ram: RAM | undefined,
  res: Resolution, setting: Setting, ids = ['fortnite', 'cyberpunk', 'cs2', 'gtav'],
): number {
  const vals = ids.map(id => {
    const g = GAME_INDEX.get(id)!
    return estimateFps(cpu, gpu, ram, g, res, setting).avg
  })
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
}

// ─── Power ─────────────────────────────────────────────────────────────────

export interface PowerInfo {
  gamingW: number
  peakW: number
  recPsu: number
  headroom: number | null // fraction, null if no PSU selected
}

export function powerEstimate(r: Resolved): PowerInfo {
  let w = 65
  if (r.cpu) w += r.cpu.tdp * 0.72
  if (r.gpu) w += r.gpu.tdp
  if (r.storage?.kind === 'HDD') w += 8
  else if (r.storage) w += 4
  if (r.fans) w += (r.fans as any).count * 1.5
  if (r.ram) w += 5
  const gamingW = Math.round(w)
  const peakW = Math.round(w * 1.18)
  const base = r.gpu?.recPsu ?? 450
  const recPsu = Math.max(base, Math.ceil((peakW * 1.33) / 50) * 50)
  const headroom = r.psu ? (r.psu.watts - peakW) / r.psu.watts : null
  return { gamingW, peakW, recPsu, headroom }
}

// ─── Compatibility ─────────────────────────────────────────────────────────

function fixesFor(cat: Cat, pred: (p: Part) => boolean): string[] {
  return DB[cat].filter(pred)
    .sort((a, b) => ((a as any).perf ?? (a as any).gaming ?? 0) - ((b as any).perf ?? (b as any).gaming ?? 0))
    .slice(-3).map(p => p.id)
}

export function compatCheck(r: Resolved): CompatIssue[] {
  const out: CompatIssue[] = []
  const { cpu, mb, ram, gpu, case: cs, cooler, psu, storage } = r
  const power = powerEstimate(r)

  if (cpu && mb && cpu.socket !== mb.socket)
    out.push({
      level: 'error',
      title: 'CPU socket does not fit the motherboard',
      detail: `Your CPU uses ${cpu.socket}, but this motherboard uses ${mb.socket}. These are physically and electrically incompatible.`,
      fixCat: 'mb',
      fixIds: fixesFor('mb', m => (m as MB).socket === cpu.socket),
    })

  if (mb && ram && mb.ramType !== ram.type)
    out.push({
      level: 'error',
      title: 'RAM generation does not match the motherboard',
      detail: `This motherboard only accepts ${mb.ramType} memory, but you picked ${ram.type}. DDR generations do not fit each other's slots.`,
      fixCat: 'ram',
      fixIds: fixesFor('ram', m => (m as RAM).type === mb.ramType),
    })

  if (cs && mb && !cs.supports.includes(mb.form))
    out.push({
      level: 'error',
      title: 'Motherboard is too large for this case',
      detail: `The case supports ${cs.supports.join(', ')} boards, but your motherboard is ${mb.form}.`,
      fixCat: 'case',
      fixIds: fixesFor('case', c => (c as Case).supports.includes(mb.form)),
    })

  if (gpu && cs) {
    if (gpu.length > cs.gpuMm)
      out.push({
        level: 'error',
        title: 'GPU does not physically fit the case',
        detail: `Your graphics card is ${gpu.length}mm long, but the case only fits cards up to ${cs.gpuMm}mm.`,
        fixCat: 'case',
        fixIds: fixesFor('case', c => (c as Case).gpuMm >= gpu.length),
      })
    else if (cs.gpuMm - gpu.length < 15)
      out.push({
        level: 'warn',
        title: 'GPU clearance is very tight',
        detail: `Only ${cs.gpuMm - gpu.length}mm of spare clearance. It fits, but cable space will be cramped.`,
      })
  }

  if (cooler && cs) {
    if (cooler.kind === 'Air' && cooler.heightMm) {
      if (cooler.heightMm > cs.coolerMm)
        out.push({
          level: 'error',
          title: 'CPU cooler is too tall for the case',
          detail: `The cooler is ${cooler.heightMm}mm tall, but the case supports coolers up to ${cs.coolerMm}mm.`,
          fixCat: 'cooler',
          fixIds: fixesFor('cooler', c => (c as Cooler).kind === 'Air' && (c as Cooler).heightMm! <= cs.coolerMm),
        })
      else if (cs.coolerMm - cooler.heightMm < 10)
        out.push({ level: 'warn', title: 'Cooler clearance is tight', detail: `${cs.coolerMm - cooler.heightMm}mm to spare — double-check side panel space.` })
    }
    if (cooler.kind === 'AIO' && cooler.radiator && !cs.radiator.includes(cooler.radiator)) {
      const smaller = cs.radiator.filter(s => s < cooler.radiator!)
      out.push({
        level: smaller.length ? 'warn' : 'error',
        title: `${cooler.radiator}mm radiator may not mount`,
        detail: smaller.length
          ? `The case lists ${cs.radiator.join('/')}mm radiator mounts. A ${smaller.at(-1)}mm AIO would fit safely.`
          : `The case does not list a ${cooler.radiator}mm radiator mount.`,
        fixCat: 'cooler',
        fixIds: fixesFor('cooler', c => (c as Cooler).kind === 'AIO' && cs.radiator.includes((c as Cooler).radiator!)),
      })
    }
  }

  if (cpu && cooler && !cooler.sockets.includes(cpu.socket))
    out.push({
      level: 'error',
      title: 'Cooler does not support this CPU socket',
      detail: `This cooler supports ${cooler.sockets.join(', ')}, but your CPU is ${cpu.socket}.`,
      fixCat: 'cooler',
      fixIds: fixesFor('cooler', c => (c as Cooler).sockets.includes(cpu.socket)),
    })

  if (cpu && cooler && cpu.tdp > cooler.capacity * 1.25)
    out.push({
      level: 'warn',
      title: 'CPU cooler may not be sufficient',
      detail: `The ${cpu.name} can draw ~${cpu.tdp}W, which is well above this cooler's ~${cooler.capacity}W capacity. Expect thermal throttling under load.`,
      fixCat: 'cooler',
      fixIds: fixesFor('cooler', c => (c as Cooler).capacity >= cpu.tdp * 1.15),
    })

  if (psu && power.peakW > psu.watts)
    out.push({
      level: 'error',
      title: 'PSU wattage is too low',
      detail: `Estimated peak draw is ~${power.peakW}W but the PSU provides ${psu.watts}W. The system may shut down under load.`,
      fixCat: 'psu',
      fixIds: fixesFor('psu', p => (p as PSU).watts >= power.recPsu),
    })
  else if (psu && power.headroom !== null && power.headroom < 0.12)
    out.push({
      level: 'warn',
      title: 'PSU has limited upgrade headroom',
      detail: `Only about ${Math.round(power.headroom * 100)}% spare capacity. Fine today, but a future GPU upgrade may require a new PSU.`,
      fixCat: 'psu',
      fixIds: fixesFor('psu', p => (p as PSU).watts >= power.recPsu + 150),
    })

  if (mb && ram && ram.gb > mb.maxRam)
    out.push({ level: 'error', title: 'More RAM than the motherboard supports', detail: `Board supports up to ${mb.maxRam}GB; the kit is ${ram.gb}GB.` })

  if (mb && storage && storage.kind === 'NVMe SSD' && mb.m2 === 0)
    out.push({ level: 'warn', title: 'No M.2 slot available', detail: 'This motherboard has no M.2 slots — choose a SATA drive instead.' })

  const BIOS_RISK: Record<string, string[]> = {
    h610m: ['i5-13600k', 'i7-14700k', 'i9-14900k'],
    b660m: ['i7-14700k', 'i9-14900k'],
    b650m: ['r7-9800x3d'],
  }
  if (cpu && mb && BIOS_RISK[mb.id]?.includes(cpu.id))
    out.push({
      level: 'warn',
      title: 'BIOS update may be required',
      detail: `Older ${mb.name} stock may ship with a BIOS that predates the ${cpu.name}. You may need to flash the BIOS (most boards support USB flashing without a CPU).`,
    })

  if (!out.length)
    out.push({ level: 'ok', title: 'All checks passed', detail: 'Everything selected so far is compatible. PCForge re-checks automatically whenever you change a part.' })
  return out
}

export function compatScore(issues: CompatIssue[]): number {
  return clamp(100 - issues.filter(i => i.level === 'error').length * 30 - issues.filter(i => i.level === 'warn').length * 10)
}

// ─── Scores ────────────────────────────────────────────────────────────────

export function combinedPerf(r: Resolved): number {
  if (!r.cpu && !r.gpu) return 0
  if (!r.gpu) return r.cpu!.gaming
  if (!r.cpu) return r.gpu.perf
  return r.gpu.perf * 0.66 + r.cpu.gaming * 0.34
}

export function scoreBuild(r: Resolved, issues: CompatIssue[], price: number): ScoreBreakdown {
  const perf = combinedPerf(r)
  const power = powerEstimate(r)
  const notes: Record<string, string> = {}

  const performance = clamp(Math.round(perf))
  const ppd = price > 0 ? (perf / price) * 1000 : 0
  const value = clamp(Math.round(ppd * 1.35))
  const compat = compatScore(issues)

  let u = 0
  if (r.psu && power.headroom !== null) {
    if (power.headroom >= 0.3) u += 22
    else if (power.headroom >= 0.2) u += 16
    else if (power.headroom >= 0.1) u += 10
    else u += 4
  }
  if (r.mb) {
    u += r.mb.m2 >= 3 ? 14 : r.mb.m2 === 2 ? 10 : 4
    u += r.mb.maxRam >= 192 ? 12 : r.mb.maxRam >= 128 ? 9 : r.mb.maxRam >= 96 ? 6 : 3
    u += r.mb.socket === 'AM5' ? 16 : r.mb.socket === 'LGA1700' ? 9 : 4
    u += r.mb.sata >= 4 ? 6 : 3
  }
  if (r.case && r.gpu) {
    const margin = r.case.gpuMm - r.gpu.length
    u += margin >= 60 ? 12 : margin >= 30 ? 8 : 3
  }
  if (r.ram) u += r.ram.gb <= 32 ? 8 : 4
  const upgradeability = clamp(Math.round(u * 1.12))

  const effRaw = power.peakW > 0 ? (perf / power.peakW) * 1000 : 0
  const efficiency = clamp(Math.round(effRaw * 0.42))

  if (value >= 90) notes.value = 'Excellent frames-per-dollar for this class.'
  if (upgradeability >= 80) notes.upgrade = 'Strong upgrade path — good platform choice.'
  if (efficiency <= 55) notes.efficiency = 'Power-hungry configuration; expect higher energy bills.'
  if (performance >= 90) notes.performance = 'Top-tier estimated gaming performance.'

  const overall = Math.round(
    performance * 0.4 + value * 0.22 + compat * 0.16 + upgradeability * 0.12 + efficiency * 0.1,
  )
  return { overall, performance, value, compat, upgradeability, efficiency, notes }
}

// ─── Bottleneck ────────────────────────────────────────────────────────────

export interface Bottleneck {
  cpu: number; gpu: number; ram: number; storage: number
  cpuShare: number; gpuShare: number
  verdict: string
}

const PERF_TARGET: Record<Resolution, number> = { '720p': 28, '1080p': 48, '1440p': 75, '4K': 105 }

export function bottleneckAnalysis(r: Resolved, res: Resolution = '1080p'): Bottleneck {
  const gpuT = PERF_TARGET[res]
  const gpu = r.gpu ? clamp(Math.round((r.gpu.perf / gpuT) * 10), 1, 10) : 0
  const cpu = r.cpu ? clamp(Math.round((r.cpu.gaming / 92) * 10), 1, 10) : 0
  let ram = 0
  if (r.ram) {
    ram = r.ram.gb >= 32 ? 10 : r.ram.gb >= 16 ? 7 : 4
    if (r.ram.sticks >= 2 && r.ram.mhz >= (r.ram.type === 'DDR5' ? 5600 : 3600)) ram = Math.min(10, ram + 1)
  }
  const storage = !r.storage ? 0
    : r.storage.kind === 'NVMe SSD' ? (r.storage.iface === 'PCIe 4.0' ? 10 : 8)
    : r.storage.kind === 'SATA SSD' ? 7 : 4

  const utils = ['fortnite', 'cyberpunk', 'cs2'].map(id =>
    estimateFps(r.cpu, r.gpu, r.ram, GAME_INDEX.get(id)!, res, 'High'))
  const rawCpu = utils.reduce((s, u) => s + u.cpuUtil, 0) / utils.length
  const rawGpu = utils.reduce((s, u) => s + u.gpuUtil, 0) / utils.length
  const tot = rawCpu + rawGpu || 1
  const cpuShare = Math.round((rawCpu / tot) * 100)
  const gpuShare = 100 - cpuShare

  let verdict = 'Add a CPU and GPU to see balance analysis.'
  if (r.cpu && r.gpu) {
    const gap = cpu - gpu
    if (gap <= -3) verdict = `Your GPU is considerably stronger than your CPU. In CPU-heavy games, upgrading the CPU could improve your FPS.`
    else if (gap >= 3) verdict = `Your CPU outruns your GPU. At ${res} resolution, a stronger GPU would raise average FPS the most.`
    else verdict = 'Well balanced — neither component heavily limits the other at this resolution.'
  }
  return { cpu, gpu, ram, storage, cpuShare, gpuShare, verdict }
}

// ─── Recommendations ───────────────────────────────────────────────────────

export interface Rec {
  icon: string
  title: string
  detail: string
  swap?: { cat: Cat; removeId: string; addId: string; save: number }
}

function perfOf(p: Part): number {
  if (p.cat === 'cpu') return (p as CPU).gaming
  if (p.cat === 'gpu') return (p as GPU).perf
  return 0
}

function cheaperAlt(cur: Part, r: Resolved): Part | undefined {
  const pool = DB[cur.cat].filter(c => {
    if (c.id === cur.id || c.price >= cur.price * 0.93 || cur.price - c.price < 10) return false
    if (c.rating < 4.4) return false
    switch (cur.cat) {
      case 'cpu': {
        const a = c as CPU, b = cur as CPU
        return a.socket === b.socket && a.gaming >= b.gaming * 0.95
      }
      case 'gpu': {
        const a = c as GPU, b = cur as GPU
        return a.perf >= b.perf * 0.95
      }
      case 'ram': {
        const a = c as RAM, b = cur as RAM
        return a.type === b.type && a.gb === b.gb && a.sticks === b.sticks
      }
      case 'storage': {
        const a = c as Storage, b = cur as Storage
        return a.kind === b.kind && a.gb >= b.gb
      }
      case 'psu': {
        const a = c as PSU
        return a.watts >= powerEstimate(r).recPsu
      }
      case 'mb': {
        const a = c as MB, b = cur as MB
        return a.socket === b.socket && a.ramType === b.ramType && a.form === b.form && a.m2 >= Math.min(2, b.m2)
      }
      case 'cooler': {
        const a = c as Cooler, b = cur as Cooler
        const need = r.cpu ? r.cpu.tdp * 1.15 : 120
        return a.capacity >= need && a.kind === b.kind &&
          (!r.case || (a.heightMm ? a.heightMm <= r.case.coolerMm : true))
      }
      case 'case': {
        const a = c as Case
        return (!r.mb || a.supports.includes(r.mb.form)) && (!r.gpu || a.gpuMm >= r.gpu.length)
      }
      default:
        return (c as any).spec === (cur as any).spec
    }
  })
  return pool.sort((a, b) => b.price - a.price)[0]
}

export function recommendations(r: Resolved): Rec[] {
  const recs: Rec[] = []
  const power = powerEstimate(r)
  const bn = bottleneckAnalysis(r)

  for (const cat of ['gpu', 'cpu', 'mb', 'ram', 'storage', 'psu', 'case', 'cooler'] as Cat[]) {
    const cur = (r as any)[cat] as Part | undefined
    if (!cur) continue
    const alt = cheaperAlt(cur, r)
    if (alt) {
      const save = cur.price - alt.price
      recs.push({
        icon: 'dollar',
        title: `Save ${money(save)} on the ${CATS.find(c => c.key === cat)!.short}`,
        detail: `You're spending ${money(cur.price)} on the ${cur.name}. The ${alt.name} provides nearly identical performance for ${money(alt.price)} — saving ${money(save)} with little to no real-world difference.`,
        swap: { cat, removeId: cur.id, addId: alt.id, save },
      })
    }
  }

  if (bn.cpu && bn.gpu && bn.gpu - bn.cpu >= 3) {
    const better = DB.cpu
      .filter(c => (c as CPU).socket === (r.mb?.socket ?? (r.cpu as CPU)?.socket) && (c as CPU).gaming > (r.cpu!.gaming) && (c as CPU).price - (r.cpu!.price) < 200)
      .sort((a, b) => (a as CPU).gaming - (b as CPU).gaming)[0] as CPU | undefined
    recs.push({
      icon: 'zap',
      title: 'Your GPU is significantly stronger than your CPU',
      detail: better
        ? `Consider upgrading the CPU to reduce potential bottlenecks — e.g., the ${better.name} (+${money(Math.max(0, better.price - (r.cpu?.price ?? 0)))}) would lift CPU-limited scenarios noticeably.`
        : 'Consider upgrading the CPU to reduce potential bottlenecks in CPU-heavy titles.',
      swap: better ? { cat: 'cpu', removeId: r.cpu!.id, addId: better.id, save: -(better.price - (r.cpu?.price ?? 0)) } : undefined,
    })
  }

  if (r.psu && power.headroom !== null && power.headroom > 0.55 && r.psu.watts - power.peakW > 350)
    recs.push({
      icon: 'plug',
      title: 'PSU may be oversized',
      detail: `Your ${r.psu.watts}W PSU has huge headroom (~${Math.round(power.headroom * 100)}%). A smaller quality unit could save money — though extra headroom is nice for future upgrades.`,
    })
  else if (r.psu && power.headroom !== null && power.headroom >= 0.12 && power.headroom < 0.3)
    recs.push({
      icon: 'plug',
      title: 'PSU is sufficient, but headroom is modest',
      detail: `Your ${r.psu.watts}W PSU is sufficient today. A ${power.recPsu + 150}W unit would give you more upgrade headroom for a future GPU jump.`,
    })

  if (r.ram && r.ram.gb <= 16)
    recs.push({
      icon: 'memory',
      title: '16GB is the minimum for modern gaming',
      detail: 'Several new titles already exceed 12GB with background apps open. A 32GB kit is a cheap, future-proof step-up.',
    })
  if (r.ram && r.ram.sticks === 1)
    recs.push({ icon: 'memory', title: 'Single-channel RAM hurts performance', detail: 'One stick halves memory bandwidth. A 2-stick kit typically gains 5–15% FPS in CPU-limited scenarios.' })

  if (r.storage && r.storage.kind === 'HDD')
    recs.push({ icon: 'drive', title: 'Games load dramatically faster on an NVMe SSD', detail: 'Modern titles stream assets constantly. Even a budget NVMe drive removes stutter and long load screens compared to an HDD.' })
  if (r.storage && r.storage.gb < 1000)
    recs.push({ icon: 'drive', title: 'Storage fills up fast', detail: 'Call of Duty alone can exceed 150GB. A 1TB+ drive avoids constant uninstalling.' })

  if (r.mb && r.cpu && r.mb.price > r.cpu.price * 1.4 && r.mb.price > 180)
    recs.push({ icon: 'board', title: 'Motherboard spend looks high for this CPU', detail: `You're spending ${money(r.mb.price)} on the board versus ${money(r.cpu.price)} on the CPU. A cheaper board with the same features would not change FPS.` })

  if (r.monitor && r.gpu) {
    const t = PERF_TARGET[r.monitor.res]
    if (r.gpu.perf < t * 0.7)
      recs.push({ icon: 'screen', title: 'GPU may struggle at your monitor\'s resolution', detail: `The ${r.monitor.name} is ${r.monitor.res}, but your GPU is below the comfortable class for that resolution. Consider lowering settings or a ${r.monitor.res === '4K' ? '1440p' : '1080p'} display.` })
  }
  return recs.slice(0, 6)
}

// ─── Upgrade finder ("What should I change?") ──────────────────────────────

export interface UpgradeOption {
  cat: Cat
  label: string
  current?: Part
  suggested: Part
  deltaPrice: number
  fpsGain: number // percent, estimated
  why: string
}

function fpsGainPct(r: Resolved, cat: Cat, next: Part): number {
  const before = avgAcrossGames(r.cpu, r.gpu, r.ram, '1440p', 'High')
  const mod: Resolved = { ...r, [cat]: next } as any
  const after = avgAcrossGames(mod.cpu, mod.gpu, mod.ram, '1440p', 'High')
  return Math.round(((after - before) / Math.max(before, 1)) * 100)
}

export function upgradeOptions(r: Resolved): UpgradeOption[] {
  const opts: UpgradeOption[] = []

  if (r.gpu) {
    const ups = DB.gpu.filter(g => (g as GPU).perf >= (r.gpu as GPU).perf * 1.12)
      .sort((a, b) => (a as GPU).perf - (b as GPU).perf).slice(0, 2)
    for (const u of ups)
      opts.push({
        cat: 'gpu', label: 'Upgrade your GPU', current: r.gpu, suggested: u,
        deltaPrice: u.price - r.gpu.price, fpsGain: fpsGainPct(r, 'gpu', u),
        why: 'The GPU is the biggest lever on average FPS at 1080p/1440p.',
      })
  }
  if (r.cpu) {
    const ups = DB.cpu.filter(c => (c as CPU).socket === (r.mb?.socket ?? (r.cpu as CPU).socket) && (c as CPU).gaming >= (r.cpu as CPU).gaming * 1.12)
      .sort((a, b) => (a as CPU).gaming - (b as CPU).gaming).slice(0, 2)
    for (const u of ups)
      opts.push({
        cat: 'cpu', label: 'Upgrade your CPU', current: r.cpu, suggested: u,
        deltaPrice: u.price - r.cpu.price, fpsGain: fpsGainPct(r, 'cpu', u),
        why: 'Raises esports ceilings and 1% lows; matters most in CPU-heavy games.',
      })
  }
  if (r.ram && r.ram.gb <= 16) {
    const kits = DB.ram.filter(m => (m as RAM).type === r.ram!.type && (m as RAM).gb === 32)
      .sort((a, b) => a.price - b.price)
    if (kits[0])
      opts.push({ cat: 'ram', label: 'Add more RAM', current: r.ram, suggested: kits[0], deltaPrice: kits[0].price - r.ram.price, fpsGain: 3, why: 'Recommended if you multitask, stream, or play modern open-world titles.' })
  }
  if (r.storage && r.storage.gb < 2000) {
    const ssds = DB.storage.filter(s => (s as Storage).kind === 'NVMe SSD' && (s as Storage).gb >= 2000).sort((a, b) => a.price - b.price)
    if (ssds[0])
      opts.push({ cat: 'storage', label: 'Upgrade your SSD', current: r.storage, suggested: ssds[0], deltaPrice: ssds[0].price - r.storage.price, fpsGain: 0, why: 'Improves storage capacity and load times; no direct FPS change in most games.' })
  }
  if (r.psu) {
    const power = powerEstimate(r)
    if (power.headroom !== null && power.headroom < 0.2) {
      const next = DB.psu.filter(p => (p as PSU).watts >= power.recPsu + 100).sort((a, b) => a.price - b.price)[0]
      if (next)
        opts.push({ cat: 'psu', label: 'Add PSU headroom', current: r.psu, suggested: next, deltaPrice: next.price - r.psu.price, fpsGain: 0, why: 'Creates safe headroom for a future GPU upgrade.' })
    }
  }
  return opts.slice(0, 5)
}

// ─── Optimizers ────────────────────────────────────────────────────────────

export interface OptimizeResult {
  parts: BuildParts
  beforePrice: number
  afterPrice: number
  perfDelta: number
  swaps: { label: string; from: string; to: string; save: number }[]
}

export function optimizePrice(p: BuildParts): OptimizeResult {
  const r = resolve(p)
  const before = totalPrice(p)
  const beforePerf = combinedPerf(r)
  const parts: BuildParts = { ...p }
  const swaps: OptimizeResult['swaps'] = []
  for (const cat of ['mb', 'case', 'psu', 'cooler', 'ram', 'storage', 'gpu', 'cpu'] as Cat[]) {
    const cur = getPart((parts as any)[cat])
    if (!cur) continue
    const rr = resolve(parts)
    const alt = cheaperAlt(cur, rr)
    if (alt) {
      swaps.push({ label: CATS.find(c => c.key === cat)!.short, from: cur.name, to: alt.name, save: cur.price - alt.price })
      ;(parts as any)[cat] = alt.id
    }
  }
  const after = totalPrice(parts)
  const afterPerf = combinedPerf(resolve(parts))
  return {
    parts, beforePrice: before, afterPrice: after,
    perfDelta: beforePerf ? Math.round(((afterPerf - beforePerf) / beforePerf) * 100) : 0,
    swaps,
  }
}

export function maximizePerformance(p: BuildParts): OptimizeResult {
  const parts: BuildParts = { ...p }
  const r0 = resolve(parts)
  const budget = totalPrice(parts)
  const swaps: OptimizeResult['swaps'] = []

  // Trim non-FPS spending first.
  const trim: [Cat, (rr: Resolved) => Part | undefined][] = [
    ['fans', () => DB.fans.filter(f => f.price < ((r0.fans?.price ?? 0)) ).sort((a, b) => a.price - b.price)[0]],
    ['mb', (rr) => {
      if (!rr.cpu) return undefined
      return DB.mb.filter(m => (m as MB).socket === rr.cpu!.socket && (m as MB).ramType === (rr.ram?.type ?? (m as MB).ramType) && m.price < (rr.mb?.price ?? 0) && (m as MB).m2 >= 1)
        .sort((a, b) => b.price - a.price)[0]
    }],
    ['case', (rr) => DB.case.filter(c => (!rr.mb || (c as Case).supports.includes(rr.mb.form)) && (!rr.gpu || (c as Case).gpuMm >= rr.gpu.length) && c.price < (rr.case?.price ?? 0)).sort((a, b) => b.price - a.price)[0]],
    ['ram', (rr) => rr.ram && rr.ram.gb > 32 ? DB.ram.filter(m => (m as RAM).type === rr.ram!.type && (m as RAM).gb === 32).sort((a, b) => a.price - b.price)[0] : undefined],
    ['psu', (rr) => {
      const pw = powerEstimate(rr)
      if (rr.psu && rr.psu.watts > pw.recPsu + 200)
        return DB.psu.filter(x => (x as PSU).watts >= pw.recPsu + 50 && x.price < rr.psu!.price).sort((a, b) => b.price - a.price)[0]
      return undefined
    }],
  ]
  for (const [cat, fn] of trim) {
    const cur = getPart((parts as any)[cat])
    if (!cur) continue
    const alt = fn(resolve(parts))
    if (alt && alt.id !== cur.id) {
      swaps.push({ label: `Trimmed ${CATS.find(c => c.key === cat)!.short}`, from: cur.name, to: alt.name, save: -(cur.price - alt.price) })
      ;(parts as any)[cat] = alt.id
    }
  }

  // Spend the pool where it moves FPS most: GPU first, then CPU.
  let pool = budget - totalPrice(parts)
  const tryUpgrade = (cat: 'gpu' | 'cpu') => {
    const rr = resolve(parts)
    const cur = (rr as any)[cat] as Part | undefined
    if (!cur) return
    const cands = DB[cat]
      .filter(x => perfOf(x) > perfOf(cur) && x.price - cur.price <= pool)
      .sort((a, b) => perfOf(b) - perfOf(a))[0]
    if (cands) {
      pool -= cands.price - cur.price
      swaps.push({ label: `Invested in ${CATS.find(c => c.key === cat)!.short}`, from: cur.name, to: cands.name, save: -(cands.price - cur.price) })
      ;(parts as any)[cat] = cands.id
    }
  }
  tryUpgrade('gpu')
  tryUpgrade('cpu')

  const rAfter = resolve(parts)
  const beforePerf = combinedPerf(r0)
  const afterPerf = combinedPerf(rAfter)
  return {
    parts, beforePrice: budget, afterPrice: totalPrice(parts),
    perfDelta: beforePerf ? Math.round(((afterPerf - beforePerf) / beforePerf) * 100) : 0,
    swaps,
  }
}

export function balanceBuild(p: BuildParts): OptimizeResult {
  const parts: BuildParts = { ...p }
  const r0 = resolve(parts)
  const budget = totalPrice(parts)
  const swaps: OptimizeResult['swaps'] = []
  const ratio = () => {
    const rr = resolve(parts)
    if (!rr.cpu || !rr.gpu) return 1
    const cpuCap = estimateFps(rr.cpu, rr.gpu, rr.ram, GAME_INDEX.get('fortnite')!, '1440p', 'High').cpuUtil
    const gpuUtil = estimateFps(rr.cpu, rr.gpu, rr.ram, GAME_INDEX.get('fortnite')!, '1440p', 'High').gpuUtil
    return cpuCap / Math.max(gpuUtil, 1)
  }

  for (let i = 0; i < 3; i++) {
    const rt = ratio()
    if (rt > 1.3) {
      // CPU overkill → trade down CPU or up GPU, whichever is cheaper.
      const rr = resolve(parts)
      const gpuUp = DB.gpu.filter(g => rr.gpu && (g as GPU).perf > (rr.gpu as GPU).perf && (g as GPU).perf - (rr.gpu as GPU).perf <= 25)
        .sort((a, b) => a.price - b.price)[0]
      const cpuDown = DB.cpu.filter(c => rr.cpu && (c as CPU).socket === rr.cpu.socket && (c as CPU).gaming < rr.cpu.gaming * 0.95 && (c as CPU).gaming > rr.cpu.gaming * 0.75)
        .sort((a, b) => b.price - a.price)[0]
      const pickGpu = gpuUp && (!cpuDown || gpuUp.price - (rr.gpu?.price ?? 0) <= (rr.cpu!.price - cpuDown.price))
      if (pickGpu && totalPrice(parts) + (gpuUp.price - (rr.gpu?.price ?? 0)) <= budget * 1.05) {
        swaps.push({ label: 'Balanced toward GPU', from: rr.gpu!.name, to: gpuUp.name, save: -(gpuUp.price - rr.gpu!.price) })
        ;(parts as any).gpu = gpuUp.id
      } else if (cpuDown) {
        swaps.push({ label: 'Balanced toward CPU spend', from: rr.cpu!.name, to: cpuDown.name, save: rr.cpu!.price - cpuDown.price })
        ;(parts as any).cpu = cpuDown.id
      } else break
    } else if (rt < 0.77) {
      const rr = resolve(parts)
      const cpuUp = DB.cpu.filter(c => rr.mb && (c as CPU).socket === rr.mb.socket && (c as CPU).gaming > rr.cpu!.gaming)
        .sort((a, b) => (a as CPU).gaming - (b as CPU).gaming)[0] as CPU | undefined
      const gpuDown = DB.gpu.filter(g => rr.gpu && (g as GPU).perf < rr.gpu.perf * 0.9 && (g as GPU).perf > rr.gpu.perf * 0.7)
        .sort((a, b) => b.price - a.price)[0]
      if (cpuUp && totalPrice(parts) + (cpuUp.price - rr.cpu!.price) <= budget * 1.05) {
        swaps.push({ label: 'Balanced toward CPU', from: rr.cpu!.name, to: cpuUp.name, save: -(cpuUp.price - rr.cpu!.price) })
        ;(parts as any).cpu = cpuUp.id
      } else if (gpuDown) {
        swaps.push({ label: 'Balanced toward GPU spend', from: rr.gpu!.name, to: gpuDown.name, save: rr.gpu!.price - gpuDown.price })
        ;(parts as any).gpu = gpuDown.id
      } else break
    } else break
  }
  const beforePerf = combinedPerf(r0)
  const afterPerf = combinedPerf(resolve(parts))
  return {
    parts, beforePrice: budget, afterPrice: totalPrice(parts),
    perfDelta: beforePerf ? Math.round(((afterPerf - beforePerf) / beforePerf) * 100) : 0,
    swaps,
  }
}

// ─── Budget generator ──────────────────────────────────────────────────────

export type Purpose = 'Gaming' | 'Streaming' | 'School' | 'Programming' | 'Video editing' | '3D rendering' | 'Everything'

const ALLOC: Record<Purpose, Partial<Record<Cat, number>>> = {
  Gaming: { gpu: 0.37, cpu: 0.17, mb: 0.09, ram: 0.07, storage: 0.08, psu: 0.06, case: 0.06, cooler: 0.04, fans: 0.02, os: 0.04 },
  Streaming: { gpu: 0.33, cpu: 0.21, mb: 0.09, ram: 0.08, storage: 0.08, psu: 0.06, case: 0.05, cooler: 0.05, fans: 0.02, os: 0.03 },
  School: { gpu: 0.24, cpu: 0.2, mb: 0.1, ram: 0.09, storage: 0.13, psu: 0.06, case: 0.07, cooler: 0.04, fans: 0.02, os: 0.05 },
  Programming: { gpu: 0.24, cpu: 0.22, mb: 0.1, ram: 0.11, storage: 0.11, psu: 0.06, case: 0.06, cooler: 0.04, fans: 0.02, os: 0.04 },
  'Video editing': { gpu: 0.31, cpu: 0.2, mb: 0.09, ram: 0.11, storage: 0.1, psu: 0.06, case: 0.05, cooler: 0.04, fans: 0.01, os: 0.03 },
  '3D rendering': { gpu: 0.35, cpu: 0.18, mb: 0.08, ram: 0.11, storage: 0.09, psu: 0.06, case: 0.05, cooler: 0.04, fans: 0.01, os: 0.03 },
  Everything: { gpu: 0.32, cpu: 0.19, mb: 0.09, ram: 0.09, storage: 0.1, psu: 0.06, case: 0.06, cooler: 0.04, fans: 0.02, os: 0.03 },
}

const RES_SHIFT: Record<Resolution, number> = { '720p': -0.04, '1080p': -0.02, '1440p': 0, '4K': 0.05 }

function pickBest<T extends Part>(cat: Cat, cap: number, ok: (p: T) => boolean, preferValue: boolean): T | undefined {
  const pool = DB[cat].filter(p => ok(p as T)) as T[]
  if (!pool.length) return undefined
  const perfOfP = (p: T) => perfOf(p) || p.rating * 12
  const inBudget = pool.filter(p => p.price <= cap * (preferValue ? 1.18 : 1.32))
  const candidates = inBudget.length ? inBudget : [pool.slice().sort((a, b) => a.price - b.price)[0]]
  return candidates.slice().sort((a, b) =>
    preferValue
      ? perfOfP(b) / Math.max(b.price, 1) - perfOfP(a) / Math.max(a.price, 1)
      : perfOfP(b) - perfOfP(a),
  )[0]
}

export function generateBuild(budget: number, purpose: Purpose, res: Resolution, prefs: { wifi?: boolean; rgb?: boolean; quiet?: boolean; white?: boolean } = {}, preferValue = false): BuildParts {
  const b: BuildParts = {}
  const alloc = { ...ALLOC[purpose] }
  alloc.gpu = (alloc.gpu ?? 0) + RES_SHIFT[res]
  alloc.cpu = (alloc.cpu ?? 0) - RES_SHIFT[res] * 0.5

  const cpu = pickBest<CPU>('cpu', budget * (alloc.cpu ?? 0.17), () => true, preferValue)
  if (cpu) b.cpu = cpu.id
  const mb = pickBest<MB>('mb', budget * (alloc.mb ?? 0.09), m => !!cpu && m.socket === cpu.socket && (!prefs.white ? true : true), preferValue)
  if (mb) b.mb = mb.id
  const ram = pickBest<RAM>('ram', budget * (alloc.ram ?? 0.08), m => !!mb && m.type === mb.ramType && m.gb >= (purpose === 'School' ? 16 : 32) && (!prefs.rgb || m.rgb), preferValue)
  if (ram) b.ram = ram.id
  const gpu = pickBest<GPU>('gpu', budget * (alloc.gpu ?? 0.36), () => true, preferValue)
  if (gpu) b.gpu = gpu.id
  const storage = pickBest<Storage>('storage', budget * (alloc.storage ?? 0.08), s => s.kind === 'NVMe SSD' && s.gb >= (budget > 1200 ? 1000 : 500), preferValue)
  if (storage) b.storage = storage.id
  const rr = resolve(b)
  const pw = powerEstimate(rr)
  const psu = pickBest<PSU>('psu', budget * (alloc.psu ?? 0.06), p => p.watts >= pw.recPsu, preferValue)
  if (psu) b.psu = psu.id
  const cooler = pickBest<Cooler>('cooler', budget * (alloc.cooler ?? 0.04), c => !!cpu && c.sockets.includes(cpu.socket) && c.capacity >= cpu.tdp * 1.1 && (!prefs.quiet || c.noise < 34), preferValue)
  if (cooler) b.cooler = cooler.id
  const kase = pickBest<Case>('case', budget * (alloc.case ?? 0.06), c => !!mb && c.supports.includes(mb.form) && (!gpu || c.gpuMm >= gpu.length) && (!prefs.white || c.color === 'White'), preferValue)
  if (kase) b.case = kase.id
  if (prefs.rgb) b.fans = 'tlc12-3pk'
  if (prefs.wifi && !mb?.wifi) b.wifi = 'axe5400'
  b.os = budget > 700 ? 'win11-oem' : 'ubuntu'
  return b
}

export function generateVariants(budget: number, purpose: Purpose, res: Resolution, prefs: Parameters<typeof generateBuild>[3] = {}) {
  return {
    best: { label: 'Best Performance', desc: 'Maximum frame rates for your budget.', parts: generateBuild(budget, purpose, res, prefs, false) },
    value: { label: 'Best Value', desc: 'Nearly identical experience, smarter spending.', parts: generateBuild(budget, purpose, res, prefs, true) },
    balanced: { label: 'Balanced Build', desc: 'A middle path with upgrade headroom.', parts: (() => {
      const p = generateBuild(budget * 0.94, purpose, res, prefs, false)
      return p
    })() },
  }
}

// ─── Monitor matching ──────────────────────────────────────────────────────

export function monitorMatch(fps: number, res: Resolution): { picks: Monitor[]; advice: string } {
  const pool = DB.monitor.filter(m => (m as Monitor).res === res) as Monitor[]
  const idealHz = Math.max(60, Math.min(360, Math.round(fps / 10) * 10))
  let picks = pool
    .filter(m => m.hz <= idealHz * 1.35)
    .sort((a, b) => b.hz - a.hz)
    .slice(0, 2)
  if (!picks.length && pool.length) {
    picks = pool.slice()
      .sort((a, b) => Math.abs(a.hz - idealHz) - Math.abs(b.hz - idealHz))
      .slice(0, 2)
      .sort((a, b) => b.hz - a.hz)
  }
  const overkill = pool.filter(m => m.hz >= 300)
  let advice: string
  if (fps >= 240) advice = `Your PC averages around ${fps} FPS at ${res} — a 240Hz+ display makes sense.`
  else if (fps >= 140) advice = `Your PC averages around ${fps} FPS at ${res}. A ${Math.min(idealHz, 240)}Hz monitor matches it well.`
  else advice = `Your PC averages around ${fps} FPS at ${res}. A high-refresh (${idealHz}Hz-class) panel is plenty.`
  if (overkill.length && fps < 200)
    advice += ` A 360Hz monitor would provide little benefit for this particular build — your estimated FPS rarely reaches those frame rates.`
  return { picks, advice }
}

// ─── Can I run it ──────────────────────────────────────────────────────────

export interface RunVerdict {
  verdict: 'yes' | 'maybe' | 'no'
  headline: string
  rows: { res: Resolution; setting: Setting; fps: FpsEstimate }[]
  minOk: boolean
  recOk: boolean
}

export function canIRunIt(cpu: CPU | undefined, gpu: GPU | undefined, ramGb: number, game: Game): RunVerdict {
  const min = minReq(game)
  const rec = recReq(game)
  const ramObj: RAM = { cat: 'ram', id: 'x', name: 'x', brand: 'x', price: 0, rating: 4, type: 'DDR5', gb: ramGb, sticks: 2, mhz: 6000, rgb: false }
  const rows: RunVerdict['rows'] = [
    { res: '1080p', setting: 'Low', fps: estimateFps(cpu, gpu, ramObj, game, '1080p', 'Low') },
    { res: '1080p', setting: 'High', fps: estimateFps(cpu, gpu, ramObj, game, '1080p', 'High') },
    { res: '1440p', setting: 'High', fps: estimateFps(cpu, gpu, ramObj, game, '1440p', 'High') },
    { res: '4K', setting: 'Ultra', fps: estimateFps(cpu, gpu, ramObj, game, '4K', 'Ultra') },
  ]
  const gpuPerf = gpu?.perf ?? 0
  const cpuPerf = cpu?.gaming ?? 0
  const minOk = gpuPerf >= min.gpuPerf && cpuPerf >= min.cpuGaming && ramGb >= min.ramGb
  const recOk = gpuPerf >= rec.gpuPerf && cpuPerf >= rec.cpuGaming && ramGb >= rec.ramGb
  const verdict: RunVerdict['verdict'] = recOk ? 'yes' : minOk ? 'maybe' : 'no'
  const headline = recOk
    ? `Yes — comfortably. Estimated ${rows[1].fps.avg}+ FPS at 1080p High.`
    : minOk
      ? `Yes, with settings adjustments. Expect roughly ${rows[1].fps.avg} FPS at 1080p High.`
      : `Not recommended. This hardware falls short of the game's minimum requirements.`
  return { verdict, headline, rows, minOk, recOk }
}

// ─── Share-link encoding ───────────────────────────────────────────────────

export function encodeBuild(name: string, parts: BuildParts): string {
  const json = JSON.stringify({ v: 1, n: name, p: parts })
  return btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeBuild(code: string): { name: string; parts: BuildParts } | null {
  try {
    const b = code.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(atob(b).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''))
    const obj = JSON.parse(json)
    if (obj && typeof obj === 'object' && obj.p) return { name: String(obj.n ?? 'Shared Build'), parts: obj.p }
    return null
  } catch {
    return null
  }
}

// ─── Full analysis ─────────────────────────────────────────────────────────

export interface Analysis {
  r: Resolved
  price: number
  power: PowerInfo
  issues: CompatIssue[]
  scores: ScoreBreakdown
  bottleneck: Bottleneck
  recs: Rec[]
  upgrades: UpgradeOption[]
  perfPerDollar: number
  ready: boolean
}

export function analyze(p: BuildParts): Analysis {
  const r = resolve(p)
  const price = totalPrice(p)
  const power = powerEstimate(r)
  const issues = compatCheck(r)
  const scores = scoreBuild(r, issues, price)
  const perf = combinedPerf(r)
  return {
    r, price, power, issues, scores,
    bottleneck: bottleneckAnalysis(r),
    recs: recommendations(r),
    upgrades: upgradeOptions(r),
    perfPerDollar: price > 0 ? Number((perf / price * 1000).toFixed(1)) : 0,
    ready: CORE_CATS.every(c => !!r[c as keyof Resolved]),
  }
}
