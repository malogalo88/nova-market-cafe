'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Cpu, Gamepad2, Gauge, ArrowRight, BarChart3, Monitor, Zap, ChevronRight, Loader2, Shield,
} from 'lucide-react'

interface Game {
  id: string
  title: string
  genre: string
  tags: string[]
}

const quickLinks = [
  { title: 'Can I Run It?', description: 'Check if your PC can run any game instantly', href: '/run', icon: Zap, color: 'text-accent', highlight: true },
  { title: 'PC Builder', description: 'Configure your system and check compatibility', href: '/builder', icon: Cpu, color: 'text-green' },
  { title: 'Game Database', description: 'Browse all supported games and their requirements', href: '/games', icon: Gamepad2, color: 'text-purple' },
  { title: 'FPS Estimator', description: 'Estimate performance for any game with your hardware', href: '/estimate', icon: Gauge, color: 'text-yellow' },
  { title: 'Upgrade Guide', description: 'Find bottlenecks and get upgrade recommendations', href: '/upgrade', icon: BarChart3, color: 'text-cyan' },
  { title: 'Compare PCs', description: 'Compare two builds side by side', href: '/compare', icon: Monitor, color: 'text-blue' },
]

const performanceTiers = [
  { name: 'Excellent', fps: '90+ FPS', desc: 'Ultra settings, 1440p+', color: 'border-green/30 bg-green/5', badge: 'bg-green/20 text-green' },
  { name: 'Good', fps: '60-90 FPS', desc: 'High settings, 1080p-1440p', color: 'border-blue/30 bg-blue/5', badge: 'bg-blue/20 text-blue' },
  { name: 'Playable', fps: '45-60 FPS', desc: 'Medium settings, 1080p', color: 'border-yellow/30 bg-yellow/5', badge: 'bg-yellow/20 text-yellow' },
  { name: 'Poor', fps: '30-45 FPS', desc: 'Low settings, 720p-1080p', color: 'border-orange/30 bg-orange/5', badge: 'bg-orange/20 text-orange' },
]

const stats = [
  { label: 'CPUs', value: '50+', icon: Cpu },
  { label: 'GPUs', value: '80+', icon: Monitor },
  { label: 'Games', value: '25+', icon: Gamepad2 },
]

export default function HomePage() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/games')
      .then((res) => res.json())
      .then((data) => {
        setGames(Array.isArray(data) ? data.slice(0, 8) : [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <section className="hero-gradient relative overflow-hidden px-6 py-28 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(108,99,255,0.08)_0%,transparent_70%)]" />
        <div className="relative mx-auto max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-bg-card/60 px-4 py-1.5 text-sm text-text-secondary">
            <Zap className="h-3.5 w-3.5 text-accent" />
            Instant PC Gaming Analysis
          </div>
          <h1 className="mb-4 text-5xl font-bold tracking-tight md:text-7xl">
            Can<span className="text-accent">IRun</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-text-secondary md:text-xl">
            Check if your PC can run the games you love. Get accurate FPS estimates,
            hardware compatibility checks, and performance insights in seconds.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/run"
              className="btn-primary inline-flex items-center gap-2 rounded-xl px-8 py-4 text-lg font-bold text-white shadow-lg shadow-accent/20 transition-all hover:shadow-xl hover:shadow-accent/30"
            >
              <Zap className="h-5 w-5" />
              Check Now
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/games"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-bg-card px-8 py-4 text-lg font-semibold text-text-primary transition-all hover:border-border-active hover:bg-bg-card-hover"
            >
              Browse Games
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="mb-10 text-center text-2xl font-bold">Performance Tiers</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {performanceTiers.map((tier) => (
            <div key={tier.name} className={`rounded-xl border p-5 ${tier.color}`}>
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${tier.badge}`}>{tier.name}</span>
              <p className="mt-3 text-xl font-black text-text-primary">{tier.fps}</p>
              <p className="mt-1 text-sm text-text-secondary">{tier.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <h2 className="mb-10 text-center text-2xl font-bold">Get Started</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`group rounded-xl border bg-bg-card p-6 transition-all hover:border-border-active hover:bg-bg-card-hover hover:shadow-lg ${link.highlight ? 'border-accent/40 glow-accent' : 'border-border'}`}
              >
                <div className="flex items-start justify-between">
                  <Icon className={`mb-4 h-10 w-10 ${link.color}`} />
                  {link.highlight && <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent">POPULAR</span>}
                </div>
                <h3 className="mb-1 font-semibold text-text-primary group-hover:text-accent">
                  {link.title}
                </h3>
                <p className="mb-4 text-sm text-text-secondary">{link.description}</p>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
                  Go <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Featured Games</h2>
          <Link href="/games" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
            View all <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        ) : games.length === 0 ? (
          <p className="py-16 text-center text-text-muted">No games available yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {games.map((game) => (
              <Link
                key={game.id}
                href={`/run`}
                className="group rounded-xl border border-border bg-bg-card p-5 transition-all hover:border-border-active hover:bg-bg-card-hover"
              >
                <h3 className="mb-2 font-semibold text-text-primary group-hover:text-accent">
                  {game.title}
                </h3>
                <p className="mb-3 text-sm text-text-secondary">{game.genre}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(game.tags || []).slice(0, 3).map((tag) => (
                    <span key={tag} className="rounded-md bg-bg-primary px-2 py-0.5 text-xs text-text-muted">{tag}</span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-2xl border border-border bg-bg-card p-8 text-center">
          <Shield className="mx-auto mb-4 h-12 w-12 text-accent/40" />
          <h2 className="mb-2 text-2xl font-bold">How It Works</h2>
          <p className="mx-auto mb-8 max-w-xl text-text-secondary">
            Our performance scoring engine compares your hardware against aggregated benchmark data
            to deliver instant compatibility and FPS estimates.
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              { step: '1', title: 'Select Your PC', desc: 'Choose a saved profile or pick your CPU, GPU, and RAM manually.' },
              { step: '2', title: 'Pick a Game', desc: 'Search our database of popular PC games with full system requirements.' },
              { step: '3', title: 'Get Results', desc: 'Instant FPS estimates, bottleneck analysis, and upgrade suggestions.' },
            ].map(s => (
              <div key={s.step} className="text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 text-lg font-bold text-accent">{s.step}</div>
                <h3 className="mb-1 font-semibold text-text-primary">{s.title}</h3>
                <p className="text-sm text-text-secondary">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-bg-secondary/50 px-6 py-16">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 text-center sm:grid-cols-3">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="flex flex-col items-center">
                <Icon className="mb-3 h-8 w-8 text-accent" />
                <p className="text-3xl font-bold text-text-primary">{stat.value}</p>
                <p className="text-sm text-text-secondary">{stat.label} in Database</p>
              </div>
            )
          })}
        </div>
      </section>

      <footer className="border-t border-border px-6 py-10 text-center">
        <p className="mx-auto max-w-2xl text-xs text-text-muted">
          All performance estimates are approximate and based on aggregate benchmark data.
          Actual in-game performance may vary depending on drivers, background processes,
          system configuration, and game updates. CanIRun is not affiliated with any game
          publishers or hardware manufacturers.
        </p>
      </footer>
    </div>
  )
}
