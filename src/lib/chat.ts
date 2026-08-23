/**
 * Staff chat client — API wrappers plus a tiny singleton "chat presence"
 * store that runs the shared heartbeat for the whole app.
 *
 * Design notes:
 *  • The heartbeat (every 5s while signed in) is the ONLY recurring chat
 *    request. It carries no message bodies — just presence, unread counts,
 *    and typing flags — so nav badges and notifications stay cheap and the
 *    business database is never polled for chat purposes.
 *  • Message bodies are fetched only by the Staff Chat page, incrementally
 *    (`after=<lastSeq>`), so opening chat never re-downloads history.
 *  • Presence truth lives on the server: a member is offline when heartbeats
 *    stop (closed tab / lost connection), away after inactivity. Signing out
 *    marks you offline immediately via /api/chat/leave.
 */
import { useSyncExternalStore } from "react";
import { api } from "./storage";
import { smartPoll } from "./smartPoll";
import type { Employee } from "./types";

export type ChatChannel = string; // "staff" | `dm:<idA>:<idB>` (ids sorted)

export const STAFF_CHANNEL: ChatChannel = "staff";

/** Canonical DM channel key — both participants compute the same value. */
export function dmChannel(myId: string, otherId: string): ChatChannel {
  return `dm:${[myId, otherId].sort().join(":")}`;
}

export interface ChatMessage {
  seq: number;
  channel: ChatChannel;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
  /** Client-side only: message not confirmed by the server yet. */
  pending?: boolean;
  failed?: boolean;
}

export interface ChatPresenceEntry {
  id: string;
  name: string;
  role: Employee["role"];
  status: "online" | "away" | "offline";
  lastSeenAt: number;
}

interface HeartbeatReply {
  ok: boolean;
  serverTime: number;
  myStatus: "online" | "away" | "offline";
  presence: ChatPresenceEntry[];
  unread: Record<string, number>;
  typing: Array<{ employeeId: string; channel: ChatChannel }>;
}

export async function chatHeartbeat(activeNow: boolean): Promise<HeartbeatReply> {
  const r = await api("/api/chat/heartbeat", {
    method: "POST",
    body: JSON.stringify({ activeNow }),
  });
  if (r.status === 401) throw new UnauthorizedChatError();
  if (!r.ok) throw new Error(`Server responded ${r.status}`);
  return (await r.json()) as HeartbeatReply;
}

export class UnauthorizedChatError extends Error {}

export async function chatLeave(): Promise<void> {
  try {
    await api("/api/chat/leave", { method: "POST" });
  } catch {
    /* best effort — heartbeat timeout will mark us offline anyway */
  }
}

export interface ChatHistory {
  messages: ChatMessage[];
  hasMore: boolean;
  othersReadUpTo: number;
}

export async function fetchChatMessages(opts: {
  channel: ChatChannel;
  after?: number;
  before?: number;
  limit?: number;
}): Promise<ChatHistory> {
  const q = new URLSearchParams({ channel: opts.channel });
  if (opts.after !== undefined) q.set("after", String(opts.after));
  if (opts.before !== undefined) q.set("before", String(opts.before));
  if (opts.limit !== undefined) q.set("limit", String(opts.limit));
  dbg(`messages poll request channel=${opts.channel} after=${opts.after ?? "-"} before=${opts.before ?? "-"} limit=${opts.limit ?? "-"}`);
  const t0 = Date.now();
  try {
    const r = await api(`/api/chat/messages?${q.toString()}`);
    if (!r.ok) {
      dbg(`messages poll response HTTP ${r.status} in ${Date.now() - t0}ms`);
      throw new Error(`Server responded ${r.status}`);
    }
    const body = (await r.json()) as { ok: boolean; messages: ChatMessage[]; hasMore: boolean; othersReadUpTo: number };
    dbg(`messages poll response ok in ${Date.now() - t0}ms count=${body.messages?.length ?? 0} hasMore=${body.hasMore}`);
    return { messages: body.messages ?? [], hasMore: !!body.hasMore, othersReadUpTo: body.othersReadUpTo ?? 0 };
  } catch (err: unknown) {
    if (!(err instanceof Error) || !err.message.startsWith("Server responded")) {
      dbg(`messages poll NETWORK error after ${Date.now() - t0}ms: ${String(err)}`);
    }
    throw err;
  }
}

export async function sendChatMessage(channel: ChatChannel, body: string): Promise<ChatMessage> {
  dbg(`send message request channel=${channel} len=${body.length}`);
  const t0 = Date.now();
  const r = await api("/api/chat/messages", { method: "POST", body: JSON.stringify({ channel, body }) }, 15000);
  dbg(`send message response HTTP ${r.status} in ${Date.now() - t0}ms`);
  if (!r.ok) throw new Error(`Server responded ${r.status}`);
  const parsed = (await r.json()) as { ok: boolean; message: ChatMessage };
  return parsed.message;
}

export async function chatMarkRead(channel: ChatChannel, upToSeq: number): Promise<void> {
  await api("/api/chat/read", { method: "POST", body: JSON.stringify({ channel, upToSeq }) }).catch(() => {});
}

export async function chatSetTyping(channel: ChatChannel): Promise<void> {
  await api("/api/chat/typing", { method: "POST", body: JSON.stringify({ channel }) }).catch(() => {});
}

// ── App-wide chat state (singleton + useSyncExternalStore) ──────────────────

/**
 * Connection states, deliberately split so the UI never conflates "your
 * internet is down" with "the chat server is briefly unreachable":
 *  • idle         — not signed in / presence stopped
 *  • connecting   — signed in, first heartbeat still in flight
 *  • online       — last heartbeat confirmed by the server
 *  • reconnecting — internet looks fine (browser online) but a heartbeat
 *                   failed; retrying with exponential backoff
 *  • offline      — the BROWSER reports no network (navigator.onLine === false)
 */
export type ChatConnection = "idle" | "connecting" | "online" | "reconnecting" | "offline";

export interface ChatSnapshot {
  connection: ChatConnection;
  myStatus: "online" | "away" | "offline";
  presence: ChatPresenceEntry[];
  /** Unread counts per channel (only channels with >0). */
  unread: Record<string, number>;
  totalUnread: number;
  typing: Array<{ employeeId: string; channel: ChatChannel }>;
}

let snapshot: ChatSnapshot = {
  connection: "idle",
  myStatus: "offline",
  presence: [],
  unread: {},
  totalUnread: 0,
  typing: [],
};

const listeners = new Set<() => void>();
function setSnapshot(patch: Partial<ChatSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** React hook: live chat summary (badges, presence dots, connection state). */
export function useChatSnapshot(): ChatSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot);
}
function getSnapshot(): ChatSnapshot {
  return snapshot;
}

// ── Heartbeat loop ───────────────────────────────────────────────────────────

let pollCleanup: (() => void) | null = null;
let beatFailures = 0;
/** Backoff gate: no network beat before this timestamp (0 = fire freely). */
let nextBeatAllowedAt = 0;
let lastUserInputAt = Date.now();
let inputAttached = false;
let networkAttached = false;
let myIdentity: { id: string; name: string } | null = null;

/** TEMPORARY diagnostics — remove once chat connection stability is confirmed. */
function dbg(...args: unknown[]): void {
  console.info("[CHAT][dbg]", ...args);
}

function setConnection(next: ChatConnection): void {
  if (snapshot.connection === next) return;
  dbg(`connection transition: ${snapshot.connection} -> ${next}`);
  setSnapshot({ connection: next });
}

/** Which conversation is open on screen right now (toast suppression). */
let viewedChannel: ChatChannel | null = null;
/** Baselines so the first heartbeat never fires spurious notifications. */
let knownUnread: Record<string, number> | null = null;
let lastStaffSeq = 0;

function attachInputTracking(): void {
  if (inputAttached || typeof window === "undefined") return;
  inputAttached = true;
  const mark = (): void => {
    lastUserInputAt = Date.now();
  };
  window.addEventListener("pointerdown", mark, { passive: true });
  window.addEventListener("keydown", mark);
  window.addEventListener("touchstart", mark, { passive: true });
}

/** Track browser-level connectivity so we can tell the two failure kinds apart. */
function attachNetworkTracking(): void {
  if (networkAttached || typeof window === "undefined") return;
  networkAttached = true;
  const onChange = (): void => {
    dbg(`browser network event: navigator.onLine=${navigator.onLine}`);
    if (!navigator.onLine) {
      setConnection("offline");
    } else {
      // Internet just came back — beat immediately instead of waiting out
      // whatever backoff was in effect.
      nextBeatAllowedAt = 0;
      void runBeat();
    }
  };
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
}

/** Fire a toast without importing the UI module into this lib's hot path. */
let notify: ((text: string) => void) | null = null;
export function setChatNotifier(fn: (text: string) => void): void {
  notify = fn;
}

/** The Staff Chat page calls this so its own conversation never toasts. */
export function setViewedChatChannel(channel: ChatChannel | null): void {
  viewedChannel = channel;
}

async function checkMentionsAndPreview(prevStaffUnread: number, nowStaffUnread: number): Promise<void> {
  // Only when staff-wide traffic actually arrived — costs nothing at rest.
  if (nowStaffUnread <= prevStaffUnread || !myIdentity) return;
  try {
    const hist = await fetchChatMessages({ channel: STAFF_CHANNEL, after: lastStaffSeq, limit: 20 });
    let mention: string | null = null;
    let preview: string | null = null;
    for (const m of hist.messages) {
      if (m.senderId === myIdentity.id) continue;
      if (lastStaffSeq === 0 || m.seq > lastStaffSeq) lastStaffSeq = m.seq;
      if (!preview) preview = `${m.senderName}: ${m.body.slice(0, 60)}`;
      const lower = m.body.toLowerCase();
      const meName = myIdentity.name.toLowerCase();
      if (
        lower.includes(`@${meName}`) ||
        (meName.includes(" ") && lower.includes(`@${meName.split(/\s+/)[0]}`))
      ) {
        mention = `${m.senderName} mentioned you`;
      }
    }
    if (mention && viewedChannel !== STAFF_CHANNEL) notify?.(mention);
    else if (preview && viewedChannel !== STAFF_CHANNEL) notify?.(preview);
  } catch {
    /* notification enrichment is best-effort */
  }
}

/** One presence beat. Cheap, idempotent, and safe to call at any moment —
 *  the exponential-backoff gate inside decides whether it actually hits the
 *  network. */
async function runBeat(): Promise<void> {
  if (!myIdentity || !pollCleanup) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    // Browser itself reports no network. Don't waste requests; the "online"
    // event will trigger an immediate beat when connectivity returns.
    setConnection("offline");
    dbg("beat skipped: browser reports offline");
    return;
  }
  if (Date.now() < nextBeatAllowedAt) {
    dbg(`beat gated by backoff (${Math.ceil((nextBeatAllowedAt - Date.now()) / 1000)}s left)`);
    return;
  }
  const activeNow = Date.now() - lastUserInputAt < 60_000 && !(typeof document !== "undefined" && document.hidden);
  dbg(`heartbeat request (active=${activeNow}, priorFailures=${beatFailures})`);
  const t0 = Date.now();
  try {
    const r = await chatHeartbeat(activeNow);
    if (beatFailures > 0) dbg(`recovered after ${beatFailures} failed beat(s) in ${Date.now() - t0}ms`);
    beatFailures = 0;
    nextBeatAllowedAt = 0;
    const hadBaseline = knownUnread !== null;
    const prev = knownUnread ?? {};
    // New DM → toast with sender name; staff traffic → enriched toast
    // (preview or @mention) via a targeted incremental fetch.
    for (const [ch, n] of Object.entries(r.unread)) {
      const before = prev[ch] ?? 0;
      if (!hadBaseline || n <= before || ch === viewedChannel) continue;
      if (ch.startsWith("dm:")) {
        const otherId = ch.split(":").find((part) => part !== myIdentity?.id);
        const nm = r.presence.find((p) => p.id === otherId)?.name ?? "A colleague";
        notify?.(`New message from ${nm}`);
      } else if (ch === STAFF_CHANNEL) {
        void checkMentionsAndPreview(before, n);
      }
    }
    knownUnread = { ...r.unread };
    setSnapshot({
      myStatus: r.myStatus,
      presence: r.presence,
      unread: r.unread,
      totalUnread: Object.values(r.unread).reduce((a, b) => a + b, 0),
      typing: r.typing,
    });
    setConnection("online");
    dbg(`heartbeat ok in ${Date.now() - t0}ms status=${r.myStatus} presence=${r.presence.length} unreadTotal=${Object.values(r.unread).reduce((a, b) => a + b, 0)} typing=${r.typing.length}`);
  } catch (err: unknown) {
    if (err instanceof UnauthorizedChatError) {
      dbg("heartbeat rejected (401): token expired or invalid — stopping chat presence. This is an auth problem, not a connectivity problem.");
      stopChatPresence(false);
      return;
    }
    beatFailures++;
    // Exponential backoff: 5s → 10s → 20s → 40s → capped at 60s. Any success
    // resets both counters and restores Online instantly.
    const waitMs = Math.min(60_000, 5_000 * Math.pow(2, Math.min(beatFailures - 1, 4)));
    nextBeatAllowedAt = Date.now() + waitMs;
    const browserOffline = typeof navigator !== "undefined" && navigator.onLine === false;
    setConnection(browserOffline ? "offline" : "reconnecting");
    if (browserOffline) setSnapshot({ myStatus: "offline" });
    dbg(
      `heartbeat failed (#${beatFailures}) after ${Date.now() - t0}ms: ${String(err)} — retrying in ~${Math.round(waitMs / 1000)}s, state=${browserOffline ? "offline" : "reconnecting"}`
    );
  }
}

/** Start the app-wide presence heartbeat (idempotent). Call on sign-in. */
export function startChatPresence(me: { id: string; name: string }): void {
  myIdentity = me;
  attachInputTracking();
  attachNetworkTracking();
  setSnapshot({ connection: "connecting", myStatus: "offline" });
  dbg(`presence started for ${me.name} (navigator.onLine=${typeof navigator !== "undefined" ? navigator.onLine : "?"})`);
  if (pollCleanup) return;
  pollCleanup = smartPoll(
    () => {
      void runBeat();
    },
    5000
  );
}

/** Stop heartbeats. markLeft=false when the server already rejected us. */
export function stopChatPresence(markLeft = true): void {
  if (markLeft) void chatLeave();
  pollCleanup?.();
  pollCleanup = null;
  knownUnread = null;
  lastStaffSeq = 0;
  viewedChannel = null;
  beatFailures = 0;
  nextBeatAllowedAt = 0;
  dbg(`presence stopped (markLeft=${markLeft})`);
  setSnapshot({
    connection: "idle",
    myStatus: "offline",
    presence: [],
    unread: {},
    totalUnread: 0,
    typing: [],
  });
}

/** Track the newest staff-channel seq seen anywhere, so mention checks stay
 *  incremental across page visits too. */
export function noteStaffSeq(seq: number): void {
  if (seq > lastStaffSeq) lastStaffSeq = seq;
}
