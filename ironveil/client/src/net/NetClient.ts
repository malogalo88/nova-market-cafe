import {
  BTN,
} from "../../../shared/src/config.js";
import { Writer, Reader, MSG_C_JOIN, MSG_C_INPUT, MSG_C_ACTION, MSG_C_PING, MSG_C_CHAT, MSG_C_LEAVE, MSG_S_WELCOME, MSG_S_SNAPSHOT, MSG_S_EVENTS, MSG_S_ROSTER, MSG_S_PONG, MSG_S_CHAT, MSG_S_KICK, MSG_S_PING, MSG_C_PONG } from "../../../shared/src/protocol.js";
import { decodeSnapshot, decodeEvent, decodeRoster, NetEntState, SnapshotHeader, RosterEntry } from "../../../shared/src/netcodec.js";

export interface RemoteSnap {
  tick: number;
  time: number;
  ents: Map<number, NetEntState>;
  header: SnapshotHeader;
}

export type GameEventHandler = (ev: any) => void;

export class NetClient {
  ws: WebSocket | null = null;
  myId = -1;
  myTeam = 0;
  mode = 0;
  mapName = "";
  token = "";

  connected = false;
  pingMs = 0;

  snapBuffer: RemoteSnap[] = [];
  latestHeader: SnapshotHeader | null = null;

  onWelcome: ((w: WelcomeInfo) => void) | null = null;
  onEvent: GameEventHandler | null = null;
  onRoster: ((r: RosterEntry[]) => void) | null = null;
  onChat: ((pid: number, text: string) => void) | null = null;
  onKick: ((reason: string) => void) | null = null;
  onDisconnect: (() => void) | null = null;
  onConnectedFirstTime: (() => void) | null = null;

  inputSender: (() => { seq: number; btn: number; yaw: number; pitch: number; slot: number }) | null = null;

  private writer = new Writer(64);
  private rttSentAt = 0;
  private snapsReceived = 0;
  private lastSnapTick = -1;
  private lostPackets = 0;
  private gotFirst = false;

  connect(url: string): void {
    this.close();
    this.ws = new WebSocket(url);
    this.ws.binaryType = "arraybuffer";
    this.gotFirst = false;

    this.ws.onopen = () => {
      const w = this.writer;
      w.reset();
      w.u8(MSG_C_JOIN);
      w.str(this.joinedName);
      w.str(this.token);
      w.u8(this.prefMode);
      w.u8(this.prefPrimary);
      w.u8(this.prefAgent);
      this.ws!.send(w.finish());
    };

    this.ws.onmessage = (ev) => this.onMessage(new Reader(ev.data as ArrayBuffer));
    this.ws.onclose = () => {
      this.connected = false;
      this.ws = null;
      this.onDisconnect?.();
    };
    this.ws.onerror = () => { /* close follows */ };

    this.pingTimer = window.setInterval(() => {
      if (this.ws && this.connected) {
        const w = this.writer;
        w.reset();
        w.u8(MSG_C_PING);
        this.rttSentAt = performance.now();
        w.u32(Math.round(performance.now()) & 0xffffffff);
        this.ws.send(w.finish());
      }
    }, 1000);
  }

  joinedName = "Operative";
  prefMode = 1;
  prefPrimary = 2;
  prefAgent = 0;
  private pingTimer = 0;

  close(): void {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = 0; }
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
    this.connected = false;
    this.snapBuffer.length = 0;
  }

  sendInput(seq: number, btn: number, yaw: number, pitch: number, slot: number): void {
    if (!this.ws || !this.connected) return;
    const w = this.writer;
    w.reset();
    w.u8(MSG_C_INPUT);
    w.u16(seq & 0xffff);
    w.u16(btn & 0xffff);
    w.u16(quantYaw(yaw));
    w.u8(quantPitchC(pitch));
    w.u8(slot);
    this.ws.send(w.finish());
  }

  sendAction(kind: number, arg: number): void {
    if (!this.ws || !this.connected) return;
    const w = this.writer;
    w.reset();
    w.u8(MSG_C_ACTION);
    w.u8(kind); w.u8(arg);
    this.ws.send(w.finish());
  }

  sendChat(text: string): void {
    if (!this.ws || !this.connected) return;
    const w = new Writer(128);
    w.u8(MSG_C_CHAT);
    w.str(text);
    this.ws.send(w.finish());
  }

  sendLeave(): void {
    if (!this.ws || !this.connected) return;
    const w = this.writer;
    w.reset();
    w.u8(MSG_C_LEAVE);
    try { this.ws.send(w.finish()); } catch { /* ignore */ }
  }

  packetLoss(): number {
    return this.snapsReceived > 10 ? this.lostPackets / (this.snapsReceived + this.lostPackets) : 0;
  }

  private onMessage(r: Reader): void {
    const t = r.u8();
    switch (t) {
      case MSG_S_WELCOME: {
        this.myId = r.u8();
        void r.u32();
        void r.u8();
        this.mode = r.u8();
        this.myTeam = r.u8();
        this.mapName = r.str();
        this.token = r.str();
        this.connected = true;
        this.onWelcome?.({ id: this.myId, team: this.myTeam, mode: this.mode, map: this.mapName });
        break;
      }
      case MSG_S_SNAPSHOT: {
        const header: SnapshotHeader = { tick: 0, ackSeq: 0, timeLeftDs: 0, phase: 0, scoreA: 0, scoreB: 0, roundNum: 0, myMag: 0, myReserve: 0 };
        const ents: NetEntState[] = [];
        decodeSnapshot(r, ents, header);
        this.latestHeader = header;
        this.snapsReceived++;
        if (this.lastSnapTick >= 0 && header.tick > this.lastSnapTick + 1) {
          this.lostPackets += Math.min(header.tick - this.lastSnapTick - 1, 30);
        }
        this.lastSnapTick = header.tick;
        const m = new Map<number, NetEntState>();
        for (const s of ents) m.set(s.id, s);
        this.snapBuffer.push({ tick: header.tick, time: performance.now(), ents: m, header });
        if (this.snapBuffer.length > 40) this.snapBuffer.shift();
        if (!this.gotFirst) {
          this.gotFirst = true;
          this.onConnectedFirstTime?.();
        }
        break;
      }
      case MSG_S_EVENTS: {
        const count = r.u8();
        for (let i = 0; i < count; i++) {
          const e = decodeEvent(r);
          if (e && (e.to < 0 || e.to === this.myId)) this.onEvent?.(e);
        }
        break;
      }
      case MSG_S_ROSTER:
        this.onRoster?.(decodeRoster(r));
        break;
      case MSG_S_PONG: {
        void r.u32();
        break;
      }
      case MSG_S_PING: {
        const w = this.writer;
        w.reset();
        w.u8(MSG_C_PONG);
        w.u32(r.u32());
        this.ws?.send(w.finish());
        break;
      }
      case MSG_S_CHAT:
        this.onChat?.(r.u8(), r.str());
        break;
      case MSG_S_KICK:
        this.onKick?.(r.str());
        break;
    }
    if (this.rttSentAt > 0 && t === MSG_S_PONG) {
      this.pingMs = Math.round(performance.now() - this.rttSentAt);
    }
  }

  sampleInterpolated(renderDelayMs: number, out: Map<number, InterpEnt>): void {
    const buf = this.snapBuffer;
    if (buf.length === 0) return;
    const targetTime = performance.now() - renderDelayMs;
    let a: RemoteSnap | null = null;
    let b: RemoteSnap | null = null;
    for (let i = buf.length - 1; i >= 0; i--) {
      if (buf[i].time <= targetTime) { a = buf[i]; b = buf[i + 1] ?? null; break; }
    }
    if (!a) { a = buf[0]; }
    if (!b) {
      for (const [id, s] of a.ents) out.set(id, { x: s.x, y: s.y, z: s.z, yaw: s.yaw, pitch: s.pitch, flags: s.flags, hp: s.hp, armor: s.armor, weapon: s.weapon, vx: s.vx, vy: s.vy, vz: s.vz });
      return;
    }
    const span = b.time - a.time;
    const f = span > 1 ? clamp((targetTime - a.time) / span, 0, 1.25) : 0;
    for (const [id, sa] of a.ents) {
      const sb = b.ents.get(id);
      if (!sb) {
        out.set(id, { x: sa.x, y: sa.y, z: sa.z, yaw: sa.yaw, pitch: sa.pitch, flags: sa.flags, hp: sa.hp, armor: sa.armor, weapon: sa.weapon, vx: sa.vx, vy: sa.vy, vz: sa.vz });
        continue;
      }
      out.set(id, {
        x: lerpN(sa.x, sb.x, f),
        y: lerpN(sa.y, sb.y, f),
        z: lerpN(sa.z, sb.z, f),
        yaw: lerpAngleN(sa.yaw, sb.yaw, f),
        pitch: lerpN(sa.pitch, sb.pitch, f),
        flags: sb.flags,
        hp: sb.hp,
        armor: sb.armor,
        weapon: sb.weapon,
        vx: lerpN(sa.vx, sb.vx, f),
        vy: lerpN(sa.vy, sb.vy, f),
        vz: lerpN(sa.vz, sb.vz, f),
      });
    }
  }
}

export interface WelcomeInfo {
  id: number;
  team: number;
  mode: number;
  map: string;
}

export interface InterpEnt {
  x: number; y: number; z: number;
  yaw: number; pitch: number;
  flags: number;
  hp: number; armor: number;
  weapon: number;
  vx: number; vy: number; vz: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
function lerpN(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function lerpAngleN(a: number, b: number, t: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
function quantYaw(yaw: number): number {
  const twoPi = Math.PI * 2;
  return Math.round((((yaw % twoPi) + twoPi) % twoPi) * 65535 / twoPi) & 0xffff;
}
function quantPitchC(pitch: number): number {
  return Math.max(0, Math.min(255, Math.round(((pitch + Math.PI / 2) / Math.PI) * 255)));
}
