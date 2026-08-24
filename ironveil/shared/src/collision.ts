export interface AABB {
  minX: number; minY: number; minZ: number;
  maxX: number; maxY: number; maxZ: number;
}

export interface RayHit {
  t: number;
  nx: number; ny: number; nz: number;
  boxIndex: number;
}

const CELL = 4;

export class CollisionWorld {
  boxes: AABB[] = [];
  private cells = new Map<number, number[]>();
  private queryOut: number[] = [];

  addBox(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): AABB {
    const b: AABB = { minX, minY, minZ, maxX, maxY, maxZ };
    this.boxes.push(b);
    return b;
  }

  build() {
    this.cells.clear();
    for (let i = 0; i < this.boxes.length; i++) {
      const b = this.boxes[i];
      const x0 = Math.floor(b.minX / CELL), x1 = Math.floor(b.maxX / CELL);
      const z0 = Math.floor(b.minZ / CELL), z1 = Math.floor(b.maxZ / CELL);
      for (let cx = x0; cx <= x1; cx++) {
        for (let cz = z0; cz <= z1; cz++) {
          const key = cx * 8192 + cz;
          let arr = this.cells.get(key);
          if (!arr) { arr = []; this.cells.set(key, arr); }
          arr.push(i);
        }
      }
    }
  }

  clearDynamic(): void {
    for (const arr of this.cells.values()) {
      for (let i = arr.length - 1; i >= 0; i--) if (arr[i] >= this.staticCount) arr.splice(i, 1);
    }
    this.boxes.length = this.staticCount;
  }

  staticCount = 0;

  markStaticsBuilt(): void {
    this.staticCount = this.boxes.length;
  }

  addDynamicBox(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): AABB {
    const b = this.addBox(minX, minY, minZ, maxX, maxY, maxZ);
    const x0 = Math.floor(b.minX / CELL), x1 = Math.floor(b.maxX / CELL);
    const z0 = Math.floor(b.minZ / CELL), z1 = Math.floor(b.maxZ / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const key = cx * 8192 + cz;
        let arr = this.cells.get(key);
        if (!arr) { arr = []; this.cells.set(key, arr); }
        arr.push(this.boxes.length - 1);
      }
    }
    return b;
  }

  queryBox(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): number[] {
    if (this.cells.size === 0 && this.boxes.length > 0) this.build();
    const out = this.queryOut;
    out.length = 0;
    const seen = querySeen;
    seen.clear();
    const x0 = Math.floor(minX / CELL), x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL), z1 = Math.floor(maxZ / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const arr = this.cells.get(cx * 8192 + cz);
        if (!arr) continue;
        for (let k = 0; k < arr.length; k++) {
          const idx = arr[k];
          if (!seen.has(idx)) { seen.add(idx); out.push(idx); }
        }
      }
    }
    return out;
  }

  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxT: number): RayHit | null {
    const ex = ox + dx * maxT, ey = oy + dy * maxT, ez = oz + dz * maxT;
    const cand = this.queryBox(Math.min(ox, ex) - 0.01, Math.min(oy, ey) - 0.01, Math.min(oz, ez) - 0.01, Math.max(ox, ex) + 0.01, Math.max(oy, ey) + 0.01, Math.max(oz, ez) + 0.01);
    let best = -1;
    let bestT = maxT;
    let bnx = 0, bny = 0, bnz = 0;
    const idx = dx === 0 ? Infinity : 1 / dx;
    const idy = dy === 0 ? Infinity : 1 / dy;
    const idz = dz === 0 ? Infinity : 1 / dz;
    for (let c = 0; c < cand.length; c++) {
      const b = this.boxes[cand[c]];
      let t1 = (b.minX - ox) * idx, t2 = (b.maxX - ox) * idx;
      let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
      let axis = 0;
      t1 = (b.minY - oy) * idy; t2 = (b.maxY - oy) * idy;
      if (Math.min(t1, t2) > tmin) { tmin = Math.min(t1, t2); axis = 1; }
      tmax = Math.min(tmax, Math.max(t1, t2));
      if (tmax < tmin) continue;
      t1 = (b.minZ - oz) * idz; t2 = (b.maxZ - oz) * idz;
      if (Math.min(t1, t2) > tmin) { tmin = Math.min(t1, t2); axis = 2; }
      tmax = Math.min(tmax, Math.max(t1, t2));
      if (tmax < tmin || tmin > bestT || tmin < 0) continue;
      bestT = tmin;
      best = cand[c];
      bnx = axis === 0 ? (dx > 0 ? -1 : 1) : 0;
      bny = axis === 1 ? (dy > 0 ? -1 : 1) : 0;
      bnz = axis === 2 ? (dz > 0 ? -1 : 1) : 0;
    }
    if (best < 0) return null;
    return { t: bestT, nx: bnx, ny: bny, nz: bnz, boxIndex: best };
  }

  overlapsBox(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): boolean {
    const cand = this.queryBox(minX, minY, minZ, maxX, maxY, maxZ);
    for (let i = 0; i < cand.length; i++) {
      const b = this.boxes[cand[i]];
      if (minX < b.maxX && maxX > b.minX && minY < b.maxY && maxY > b.minY && minZ < b.maxZ && maxZ > b.minZ) return true;
    }
    return false;
  }

  segmentClear(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): boolean {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 1e-6) return true;
    const hit = this.raycast(x0, y0, z0, dx / len, dy / len, dz / len, len);
    return hit === null;
  }
}

const querySeen = new Set<number>();

export function makeAABB(cx: number, cy: number, cz: number, hx: number, hy: number, hz: number): AABB {
  return { minX: cx - hx, minY: cy - hy, minZ: cz - hz, maxX: cx + hx, maxY: cy + hy, maxZ: cz + hz };
}
