import * as THREE from "three";

interface TracerSlot {
  sx: number; sy: number; sz: number;
  ex: number; ey: number; ez: number;
  life: number;
}

export class Effects {
  private tracerGeo = new THREE.PlaneGeometry(0.035, 1);
  private tracerMesh: THREE.InstancedMesh;
  private tracerSlots: TracerSlot[] = [];
  private tracerCount = 48;
  private tracerDummy = new THREE.Object3D();
  private upVec = new THREE.Vector3(0, 1, 0);
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();

  private sparkGeo = new THREE.BufferGeometry();
  private sparks: THREE.Points;
  private sparkPos: Float32Array;
  private sparkVel: Float32Array;
  private sparkCol: Float32Array;
  private sparkLife: Float32Array;
  private sparkMax = 320;
  private sparkCursor = 0;

  private decalHoles: THREE.InstancedMesh;
  private decalChips: THREE.InstancedMesh;
  private decalIdx = 0;
  private decalMax = 40;
  private dummy = new THREE.Object3D();

  private smokeSprites: THREE.Sprite[] = [];
  private quality = 1;

  constructor(scene: THREE.Scene, effectsQuality: number) {
    this.quality = effectsQuality;
    const tScale = effectsQuality === 0 ? 0.4 : effectsQuality === 1 ? 0.7 : 1;
    this.tracerCount = Math.round(40 * tScale) + 8;
    this.sparkMax = Math.round(320 * tScale) + 32;
    this.decalMax = Math.round(36 * tScale) + 8;

    this.tracerGeo.translate(0, 0.5, 0);
    const tracerMat = new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
      side: THREE.DoubleSide, fog: false,
    });
    this.tracerMesh = new THREE.InstancedMesh(this.tracerGeo, tracerMat, this.tracerCount);
    this.tracerMesh.frustumCulled = false;
    this.tracerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const hide = new THREE.Color(0, 0, 0);
    for (let i = 0; i < this.tracerCount; i++) {
      this.tracerSlots.push({ sx: 0, sy: -9999, sz: 0, ex: 0, ey: -9999, ez: 0, life: 0 });
      this.tracerDummy.position.set(0, -9999, 0);
      this.tracerDummy.scale.set(1, 0.001, 1);
      this.tracerDummy.updateMatrix();
      this.tracerMesh.setMatrixAt(i, this.tracerDummy.matrix);
      this.tracerMesh.setColorAt(i, hide);
    }
    scene.add(this.tracerMesh);

    this.sparkPos = new Float32Array(this.sparkMax * 3);
    this.sparkVel = new Float32Array(this.sparkMax * 3);
    this.sparkCol = new Float32Array(this.sparkMax * 3);
    this.sparkLife = new Float32Array(this.sparkMax);
    for (let i = 0; i < this.sparkMax; i++) this.sparkPos[i * 3 + 1] = -9999;
    this.sparkGeo.setAttribute("position", new THREE.BufferAttribute(this.sparkPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.sparkGeo.setAttribute("color", new THREE.BufferAttribute(this.sparkCol, 3).setUsage(THREE.DynamicDrawUsage));
    const sparkMat = new THREE.PointsMaterial({
      size: 0.07,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.sparks = new THREE.Points(this.sparkGeo, sparkMat);
    this.sparks.frustumCulled = false;
    scene.add(this.sparks);

    this.decalHoles = this.makeDecalMesh(makeHoleTexture(), scene);
    this.decalChips = this.makeDecalMesh(makeChipTexture(), scene);

    if (effectsQuality >= 1) {
      const smokeTex = makeSmokeTexture();
      const n = effectsQuality >= 2 ? 14 : 8;
      for (let i = 0; i < n; i++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({
          map: smokeTex, color: 0xbcc4c9, transparent: true, opacity: 0,
          depthWrite: false, rotation: Math.random() * Math.PI * 2,
        }));
        s.visible = false;
        s.userData.life = -1;
        s.userData.driftX = 0;
        s.userData.driftY = 0;
        scene.add(s);
        this.smokeSprites.push(s);
      }
    }
  }

  private makeDecalMesh(tex: THREE.Texture, scene: THREE.Scene): THREE.InstancedMesh {
    const m = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.15, 0.15),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      this.decalMax
    );
    m.frustumCulled = false;
    for (let i = 0; i < this.decalMax; i++) {
      this.dummy.position.set(0, -9999, 0);
      this.dummy.updateMatrix();
      m.setMatrixAt(i, this.dummy.matrix);
    }
    scene.add(m);
    return m;
  }

  addTracer(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
    let slot = -1;
    let oldest = Infinity;
    let oldestIdx = 0;
    for (let i = 0; i < this.tracerCount; i++) {
      const l = this.tracerSlots[i].life;
      if (l <= 0) { slot = i; break; }
      if (l < oldest) { oldest = l; oldestIdx = i; }
    }
    if (slot < 0) slot = oldestIdx;
    const s = this.tracerSlots[slot];
    s.sx = x0; s.sy = y0; s.sz = z0;
    s.ex = x1; s.ey = y1; s.ez = z1;
    s.life = 1;
  }

  impactSparks(x: number, y: number, z: number, nx: number, ny: number, nz: number, count: number, r: number, g: number, b: number): void {
    const n = Math.max(2, Math.round(count * (this.quality === 0 ? 0.5 : 1)));
    for (let k = 0; k < n; k++) {
      const i = this.sparkCursor;
      this.sparkCursor = (this.sparkCursor + 1) % this.sparkMax;
      const o = i * 3;
      this.sparkPos[o] = x; this.sparkPos[o + 1] = y; this.sparkPos[o + 2] = z;
      const sp = 1.5 + Math.random() * 3.2;
      this.sparkVel[o] = nx * 2 + (Math.random() - 0.5) * sp;
      this.sparkVel[o + 1] = ny * 2 + (Math.random() - 0.2) * sp;
      this.sparkVel[o + 2] = nz * 2 + (Math.random() - 0.5) * sp;
      this.sparkCol[o] = r; this.sparkCol[o + 1] = g; this.sparkCol[o + 2] = b;
      this.sparkLife[i] = 0.28 + Math.random() * 0.25;
    }
  }

  addDecal(x: number, y: number, z: number, nx: number, ny: number, nz: number): void {
    const mesh = this.decalIdx % 2 === 0 ? this.decalHoles : this.decalChips;
    const idx = Math.floor(this.decalIdx / 2) % this.decalMax;
    this.dummy.position.set(x + nx * 0.006, y + ny * 0.006, z + nz * 0.006);
    this.dummy.lookAt(x + nx, y + ny, z + nz);
    this.dummy.rotateZ(Math.random() * Math.PI * 2);
    const sc = 0.75 + Math.random() * 0.55;
    this.dummy.scale.set(sc, sc, sc);
    this.dummy.updateMatrix();
    mesh.setMatrixAt(idx, this.dummy.matrix);
    mesh.instanceMatrix.needsUpdate = true;
    this.decalIdx = (this.decalIdx + 1) % (this.decalMax * 2);
  }

  bulletImpact(x: number, y: number, z: number, nAxis: number, nSign: number): void {
    const nx = nAxis === 0 ? nSign : 0;
    const ny = nAxis === 1 ? nSign : 0;
    const nz = nAxis === 2 ? nSign : 0;
    if (this.quality >= 1) this.impactSparks(x, y, z, nx, ny, nz, 7, 1, 0.78, 0.42);
    if (this.quality >= 2) this.addDecal(x, y, z, nx, ny, nz);
  }

  bloodPuff(x: number, y: number, z: number): void {
    if (this.quality >= 1) this.impactSparks(x, y, z, 0, 0.4, 0, 6, 0.62, 0.08, 0.08);
  }

  spawnSmokePuff(x: number, y: number, z: number, scale: number, life: number): void {
    for (const s of this.smokeSprites) {
      if ((s.userData.life as number) > 0) continue;
      s.position.set(x, y, z);
      s.scale.set(scale, scale, 1);
      (s.material as THREE.SpriteMaterial).rotation = Math.random() * Math.PI * 2;
      (s.material as THREE.SpriteMaterial).opacity = 0.18;
      s.userData.driftX = (Math.random() - 0.5) * 0.35;
      s.userData.driftY = 0.45 + Math.random() * 0.4;
      s.visible = true;
      s.userData.life = life;
      s.userData.maxLife = life;
      return;
    }
  }

  update(dt: number): void {
    let anyTracer = false;
    for (let i = 0; i < this.tracerCount; i++) {
      const s = this.tracerSlots[i];
      if (s.sy <= -999 && s.life <= 0) continue;
      if (s.life > 0) s.life -= dt * 7.5;
      const f = Math.max(0, Math.min(1, s.life));
      if (f <= 0 || s.sy <= -999) {
        this.tracerDummy.position.set(0, -9999, 0);
        this.tracerDummy.scale.set(1, 0.001, 1);
        this.tracerMesh.setColorAt(i, hideColor);
      } else {
        this.tmpA.set(s.ex - s.sx, s.ey - s.sy, s.ez - s.sz);
        const len = this.tmpA.length() || 0.001;
        this.tmpA.divideScalar(len);
        this.tracerDummy.quaternion.setFromUnitVectors(this.upVec, this.tmpA);
        const head = f > 0.72 ? (f - 0.72) / 0.28 : 0;
        this.tracerDummy.position.set(s.sx + this.tmpA.x * len * head, s.sy + this.tmpA.y * len * head, s.sz + this.tmpA.z * len * head);
        this.tracerDummy.scale.set(f * 0.6 + 0.4, len * (1 - head), 1);
        const fade = f * f * 1.6;
        this.tracerMesh.setColorAt(i, tmpColor.setRGB(fade, fade * 0.78, fade * 0.42));
      }
      this.tracerDummy.updateMatrix();
      this.tracerMesh.setMatrixAt(i, this.tracerDummy.matrix);
      anyTracer = true;
    }
    if (anyTracer) {
      this.tracerMesh.instanceMatrix.needsUpdate = true;
      if (this.tracerMesh.instanceColor) this.tracerMesh.instanceColor.needsUpdate = true;
    }

    let anySpark = false;
    for (let i = 0; i < this.sparkMax; i++) {
      if (this.sparkLife[i] <= 0) continue;
      this.sparkLife[i] -= dt;
      const o = i * 3;
      if (this.sparkLife[i] <= 0) {
        this.sparkPos[o + 1] = -9999;
        anySpark = true;
        continue;
      }
      this.sparkVel[o + 1] -= 12 * dt;
      this.sparkPos[o] += this.sparkVel[o] * dt;
      this.sparkPos[o + 1] += this.sparkVel[o + 1] * dt;
      this.sparkPos[o + 2] += this.sparkVel[o + 2] * dt;
      anySpark = true;
    }
    if (anySpark) {
      (this.sparkGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    for (const s of this.smokeSprites) {
      const life = s.userData.life as number;
      if (life <= 0) continue;
      s.userData.life = life - dt;
      const mat = s.material as THREE.SpriteMaterial;
      const maxL = (s.userData.maxLife as number) || 1;
      mat.opacity = 0.18 * Math.min(1, (s.userData.life as number) / maxL * 2.2);
      mat.rotation += dt * 0.6;
      s.position.x += (s.userData.driftX as number) * dt;
      s.position.y += (s.userData.driftY as number) * dt;
      s.scale.multiplyScalar(1 + dt * 0.65);
      if ((s.userData.life as number) <= 0) {
        s.visible = false;
        mat.opacity = 0;
      }
    }
  }
}

const tmpColor = new THREE.Color();
const hideColor = new THREE.Color(0, 0, 0);

function makeHoleTexture(): THREE.Texture {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 32;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
  g.addColorStop(0, "rgba(10,9,8,0.95)");
  g.addColorStop(0.55, "rgba(26,22,19,0.6)");
  g.addColorStop(1, "rgba(26,22,19,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(16, 16, 15, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(cv);
}

function makeChipTexture(): THREE.Texture {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 32;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "rgba(210,205,196,0.5)";
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const r = 6 + Math.random() * 8;
    const px = 16 + Math.cos(a) * r;
    const py = 16 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(15,13,11,0.85)";
  ctx.beginPath();
  ctx.arc(16, 16, 4.5, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(cv);
}

function makeSmokeTexture(): THREE.Texture {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 64;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 31);
  g.addColorStop(0, "rgba(255,255,255,0.85)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}
