import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessagesSquare, MessageSquare, Mic, PanelLeft, Pause, Play, RefreshCcw, Search, Send, Trash2, X } from "lucide-react";
import { useAppStore } from "../store/useStore";
import { Badge, EmptyState, IconButton, Spinner, toast } from "../components/ui";
import { ROLE_LABELS } from "../lib/permissions";
import { fmtDate, fmtTime, relativeTime } from "../lib/format";
import type { Employee } from "../lib/types";
import { smartPoll } from "../lib/smartPoll";
import {
  chatMarkRead,
  chatSetTyping,
  dmChannel,
  dbg,
  fetchChatMessages,
  fetchVoiceObjectUrl,
  noteStaffSeq,
  sendChatMessage,
  setViewedChatChannel,
  STAFF_CHANNEL,
  uploadVoiceNote,
  useChatSnapshot,
  type ChatChannel,
  type ChatMessage,
  type ChatPresenceEntry,
} from "../lib/chat";

type PresenceStatus = ChatPresenceEntry["status"];

/** mm:ss from milliseconds. */
function fmtDur(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Playable voice-note bubble. Bytes are fetched lazily through the
 * authenticated endpoint (the <audio> element cannot attach an Authorization
 * header itself), then played from a local object URL.
 */
function VoiceBubble({ msg }: { msg: ChatMessage }): React.ReactElement {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let alive = true;
    if (!msg.mediaId) {
      setError(true);
      return;
    }
    fetchVoiceObjectUrl(msg.mediaId)
      .then((u) => {
        if (alive) setUrl(u);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [msg.mediaId]);

  useEffect(() => {
    if (!url) return;
    const a = new Audio(url);
    audioRef.current = a;
    const onTime = (): void => setPositionMs(a.currentTime * 1000);
    const onEnd = (): void => {
      setPlaying(false);
      setPositionMs(0);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    return () => {
      a.pause();
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
      audioRef.current = null;
    };
  }, [url]);

  function toggle(): void {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      void a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  }

  const total = msg.durationMs && msg.durationMs > 0 ? msg.durationMs : 0;
  const frac = total > 0 ? Math.min(1, positionMs / total) : positionMs > 0 ? 1 : 0;

  return (
    <div className="flex items-center gap-2.5">
      <button
        onClick={toggle}
        disabled={!url}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
        className="grid size-9 shrink-0 place-items-center rounded-full"
        style={{
          background: url && !error ? "var(--accent)" : "var(--border)",
          color: "#fff",
          opacity: url ? 1 : 0.6,
        }}
      >
        {!url ? error ? <X size={16} /> : <Spinner className="size-4" /> : playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </button>
      <div
        className="h-1.5 w-24 overflow-hidden rounded-full sm:w-32"
        style={{ background: "color-mix(in srgb, currentColor 25%, transparent)" }}
        role="progressbar"
        aria-valuenow={Math.round(frac * 100)}
      >
        <div className="h-full rounded-full transition-[width]" style={{ width: `${Math.round(frac * 100)}%`, background: "currentColor" }} />
      </div>
      <span className="text-[11px] font-bold tabular-nums opacity-80">
        {total > 0 ? `${fmtDur(positionMs)} / ${fmtDur(total)}` : fmtDur(positionMs)}
      </span>
      {error && <span className="text-[11px] font-semibold">unavailable</span>}
    </div>
  );
}

function StatusDot({ status }: { status: PresenceStatus }): React.ReactElement {
  const color = status === "online" ? "var(--success)" : status === "away" ? "#eab308" : "var(--border)";
  return <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />;
}

function presenceText(status: PresenceStatus, lastSeenAt: number): string {
  if (status === "online") return "Online";
  if (status === "away") return "Away";
  return lastSeenAt > 0 ? `Last seen ${relativeTime(new Date(lastSeenAt))}` : "Offline";
}

/** Highlight @mentions that match a current employee's full or first name. */
function renderBody(body: string, staff: Employee[]): React.ReactElement[] {
  const parts = body.split(/(@[A-Za-z][A-Za-z .'-]*)/g);
  return parts.map((part, i) => {
    if (!part.startsWith("@")) return <span key={i}>{part}</span>;
    const trailingWs = part.endsWith(" ");
    const bare = part.slice(1, trailingWs ? -1 : undefined).trimEnd().toLowerCase();
    const hit = staff.some((e) => {
      const full = e.name.toLowerCase();
      return full === bare || full.split(/\s+/)[0] === bare;
    });
    return hit ? (
      <span key={i}>
        <span
          className="rounded-md px-1 font-bold"
          style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
        >
          @{bare}
        </span>
        {trailingWs ? " " : ""}
      </span>
    ) : (
      <span key={i}>{part}</span>
    );
  });
}

export default function StaffChat(): React.ReactElement {
  const db = useAppStore((s) => s.db);
  const me = useAppStore((s) => s.currentUser());
  const chat = useChatSnapshot();

  const [peerId, setPeerId] = useState<string | null>(null);
  const channel: ChatChannel = peerId && me ? dmChannel(me.id, peerId) : STAFF_CHANNEL;

  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [othersReadUpTo, setOthersReadUpTo] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadOlderBusy, setLoadOlderBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [showListMobile, setShowListMobile] = useState(false);

  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const nearBottomRef = useRef(true);
  const lastSeqRef = useRef(0);
  const typingSentAtRef = useRef(0);
  const caretRef = useRef(0);

  // ── Voice-note recorder state ───────────────────────────────────────────────
  const [recState, setRecState] = useState<"idle" | "recording" | "sending">("idle");
  const [recMs, setRecMs] = useState(0);
  const recRef = useRef<{ rec: MediaRecorder; chunks: Blob[]; mime: string; stream: MediaStream } | null>(null);
  const recTimerRef = useRef(0);
  const recCancelRef = useRef(false);

  /** Mic availability: server storage + browser capability. */
  const micAvailable = useMemo(
    () =>
      chat.voiceReady &&
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined",
    [chat.voiceReady]
  );

  const activeStaff = useMemo(() => db.employees.filter((e) => e.status === "active"), [db.employees]);
  const peers = useMemo(() => activeStaff.filter((e) => e.id !== me?.id), [activeStaff, me?.id]);

  const presenceById = useMemo(() => {
    const map = new Map<string, ChatPresenceEntry>();
    for (const p of chat.presence) map.set(p.id, p);
    return map;
  }, [chat.presence]);

  const entryFor = useCallback(
    (emp: Employee): ChatPresenceEntry =>
      presenceById.get(emp.id) ?? { id: emp.id, name: emp.name, role: emp.role, status: "offline", lastSeenAt: 0 },
    [presenceById]
  );

  const typingNames = useMemo(
    () =>
      chat.typing
        .filter((t) => t.channel === channel)
        .map((t) => presenceById.get(t.employeeId)?.name)
        .filter((n): n is string => !!n),
    [chat.typing, channel, presenceById]
  );

  const scrollToBottom = useCallback((smooth = false): void => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    });
  }, []);

  /** Replace a locally pending twin when the server copy arrives. */
  function mergeIncoming(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
    const out = [...prev];
    for (const inc of incoming) {
      if (inc.senderId === me?.id) {
        const twinIdx = out.findIndex(
          (m) =>
            m.pending !== undefined &&
            m.senderId === inc.senderId &&
            m.body === inc.body &&
            (m.kind ?? "text") === (inc.kind ?? "text")
        );
        if (twinIdx >= 0) {
          out[twinIdx] = { ...inc };
          continue;
        }
      }
      if (!out.some((m) => m.seq === inc.seq)) out.push(inc);
    }
    out.sort((a, b) => a.seq - b.seq);
    return out;
  }

  // ── Load history whenever the channel changes ─────────────────────────────
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setMsgs([]);
    setHasMore(false);
    setOthersReadUpTo(0);
    setSearch("");
    setMention(null);
    lastSeqRef.current = 0;
    fetchChatMessages({ channel, limit: 50 })
      .then((h) => {
        if (!alive) return;
        setMsgs(h.messages);
        setHasMore(h.hasMore);
        setOthersReadUpTo(h.othersReadUpTo);
        const maxSeq = h.messages.length ? h.messages[h.messages.length - 1].seq : 0;
        lastSeqRef.current = maxSeq;
        if (channel === STAFF_CHANNEL && maxSeq) noteStaffSeq(maxSeq);
        void chatMarkRead(channel, maxSeq);
        scrollToBottom();
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    setViewedChatChannel(channel);
    return () => {
      alive = false;
    };
  }, [channel, scrollToBottom]);

  // Resume global notifications once the page unmounts.
  useEffect(() => () => setViewedChatChannel(null), []);

  // ── Incremental sync while the page is open ───────────────────────────────
  useEffect(() => {
    const stop = smartPoll(() => {
      fetchChatMessages({ channel, after: lastSeqRef.current, limit: 50 })
        .then((h) => {
          setOthersReadUpTo(h.othersReadUpTo);
          if (h.messages.length === 0) return;
          setMsgs((prev) => mergeIncoming(prev, h.messages));
          const maxSeq = h.messages[h.messages.length - 1].seq;
          if (maxSeq > lastSeqRef.current) {
            lastSeqRef.current = maxSeq;
            if (channel === STAFF_CHANNEL) noteStaffSeq(maxSeq);
            void chatMarkRead(channel, maxSeq);
          }
        })
        .catch(() => {});
    }, 3000);
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  // Stick to the bottom on new activity unless the user is reading history.
  useEffect(() => {
    if (nearBottomRef.current) scrollToBottom(true);
  }, [msgs.length, typingNames.length, scrollToBottom]);

  async function loadOlder(): Promise<void> {
    if (!hasMore || loadOlderBusy || msgs.length === 0) return;
    setLoadOlderBusy(true);
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const prevTop = el?.scrollTop ?? 0;
    try {
      const h = await fetchChatMessages({ channel, before: msgs[0].seq, limit: 50 });
      setMsgs((prev) => [...h.messages, ...prev]);
      setHasMore(h.hasMore);
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight + prevTop;
      });
    } catch {
      /* keep what we have */
    } finally {
      setLoadOlderBusy(false);
    }
  }

  async function pushMessage(
    text: string,
    replaceTempSeq?: number,
    media?: { kind: "voice"; mediaId: string; mediaMime: string; durationMs: number; mediaBytes: number }
  ): Promise<void> {
    const optimistic: ChatMessage = {
      seq: replaceTempSeq ?? -Date.now(),
      channel,
      senderId: me!.id,
      senderName: me!.name,
      body: text,
      createdAt: new Date().toISOString(),
      pending: true,
      ...(media ? { kind: media.kind, mediaId: media.mediaId, mediaMime: media.mediaMime, durationMs: media.durationMs, mediaBytes: media.mediaBytes } : {}),
    };
    setMsgs((prev) =>
      replaceTempSeq ? prev.map((m) => (m.seq === replaceTempSeq ? optimistic : m)) : [...prev, optimistic]
    );
    nearBottomRef.current = true;
    try {
      const saved = await sendChatMessage(channel, text, media);
      setMsgs((prev) => prev.map((m) => (m.seq === optimistic.seq ? { ...saved } : m)));
      if (saved.seq > lastSeqRef.current) {
        lastSeqRef.current = saved.seq;
        if (channel === STAFF_CHANNEL) noteStaffSeq(saved.seq);
      }
      void chatMarkRead(channel, saved.seq);
    } catch {
      setMsgs((prev) =>
        prev.map((m) => (m.seq === optimistic.seq ? { ...optimistic, pending: false, failed: true } : m))
      );
    }
  }

  // ── Voice-note recording ────────────────────────────────────────────────────
  const lastDurRef = useRef(0);

  function stopRecTimer(): void {
    window.clearInterval(recTimerRef.current);
    recTimerRef.current = 0;
  }

  function teardownRecorder(): void {
    recRef.current?.stream.getTracks().forEach((t) => t.stop());
    recRef.current = null;
    stopRecTimer();
  }

  async function sendRecording(): Promise<void> {
    const r = recRef.current;
    if (!r) return;
    lastDurRef.current = recMs; // capture elapsed time before state resets
    recCancelRef.current = false;
    try {
      r.rec.stop(); // onstop → finishRecording
    } catch {
      teardownRecorder();
      setRecState("idle");
    }
  }

  function cancelRecording(): void {
    if (!recRef.current) return;
    recCancelRef.current = true;
    try {
      recRef.current.rec.stop();
    } catch {
      /* already stopped */
    }
    teardownRecorder();
    setRecState("idle");
    setRecMs(0);
  }

  async function startRecording(): Promise<void> {
    if (!chat.voiceReady) {
      toast.info("Voice notes aren't configured on this deployment yet.");
      return;
    }
    if (!micAvailable) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/mpeg"];
      const mime = candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      let finalMime = mime || "audio/webm";
      rec.ondataavailable = (e): void => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      rec.onstop = (): void => {
        const useMime = rec.mimeType || finalMime;
        const stream2 = rec.stream;
        if (recCancelRef.current) {
          stream2.getTracks().forEach((t) => t.stop());
          setRecState("idle");
          setRecMs(0);
          return;
        }
        finishRecording(chunks, useMime, stream2, lastDurRef.current);
      };
      rec.start();
      recRef.current = { rec, chunks, mime: finalMime, stream };
      recCancelRef.current = false;
      setRecMs(0);
      setRecState("recording");
      stopRecTimer();
      recTimerRef.current = window.setInterval(() => setRecMs((ms) => ms + 200), 200);
    } catch {
      toast.error("Microphone unavailable — check browser permission.");
    }
  }

  // Hard cap: auto-stop (and send) at 2 minutes.
  useEffect(() => {
    if (recState !== "recording" || recMs < 120_000) return;
    lastDurRef.current = 120_000;
    recCancelRef.current = false;
    try {
      recRef.current?.rec.stop();
    } catch {
      /* noop */
    }
  }, [recMs, recState]);

  // Never leave the mic hot if the page unmounts mid-recording.
  useEffect(
    () => () => {
      if (recRef.current) {
        recCancelRef.current = true;
        try {
          recRef.current.rec.stop();
        } catch {
          /* noop */
        }
        teardownRecorder();
      }
    },
    []
  );

  async function finishRecording(chunks: Blob[], mime: string, stream: MediaStream, durationMs: number): Promise<void> {
    teardownRecorder();
    setRecState("sending");
    setRecMs(0);
    try {
      const blob = new Blob(chunks, { type: mime });
      if (!blob.size || blob.size < 512) {
        toast.error("Recording was empty.");
        setRecState("idle");
        return;
      }
      dbg(`voice recorded mime=${mime} bytes=${blob.size} dur=${durationMs}ms`);
      const { mediaId } = await uploadVoiceNote(blob, mime);
      await pushMessage("", undefined, {
        kind: "voice",
        mediaId,
        mediaMime: mime,
        durationMs: Math.max(durationMs, 1000),
        mediaBytes: blob.size,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the voice note.");
    } finally {
      stream.getTracks().forEach((t) => t.stop());
      setRecState("idle");
    }
  }

  // ── Mentions ──────────────────────────────────────────────────────────────
  const mentionMatches = useMemo(() => {
    if (!mention || !me) return [];
    const q = mention.query;
    return activeStaff
      .filter((e) => {
        const full = e.name.toLowerCase();
        return full.startsWith(q) || full.split(/\s+/)[0].startsWith(q);
      })
      .slice(0, 6);
  }, [mention, activeStaff, me]);

  function detectMention(value: string, caret: number): void {
    const before = value.slice(0, caret);
    const m = /(^|\s)@([A-Za-z]*)$/.exec(before);
    if (m) {
      setMention({ query: m[2].toLowerCase(), start: caret - m[2].length - 1 });
      setMentionIdx(0);
    } else {
      setMention(null);
    }
  }

  function applyMention(emp: Employee): void {
    const caret = caretRef.current;
    const before = draft.slice(0, caret).replace(/@[A-Za-z]*$/, `@${emp.name} `);
    const next = before + draft.slice(caret);
    const insertedEnd = before.length;
    setDraft(next);
    caretRef.current = insertedEnd;
    setMention(null);
    requestAnimationFrame(() => taRef.current?.setSelectionRange(insertedEnd, insertedEnd));
  }

  function onDraftChange(value: string, caret: number): void {
    setDraft(value);
    caretRef.current = caret;
    detectMention(value, caret);
    const now = Date.now();
    if (now - typingSentAtRef.current > 3000 && value.trim()) {
      typingSentAtRef.current = now;
      void chatSetTyping(channel);
    }
  }

  function submit(): void {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setMention(null);
    void pushMessage(text);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (mention && mentionMatches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIdx((i) => (i + 1) % mentionMatches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIdx((i) => (i - 1 + mentionMatches.length) % mentionMatches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        applyMention(mentionMatches[mentionIdx]);
        return;
      }
      if (e.key === "Escape") {
        setMention(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  const shown = useMemo(() => {
    if (!search.trim()) return msgs;
    const q = search.toLowerCase();
    return msgs.filter((m) => m.body.toLowerCase().includes(q));
  }, [msgs, search]);

  if (!me) {
    return <EmptyState icon={<MessageSquare size={28} />} title="Signed out" message="Sign in to use staff chat." />;
  }

  const convUnread = (ch: ChatChannel): number => chat.unread[ch] ?? 0;

  const sidebar = (
    <div className="flex h-full w-full flex-col">
      <div className="border-b px-3 py-3" style={{ borderColor: "var(--border)" }}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[11px] font-bold tracking-[0.08em] text-muted uppercase">Staff online</h3>
          <Badge tone={chat.connection === "online" ? "success" : chat.connection === "offline" ? "danger" : chat.connection === "reconnecting" ? "warn" : "neutral"}>
            {chat.connection === "online"
              ? "Live"
              : chat.connection === "reconnecting"
                ? "Reconnecting…"
                : chat.connection === "offline"
                  ? "Offline"
                  : "…"}
          </Badge>
        </div>
        <ul className="space-y-1">
          {activeStaff.map((emp) => {
            const entry = entryFor(emp);
            const unread = emp.id === me.id ? 0 : convUnread(dmChannel(me.id, emp.id));
            return (
              <li key={emp.id}>
                <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px]">
                  <StatusDot status={entry.status} />
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {emp.name}
                    {emp.id === me.id ? " (you)" : ""}
                  </span>
                  {unread > 0 && <Badge tone="accent">{unread}</Badge>}
                  <span className="text-[11px] font-medium text-muted">{ROLE_LABELS[emp.role]}</span>
                </div>
                {entry.status !== "online" && (
                  <div className="pl-[22px] text-[11px] text-muted">{presenceText(entry.status, entry.lastSeenAt)}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <button
          onClick={() => {
            setPeerId(null);
            setShowListMobile(false);
          }}
          className={`mb-0.5 flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13.5px] font-semibold transition-colors ${
            channel === STAFF_CHANNEL ? "" : "text-muted hover:bg-surface-2 hover:text-ink"
          }`}
          style={channel === STAFF_CHANNEL ? { background: "var(--accent-soft)", color: "var(--accent-strong)" } : undefined}
        >
          <MessagesSquare size={17} strokeWidth={2.2} />
          <span className="flex-1">Staff-wide</span>
          {convUnread(STAFF_CHANNEL) > 0 && <Badge tone="accent">{convUnread(STAFF_CHANNEL)}</Badge>}
        </button>
        <div className="mt-1 mb-1 px-2.5 text-[10.5px] font-bold tracking-[0.08em] text-muted uppercase">
          Direct messages
        </div>
        {peers.map((emp) => {
          const ch = dmChannel(me.id, emp.id);
          const entry = entryFor(emp);
          const unread = convUnread(ch);
          return (
            <button
              key={emp.id}
              onClick={() => {
                setPeerId(emp.id);
                setShowListMobile(false);
              }}
              className={`mb-0.5 flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13.5px] font-semibold transition-colors ${
                channel === ch ? "" : "text-muted hover:bg-surface-2 hover:text-ink"
              }`}
              style={channel === ch ? { background: "var(--accent-soft)", color: "var(--accent-strong)" } : undefined}
            >
              <StatusDot status={entry.status} />
              <span className="min-w-0 flex-1 truncate">{emp.name}</span>
              {unread > 0 && <Badge tone="accent">{unread}</Badge>}
            </button>
          );
        })}
      </div>
    </div>
  );

  const peer = peerId ? db.employees.find((e) => e.id === peerId) : null;

  return (
    <div className="flex h-[calc(100dvh-140px)] min-h-[440px] gap-4">
      {/* Desktop sidebar */}
      <aside className="card hidden w-72 shrink-0 overflow-hidden lg:flex lg:flex-col" style={{ padding: 0 }}>
        {sidebar}
      </aside>

      {/* Mobile conversations drawer */}
      {showListMobile && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Conversations">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowListMobile(false)} aria-hidden />
          <aside
            className="card absolute inset-y-3 left-3 z-10 flex w-80 max-w-[85vw] flex-col overflow-hidden"
            style={{ padding: 0 }}
          >
            <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
              <span className="text-sm font-bold">Conversations</span>
              <IconButton label="Close" onClick={() => setShowListMobile(false)}>
                <X size={16} />
              </IconButton>
            </div>
            <div className="min-h-0 flex-1">{sidebar}</div>
          </aside>
        </div>
      )}

      {/* Main column */}
      <section className="card relative flex min-w-0 flex-1 flex-col overflow-hidden" style={{ padding: 0 }}>
        <header className="flex items-center gap-2 border-b px-3 py-2.5" style={{ borderColor: "var(--border)" }}>
          <IconButton label="Conversations" className="lg:hidden" onClick={() => setShowListMobile(true)}>
            <PanelLeft size={17} />
          </IconButton>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14.5px] leading-tight font-extrabold">{peer ? peer.name : "Staff-wide chat"}</div>
            <div className="truncate text-[11.5px] font-medium text-muted">
              {typingNames.length > 0
                ? `${typingNames.join(", ")} ${typingNames.length === 1 ? "is" : "are"} typing…`
                : peer
                  ? `${ROLE_LABELS[peer.role]} · ${presenceText(entryFor(peer).status, entryFor(peer).lastSeenAt)}`
                  : "Everyone on the team"}
            </div>
          </div>
          <div className="relative hidden sm:block">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search messages"
              className="w-44 rounded-xl border bg-transparent py-1.5 pr-2.5 pl-8 text-[13px] font-medium outline-none focus:border-accent"
              style={{ borderColor: "var(--border)" }}
              aria-label="Search messages"
            />
          </div>
        </header>

        {chat.connection === "offline" && (
          <div
            className="px-3 py-1.5 text-center text-[12.5px] font-bold"
            style={{
              background: "color-mix(in srgb, var(--danger) 12%, transparent)",
              color: "var(--danger)",
            }}
          >
            You're offline — check your internet connection. Chat will resume automatically.
          </div>
        )}
        {chat.connection === "reconnecting" && (
          <div
            className="px-3 py-1.5 text-center text-[12.5px] font-bold"
            style={{
              background: "color-mix(in srgb, #eab308 14%, transparent)",
              color: "#a16207",
            }}
          >
            Reconnecting to the chat server…
          </div>
        )}

        <div
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
          }}
          className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-3"
        >
          {hasMore && !search && (
            <div className="pb-2 text-center">
              <button className="btn btn-secondary btn-sm !gap-1.5" onClick={() => void loadOlder()} disabled={loadOlderBusy}>
                {loadOlderBusy ? <Spinner className="size-4" /> : <RefreshCcw size={14} />} Load earlier messages
              </button>
            </div>
          )}
          {loading ? (
            <div className="grid h-full place-items-center">
              <Spinner className="size-6" />
            </div>
          ) : shown.length === 0 ? (
            <EmptyState
              icon={<MessagesSquare size={28} />}
              title={search ? "No matches" : "No messages yet"}
              message={search ? "Try a different search." : "Say hello to your team."}
            />
          ) : (
            shown.map((m, i) => {
              const prev = shown[i - 1];
              const newDay = !prev || fmtDate(prev.createdAt) !== fmtDate(m.createdAt);
              const mine = m.senderId === me.id;
              // A new "group" starts when the sender changes (or across a day
              // divider). The name shows on every group start — including my
              // own messages ("Me") so voice/text groups are always labelled.
              const groupStart = newDay || !prev || prev.senderId !== m.senderId;
              const isVoice = m.kind === "voice";
              return (
                <div key={m.seq}>
                  {newDay && (
                    <div className="py-2 text-center text-[11px] font-bold tracking-wide text-muted uppercase">
                      {fmtDate(m.createdAt)}
                    </div>
                  )}
                  <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                    {groupStart && (
                      <span className="px-1 pb-0.5 text-[11.5px] font-bold text-muted">{mine ? "Me" : m.senderName}</span>
                    )}
                    <div
                      className={`max-w-[78%] rounded-2xl px-3 py-2 text-[13.5px] leading-snug ${mine ? "rounded-br-md" : "rounded-bl-md"}`}
                      style={
                        m.failed
                          ? { background: "color-mix(in srgb, var(--danger) 12%, transparent)", border: "1px solid var(--danger)" }
                          : mine
                            ? { background: "var(--accent-soft)", color: "var(--accent-strong)" }
                            : { background: "var(--surface-2)" }
                      }
                    >
                      {isVoice && m.mediaId ? (
                        <VoiceBubble msg={m} />
                      ) : (
                        <>
                          {renderBody(m.body, activeStaff)}
                          <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] font-semibold opacity-70">
                            <span>{fmtTime(m.createdAt)}</span>
                            {mine &&
                              (m.failed ? (
                                <button
                                  className="font-bold underline underline-offset-2"
                                  onClick={() =>
                                    void pushMessage(
                                      m.body,
                                      m.seq,
                                      // Voice notes must retry WITH their media,
                                      // otherwise the server sees an empty text.
                                      m.kind === "voice" && m.mediaId
                                        ? {
                                            kind: "voice",
                                            mediaId: m.mediaId,
                                            mediaMime: m.mediaMime ?? "audio/webm",
                                            durationMs: m.durationMs ?? 1000,
                                            mediaBytes: m.mediaBytes ?? 0,
                                          }
                                        : undefined
                                    )
                                  }
                                >
                                  Not sent · Retry
                                </button>
                              ) : m.pending ? (
                                <span>Sending…</span>
                              ) : othersReadUpTo >= m.seq ? (
                                <span>Seen</span>
                              ) : null)}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {typingNames.length > 0 && (
            <div className="pt-1 pl-1 text-[11.5px] font-semibold text-muted italic">
              {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing…
            </div>
          )}
        </div>

        {/* Mention autocomplete */}
        {mention && mentionMatches.length > 0 && (
          <div className="card absolute bottom-[64px] left-3 z-20 max-h-48 w-64 overflow-y-auto p-1 shadow-lg shadow-black/10">
            {mentionMatches.map((emp, i) => (
              <button
                key={emp.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyMention(emp);
                }}
                onMouseEnter={() => setMentionIdx(i)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px]"
                style={i === mentionIdx ? { background: "var(--surface-2)" } : undefined}
              >
                <span className="font-semibold">{emp.name}</span>
                <span className="ml-auto text-[11px] font-medium text-muted">{ROLE_LABELS[emp.role]}</span>
              </button>
            ))}
          </div>
        )}

        {/* Composer — swaps to a recording bar while the mic is live */}
        {recState === "recording" ? (
          <div
            className="flex items-center gap-2 border-t px-3 py-2.5"
            style={{ borderColor: "var(--border)" }}
            role="group"
            aria-label="Recording voice note"
          >
            <span className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2" style={{ background: "color-mix(in srgb, var(--danger) 10%, transparent)" }}>
              <span
                className="size-2.5 shrink-0 animate-pulse rounded-full"
                style={{ background: "var(--danger)" }}
                aria-hidden
              />
              <span className="text-[13.5px] font-bold tabular-nums" style={{ color: "var(--danger)" }}>
                Recording {fmtDur(recMs)} · max 2:00
              </span>
            </span>
            <IconButton
              label="Cancel recording"
              onClick={cancelRecording}
              className="size-10"
              style={{ color: "var(--danger)" }}
            >
              <Trash2 size={17} />
            </IconButton>
            <button
              type="button"
              onClick={() => void sendRecording()}
              className="btn btn-primary btn-sm !min-h-[40px] !gap-1.5"
              disabled={recMs < 600}
              title={recMs < 600 ? "Hold on a moment…" : "Stop and send"}
            >
              <Send size={15} /> Send
            </button>
          </div>
        ) : (
          <form
            className="flex items-end gap-2 border-t px-3 py-2.5"
            style={{ borderColor: "var(--border)" }}
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            {micAvailable && (
              <button
                type="button"
                onClick={() => void startRecording()}
                className="btn btn-secondary btn-sm !min-h-[40px] shrink-0 !px-2.5"
                title="Record a voice note (up to 2 minutes)"
                aria-label="Record voice note"
                disabled={recState === "sending"}
              >
                {recState === "sending" ? <Spinner className="size-[15px]" /> : <Mic size={16} />}
              </button>
            )}
            <textarea
              ref={taRef}
              value={draft}
              onChange={(e) => onDraftChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
              onKeyDown={onKeyDown}
              onBlur={() => setMention(null)}
              rows={Math.min(4, Math.max(1, draft.split("\n").length))}
              placeholder={peer ? `Message ${peer.name}…` : "Message the team…"}
              className="max-h-32 min-h-[38px] min-w-0 flex-1 resize-none rounded-xl border px-3 py-2 text-[13.5px] leading-snug outline-none focus:border-accent"
              style={{ borderColor: "var(--border)", background: "transparent" }}
              aria-label="Message"
            />
            <button type="submit" className="btn btn-primary btn-sm !min-h-[40px] !gap-1.5 self-end" disabled={!draft.trim()}>
              <Send size={15} /> Send
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
