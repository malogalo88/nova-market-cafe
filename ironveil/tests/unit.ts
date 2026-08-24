import { strict as assert } from "node:assert";
import { Writer, Reader } from "../shared/src/protocol.js";
import { quantPos, dequantPos, quantAngle, dequantAngle, quantPitch, dequantPitch, MOVE_CFG, MODE_DM, PHASE_LIVE } from "../shared/src/config.js";
import { encodeSnapshot, decodeSnapshot, SnapshotHeader, NetEntState } from "../shared/src/netcodec.js";
import { moveStep, MoveState, MoveEvents } from "../shared/src/movement.js";
import { buildFoundry } from "../shared/src/mapdata.js";
import { CollisionWorld } from "../shared/src/collision.js";
import { raycastEntity } from "../shared/src/hitreg.js";

function testQuantization(): void {
  for (let i = 0; i < 500; i++) {
    const v = (Math.random() * 2 - 1) * 63;
    const q = quantPos(v);
    assert.ok(Math.abs(dequantPos(q) - v) < 0.13, `pos quant drift ${v}`);
  }
  for (let i = 0; i < 200; i++) {
    const a = Math.random() * Math.PI * 2;
    assert.ok(Math.abs(dequantAngle(quantAngle(a)) - a) < 0.001 || Math.abs(Math.abs(dequantAngle(quantAngle(a)) - a) - Math.PI * 2) < 0.001);
  }
  for (let i = 0; i < 200; i++) {
    const p = Math.random() * 1.5 - 0.75;
    assert.ok(Math.abs(dequantPitch(quantPitch(p)) - p) < 0.02, `pitch quant drift ${p}`);
  }
}

function testWriterReader(): void {
  const w = new Writer(64);
  w.u8(200); w.u16(65535); w.u32(4000000000); w.i8(-100); w.i16(-30000); w.str("ironveil");
  const r = new Reader(w.finish().buffer as ArrayBuffer);
  assert.equal(r.u8(), 200);
  assert.equal(r.u16(), 65535);
  assert.equal(r.u32(), 4000000000);
  assert.equal(r.i8(), -100);
  assert.equal(r.i16(), -30000);
  assert.equal(r.str(), "ironveil");
}

function makeFakeEnt(id: number, x: number, y: number, z: number) {
  return {
    id,
    connected: true,
    isBot: false,
    alive: true,
    ads: false,
    revealedUntil: -1,
    reloadingUntil: -1,
    hp: 100,
    armor: 25,
    yaw: 0.5,
    pitch: -0.1,
    move: { x, y, z, crouching: false, vx: 1, vy: 0, vz: -2 },
    currentWeaponId: () => 2,
  };
}

function testSnapshotRoundtrip(): void {
  const w = new Writer(512);
  const ents = [makeFakeEnt(0, 1, 2, 3), makeFakeEnt(5, -10, 0.5, 20)];
  const view = {
    tick: 123456,
    nowS: 10,
    ents,
    timeLeftS: 88.4,
    phase: 2,
    scoreA: 3,
    scoreB: 7,
    roundNum: 11,
  };
  const buf = encodeSnapshot(w, view, 40960, 24, 90);
  assert.ok(buf.length > 0 && buf.length < 80, "snapshot compact");
  const r = new Reader(buf.buffer as ArrayBuffer);
  assert.equal(r.u8(), 11);
  const out: NetEntState[] = [];
  const header: SnapshotHeader = { tick: 0, ackSeq: 0, timeLeftDs: 0, phase: 0, scoreA: 0, scoreB: 0, roundNum: 0, myMag: 0, myReserve: 0 };
  decodeSnapshot(r, out, header);
  assert.equal(out.length, 2);
  assert.equal(header.tick, 123456);
  assert.equal(header.phase, 2);
  assert.equal(header.myMag, 24);
  assert.equal(header.myReserve, 90);
  assert.equal(out[0].id, 0);
  assert.ok(Math.abs(out[0].x - 1) < 0.13);
  assert.ok(Math.abs(out[1].z - 20) < 0.13);
  assert.equal(out[0].weapon, 2);
}

function buildTestWorld(): CollisionWorld {
  const world = new CollisionWorld();
  world.addBox(-50, -1, -50, 50, 0, 50);
  world.addBox(-2, 0, -2, 2, 3, 2);
  world.build();
  return world;
}

function testMovementDeterminism(): void {
  const map = buildFoundry();
  const runOnce = (): { x: number; y: number; z: number } => {
    const world = new CollisionWorld();
    for (const b of map.boxes) {
      world.addBox(b.x - b.sx / 2, b.y - b.sy / 2, b.z - b.sz / 2, b.x + b.sx / 2, b.y + b.sy / 2, b.z + b.sz / 2);
    }
    world.build();
    const s: MoveState = { x: 0, y: 2, z: 30, vx: 0, vy: 0, vz: 0, onGround: false, crouching: false, height: 1.8 };
    const ev: MoveEvents = { landedHard: false, jumped: false, walkedDist: 0, stepUp: false };
    let jumpTick = 10;
    for (let t = 0; t < 600; t++) {
      const btn = (t === jumpTick ? 16 : 0) | (t > 5 && t < 400 ? 1 : 0) | ((t > 100 && t < 150) ? 8 : 0) | ((t % 97 < 30) ? 32 : 0);
      moveStep(s, btn, t * 0.004, 1 / 64, world, ev, 1);
      if (t === 300) jumpTick = 320;
    }
    return { x: s.x, y: s.y, z: s.z };
  };
  const a = runOnce();
  const b = runOnce();
  assert.equal(a.x, b.x);
  assert.equal(a.y, b.y);
  assert.equal(a.z, b.z);
  assert.ok(Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(a.z));
}

function testRaycastEntity(): void {
  const target = { x: 0, y: 0, z: 0, height: 1.8, crouching: false };
  const body = raycastEntity(0, 1.0, 6, 0, 0, -1, 100, target);
  assert.ok(body, "body shot should register");
  assert.ok(!body.headshot, "torso-level shot is not headshot");
  const head = raycastEntity(0, 1.3, 10, 0, 0.042, -1, 100, target);
  assert.ok(head?.headshot, "head-height shot should be headshot");
  const miss = raycastEntity(5, 1.66, 5, 0, 0, -1, 100, target);
  assert.equal(miss, null);
}

function testWorldRaycast(): void {
  const world = buildTestWorld();
  const floor = world.raycast(20, 5, 20, 0, -1, 0, 100);
  assert.ok(floor);
  assert.ok(Math.abs(floor.t - 5) < 0.01);
  assert.equal(floor.ny, 1);
  const boxSide = world.raycast(0, 1, 10, 0, 0, -1, 100);
  assert.ok(boxSide);
  assert.ok(Math.abs(boxSide.t - 8) < 0.01, `expected t~8 got ${boxSide.t}`);
  assert.equal(boxSide.nz, 1);
}

function stubDomForTextures(): void {
  const px = 256 * 256 * 4;
  const mkCtx = (): CanvasRenderingContext2D => {
    const noop = (): void => undefined;
    return {
      fillStyle: "", strokeStyle: "", lineWidth: 0, font: "",
      fillRect: noop, strokeRect: noop, clearRect: noop, fillText: noop,
      beginPath: noop, moveTo: noop, lineTo: noop, arc: noop,
      fill: noop, stroke: noop, save: noop, restore: noop,
      translate: noop, rotate: noop,
      getImageData: () => ({ data: new Uint8ClampedArray(px) }),
      putImageData: noop,
    } as unknown as CanvasRenderingContext2D;
  };
  const canvas = () => ({
    width: 0, height: 0,
    getContext: () => mkCtx(),
  });
  (globalThis as Record<string, unknown>).document = { createElement: canvas };
}

async function testWorldWinding(): Promise<void> {
  stubDomForTextures();
  const { buildWorldMeshes } = await import("../client/src/render/world.js");
  const { TEX_UV, ATLAS_COLS, ATLAS_ROWS } = await import("../client/src/render/textures.js");
  for (let i = 0; i < 8; i++) {
    const [u0, v0] = TEX_UV[i];
    assert.ok(u0 >= 0 && u0 <= 1 - 1 / ATLAS_COLS + 1e-9, `uv u out of cell ${i}`);
    assert.ok(v0 >= 0 && v0 <= 1 - 1 / ATLAS_ROWS + 1e-9, `uv v out of cell ${i}`);
  }
  const group = buildWorldMeshes(buildFoundry());
  let tris = 0;
  group.traverse((o) => {
    const mesh = o as import("three").Mesh;
    if (!mesh.isMesh) return;
    const pos = mesh.geometry.getAttribute("position");
    const nor = mesh.geometry.getAttribute("normal");
    const idx = mesh.geometry.getIndex();
    assert.ok(idx !== null);
    for (let t = 0; t < idx.count; t += 3) {
      const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
      const ax = pos.getX(a), ay = pos.getY(a), az = pos.getZ(a);
      const e1x = pos.getX(b) - ax, e1y = pos.getY(b) - ay, e1z = pos.getZ(b) - az;
      const e2x = pos.getX(c) - ax, e2y = pos.getY(c) - ay, e2z = pos.getZ(c) - az;
      const gx = e1y * e2z - e1z * e2y;
      const gy = e1z * e2x - e1x * e2z;
      const gz = e1x * e2y - e1y * e2x;
      const dot = gx * nor.getX(a) + gy * nor.getY(a) + gz * nor.getZ(a);
      assert.ok(dot > 0, `inverted winding at tri ${t} of mesh in world group (dot=${dot})`);
      tris++;
    }
  });
  assert.ok(tris > 600, `expected substantial map geometry, got ${tris} tris`);
}

const hudEls = new Map<string, { textContent: string; [k: string]: unknown }>();
function stubHudDom(): void {
  hudEls.clear();
  const mkEl = (): { textContent: string; [k: string]: unknown } => ({
    textContent: "",
    style: {} as Record<string, string>,
    classList: { toggle: (): void => undefined, add: (): void => undefined, remove: (): void => undefined },
    appendChild: (): void => undefined,
    remove: (): void => undefined,
    children: [] as unknown[],
    innerHTML: "",
    querySelector: (): Record<string, unknown> => mkEl(),
  });
  (globalThis as Record<string, unknown>).document = {
    createElement: (): Record<string, unknown> => mkEl(),
    getElementById: (id: string): Record<string, unknown> => {
      let e = hudEls.get(id);
      if (!e) { e = mkEl(); hudEls.set(id, e); }
      return e;
    },
  };
}
function elText(id: string): string {
  return hudEls.get(id)?.textContent ?? "";
}

async function testHudAmmo(): Promise<void> {
  stubHudDom();
  const { HUD } = await import("../client/src/ui/HUD.js");
  const hud = new HUD();
  hud.updateAmmo(25, 75, "ar-77 longhorn");
  assert.equal(elText("ammomag"), "25", "rifle mag should display number");
  assert.equal(elText("ammoresev"), "/ 75", "reserve should display");
  assert.equal(elText("weaponname"), "AR-77 LONGHORN");
  hud.updateAmmo(0, 75, "ar-77 longhorn");
  assert.equal(elText("ammomag"), "0");
  hud.updateAmmo(-1, -1, "tanto");
  assert.equal(elText("ammomag"), "—", "melee mag should render dash, never -1");
  assert.equal(elText("ammoresev"), "", "melee reserve should render empty, never -1");
}

function buildFoundryWorld(): CollisionWorld {
  const world = new CollisionWorld();
  for (const b of buildFoundry().boxes) {
    world.addBox(b.x - b.sx / 2, b.y - b.sy / 2, b.z - b.sz / 2, b.x + b.sx / 2, b.y + b.sy / 2, b.z + b.sz / 2);
  }
  world.build();
  return world;
}

function mkState(x: number, y: number, z: number): { s: MoveState; ev: MoveEvents } {
  return {
    s: { x, y, z, vx: 0, vy: 0, vz: 0, onGround: false, crouching: false, height: 1.8 },
    ev: { landedHard: false, jumped: false, walkedDist: 0, stepUp: false },
  };
}

function testFallSafety(): void {
  const world = buildFoundryWorld();
  const dt = 1 / 64;
  const floor = buildFoundry().boxes[0];

  const drop = mkState(-35, 6, -27);
  for (let t = 0; t < 180; t++) moveStep(drop.s, 0, 0, dt, world, drop.ev, 1);
  assert.ok(drop.s.onGround, "dropped entity should land grounded");
  assert.ok(Math.abs(drop.s.y - (floor.y + floor.sy / 2)) < 0.05, `should rest on floor top y≈0, got ${drop.s.y}`);
  assert.ok(drop.s.y > -1, "entity must never sink below the floor");

  for (const list of [buildFoundry().spawnsA, buildFoundry().spawnsB]) {
    for (const sp of list) {
      const st = mkState(sp[0], sp[1] + 0.05, sp[2]);
      for (let t = 0; t < 30; t++) moveStep(st.s, 0, 0, dt, world, st.ev, 1);
      assert.ok(st.s.onGround, `spawn (${sp[0]},${sp[2]}) should be on a walkable surface`);
      assert.ok(st.s.y >= -0.05 && st.s.y < 3, `spawn (${sp[0]},${sp[2]}) resting height sane, got ${st.s.y}`);
    }
  }

  const push = mkState(40, 0.02, 0);
  let maxXSeen = -Infinity;
  for (let t = 0; t < 300; t++) {
    moveStep(push.s, 8, 0, dt, world, push.ev, 1);
    maxXSeen = Math.max(maxXSeen, push.s.x);
    assert.ok(Number.isFinite(push.s.x), "position stays finite at boundary");
  }
  assert.ok(maxXSeen <= MOVE_CFG.boundX + 1e-9, `clamped at arena edge, max ${maxXSeen} vs bound ${MOVE_CFG.boundX}`);

  const outside = mkState(41.5, 0.02, 0);
  moveStep(outside.s, 8, 0, dt, world, outside.ev, 1);
  assert.ok(outside.s.x <= MOVE_CFG.boundX, "out-of-bounds entity pulled back inside on next tick");

  const void_ = mkState(0, -30, 0);
  void_.s.vy = -10;
  moveStep(void_.s, 0, 0, dt, world, void_.ev, 1);
  assert.ok(void_.s.y < -30.1, `below-kill-plane fall continues (no mid-air teleport), got ${void_.s.y}`);
}

async function testGameplayIntegration(): Promise<void> {
  const { Match } = await import("../server/src/Match.js");
  const noop = () => undefined;
  const m = new Match({ mode: MODE_DM, botFill: 0, botDifficulty: 1, onBroadcast: noop, onSendTo: noop, onEnded: noop });
  const conn = { send: noop, close: noop, readyState: 1 };
  const { ent } = m.addPlayer("tester", "tok_integration", conn);
  assert.ok(ent.alive, "human spawns alive via respawnDM");

  for (let i = 0; i < 11 * 64; i++) m.simulate();
  assert.equal(m.phase, PHASE_LIVE, "warmup should transition to LIVE");

  let seq = 100;
  let minY = Infinity, maxAbsX = 0, maxAbsZ = 0;
  const feed = (btn: number, yaw: number): void => {
    ent.pendingInputs.push({ seq: (seq++) & 0xffff, btn, yaw, pitch: 0, slot: 1 });
  };
  const check = (label: string): void => {
    minY = Math.min(minY, ent.move.y);
    maxAbsX = Math.max(maxAbsX, Math.abs(ent.move.x));
    maxAbsZ = Math.max(maxAbsZ, Math.abs(ent.move.z));
    assert.ok(Number.isFinite(ent.move.x) && Number.isFinite(ent.move.y) && Number.isFinite(ent.move.z), `${label}: finite position`);
    assert.ok(ent.move.y > MOVE_CFG.killY + 1, `${label}: never near kill plane (y=${ent.move.y})`);
    assert.ok(ent.alive, `${label}: player must stay alive through ${label}`);
  };

  const standStart = { x: ent.move.x, z: ent.move.z };
  for (let t = 0; t < 320; t++) { feed(0, Math.PI); m.simulate(); check("stand"); }
  assert.ok(ent.move.onGround, "grounded while standing");
  assert.ok(Math.hypot(ent.move.x - standStart.x, ent.move.z - standStart.z) < 0.5, "standing still does not drift");

  let sawAir = false;
  const eastTicks = 900;
  for (let t = 0; t < eastTicks; t++) {
    if (t % 64 === 32) sawAir = true;
    feed(1 | ((t % 64 === 32 && t < 830) ? 16 : 0), -Math.PI / 2);
    m.simulate();
    check("walk-east");
  }
  assert.ok(ent.move.x > 39, `east perimeter stops the player (x=${ent.move.x})`);
  assert.ok(ent.move.onGround, "pressed against wall, still grounded");

  sawAir = false;
  for (let t = 0; t < 256; t++) {
    const jump = (t % 48 === 0 && t < 180) ? 16 : 0;
    if (jump === 16) sawAir = true;
    feed(1 | jump, Math.PI / 2);
    m.simulate();
    check("jump-walk-west");
  }
  assert.ok(sawAir, "jump input produced airborne ticks");
  assert.ok(ent.move.onGround, "lands after repeated jumps");

  for (let t = 0; t < 320; t++) { feed(1, Math.PI); m.simulate(); check("walk-south-into-wall"); }
  assert.ok(ent.move.z > 30, `south perimeter stops the player (z=${ent.move.z})`);

  assert.ok(minY > MOVE_CFG.killY + 1, `whole session never approached kill plane (minY=${minY})`);
  assert.ok(maxAbsX <= MOVE_CFG.boundX + 1e-9 && maxAbsZ <= MOVE_CFG.boundZ + 1e-9,
    `whole session inside arena bounds (|x|max=${maxAbsX}, |z|max=${maxAbsZ})`);
}

const tests: [string, () => void | Promise<void>][] = [
  ["quantization", testQuantization],
  ["writer-reader", testWriterReader],
  ["snapshot-roundtrip", testSnapshotRoundtrip],
  ["movement-determinism", testMovementDeterminism],
  ["fall-safety", testFallSafety],
  ["gameplay-integration", testGameplayIntegration],
  ["raycast-entity", testRaycastEntity],
  ["world-raycast", testWorldRaycast],
  ["world-winding", testWorldWinding],
  ["hud-ammo", testHudAmmo],
];

let failed = 0;
for (const [name, fn] of tests) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${name}: ${(err as Error).message}`);
  }
}
process.exit(failed > 0 ? 1 : 0);
