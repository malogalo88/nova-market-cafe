import { CollisionWorld } from "./collision.js";
import { MOVE_CFG as M, PLAYER_RADIUS, BTN, STAND_HEIGHT, CROUCH_HEIGHT } from "./config.js";
import { clamp } from "./mathutil.js";

export interface MoveState {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  onGround: boolean;
  crouching: boolean;
  height: number;
}

export interface MoveEvents {
  landedHard: boolean;
  jumped: boolean;
  walkedDist: number;
  stepUp: boolean;
}

const R = PLAYER_RADIUS;
const EPS = 0.0015;

function playerOverlaps(w: CollisionWorld, x: number, y: number, z: number, h: number): boolean {
  return w.overlapsBox(x - R, y + EPS, z - R, x + R, y + h, z + R);
}

function resolveAxis(w: CollisionWorld, s: MoveState, axis: 0 | 1 | 2): boolean {
  const cand = w.queryBox(s.x - R - 0.05, s.y - 0.05, s.z - R - 0.05, s.x + R + 0.05, s.y + s.height + 0.05, s.z + R + 0.05);
  let hit = false;
  for (let i = 0; i < cand.length; i++) {
    const b = w.boxes[cand[i]];
    if (!(s.x - R < b.maxX && s.x + R > b.minX && s.y < b.maxY && s.y + s.height > b.minY && s.z - R < b.maxZ && s.z + R > b.minZ)) continue;
    hit = true;
    if (axis === 0) {
      const cx = s.x;
      if (cx < (b.minX + b.maxX) / 2) s.x = b.minX - R - EPS;
      else s.x = b.maxX + R + EPS;
      s.vx = 0;
    } else if (axis === 2) {
      const cz = s.z;
      if (cz < (b.minZ + b.maxZ) / 2) s.z = b.minZ - R - EPS;
      else s.z = b.maxZ + R + EPS;
      s.vz = 0;
    } else {
      const cy = s.y + s.height / 2;
      if (cy < (b.minY + b.maxY) / 2) { s.y = b.minY - s.height - EPS; s.vy = Math.min(0, s.vy); }
      else { s.y = b.maxY + EPS; s.vy = Math.max(0, s.vy); }
    }
  }
  return hit;
}

function tryStepUp(w: CollisionWorld, s: MoveState, prevX: number, prevZ: number, dt: number): boolean {
  if (!s.onGround) return false;
  const saveX = s.x, saveY = s.y, saveZ = s.z, saveVX = s.vx, saveVZ = s.vz;
  s.x = prevX; s.z = prevZ; s.y += M.stepHeight;
  if (playerOverlaps(w, s.x, s.y, s.z, s.height)) { s.x = saveX; s.y = saveY; s.z = saveZ; return false; }
  s.x += saveVX * dt * 2;
  s.z += saveVZ * dt * 2;
  resolveAxis(w, s, 0);
  resolveAxis(w, s, 2);
  let landedY = -1;
  const cand = w.queryBox(s.x - R, s.y - 0.1, s.z - R, s.x + R, s.y + 0.1, s.z + R);
  for (let i = 0; i < cand.length; i++) {
    const b = w.boxes[cand[i]];
    if (s.x - R < b.maxX && s.x + R > b.minX && s.z - R < b.maxZ && s.z + R > b.minZ) {
      if (b.maxY <= saveY + M.stepHeight + 0.01 && b.maxY > landedY) landedY = b.maxY;
    }
  }
  if (landedY >= 0) {
    s.y = landedY + EPS;
    return true;
  }
  s.x = saveX; s.y = saveY; s.z = saveZ;
  return false;
}

function groundCheck(w: CollisionWorld, s: MoveState): boolean {
  if (s.vy > 0.05) return false;
  const yTest = s.y - 0.06;
  const cand = w.queryBox(s.x - R, yTest - 0.05, s.z - R, s.x + R, yTest + 0.12, s.z + R);
  for (let i = 0; i < cand.length; i++) {
    const b = w.boxes[cand[i]];
    if (s.x - R < b.maxX && s.x + R > b.minX && s.z - R < b.maxZ && s.z + R > b.minZ) {
      if (b.maxY <= s.y + 0.02 && b.maxY >= yTest) return true;
    }
  }
  return false;
}

function accelerate(vx: number, vz: number, wx: number, wz: number, wishSpeed: number, accel: number, dt: number): [number, number] {
  const cur = vx * wx + vz * wz;
  const add = wishSpeed - cur;
  if (add <= 0) return [vx, vz];
  let a = accel * dt * 10;
  if (a > add) a = add;
  return [vx + wx * a, vz + wz * a];
}

export function moveStep(
  s: MoveState,
  btn: number,
  yaw: number,
  dt: number,
  w: CollisionWorld,
  ev: MoveEvents,
  speedMult: number
): void {
  const wantCrouch = (btn & BTN.CROUCH) !== 0;
  if (wantCrouch) {
    if (!s.crouching) { s.crouching = true; s.height = CROUCH_HEIGHT; }
  } else if (s.crouching) {
    const canStand = !playerOverlaps(w, s.x, s.y, s.z, STAND_HEIGHT);
    if (canStand) { s.crouching = false; s.height = STAND_HEIGHT; }
  }

  let fx = 0, fz = 0;
  if (btn & BTN.FORWARD) fz -= 1;
  if (btn & BTN.BACK) fz += 1;
  if (btn & BTN.LEFT) fx -= 1;
  if (btn & BTN.RIGHT) fx += 1;
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  let wx = fx * cos + fz * sin;
  let wz = -fx * sin + fz * cos;
  const wl = Math.hypot(wx, wz);
  if (wl > 1e-4) { wx /= wl; wz /= wl; }

  let maxSpeed = M.baseSpeed * speedMult;
  if (s.crouching) maxSpeed *= M.crouchMult;
  else if (btn & BTN.WALK) maxSpeed *= M.walkMult;

  const wasGround = s.onGround;
  if (wasGround) {
    const speed = Math.hypot(s.vx, s.vz);
    if (speed > 0.001) {
      const drop = Math.max(speed, M.stopSpeed) * M.friction * dt;
      const ns = Math.max(0, speed - drop);
      const sc = ns / speed;
      s.vx *= sc; s.vz *= sc;
    }
    if ((btn & BTN.JUMP) !== 0) {
      s.vy = M.jumpVel;
      s.onGround = false;
      ev.jumped = true;
    }
  }

  if (wl > 1e-4) {
    const airCap = Math.min(maxSpeed, wasGround ? maxSpeed : M.airWishCap + 0.2);
    const accelRate = wasGround ? M.groundAccel : M.airAccel;
    const [nx, nz] = accelerate(s.vx, s.vz, wx, wz, airCap, accelRate, dt);
    s.vx = nx; s.vz = nz;
  }

  if (!s.onGround) s.vy -= M.gravity * dt;

  const px = s.x, pz = s.z;
  s.x += s.vx * dt;
  if (resolveAxis(w, s, 0)) tryStepUp(w, s, px, pz, dt);
  s.z += s.vz * dt;
  if (resolveAxis(w, s, 2)) tryStepUp(w, s, px, pz, dt);

  s.y += s.vy * dt;
  resolveAxis(w, s, 1);

  const grounded = groundCheck(w, s);
  if (grounded) {
    if (!wasGround && s.vy <= M.landHardVy) ev.landedHard = true;
    if (!wasGround || s.vy < 0) {
      s.vy = 0;
      const snapCand = w.queryBox(s.x - R, s.y - 0.3, s.z - R, s.x + R, s.y + 0.1, s.z + R);
      let bestY = -Infinity;
      for (let i = 0; i < snapCand.length; i++) {
        const b = w.boxes[snapCand[i]];
        if (s.x - R < b.maxX && s.x + R > b.minX && s.z - R < b.maxZ && s.z + R > b.minZ && b.maxY <= s.y + 0.05 && b.maxY > bestY) bestY = b.maxY;
      }
      if (bestY > -Infinity) s.y = bestY + EPS;
    }
    s.onGround = true;
  } else {
    s.onGround = false;
  }

  const moved = Math.hypot(s.x - px, s.z - pz);
  if (s.onGround && moved > 0.0001) ev.walkedDist += moved;

  const maxX = M.boundX;
  if (s.x > maxX) { s.x = maxX; if (s.vx > 0) s.vx = 0; }
  else if (s.x < -maxX) { s.x = -maxX; if (s.vx < 0) s.vx = 0; }
  const maxZ = M.boundZ;
  if (s.z > maxZ) { s.z = maxZ; if (s.vz > 0) s.vz = 0; }
  else if (s.z < -maxZ) { s.z = -maxZ; if (s.vz < 0) s.vz = 0; }
}

export function forwardVec(yaw: number, pitch: number): [number, number, number] {
  const cp = Math.cos(pitch);
  return [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
}
