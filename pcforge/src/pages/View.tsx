import { useMemo, useState } from 'react'
import { useApp } from '../lib/store'
import { Badge, Bar, Btn, Card, EmptyState, Icon, ScoreRing, SectionHead, Stars, Tip } from '../components/ui'
import { PartThumb, BuildSummary, FpsPanel } from '../components/builder-ui'
import { CATS, DB, getPart } from '../data/parts'
import { SEED_POSTS } from '../data/community'
import { analyze, avgAcrossGames, decodeBuild, encodeBuild, money } from '../lib/engine'
import { Link, navigate } from '../lib/router'
import type { BuildParts, CPU, GPU, MB, Part, PSU, RAM, Storage } from '../types'

// ─── Shared build viewer ───────────────────────────────────────────────────

export function SharedBuild({ code }: { code: string }) {
  const app = useApp()
  const decoded = useMemo(() => decodeBuild(code), [code])

  if (!decoded) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <Card className="p-0">
          <EmptyState icon="alert" title="This build link is invalid"
            text="The share code couldn't be decoded. Ask for a fresh link — or forge your own build."
            action={<Link to="/builder"><Btn variant="primary">Open the Builder</Btn></Link>} />
        </Card>
      </div>
    )
  }

  const a = analyze(decoded.parts)
  const fps = avgAcrossGames(a.r.cpu, a.r.gpu, a.r.ram, '1080p', 'High')

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <SectionHead eyebrow="Shared build" title={decoded.name}
        sub="Someone forged this configuration and sent it to you. Load it into your builder to tweak and make it yours." />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <ScoreRing score={a.scores.overall} label="overall" />
              <div className="flex-1 min-w-40 space-y-2">
                {[['Gaming', a.scores.performance], ['Value', a.scores.value], ['Upgradeability', a.scores.upgradeability], ['Efficiency', a.scores.efficiency]].map(([l, v]) => (
                  <div key={l as string}>
                    <div className="flex justify-between text-xs mb-1"><span className="text-mute">{l}</span><b>{v}</b></div>
                    <Bar value={v as number} tone={(v as number) >= 70 ? 'good' : (v as number) >= 45 ? 'neon' : 'warn'} />
                  </div>
                ))}
              </div>
              <div className="text-right">
                <div className="font-display font-bold text-2xl grad-text">{money(a.price)}</div>
                <div className="text-[11px] text-mute">≈ {fps} FPS @1080p High</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Btn variant="primary" onClick={() => { app.loadParts(decoded.parts); navigate('/builder') }}>
                <Icon name="edit" className="w-4 h-4" />Open in Builder
              </Btn>
              <Btn onClick={() => { app.loadParts(decoded.parts); app.saveBuild(decoded.name); }}>
                <Icon name="bookmark" className="w-4 h-4" />Save to my builds
              </Btn>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-display font-semibold mb-3">Parts list</h3>
            <div className="space-y-1.5">
              {CATS.filter(c => decoded.parts[c.key]).map(c => {
                const p = getPart(decoded.parts[c.key])!
                return (
                  <Link key={c.key} to={`/part/${p.id}`}
                    className="flex items-center gap-3 rounded-xl border border-line/60 bg-surface2 px-3 py-2 hover:border-neon/40 transition-colors cursor-pointer">
                    <PartThumb part={p} size="sm" />
                    <span className="text-[10px] uppercase tracking-wider text-mute w-14 shrink-0">{c.short}</span>
                    <span className="text-sm truncate flex-1">{p.name}</span>
                    <span className="text-sm font-medium shrink-0">{money(p.price)}</span>
                  </Link>
                )
              })}
            </div>
          </Card>

          <FpsPanel analysis={a} />
        </div>

        <BuildSummary analysis={a}
          onSave={() => { app.loadParts(decoded.parts); app.saveBuild(decoded.name) }}
          onShare={() => {
            const link = `${window.location.origin}${window.location.pathname}#/build/${encodeBuild(decoded.name, decoded.parts)}`
            navigator.clipboard?.writeText(link).then(() => app.toast('Share link copied'), () => app.toast('Copy failed', 'warn'))
          }} />
      </div>
    </div>
  )
}

// ─── Part detail page ──────────────────────────────────────────────────────

function prosCons(p: Part): { pros: string[]; cons: string[] } {
  const pros: string[] = []
  const cons: string[] = []
  if (p.cat === 'gpu') {
    const g = p as GPU
    if (g.perf >= 70) pros.push('High-tier performance — comfortable at 1440p and beyond')
    if (g.perf < 35) cons.push('Entry-level: expect to lower settings in modern AAA titles')
    if (g.vram >= 16) pros.push(`${g.vram}GB VRAM is future-proof for higher resolutions`)
    else if (g.vram <= 8) cons.push('8GB VRAM can limit texture quality in newer games')
    if (g.tdp / g.perf < 1.1) pros.push(`Efficient: ~${g.tdp}W for this performance class`)
    if (g.length > 320) cons.push(`Long card (${g.length}mm) — check case clearance`)
    pros.push(`Great value per frame at ${money(g.price)} (sample price)`)
  } else if (p.cat === 'cpu') {
    const c = p as CPU
    if (c.gaming >= 80) pros.push('Top-class gaming performance')
    if (c.multi >= 60) pros.push('Strong multi-core results for streaming and creation')
    if (c.socket === 'AM5') pros.push('AM5 socket has an upgrade path ahead of it')
    if (c.socket === 'AM4') cons.push('AM4 is a mature platform — limited future CPU upgrades')
    if (c.igpu) pros.push('Integrated graphics — basic display output without a GPU')
    else cons.push('No integrated graphics — a dedicated GPU is required')
    if (c.tdp >= 120) cons.push(`Draws up to ${c.tdp}W — budget for cooling and PSU headroom`)
  } else if (p.cat === 'ram') {
    const r = p as RAM
    if (r.gb >= 32) pros.push('32GB handles gaming + heavy multitasking')
    if (r.mhz >= 6000 && r.type === 'DDR5') pros.push('Fast DDR5 kit — sweet spot for Ryzen 7000/9000')
    if (r.rgb) pros.push('RGB lighting with software control')
    if (r.sticks === 1) cons.push('Single stick = single-channel bandwidth penalty')
    if (r.type === 'DDR4') cons.push('DDR4 platform is end-of-line for new builds')
  } else if (p.cat === 'storage') {
    const s = p as Storage
    if (s.iface === 'PCIe 4.0') pros.push('PCIe 4.0 speeds for fast loads and transfers')
    if (s.gb >= 1000000) pros.push('1TB+ holds a healthy modern library')
    if (s.gb < 500000) cons.push('Under 500GB fills up quickly with modern installs')
    if (s.kind !== 'HDD') pros.push('SSD storage — no moving parts, instant load times')
  } else if (p.cat === 'psu') {
    const u = p as PSU
    if (u.cert.startsWith('80+ Gold')) pros.push('Gold efficiency — cooler, quieter, cheaper to run')
    if (u.modular) pros.push('Modular cabling keeps the build tidy')
    if (u.watts >= 750) pros.push('Plenty of headroom for GPU upgrades')
    if (u.watts < 550) cons.push('Limited upgrade headroom for bigger GPUs')
  } else if (p.cat === 'mb') {
    const m = p as MB
    if (m.m2 >= 2) pros.push(`${m.m2} M.2 slots for NVMe storage expansion`)
    if (m.wifi) pros.push('Built-in Wi-Fi saves an add-in card')
    if (!m.wifi) cons.push('No built-in Wi-Fi')
    if (m.form === 'ATX') pros.push('ATX layout: roomy for building and airflow')
    if (m.form === 'Mini-ITX') cons.push('Mini-ITX: cramped builds, fewer slots, often pricier cases/PSUs')
  }
  return { pros: pros.slice(0, 4), cons: cons.slice(0, 3) }
}

export function PartPage({ id }: { id: string }) {
  const app = useApp()
  const part = getPart(id)

  if (!part) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <Card className="p-0">
          <EmptyState icon="search" title="Part not found"
            text="That component isn't in our sample database."
            action={<Link to="/builder"><Btn variant="primary">Browse parts</Btn></Link>} />
        </Card>
      </div>
    )
  }

  const catMeta = CATS.find(c => c.key === part.cat)!
  const { pros, cons } = prosCons(part)
  const related = DB[part.cat].filter(x => x.id !== part.id)
    .sort((x, y) => Math.abs(x.price - part.price) - Math.abs(y.price - part.price)).slice(0, 4)
  const compatWith = useMemo(() => {
    switch (part.cat) {
      case 'cpu': return DB.mb.filter(m => (m as MB).socket === part.socket).map(m => m.name)
      case 'mb': return DB.cpu.filter(c => (c as CPU).socket === part.socket).map(c => c.name)
      case 'ram': return DB.mb.filter(m => (m as MB).ramType === part.type).map(m => m.name)
      default: return []
    }
  }, [part])
  const inBuild = app.build[part.cat] === part.id

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <button onClick={() => navigate('/builder')} className="text-xs text-mute hover:text-neon cursor-pointer inline-flex items-center gap-1 mb-4">
        <Icon name="arrowRight" className="w-3.5 h-3.5 rotate-180" />Back to builder
      </button>

      <div className="grid md:grid-cols-[300px_minmax(0,1fr)] gap-5 items-start">
        <Card className="p-6 flex flex-col items-center text-center md:sticky md:top-20">
          <PartThumb part={part} size="lg" />
          <Badge tone="line" className="mt-4">{catMeta.label}</Badge>
          <h1 className="font-display font-bold text-lg mt-2 leading-snug">{part.name}</h1>
          <Stars rating={part.rating} className="mt-1" />
          <div className="font-display font-bold text-2xl grad-text mt-3">{money(part.price)}</div>
          {part.msrp && part.msrp > part.price && (
            <div className="text-xs text-good mt-0.5">Deal: MSRP {money(part.msrp)} · save {Math.round((1 - part.price / part.msrp) * 100)}%</div>
          )}
          <p className="text-[10px] text-mute mt-1">Sample price — not a store listing.</p>
          <div className="flex flex-col gap-2 w-full mt-4">
            {inBuild ? (
              <Btn variant="soft" onClick={() => app.setPart(part.cat, undefined)}><Icon name="check" className="w-4 h-4 text-good" />In your build — remove?</Btn>
            ) : (
              <Btn variant="primary" onClick={() => { app.setPart(part.cat, part.id); }}>
                <Icon name="plus" className="w-4 h-4" />Add to Build
              </Btn>
            )}
            <Btn onClick={() => navigate('/compare')}><Icon name="layers" className="w-4 h-4" />Compare</Btn>
            <Btn onClick={() => { app.loadParts({ ...app.build, [part.cat]: part.id }); app.saveBuild(`${part.name} spot-build`); }}>
              <Icon name="bookmark" className="w-4 h-4" />Save
            </Btn>
          </div>
        </Card>

        <div className="space-y-4">
          {(part.cat === 'cpu' || part.cat === 'gpu') && (
            <Card className="p-5">
              <h3 className="font-display font-semibold mb-3">Performance tier</h3>
              <Bar value={part.cat === 'gpu' ? (part as GPU).perf : (part as CPU).gaming} max={100} tone="neon" />
              <div className="flex justify-between text-xs text-mute mt-1.5">
                <span>Entry</span><span>{part.cat === 'gpu' ? `Index ${(part as GPU).perf}` : `Gaming score ${(part as CPU).gaming}`} / 100</span><span>Flagship</span>
              </div>
            </Card>
          )}

          <Card className="p-5">
            <h3 className="font-display font-semibold mb-3">Specifications</h3>
            <SpecTable part={part} />
          </Card>

          {(pros.length > 0 || cons.length > 0) && (
            <div className="grid sm:grid-cols-2 gap-4">
              <Card className="p-5">
                <h3 className="font-display font-semibold text-good mb-2 flex items-center gap-1.5"><Icon name="check" className="w-4 h-4" />Pros</h3>
                <ul className="space-y-1.5 text-sm text-mute">{pros.map((x, i) => <li key={i}>• {x}</li>)}</ul>
              </Card>
              <Card className="p-5">
                <h3 className="font-display font-semibold text-warn mb-2 flex items-center gap-1.5"><Icon name="alert" className="w-4 h-4" />Consider</h3>
                <ul className="space-y-1.5 text-sm text-mute">{cons.map((x, i) => <li key={i}>• {x}</li>)}{cons.length === 0 && <li>• No significant drawbacks noted.</li>}</ul>
              </Card>
            </div>
          )}

          {compatWith.length > 0 && (
            <Card className="p-5">
              <h3 className="font-display font-semibold mb-1 flex items-center gap-1.5">
                <Icon name="check" className="w-4 h-4 text-good" />Pairs with
              </h3>
              <p className="text-xs text-mute mb-3">{part.cat === 'ram' ? 'Motherboards that accept this memory type:' : 'Verified-compatible parts in our database:'}</p>
              <div className="flex flex-wrap gap-1.5">
                {compatWith.map(n => <Badge key={n} tone="good">{n}</Badge>)}
              </div>
            </Card>
          )}

          <Card className="p-5">
            <h3 className="font-display font-semibold mb-3">Related options</h3>
            <div className="grid sm:grid-cols-2 gap-2">
              {related.map(r => (
                <Link key={r.id} to={`/part/${r.id}`}
                  className="flex items-center gap-3 rounded-xl border border-line/60 bg-surface2 px-3 py-2 hover:border-neon/40 transition-colors cursor-pointer">
                  <PartThumb part={r} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm truncate">{r.name}</span>
                    <span className="block text-xs text-mute">{money(r.price)}</span>
                  </span>
                </Link>
              ))}
            </div>
          </Card>

          <Tip term="Why no buy buttons?" text="PCForge is a demo with sample data — there's no checkout. Prices are representative figures for planning." />
        </div>
      </div>
    </div>
  )
}

function SpecTable({ part }: { part: Part }) {
  const rows: [string, string][] = (() => {
    switch (part.cat) {
      case 'cpu': { const c = part as CPU; return [
        ['Socket', c.socket], ['Cores / Threads', `${c.cores} / ${c.threads}`], ['Boost clock', `${c.boost} GHz`],
        ['TDP', `${c.tdp} W`], ['Gaming score', `${c.gaming} / 100`], ['Multi-core score', `${c.multi} / 100`],
        ['iGPU', c.igpu ? 'Yes' : 'No'],
      ] }
      case 'gpu': { const g = part as GPU; return [
        ['VRAM', `${g.vram} GB`], ['TDP', `${g.tdp} W`], ['Recommended PSU', `${g.recPsu} W`],
        ['Length', `${g.length} mm`], ['Power connectors', g.connectors], ['Perf index', `${g.perf} / 100`],
      ] }
      case 'mb': { const m = part as MB; return [
        ['Socket', m.socket], ['Form factor', m.form], ['Memory', `${m.ramType} · max ${m.maxRam} GB`],
        ['M.2 / SATA', `${m.m2} / ${m.sata}`], ['Wi-Fi', m.wifi ? 'Yes' : 'No'],
      ] }
      case 'ram': { const r = part as RAM; return [
        ['Type', r.type], ['Capacity', `${r.gb} GB (${r.sticks}×${r.gb / r.sticks})`], ['Speed', `${r.mhz} MHz`],
        ['RGB', r.rgb ? 'Yes' : 'No'],
      ] }
      case 'storage': { const s = part as Storage; return [
        ['Kind', s.kind], ['Interface', s.iface], ['Capacity', s.gb >= 1000000 ? `${s.gb / 1000} TB` : `${s.gb} GB`],
        ['Seq. read', `${s.read} MB/s`],
      ] }
      case 'psu': { const u = part as PSU; return [
        ['Wattage', `${u.watts} W`], ['Efficiency', u.cert], ['Modular', u.modular ? 'Yes' : 'No'],
      ] }
      default: return Object.entries(part).filter(([k, v]) => typeof v !== 'object').slice(0, 7) as [string, string][]
    }
  })()
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-b border-line/50 last:border-0">
            <td className="py-2 pr-3 text-mute align-top whitespace-nowrap">{k}</td>
            <td className="py-2">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── Profile ───────────────────────────────────────────────────────────────

export function Profile() {
  const app = useApp()
  const [bio, setBio] = useState(app.user?.bio ?? '')

  if (!app.user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <Card className="p-0">
          <EmptyState icon="user" title="You're browsing as a guest"
            text="Profiles are a local demo — create one to customize a handle and bio. Nothing leaves your browser."
            action={<Btn variant="primary" onClick={() => app.toast('Use the account menu in the navbar to sign up', 'ok')}>How do I sign up?</Btn>} />
        </Card>
      </div>
    )
  }

  const likedPosts = SEED_POSTS.filter(p => app.likes[p.id])
  const followingCount = Object.values(app.follows).filter(Boolean).length

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <Card className="p-6 mb-5">
        <div className="flex items-start gap-4">
          <span className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/25 to-violet-500/25 border border-neon/30 flex items-center justify-center font-display font-bold text-2xl uppercase text-neon shrink-0">
            {app.user.username[0]}
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-xl">{app.user.username}</h1>
            <p className="text-xs text-mute">Member since {new Date(app.user.joined).toLocaleDateString()} · demo profile stored locally</p>
            <textarea className="field mt-3 min-h-16 !text-sm" maxLength={160} placeholder="Tell the community about your setup…"
              value={bio} onChange={e => setBio(e.target.value)} />
            <Btn size="sm" variant="primary" className="mt-2"
              onClick={() => { app.updateProfile({ bio: bio.trim().replace(/[<>]/g, '') }); app.toast('Profile updated') }}>Save bio</Btn>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-line text-center">
          <Stat n={app.saved.length} label="Saved builds" />
          <Stat n={Object.keys(app.likes).length} label="Likes given" />
          <Stat n={followingCount} label="Following" />
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-display font-semibold mb-3">Your builds</h3>
          {app.saved.length === 0
            ? <p className="text-sm text-mute">No saved builds yet. <Link to="/builder" className="text-neon">Forge one →</Link></p>
            : (
              <div className="space-y-2">
                {app.saved.slice(0, 5).map(b => {
                  const a = analyze(b.parts)
                  return (
                    <div key={b.id} className="flex items-center justify-between text-sm bg-surface2 border border-line rounded-xl px-3 py-2">
                      <span className="truncate">{b.name}</span>
                      <span className="text-xs text-mute shrink-0 ml-2">{money(a.price)} · {a.scores.overall}/100</span>
                    </div>
                  )
                })}
                <Btn size="sm" onClick={() => navigate('/saved')}>View all<Icon name="arrowRight" className="w-3.5 h-3.5" /></Btn>
              </div>
            )}
        </Card>

        <Card className="p-5">
          <h3 className="font-display font-semibold mb-3">Liked community builds</h3>
          {likedPosts.length === 0
            ? <p className="text-sm text-mute">Nothing liked yet. Explore the <Link to="/community" className="text-neon">community feed →</Link></p>
            : (
              <div className="space-y-2">
                {likedPosts.map(p => (
                  <div key={p.id} className="text-sm bg-surface2 border border-line rounded-xl px-3 py-2 truncate">{p.title}</div>
                ))}
              </div>
            )}
        </Card>
      </div>
    </div>
  )
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div className="font-display font-bold text-xl grad-text">{n}</div>
      <div className="text-[11px] text-mute">{label}</div>
    </div>
  )
}
