/**
 * NovaPOS database store — pluggable persistence for the shared backend.
 *
 * Both the local server (server/index.ts) and the Vercel serverless function
 * (api/[...path].ts) talk to the same tiny interface:
 *
 *   get()               → { db, rev }   (seeds demo data when empty)
 *   mutate(fn)          → { value, rev } (fn runs against the latest db under
 *                                          a write lock; returns what changed)
 *
 * Two implementations:
 *  • PgStore    — a single JSONB row in any Postgres database (Neon / Vercel
 *                 Postgres / Supabase / Railway…). Row-level lock inside a
 *                 transaction makes every mutation atomic, which is what lets
 *                 phones and staff devices share data safely. Selected
 *                 automatically when POSTGRES_URL or DATABASE_URL is set.
 *  • FileStore  — data/db.json with serialized atomic writes. Local LAN /
 *                 offline mode, unchanged behaviour.
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import pg from "pg";
import type { DB } from "../src/lib/types";
import { buildDemoDB } from "../src/lib/seed";
import { normalizeDB } from "../src/lib/storage";

export interface DbSnapshot {
  db: DB;
  rev: number;
}

export interface MutationOutcome<T> {
  /** Return the (possibly mutated) db. Required so callers always clone first. */
  db: DB;
  /** Set false to skip persisting (e.g. validation failed). Default true. */
  changed?: boolean;
  /** Whatever the endpoint should reply with. */
  value: T;
}

export interface DbStore {
  get(): Promise<DbSnapshot>;
  mutate<T>(fn: (db: DB, rev: number) => MutationOutcome<T>): Promise<{ value: T; rev: number }>;
}

const ROW_ID = "app";

/** Pick the right store for this environment. */
export function chooseStore(dataDir?: string): DbStore {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL || "";
  if (url) {
    console.log("[store] using Postgres database");
    return new PgStore(url);
  }
  console.log("[store] no database URL set — using local file storage (single-device/LAN mode)");
  return new FileStore(path.join(dataDir ?? path.join(process.cwd(), "data"), "db.json"));
}

// ── Postgres ────────────────────────────────────────────────────────────────
export class PgStore implements DbStore {
  private pool: pg.Pool;
  private ready: Promise<void> | null = null;

  constructor(connectionString: string) {
    // Cache one pool per process/lambda instance (survives warm invocations).
    const g = globalThis as unknown as { __novaposPool?: pg.Pool };
    if (!g.__novaposPool) {
      const secure = !/localhost|127\.0\.0\.1/.test(connectionString);
      g.__novaposPool = new pg.Pool({
        connectionString,
        max: 3,
        ssl: secure ? { rejectUnauthorized: false } : undefined,
      });
    }
    this.pool = g.__novaposPool;
  }

  private ensureReady(): Promise<void> {
    if (!this.ready) {
      this.ready = (async () => {
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS novapos_state (
            id TEXT PRIMARY KEY,
            rev BIGINT NOT NULL DEFAULT 0,
            data JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `);
      })();
    }
    return this.ready;
  }

  private async seedIfEmpty(client: { query: (text: string, values?: unknown[]) => Promise<unknown> }): Promise<void> {
    await client.query(
      `INSERT INTO novapos_state (id, rev, data) VALUES ($1, 1, $2::jsonb) ON CONFLICT (id) DO NOTHING`,
      [ROW_ID, JSON.stringify(buildDemoDB())]
    );
  }

  async get(): Promise<DbSnapshot> {
    await this.ensureReady();
    let r = await this.pool.query<{ rev: string | number; data: DB }>(
      `SELECT rev, data FROM novapos_state WHERE id = $1`,
      [ROW_ID]
    );
    if (r.rowCount === 0) {
      await this.seedIfEmpty(this.pool);
      r = await this.pool.query(`SELECT rev, data FROM novapos_state WHERE id = $1`, [ROW_ID]);
    }
    return { db: normalizeDB(r.rows[0].data), rev: Number(r.rows[0].rev) };
  }

  async mutate<T>(fn: (db: DB, rev: number) => MutationOutcome<T>): Promise<{ value: T; rev: number }> {
    await this.ensureReady();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      let r = await client.query<{ rev: string | number; data: DB }>(
        `SELECT rev, data FROM novapos_state WHERE id = $1 FOR UPDATE`,
        [ROW_ID]
      );
      if (r.rowCount === 0) {
        await this.seedIfEmpty(client);
        r = await client.query(`SELECT rev, data FROM novapos_state WHERE id = $1 FOR UPDATE`, [ROW_ID]);
      }
      const currentRev = Number(r.rows[0].rev);
      const outcome = fn(normalizeDB(r.rows[0].data), currentRev);
      let newRev = currentRev;
      if (outcome.changed !== false) {
        newRev = currentRev + 1;
        await client.query(
          `UPDATE novapos_state SET data = $2::jsonb, rev = $3, updated_at = now() WHERE id = $1`,
          [ROW_ID, JSON.stringify(outcome.db), newRev]
        );
      }
      await client.query("COMMIT");
      return { value: outcome.value, rev: newRev };
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
}

// ── Local file ──────────────────────────────────────────────────────────────
interface FileWrapper {
  v: 1;
  rev: number;
  data: DB;
}

export class FileStore implements DbStore {
  private file: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(file: string) {
    this.file = file;
  }

  private readRaw(): Promise<FileWrapper | null> {
    return fs
      .readFile(this.file, "utf8")
      .then((raw) => {
        const parsed = JSON.parse(raw) as Partial<FileWrapper>;
        // Legacy files written by earlier versions were the bare DB document.
        if (!parsed || typeof parsed !== "object" || parsed.v !== 1 || !("data" in parsed)) {
          return { v: 1 as const, rev: 1, data: normalizeDB(parsed) };
        }
        return { v: 1 as const, rev: Number(parsed.rev) || 1, data: normalizeDB(parsed.data) };
      })
      .catch(() => null);
  }

  private writeRaw(wrapper: FileWrapper): Promise<void> {
    return this.queue.then(async () => {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.${crypto.randomBytes(4).toString("hex")}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(wrapper), "utf8");
      await fs.rename(tmp, this.file);
    });
  }

  async get(): Promise<DbSnapshot> {
    const raw = await this.readRaw();
    if (raw) return { db: raw.data, rev: raw.rev };
    const fresh: FileWrapper = { v: 1, rev: 1, data: buildDemoDB() };
    await this.writeRaw(fresh);
    return { db: fresh.data, rev: fresh.rev };
  }

  mutate<T>(fn: (db: DB, rev: number) => MutationOutcome<T>): Promise<{ value: T; rev: number }> {
    // Serialize every read-modify-write through one queue. NOTE: the file
    // write happens inline here -- we are already inside the queued task, so
    // awaiting this.queue again would deadlock on ourselves.
    const run = this.queue.then(async () => {
      const raw = await this.readRaw();
      const rev = raw?.rev ?? 1;
      const outcome = fn(raw ? structuredClone(raw.data) : buildDemoDB(), rev);
      if (outcome.changed !== false) {
        await fs.mkdir(path.dirname(this.file), { recursive: true });
        const tmp = `${this.file}.${crypto.randomBytes(4).toString("hex")}.tmp`;
        await fs.writeFile(tmp, JSON.stringify({ v: 1, rev: rev + 1, data: outcome.db }), "utf8");
        await fs.rename(tmp, this.file);
        return { value: outcome.value, rev: rev + 1 };
      }
      return { value: outcome.value, rev };
    });
    this.queue = run.catch(() => {}); // keep the chain alive on errors
    return run;
  }
}
