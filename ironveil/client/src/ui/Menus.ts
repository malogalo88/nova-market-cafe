import { Settings, GRAPHICS_PRESETS, applyPreset } from "../settings.js";
import { ACTION_NAMES, keyLabel } from "../input.js";
import { AGENTS } from "../../../shared/src/agents.js";

export interface MenuCallbacks {
  onPlay(addr: string, name: string, mode: number, bots: number, diff: number): void;
  onSettingsChanged(): void;
  onResume(): void;
  onLeave(): void;
  onLoadoutSelect(primary: number, agent: number): void;
}

const $ = (id: string): HTMLElement => document.getElementById(id)!;

export class Menus {
  private cb: MenuCallbacks;
  private s: Settings;
  private listeningBind: string | null = null;
  private selPrimary = 2;
  private selAgent = 0;

  constructor(s: Settings, cb: MenuCallbacks) {
    this.s = s;
    this.cb = cb;

    $("btn-play").addEventListener("click", () => this.swap("playpanel"));
    $("btn-settings").addEventListener("click", () => this.swap("settingspanel"));
    $("btn-pause-settings").addEventListener("click", () => {
      $("pausemenu").classList.add("hidden");
      $("menu-root").classList.remove("hidden");
      $("menu-root").style.background = "rgba(10,13,17,0.85)";
      this.swap("settingspanel");
    });
    document.querySelectorAll("[data-back]").forEach((b) => {
      b.addEventListener("click", () => {
        const inGame = !$("hud").classList.contains("hidden");
        if (inGame) {
          $("settingspanel").classList.add("hidden");
          $("pausemenu").classList.remove("hidden");
        } else {
          this.swap("mainmenu");
          $("menu-root").style.background = "";
        }
      });
    });

    $("btn-connect").addEventListener("click", () => {
      this.uiClick();
      const addr = ($("inp-addr") as HTMLInputElement).value.trim() || `${location.hostname || "localhost"}:${location.port || "8012"}`;
      const name = ($("inp-name") as HTMLInputElement).value.trim() || "Operative";
      const mode = Number(($("sel-mode") as HTMLSelectElement).value);
      const bots = Math.max(1, Math.min(9, Number(($("inp-bots") as HTMLInputElement).value)));
      const diff = Number(($("sel-diff") as HTMLSelectElement).value);
      localStorage.setItem("ironveil.name", name);
      localStorage.setItem("ironveil.addr", addr);
      this.cb.onPlay(addr, name, mode, bots, diff);
    });

    $("btn-resume").addEventListener("click", () => { this.uiClick(); this.cb.onResume(); });
    $("btn-leave").addEventListener("click", () => { this.uiClick(); this.cb.onLeave(); });
    $("btn-end-menu").addEventListener("click", () => { this.uiClick(); this.hideAllPanels(); $("menu-root").classList.remove("hidden"); this.swap("mainmenu"); $("menu-root").style.background = ""; });

    document.querySelectorAll(".tab").forEach((t) => {
      t.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
        t.classList.add("active");
        document.querySelectorAll(".tabpage").forEach((p) => p.classList.add("hidden"));
        $(`tab-${(t as HTMLElement).dataset.tab}`).classList.remove("hidden");
        if ((t as HTMLElement).dataset.tab === "crosshair") this.drawXhPreview();
      });
    });

    const savedName = localStorage.getItem("ironveil.name");
    if (savedName) ($("inp-name") as HTMLInputElement).value = savedName;
    else ($("inp-name") as HTMLInputElement).value = "Operative" + Math.floor(Math.random() * 90 + 10);
    const savedAddr = localStorage.getItem("ironveil.addr");
    if (savedAddr) ($("inp-addr") as HTMLInputElement).value = savedAddr;

    this.buildVideoTab();
    this.buildControlsTab();
    this.buildCrosshairTab();
    this.buildAudioTab();
    this.buildLoadoutCards();
  }

  private uiHover(): void { /* handled by game audio hook */ }
  private uiClick(): void { }

  swap(panelId: string): void {
    this.hideAllPanels();
    $("menu-root").classList.remove("hidden");
    $(panelId).classList.remove("hidden");
  }

  hideAllPanels(): void {
    ["mainmenu", "playpanel", "settingspanel", "loadingpanel", "loadoutpanel", "pausemenu", "endscreen"].forEach((id) => $(id).classList.add("hidden"));
    $("menu-root").classList.add("hidden");
    $("menu-root").style.background = "";
  }

  showPause(): void {
    this.swap("pausemenu");
  }

  get pauseVisible(): boolean {
    return !$("pausemenu").classList.contains("hidden") || !$("endscreen").classList.contains("hidden");
  }

  hideMenus(): void {
    this.hideAllPanels();
  }

  showLoading(mapName: string): void {
    this.swap("loadingpanel");
    $("loadmapname").textContent = mapName.toUpperCase();
  }

  setLoadProgress(frac: number, tip: string): void {
    ($("loadbar") as HTMLElement).style.width = `${Math.round(frac * 100)}%`;
    $("loadtip").textContent = tip;
  }

  showLoadout(primary: number, agent: number): void {
    this.selPrimary = primary;
    this.selAgent = agent;
    this.refreshLoadoutSel();
    $("loadoutpanel").classList.remove("hidden");
    $("menu-root").classList.remove("hidden");
    $("menu-root").style.background = "rgba(10,13,17,0.35)";
  }

  hideLoadout(): void {
    $("loadoutpanel").classList.add("hidden");
    $("menu-root").style.background = "";
    if ([...document.querySelectorAll("#menu-root .panel:not(.hidden)")].length === 0) {
      $("menu-root").classList.add("hidden");
    }
  }

  setLoadoutCountdown(t: number): void {
    const el = $("lo-countdown");
    const txt = `${Math.ceil(t)}s`;
    if (el.textContent !== txt) el.textContent = txt;
  }

  showEnd(title: string, sub: string): void {
    $("end-title").textContent = title;
    $("end-score").textContent = sub;
    this.swap("endscreen");
  }

  private buildLoadoutCards(): void {
    const wWrap = $("lo-weapons");
    wWrap.innerHTML = `<div class="lo-title">PRIMARY WEAPON</div><div class="lo-cards" id="lo-wcards"></div>`;
    const aWrap = $("lo-agents");
    aWrap.innerHTML = `<div class="lo-title" style="margin-top:14px">OPERATIVE</div><div class="lo-cards" id="lo-acards"></div>`;

    const wc = $("lo-wcards");
    const weaponsList: [number, string, string][] = [
      [1, "HORNET", "SMG · 800rpm"],
      [2, "AR-77 LONGHORN", "Rifle · 33 dmg"],
      [3, "MAULER-12", "Shotgun · 8 pellets"],
      [4, "VKS LONGSHOT", "Sniper · lethal head"],
      [5, "GORGON", "LMG · 60 mag"],
    ];
    for (const [id, name, sub] of weaponsList) {
      const card = document.createElement("div");
      card.className = "lo-card";
      card.innerHTML = `<div class="lo-name">${name}</div><div class="lo-sub">${sub}</div>`;
      card.addEventListener("click", () => {
        this.selPrimary = id;
        this.refreshLoadoutSel();
        this.cb.onLoadoutSelect(this.selPrimary, this.selAgent);
      });
      wc.appendChild(card);
    }

    const ac = $("lo-acards");
    for (const ag of AGENTS) {
      const card = document.createElement("div");
      card.className = "lo-card";
      card.innerHTML = `<div class="lo-name">${ag.name}</div><div class="lo-sub">${ag.role}<br>${ag.q.name} · ${ag.e.name}</div>`;
      card.addEventListener("click", () => {
        this.selAgent = ag.id;
        this.refreshLoadoutSel();
        this.cb.onLoadoutSelect(this.selPrimary, this.selAgent);
      });
      ac.appendChild(card);
    }
    this.refreshLoadoutSel();
  }

  private refreshLoadoutSel(): void {
    document.querySelectorAll("#lo-wcards .lo-card").forEach((c, i) => {
      c.classList.toggle("sel", [1, 2, 3, 4, 5][i] === this.selPrimary);
    });
    document.querySelectorAll("#lo-acards .lo-card").forEach((c, i) => {
      c.classList.toggle("sel", i === this.selAgent);
    });
  }

  private buildVideoTab(): void {
    const tab = $("tab-video");
    tab.innerHTML = "";
    const g = this.s.graphics;

    const presetRow = document.createElement("div");
    presetRow.className = "setrow";
    presetRow.innerHTML = `<label>Quality Preset</label><select class="setsel" id="set-preset"></select>`;
    tab.appendChild(presetRow);
    const presetSel = presetRow.querySelector("select")!;
    GRAPHICS_PRESETS.forEach((name, i) => {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = name;
      presetSel.appendChild(opt);
    });
    presetSel.value = String(g.preset);
    presetSel.addEventListener("change", () => {
      applyPreset(g, Number(presetSel.value));
      this.rebuildVideoRows();
      this.cb.onSettingsChanged();
    });

    const rowsHost = document.createElement("div");
    rowsHost.id = "video-rows";
    tab.appendChild(rowsHost);
    this.buildVideoRows(rowsHost);
  }

  private rebuildVideoRows(): void {
    this.buildVideoRows($("video-rows"));
    ($("set-preset") as HTMLSelectElement).value = String(this.s.graphics.preset);
    this.cb.onSettingsChanged();
  }

  private buildVideoRows(host: HTMLElement): void {
    host.innerHTML = "";
    const g = this.s.graphics;

    this.slider(host, "Resolution Scale", 50, 130, Math.round(g.resScale * 100), (v) => { g.resScale = v / 100; g.preset = -1; }, "%");
    this.select(host, "Shadows", ["Off", "Blob Only", "Low (1024)", "High (2048)"], g.shadows, (v) => { g.shadows = v; g.preset = -1; });
    this.select(host, "Effects", ["Minimal", "Reduced", "Full"], g.effects, (v) => { g.effects = v; g.preset = -1; });
    this.slider(host, "View Distance", 60, 240, g.viewDist, (v) => { g.viewDist = v; g.preset = -1; }, "m");
    this.select(host, "Anti-Aliasing", ["Off", "MSAA 2x", "MSAA 4x"], g.aa, (v) => { g.aa = v; g.preset = -1; });
    this.slider(host, "Field of View", 60, 110, g.fov, (v) => { g.fov = v; }, "°");
    this.slider(host, "FPS Limit", 30, 244, Math.max(g.fpsLimit, 30), (v) => { g.fpsLimit = v === 244 ? 0 : v; g.preset = -1; }, g.fpsLimit === 0 ? "" : "");
  }

  private buildControlsTab(): void {
    const tab = $("tab-controls");
    tab.innerHTML = "";

    this.slider(tab, "Mouse Sensitivity", 20, 200, Math.round(this.s.sensitivity * 10000), (v) => { this.s.sensitivity = v / 10000; });
    this.slider(tab, "ADS Sensitivity", 40, 120, Math.round(this.s.adsSensMult * 100), (v) => { this.s.adsSensMult = v / 100; }, "%");
    this.check(tab, "Invert Y", this.s.invertY, (v) => { this.s.invertY = v; });

    const bindsHost = document.createElement("div");
    bindsHost.style.marginTop = "18px";
    const bindsRec = this.s.binds as unknown as Record<string, string>;
    for (const action of Object.keys(bindsRec)) {
      const code = bindsRec[action];
      const row = document.createElement("div");
      row.className = "keyrow";
      row.innerHTML = `<span>${ACTION_NAMES[action] ?? action}</span>`;
      const btn = document.createElement("button");
      btn.className = "keybtn";
      btn.textContent = keyLabel(code);
      btn.addEventListener("click", () => {
        if (this.listeningBind) return;
        this.listeningBind = action;
        btn.classList.add("listening");
        btn.textContent = "PRESS KEY";
        const handler = (e: KeyboardEvent) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.code !== "Escape") {
            bindsRec[action] = e.code;
            btn.textContent = keyLabel(e.code);
          } else {
            btn.textContent = keyLabel(bindsRec[action]);
          }
          btn.classList.remove("listening");
          this.listeningBind = null;
          window.removeEventListener("keydown", handler, true);
          this.cb.onSettingsChanged();
        };
        window.addEventListener("keydown", handler, true);
      });
      row.appendChild(btn);
      bindsHost.appendChild(row);
    }
    tab.appendChild(bindsHost);
  }

  private buildCrosshairTab(): void {
    const tab = $("tab-crosshair");
    tab.innerHTML = "";
    const preview = document.createElement("div");
    preview.className = "xh-preview";
    const pvCanvas = document.createElement("canvas");
    pvCanvas.width = pvCanvas.height = 64;
    pvCanvas.id = "xhair-preview";
    preview.appendChild(pvCanvas);
    tab.appendChild(preview);

    const c = this.s.crosshair;
    this.colorPick(tab, "Color", c.color, (v) => { c.color = v; this.drawXhPreview(); });
    this.slider(tab, "Length", 1, 16, c.size, (v) => { c.size = v; this.drawXhPreview(); });
    this.slider(tab, "Gap", 0, 14, c.gap, (v) => { c.gap = v; this.drawXhPreview(); });
    this.slider(tab, "Thickness", 1, 6, c.thickness, (v) => { c.thickness = v; this.drawXhPreview(); });
    this.check(tab, "Center Dot", c.dot, (v) => { c.dot = v; this.drawXhPreview(); });
    this.check(tab, "Outline", c.outline, (v) => { c.outline = v; this.drawXhPreview(); });
    this.check(tab, "Dynamic Spread", c.dynamic, (v) => { c.dynamic = v; });
    this.drawXhPreview();
  }

  drawXhPreview(): void {
    const cv = document.getElementById("xhair-preview") as HTMLCanvasElement | null;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    const c = this.s.crosshair;
    ctx.clearRect(0, 0, 64, 64);
    const cx = 32;
    ctx.strokeStyle = c.color;
    ctx.lineWidth = c.thickness;
    const gap = c.gap + 3;
    ctx.beginPath();
    ctx.moveTo(cx, cx - gap - c.size); ctx.lineTo(cx, cx - gap);
    ctx.moveTo(cx, cx + gap); ctx.lineTo(cx, cx + gap + c.size);
    ctx.moveTo(cx - gap - c.size, cx); ctx.lineTo(cx - gap, cx);
    ctx.moveTo(cx + gap, cx); ctx.lineTo(cx + gap + c.size, cx);
    ctx.stroke();
    if (c.dot) {
      ctx.fillStyle = c.color;
      ctx.fillRect(cx - c.thickness / 2, cx - c.thickness / 2, c.thickness, c.thickness);
    }
  }

  private buildAudioTab(): void {
    const tab = $("tab-audio");
    tab.innerHTML = "";
    this.slider(tab, "Master Volume", 0, 100, Math.round(this.s.audio.master * 100), (v) => { this.s.audio.master = v / 100; });
    this.slider(tab, "SFX Volume", 0, 100, Math.round(this.s.audio.sfx * 100), (v) => { this.s.audio.sfx = v / 100; });
    this.check(tab, "Show FPS Counter", this.s.showFps, (v) => { this.s.showFps = v; });
  }

  private slider(parent: HTMLElement, label: string, min: number, max: number, value: number, onChange: (v: number) => void, suffix = ""): void {
    const row = document.createElement("div");
    row.className = "setrow";
    row.innerHTML = `<label>${label}</label><input type="range" min="${min}" max="${max}" value="${value}"><span class="val">${value}${suffix}</span>`;
    const input = row.querySelector("input")!;
    const val = row.querySelector(".val")!;
    input.addEventListener("input", () => {
      let v = Number(input.value);
      onChange(v);
      if (suffix === "%") suffix = "";
      val.textContent = String(v) + suffix;
      this.cb.onSettingsChanged();
    });
    parent.appendChild(row);
  }

  private select(parent: HTMLElement, label: string, options: string[], value: number, onChange: (v: number) => void): void {
    const row = document.createElement("div");
    row.className = "setrow";
    row.innerHTML = `<label>${label}</label><select class="setsel"></select>`;
    const sel = row.querySelector("select")!;
    options.forEach((o, i) => {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = o;
      sel.appendChild(opt);
    });
    sel.value = String(value);
    sel.addEventListener("change", () => {
      onChange(Number(sel.value));
      this.cb.onSettingsChanged();
    });
    parent.appendChild(row);
  }

  private check(parent: HTMLElement, label: string, value: boolean, onChange: (v: boolean) => void): void {
    const row = document.createElement("div");
    row.className = "setrow";
    row.innerHTML = `<label>${label}</label><input type="checkbox" ${value ? "checked" : ""}>`;
    const input = row.querySelector("input")!;
    input.addEventListener("change", () => {
      onChange(input.checked);
      this.cb.onSettingsChanged();
    });
    parent.appendChild(row);
  }

  private colorPick(parent: HTMLElement, label: string, value: string, onChange: (v: string) => void): void {
    const row = document.createElement("div");
    row.className = "setrow";
    row.innerHTML = `<label>${label}</label><input type="color" value="${value}" style="width:120px;height:34px;padding:2px">`;
    const input = row.querySelector("input")!;
    input.addEventListener("input", () => {
      onChange(input.value);
      this.cb.onSettingsChanged();
    });
    parent.appendChild(row);
  }
}
