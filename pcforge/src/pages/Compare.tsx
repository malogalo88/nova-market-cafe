import { useMemo, useState } from 'react'
import { useApp } from '../lib/store'
import { Badge, Card, Icon, SectionHead } from '../components/ui'
import { DB, getPart } from '../data/parts'
import type { Cat, CPU, GPU, MB, Part, PSU, RAM, Storage } from '../types'

const COMPARE_CATS: { key: Cat; label: string }[] = [
  { key: 'cpu', label: 'CPUs' }, { key: 'gpu', label: 'GPUs' }, { key: 'mb', label: 'Motherboards' },
  { key: 'ram', label: 'RAM' }, { key: 'storage', label: 'SSDs' }, { key: 'psu', label: 'PSUs' },
]

interface Row { label: string; a: string; b: string; winner?: 'a' | 'b' | null }

function specRows(cat: Cat, A: Part, B: Part): Row[] {
  const rows: Row[] = []
  const push = (label: string, va: any, vb: any, num = false, higherWins = true) => {
    const na = num ? Number(va) : NaN
    const nb = num ? Number(vb) : NaN
    let winner: 'a' | 'b' | null = null
    if (num && !isNaN(na) && !isNaN(nb) && na !== nb) winner = (higherWins ? na > nb : na < nb) ? 'a' : 'b'
    rows.push({ label, a: String(va), b: String(vb), winner })
  }
  const both = [A, B]
  switch (cat) {
    case 'cpu': {
      const [a, b] = both as CPU[]
      push('Socket', a.socket, b.socket)
      push('Cores / Threads', `${a.cores}/${a.threads}`, `${b.cores}/${b.threads}`)
      push('Boost clock', `${a.boost} GHz`, `${b.boost} GHz`)
      push('Gaming score', a.gaming, b.gaming, true); rows[rows.length - 1].label = '🏆 Gaming score'
      push('Productivity score', a.multi, b.multi, true); rows[rows.length - 1].label = '🏆 Productivity score'
      push('Value (gaming/$)', Math.round((a.gaming / a.price) * 1000), Math.round((b.gaming / b.price) * 1000), true); rows[rows.length - 1].label = '🏆 Value'
      push('Efficiency (gaming/W)', Math.round(a.gaming / a.tdp * 100) / 100, Math.round(b.gaming / b.tdp * 100) / 100, true); rows[rows.length - 1].label = '🏆 Power efficiency'
      push('Upgrade path', a.socket === 'AM5' ? 'AM5 (new CPUs expected)' : a.socket === 'LGA1700' ? 'LGA1700 (end of line)' : 'AM4 (mature)',
        b.socket === 'AM5' ? 'AM5 (new CPUs expected)' : b.socket === 'LGA1700' ? 'LGA1700 (end of line)' : 'AM4 (mature)')
      rows[rows.length - 1].label = '🏆 Upgradeability'
      break
    }
    case 'gpu': {
      const [a, b] = both as GPU[]
      push('VRAM', `${a.vram} GB`, `${b.vram} GB`)
      push('Performance index', a.perf, b.perf, true); rows[rows.length - 1].label = '🏆 Gaming'
      push('Productivity index', Math.round(a.perf * (1 + a.vram / 120)), Math.round(b.perf * (1 + b.vram / 120)), true); rows[rows.length - 1].label = '🏆 Productivity'
      push('Value (perf/$)', Math.round(a.perf / a.price * 1000), Math.round(b.perf / b.price * 1000), true); rows[rows.length - 1].label = '🏆 Value'
      push('Efficiency (perf/W)', Math.round(a.perf / a.tdp * 100) / 100, Math.round(b.perf / b.tdp * 100) / 100, true); rows[rows.length - 1].label = '🏆 Power efficiency'
      push('Future-proofing (VRAM class)', a.vram >= 16 ? 'High' : a.vram >= 12 ? 'Medium' : 'Basic', b.vram >= 16 ? 'High' : b.vram >= 12 ? 'Medium' : 'Basic')
      rows[rows.length - 1].label = '🏆 Upgradeability'
      push('Power draw', `${a.tdp} W`, `${b.tdp} W`, true, false)
      push('Recommended PSU', `${a.recPsu} W`, `${b.recPsu} W`, true, false)
      push('Length', `${a.length} mm`, `${b.length} mm`, true, false)
      break
    }
    case 'mb': {
      const [a, b] = both as MB[]
      push('Socket', a.socket, b.socket)
      push('Form factor', a.form, b.form)
      push('Memory', `${a.ramType} · up to ${a.maxRam}GB`, `${b.ramType} · up to ${b.maxRam}GB`)
      push('M.2 slots', a.m2, b.m2, true)
      push('SATA ports', a.sata, b.sata, true)
      push('Wi-Fi', a.wifi ? 'Yes' : 'No', b.wifi ? 'Yes' : 'No')
      push('Features per $', Math.round(((a.m2 * 2 + a.maxRam / 32 + (a.wifi ? 3 : 0)) / a.price) * 100), Math.round(((b.m2 * 2 + b.maxRam / 32 + (b.wifi ? 3 : 0)) / b.price) * 100), true)
      rows[rows.length - 1].label = '🏆 Value'
      push('Expansion', `${a.m2} M.2 + ${a.sata} SATA`, `${b.m2} M.2 + ${b.sata} SATA`)
      rows[rows.length - 1].label = '🏆 Upgradeability'
      break
    }
    case 'ram': {
      const [a, b] = both as RAM[]
      push('Type', a.type, b.type)
      push('Capacity', `${a.gb} GB`, `${b.gb} GB`, true)
      push('Speed', `${a.mhz} MHz`, `${b.mhz} MHz`, true)
      push('Kit layout', `${a.sticks}×${a.gb / a.sticks} GB`, `${b.sticks}×${b.gb / b.sticks} GB`)
      push('RGB', a.rgb ? 'Yes' : 'No', b.rgb ? 'Yes' : 'No')
      push('Value (GB/$)', Math.round(a.gb / a.price * 100) / 10, Math.round(b.gb / b.price * 100) / 10, true)
      rows[rows.length - 1].label = '🏆 Value'
      break
    }
    case 'storage': {
      const [a, b] = both as Storage[]
      push('Type', a.kind, b.kind)
      push('Interface', a.iface, b.iface)
      push('Capacity', `${a.gb >= 1000 ? a.gb / 1000 + ' TB' : a.gb + ' GB'}`, `${b.gb >= 1000 ? b.gb / 1000 + ' TB' : b.gb + ' GB'}`, true)
      push('Seq. read', `${a.read} MB/s`, `${b.read} MB/s`, true)
      push('Value (GB/$)', Math.round(a.gb / a.price * 100) / 10, Math.round(b.gb / b.price * 100) / 10, true)
      rows[rows.length - 1].label = '🏆 Value'
      break
    }
    case 'psu': {
      const [a, b] = both as PSU[]
      push('Wattage', `${a.watts} W`, `${b.watts} W`, true)
      push('Efficiency cert', a.cert, b.cert)
      push('Modular', a.modular ? 'Yes' : 'No', b.modular ? 'Yes' : 'No')
      push('Value (W/$)', Math.round(a.watts / a.price * 10) / 10, Math.round(b.watts / b.price * 10) / 10, true)
      rows[rows.length - 1].label = '🏆 Value'
      break
    }
  }
  return rows
}

function verdictText(cat: Cat, A: Part, B: Part): string {
  const nameOf = (p: Part) => p.name
  switch (cat) {
    case 'cpu': {
      const [a, b] = [A, B] as CPU[]
      const gamer = a.gaming > b.gaming ? a : b
      const worker = a.multi > b.multi ? a : b
      return `${nameOf(gamer)} is the better gaming chip, while ${nameOf(worker)} pulls ahead in multi-core workloads like rendering and compiling. If you mostly game at high refresh rates, prioritize gaming score; for streaming plus heavy multitasking, productivity matters more.`
    }
    case 'gpu': {
      const [a, b] = [A, B] as GPU[]
      const faster = a.perf > b.perf ? a : b
      const efficient = a.perf / a.tdp > b.perf / b.tdp ? a : b
      return `${nameOf(faster)} delivers higher estimated FPS, but ${nameOf(efficient)} does more with each watt. Check VRAM for the resolution you target — 12GB+ is safer for 1440p and above.`
    }
    default:
      return `Neither option is universally "better" — weigh the highlighted categories against your use case and budget. Value shows raw capability per dollar; upgradeability favors long-term flexibility.`
  }
}

export default function Compare() {
  const app = useApp()
  const [cat, setCat] = useState<Cat>('gpu')
  const [idA, setIdA] = useState('rtx-4070s')
  const [idB, setIdB] = useState('rx-7900gre')

  const list = DB[cat]
  const A = getPart(idA) && getPart(idA)!.cat === cat ? getPart(idA)! : list[0]
  const B = getPart(idB) && getPart(idB)!.cat === cat ? getPart(idB)! : list[1]
  const rows = useMemo(() => specRows(cat, A, B), [cat, A, B])
  const winsA = rows.filter(r => r.winner === 'a').length
  const winsB = rows.filter(r => r.winner === 'b').length

  const switchCat = (c: Cat) => {
    setCat(c)
    const l = DB[c]
    // default to current build's parts when possible
    const cur = app.build[c]
    setIdA(cur && l.some(x => x.id === cur) ? cur : l[Math.min(1, l.length - 1)].id)
    setIdB(l[l.length - 1].id)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <SectionHead eyebrow="Head to head" title="Compare Parts"
        sub="Side-by-side specifications with category winners. No product is universally better — see which fits your use case." />

      <div className="flex flex-wrap gap-1.5 mb-6">
        {COMPARE_CATS.map(c => (
          <button key={c.key} onClick={() => switchCat(c.key)}
            className={`text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${cat === c.key ? 'border-neon/50 text-neon bg-neon/10' : 'border-line text-mute hover:text-ink'}`}>
            {c.label}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden mb-6">
        <div className="grid grid-cols-[1fr_1fr_1fr] items-stretch border-b border-line">
          <div className="p-4 text-xs uppercase tracking-wider text-mute flex items-center">Spec</div>
          {[A, B].map((p, i) => (
            <div key={i} className={`p-4 ${i === 0 ? 'border-l border-cyan-400/20 bg-cyan-400/5' : 'border-l border-fuchsia-400/20 bg-fuchsia-400/5'}`}>
              <select className="field !py-1.5 !px-2 text-xs mb-2" value={p.id}
                onChange={e => (i === 0 ? setIdA : setIdB)(e.target.value)}>
                {list.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
              <div className="font-display font-bold">{`$${Math.round(p.price)}`}</div>
              <div className="text-[11px] text-mute">{p.brand} · ★ {p.rating.toFixed(1)}</div>
            </div>
          ))}
        </div>
        {rows.map((r, i) => (
          <div key={i} className={`grid grid-cols-[1fr_1fr_1fr] text-sm border-b border-line/50 last:border-0 ${r.label.startsWith('🏆') ? 'bg-surface2' : ''}`}>
            <div className="p-3 pr-2 text-xs text-mute flex items-center gap-1">
              {r.label.startsWith('🏆') && <span>{r.label.slice(0, 2)}</span>}{r.label.replace('🏆 ', '')}
            </div>
            {(['a', 'b'] as const).map(side => {
              const v = side === 'a' ? r.a : r.b
              const win = r.winner === side
              return (
                <div key={side} className={`p-3 flex items-center gap-2 ${side === 'a' ? 'border-l border-line/40' : 'border-l border-line/40'} ${win ? 'text-good font-semibold' : ''}`}>
                  {win && <Icon name="trophy" className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate" title={v}>{v}</span>
                </div>
              )
            })}
          </div>
        ))}
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <Badge tone={winsA === winsB ? 'line' : winsA > winsB ? 'neon' : 'viol'}>
            Category wins — A: {winsA} · B: {winsB}
          </Badge>
          <span className="text-xs text-mute">Trophy rows mark per-category leaders, not an overall verdict.</span>
        </div>
        <p className="text-sm leading-relaxed">{verdictText(cat, A, B)}</p>
      </Card>
    </div>
  )
}
