import { RosterEntry } from "../../../shared/src/netcodec.js";
import { AGENTS } from "../../../shared/src/agents.js";

const $ = (id: string): HTMLElement => document.getElementById(id)!;

interface KillFeedEntry {
  el: HTMLDivElement;
  expiresAt: number;
}

export class HUD {
  root: HTMLElement;
  private killfeed: HTMLElement;
  private kfEntries: KillFeedEntry[] = [];
  private lastVals = new Map<string, string>();

  constructor() {
    this.root = $("hud");
    this.killfeed = $("killfeed");
  }

  show(v: boolean): void {
    this.root.classList.toggle("hidden", !v);
  }

  crosshairVisible(v: boolean): void {
    $("crosshair-wrap").classList.toggle("hidden", !v);
  }

  private setText(id: string, text: string): void {
    const prev = this.lastVals.get(id);
    if (prev === text) return;
    this.lastVals.set(id, text);
    $(id).textContent = text;
  }

  updateHealth(hp: number, armor: number): void {
    this.setText("hpnum", String(Math.max(0, Math.ceil(hp))));
    const bar = $("hpbar");
    const pct = Math.max(0, Math.min(100, hp));
    bar.style.width = pct + "%";
    bar.classList.toggle("hurt", pct < 35);
    this.setText("armornum", String(Math.ceil(armor)));
  }

  updateAmmo(mag: number, reserve: number, weaponName: string): void {
    const magEl = $("ammomag");
    const magText = mag < 0 ? "—" : String(mag);
    if (this.lastVals.get("ammomag") !== magText) {
      magEl.textContent = magText;
      this.lastVals.set("ammomag", magText);
      magEl.classList.toggle("empty", mag === 0);
    }
    this.setText("ammoresev", reserve < 0 ? "" : "/ " + reserve);
    this.setText("weaponname", weaponName.toUpperCase());
  }

  updateTimer(timeLeftS: number, phase: number): void {
    const m = Math.floor(timeLeftS / 60);
    const s = Math.floor(timeLeftS % 60);
    const txt = phase >= 3 ? "--" : `${m}:${s.toString().padStart(2, "0")}`;
    this.setText("roundtimer", txt);
    $("roundtimer").classList.toggle("low", timeLeftS < 15 && phase === 2);
  }

  updateScore(scoreA: number, scoreB: number): void {
    this.setText("scoreA", String(scoreA));
    this.setText("scoreB", String(scoreB));
  }

  updateAbilities(qCdFrac: number, eCdFrac: number, agentId: number): void {
    const agent = AGENTS[agentId] ?? AGENTS[0];
    const qEl = $("ab-q");
    const eEl = $("ab-e");
    qEl.querySelector(".ab-name")!.textContent = agent.q.name.toUpperCase();
    eEl.querySelector(".ab-name")!.textContent = agent.e.name.toUpperCase();
    const qc = qEl.querySelector(".ab-cd") as HTMLElement;
    const ec = eEl.querySelector(".ab-cd") as HTMLElement;
    qc.style.transform = `scaleY(${qCdFrac})`;
    ec.style.transform = `scaleY(${eCdFrac})`;
    qEl.classList.toggle("ready", qCdFrac <= 0.001);
    eEl.classList.toggle("ready", eCdFrac <= 0.001);
  }

  addKillFeed(killerName: string, killerTeam: number, victimName: string, victimTeam: number, weaponName: string, head: boolean, myId: number, killerId: number, victimId: number): void {
    const div = document.createElement("div");
    div.className = "kf-entry";
    const kCls = killerTeam === 0 ? "kf-a" : "kf-b";
    const vCls = victimTeam === 0 ? "kf-a" : "kf-b";
    let inner = `<span class="${kCls}">${escapeHtml(killerName)}</span>`;
    inner += `<span class="kf-wpn">${escapeHtml(weaponName)}${head ? ' <span class="kf-head">◎</span>' : ""}</span>`;
    inner += `<span class="${vCls}">${escapeHtml(victimName)}</span>`;
    div.innerHTML = inner;
    if (killerId === myId || victimId === myId) div.style.border = "1px solid rgba(255,176,46,0.5)";
    this.killfeed.appendChild(div);
    this.kfEntries.push({ el: div, expiresAt: performance.now() + 5200 });
    while (this.kfEntries.length > 6) {
      const old = this.kfEntries.shift()!;
      old.el.remove();
    }
  }

  pruneKillFeed(nowMs: number): void {
    for (let i = this.kfEntries.length - 1; i >= 0; i--) {
      if (nowMs > this.kfEntries[i].expiresAt) {
        this.kfEntries[i].el.remove();
        this.kfEntries.splice(i, 1);
      }
    }
  }

  banner(text: string, color: string): void {
    const b = $("phasebanner");
    b.textContent = text;
    b.style.color = color;
    b.classList.add("show");
    window.clearTimeout((b as any)._t);
    (b as any)._t = window.setTimeout(() => b.classList.remove("show"), 2600);
  }

  respawnMsg(text: string | null): void {
    const el = $("respawnmsg");
    if (!text) { el.classList.add("hidden"); return; }
    el.classList.remove("hidden");
    this.setText2(el, text);
  }

  private setText2(el: HTMLElement, text: string): void {
    if (el.textContent !== text) el.textContent = text;
  }

  hitmarker(head: boolean): void {
    const h = $("hitmarker");
    h.classList.remove("show");
    void h.offsetWidth;
    h.classList.toggle("head", head);
    h.classList.add("show");
  }

  damageFlash(): void {
    const d = $("dmgflash") as HTMLElement;
    d.style.opacity = "1";
    window.clearTimeout((d as any)._t);
    (d as any)._t = window.setTimeout(() => { d.style.opacity = "0"; }, 90);
  }

  damageIndicator(attackerYawFromMe: number, myYaw: number): void {
    const wrap = $("damageindicators");
    const rel = attackerYawFromMe - myYaw;
    const div = document.createElement("div");
    div.className = "dmg-ind";
    div.style.transform = `rotate(${-rel * 180 / Math.PI}deg)`;
    wrap.appendChild(div);
    window.setTimeout(() => div.remove(), 750);
  }

  blind(opacity: number): void {
    ($("blindoverlay") as HTMLElement).style.opacity = String(opacity);
  }

  scope(show: boolean): void {
    $("scopeoverlay").classList.toggle("hidden", !show);
  }

  chatLine(name: string, text: string, teamColor: string): void {
    const log = $("chatlog");
    const div = document.createElement("div");
    div.className = "chat-line";
    const span = document.createElement("span");
    span.style.color = teamColor;
    span.textContent = name + ": ";
    div.appendChild(span);
    div.appendChild(document.createTextNode(text));
    log.appendChild(div);
    while (log.children.length > 5) (log.firstChild as HTMLElement).remove();
    window.setTimeout(() => div.remove(), 9000);
  }

  updateTeams(roster: RosterEntry[], myId: number): void {
    const ti = $("teaminfo");
    const mine = roster.filter((r) => r.team === roster.find((r2) => r2.id === myId)?.team && r.id !== myId).slice(0, 4);
    let html = "";
    for (const r of mine) {
      const cls = r.connected ? "ti-row" : "ti-row ti-dead";
      html += `<div class="${cls}" style="color:${r.team === 0 ? "#ffb02e" : "#58c7ff"}">${escapeHtml(r.name)}</div>`;
    }
    if (ti.innerHTML !== html && html !== "") ti.innerHTML = html;
  }

  ping(fps: number, pingMs: number): void {
    this.setText("pingfps", `${fps} FPS · ${pingMs}ms`);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}
