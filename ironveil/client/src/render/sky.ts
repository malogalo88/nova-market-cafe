import * as THREE from "three";
import { GameMap } from "../../../shared/src/mapdata.js";

export function buildSky(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(380, 24, 14);
  const colors: number[] = [];
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = Math.max(-0.12, pos.getY(i) / 380);
    const t = Math.min(1, Math.max(0, (y + 0.08) / 0.75));
    const r = 0.845 - t * 0.325;
    const g = 0.865 - t * 0.235;
    const b = 0.905 - t * 0.135;
    for (let k = 0; k < 3; k++) colors.push(r, g, b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.matrixAutoUpdate = false;
  mesh.renderOrder = -10;
  return mesh;
}

export function buildSiteMarkers(map: GameMap): THREE.Mesh {
  const acc = { pos: [] as number[], col: [] as number[], idx: [] as number[] };
  const addPad = (x: number, y: number, z: number, r: number): void => {
    const base = acc.pos.length / 3;
    acc.pos.push(
      x - r, y + 0.03, z - r,
      x + r, y + 0.03, z - r,
      x - r, y + 0.03, z + r,
      x + r, y + 0.03, z + r
    );
    for (let i = 0; i < 4; i++) acc.col.push(1.0, 0.69, 0.18);
    acc.idx.push(base, base + 2, base + 1, base + 2, base + 3, base + 1);
  };
  addPad(map.siteA[0], map.siteA[1], map.siteA[2], 4);
  addPad(map.siteB[0], map.siteB[1], map.siteB[2], 4);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(acc.pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(acc.col, 3));
  geo.setIndex(acc.idx);
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.25, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.matrixAutoUpdate = false;
  mesh.renderOrder = 2;
  return mesh;
}
