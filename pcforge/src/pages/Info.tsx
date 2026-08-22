import { useState } from 'react'
import { Badge, Btn, Card, Icon, SectionHead } from '../components/ui'
import { GUIDES } from '../data/guides'
import { useApp } from '../lib/store'
import { Link, navigate } from '../lib/router'

// ─── About ─────────────────────────────────────────────────────────────────

export function About() {
  const features = [
    { icon: 'cpu', title: 'Live Compatibility Engine', text: 'Every part you pick is checked against sockets, memory types, form factors, PSU headroom and cooler clearance — instantly.' },
    { icon: 'gauge', title: 'Performance Estimates', text: 'A transparent FPS model calibrated against public performance tiers, with honest labels everywhere. Estimates, not guarantees.' },
    { icon: 'wand', title: 'Budget Wizard', text: 'Answer four questions and get three complete builds — Best Performance, Best Value and Balanced — within your budget.' },
    { icon: 'users', title: 'Community Builds', text: 'Browse sample builds from the community, load them into your own builder, remix and share them back out.' },
    { icon: 'activity', title: 'Can I Run It?', text: 'Check any game against any hardware combo and see estimated FPS at common resolution/setting pairs.' },
    { icon: 'shield', title: 'Private by Design', text: 'Accounts are a local demo. Your builds live in this browser\'s storage — nothing is uploaded anywhere.' },
  ]
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <SectionHead eyebrow="About" title="What is PCForge?"
        sub="An interactive PC-building playground: pick parts, get instant compatibility checks, performance estimates and upgrade advice." />

      <Card className="p-6 mb-6">
        <p className="text-sm leading-relaxed mb-3">
          PCForge exists to make the confusing world of PC building approachable. Instead of juggling spec sheets,
          forum threads and retailer tabs, you assemble a build visually and watch a live engine validate it:
          <b className="text-ink"> will it boot, will it fit, will the PSU hold, and what FPS should you expect?</b>
        </p>
        <p className="text-sm leading-relaxed">
          It's also honest about being a demo: every price is a sample figure, every FPS number is an estimate from
          our model, and all data lives in your browser. The goal is to demonstrate the full experience of a modern
          PC-building platform.
        </p>
      </Card>

      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        {features.map(f => (
          <Card key={f.title} hover className="p-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-neon/20 flex items-center justify-center text-neon mb-3">
              <Icon name={f.icon} />
            </div>
            <h3 className="font-display font-semibold mb-1">{f.title}</h3>
            <p className="text-sm text-mute">{f.text}</p>
          </Card>
        ))}
      </div>

      <Card className="p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-semibold">Ready to forge?</h3>
          <p className="text-sm text-mute">Start from scratch or let the wizard do the heavy lifting.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/builder"><Btn variant="primary">Open Builder</Btn></Link>
          <Link to="/wizard"><Btn><Icon name="wand" className="w-4 h-4" />Build Wizard</Btn></Link>
        </div>
      </Card>
    </div>
  )
}

// ─── Guides ────────────────────────────────────────────────────────────────

export function Guides({ query }: { query: URLSearchParams }) {
  const app = useApp()
  const [openId, setOpenId] = useState<string | null>(query.get('g'))

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <SectionHead eyebrow="Learn" title="PC Building Guides"
        sub="Short, practical reads on the topics that trip people up most. No jargon walls." />

      <div className="space-y-3">
        {GUIDES.map((g, i) => {
          const open = openId === g.id
          return (
            <Card key={g.id} className={`overflow-hidden rise rise-${(i % 6) + 1}`}>
              <button onClick={() => setOpenId(open ? null : g.id)}
                className="w-full flex items-center gap-3 p-4 text-left cursor-pointer hover:bg-surface2 transition-colors">
                <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/15 to-violet-500/15 border border-line flex items-center justify-center shrink-0">
                  <Icon name="book" className="w-[18px] h-[18px] text-neon" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-display font-semibold truncate">{g.title}</span>
                  <span className="block text-xs text-mute truncate">{g.level} · {g.tags.join(', ')}</span>
                </span>
                <Icon name="chevronDown" className={`w-4 h-4 text-mute shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>
              {open && (
                <div className="px-4 pb-5 pt-1 border-t border-line/60">
                  {g.body.map((para, k) => (
                    <p key={k} className="text-sm text-mute leading-relaxed mt-3 first:mt-3">{para}</p>
                  ))}
                  <div className="flex flex-wrap gap-2 mt-4">
                    <Btn size="sm" variant="primary" onClick={() => navigate('/builder')}>Try it in the Builder</Btn>
                    <Btn size="sm" onClick={() => { app.toast('Guide link copied'); }}>
                      <Icon name="share" className="w-3.5 h-3.5" />Share guide
                    </Btn>
                    <Badge tone="line" className="ml-auto self-center">{g.minutes} min read</Badge>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      <Card className="p-5 mt-6 flex items-center gap-3">
        <Icon name="sparkles" className="text-warn shrink-0" />
        <p className="text-sm text-mute">Still stuck? Ask <button onClick={() => navigate('/')} className="text-neon cursor-pointer underline underline-offset-2">ForgeAI</button> in the chat bubble — it knows your current build.</p>
      </Card>
    </div>
  )
}
