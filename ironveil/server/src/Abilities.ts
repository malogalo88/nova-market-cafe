import { agentById } from "../../shared/src/agents.js";
import { ABILITY, MAX_ARMOR } from "../../shared/src/config.js";
import * as P from "../../shared/src/protocol.js";
import { ServerEntity } from "./Entity.js";
import { MatchView, EventRec, Barrier, HealZone } from "./types.js";
import { forwardVec } from "../../shared/src/movement.js";

export function tryUseAbility(m: MatchView, e: ServerEntity, key: "q" | "e", pushEv: (ev: EventRec) => void): boolean {
  if (!e.alive || m.phase !== 2) return false;
  const agent = agentById(e.agent);
  const def = key === "q" ? agent.q : agent.e;
  const nowS = m.nowS;
  const cdEnd = key === "q" ? e.qCdEnd : e.eCdEnd;
  if (nowS < cdEnd) return false;
  let ok = false;
  lastBarrierOrientation = 0;

  switch (def.id) {
    case "pulseScan": {
      for (const o of m.ents) {
        if (!o.alive || o.team === e.team) continue;
        const d = Math.hypot(o.move.x - e.move.x, o.move.z - e.move.z);
        if (d <= ABILITY.PULSE_SCAN_R && m.world.segmentClear(e.move.x, e.eyeY(), e.move.z, o.move.x, o.eyeY(), o.move.z)) {
          o.revealedUntil = Math.max(o.revealedUntil, nowS + ABILITY.PULSE_SCAN_DUR_S);
        }
      }
      ok = true;
      break;
    }
    case "silentStep": {
      e.silentUntil = nowS + ABILITY.SILENT_STEP_DUR_S;
      ok = true;
      break;
    }
    case "barrierWall": {
      const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw);
      const px = e.move.x + fx * ABILITY.WALL_DIST;
      const pz = e.move.z + fz * ABILITY.WALL_DIST;
      const rx = -fz, rz = fx;
      const hw = ABILITY.WALL_W / 2;
      const alongX = Math.abs(rx) >= Math.abs(rz);
      const b: Barrier = {
        owner: e.id, team: e.team,
        hp: ABILITY.WALL_HP,
        dieAt: nowS + ABILITY.WALL_DUR_S,
        minX: alongX ? px - hw : px - 0.18,
        maxX: alongX ? px + hw : px + 0.18,
        minZ: alongX ? pz - 0.18 : pz - hw,
        maxZ: alongX ? pz + 0.18 : pz + hw,
        minY: e.move.y,
        maxY: e.move.y + ABILITY.WALL_H,
      };
      m.barriers.push(b);
      rebuildDynamic(m);
      lastBarrierOrientation = alongX ? 0 : 1;
      ok = true;
      break;
    }
    case "fortify": {
      e.armor = Math.min(MAX_ARMOR, e.armor + ABILITY.FORTIFY_ARMOR);
      ok = true;
      break;
    }
    case "slipstream": {
      const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw);
      const btnFwd = e.btn & 1, btnBack = e.btn & 2, btnLeft = e.btn & 4, btnRight = e.btn & 8;
      let dx = 0, dz = 0;
      if (btnFwd) { dx += fx; dz += fz; }
      if (btnBack) { dx -= fx; dz -= fz; }
      if (btnLeft) { dx -= -fz; dz -= fx; }
      if (btnRight) { dx += -fz; dz += fx; }
      const l = Math.hypot(dx, dz);
      if (l > 0.01) { dx /= l; dz /= l; } else { dx = fx; dz = fz; }
      e.move.vx = dx * ABILITY.DASH_SPEED;
      e.move.vz = dz * ABILITY.DASH_SPEED;
      if (!e.move.onGround) e.move.vy = Math.max(e.move.vy, 1.5);
      ok = true;
      break;
    }
    case "updraft": {
      e.move.vy = ABILITY.UPDRAFT_VEL;
      ok = true;
      break;
    }
    case "solaceField": {
      m.healZones.push({
        owner: e.id, team: e.team,
        x: e.move.x, y: e.move.y, z: e.move.z,
        dieAt: nowS + ABILITY.FIELD_DUR_S,
      });
      ok = true;
      break;
    }
    case "flare": {
      for (const o of m.ents) {
        if (!o.alive || !o.connected || o.team === e.team || o.isBot) continue;
        const dx = e.move.x - o.move.x, dyv = e.eyeY() - o.eyeY(), dz = e.move.z - o.move.z;
        const dist = Math.hypot(dx, dyv, dz);
        if (dist > ABILITY.FLARE_R) continue;
        if (!m.world.segmentClear(o.move.x, o.eyeY(), o.move.z, e.move.x, e.eyeY(), e.move.z)) continue;
        const f = forwardVec(o.yaw, o.pitch);
        const dot = (f[0] * dx + f[1] * dyv + f[2] * dz) / (dist || 1);
        if (dot < 0.25) continue;
        const dur = ABILITY.FLARE_BLIND_MAX_S * dot;
        pushEv({ to: o.id, kind: P.EV_BLINDED, durDs: Math.round(dur * 10), byPid: e.id });
      }
      ok = true;
      break;
    }
  }

  if (ok) {
    const isQ = key === "q";
    if (isQ) e.qCdEnd = nowS + def.cd;
    else e.eCdEnd = nowS + def.cd;
    pushEv({
      to: -1, kind: P.EV_ABILITY, pid: e.id,
      abk: abkOf(def.id), ax: e.move.x, ay: e.move.y, az: e.move.z, arg: lastBarrierOrientation,
    });
  }
  return ok;
}

let lastBarrierOrientation = 0;

export function abkOf(id: string): number {
  switch (id) {
    case "pulseScan": return P.ABK_SCAN;
    case "silentStep": return P.ABK_SILENT;
    case "barrierWall": return P.ABK_WALL;
    case "fortify": return P.ABK_FORTIFY;
    case "slipstream": return P.ABK_DASH;
    case "updraft": return P.ABK_UPDRAFT;
    case "solaceField": return P.ABK_FIELD;
    case "flare": return P.ABK_FLARE;
    default: return P.ABK_WALLDOWN;
  }
}

export function tickAbilityWorld(m: MatchView, pushEv: (ev: EventRec) => void): void {
  let barriersChanged = false;
  for (let i = m.barriers.length - 1; i >= 0; i--) {
    const b = m.barriers[i];
    if (m.nowS >= b.dieAt || b.hp <= 0) {
      m.barriers.splice(i, 1);
      barriersChanged = true;
      pushEv({
        to: -1, kind: P.EV_ABILITY, pid: b.owner,
        abk: P.ABK_WALLDOWN, ax: (b.minX + b.maxX) / 2, ay: b.minY, az: (b.minZ + b.maxZ) / 2, arg: 0,
      });
    }
  }
  if (barriersChanged) rebuildDynamic(m);

  for (let i = m.healZones.length - 1; i >= 0; i--) {
    const z = m.healZones[i];
    if (m.nowS >= z.dieAt) { m.healZones.splice(i, 1); continue; }
    for (const e of m.ents) {
      if (!e.alive || e.team !== z.team) continue;
      const d = Math.hypot(e.move.x - z.x, e.move.z - z.z);
      if (d <= ABILITY.FIELD_R && Math.abs(e.move.y - z.y) < 3) {
        e.hp = Math.min(100, e.hp + ABILITY.FIELD_HPS / TICK_RATE_F());
      }
    }
  }
}

const TICK_RATE_F = () => 64;

export function rebuildDynamic(m: MatchView): void {
  m.world.clearDynamic();
  for (const b of m.barriers) {
    m.world.addDynamicBox(b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ);
  }
}
