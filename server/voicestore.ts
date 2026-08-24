/**
 * Voice-note file storage for staff chat.
 *
 * Architecture rules:
 *  • Audio bytes NEVER go into Postgres. Only the tiny metadata row in
 *    chat_messages references a media id.
 *  • Production (Vercel): bytes are stored in Vercel Blob, which requires the
 *    BLOB_READ_WRITE_TOKEN environment variable. Without it the feature is
 *    reported as unavailable instead of silently faking it.
 *  • Local dev / LAN server (file mode): bytes live under data/voice/ so the
 *    whole flow can be tested without any cloud account.
 *
 * Playback is never a raw public URL: the client always goes through
 * GET /api/chat/voice/:id, which enforces staff auth + channel membership and
 * proxies the bytes, so blob URLs stay server-side.
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export type VoiceBackend = "blob" | "disk" | "none";

/** 2 MB cap — several minutes of Opus voice at typical bitrates. */
export const VOICE_MAX_BYTES = 2_000_000;

const MIME_ALLOW = new Set([
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/ogg;codecs=opus",
  "audio/wav",
  "audio/aac",
]);

export function normalizeVoiceMime(raw: string | undefined): string {
  const m = (raw ?? "").split(";")[0].trim().toLowerCase();
  return MIME_ALLOW.has(m) ? m : "audio/webm";
}

let backendCache: VoiceBackend | null = null;

export function voiceBackend(): VoiceBackend {
  if (backendCache) return backendCache;
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token && token.trim().length > 10) {
    backendCache = "blob";
  } else {
    // File mode only — on Vercel the filesystem is ephemeral, so without a
    // blob token there is no reliable place to put audio at all.
    const pgUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
    backendCache = pgUrl ? "none" : "disk";
  }
  return backendCache;
}

function safeName(mediaId: string): string {
  // mediaId looks like `emp_1:a1b2c3...`; keep it filesystem/URL safe.
  return mediaId.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function saveVoice(dataDir: string, mediaId: string, data: Buffer, mime: string): Promise<void> {
  const backend = voiceBackend();
  if (backend === "disk") {
    const dir = path.join(dataDir, "voice");
    await fs.mkdir(dir, { recursive: true });
    const name = safeName(mediaId);
    await fs.writeFile(path.join(dir, `${name}.bin`), data);
    await fs.writeFile(path.join(dir, `${name}.json`), JSON.stringify({ mime }), "utf8");
    return;
  }
  // blob
  const { put } = await import("@vercel/blob");
  await put(`chat-voice/${safeName(mediaId)}.bin`, data, {
    access: "private",
    contentType: mime,
    addRandomSuffix: false,
    allowOverwrite: false,
  });
}

export async function readVoice(dataDir: string, mediaId: string): Promise<{ data: Buffer; mime: string } | null> {
  const backend = voiceBackend();
  if (backend === "disk") {
    const dir = path.join(dataDir, "voice");
    const name = safeName(mediaId);
    try {
      const [data, metaRaw] = await Promise.all([
        fs.readFile(path.join(dir, `${name}.bin`)),
        fs.readFile(path.join(dir, `${name}.json`), "utf8").catch(() => "{}"),
      ]);
      let mime = "audio/webm";
      try {
        mime = (JSON.parse(metaRaw) as { mime?: string }).mime ?? mime;
      } catch {
        /* default */
      }
      return { data, mime };
    } catch {
      return null;
    }
  }
  if (backend === "none") return null;
  // blob: read through the SDK's authenticated access. Private-store bytes
  // are fetched server-side only — no URL ever reaches the client.
  try {
    const { get } = await import("@vercel/blob");
    const res = await get(`chat-voice/${safeName(mediaId)}.bin`, { access: "private" });
    if (!res || !res.stream) return null;
    const chunks: Uint8Array[] = [];
    // Node's ReadableStream is async-iterable at runtime; the server tsconfig
    // just lacks the lib that types it.
    for await (const chunk of res.stream as unknown as AsyncIterable<Uint8Array>) chunks.push(chunk);
    return { data: Buffer.concat(chunks), mime: res.blob?.contentType ?? "audio/webm" };
  } catch {
    return null;
  }
}

/** Fresh unguessable media id bound to its uploader: `<employeeId>:<rand>` —
 *  the core route refuses voice messages whose prefix doesn't match the
 *  authenticated sender, so nobody can attach someone else's recording. */
export function newMediaId(employeeId: string): string {
  return `${employeeId}:${crypto.randomBytes(16).toString("hex")}`;
}
