import { CollisionWorld } from "../../shared/src/collision.js";
import { ServerEntity } from "./Entity.js";
import { mulberry32 } from "../../shared/src/mathutil.js";
import { weaponById } from "../../shared/src/weapons.js";

export interface BotCtx {
  world: CollisionWorld;
  navNodes: number[][];
  entities: ServerEntity[];
  nowS: number;
  requestReload(e: ServerEntity): void;
  tryAbility(e: ServerEntity, key: "q" | "e"): void;
}

interface BotBrain {
  seedRng: () => number;
  targetId: number;
  lastPerceive: number;
  firstSeenAt: number;
  repathAt: number;
  goalNode: number;
  strafe: number;
  strafeUntil: number;
  nextJumpAt: number;
  crouchUntil: number;
  abilityUrge: number;
  nextSemiAt: number;
}

const brains = new WeakMap<ServerEntity, BotBrain>();

const DIFFICULTY = [
  { name: "recruit", aimErr: 4.6, reactMs: 520, fovCos: 0.15 },
  { name: "regular", aimErr: 2.7, reactMs: 360, fovCos: 0.05 },
  { name: "veteran", aimErr: 1.5, reactMs: 240, fovCos: -0.1 },
];

export let BOT_DIFFICULTY_INDEX = 1;
export function setBotDifficulty(i: number): void {
  BOT_DIFFICULTY_INDEX = Math.max(0, Math.min(2, i));
}

function brainFor(e: ServerEntity): BotBrain {
  let b = brains.get(e);
  if (!b) {
    b = {
      seedRng: mulberry32((e.id + 1) * 7919),
      targetId: -1,
      lastPerceive: -9,
      firstSeenAt: 0,
      repathAt: 0,
      goalNode: -1,
      strafe: 0,
      strafeUntil: 0,
      nextJumpAt: 0,
      crouchUntil: 0,
      abilityUrge: 0.35,
      nextSemiAt: 0,
    };
    brains.set(e, b);
  }
  return b;
}

function visibleEnemy(ctx: BotCtx, e: ServerEntity, diff: typeof DIFFICULTY[0]): ServerEntity | null {
  const ex = e.move.x, ey = e.eyeY(), ez = e.move.z;
  const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw);
  let best: ServerEntity | null = null;
  let bestD = Infinity;
  for (const o of ctx.entities) {
    if (o === e || !o.alive || o.team === e.team || !o.connected) continue;
    const dx = o.move.x - ex, dz = o.move.z - ez;
    const dist = Math.hypot(dx, dz);
    if (dist > 65 || dist > bestD) continue;
    const dot = (dx * fx + dz * fz) / (dist || 1);
    if (dot < diff.fovCos && dist > 2.5) continue;
    if (!ctx.world.segmentClear(ex, ey, ez, o.move.x, o.eyeY() - 0.25, o.move.z)) continue;
    best = o;
    bestD = dist;
  }
  return best;
}

function steerToward(ctx: BotCtx, b: BotBrain, e: ServerEntity, gx: number, gz: number): { mx: number; mz: number } {
  const nodes = ctx.navNodes;
  let bx = gx, bz = gz, bd = Infinity;
  const ex = e.move.x, ez = e.move.z;
  const ey = e.eyeY();
  const directDist = Math.hypot(gx - ex, gz - ez);
  if (ctx.world.segmentClear(ex, ey - 0.3, ez, gx, 1.2, gz) || directDist < 8) {
    bx = gx; bz = gz; bd = directDist;
  } else {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const dn = Math.hypot(n[0] - ex, n[2] - ez);
      if (dn > 26 || dn < 0.01) continue;
      if (!ctx.world.segmentClear(ex, ey - 0.3, ez, n[0], n[1] + 1.1, n[2])) continue;
      const total = dn + Math.hypot(n[0] - gx, n[2] - gz);
      if (total < bd) { bd = total; bx = n[0]; bz = n[2]; }
    }
  }
  let dx = bx - ex, dz = bz - ez;
  const l = Math.hypot(dx, dz);
  if (l < 0.001) return { mx: 0, mz: 0 };
  dx /= l; dz /= l;
  if (l < 1.6 && b.goalNode >= 0) b.goalNode = -1;
  return { mx: dx, mz: dz };
}

export function botThink(ctx: BotCtx, e: ServerEntity): void {
  const b = brainFor(e);
  const diff = DIFFICULTY[BOT_DIFFICULTY_INDEX];
  const now = ctx.nowS;

  if (!e.alive || !e.connected) {
    e.btn = 0;
    return;
  }

  if (now - b.lastPerceive > 0.1) {
    b.lastPerceive = now;
    const t = visibleEnemy(ctx, e, diff);
    if (t && t.id !== b.targetId) {
      b.targetId = t.id;
      b.firstSeenAt = now;
      if (b.seedRng() < b.abilityUrge) {
        b.abilityUrge = 0.15;
        ctx.tryAbility(e, b.seedRng() < 0.5 ? "q" : "e");
      }
    } else if (!t) {
      b.targetId = -1;
    }
  }

  const target = b.targetId >= 0 ? ctx.entities[b.targetId] : null;

  e.btn = 0;

  let wishX = 0, wishZ = 0;
  let wantYaw = e.yaw, wantPitch = 0;

  if (target && target.alive) {
    const dx = target.move.x - e.move.x;
    const dy = (target.move.y + target.move.height * 0.72) - e.eyeY();
    const dz = target.move.z - e.move.z;
    const dist = Math.hypot(dx, dz);
    wantYaw = Math.atan2(-dx, -dz);
    wantPitch = Math.atan2(dy, Math.hypot(dx, dz));

    const aimTime = now - b.firstSeenAt;
    const errDeg = diff.aimErr * Math.exp(-aimTime * 2.2);
    const wob = now * 3.1 + e.id * 13.7;
    wantYaw += Math.sin(wob) * (errDeg * Math.PI) / 180;
    wantPitch += Math.cos(wob * 0.83) * (errDeg * 0.7 * Math.PI) / 180;

    const canSee = ctx.world.segmentClear(e.move.x, e.eyeY(), e.move.z, target.move.x, target.eyeY() - 0.2, target.move.z);
    if (canSee && now - b.firstSeenAt > diff.reactMs / 1000) {
      const wpn = weaponById(e.currentWeaponId());
      if (wpn.auto || wpn.melee) {
        e.btn |= 128;
      } else if (now >= b.nextSemiAt) {
        e.btn |= 128;
        b.nextSemiAt = now + Math.max(0.13, 60 / wpn.rpm + 0.06);
      }
    }
    if (e.mags[e.weaponSlot] <= 0 && now > e.reloadDur + 0.1) ctx.requestReload(e);

    if (now > b.strafeUntil) {
      b.strafe = b.seedRng() < 0.5 ? -1 : 1;
      b.strafeUntil = now + 0.5 + b.seedRng() * 0.8;
    }
    const fx = -Math.sin(wantYaw), fz = -Math.cos(wantYaw);
    const rxv = -fz, rzv = fx;
    const idealDist = e.weaponSlot === 2 ? 1.6 : dist > 30 ? 12 : dist < 7 ? 10 : 0;
    let adv = dist > idealDist + 2 ? 1 : dist < idealDist - 2 ? -0.6 : 0;
    wishX = fx * adv + rxv * b.strafe * 0.85;
    wishZ = fz * adv + rzv * b.strafe * 0.85;
    if (b.seedRng() < 0.003 && now > b.crouchUntil) b.crouchUntil = now + 0.6;
  } else {
    const nodes = ctx.navNodes;
    if (b.goalNode < 0 || now > b.repathAt) {
      b.goalNode = (b.seedRng() * nodes.length) | 0;
      const g0 = nodes[b.goalNode];
      if (g0 && Math.hypot(g0[0] - e.move.x, g0[2] - e.move.z) < 15) {
        for (let tries = 0; tries < 5; tries++) {
          const cand = (b.seedRng() * nodes.length) | 0;
          const c = nodes[cand];
          if (c && Math.hypot(c[0] - e.move.x, c[2] - e.move.z) >= 18) {
            b.goalNode = cand;
            break;
          }
        }
      }
      b.repathAt = now + 4 + b.seedRng() * 4;
    }
    const g = nodes[b.goalNode] ?? [0, 0, 0];
    const st = steerToward(ctx, b, e, g[0], g[2]);
    wishX = st.mx; wishZ = st.mz;
    if (wishX !== 0 || wishZ !== 0) wantYaw = Math.atan2(-wishX, -wishZ);
    if ((Math.abs(e.move.vx) < 0.4 && Math.abs(e.move.vz) < 0.4 && e.move.onGround) && now > b.nextJumpAt) {
      e.btn |= 16;
      b.nextJumpAt = now + 0.8;
    }
    if (e.mags[e.weaponSlot] < 4 && e.weaponSlot === 1) ctx.requestReload(e);
    if (b.seedRng() < 0.002) b.abilityUrge = 0.6;
  }

  const spd = Math.hypot(e.move.vx, e.move.vz);
  const stuck = (wishX !== 0 || wishZ !== 0) && spd < 0.6 && e.move.onGround;
  if (stuck && now > b.nextJumpAt) {
    e.btn |= 16;
    b.nextJumpAt = now + 0.6;
    if (!target && b.seedRng() < 0.4) {
      b.goalNode = -1;
      b.repathAt = 0;
    }
  }

  let dYaw = wantYaw - e.yaw;
  while (dYaw > Math.PI) dYaw -= Math.PI * 2;
  while (dYaw < -Math.PI) dYaw += Math.PI * 2;
  const turnRate = target ? 14 : 7;
  e.yaw += dYaw * Math.min(1, turnRate * 0.06);
  e.pitch += (wantPitch - e.pitch) * Math.min(1, 0.6);

  if (now < b.crouchUntil) e.btn |= 32;
  if (wishX !== 0 || wishZ !== 0) {
    const sin = Math.sin(e.yaw), cos = Math.cos(e.yaw);
    const lf = wishX * cos + wishZ * sin;
    const rf = -wishX * sin + wishZ * cos;
    if (lf > 0.25) e.btn |= 1;
    if (lf < -0.25) e.btn |= 2;
    if (rf < -0.25) e.btn |= 4;
    if (rf > 0.25) e.btn |= 8;
  }
}
