'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  GitCompare,
  Plus,
  X,
  Loader2,
  AlertCircle,
  Gamepad2,
  Cpu,
  BarChart3,
  Trophy,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts'
import type { SavedProfile, CompareEntry } from '@/types'

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-bg-card p-3 shadow-xl">
      <p className="mb-1 text-sm font-medium text-text-primary">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs" style={{ color: p.color }}>
          {p.name}: {p.value} FPS
        </p>
      ))}
    </div>
  )
}

export default function ComparePage() {
  const [profiles, setProfiles] = useState<SavedProfile[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [gameId, setGameId] = useState('')
  const [gameQuery, setGameQuery] = useState('')
  const [games, setGames] = useState<{ id: string; title: string }[]>([])
  const [gameDropdownOpen, setGameDropdownOpen] = useState(false)
  const [results, setResults] = useState<CompareEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [profilesLoading, setProfilesLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/profiles')
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : []
        setProfiles(list)
      })
      .catch(() => setProfiles([]))
      .finally(() => setProfilesLoading(false))
  }, [])

  useEffect(() => {
    if (!gameQuery.trim()) return
    const t = setTimeout(() => {
      fetch(`/api/games?q=${encodeURIComponent(gameQuery)}`)
        .then((r) => r.json())
        .then((data) => {
          setGames(Array.isArray(data) ? data.slice(0, 10) : [])
          setGameDropdownOpen(true)
        })
        .catch(() => setGames([]))
    }, 300)
    return () => clearTimeout(t)
  }, [gameQuery])

  const handleGameQueryChange = useCallback((value: string) => {
    setGameQuery(value)
    if (!value.trim()) {
      setGames([])
      setGameDropdownOpen(false)
    }
  }, [])

  const toggleProfile = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : prev.length < 4 ? [...prev, id] : prev
    )
  }, [])

  const handleCompare = async () => {
    if (selectedIds.length < 2) return
    setLoading(true)
    setError('')
    setResults([])
    setExpandedIdx(null)
    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileIds: selectedIds, gameId: gameId || undefined }),
      })
      if (!res.ok) throw new Error('Failed to compare')
      const data: CompareEntry[] = await res.json()
      if (data.length < 2) throw new Error('Need at least 2 valid profiles to compare')
      setResults(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Comparison failed')
    } finally {
      setLoading(false)
    }
  }

  const resolutions = ['1080p', '1440p', '4k'] as const
  const qualities = ['low', 'medium', 'high', 'ultra'] as const

  const getFpsBarData = () => {
    if (!results[0]?.fpsEstimate) return []
    const data: { resolution: string; [key: string]: string | number }[] = []
    for (const res of resolutions) {
      const entry: { resolution: string; [key: string]: string | number } = {
        resolution: `1080p`,
      }
      entry.resolution = res === '1080p' ? '1080p' : res === '1440p' ? '1440p' : '4K'
      for (const r of results) {
        if (r.fpsEstimate) {
          const fpsData = res === '1080p'
            ? r.fpsEstimate.resolution1080p
            : res === '1440p'
              ? r.fpsEstimate.resolution1440p
              : r.fpsEstimate.resolution4k
          entry[`${r.profile.name} - Ultra`] = fpsData.ultra
        }
      }
      data.push(entry)
    }
    return data
  }

  const getFpsByQualityData = (resolutionKey: 'resolution1080p' | 'resolution1440p' | 'resolution4k') => {
    const data: { quality: string; [key: string]: string | number }[] = []
    for (const q of qualities) {
      const entry: { quality: string; [key: string]: string | number } = { quality: q.charAt(0).toUpperCase() + q.slice(1) }
      for (const r of results) {
        if (r.fpsEstimate) {
          entry[r.profile.name] = r.fpsEstimate[resolutionKey][q]
        }
      }
      data.push(entry)
    }
    return data
  }

  const getRadarData = () => {
    return results.map((r) => {
      const e = r.fpsEstimate
      return {
        name: r.profile.name,
        cpu: r.cpu.performanceScore,
        gpu: r.gpu.performanceScore,
        ram: Math.min(100, (r.profile.ramGB / 64) * 100),
        fps1080p: e ? e.resolution1080p.high : 0,
        bottleneck: e ? 100 - e.bottleneckAnalysis.bottleneckPercent : 100,
      }
    })
  }

  const radarFields = ['cpu', 'gpu', 'ram', 'fps1080p', 'bottleneck'] as const
  const radarLabels: Record<string, string> = {
    cpu: 'CPU Score',
    gpu: 'GPU Score',
    ram: 'RAM',
    fps1080p: 'FPS (1080p High)',
    bottleneck: 'Balance',
  }

  const colors = ['#6c63ff', '#4ade80', '#facc15', '#f87171']

  const getScoreLabel = (fps: number): { text: string; color: string } => {
    if (fps >= 60) return { text: 'Excellent', color: 'text-green' }
    if (fps >= 30) return { text: 'Playable', color: 'text-yellow' }
    return { text: 'Poor', color: 'text-red' }
  }

  if (profilesLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    )
  }

  if (profiles.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-20 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-bg-card">
          <GitCompare className="h-10 w-10 text-accent" />
        </div>
        <h1 className="mb-3 text-3xl font-bold">Compare PCs</h1>
        <p className="mb-8 text-text-secondary">
          You need at least 2 saved profiles to compare. Create some profiles first!
        </p>
        <Link
          href="/profiles"
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 font-semibold text-white transition-all hover:bg-accent/90"
        >
          <Plus className="h-4 w-4" />
          Create Profiles
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 flex items-center gap-3">
        <GitCompare className="h-8 w-8 text-cyan" />
        <div>
          <h1 className="text-3xl font-bold">Compare PCs</h1>
          <p className="text-text-secondary">Compare 2-4 system builds side by side</p>
        </div>
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <Cpu className="h-5 w-5 text-accent" />
              Select Profiles to Compare
            </h2>
            <p className="mb-4 text-sm text-text-muted">Choose 2-4 profiles</p>
            <div className="space-y-2">
              {profiles.map((profile) => {
                const selected = selectedIds.includes(profile.id)
                return (
                  <button
                    key={profile.id}
                    onClick={() => toggleProfile(profile.id)}
                    className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-all ${
                      selected
                        ? 'border-accent bg-accent/10'
                        : 'border-border bg-bg-primary hover:border-border-active hover:bg-bg-card-hover'
                    }`}
                  >
                    <div>
                      <span className="font-medium text-text-primary">{profile.name}</span>
                      <span className="ml-2 text-xs text-text-muted">
                        {profile.type === 'laptop' ? 'Laptop' : 'Desktop'}
                      </span>
                    </div>
                    {selected && (
                      <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-white">
                        Selected
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <Gamepad2 className="h-5 w-5 text-green" />
              Optional Game
            </h2>
            <p className="mb-4 text-sm text-text-muted">Select a game to compare FPS estimates</p>
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={gameQuery}
                  onChange={(e) => handleGameQueryChange(e.target.value)}
                  placeholder="Search games..."
                  className="w-full rounded-lg border border-border bg-bg-input py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                />
              </div>
              {gameDropdownOpen && games.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-bg-card shadow-xl">
                  <button
                    onClick={() => {
                      setGameId('')
                      setGameQuery('')
                      setGameDropdownOpen(false)
                    }}
                    className="w-full border-b border-border px-4 py-2 text-left text-sm text-text-muted hover:bg-bg-card-hover"
                  >
                    No game (hardware only)
                  </button>
                  {games.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => {
                        setGameId(g.id)
                        setGameQuery(g.title)
                        setGameDropdownOpen(false)
                      }}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors hover:bg-bg-card-hover ${
                        gameId === g.id ? 'bg-accent/10 text-accent' : 'text-text-primary'
                      }`}
                    >
                      {g.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {gameId && (
              <button
                onClick={() => {
                  setGameId('')
                  setGameQuery('')
                }}
                className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline"
              >
                <X className="h-3 w-3" />
                Clear game
              </button>
            )}
          </div>
        </div>

        <div className="flex items-start">
          <div className="rounded-xl border border-border bg-bg-card p-5">
            <h3 className="mb-2 text-sm font-medium text-text-muted">Selected</h3>
            <div className="flex gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-bold ${
                    selectedIds[i]
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-border bg-bg-input text-text-muted'
                  }`}
                >
                  {i + 1}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-text-muted">
              {selectedIds.length}/4 selected
            </p>
          </div>
        </div>
      </div>

      <div className="mb-8 flex justify-center">
        <button
          onClick={handleCompare}
          disabled={selectedIds.length < 2 || loading}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-8 py-3.5 font-semibold text-white transition-all hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <GitCompare className="h-5 w-5" />
          )}
          Compare {selectedIds.length} PCs
        </button>
      </div>

      {error && (
        <div className="mb-8 flex items-center gap-3 rounded-xl border border-red/30 bg-red-dim/20 p-4">
          <AlertCircle className="h-5 w-5 text-red" />
          <p className="text-sm text-red">{error}</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-8 animate-fadeIn">
          <div className="rounded-xl border border-border bg-bg-card p-6">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
              <Cpu className="h-5 w-5 text-accent" />
              Hardware Specifications
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-3 pr-4 text-left text-text-muted">Spec</th>
                    {results.map((r, i) => (
                      <th key={i} className="pb-3 px-4 text-left" style={{ color: colors[i] }}>
                        {r.profile.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Type', getValue: (r: CompareEntry) => r.profile.type === 'laptop' ? 'Laptop' : 'Desktop' },
                    { label: 'CPU', getValue: (r: CompareEntry) => r.cpu.name },
                    { label: 'CPU Cores', getValue: (r: CompareEntry) => `${r.cpu.cores}C / ${r.cpu.threads}T`, compare: (r: CompareEntry) => r.cpu.cores },
                    { label: 'CPU Clock', getValue: (r: CompareEntry) => `${r.cpu.boostClock} GHz` },
                    { label: 'GPU', getValue: (r: CompareEntry) => r.gpu.name },
                    { label: 'VRAM', getValue: (r: CompareEntry) => `${r.gpu.vram} GB ${r.gpu.vramType}`, compare: (r: CompareEntry) => r.gpu.vram },
                    { label: 'RAM', getValue: (r: CompareEntry) => `${r.profile.ramGB} GB @ ${r.profile.ramSpeed} MHz`, compare: (r: CompareEntry) => r.profile.ramGB },
                    { label: 'Storage', getValue: (r: CompareEntry) => `${r.profile.storageCapacity} GB ${r.profile.storageType}` },
                    { label: 'Display', getValue: (r: CompareEntry) => r.profile.displayResolution },
                    { label: 'CPU Score', getValue: (r: CompareEntry) => r.cpu.performanceScore.toString(), compare: (r: CompareEntry) => r.cpu.performanceScore },
                    { label: 'GPU Score', getValue: (r: CompareEntry) => r.gpu.performanceScore.toString(), compare: (r: CompareEntry) => r.gpu.performanceScore },
                  ].map((row) => {
                    let bestVal = -Infinity
                    if (row.compare) {
                      bestVal = Math.max(...results.map(row.compare))
                    }
                    return (
                      <tr key={row.label} className="border-b border-border/50">
                        <td className="py-2.5 pr-4 font-medium text-text-secondary">{row.label}</td>
                        {results.map((r, i) => {
                          const val = row.getValue(r)
                          const isBest = row.compare && row.compare(r) === bestVal && results.length > 1
                          return (
                            <td
                              key={i}
                              className={`py-2.5 px-4 ${isBest ? 'font-semibold text-green' : 'text-text-primary'}`}
                            >
                              {val}
                              {isBest && <span className="ml-1 text-xs text-green">*</span>}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-text-muted">
              <span className="text-green">*</span> indicates best value in category
            </p>
          </div>

          {results[0]?.fpsEstimate && (
            <>
              <div className="rounded-xl border border-border bg-bg-card p-6">
                <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
                  <BarChart3 className="h-5 w-5 text-yellow" />
                  FPS Comparison by Quality (Ultra)
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getFpsBarData()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                    <XAxis dataKey="resolution" tick={{ fill: '#8888a8' }} />
                    <YAxis tick={{ fill: '#8888a8' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ color: '#8888a8' }} />
                    {results.map((r, i) => (
                      <Bar
                        key={r.profile.id}
                        dataKey={`${r.profile.name} - Ultra`}
                        fill={colors[i]}
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                {resolutions.map((res) => {
                  const key = res === '1080p' ? 'resolution1080p' : res === '1440p' ? 'resolution1440p' : 'resolution4k'
                  const resLabel = res === '1080p' ? '1080p' : res === '1440p' ? '1440p' : '4K'
                  return (
                    <div key={res} className="rounded-xl border border-border bg-bg-card p-5">
                      <h3 className="mb-3 text-center text-lg font-semibold text-text-primary">{resLabel}</h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={getFpsByQualityData(key)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                          <XAxis dataKey="quality" tick={{ fill: '#8888a8', fontSize: 11 }} />
                          <YAxis tick={{ fill: '#8888a8', fontSize: 11 }} />
                          <Tooltip content={<CustomTooltip />} />
                          {results.map((r, i) => (
                            <Bar key={r.profile.id} dataKey={r.profile.name} fill={colors[i]} radius={[3, 3, 0, 0]} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )
                })}
              </div>

              <div className="rounded-xl border border-border bg-bg-card p-6">
                <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
                  <Trophy className="h-5 w-5 text-orange" />
                  Overall Comparison
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="pb-3 pr-4 text-left text-text-muted">Metric</th>
                        {results.map((r, i) => (
                          <th key={i} className="pb-3 px-4 text-left" style={{ color: colors[i] }}>
                            {r.profile.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border/50">
                        <td className="py-2.5 pr-4 text-text-secondary">Meets Min Requirements</td>
                        {results.map((r, i) => (
                          <td key={i} className={`py-2.5 px-4 font-medium ${r.fpsEstimate?.meetsMinRequirements ? 'text-green' : 'text-red'}`}>
                            {r.fpsEstimate?.meetsMinRequirements ? 'Yes' : 'No'}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2.5 pr-4 text-text-secondary">Meets Recommended</td>
                        {results.map((r, i) => (
                          <td key={i} className={`py-2.5 px-4 font-medium ${r.fpsEstimate?.meetsRecRequirements ? 'text-green' : 'text-red'}`}>
                            {r.fpsEstimate?.meetsRecRequirements ? 'Yes' : 'No'}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2.5 pr-4 text-text-secondary">1080p Ultra FPS</td>
                        {results.map((r, i) => {
                          const fps = r.fpsEstimate?.resolution1080p.ultra ?? 0
                          const label = getScoreLabel(fps)
                          return (
                            <td key={i} className="py-2.5 px-4">
                              <span className="font-semibold text-text-primary">{fps}</span>
                              <span className={`ml-2 text-xs ${label.color}`}>({label.text})</span>
                            </td>
                          )
                        })}
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2.5 pr-4 text-text-secondary">Bottleneck</td>
                        {results.map((r, i) => (
                          <td key={i} className="py-2.5 px-4 text-text-primary">
                            {r.fpsEstimate?.bottleneckAnalysis.bottleneckComponent ?? '-'} ({r.fpsEstimate?.bottleneckAnalysis.bottleneckPercent ?? 0}%)
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-2.5 pr-4 text-text-secondary">Recommended Settings</td>
                        {results.map((r, i) => (
                          <td key={i} className="py-2.5 px-4 text-text-primary">
                            {r.fpsEstimate?.recommendedSettings.resolution} {r.fpsEstimate?.recommendedSettings.quality} @ {r.fpsEstimate?.recommendedSettings.estimatedFps} FPS
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-bg-card p-6">
                <h2 className="mb-4 text-xl font-bold">Score Radar</h2>
                <ResponsiveContainer width="100%" height={350}>
                  <RadarChart data={radarFields.map((f) => ({ field: f, label: radarLabels[f], ...Object.fromEntries(results.map((r, i) => [r.profile.name, getRadarData()[i][f]])) }))}>
                    <PolarGrid stroke="#2a2a4a" />
                    <PolarAngleAxis dataKey="label" tick={{ fill: '#8888a8', fontSize: 11 }} />
                    <PolarRadiusAxis tick={{ fill: '#5a5a7a', fontSize: 10 }} />
                    {results.map((r, i) => (
                      <Radar key={r.profile.id} name={r.profile.name} dataKey={r.profile.name} stroke={colors[i]} fill={colors[i]} fillOpacity={0.15} />
                    ))}
                    <Legend wrapperStyle={{ color: '#8888a8' }} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {results.map((r, i) => (
                <div key={i} className="rounded-xl border border-border bg-bg-card">
                  <button
                    onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                    className="flex w-full items-center justify-between p-5 text-left"
                  >
                    <div>
                      <h3 className="font-semibold" style={{ color: colors[i] }}>{r.profile.name}</h3>
                      <p className="text-sm text-text-muted">
                        {r.fpsEstimate?.recommendedSettings.description}
                      </p>
                    </div>
                    {expandedIdx === i ? (
                      <ChevronUp className="h-5 w-5 text-text-muted" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-text-muted" />
                    )}
                  </button>
                  {expandedIdx === i && r.fpsEstimate && (
                    <div className="border-t border-border p-5 animate-fadeIn">
                      <div className="grid gap-6 md:grid-cols-3">
                        {(['resolution1080p', 'resolution1440p', 'resolution4k'] as const).map((rk) => {
                          const label = rk === 'resolution1080p' ? '1080p' : rk === 'resolution1440p' ? '1440p' : '4K'
                          const fps = r.fpsEstimate![rk]
                          return (
                            <div key={rk}>
                              <h4 className="mb-2 text-sm font-medium text-text-secondary">{label}</h4>
                              <div className="space-y-1.5">
                                {qualities.map((q) => (
                                  <div key={q} className="flex items-center gap-2">
                                    <span className="w-12 text-xs capitalize text-text-muted">{q}</span>
                                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-input">
                                      <div
                                        className="fps-bar h-full rounded-full"
                                        style={{
                                          width: `${Math.min(100, (fps[q] / 120) * 100)}%`,
                                          backgroundColor: fps[q] >= 60 ? '#4ade80' : fps[q] >= 30 ? '#facc15' : '#f87171',
                                        }}
                                      />
                                    </div>
                                    <span className="w-10 text-right text-xs font-medium text-text-primary">{fps[q]}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div className="mt-4 rounded-lg bg-bg-primary p-3 text-sm text-text-secondary">
                        {r.fpsEstimate!.bottleneckAnalysis.description}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {!results[0]?.fpsEstimate && (
            <div className="rounded-xl border border-border bg-bg-card p-6 text-center">
              <BarChart3 className="mx-auto mb-3 h-10 w-10 text-text-muted" />
              <p className="text-text-secondary">
                Select a game to see FPS comparison charts
              </p>
            </div>
          )}
        </div>
      )}

      {!loading && results.length === 0 && !error && (
        <div className="rounded-xl border border-border bg-bg-card p-12 text-center">
          <GitCompare className="mx-auto mb-4 h-12 w-12 text-text-muted" />
          <p className="text-text-secondary">
            Select 2-4 profiles and click Compare to see results
          </p>
        </div>
      )}
    </div>
  )
}
