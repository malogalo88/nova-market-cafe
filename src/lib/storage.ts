import type { DB, Employee, QrOrderStatus } from "./types.js";
import { buildDemoDB, buildEmptyDB } from "./seed.js";

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
export interface SaveOptions {
  /** Revision this db was based on (server rejects/merges stale writes). */
  baseRev?: number | null;
  /** "merge" keeps phone orders placed in the meantime; "replace" overwrites. */
  mode?: "merge" | "replace";
}

export interface DbEnvelope {
  db: DB;
  rev: number;
}

export interface DataAdapter {
  load: () => Promise<DB>;
  /** Persists the db. Server-backed adapters return the authoritative merged
   *  database + revision so the client can adopt it; null = nothing to adopt. */
  save: (db: DB, opts?: SaveOptions) => Promise<DbEnvelope | null>;
  /** Same as load but also returns the server revision (server adapters only). */
  loadEnvelope?: () => Promise<DbEnvelope>;
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
    return null;
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

// ── Server mode (multi-device QR ordering) ──────────────────────────────────
// When the app is served by `npm run server`, /api/* is available and every
// device — counter PCs AND customer phones — shares the canonical database.
// Without a server the app stays fully functional on localStorage alone.

const AUTH_KEY = "novapos.auth";

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
  }
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(AUTH_KEY, token);
    else localStorage.removeItem(AUTH_KEY);
  } catch {
    /* storage unavailable */
  }
}

async function api(path: string, opts: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const token = getAuthToken();
  try {
    return await fetch(path, {
      ...opts,
      signal: ctrl.signal,
      headers: {
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Is this page being served by the NovaPOS server? Retried because a freshly
 * deployed serverless function may need several seconds to cold-start. */
export async function probeServer(): Promise<boolean> {
  for (const timeoutMs of [3500, 3500]) {
    try {
      const r = await api("/api/health", {}, timeoutMs);
      if (r.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((res) => setTimeout(res, 400));
  }
  return false;
}

export interface BootInfo {
  businessName: string;
  logo?: string;
  theme: "light" | "dark";
  currencySymbol: string;
  employees: Array<{ id: string; name: string; username: string; role: Employee["role"] }>;
}

export async function fetchBootInfo(): Promise<BootInfo> {
  const r = await api("/api/boot");
  if (!r.ok) throw new Error(`Server responded ${r.status}`);
  return (await r.json()) as BootInfo;
}

export async function apiLogin(username: string, pin: string): Promise<{ token: string; employeeId: string }> {
  const r = await api("/api/session/login", { method: "POST", body: JSON.stringify({ username, pin }) });
  const body = (await r.json()) as { ok: boolean; error?: string; token?: string; employeeId?: string };
  if (!r.ok || !body.ok || !body.token || !body.employeeId) throw new Error(body.error ?? "Wrong name or PIN.");
  return { token: body.token, employeeId: body.employeeId };
}

/** Ask the server to (re-)guarantee the permanent printed QR ids exist.
 * Additive + idempotent: never touches existing or deleted custom codes. */
export async function ensureQrCodesOnServer(): Promise<string[]> {
  const r = await api("/api/staff/qr-codes/ensure", { method: "POST" });
  if (r.status === 401) throw new UnauthorizedError();
  if (!r.ok) throw new Error(`Server responded ${r.status}`);
  const body = (await r.json()) as { ok: boolean; added?: string[] };
  if (!body.ok) throw new Error("Server refused the request");
  return body.added ?? [];
}

/** Full database adapter backed by the NovaPOS API (requires sign-in). */
export const httpAdapter: DataAdapter = {
  load: async () => (await httpAdapter.loadEnvelope!()).db,
  loadEnvelope: async () => {
    const r = await api("/api/db");
    if (r.status === 401) throw new UnauthorizedError();
    if (!r.ok) throw new Error(`Server responded ${r.status}`);
    const body = (await r.json()) as { ok: boolean; db?: DB; rev?: number };
    if (!body.ok || !body.db || typeof body.rev !== "number") throw new Error("Malformed server response");
    return { db: body.db, rev: body.rev };
  },
  save: async (db, opts) => {
    try {
      const r = await api(
        "/api/db",
        {
          method: "PUT",
          body: JSON.stringify({
            db,
            baseRev: opts?.baseRev ?? null,
            mode: opts?.mode ?? "merge",
          }),
        },
        20000
      );
      if (r.status === 401) throw new UnauthorizedError();
      if (!r.ok) {
        console.error("[server] save failed:", r.status);
        return null;
      }
      const body = (await r.json()) as { ok: boolean; db?: DB; rev?: number };
      if (!body.ok || !body.db || typeof body.rev !== "number") return null;
      return { db: body.db, rev: body.rev };
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      console.error("[server] save failed", err);
      return null;
    }
  },
};

// ── Public customer-ordering endpoints (used by the phone page) ─────────────
export interface PublicConfig {
  businessName: string;
  logo?: string;
  currencySymbol: string;
  taxEnabled: boolean;
  taxRate: number;
  qr: {
    enabled: boolean;
    serviceMode: "counter" | "table";
    allowName: boolean;
    allowPhone: boolean;
    allowNotes: boolean;
    instructions: string;
  };
  /** Display label for where this order is going (table/counter name). */
  locationLabel: string | null;
  /** False when the scanned code doesn't exist, was paused, or its location is inactive. */
  codeValid: boolean;
  products: Array<{
    id: string;
    name: string;
    price: number;
    category: string;
    description?: string;
    image?: string;
    stock: number;
    lowStockThreshold: number;
  }>;
}

export async function fetchPublicConfig(codeId: string | null): Promise<PublicConfig> {
  const q = codeId ? `?code=${encodeURIComponent(codeId)}` : "";
  const r = await api(`/api/public/config${q}`);
  if (!r.ok) throw new Error(`Server responded ${r.status}`);
  return (await r.json()) as PublicConfig;
}

export interface PublicOrderView {
  id: string;
  number: string;
  locationLabel?: string;
  status: QrOrderStatus;
  createdAt: string;
  readyAt?: string;
  completedAt?: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  items: Array<{ productId: string; name: string; qty: number; price: number; lineDiscount: number }>;
  customerName?: string;
  note?: string;
}

export async function postPublicOrder(input: {
  qrCodeId: string | null;
  sessionId: string;
  items: Array<{ productId: string; qty: number }>;
  customerName?: string;
  customerPhone?: string;
  note?: string;
}): Promise<PublicOrderView> {
  const r = await api("/api/public/orders", { method: "POST", body: JSON.stringify(input) }, 15000);
  const body = (await r.json()) as { ok: boolean; error?: string; value?: PublicOrderView };
  if (!r.ok || !body.ok || !body.value) throw new Error(body.error ?? "Could not place the order.");
  return body.value;
}

export async function fetchSessionOrders(sessionId: string): Promise<PublicOrderView[]> {
  const r = await api(`/api/public/orders?session=${encodeURIComponent(sessionId)}`);
  if (!r.ok) return [];
  return (await r.json()) as PublicOrderView[];
}

export async function cancelPublicOrder(orderId: string, sessionId: string): Promise<void> {
  // Query-param form (not /orders/:id) so cancelling works even on
  // deployments where the bracketed catch-all route file is unavailable.
  const r = await api(
    `/api/public/orders?id=${encodeURIComponent(orderId)}&session=${encodeURIComponent(sessionId)}`,
    { method: "DELETE" }
  );
  const body = (await r.json()) as { ok: boolean; error?: string };
  if (!r.ok || !body.ok) throw new Error(body.error ?? "Could not cancel the order.");
}
