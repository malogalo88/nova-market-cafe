import * as THREE from "three";

const TEAM_COLORS = [0xd99a2b, 0x3f9fd6];
const DARK_COLORS = [0x6e5522, 0x23506e];

interface CharParts {
  group: THREE.Group;
  torso: THREE.Mesh;
  plate: THREE.Mesh;
  head: THREE.Mesh;
  helm: THREE.Mesh;
  visor: THREE.Mesh;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  gun: THREE.Mesh;
  muzzle: THREE.Object3D;
  blob: THREE.Sprite;
}

interface SharedGeos {
  torso: THREE.BoxGeometry;
  plate: THREE.BoxGeometry;
  head: THREE.BoxGeometry;
  helm: THREE.BoxGeometry;
  limb: THREE.BoxGeometry;
  pad: THREE.BoxGeometry;
  boot: THREE.BoxGeometry;
  gun: THREE.BoxGeometry;
  blobTex: THREE.Texture;
}

let sharedGeos: SharedGeos | null = null;

function makeBlobTexture(): THREE.Texture {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 64;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  g.addColorStop(0, "rgba(0,0,0,0.42)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

function ensureShared(): void {
  if (sharedGeos) return;
  sharedGeos = {
    torso: new THREE.BoxGeometry(0.46, 0.56, 0.26),
    plate: new THREE.BoxGeometry(0.48, 0.34, 0.3),
    head: new THREE.BoxGeometry(0.22, 0.24, 0.23),
    helm: new THREE.BoxGeometry(0.27, 0.17, 0.28),
    limb: new THREE.BoxGeometry(0.13, 0.54, 0.14),
    pad: new THREE.BoxGeometry(0.16, 0.12, 0.2),
    boot: new THREE.BoxGeometry(0.15, 0.1, 0.22),
    gun: new THREE.BoxGeometry(0.08, 0.12, 0.6),
    blobTex: makeBlobTexture(),
  };
}

export interface CharacterView {
  parts: CharParts;
  walkPhase: number;
  deadAt: number;
  deadRoll: number;
  team: number;
  nameplate: THREE.Sprite | null;
  nameText: string;
}

const nameplateCache = new Map<string, THREE.Texture>();

function nameplateTexture(name: string, colorHex: string): THREE.Texture {
  const key = colorHex + name;
  const cached = nameplateCache.get(key);
  if (cached) return cached;
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 48;
  const ctx = cv.getContext("2d")!;
  ctx.font = "700 26px 'Segoe UI', Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(8,10,12,0.55)";
  ctx.fillRect(48, 6, 160, 36);
  ctx.fillStyle = colorHex;
  ctx.fillText(name.slice(0, 16), 128, 26);
  const tex = new THREE.CanvasTexture(cv);
  nameplateCache.set(key, tex);
  return tex;
}

export function createCharacter(team: number): CharacterView {
  ensureShared();
  const s = sharedGeos!;
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: TEAM_COLORS[team] ?? TEAM_COLORS[0], roughness: 0.72, metalness: 0.08 });
  const darkMat = new THREE.MeshStandardMaterial({ color: DARK_COLORS[team] ?? DARK_COLORS[0], roughness: 0.85, metalness: 0.05 });
  const gearMat = new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.8, metalness: 0.12 });
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x11151a, roughness: 0.25, metalness: 0.6,
    emissive: TEAM_COLORS[team] ?? TEAM_COLORS[0], emissiveIntensity: 0.55,
  });
  const gunMat = new THREE.MeshStandardMaterial({ color: 0x20242a, roughness: 0.55, metalness: 0.35 });

  const hips = new THREE.Group();
  hips.position.y = 0.92;
  group.add(hips);

  const torso = new THREE.Mesh(s.torso, bodyMat);
  torso.position.y = 0.31;
  hips.add(torso);

  const plate = new THREE.Mesh(s.plate, gearMat);
  plate.position.set(0, 0.36, -0.02);
  hips.add(plate);

  const head = new THREE.Mesh(s.head, darkMat);
  head.position.y = 0.76;
  hips.add(head);

  const helm = new THREE.Mesh(s.helm, gearMat);
  helm.position.set(0, 0.84, 0);
  hips.add(helm);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.03), visorMat);
  visor.position.set(0, 0.78, -0.125);
  hips.add(visor);

  const mkArm = (side: number): { pivot: THREE.Group; pad: THREE.Mesh } => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.31, 0.52, 0);
    const mesh = new THREE.Mesh(s.limb, darkMat);
    mesh.position.y = -0.26;
    pivot.add(mesh);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.1), gearMat);
    hand.position.y = -0.52;
    pivot.add(hand);
    const pad = new THREE.Mesh(s.pad, bodyMat);
    pad.position.set(side * -0.01, 0.02, 0);
    pivot.add(pad);
    hips.add(pivot);
    return { pivot, pad };
  };
  const armL = mkArm(-1).pivot;
  const armR = mkArm(1).pivot;

  const mkLeg = (side: number): { pivot: THREE.Group; boot: THREE.Mesh } => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.13, 0.02, 0);
    const mesh = new THREE.Mesh(s.limb, darkMat);
    mesh.scale.y = 0.96;
    mesh.position.y = -0.27;
    pivot.add(mesh);
    const boot = new THREE.Mesh(s.boot, gearMat);
    boot.position.set(0, -0.58, -0.03);
    pivot.add(boot);
    hips.add(pivot);
    return { pivot, boot };
  };
  const legL = mkLeg(-1).pivot;
  const legR = mkLeg(1).pivot;

  const gun = new THREE.Mesh(s.gun, gunMat);
  gun.position.set(0.2, 0.4, -0.36);
  hips.add(gun);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0.2, 0.42, -0.7);
  hips.add(muzzle);

  const blobMat = new THREE.SpriteMaterial({ map: s.blobTex, depthWrite: false, transparent: true });
  const blob = new THREE.Sprite(blobMat);
  blob.scale.set(1.4, 0.7, 1);
  blob.position.y = 0.03;
  group.add(blob);

  return {
    parts: { group, torso, plate, head, helm, visor, armL, armR, legL, legR, gun, muzzle, blob },
    walkPhase: Math.random() * 6,
    deadAt: -1,
    deadRoll: (Math.random() - 0.5) * 1.1,
    team,
    nameplate: null,
    nameText: "",
  };
}

export function updateCharacter(
  cv: CharacterView,
  x: number, y: number, z: number,
  yaw: number, pitch: number,
  speed01: number, crouch: boolean, alive: boolean,
  dt: number, nowS: number
): void {
  const p = cv.parts;
  p.group.visible = true;

  if (!alive) {
    if (cv.deadAt < 0) cv.deadAt = nowS;
    const t = Math.min(1, (nowS - cv.deadAt) / 0.5);
    const e = 1 - (1 - t) * (1 - t);
    p.group.rotation.x = e * Math.PI * 0.47;
    p.group.rotation.z = e * cv.deadRoll;
    p.group.position.set(x, y + 0.16 * (1 - e) - e * 0.04, z);
    p.blob.visible = false;
    p.head.rotation.x = 0;
    if (nowS - cv.deadAt > 3.5) p.group.visible = false;
    return;
  }
  if (cv.deadAt >= 0) {
    cv.deadAt = -1;
    p.group.rotation.x = 0;
    p.group.rotation.z = 0;
  }

  p.group.rotation.x = 0;
  p.group.rotation.z = 0;
  p.group.position.set(x, y, z);
  p.group.rotation.y = yaw;
  p.blob.visible = true;

  const lean = speed01 * 0.14;
  p.torso.rotation.x = lean;
  p.plate.rotation.x = lean;

  cv.walkPhase += dt * (4 + speed01 * 11);
  const amp = Math.sin(cv.walkPhase) * Math.min(speed01 * 0.95, 0.8);
  const idle = Math.sin(nowS * 1.9 + cv.walkPhase * 0.13) * (1 - Math.min(1, speed01 * 3)) * 0.02;
  const crouchK = crouch ? 1 : 0;
  const bend = crouchK * 0.85;

  p.legL.rotation.x = amp * (crouch ? 0.5 : 1) + bend;
  p.legR.rotation.x = -amp * (crouch ? 0.5 : 1) + bend;
  p.armL.rotation.x = (-amp * 0.75 - 0.95) * (1 - crouchK * 0.3);
  p.armL.rotation.z = 0.5 + crouchK * 0.2;
  p.armR.rotation.x = pitch > 0 ? -1.32 - pitch * 0.45 : -1.32;
  p.armR.rotation.z = -0.16;
  p.gun.rotation.x = -pitch;
  p.muzzle.rotation.x = -pitch;

  const bobY = Math.abs(Math.sin(cv.walkPhase)) * 0.035 * Math.min(speed01, 1) * (crouch ? 0.4 : 1);
  p.torso.position.y = 0.31 + bobY + idle;
  p.plate.position.y = 0.36 + bobY + idle;
  p.head.position.y = 0.76 - crouchK * 0.16;
  p.helm.position.y = 0.84 - crouchK * 0.16;
  p.visor.position.y = 0.78 - crouchK * 0.16;
  p.gun.position.y = 0.4 + bobY * 0.5 - crouchK * 0.1;
  p.muzzle.position.y = 0.42 + bobY * 0.5 - crouchK * 0.1;
  p.head.rotation.x = -pitch * 0.55;
  void dt;
}
