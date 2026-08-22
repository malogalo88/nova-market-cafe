import type { DB } from "./types";
import { buildDemoDB, buildEmptyDB } from "./seed";

const STORAGE_KEY = "novapos.db.v1";
export { STORAGE_KEY };

/**
 * Merge a (possibly old, possibly partial) stored database over fresh defaults
 * so data written by earlier versions of the app gains new fields — e.g. the
 * QR ordering arrays and settings — without ever crashing on `undefined`.
 */
export function normalizeDB(raw: unknown): DB {
  const base = buildEmptyDB();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<DB>;
  const s = (r.settings ?? {}) as Partial<DB["settings"]>;
  return {
    ...base,
    ...r,
    settings: {
      ...base.settings,
      ...s,
      paymentMethods: { ...base.settings.paymentMethods, ...(s.paymentMethods ?? {}) },
      loyalty: { ...base.settings.loyalty, ...(s.loyalty ?? {}) },
      qr: { ...base.settings.qr, ...(s.qr ?? {}) },
    },
  };
}

/**
 * Persistence layer. The whole app talks to the store, and the store talks to
 * this adapter — swap `loadDB`/`saveDB` for API calls to move to a real
 * backend without rewriting any UI.
 */
export interface DataAdapter {
  load: () => Promise<DB>;
  save: (db: DB) => Promise<void>;
}

function readLocal(): DB | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const db = JSON.parse(raw) as DB;
    if (!db || !Array.isArray(db.products) || !db.settings) return null;
    return db;
  } catch {
    return null;
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const localStorageAdapter: DataAdapter = {
  load: async () => {
    const existing = readLocal();
    if (existing) {
      // Freshen demo data if it was generated long ago so charts stay alive.
      const ageDays =
        existing.transactions.length > 0
          ? (Date.now() - new Date(existing.transactions[0].date).getTime()) / 86400000
          : 999;
      if (existing.settings.demoData && Math.abs(ageDays) > 45) {
        const fresh = buildDemoDB();
        await localStorageAdapter.save(fresh);
        return fresh;
      }
      return normalizeDB(existing);
    }
    // First run ever → install demo data so nothing is ever empty.
    const demo = buildDemoDB();
    await localStorageAdapter.save(demo);
    return demo;
  },
  save: async (db) => {
    try {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
        } catch (err) {
          console.error("Failed to persist data", err);
        }
      }, 250);
    } catch (err) {
      console.error("Storage unavailable", err);
    }
  },
};

export function resetAllData(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function downloadJSON(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const defaultAdapter: DataAdapter = localStorageAdapter;
