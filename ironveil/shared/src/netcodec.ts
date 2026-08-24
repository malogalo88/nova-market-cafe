import {
  quantPos, quantAngle, quantPitch, dequantAngle, dequantPos, dequantPitch,
} from "../../shared/src/config.js";
import * as P from "../../shared/src/protocol.js";
import { Writer, Reader } from "../../shared/src/protocol.js";

export interface EvBase {
  to: number;
  kind: number;
}

export interface EvShot extends EvBase {
  kind: typeof P.EV_SHOT;
  pid: number; weapon: number;
  ox: number; oy: number; oz: number;
  yaw: number; pitch: number;
}
export interface EvImpact extends EvBase {
  kind: typeof P.EV_IMPACT;
  x: number; y: number; z: number;
  nAxis: number; nSign: number; tex: number;
}
export interface EvHitConfirm extends EvBase {
  kind: typeof P.EV_HITCONFIRM;
  seq: number; dmg: number; hpLeft: number; head: boolean; killed: boolean;
}
export interface EvDamaged extends EvBase {
  kind: typeof P.EV_DAMAGED;
  dmg: number; attackerId: number; head: boolean; dirYaw: number;
}
export interface EvKill extends EvBase {
  kind: typeof P.EV_KILL;
  killer: number; victim: number; weapon: number; head: boolean;
}
export interface EvFootstep extends EvBase {
  kind: typeof P.EV_FOOTSTEP;
  pid: number; x: number; y: number; z: number; loud: number;
}
export interface EvReload extends EvBase {
  kind: typeof P.EV_RELOAD;
  pid: number; durMs: number;
}
export interface EvAbility extends EvBase {
  kind: typeof P.EV_ABILITY;
  pid: number; abk: number;
  ax: number; ay: number; az: number; arg: number;
}
export interface EvBlinded extends EvBase {
  kind: typeof P.EV_BLINDED;
  durDs: number; byPid: number;
}
export interface EvBanner extends EvBase {
  kind: typeof P.EV_BANNER;
  bannerKind: number; arg: number;
}

export type EventRec =
  | EvShot | EvImpact | EvHitConfirm | EvDamaged | EvKill
  | EvFootstep | EvReload | EvAbility | EvBlinded | EvBanner;

export interface SnapEntLike {
  connected: boolean;
  isBot: boolean;
  move: { x: number; y: number; z: number; crouching: boolean; vx: number; vy: number; vz: number };
  yaw: number; pitch: number;
  alive: boolean;
  ads: boolean;
  revealedUntil: number;
  reloadingUntil: number;
  hp: number; armor: number;
  currentWeaponId(): number;
  id: number;
}

export interface SnapView {
  tick: number;
  nowS: number;
  ents: SnapEntLike[];
  timeLeftS: number;
  phase: number;
  scoreA: number;
  scoreB: number;
  roundNum: number;
}

export interface NetEntState {
  id: number;
  x: number; y: number; z: number;
  yaw: number; pitch: number;
  flags: number;
  hp: number; armor: number;
  weapon: number;
  vx: number; vy: number; vz: number;
}

export function encodeSnapshot(
  w: Writer,
  m: SnapView,
  ackSeq: number,
  selfMag: number,
  selfReserve: number
): Uint8Array {
  w.reset();
  w.u8(P.MSG_S_SNAPSHOT);
  w.u32(m.tick);
  let count = 0;
  for (const e of m.ents) if (e.connected || e.isBot) count++;
  w.u16(ackSeq);
  w.u16(Math.max(0, Math.round(m.timeLeftS * 10)));
  w.u8(m.phase);
  w.u8(m.scoreA); w.u8(m.scoreB);
  w.u8(count > 255 ? 255 : count);
  w.u8(m.roundNum);
  w.u8(Math.max(0, Math.min(255, selfMag)));
  w.u8(Math.max(0, Math.min(255, selfReserve)));
  for (const e of m.ents) {
    if (!(e.connected || e.isBot)) continue;
    w.u8(e.id);
    w.u16(quantPos(e.move.x));
    w.u16(quantPos(e.move.y));
    w.u16(quantPos(e.move.z));
    w.u16(quantAngle(e.yaw));
    w.u8(quantPitch(e.pitch));
    let f = 0;
    if (e.alive) f |= P.ENT_ALIVE;
    if (e.move.crouching) f |= P.ENT_CROUCH;
    if (e.ads && e.alive) f |= P.ENT_ADS;
    if (m.nowS < e.revealedUntil) f |= P.ENT_REVEALED;
    if (m.nowS < e.reloadingUntil) f |= P.ENT_RELOADING;
    w.u8(f);
    w.u8(Math.max(0, Math.min(255, Math.ceil(e.hp))));
    w.u8(Math.max(0, Math.min(255, Math.ceil(e.armor))));
    w.u8(e.currentWeaponId());
    w.i8(Math.max(-127, Math.min(127, Math.round(e.move.vx * 4))));
    w.i8(Math.max(-127, Math.min(127, Math.round(e.move.vy * 4))));
    w.i8(Math.max(-127, Math.min(127, Math.round(e.move.vz * 4))));
  }
  return w.finish();
}

export function decodeSnapshot(r: Reader, out: NetEntState[], header: SnapshotHeader): void {
  header.tick = r.u32();
  header.ackSeq = r.u16();
  header.timeLeftDs = r.u16();
  header.phase = r.u8();
  header.scoreA = r.u8();
  header.scoreB = r.u8();
  const count = r.u8();
  header.roundNum = r.u8();
  header.myMag = r.u8();
  header.myReserve = r.u8();
  out.length = count;
  for (let i = 0; i < count; i++) {
    let s = out[i];
    if (!s) { s = { id: 0, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, flags: 0, hp: 0, armor: 0, weapon: 0, vx: 0, vy: 0, vz: 0 }; out[i] = s; }
    s.id = r.u8();
    s.x = dequantPos(r.u16());
    s.y = dequantPos(r.u16());
    s.z = dequantPos(r.u16());
    s.yaw = dequantAngle(r.u16());
    s.pitch = dequantPitch(r.u8());
    s.flags = r.u8();
    s.hp = r.u8();
    s.armor = r.u8();
    s.weapon = r.u8();
    s.vx = r.i8() / 4;
    s.vy = r.i8() / 4;
    s.vz = r.i8() / 4;
  }
}

export interface SnapshotHeader {
  tick: number;
  ackSeq: number;
  timeLeftDs: number;
  phase: number;
  scoreA: number;
  scoreB: number;
  roundNum: number;
  myMag: number;
  myReserve: number;
}

export function encodeEvent(w: Writer, e: EventRec): void {
  switch (e.kind) {
    case P.EV_SHOT:
      w.u8(P.EV_SHOT); w.u8(e.pid); w.u8(e.weapon);
      w.u16(quantPos(e.ox)); w.u16(quantPos(e.oy)); w.u16(quantPos(e.oz));
      w.u16(quantAngle(e.yaw)); w.u8(quantPitch(e.pitch));
      break;
    case P.EV_IMPACT:
      w.u8(P.EV_IMPACT);
      w.u16(quantPos(e.x)); w.u16(quantPos(e.y)); w.u16(quantPos(e.z));
      w.u8(e.nAxis); w.u8(e.nSign); w.u8(e.tex);
      break;
    case P.EV_HITCONFIRM:
      w.u8(P.EV_HITCONFIRM); w.u16(e.seq); w.u8(e.dmg); w.u8(e.hpLeft);
      w.u8((e.head ? P.EF_HEAD : 0) | (e.killed ? P.EF_KILLED : 0));
      break;
    case P.EV_DAMAGED:
      w.u8(P.EV_DAMAGED); w.u8(e.dmg); w.u8(e.attackerId);
      w.u8((e.head ? P.EF_HEAD : 0)); w.u16(quantAngle(e.dirYaw));
      break;
    case P.EV_KILL:
      w.u8(P.EV_KILL); w.u8(e.killer); w.u8(e.victim); w.u8(e.weapon);
      w.u8(e.head ? P.EF_HEAD : 0);
      break;
    case P.EV_FOOTSTEP:
      w.u8(P.EV_FOOTSTEP); w.u8(e.pid);
      w.u16(quantPos(e.x)); w.u16(quantPos(e.y)); w.u16(quantPos(e.z));
      w.u8(e.loud);
      break;
    case P.EV_RELOAD:
      w.u8(P.EV_RELOAD); w.u8(e.pid); w.u16(e.durMs);
      break;
    case P.EV_ABILITY:
      w.u8(P.EV_ABILITY); w.u8(e.pid); w.u8(e.abk);
      w.u16(quantPos(e.ax)); w.u16(quantPos(e.ay)); w.u16(quantPos(e.az));
      w.u8(e.arg);
      break;
    case P.EV_BLINDED:
      w.u8(P.EV_BLINDED); w.u16(e.durDs); w.u8(e.byPid);
      break;
    case P.EV_BANNER:
      w.u8(P.EV_BANNER); w.u8(e.bannerKind); w.u8(e.arg);
      break;
  }
}

export function decodeEvent(r: Reader): EventRec | null {
  const kind = r.u8();
  switch (kind) {
    case P.EV_SHOT: {
      const pid = r.u8(); const weapon = r.u8();
      const ox = dequantPos(r.u16()); const oy = dequantPos(r.u16()); const oz = dequantPos(r.u16());
      return { to: -1, kind, pid, weapon, ox, oy, oz, yaw: dequantAngle(r.u16()), pitch: dequantPitch(r.u8()) };
    }
    case P.EV_IMPACT: {
      const x = dequantPos(r.u16()); const y = dequantPos(r.u16()); const z = dequantPos(r.u16());
      return { to: -1, kind, x, y, z, nAxis: r.u8(), nSign: r.u8(), tex: r.u8() };
    }
    case P.EV_HITCONFIRM: {
      const seq = r.u16(); const dmg = r.u8(); const hpLeft = r.u8(); const fl = r.u8();
      return { to: -1, kind, seq, dmg, hpLeft, head: (fl & P.EF_HEAD) !== 0, killed: (fl & P.EF_KILLED) !== 0 };
    }
    case P.EV_DAMAGED: {
      const dmg = r.u8(); const attackerId = r.u8(); const head = (r.u8() & P.EF_HEAD) !== 0;
      return { to: -1, kind, dmg, attackerId, head, dirYaw: dequantAngle(r.u16()) };
    }
    case P.EV_KILL: {
      const killer = r.u8(); const victim = r.u8(); const weapon = r.u8(); const head = (r.u8() & P.EF_HEAD) !== 0;
      return { to: -1, kind, killer, victim, weapon, head };
    }
    case P.EV_FOOTSTEP: {
      const pid = r.u8();
      const x = dequantPos(r.u16()); const y = dequantPos(r.u16()); const z = dequantPos(r.u16());
      return { to: -1, kind, pid, x, y, z, loud: r.u8() };
    }
    case P.EV_RELOAD: {
      const pid = r.u8(); const durMs = r.u16();
      return { to: -1, kind, pid, durMs };
    }
    case P.EV_ABILITY: {
      const pid = r.u8(); const abk = r.u8();
      const ax = dequantPos(r.u16()); const ay = dequantPos(r.u16()); const az = dequantPos(r.u16());
      return { to: -1, kind, pid, abk, ax, ay, az, arg: r.u8() };
    }
    case P.EV_BLINDED: {
      const durDs = r.u16(); const byPid = r.u8();
      return { to: -1, kind, durDs, byPid };
    }
    case P.EV_BANNER: {
      const bannerKind = r.u8(); const arg = r.u8();
      return { to: -1, kind, bannerKind, arg };
    }
    default:
      return null;
  }
}

export function encodeEvents(w: Writer, evq: EventRec[]): void {
  w.reset();
  w.u8(P.MSG_S_EVENTS);
  w.u8(evq.length);
  for (let i = 0; i < evq.length; i++) encodeEvent(w, evq[i]);
}

export interface RosterEntry {
  id: number;
  name: string;
  team: number;
  agent: number;
  kills: number;
  deaths: number;
  pingMs: number;
  connected: boolean;
  isBot: boolean;
}

export function encodeRoster(w: Writer, entries: RosterEntry[]): void {
  w.reset();
  w.u8(P.MSG_S_ROSTER);
  w.u8(entries.length);
  for (const e of entries) {
    w.u8(e.id);
    w.str(e.name);
    w.u8(e.team); w.u8(e.agent);
    w.u8(Math.min(255, e.kills)); w.u8(Math.min(255, e.deaths));
    w.u8(Math.min(255, Math.round(e.pingMs)));
    w.u8((e.connected ? 1 : 0) | (e.isBot ? 2 : 0));
  }
}

export function decodeRoster(r: Reader): RosterEntry[] {
  const n = r.u8();
  const out: RosterEntry[] = [];
  for (let i = 0; i < n; i++) {
    const id = r.u8();
    const name = r.str();
    out.push({
      id, name,
      team: r.u8(), agent: r.u8(),
      kills: r.u8(), deaths: r.u8(),
      pingMs: r.u8(),
      connected: (r.u8() & 1) !== 0,
      isBot: false,
    });
  }
  return out;
}
