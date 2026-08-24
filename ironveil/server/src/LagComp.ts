import { ServerEntity, ENT_MAX } from "./Entity.js";

const HISTORY_BITS = 10;
const HISTORY_SIZE = 1 << HISTORY_BITS;
const HISTORY_MASK = HISTORY_SIZE - 1;

export class LagComp {
  xs = new Float32Array(ENT_MAX * HISTORY_SIZE);
  ys = new Float32Array(ENT_MAX * HISTORY_SIZE);
  zs = new Float32Array(ENT_MAX * HISTORY_SIZE);
  hs = new Float32Array(ENT_MAX * HISTORY_SIZE);
  cs = new Uint8Array(ENT_MAX * HISTORY_SIZE);
  valid = new Uint8Array(HISTORY_SIZE);

  record(tick: number, ents: ServerEntity[]): void {
    const slot = tick & HISTORY_MASK;
    const base = slot * ENT_MAX;
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      this.xs[base + e.id] = e.move.x;
      this.ys[base + e.id] = e.move.y;
      this.zs[base + e.id] = e.move.z;
      this.hs[base + e.id] = e.move.height;
      this.cs[base + e.id] = e.move.crouching ? 1 : 0;
    }
    this.valid[slot] = 1;
  }

  sample(tick: number, id: number, out: { x: number; y: number; z: number; h: number; crouch: boolean }): boolean {
    const slot = tick & HISTORY_MASK;
    if (!this.valid[slot]) return false;
    const base = slot * ENT_MAX + id;
    out.x = this.xs[base];
    out.y = this.ys[base];
    out.z = this.zs[base];
    out.h = this.hs[base];
    out.crouch = this.cs[base] === 1;
    return true;
  }
}
