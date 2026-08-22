'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  TrendingUp, Cpu, ArrowRight, LogIn, Loader2, Zap, AlertTriangle, DollarSign,
} from 'lucide-react';

interface UserPC {
  id: string; name: string; isDefault: boolean; cpuId: string; cpuModel: string;
  gpuId: string; gpuModel: string; gpuVram: number; ramTotalGB: number;
  ramType: string; storageType: string; storageCapacityGB: number;
}

interface BottleneckResult {
  cpuScore: number; gpuScore: number; ramScore: number;
  bottleneckPercent: number; bottleneckComponent: string; description: string;
}

interface UpgradeSuggestion {
  component: string; current: string; recommended: string; reason: string; impact: string;
}

const costTiers = [
  { component: 'GPU', budget: 'GTX 1650 / RX 6500 XT', mid: 'RTX 4060 / RX 7600', premium: 'RTX 4080 / RX 7900 XT' },
  { component: 'CPU', budget: 'Ryzen 5 5600 / i5-12400', mid: 'Ryzen 7 7700X / i7-13700K', premium: 'Ryzen 9 7950X / i9-14900K' },
  { component: 'RAM', budget: '16GB DDR4 3200', mid: '32GB DDR5 5600', premium: '64GB DDR5 6000' },
];

function getTierForScore(score: number): string {
  if (score >= 85) return 'High-End';
  if (score >= 65) return 'Upper Mid-Range';
  if (score >= 45) return 'Mid-Range';
  if (score >= 30) return 'Budget';
  return 'Entry-Level';
}

function getCostTier(score: number): { label: string; color: string } {
  if (score >= 75) return { label: 'Premium', color: 'text-purple' };
  if (score >= 50) return { label: 'Mid-range', color: 'text-blue' };
  return { label: 'Budget', color: 'text-green' };
}

function getImpactColor(impact: string) {
  if (impact === 'high') return 'border-red/30 bg-red/5';
  if (impact === 'medium') return 'border-yellow/30 bg-yellow/5';
  return 'border-border bg-bg-secondary';
}

function getImpactBadge(impact: string) {
  if (impact === 'high') return 'bg-red/20 text-red';
  if (impact === 'medium') return 'bg-yellow/20 text-yellow';
  return 'bg-text-muted/20 text-text-muted';
}

export default function UpgradePage() {
  const { data: session, status } = useSession();
  const [pcs, setPcs] = useState<UserPC[]>([]);
  const [selectedPC, setSelectedPC] = useState<UserPC | null>(null);
  const [bottleneck, setBottleneck] = useState<BottleneckResult | null>(null);
  const [suggestions, setSuggestions] = useState<UpgradeSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const isAuth = status === 'authenticated';

  useEffect(() => {
    if (!isAuth) return;
    fetch('/api/user-pcs').then(r => r.json()).then(d => {
      if (Array.isArray(d)) {
        setPcs(d);
        const def = d.find((pc: UserPC) => pc.isDefault);
        if (def) setSelectedPC(def);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [isAuth]);

  useEffect(() => {
    if (!selectedPC) return;
    let cancelled = false;
    const controller = new AbortController();
    fetch('/api/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpuId: selectedPC.cpuId, gpuId: selectedPC.gpuId, ramGB: selectedPC.ramTotalGB, gameId: 'cyberpunk-2077' }),
      signal: controller.signal,
    }).then(r => r.json()).then(data => {
      if (cancelled) return;
      if (data.bottleneckAnalysis) setBottleneck(data.bottleneckAnalysis);
      if (data.upgradeSuggestions) setSuggestions(data.upgradeSuggestions);
    }).catch(() => {}).finally(() => { if (!cancelled) setAnalyzing(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [selectedPC]);

  if (status === 'loading' || (loading && isAuth)) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
  }

  if (!session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center">
          <TrendingUp className="mx-auto mb-4 h-16 w-16 text-text-muted/30" />
          <h1 className="mb-2 text-2xl font-bold">Upgrade Recommendations</h1>
          <p className="mb-6 text-text-secondary">Sign in to analyze your PC and get upgrade suggestions.</p>
          <Link href="/auth/signin" className="btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3 font-semibold text-white"><LogIn className="h-5 w-5" /> Sign In</Link>
        </div>
      </div>
    );
  }

  const avgScore = bottleneck ? Math.round((bottleneck.cpuScore + bottleneck.gpuScore + bottleneck.ramScore) / 3) : 0;
  const tier = getTierForScore(avgScore);
  const costTier = getCostTier(avgScore);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold">Upgrade Recommendations</h1>
      <p className="mb-8 text-text-secondary">Analyze bottlenecks and find the best upgrades for your PC.</p>

      <div className="mb-8 rounded-xl border border-border bg-bg-card p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><Cpu className="h-5 w-5 text-accent" /> Select PC</h2>
        {pcs.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-text-muted mb-3">No saved PCs found.</p>
            <Link href="/my-pc" className="text-sm text-accent hover:underline">Create a PC profile first</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pcs.map(pc => (
              <button key={pc.id} onClick={() => { setAnalyzing(true); setSelectedPC(pc); }} className={`rounded-lg border p-4 text-left transition-all ${selectedPC?.id === pc.id ? 'border-accent bg-accent/10' : 'border-border hover:border-border-active'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-text-primary">{pc.name}</span>
                  {pc.isDefault && <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] text-accent">Default</span>}
                </div>
                <p className="mt-1 text-xs text-text-muted">{pc.cpuModel} | {pc.gpuModel} | {pc.ramTotalGB}GB</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedPC && (
        <div className="space-y-6 animate-fadeIn">
          {analyzing ? (
            <div className="rounded-xl border border-border bg-bg-card p-8 text-center">
              <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-accent" />
              <p className="text-text-secondary">Analyzing your hardware...</p>
            </div>
          ) : bottleneck && (
            <>
              <div className="rounded-xl border border-border bg-bg-card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold">Performance Overview</h2>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold ${costTier.color}`}>{costTier.label} Upgrade</span>
                    <span className="rounded-full border border-border px-3 py-1 text-xs font-bold text-text-primary">{tier}</span>
                  </div>
                </div>

                <div className="mb-6 grid grid-cols-3 gap-4">
                  {[
                    { label: 'CPU', score: bottleneck.cpuScore },
                    { label: 'GPU', score: bottleneck.gpuScore },
                    { label: 'RAM', score: bottleneck.ramScore },
                  ].map(s => (
                    <div key={s.label} className="text-center">
                      <p className="mb-1 text-xs font-medium text-text-muted">{s.label} Score</p>
                      <p className="text-3xl font-black text-text-primary">{s.score}</p>
                      <div className="mx-auto mt-2 h-2 w-full overflow-hidden rounded-full bg-bg-primary">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, s.score)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                {bottleneck.bottleneckComponent !== 'Balanced' && (
                  <div className="rounded-lg border border-yellow/30 bg-yellow/5 p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow" />
                      <div>
                        <p className="text-sm font-medium text-yellow">Bottleneck: {bottleneck.bottleneckComponent}</p>
                        <p className="mt-1 text-xs text-text-secondary">{bottleneck.description}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border bg-bg-card p-6">
                <h2 className="mb-4 text-lg font-bold">Component Analysis</h2>
                <div className="space-y-3">
                  <div className="rounded-lg border border-border bg-bg-secondary p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-text-primary">CPU: {selectedPC.cpuModel}</p>
                        <p className="text-xs text-text-muted">Score: {bottleneck.cpuScore}/100 | {getTierForScore(bottleneck.cpuScore)}</p>
                      </div>
                      <div className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getImpactBadge(bottleneck.bottleneckComponent === 'CPU' ? 'high' : 'low')}`}>
                        {bottleneck.bottleneckComponent === 'CPU' ? 'Bottleneck' : 'OK'}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-bg-secondary p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-text-primary">GPU: {selectedPC.gpuModel} ({selectedPC.gpuVram}GB)</p>
                        <p className="text-xs text-text-muted">Score: {bottleneck.gpuScore}/100 | {getTierForScore(bottleneck.gpuScore)}</p>
                      </div>
                      <div className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getImpactBadge(bottleneck.bottleneckComponent === 'GPU' ? 'high' : 'low')}`}>
                        {bottleneck.bottleneckComponent === 'GPU' ? 'Bottleneck' : 'OK'}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-bg-secondary p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-text-primary">RAM: {selectedPC.ramTotalGB}GB {selectedPC.ramType}</p>
                        <p className="text-xs text-text-muted">Score: {bottleneck.ramScore}/100</p>
                      </div>
                      <div className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getImpactBadge(bottleneck.bottleneckComponent === 'RAM' ? 'high' : 'low')}`}>
                        {bottleneck.bottleneckComponent === 'RAM' ? 'Bottleneck' : 'OK'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {suggestions.length > 0 && (
                <div className="rounded-xl border border-border bg-bg-card p-6">
                  <h2 className="mb-4 text-lg font-bold">Upgrade Priority</h2>
                  <div className="space-y-3">
                    {suggestions.map((s, i) => (
                      <div key={i} className={`rounded-lg border p-4 ${getImpactColor(s.impact)}`}>
                        <div className="flex items-start gap-3">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">{i + 1}</div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-text-primary">{s.component}</p>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getImpactBadge(s.impact)}`}>{s.impact} impact</span>
                            </div>
                            <p className="mt-1 text-sm text-text-secondary">{s.reason}</p>
                            <div className="mt-2 flex items-center gap-2 text-xs text-text-muted">
                              <span>{s.current}</span>
                              <ArrowRight className="h-3 w-3 text-accent" />
                              <span className="font-medium text-accent">{s.recommended}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-accent/30 bg-accent/5 p-6">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Zap className="h-5 w-5 text-accent" /> Best Upgrade for Your Money</h2>
                <p className="text-sm text-text-secondary">
                  {bottleneck.bottleneckComponent === 'GPU'
                    ? 'Upgrading your GPU will give you the biggest performance boost. Consider an RTX 4060 or RX 7600 for excellent 1080p performance at a reasonable price.'
                    : bottleneck.bottleneckComponent === 'CPU'
                      ? 'Your CPU is holding back your GPU. A Ryzen 5 7600 or i5-13600K would be a great mid-range upgrade.'
                      : bottleneck.bottleneckComponent === 'RAM'
                        ? 'Adding more RAM is the most cost-effective upgrade. Going from 8GB to 16GB or 32GB can significantly improve performance in modern games.'
                        : 'Your system is well-balanced. Consider upgrading the GPU first for the most noticeable improvement.'}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-bg-card p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><DollarSign className="h-5 w-5 text-text-muted" /> Estimated Upgrade Tiers</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {costTiers.map(ct => (
                    <div key={ct.component} className="rounded-lg border border-border bg-bg-secondary p-4">
                      <h3 className="mb-2 text-sm font-bold text-text-primary">{ct.component}</h3>
                      <div className="space-y-1.5 text-xs text-text-secondary">
                        <p><span className="text-green">Budget:</span> {ct.budget}</p>
                        <p><span className="text-blue">Mid:</span> {ct.mid}</p>
                        <p><span className="text-purple">Premium:</span> {ct.premium}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-text-muted">
                Upgrade recommendations are based on relative performance scoring and general pricing tiers.
                Actual prices vary by region and availability. Check current pricing before making purchase decisions.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
