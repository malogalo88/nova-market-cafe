import { Settings } from "./settings.js";

export const ACTION_NAMES: Record<string, string> = {
  forward: "Move Forward",
  back: "Move Backward",
  left: "Strafe Left",
  right: "Strafe Right",
  jump: "Jump",
  crouch: "Crouch",
  walk: "Walk (quiet)",
  reload: "Reload",
  slot1: "Primary Weapon",
  slot2: "Sidearm",
  slot3: "Blade",
  abilityQ: "Ability Q",
  abilityE: "Ability E",
  scoreboard: "Scoreboard",
  chat: "Chat",
  quickchat1: "Quick Chat 1",
  quickchat2: "Quick Chat 2",
  perf: "Perf Overlay",
};

const LATCH_ACTIONS = new Set(["slot1", "slot2", "slot3", "abilityQ", "abilityE"]);

export class InputManager {
  settings: Settings;
  private latches = new Set<string>();
  private heldActions = new Set<string>();
  onAction: ((a: string) => void) | null = null;
  onMouseButton: ((btn: number) => void) | null = null;
  mouseDX = 0;
  mouseDY = 0;
  fireHeld = false;
  adsHeld = false;
  locked = false;
  chatOpen = false;

  constructor(settings: Settings) {
    this.settings = settings;

    window.addEventListener("keydown", (e) => {
      const bound = this.isBound(e.code);
      if (!this.chatOpen && bound) e.preventDefault();
      if (this.chatOpen || e.repeat) return;
      this.holdActionForCode(e.code, true);
      this.fireLatchedForCode(e.code);
    });
    window.addEventListener("keyup", (e) => {
      this.holdActionForCode(e.code, false);
    });
    window.addEventListener("mousemove", (e) => {
      if (!this.locked || this.chatOpen) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    window.addEventListener("mousedown", (e) => {
      if (!this.locked || this.chatOpen) return;
      if (e.button === 0) this.fireHeld = true;
      if (e.button === 2) this.adsHeld = true;
      if (e.button === 1) { e.preventDefault(); this.onMouseButton?.(1); }
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.fireHeld = false;
      if (e.button === 2) this.adsHeld = false;
    });
    window.addEventListener("contextmenu", (e) => {
      if (this.locked) e.preventDefault();
    });
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement !== null;
      if (!this.locked) {
        this.heldActions.clear();
        this.fireHeld = false;
        this.adsHeld = false;
      }
    });
    window.addEventListener("blur", () => {
      this.heldActions.clear();
      this.fireHeld = false;
      this.adsHeld = false;
    });
  }

  private actionByCode(code: string): string | null {
    for (const [action, c] of Object.entries(this.settings.binds)) {
      if (c === code) return action;
    }
    return null;
  }

  isBound(code: string): boolean {
    return this.actionByCode(code) !== null || code === this.settings.binds.scoreboard;
  }

  private holdActionForCode(code: string, down: boolean): void {
    const a = this.actionByCode(code);
    if (!a) return;
    if (down) this.heldActions.add(a);
    else this.heldActions.delete(a);
  }

  private fireLatchedForCode(code: string): void {
    const a = this.actionByCode(code);
    if (!a) return;
    if (LATCH_ACTIONS.has(a) && !this.latches.has(a)) {
      this.latches.add(a);
      this.onAction?.(a);
    }
  }

  consumeLatches(): void {
    this.latches.clear();
  }

  wasLatched(action: string): boolean {
    return this.latches.has(action);
  }

  isDown(action: string): boolean {
    return this.heldActions.has(action);
  }

  btnFromBinds(): number {
    let v = 0;
    if (this.isDown("forward")) v |= 1;
    if (this.isDown("back")) v |= 2;
    if (this.isDown("left")) v |= 4;
    if (this.isDown("right")) v |= 8;
    if (this.isDown("jump")) v |= 16;
    if (this.isDown("crouch")) v |= 32;
    if (this.isDown("walk")) v |= 64;
    if (this.fireHeld) v |= 128;
    if (this.adsHeld) v |= 256;
    return v;
  }

  pollMouse(): { dx: number; dy: number } {
    const r = { dx: this.mouseDX, dy: this.mouseDY };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return r;
  }
}

export function keyLabel(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code === "Space") return "SPACE";
  if (code === "ShiftLeft") return "LSHIFT";
  if (code === "ShiftRight") return "RSHIFT";
  if (code === "ControlLeft") return "LCTRL";
  if (code === "ControlRight") return "RCTRL";
  if (code === "AltLeft") return "LALT";
  if (code === "Enter") return "ENTER";
  if (code === "Tab") return "TAB";
  if (code.startsWith("Numpad")) return "NUM" + code.slice(6);
  return code.toUpperCase();
}
