/**
 * NovaPOS shared API core -- one request handler used by BOTH:
 *   - server/index.ts   (local single-process server, LAN mode)
 *   - api/[...path].ts  (Vercel serverless function, production)
 *
 * Everything stateful lives in the injected DbStore (Postgres or file), so
 * this handler is safe under serverless cold starts. Auth tokens are signed
 * (stateless HMAC) rather than kept in memory for the same reason.
 *
 * Conflict safety: staff devices send their last-seen revision (baseRev) when
 * saving. If phone orders arrived in the meantime, the server merges instead
 * of overwriting -- new orders survive, stock reservations are re-applied,
 * and the authoritative merged database is returned to the device.
 */
import crypto from "node:crypto";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { DB, QrOrder } from "../src/lib/types.js";
import { normalizeDB } from "../src/lib/storage.js";
import { applyPlaceQrOrder, logActivity, recordMovement } from "../src/lib/qrOrderCore.js";
import type { DbStore } from "./store.js";
import { chooseChatStore, chooseStore, databaseUrl, describeStorage, type ChatMessageRow } from "./store.js";
import { newMediaId, normalizeVoiceMime, readVoice, saveVoice, VOICE_MAX_BYTES, voiceBackend } from "./voicestore.js";

/**
 * QR codes printed on posters are permanent physical objects -- their ids must
 * always resolve on the server. This guarantee is ADDITIVE and idempotent:
 * existing codes are never modified, paused or deleted; only missing standard
 * ids are appended. Run when a database is seeded or wholesale-uploaded so a
 * migrated business can never lose its printed tables.
 */
const STANDARD_QR_CODES: Array<{ id: string; label: string }> = [
  { id: "qr_table_1", label: "Table 1" },
  { id: "qr_table_2", label: "Table 2" },
  { id: "qr_counter", label: "Counter" },
];

export function ensureStandardQrCodes(db: DB): string[] {
  const added: string[] = [];
  const now = new Date().toISOString();
  for (const std of STANDARD_QR_CODES) {
    if (!db.qrCodes.some((q) => q.id === std.id)) {
      db.qrCodes.push({ id: std.id, label: std.label, active: true, createdAt: now, scans: 0 });
      added.push(std.id);
    }
  }
  return added;
}

// -- Staff chat & presence ----------------------------------------------------
// Customers have no access to any /api/chat/* route: every one of them starts
// with the same token check as the rest of the staff API, and none of them is
// reachable from the public ordering endpoints.
const CHAT_ONLINE_MS = 25_000; // missed heartbeats longer than this â†’ offline
const CHAT_AWAY_MS = 90_000; // no reported activity for this long â†’ away

type PresenceStatus = "online" | "away" | "offline";
function chatStatusOf(p: { lastBeatAt: number; lastActiveAt: number }, now: number): PresenceStatus {
  if (now - p.lastBeatAt > CHAT_ONLINE_MS) return "offline";
  if (now - p.lastActiveAt > CHAT_AWAY_MS) return "away";
  return "online";
}

/** Validate + normalize a chat channel for THIS user. DM channels are only
 *  usable by their two participants â€” everyone else gets null. */
function parseChatChannel(raw: string | null | undefined, meId: string): string | null {
  if (!raw) return null;
  if (raw === "staff") return "staff";
  const m = /^dm:([^:\s]+):([^:\s]+)$/.exec(raw);
  if (!m) return null;
  const [, a, b] = m;
  if (a === b || (a !== meId && b !== meId)) return null;
  return `dm:${[a, b].sort().join(":")}`;
}

/** One chat store per server process / warm lambda instance. */
let chatStoreInstance: ReturnType<typeof chooseChatStore> | null = null;
function chatStore(): ReturnType<typeof chooseChatStore> {
  if (!chatStoreInstance) chatStoreInstance = chooseChatStore();
  return chatStoreInstance;
}

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // stateless tokens cannot slide, so keep them long-lived
const BODY_LIMIT = 20 * 1024 * 1024; // note: Vercel caps request bodies at ~4.5 MB

// -- Signing secret -----------------------------------------------------------
// NOVAPOS_SECRET env var is preferred. Fallbacks, in order:
//   1. data/secret.key persisted next to the local file DB
//   2. deterministic key derived from the database URL (serverless safe)
let secretCache: string | null = null;

async function signingSecret(): Promise<string> {
  if (secretCache) return secretCache;
  const explicit = process.env.NOVAPOS_SECRET;
  if (explicit && explicit.length >= 8) {
    secretCache = explicit;
    return secretCache;
  }
  const dbUrl = databaseUrl();
  if (!dbUrl) {
    try {
      const fsMod = await import("node:fs/promises");
      const pathMod = await import("node:path");
      const dir = pathMod.join(process.cwd(), "data");
      const keyFile = pathMod.join(dir, "secret.key");
      const existing = await fsMod.readFile(keyFile, "utf8").catch(() => null);
      if (existing && existing.trim().length >= 8) {
        secretCache = existing.trim();
        return secretCache;
      }
      const generated = crypto.randomBytes(32).toString("hex");
      await fsMod.mkdir(dir, { recursive: true });
      await fsMod.writeFile(keyFile, generated, "utf8");
      secretCache = generated;
      return secretCache;
    } catch {
      /* fall through to derived key */
    }
  }
  secretCache = crypto.createHash("sha256").update(`novapos:${dbUrl}`).digest("hex");
  return secretCache;
}

async function issueToken(employeeId: string): Promise<string> {
  const payload = Buffer.from(JSON.stringify({ sub: employeeId, exp: Date.now() + TOKEN_TTL_MS })).toString("base64url");
  const sig = crypto.createHmac("sha256", await signingSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

async function tokenEmployeeId(req: IncomingMessage): Promise<string | null> {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", await signingSecret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let parsed: { sub?: string; exp?: number };
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed.sub || typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null;
  return parsed.sub;
}

// -- Helpers ------------------------------------------------------------------
export function json(res: ServerResponse, status: number, body: unknown, extraHeaders?: Record<string, string>): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, If-None-Match, X-NovaPOS-Rev",
    "Access-Control-Expose-Headers": "ETag",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    ...extraHeaders,
  });
  res.end(JSON.stringify(body));
}

export function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > BODY_LIMIT) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : null);
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

/** Raw binary body reader for voice uploads — drains oversized bodies
 *  gracefully so the route can still answer with a proper 413 instead of
 *  resetting the connection mid-request. */
function readRawBody(req: IncomingMessage, limitBytes: number): Promise<{ ok: true; data: Buffer } | { ok: false }> {
  return new Promise((resolve) => {
    let size = 0;
    let over = false;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      if (over) return; // keep draining, discard
      size += c.length;
      if (size > limitBytes) {
        over = true;
        chunks.length = 0;
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(over ? { ok: false } : { ok: true, data: Buffer.concat(chunks) }));
    req.on("error", () => resolve({ ok: false }));
  });
}

function publicMenu(db: DB) {
  return {
    businessName: db.settings.businessName,
    logo: db.settings.logo,
    currencySymbol: db.settings.currencySymbol,
    qr: {
      enabled: db.settings.qr.enabled,
      serviceMode: db.settings.qr.serviceMode,
      allowName: db.settings.qr.allowName,
      allowPhone: db.settings.qr.allowPhone,
      allowNotes: db.settings.qr.allowNotes,
      instructions: db.settings.qr.instructions,
    },
    products: db.products
      .filter((p) => p.status === "active")
      .map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        category: p.category,
        description: p.description,
        image: p.image,
        stock: p.stock,
        lowStockThreshold: p.lowStockThreshold,
      })),
  };
}

function customerView(o: QrOrder) {
  return {
    id: o.id,
    number: o.number,
    locationLabel: o.locationLabel,
    status: o.status,
    createdAt: o.createdAt,
    readyAt: o.readyAt,
    completedAt: o.completedAt,
    subtotal: o.subtotal,
    discount: o.discount,
    tax: o.tax,
    total: o.total,
    items: o.items.map((i) => ({
      productId: i.productId,
      name: i.name,
      qty: i.qty,
      price: i.price,
      lineDiscount: i.lineDiscount,
    })),
    customerName: o.customerName,
    note: o.note,
  };
}

// -- Conflict-safe merge ------------------------------------------------------
// The saving client was working from an older snapshot. Instead of letting it
// wipe newer server-side changes (phone orders!), weave them back in.
function orderTime(o: QrOrder): number {
  return Date.parse(o.updatedAt ?? o.createdAt) || 0;
}

const ACTIVE_QR_STATUSES = new Set(["new", "accepted", "preparing", "ready"]);

export function mergeDbs(current: DB, incoming: DB, mode: "merge" | "replace"): DB {
  if (mode === "replace") return structuredClone(incoming);

  const merged = structuredClone(incoming);

  // QR orders: newest edit wins per order id; orders only on the server
  // (placed by phones after this client's last sync) are preserved as-is.
  const incOrders = new Map(merged.qrOrders.map((o) => [o.id, o]));
  for (const srv of current.qrOrders) {
    const inc = incOrders.get(srv.id);
    if (!inc) merged.qrOrders.push(structuredClone(srv));
    else if (orderTime(srv) > orderTime(inc)) Object.assign(inc, structuredClone(srv));
  }

  // Append-only collections: union by id so nothing written server-side in
  // the meantime is lost (notifications, history, sales, customers).
  const unionIds = (
    key: "notifications" | "activityLog" | "stockHistory" | "transactions" | "customers",
    cap?: number
  ): void => {
    const incIds = new Set(incoming[key].map((x) => x.id));
    const extra = current[key].filter((x) => !incIds.has(x.id));
    (merged[key] as Array<{ id: string }>) = [
      ...(incoming[key] as Array<{ id: string }>),
      ...extra,
    ] as typeof merged[typeof key];
    if (cap && merged[key].length > cap) merged[key].length = cap;
  };
  unionIds("notifications", 200);
  unionIds("activityLog", 1000);
  unionIds("stockHistory", 3000);
  unionIds("transactions");
  unionIds("customers");

  // Products: the client's edits win (prices/names/status), but stock must
  // account for phone-order reservations the client never saw. Re-apply the
  // outstanding reservation deltas of server-only orders on top.
  const reservedByProduct = new Map<string, number>();
  for (const o of current.qrOrders) {
    if (!incOrders.has(o.id) && ACTIVE_QR_STATUSES.has(o.status)) {
      for (const item of o.items) {
        reservedByProduct.set(item.productId, (reservedByProduct.get(item.productId) ?? 0) + item.qty);
      }
    }
  }
  if (reservedByProduct.size > 0) {
    for (const p of merged.products) {
      const reserve = reservedByProduct.get(p.id);
      if (reserve) p.stock = Math.max(0, p.stock - reserve);
    }
  }

  // Monotonic counters.
  merged.settings.nextQrNumber = Math.max(merged.settings.nextQrNumber ?? 1, current.settings.nextQrNumber ?? 1);

  return merged;
}

// -- Entry points ---------------------------------------------------------------
/**
 * Shared serverless entry used by api/[...path].ts AND the plain-named
 * wrapper files (api/public/config.ts etc.). The wrappers exist because some
 * deployment pipelines mangle bracket filenames like "[...path].ts", which
 * silently breaks every multi-segment API route; literal file names always
 * deploy correctly.
 */
/** Local data dir for the file-mode voice backend (dev/LAN only). */
const dataDir = (): string => path.join(process.cwd(), "data");

export async function serveApi(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const host = req.headers.host ?? "localhost";
    const url = new URL(req.url ?? "/api", `http://${host}`);
    await handleApiRequest(req, res, url, chooseStore());
  } catch (err) {
    console.error("[api]", (err as Error).message);
    if (!res.headersSent) {
      json(res, (err as Error).message === "Invalid JSON" || (err as Error).message === "Payload too large" ? 400 : 500, {
        ok: false,
        error: (err as Error).message,
      });
    }
  }
}

// -- Router -------------------------------------------------------------------
export async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  store: DbStore
): Promise<void> {
  const route = `${req.method} ${url.pathname}`;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    });
    res.end();
    return;
  }

  switch (route) {
    case "GET /api/health":
      // Deliberately touches no database -- must answer even when the DB is
      // unreachable, and reports which backend is configured for diagnostics.
      json(res, 200, { ok: true, server: true, storage: describeStorage(), time: new Date().toISOString() });
      return;

    case "GET /api/boot": {
      // Pre-login info only -- never includes PINs or sales data.
      const { db } = await store.get();
      json(res, 200, {
        businessName: db.settings.businessName,
        logo: db.settings.logo,
        theme: db.settings.theme,
        currencySymbol: db.settings.currencySymbol,
        employees: db.employees
          .filter((e) => e.status === "active")
          .map((e) => ({ id: e.id, name: e.name, username: e.username, role: e.role })),
      });
      return;
    }

    case "POST /api/session/login": {
      const body = (await readBody(req)) as { username?: string; pin?: string } | null;
      const user = String(body?.username ?? "").trim().toLowerCase();
      const pin = String(body?.pin ?? "").trim();
      const { db } = await store.get();
      const emp = db.employees.find(
        (e) => e.status === "active" && pin && e.pin === pin && (e.username.toLowerCase() === user || e.id === user)
      );
      if (!emp) {
        json(res, 401, { ok: false, error: "Wrong name or PIN." });
        return;
      }
      json(res, 200, { ok: true, token: await issueToken(emp.id), employeeId: emp.id, name: emp.name, role: emp.role });
      return;
    }

    case "GET /api/db": {
      const employeeId = await tokenEmployeeId(req);
      if (!employeeId) {
        json(res, 401, { ok: false, error: "Sign in required." });
        return;
      }
      const snap = await store.get();
      if (!snap.db.employees.some((e) => e.id === employeeId && e.status === "active")) {
        json(res, 401, { ok: false, error: "Sign in required." });
        return;
      }
      // Bandwidth short-circuit for the 4-second staff poll: if the client
      // already has this revision, reply with a tiny unchanged marker instead
      // of the full database.
      const knownRev = Number(req.headers["x-novapos-rev"]);
      if (Number.isFinite(knownRev) && knownRev >= 0 && knownRev === snap.rev) {
        json(res, 200, { ok: true, unchanged: true, rev: snap.rev });
        return;
      }
      json(res, 200, { ok: true, db: snap.db, rev: snap.rev });
      return;
    }

    case "PUT /api/db": {
      const employeeId = await tokenEmployeeId(req);
      if (!employeeId) {
        json(res, 401, { ok: false, error: "Sign in required." });
        return;
      }
      const body = (await readBody(req)) as { db?: unknown; baseRev?: unknown; mode?: unknown } | null;
      const rawDb = (body?.db ?? body) as Partial<DB> | null;
      // Refuse implausible payloads rather than normalizing them into an
      // empty database -- a malformed save must never be able to wipe data.
      if (
        !rawDb ||
        typeof rawDb !== "object" ||
        !Array.isArray(rawDb.products) ||
        !Array.isArray(rawDb.employees) ||
        typeof rawDb.settings !== "object"
      ) {
        json(res, 400, { ok: false, error: "Malformed database payload." });
        return;
      }
      const incoming = normalizeDB(rawDb);
      const baseRev = typeof body?.baseRev === "number" ? body.baseRev : null;
      const mode = body?.mode === "replace" ? "replace" : "merge";

      type PutReply = { ok: false; stale: boolean; rev: number } | { ok: true; rev: number };
      const result = await store.mutate<PutReply>((current, rev) => {
        // Stale-write protection: refuse merges based on ancient snapshots so
        // a forgotten open tab cannot resurrect long-deleted data. Replace
        // mode (explicit upload) and fresh clients are always allowed.
        if (mode === "merge" && baseRev !== null && rev - baseRev > 500) {
          return { db: current, changed: false, value: { ok: false, stale: true, rev } };
        }
        const merged = mergeDbs(current, incoming, mode);
        // Every accepted save re-guarantees the printed QR ids -- replace
        // uploads, normal merges, all of them -- so no snapshot taken before
        // the ids existed can ever push them out of the shared database.
        // Deliberately paused/deleted-custom codes are never touched; only
        // missing standard ids are recreated (active).
        const ensured = ensureStandardQrCodes(merged);
        if (ensured.length) {
          logActivity(merged, {
            type: "system",
            action: "Standard QR codes restored",
            detail: ensured.join(", "),
          });
        }
        return { db: merged, value: { ok: true, rev: rev + 1 } };
      });

      if (!result.value.ok) {
        json(res, 409, { ok: false, error: "This view is too far behind. Refresh the page.", stale: true });
        return;
      }
      const snap = await store.get();
      console.log(`[db] saved by ${employeeId} (rev ${snap.rev}, mode ${mode})`);
      json(res, 200, { ok: true, db: snap.db, rev: snap.rev });
      return;
    }

    case "GET /api/public/config": {
      // Self-healing for printed posters: if anything ever dropped one of the
      // permanently printed ids from the shared database (an old snapshot
      // saved before they existed, a manual restore, etc.), recreate it here
      // so wall codes can never go dead. Read-only while all three exist, so
      // the 6-second customer polling never writes. Only MISSING ids are
      // recreated -- a code staff deliberately paused stays paused.
      const pre = await store.get();
      if (STANDARD_QR_CODES.some((s) => !pre.db.qrCodes.some((q) => q.id === s.id))) {
        await store.mutate<string[]>((db) => {
          const added = ensureStandardQrCodes(db);
          if (added.length) {
            logActivity(db, {
              type: "system",
              action: "Standard QR codes restored",
              detail: `${added.join(", ")} (auto-heal on menu request)`,
            });
          }
          return { db, changed: added.length > 0, value: added };
        });
      }
      const { db } = await store.get();
      const codeId = url.searchParams.get("code");
      const code = codeId ? db.qrCodes.find((q) => q.id === codeId) ?? null : null;
      const payload = {
        ...publicMenu(db),
        taxEnabled: db.settings.taxEnabled,
        taxRate: db.settings.taxRate,
        locationLabel: code?.label ?? null,
        // A scanned code works only if it still exists and is active. Checked
        // server-side against the shared database -- never browser storage.
        codeValid: !!code && code.active,
      };
      // Menu polling happens every few seconds from every phone on site; an
      // ETag turns repeat polls of an unchanged menu into empty 304 replies.
      const etag = `"${crypto.createHash("sha1").update(JSON.stringify(payload)).digest("hex").slice(0, 20)}"`;
      if (req.headers["if-none-match"] === etag) {
        res.writeHead(304, { "Access-Control-Expose-Headers": "ETag", ETag: etag });
        res.end();
        return;
      }
      json(res, 200, payload, { ETag: etag });
      return;
    }

    case "POST /api/public/orders": {
      const body = (await readBody(req)) as Record<string, unknown> | null;
      const input = {
        qrCodeId: typeof body?.qrCodeId === "string" ? body.qrCodeId : null,
        sessionId: typeof body?.sessionId === "string" ? body.sessionId.slice(0, 64) : "",
        items: Array.isArray(body?.items)
          ? (body!.items as Array<Record<string, unknown>>)
              .filter((i) => typeof i?.productId === "string")
              .map((i) => ({ productId: String(i.productId), qty: Math.floor(Number(i.qty) || 0) }))
              .filter((i) => i.qty > 0)
          : [],
        customerName: typeof body?.customerName === "string" ? body.customerName.slice(0, 60) : undefined,
        customerPhone: typeof body?.customerPhone === "string" ? body.customerPhone.slice(0, 30) : undefined,
        note: typeof body?.note === "string" ? body.note.slice(0, 200) : undefined,
      };

      type PlaceReply = { ok: true; value: QrOrder } | { ok: false; error: string };
      const result = await store.mutate<PlaceReply>((db) => {
        const placed: PlaceReply = applyPlaceQrOrder(db, input);
        return { db, changed: placed.ok, value: placed };
      });

      if (!result.value.ok) {
        json(res, 400, result.value);
        return;
      }
      const order = result.value.value;
      console.log(`[order] ${order.number} Â· ${order.locationLabel ?? "walk-up"} Â· total ${order.total.toFixed(2)} (rev ${result.rev})`);
      json(res, 200, { ok: true, value: customerView(order) });
      return;
    }

    default: {
      if (req.method === "GET" && url.pathname === "/api/public/orders") {
        const sessionId = url.searchParams.get("session") ?? "";
        const { db } = await store.get();
        const orders = sessionId
          ? db.qrOrders.filter((o) => o.sessionId === sessionId).slice(0, 20).map(customerView)
          : [];
        json(res, 200, orders);
        return;
      }

      // Customer cancelling their own still-new order (session must match).
      // Accepts BOTH /api/public/orders/:id and /api/public/orders?id=:id --
      // the query-param form exists so deployments without a working
      // catch-all route (bracket filenames) can still cancel via the plain
      // api/public/orders.ts wrapper file.
      if (req.method === "DELETE" && (url.pathname === "/api/public/orders" || url.pathname.startsWith("/api/public/orders/"))) {
        const orderId = url.pathname.startsWith("/api/public/orders/")
          ? decodeURIComponent(url.pathname.slice("/api/public/orders/".length))
          : url.searchParams.get("id") ?? "";
        const sessionId = url.searchParams.get("session") ?? "";

        type CancelReply = { status: number; body: unknown };
        const outcome = await store.mutate<CancelReply>((db) => {
          const order = db.qrOrders.find((o) => o.id === orderId);
          if (!order || !sessionId || order.sessionId !== sessionId) {
            return { db, changed: false, value: { status: 404, body: { ok: false, error: "Order not found." } } };
          }
          if (order.status !== "new") {
            return {
              db,
              changed: false,
              value: {
                status: 409,
                body: { ok: false, error: "Staff have already started this order -- it can no longer be cancelled." },
              },
            };
          }
          order.status = "cancelled";
          order.updatedAt = new Date().toISOString();
          for (const item of order.items) {
            const product = db.products.find((p) => p.id === item.productId);
            if (!product) continue;
            product.stock += item.qty;
            recordMovement(db, {
              date: new Date().toISOString(),
              productId: product.id,
              productName: product.name,
              change: item.qty,
              reason: "qr-release",
              reference: `${order.number} cancelled by customer`,
              resultingStock: product.stock,
            });
          }
          logActivity(db, {
            type: "system",
            action: "Customer cancelled order",
            detail: `${order.number}${order.locationLabel ? ` Â· ${order.locationLabel}` : ""}`,
          });
          return { db, value: { status: 200, body: { ok: true } } };
        });

        json(res, outcome.value.status, outcome.value.body);
        return;
      }

      // Staff repair: guarantee printed QR ids exist server-side without a
      // full data re-upload (additive + idempotent).
      if (req.method === "POST" && url.pathname === "/api/staff/qr-codes/ensure") {
        const employeeId = await tokenEmployeeId(req);
        if (!employeeId) {
          json(res, 401, { ok: false, error: "Sign in required." });
          return;
        }
        type EnsureReply = { ok: true; added: string[] };
        const result = await store.mutate<EnsureReply>((db) => {
          const added = ensureStandardQrCodes(db);
          if (added.length) {
            logActivity(db, { type: "system", action: "Standard QR codes restored", detail: added.join(", ") });
          }
          return { db, changed: added.length > 0, value: { ok: true, added } };
        });
        json(res, 200, result.value);
        return;
      }

      // â”€â”€ Staff chat & presence (authenticated staff only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // Heartbeat: refreshes my presence and returns the full lightweight
      // chat snapshot â€” presence list, per-channel unread counts, active
      // typers. This is the ONLY recurring chat request; it never ships
      // message bodies or any business data.
      if (req.method === "POST" && url.pathname === "/api/chat/heartbeat") {
        const employeeId = await tokenEmployeeId(req);
        if (!employeeId) {
          json(res, 401, { ok: false, error: "Sign in required." });
          return;
        }
        const snap = await store.get();
        const emp = snap.db.employees.find((e) => e.id === employeeId && e.status === "active");
        if (!emp) {
          json(res, 401, { ok: false, error: "Sign in required." });
          return;
        }
        const beatBody = (await readBody(req).catch(() => null)) as { activeNow?: unknown } | null;
        await chatStore().heartbeat({ id: emp.id, name: emp.name, role: emp.role }, beatBody?.activeNow === true);
        const now = Date.now();
        const rows = await chatStore().presence();
        const activeIds = new Set(snap.db.employees.filter((e) => e.status === "active").map((e) => e.id));
        const presence = rows
          .filter((p) => activeIds.has(p.employeeId))
          .map((p) => ({
            id: p.employeeId,
            name: p.name,
            role: p.role,
            status: chatStatusOf(p, now),
            lastSeenAt: p.lastSeenAt,
          }));
        const unread = await chatStore().unreadCounts(employeeId);
        const typing = (await chatStore().typing())
          .filter((t) => t.employeeId !== employeeId && t.untilAt > now && activeIds.has(t.employeeId))
          .map((t) => ({ employeeId: t.employeeId, channel: t.channel }));
        const meRow = rows.find((r) => r.employeeId === employeeId);
        json(res, 200, {
          ok: true,
          serverTime: now,
          myStatus: meRow ? chatStatusOf(meRow, now) : "online",
          presence,
          unread,
          typing,
          // Voice notes need object storage (Vercel Blob in production, local
          // disk in dev). Clients hide the mic button when this is false.
          voice: voiceBackend() !== "none",
        });
        return;
      }

      // Explicit sign-out: go offline immediately instead of waiting out the
      // heartbeat timeout.
      if (req.method === "POST" && url.pathname === "/api/chat/leave") {
        const employeeId = await tokenEmployeeId(req);
        if (!employeeId) {
          json(res, 401, { ok: false, error: "Sign in required." });
          return;
        }
        await chatStore().leave(employeeId);
        json(res, 200, { ok: true });
        return;
      }

      // ── Voice notes (staff-only, authenticated, membership-checked) ──────
      // Upload the audio bytes; the message row referencing them is created
      // separately by POST /api/chat/messages. Bytes go to object storage
      // (Vercel Blob) or local disk — never into Postgres.
      if (req.method === "POST" && url.pathname === "/api/chat/voice") {
        const employeeId = await tokenEmployeeId(req);
        if (!employeeId) {
          json(res, 401, { ok: false, error: "Sign in required." });
          return;
        }
        if (voiceBackend() === "none") {
          json(res, 501, { ok: false, error: "Voice storage is not configured on this deployment." });
          return;
        }
        const mime = normalizeVoiceMime(req.headers["x-novapos-voice-mime"] as string | undefined);
        const raw = await readRawBody(req, VOICE_MAX_BYTES);
        if (!raw.ok) {
          json(res, 413, { ok: false, error: "Voice note too large." });
          return;
        }
        const data = raw.data;
        if (data.length < 512) {
          json(res, 400, { ok: false, error: "Recording is empty." });
          return;
        }
        const mediaId = newMediaId(employeeId);
        try {
          await saveVoice(dataDir(), mediaId, data, mime);
        } catch {
          json(res, 502, { ok: false, error: "Could not store the recording." });
          return;
        }
        json(res, 200, { ok: true, mediaId, bytes: data.length, mime });
        return;
      }

      // Stream a voice note back. Same access rules as chat messages: staff
      // token required, and for DMs you must be a participant. The blob URL,
      // when object storage is used, never reaches the client — bytes are
      // proxied through this authenticated endpoint.
      if (req.method === "GET" && url.pathname.startsWith("/api/chat/voice/")) {
        const employeeId = await tokenEmployeeId(req);
        if (!employeeId) {
          json(res, 401, { ok: false, error: "Sign in required." });
          return;
        }
        const mediaId = decodeURIComponent(url.pathname.slice("/api/chat/voice/".length));
        if (!/^[A-Za-z0-9._:-]+$/.test(mediaId)) {
          json(res, 400, { ok: false, error: "Invalid media id." });
          return;
        }
        const owner = await chatStore().messageByMediaId(mediaId);
        if (!owner || !parseChatChannel(owner.channel, employeeId)) {
          json(res, owner ? 403 : 404, { ok: false, error: owner ? "Not allowed." : "Not found." });
          return;
        }
        const file = await readVoice(dataDir(), mediaId);
        if (!file) {
          json(res, 404, { ok: false, error: "Audio missing." });
          return;
        }
        res.writeHead(200, {
          "Content-Type": file.mime,
          "Content-Length": file.data.length,
          "Cache-Control": "private, max-age=86400",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(file.data);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/chat/messages") {
        const employeeId = await tokenEmployeeId(req);
        if (!employeeId) {
          json(res, 401, { ok: false, error: "Sign in required." });
          return;
        }
        const channel = parseChatChannel(url.searchParams.get("channel"), employeeId);
        if (!channel) {
          json(res, 400, { ok: false, error: "Invalid channel." });
          return;
        }
        const limitRaw = Math.floor(Number(url.searchParams.get("limit") ?? 50));
        const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 100);
        const afterRaw = url.searchParams.get("after");
        const beforeRaw = url.searchParams.get("before");
        let msgs: ChatMessageRow[];
        let hasMore = false;
        if (afterRaw !== null && Number.isFinite(Number(afterRaw))) {
          // Incremental poll: only messages newer than what I already have.
          msgs = await chatStore().messagesAfter(channel, Number(afterRaw), limit + 1);
          hasMore = msgs.length > limit;
          if (hasMore) msgs = msgs.slice(0, limit);
        } else if (beforeRaw !== null && Number.isFinite(Number(beforeRaw))) {
          // Scrollback pagination: the page older than a known message.
          const page = await chatStore().messagesBefore(channel, Number(beforeRaw), limit + 1);
          hasMore = page.length > limit;
          msgs = (hasMore ? page.slice(0, limit) : page); // ascending
        } else {
          const latest = await chatStore().latestMessages(channel, limit);
          msgs = latest.msgs;
          hasMore = latest.hasMore;
        }
        const reads = await chatStore().readsFor(channel);
        const minOtherRead = reads
          .filter((r) => r.employeeId !== employeeId)
          .reduce((min, r) => Math.min(min, r.lastReadSeq), Number.MAX_SAFE_INTEGER);
        json(res, 200, {
          ok: true,
          messages: msgs,
          hasMore,
          othersReadUpTo: minOtherRead === Number.MAX_SAFE_INTEGER ? 0 : minOtherRead,
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/chat/messages") {
        const employeeId = await tokenEmployeeId(req);
        if (!employeeId) {
          json(res, 401, { ok: false, error: "Sign in required." });
          return;
        }
        const snap = await store.get();
        const emp = snap.db.employees.find((e) => e.id === employeeId && e.status === "active");
        if (!emp) {
          json(res, 401, { ok: false, error: "Sign in required." });
          return;
        }
        const sendBody = (await readBody(req)) as {
          channel?: unknown;
          body?: unknown;
          kind?: unknown;
          mediaId?: unknown;
          mediaMime?: unknown;
          durationMs?: unknown;
          mediaBytes?: unknown;
        } | null;
        const channel = parseChatChannel(typeof sendBody?.channel === "string" ? sendBody.channel : null, employeeId);
        const rawText = typeof sendBody?.body === "string" ? sendBody.body.trim() : "";
        const isVoice = sendBody?.kind === "voice";

        // Voice messages: metadata only. The media id is bound to its uploader
        // (`<employeeId>:<random>`), so a client can never attach another
        // staff member's recording to their own message.
        let media: Pick<ChatMessageRow, "kind" | "mediaId" | "mediaMime" | "durationMs" | "mediaBytes"> | undefined;
        if (isVoice) {
          const mid = typeof sendBody?.mediaId === "string" ? sendBody.mediaId : "";
          if (!channel || !mid.startsWith(`${employeeId}:`) || !/^[A-Za-z0-9._:-]+$/.test(mid)) {
            json(res, 400, { ok: false, error: "Invalid voice attachment." });
            return;
          }
          const dur = Math.floor(Number(sendBody?.durationMs));
          media = {
            kind: "voice",
            mediaId: mid,
            mediaMime: normalizeVoiceMime(typeof sendBody?.mediaMime === "string" ? sendBody.mediaMime : undefined),
            durationMs: Number.isFinite(dur) ? Math.min(Math.max(dur, 0), 300_000) : undefined,
            mediaBytes: Math.min(Math.max(Math.floor(Number(sendBody?.mediaBytes)) || 0, 0), VOICE_MAX_BYTES) || undefined,
          };
        }

        // Text messages reject rather than silently truncate: a cut-off
        // message would read as complete to the recipients. Voice rows may
        // have an empty body (the audio IS the content).
        if (!channel || (!isVoice && (!rawText || rawText.length > 2000))) {
          json(res, 400, {
            ok: false,
            error: !isVoice && rawText.length > 2000 ? "Message too long (max 2000 characters)." : "Invalid message.",
          });
          return;
        }
        const message = await chatStore().insertMessage(channel, employeeId, emp.name, rawText, media);
        // Sending implies having read the conversation up to this point.
        await chatStore().setRead(employeeId, channel, message.seq);
        json(res, 200, { ok: true, message });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/chat/read") {
        const employeeId = await tokenEmployeeId(req);
        if (!employeeId) {
          json(res, 401, { ok: false, error: "Sign in required." });
          return;
        }
        const readReq = (await readBody(req)) as { channel?: unknown; upToSeq?: unknown } | null;
        const channel = parseChatChannel(typeof readReq?.channel === "string" ? readReq.channel : null, employeeId);
        const upToSeq = Math.max(0, Math.floor(Number(readReq?.upToSeq ?? 0)));
        if (!channel || !Number.isFinite(upToSeq)) {
          json(res, 400, { ok: false, error: "Invalid request." });
          return;
        }
        await chatStore().setRead(employeeId, channel, upToSeq);
        json(res, 200, { ok: true });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/chat/typing") {
        const employeeId = await tokenEmployeeId(req);
        if (!employeeId) {
          json(res, 401, { ok: false, error: "Sign in required." });
          return;
        }
        const typeBody = (await readBody(req)) as { channel?: unknown } | null;
        const channel = parseChatChannel(typeof typeBody?.channel === "string" ? typeBody.channel : null, employeeId);
        if (!channel) {
          json(res, 400, { ok: false, error: "Invalid channel." });
          return;
        }
        await chatStore().setTyping(employeeId, channel, Date.now() + 6000);
        json(res, 200, { ok: true });
        return;
      }

      json(res, 404, { ok: false, error: "Not found" });
    }
  }
}
