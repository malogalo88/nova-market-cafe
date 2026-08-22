'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Cpu,
  Monitor,
  MemoryStick,
  Gamepad2,
  BarChart3,
  Loader2,
  ChevronDown,
  Check,
  X,
  AlertTriangle,
  Trophy,
  TrendingDown,
  Settings,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import type {
  CPU,
  GPU,
  Game,
  SavedProfile,
  FpsEstimateResult,
} from '@/types';

const RESOLUTIONS = ['1080p', '1440p', '4K'] as const;
const QUALITIES = ['low', 'medium', 'high', 'ultra'] as const;
const QUALITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  ultra: 'Ultra',
};

function fpsColor(fps: number): string {
  if (fps >= 60) return 'text-green';
  if (fps >= 30) return 'text-yellow';
  return 'text-red';
}

function fpsBg(fps: number): string {
  if (fps >= 60) return 'bg-green/15 border-green/30';
  if (fps >= 30) return 'bg-yellow/15 border-yellow/30';
  return 'bg-red/15 border-red/30';
}

function SearchableDropdown<T extends { id: string }>({
  label,
  icon: Icon,
  items,
  value,
  onSelect,
  searchQuery,
  onSearchChange,
  placeholder,
  renderItem,
  getName,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: T[];
  value: T | null;
  onSelect: (item: T) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  placeholder: string;
  renderItem?: (item: T) => React.ReactNode;
  getName: (item: T) => string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <label className="mb-2 block text-sm font-medium text-text-secondary">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          type="search"
          placeholder={value ? '' : placeholder}
          value={value ? getName(value) : searchQuery}
          onChange={(e) => {
            onSelect(null as unknown as T);
            onSearchChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="w-full rounded-lg border border-border bg-bg-input py-2.5 pl-9 pr-8 text-sm text-text-primary placeholder-text-muted outline-none transition-colors focus:border-accent"
        />
        {value && (
          <button
            onClick={() => {
              onSelect(null as unknown as T);
              onSearchChange('');
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {!value && (
          <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        )}
      </div>
      {open && items.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-bg-card shadow-2xl">
          {items.slice(0, 20).map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onSelect(item);
                setOpen(false);
                onSearchChange('');
              }}
              className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors hover:bg-bg-card-hover ${
                value?.id === item.id ? 'bg-accent/10 text-accent' : 'text-text-primary'
              }`}
            >
              {renderItem ? renderItem(item) : (
                <span>{getName(item)}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EstimateContent() {
  const searchParams = useSearchParams();
  const preCpuId = searchParams.get('cpuId');
  const preGpuId = searchParams.get('gpuId');
  const preRam = searchParams.get('ramGB');
  const preGameId = searchParams.get('gameId');

  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [useProfile, setUseProfile] = useState(false);

  const [cpus, setCpus] = useState<CPU[]>([]);
  const [gpus, setGpus] = useState<GPU[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [selectedCpu, setSelectedCpu] = useState<CPU | null>(null);
  const [selectedGpu, setSelectedGpu] = useState<GPU | null>(null);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [ramGB, setRamGB] = useState(preRam ? parseInt(preRam) : 16);

  const [cpuQuery, setCpuQuery] = useState('');
  const [gpuQuery, setGpuQuery] = useState('');
  const [gameQuery, setGameQuery] = useState('');

  const [loadingHardware, setLoadingHardware] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [result, setResult] = useState<FpsEstimateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showProfileHint, setShowProfileHint] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/profiles');
      if (res.ok) {
        const data = await res.json();
        setProfiles(data);
        if (preCpuId && preGpuId && preRam) {
          setUseProfile(false);
        } else if (data.length > 0) {
          setShowProfileHint(true);
        }
      }
    }
    load();
  }, [preCpuId, preGpuId, preRam]);

  useEffect(() => {
    if (!preCpuId || !preGpuId || !preGameId) return;
    (async () => {
      setLoadingHardware(true);
      try {
        const [allCpus, allGpus, allGames] = await Promise.all([
          fetch(`/api/hardware/cpus`).then((r) => r.json()),
          fetch(`/api/hardware/gpus`).then((r) => r.json()),
          fetch(`/api/games`).then((r) => r.json()),
        ]);
        const cpu = allCpus.find((c: CPU) => c.id === preCpuId);
        const gpu = allGpus.find((g: GPU) => g.id === preGpuId);
        const game = allGames.find((g: Game) => g.id === preGameId);
        if (cpu) setSelectedCpu(cpu);
        if (gpu) setSelectedGpu(gpu);
        if (game) setSelectedGame(game);
      } finally {
        setLoadingHardware(false);
      }
    })();
  }, [preCpuId, preGpuId, preGameId]);

  const searchCpus = useCallback(async (q: string) => {
    const res = await fetch(`/api/hardware/cpus?q=${encodeURIComponent(q)}`);
    if (res.ok) setCpus(await res.json());
  }, []);

  const searchGpus = useCallback(async (q: string) => {
    const res = await fetch(`/api/hardware/gpus?q=${encodeURIComponent(q)}`);
    if (res.ok) setGpus(await res.json());
  }, []);

  const searchGames = useCallback(async (q: string) => {
    const res = await fetch(`/api/games?q=${encodeURIComponent(q)}`);
    if (res.ok) setGames(await res.json());
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchCpus(cpuQuery), 250);
    return () => clearTimeout(t);
  }, [cpuQuery, searchCpus]);

  useEffect(() => {
    const t = setTimeout(() => searchGpus(gpuQuery), 250);
    return () => clearTimeout(t);
  }, [gpuQuery, searchGpus]);

  useEffect(() => {
    const t = setTimeout(() => searchGames(gameQuery), 250);
    return () => clearTimeout(t);
  }, [gameQuery, searchGames]);

  function applyProfile(profile: SavedProfile) {
    setSelectedProfileId(profile.id);
    setRamGB(profile.ramGB);
    setLoadingHardware(true);
    Promise.all([
      fetch('/api/hardware/cpus').then((r) => r.json()),
      fetch('/api/hardware/gpus').then((r) => r.json()),
    ])
      .then(([allCpus, allGpus]) => {
        const cpu = allCpus.find((c: CPU) => c.id === profile.cpuId);
        const gpu = allGpus.find((g: GPU) => g.id === profile.gpuId);
        if (cpu) setSelectedCpu(cpu);
        if (gpu) setSelectedGpu(gpu);
      })
      .finally(() => setLoadingHardware(false));
  }

  async function handleEstimate() {
    if (!selectedCpu || !selectedGpu || !selectedGame) {
      setError('Please select a CPU, GPU, and game');
      return;
    }

    setEstimating(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cpuId: selectedCpu.id,
          gpuId: selectedGpu.id,
          ramGB,
          gameId: selectedGame.id,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Estimation failed');
      }
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to estimate FPS');
    } finally {
      setEstimating(false);
    }
  }

  const chartData = useMemo(() => {
    if (!result) return [];
    const resKey = (r: string) => {
      if (r === '1080p') return 'resolution1080p';
      if (r === '1440p') return 'resolution1440p';
      return 'resolution4k';
    };
    return RESOLUTIONS.flatMap((res) =>
      QUALITIES.map((q) => ({
        name: `${res} ${QUALITY_LABELS[q]}`,
        fps: (result as unknown as Record<string, Record<string, number>>)[resKey(res)][q],
        resolution: res,
        quality: QUALITY_LABELS[q],
      }))
    );
  }, [result]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary">FPS Estimator</h1>
        <p className="mt-2 text-text-secondary">
          Select your hardware and a game to get estimated performance
        </p>
      </div>

      {showProfileHint && profiles.length > 0 && !selectedCpu && !selectedGpu && (
        <div className="mb-6 rounded-xl border border-accent/30 bg-accent/5 p-4">
          <p className="mb-2 text-sm text-accent">
            You have saved profiles. Load one to quickly fill in your hardware.
          </p>
          <div className="flex flex-wrap gap-2">
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  applyProfile(p);
                  setShowProfileHint(false);
                }}
                className="rounded-lg bg-bg-card px-3 py-1.5 text-xs font-medium text-text-secondary transition-all hover:bg-bg-card-hover hover:text-text-primary"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {loadingHardware && (
        <div className="mb-4 flex items-center gap-2 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading hardware data...
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <div className="rounded-xl border border-border bg-bg-card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-text-primary">
              <Cpu className="h-5 w-5 text-accent" />
              Hardware
            </h2>

            <div className="mb-4">
              <div className="mb-3 flex items-center gap-2">
                <button
                  onClick={() => setUseProfile(false)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    !useProfile ? 'bg-accent text-white' : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Manual
                </button>
                <button
                  onClick={() => setUseProfile(true)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    useProfile ? 'bg-accent text-white' : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Profile
                </button>
              </div>

              {useProfile ? (
                <div className="relative">
                  <button
                    onClick={() => setShowProfileHint(!showProfileHint)}
                    className="flex w-full items-center justify-between rounded-lg border border-border bg-bg-input px-3 py-2.5 text-left text-sm text-text-primary transition-colors hover:border-border-active"
                  >
                    <span className={selectedProfileId ? '' : 'text-text-muted'}>
                      {profiles.find((p) => p.id === selectedProfileId)?.name || 'Select profile...'}
                    </span>
                    <ChevronDown className="h-4 w-4 text-text-muted" />
                  </button>
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-bg-card shadow-xl">
                    {profiles.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          applyProfile(p);
                        }}
                        className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors hover:bg-bg-card-hover ${
                          selectedProfileId === p.id ? 'bg-accent/10 text-accent' : 'text-text-primary'
                        }`}
                      >
                        <span>{p.name}</span>
                        {selectedProfileId === p.id && <Check className="h-4 w-4" />}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <SearchableDropdown
                    label="CPU"
                    icon={Cpu}
                    items={cpus}
                    value={selectedCpu}
                    onSelect={(item) => setSelectedCpu(item as CPU)}
                    searchQuery={cpuQuery}
                    onSearchChange={setCpuQuery}
                    placeholder="Search CPU..."
                    getName={(item) => (item as CPU).name}
                    renderItem={(item) => {
                      const cpu = item as CPU;
                      return (
                        <span className="flex w-full items-center justify-between">
                          <span>{cpu.name}</span>
                          <span className="text-xs text-text-muted">Score: {cpu.performanceScore}</span>
                        </span>
                      );
                    }}
                  />
                  <SearchableDropdown
                    label="GPU"
                    icon={Monitor}
                    items={gpus}
                    value={selectedGpu}
                    onSelect={(item) => setSelectedGpu(item as GPU)}
                    searchQuery={gpuQuery}
                    onSearchChange={setGpuQuery}
                    placeholder="Search GPU..."
                    getName={(item) => (item as GPU).name}
                    renderItem={(item) => {
                      const gpu = item as GPU;
                      return (
                        <span className="flex w-full items-center justify-between">
                          <span>{gpu.name}</span>
                          <span className="text-xs text-text-muted">Score: {gpu.performanceScore}</span>
                        </span>
                      );
                    }}
                  />
                </div>
              )}

              <div className="mt-3">
                <label className="mb-2 block text-sm font-medium text-text-secondary">RAM (GB)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={4}
                    max={128}
                    step={2}
                    value={ramGB}
                    onChange={(e) => setRamGB(parseInt(e.target.value))}
                    className="flex-1 accent-accent"
                  />
                  <input
                    type="number"
                    min={4}
                    max={128}
                    step={2}
                    value={ramGB}
                    onChange={(e) => setRamGB(Math.max(4, Math.min(128, parseInt(e.target.value) || 4)))}
                    className="w-20 rounded-lg border border-border bg-bg-input px-3 py-2 text-center text-sm text-text-primary outline-none focus:border-accent"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-bg-card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-text-primary">
              <Gamepad2 className="h-5 w-5 text-accent" />
              Game
            </h2>
            <SearchableDropdown
              label="Select Game"
              icon={Gamepad2}
              items={games}
              value={selectedGame}
              onSelect={(item) => setSelectedGame(item as Game)}
              searchQuery={gameQuery}
              onSearchChange={setGameQuery}
              placeholder="Search for a game..."
              getName={(item) => (item as Game).title}
              renderItem={(item) => {
                const game = item as Game;
                return (
                  <span className="flex w-full items-center justify-between">
                    <span>{game.title}</span>
                    <span className="text-xs text-text-muted">{game.genre}</span>
                  </span>
                );
              }}
            />
          </div>

          <button
            onClick={handleEstimate}
            disabled={estimating || !selectedCpu || !selectedGpu || !selectedGame}
            className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {estimating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Calculating FPS...
              </>
            ) : (
              <>
                <BarChart3 className="h-4 w-4" />
                Estimate Performance
              </>
            )}
          </button>
        </div>

        <div className="lg:col-span-2">
          {error && (
            <div className="mb-6 flex items-center gap-2 rounded-xl border border-red/30 bg-red/10 p-4 text-sm text-red">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              {error}
            </div>
          )}

          {!result && !estimating && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-bg-card py-20">
              <BarChart3 className="mb-4 h-12 w-12 text-text-muted" />
              <h3 className="mb-2 text-lg font-semibold text-text-primary">No results yet</h3>
              <p className="text-center text-text-secondary">
                Select your hardware and a game, then click &quot;Estimate Performance&quot;
              </p>
            </div>
          )}

          {estimating && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-bg-card py-20">
              <Loader2 className="mb-4 h-10 w-10 animate-spin text-accent" />
              <h3 className="mb-2 text-lg font-semibold text-text-primary">Calculating...</h3>
              <p className="text-text-secondary">Analyzing hardware performance and game requirements</p>
            </div>
          )}

          {result && (
            <div className="space-y-6 animate-fadeIn">
              <div className="rounded-xl border border-border bg-bg-card p-5">
                <h3 className="mb-3 text-lg font-semibold text-text-primary">Compatibility</h3>
                <div className="flex gap-3">
                  <span
                    className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium ${
                      result.meetsMinRequirements
                        ? 'border-green/30 bg-green/10 text-green'
                        : 'border-red/30 bg-red/10 text-red'
                    }`}
                  >
                    {result.meetsMinRequirements ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                    Minimum Requirements
                  </span>
                  <span
                    className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium ${
                      result.meetsRecRequirements
                        ? 'border-green/30 bg-green/10 text-green'
                        : 'border-red/30 bg-red/10 text-red'
                    }`}
                  >
                    {result.meetsRecRequirements ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                    Recommended Requirements
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-bg-card p-5">
                <h3 className="mb-4 text-lg font-semibold text-text-primary">
                  Estimated FPS by Resolution & Quality
                </h3>
                <div className="mb-4 grid grid-cols-4 gap-2 text-center text-xs font-medium text-text-muted">
                  <div></div>
                  <div>Low</div>
                  <div>Medium</div>
                  <div>High / Ultra</div>
                </div>
                {RESOLUTIONS.map((res) => {
                  const key = res === '1080p' ? 'resolution1080p' : res === '1440p' ? 'resolution1440p' : 'resolution4k';
                  const data = result[key];
                  return (
                    <div key={res} className="mb-3 grid grid-cols-4 gap-2">
                      <div className="flex items-center text-sm font-medium text-text-secondary">{res}</div>
                      {QUALITIES.map((q) => (
                        <div
                          key={q}
                          className={`rounded-lg border p-2.5 text-center transition-all ${fpsBg(data[q])}`}
                        >
                          <span className={`text-lg font-bold ${fpsColor(data[q])}`}>{data[q]}</span>
                          <span className="ml-0.5 text-xs text-text-muted">FPS</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              <div className="rounded-xl border border-border bg-bg-card p-5">
                <h3 className="mb-4 text-lg font-semibold text-text-primary">FPS Chart</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: '#8888a8', fontSize: 11 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis tick={{ fill: '#8888a8', fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1a1a2e',
                          border: '1px solid #2a2a4a',
                          borderRadius: '8px',
                          color: '#e8e8f0',
                        }}
                        labelStyle={{ color: '#e8e8f0' }}
                      />
                      <Legend wrapperStyle={{ color: '#8888a8', fontSize: 12 }} />
                      <Bar dataKey="fps" name="FPS" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={
                              entry.fps >= 60 ? '#4ade80' : entry.fps >= 30 ? '#facc15' : '#f87171'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-bg-card p-5">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-text-primary">
                  <TrendingDown className="h-5 w-5 text-orange" />
                  Bottleneck Analysis
                </h3>
                <div className="mb-4 grid grid-cols-3 gap-4">
                  {[
                    { label: 'CPU Score', value: result.bottleneckAnalysis.cpuScore, icon: Cpu },
                    { label: 'GPU Score', value: result.bottleneckAnalysis.gpuScore, icon: Monitor },
                    { label: 'RAM Score', value: result.bottleneckAnalysis.ramScore, icon: MemoryStick },
                  ].map(({ label, value, icon: ItemIcon }) => (
                    <div key={label} className="rounded-lg bg-bg-secondary p-3 text-center">
                      <ItemIcon className="mx-auto mb-1 h-4 w-4 text-text-muted" />
                      <p className="text-xs text-text-muted">{label}</p>
                      <p className="text-lg font-bold text-text-primary">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mb-4">
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-text-secondary">Bottleneck</span>
                    <span className="font-semibold text-text-primary">
                      {result.bottleneckAnalysis.bottleneckPercent}% -{' '}
                      {result.bottleneckAnalysis.bottleneckComponent}
                    </span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-bg-secondary">
                    <div
                      className="fps-bar h-full rounded-full"
                      style={{
                        width: `${Math.min(100, result.bottleneckAnalysis.bottleneckPercent)}%`,
                        backgroundColor:
                          result.bottleneckAnalysis.bottleneckPercent > 50
                            ? '#f87171'
                            : result.bottleneckAnalysis.bottleneckPercent > 25
                              ? '#facc15'
                              : '#4ade80',
                      }}
                    />
                  </div>
                </div>
                <p className="text-sm text-text-secondary">{result.bottleneckAnalysis.description}</p>
              </div>

              <div className="rounded-xl border border-accent/30 bg-accent/5 p-5">
                <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-text-primary">
                  <Trophy className="h-5 w-5 text-accent" />
                  Recommended Settings
                </h3>
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="mb-2 flex flex-wrap gap-3 text-sm">
                      <span className="rounded-lg bg-bg-card px-3 py-1">
                        <span className="text-text-muted">Resolution: </span>
                        <span className="font-semibold text-text-primary">
                          {result.recommendedSettings.resolution}
                        </span>
                      </span>
                      <span className="rounded-lg bg-bg-card px-3 py-1">
                        <span className="text-text-muted">Quality: </span>
                        <span className="font-semibold text-text-primary">
                          {result.recommendedSettings.quality}
                        </span>
                      </span>
                      <span className="rounded-lg bg-green/10 px-3 py-1">
                        <span className="text-text-muted">Est. FPS: </span>
                        <span className="font-bold text-green">
                          {result.recommendedSettings.estimatedFps}
                        </span>
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary">
                      {result.recommendedSettings.description}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-bg-card p-4">
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <Settings className="h-4 w-4" />
                  This analysis has been saved to your history. FPS values are estimates based on
                  relative performance scoring.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EstimatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-accent" />
            <p className="text-text-secondary">Loading FPS Estimator...</p>
          </div>
        </div>
      }
    >
      <EstimateContent />
    </Suspense>
  );
}
