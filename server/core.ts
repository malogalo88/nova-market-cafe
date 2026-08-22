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
import type { IncomingMessage, ServerResponse } from "node:http";
import type { DB, QrOrder } from "../src/lib/types.js";
import { normalizeDB } from "../src/lib/storage.js";
import { applyPlaceQrOrder, logActivity, recordMovement } from "../src/lib/qrOrderCore.js";
import type { DbStore } from "./store.js";
import { databaseUrl, describeStorage } from "./store.js";

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
export function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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
        // Wholesale uploads (browser migration) always re-guarantee printed
        // QR ids so an uploaded dataset without codes cannot break posters.
        const ensured = mode === "replace" ? ensureStandardQrCodes(merged) : [];
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
      const { db } = await store.get();
      const codeId = url.searchParams.get("code");
      const code = codeId ? db.qrCodes.find((q) => q.id === codeId) ?? null : null;
      json(res, 200, {
        ...publicMenu(db),
        taxEnabled: db.settings.taxEnabled,
        taxRate: db.settings.taxRate,
        locationLabel: code?.label ?? null,
        // A scanned code works only if it still exists and is active. Checked
        // server-side against the shared database -- never browser storage.
        codeValid: !!code && code.active,
      });
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
      console.log(`[order] ${order.number} · ${order.locationLabel ?? "walk-up"} · total ${order.total.toFixed(2)} (rev ${result.rev})`);
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
      if (req.method === "DELETE" && url.pathname.startsWith("/api/public/orders/")) {
        const orderId = decodeURIComponent(url.pathname.slice("/api/public/orders/".length));
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
            detail: `${order.number}${order.locationLabel ? ` · ${order.locationLabel}` : ""}`,
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

      json(res, 404, { ok: false, error: "Not found" });
    }
  }
}
