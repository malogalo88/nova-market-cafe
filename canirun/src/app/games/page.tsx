'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Search, Gamepad2, Tag, ArrowRight, Loader2 } from 'lucide-react';
import type { Game } from '@/types';

const GENRES = [
  'All',
  'Action',
  'RPG',
  'FPS',
  'Adventure',
  'Strategy',
  'Racing',
  'Sports',
  'Simulation',
  'Horror',
  'Sandbox',
  'Puzzle',
  'Platformer',
];

const TAG_COLORS: Record<string, string> = {
  'Open World': 'bg-blue/15 text-blue',
  Multiplayer: 'bg-green/15 text-green',
  'Co-op': 'bg-cyan/15 text-cyan',
  Competitive: 'bg-red/15 text-red',
  VR: 'bg-purple/15 text-purple',
  'Ray Tracing': 'bg-orange/15 text-orange',
  'Cross-Platform': 'bg-yellow/15 text-yellow',
  'Early Access': 'bg-accent/15 text-accent',
};

function getTagColor(tag: string): string {
  if (TAG_COLORS[tag]) return TAG_COLORS[tag];
  const hash = tag.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const colors = [
    'bg-blue/15 text-blue',
    'bg-green/15 text-green',
    'bg-purple/15 text-purple',
    'bg-orange/15 text-orange',
    'bg-cyan/15 text-cyan',
    'bg-yellow/15 text-yellow',
    'bg-accent/15 text-accent',
  ];
  return colors[hash % colors.length];
}

export default function GamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchGames = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedQuery) params.set('q', debouncedQuery);
      if (selectedGenre !== 'All') params.set('genre', selectedGenre);
      const res = await fetch(`/api/games?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch games');
      const data = await res.json();
      setGames(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, selectedGenre]);

  useEffect(() => {
    (async () => { await fetchGames(); })();
  }, [fetchGames]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary">Game Database</h1>
        <p className="mt-2 text-text-secondary">
          Browse our library of games and check if your PC can run them
        </p>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            placeholder="Search games by title, developer, or engine..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-border bg-bg-input py-3 pl-11 pr-4 text-text-primary placeholder-text-muted outline-none transition-colors focus:border-accent"
          />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {GENRES.map((genre) => (
          <button
            key={genre}
            onClick={() => setSelectedGenre(genre)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
              selectedGenre === genre
                ? 'bg-accent text-white'
                : 'bg-bg-card text-text-secondary hover:bg-bg-card-hover hover:text-text-primary'
            }`}
          >
            {genre}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red/30 bg-red/10 p-4 text-red">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-accent" />
          <p className="text-text-secondary">Loading games...</p>
        </div>
      ) : games.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-bg-card py-20">
          <Gamepad2 className="mb-4 h-12 w-12 text-text-muted" />
          <h3 className="mb-2 text-lg font-semibold text-text-primary">No games found</h3>
          <p className="text-text-secondary">
            {searchQuery || selectedGenre !== 'All'
              ? 'Try adjusting your search or filters'
              : 'No games are available in the database yet'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <div
              key={game.id}
              className="group flex flex-col rounded-xl border border-border bg-bg-card p-5 transition-all hover:border-border-active hover:bg-bg-card-hover"
            >
              <div className="mb-3">
                <h3 className="text-lg font-semibold text-text-primary group-hover:text-accent">
                  {game.title}
                </h3>
                <p className="text-sm text-text-secondary">{game.developer}</p>
              </div>

              <div className="mb-3">
                <span className="inline-block rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                  {game.genre}
                </span>
              </div>

              {game.tags && game.tags.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {game.tags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${getTagColor(tag)}`}
                    >
                      <Tag className="h-3 w-3" />
                      {tag}
                    </span>
                  ))}
                  {game.tags.length > 4 && (
                    <span className="rounded-md bg-bg-secondary px-2 py-0.5 text-xs text-text-muted">
                      +{game.tags.length - 4}
                    </span>
                  )}
                </div>
              )}

              <div className="mt-auto">
                <Link
                  href={`/estimate?gameId=${game.id}`}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent/10 py-2.5 text-sm font-medium text-accent transition-all hover:bg-accent hover:text-white"
                >
                  Check Compatibility
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
