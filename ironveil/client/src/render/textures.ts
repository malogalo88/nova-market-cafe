import * as THREE from "three";

export const ATLAS_COLS = 4;
export const ATLAS_ROWS = 3;
const CELL = 256;

export const TEX_UV: Record<number, [number, number]> = {};
for (let i = 0; i < ATLAS_COLS * ATLAS_ROWS; i++) {
  const row = Math.floor(i / ATLAS_COLS);
  TEX_UV[i] = [(i % ATLAS_COLS) / ATLAS_COLS, 1 - (row + 1) / ATLAS_ROWS];
}

let atlasTexture: THREE.Texture | null = null;

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

function noiseOverlay(ctx: CanvasRenderingContext2D, x0: number, y0: number, rng: () => number, amount: number): void {
  const img = ctx.getImageData(x0, y0, CELL, CELL);
  const d = img.data;
  let acc = 0;
  for (let i = 0; i < d.length; i += 4) {
    acc = acc * 0.82 + (rng() - 0.5) * amount;
    const n = acc + (rng() - 0.5) * amount * 0.55;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, x0, y0);
}

function vgrad(ctx: CanvasRenderingContext2D, x0: number, y0: number, top: string, bot: string): void {
  const c0 = parseInt(top.slice(1), 16), c1 = parseInt(bot.slice(1), 16);
  for (let y = 0; y < CELL; y++) {
    const t = y / (CELL - 1);
    const r = ((c0 >> 16) & 255) * (1 - t) + ((c1 >> 16) & 255) * t;
    const g = ((c0 >> 8) & 255) * (1 - t) + ((c1 >> 8) & 255) * t;
    const b = (c0 & 255) * (1 - t) + (c1 & 255) * t;
    ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
    ctx.fillRect(x0, y0 + y, CELL, 1);
  }
}

function speck(ctx: CanvasRenderingContext2D, x0: number, y0: number, rng: () => number, n: number, lo: number, hi: number, alpha: number): void {
  for (let i = 0; i < n; i++) {
    const g = lo + Math.floor(rng() * (hi - lo));
    ctx.fillStyle = `rgba(${g},${g},${g},${alpha})`;
    ctx.fillRect(x0 + rng() * CELL, y0 + rng() * CELL, 1 + rng() * 3, 1 + rng() * 3);
  }
}

function scratches(ctx: CanvasRenderingContext2D, x0: number, y0: number, rng: () => number, n: number, dark: string, light: string): void {
  for (let i = 0; i < n; i++) {
    ctx.strokeStyle = rng() > 0.45 ? dark : light;
    ctx.lineWidth = 0.6 + rng() * 1.4;
    ctx.beginPath();
    const sx = x0 + rng() * CELL, sy = y0 + rng() * CELL;
    const a = rng() * Math.PI * 2, l = 8 + rng() * 46;
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l);
    ctx.stroke();
  }
}

function rivets(ctx: CanvasRenderingContext2D, x0: number, y0: number, pts: number[][]): void {
  ctx.fillStyle = "rgba(18,22,26,0.65)";
  for (const [px, py] of pts) {
    ctx.beginPath(); ctx.arc(x0 + px, y0 + py, 3.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = "rgba(210,220,228,0.30)";
  for (const [px, py] of pts) {
    ctx.beginPath(); ctx.arc(x0 + px - 1, y0 + py - 1, 1.5, 0, Math.PI * 2); ctx.fill();
  }
}

function drawFloor(ctx: CanvasRenderingContext2D, x0: number, y0: number, rng: () => number): void {
  vgrad(ctx, x0, y0, "#7b7f83", "#66696d");
  const tile = 64;
  for (let ty = 0; ty < CELL; ty += tile) {
    for (let tx = 0; tx < CELL; tx += tile) {
      const v = 106 + Math.floor(rng() * 20);
      ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
      ctx.fillRect(x0 + tx + 2, y0 + ty + 2, tile - 4, tile - 4);
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(x0 + tx + 2, y0 + ty + 2, tile - 4, 2);
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(x0 + tx + 2, y0 + ty + tile - 5, tile - 4, 3);
      if (rng() > 0.72) {
        ctx.fillStyle = `rgba(52,50,44,${0.14 + rng() * 0.2})`;
        ctx.fillRect(x0 + tx + 6 + rng() * 20, y0 + ty + 6 + rng() * 20, 14 + rng() * 30, 10 + rng() * 24);
      }
    }
  }
  scratches(ctx, x0, y0, rng, 10, "rgba(30,30,30,0.25)", "rgba(255,255,255,0.06)");
  speck(ctx, x0, y0, rng, 130, 60, 140, 0.16);
  noiseOverlay(ctx, x0, y0, rng, 20);
}

function drawWall(ctx: CanvasRenderingContext2D, x0: number, y0: number, rng: () => number): void {
  vgrad(ctx, x0, y0, "#a39c8e", "#8a8276");
  const rows = 4;
  const h = CELL / rows;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (CELL / 8);
    for (let c = -1; c < 5; c++) {
      const w = CELL / 4;
      const v = 150 + Math.floor(rng() * 16);
      ctx.fillStyle = `rgb(${v},${v - 5},${v - 12})`;
      ctx.fillRect(x0 + ((off + c * w) % (CELL + w)) - w / 2 + 2, y0 + r * h + 2, w - 4, h - 4);
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(x0 + ((off + c * w) % (CELL + w)) - w / 2 + 2, y0 + r * h + 2, w - 4, 2);
    }
  }
  ctx.fillStyle = "rgba(58,52,42,0.35)";
  ctx.fillRect(x0, y0 + CELL - 34, CELL, 10);
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = `rgba(64,56,40,${0.08 + rng() * 0.16})`;
    ctx.fillRect(x0 + rng() * CELL, y0 + CELL - 60 + rng() * 60, 4 + rng() * 22, 3 + rng() * 14);
  }
  scratches(ctx, x0, y0, rng, 8, "rgba(48,42,32,0.22)", "rgba(255,250,240,0.05)");
  noiseOverlay(ctx, x0, y0, rng, 15);
}

function drawConcrete(ctx: CanvasRenderingContext2D, x0: number, y0: number, rng: () => number): void {
  vgrad(ctx, x0, y0, "#95979b", "#7d7f83");
  for (let i = 0; i < 46; i++) {
    const g = 116 + Math.floor(rng() * 44);
    ctx.fillStyle = `rgba(${g},${g},${g},0.24)`;
    ctx.fillRect(x0 + rng() * CELL, y0 + rng() * CELL, 12 + rng() * 54, 7 + rng() * 22);
  }
  ctx.strokeStyle = "rgba(40,40,42,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0 + rng() * CELL, y0);
  for (let yy = 0; yy < 5; yy++) ctx.lineTo(x0 + rng() * CELL, y0 + (yy * CELL) / 4);
  ctx.stroke();
  speck(ctx, x0, y0, rng, 170, 70, 160, 0.18);
  noiseOverlay(ctx, x0, y0, rng, 24);
}

function drawMetal(ctx: CanvasRenderingContext2D, x0: number, y0: number, rng: () => number): void {
  vgrad(ctx, x0, y0, "#68737e", "#525b64");
  for (let yy = 0; yy < CELL; yy += 64) {
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.fillRect(x0, y0 + yy, CELL, 3);
    ctx.fillStyle = "rgba(0,0,0,0.30)";
    ctx.fillRect(x0, y0 + yy + 60, CELL, 4);
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(x0 + 62, y0 + yy, 3, 64);
    ctx.fillRect(x0 + 190, y0 + yy, 3, 64);
  }
  rivets(ctx, x0, y0, [[16, 16], [112, 16], [208, 16], [16, 112], [112, 112], [208, 112], [16, 208], [112, 208], [208, 208]]);
  scratches(ctx, x0, y0, rng, 14, "rgba(22,26,30,0.4)", "rgba(200,214,224,0.13)");
  noiseOverlay(ctx, x0, y0, rng, 11);
}

function drawCrate(ctx: CanvasRenderingContext2D, x0: number, y0: number, rng: () => number): void {
  vgrad(ctx, x0, y0, "#96754c", "#7a5c38");
  for (let b = 0; b < 4; b++) {
    const v = 126 + Math.floor(rng() * 26);
    ctx.fillStyle = `rgb(${v},${Math.floor(v * 0.74)},${Math.floor(v * 0.5)})`;
    ctx.fillRect(x0 + 4, y0 + 4 + b * 63, CELL - 8, 57);
    ctx.fillStyle = "rgba(255,235,200,0.09)";
    ctx.fillRect(x0 + 4, y0 + 4 + b * 63, CELL - 8, 3);
    ctx.fillStyle = "rgba(30,20,10,0.4)";
    ctx.fillRect(x0 + 4, y0 + 57 + b * 63, CELL - 8, 4);
    for (let i = 0; i < 9; i++) {
      ctx.strokeStyle = "rgba(56,40,22,0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      const gy = y0 + 8 + b * 63 + rng() * 50;
      ctx.moveTo(x0 + 6 + rng() * 40, gy);
      ctx.lineTo(x0 + 60 + rng() * 180, gy + (rng() - 0.5) * 6);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = "rgba(38,26,14,0.85)";
  ctx.lineWidth = 10;
  ctx.strokeRect(x0 + 5, y0 + 5, CELL - 10, CELL - 10);
  ctx.fillStyle = "rgba(238,196,88,0.9)";
  ctx.save();
  ctx.translate(x0 + CELL / 2, y0 + CELL / 2);
  ctx.rotate(-Math.PI / 4);
  ctx.fillRect(-110, -8, 220, 16);
  ctx.restore();
  ctx.fillStyle = "rgba(30,22,12,0.75)";
  ctx.font = "bold 44px monospace";
  ctx.fillText("IV-77", x0 + 74, y0 + 146);
  noiseOverlay(ctx, x0, y0, rng, 17);
}

function drawPlat(ctx: CanvasRenderingContext2D, x0: number, y0: number, rng: () => number): void {
  vgrad(ctx, x0, y0, "#576069", "#454d55");
  for (let i = 0; i < CELL; i += 32) {
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.fillRect(x0, y0 + i, CELL, 5);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(x0, y0 + i + 5, CELL, 2);
  }
  for (let gx = 14; gx < CELL; gx += 30) {
    ctx.strokeStyle = "rgba(20,24,28,0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x0 + gx, y0);
    ctx.lineTo(x0 + gx, y0 + CELL);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(232,178,52,0.28)";
  ctx.fillRect(x0, y0, CELL, 14);
  ctx.fillStyle = "rgba(232,178,52,0.85)";
  for (let i = 21; i < CELL; i += 84) {
    ctx.save();
    ctx.translate(x0 + i, y0 + 62);
    ctx.rotate(-0.35);
    ctx.fillRect(-7, -42, 14, 84);
    ctx.restore();
  }
  noiseOverlay(ctx, x0, y0, rng, 13);
}

function drawDark(ctx: CanvasRenderingContext2D, x0: number, y0: number, rng: () => number): void {
  vgrad(ctx, x0, y0, "#3b4148", "#2c3136");
  speck(ctx, x0, y0, rng, 90, 50, 100, 0.2);
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fillRect(x0, y0, CELL, 2);
  noiseOverlay(ctx, x0, y0, rng, 10);
}

function drawRoof(ctx: CanvasRenderingContext2D, x0: number, y0: number, rng: () => number): void {
  vgrad(ctx, x0, y0, "#5f656c", "#4b5158");
  for (let i = 0; i < CELL; i += 26) {
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(x0 + i, y0, 10, CELL);
    ctx.fillStyle = "rgba(0,0,0,0.30)";
    ctx.fillRect(x0 + i + 13, y0, 13, CELL);
  }
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(120,80,50,${0.05 + rng() * 0.14})`;
    ctx.fillRect(x0 + rng() * CELL, y0 + rng() * CELL, 3 + rng() * 10, 2 + rng() * 6);
  }
  noiseOverlay(ctx, x0, y0, rng, 12);
}

function drawTrim(ctx: CanvasRenderingContext2D, x0: number, y0: number, rng: () => number): void {
  vgrad(ctx, x0, y0, "#4a525a", "#333a41");
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(x0, y0, CELL, 6);
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(x0, y0 + CELL - 8, CELL, 8);
  for (let i = 20; i < CELL; i += 48) {
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(x0 + i, y0 + 20, 8, CELL - 40);
  }
  rivets(ctx, x0, y0, [[36, 128], [128, 40], [128, 216], [220, 128]]);
  scratches(ctx, x0, y0, rng, 9, "rgba(10,12,14,0.4)", "rgba(190,204,214,0.10)");
  noiseOverlay(ctx, x0, y0, rng, 10);
}

function drawHazard(ctx: CanvasRenderingContext2D, x0: number, y0: number, rng: () => number): void {
  ctx.fillStyle = "#c99a1c";
  ctx.fillRect(x0, y0, CELL, CELL);
  ctx.fillStyle = "#20242a";
  ctx.save();
  ctx.translate(x0 + CELL / 2, y0 + CELL / 2);
  ctx.rotate(Math.PI / 4);
  for (let i = -3; i <= 3; i++) ctx.fillRect(i * 64 - 16, -220, 32, 440);
  ctx.restore();
  ctx.fillStyle = "rgba(255,230,140,0.16)";
  ctx.fillRect(x0, y0, CELL, 10);
  ctx.fillStyle = "rgba(0,0,0,0.30)";
  ctx.fillRect(x0, y0 + CELL - 12, CELL, 12);
  speck(ctx, x0, y0, rng, 60, 40, 110, 0.16);
  noiseOverlay(ctx, x0, y0, rng, 13);
}

function drawGlass(ctx: CanvasRenderingContext2D, x0: number, y0: number, rng: () => number): void {
  vgrad(ctx, x0, y0, "#9fbccb", "#7195aa");
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.beginPath();
  ctx.moveTo(x0 + 30, y0 + CELL);
  ctx.lineTo(x0 + 130, y0);
  ctx.lineTo(x0 + 168, y0);
  ctx.lineTo(x0 + 68, y0 + CELL);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.moveTo(x0 + 150, y0 + CELL);
  ctx.lineTo(x0 + 230, y0);
  ctx.lineTo(x0 + 246, y0);
  ctx.lineTo(x0 + 166, y0 + CELL);
  ctx.fill();
  ctx.strokeStyle = "#3c4650";
  ctx.lineWidth = 14;
  ctx.strokeRect(x0 + 7, y0 + 7, CELL - 14, CELL - 14);
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 3;
  ctx.strokeRect(x0 + 16, y0 + 16, CELL - 32, CELL - 32);
  speck(ctx, x0, y0, rng, 26, 200, 245, 0.1);
  noiseOverlay(ctx, x0, y0, rng, 7);
}

function drawLamp(ctx: CanvasRenderingContext2D, x0: number, y0: number, rng: () => number): void {
  ctx.fillStyle = "#fdf7e6";
  ctx.fillRect(x0, y0, CELL, CELL);
  ctx.fillStyle = "rgba(255,244,214,0.9)";
  ctx.fillRect(x0 + 10, y0 + 10, CELL - 20, CELL - 20);
  ctx.strokeStyle = "#8a8676";
  ctx.lineWidth = 10;
  ctx.strokeRect(x0 + 5, y0 + 5, CELL - 10, CELL - 10);
  ctx.fillStyle = "rgba(210,200,170,0.5)";
  for (let i = 24; i < CELL; i += 48) ctx.fillRect(x0 + i, y0 + 12, 4, CELL - 24);
  noiseOverlay(ctx, x0, y0, rng, 5);
}

export function buildAtlas(): THREE.Texture {
  if (atlasTexture) return atlasTexture;
  const cv = document.createElement("canvas");
  cv.width = CELL * ATLAS_COLS;
  cv.height = CELL * ATLAS_ROWS;
  const ctx = cv.getContext("2d")!;
  const rng = mulberry(1337);

  const drawers = [drawFloor, drawWall, drawConcrete, drawMetal, drawCrate, drawPlat, drawDark, drawRoof, drawTrim, drawHazard, drawGlass, drawLamp];
  drawers.forEach((fn, i) => {
    const x0 = (i % ATLAS_COLS) * CELL;
    const y0 = Math.floor(i / ATLAS_COLS) * CELL;
    fn(ctx, x0, y0, rng);
  });

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  atlasTexture = tex;
  return tex;
}
