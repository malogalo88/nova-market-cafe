export const TEX = { FLOOR: 0, WALL: 1, CONCRETE: 2, METAL: 3, CRATE: 4, PLAT: 5, DARK: 6, ROOF: 7, TRIM: 8, HAZARD: 9, GLASS: 10, LAMP: 11 } as const;

export interface MapBox {
  x: number; y: number; z: number;
  sx: number; sy: number; sz: number;
  tex: number;
}

export interface GameMap {
  name: string;
  displayName: string;
  boxes: MapBox[];
  spawnsA: number[][];
  spawnsB: number[][];
  navNodes: number[][];
  siteA: number[];
  siteB: number[];
}

type BFn = (x: number, y: number, z: number, sx: number, sy: number, sz: number, tex: number) => MapBox;
const B: BFn = (x, y, z, sx, sy, sz, tex) => ({ x, y, z, sx, sy, sz, tex });

function wallX(x: number, z0: number, z1: number, h: number): MapBox {
  return B(x, h / 2, (z0 + z1) / 2, 1, h, Math.abs(z1 - z0), TEX.WALL);
}
function wallZ(z: number, x0: number, x1: number, h: number): MapBox {
  return B((x0 + x1) / 2, h / 2, z, Math.abs(x1 - x0), h, 1, TEX.WALL);
}
function crate(x: number, z: number): MapBox {
  return B(x, 0.6, z, 1.2, 1.2, 1.2, TEX.CRATE);
}
function lowCover(x: number, z: number, sx = 2.4, sz = 1.1): MapBox {
  return B(x, 0.55, z, sx, 1.1, sz, TEX.CONCRETE);
}
function plat(x: number, z: number, sx: number, sz: number, y0: number, th: number): MapBox {
  return B(x, y0 + th / 2, z, sx, th, sz, TEX.PLAT);
}
function steps(x: number, z: number, dirX: number, dirZ: number, count: number, width: number, rise: number, depth: number): void {
  const acc = stepsAcc;
  for (let i = 1; i <= count; i++) {
    const h = rise * i;
    acc.push(B(x + dirX * (i - 0.5) * depth, h / 2, z + dirZ * (i - 0.5) * depth,
      dirZ !== 0 ? width : depth, h, dirX !== 0 ? width : depth, TEX.CONCRETE));
  }
}
let stepsAcc: MapBox[] = [];

export function buildFoundry(): GameMap {
  stepsAcc = [];
  const boxes = stepsAcc;
  boxes.push(B(0, -0.5, 0, 84, 1, 68, TEX.FLOOR));

  boxes.push(wallZ(-33, -42, 42, 7), wallZ(33, -42, 42, 7), wallX(-41, -33, 33, 7), wallX(41, -33, 33, 7));

  boxes.push(wallZ(-23, -41, -28, 4.5), wallZ(-23, -21, -2, 4.5), wallZ(-23, 3, 25, 4.5), wallZ(-23, 29, 41, 4.5));
  boxes.push(wallZ(23, -41, -27, 4.5), wallZ(23, -22, -3, 4.5), wallZ(23, 2, 24, 4.5), wallZ(23, 30, 41, 4.5));

  const ax0 = -37, ax1 = -15, az0 = -13, az1 = 13;
  boxes.push(wallZ(az1, ax0, -26, 4.2), wallZ(az1, -22, ax1, 4.2));
  boxes.push(wallZ(az0, ax0, -26, 4.2), wallZ(az0, -22, -17, 4.2), wallZ(az0, -13, ax1, 4.2));
  boxes.push(wallX(ax0, az0, az1, 4.2), wallX(ax1, az0, -2, 4.2), wallX(ax1, 2, az1, 4.2));
  platPush(boxes, -31, 8, 9, 9, 3.6, 0.5, TEX.ROOF);
  boxes.push(B(-31, 1.8, 12.3, 10, 0.35, 0.6, TEX.METAL));
  boxes.push(crate(-19, -6), crate(-19, -7.4));
  boxes.push(lowCover(-24, -8, 3, 1.1));
  boxes.push(B(-34, 1, 0, 0.8, 2, 6, TEX.DARK));
  steps(-36.5, -9, 0, -1, 7, 2.4, 0.55, 0.55);

  boxes.push(B(0, 2.25, 2, 12, 4.5, 11, TEX.CONCRETE));
  steps(2.5, 14, 0, -1, 8, 4, 0.56, 0.56);
  platPush(boxes, 0, -9, 7, 4, 0, 0.55, TEX.PLAT);
  boxes.push(crate(-9, 0), crate(-10.4, 1.2), lowCover(-9, -5));
  boxes.push(crate(9, 0), crate(10.4, -1.2), lowCover(9.5, 6));

  boxes.push(wallX(14, -20, -14, 4), wallX(14, -10, 6, 4), wallX(14, 10, 20, 4));
  platPush(boxes, 27, -18, 16, 10, 0, 0.6, TEX.PLAT);
  steps(18.5, -18, 1, 0, 3, 5, 0.56, 0.62);
  boxes.push(crate(20, -13), crate(21.4, -13), crate(31, -8));
  boxes.push(lowCover(24, 0, 3.6, 1.1), lowCover(32, 6, 1.1, 3.6));
  boxes.push(crate(18, 10), crate(18, 11.4), crate(19.4, 10), lowCover(27, 15, 3.6, 1.1));

  boxes.push(wallX(22, 8, 14, 3.6), wallX(30, 8, 14, 3.6), wallZ(14, 22, 30, 3.6));
  platPush(boxes, 26, 11, 8, 6, 3.4, 0.4, TEX.ROOF);
  boxes.push(lowCover(26, 11, 1.4, 3));

  boxes.push(wallX(-24.5, 14, 22.5, 3.6), wallX(-19.5, 14, 22.5, 3.6), wallZ(22.5, -19.5, -18, 3.6));

  boxes.push(plat(0, 28.5, 30, 8, 0, 0.35));
  boxes.push(plat(0, -28.5, 30, 8, 0, 0.35));

  dressWorld(boxes);

  const spawnsA = [
    [-30, 0, 28], [-20, 0, 28], [-16.5, 0, 28], [16.5, 0, 28], [24, 0, 28],
  ];
  const spawnsB = [
    [-30, 0, -28], [-20, 0, -28], [-16.5, 0, -28], [16.5, 0, -28], [24, 0, -28],
  ];

  const navNodes: number[][] = [
    [-26, 0, 28], [0, 0, 28], [24, 0, 28],
    [-24.5, 0, 18], [-24.5, 0, 8], [-24.5, 0, -8], [-24.5, 0, -17],
    [-26, 0, 26.5],
    [-9.5, 0, 10], [-9.5, 0, 0], [-9.5, 0, -6], [-9.5, 0, -16],
    [9.5, 0, 10], [9.5, 0, 0], [9.5, 0, -6], [9.5, 0, -16],
    [2.5, 4.5, 8], [2.5, 4.5, 2], [2.5, 0.5, 12],
    [-31, 0.6, 8], [-31, 0.6, 0], [-26, 0.6, -8],
    [-36.5, 3.85, -9], [-31, 3.85, -9], [-26, 3.85, 8],
    [18, 0, 16], [26, 0, 11], [26, 0, 0], [26, 0, -8], [27, 0.6, -18], [31, 0, -8],
    [26, 0, -26], [0, 0, -26], [-26, 0, -26], [26, 0, 26],
  ];

  return {
    name: "foundry",
    displayName: "FOUNDRY",
    boxes,
    spawnsA,
    spawnsB,
    navNodes,
    siteA: [-26, 0.6, 0],
    siteB: [27, 0.6, -18],
  };
}

function platPush(arr: MapBox[], x: number, z: number, sx: number, sz: number, y0: number, th: number, tex: number): void {
  arr.push(B(x, y0 + th / 2, z, sx, th, sz, tex));
}

function dressWorld(bx: MapBox[]): void {
  const T = TEX;
  const trimX = (x: number, z0: number, z1: number, y = 0.18, h = 0.36): void => {
    bx.push(B(x, y, (z0 + z1) / 2, 0.14, h, Math.abs(z1 - z0), T.TRIM));
  };
  const trimZ = (z: number, x0: number, x1: number, y = 0.18, h = 0.36): void => {
    bx.push(B((x0 + x1) / 2, y, z, Math.abs(x1 - x0), h, 0.14, T.TRIM));
  };

  trimX(-40.42, -32.6, 32.6);
  trimX(40.42, -32.6, 32.6);
  trimZ(-32.92, -40, 40);
  trimZ(32.92, -40, 40);

  for (const zx of [-1, 1]) {
    bx.push(B(zx * 39.9, 6.55, 0, 0.5, 0.5, 62, T.TRIM));
    bx.push(B(0, 6.55, zx * 31.9, 76, 0.5, 0.5, T.TRIM));
  }

  const pillar = (x: number, z: number, h = 4.4): void => {
    bx.push(B(x, h / 2, z, 0.95, h, 0.95, T.CONCRETE));
    bx.push(B(x, h + 0.12, z, 1.15, 0.24, 1.15, T.TRIM));
  };
  pillar(-26.2, -22.2); pillar(-15.8, -22.2); pillar(-15.8, -13.8); pillar(-37.6, 13.6);
  pillar(14.9, -10.4); pillar(14.9, 5.6); pillar(30.6, 7.2); pillar(21.4, 14.6);

  const doorFrame = (z: number, x0: number, x1: number): void => {
    bx.push(B(x0, 1.85, z, 0.45, 3.7, 0.6, T.TRIM));
    bx.push(B(x1, 1.85, z, 0.45, 3.7, 0.6, T.TRIM));
    bx.push(B((x0 + x1) / 2, 3.85, z, Math.abs(x1 - x0) + 0.45, 0.5, 0.62, T.TRIM));
    bx.push(B((x0 + x1) / 2, 3.35, z, Math.abs(x1 - x0), 0.16, 0.66, T.HAZARD));
  };
  doorFrame(23, -25.4, -22.6);
  doorFrame(-23, 24.6, 27.4);

  const window_ = (x: number, z: number, horiz: boolean): void => {
    if (horiz) bx.push(B(x, 1.75, z, 2.6, 1.5, 0.18, T.GLASS));
    else bx.push(B(x, 1.75, z, 0.18, 1.5, 2.6, T.GLASS));
  };
  window_(0, -22.94, true); window_(-12, -22.94, true); window_(12, 22.94, true); window_(0, 22.94, true);
  window_(-40.94, 18, false); window_(40.94, -18, false); window_(-40.94, -18, false); window_(40.94, 18, false);
  window_(-13.94, 0, false); window_(13.94, 0, false);

  for (const [px, pz, len] of [[-9.5, 20, 9], [9.5, -20, 9], [-24.5, 0, 11], [26, 4, 10]] as number[][]) {
    const horiz = px === -9.5 || px === 9.5;
    if (horiz) {
      bx.push(B(px, 3.45, pz, 0.34, 0.34, len, T.METAL));
      bx.push(B(px, 3.72, pz, 0.44, 0.2, len * 0.7, T.TRIM));
    } else {
      bx.push(B(px, 3.45, pz, len, 0.34, 0.34, T.METAL));
      bx.push(B(px, 3.72, pz, len * 0.7, 0.2, 0.44, T.TRIM));
    }
  }

  bx.push(B(-26, 4.78, 0, 22.5, 0.35, 26.4, T.ROOF));
  for (const bz of [-10, 0, 10]) bx.push(B(-26, 4.5, bz, 22, 0.55, 0.4, T.TRIM));
  for (const bxx of [-35.5, -16.5]) bx.push(B(bxx, 2.4, 0, 0.5, 4.8, 0.5, T.TRIM));
  bx.push(B(-26, 4.52, -12.4, 20, 0.5, 0.4, T.TRIM));

  const lamp = (x: number, y: number, z: number): void => {
    bx.push(B(x, y, z, 1.7, 0.42, 0.5, T.LAMP));
  };
  lamp(-26, 4.5, 0); lamp(-26, 4.5, -9); lamp(0, 3.4, -22.6); lamp(26, 3.4, 23);
  lamp(-38, 3.2, 28); lamp(38, 3.2, -28);

  const hazardPlate = (x: number, z: number, horiz: boolean): void => {
    if (horiz) bx.push(B(x, 1.05, z, 3.2, 0.9, 0.16, T.HAZARD));
    else bx.push(B(x, 1.05, z, 0.16, 0.9, 3.2, T.HAZARD));
  };
  hazardPlate(-15.06, 8, false); hazardPlate(14.06, -12, false);
  hazardPlate(0, -32.42, true); hazardPlate(-26, 32.42, true);

  bx.push(B(-26, 0.035, 4.8, 9.6, 0.07, 0.07, T.HAZARD));

  const barrel = (x: number, z: number, stack = 1): void => {
    bx.push(B(x, 0.46, z, 0.88, 0.92, 0.88, T.METAL));
    if (stack > 1) bx.push(B(x + 0.04, 1.36, z - 0.03, 0.82, 0.86, 0.82, T.METAL));
  };
  barrel(-38.9, 30.9); barrel(-38.1, 29.9, 2); barrel(38.8, -30.6); barrel(38.2, -29.4, 2);
  barrel(-39, -25.5); barrel(20.2, -31.2); barrel(-19.6, 31.3, 2); barrel(33.5, 30.9);

  const pallet = (x: number, z: number): void => {
    bx.push(B(x, 0.09, z, 1.5, 0.18, 1.5, T.DARK));
  };
  pallet(-36.2, 22.4); pallet(35.4, 24.8); pallet(17.6, -30.6); pallet(-8.2, -30.9);

  bx.push(crate(-37.9, -31)); cratePush(bx, -36.6, -30.4);
  cratePush(bx, 36.8, 31.2); cratePush(bx, 35.6, 30.2);

  const signPost = (x: number, z: number, horiz: boolean): void => {
    if (horiz) {
      bx.push(B(x, 2.9, z, 2.2, 1.0, 0.14, T.HAZARD));
      bx.push(B(x, 2.9, z + (z > 0 ? -0.1 : 0.1), 2.3, 1.1, 0.06, T.DARK));
    } else {
      bx.push(B(x, 2.9, z, 0.14, 1.0, 2.2, T.HAZARD));
    }
  };
  signPost(-9.5, 13.2, true); signPost(9.5, -13.2, true); signPost(-24.5, -20.4, true);

  bx.push(B(-31, 3.62, 12.3, 10.4, 0.14, 0.7, T.TRIM));
  bx.push(B(26, 3.58, 11, 8.4, 0.14, 6.4, T.TRIM));
}

function cratePush(arr: MapBox[], x: number, z: number): void {
  arr.push(B(x, 0.6, z, 1.2, 1.2, 1.2, TEX.CRATE));
}
