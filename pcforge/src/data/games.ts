import type { Game } from '../types'

// demand: relative GPU load (higher = heavier). cpuLoad: how CPU-bound (0-1).
// These drive PCForge's FPS estimation model — all outputs are labeled as estimates.

export const GAMES: Game[] = [
  { id: 'minecraft', name: 'Minecraft', demand: 0.16, cpuLoad: 0.9, genre: 'Sandbox', note: 'Java Edition with OptiFine/Sodium can be significantly faster.' },
  { id: 'fortnite', name: 'Fortnite', demand: 0.40, cpuLoad: 0.75, genre: 'Battle Royale' },
  { id: 'roblox', name: 'Roblox', demand: 0.14, cpuLoad: 0.7, genre: 'Sandbox', note: 'Varies hugely by experience.' },
  { id: 'valorant', name: 'Valorant', demand: 0.10, cpuLoad: 0.85, genre: 'Tactical Shooter' },
  { id: 'cs2', name: 'Counter-Strike 2', demand: 0.20, cpuLoad: 1.0, genre: 'Tactical Shooter' },
  { id: 'cod', name: 'Call of Duty (MW3)', demand: 0.62, cpuLoad: 0.7, genre: 'FPS' },
  { id: 'warzone', name: 'Warzone', demand: 0.70, cpuLoad: 0.8, genre: 'Battle Royale' },
  { id: 'apex', name: 'Apex Legends', demand: 0.55, cpuLoad: 0.75, genre: 'Battle Royale' },
  { id: 'gtav', name: 'GTA V', demand: 0.58, cpuLoad: 0.65, genre: 'Open World' },
  { id: 'gtavi', name: 'GTA VI', demand: 1.15, cpuLoad: 0.7, genre: 'Open World', unreleased: true, note: 'Not yet released on PC — based on expected requirements. Treat all numbers as rough projections.' },
  { id: 'cyberpunk', name: 'Cyberpunk 2077', demand: 1.0, cpuLoad: 0.55, genre: 'RPG', note: 'Ray tracing dramatically increases GPU load; estimates assume rasterization.' },
  { id: 'rdr2', name: 'Red Dead Redemption 2', demand: 0.85, cpuLoad: 0.55, genre: 'Open World' },
  { id: 'forza', name: 'Forza Horizon 5', demand: 0.72, cpuLoad: 0.5, genre: 'Racing' },
  { id: 'eldenring', name: 'Elden Ring', demand: 0.68, cpuLoad: 0.5, genre: 'Action RPG', note: 'Locked to 60 FPS in the official release.' },
  { id: 'overwatch', name: 'Overwatch 2', demand: 0.28, cpuLoad: 0.8, genre: 'Hero Shooter' },
  { id: 'pubg', name: 'PUBG: Battlegrounds', demand: 0.50, cpuLoad: 0.85, genre: 'Battle Royale' },
  { id: 'lol', name: 'League of Legends', demand: 0.12, cpuLoad: 0.8, genre: 'MOBA' },
  { id: 'rocketleague', name: 'Rocket League', demand: 0.18, cpuLoad: 0.75, genre: 'Sports' },
]

export const GAME_INDEX = new Map(GAMES.map(g => [g.id, g]))

export const RESOLUTIONS = ['720p', '1080p', '1440p', '4K'] as const
export const SETTINGS = ['Low', 'Medium', 'High', 'Ultra'] as const

export const RES_MULT: Record<string, number> = { '720p': 2.1, '1080p': 1.55, '1440p': 1.0, '4K': 0.52 }
export const SET_MULT: Record<string, number> = { Low: 1.45, Medium: 1.18, High: 1.0, Ultra: 0.82 }

// Rough hardware class needed to hit ~60fps at High settings in that game.
export function minReq(game: Game) {
  return {
    gpuPerf: Math.round(38 * game.demand + 8),
    cpuGaming: Math.round(30 * game.cpuLoad + 22),
    ramGb: game.demand > 0.6 ? 16 : 8,
  }
}
export function recReq(game: Game) {
  return {
    gpuPerf: Math.round(62 * game.demand + 14),
    cpuGaming: Math.round(45 * game.cpuLoad + 35),
    ramGb: game.demand > 0.6 ? 32 : 16,
  }
}
