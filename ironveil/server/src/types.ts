import { ServerEntity } from "./Entity.js";
import { CollisionWorld } from "../../shared/src/collision.js";
import { GameMap } from "../../shared/src/mapdata.js";
import { EventRec, EvShot, EvImpact, EvHitConfirm, EvDamaged, EvKill, EvFootstep, EvReload, EvAbility, EvBlinded, EvBanner } from "../../shared/src/netcodec.js";

export { EventRec };

export interface Barrier {
  owner: number;
  team: number;
  hp: number;
  dieAt: number;
  minX: number; minY: number; minZ: number;
  maxX: number; maxY: number; maxZ: number;
}

export interface HealZone {
  owner: number;
  team: number;
  x: number; y: number; z: number;
  dieAt: number;
}

export interface MatchView {
  world: CollisionWorld;
  map: GameMap;
  ents: ServerEntity[];
  barriers: Barrier[];
  healZones: HealZone[];
  tick: number;
  nowS: number;
  phase: number;
  mode: number;
  roundNum: number;
  scoreA: number;
  scoreB: number;
  timeLeftS: number;
  evq: EventRec[];
  botFill: number;
}

export function aliveCount(m: MatchView, team: number): number {
  let n = 0;
  for (const e of m.ents) if (e.alive && e.connected && e.team === team) n++;
  return n;
}

export function findSpawn(m: MatchView, e: ServerEntity, yawOut: { v: number }): [number, number, number] {
  const list = e.team === 0 ? m.map.spawnsA : m.map.spawnsB;
  const idx = (e.id * 7 + m.roundNum) % list.length;
  const s = list[idx];
  yawOut.v = e.team === 0 ? Math.PI : 0;
  return [s[0], s[1] + 0.05, s[2]];
}
