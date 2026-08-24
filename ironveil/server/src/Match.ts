import {
  TICK_RATE, TICK_MS, TICK_DT, NET_SEND_EVERY, MOVE_CFG, BTN,
  MODE_ELIM, MODE_DM, PHASE_WARMUP, PHASE_FREEZE, PHASE_LIVE, PHASE_ROUNDEND, PHASE_MATCHEND,
  ROUND_TIME_S, FREEZE_TIME_S, ROUND_END_TIME_S, ROUNDS_TO_WIN, DM_TIME_S,
  DM_SCORE_LIMIT, DM_RESPAWN_S, MAX_PLAYERS, TEAM_SIZE, MAX_HP, MAX_ARMOR, FOOTSTEP_DIST,
} from "../../shared/src/config.js";
import { CollisionWorld } from "../../shared/src/collision.js";
import { moveStep, MoveEvents } from "../../shared/src/movement.js";
import { buildFoundry } from "../../shared/src/mapdata.js";
import { weaponById, KNIFE_ID, PISTOL_ID } from "../../shared/src/weapons.js";
import * as P from "../../shared/src/protocol.js";
import { Writer } from "../../shared/src/protocol.js";
import { ServerEntity, InputRec, WsLike } from "./Entity.js";
import { LagComp } from "./LagComp.js";
import { MatchView, EventRec, findSpawn } from "./types.js";
import {
  tryFire, requestReload, finishReloadIfDue, applyDamage, killEntity,
} from "./Combat.js";
import { tryUseAbility, tickAbilityWorld, rebuildDynamic } from "./Abilities.js";
import { botThink, setBotDifficulty } from "./Bots.js";
import { encodeSnapshot, encodeEvents, encodeRoster, RosterEntry } from "../../shared/src/netcodec.js";

const BOT_NAMES = ["MARROW", "SLATE", "VESPER", "ONYX-2", "HALDANE", "TALIK", "RIVET", "CINDER", "MOTH", "GRAF"];

export interface MatchConfig {
  mode: number;
  botFill: number;
  botDifficulty: number;
  onBroadcast: (data: Uint8Array) => void;
  onSendTo: (entId: number, data: Uint8Array) => void;
  onEnded: () => void;
}

export class Match implements MatchView {
  world = new CollisionWorld();
  map = buildFoundry();
  ents: ServerEntity[] = [];
  barriers: import("./types.js").Barrier[] = [];
  healZones: import("./types.js").HealZone[] = [];
  tick = 0;
  nowS = 0;
  phase = PHASE_WARMUP;
  mode: number;
  roundNum = 0;
  scoreA = 0;
  scoreB = 0;
  timeLeftS = 0;
  phaseEndsAt = 0;
  evq: EventRec[] = [];
  lag = new LagComp();
  cfg: MatchConfig;
  botFill: number;

  private snapWriter = new Writer(4096);
  private evWriter = new Writer(2048);
  private rosterWriter = new Writer(1024);
  private moveEv: MoveEvents = { landedHard: false, jumped: false, walkedDist: 0, stepUp: false };
  private nextId = 0;
  private rosterDirty = true;
  private lastRosterSent = 0;
  ended = false;

  constructor(cfg: MatchConfig) {
    this.cfg = cfg;
    this.mode = cfg.mode;
    this.botFill = cfg.botFill;
    setBotDifficulty(cfg.botDifficulty);
    this.buildWorld();
    this.fillBots();
    this.phase = PHASE_WARMUP;
    this.timeLeftS = 10;
    this.phaseEndsAt = this.nowS + 10;
  }

  buildWorld(): void {
    for (const b of this.map.boxes) {
      this.world.addBox(b.x - b.sx / 2, b.y - b.sy / 2, b.z - b.sz / 2, b.x + b.sx / 2, b.y + b.sy / 2, b.z + b.sz / 2);
    }
    this.world.build();
    this.world.markStaticsBuilt();
  }

  fillBots(): void {
    let humansA = 0, humansB = 0;
    for (const e of this.ents) if (!e.isBot) (e.team === 0 ? humansA++ : humansB++);
    const wantTotal = Math.min(MAX_PLAYERS - this.ents.length, this.cfg.botFill);
    let added = 0;
    while (added < wantTotal && this.ents.length < MAX_PLAYERS) {
      const team = humansA <= humansB ? 0 : 1;
      if (team === 0) humansA++; else humansB++;
      this.spawnBot(team);
      added++;
    }
  }

  spawnBot(team: number): void {
    const e = new ServerEntity();
    e.id = this.nextId++;
    e.isBot = true;
    e.name = BOT_NAMES[e.id % BOT_NAMES.length] + " [BOT]";
    e.team = team;
    e.agent = e.id % 4;
    e.loadoutPrimary = [1, 2, 2, 3, 5][e.id % 5];
    this.ents.push(e);
  }

  addPlayer(name: string, token: string, conn: WsLike): { ent: ServerEntity; reconnected: boolean; newToken: string } {
    for (const e of this.ents) {
      if (!e.isBot && e.token === token && token.length > 4) {
        e.conn = conn;
        e.connected = true;
        return { ent: e, reconnected: true, newToken: token };
      }
    }
    let humansA = 0, humansB = 0;
    let firstFree = -1;
    for (let i = 0; i < this.ents.length; i++) {
      const e = this.ents[i];
      if (!e.isBot) {
        if (e.team === 0) humansA++; else humansB++;
        if (!e.connected && firstFree < 0) firstFree = i;
      }
    }
    const team = humansA <= humansB ? 0 : 1;
    let ent: ServerEntity;
    if (firstFree >= 0) {
      ent = this.ents[firstFree];
    } else {
      if (this.ents.length >= MAX_PLAYERS) throw new Error("match_full");
      ent = new ServerEntity();
      ent.id = this.nextId++;
      this.ents.push(ent);
    }
    const newToken = "tok_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    ent.isBot = false;
    ent.name = name;
    ent.team = team;
    ent.conn = conn;
    ent.connected = true;
    ent.token = newToken;
    ent.hp = 100;
    ent.alive = false;
    ent.respawnAt = -1;
    if (this.mode === MODE_DM || this.phase === PHASE_WARMUP) {
      this.respawnDM(ent);
    }
    this.rosterDirty = true;
    return { ent, reconnected: false, newToken };
  }

  removePlayer(ent: ServerEntity): void {
    ent.connected = false;
    ent.conn = null;
    ent.btn = 0;
    this.rosterDirty = true;
  }

  pushEvent(ev: EventRec): void {
    this.evq.push(ev);
  }

  handleInput(ent: ServerEntity, r: P.Reader, rateOk: boolean): void {
    if (!rateOk) return;
    if (ent.pendingInputs.length > 30) ent.pendingInputs.length = 0;
    const seq = r.u16();
    const btn = r.u16();
    const yawQ = r.u16();
    const pitchQ = r.u8();
    const slot = r.u8();
    if (seq <= ent.ackSeq && ent.pendingInputs.length > 0) return;
    const rec: InputRec = {
      seq,
      btn,
      yaw: ((yawQ / 65535) * Math.PI * 2),
      pitch: (pitchQ / 255) * Math.PI - Math.PI / 2,
      slot,
    };
    ent.pendingInputs.push(rec);
  }

  handleAction(ent: ServerEntity, kind: number, arg: number): void {
    switch (kind) {
      case P.ACT_RELOAD:
        requestReload(this, ent, (ev) => this.pushEvent(ev));
        break;
      case P.ACT_SLOT:
        this.switchSlot(ent, arg);
        break;
      case P.ACT_NEXT:
        this.switchSlot(ent, (ent.weaponSlot + 1) % 3);
        break;
      case P.ACT_PREV:
        this.switchSlot(ent, (ent.weaponSlot + 2) % 3);
        break;
      case P.ACT_ABILITY_Q:
        tryUseAbility(this, ent, "q", (ev) => this.pushEvent(ev));
        break;
      case P.ACT_ABILITY_E:
        tryUseAbility(this, ent, "e", (ev) => this.pushEvent(ev));
        break;
      case P.ACT_SELECT_PRIMARY:
        if (arg >= 1 && arg <= 5) ent.loadoutPrimary = arg;
        break;
      case P.ACT_SELECT_AGENT:
        if (arg >= 0 && arg < 4 && !ent.alive) { ent.agent = arg; this.rosterDirty = true; }
        break;
    }
  }

  switchSlot(ent: ServerEntity, slot: number): void {
    if (slot === ent.weaponSlot || slot < 0 || slot > 2) return;
    if (slot === 0 && ent.loadoutPrimary <= 0) return;
    ent.weaponSlot = slot;
    ent.reloadingUntil = -1;
    ent.burstIndex = 0;
    ent.drawUntil = this.nowS + weaponById(slot === 0 ? ent.loadoutPrimary : slot === 1 ? PISTOL_ID : KNIFE_ID).drawTime;
  }

  simulate(): void {
    this.nowS = this.tick * TICK_DT;
    tickAbilityWorld(this, (ev) => this.pushEvent(ev));

    for (const e of this.ents) {
      if (e.isBot && e.connected) {
        botThink({
          world: this.world,
          navNodes: this.map.navNodes,
          entities: this.ents,
          nowS: this.nowS,
          requestReload: (be) => { if (be.alive) requestReload(this, be, (ev) => this.pushEvent(ev)); },
          tryAbility: (be, key) => { tryUseAbility(this, be, key, (ev) => this.pushEvent(ev)); },
        }, e);
      }

      if (!e.connected && !e.isBot) continue;
      let inputs = 0;
      while (e.pendingInputs.length > 0 && inputs < 8) {
        const inp = e.pendingInputs.shift()!;
        if (inp.seq <= e.ackSeq) continue;
        e.ackSeq = inp.seq;
        e.btn = inp.btn;
        e.yaw = inp.yaw;
        e.pitch = inp.pitch;
        if (inp.slot !== e.weaponSlot && inp.slot >= 0 && inp.slot <= 2) this.switchSlot(e, inp.slot);
        inputs++;
      }
      if (e.pendingInputs.length === 0 && e.isBot === false && !e.alive) e.btn = 0;

      finishReloadIfDue(e, this.nowS);

      const frozen = this.mode === MODE_ELIM && (this.phase === PHASE_FREEZE || this.phase === PHASE_ROUNDEND || this.phase === PHASE_MATCHEND);
      const canMove = e.alive && !frozen;

      this.moveEv.landedHard = false;
      this.moveEv.jumped = false;
      this.moveEv.walkedDist = 0;

      if (canMove) {
        const w = weaponById(e.currentWeaponId());
        let speedMult = w.moveMult;
        if (this.nowS < e.silentUntil) speedMult *= 1.15;
        moveStep(e.move, frozen ? 0 : e.btn, e.yaw, TICK_DT, this.world, this.moveEv, speedMult);
        if (e.move.y < MOVE_CFG.killY) {
          killEntity(this, e, e, KNIFE_ID, false, (ev) => this.pushEvent(ev));
          e.move.vx = 0; e.move.vy = 0; e.move.vz = 0;
        }
        if ((e.btn & BTN.ADS) !== 0) e.ads = true; else e.ads = false;

        if (this.moveEv.walkedDist > 0 && this.phase === PHASE_LIVE) {
          e.footAccum += this.moveEv.walkedDist;
          const silent = this.nowS < e.silentUntil || e.move.crouching;
          if (!silent && e.footAccum >= FOOTSTEP_DIST) {
            e.footAccum = 0;
            this.pushEvent({
              to: -1, kind: P.EV_FOOTSTEP, pid: e.id,
              x: e.move.x, y: e.move.y, z: e.move.z,
              loud: (e.btn & BTN.WALK) !== 0 ? 1 : 2,
            });
          }
        }
        if ((e.btn & BTN.FIRE) !== 0 && !frozen) {
          const w2 = weaponById(e.currentWeaponId());
          const trigger = w2.auto || !e.fireLatch;
          if (trigger) {
            tryFire(this, this.lag, e, e.ackSeq, (ev) => this.pushEvent(ev));
            e.fireLatch = true;
          }
        } else {
          e.fireLatch = false;
        }
      } else {
        e.move.vx = 0; e.move.vz = 0;
      }
    }

    this.lag.record(this.tick, this.ents);
    this.tickPhase();
    this.tick++;
  }

  tickPhase(): void {
    if (this.ended) return;
    const prevPhase = this.phase;

    if (this.mode === MODE_DM) {
      if (this.phase === PHASE_WARMUP) {
        if (this.nowS >= this.phaseEndsAt) {
          this.phase = PHASE_LIVE;
          this.phaseEndsAt = this.nowS + DM_TIME_S;
        }
      }
      this.timeLeftS = Math.max(0, this.phaseEndsAt - this.nowS);
      for (const e of this.ents) {
        if (!e.alive && e.respawnAt < 0) e.respawnAt = this.nowS + (e.isBot ? 1.2 : DM_RESPAWN_S);
        if (!e.alive && e.respawnAt > 0 && this.nowS >= e.respawnAt) {
          e.respawnAt = -1;
          this.respawnDM(e);
        }
      }
      let topKills = 0;
      for (const e of this.ents) topKills = Math.max(topKills, e.kills);
      if (topKills >= DM_SCORE_LIMIT || (this.phaseEndsAt > 0 && this.nowS >= this.phaseEndsAt)) {
        this.endMatch();
      }
      return;
    }

    switch (this.phase) {
      case PHASE_WARMUP:
        this.timeLeftS = Math.max(0, this.phaseEndsAt - this.nowS);
        if (this.nowS >= this.phaseEndsAt) this.startRound();
        break;
      case PHASE_FREEZE:
        this.timeLeftS = Math.max(0, this.phaseEndsAt - this.nowS);
        if (this.nowS >= this.phaseEndsAt) {
          this.phase = PHASE_LIVE;
          this.phaseEndsAt = this.nowS + ROUND_TIME_S;
        }
        break;
      case PHASE_LIVE: {
        this.timeLeftS = Math.max(0, this.phaseEndsAt - this.nowS);
        const aliveA = this.countAlive(0);
        const aliveB = this.countAlive(1);
        if (aliveA === 0 || aliveB === 0) {
          this.endRound(aliveA === 0 ? 1 : 0);
        } else if (this.nowS >= this.phaseEndsAt) {
          this.endRound(aliveA > aliveB ? 0 : aliveB > aliveA ? 1 : 1);
        }
        break;
      }
      case PHASE_ROUNDEND:
        this.timeLeftS = Math.max(0, this.phaseEndsAt - this.nowS);
        if (this.nowS >= this.phaseEndsAt) {
          if (this.scoreA >= ROUNDS_TO_WIN || this.scoreB >= ROUNDS_TO_WIN) this.endMatch();
          else this.startRound();
        }
        break;
    }
    if (prevPhase !== this.phase) this.rosterDirty = true;
  }

  countAlive(team: number): number {
    let n = 0;
    for (const e of this.ents) if (e.alive && e.connected && e.team === team) n++;
    return n;
  }

  startRound(): void {
    this.roundNum++;
    this.barriers.length = 0;
    this.healZones.length = 0;
    rebuildDynamic(this);
    const yawOut = { v: 0 };
    for (const e of this.ents) {
      const [sx, sy, sz] = findSpawn(this, e, yawOut);
      e.resetForRound(sx, sy, sz, yawOut.v);
      e.mags[1] = weaponById(PISTOL_ID).magSize;
      e.reserves[1] = weaponById(PISTOL_ID).reserve;
      e.mags[0] = weaponById(e.loadoutPrimary).magSize;
      e.reserves[0] = weaponById(e.loadoutPrimary).reserve;
    }
    this.phase = PHASE_FREEZE;
    this.phaseEndsAt = this.nowS + FREEZE_TIME_S;
    this.rosterDirty = true;
  }

  endRound(winner: number): void {
    if (winner === 0) this.scoreA++; else this.scoreB++;
    this.phase = PHASE_ROUNDEND;
    this.phaseEndsAt = this.nowS + ROUND_END_TIME_S;
    const banner = winner === 0 ? P.BANNER_ROUND_WIN_A : P.BANNER_ROUND_WIN_B;
    const matchPoint = this.scoreA >= ROUNDS_TO_WIN - 1 || this.scoreB >= ROUNDS_TO_WIN - 1;
    this.pushEvent({ to: -1, kind: P.EV_BANNER, bannerKind: banner, arg: matchPoint ? 1 : 0 });
  }

  respawnDM(e: ServerEntity): void {
    const yawOut = { v: 0 };
    let bestSpawn: number[] = this.map.spawnsA[0];
    const list = e.team === 0 ? this.map.spawnsA : this.map.spawnsB;
    let worstDist = -1;
    for (const s of list) {
      let minD = Infinity;
      for (const o of this.ents) {
        if (!o.alive || o.team === e.team) continue;
        minD = Math.min(minD, Math.hypot(o.move.x - s[0], o.move.z - s[2]));
      }
      const d = minD === Infinity ? 999 : minD;
      if (d > worstDist) { worstDist = d; bestSpawn = s; }
    }
    e.resetForRound(bestSpawn[0], bestSpawn[1] + 0.05, bestSpawn[2], e.team === 0 ? Math.PI : 0);
    e.mags[1] = weaponById(PISTOL_ID).magSize;
    e.reserves[1] = weaponById(PISTOL_ID).reserve;
    e.mags[0] = weaponById(e.loadoutPrimary).magSize;
    e.reserves[0] = weaponById(e.loadoutPrimary).reserve;
    e.drawUntil = this.nowS + 0.3;
  }

  endMatch(): void {
    this.phase = PHASE_MATCHEND;
    this.ended = true;
    this.pushEvent({ to: -1, kind: P.EV_BANNER, bannerKind: P.BANNER_MATCH_END, arg: 0 });
    setTimeout(() => this.cfg.onEnded(), 8000);
  }

  broadcastTick(): void {
    if (this.tick % NET_SEND_EVERY !== 0) return;
    for (const e of this.ents) {
      if (!e.conn || !e.connected) continue;
      const slot = Math.max(0, Math.min(2, e.weaponSlot));
      const snap = encodeSnapshot(this.snapWriter, this, e.ackSeq & 0xffff, e.mags[slot], e.reserves[slot]);
      this.cfg.onSendTo(e.id, snap);
    }
    if (this.evq.length > 0) {
      encodeEvents(this.evWriter, this.evq);
      const evData = this.evWriter.finish();
      const copy = new Uint8Array(evData.length);
      copy.set(evData);
      this.evq.length = 0;
      this.cfg.onBroadcast(copy);
    }
    if (this.rosterDirty || this.nowS - this.lastRosterSent > 2) {
      this.rosterDirty = false;
      this.lastRosterSent = this.nowS;
      encodeRoster(this.rosterWriter, this.buildRoster());
      const rd = new Uint8Array(this.rosterWriter.finish().length);
      rd.set(this.rosterWriter.finish());
      this.cfg.onBroadcast(rd);
    }
  }

  buildRoster(): RosterEntry[] {
    const out: RosterEntry[] = [];
    for (const e of this.ents) {
      out.push({
        id: e.id,
        name: e.name,
        team: e.team,
        agent: e.agent,
        kills: e.kills,
        deaths: e.deaths,
        pingMs: e.pingMs,
        connected: e.connected,
        isBot: e.isBot,
      });
    }
    return out;
  }
}
