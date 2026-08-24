import { CrosshairSettings } from "../settings.js";

export class Crosshair {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  settings: CrosshairSettings;
  spread01 = 0;

  constructor(settings: CrosshairSettings) {
    this.canvas = document.getElementById("xhair") as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    this.settings = settings;
  }

  draw(): void {
    const c = this.settings;
    const ctx = this.ctx;
    const size = 64;
    const cx = size / 2;
    ctx.clearRect(0, 0, size, size);

    const gap = c.gap + (c.dynamic ? this.spread01 * 10 : 0);
    const len = c.size;
    const th = c.thickness;

    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.lineWidth = th + 2;
    if (c.outline) this.drawLines(cx, gap, len, th + 2);

    ctx.strokeStyle = c.color;
    ctx.lineWidth = th;
    if (!c.dot || true) this.drawLines(cx, gap, len, th);

    if (c.dot) {
      if (c.outline) {
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.fillRect(cx - th / 2 - 1, cx - th / 2 - 1, th + 2, th + 2);
      }
      ctx.fillStyle = c.color;
      ctx.fillRect(cx - th / 2, cx - th / 2, th, th);
    }
  }

  private drawLines(cx: number, gap: number, len: number, th: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(cx, cx - gap - len); ctx.lineTo(cx, cx - gap);
    ctx.moveTo(cx, cx + gap); ctx.lineTo(cx, cx + gap + len);
    ctx.moveTo(cx - gap - len, cx); ctx.lineTo(cx - gap, cx);
    ctx.moveTo(cx + gap, cx); ctx.lineTo(cx + gap + len, cx);
    ctx.stroke();
  }
}
