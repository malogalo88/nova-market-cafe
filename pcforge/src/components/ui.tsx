import React from 'react'

// ─── Icons ─────────────────────────────────────────────────────────────────

const PATHS: Record<string, React.ReactNode> = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20.5 20.5-4-4" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></>,
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />,
  laptop: <><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M2 20h20" /></>,
  heart: <path d="M12 20.5C7 16.5 3.5 13.3 3.5 9.6 3.5 7 5.5 5 8 5c1.6 0 3.1.8 4 2.1C12.9 5.8 14.4 5 16 5c2.5 0 4.5 2 4.5 4.6 0 3.7-3.5 6.9-8.5 10.9Z" />,
  share: <><circle cx="6" cy="12" r="2.5" /><circle cx="17" cy="5.5" r="2.5" /><circle cx="17" cy="18.5" r="2.5" /><path d="m8.3 10.8 6.4-4M8.3 13.2l6.4 4" /></>,
  bookmark: <path d="M6 3h12v18l-6-4.5L6 21V3Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  zap: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />,
  cpu: <><rect x="6" y="6" width="12" height="12" rx="2" /><rect x="10" y="10" width="4" height="4" /><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4" /></>,
  chip: <><rect x="4" y="7" width="16" height="10" rx="2" /><path d="M8 7V4m8 3V4M8 20v-3m8 3v-3" /><circle cx="9.5" cy="12" r="1" /><circle cx="14.5" cy="12" r="1" /></>,
  board: <><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="8" y="8" width="5" height="5" /><path d="M16 8v2m0 3v2M8 16h2m3 0h2" /></>,
  memory: <><rect x="3" y="8" width="18" height="8" rx="1.5" /><path d="M7 16v3m5-3v3m5-3v3M7 8V5m5 3V5m5 3V5" /></>,
  drive: <><rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01" /></>,
  plug: <><path d="M9 3v5m6-5v5M6 8h12v3a6 6 0 0 1-12 0V8Z" /><path d="M12 17v4" /></>,
  case: <><rect x="5" y="3" width="14" height="18" rx="2" /><circle cx="15" cy="17" r="1" /><path d="M9 3v18" /></>,
  snow: <path d="M12 2v20M4 6l16 12M20 6 4 18M12 6l3-2m-3 2L9 4m3 14 3 2m-3-2-3 2" />,
  fan: <><circle cx="12" cy="12" r="2" /><path d="M12 10c0-4 -1.5-6 3-6 3 0 4 2 2 4.5S12 12 12 10Zm2 3.5c3.5 2 6 2 6 5.5 0 2-2 3-4.5 1.5S12 15 14 13.5Zm-4 0c-3.5 2-6 2-6 5.5 0 2 2 3 4.5 1.5S12 15 10 13.5ZM10 10c0-4 1.5-6-3-6-3 0-4 2-2 4.5S10 12 10 10Z" /></>,
  disc: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.5" /></>,
  screen: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M9 20h6m-3-4v4" /></>,
  keyboard: <><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6" /></>,
  mouse: <><rect x="7" y="3" width="10" height="18" rx="5" /><path d="M12 7v4" /></>,
  headset: <><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="14" width="4" height="6" rx="1.5" /><rect x="17" y="14" width="4" height="6" rx="1.5" /></>,
  wifi: <><path d="M2.5 9a15 15 0 0 1 19 0M5.5 12.5a10.5 10.5 0 0 1 13 0M8.5 16a6 6 0 0 1 7 0" /><circle cx="12" cy="19.5" r="1" /></>,
  flame: <path d="M12 22c4 0 7-2.7 7-6.5 0-3-2-5-3.5-6.5C14 7.5 13 5.5 13 2c-3 2-5.5 5-5.5 8 0 1-.6 1.5-1.2.8C5.5 9.8 5 8.5 5 8.5c-1.3 1.7-2 3.9-2 6 0 4.3 4 7.5 9 7.5Z" />,
  trophy: <><path d="M8 4h8v6a4 4 0 0 1-8 0V4Z" /><path d="M8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 14v4m-4 3h8" /></>,
  chat: <path d="M21 12a8 8 0 0 1-8 8H4l2.3-2.9A8 8 0 1 1 21 12Z" />,
  arrowRight: <path d="M4 12h16m-6-6 6 6-6 6" />,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  alert: <><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 10v4m0 3h.01" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
  sparkles: <><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" /><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" /></>,
  sliders: <><path d="M4 8h10m4 0h2M4 16h4m4 0h8" /><circle cx="16" cy="8" r="2" /><circle cx="10" cy="16" r="2" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m4.5 12.5 7.5 4.2 7.5-4.2M4.5 16.5 12 20.7l7.5-4.2" /></>,
  home: <path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9Z" />,
  grid: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c1.2-3.2 3.6-5 6.5-5s5.3 1.8 6.5 5" /><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4m1.5 3.9c1.9.7 3.3 2.3 4 4.9" /></>,
  book: <><path d="M4 5a2 2 0 0 1 2-2h14v18H6a2 2 0 0 0-2 2V5Z" /><path d="M4 19a2 2 0 0 1 2-2h14" /></>,
  wand: <><path d="m14 5 5 5L8 21l-5-5L14 5Z" /><path d="M15 4l1-2 1 2 2 1-2 1-1 2-1-2-2-1 2-1Z" /></>,
  gauge: <><path d="M4 14a8 8 0 1 1 16 0" /><path d="m12 14 4-5" /><path d="M5 19h14" /></>,
  dollar: <><path d="M12 2v20" /><path d="M17 6.5c-.8-1.5-2.6-2.5-5-2.5-2.8 0-4.5 1.4-4.5 3.4 0 4.6 9.5 2.4 9.5 7.1 0 2-1.7 3.5-4.9 3.5-2.6 0-4.4-1-5.1-2.6" /></>,
  refresh: <><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 3v5h-5" /></>,
  trash: <><path d="M4 7h16M9 7V4h6v3m-9 0 1 14h10l1-14" /><path d="M10 11v6m4-6v6" /></>,
  edit: <><path d="M4 20h4L20 8l-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></>,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></>,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  star: <path d="m12 3 2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 16.9 6.4 20l1.3-6.2L3 9.5l6.3-.7L12 3Z" />,
  activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  shield: <path d="M12 2 4.5 5v6c0 5 3.2 8.6 7.5 11 4.3-2.4 7.5-6 7.5-11V5L12 2Z" />,
  external: <><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4m8-4v4M3 10h18" /></>,
  filter: <path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z" />,
  percent: <><path d="m19 5-14 14" /><circle cx="7" cy="7" r="2.5" /><circle cx="17" cy="17" r="2.5" /></>,
  send: <path d="M22 2 11 13M22 2 15 22l-4-9-9-4 20-7Z" />,
  bolt: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />,
}

export function Icon({ name, className = 'w-5 h-5', strokeWidth = 1.8 }: { name: string; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {PATHS[name] ?? PATHS.info}
    </svg>
  )
}

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-label="PCForge logo">
      <defs>
        <linearGradient id="pcfg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" /><stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      <path d="M16 2l12 7v14l-12 7L4 23V9z" fill="rgba(34,211,238,0.08)" stroke="url(#pcfg)" strokeWidth="2" />
      <path d="M12 21V11h9M12 16h7" stroke="url(#pcfg)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </svg>
  )
}

// ─── Primitives ────────────────────────────────────────────────────────────

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'soft' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}
export function Btn({ variant = 'ghost', size = 'md', className = '', ...rest }: BtnProps) {
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' }[size]
  const variants = {
    primary: 'btn-primary',
    ghost: 'btn-ghost text-[color:var(--ink)]',
    soft: 'bg-surface2 border border-line hover:border-neon/40 transition-colors text-[color:var(--ink)]',
    danger: 'border border-bad/40 text-bad hover:bg-bad/10 transition-colors',
  }[variant]
  return <button className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium cursor-pointer select-none ${sizes} ${variants} ${className}`} {...rest} />
}

export function Card({ className = '', children, hover = false }: { className?: string; children: React.ReactNode; hover?: boolean }) {
  return <div className={`glass rounded-2xl ${hover ? 'card-hover' : ''} ${className}`}>{children}</div>
}

export function Badge({ tone = 'line', children, className = '' }: { tone?: 'line' | 'good' | 'warn' | 'bad' | 'neon' | 'viol'; children: React.ReactNode; className?: string }) {
  const tones = {
    line: 'border-line text-mute',
    good: 'border-good/40 text-good bg-good/10',
    warn: 'border-warn/40 text-warn bg-warn/10',
    bad: 'border-bad/40 text-bad bg-bad/10',
    neon: 'border-neon/40 text-neon bg-neon/10',
    viol: 'border-viol/40 text-viol bg-viol/10',
  }[tone]
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones} ${className}`}>{children}</span>
}

export function Stars({ rating, className = '' }: { rating: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs text-mute ${className}`}>
      <Icon name="star" className="w-3.5 h-3.5 text-warn" />
      {rating.toFixed(1)}
    </span>
  )
}

export function Bar({ value, max = 10, tone = 'neon', className = '' }: { value: number; max?: number; tone?: 'neon' | 'viol' | 'good' | 'warn' | 'bad'; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const grad = {
    neon: 'from-cyan-400 to-cyan-300', viol: 'from-violet-500 to-fuchsia-400',
    good: 'from-emerald-500 to-emerald-400', warn: 'from-amber-500 to-amber-400', bad: 'from-red-500 to-red-400',
  }[tone]
  return (
    <div className={`h-2 rounded-full bg-surface2 overflow-hidden ${className}`}>
      <div className={`h-full rounded-full bg-gradient-to-r ${grad} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function ScoreRing({ score, size = 92, label }: { score: number; size?: number; label?: string }) {
  const R = (size - 12) / 2
  const C = 2 * Math.PI * R
  const off = C * (1 - Math.max(0, Math.min(100, score)) / 100)
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`ring-${size}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#22d3ee" /><stop offset="1" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={R} stroke="var(--surface2)" strokeWidth="7" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={R} stroke={`url(#ring-${size})`} strokeWidth="7" fill="none"
          strokeDasharray={C} strokeDashoffset={off} strokeLinecap="round" style={{ transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-bold leading-none" style={{ fontSize: size * 0.28 }}>{score}</span>
        {label && <span className="text-[10px] text-mute mt-0.5">{label}</span>}
      </div>
    </div>
  )
}

export function Modal({ open, onClose, title, children, wide = false }: {
  open: boolean; onClose: () => void; title?: React.ReactNode; children: React.ReactNode; wide?: boolean
}) {
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[80] flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className={`relative glass rounded-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} my-auto rise`}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="font-display font-semibold">{title}</div>
          <button onClick={onClose} className="text-mute hover:text-ink cursor-pointer p-1" aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} />
}

export function EmptyState({ icon = 'grid', title, text, action }: {
  icon?: string; title: string; text?: string; action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="w-14 h-14 rounded-2xl glass flex items-center justify-center text-mute mb-4"><Icon name={icon} className="w-7 h-7" /></div>
      <div className="font-display font-semibold text-lg">{title}</div>
      {text && <p className="text-sm text-mute mt-1 max-w-sm">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Tip({ term, text }: { term: React.ReactNode; text: string }) {
  return (
    <span className="tip relative inline-block">
      {term}
      <span className="tipbox absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 z-50 rounded-xl glass p-3 text-xs text-left normal-case tracking-normal shadow-xl pointer-events-none">
        {text}
      </span>
    </span>
  )
}

export function SectionHead({ eyebrow, title, sub, right }: { eyebrow?: string; title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        {eyebrow && <div className="text-xs font-semibold uppercase tracking-[0.2em] text-neon mb-2">{eyebrow}</div>}
        <h2 className="font-display text-2xl sm:text-3xl font-bold">{title}</h2>
        {sub && <p className="text-sm text-mute mt-1 max-w-2xl">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange, className = '' }: {
  tabs: { key: T; label: string; icon?: string }[]; value: T; onChange: (t: T) => void; className?: string
}) {
  return (
    <div className={`flex gap-1.5 overflow-x-auto no-scrollbar ${className}`}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={`px-3.5 py-2 rounded-xl text-sm whitespace-nowrap cursor-pointer inline-flex items-center gap-1.5 transition-colors ${
            value === t.key ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 border border-neon/40 text-ink' : 'border border-transparent text-mute hover:text-ink hover:bg-surface2'
          }`}>
          {t.icon && <Icon name={t.icon} className="w-4 h-4" />}{t.label}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, children, hint }: { label: React.ReactNode; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-mute mb-1.5 flex items-center gap-1">{label}{hint && <Tip term="?" text={hint} />}</div>
      {children}
    </label>
  )
}

export function ErrorBoundaryFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md p-8 text-center">
        <div className="text-bad mb-3 flex justify-center"><Icon name="alert" className="w-10 h-10" /></div>
        <h1 className="font-display text-xl font-bold mb-2">Something went wrong</h1>
        <p className="text-sm text-mute mb-5">We couldn't load this part of PCForge. Your saved builds are safe.</p>
        <pre className="text-[10px] text-left text-mute bg-surface2 rounded-lg p-3 overflow-x-auto mb-5">{error.message}</pre>
        <Btn variant="primary" onClick={reset}><Icon name="refresh" className="w-4 h-4" />Try again</Btn>
      </Card>
    </div>
  )
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) return <ErrorBoundaryFallback error={this.state.error} reset={() => this.setState({ error: null })} />
    return this.props.children
  }
}
