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
  const r = await api(`/api/chat/messages?${q.toString()}`);
  if (!r.ok) throw new Error(`Server responded ${r.status}`);
  const body = (await r.json()) as { ok: boolean; messages: ChatMessage[]; hasMore: boolean; othersReadUpTo: number };
  return { messages: body.messages ?? [], hasMore: !!body.hasMore, othersReadUpTo: body.othersReadUpTo ?? 0 };
}

export async function sendChatMessage(channel: ChatChannel, body: string): Promise<ChatMessage> {
  const r = await api("/api/chat/messages", { method: "POST", body: JSON.stringify({ channel, body }) }, 15000);
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

export type ChatConnection = "idle" | "connecting" | "online" | "disconnected";

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
let lastUserInputAt = Date.now();
let inputAttached = false;
let myIdentity: { id: string; name: string } | null = null;

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

/** Start the app-wide presence heartbeat (idempotent). Call on sign-in. */
export function startChatPresence(me: { id: string; name: string }): void {
  myIdentity = me;
  attachInputTracking();
  setSnapshot({ connection: "connecting" });
  if (pollCleanup) return;
  const beat = (): void => {
    const activeNow = Date.now() - lastUserInputAt < 60_000 && !(typeof document !== "undefined" && document.hidden);
    chatHeartbeat(activeNow)
      .then((r) => {
        beatFailures = 0;
        const hadBaseline = knownUnread !== null;
        const prev = knownUnread ?? {};
        // New DM → toast with sender name; staff traffic → enriched toast
        // (preview or @mention) via a targeted incremental fetch.
        for (const [ch, n] of Object.entries(r.unread)) {
          const before = prev[ch] ?? 0;
          if (!hadBaseline || n <= before || ch === viewedChannel) continue;
          if (ch.startsWith("dm:")) {
            const otherId = ch.split(":").find((part) => part !== me.id);
            const nm = r.presence.find((p) => p.id === otherId)?.name ?? "A colleague";
            notify?.(`New message from ${nm}`);
          } else if (ch === STAFF_CHANNEL) {
            void checkMentionsAndPreview(before, n);
          }
        }
        knownUnread = { ...r.unread };
        setSnapshot({
          connection: "online",
          myStatus: r.myStatus,
          presence: r.presence,
          unread: r.unread,
          totalUnread: Object.values(r.unread).reduce((a, b) => a + b, 0),
          typing: r.typing,
        });
      })
      .catch((err: unknown) => {
        if (err instanceof UnauthorizedChatError) {
          stopChatPresence(false);
          return;
        }
        beatFailures++;
        if (beatFailures >= 2) setSnapshot({ connection: "disconnected", myStatus: "offline" });
      });
  };
  pollCleanup = smartPoll(beat, 5000);
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
