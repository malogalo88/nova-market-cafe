import { WeaponDef, WEAPONS } from "../../../shared/src/weapons.js";

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private liveVoices = 0;
  maxVoices = 22;
  private lastStepAt = 0;
  private stepFlip = false;
  private listenerX = 0;
  private listenerZ = 0;
  private cosYaw = 1;
  private sinYaw = 0;
  sfxVolume = 0.9;
  private ambStarted = false;

  ensure(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    try {
      const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AC({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);

      const len = Math.floor(this.ctx.sampleRate * 0.5);
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

      this.startAmbience();
    } catch {
      this.ctx = null;
    }
  }

  private startAmbience(): void {
    if (!this.ctx || !this.master || this.ambStarted) return;
    this.ambStarted = true;
    const t = this.ctx.currentTime;
    const hum = this.ctx.createOscillator();
    hum.type = "sine";
    hum.frequency.value = 52;
    const humG = this.ctx.createGain();
    humG.gain.setValueAtTime(0, t);
    humG.gain.linearRampToValueAtTime(0.006, t + 4);
    hum.connect(humG);
    humG.connect(this.master);
    hum.start(t);

    const airSrc = this.ctx.createBufferSource();
    airSrc.buffer = this.noiseBuf;
    airSrc.loop = true;
    airSrc.playbackRate.value = 0.32;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 320;
    const airG = this.ctx.createGain();
    airG.gain.setValueAtTime(0, t);
    airG.gain.linearRampToValueAtTime(0.010, t + 6);
    airSrc.connect(lp);
    lp.connect(airG);
    airG.connect(this.master);
    airSrc.start(t);
  }

  setVolumes(master: number, sfx: number): void {
    this.sfxVolume = sfx;
    if (this.master) this.master.gain.value = master;
  }

  updateListener(x: number, z: number, yaw: number): void {
    this.listenerX = x;
    this.listenerZ = z;
    this.cosYaw = Math.cos(yaw);
    this.sinYaw = Math.sin(yaw);
  }

  private spatial(x: number, z: number): { pan: number; atten: number } {
    const dx = x - this.listenerX;
    const dz = z - this.listenerZ;
    const dist = Math.hypot(dx, dz);
    const pan = Math.max(-1, Math.min(1, (dx * this.cosYaw - dz * this.sinYaw) / Math.max(5, dist)));
    return { pan, atten: 1 / (1 + dist * dist * 0.006) };
  }

  private canPlay(): boolean {
    return !!this.ctx && !!this.master && this.liveVoices < this.maxVoices;
  }

  private trackVoice(gain: GainNode, untilS: number): void {
    this.liveVoices++;
    window.setTimeout(() => {
      this.liveVoices--;
      try { gain.disconnect(); } catch { /* ignore */ }
    }, Math.max(30, (untilS - this.ctx!.currentTime) * 1000 + 60));
  }

  gunshot(w: WeaponDef, x?: number, z?: number): void {
    if (!this.canPlay() || !this.noiseBuf || !this.ctx || !this.master) return;
    const isLocal = x === undefined || z === undefined;
    const sp = isLocal ? { pan: 0, atten: 1 } : this.spatial(x!, z!);
    if (!isLocal && sp.atten < 0.02) return;
    const now = this.ctx.currentTime;
    const far = sp.atten < 0.25;
    const vol = sp.atten * w.sfx.vol * this.sfxVolume;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(vol, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + w.sfx.decay * (far ? 1.8 : 1));
    const pan = this.ctx.createStereoPanner();
    pan.pan.value = sp.pan;
    env.connect(pan);
    pan.connect(this.master);

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 1 + Math.random() * 0.15;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = far ? 500 : 1800;
    const crackG = this.ctx.createGain();
    crackG.gain.setValueAtTime(far ? 0.35 : 0.85, now);
    crackG.gain.exponentialRampToValueAtTime(0.001, now + (far ? 0.03 : 0.055));
    src.connect(hp);
    hp.connect(crackG);
    crackG.connect(env);

    const body = this.ctx.createBufferSource();
    body.buffer = this.noiseBuf;
    body.playbackRate.value = 0.7 + Math.random() * 0.2;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = w.sfx.freq * (far ? 0.5 : 1);
    bp.Q.value = 0.8;
    const bodyG = this.ctx.createGain();
    bodyG.gain.setValueAtTime(vol * 0.9, now);
    bodyG.gain.exponentialRampToValueAtTime(0.001, now + w.sfx.decay);
    body.connect(bp);
    bp.connect(bodyG);
    bodyG.connect(env);

    const thump = this.ctx.createOscillator();
    thump.type = "square";
    thump.frequency.setValueAtTime(140, now);
    thump.frequency.exponentialRampToValueAtTime(44, now + 0.055);
    const thumpG = this.ctx.createGain();
    thumpG.gain.setValueAtTime(vol * w.sfx.punch * 0.55, now);
    thumpG.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    thump.connect(thumpG);
    thumpG.connect(env);

    src.start(now);
    src.stop(now + 0.09);
    body.start(now);
    body.stop(now + w.sfx.decay * 2 + 0.05);
    thump.start(now);
    thump.stop(now + 0.1);

    if (!isLocal && far) {
      const tail = this.ctx.createBufferSource();
      tail.buffer = this.noiseBuf;
      tail.playbackRate.value = 0.5;
      const lp2 = this.ctx.createBiquadFilter();
      lp2.type = "lowpass";
      lp2.frequency.value = 700;
      const tailG = this.ctx.createGain();
      tailG.gain.setValueAtTime(0.0001, now);
      tailG.gain.linearRampToValueAtTime(vol * 0.5, now + 0.09);
      tailG.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      const pan2 = this.ctx.createStereoPanner();
      pan2.pan.value = sp.pan;
      tail.connect(lp2);
      lp2.connect(tailG);
      tailG.connect(pan2);
      pan2.connect(this.master);
      tail.start(now + 0.1);
      tail.stop(now + 0.45);
    }

    this.trackVoice(env, now + w.sfx.decay * 3 + 0.15);
    this.trackVoice(bodyG, now + w.sfx.decay * 3 + 0.15);
  }

  footstep(x: number, z: number, loud: boolean): void {
    if (!this.canPlay() || !this.noiseBuf || !this.ctx || !this.master) return;
    const nowMs = performance.now();
    if (nowMs - this.lastStepAt < 40) return;
    this.lastStepAt = nowMs;
    const sp = this.spatial(x, z);
    if (sp.atten < 0.02) return;
    const t = this.ctx.currentTime;
    this.stepFlip = !this.stepFlip;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime((loud ? 0.34 : 0.17) * sp.atten * this.sfxVolume, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    const pan = this.ctx.createStereoPanner();
    pan.pan.value = sp.pan;
    env.connect(pan);
    pan.connect(this.master);

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.35;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = (this.stepFlip ? (loud ? 920 : 640) : (loud ? 780 : 520)) * (0.92 + Math.random() * 0.16);
    bp.Q.value = 1.25;
    src.connect(bp);
    bp.connect(env);

    const tap = this.ctx.createOscillator();
    tap.type = "triangle";
    tap.frequency.setValueAtTime(loud ? 210 : 160, t);
    tap.frequency.exponentialRampToValueAtTime(70, t + 0.04);
    const tapG = this.ctx.createGain();
    tapG.gain.setValueAtTime(env.gain.value * 0.5, t);
    tapG.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    tap.connect(tapG);
    tapG.connect(env);

    src.start(t);
    src.stop(t + 0.12);
    tap.start(t);
    tap.stop(t + 0.06);
    this.trackVoice(env, t + 0.14);
  }

  hit(head: boolean): void {
    if (head) {
      this.tone(1320, 0.07, 0.22, "sine");
      this.tone(1980, 0.1, 0.12, "sine", 0.02);
    } else {
      this.tone(340, 0.045, 0.18, "square");
      this.tone(950, 0.05, 0.14, "triangle", 0.01);
    }
  }

  reloadClick(pitchUp: boolean): void {
    this.tone(pitchUp ? 660 : 430, 0.03, 0.13, "square");
    this.noiseTick(pitchUp ? 2600 : 1900, 0.028, 0.1, pitchUp ? 0.02 : 0);
  }

  uiHover(): void { this.tone(520, 0.03, 0.06, "sine"); }
  uiClick(): void { this.tone(780, 0.045, 0.1, "triangle"); this.noiseTick(3000, 0.02, 0.05, 0); }

  abilityCast(): void {
    this.tone(330, 0.16, 0.2, "sawtooth");
    this.tone(660, 0.22, 0.15, "sine", 0.05);
  }

  roundStinger(win: boolean): void {
    const notes = win ? [392, 494, 587] : [330, 277, 220];
    notes.forEach((f, i) => {
      this.tone(f, 0.3, 0.16, "triangle", i * 0.13);
      this.tone(f * 2, 0.22, 0.06, "sine", i * 0.13 + 0.01);
    });
  }

  damageTaken(): void {
    this.tone(185, 0.09, 0.26, "square");
    this.noiseTick(900, 0.06, 0.12, 0);
  }

  private tone(freq: number, dur: number, vol: number, type: OscillatorType, delay = 0): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(Math.min(1, vol * this.sfxVolume), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noiseTick(freq: number, dur: number, vol: number, delay: number): void {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 1.4;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq;
    bp.Q.value = 2.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(Math.min(1, vol * this.sfxVolume), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  weaponSoundById(id: number, x?: number, z?: number): void {
    const w = WEAPONS[id];
    if (w) this.gunshot(w, x, z);
  }
}
