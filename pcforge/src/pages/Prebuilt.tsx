import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../lib/store'
import { Badge, Btn, Card, Icon, Modal, SectionHead, Tabs } from '../components/ui'
import { PREBUILTS, PREBUILT_TAGS } from '../data/prebuilt'
import { CATS, DB, getPart } from '../data/parts'
import { analyze, avgAcrossGames, money } from '../lib/engine'
import type { Prebuilt } from '../data/prebuilt'
import type { Cat } from '../types'
import { navigate } from '../lib/router'

export default function Prebuilt({ query }: { query: URLSearchParams }) {
  const app = useApp()
  const [tab, setTab] = useState<'builds' | 'deals'>(query.get('tab') === 'deals' ? 'deals' : 'builds')
  const [tag, setTag] = useState<string | null>(null)
  const [detail, setDetail] = useState<Prebuilt | null>(null)

  useEffect(() => {
    const b = query.get('b')
    if (b) {
      const found = PREBUILTS.find(x => x.id === b)
      if (found) setDetail(found)
    }
    if (query.get('tab') === 'deals') setTab('deals')
  }, [query])

  const list = useMemo(() => tag ? PREBUILTS.filter(b => b.tags.includes(tag)) : PREBUILTS, [tag])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <SectionHead eyebrow="Curated systems" title="Prebuilt Builds"
        sub="Reference builds assembled from our component database. Stats update automatically as prices and parts change." />

      <Tabs value={tab} onChange={setTab} tabs={[
        { key: 'builds', label: 'Builds', icon: 'case' },
        { key: 'deals', label: 'Deal Finder', icon: 'percent' },
      ]} className="mb-6" />

      {tab === 'builds' && (
        <>
          <div className="flex flex-wrap gap-1.5 mb-6">
            <button onClick={() => setTag(null)}
              className={`text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${!tag ? 'border-neon/50 text-neon bg-neon/10' : 'border-line text-mute hover:text-ink'}`}>
              All
            </button>
            {PREBUILT_TAGS.map(t => (
              <button key={t} onClick={() => setTag(t === tag ? null : t)}
                className={`text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${tag === t ? 'border-neon/50 text-neon bg-neon/10' : 'border-line text-mute hover:text-ink'}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {list.map((b, i) => {
              const a = analyze(b.parts)
              const fps = avgAcrossGames(a.r.cpu, a.r.gpu, a.r.ram, '1080p', 'High')
              return (
                <Card key={b.id} hover className={`p-5 flex flex-col rise rise-${(i % 6) + 1}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-display font-semibold">{b.name}</h3>
                      <div className="text-[11px] text-mute">{b.tags.join(' · ')}</div>
                    </div>
                    <Badge tone="neon">{a.scores.overall}/100</Badge>
                  </div>
                  <p className="text-xs text-mute mb-4">{b.blurb}</p>
                  <div className="font-display font-bold text-2xl grad-text">{money(a.price)}</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-xs text-mute flex-1">
                    <Spec label="CPU" v={getPart(b.parts.cpu)?.name} />
                    <Spec label="GPU" v={getPart(b.parts.gpu)?.name} />
                    <Spec label="RAM" v={getPart(b.parts.ram)?.name} />
                    <Spec label="Storage" v={getPart(b.parts.storage)?.name} />
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-line text-xs">
                    <span className="text-mute">≈ <b className="text-ink">{fps}</b> FPS @1080p · ~{a.power.gamingW}W</span>
                    <Btn size="sm" variant="primary" onClick={() => setDetail(b)}>View Build</Btn>
                  </div>
                </Card>
              )
            })}
          </div>
        </>
      )}

      {tab === 'deals' && <Deals />}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name} wide>
        {detail && (() => {
          const a = analyze(detail.parts)
          return (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {detail.tags.map(t => <Badge key={t} tone="viol">{t}</Badge>)}
              </div>
              <div className="flex flex-wrap gap-4 items-center">
                <div className="font-display font-bold text-3xl grad-text">{money(a.price)}</div>
                <Badge tone="line">Score {a.scores.overall}/100</Badge>
                <Badge tone="line">~{a.power.gamingW}W gaming</Badge>
                <Badge tone="line">PSU {a.power.recPsu}W+</Badge>
              </div>
              <div className="space-y-1.5">
                {CATS.filter(c => detail.parts[c.key]).map(c => {
                  const p = getPart(detail.parts[c.key])!
                  return (
                    <div key={c.key} className="flex items-center gap-3 bg-surface2 border border-line rounded-xl px-3 py-2.5 text-sm">
                      <Icon name={(c.key === 'gpu' ? 'chip' : c.key) as string} className="w-4 h-4 text-neon shrink-0" />
                      <span className="text-mute w-24 shrink-0 text-xs uppercase tracking-wider">{c.short}</span>
                      <span className="truncate flex-1">{p.name}</span>
                      <span className="text-mute text-xs">{money(p.price)}</span>
                    </div>
                  )
                })}
              </div>
              <p className="text-[11px] text-mute">Estimated prices. Estimated FPS: ≈{avgAcrossGames(a.r.cpu, a.r.gpu, a.r.ram, '1080p', 'High')} @1080p High — results vary by game and settings.</p>
              <div className="flex flex-wrap gap-2">
                <Btn variant="primary" onClick={() => { app.loadParts(detail.parts); app.toast(`${detail.name} loaded into Builder`); setDetail(null); navigate('/builder') }}>
                  <Icon name="cpu" className="w-4 h-4" />Load into Builder
                </Btn>
                <Btn onClick={() => { app.loadParts(detail.parts); app.saveBuild(detail.name); setDetail(null) }}>
                  <Icon name="bookmark" className="w-4 h-4" />Save
                </Btn>
              </div>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}

function Spec({ label, v }: { label: string; v?: string }) {
  return <div className="truncate"><span className="text-[10px] uppercase tracking-wider mr-1.5 opacity-70">{label}</span><span className="text-ink">{v ?? '—'}</span></div>
}

function Deals() {
  const groups: { title: string; icon: string; cats: string[] }[] = [
    { title: 'Best GPU Deals', icon: 'chip', cats: ['gpu'] },
    { title: 'Best CPU Deals', icon: 'cpu', cats: ['cpu'] },
    { title: 'Best SSD Deals', icon: 'drive', cats: ['storage'] },
    { title: 'Best RAM Deals', icon: 'memory', cats: ['ram'] },
    { title: 'Best Complete PC Deals', icon: 'case', cats: [] },
  ]
  return (
    <div className="space-y-6">
      <Card className="p-4 text-xs text-mute flex items-start gap-2">
        <Icon name="info" className="w-4 h-4 shrink-0 mt-0.5 text-neon" />
        PCForge does not have live store pricing yet. Deals below compare current sample catalog prices against typical MSRP — treat them as demonstrations of how real deal data will appear.
      </Card>
      {groups.map(g => {
        const items = g.cats.length
          ? g.cats.flatMap(c => DB[c as Cat]).filter((p: any) => p.msrp && p.price < p.msrp * 0.97)
          : PREBUILTS.filter(b => { const a = analyze(b.parts); return a.price < 800 }).slice(0, 2)
        return (
          <div key={g.title}>
            <h3 className="font-display font-semibold mb-3 flex items-center gap-2"><Icon name={g.icon} className="w-4 h-4 text-viol" />🔥 {g.title}</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((p: any) => {
                const isBuild = !g.cats.length
                const price = isBuild ? analyze((p as any).parts).price : p.price
                const msrp = isBuild ? Math.round(price * 1.12) : p.msrp
                return (
                  <Card key={p.id} hover className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm truncate font-medium">{isBuild ? p.name : p.name}</div>
                        <div className="text-[11px] text-mute">{isBuild ? `${p.tags[0]} build` : p.brand}</div>
                      </div>
                      <Badge tone="good"><Icon name="flame" className="w-3 h-3" />Good deal</Badge>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="font-display font-bold text-xl">{money(price)}</span>
                      <span className="text-xs text-mute line-through">${msrp}</span>
                      <span className="text-xs text-good ml-auto">Save {money(msrp - price)}</span>
                    </div>
                    {!isBuild && (
                      <a href={`#/part/${p.id}`} className="text-xs text-neon hover:underline inline-flex items-center gap-1 mt-2">
                        View part<Icon name="arrowRight" className="w-3 h-3" />
                      </a>
                    )}
                  </Card>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
