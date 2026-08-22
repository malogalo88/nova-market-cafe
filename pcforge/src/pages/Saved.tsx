import { useState } from 'react'
import { useApp } from '../lib/store'
import { Badge, Btn, Card, EmptyState, Icon, Modal, SectionHead } from '../components/ui'
import { CATS, getPart } from '../data/parts'
import { analyze, avgAcrossGames, encodeBuild, money } from '../lib/engine'
import { Link, navigate } from '../lib/router'
import type { SavedBuild } from '../types'

export default function Saved() {
  const app = useApp()
  const [renaming, setRenaming] = useState<SavedBuild | null>(null)
  const [newName, setNewName] = useState('')

  const share = (b: SavedBuild) => {
    const link = `${window.location.origin}${window.location.pathname}#/build/${encodeBuild(b.name, b.parts)}`
    navigator.clipboard?.writeText(link).then(() => app.toast('Share link copied'), () => app.toast('Copy failed', 'warn'))
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <SectionHead eyebrow="Your workshop" title="Saved Builds"
        sub="Everything is stored locally in this browser. Share links encode the full build so anyone can view it."
        right={<Link to="/builder"><Btn variant="primary" size="sm"><Icon name="plus" className="w-3.5 h-3.5" />New build</Btn></Link>} />

      {app.saved.length === 0 ? (
        <Card className="p-0">
          <EmptyState icon="bookmark" title="You haven't created any builds yet."
            text="Fire up the Builder or answer a few questions in the Build Wizard — your saves will appear here."
            action={
              <div className="flex gap-2 justify-center">
                <Link to="/builder"><Btn variant="primary">Create Your First Build</Btn></Link>
                <Link to="/wizard"><Btn><Icon name="wand" className="w-4 h-4" />Build Wizard</Btn></Link>
              </div>
            } />
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {app.saved.map((b, i) => {
            const a = analyze(b.parts)
            const fps = avgAcrossGames(a.r.cpu, a.r.gpu, a.r.ram, '1080p', 'High')
            return (
              <Card key={b.id} hover className={`p-5 flex flex-col rise rise-${(i % 6) + 1}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-display font-semibold truncate">{b.name}</h3>
                    <div className="text-[11px] text-mute flex items-center gap-1 mt-0.5">
                      <Icon name="calendar" className="w-3 h-3" />{new Date(b.date).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge tone="neon">{a.scores.overall}/100</Badge>
                </div>

                <div className="font-display font-bold text-xl grad-text mt-3">{money(a.price)}</div>
                <div className="text-[11px] text-mute">≈ {fps} FPS @1080p High · ~{a.power.gamingW}W (est.)</div>

                <div className="mt-3 space-y-1 text-xs text-mute flex-1">
                  {(['cpu', 'gpu', 'ram', 'storage'] as const).map(c => (
                    <div key={c} className="truncate">
                      <span className="text-[10px] uppercase tracking-wider mr-1.5 opacity-70">{CATS.find(x => x.key === c)!.short}</span>
                      <span className="text-ink">{getPart(b.parts[c])?.name ?? '—'}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-line">
                  <Btn size="sm" variant="primary" onClick={() => { app.loadParts(b.parts); navigate('/builder') }}>
                    <Icon name="edit" className="w-3.5 h-3.5" />Edit
                  </Btn>
                  <Btn size="sm" onClick={() => share(b)} title="Copy share link"><Icon name="share" className="w-3.5 h-3.5" /></Btn>
                  <Btn size="sm" onClick={() => app.duplicateBuild(b.id)} title="Duplicate"><Icon name="copy" className="w-3.5 h-3.5" /></Btn>
                  <Btn size="sm" onClick={() => { setRenaming(b); setNewName(b.name) }} title="Rename"><Icon name="menu" className="w-3.5 h-3.5 rotate-90" /></Btn>
                  <Btn size="sm" variant="danger" className="ml-auto" onClick={() => app.deleteBuild(b.id)} title="Delete"><Icon name="trash" className="w-3.5 h-3.5" /></Btn>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={!!renaming} onClose={() => setRenaming(null)} title="Rename build">
        <input className="field mb-4" value={newName} onChange={e => setNewName(e.target.value)} maxLength={40} />
        <div className="flex justify-end gap-2">
          <Btn onClick={() => setRenaming(null)}>Cancel</Btn>
          <Btn variant="primary" disabled={!newName.trim()} onClick={() => { if (renaming) app.updateBuild(renaming.id, { name: newName.trim() }); setRenaming(null); app.toast('Renamed') }}>Save</Btn>
        </div>
      </Modal>
    </div>
  )
}
