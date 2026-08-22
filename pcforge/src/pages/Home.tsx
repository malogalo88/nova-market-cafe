import { Link } from '../lib/router'
import { Badge, Btn, Card, Icon, SectionHead } from '../components/ui'
import { BuildPreview } from '../components/builder-ui'
import { useApp } from '../lib/store'
import { PREBUILTS } from '../data/prebuilt'
import { getPart } from '../data/parts'
import { analyze, avgAcrossGames, money } from '../lib/engine'
import { SEED_POSTS } from '../data/community'
import { DB } from '../data/parts'

const FEATURES = [
  { icon: 'cpu', title: 'Build', text: 'Create a custom PC from individual components.', to: '/builder' },
  { icon: 'shield', title: 'Check', text: 'Automatically detect compatibility problems.', to: '/builder' },
  { icon: 'activity', title: 'Perform', text: 'Estimate FPS and gaming performance.', to: '/performance' },
  { icon: 'wand', title: 'Optimize', text: 'Find better parts and upgrades for your budget.', to: '/builder' },
  { icon: 'layers', title: 'Compare', text: 'Compare CPUs, GPUs, complete PCs, and builds.', to: '/compare' },
  { icon: 'share', title: 'Share', text: 'Save and share builds with other users.', to: '/community' },
]

export default function Home() {
  const { analysis } = useApp()
  const featured = PREBUILTS.slice(2, 5)

  return (
    <div>
      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-14 pb-16 grid lg:grid-cols-[1.15fr_0.85fr] gap-10 items-center relative">
          <div>
            <Badge tone="neon" className="mb-5 rise"><Icon name="sparkles" className="w-3 h-3" />The interactive PC-building platform</Badge>
            <h1 className="font-display font-bold text-4xl sm:text-6xl leading-[1.05] tracking-tight rise rise-1">
              Build Your <span className="grad-text">Perfect PC.</span>
            </h1>
            <p className="text-mute mt-5 max-w-xl text-base sm:text-lg leading-relaxed rise rise-2">
              Choose your parts, check compatibility, estimate gaming performance, and optimize your build — all in one place.
            </p>
            <div className="flex flex-wrap gap-3 mt-7 rise rise-3">
              <Link to="/builder"><Btn variant="primary" size="lg"><Icon name="cpu" className="w-4.5 h-4.5 w-[18px] h-[18px]" />Start Building</Btn></Link>
              <Link to="/prebuilt"><Btn size="lg"><Icon name="case" className="w-[18px] h-[18px]" />Explore Builds</Btn></Link>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3 mt-9 rise rise-4">
              {[['120+', 'Components'], ['18', 'Games modeled'], ['40+', 'Compatibility checks']].map(([n, l]) => (
                <div key={l}><div className="font-display font-bold text-xl grad-text">{n}</div><div className="text-xs text-mute">{l}</div></div>
              ))}
            </div>
          </div>
          <div className="relative hidden lg:block">
            <div className="absolute -inset-8 bg-gradient-to-br from-cyan-500/10 via-transparent to-violet-500/10 blur-2xl rounded-full" />
            <BuildPreview />
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <SectionHead eyebrow="Everything connected" title="One platform, every step of the build"
          sub="Change a GPU and everything updates: price, power, compatibility, FPS estimates and scores." />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <Link key={f.title} to={f.to}>
              <Card hover className={`p-5 h-full rise rise-${(i % 6) + 1}`}>
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/15 border border-line flex items-center justify-center text-neon mb-4">
                  <Icon name={f.icon} className="w-5 h-5" />
                </div>
                <h3 className="font-display font-semibold mb-1.5">{f.title}</h3>
                <p className="text-sm text-mute leading-relaxed">{f.text}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── Live snapshot band ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <Card className="p-6 flex flex-wrap items-center gap-6 justify-between">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-good blink" />
            <div>
              <div className="font-display font-semibold">Your current build is live</div>
              <div className="text-xs text-mute">Estimated at {money(analysis.price)} · ~{analysis.power.gamingW}W gaming · score {analysis.scores.overall}/100</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/builder"><Btn variant="primary" size="sm">Open Builder</Btn></Link>
            <Link to="/performance"><Btn size="sm">See FPS estimates</Btn></Link>
          </div>
        </Card>
      </section>

      {/* ─── Popular prebuilts ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <SectionHead eyebrow="Prebuilt recommendations" title="Ready-made builds that punch above their price"
          right={<Link to="/prebuilt" className="text-sm text-neon hover:underline inline-flex items-center gap-1">All builds<Icon name="arrowRight" className="w-4 h-4" /></Link>} />
        <div className="grid md:grid-cols-3 gap-4">
          {featured.map((b, i) => {
            const a = analyze(b.parts)
            const fps = avgAcrossGames(a.r.cpu, a.r.gpu, a.r.ram, '1080p', 'High')
            return (
              <Link key={b.id} to={`/prebuilt?b=${b.id}`}>
                <Card hover className={`p-5 h-full rise rise-${i + 1}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-display font-semibold">{b.name}</div>
                      <div className="text-[11px] text-mute">{b.tags.join(' · ')}</div>
                    </div>
                    <ScoreMini v={a.scores.overall} />
                  </div>
                  <div className="font-display font-bold text-2xl grad-text mt-3">{money(a.price)}</div>
                  <div className="mt-3 space-y-1 text-xs text-mute">
                    <div>GPU: <span className="text-ink">{getPart(b.parts.gpu)?.name}</span></div>
                    <div>CPU: <span className="text-ink">{getPart(b.parts.cpu)?.name}</span></div>
                  </div>
                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-line text-xs">
                    <span className="text-mute">≈ <b className="text-ink">{fps} FPS</b> @1080p High (est.)</span>
                    <span className="text-neon inline-flex items-center gap-1">View Build<Icon name="arrowRight" className="w-3.5 h-3.5" /></span>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      </section>

      {/* ─── Community teaser ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="p-6">
            <SectionHead eyebrow="Community" title="Built by people like you" />
            <div className="space-y-3">
              {SEED_POSTS.slice(0, 3).map(p => (
                <div key={p.id} className="flex items-center gap-3 bg-surface2 border border-line rounded-xl p-3">
                  <span className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center font-bold text-sm uppercase"
                    style={{ background: `${p.color}22`, color: p.color }}>{p.displayName[0]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">{p.title}</div>
                    <div className="text-[11px] text-mute">@{p.author} · ❤ {p.likes} · {p.category}</div>
                  </div>
                </div>
              ))}
            </div>
            <Link to="/community"><Btn variant="soft" size="sm" className="mt-4">Explore community builds<Icon name="arrowRight" className="w-3.5 h-3.5" /></Btn></Link>
          </Card>
          <Card className="p-6">
            <SectionHead eyebrow="Deal finder" title="🔥 Estimated deals this week" />
            <div className="space-y-3">
              {DB.gpu.filter(g => g.msrp && g.price < g.msrp * 0.94).slice(0, 3).map(g => (
                <div key={g.id} className="flex items-center gap-3 bg-surface2 border border-line rounded-xl p-3">
                  <Icon name="chip" className="w-4 h-4 text-viol shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">{g.name}</div>
                    <div className="text-[11px] text-mute">Typical ${g.msrp} → now {money(g.price)}</div>
                  </div>
                  <Badge tone="good">Save {money((g.msrp ?? 0) - g.price)}</Badge>
                </div>
              ))}
              <p className="text-[11px] text-mute">Based on sample typical pricing — not live market data.</p>
            </div>
            <Link to="/prebuilt?tab=deals"><Btn variant="soft" size="sm" className="mt-4">Open Deal Finder<Icon name="arrowRight" className="w-3.5 h-3.5" /></Btn></Link>
          </Card>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <Card className="p-10 sm:p-14 text-center relative overflow-hidden">
          <div className="absolute inset-0 grid-bg opacity-60 pointer-events-none" />
          <div className="relative">
            <h2 className="font-display font-bold text-3xl sm:text-4xl">Ready to build?</h2>
            <p className="text-mute mt-3 max-w-md mx-auto">Create a PC that fits your budget, your games, and your future.</p>
            <div className="flex flex-wrap justify-center gap-3 mt-7">
              <Link to="/builder"><Btn variant="primary" size="lg">Start Building</Btn></Link>
              <Link to="/community"><Btn size="lg">Explore Community Builds</Btn></Link>
            </div>
          </div>
        </Card>
      </section>
    </div>
  )
}

function ScoreMini({ v }: { v: number }) {
  return (
    <div className="text-right">
      <div className="font-display font-bold text-lg leading-none">{v}<span className="text-xs text-mute">/100</span></div>
      <div className="text-[10px] text-mute">score</div>
    </div>
  )
}
