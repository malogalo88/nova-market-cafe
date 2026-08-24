import WebSocket from "ws";
import { Reader, EV_SHOT, EV_KILL } from "../shared/src/protocol.js";
import { decodeEvent, decodeSnapshot, NetEntState, SnapshotHeader } from "../shared/src/netcodec.js";

const PORT = Number(process.env.PORT ?? 8012);
const URL = `ws://127.0.0.1:${PORT}/ws`;

interface Result {
  name: string;
  ok: boolean;
  note: string;
}

const results: Result[] = [];
function record(name: string, ok: boolean, note = ""): void {
  results.push({ name, ok, note });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${note ? ` — ${note}` : ""}`);
}

class W {
  parts: number[] = [];
  u8(v: number): this { this.parts.push(v & 0xff); return this; }
  u16(v: number): this { this.parts.push(v & 0xff, (v >> 8) & 0xff); return this; }
  u32(v: number): this { this.parts.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff); return this; }
  str(s: string): this {
    const b = Buffer.from(s, "utf8");
    this.u8(b.length);
    for (const c of b) this.u8(c);
    return this;
  }
  buf(): Buffer { return Buffer.from(this.parts); }
}

class R {
  off = 1;
  constructor(public b: Buffer) { }
  u8(): number { return this.b[this.off++]; }
  u16(): number { const v = this.b.readUInt16LE(this.off); this.off += 2; return v; }
  u32(): number { const v = this.b.readUInt32LE(this.off); this.off += 4; return v; }
  skip(n: number): void { this.off += n; }
  str(): string {
    const l = this.u8();
    const s = this.b.toString("utf8", this.off, this.off + l);
    this.off += l;
    return s;
  }
}

class TestClient {
  ws: WebSocket;
  snapTicks: number[] = [];
  eventCount = 0;
  eventKinds = new Set<number>();
  rosterCount = 0;
  welcomeId = -1;
  chatMsgs: string[] = [];
  lastPositions = "";
  phase = -1;
  timeLeftDs = -1;

  constructor() {
    this.ws = new WebSocket(URL);
    this.ws.binaryType = "nodebuffer";
    this.ws.on("message", (data) => {
      const b = data as Buffer;
      const t = b[0];
      const r = new R(b);
      if (t === 10) {
        this.welcomeId = r.u8();
        r.skip(4);
        r.skip(3);
        r.str();
        r.str();
      } else if (t === 11) {
        const ncR = new Reader(new Uint8Array(b.buffer, b.byteOffset + 1));
        const header = {} as SnapshotHeader;
        const out: NetEntState[] = [];
        decodeSnapshot(ncR, out, header);
        this.snapTicks.push(header.tick);
        this.phase = header.phase;
        this.timeLeftDs = header.timeLeftDs;
        this.lastPositions = out
          .map((s) => `${s.id}:(${s.x.toFixed(1)},${s.y.toFixed(1)},${s.z.toFixed(1)})v(${s.vx.toFixed(1)},${s.vz.toFixed(1)})hp${s.hp}f${s.flags}`)
          .join(" ");
      } else if (t === 12) {
        const sr = new Reader(new Uint8Array(b).buffer);
        sr.u8();
        const count = sr.u8();
        for (let i = 0; i < count; i++) {
          const e = decodeEvent(sr);
          if (!e) break;
          this.eventKinds.add(e.kind);
          this.eventCount++;
        }
      } else if (t === 13) {
        const n = r.u8();
        this.rosterCount = Math.max(this.rosterCount, n);
        for (let i = 0; i < n; i++) {
          r.u8();
          r.str();
          r.skip(6);
        }
      } else if (t === 15) {
        r.u8();
        this.chatMsgs.push(r.str());
      }
    });
  }

  send(msg: Uint8Array): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(msg);
  }

  join(name: string): void {
    this.send(new W().u8(1).str(name).str("").u8(1).u8(2).u8(0).buf());
  }

  input(seq: number, btn: number, yawQ: number): void {
    const w = new W().u8(2).u16(seq).u16(btn).u16(yawQ).u8(128).u8(1);
    this.send(w.buf());
  }

  ping(t: number): void {
    this.send(new W().u8(4).u32(t).buf());
  }

  chat(text: string): void {
    this.send(new W().u8(5).str(text).buf());
  }

  close(): void {
    try { this.ws.close(); } catch { /* ignore */ }
  }

  waitOpen(timeoutMs = 3000): Promise<void> {
    return new Promise((res, rej) => {
      if (this.ws.readyState === WebSocket.OPEN) return res();
      const timer = setTimeout(() => rej(new Error("connect timeout")), timeoutMs);
      this.ws.once("open", () => { clearTimeout(timer); res(); });
      this.ws.once("error", (e) => { clearTimeout(timer); rej(e); });
    });
  }
}

async function main(): Promise<void> {
  const a = new TestClient();
  await a.waitOpen().catch(() => record("server reachable", false));
  record("server reachable", true);

  a.join("SmokeTester");
  const deadline = Date.now() + 4000;
  while ((a.welcomeId < 0 || a.snapTicks.length < 20 || a.rosterCount < 6) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50));
  }
  record("join accepted", a.welcomeId >= 0, `id=${a.welcomeId}`);
  record("snapshots streaming", a.snapTicks.length >= 20, `${a.snapTicks.length} snaps`);
  record("roster broadcast", a.rosterCount >= 6, `${a.rosterCount} ents`);

  const ticks = a.snapTicks;
  let monotonic = true;
  for (let i = 1; i < ticks.length; i++) {
    const d = (ticks[i] - ticks[i - 1] + 65536) % 65536;
    if (d === 0 || d > 10) { monotonic = false; break; }
  }
  record("tick counter monotonic", monotonic);

  a.ping(123456789);
  await new Promise((r) => setTimeout(r, 400));

  for (let s = 0; s < 30; s++) {
    a.input(s + 1, s % 10 === 0 ? 129 : 128, (s * 1000) % 65536);
    await new Promise((r) => setTimeout(r, 33));
  }
  record("inputs accepted without kick", a.ws.readyState === WebSocket.OPEN);

  const evDeadline = Date.now() + 30000;
  let seq = 30;
  while (!(a.eventKinds.has(EV_SHOT) || a.eventKinds.has(EV_KILL)) && Date.now() < evDeadline) {
    a.input(++seq, seq % 8 < 5 ? 129 : seq % 8 < 7 ? 1 : 0, (seq * 700) % 65536);
    await new Promise((r) => setTimeout(r, 100));
  }
  const kinds = [...a.eventKinds].sort((x, y) => x - y).join(",");
  record(
    "combat events streaming",
    a.eventKinds.has(EV_SHOT) || a.eventKinds.has(EV_KILL),
    `${a.eventCount} evts kinds=[${kinds}] phase=${a.phase} tleft=${(a.timeLeftDs / 10).toFixed(1)}s pos=[${a.lastPositions}]`
  );

  const b = new TestClient();
  await b.waitOpen();
  b.join("Chatter");
  await new Promise((r) => setTimeout(r, 600));
  b.chat("hi");
  await new Promise((r) => setTimeout(r, 500));
  record("chat relayed", a.chatMsgs.some((m) => m.includes("hi")) || b.chatMsgs.some((m) => m.includes("hi")), JSON.stringify(a.chatMsgs));

  a.close();
  b.close();

  const failed = results.filter((r) => !r.ok).length;
  console.log(failed === 0 ? "SMOKE OK" : `SMOKE FAILED (${failed})`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("SMOKE ERROR", e.message);
  process.exit(1);
});
