import * as THREE from "three";
import { Settings } from "../settings.js";

export interface RenderStats {
  drawCalls: number;
  triangles: number;
}

export class GameRenderer {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  private currentAA = -1;
  private canvas: HTMLCanvasElement;

  constructor(private settings: Settings) {
    this.canvas = document.getElementById("gl") as HTMLCanvasElement;
    this.camera = new THREE.PerspectiveCamera(settings.graphics.fov, window.innerWidth / window.innerHeight, 0.06, 420);
    this.scene.add(this.camera);
    this.renderer = this.createRenderer();
    this.hemi = new THREE.HemisphereLight(0x9fc3e8, 0x6b6156, 0.72);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffe3bd, 1.65);
    this.sun.position.set(-38, 55, 24);
    this.sun.target.position.set(0, 0, 0);
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    const fill = new THREE.DirectionalLight(0xbcd0e4, 0.32);
    fill.position.set(30, 26, -34);
    this.scene.add(fill);
    window.addEventListener("resize", () => this.onResize());
    this.onResize();
  }

  private createRenderer(): THREE.WebGLRenderer {
    const aaMode = this.settings.graphics.aa;
    this.currentAA = aaMode;
    const r = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: aaMode > 0,
      powerPreference: "high-performance",
      stencil: false,
    });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.08;
    r.shadowMap.enabled = this.settings.graphics.shadows >= 2;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    return r;
  }

  applySettings(): void {
    const g = this.settings.graphics;
    if (g.aa !== this.currentAA || (g.shadows >= 2) !== this.renderer.shadowMap.enabled) {
      const size = new THREE.Vector2();
      this.renderer.getSize(size);
      const ratio = this.renderer.getPixelRatio();
      this.renderer.dispose();
      this.renderer = this.createRenderer();
      this.renderer.setPixelRatio(ratio);
      this.renderer.setSize(size.x / Math.max(ratio, 0.0001), size.y / Math.max(ratio, 0.0001), false);
    }
    this.applyResolution();
    this.camera.fov = g.fov;
    this.camera.far = Math.max(g.viewDist * 2.2, 420);
    this.camera.updateProjectionMatrix();

    if (g.shadows >= 2) {
      const mapSize = g.shadows === 3 ? 2048 : 1024;
      if (!this.sun.castShadow || this.sun.shadow.mapSize.x !== mapSize) {
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(mapSize, mapSize);
        this.sun.shadow.camera.left = -55;
        this.sun.shadow.camera.right = 55;
        this.sun.shadow.camera.top = 45;
        this.sun.shadow.camera.bottom = -45;
        this.sun.shadow.camera.near = 10;
        this.sun.shadow.camera.far = 160;
        this.sun.shadow.bias = -0.0008;
        this.sun.shadow.normalBias = 0.03;
        this.sun.shadow.radius = 3;
        this.sun.shadow.map?.dispose();
        (this.sun.shadow as any).map = null;
      }
    } else {
      this.sun.castShadow = false;
    }

    this.scene.fog = new THREE.Fog(0xbfc9d4, g.viewDist * 0.55, g.viewDist);
  }

  applyResolution(): void {
    const scale = this.settings.graphics.resScale;
    const pr = Math.min(window.devicePixelRatio || 1, 2) * scale;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.applyResolution();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  stats(): RenderStats {
    return {
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
    };
  }

  dispose(): void {
    this.renderer.dispose();
  }

  get shadowEnabled(): boolean {
    return this.renderer.shadowMap.enabled;
  }

  setWorldShadows(worldGroup: THREE.Group): void {
    worldGroup.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = false;
        o.receiveShadow = this.settings.graphics.shadows >= 2;
      }
    });
  }
}
