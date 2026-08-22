'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  Search, Cpu, Monitor, HardDrive, Zap, Check, X, AlertTriangle,
  Loader2, ArrowRight, Gamepad2, Settings, Save, Heart,
} from 'lucide-react';

interface Game {
  id: string;
  title: string;
  genre: string;
  tags: string[];
  developer: string;
}

interface CpuOption {
  id: string;
  name: string;
  performanceScore: number;
}

interface GpuOption {
  id: string;
  name: string;
  performanceScore: number;
  vram: number;
}

interface UserPC {
  id: string;
  name: string;
  isDefault: boolean;
  cpuId: string;
  cpuModel: string;
  gpuId: string;
  gpuModel: string;
  gpuVram: number;
  ramTotalGB: number;
}

interface FpsQualitySet {
  veryLow: number;
  low: number;
  medium: number;
  high: number;
  ultra: number;
  rayTracingLow: number;
  rayTracingMedium: number;
  rayTracingHigh: number;
  dlssUltra: number;
  dlssQuality: number;
  fsrUltra: number;
  fsrQuality: number;
  low1Percent: number;
}

interface EstimateResult {
  resolution720p: FpsQualitySet;
  resolution900p: FpsQualitySet;
  resolution1080p: FpsQualitySet;
  resolution1440p: FpsQualitySet;
  resolution4k: FpsQualitySet;
  meetsMinRequirements: boolean;
  meetsRecRequirements: boolean;
  bottleneckAnalysis: {
    cpuScore: number;
    gpuScore: number;
    ramScore: number;
    bottleneckPercent: number;
    bottleneckComponent: string;
    description: string;
  };
  recommendedSettings: {
    resolution: string;
    quality: string;
    estimatedFps: number;
    description: string;
  };
  upgradeSuggestions: Array<{
    component: string;
    current: string;
    recommended: string;
    reason: string;
    impact: string;
  }>;
  performanceTier: string;
}

const resolutions = ['720p', '900p', '1080p', '1440p', '4K'] as const;
const qualities = ['Very Low', 'Low', 'Medium', 'High', 'Ultra'] as const;
const upscalingOptions = ['Off', 'FSR Quality', 'FSR Ultra', 'DLSS Quality', 'DLSS Ultra'] as const;
const rayTracingOptions = ['Off', 'Low', 'Medium', 'High'] as const;

const upscaleMultipliers: Record<string, number> = {
  'Off': 1.0,
  'FSR Quality': 1.2,
  'FSR Ultra': 1.35,
  'DLSS Quality': 1.25,
  'DLSS Ultra': 1.4,
};

const rtMultipliers: Record<string, number> = {
  'Off': 1.0,
  'Low': 0.85,
  'Medium': 0.7,
  'High': 0.55,
};

function getResKey(res: string) {
  const map: Record<string, string> = {
    '720p': 'resolution720p', '900p': 'resolution900p',
    '1080p': 'resolution1080p', '1440p': 'resolution1440p', '4K': 'resolution4k',
  };
  return map[res];
}

function getQualKey(q: string): keyof FpsQualitySet | null {
  const map: Record<string, keyof FpsQualitySet> = {
    'Very Low': 'veryLow', 'Low': 'low', 'Medium': 'medium', 'High': 'high', 'Ultra': 'ultra',
  };
  return map[q] || null;
}

function getFps(result: EstimateResult, res: string, qual: string, upscaling: string, rt: string): number {
  const resKey = getResKey(res);
  const qualKey = getQualKey(qual);
  if (!resKey || !qualKey) return 0;
  const fpsSet = (result as unknown as Record<string, FpsQualitySet>)[resKey];
  if (!fpsSet) return 0;
  let base = fpsSet[qualKey] || 0;
  base = Math.round(base * rtMultipliers[rt]);
  base = Math.round(base * upscaleMultipliers[upscaling]);
  return Math.max(1, base);
}

function getFpsColor(fps: number): string {
  if (fps >= 60) return 'text-green';
  if (fps >= 45) return 'text-yellow';
  if (fps >= 30) return 'text-orange';
  return 'text-red';
}

function getTierBadge(tier: string) {
  switch (tier) {
    case 'excellent': return { label: 'Excellent', color: 'bg-green/20 text-green border-green/30' };
    case 'good': return { label: 'Good', color: 'bg-blue/20 text-blue border-blue/30' };
    case 'playable': return { label: 'Playable', color: 'bg-yellow/20 text-yellow border-yellow/30' };
    case 'poor': return { label: 'Poor', color: 'bg-orange/20 text-orange border-orange/30' };
    default: return { label: 'Not Recommended', color: 'bg-red/20 text-red border-red/30' };
  }
}

export default function RunPage() {
  const { data: session } = useSession();
  const [games, setGames] = useState<Game[]>([]);
  const [userPCs, setUserPCs] = useState<UserPC[]>([]);
  const [cpus, setCpus] = useState<CpuOption[]>([]);
  const [gpus, setGpus] = useState<GpuOption[]>([]);

  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [gameSearch, setGameSearch] = useState('');
  const [showGameDropdown, setShowGameDropdown] = useState(false);

  const [selectedPC, setSelectedPC] = useState<UserPC | null>(null);
  const [useManual, setUseManual] = useState(false);
  const [manualCpuId, setManualCpuId] = useState('');
  const [manualGpuId, setManualGpuId] = useState('');
  const [manualRam, setManualRam] = useState(16);
  const [cpuSearch, setCpuSearch] = useState('');
  const [gpuSearch, setGpuSearch] = useState('');
  const [showCpuDropdown, setShowCpuDropdown] = useState(false);
  const [showGpuDropdown, setShowGpuDropdown] = useState(false);

  const [resolution, setResolution] = useState<string>('1080p');
  const [quality, setQuality] = useState<string>('Medium');
  const [upscaling, setUpscaling] = useState<string>('Off');
  const [rayTracing, setRayTracing] = useState<string>('Off');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [favoriting, setFavoriting] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [favMsg, setFavMsg] = useState('');

  useEffect(() => {
    fetch('/api/games').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setGames(d);
    }).catch(() => {});
    fetch('/api/hardware?type=cpu').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setCpus(d);
    }).catch(() => {});
    fetch('/api/hardware?type=gpu').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setGpus(d);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      fetch('/api/user-pcs').then(r => r.json()).then(d => {
        if (Array.isArray(d)) {
          setUserPCs(d);
          const def = d.find((pc: UserPC) => pc.isDefault);
          if (def) setSelectedPC(def);
        }
      }).catch(() => {});
    }
  }, [session]);

  const filteredGames = games.filter(g =>
    g.title.toLowerCase().includes(gameSearch.toLowerCase()) ||
    g.genre.toLowerCase().includes(gameSearch.toLowerCase()) ||
    g.tags.some(t => t.toLowerCase().includes(gameSearch.toLowerCase()))
  );

  const filteredCpus = cpus.filter(c =>
    c.name.toLowerCase().includes(cpuSearch.toLowerCase())
  );

  const filteredGpus = gpus.filter(g =>
    g.name.toLowerCase().includes(gpuSearch.toLowerCase())
  );

  const handleCheck = useCallback(async () => {
    if (!selectedGame) return;
    const cpuId = useManual ? manualCpuId : selectedPC?.cpuId;
    const gpuId = useManual ? manualGpuId : selectedPC?.gpuId;
    const ramGB = useManual ? manualRam : selectedPC?.ramTotalGB;

    if (!cpuId || !gpuId || !ramGB) return;

    setLoading(true);
    setResult(null);
    setSavedMsg('');
    setFavMsg('');

    try {
      const res = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpuId, gpuId, ramGB, gameId: selectedGame.id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [selectedGame, useManual, manualCpuId, manualGpuId, manualRam, selectedPC]);

  const handleSaveHistory = async () => {
    if (!result || !selectedGame) return;
    setSaving(true);
    try {
      await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pcId: selectedPC?.id || '',
          gameId: selectedGame.id,
          gameTitle: selectedGame.title,
          results: result,
          settingsUsed: { resolution, quality, upscaling, rayTracing },
        }),
      });
      setSavedMsg('Saved to history!');
      setTimeout(() => setSavedMsg(''), 3000);
    } catch {
      setSavedMsg('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleAddFavorite = async () => {
    if (!selectedGame) return;
    setFavoriting(true);
    try {
      await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: selectedGame.id }),
      });
      setFavMsg('Added to favorites!');
      setTimeout(() => setFavMsg(''), 3000);
    } catch {
      setFavMsg('Failed to add');
    } finally {
      setFavoriting(false);
    }
  };

  const fps = result ? getFps(result, resolution, quality, upscaling, rayTracing) : 0;
  const tier = result ? getTierBadge(result.performanceTier) : null;

  const componentStatus = (userScore: number, minScore: number, recScore: number) => {
    if (userScore >= recScore) return { icon: Check, color: 'text-green', label: 'Meets Recommended' };
    if (userScore >= minScore) return { icon: AlertTriangle, color: 'text-yellow', label: 'Meets Minimum' };
    return { icon: X, color: 'text-red', label: 'Below Minimum' };
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <section className="hero-gradient relative overflow-hidden px-6 py-16 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(108,99,255,0.1)_0%,transparent_70%)]" />
        <div className="relative mx-auto max-w-4xl">
          <h1 className="mb-4 text-5xl font-bold tracking-tight md:text-6xl">
            Can I <span className="text-accent">Run It</span>?
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-text-secondary">
            Select your game and PC to get instant performance estimates with detailed breakdowns.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-1">
            <div className="rounded-xl border border-border bg-bg-card p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                <Gamepad2 className="h-5 w-5 text-accent" />
                Select Game
              </h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search games..."
                  value={selectedGame ? selectedGame.title : gameSearch}
                  onChange={e => {
                    setGameSearch(e.target.value);
                    setSelectedGame(null);
                    setShowGameDropdown(true);
                  }}
                  onFocus={() => setShowGameDropdown(true)}
                  className="w-full rounded-lg border border-border bg-bg-input py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder-text-muted outline-none transition-colors focus:border-accent"
                />
                {showGameDropdown && !selectedGame && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-bg-card shadow-xl">
                    {filteredGames.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-text-muted">No games found</p>
                    ) : (
                      filteredGames.slice(0, 50).map(game => (
                        <button
                          key={game.id}
                          onClick={() => { setSelectedGame(game); setShowGameDropdown(false); setGameSearch(''); }}
                          className="flex w-full flex-col px-4 py-2.5 text-left hover:bg-bg-card-hover"
                        >
                          <span className="text-sm font-medium text-text-primary">{game.title}</span>
                          <span className="text-xs text-text-muted">{game.genre}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {selectedGame && (
                <div className="mt-3 rounded-lg border border-accent/30 bg-accent/5 p-3">
                  <p className="font-medium text-text-primary">{selectedGame.title}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] text-accent">{selectedGame.genre}</span>
                    {selectedGame.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="rounded bg-bg-primary px-1.5 py-0.5 text-[10px] text-text-muted">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-bg-card p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                <Cpu className="h-5 w-5 text-accent" />
                Select PC
              </h2>

              {session?.user?.id && userPCs.length > 0 && !useManual && (
                <div className="mb-4">
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary">Your Saved PCs</label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {userPCs.map(pc => (
                      <button
                        key={pc.id}
                        onClick={() => setSelectedPC(pc)}
                        className={`w-full rounded-lg border p-3 text-left transition-all ${
                          selectedPC?.id === pc.id
                            ? 'border-accent bg-accent/10'
                            : 'border-border hover:border-border-active'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-text-primary">{pc.name}</span>
                          {pc.isDefault && <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] text-accent">Default</span>}
                        </div>
                        <p className="mt-1 text-xs text-text-muted">
                          {pc.cpuModel} | {pc.gpuModel} | {pc.ramTotalGB}GB RAM
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => { setUseManual(!useManual); setSelectedPC(null); }}
                className="mb-4 w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-xs text-text-secondary hover:border-border-active hover:text-text-primary"
              >
                {useManual ? 'Use Saved PC' : 'Pick Hardware Manually'}
              </button>

              {useManual && (
                <div className="space-y-4">
                  <div className="relative">
                    <label className="mb-1 block text-xs font-medium text-text-secondary">CPU</label>
                    <input
                      type="text"
                      placeholder="Search CPU..."
                      value={cpuSearch}
                      onChange={e => { setCpuSearch(e.target.value); setShowCpuDropdown(true); }}
                      onFocus={() => setShowCpuDropdown(true)}
                      className="w-full rounded-lg border border-border bg-bg-input py-2 px-3 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent"
                    />
                    {showCpuDropdown && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-bg-card shadow-xl">
                        {filteredCpus.slice(0, 30).map(c => (
                          <button
                            key={c.id}
                            onClick={() => { setManualCpuId(c.id); setCpuSearch(c.name); setShowCpuDropdown(false); }}
                            className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-bg-card-hover"
                          >
                            <span className="text-text-primary">{c.name}</span>
                            <span className="text-xs text-text-muted">Score: {c.performanceScore}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <label className="mb-1 block text-xs font-medium text-text-secondary">GPU</label>
                    <input
                      type="text"
                      placeholder="Search GPU..."
                      value={gpuSearch}
                      onChange={e => { setGpuSearch(e.target.value); setShowGpuDropdown(true); }}
                      onFocus={() => setShowGpuDropdown(true)}
                      className="w-full rounded-lg border border-border bg-bg-input py-2 px-3 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent"
                    />
                    {showGpuDropdown && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-bg-card shadow-xl">
                        {filteredGpus.slice(0, 30).map(g => (
                          <button
                            key={g.id}
                            onClick={() => { setManualGpuId(g.id); setGpuSearch(g.name); setShowGpuDropdown(false); }}
                            className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-bg-card-hover"
                          >
                            <span className="text-text-primary">{g.name}</span>
                            <span className="text-xs text-text-muted">Score: {g.performanceScore} | {g.vram}GB VRAM</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-secondary">RAM (GB)</label>
                    <div className="flex gap-2">
                      {[8, 16, 32, 64].map(r => (
                        <button
                          key={r}
                          onClick={() => setManualRam(r)}
                          className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-all ${
                            manualRam === r
                              ? 'border-accent bg-accent/15 text-accent'
                              : 'border-border text-text-secondary hover:border-border-active'
                          }`}
                        >
                          {r}GB
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-bg-card p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                <Settings className="h-5 w-5 text-accent" />
                Settings
              </h2>

              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-medium text-text-secondary">Resolution</label>
                <div className="flex flex-wrap gap-2">
                  {resolutions.map(r => (
                    <button
                      key={r}
                      onClick={() => setResolution(r)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                        resolution === r
                          ? 'border-accent bg-accent/15 text-accent'
                          : 'border-border text-text-secondary hover:border-border-active'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-medium text-text-secondary">Quality</label>
                <div className="flex flex-wrap gap-2">
                  {qualities.map(q => (
                    <button
                      key={q}
                      onClick={() => setQuality(q)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                        quality === q
                          ? 'border-accent bg-accent/15 text-accent'
                          : 'border-border text-text-secondary hover:border-border-active'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-medium text-text-secondary">Upscaling</label>
                <div className="flex flex-wrap gap-2">
                  {upscalingOptions.map(u => (
                    <button
                      key={u}
                      onClick={() => setUpscaling(u)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                        upscaling === u
                          ? 'border-accent bg-accent/15 text-accent'
                          : 'border-border text-text-secondary hover:border-border-active'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="mb-1.5 block text-xs font-medium text-text-secondary">Ray Tracing</label>
                <div className="flex flex-wrap gap-2">
                  {rayTracingOptions.map(r => (
                    <button
                      key={r}
                      onClick={() => setRayTracing(r)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                        rayTracing === r
                          ? 'border-accent bg-accent/15 text-accent'
                          : 'border-border text-text-secondary hover:border-border-active'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleCheck}
                disabled={!selectedGame || (!useManual && !selectedPC) || (useManual && (!manualCpuId || !manualGpuId)) || loading}
                className="btn-primary w-full rounded-xl py-3.5 text-base font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Analyzing...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Zap className="h-5 w-5" />
                    CHECK NOW
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="lg:col-span-2">
            {!result && !loading && (
              <div className="flex min-h-[400px] items-center justify-center rounded-xl border border-dashed border-border">
                <div className="text-center">
                  <Monitor className="mx-auto mb-4 h-16 w-16 text-text-muted/30" />
                  <p className="text-lg text-text-muted">Select a game and PC, then click CHECK NOW</p>
                  <p className="mt-1 text-sm text-text-muted/60">Results will appear here</p>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex min-h-[400px] items-center justify-center rounded-xl border border-border bg-bg-card">
                <div className="text-center">
                  <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-accent" />
                  <p className="text-lg font-medium text-text-primary">Analyzing Performance...</p>
                  <p className="mt-1 text-sm text-text-secondary">Comparing your hardware against game requirements</p>
                </div>
              </div>
            )}

            {result && !loading && (
              <div className="space-y-6 animate-fadeIn">
                <div className={`rounded-2xl border-2 p-8 text-center ${
                  result.meetsRecRequirements
                    ? 'border-green/50 bg-green/5'
                    : result.meetsMinRequirements
                      ? 'border-yellow/50 bg-yellow/5'
                      : 'border-red/50 bg-red/5'
                }`}>
                  <h2 className="mb-2 text-3xl font-black uppercase tracking-tight">Can You Run It?</h2>
                  {result.meetsRecRequirements ? (
                    <div>
                      <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-green/20">
                        <Check className="h-10 w-10 text-green" />
                      </div>
                      <p className="text-2xl font-bold text-green">YES</p>
                      <p className="mt-1 text-sm text-text-secondary">Your PC meets recommended specifications</p>
                    </div>
                  ) : result.meetsMinRequirements ? (
                    <div>
                      <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-yellow/20">
                        <AlertTriangle className="h-10 w-10 text-yellow" />
                      </div>
                      <p className="text-2xl font-bold text-yellow">YES WITH COMPROMISES</p>
                      <p className="mt-1 text-sm text-text-secondary">Meets minimum but not recommended specs</p>
                    </div>
                  ) : (
                    <div>
                      <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-red/20">
                        <X className="h-10 w-10 text-red" />
                      </div>
                      <p className="text-2xl font-bold text-red">NO</p>
                      <p className="mt-1 text-sm text-text-secondary">Below minimum specifications</p>
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-center gap-4">
                    <span className={`rounded-full border px-4 py-1.5 text-sm font-bold ${tier?.color}`}>
                      {tier?.label}
                    </span>
                    <span className={`text-3xl font-black ${getFpsColor(fps)}`}>
                      ~{fps} FPS
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-text-muted">
                    {resolution} | {quality} | {upscaling !== 'Off' ? upscaling : 'No upscaling'} | RT: {rayTracing}
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-bg-card p-6">
                  <h3 className="mb-4 text-lg font-bold">Component Breakdown</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      {
                        label: 'CPU',
                        userScore: result.bottleneckAnalysis.cpuScore,
                        minScore: result.bottleneckAnalysis.cpuScore * (result.meetsMinRequirements ? 0.85 : 1.1),
                        recScore: result.bottleneckAnalysis.cpuScore * (result.meetsRecRequirements ? 0.9 : 1.05),
                      },
                      {
                        label: 'GPU',
                        userScore: result.bottleneckAnalysis.gpuScore,
                        minScore: result.bottleneckAnalysis.gpuScore * (result.meetsMinRequirements ? 0.85 : 1.1),
                        recScore: result.bottleneckAnalysis.gpuScore * (result.meetsRecRequirements ? 0.9 : 1.05),
                      },
                      {
                        label: 'RAM',
                        userScore: result.bottleneckAnalysis.ramScore,
                        minScore: 80,
                        recScore: 100,
                      },
                    ].map(comp => {
                      const status = componentStatus(comp.userScore, comp.minScore, comp.recScore);
                      const StatusIcon = status.icon;
                      return (
                        <div key={comp.label} className="rounded-lg border border-border bg-bg-secondary p-4">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-text-primary">{comp.label}</span>
                            <StatusIcon className={`h-5 w-5 ${status.color}`} />
                          </div>
                          <p className="mt-1 text-xs text-text-muted">{status.label}</p>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg-primary">
                            <div
                              className="h-full rounded-full bg-accent"
                              style={{ width: `${Math.min(100, (comp.userScore / 100) * 100)}%` }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-text-muted">Score: {comp.userScore}/100</p>
                        </div>
                      );
                    })}

                    <div className="rounded-lg border border-border bg-bg-secondary p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-text-primary">VRAM</span>
                        <HardDrive className={`h-5 w-5 ${fps >= 30 ? 'text-green' : 'text-red'}`} />
                      </div>
                      <p className="mt-1 text-xs text-text-muted">
                        {selectedPC ? `${selectedPC.gpuVram}GB` : useManual ? `${gpus.find(g => g.id === manualGpuId)?.vram || 0}GB` : 'N/A'}
                      </p>
                    </div>

                    <div className="rounded-lg border border-border bg-bg-secondary p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-text-primary">Storage</span>
                        <HardDrive className="h-5 w-5 text-green" />
                      </div>
                      <p className="mt-1 text-xs text-text-muted">Sufficient</p>
                    </div>
                  </div>

                  {result.bottleneckAnalysis.bottleneckComponent !== 'Balanced' && (
                    <div className="mt-4 rounded-lg border border-yellow/30 bg-yellow/5 p-4">
                      <p className="text-sm text-yellow">{result.bottleneckAnalysis.description}</p>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-border bg-bg-card p-6">
                  <h3 className="mb-4 text-lg font-bold">Estimated FPS Table</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-3 py-2 text-left text-xs font-medium text-text-muted">Resolution</th>
                          {qualities.map(q => (
                            <th key={q} className="px-3 py-2 text-center text-xs font-medium text-text-muted">{q}</th>
                          ))}
                          <th className="px-3 py-2 text-center text-xs font-medium text-text-muted">DLSS Ultra</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-text-muted">FSR Ultra</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resolutions.map(res => (
                          <tr key={res} className="border-b border-border/50">
                            <td className="px-3 py-2 font-medium text-text-primary">{res}</td>
                            {qualities.map(q => {
                              const f = getFps(result, res, q, 'Off', 'Off');
                              const isActive = res === resolution && q === quality;
                              return (
                                <td key={q} className={`px-3 py-2 text-center ${isActive ? 'bg-accent/10 rounded' : ''}`}>
                                  <span className={`font-mono font-bold ${getFpsColor(f)}`}>{f}</span>
                                </td>
                              );
                            })}
                            <td className="px-3 py-2 text-center">
                              <span className={`font-mono font-bold ${getFpsColor(getFps(result, res, quality, 'DLSS Ultra', 'Off'))}`}>
                                {getFps(result, res, quality, 'DLSS Ultra', 'Off')}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`font-mono font-bold ${getFpsColor(getFps(result, res, quality, 'FSR Ultra', 'Off'))}`}>
                                {getFps(result, res, quality, 'FSR Ultra', 'Off')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-bg-card p-6">
                  <h3 className="mb-3 text-lg font-bold">1% Low Estimates</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {resolutions.map(res => {
                      const resKey = getResKey(res);
  const fpsSet = (result as unknown as Record<string, FpsQualitySet>)[resKey];
                      const low1 = fpsSet?.low1Percent || 0;
                      return (
                        <div key={res} className="rounded-lg border border-border bg-bg-secondary p-3 text-center">
                          <p className="text-xs text-text-muted">{res}</p>
                          <p className={`mt-1 text-lg font-bold font-mono ${getFpsColor(low1)}`}>{low1}</p>
                          <p className="text-[10px] text-text-muted">1% Low</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {result.recommendedSettings && (
                  <div className="rounded-xl border border-accent/30 bg-accent/5 p-6">
                    <h3 className="mb-2 text-lg font-bold">Recommended Settings</h3>
                    <p className="text-sm text-text-secondary">{result.recommendedSettings.description}</p>
                  </div>
                )}

                {result.upgradeSuggestions.length > 0 && (
                  <div className="rounded-xl border border-border bg-bg-card p-6">
                    <h3 className="mb-4 text-lg font-bold">Upgrade Suggestions</h3>
                    <div className="space-y-3">
                      {result.upgradeSuggestions.map((s, i) => (
                        <div key={i} className="flex items-start gap-3 rounded-lg border border-border bg-bg-secondary p-4">
                          <ArrowRight className={`mt-0.5 h-4 w-4 ${
                            s.impact === 'high' ? 'text-red' : s.impact === 'medium' ? 'text-yellow' : 'text-text-muted'
                          }`} />
                          <div>
                            <p className="font-medium text-text-primary">{s.component} Upgrade</p>
                            <p className="text-sm text-text-secondary">{s.reason}</p>
                            <p className="mt-1 text-xs text-text-muted">
                              Current: {s.current} → Recommended: {s.recommended}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-border bg-bg-card p-6">
                  <p className="text-xs leading-relaxed text-text-muted">
                    Estimates are based on relative performance scoring. Actual FPS can vary depending on drivers,
                    thermals, background applications, power mode, game updates and other factors.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  {session?.user?.id && (
                    <>
                      <button
                        onClick={handleSaveHistory}
                        disabled={saving}
                        className="flex items-center gap-2 rounded-lg border border-border bg-bg-card px-4 py-2.5 text-sm font-medium text-text-primary transition-all hover:border-border-active hover:bg-bg-card-hover disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" />
                        {saving ? 'Saving...' : 'Save to History'}
                      </button>
                      <button
                        onClick={handleAddFavorite}
                        disabled={favoriting}
                        className="flex items-center gap-2 rounded-lg border border-border bg-bg-card px-4 py-2.5 text-sm font-medium text-text-primary transition-all hover:border-border-active hover:bg-bg-card-hover disabled:opacity-50"
                      >
                        <Heart className="h-4 w-4" />
                        {favoriting ? 'Adding...' : 'Add to Favorites'}
                      </button>
                    </>
                  )}
                </div>
                {savedMsg && <p className="text-sm text-green">{savedMsg}</p>}
                {favMsg && <p className="text-sm text-green">{favMsg}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
