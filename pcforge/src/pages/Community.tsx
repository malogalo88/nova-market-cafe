import { useMemo, useState } from 'react'
import { useApp } from '../lib/store'
import { Badge, Btn, Card, EmptyState, Icon, SectionHead, Tabs } from '../components/ui'
import { CHALLENGES, COMMUNITY_CATEGORIES, SEED_POSTS } from '../data/community'
import { CATS, getPart } from '../data/parts'
import { analyze, avgAcrossGames, encodeBuild, money } from '../lib/engine'
import { navigate } from '../lib/router'

export default function Community() {
  const app = useApp()
  const [tab, setTab] = useState<'feed' | 'challenges'>('feed')
  const [cat, setCat] = useState<string | null>(null)
  const [comments, setComments] = useState<Record<string, { author: string; text: string; when: string }[]>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [votes, setVotes] = useState<Record<string, number>>({})

  const posts = useMemo(() => {
    const list = cat ? SEED_POSTS.filter(p => p.category === cat) : SEED_POSTS
    return [...list].sort((a, b) => ((app.likes[b.id] ? 1 : 0) + b.likes) - ((app.likes[a.id] ? 1 : 0) + a.likes))
  }, [cat, app.likes])

  const leaderboard = useMemo(() => {
    const totals: Record<string, { name: string; color: string; likes: number; posts: number }> = {}
    for (const p of SEED_POSTS) {
      totals[p.author] ??= { name: p.displayName, color: p.color, likes: 0, posts: 0 }
      totals[p.author].likes += p.likes + (app.likes[p.id] ? 1 : 0)
      totals[p.author].posts++
    }
    return Object.entries(totals).map(([author, v]) => ({ author, ...v })).sort((a, b) => b.likes - a.likes)
  }, [app.likes])

  const sharePost = (id: string) => {
    const post = SEED_POSTS.find(p => p.id === id)!
    const link = `${window.location.origin}${window.location.pathname}#/build/${encodeBuild(post.title, post.parts)}`
    navigator.clipboard?.writeText(link).then(() => app.toast('Build link copied'), () => app.toast('Copy failed', 'warn'))
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <SectionHead eyebrow="Community" title="Built by the community"
        sub="Discover real builds, vote on challenges, and share your own creations." />

      <Tabs value={tab} onChange={setTab} tabs={[
        { key: 'feed', label: 'Build Feed', icon: 'users' },
        { key: 'challenges', label: 'Challenges', icon: 'trophy' },
      ]} className="mb-6" />

      {tab === 'feed' && (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
          <div>
            <div className="flex flex-wrap gap-1.5 mb-5">
              <button onClick={() => setCat(null)}
                className={`text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${!cat ? 'border-neon/50 text-neon bg-neon/10' : 'border-line text-mute hover:text-ink'}`}>All</button>
              {COMMUNITY_CATEGORIES.map(c => (
                <button key={c} onClick={() => setCat(c === cat ? null : c)}
                  className={`text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${cat === c ? 'border-neon/50 text-neon bg-neon/10' : 'border-line text-mute hover:text-ink'}`}>{c}</button>
              ))}
            </div>

            {posts.length === 0 && (
              <EmptyState icon="users" title="No builds in this category yet" text="Be the first — load a build in the Builder and share it."
                action={<Btn variant="primary" onClick={() => navigate('/builder')}>Create Your First Build</Btn>} />
            )}

            <div className="space-y-4">
              {posts.map((p, i) => {
                const a = analyze(p.parts)
                const liked = !!app.likes[p.id]
                const following = !!app.follows[p.author]
                const allComments = [...p.comments, ...(comments[p.id] ?? [])]
                return (
                  <Card key={p.id} className={`p-5 rise rise-${(i % 6) + 1}`}>
                    <div className="flex items-start gap-3 mb-3">
                      <span className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center font-bold uppercase"
                        style={{ background: `${p.color}22`, color: p.color }}>{p.displayName[0]}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-display font-semibold leading-snug">{p.title}</div>
                        <div className="text-xs text-mute mt-0.5 flex flex-wrap items-center gap-x-2">
                          <span>@{p.author}</span>·<span>{p.daysAgo}d ago</span>·<Badge tone="viol">{p.category}</Badge>
                        </div>
                      </div>
                      <button onClick={() => app.toggleFollow(p.author)}
                        className={`text-xs px-2.5 py-1 rounded-full border cursor-pointer shrink-0 transition-colors ${following ? 'border-good/50 text-good' : 'border-line text-mute hover:text-ink'}`}>
                        {following ? 'Following ✓' : '+ Follow'}
                      </button>
                    </div>
                    <p className="text-sm text-mute mb-3">{p.blurb}</p>

                    <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs bg-surface2 border border-line rounded-xl p-3 mb-3">
                      {CATS.filter(c => p.parts[c.key]).slice(0, 6).map(c => (
                        <div key={c.key} className="truncate"><span className="text-[10px] uppercase tracking-wider text-mute mr-1.5">{c.short}</span><span>{getPart(p.parts[c.key])?.name}</span></div>
                      ))}
                      <div className="sm:col-span-2 flex items-center justify-between pt-1.5 border-t border-line/60 mt-1">
                        <span className="font-display font-bold grad-text">{money(a.price)}</span>
                        <span className="text-mute">≈ {avgAcrossGames(a.r.cpu, a.r.gpu, a.r.ram, '1080p', 'High')} FPS @1080p · score {a.scores.overall}/100</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <button onClick={() => app.toggleLike(p.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors ${liked ? 'border-bad/50 text-bad' : 'border-line text-mute hover:text-ink'}`}>
                        <Icon name="heart" className={`w-3.5 h-3.5 ${liked ? 'fill-current' : ''}`} />{p.likes + (liked ? 1 : 0)}
                      </button>
                      <button onClick={() => { app.loadParts(p.parts); app.toast('Loaded into your builder'); navigate('/builder') }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line text-mute hover:text-neon cursor-pointer">
                        <Icon name="cpu" className="w-3.5 h-3.5" />Use this build
                      </button>
                      <button onClick={() => { app.loadParts(p.parts); app.saveBuild(`${p.title.slice(0, 30)} (by @${p.author})`) }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line text-mute hover:text-neon cursor-pointer">
                        <Icon name="bookmark" className="w-3.5 h-3.5" />Save
                      </button>
                      <button onClick={() => sharePost(p.id)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line text-mute hover:text-neon cursor-pointer">
                        <Icon name="share" className="w-3.5 h-3.5" />Share
                      </button>
                      <span className="ml-auto text-mute inline-flex items-center gap-1"><Icon name="eye" className="w-3.5 h-3.5" />{p.views.toLocaleString()}</span>
                    </div>

                    {/* comments */}
                    <div className="mt-4 border-t border-line pt-3 space-y-2">
                      {allComments.length === 0 && <div className="text-xs text-mute">No comments yet — start the conversation.</div>}
                      {allComments.map((c, k) => (
                        <div key={k} className="text-xs flex gap-2">
                          <b className="text-neon shrink-0">@{c.author}</b>
                          <span className="text-mute">{c.text}<span className="opacity-50 ml-2">{c.when}</span></span>
                        </div>
                      ))}
                      <div className="flex gap-2 pt-1">
                        <input className="field !py-1.5 !text-xs" placeholder="Add a comment…"
                          value={drafts[p.id] ?? ''} onChange={e => setDrafts(d => ({ ...d, [p.id]: e.target.value }))} />
                        <Btn size="sm" onClick={() => {
                          const t = (drafts[p.id] ?? '').trim()
                          if (!t) return
                          if (/[<>{}]/.test(t)) { app.toast('Comments are plain text only', 'warn'); return }
                          setComments(cm => ({ ...cm, [p.id]: [...(cm[p.id] ?? []), { author: app.user?.username ?? 'guest', text: t.slice(0, 200), when: 'now' }] }))
                          setDrafts(d => ({ ...d, [p.id]: '' }))
                        }}><Icon name="chat" className="w-3.5 h-3.5" /></Btn>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* leaderboard */}
          <Card className="p-5 lg:sticky lg:top-20">
            <h3 className="font-display font-semibold mb-1">Leaderboard</h3>
            <p className="text-[11px] text-mute mb-4">Most liked builders this month</p>
            <div className="space-y-2.5">
              {leaderboard.map((u, i) => (
                <div key={u.author} className="flex items-center gap-3">
                  <span className={`font-display font-bold w-5 text-center ${i === 0 ? 'text-warn' : i === 1 ? 'text-mute' : i === 2 ? 'text-amber-700' : 'text-mute opacity-60'}`}>{i + 1}</span>
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm uppercase"
                    style={{ background: `${u.color}22`, color: u.color }}>{u.name[0]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">{u.name}</div>
                    <div className="text-[11px] text-mute">@{u.author} · {u.posts} build{u.posts > 1 ? 's' : ''}</div>
                  </div>
                  <Badge tone="line">❤ {u.likes}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === 'challenges' && (
        <div className="grid md:grid-cols-2 gap-4">
          {CHALLENGES.map(c => (
            <Card key={c.id} hover className="p-5">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-display font-semibold">{c.name}</h3>
                <Badge tone="warn"><Icon name="clock" className="w-3 h-3" />{c.endsIn} left</Badge>
              </div>
              <p className="text-sm text-mute mb-4">{c.desc}</p>
              <div className="flex items-center justify-between text-xs text-mute mb-3">
                <span>{c.entries + (votes[c.id] ?? 0)} entries</span>
                <span><Icon name="trophy" className="w-3.5 h-3.5 inline text-warn" /> Community badge</span>
              </div>
              <div className="flex gap-2">
                <Btn size="sm" variant="primary" onClick={() => navigate('/wizard')}><Icon name="wand" className="w-3.5 h-3.5" />Submit a build</Btn>
                <Btn size="sm" onClick={() => { setVotes(v => ({ ...v, [c.id]: (v[c.id] ?? 0) + 1 })); app.toast('Vote counted') }}>
                  <Icon name="heart" className="w-3.5 h-3.5" />Vote ({c.entries % 37 + (votes[c.id] ?? 0)})
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
