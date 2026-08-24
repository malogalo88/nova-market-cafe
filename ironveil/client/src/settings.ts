export interface GraphicsSettings {
  preset: number;
  resScale: number;
  shadows: number;
  effects: number;
  viewDist: number;
  aa: number;
  fpsLimit: number;
  fov: number;
}

export interface CrosshairSettings {
  color: string;
  size: number;
  gap: number;
  thickness: number;
  dot: boolean;
  outline: boolean;
  dynamic: boolean;
}

export interface AudioSettings {
  master: number;
  sfx: number;
}

export interface Keybinds {
  forward: string; back: string; left: string; right: string;
  jump: string; crouch: string; walk: string; reload: string;
  slot1: string; slot2: string; slot3: string;
  abilityQ: string; abilityE: string;
  scoreboard: string; chat: string; quickchat1: string; quickchat2: string;
  perf: string;
}

export interface Settings {
  graphics: GraphicsSettings;
  crosshair: CrosshairSettings;
  audio: AudioSettings;
  binds: Keybinds;
  sensitivity: number;
  adsSensMult: number;
  invertY: boolean;
  showFps: boolean;
}

export const GRAPHICS_PRESETS = ["Very Low", "Low", "Medium", "High", "Ultra"];

const DEFAULT_GRAPHICS: Record<number, Partial<GraphicsSettings>> = {
  0: { resScale: 0.6, shadows: 0, effects: 0, viewDist: 70, aa: 0 },
  1: { resScale: 0.75, shadows: 0, effects: 1, viewDist: 90, aa: 0 },
  2: { resScale: 0.9, shadows: 1, effects: 1, viewDist: 120, aa: 1 },
  3: { resScale: 1.0, shadows: 2, effects: 2, viewDist: 160, aa: 1 },
  4: { resScale: 1.0, shadows: 3, effects: 2, viewDist: 220, aa: 2 },
};

export const DEFAULT_SETTINGS: Settings = {
  graphics: {
    preset: 2,
    resScale: 0.9,
    shadows: 1,
    effects: 1,
    viewDist: 120,
    aa: 1,
    fpsLimit: 0,
    fov: 75,
  },
  crosshair: {
    color: "#7dffb0",
    size: 5,
    gap: 4,
    thickness: 2,
    dot: false,
    outline: true,
    dynamic: true,
  },
  audio: { master: 0.8, sfx: 0.9 },
  binds: {
    forward: "KeyW", back: "KeyS", left: "KeyA", right: "KeyD",
    jump: "Space", crouch: "ControlLeft", walk: "ShiftLeft", reload: "KeyR",
    slot1: "Digit1", slot2: "Digit2", slot3: "Digit3",
    abilityQ: "KeyQ", abilityE: "KeyE",
    scoreboard: "Tab", chat: "Enter", quickchat1: "KeyZ", quickchat2: "KeyX",
    perf: "F3",
  },
  sensitivity: 0.0023,
  adsSensMult: 0.85,
  invertY: false,
  showFps: true,
};

const LS_KEY = "ironveil.settings.v1";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return structuredCloneSafe(DEFAULT_SETTINGS);
    const parsed = JSON.parse(raw);
    return mergeDeep(structuredCloneSafe(DEFAULT_SETTINGS), parsed);
  } catch {
    return structuredCloneSafe(DEFAULT_SETTINGS);
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch { /* storage unavailable */ }
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function mergeDeep(base: any, over: any): any {
  for (const k of Object.keys(over)) {
    if (base[k] && typeof base[k] === "object" && !Array.isArray(base[k]) && typeof over[k] === "object") {
      mergeDeep(base[k], over[k]);
    } else if (k in base) {
      base[k] = over[k];
    }
  }
  return base;
}

export function applyPreset(g: GraphicsSettings, preset: number): void {
  g.preset = preset;
  Object.assign(g, DEFAULT_GRAPHICS[preset]);
}
