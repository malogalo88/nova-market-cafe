import { useState } from 'react'
import { useApp } from '../lib/store'
import { Badge, Btn, Card, EmptyState, Icon, Tabs } from '../components/ui'
import {
  BottleneckPanel, BuildPreview, BuildSummary, CompatPanel, FpsPanel,
  InsightsReport, MonitorMatchCard, OptimizerBar, PartPicker, UpgradePanel,
} from '../components/builder-ui'
import { CATS, CORE_CATS } from '../data/parts'
import type { Cat } from '../types'
import { Link } from '../lib/router'

type Panel = 'compat' | 'bottleneck' | 'fps' | 'upgrades' | 'insights'

export default function Builder() {
  const app = useApp()
  const a = app.analysis
  const [cat, setCat] = useState<Cat>('cpu')
  const [panel, setPanel] = useState<Panel>('compat')
  const [mobileTab, setMobileTab] = useState<'parts' | 'summary'>('parts')
  const [nameModal, setNameModal] = useState(false)
  const [buildName, setBuildName] = useState('My Forge Build')

  const missing = CORE_CATS.filter(c => !a.r[c as 'cpu'])
  const hasErrors = a.issues.some(i => i.level === 'error')

  const doSave = () => setNameModal(true)
  const doShare = () => {
    const link = app.shareLink(buildName)
    navigator.clipboard?.writeText(link).then(
      () => app.toast('Share link copied to clipboard'),
      () => app.toast(link, 'warn'),
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl">PC Builder</h1>
          <p className="text-sm text-mute mt-1">Pick parts on the left — price, power, compatibility and FPS estimates update live.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-2 text-xs text-mute cursor-pointer select-none">
            <input type="checkbox" checked={app.beginner} onChange={e => app.setBeginner(e.target.checked)} className="accent-cyan-400" />
            Beginner mode
          </label>
          <Link to="/wizard"><Btn size="sm"><Icon name="wand" className="w-3.5 h-3.5" />Build Wizard</Btn></Link>
          <Btn size="sm" onClick={app.clearBuild}><Icon name="trash" className="w-3.5 h-3.5" />Clear</Btn>
        </div>
      </div>

      {/* status strip */}
      <Card className="p-4 mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span className={`inline-flex items-center gap-2 ${hasErrors ? 'text-bad' : 'text-good'}`}>
          <span className="w-2 h-2 rounded-full" style={{ background: hasErrors ? '#f87171' : '#34d399' }} />
          {hasErrors ? 'Compatibility problems found' : 'All compatibility checks passing'}
        </span>
        <span className="text-mute">Total <b className="text-ink">{`$${Math.round(a.price).toLocaleString()}`}</b></span>
        <span className="text-mute">Power <b className="text-ink">~{a.power.gamingW}W</b></span>
        <span className="text-mute">Score <b className="text-ink">{a.scores.overall}/100</b></span>
        {missing.length > 0 && <Badge tone="warn">Missing: {missing.map(m => CATS.find(c => c.key === m)!.short).join(', ')}</Badge>}
      </Card>

      <OptimizerBar analysis={a} />

      {/* mobile tab switch */}
      <div className="lg:hidden mt-6">
        <Tabs value={mobileTab} onChange={setMobileTab} tabs={[
          { key: 'parts', label: 'Choose Parts', icon: 'grid' },
          { key: 'summary', label: 'Summary & Analysis', icon: 'gauge' },
        ]} />
      </div>

      <div className="mt-6 grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        {/* left: category rail + picker (desktop) / tabbed (mobile) */}
        <div className={`${mobileTab === 'parts' ? '' : 'hidden lg:block'} min-w-0`}>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-4">
            {CATS.map(c => {
              const selected = !!app.build[c.key]
              return (
                <button key={c.key} onClick={() => setCat(c.key)}
                  className={`px-3 py-2 rounded-xl text-xs whitespace-nowrap cursor-pointer inline-flex items-center gap-1.5 border transition-colors ${
                    cat === c.key ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 border-neon/40 text-ink'
                      : selected ? 'border-good/40 text-good/90 bg-surface'
                      : 'border-line text-mute hover:text-ink hover:bg-surface2'
                  }`}>
                  <Icon name={(c.key === 'gpu' ? 'chip' : c.key) as string} className="w-3.5 h-3.5" />
                  {c.short}
                  {!c.required && <span className="opacity-50">+</span>}
                </button>
              )
            })}
          </div>
          <PartPicker cat={cat} />
        </div>

        {/* right: summary + panels */}
        <div className={`${mobileTab === 'summary' ? '' : 'hidden lg:block'} space-y-4 lg:sticky lg:top-20`}>
          <BuildSummary analysis={a} onSave={doSave} onShare={doShare} />
          <BuildPreview />
          <Tabs value={panel} onChange={setPanel} tabs={[
            { key: 'compat', label: 'Compat', icon: 'shield' },
            { key: 'bottleneck', label: 'Balance', icon: 'gauge' },
            { key: 'fps', label: 'FPS', icon: 'activity' },
            { key: 'upgrades', label: 'Upgrades', icon: 'zap' },
            { key: 'insights', label: 'Report', icon: 'sparkles' },
          ]} className="w-full" />
          <div className="space-y-4">
            {panel === 'compat' && <CompatPanel analysis={a} />}
            {panel === 'bottleneck' && <>
              <BottleneckPanel analysis={a} />
              <MonitorMatchCard analysis={a} />
            </>}
            {panel === 'fps' && <FpsPanel analysis={a} />}
            {panel === 'upgrades' && (
              CORE_CATS.every(c => a.r[c as 'cpu'])
                ? <UpgradePanel analysis={a} />
                : <EmptyState icon="zap" title="Finish your build first" text="Add the core components to unlock personalized upgrade suggestions." />
            )}
            {panel === 'insights' && (
              CORE_CATS.every(c => a.r[c as 'cpu'])
                ? <InsightsReport analysis={a} />
                : <EmptyState icon="sparkles" title="Almost there" text="The final report unlocks once CPU, GPU, motherboard, RAM, storage, PSU, cooler and case are chosen." />
            )}
          </div>
        </div>
      </div>

      {/* save modal */}
      {nameModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setNameModal(false)} />
          <Card className="relative p-6 w-full max-w-md rise">
            <h3 className="font-display font-semibold mb-4">Save this build</h3>
            <input className="field mb-3" value={buildName} onChange={e => setBuildName(e.target.value)} placeholder="Build name" maxLength={40} />
            <p className="text-[11px] text-mute mb-4">Saved builds stay in this browser. Share links work for anyone with the URL.</p>
            <div className="flex gap-2 justify-end">
              <Btn onClick={() => setNameModal(false)}>Cancel</Btn>
              <Btn variant="primary" disabled={!buildName.trim()} onClick={() => { app.saveBuild(buildName.trim()); setNameModal(false) }}>
                <Icon name="bookmark" className="w-4 h-4" />Save Build
              </Btn>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
