/**
 * NovaPOS database store Ã¢â‚¬â€ pluggable persistence for the shared backend.
 *
 * Both the local server (server/index.ts) and the Vercel serverless function
 * (api/[...path].ts) talk to the same tiny interface:
 *
 *   get()               Ã¢â€ â€™ { db, rev }   (seeds demo data when empty)
 *   mutate(fn)          Ã¢â€ â€™ { value, rev } (fn runs against the latest db under
 *                                          a write lock; returns what changed)
 *
 * Two implementations:
 *  Ã¢â‚¬Â¢ PgStore    Ã¢â‚¬â€ a single JSONB row in any Postgres database (Neon / Vercel
 *                 Postgres / Supabase / RailwayÃ¢â‚¬Â¦). Row-level lock inside a
 *                 transaction makes every mutation atomic, which is what lets
 *                 phones and staff devices share data safely. Selected
 *                 automatically when POSTGRES_URL or DATABASE_URL is set.
 *  Ã¢â‚¬Â¢ FileStore  Ã¢â‚¬â€ data/db.json with serialized atomic writes. Local LAN /
 *                 offline mode, unchanged behaviour.
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import pg from "pg";
import type { DB } from "../src/lib/types.js";
import { buildDemoDB } from "../src/lib/seed.js";
import { normalizeDB } from "../src/lib/storage.js";

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

/** Every connection-string env var we accept. Vercel's Neon/Postgres
 * integrations inject several names depending on how the database was added;
 * accepting the common ones means "connect database -> it just works". */
const PG_ENV_VARS = ["POSTGRES_URL", "DATABASE_URL", "POSTGRESQL_URL"] as const;

function firstPgEnv(): { url: string; source: string } {
  for (const name of PG_ENV_VARS) {
    const v = process.env[name];
    if (v && v.trim()) return { url: v.trim(), source: name };
  }
  return { url: "", source: "" };
}

/** Same lookup chooseStore uses Ã¢â‚¬â€ shared with the token-signing secret logic. */
export function databaseUrl(): string {
  return firstPgEnv().url;
}

/** Pick the right store for this environment. */
export function chooseStore(dataDir?: string): DbStore {
  const { url, source } = firstPgEnv();
  if (url) {
    console.log(`[store] using Postgres database (from ${source})`);
    return new PgStore(url);
  }
  console.log("[store] no database URL set Ã¢â‚¬â€ using local file storage (single-device/LAN mode)");
  return new FileStore(path.join(dataDir ?? path.join(process.cwd(), "data"), "db.json"));
}

/** Which backend will chooseStore() pick? For diagnostics only. */
export function describeStorage(): "postgres" | "file" {
  return firstPgEnv().url ? "postgres" : "file";
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Shared Postgres pool Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function sharedPgPool(connectionString: string): pg.Pool {
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
  return g.__novaposPool;
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Postgres Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
export class PgStore implements DbStore {
  private pool: pg.Pool;
  private ready: Promise<void> | null = null;

  constructor(connectionString: string) {
    this.pool = sharedPgPool(connectionString);
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

// Ã¢â€â‚¬Ã¢â€â‚¬ Local file Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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

// Ã¢â€â‚¬Ã¢â€â‚¬ Staff chat & presence Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
//
// Chat deliberately lives OUTSIDE the main business-JSON blob: messages get
// their own Postgres tables so a chat poll never reads (or ships) the whole
// business database, and history survives restarts and deployments.
//
// Channels: "staff" (everyone) or "dm:<idA>:<idB>" with ids sorted
// lexicographically so both participants address the same channel.

export interface ChatMessageRow {
  seq: number;
  channel: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string; // ISO timestamp
  /** "text" (default) or "voice". Voice rows carry media metadata only —
   *  audio bytes live in object storage / local disk, never in Postgres. */
  kind?: "text" | "voice";
  mediaId?: string;
  mediaMime?: string;
  durationMs?: number;
  mediaBytes?: number;
}

export interface PresenceRecord {
  employeeId: string;
  name: string;
  role: string;
  lastBeatAt: number; // epoch ms of latest heartbeat
  lastActiveAt: number; // epoch ms of latest heartbeat sent with activeNow=true
  lastSeenAt: number; // epoch ms Ã¢â‚¬â€ kept fresh even after going offline
}

export interface ReadRecord {
  employeeId: string;
  channel: string;
  lastReadSeq: number;
}

export interface TypingRecord {
  employeeId: string;
  channel: string;
  untilAt: number; // epoch ms
}

export interface ChatStore {
  /** Upsert my presence row; activeNow=false moves lastActiveAt into the past
   *  bucket only if it would otherwise look fresher than reality. */
  heartbeat(me: { id: string; name: string; role: string }, activeNow: boolean): Promise<void>;
  /** Mark me offline immediately (sign-out) while keeping lastSeen fresh. */
  leave(employeeId: string): Promise<void>;
  presence(): Promise<PresenceRecord[]>;
  /** Media payload descriptor attached to a voice-note message. */
  insertMessage(
    channel: string,
    senderId: string,
    senderName: string,
    body: string,
    media?: Pick<ChatMessageRow, "kind" | "mediaId" | "mediaMime" | "durationMs" | "mediaBytes">
  ): Promise<ChatMessageRow>;
  /** Find which channel/sender a voice media id belongs to (playback authz). */
  messageByMediaId(mediaId: string): Promise<{ channel: string; senderId: string } | null>;
  /** Messages with seq > afterSeq, ascending, capped at limit. */
  messagesAfter(channel: string, afterSeq: number, limit: number): Promise<ChatMessageRow[]>;
  /** Messages with seq < beforeSeq, ascending (the page just before it). */
  messagesBefore(channel: string, beforeSeq: number, limit: number): Promise<ChatMessageRow[]>;
  /** Newest `limit` messages, returned oldestÃ¢â€ â€™newest. */
  latestMessages(channel: string, limit: number): Promise<{ msgs: ChatMessageRow[]; hasMore: boolean }>;
  setRead(employeeId: string, channel: string, upToSeq: number): Promise<void>;
  /** All read cursors for a channel (used for Seen markers). */
  readsFor(channel: string): Promise<ReadRecord[]>;
  /** Per-channel unread counts for one employee (only channels with >0). */
  unreadCounts(employeeId: string): Promise<Record<string, number>>;
  setTyping(employeeId: string, channel: string, untilMs: number): Promise<void>;
  /** Active typing rows (already pruned). */
  typing(): Promise<TypingRecord[]>;
}

const CHAT_SQL = `
  CREATE TABLE IF NOT EXISTS chat_messages (
    seq BIGSERIAL PRIMARY KEY,
    channel TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  -- Voice notes: metadata only. Audio bytes live in object storage
  -- (Vercel Blob) or on local disk in dev -- never in Postgres.
  ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'text';
  ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS media_id TEXT;
  ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS media_mime TEXT;
  ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS duration_ms INTEGER;
  ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS media_bytes INTEGER;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_messages_media ON chat_messages (media_id) WHERE media_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_seq ON chat_messages (channel, seq DESC);
  CREATE TABLE IF NOT EXISTS chat_reads (
    employee_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    last_read_seq BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (employee_id, channel)
  );
  CREATE TABLE IF NOT EXISTS chat_presence (
    employee_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    last_beat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS chat_typing (
    employee_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    until_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (employee_id, channel)
  );
`;

const TS = (v: Date | string | number): number => new Date(v).getTime();

export class PgChatStore implements ChatStore {
  private pool: pg.Pool;
  private ready: Promise<void> | null = null;

  constructor(connectionString: string) {
    this.pool = sharedPgPool(connectionString);
  }

  private ensureReady(): Promise<void> {
    if (!this.ready) {
      this.ready = this.pool.query(CHAT_SQL).then(() => undefined);
    }
    return this.ready;
  }

  async heartbeat(
    me: { id: string; name: string; role: string },
    activeNow: boolean
  ): Promise<void> {
    await this.ensureReady();
    // lastActiveAt is what makes someone "away": refresh it only when the
    // client reports real activity; otherwise let its age grow naturally.
    await this.pool.query(
      `INSERT INTO chat_presence (employee_id, name, role, last_beat_at, last_active_at, last_seen_at)
       VALUES ($1, $2, $3, now(), CASE WHEN $4 THEN now() ELSE now() - interval '2 minutes' END, now())
       ON CONFLICT (employee_id) DO UPDATE SET
         name = EXCLUDED.name,
         role = EXCLUDED.role,
         last_beat_at = now(),
         last_active_at = CASE WHEN $4 THEN now() ELSE chat_presence.last_active_at END,
         last_seen_at = now()`,
      [me.id, me.name, me.role, activeNow]
    );
  }

  async leave(employeeId: string): Promise<void> {
    await this.ensureReady();
    await this.pool.query(
      `UPDATE chat_presence SET last_beat_at = to_timestamp(0), last_seen_at = now() WHERE employee_id = $1`,
      [employeeId]
    );
  }

  async presence(): Promise<PresenceRecord[]> {
    await this.ensureReady();
    const r = await this.pool.query<{
      employee_id: string; name: string; role: string;
      last_beat_at: Date; last_active_at: Date; last_seen_at: Date;
    }>(
      `SELECT employee_id, name, role, last_beat_at, last_active_at, last_seen_at FROM chat_presence`
    );
    return r.rows.map((row) => ({
      employeeId: row.employee_id,
      name: row.name,
      role: row.role,
      lastBeatAt: TS(row.last_beat_at),
      lastActiveAt: TS(row.last_active_at),
      lastSeenAt: TS(row.last_seen_at),
    }));
  }

  async insertMessage(
    channel: string,
    senderId: string,
    senderName: string,
    body: string,
    media?: Pick<ChatMessageRow, "kind" | "mediaId" | "mediaMime" | "durationMs" | "mediaBytes">
  ): Promise<ChatMessageRow> {
    await this.ensureReady();
    const r = await this.pool.query<{ seq: string; created_at: Date }>(
      `INSERT INTO chat_messages (channel, sender_id, sender_name, body, kind, media_id, media_mime, duration_ms, media_bytes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING seq, created_at`,
      [
        channel,
        senderId,
        senderName,
        body,
        media?.kind ?? "text",
        media?.mediaId ?? null,
        media?.mediaMime ?? null,
        media?.durationMs ?? null,
        media?.mediaBytes ?? null,
      ]
    );
    return {
      seq: Number(r.rows[0].seq),
      channel,
      senderId,
      senderName,
      body,
      createdAt: new Date(r.rows[0].created_at).toISOString(),
      kind: media?.kind ?? "text",
      ...(media?.mediaId ? { mediaId: media.mediaId, mediaMime: media.mediaMime, durationMs: media.durationMs, mediaBytes: media.mediaBytes } : {}),
    };
  }

  async messageByMediaId(mediaId: string): Promise<{ channel: string; senderId: string } | null> {
    await this.ensureReady();
    const r = await this.pool.query<{ channel: string; sender_id: string }>(
      `SELECT channel, sender_id FROM chat_messages WHERE media_id = $1 LIMIT 1`,
      [mediaId]
    );
    if (r.rows.length === 0) return null;
    return { channel: r.rows[0].channel, senderId: r.rows[0].sender_id };
  }

  async messagesAfter(channel: string, afterSeq: number, limit: number): Promise<ChatMessageRow[]> {
    await this.ensureReady();
    const r = await this.pool.query<MsgRowShape>(
      `SELECT ${MSG_COLS} FROM chat_messages WHERE channel = $1 AND seq > $2 ORDER BY seq ASC LIMIT $3`,
      [channel, afterSeq, limit]
    );
    return r.rows.map(mapMsgRow);
  }

  async messagesBefore(channel: string, beforeSeq: number, limit: number): Promise<ChatMessageRow[]> {
    await this.ensureReady();
    const r = await this.pool.query<MsgRowShape>(
      `SELECT ${MSG_COLS} FROM chat_messages WHERE channel = $1 AND seq < $2 ORDER BY seq DESC LIMIT $3`,
      [channel, beforeSeq, limit]
    );
    return r.rows.map(mapMsgRow).reverse();
  }
  async latestMessages(channel: string, limit: number): Promise<{ msgs: ChatMessageRow[]; hasMore: boolean }> {
    await this.ensureReady();
    const r = await this.pool.query<MsgRowShape>(
      `SELECT ${MSG_COLS} FROM chat_messages WHERE channel = $1 ORDER BY seq DESC LIMIT $2`,
      [channel, limit + 1]
    );
    const hasMore = r.rows.length > limit;
    const rows = hasMore ? r.rows.slice(0, limit) : r.rows;
    return { msgs: rows.map(mapMsgRow).reverse(), hasMore };
  }

  async setRead(employeeId: string, channel: string, upToSeq: number): Promise<void> {
    await this.ensureReady();
    await this.pool.query(
      `INSERT INTO chat_reads (employee_id, channel, last_read_seq) VALUES ($1, $2, $3)
       ON CONFLICT (employee_id, channel) DO UPDATE SET last_read_seq = GREATEST(chat_reads.last_read_seq, EXCLUDED.last_read_seq)`,
      [employeeId, channel, upToSeq]
    );
  }

  async readsFor(channel: string): Promise<ReadRecord[]> {
    await this.ensureReady();
    const r = await this.pool.query<{ employee_id: string; channel: string; last_read_seq: string }>(
      `SELECT employee_id, channel, last_read_seq FROM chat_reads WHERE channel = $1`,
      [channel]
    );
    return r.rows.map((row) => ({
      employeeId: row.employee_id,
      channel: row.channel,
      lastReadSeq: Number(row.last_read_seq),
    }));
  }

  async unreadCounts(employeeId: string): Promise<Record<string, number>> {
    await this.ensureReady();
    const r = await this.pool.query<{ channel: string; n: string }>(
      `SELECT m.channel AS channel, COUNT(*)::bigint AS n
       FROM chat_messages m
       LEFT JOIN chat_reads r ON r.channel = m.channel AND r.employee_id = $1
       WHERE m.sender_id <> $1 AND m.seq > COALESCE(r.last_read_seq, 0)
       GROUP BY m.channel`,
      [employeeId]
    );
    const out: Record<string, number> = {};
    for (const row of r.rows) out[row.channel] = Number(row.n);
    return out;
  }

  async setTyping(employeeId: string, channel: string, untilMs: number): Promise<void> {
    await this.ensureReady();
    await this.pool.query(
      `INSERT INTO chat_typing (employee_id, channel, until_at) VALUES ($1, $2, $3)
       ON CONFLICT (employee_id, channel) DO UPDATE SET until_at = EXCLUDED.until_at`,
      [employeeId, channel, new Date(untilMs)]
    );
  }

  async typing(): Promise<TypingRecord[]> {
    await this.ensureReady();
    const r = await this.pool.query<{ employee_id: string; channel: string; until_at: Date }>(
      `SELECT employee_id, channel, until_at FROM chat_typing WHERE until_at > now()`,
      []
    );
    return r.rows.map((row) => ({ employeeId: row.employee_id, channel: row.channel, untilAt: TS(row.until_at) }));
  }
}

interface MsgRowShape {
  seq: string; channel: string; sender_id: string; sender_name: string; body: string; created_at: Date;
  kind: string | null; media_id: string | null; media_mime: string | null; duration_ms: number | null; media_bytes: number | null;
}

const MSG_COLS = "seq, channel, sender_id, sender_name, body, created_at, kind, media_id, media_mime, duration_ms, media_bytes";

function mapMsgRow(row: MsgRowShape): ChatMessageRow {
  const base: ChatMessageRow = {
    seq: Number(row.seq),
    channel: row.channel,
    senderId: row.sender_id,
    senderName: row.sender_name,
    body: row.body,
    createdAt: new Date(row.created_at).toISOString(),
    kind: (row.kind as ChatMessageRow["kind"]) ?? "text",
  };
  if (row.media_id) {
    base.mediaId = row.media_id;
    base.mediaMime = row.media_mime ?? "audio/webm";
    base.durationMs = row.duration_ms ?? undefined;
    base.mediaBytes = row.media_bytes ?? undefined;
  }
  return base;
}

interface ChatFileShape {
  v: 1;
  nextSeq: number;
  messages: ChatMessageRow[];
  presence: PresenceRecord[];
  reads: ReadRecord[];
  typing: TypingRecord[];
}

export class FileChatStore implements ChatStore {
  private file: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(file: string) {
    this.file = file;
  }

  private readRaw(): Promise<ChatFileShape> {
    return fs
      .readFile(this.file, "utf8")
      .then((raw) => {
        const parsed = JSON.parse(raw) as Partial<ChatFileShape>;
        if (parsed && parsed.v === 1 && Array.isArray(parsed.messages)) {
          return {
            v: 1 as const,
            nextSeq: Number(parsed.nextSeq) || 1,
            messages: parsed.messages,
            presence: parsed.presence ?? [],
            reads: parsed.reads ?? [],
            typing: parsed.typing ?? [],
          };
        }
        return { v: 1 as const, nextSeq: 1, messages: [], presence: [], reads: [], typing: [] };
      })
      .catch(() => ({ v: 1 as const, nextSeq: 1, messages: [], presence: [], reads: [], typing: [] }));
  }

  private write(mutateFn?: (s: ChatFileShape) => void): Promise<ChatFileShape> {
    const run = this.queue.then(async () => {
      const current = await this.readRaw();
      if (mutateFn) mutateFn(current);
      current.nextSeq = current.nextSeq || current.messages.reduce((m, x) => Math.max(m, x.seq), 0) + 1;
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.${crypto.randomBytes(4).toString("hex")}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(current), "utf8");
      await fs.rename(tmp, this.file);
      return current;
    });
    this.queue = run.catch(() => {});
    return run;
  }

  private prune(s: ChatFileShape, now: number): void {
    s.typing = s.typing.filter((t) => t.untilAt > now);
  }

  async heartbeat(me: { id: string; name: string; role: string }, activeNow: boolean): Promise<void> {
    await this.write((s) => {
      const now = Date.now();
      this.prune(s, now);
      const existing = s.presence.find((p) => p.employeeId === me.id);
      if (existing) {
        existing.name = me.name;
        existing.role = me.role;
        existing.lastBeatAt = now;
        existing.lastSeenAt = now;
        if (activeNow) existing.lastActiveAt = now;
      } else {
        s.presence.push({
          employeeId: me.id,
          name: me.name,
          role: me.role,
          lastBeatAt: now,
          lastActiveAt: activeNow ? now : now - 10_000,
          lastSeenAt: now,
        });
      }
    });
  }

  async leave(employeeId: string): Promise<void> {
    await this.write((s) => {
      const p = s.presence.find((x) => x.employeeId === employeeId);
      if (p) {
        p.lastBeatAt = 0;
        p.lastSeenAt = Date.now();
      }
    });
  }

  async presence(): Promise<PresenceRecord[]> {
    const s = await this.readRaw();
    return s.presence.map((p) => ({ ...p }));
  }

  async insertMessage(
    channel: string,
    senderId: string,
    senderName: string,
    body: string,
    media?: Pick<ChatMessageRow, "kind" | "mediaId" | "mediaMime" | "durationMs" | "mediaBytes">
  ): Promise<ChatMessageRow> {
    let created!: ChatMessageRow;
    await this.write((s) => {
      const seq = s.nextSeq++;
      created = {
        seq,
        channel,
        senderId,
        senderName,
        body,
        createdAt: new Date().toISOString(),
        kind: media?.kind ?? "text",
        ...(media?.mediaId ? { mediaId: media.mediaId, mediaMime: media.mediaMime, durationMs: media.durationMs, mediaBytes: media.mediaBytes } : {}),
      };
      s.messages.push(created);
      if (s.messages.length > 5000) s.messages = s.messages.slice(-4000); // dev-mode safety valve
    });
    return created;
  }

  async messageByMediaId(mediaId: string): Promise<{ channel: string; senderId: string } | null> {
    const s = await this.readRaw();
    const hit = s.messages.find((m) => m.mediaId === mediaId);
    return hit ? { channel: hit.channel, senderId: hit.senderId } : null;
  }

  async messagesAfter(channel: string, afterSeq: number, limit: number): Promise<ChatMessageRow[]> {
    const s = await this.readRaw();
    return s.messages.filter((m) => m.channel === channel && m.seq > afterSeq).slice(-limit);
  }

  async messagesBefore(channel: string, beforeSeq: number, limit: number): Promise<ChatMessageRow[]> {
    const s = await this.readRaw();
    const older = s.messages.filter((m) => m.channel === channel && m.seq < beforeSeq);
    return older.slice(-limit);
  }
  async latestMessages(channel: string, limit: number): Promise<{ msgs: ChatMessageRow[]; hasMore: boolean }> {
    const s = await this.readRaw();
    const all = s.messages.filter((m) => m.channel === channel);
    const msgs = all.slice(-limit);
    return { msgs, hasMore: all.length > msgs.length };
  }

  async setRead(employeeId: string, channel: string, upToSeq: number): Promise<void> {
    await this.write((s) => {
      const existing = s.reads.find((r) => r.employeeId === employeeId && r.channel === channel);
      if (existing) existing.lastReadSeq = Math.max(existing.lastReadSeq, upToSeq);
      else s.reads.push({ employeeId, channel, lastReadSeq: upToSeq });
    });
  }

  async readsFor(channel: string): Promise<ReadRecord[]> {
    const s = await this.readRaw();
    return s.reads.filter((r) => r.channel === channel).map((r) => ({ ...r }));
  }

  async unreadCounts(employeeId: string): Promise<Record<string, number>> {
    const s = await this.readRaw();
    const out: Record<string, number> = {};
    for (const m of s.messages) {
      if (m.senderId === employeeId) continue;
      const read = s.reads.find((r) => r.employeeId === employeeId && r.channel === m.channel);
      if (m.seq > (read?.lastReadSeq ?? 0)) out[m.channel] = (out[m.channel] ?? 0) + 1;
    }
    return out;
  }

  async setTyping(employeeId: string, channel: string, untilMs: number): Promise<void> {
    await this.write((s) => {
      this.prune(s, Date.now());
      const existing = s.typing.find((t) => t.employeeId === employeeId && t.channel === channel);
      if (existing) existing.untilAt = untilMs;
      else s.typing.push({ employeeId, channel, untilAt: untilMs });
    });
  }

  async typing(): Promise<TypingRecord[]> {
    const s = await this.readRaw();
    const now = Date.now();
    return s.typing.filter((t) => t.untilAt > now).map((t) => ({ ...t }));
  }
}

/** Pick the right chat store Ã¢â‚¬â€ same environment rule as chooseStore(). */
export function chooseChatStore(dataDir?: string): ChatStore {
  const { url } = firstPgEnv();
  if (url) return new PgChatStore(url);
  return new FileChatStore(path.join(dataDir ?? path.join(process.cwd(), "data"), "chat.json"));
}
