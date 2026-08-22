'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import {
  LayoutDashboard, Cpu, Gamepad2, Zap, ArrowRight, Clock, Star,
  Loader2, TrendingUp, BarChart3, LogIn,
} from 'lucide-react';

interface Game {
  id: string;
  title: string;
  genre: string;
  tags: string[];
}

interface UserPC {
  id: string;
  name: string;
  isDefault: boolean;
  cpuModel: string;
  gpuModel: string;
  gpuVram: number;
  ramTotalGB: number;
  storageCapacityGB: number;
  displayResolution: string;
}

interface HistoryEntry {
  id: string;
  gameId: string;
  gameTitle: string;
  results: string;
  settingsUsed: string;
  createdAt: string;
}

interface FavoriteEntry {
  id: string;
  gameId: string;
  game: Game;
}

function getPerformanceTier(cpuModel: string, gpuModel: string, ram: number): string {
  if (ram >= 32 && (gpuModel.includes('4090') || gpuModel.includes('5090'))) return 'excellent';
  if (ram >= 16 && (gpuModel.includes('4070') || gpuModel.includes('4080') || gpuModel.includes('3080') || gpuModel.includes('3090') || gpuModel.includes('7800') || gpuModel.includes('7900'))) return 'good';
  if (ram >= 16 && (gpuModel.includes('4060') || gpuModel.includes('3060') || gpuModel.includes('7600') || gpuModel.includes('7700'))) return 'playable';
  if (ram >= 8) return 'poor';
  return 'not_recommended';
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

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [defaultPC, setDefaultPC] = useState<UserPC | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const isAuth = status === 'authenticated';

  useEffect(() => {
    if (!isAuth) return;

    Promise.all([
      fetch('/api/user-pcs').then(r => r.json()),
      fetch('/api/history').then(r => r.json()).catch(() => []),
      fetch('/api/favorites').then(r => r.json()).catch(() => []),
    ]).then(([pcs, hist, favs]) => {
      if (Array.isArray(pcs)) {
        const def = pcs.find((pc: UserPC) => pc.isDefault) || pcs[0];
        setDefaultPC(def || null);
      }
      if (Array.isArray(hist)) setHistory(hist.slice(0, 8));
      if (Array.isArray(favs)) setFavorites(favs.slice(0, 8));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [isAuth]);

  if (status === 'loading' || (loading && isAuth)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center">
          <LayoutDashboard className="mx-auto mb-4 h-16 w-16 text-text-muted/30" />
          <h1 className="mb-2 text-2xl font-bold">Welcome to CanIRun</h1>
          <p className="mb-6 text-text-secondary">Sign in to access your dashboard, saved PCs, and check history.</p>
          <Link
            href="/auth/signin"
            className="btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3 font-semibold text-white"
          >
            <LogIn className="h-5 w-5" />
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const tier = defaultPC ? getPerformanceTier(defaultPC.cpuModel, defaultPC.gpuModel, defaultPC.ramTotalGB) : null;
  const tierBadge = tier ? getTierBadge(tier) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex items-center gap-4">
        {session.user?.image ? (
          <Image src={session.user.image} alt="" width={56} height={56} className="rounded-full border-2 border-accent" unoptimized />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-xl font-bold text-white">
            {session.user?.name?.[0] || 'U'}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {session.user?.name || 'Gamer'}</h1>
          <p className="text-sm text-text-secondary">Here&apos;s your gaming overview</p>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/run" className="group rounded-xl border border-border bg-bg-card p-5 transition-all hover:border-accent hover:bg-bg-card-hover">
          <Zap className="mb-3 h-8 w-8 text-accent" />
          <h3 className="font-semibold text-text-primary group-hover:text-accent">Check a Game</h3>
          <p className="text-xs text-text-secondary">Can your PC run it?</p>
        </Link>
        <Link href="/my-pc" className="group rounded-xl border border-border bg-bg-card p-5 transition-all hover:border-accent hover:bg-bg-card-hover">
          <Cpu className="mb-3 h-8 w-8 text-green" />
          <h3 className="font-semibold text-text-primary group-hover:text-accent">Build a PC</h3>
          <p className="text-xs text-text-secondary">Manage your PC profiles</p>
        </Link>
        <Link href="/games" className="group rounded-xl border border-border bg-bg-card p-5 transition-all hover:border-accent hover:bg-bg-card-hover">
          <Gamepad2 className="mb-3 h-8 w-8 text-purple" />
          <h3 className="font-semibold text-text-primary group-hover:text-accent">Browse Games</h3>
          <p className="text-xs text-text-secondary">Explore game database</p>
        </Link>
        <Link href="/upgrade" className="group rounded-xl border border-border bg-bg-card p-5 transition-all hover:border-accent hover:bg-bg-card-hover">
          <TrendingUp className="mb-3 h-8 w-8 text-cyan" />
          <h3 className="font-semibold text-text-primary group-hover:text-accent">Upgrade Guide</h3>
          <p className="text-xs text-text-secondary">Find bottlenecks</p>
        </Link>
      </div>

      {defaultPC && (
        <div className="mb-8 rounded-xl border border-accent/30 bg-bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Cpu className="h-5 w-5 text-accent" />
              My PC
            </h2>
            {tierBadge && (
              <span className={`rounded-full border px-3 py-1 text-xs font-bold ${tierBadge.color}`}>
                {tierBadge.label}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-text-muted">Name</p>
              <p className="font-medium text-text-primary">{defaultPC.name}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">CPU</p>
              <p className="font-medium text-text-primary">{defaultPC.cpuModel || 'Not set'}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">GPU</p>
              <p className="font-medium text-text-primary">{defaultPC.gpuModel || 'Not set'} ({defaultPC.gpuVram}GB)</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">RAM</p>
              <p className="font-medium text-text-primary">{defaultPC.ramTotalGB}GB</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Clock className="h-5 w-5 text-accent" />
              Recently Checked
            </h2>
            {history.length > 0 && (
              <Link href="/history" className="text-xs font-medium text-accent hover:underline">View all</Link>
            )}
          </div>
          {history.length === 0 ? (
            <div className="py-8 text-center">
              <BarChart3 className="mx-auto mb-2 h-8 w-8 text-text-muted/30" />
              <p className="text-sm text-text-muted">No checks yet</p>
              <Link href="/run" className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline">
                Check your first game <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map(h => (
                <Link
                  key={h.id}
                  href={`/run`}
                  className="flex items-center justify-between rounded-lg border border-border bg-bg-secondary px-4 py-3 transition-all hover:border-border-active"
                >
                  <div>
                    <p className="text-sm font-medium text-text-primary">{h.gameTitle}</p>
                    <p className="text-xs text-text-muted">{new Date(h.createdAt).toLocaleDateString()}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-text-muted" />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Star className="h-5 w-5 text-yellow" />
              Favorite Games
            </h2>
            {favorites.length > 0 && (
              <Link href="/profiles" className="text-xs font-medium text-accent hover:underline">View all</Link>
            )}
          </div>
          {favorites.length === 0 ? (
            <div className="py-8 text-center">
              <Star className="mx-auto mb-2 h-8 w-8 text-text-muted/30" />
              <p className="text-sm text-text-muted">No favorites yet</p>
              <Link href="/games" className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline">
                Browse games <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {favorites.map(fav => (
                <Link
                  key={fav.id}
                  href={`/run`}
                  className="rounded-lg border border-border bg-bg-secondary p-3 transition-all hover:border-border-active"
                >
                  <p className="text-sm font-medium text-text-primary">{fav.game.title}</p>
                  <p className="text-xs text-text-muted">{fav.game.genre}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
