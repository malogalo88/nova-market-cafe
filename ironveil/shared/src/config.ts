export const GAME_NAME = "IRONVEIL";
export const VERSION = "0.1.0";

export const TICK_RATE = 64;
export const TICK_MS = 1000 / TICK_RATE;
export const TICK_DT = 1 / TICK_RATE;
export const NET_SEND_HZ = 21;
export const NET_SEND_EVERY = Math.max(1, Math.round(TICK_RATE / NET_SEND_HZ));
export const SNAPSHOT_INTERP_MS = 110;
export const MAX_INPUTS_QUEUED = 8;
export const INPUT_MSG_LIMIT_PER_SEC = 150;

export const MAX_PLAYERS = 12;
export const TEAM_SIZE = 5;
export const ROUNDS_TO_WIN = 5;
export const ROUND_TIME_S = 95;
export const FREEZE_TIME_S = 6;
export const ROUND_END_TIME_S = 6;
export const DM_TIME_S = 360;
export const DM_SCORE_LIMIT = 40;
export const DM_RESPAWN_S = 2.5;
export const MATCH_ID_BITS = 4;

export const MODE_ELIM = 0;
export const MODE_DM = 1;
export const PHASE_WARMUP = 0;
export const PHASE_FREEZE = 1;
export const PHASE_LIVE = 2;
export const PHASE_ROUNDEND = 3;
export const PHASE_MATCHEND = 4;

export const TEAM_A = 0;
export const TEAM_B = 1;
export const TEAM_NAMES = ["AMBER", "COBALT"];

export const POS_SCALE = 255.95;
export const MAP_EXTENT = 128;
export const VEL_SCALE = 96;

export const BTN = {
  FORWARD: 1 << 0,
  BACK: 1 << 1,
  LEFT: 1 << 2,
  RIGHT: 1 << 3,
  JUMP: 1 << 4,
  CROUCH: 1 << 5,
  WALK: 1 << 6,
  FIRE: 1 << 7,
  ADS: 1 << 8,
  RELOAD: 1 << 9,
};

export const PLAYER_RADIUS = 0.38;
export const STAND_HEIGHT = 1.8;
export const CROUCH_HEIGHT = 1.24;
export const STAND_EYE = 1.66;
export const CROUCH_EYE = 1.06;
export const HEAD_BOX_H = 0.34;

export const MOVE_CFG = {
  baseSpeed: 5.4,
  sprintMult: 1.34,
  crouchMult: 0.5,
  adsMult: 0.58,
  walkMult: 0.52,
  groundAccel: 13,
  airAccel: 2.4,
  airWishCap: 1.35,
  friction: 8.5,
  stopSpeed: 1.6,
  gravity: 21.5,
  jumpVel: 7.55,
  stepHeight: 0.56,
  landHardVy: -9,
  killY: -24,
  boundX: 40.1,
  boundZ: 32.1,
};

export const FOOTSTEP_DIST = 2.35;
export const ARMOR_ABSORB = 0.66;
export const MAX_ARMOR = 100;
export const MAX_HP = 100;

export const ABILITY = {
  PULSE_SCAN_R: 16,
  PULSE_SCAN_DUR_S: 4,
  SILENT_STEP_DUR_S: 6,
  SILENT_STEP_SPEED: 1.15,
  WALL_HP: 250,
  WALL_DUR_S: 8,
  WALL_W: 4.2,
  WALL_H: 2.5,
  WALL_DIST: 5.5,
  FORTIFY_ARMOR: 50,
  DASH_SPEED: 17,
  DASH_TIME_S: 0.16,
  UPDRAFT_VEL: 8.6,
  FIELD_R: 4.5,
  FIELD_DUR_S: 6,
  FIELD_HPS: 9,
  FLARE_BLIND_MAX_S: 1.7,
  FLARE_R: 18,
};

export const DEFAULT_PORT = 8012;

export function quantPos(v: number): number {
  return Math.max(0, Math.min(65535, Math.round((v + MAP_EXTENT) * POS_SCALE)));
}
export function dequantPos(q: number): number {
  return q / POS_SCALE - MAP_EXTENT;
}
export function quantAngle(a: number): number {
  return Math.round((((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) * 65535 / (Math.PI * 2)) & 0xffff;
}
export function dequantAngle(q: number): number {
  return (q / 65535) * Math.PI * 2;
}
export function quantPitch(a: number): number {
  return Math.max(0, Math.min(255, Math.round(((a + Math.PI / 2) / Math.PI) * 255)));
}
export function dequantPitch(q: number): number {
  return (q / 255) * Math.PI - Math.PI / 2;
}
