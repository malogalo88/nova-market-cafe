import * as THREE from "three";
import { WeaponDef, WEAPONS } from "../../../shared/src/weapons.js";

interface RecoilSpring {
  pos: number;
  vel: number;
}

interface Shell {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  life: number;
}

const bodyMat = new THREE.MeshStandardMaterial({ color: 0x262b31, roughness: 0.52, metalness: 0.42 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x161a1f, roughness: 0.85, metalness: 0.15 });
const gripMat = new THREE.MeshStandardMaterial({ color: 0x1d2227, roughness: 0.95, metalness: 0.05 });
const brassMat = new THREE.MeshBasicMaterial({ color: 0xd3a44a });

export class ViewModel {
  root = new THREE.Group();
  private weaponHolder = new THREE.Group();
  private models = new Map<number, THREE.Group>();
  private muzzleFlash: THREE.Sprite;
  private flashGlow: THREE.Sprite;
  private flashLight: THREE.PointLight | null = null;
  private flashTime = -1;
  private flashDur = 0.05;

  private shells: Shell[] = [];
  private shellPool: Shell[] = [];

  private recoilPitch: RecoilSpring = { pos: 0, vel: 0 };
  private recoilBack: RecoilSpring = { pos: 0, vel: 0 };
  private recoilRoll: RecoilSpring = { pos: 0, vel: 0 };
  private swayX = 0;
  private swayY = 0;
  private bobPhase = 0;
  private breathePhase = 0;
  adsAmount = 0;
  private drawT = 1;
  private reloadT = -1;
  private reloadDur = 1;
  currentWeaponId = 2;
  visible = true;

  constructor(camera: THREE.Camera, effectsQuality: number) {
    this.root.add(this.weaponHolder);
    camera.add(this.root);

    const flashTex = makeFlashTexture();
    const mat = new THREE.SpriteMaterial({
      map: flashTex,
      color: 0xffe2ae,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    this.muzzleFlash = new THREE.Sprite(mat);
    this.muzzleFlash.scale.set(0.36, 0.36, 1);
    this.muzzleFlash.visible = false;

    const glowMat = new THREE.SpriteMaterial({
      map: flashTex,
      color: 0xff9a3c,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.55,
    });
    this.flashGlow = new THREE.Sprite(glowMat);
    this.flashGlow.scale.set(0.72, 0.72, 1);
    this.flashGlow.visible = false;

    if (effectsQuality >= 2) {
      this.flashLight = new THREE.PointLight(0xffc880, 0, 11, 2);
      camera.add(this.flashLight);
    }
    for (let i = 0; i < 10; i++) {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.034), brassMat);
      sh.visible = false;
      this.root.add(sh);
      this.shellPool.push({ mesh: sh, vel: new THREE.Vector3(), spin: new THREE.Vector3(), life: -1 });
    }
    for (const w of WEAPONS) {
      this.models.set(w.id, buildWeaponModel(w));
    }
    this.weaponHolder.add(this.models.get(2)!);
    this.root.position.set(0.24, -0.24, -0.45);
  }

  setWeapon(id: number): void {
    if (id === this.currentWeaponId && this.weaponHolder.children.length > 0) return;
    this.weaponHolder.clear();
    const m = this.models.get(id);
    if (m) {
      m.add(this.muzzleFlash);
      m.add(this.flashGlow);
      if (this.flashLight) m.add(this.flashLight);
      this.weaponHolder.add(m);
    }
    this.currentWeaponId = id;
    this.drawT = 0;
    for (const s of this.shells) { s.life = -1; s.mesh.visible = false; }
    this.shells.length = 0;
  }

  triggerShot(recoilScale: number): void {
    this.recoilPitch.vel += 5.5 * recoilScale * (0.9 + Math.random() * 0.2);
    this.recoilBack.vel += 3.4 * recoilScale;
    this.recoilRoll.vel += (Math.random() - 0.5) * 4.4 * recoilScale;
    this.flashDur = 0.04 + Math.random() * 0.025;
    this.flashTime = this.flashDur;
    this.muzzleFlash.material.rotation = Math.random() * Math.PI * 2;
    const sc = 0.85 + Math.random() * 0.35;
    this.muzzleFlash.scale.set(0.34 * sc, 0.34 * sc, 1);
    this.flashGlow.material.rotation = this.muzzleFlash.material.rotation;
    this.muzzleFlash.visible = true;
    this.flashGlow.visible = true;
    if (this.flashLight) this.flashLight.intensity = 20;
    this.ejectShell();
  }

  private ejectShell(): void {
    const s = this.shellPool.find((p) => p.life < 0);
    if (!s) return;
    s.mesh.position.set(0.05, 0.02, -0.12);
    s.vel.set(1.5 + Math.random() * 0.8, 1.9 + Math.random() * 0.6, 0.4 + Math.random() * 0.3);
    s.spin.set((Math.random() - 0.5) * 26, (Math.random() - 0.5) * 26, (Math.random() - 0.5) * 30);
    s.life = 0.85;
    s.mesh.visible = true;
    s.mesh.rotation.set(0, 0, 0);
    this.shells.push(s);
  }

  startReload(dur: number): void {
    this.reloadDur = dur;
    this.reloadT = 0;
  }

  update(dt: number, moveSpeed01: number, onGround: boolean, adsTarget: boolean, adsFovFrac: number, mouseDX: number, mouseDY: number, sprinting: boolean): void {
    void adsFovFrac;
    const w = WEAPONS[this.currentWeaponId] ?? WEAPONS[2];
    const adsSpeed = w.adsTime > 0 ? 1 / w.adsTime : 10;
    this.adsAmount += ((adsTarget ? 1 : 0) - this.adsAmount) * Math.min(1, dt * adsSpeed * 1.6);

    if (this.drawT < 1) this.drawT = Math.min(1, this.drawT + dt / Math.max(w.drawTime, 0.01));
    let reloading = false;
    let magAnim = 0;
    if (this.reloadT >= 0) {
      this.reloadT += dt;
      if (this.reloadT >= this.reloadDur) this.reloadT = -1;
      else {
        reloading = true;
        const t = this.reloadT / this.reloadDur;
        magAnim = t < 0.42 ? easeOut(t / 0.42) : t < 0.62 ? 1 : 1 - easeOut((t - 0.62) / 0.38);
        magAnim *= w.melee ? 0 : 1;
      }
    }

    this.recoilPitch.pos += this.recoilPitch.vel * dt * 8;
    this.recoilPitch.vel -= this.recoilPitch.pos * 130 * dt + this.recoilPitch.vel * 14 * dt;
    this.recoilBack.pos += this.recoilBack.vel * dt * 4;
    this.recoilBack.vel -= this.recoilBack.pos * 90 * dt + this.recoilBack.vel * 12 * dt;
    this.recoilRoll.pos += this.recoilRoll.vel * dt * 6;
    this.recoilRoll.vel -= this.recoilRoll.pos * 110 * dt + this.recoilRoll.vel * 13 * dt;

    this.swayX += (-mouseDX * 0.00035 - this.swayX) * Math.min(1, dt * 11);
    this.swayY += (-mouseDY * 0.00035 - this.swayY) * Math.min(1, dt * 11);

    const bobAmt = onGround ? Math.min(moveSpeed01, 1.15) * (sprinting ? 1.25 : 1) : 0;
    this.bobPhase += dt * (6.5 + bobAmt * 7);
    this.breathePhase += dt * 1.7;

    const bobX = Math.cos(this.bobPhase) * 0.008 * bobAmt * (1 - this.adsAmount * 0.85);
    const bobY = Math.abs(Math.sin(this.bobPhase)) * 0.007 * bobAmt * (1 - this.adsAmount * 0.85);
    const brX = Math.sin(this.breathePhase) * 0.0016 * (1 - bobAmt);
    const brY = Math.sin(this.breathePhase * 1.3) * 0.0022 * (1 - bobAmt);

    const hipPos = { x: 0.24, y: -0.235, z: -0.42 };
    const adsPos = { x: 0.0, y: -0.166, z: -0.30 };
    const a = this.adsAmount;

    let rx = hipPos.x + (adsPos.x - hipPos.x) * a;
    let ry = hipPos.y + (adsPos.y - hipPos.y) * a;
    let rz = hipPos.z + (adsPos.z - hipPos.z) * a;
    rx += bobX + this.swayX + brX;
    ry += bobY + this.swayY + brY;
    rz += this.recoilBack.pos * 0.02;

    const drawDip = (1 - easeOut(this.drawT)) * 0.32;
    ry -= drawDip;
    const drawRot = (1 - easeOut(this.drawT)) * 0.7;

    let reloadRot = 0;
    let reloadDrop = 0;
    let reloadRoll = 0;
    if (reloading) {
      const t = this.reloadT / this.reloadDur;
      const envl = t < 0.22 ? easeOut(t / 0.22) : t > 0.78 ? 1 - easeOut((t - 0.78) / 0.22) : 1;
      reloadRot = envl * 0.5;
      reloadDrop = envl * 0.09;
      reloadRoll = envl * 0.28;
    }

    this.root.position.set(rx, ry - reloadDrop, rz);
    this.root.rotation.set(
      -this.recoilPitch.pos * 0.05 + drawRot + reloadRot + this.swayY * 1.2,
      this.swayX * 1.6,
      this.swayX * 2.2 + this.recoilRoll.pos * 0.06 + reloadRoll
    );

    const model = this.models.get(this.currentWeaponId);
    if (model && magAnim > 0) {
      const mag = model.userData.mag as THREE.Object3D | undefined;
      if (mag) {
        mag.position.y = mag.userData.baseY - magAnim * 0.14;
        mag.position.z = mag.userData.baseZ + magAnim * 0.03;
        mag.rotation.z = magAnim * 0.35;
      }
    }

    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      s.life -= dt;
      if (s.life <= 0) {
        s.mesh.visible = false;
        this.shells.splice(i, 1);
        continue;
      }
      s.vel.y -= 10.5 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.rotation.x += s.spin.x * dt;
      s.mesh.rotation.y += s.spin.y * dt;
      s.mesh.rotation.z += s.spin.z * dt;
    }

    this.root.visible = this.visible && !(w.zoomScope && a > 0.82);

    if (this.flashTime > 0) {
      this.flashTime -= dt;
      const k = Math.max(0, this.flashTime / this.flashDur);
      if (this.flashLight) this.flashLight.intensity = 22 * k;
      (this.flashGlow.material as THREE.SpriteMaterial).opacity = 0.55 * k;
      if (this.flashTime <= 0) {
        this.muzzleFlash.visible = false;
        this.flashGlow.visible = false;
        if (this.flashLight) this.flashLight.intensity = 0;
      }
    }
  }

  get muzzleWorld(): THREE.Vector3 {
    this.muzzleFlash.getWorldPosition(tmpV);
    return tmpV;
  }
}

const tmpV = new THREE.Vector3();

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function buildWeaponModel(w: WeaponDef): THREE.Group {
  const g = new THREE.Group();
  const accentMat = new THREE.MeshStandardMaterial({
    color: w.tracerColor, roughness: 0.4, metalness: 0.3,
    emissive: w.tracerColor, emissiveIntensity: 0.25,
  });

  if (w.melee) {
    const blade = box(0.014, 0.052, 0.34, accentMat, 0, 0.012, -0.2);
    blade.rotation.x = 0.1;
    g.add(blade);
    g.add(box(0.006, 0.02, 0.08, bodyMat, 0, 0.042, -0.34));
    g.add(box(0.034, 0.04, 0.13, gripMat, 0, -0.008, 0));
    g.add(box(0.042, 0.012, 0.05, bodyMat, 0, 0.014, 0.05));
    return g;
  }

  const sniper = w.cls === "sniper";
  const pistol = w.cls === "pistol";
  const shotgun = w.cls === "shotgun";
  const lmg = w.cls === "lmg";
  const smg = w.cls === "smg";

  const recvLen = sniper ? 0.5 : pistol ? 0.24 : 0.46;
  const receiver = box(0.07, 0.1, recvLen, bodyMat, 0, 0, -(0.06 + recvLen * 0.32));
  g.add(receiver);

  g.add(box(0.074, 0.02, recvLen * 0.7, darkMat, 0, 0.052, -(0.06 + recvLen * 0.3)));

  const barrelLen = sniper ? 0.5 : pistol ? 0.1 : shotgun ? 0.42 : 0.32;
  const bz = -(0.06 + recvLen * 0.62) - barrelLen * 0.5;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(pistol ? 0.014 : 0.017, pistol ? 0.016 : 0.019, barrelLen, 8), darkMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.014, bz - barrelLen * 0.18);
  g.add(barrel);

  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.022, 0.06, 8), bodyMat);
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0, 0.014, bz - barrelLen * 0.42);
  g.add(muzzle);

  if (!pistol) {
    g.add(box(0.056, 0.05, barrelLen * 0.62, gripMat, 0, -0.018, bz + barrelLen * 0.05));
    g.add(box(0.062, 0.014, barrelLen * 0.66, bodyMat, 0, 0.044, bz + barrelLen * 0.05));
  }

  const magH = sniper ? 0.09 : lmg ? 0.11 : 0.14;
  const mag = box(pistol ? 0.042 : 0.05, magH, pistol ? 0.05 : 0.085, darkMat, 0, -0.045 - magH * 0.45, pistol ? -0.02 : -0.13);
  mag.rotation.x = pistol ? 0.1 : 0.16;
  mag.userData.baseY = mag.position.y;
  mag.userData.baseZ = mag.position.z;
  g.add(mag);
  g.userData.mag = mag;

  const grip = box(0.046, 0.125, 0.062, gripMat, 0, -0.095, pistol ? 0.045 : 0.015);
  grip.rotation.x = -0.32;
  g.add(grip);

  g.add(box(0.014, 0.03, 0.018, darkMat, 0, 0.072, -(0.02 + recvLen * 0.5)));
  g.add(box(0.03, 0.022, 0.014, darkMat, 0, 0.068, -(0.04 + recvLen * 0.78)));
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0038, 6, 6), accentMat);
  dot.position.set(0, 0.084, -(0.02 + recvLen * 0.5));
  g.add(dot);

  if (sniper) {
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 10), darkMat);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.088, -0.22);
    g.add(scope);
    g.add(box(0.018, 0.03, 0.03, bodyMat, 0, 0.06, -0.14));
    g.add(box(0.018, 0.03, 0.03, bodyMat, 0, 0.06, -0.3));
    g.add(box(0.05, 0.09, 0.2, gripMat, 0, -0.02, 0.17));
  } else if (!pistol) {
    g.add(box(0.055, 0.075, 0.17, gripMat, 0, -0.03, 0.16));
    g.add(box(0.06, 0.05, 0.06, bodyMat, 0, 0.012, 0.21));
  } else {
    g.add(box(0.04, 0.02, 0.09, darkMat, 0, -0.108, 0.03));
  }

  if (shotgun || lmg || smg) {
    g.add(box(0.05, 0.045, 0.1, gripMat, 0, -0.045, bz + barrelLen * 0.28));
  }
  if (lmg) {
    g.add(box(0.055, 0.05, 0.12, bodyMat, 0.045, -0.02, -0.05));
  }

  g.add(box(0.072, 0.008, recvLen * 0.5, accentMat, 0, -0.052, -(0.05 + recvLen * 0.3)));

  return g;
}

function makeFlashTexture(): THREE.Texture {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 64;
  const ctx = cv.getContext("2d")!;
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,210,140,0.85)");
  grad.addColorStop(1, "rgba(255,160,60,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = "rgba(255,230,170,0.9)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    ctx.moveTo(32, 32);
    ctx.lineTo(32 + Math.cos(a) * 29, 32 + Math.sin(a) * 29);
  }
  ctx.stroke();
  return new THREE.CanvasTexture(cv);
}
