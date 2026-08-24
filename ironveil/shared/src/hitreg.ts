import { CollisionWorld, RayHit } from "./collision.js";
import { PLAYER_RADIUS, HEAD_BOX_H } from "./config.js";
import { forwardVec } from "./movement.js";

export interface EntityHitbox {
  x: number; y: number; z: number;
  height: number;
  crouching: boolean;
}

export interface EntRayResult {
  t: number;
  headshot: boolean;
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

export function raycastEntity(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  maxT: number,
  e: EntityHitbox
): EntRayResult | null {
  const idx = dx === 0 ? Infinity : 1 / dx;
  const idy = dy === 0 ? Infinity : 1 / dy;
  const idz = dz === 0 ? Infinity : 1 / dz;
  const r = PLAYER_RADIUS;
  const headMinY = e.y + e.height - HEAD_BOX_H;
  const headT = rayBox(ox, oy, oz, idx, idy, idz,
    e.x - r * 0.72, headMinY, e.z - r * 0.72,
    e.x + r * 0.72, e.y + e.height, e.z + r * 0.72);
  const bodyMax = headMinY - 0.01;
  if (bodyMax > e.y) {
    const bodyT = rayBox(ox, oy, oz, idx, idy, idz,
      e.x - r, e.y, e.z - r,
      e.x + r, bodyMax, e.z + r);
    if (bodyT >= 0 && bodyT <= maxT) {
      if (headT >= 0 && headT <= maxT && headT < bodyT) return { t: headT, headshot: true };
      return { t: bodyT, headshot: false };
    }
  }
  if (headT >= 0 && headT <= maxT) return { t: headT, headshot: true };
  return null;
}

export function raycastEntities<T extends EntityHitbox & { id: number }>(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  maxT: number,
  entities: T[],
  ignoreId: number
): { ent: T; res: EntRayResult } | null {
  let best: { ent: T; res: EntRayResult } | null = null;
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    if (e.id === ignoreId) continue;
    const res = raycastEntity(ox, oy, oz, dx, dy, dz, best ? best.res.t : maxT, e);
    if (res) best = { ent: e, res };
  }
  return best;
}

const worldHit: RayHit = { t: 0, nx: 0, ny: 0, nz: 0, boxIndex: -1 };

export function bulletTrace(
  world: CollisionWorld,
  ox: number, oy: number, oz: number,
  yaw: number, pitch: number,
  spreadDeg: number,
  rand: () => number,
  maxDist: number
): { hx: number; hy: number; hz: number; hitWorld: RayHit | null } {
  const cp = Math.cos(pitch);
  let dx = -Math.sin(yaw) * cp, dy = Math.sin(pitch), dz = -Math.cos(yaw) * cp;
  if (spreadDeg > 0.0001) {
    const a = rand() * Math.PI * 2;
    const r = Math.tan((spreadDeg * Math.PI) / 180) * Math.sqrt(rand());
    let rx = -dz, ry = 0, rz = dx;
    const rl = Math.hypot(rx, rz);
    if (rl < 1e-5) { rx = 1; rz = 0; } else { rx /= rl; rz /= rl; }
    const ux = ry * dz - rz * dy;
    const uy = rz * dx - rx * dz;
    const uz = rx * dy - ry * dx;
    dx += rx * Math.cos(a) * r + ux * Math.sin(a) * r;
    dy += ry * Math.cos(a) * r + uy * Math.sin(a) * r;
    dz += rz * Math.cos(a) * r + uz * Math.sin(a) * r;
    const l2 = Math.hypot(dx, dy, dz);
    dx /= l2; dy /= l2; dz /= l2;
  }
  const hit = world.raycast(ox, oy, oz, dx, dy, dz, maxDist);
  return { hx: ox + dx * (hit ? hit.t : maxDist), hy: oy + dy * (hit ? hit.t : maxDist), hz: oz + dz * (hit ? hit.t : maxDist), hitWorld: hit };
}
