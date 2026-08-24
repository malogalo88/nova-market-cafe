export class PerfOverlay {
  el: HTMLDivElement;
  private graph: HTMLCanvasElement;
  private gctx: CanvasRenderingContext2D;
  private statsEl: HTMLPreElement;
  visible = false;
  frameTimes: Float32Array = new Float32Array(140);
  ftIdx = 0;

  constructor() {
    this.el = document.createElement("div");
    this.el.id = "perf-overlay";
    this.el.classList.add("hidden");
    const graph = document.createElement("canvas");
    graph.id = "perf-graph";
    graph.width = 220;
    graph.height = 44;
    this.graph = graph;
    this.gctx = graph.getContext("2d")!;
    this.statsEl = document.createElement("pre");
    this.statsEl.id = "perf-stats";
    this.el.appendChild(graph);
    this.el.appendChild(this.statsEl);
    document.body.appendChild(this.el);
  }

  setStats(text: string): void {
    this.statsEl.textContent = text;
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.classList.toggle("hidden", !this.visible);
  }

  pushFrameTime(ms: number): void {
    this.frameTimes[this.ftIdx] = ms;
    this.ftIdx = (this.ftIdx + 1) % this.frameTimes.length;
  }

  get avgFrameMs(): number {
    let sum = 0;
    let n = 0;
    for (let i = 0; i < this.frameTimes.length; i++) {
      const v = this.frameTimes[i];
      if (v > 0) { sum += v; n++; }
    }
    return n > 0 ? sum / n : 16.7;
  }

  drawGraph(): void {
    const ctx = this.gctx;
    const w = this.graph.width;
    const h = this.graph.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0b0f13";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#1d4a28";
    ctx.beginPath();
    ctx.moveTo(0, h - (16.7 / 50) * h);
    ctx.lineTo(w, h - (16.7 / 50) * h);
    ctx.stroke();
    ctx.strokeStyle = "#5cff8a";
    ctx.beginPath();
    for (let i = 0; i < this.frameTimes.length; i++) {
      const v = this.frameTimes[(this.ftIdx + i) % this.frameTimes.length];
      if (v <= 0) continue;
      const x = (i / this.frameTimes.length) * w;
      const y = h - Math.min(v, 50) / 50 * h;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}
