import { MoveState } from "../../shared/src/movement.js";

export interface InputRec {
  seq: number;
  btn: number;
  yaw: number;
  pitch: number;
  slot: number;
}

export interface WsLike {
  send(data: Uint8Array): void;
  close(code?: number, reason?: string): void;
  readyState: number;
}

export const ENT_MAX = 32;

export class ServerEntity {
  id = 0;
  isBot = false;
  name = "";
  team = 0;
  agent = 0;
  connected = true;

  move: MoveState = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, onGround: false, crouching: false, height: 1.8 };
  btn = 0;
  yaw = 0;
  pitch = 0;

  hp = 100;
  armor = 0;
  alive = false;
  respawnAt = -1;

  weaponSlot = 1;
  loadoutPrimary = 2;
  mags = [0, 12, 0];
  reserves = [0, 36, 0];
  reloadingUntil = -1;
  reloadDur = 0;

  nextFireAt = 0;
  burstIndex = 0;
  lastFireTime = -9;
  bloom = 0;
  ads = false;
  drawUntil = -1;

  kills = 0;
  deaths = 0;

  pendingInputs: InputRec[] = [];
  ackSeq = 0;
  footAccum = 0;

  silentUntil = -1;
  revealedUntil = -1;
  blindUntil = -1;

  qCdEnd = 0;
  eCdEnd = 0;
  dashCharges = 0;
  dashRechargeAt = 0;

  conn: WsLike | null = null;
  token = "";
  pingMs = 0;
  fireLatch = false;

  resetForRound(x: number, y: number, z: number, yawTo: number): void {
    this.move.x = x; this.move.y = y; this.move.z = z;
    this.move.vx = 0; this.move.vy = 0; this.move.vz = 0;
    this.move.onGround = true;
    this.move.crouching = false;
    this.move.height = 1.8;
    this.yaw = yawTo;
    this.pitch = 0;
    this.hp = 100;
    this.alive = true;
    this.respawnAt = -1;
    this.reloadingUntil = -1;
    this.nextFireAt = 0;
    this.burstIndex = 0;
    this.bloom = 0;
    this.drawUntil = 0.35;
    this.silentUntil = -1;
    this.blindUntil = -1;
    this.revealedUntil = -1;
    this.qCdEnd = 0;
    this.eCdEnd = 0;
    this.dashCharges = 2;
    this.pendingInputs.length = 0;
    this.btn = 0;
    this.weaponSlot = 1;
    this.mags[0] = 0; this.mags[1] = 12; this.mags[2] = 0;
  }

  currentWeaponId(): number {
    if (this.weaponSlot === 0) return this.loadoutPrimary;
    if (this.weaponSlot === 1) return 0;
    return 6;
  }

  eyeY(): number {
    return this.move.y + (this.move.crouching ? 1.06 : 1.66) * (this.move.height / 1.8);
  }
}
