'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Cpu,
  HardDrive,
  MemoryStick,
  Monitor,
  Tag,
  Calendar,
  Building2,
  Gamepad2,
  Loader2,
  ChevronDown,
  Check,
  X,
  BarChart3,
} from 'lucide-react';
import type { Game, CPU as CpuType, GPU as GpuType, SavedProfile, FpsEstimateResult } from '@/types';

function RequirementsCard({
  title,
  cpuName,
  gpuName,
  ramGB,
  storageGB,
  os,
  directX,
  notes,
}: {
  title: string;
  cpuName: string;
  gpuName: string;
  ramGB: number;
  storageGB: number;
  os: string;
  directX: string | null;
  notes: string | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-card p-5">
      <h3 className="mb-4 text-lg font-semibold text-text-primary">{title}</h3>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Cpu className="h-5 w-5 text-accent" />
          <div>
            <p className="text-xs text-text-muted">CPU</p>
            <p className="text-sm text-text-primary">{cpuName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Monitor className="h-5 w-5 text-accent" />
          <div>
            <p className="text-xs text-text-muted">GPU</p>
            <p className="text-sm text-text-primary">{gpuName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <MemoryStick className="h-5 w-5 text-accent" />
          <div>
            <p className="text-xs text-text-muted">RAM</p>
            <p className="text-sm text-text-primary">{ramGB} GB</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <HardDrive className="h-5 w-5 text-accent" />
          <div>
            <p className="text-xs text-text-muted">Storage</p>
            <p className="text-sm text-text-primary">{storageGB} GB</p>
          </div>
        </div>
        {os && (
          <div className="border-t border-border pt-3">
            <p className="text-xs text-text-muted">OS</p>
            <p className="text-sm text-text-primary">{os}</p>
          </div>
        )}
        {directX && (
          <div className="border-t border-border pt-3">
            <p className="text-xs text-text-muted">DirectX</p>
            <p className="text-sm text-text-primary">{directX}</p>
          </div>
        )}
        {notes && (
          <div className="border-t border-border pt-3">
            <p className="text-xs text-text-muted">Notes</p>
            <p className="text-sm text-text-primary">{notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function FpsCell({ fps }: { fps: number }) {
  let color = 'text-green';
  let bg = 'bg-green/10';
  if (fps < 30) { color = 'text-red'; bg = 'bg-red/10'; }
  else if (fps < 60) { color = 'text-yellow'; bg = 'bg-yellow/10'; }
  return (
    <div className={`rounded-lg ${bg} p-2 text-center`}>
      <span className={`text-lg font-bold ${color}`}>{fps}</span>
      <span className="ml-1 text-xs text-text-muted">FPS</span>
    </div>
  );
}

export default function GameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [cpuSearch, setCpuSearch] = useState('');
  const [gpuSearch, setGpuSearch] = useState('');
  const [cpus, setCpus] = useState<CpuType[]>([]);
  const [gpus, setGpus] = useState<GpuType[]>([]);
  const [selectedCpu, setSelectedCpu] = useState<CpuType | null>(null);
  const [selectedGpu, setSelectedGpu] = useState<GpuType | null>(null);
  const [ramGB, setRamGB] = useState(16);
  const [estimating, setEstimating] = useState(false);
  const [estimateResult, setEstimateResult] = useState<FpsEstimateResult | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [cpuDropdownOpen, setCpuDropdownOpen] = useState(false);
  const [gpuDropdownOpen, setGpuDropdownOpen] = useState(false);
  const [minCpuName, setMinCpuName] = useState('');
  const [minGpuName, setMinGpuName] = useState('');
  const [recCpuName, setRecCpuName] = useState('');
  const [recGpuName, setRecGpuName] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/games?q=`);
        if (!res.ok) throw new Error('Failed to fetch games');
        const games = await res.json();
        const found = games.find((g: Game) => g.id === id);
        if (!found) throw new Error('Game not found');
        setGame(found);

        if (found.minRequirements.cpuId) {
          const cpuRes = await fetch(`/api/hardware/cpus?q=`);
          const allCpus = await cpuRes.json();
          const cpu = allCpus.find((c: CpuType) => c.id === found.minRequirements.cpuId);
          setMinCpuName(cpu?.name || found.minRequirements.cpuId);
          const recCpu = allCpus.find((c: CpuType) => c.id === found.recRequirements.cpuId);
          setRecCpuName(recCpu?.name || found.recRequirements.cpuId);
        }

        if (found.minRequirements.gpuId) {
          const gpuRes = await fetch(`/api/hardware/gpus?q=`);
          const allGpus = await gpuRes.json();
          const gpu = allGpus.find((g: GpuType) => g.id === found.minRequirements.gpuId);
          setMinGpuName(gpu?.name || found.minRequirements.gpuId);
          const recGpu = allGpus.find((g: GpuType) => g.id === found.recRequirements.gpuId);
          setRecGpuName(recGpu?.name || found.recRequirements.gpuId);
        }

        const profilesRes = await fetch('/api/profiles');
        if (profilesRes.ok) {
          const data = await profilesRes.json();
          setProfiles(data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load game');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const searchCpus = useCallback(async (q: string) => {
    if (!q || q.length < 2) { setCpus([]); return; }
    try {
      const res = await fetch(`/api/hardware/cpus?q=${encodeURIComponent(q)}`);
      if (res.ok) setCpus(await res.json());
    } catch { /* ignore */ }
  }, []);

  const searchGpus = useCallback(async (q: string) => {
    if (!q || q.length < 2) { setGpus([]); return; }
    try {
      const res = await fetch(`/api/hardware/gpus?q=${encodeURIComponent(q)}`);
      if (res.ok) setGpus(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchCpus(cpuSearch), 250);
    return () => clearTimeout(timer);
  }, [cpuSearch, searchCpus]);

  useEffect(() => {
    const timer = setTimeout(() => searchGpus(gpuSearch), 250);
    return () => clearTimeout(timer);
  }, [gpuSearch, searchGpus]);

  async function handleEstimate() {
    if (!game) return;

    let cpuId = '';
    let gpuId = '';
    let ram = ramGB;

    if (!manualMode && selectedProfileId) {
      const profile = profiles.find((p) => p.id === selectedProfileId);
      if (profile) {
        cpuId = profile.cpuId;
        gpuId = profile.gpuId;
        ram = profile.ramGB;
      }
    } else if (manualMode && selectedCpu && selectedGpu) {
      cpuId = selectedCpu.id;
      gpuId = selectedGpu.id;
      ram = ramGB;
    }

    if (!cpuId || !gpuId) {
      setEstimateError('Please select a CPU and GPU');
      return;
    }

    setEstimating(true);
    setEstimateError(null);
    setEstimateResult(null);

    try {
      const res = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpuId, gpuId, ramGB: ram, gameId: game.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Estimation failed');
      }
      setEstimateResult(await res.json());
    } catch (err) {
      setEstimateError(err instanceof Error ? err.message : 'Failed to estimate');
    } finally {
      setEstimating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="mb-4 h-8 w-8 animate-spin text-accent" />
        <p className="text-text-secondary">Loading game details...</p>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <Gamepad2 className="mx-auto mb-4 h-12 w-12 text-text-muted" />
        <h2 className="mb-2 text-xl font-bold text-text-primary">Game not found</h2>
        <p className="mb-4 text-text-secondary">{error || 'The game you are looking for does not exist.'}</p>
        <Link href="/games" className="text-sm font-medium text-accent hover:underline">
          Back to games
        </Link>
      </div>
    );
  }

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Link
        href="/games"
        className="mb-6 inline-flex items-center gap-1 text-sm text-text-secondary hover:text-accent"
      >
        &larr; Back to Games
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary">{game.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-text-secondary">
          <span className="flex items-center gap-1.5">
            <Building2 className="h-4 w-4" />
            {game.developer}
          </span>
          <span className="flex items-center gap-1.5">
            <Building2 className="h-4 w-4" />
            {game.publisher}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {game.releaseDate}
          </span>
          <span className="rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
            {game.genre}
          </span>
          {game.engine && (
            <span className="rounded-md bg-bg-card px-2 py-0.5 text-xs text-text-muted">
              {game.engine}
            </span>
          )}
        </div>
        {game.tags && game.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {game.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-md bg-bg-card px-2 py-0.5 text-xs text-text-secondary"
              >
                <Tag className="h-3 w-3" />
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mb-10 grid gap-4 md:grid-cols-2">
        <RequirementsCard
          title="Minimum Requirements"
          cpuName={minCpuName}
          gpuName={minGpuName}
          ramGB={game.minRequirements.ramGB}
          storageGB={game.minRequirements.storageGB}
          os={game.minRequirements.os}
          directX={game.minRequirements.directX}
          notes={game.minRequirements.notes}
        />
        <RequirementsCard
          title="Recommended Requirements"
          cpuName={recCpuName}
          gpuName={recGpuName}
          ramGB={game.recRequirements.ramGB}
          storageGB={game.recRequirements.storageGB}
          os={game.recRequirements.os}
          directX={game.recRequirements.directX}
          notes={game.recRequirements.notes}
        />
      </div>

      <div className="rounded-xl border border-border bg-bg-card p-6">
        <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-text-primary">
          <BarChart3 className="h-5 w-5 text-accent" />
          Can I Run This?
        </h2>

        <div className="mb-6 flex gap-3">
          <button
            onClick={() => setManualMode(false)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              !manualMode ? 'bg-accent text-white' : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
            }`}
          >
            Use Saved Profile
          </button>
          <button
            onClick={() => setManualMode(true)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              manualMode ? 'bg-accent text-white' : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
            }`}
          >
            Enter Manually
          </button>
        </div>

        {!manualMode ? (
          <div className="mb-6">
            <label className="mb-2 block text-sm text-text-secondary">Select a profile</label>
            <div className="relative">
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-bg-input px-4 py-3 text-left text-text-primary transition-colors hover:border-border-active"
              >
                <span className={selectedProfile ? 'text-text-primary' : 'text-text-muted'}>
                  {selectedProfile ? selectedProfile.name : 'Choose a profile...'}
                </span>
                <ChevronDown className="h-4 w-4 text-text-muted" />
              </button>
              {showProfileDropdown && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-bg-card shadow-xl">
                  {profiles.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-text-muted">
                      No profiles saved.{' '}
                      <Link href="/profiles" className="text-accent hover:underline">
                        Create one
                      </Link>
                    </div>
                  ) : (
                    profiles.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedProfileId(p.id);
                          setShowProfileDropdown(false);
                        }}
                        className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-bg-card-hover ${
                          selectedProfileId === p.id ? 'bg-accent/10 text-accent' : 'text-text-primary'
                        }`}
                      >
                        <span>{p.name}</span>
                        {selectedProfileId === p.id && <Check className="h-4 w-4" />}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div className="relative">
              <label className="mb-2 block text-sm text-text-secondary">CPU</label>
              <input
                type="search"
                placeholder="Search CPU..."
                value={selectedCpu ? selectedCpu.name : cpuSearch}
                onChange={(e) => {
                  setSelectedCpu(null);
                  setCpuSearch(e.target.value);
                  setCpuDropdownOpen(true);
                }}
                onFocus={() => setCpuDropdownOpen(true)}
                className="w-full rounded-lg border border-border bg-bg-input px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent"
              />
              {selectedCpu && (
                <button
                  onClick={() => { setSelectedCpu(null); setCpuSearch(''); }}
                  className="absolute right-3 top-9 text-text-muted hover:text-text-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {cpuDropdownOpen && cpus.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-bg-card shadow-xl">
                  {cpus.slice(0, 15).map((cpu) => (
                    <button
                      key={cpu.id}
                      onClick={() => {
                        setSelectedCpu(cpu);
                        setCpuSearch('');
                        setCpuDropdownOpen(false);
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-bg-card-hover"
                    >
                      <span className="text-text-primary">{cpu.name}</span>
                      <span className="text-xs text-text-muted">Score: {cpu.performanceScore}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <label className="mb-2 block text-sm text-text-secondary">GPU</label>
              <input
                type="search"
                placeholder="Search GPU..."
                value={selectedGpu ? selectedGpu.name : gpuSearch}
                onChange={(e) => {
                  setSelectedGpu(null);
                  setGpuSearch(e.target.value);
                  setGpuDropdownOpen(true);
                }}
                onFocus={() => setGpuDropdownOpen(true)}
                className="w-full rounded-lg border border-border bg-bg-input px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent"
              />
              {selectedGpu && (
                <button
                  onClick={() => { setSelectedGpu(null); setGpuSearch(''); }}
                  className="absolute right-3 top-9 text-text-muted hover:text-text-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {gpuDropdownOpen && gpus.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-bg-card shadow-xl">
                  {gpus.slice(0, 15).map((gpu) => (
                    <button
                      key={gpu.id}
                      onClick={() => {
                        setSelectedGpu(gpu);
                        setGpuSearch('');
                        setGpuDropdownOpen(false);
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-bg-card-hover"
                    >
                      <span className="text-text-primary">{gpu.name}</span>
                      <span className="text-xs text-text-muted">Score: {gpu.performanceScore}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm text-text-secondary">RAM (GB)</label>
              <input
                type="number"
                min={4}
                max={128}
                step={2}
                value={ramGB}
                onChange={(e) => setRamGB(Math.max(4, Math.min(128, parseInt(e.target.value) || 4)))}
                className="w-full rounded-lg border border-border bg-bg-input px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent"
              />
            </div>
          </div>
        )}

        {!manualMode && selectedProfile && (
          <div className="mb-6 rounded-lg bg-bg-secondary p-3 text-sm text-text-secondary">
            Using: {selectedProfile.ramGB}GB RAM, {selectedProfile.storageType} storage
          </div>
        )}

        {estimateError && (
          <div className="mb-4 rounded-lg border border-red/30 bg-red/10 p-3 text-sm text-red">
            {estimateError}
          </div>
        )}

        <button
          onClick={handleEstimate}
          disabled={estimating || (!manualMode && !selectedProfileId) || (manualMode && (!selectedCpu || !selectedGpu))}
          className="btn-primary flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {estimating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Estimating...
            </>
          ) : (
            <>
              <BarChart3 className="h-4 w-4" />
              Estimate FPS
            </>
          )}
        </button>

        {estimateResult && (
          <div className="mt-6 animate-fadeIn">
            <h3 className="mb-4 text-lg font-semibold text-text-primary">Results</h3>

            <div className="mb-4 flex gap-3">
              <span
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                  estimateResult.meetsMinRequirements
                    ? 'bg-green/10 text-green'
                    : 'bg-red/10 text-red'
                }`}
              >
                {estimateResult.meetsMinRequirements ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                Meets Min Requirements
              </span>
              <span
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                  estimateResult.meetsRecRequirements
                    ? 'bg-green/10 text-green'
                    : 'bg-red/10 text-red'
                }`}
              >
                {estimateResult.meetsRecRequirements ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                Meets Rec Requirements
              </span>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="text-center text-xs font-medium text-text-muted">1080p</div>
              <div className="text-center text-xs font-medium text-text-muted">Low</div>
              <div className="text-center text-xs font-medium text-text-muted">Medium</div>
              <div className="text-center text-xs font-medium text-text-muted">High</div>
              <FpsCell fps={estimateResult.resolution1080p.low} />
              <FpsCell fps={estimateResult.resolution1080p.medium} />
              <FpsCell fps={estimateResult.resolution1080p.high} />
              <FpsCell fps={estimateResult.resolution1080p.ultra} />
              <div className="text-center text-xs font-medium text-text-muted">1440p</div>
              <FpsCell fps={estimateResult.resolution1440p.low} />
              <FpsCell fps={estimateResult.resolution1440p.medium} />
              <FpsCell fps={estimateResult.resolution1440p.high} />
              <FpsCell fps={estimateResult.resolution1440p.ultra} />
              <div className="text-center text-xs font-medium text-text-muted">4K</div>
              <FpsCell fps={estimateResult.resolution4k.low} />
              <FpsCell fps={estimateResult.resolution4k.medium} />
              <FpsCell fps={estimateResult.resolution4k.high} />
              <FpsCell fps={estimateResult.resolution4k.ultra} />
            </div>

            <div className="rounded-lg bg-bg-secondary p-4">
              <h4 className="mb-2 text-sm font-semibold text-text-primary">Recommended Settings</h4>
              <p className="text-sm text-text-secondary">
                {estimateResult.recommendedSettings.resolution} at{' '}
                {estimateResult.recommendedSettings.quality} -{' '}
                <span className="font-semibold text-green">
                  ~{estimateResult.recommendedSettings.estimatedFps} FPS
                </span>
              </p>
              <p className="mt-1 text-xs text-text-muted">{estimateResult.recommendedSettings.description}</p>
            </div>

            <Link
              href={`/estimate?gameId=${game.id}`}
              className="mt-4 inline-flex items-center gap-1 text-sm text-accent hover:underline"
            >
              View full analysis &rarr;
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
