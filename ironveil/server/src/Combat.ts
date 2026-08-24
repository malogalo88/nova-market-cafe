import { weaponById } from "../../shared/src/weapons.js";
import { mulberry32 } from "../../shared/src/mathutil.js";
import { ServerEntity } from "./Entity.js";
import { MatchView, EventRec } from "./types.js";
import { LagComp } from "./LagComp.js";
import * as P from "../../shared/src/protocol.js";
import { CollisionWorld } from "../../shared/src/collision.js";

const lagSample = { x: 0, y: 0, z: 0, h: 0, crouch: false };

export interface RewoundEnt {
  e: ServerEntity;
  id: number;
  x: number; y: number; z: number; h: number; crouch: boolean;
}

export function collectRewound(m: MatchView, lag: LagComp, targetTick: number): RewoundEnt[] {
  const out: RewoundEnt[] = [];
  for (const e of m.ents) {
    if (!e.alive) continue;
    if (lag.sample(targetTick, e.id, lagSample)) {
      out.push({ e, id: e.id, x: lagSample.x, y: lagSample.y, z: lagSample.z, h: lagSample.h, crouch: lagSample.crouch });
    } else {
      out.push({ e, id: e.id, x: e.move.x, y: e.move.y, z: e.move.z, h: e.move.height, crouch: e.move.crouching });
    }
  }
  return out;
}

export interface HitLike {
  id: number;
  x: number; y: number; z: number;
  h: number;
  crouching?: boolean;
  crouch?: boolean;
}

export function traceBullet(
  m: MatchView,
  world: CollisionWorld,
  shooterId: number,
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  maxDist: number,
  targets: HitLike[]
): { hitEnt: HitLike | null; headshot: boolean; t: number; wx: number; wy: number; wz: number; nAxis: number; nSign: number; tex: number } {
  const wh = world.raycast(ox, oy, oz, dx, dy, dz, maxDist);
  const wallT = wh ? wh.t : maxDist;
  let bestT = wallT;
  let bestEnt: HitLike | null = null;
  let bestHead = false;
  const idx = dx === 0 ? Infinity : 1 / dx;
  const idy = dy === 0 ? Infinity : 1 / dy;
  const idz = dz === 0 ? Infinity : 1 / dz;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (t.id === shooterId) continue;
    const headMinY = t.y + t.h - 0.34;
    const r = 0.38;
    const headT = rayBox(ox, oy, oz, idx, idy, idz,
      t.x - r * 0.72, headMinY, t.z - r * 0.72, t.x + r * 0.72, t.y + t.h, t.z + r * 0.72);
    const bodyMax = headMinY - 0.01;
    let bodyT = -1;
    if (bodyMax > t.y + 0.05) {
      bodyT = rayBox(ox, oy, oz, idx, idy, idz,
        t.x - r, t.y, t.z - r, t.x + r, bodyMax, t.z + r);
    }
    let tt = -1;
    let head = false;
    if (headT >= 0 && (bodyT < 0 || headT <= bodyT)) { tt = headT; head = true; }
    else if (bodyT >= 0) { tt = bodyT; }
    if (tt >= 0 && tt < bestT) {
      bestT = tt;
      bestEnt = t;
      bestHead = head;
    }
  }
  return {
    hitEnt: bestEnt,
    headshot: bestHead,
    t: bestT,
    wx: ox + dx * bestT, wy: oy + dy * bestT, wz: oz + dz * bestT,
    nAxis: wh && bestEnt === null ? axisOf(wh.nx, wh.ny, wh.nz) : 1,
    nSign: wh && bestEnt === null ? signOf(bestEnt === null ? wh : null, ox, oy, oz, dx, dy, dz) : 1,
    tex: wh && bestEnt === null ? texOfBox(world, wh.boxIndex) : 0,
  };
}

function rayBox(ox: number, oy: number, oz: number, idx: number, idy: number, idz: number,
  minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): number {
  let t1 = (minX - ox) * idx, t2 = (maxX - ox) * idx;
  let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
  t1 = (minY - oy) * idy; t2 = (maxY - oy) * idy;
  tmin = Math.max(tmin, Math.min(t1, t2));
  tmax = Math.min(tmax, Math.max(t1, t2));
  t1 = (minZ - oz) * idz; t2 = (maxZ - oz) * idz;
  tmin = Math.max(tmin, Math.min(t1, t2));
  tmax = Math.min(tmax, Math.max(t1, t2));
  if (tmax < tmin || tmax < 0) return -1;
  return tmin >= 0 ? tmin : -1;
}

function axisOf(nx: number, ny: number, nz: number): number {
  if (nx !== 0) return 0;
  if (ny !== 0) return 1;
  return 2;
}
function signOf(hit: { nx: number; ny: number; nz: number } | null, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): number {
  if (!hit) return 1;
  if (hit.nx !== 0) return -Math.sign(dx);
  if (hit.ny !== 0) return -Math.sign(dy);
  return -Math.sign(dz);
}
function texOfBox(world: CollisionWorld, boxIndex: number): number {
  return 1;
}

export function currentSpread(e: ServerEntity, moving01: number, onGroundAir: boolean, crouch: boolean): number {
  const w = weaponById(e.currentWeaponId());
  let s = e.ads ? w.spreadAds : w.spreadHip;
  s += w.spreadMove * moving01 * (e.ads ? 0.6 : 1);
  if (onGroundAir) s += w.spreadJump;
  if (crouch) s *= 0.7;
  s += e.bloom;
  return s;
}

export function tryFire(
  m: MatchView,
  lag: LagComp,
  e: ServerEntity,
  inputSeq: number,
  pushEv: (ev: EventRec) => void
): void {
  const nowS = m.nowS;
  if (!e.alive || m.phase !== 2) return;
  if (nowS < e.nextFireAt || nowS < e.reloadingUntil || nowS < e.drawUntil) return;
  const wid = e.currentWeaponId();
  const w = weaponById(wid);
  if (w.melee) {
    meleeAttack(m, e, pushEv);
    e.nextFireAt = nowS + 60 / w.rpm;
    return;
  }
  const magIdx = e.weaponSlot;
  if (e.mags[magIdx] <= 0) {
    e.nextFireAt = nowS + 0.25;
    requestReload(m, e, pushEv);
    return;
  }
  e.mags[magIdx]--;
  e.nextFireAt = Math.max(nowS, e.nextFireAt) + 60 / w.rpm;
  if (nowS - e.lastFireTime > 0.28) e.burstIndex = 0;
  e.lastFireTime = nowS;

  const speed01 = Math.min(1, Math.hypot(e.move.vx, e.move.vz) / 5.4);
  const air = !e.move.onGround;
  const baseSpread = currentSpread(e, speed01, air, e.move.crouching);
  const rng = mulberry32((e.id * 131071 + m.tick * 2654435761) | 0);

  const eyeX = e.move.x;
  const eyeYv = e.eyeY();
  const eyeZ = e.move.z;

  const pingMs = e.pingMs;
  const rewindTicks = Math.ceil((pingMs + 110) / 15.625);
  const targetTick = Math.max(0, m.tick - Math.min(64, rewindTicks));
  const targets = collectRewound(m, lag, targetTick);

  const pellets = w.pellets;
  for (let p = 0; p < pellets; p++) {
    const cp = Math.cos(e.pitch);
    let dx = -Math.sin(e.yaw) * cp, dyv = Math.sin(e.pitch), dz = -Math.cos(e.yaw) * cp;
    const sp = (baseSpread * Math.PI) / 180;
    if (sp > 0.00001) {
      const a = rng() * Math.PI * 2;
      const rr = Math.tan(sp) * Math.sqrt(rng());
      let rxv = -dz, rzv = dx;
      const rl = Math.hypot(rxv, rzv);
      if (rl < 1e-5) { rxv = 1; rzv = 0; } else { rxv /= rl; rzv /= rl; }
      const ux = -rzv * dyv, uy = rzv * dx - rxv * dz, uz = rxv * dyv;
      dx += rxv * Math.cos(a) * rr + ux * Math.sin(a) * rr;
      dyv += uy * Math.sin(a) * rr;
      dz += rzv * Math.cos(a) * rr + uz * Math.sin(a) * rr;
      const l2 = Math.hypot(dx, dyv, dz);
      dx /= l2; dyv /= l2; dz /= l2;
    }

    const res = traceBullet(m, m.world, e.id, eyeX, eyeYv, eyeZ, dx, dyv, dz, w.rangeFar * 3 + 40, targets);
    if (res.hitEnt) {
      const dist = res.t;
      let dmg = res.headshot ? w.dmgHead : w.dmgBody;
      if (dist > w.rangeFar) dmg *= w.falloffMin;
      dmg = Math.round(dmg);
      const victimEnt = findEntById(m, res.hitEnt.id);
      if (victimEnt) {
        applyDamage(m, e, victimEnt, dmg, res.headshot, wid, inputSeq, pushEv);
      }
    } else {
      pushEv({
        to: -1, kind: P.EV_IMPACT,
        x: res.wx, y: res.wy, z: res.wz,
        nAxis: res.nAxis, nSign: res.nSign, tex: res.tex,
      });
    }
  }

  const rp = w.recoilPitch[Math.min(e.burstIndex, w.recoilPitch.length - 1)];
  const ry = w.recoilYaw[Math.min(e.burstIndex, w.recoilYaw.length - 1)];
  e.burstIndex++;
  e.bloom = Math.min(w.bloomMax, e.bloom + w.bloomPerShot);
  e.pitch = clampPitch(e.pitch + (rp * Math.PI) / 180 * 0.55);
  e.yaw += (ry * Math.PI) / 180 * 0.4;

  pushEv({
    to: -1, kind: P.EV_SHOT, pid: e.id, weapon: wid,
    ox: eyeX, oy: eyeYv, oz: eyeZ, yaw: e.yaw, pitch: e.pitch,
  });
}

function clampPitch(p: number): number {
  const lim = Math.PI / 2 - 0.001;
  return p < -lim ? -lim : p > lim ? lim : p;
}

export function meleeAttack(m: MatchView, e: ServerEntity, pushEv: (ev: EventRec) => void): void {
  const cp = Math.cos(e.pitch);
  const dx = -Math.sin(e.yaw) * cp, dy = Math.sin(e.pitch), dz = -Math.cos(e.yaw) * cp;
  const targets: HitLike[] = [];
  for (const o of m.ents) {
    if (!o.alive || o.id === e.id) continue;
    targets.push({ id: o.id, x: o.move.x, y: o.move.y, z: o.move.z, h: o.move.height });
  }
  const res = traceBullet(m, m.world, e.id, e.move.x, e.eyeY(), e.move.z, dx, dy, dz, 2.15, targets);
  if (res.hitEnt) {
    const victim = findEntById(m, res.hitEnt.id);
    if (victim) {
      const backDot = -(dx * -Math.sin(victim.yaw) + dz * -Math.cos(victim.yaw));
      const behind = backDot > 0.35;
      applyDamage(m, e, victim, behind ? 90 : 55, false, 6, 0, pushEv);
    }
  }
}

export function requestReload(_m: MatchView, e: ServerEntity, pushEv: (ev: EventRec) => void): void {
  const nowS = _m.nowS;
  if (!e.alive || nowS < e.reloadingUntil) return;
  const wid = e.currentWeaponId();
  const w = weaponById(wid);
  if (w.melee) return;
  const slot = e.weaponSlot;
  if (e.mags[slot] >= w.magSize || e.reserves[slot] <= 0) return;
  e.reloadDur = w.reloadTime;
  e.reloadingUntil = nowS + w.reloadTime;
  pushEv({ to: -1, kind: P.EV_RELOAD, pid: e.id, durMs: Math.round(w.reloadTime * 1000) });
}

export function finishReloadIfDue(e: ServerEntity, nowS: number): void {
  if (e.reloadingUntil > 0 && nowS >= e.reloadingUntil) {
    const wid = e.currentWeaponId();
    const w = weaponById(wid);
    const slot = e.weaponSlot;
    const need = w.magSize - e.mags[slot];
    const take = Math.min(need, e.reserves[slot]);
    e.mags[slot] += take;
    e.reserves[slot] -= take;
    e.reloadingUntil = -1;
    e.reloadDur = 0;
  }
}

export function applyDamage(
  m: MatchView,
  attacker: ServerEntity,
  victim: ServerEntity,
  dmg: number,
  head: boolean,
  weaponId: number,
  fireSeq: number,
  pushEv: (ev: EventRec) => void
): void {
  if (!victim.alive) return;
  if (attacker.id !== victim.id && attacker.team === victim.team) return;
  let remaining = dmg;
  if (victim.armor > 0) {
    const absorbed = Math.min(victim.armor, Math.floor(remaining * 0.66));
    victim.armor -= absorbed;
    remaining -= absorbed;
  }
  victim.hp -= remaining;
  const dirYaw = Math.atan2(-(attacker.move.x - victim.move.x), -(attacker.move.z - victim.move.z));

  pushEv({
    to: attacker.id, kind: P.EV_HITCONFIRM, seq: fireSeq,
    dmg, hpLeft: Math.max(0, Math.ceil(victim.hp)), head, killed: victim.hp <= 0,
  });

  if (victim.hp <= 0) {
    killEntity(m, attacker, victim, weaponId, head, pushEv);
  }
}

export function killEntity(
  m: MatchView,
  killer: ServerEntity,
  victim: ServerEntity,
  weaponId: number,
  head: boolean,
  pushEv: (ev: EventRec) => void
): void {
  victim.alive = false;
  victim.hp = 0;
  victim.deaths++;
  victim.reloadingUntil = -1;
  if (killer.id !== victim.id) killer.kills++;
  pushEv({ to: -1, kind: P.EV_KILL, killer: killer.id, victim: victim.id, weapon: weaponId, head });
}

export function findEntById(m: MatchView, id: number): ServerEntity | null {
  if (id >= 0 && id < m.ents.length) return m.ents[id];
  return null;
}
