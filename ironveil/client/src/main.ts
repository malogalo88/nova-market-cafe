import { loadSettings, saveSettings } from "./settings.js";
import { InputManager } from "./input.js";
import { NetClient } from "./net/NetClient.js";
import { GameRenderer } from "./render/GameRenderer.js";
import { Menus } from "./ui/Menus.js";
import { HUD } from "./ui/HUD.js";
import { AudioEngine } from "./audio/AudioEngine.js";
import { PerfOverlay } from "./perf/PerfOverlay.js";
import { Game } from "./game/Game.js";

function boot(): void {
  const settings = loadSettings();
  const canvas = document.getElementById("gl") as HTMLCanvasElement;

  const renderer = new GameRenderer(settings);
  const input = new InputManager(settings);
  const net = new NetClient();
  const audio = new AudioEngine();
  const hud = new HUD();
  const perf = new PerfOverlay();

  let game: Game | null = null;

  const menus = new Menus(settings, {
    onPlay(addr, name, mode, bots, diff) {
      menus.showLoading("foundry");
      if (game) {
        game.leaveMatch();
        game.disposeScene();
      }
      game = new Game({
        settings, renderer, input, net, audio, hud, perf,
        addr, name, mode, bots, diff,
        menus,
        onSettingsChanged() {
          saveSettings(settings);
          renderer.applySettings();
          audio.setVolumes(settings.audio.master, settings.audio.sfx);
        },
      });
      game.beginConnect();
    },
    onSettingsChanged() {
      saveSettings(settings);
      renderer.applySettings();
      audio.setVolumes(settings.audio.master, settings.audio.sfx);
    },
    onResume() {
      menus.hideMenus();
      canvas.requestPointerLock();
    },
    onLeave() {
      if (game) {
        game.leaveMatch();
        game.disposeScene();
        game = null;
      }
      hud.show(false);
      menus.hideAllPanels();
      document.exitPointerLock();
      menus.swap("mainmenu");
    },
    onLoadoutSelect(primary, agent) {
      if (!game) return;
      game.sendLoadout(primary, agent);
    },
  });

  menus.swap("mainmenu");

  window.addEventListener("keydown", (e) => {
    if (e.code === settings.binds.perf) {
      e.preventDefault();
      perf.toggle();
    }
  });
}

boot();
