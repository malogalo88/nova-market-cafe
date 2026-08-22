import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../lib/store'
import { Link, navigate, useRoute } from '../lib/router'
import { Badge, Btn, Icon, Logo, Modal } from './ui'
import { ALL_PARTS, CATS } from '../data/parts'
import { GAMES } from '../data/games'
import { PREBUILTS } from '../data/prebuilt'
import { GUIDES } from '../data/guides'

const NAV = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/builder', label: 'PC Builder', icon: 'cpu' },
  { to: '/prebuilt', label: 'Prebuilt Builds', icon: 'case' },
  { to: '/performance', label: 'Performance', icon: 'activity' },
  { to: '/compare', label: 'Compare', icon: 'layers' },
  { to: '/community', label: 'Community', icon: 'users' },
  { to: '/saved', label: 'Saved Builds', icon: 'bookmark' },
  { to: '/about', label: 'About', icon: 'info' },
]

// ─── Search ────────────────────────────────────────────────────────────────

interface Hit { group: string; label: string; sub?: string; to: string; icon: string }

function useSearchIndex(): Hit[] {
  return useMemo(() => {
    const hits: Hit[] = []
    for (const p of ALL_PARTS) {
      hits.push({
        group: CATS.find(c => c.key === p.cat)?.label ?? p.cat,
        label: p.name, sub: `$${p.price}`, icon: p.cat === 'gpu' ? 'chip' : p.cat,
        to: `/part/${p.id}`,
      })
    }
    for (const g of GAMES) hits.push({ group: 'Games', label: g.name, sub: g.genre, icon: 'flame', to: `/canirun?game=${g.id}` })
    for (const b of PREBUILTS) hits.push({ group: 'Builds', label: b.name, sub: b.tags[0], icon: 'case', to: `/prebuilt?b=${b.id}` })
    for (const g of GUIDES) hits.push({ group: 'Guides', label: g.title, sub: `${g.minutes} min read`, icon: 'book', to: `/guides?g=${g.id}` })
    hits.push(
      { group: 'Pages', label: 'PC Builder', icon: 'cpu', to: '/builder' },
      { group: 'Pages', label: 'Build Wizard', sub: 'Beginner friendly', icon: 'wand', to: '/wizard' },
      { group: 'Pages', label: 'Can I Run It?', icon: 'flame', to: '/canirun' },
      { group: 'Pages', label: 'Analyze My PC', icon: 'activity', to: '/checkup' },
      { group: 'Pages', label: 'Community', icon: 'users', to: '/community' },
      { group: 'Pages', label: 'Deal Finder', icon: 'percent', to: '/prebuilt?tab=deals' },
    )
    return hits
  }, [])
}

export function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('')
  const index = useSearchIndex()
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 30); else setQ('') }, [open])

  const query = q.trim().toLowerCase()
  const results = query.length < 1 ? [] : index
    .map(h => {
      const hay = `${h.label} ${h.sub ?? ''} ${h.group}`.toLowerCase()
      const idx = hay.indexOf(query)
      return { h, score: idx < 0 ? -1 : (h.label.toLowerCase().startsWith(query) ? 100 : 50 - idx) }
    })
    .filter(x => x.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map(x => x.h)

  const grouped = results.reduce<Record<string, Hit[]>>((acc, h) => { (acc[h.group] ??= []).push(h); return acc }, {})
  const suggestions = ['RTX 4070', 'Fortnite', 'How much RAM do I need?', 'Forge Value 1440', 'PSU']

  return (
    <Modal open={open} onClose={onClose} title={<span className="flex items-center gap-2"><Icon name="search" className="w-4 h-4 text-neon" />Search PCForge</span>}>
      <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Parts, builds, games, guides…"
        className="field mb-3" />
      {!query && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map(s => (
            <button key={s} onClick={() => setQ(s)} className="text-xs px-2.5 py-1 rounded-full border border-line text-mute hover:text-ink hover:border-neon/40 cursor-pointer">{s}</button>
          ))}
        </div>
      )}
      {query && results.length === 0 && (
        <div className="text-sm text-mute py-6 text-center">No matches for “{q}”. Try a part name, game or guide.</div>
      )}
      <div className="max-h-[50vh] overflow-y-auto space-y-4">
        {Object.entries(grouped).map(([group, items]) => (
          <div key={group}>
            <div className="text-[10px] uppercase tracking-[0.18em] text-mute mb-1.5">{group}</div>
            {items.map(h => (
              <Link key={h.to + h.label} to={h.to} onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface2 transition-colors">
                <Icon name={h.icon} className="w-4 h-4 text-neon shrink-0" />
                <span className="text-sm flex-1 truncate">{h.label}</span>
                {h.sub && <span className="text-xs text-mute">{h.sub}</span>}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  )
}

// ─── Auth ──────────────────────────────────────────────────────────────────

export function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { login, signUp } = useApp()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const submit = () => {
    const e = mode === 'login' ? login(username.trim(), pass) : signUp(username.trim(), email.trim(), pass)
    if (e) setErr(e)
    else { setErr(null); setUsername(''); setEmail(''); setPass(''); onClose() }
  }

  return (
    <Modal open={open} onClose={onClose} title={
      <span className="flex items-center gap-2"><Icon name="user" className="w-4 h-4 text-neon" />{mode === 'login' ? 'Log in' : 'Create account'}</span>
    }>
      <div className="flex gap-1.5 mb-5">
        {(['login', 'signup'] as const).map(m => (
          <button key={m} onClick={() => { setMode(m); setErr(null) }}
            className={`flex-1 py-2 rounded-xl text-sm cursor-pointer transition-colors ${mode === m ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 border border-neon/40' : 'border border-line text-mute hover:text-ink'}`}>
            {m === 'login' ? 'Log in' : 'Sign up'}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        <input className="field" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
        {mode === 'signup' && <input className="field" placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />}
        <input className="field" placeholder="Password" type="password" value={pass} onChange={e => setPass(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()} />
        {err && <div className="text-xs text-bad flex items-center gap-1.5"><Icon name="alert" className="w-3.5 h-3.5" />{err}</div>}
        <Btn variant="primary" className="w-full" onClick={submit}>{mode === 'login' ? 'Log in' : 'Create account'}</Btn>
        <p className="text-[11px] text-mute leading-relaxed">
          Demo authentication — accounts are stored only in this browser. An account is never required to browse parts or build.
        </p>
      </div>
    </Modal>
  )
}

// ─── Navbar ────────────────────────────────────────────────────────────────

function ThemeMenu() {
  const { theme, setTheme } = useApp()
  const [open, setOpen] = useState(false)
  const opts: { key: 'dark' | 'light' | 'system'; icon: string; label: string }[] = [
    { key: 'dark', icon: 'moon', label: 'Dark' },
    { key: 'light', icon: 'sun', label: 'Light' },
    { key: 'system', icon: 'laptop', label: 'System' },
  ]
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="p-2 rounded-xl border border-line text-mute hover:text-ink cursor-pointer" aria-label="Theme">
        <Icon name={theme === 'dark' ? 'moon' : theme === 'light' ? 'sun' : 'laptop'} className="w-4.5 h-4.5 w-[18px] h-[18px]" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 z-50 glass rounded-xl p-1 w-36 rise">
            {opts.map(o => (
              <button key={o.key} onClick={() => { setTheme(o.key); setOpen(false) }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer hover:bg-surface2 ${theme === o.key ? 'text-neon' : 'text-mute'}`}>
                <Icon name={o.icon} className="w-4 h-4" />{o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function Navbar({ onSearch, onAuth }: { onSearch: () => void; onAuth: () => void }) {
  const { path } = useRoute()
  const { user, logout, saved } = useApp()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => { setMobileOpen(false) }, [path])

  return (
    <header className="sticky top-0 z-50 glass border-x-0 border-t-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2.5 mr-2 shrink-0">
          <Logo />
          <div className="leading-none">
            <div className="font-display font-bold text-lg tracking-tight">PC<span className="grad-text">Forge</span></div>
            <div className="text-[9px] uppercase tracking-[0.22em] text-mute hidden sm:block">Build Smarter. Game Harder.</div>
          </div>
        </Link>

        <nav className="hidden xl:flex items-center gap-0.5 flex-1">
          {NAV.map(n => (
            <Link key={n.to} to={n.to}
              className={`px-3 py-2 rounded-xl text-[13px] font-medium transition-colors whitespace-nowrap ${
                path === n.to ? 'text-neon bg-neon/10' : 'text-mute hover:text-ink hover:bg-surface2'
              }`}>
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 ml-auto">
          <button onClick={onSearch} className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl border border-line text-mute hover:text-ink hover:border-neon/40 cursor-pointer text-xs w-44">
            <Icon name="search" className="w-4 h-4" />Search…
            <kbd className="ml-auto text-[10px] opacity-60">/</kbd>
          </button>
          <button onClick={onSearch} className="sm:hidden p-2 rounded-xl border border-line text-mute cursor-pointer" aria-label="Search"><Icon name="search" className="w-[18px] h-[18px]" /></button>
          <ThemeMenu />
          {user ? (
            <div className="relative group">
              <button className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-xl border border-line cursor-pointer hover:border-neon/40">
                <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center text-[#06121a] font-bold text-xs uppercase">{user.username[0]}</span>
                <span className="text-xs max-w-20 truncate hidden sm:block">{user.username}</span>
              </button>
              <div className="absolute right-0 pt-2 hidden group-hover:block z-50">
                <div className="glass rounded-xl p-1 w-44">
                  <Link to="/profile" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-mute hover:text-ink hover:bg-surface2"><Icon name="user" className="w-4 h-4" />Profile</Link>
                  <Link to="/saved" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-mute hover:text-ink hover:bg-surface2"><Icon name="bookmark" className="w-4 h-4" />Saved Builds<span className="ml-auto text-neon text-xs">{saved.length}</span></Link>
                  <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-bad hover:bg-surface2 cursor-pointer"><Icon name="x" className="w-4 h-4" />Log out</button>
                </div>
              </div>
            </div>
          ) : (
            <Btn size="sm" variant="primary" onClick={onAuth}><Icon name="user" className="w-3.5 h-3.5" />Login</Btn>
          )}
          <button onClick={() => setMobileOpen(o => !o)} className="xl:hidden p-2 rounded-xl border border-line text-mute cursor-pointer" aria-label="Menu">
            <Icon name={mobileOpen ? 'x' : 'menu'} className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="xl:hidden border-t border-line px-4 py-3 rise">
          <div className="grid grid-cols-2 gap-1.5">
            {[...NAV, { to: '/guides', label: 'Guides', icon: 'book' }, { to: '/canirun', label: 'Can I Run It?', icon: 'flame' }].map(n => (
              <Link key={n.to} to={n.to}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm ${path === n.to ? 'text-neon bg-neon/10' : 'text-mute hover:bg-surface2'}`}>
                <Icon name={n.icon} className="w-4 h-4" />{n.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  )
}

// ─── Footer ────────────────────────────────────────────────────────────────

export function Footer() {
  return (
    <footer className="border-t border-line mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-3"><Logo size={26} /><span className="font-display font-bold">PCForge</span></div>
          <p className="text-xs text-mute leading-relaxed">Build Smarter. Game Harder.<br />The interactive PC-building platform.</p>
          <Badge tone="neon" className="mt-3">All performance numbers are estimates</Badge>
        </div>
        <div>
          <div className="font-semibold mb-3 text-xs uppercase tracking-wider text-mute">Build</div>
          {[['PC Builder', '/builder'], ['Build Wizard', '/wizard'], ['Prebuilt Builds', '/prebuilt'], ['Saved Builds', '/saved'], ['Compare', '/compare']].map(([l, t]) => (
            <Link key={t} to={t} className="block py-1 text-mute hover:text-neon">{l}</Link>
          ))}
        </div>
        <div>
          <div className="font-semibold mb-3 text-xs uppercase tracking-wider text-mute">Learn</div>
          {[['Guides', '/guides'], ['Can I Run It?', '/canirun'], ['Analyze My PC', '/checkup'], ['Performance Lab', '/performance'], ['About', '/about']].map(([l, t]) => (
            <Link key={t} to={t} className="block py-1 text-mute hover:text-neon">{l}</Link>
          ))}
        </div>
        <div>
          <div className="font-semibold mb-3 text-xs uppercase tracking-wider text-mute">Community</div>
          {[['Community Hub', '/community'], ['Challenges', '/community'], ['Leaderboard', '/community'], ['Profile', '/profile']].map(([l, t]) => (
            <Link key={l} to={t} className="block py-1 text-mute hover:text-neon">{l}</Link>
          ))}
        </div>
      </div>
      <div className="border-t border-line py-4 text-center text-[11px] text-mute">
        PCForge is a demo experience with sample data. Prices and FPS figures are approximations — always verify manufacturer specifications.
      </div>
    </footer>
  )
}

// ─── Toaster ───────────────────────────────────────────────────────────────

export function Toaster() {
  const { toasts } = useApp()
  return (
    <div className="fixed top-20 right-4 z-[90] space-y-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`rise glass rounded-xl px-4 py-3 text-sm flex items-center gap-2 shadow-xl ${t.kind === 'warn' ? 'border-warn/40 text-warn' : 'border-good/40'}`}>
          <Icon name={t.kind === 'warn' ? 'alert' : 'check'} className="w-4 h-4 shrink-0" />
          {t.text}
        </div>
      ))}
    </div>
  )
}
