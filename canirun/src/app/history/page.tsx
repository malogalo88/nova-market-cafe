'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  History,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  BarChart3,
  Clock,
  Gamepad2,
} from 'lucide-react'
import type { AnalysisHistoryEntry } from '@/types'

export default function HistoryPage() {
  const [entries, setEntries] = useState<AnalysisHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/history?limit=50')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load history')
        return r.json()
      })
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load history'))
      .finally(() => setLoading(false))
  }, [])

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }, [])

  const formatDate = (d: string) => {
    try {
      const date = new Date(d)
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch { return d }
  }

  const formatTime = (d: string) => {
    try {
      const date = new Date(d)
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    } catch { return '' }
  }

  const formatRelative = (d: string) => {
    try {
      const date = new Date(d)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMin = Math.floor(diffMs / 60000)
      if (diffMin < 1) return 'Just now'
      if (diffMin < 60) return `${diffMin}m ago`
      const diffH = Math.floor(diffMin / 60)
      if (diffH < 24) return `${diffH}h ago`
      const diffD = Math.floor(diffH / 24)
      if (diffD < 7) return `${diffD}d ago`
      return formatDate(d)
    } catch { return d }
  }

  const qualities = ['low', 'medium', 'high', 'ultra'] as const

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-20 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-red-dim/20">
          <XCircle className="h-10 w-10 text-red" />
        </div>
        <h1 className="mb-3 text-3xl font-bold">Error</h1>
        <p className="text-red">{error}</p>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-20 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-bg-card">
          <History className="h-10 w-10 text-accent" />
        </div>
        <h1 className="mb-3 text-3xl font-bold">Analysis History</h1>
        <p className="mb-8 text-text-secondary">
          No analyses yet. Run your first FPS estimate to see results here.
        </p>
        <Link
          href="/estimate"
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 font-semibold text-white transition-all hover:bg-accent/90"
        >
          <BarChart3 className="h-4 w-4" />
          Run an Estimate
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-center gap-3">
        <History className="h-8 w-8 text-cyan" />
        <div>
          <h1 className="text-3xl font-bold">Analysis History</h1>
          <p className="text-text-secondary">{entries.length} past analyses</p>
        </div>
      </div>

      <div className="space-y-3">
        {entries.map((entry) => {
          const isExpanded = expandedId === entry.id
          const fps1080 = entry.results?.resolution1080p?.ultra ?? 0
          const meetsMin = entry.results?.meetsMinRequirements ?? false
          const meetsRec = entry.results?.meetsRecRequirements ?? false

          return (
            <div key={entry.id} className="rounded-xl border border-border bg-bg-card transition-all hover:border-border-active">
              <button
                onClick={() => toggleExpand(entry.id)}
                className="flex w-full items-center justify-between p-5 text-left"
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bg-primary">
                    <Gamepad2 className="h-5 w-5 text-green" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-text-primary truncate">{entry.gameTitle}</h3>
                      <span className="text-xs text-text-muted">via</span>
                      <span className="text-xs font-medium text-accent">{entry.profileName}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 flex-wrap text-xs text-text-muted">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelative(entry.createdAt)}
                      </span>
                      <span className={`flex items-center gap-1 ${meetsMin ? 'text-green' : 'text-red'}`}>
                        {meetsMin ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {meetsMin ? 'Meets Min' : 'Below Min'}
                      </span>
                      <span className={`flex items-center gap-1 ${meetsRec ? 'text-green' : 'text-yellow'}`}>
                        {meetsRec ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {meetsRec ? 'Meets Rec' : 'Below Rec'}
                      </span>
                      <span className="font-medium text-text-primary">
                        1080p Ultra: {fps1080} FPS
                      </span>
                    </div>
                  </div>
                </div>
                <div className="ml-4 shrink-0">
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-text-muted" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-text-muted" />
                  )}
                </div>
              </button>

              {isExpanded && entry.results && (
                <div className="border-t border-border p-5 animate-fadeIn">
                  <div className="mb-5 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-lg bg-bg-primary p-4">
                      <p className="text-xs font-medium text-text-muted mb-1">Created</p>
                      <p className="text-sm text-text-primary">{formatDate(entry.createdAt)} at {formatTime(entry.createdAt)}</p>
                    </div>
                    <div className="rounded-lg bg-bg-primary p-4">
                      <p className="text-xs font-medium text-text-muted mb-1">Profile</p>
                      <p className="text-sm text-text-primary">{entry.profileName}</p>
                    </div>
                    <div className="rounded-lg bg-bg-primary p-4">
                      <p className="text-xs font-medium text-text-muted mb-1">Requirements</p>
                      <div className="flex gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${meetsMin ? 'bg-green-dim/30 text-green' : 'bg-red-dim/30 text-red'}`}>
                          Min: {meetsMin ? 'PASS' : 'FAIL'}
                        </span>
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${meetsRec ? 'bg-green-dim/30 text-green' : 'bg-yellow-dim/30 text-yellow'}`}>
                          Rec: {meetsRec ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <h4 className="mb-3 font-semibold text-text-primary">FPS Estimates</h4>
                  <div className="grid gap-4 md:grid-cols-3 mb-6">
                    {([
                      { key: 'resolution1080p' as const, label: '1080p' },
                      { key: 'resolution1440p' as const, label: '1440p' },
                      { key: 'resolution4k' as const, label: '4K' },
                    ]).map(({ key, label }) => {
                      const res = entry.results[key]
                      return (
                        <div key={key} className="rounded-lg bg-bg-primary p-4">
                          <h5 className="mb-2 text-sm font-medium text-text-secondary">{label}</h5>
                          <div className="space-y-1.5">
                            {qualities.map((q) => {
                              const fps = res[q]
                              return (
                                <div key={q} className="flex items-center gap-2">
                                  <span className="w-12 text-xs capitalize text-text-muted">{q}</span>
                                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-input">
                                    <div
                                      className="fps-bar h-full rounded-full"
                                      style={{
                                        width: `${Math.min(100, (fps / 120) * 100)}%`,
                                        backgroundColor: fps >= 60 ? '#4ade80' : fps >= 30 ? '#facc15' : '#f87171',
                                      }}
                                    />
                                  </div>
                                  <span className="w-10 text-right text-xs font-medium text-text-primary">{fps}</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="rounded-lg bg-bg-primary p-4 mb-4">
                    <h4 className="mb-2 font-semibold text-text-primary">Bottleneck Analysis</h4>
                    <div className="grid gap-3 sm:grid-cols-3 mb-3">
                      <div>
                        <p className="text-xs text-text-muted">CPU Score</p>
                        <p className="text-sm font-medium text-text-primary">{entry.results.bottleneckAnalysis.cpuScore}</p>
                      </div>
                      <div>
                        <p className="text-xs text-text-muted">GPU Score</p>
                        <p className="text-sm font-medium text-text-primary">{entry.results.bottleneckAnalysis.gpuScore}</p>
                      </div>
                      <div>
                        <p className="text-xs text-text-muted">RAM Score</p>
                        <p className="text-sm font-medium text-text-primary">{entry.results.bottleneckAnalysis.ramScore}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm text-text-secondary">Bottleneck:</span>
                      <span className="rounded bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                        {entry.results.bottleneckAnalysis.bottleneckComponent} ({entry.results.bottleneckAnalysis.bottleneckPercent}%)
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary">{entry.results.bottleneckAnalysis.description}</p>
                  </div>

                  <div className="rounded-lg bg-accent/10 border border-accent/20 p-4">
                    <h4 className="mb-1 font-semibold text-accent">Recommended Settings</h4>
                    <p className="text-sm text-text-primary">
                      {entry.results.recommendedSettings.resolution} • {entry.results.recommendedSettings.quality} quality • ~{entry.results.recommendedSettings.estimatedFps} FPS
                    </p>
                    <p className="mt-1 text-sm text-text-secondary">{entry.results.recommendedSettings.description}</p>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
