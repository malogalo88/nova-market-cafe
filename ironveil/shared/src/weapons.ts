export type WeaponClass = "pistol" | "smg" | "rifle" | "shotgun" | "sniper" | "lmg" | "knife";

export interface WeaponSfx {
  freq: number;
  decay: number;
  punch: number;
  noise: number;
  vol: number;
}

export interface WeaponDef {
  id: number;
  name: string;
  cls: WeaponClass;
  slot: number;
  dmgBody: number;
  dmgHead: number;
  rpm: number;
  magSize: number;
  reserve: number;
  reloadTime: number;
  auto: boolean;
  pellets: number;
  spreadHip: number;
  spreadAds: number;
  spreadMove: number;
  spreadJump: number;
  bloomPerShot: number;
  bloomMax: number;
  bloomDecay: number;
  recoilPitch: number[];
  recoilYaw: number[];
  rangeFar: number;
  falloffMin: number;
  adsFov: number;
  adsTime: number;
  zoomScope: boolean;
  moveMult: number;
  drawTime: number;
  melee: boolean;
  tracerColor: number;
  sfx: WeaponSfx;
}

const W = (w: WeaponDef): WeaponDef => w;

export const WEAPONS: WeaponDef[] = [
  W({
    id: 0, name: "P9 Kestrel", cls: "pistol", slot: 1,
    dmgBody: 26, dmgHead: 78, rpm: 400, magSize: 12, reserve: 36, reloadTime: 1.5,
    auto: false, pellets: 1,
    spreadHip: 0.55, spreadAds: 0.28, spreadMove: 1.6, spreadJump: 3.2,
    bloomPerShot: 0.32, bloomMax: 1.8, bloomDecay: 5.5,
    recoilPitch: [0.85, 0.85, 0.9, 0.95], recoilYaw: [0, 0.12, -0.14, 0.18],
    rangeFar: 26, falloffMin: 0.72,
    adsFov: 58, adsTime: 0.13, zoomScope: false, moveMult: 1.0, drawTime: 0.4, melee: false,
    tracerColor: 0xffd9a0, sfx: { freq: 1900, decay: 0.09, punch: 0.9, noise: 0.75, vol: 0.7 },
  }),
  W({
    id: 1, name: "Hornet SMG", cls: "smg", slot: 0,
    dmgBody: 23, dmgHead: 60, rpm: 800, magSize: 25, reserve: 75, reloadTime: 1.9,
    auto: true, pellets: 1,
    spreadHip: 0.75, spreadAds: 0.42, spreadMove: 1.05, spreadJump: 3.0,
    bloomPerShot: 0.16, bloomMax: 2.2, bloomDecay: 6,
    recoilPitch: [0.38, 0.38, 0.4, 0.42, 0.44], recoilYaw: [0, 0.08, -0.08, 0.12, -0.12],
    rangeFar: 20, falloffMin: 0.62,
    adsFov: 60, adsTime: 0.15, zoomScope: false, moveMult: 1.04, drawTime: 0.45, melee: false,
    tracerColor: 0xffe9b8, sfx: { freq: 2400, decay: 0.07, punch: 0.65, noise: 0.8, vol: 0.6 },
  }),
  W({
    id: 2, name: "AR-77 Longhorn", cls: "rifle", slot: 0,
    dmgBody: 33, dmgHead: 116, rpm: 600, magSize: 25, reserve: 75, reloadTime: 2.3,
    auto: true, pellets: 1,
    spreadHip: 0.6, spreadAds: 0.22, spreadMove: 2.1, spreadJump: 4.2,
    bloomPerShot: 0.19, bloomMax: 2.6, bloomDecay: 5,
    recoilPitch: [0.52, 0.54, 0.56, 0.6, 0.66, 0.72], recoilYaw: [0, 0.06, 0.1, -0.16, -0.22, 0.2],
    rangeFar: 34, falloffMin: 0.78,
    adsFov: 55, adsTime: 0.18, zoomScope: false, moveMult: 0.97, drawTime: 0.55, melee: false,
    tracerColor: 0xfff2cc, sfx: { freq: 1500, decay: 0.11, punch: 1.0, noise: 0.7, vol: 0.8 },
  }),
  W({
    id: 3, name: "Mauler-12", cls: "shotgun", slot: 0,
    dmgBody: 11, dmgHead: 24, rpm: 68, magSize: 6, reserve: 18, reloadTime: 2.6,
    auto: false, pellets: 8,
    spreadHip: 3.6, spreadAds: 3.0, spreadMove: 4.2, spreadJump: 5.5,
    bloomPerShot: 0.4, bloomMax: 1.2, bloomDecay: 4,
    recoilPitch: [3.2], recoilYaw: [0.3],
    rangeFar: 11, falloffMin: 0.3,
    adsFov: 64, adsTime: 0.2, zoomScope: false, moveMult: 0.94, drawTime: 0.6, melee: false,
    tracerColor: 0xffcf99, sfx: { freq: 900, decay: 0.17, punch: 1.4, noise: 0.95, vol: 0.95 },
  }),
  W({
    id: 4, name: "VKS Longshot", cls: "sniper", slot: 0,
    dmgBody: 140, dmgHead: 255, rpm: 42, magSize: 5, reserve: 15, reloadTime: 3.1,
    auto: false, pellets: 1,
    spreadHip: 5.5, spreadAds: 0.03, spreadMove: 7.5, spreadJump: 9,
    bloomPerShot: 0.5, bloomMax: 1.0, bloomDecay: 3,
    recoilPitch: [4.6], recoilYaw: [0.2],
    rangeFar: 200, falloffMin: 1.0,
    adsFov: 16, adsTime: 0.32, zoomScope: true, moveMult: 0.88, drawTime: 0.75, melee: false,
    tracerColor: 0xcfe8ff, sfx: { freq: 700, decay: 0.24, punch: 1.6, noise: 0.6, vol: 1.0 },
  }),
  W({
    id: 5, name: "Gorgon LMG", cls: "lmg", slot: 0,
    dmgBody: 30, dmgHead: 96, rpm: 520, magSize: 60, reserve: 120, reloadTime: 3.6,
    auto: true, pellets: 1,
    spreadHip: 1.1, spreadAds: 0.5, spreadMove: 2.6, spreadJump: 5,
    bloomPerShot: 0.14, bloomMax: 3.2, bloomDecay: 4.2,
    recoilPitch: [0.44, 0.46, 0.48, 0.5, 0.54], recoilYaw: [0, -0.14, 0.16, -0.18, 0.22],
    rangeFar: 40, falloffMin: 0.8,
    adsFov: 56, adsTime: 0.26, zoomScope: false, moveMult: 0.86, drawTime: 0.7, melee: false,
    tracerColor: 0xffe2a8, sfx: { freq: 1150, decay: 0.13, punch: 1.15, noise: 0.85, vol: 0.85 },
  }),
  W({
    id: 6, name: "Tactical Blade", cls: "knife", slot: 2,
    dmgBody: 55, dmgHead: 55, rpm: 130, magSize: 0, reserve: 0, reloadTime: 0,
    auto: false, pellets: 1,
    spreadHip: 0, spreadAds: 0, spreadMove: 0, spreadJump: 0,
    bloomPerShot: 0, bloomMax: 0, bloomDecay: 0,
    recoilPitch: [0.4], recoilYaw: [0],
    rangeFar: 2.15, falloffMin: 1,
    adsFov: 70, adsTime: 0.1, zoomScope: false, moveMult: 1.09, drawTime: 0.3, melee: true,
    tracerColor: 0xffffff, sfx: { freq: 3200, decay: 0.05, punch: 0.2, noise: 0.4, vol: 0.35 },
  }),
];

export const PRIMARY_WEAPONS = [1, 2, 3, 4, 5];
export const PISTOL_ID = 0;
export const KNIFE_ID = 6;

export function weaponById(id: number): WeaponDef {
  return WEAPONS[id] ?? WEAPONS[PISTOL_ID];
}

export function damageAtRange(w: WeaponDef, dist: number): number {
  if (dist >= w.rangeFar) return w.dmgBody * w.falloffMin;
  return w.dmgBody;
}
