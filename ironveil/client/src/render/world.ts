import * as THREE from "three";
import { GameMap } from "../../../shared/src/mapdata.js";
import { buildAtlas, TEX_UV, ATLAS_COLS, ATLAS_ROWS } from "./textures.js";

const CELLU = 1 / ATLAS_COLS;
const CELLV = 1 / ATLAS_ROWS;
const SEG = 3;

interface GeoAcc {
  pos: number[];
  norm: number[];
  uv: number[];
  col: number[];
  idx: number[];
}

function mulberry(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface FaceDef {
  o: number[];
  uDir: number[];
  vDir: number[];
  n: number[];
  uLen: number;
  vLen: number;
  shadeBase: number;
  gradTop: number;
  gradBot: number;
}

function pushTiled(acc: GeoAcc, f: FaceDef, rng: () => number): void {
  const nu = Math.max(1, Math.round(f.uLen / SEG));
  const nv = Math.max(1, Math.round(f.vLen / SEG));
  for (let iv = 0; iv < nv; iv++) {
    for (let iu = 0; iu < nu; iu++) {
      const base = acc.pos.length / 3;
      const u0f = iu / nu, u1f = (iu + 1) / nu;
      const v0f = iv / nv, v1f = (iv + 1) / nv;
      for (let k = 0; k < 4; k++) {
        const uu = [u0f, u1f, u0f, u1f][k];
        const vv = [v0f, v0f, v1f, v1f][k];
        acc.pos.push(
          f.o[0] + f.uDir[0] * uu + f.vDir[0] * vv,
          f.o[1] + f.uDir[1] * uu + f.vDir[1] * vv,
          f.o[2] + f.uDir[2] * uu + f.vDir[2] * vv
        );
        acc.norm.push(f.n[0], f.n[1], f.n[2]);
        const vt = f.o[1] + f.uDir[1] * uu + f.vDir[1] * vv;
        const g = f.gradTop + (f.gradBot - f.gradTop) * (1 - Math.min(1, Math.max(0, vt / 4)));
        const jit = 1 + (rng() - 0.5) * 0.05;
        const s = g * f.shadeBase * jit;
        acc.col.push(s, s * (f.n[1] > 0.5 ? 0.995 : 0.985), s * (f.n[2] < -0.5 ? 1.01 : 0.98));
      }
      acc.uv.push(0, CELLV, CELLU, CELLV, 0, 0, CELLU, 0);
      acc.idx.push(base, base + 1, base + 3, base, base + 3, base + 2);
    }
  }
}

export function buildWorldMeshes(map: GameMap): THREE.Group {
  buildAtlas();
  const rng = mulberry(9042);
  const opaque = new Map<number, GeoAcc>();
  const glassAcc: GeoAcc = { pos: [], norm: [], uv: [], col: [], idx: [] };
  const lampAcc: GeoAcc = { pos: [], norm: [], uv: [], col: [], idx: [] };
  const getAcc = (tex: number): GeoAcc => {
    let a = opaque.get(tex);
    if (!a) { a = { pos: [], norm: [], uv: [], col: [], idx: [] }; opaque.set(tex, a); }
    return a;
  };

  map.boxes.forEach((b, bi) => {
    const [u0] = TEX_UV[b.tex] ?? TEX_UV[2];
    void u0;
    const hx = b.sx / 2, hy = b.sy / 2, hz = b.sz / 2;
    const cx = b.x, cy = b.y, cz = b.z;
    const tint = 0.96 + ((bi * 37) % 9) * 0.01;
    const target = b.tex === 10 ? glassAcc : b.tex === 11 ? lampAcc : getAcc(b.tex);
    const faces: FaceDef[] = [
      {
        o: [cx - hx, cy - hy, cz - hz], uDir: [b.sx, 0, 0], vDir: [0, 0, b.sz], n: [0, -1, 0],
        uLen: b.sx, vLen: b.sz, shadeBase: tint, gradTop: 0.92, gradBot: 0.98,
      },
      {
        o: [cx - hx, cy + hy, cz + hz], uDir: [b.sx, 0, 0], vDir: [0, 0, -b.sz], n: [0, 1, 0],
        uLen: b.sx, vLen: b.sz, shadeBase: tint * 1.04, gradTop: 1.02, gradBot: 0.97,
      },
      {
        o: [cx - hx, cy - hy, cz + hz], uDir: [b.sx, 0, 0], vDir: [0, b.sy, 0], n: [0, 0, 1],
        uLen: b.sx, vLen: b.sy, shadeBase: tint * 0.98, gradTop: 1.0, gradBot: 0.66,
      },
      {
        o: [cx + hx, cy - hy, cz - hz], uDir: [-b.sx, 0, 0], vDir: [0, b.sy, 0], n: [0, 0, -1],
        uLen: b.sx, vLen: b.sy, shadeBase: tint * 0.88, gradTop: 1.0, gradBot: 0.66,
      },
      {
        o: [cx + hx, cy - hy, cz + hz], uDir: [0, 0, -b.sz], vDir: [0, b.sy, 0], n: [1, 0, 0],
        uLen: b.sz, vLen: b.sy, shadeBase: tint * 0.94, gradTop: 1.0, gradBot: 0.66,
      },
      {
        o: [cx - hx, cy - hy, cz - hz], uDir: [0, 0, b.sz], vDir: [0, b.sy, 0], n: [-1, 0, 0],
        uLen: b.sz, vLen: b.sy, shadeBase: tint * 0.84, gradTop: 1.0, gradBot: 0.66,
      },
    ];
    for (const f of faces) pushTiled(target, f, rng);
  });

  const group = new THREE.Group();
  group.name = "world";
  const atlas = buildAtlas();
  const matOpaque = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true });
  const matGlass = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true, transparent: true, opacity: 0.52, depthWrite: false });
  const matLamp = new THREE.MeshBasicMaterial({ map: atlas });

  const emit = (acc: GeoAcc, mat: THREE.Material, name: string): void => {
    if (acc.pos.length === 0) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(acc.pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(acc.norm, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(acc.uv, 2));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(acc.col, 3));
    geo.setIndex(acc.idx);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.matrixAutoUpdate = false;
    mesh.name = name;
    if (mat !== matLamp && mat !== matGlass) mesh.receiveShadow = true;
    group.add(mesh);
  };
  for (const [tex, acc] of opaque) emit(acc, matOpaque, `wt${tex}`);
  emit(glassAcc, matGlass, "wglass");
  emit(lampAcc, matLamp, "wlamp");

  let lightsAdded = 0;
  for (const b of map.boxes) {
    if (b.tex === 11 && lightsAdded < 6 && b.y > 2.2) {
      const pl = new THREE.PointLight(0xffe8c4, 26, 16, 2);
      pl.position.set(b.x, b.y - b.sy / 2 - 0.15, b.z);
      group.add(pl);
      lightsAdded++;
    }
  }

  return group;
}
