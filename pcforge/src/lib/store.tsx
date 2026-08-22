import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { BuildParts, SavedBuild, UserAccount } from '../types'
import { analyze, encodeBuild, decodeBuild, type Analysis } from './engine'

// ─── persistence helpers ───────────────────────────────────────────────────

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage unavailable */ }
}

// ─── types ─────────────────────────────────────────────────────────────────

type Theme = 'dark' | 'light' | 'system'
export interface Toast { id: number; text: string; kind: 'ok' | 'warn' }

interface AppState {
  build: BuildParts
  setPart: (cat: keyof BuildParts, id: string | undefined) => void
  clearBuild: () => void
  loadParts: (parts: BuildParts, name?: string) => void
  analysis: Analysis

  saved: SavedBuild[]
  saveBuild: (name: string) => SavedBuild
  updateBuild: (id: string, patch: Partial<SavedBuild>) => void
  deleteBuild: (id: string) => void
  duplicateBuild: (id: string) => void

  theme: Theme
  setTheme: (t: Theme) => void
  beginner: boolean
  setBeginner: (b: boolean) => void

  user: UserAccount | null
  users: UserAccount[]
  signUp: (username: string, email: string, pass: string) => string | null
  login: (username: string, pass: string) => string | null
  logout: () => void
  updateProfile: (patch: Partial<UserAccount>) => void

  likes: Record<string, boolean>
  toggleLike: (id: string) => void
  follows: Record<string, boolean>
  toggleFollow: (author: string) => void

  toasts: Toast[]
  toast: (text: string, kind?: 'ok' | 'warn') => void

  shareLink: (name?: string) => string
}

const Ctx = createContext<AppState | null>(null)

const DEFAULT_BUILD: BuildParts = {
  cpu: 'r5-7600', gpu: 'rtx-4060', mb: 'b650m', ram: 'vengeance-32-d5',
  storage: 'sn580-1tb', psu: 'cv650', cooler: 'ak400', case: 'pop-air',
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [build, setBuild] = useState<BuildParts>(() => load('pcf_build', DEFAULT_BUILD))
  const [saved, setSaved] = useState<SavedBuild[]>(() => load('pcf_saved', []))
  const [theme, setThemeState] = useState<Theme>(() => load('pcf_theme', 'dark' as Theme))
  const [beginner, setBeginnerState] = useState<boolean>(() => load('pcf_beginner', true))
  const [users, setUsers] = useState<UserAccount[]>(() => load('pcf_users', []))
  const [user, setUser] = useState<UserAccount | null>(() => {
    const session = load<string | null>('pcf_session', null)
    if (!session) return null
    const all = load<UserAccount[]>('pcf_users', [])
    return all.find(u => u.username === session) ?? null
  })
  const [likes, setLikes] = useState<Record<string, boolean>>(() => load('pcf_likes', {}))
  const [follows, setFollows] = useState<Record<string, boolean>>(() => load('pcf_follows', {}))
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastId = useRef(0)

  useEffect(() => save('pcf_build', build), [build])
  useEffect(() => save('pcf_saved', saved), [saved])
  useEffect(() => save('pcf_users', users), [users])
  useEffect(() => save('pcf_likes', likes), [likes])
  useEffect(() => save('pcf_follows', follows), [follows])

  // theme application
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const apply = () => {
      const effective = theme === 'system' ? (mq.matches ? 'light' : 'dark') : theme
      document.documentElement.classList.toggle('light', effective === 'light')
      document.documentElement.classList.toggle('dark', effective === 'dark')
    }
    apply()
    save('pcf_theme', theme)
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])

  const toast = useCallback((text: string, kind: 'ok' | 'warn' = 'ok') => {
    const id = ++toastId.current
    setToasts(t => [...t, { id, text, kind }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
  }, [])

  const analysis = useMemo(() => {
    try {
      return analyze(build)
    } catch {
      return analyze({})
    }
  }, [build])

  const api: AppState = useMemo(() => ({
    analysis,
    build,
    setPart: (cat, id) => setBuild(b => {
      const next = { ...b }
      if (id) next[cat] = id
      else delete next[cat]
      return next
    }),
    clearBuild: () => setBuild({}),
    loadParts: (parts) => setBuild({ ...parts }),

    saved,
    saveBuild: (name) => {
      const sb: SavedBuild = { id: Math.random().toString(36).slice(2, 8), name, date: Date.now(), parts: { ...build } }
      setSaved(s => [sb, ...s])
      toast(`Saved "${name}"`)
      return sb
    },
    updateBuild: (id, patch) => setSaved(list => list.map(b => (b.id === id ? { ...b, ...patch } : b))),
    deleteBuild: (id) => { setSaved(list => list.filter(b => b.id !== id)); toast('Build deleted') },
    duplicateBuild: (id) => {
      const src = saved.find(b => b.id === id)
      if (!src) return
      const copy: SavedBuild = { ...src, id: Math.random().toString(36).slice(2, 8), name: `${src.name} (copy)`, date: Date.now(), parts: { ...src.parts } }
      setSaved(list => [copy, ...list])
      toast('Build duplicated')
    },

    theme,
    setTheme: setThemeState,
    beginner,
    setBeginner: (v) => { setBeginnerState(v); save('pcf_beginner', v) },

    user, users,
    signUp: (username, email, pass) => {
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return 'Username must be 3–20 letters, numbers or underscores.'
      if (!/^\S+@\S+\.\S+$/.test(email)) return 'Please enter a valid email address.'
      if (pass.length < 6) return 'Password must be at least 6 characters.'
      if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) return 'That username is taken.'
      const acct: UserAccount = { username, email, pass: btoa(pass), bio: '', joined: Date.now(), following: [] }
      setUsers(all => [...all, acct])
      setUser(acct)
      save('pcf_session', username)
      toast(`Welcome to PCForge, ${username}!`)
      return null
    },
    login: (username, pass) => {
      const found = users.find(u => u.username.toLowerCase() === username.toLowerCase())
      if (!found || found.pass !== btoa(pass)) return 'Invalid username or password.'
      setUser(found)
      save('pcf_session', found.username)
      toast(`Welcome back, ${found.username}!`)
      return null
    },
    logout: () => { setUser(null); localStorage.removeItem('pcf_session'); toast('Logged out') },
    updateProfile: (patch) => {
      if (!user) return
      const next = { ...user, ...patch }
      setUser(next)
      setUsers(all => all.map(u => (u.username === user.username ? next : u)))
    },

    likes,
    toggleLike: (id) => setLikes(l => ({ ...l, [id]: !l[id] })),
    follows,
    toggleFollow: (a) => setFollows(f => ({ ...f, [a]: !f[a] })),

    toasts, toast,

    shareLink: (name) => {
      const code = encodeBuild(name ?? 'My Build', build)
      return `${window.location.origin}${window.location.pathname}#/build/${code}`
    },
  }), [build, saved, theme, beginner, user, users, likes, follows, toasts, analysis, toast])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp outside provider')
  return ctx
}

export { decodeBuild }
