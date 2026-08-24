import * as THREE from "three";
import { Settings } from "../settings.js";
import { InputManager } from "../input.js";
import { NetClient, InterpEnt, WelcomeInfo } from "../net/NetClient.js";
import { GameRenderer } from "../render/GameRenderer.js";
import { buildWorldMeshes } from "../render/world.js";
import { buildSky, buildSiteMarkers } from "../render/sky.js";
import { CharacterView, createCharacter, updateCharacter } from "../render/Characters.js";
import { Effects } from "../render/Effects.js";
import { ViewModel } from "../render/ViewModel.js";
import { Crosshair } from "../render/Crosshair.js";
import { Menus } from "../ui/Menus.js";
import { HUD } from "../ui/HUD.js";
import { AudioEngine } from "../audio/AudioEngine.js";
import { PerfOverlay } from "../perf/PerfOverlay.js";
import { CollisionWorld } from "../../../shared/src/collision.js";
import { moveStep, MoveState, MoveEvents } from "../../../shared/src/movement.js";
import { buildFoundry } from "../../../shared/src/mapdata.js";
import { weaponById, PISTOL_ID, KNIFE_ID } from "../../../shared/src/weapons.js";
import { agentById } from "../../../shared/src/agents.js";
import { raycastEntity } from "../../../shared/src/hitreg.js";
import * as P from "../../../shared/src/protocol.js";
import { SnapshotHeader } from "../../../shared/src/netcodec.js";
import {
  TICK_DT, MOVE_CFG, BTN, PHASE_FREEZE, PHASE_LIVE, PHASE_MATCHEND,
  PHASE_WARMUP, PHASE_ROUNDEND, SNAPSHOT_INTERP_MS, ABILITY,
  STAND_EYE, CROUCH_EYE, STAND_HEIGHT, CROUCH_HEIGHT,
} from "../../../shared/src/config.js";

export interface GameDeps {
  settings: Settings;
  renderer: GameRenderer;
  input: InputManager;
  net: NetClient;
  audio: AudioEngine;
  hud: HUD;
  perf: PerfOverlay;
  menus: Menus;
  addr: string;
  name: string;
  mode: number;
  bots: number;
  diff: number;
  onSettingsChanged(): void;
}

export class Game {
  private d: GameDeps;
  world = new CollisionWorld();
  map = buildFoundry();
  state: "connecting" | "loading" | "playing" | "left" = "connecting";

  private pred: MoveState = { x: 0, y: 2, z: 0, vx: 0, vy: 0, vz: 0, onGround: false, crouching: false, height: 1.8 };
  private myYaw = 0;
  private myPitch = 0;
  private inputSeq = 1;
  private pendingInputs: { seq: number; btn: number; yaw: number; pitch: number; slot: number }[] = [];
  private lastSentSlot = 1;

  private header: SnapshotHeader = { tick: 0, ackSeq: 0, timeLeftDs: 0, phase: 0, scoreA: 0, scoreB: 0, roundNum: 0, myMag: 12, myReserve: 36 };
  private interpMap = new Map<number, InterpEnt>();
  private charViews = new Map<number, CharacterView>();

  private accumulator = 0;
  private lastFrameTime = 0;
  private running = true;

  private adsAmount = 0;
  private bloomLocal = 0;
  private lastFireAt = 0;
  private burstIdx = 0;
  private lastShotTime = -9;
  private blindUntilMs = 0;
  private blindMaxOp = 0;
  private deathAtS = -1;

  private myAgent = 0;
  private qCdEnd = 0;
  private eCdEnd = 0;
  private qCdTotal = 28;
  private eCdTotal = 22;
  private loadoutPrimary = 2;
  private landBob = 0;
  private rosterCache: import("../../../shared/src/netcodec.js").RosterEntry[] = [];
  private nameById = new Map<number, { name: string; team: number; id: number }>();
  private worldGroup: THREE.Group = new THREE.Group();
  private effects!: Effects;
  private viewModel!: ViewModel;
  private crosshair!: Crosshair;
  private scoreboardOpen = false;

  constructor(deps: GameDeps) {
    this.d = deps;
    for (const b of this.map.boxes) {
      this.world.addBox(b.x - b.sx / 2, b.y - b.sy / 2, b.z - b.sz / 2, b.x + b.sx / 2, b.y + b.sy / 2, b.z + b.sz / 2);
    }
    this.world.build();
    this.wireNet();
  }

  beginConnect(): void {
    const net = this.d.net;
    net.joinedName = this.d.name;
    net.prefMode = this.d.mode;
    net.prefPrimary = this.loadoutPrimary;
    net.prefAgent = this.myAgent;
    net.onWelcome = (_w: WelcomeInfo) => {
      this.state = "loading";
      this.asyncLoad();
    };
    net.onKick = (reason) => {
      this.d.menus.swap("mainmenu");
      this.state = "left";
      alert(reason);
    };
    net.connect(`ws://${this.d.addr}/ws`);
  }

  sendLoadout(primary: number, agent: number): void {
    this.loadoutPrimary = primary;
    this.d.net.sendAction(P.ACT_SELECT_PRIMARY, primary);
    if (!this.aliveLocal()) this.d.net.sendAction(P.ACT_SELECT_AGENT, agent);
  }

  leaveMatch(): void {
    this.d.net.sendLeave();
    this.running = false;
    this.d.net.close();
    document.exitPointerLock();
  }

  disposeScene(): void {
    this.running = false;
    const scene = this.d.renderer.scene;
    while (scene.children.length > 0) {
      const c = scene.children[0];
      scene.remove(c);
    }
    this.charViews.clear();
  }

  private aliveLocal(): boolean {
    const me = this.interpMap.get(this.d.net.myId);
    return !!me && (me.flags & P.ENT_ALIVE) !== 0;
  }

  private asyncLoad(): void {
    const menus = this.d.menus;
    const steps: [string, () => void][] = [
      ["generating texture atlas...", () => { this.worldGroup = buildWorldMeshes(this.map); }],
      ["building sky and lighting...", () => {
        this.worldGroup.add(buildSky());
        this.worldGroup.add(buildSiteMarkers(this.map));
        this.d.renderer.scene.add(this.worldGroup);
        this.d.renderer.setWorldShadows(this.worldGroup);
        this.effects = new Effects(this.d.renderer.scene, this.d.settings.graphics.effects);
        this.viewModel = new ViewModel(this.d.renderer.camera, this.d.settings.graphics.effects);
        this.crosshair = new Crosshair(this.d.settings.crosshair);
      }],
      ["compiling shaders...", () => {
        this.d.renderer.applySettings();
        this.d.renderer.render();
      }],
    ];
    let i = 0;
    const step = (): void => {
      if (i < steps.length) {
        menus.setLoadProgress(i / steps.length, steps[i][0]);
        requestAnimationFrame(() => { steps[i][1](); i++; step(); });
      } else {
        menus.setLoadProgress(1, "deploying...");
        this.wireInput();
        this.viewModel.setWeapon(this.slotWeaponId(1));
        setTimeout(() => this.enterMatch(), 250);
      }
    };
    step();
  }

  private enterMatch(): void {
    this.state = "playing";
    this.d.menus.hideMenus();
    this.d.hud.show(true);
    const canvas = document.querySelector("#gl") as HTMLCanvasElement;
    try {
      const r = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (r && typeof r.catch === "function") r.catch(() => undefined);
    } catch {
      void 0;
    }
    this.lastFrameTime = performance.now();
    requestAnimationFrame(() => this.frame());
  }

  private wireNet(): void {
    const net = this.d.net;
    net.onConnectedFirstTime = () => {
      this.header.phase = -1;
    };
    net.onEvent = (ev) => this.handleEvent(ev);
    net.onRoster = (roster) => {
      this.rosterCache = roster;
      for (const r of roster) {
        this.nameById.set(r.id, { name: r.name, team: r.team, id: r.id });
      }
      this.d.hud.updateTeams(roster, net.myId);
      this.updateScoreboard(roster);
    };
    net.onChat = (pid, text) => {
      const info = this.nameById.get(pid);
      this.d.hud.chatLine(info?.name ?? "???", text, info && info.team === 0 ? "#ffb02e" : "#58c7ff");
    };
    net.onDisconnect = () => {
      if (this.state === "playing" || this.state === "loading") {
        this.d.menus.showPause();
        this.d.hud.show(false);
        this.state = "left";
      }
    };
  }

  private lastAppliedSnapTick = -1;
  private prevAliveLocal = false;
  private viewErrX = 0;
  private viewErrY = 0;
  private viewErrZ = 0;

  private reconcile(): void {
    const net = this.d.net;
    const buf = net.snapBuffer;
    if (buf.length === 0) return;
    const latest = buf[buf.length - 1];
    if (latest.tick === this.lastAppliedSnapTick) return;
    this.lastAppliedSnapTick = latest.tick;
    const header = latest.header;
    const prevHeader = this.header;
    this.header = header;

    if (prevHeader.phase !== header.phase) this.onPhaseChange(header.phase, prevHeader.phase);

    const me = latest.ents.get(net.myId);
    if (!me) return;
    if ((me.flags & P.ENT_ALIVE) !== 0) {
      if (!this.prevAliveLocal) this.magEst = header.myMag;
      this.prevAliveLocal = true;
      this.deathAtS = -1;
      const bx = this.pred.x, by = this.pred.y, bz = this.pred.z;
      this.pred.x = me.x; this.pred.y = me.y; this.pred.z = me.z;
      this.pred.vx = me.vx; this.pred.vy = me.vy; this.pred.vz = me.vz;
      this.pred.crouching = (me.flags & P.ENT_CROUCH) !== 0;
      this.pred.height = this.pred.crouching ? CROUCH_HEIGHT : STAND_HEIGHT;
      let i = 0;
      while (i < this.pendingInputs.length && this.pendingInputs[i].seq <= header.ackSeq) i++;
      this.pendingInputs.splice(0, i);
      for (const inp of this.pendingInputs) {
        moveStep(this.pred, inp.btn, inp.yaw, TICK_DT, this.world, this.replayEv, 1);
      }
      while (this.pendingInputs.length > 90) this.pendingInputs.shift();
      const ex = this.pred.x - bx, ey = this.pred.y - by, ez = this.pred.z - bz;
      if (ex * ex + ey * ey + ez * ez > 5.29 || !this.aliveLocal()) {
        this.viewErrX = 0; this.viewErrY = 0; this.viewErrZ = 0;
      } else {
        this.viewErrX -= ex; this.viewErrY -= ey; this.viewErrZ -= ez;
        const lim = 0.6;
        const l = Math.hypot(this.viewErrX, this.viewErrY, this.viewErrZ);
        if (l > lim) { const k = lim / l; this.viewErrX *= k; this.viewErrY *= k; this.viewErrZ *= k; }
      }
    } else {
      this.viewErrX = 0; this.viewErrY = 0; this.viewErrZ = 0;
      if (this.deathAtS < 0) {
        this.deathAtS = performance.now() / 1000;
        this.d.audio.damageTaken();
      }
    }
  }

  private decayViewError(dtMs: number): void {
    if (this.viewErrX === 0 && this.viewErrY === 0 && this.viewErrZ === 0) return;
    const k = Math.exp(-dtMs / 1000 * 14);
    this.viewErrX *= k; this.viewErrY *= k; this.viewErrZ *= k;
    if (Math.abs(this.viewErrX) + Math.abs(this.viewErrY) + Math.abs(this.viewErrZ) < 0.0015) {
      this.viewErrX = 0; this.viewErrY = 0; this.viewErrZ = 0;
    }
  }

  private onPhaseChange(phase: number, prev: number): void {
    const hud = this.d.hud;
    const menus = this.d.menus;
    if (phase === PHASE_WARMUP) hud.banner("WARMUP", "#9fb4c8");
    if (phase === PHASE_FREEZE) {
      menus.showLoadout(this.loadoutPrimary, this.myAgent);
      hud.banner("ROUND " + this.header.roundNum, "#ffd166");
    }
    if (phase === PHASE_LIVE && prev === PHASE_FREEZE) {
      menus.hideLoadout();
      hud.banner("GO GO GO", "#5cff8a");
      this.d.audio.roundStinger(true);
    }
    if (phase === PHASE_ROUNDEND) this.d.audio.roundStinger(false);
    if (phase === PHASE_MATCHEND) {
      const myScore = this.d.net.myTeam === 0 ? this.header.scoreA : this.header.scoreB;
      const theirScore = this.d.net.myTeam === 0 ? this.header.scoreB : this.header.scoreA;
      document.exitPointerLock();
      menus.showEnd(myScore > theirScore ? "VICTORY" : myScore < theirScore ? "DEFEAT" : "DRAW",
        `${this.header.scoreA} — ${this.header.scoreB}`);
    }
  }

  private handleEvent(ev: any): void {
    const hud = this.d.hud;
    const fx = this.effects;
    const audio = this.d.audio;
    switch (ev.kind) {
      case P.EV_SHOT: {
        if (ev.pid === this.d.net.myId) break;
        const w = weaponById(ev.weapon);
        const cp = Math.cos(ev.pitch);
        const dx = -Math.sin(ev.yaw) * cp, dy = Math.sin(ev.pitch), dz = -Math.cos(ev.yaw) * cp;
        const hit = this.world.raycast(ev.ox, ev.oy, ev.oz, dx, dy, dz, w.rangeFar);
        const end = hit ? hit.t : w.rangeFar;
        const ex = ev.ox + dx * end, ey = ev.oy + dy * end, ez = ev.oz + dz * end;
        fx.addTracer(ev.ox, ev.oy, ev.oz, ex, ey, ez);
        audio.weaponSoundById(ev.weapon, ev.ox, ev.oz);
        if (hit) {
          fx.bulletImpact(ex, ey, ez, hitAxis(hit.nx, hit.ny, hit.nz), hitSign(hit.nx, hit.ny, hit.nz));
          fx.addDecal(ex, ey, ez, hit.nx, hit.ny, hit.nz);
        }
        break;
      }
      case P.EV_IMPACT:
        fx.bulletImpact(ev.x, ev.y, ev.z, ev.nAxis, ev.nSign);
        fx.addDecal(ev.x, ev.y, ev.z, axisN(ev.nAxis, 0) * ev.nSign, axisN(ev.nAxis, 1) * ev.nSign, axisN(ev.nAxis, 2) * ev.nSign);
        fx.spawnSmokePuff(ev.x, ev.y, ev.z, 0.5, 0.3);
        break;
      case P.EV_HITCONFIRM:
        hud.hitmarker(ev.head);
        audio.hit(ev.head);
        break;
      case P.EV_DAMAGED: {
        hud.damageFlash();
        hud.damageIndicator(ev.dirYaw, this.myYaw);
        audio.damageTaken();
        break;
      }
      case P.EV_KILL: {
        const ki = this.nameById.get(ev.killer);
        const vi = this.nameById.get(ev.victim);
        this.d.hud.addKillFeed(
          ki?.name ?? "???", ki?.team ?? 0,
          vi?.name ?? "???", vi?.team ?? 0,
          weaponById(ev.weapon).name, ev.head,
          this.d.net.myId, ev.killer, ev.victim
        );
        if (ev.killer === this.d.net.myId && ev.victim !== this.d.net.myId) this.d.audio.hit(false);
        break;
      }
      case P.EV_FOOTSTEP:
        if (ev.pid !== this.d.net.myId) this.d.audio.footstep(ev.x, ev.z, ev.loud > 0);
        break;
      case P.EV_RELOAD:
        if (ev.pid === this.d.net.myId) this.viewModel.startReload(ev.durMs / 1000);
        break;
      case P.EV_ABILITY:
        this.handleAbilityEvent(ev);
        break;
      case P.EV_BLINDED: {
        const dur = ev.durDs / 10;
        this.blindUntilMs = performance.now() + dur * 1000;
        this.blindMaxOp = Math.min(1, 0.35 + dur / 4);
        break;
      }
      case P.EV_BANNER:
        this.handleBanner(ev.bannerKind, ev.arg);
        break;
    }
  }

  private handleAbilityEvent(ev: any): void {
    const fx = this.effects;
    const audio = this.d.audio;
    const isMine = ev.pid === this.d.net.myId;
    switch (ev.abk) {
      case P.ABK_SCAN:
        fx.spawnSmokePuff(ev.ax, ev.ay + 1, ev.az, 2.4, 0.8);
        audio.abilityCast();
        break;
      case P.ABK_SILENT:
        fx.spawnSmokePuff(ev.ax, ev.ay + 1, ev.az, 1.6, 0.6);
        audio.abilityCast();
        break;
      case P.ABK_WALL:
        this.spawnWallMesh(ev.pid, ev.ax, ev.ay, ev.az, ev.arg === 0);
        for (let i = 0; i < 4; i++) fx.spawnSmokePuff(ev.ax, ev.ay + i * 0.7, ev.az, 1.2, 0.5 + i * 0.1);
        audio.abilityCast();
        break;
      case P.ABK_WALLDOWN:
        this.removeWallMesh(ev.pid);
        break;
      case P.ABK_FORTIFY:
        audio.abilityCast();
        break;
      case P.ABK_DASH:
        audio.abilityCast();
        break;
      case P.ABK_UPDRAFT:
        fx.spawnSmokePuff(ev.ax, ev.ay, ev.az, 1.8, 0.7);
        audio.abilityCast();
        break;
      case P.ABK_FIELD:
        this.addFieldZone(ev.pid, ev.ax, ev.ay, ev.az);
        audio.abilityCast();
        break;
      case P.ABK_FLARE:
        fx.spawnSmokePuff(ev.ax, ev.ay + 6, ev.az, 2.2, 1.1);
        audio.abilityCast();
        break;
    }
  }

  private handleBanner(kind: number, arg: number): void {
    const hud = this.d.hud;
    const myTeam = this.d.net.myTeam;
    switch (kind) {
      case P.BANNER_ROUND_WIN_A:
        hud.banner(arg === 1 ? "ATTACKERS WIN" : "DEFENDERS WIN", "#ffd166");
        this.d.audio.roundStinger(myTeam === 0);
        break;
      case P.BANNER_ROUND_WIN_B:
        hud.banner(arg === 1 ? "ATTACKERS WIN" : "DEFENDERS WIN", "#ffd166");
        this.d.audio.roundStinger(myTeam === 1);
        break;
      case P.BANNER_DRAW:
        hud.banner("ROUND DRAW", "#9fb4c8");
        this.d.audio.roundStinger(false);
        break;
      case P.BANNER_MATCH_POINT:
        hud.banner("MATCH POINT", "#ff5c5c");
        break;
      case P.BANNER_HALF_SWAP:
        hud.banner("SWAPPING SIDES", "#9fb4c8");
        break;
    }
  }

  private walls = new Map<number, THREE.Mesh>();
  private fieldZones = new Map<number, { mesh: THREE.Mesh; until: number }>();

  private spawnWallMesh(pid: number, x: number, y: number, z: number, alongX: boolean): void {
    this.removeWallMesh(pid);
    const geo = new THREE.BoxGeometry(alongX ? ABILITY.WALL_W : 0.36, ABILITY.WALL_H, alongX ? 0.36 : ABILITY.WALL_W);
    const mat = new THREE.MeshLambertMaterial({ color: 0x3a5f7d, emissive: 0x14222e, transparent: true, opacity: 0.92 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y + ABILITY.WALL_H / 2, z);
    mesh.castShadow = false;
    this.d.renderer.scene.add(mesh);
    this.walls.set(pid, mesh);
  }

  private removeWallMesh(pid: number): void {
    const m = this.walls.get(pid);
    if (!m) return;
    this.d.renderer.scene.remove(m);
    m.geometry.dispose();
    (m.material as THREE.Material).dispose();
    this.walls.delete(pid);
  }

  private addFieldZone(pid: number, x: number, y: number, z: number): void {
    const old = this.fieldZones.get(pid);
    if (old) { this.d.renderer.scene.remove(old.mesh); }
    const geo = new THREE.CircleGeometry(ABILITY.FIELD_R, 28);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0x46e08a, transparent: true, opacity: 0.16, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y + 0.06, z);
    this.d.renderer.scene.add(mesh);
    this.fieldZones.set(pid, { mesh, until: performance.now() + ABILITY.FIELD_DUR_S * 1000 });
  }

  private updateAbilityVisuals(): void {
    const now = performance.now();
    for (const [pid, z] of this.fieldZones) {
      const left = z.until - now;
      if (left <= 0) {
        this.d.renderer.scene.remove(z.mesh);
        z.mesh.geometry.dispose();
        (z.mesh.material as THREE.Material).dispose();
        this.fieldZones.delete(pid);
        continue;
      }
      (z.mesh.material as THREE.MeshBasicMaterial).opacity = 0.10 + 0.07 * Math.sin(now / 180);
    }
  }

  updateScoreboard(roster: import("../../../shared/src/netcodec.js").RosterEntry[]): void {
    const rows = [...roster].sort((a, b) => a.team - b.team || b.kills - a.kills);
    let html = "";
    let lastTeam = -1;
    for (const r of rows) {
      if (r.team !== lastTeam) {
        lastTeam = r.team;
        html += `<tr class="sb-team"><td colspan="5" style="color:${r.team === 0 ? "#ffb02e" : "#58c7ff"}">${r.team === 0 ? "TEAM A" : "TEAM B"}</td></tr>`;
      }
      const me = r.id === this.d.net.myId ? " me" : "";
      html += `<tr class="sb-row${me}"><td>${escapeHtml(r.name)}</td><td>${agentShort(r.agent)}</td><td>${r.kills}</td><td>${r.deaths}</td><td>${r.connected ? r.pingMs : "-"}</td></tr>`;
    }
    const el = document.getElementById("sb-table");
    if (el) el.innerHTML = html;
  }

  private mySlot = 1;
  private magEst = 12;
  private moveEv: MoveEvents = { landedHard: false, jumped: false, walkedDist: 0, stepUp: false };
  private replayEv: MoveEvents = { landedHard: false, jumped: false, walkedDist: 0, stepUp: false };
  private nextFireS = 0;
  private fireConsumed = false;
  private reloadWasDown = false;
  private reloadingUntilS = 0;
  private recoilIdx = 0;
  private lastStepSoundS = 0;

  slotWeaponId(slot: number): number {
    return slot === 1 ? this.loadoutPrimary : slot === 2 ? PISTOL_ID : KNIFE_ID;
  }

  private wireInput(): void {
    this.d.input.onAction = (a) => {
      if (this.state !== "playing") return;
      if (a === "slot1" || a === "slot2" || a === "slot3") {
        const n = a === "slot1" ? 1 : a === "slot2" ? 2 : 3;
        if (n !== this.mySlot) {
          this.mySlot = n;
          this.reloadingUntilS = 0;
          this.magEst = this.header.myMag;
          this.viewModel.setWeapon(this.slotWeaponId(n));
          this.d.audio.reloadClick(true);
          this.d.net.sendAction(P.ACT_SLOT, n);
        }
      } else if (a === "abilityQ" || a === "abilityE") {
        this.d.net.sendAction(a === "abilityQ" ? P.ACT_ABILITY_Q : P.ACT_ABILITY_E, 0);
        const agent = agentById(this.myAgent);
        const cd = (a === "abilityQ" ? agent.q.cd : agent.e.cd) * 1000;
        if (a === "abilityQ") { this.qCdEnd = performance.now() + cd; this.qCdTotal = cd; }
        else { this.eCdEnd = performance.now() + cd; this.eCdTotal = cd; }
      }
    };
    window.addEventListener("keydown", (e) => {
      if (this.state !== "playing") return;
      if (e.code === this.d.settings.binds.scoreboard && !this.scoreboardOpen) {
        this.scoreboardOpen = true;
        document.getElementById("scoreboard")?.classList.remove("hidden");
      }
      if (e.code === this.d.settings.binds.chat && !this.d.input.chatOpen) {
        e.preventDefault();
        this.openChat();
      }
      if (e.code === this.d.settings.binds.quickchat1 && !this.d.input.chatOpen) this.d.net.sendChat("Enemy spotted!");
      if (e.code === this.d.settings.binds.quickchat2 && !this.d.input.chatOpen) this.d.net.sendChat("Need backup!");
    });
    window.addEventListener("keyup", (e) => {
      if (e.code === this.d.settings.binds.scoreboard && this.scoreboardOpen) {
        this.scoreboardOpen = false;
        document.getElementById("scoreboard")?.classList.add("hidden");
      }
    });
    document.addEventListener("pointerlockchange", () => {
      if (this.state !== "playing") return;
      if (this.d.input.locked) {
        if (!this.d.input.chatOpen) this.d.menus.hideMenus();
      } else if (!this.d.input.chatOpen) {
        this.d.menus.showPause();
      }
    });
    const glCanvas = document.querySelector("#gl") as HTMLCanvasElement;
    glCanvas.addEventListener("pointerdown", () => {
      if (this.state !== "playing" || this.d.input.locked || this.d.input.chatOpen) return;
      try {
        const r = glCanvas.requestPointerLock() as unknown as Promise<void> | undefined;
        if (r && typeof r.catch === "function") r.catch(() => undefined);
      } catch {
        void 0;
      }
    });
  }

  private openChat(): void {
    const inp = document.getElementById("chatinput") as HTMLInputElement | null;
    if (!inp) return;
    this.d.input.chatOpen = true;
    document.exitPointerLock();
    inp.classList.add("open");
    inp.value = "";
    setTimeout(() => inp.focus(), 30);
    const submit = (): void => {
      const text = inp.value.trim().slice(0, 90);
      inp.classList.remove("open");
      inp.blur();
      this.d.input.chatOpen = false;
      inp.removeEventListener("keydown", onKey);
      inp.removeEventListener("blur", submit);
      if (text) {
        this.d.net.sendChat(text);
        this.d.hud.chatLine(this.d.name, text, "#e8f0f8");
      }
      document.getElementById("gl")?.requestPointerLock();
    };
    const onKey = (ev: KeyboardEvent): void => {
      ev.stopPropagation();
      if (ev.code === "Enter") submit();
      else if (ev.code === "Escape") { inp.value = ""; submit(); }
    };
    inp.addEventListener("keydown", onKey);
    inp.addEventListener("blur", () => { if (this.d.input.chatOpen) submit(); });
  }

  private tickOnce(nowMs: number): void {
    const input = this.d.input;
    const nowS = nowMs / 1000;
    const btn = input.btnFromBinds();

    const reloadDown = input.isDown("reload");
    if (reloadDown && !this.reloadWasDown) {
      this.d.net.sendAction(P.ACT_RELOAD, 0);
      const w = weaponById(this.slotWeaponId(this.mySlot));
      if (!w.melee) {
        this.viewModel.startReload(w.reloadTime);
        this.reloadingUntilS = nowS + w.reloadTime;
        this.d.audio.reloadClick(false);
      }
    }
    this.reloadWasDown = reloadDown;

    this.inputSeq = (this.inputSeq + 1) & 0xffff;
    const inpRec = { seq: this.inputSeq & 0xffff, btn, yaw: this.myYaw, pitch: this.myPitch, slot: this.mySlot };
    this.pendingInputs.push(inpRec);
    this.d.net.sendInput(inpRec.seq, btn, this.myYaw, this.myPitch, this.mySlot);
    moveStep(this.pred, btn, this.myYaw, TICK_DT, this.world, this.moveEv, 1);
    if (this.pred.y < MOVE_CFG.killY) {
      const sp = this.map.spawnsA[0];
      this.pred.x = sp[0]; this.pred.y = sp[1] + 0.05; this.pred.z = sp[2];
      this.pred.vx = 0; this.pred.vy = 0; this.pred.vz = 0;
      this.accumulator = 0;
    }

    const w = weaponById(this.slotWeaponId(this.mySlot));
    this.bloomLocal = Math.max(0, this.bloomLocal - w.bloomDecay * TICK_DT);

    const alive = this.aliveLocal();
    if (alive && this.header.phase === PHASE_LIVE) this.predictFire(w, nowMs, btn);

    if (!this.pred.onGround && this.pred.vy < -9) this.landBob = Math.min(0.14, -this.pred.vy * 0.009);
    else this.landBob *= 0.82;

    const speed = Math.hypot(this.pred.vx, this.pred.vz);
    if (alive && this.pred.onGround && speed > 2.4 && (btn & BTN.WALK) === 0 && nowS - this.lastStepSoundS > 0.38) {
      this.lastStepSoundS = nowS;
      this.d.audio.footstep(this.pred.x, this.pred.z, true);
    }
  }

  private predictFire(w: ReturnType<typeof weaponById>, nowMs: number, _btn: number): void {
    const nowS = nowMs / 1000;
    const wantFire = w.auto ? this.d.input.fireHeld : (this.d.input.fireHeld && !this.fireConsumed);
    if (!wantFire || nowS < this.nextFireS || nowS < this.reloadingUntilS || this.magEst <= 0) return;
    if (!w.auto) this.fireConsumed = true;
    this.nextFireS = nowS + 60 / w.rpm;
    this.lastShotTime = nowS;
    this.magEst = Math.max(0, this.magEst - 1);

    const moving = Math.hypot(this.pred.vx, this.pred.vz);
    let spreadDeg = this.d.input.adsHeld ? w.spreadAds : w.spreadHip;
    spreadDeg += (moving / MOVE_CFG.baseSpeed) * w.spreadMove * 0.5;
    if (!this.pred.onGround) spreadDeg += w.spreadJump;
    spreadDeg += this.bloomLocal;
    this.bloomLocal = Math.min(w.bloomMax, this.bloomLocal + w.bloomPerShot);

    const camPos = this.d.renderer.camera.position;
    const yaw = this.myYaw, pitch = this.myPitch;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const baseDx = -Math.sin(yaw) * cp, baseDy = sp, baseDz = -Math.cos(yaw) * cp;
    const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
    const upX = -sp * -Math.sin(yaw), upY = cp, upZ = -sp * -Math.cos(yaw);
    const spreadRad = (spreadDeg * Math.PI) / 180;

    for (let p = 0; p < w.pellets; p++) {
      const r1 = (Math.random() + Math.random() - 1) * spreadRad;
      const r2 = (Math.random() + Math.random() - 1) * spreadRad;
      const dx = baseDx + rightX * r1 + upX * r2;
      const dy = baseDy + upY * r2;
      const dz = baseDz + rightZ * r1 + upZ * r2;
      const len = Math.hypot(dx, dy, dz) || 1;
      const ndx = dx / len, ndy = dy / len, ndz = dz / len;

      const wh = this.world.raycast(camPos.x, camPos.y, camPos.z, ndx, ndy, ndz, w.rangeFar);
      let bestT = wh ? wh.t : w.rangeFar;
      let hitEnt: InterpEnt | null = null;
      let headshot = false;
      for (const [id, e] of this.interpMap) {
        if (id === this.d.net.myId || (e.flags & P.ENT_ALIVE) === 0) continue;
        const info = this.nameById.get(id);
        if (info && info.team === this.d.net.myTeam) continue;
        const crouching = (e.flags & P.ENT_CROUCH) !== 0;
        const res = raycastEntity(
          camPos.x, camPos.y, camPos.z, ndx, ndy, ndz,
          bestT,
          { x: e.x, y: e.y, z: e.z, height: crouching ? CROUCH_HEIGHT : STAND_HEIGHT, crouching }
        );
        if (res && res.t < bestT) {
          bestT = res.t;
          hitEnt = e;
          headshot = res.headshot;
        }
      }

      const ex = camPos.x + ndx * bestT, ey = camPos.y + ndy * bestT, ez = camPos.z + ndz * bestT;
      if (!w.melee) this.effects.addTracer(camPos.x, camPos.y, camPos.z, ex, ey, ez);
      if (hitEnt) {
        this.effects.spawnSmokePuff(ex, ey, ez, 0.35, 0.25);
      } else if (wh) {
        this.effects.bulletImpact(ex, ey, ez, hitAxis(wh.nx, wh.ny, wh.nz), hitSign(wh.nx, wh.ny, wh.nz));
        this.effects.addDecal(ex, ey, ez, wh.nx, wh.ny, wh.nz);
      }
    }

    if (!w.melee) this.d.audio.gunshot(w);
    this.viewModel.triggerShot(1 + this.bloomLocal * 0.3);
    const kickP = (w.recoilPitch[this.recoilIdx % w.recoilPitch.length] ?? 0.6) * 0.0075;
    const kickY = (w.recoilYaw[this.recoilIdx % w.recoilYaw.length] ?? 0) * 0.0075;
    this.recoilIdx++;
    this.myPitch += kickP;
    this.myYaw += kickY;
  }

  private updateCharacters(dt: number, nowS: number): void {
    const seen = new Set<number>();
    for (const [id, e] of this.interpMap) {
      if (id === this.d.net.myId) continue;
      seen.add(id);
      let cv = this.charViews.get(id);
      if (!cv) {
        const info = this.nameById.get(id);
        if (!info) continue;
        cv = createCharacter(info.team);
        cv.nameText = info.name;
        this.d.renderer.scene.add(cv.parts.group);
        this.charViews.set(id, cv);
      }
      const alive = (e.flags & P.ENT_ALIVE) !== 0;
      const crouch = (e.flags & P.ENT_CROUCH) !== 0;
      const speed01 = Math.min(1, Math.hypot(e.vx, e.vz) / MOVE_CFG.baseSpeed);
      updateCharacter(cv, e.x, e.y, e.z, e.yaw, e.pitch, speed01, crouch, alive, dt, nowS);
    }
    for (const [id, cv] of this.charViews) {
      if (!seen.has(id)) {
        this.d.renderer.scene.remove(cv.parts.group);
        this.charViews.delete(id);
      }
    }
  }

  private updateCameraAndVm(dtMs: number): void {
    const cam = this.d.renderer.camera;
    const eye = this.pred.crouching ? CROUCH_EYE : STAND_EYE;
    cam.position.set(
      this.pred.x + this.viewErrX,
      this.pred.y + this.viewErrY + eye - this.landBob * 0.4,
      this.pred.z + this.viewErrZ
    );
    cam.rotation.order = "YXZ";
    cam.rotation.y = this.myYaw;
    cam.rotation.x = Math.max(-1.5533, Math.min(1.5533, this.myPitch));

    const w = weaponById(this.slotWeaponId(this.mySlot));
    const adsWant = this.d.input.adsHeld && this.aliveLocal() && !w.melee;
    const adsSpeed = dtMs / 1000 / Math.max(0.08, w.adsTime);
    this.adsAmount += ((adsWant ? 1 : 0) - this.adsAmount) * Math.min(1, adsSpeed * 2.2);
    const targetFov = this.d.settings.graphics.fov + (w.adsFov - this.d.settings.graphics.fov) * this.adsAmount;
    if (Math.abs(cam.fov - targetFov) > 0.05) {
      cam.fov = targetFov;
      cam.updateProjectionMatrix();
    }
    const scoped = w.zoomScope && this.adsAmount > 0.82;
    this.d.hud.scope(scoped);

    const m = this.d.input.pollMouse();
    const sens = this.d.settings.sensitivity * (this.d.input.adsHeld ? this.d.settings.adsSensMult : 1);
    if (this.state === "playing" && this.aliveLocal()) {
      this.myYaw -= m.dx * sens;
      const dy = m.dy * sens * (this.d.settings.invertY ? 1 : -1);
      this.myPitch = Math.max(-1.5533, Math.min(1.5533, this.myPitch + dy));
    }

    const moving = Math.hypot(this.pred.vx, this.pred.vz);
    const sprinting = this.pred.onGround && moving > MOVE_CFG.baseSpeed * 1.05 && (this.lastBtn & BTN.WALK) === 0;
    this.viewModel.update(
      dtMs / 1000,
      Math.min(1, moving / MOVE_CFG.baseSpeed),
      this.pred.onGround,
      adsWant,
      this.adsAmount,
      m.dx, m.dy,
      sprinting
    );
    this.lastMouseDX = m.dx; this.lastMouseDY = m.dy;
  }

  private lastBtn = 0;
  private lastMouseDX = 0;
  private lastMouseDY = 0;

  private updateHud(nowMs: number): void {
    const hud = this.d.hud;
    const header = this.header;
    hud.updateTimer(header.timeLeftDs / 10, header.phase);
    hud.updateScore(header.scoreA, header.scoreB);

    const me = this.interpMap.get(this.d.net.myId);
    if (me) {
      hud.updateHealth(me.hp, me.armor);
    }
    const w = weaponById(this.slotWeaponId(this.mySlot));
    hud.updateAmmo(w.melee ? -1 : this.magEst, w.melee ? -1 : header.myReserve, w.name);

    const now = performance.now();
    const qLeft = Math.max(0, this.qCdEnd - now);
    const eLeft = Math.max(0, this.eCdEnd - now);
    hud.updateAbilities(qLeft / this.qCdTotal, eLeft / this.eCdTotal, this.myAgent);

    const alive = this.aliveLocal();
    if (!alive) {
      if (header.phase === PHASE_LIVE) {
        hud.respawnMsg("ELIMINATED");
      } else {
        hud.respawnMsg(null);
      }
    } else {
      hud.respawnMsg(null);
    }

    const blindLeft = (this.blindUntilMs - now) / 1000;
    hud.blind(blindLeft > 0 ? Math.min(1, blindLeft * 2) * this.blindMaxOp : 0);

    const spreadBase = w.melee ? 0 : (this.d.input.adsHeld ? w.spreadAds : w.spreadHip) + this.bloomLocal;
    this.crosshair.spread01 = Math.min(1, spreadBase / 6);
    this.crosshair.draw();
    hud.crosshairVisible(alive && !(w.zoomScope && this.adsAmount > 0.82));

    if (now - this.lastPerfUpdate > 250) {
      this.lastPerfUpdate = now;
      hud.ping(Math.round(this.fpsEstimate), this.d.net.pingMs);
      if (this.perfVisible()) {
        const info = this.d.renderer.renderer.info;
        this.d.perf.setStats(
          `${this.fpsEstimate.toFixed(0)} fps\n` +
          `frame ${this.d.perf.avgFrameMs.toFixed(2)} ms\n` +
          `cpu ${this.cpuMs.toFixed(2)} ms\n` +
          `ping ${this.d.net.pingMs} ms\n` +
          `loss ${(this.d.net.packetLoss() * 100).toFixed(0)}%\n` +
          `draws ${info.render.calls}\n` +
          `tris ${(info.render.triangles / 1000).toFixed(1)}k`
        );
        this.d.perf.drawGraph();
      }
    }
  }

  private lastPerfUpdate = 0;
  private fpsSmoothed = 60;
  perfVisible(): boolean { return this.d.perf.visible; }
  get fpsEstimate(): number { return this.fpsSmoothed; }

  private frame = (): void => {
    if (!this.running) return;
    requestAnimationFrame(() => this.frame());
    const nowMs = performance.now();
    let dtMs = nowMs - this.lastFrameTime;
    this.lastFrameTime = nowMs;
    if (dtMs <= 0 || dtMs > 500) dtMs = 16.7;
    this.d.perf.pushFrameTime(dtMs);
    this.fpsSmoothed += (1000 / dtMs - this.fpsSmoothed) * 0.05;

    const limit = this.d.settings.graphics.fpsLimit;
    if (limit > 0 && dtMs < 1000 / limit - 0.5) return;

    const paused = this.state === "playing" && this.d.menus.pauseVisible;
    const t0 = performance.now();

    if (this.state === "playing" && !paused) {
      this.reconcile();
      this.decayViewError(dtMs);
      this.accumulator += dtMs / 1000;
      let steps = 0;
      while (this.accumulator >= TICK_DT && steps < 8) {
        this.accumulator -= TICK_DT;
        steps++;
        if (!this.fireHeldPrev && this.d.input.fireHeld) this.fireConsumed = false;
        this.fireHeldPrev = this.d.input.fireHeld;
        this.tickOnce(nowMs);
      }
      if (this.accumulator > TICK_DT * 3) this.accumulator = TICK_DT * 3;
      this.lastBtn = this.d.input.btnFromBinds();
    }

    this.d.net.sampleInterpolated(SNAPSHOT_INTERP_MS + Math.max(0, this.d.net.pingMs - 60), this.interpMap);
    const nowS = nowMs / 1000;
    this.updateCharacters(dtMs / 1000, nowS);
    this.updateCameraAndVm(dtMs);
    this.effects.update(dtMs / 1000);
    this.updateAbilityVisuals();
    this.d.audio.ensure();
    this.d.audio.updateListener(this.pred.x + this.viewErrX, this.pred.z + this.viewErrZ, this.myYaw);
    this.updateHud(nowMs);

    this.d.renderer.render();
    this.cpuMs = performance.now() - t0;
  };

  private fireHeldPrev = false;
  cpuMs = 0;
}

function hitAxis(nx: number, ny: number, nz: number): number {
  const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
  return ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2;
}
function hitSign(nx: number, ny: number, nz: number): number {
  const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
  const v = ax >= ay && ax >= az ? nx : ay >= az ? ny : nz;
  return v >= 0 ? 1 : 255;
}
function axisN(axis: number, which: number): number {
  return axis === which ? 1 : 0;
}
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
function agentShort(id: number): string {
  return ["NYX", "KILN", "ZEPHYR", "LUMEN"][id] ?? "?";
}



