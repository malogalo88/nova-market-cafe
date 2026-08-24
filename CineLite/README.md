# CineLite

**Fake-ray-traced cinematic shaders for Minecraft Java Edition — engineered for Intel UHD integrated graphics.**

CineLite makes Minecraft look dramatically better than vanilla using only cheap approximations:
wrapped-diffuse "soft shadow" lighting, screen-space contact shadows, neighbour-bleed colored
bounce light, analytic sky reflections on water, procedural sky/fog that always match, subtle
bloom and a filmic color grade. There is **no ray tracing of any kind**, **no shadow map pass**,
and only **three post-processing passes** total.

> Target hardware (this pack was tuned on): Intel Core i5-10310U, Intel UHD Graphics,
> 16 GB RAM, 1080p, 60 Hz.
>
> Expected results at 1080p: **LOW ~80–120 FPS · MEDIUM ~50–70 FPS · HIGH ~40–55 FPS.**
> Stable frame times matter more than peak numbers — if you feel stutter, drop one tier.

---

## 1. What you need

| Component | Requirement |
|---|---|
| Minecraft Java Edition | 1.16 or newer (newer = better; block/tag names auto-ignore what's missing) |
| Mod loader | Fabric |
| Shader loader | **Iris** — required. Sodium alone cannot load shader packs. |
| Performance mod | Sodium (installed automatically as an Iris dependency) |
| GPU driver | Update your Intel graphics driver from intel.com before reporting issues |

The pack also works on OptiFine (G8+), but the intended setup is Fabric + Iris + Sodium.

## 2. Installation

1. Install Fabric Loader for your Minecraft version.
2. Download **Iris** (it bundles Sodium) and put the jar in `.minecraft/mods/`.
3. Put this pack in your shader packs:
   - Either copy the whole `CineLite` folder into `.minecraft/shaderpacks/`,
   - or zip the **contents** of `CineLite` (so `shaders/` is at the zip root) and copy the zip there.
4. Launch the game → Options → Video Settings → Shader Packs → select **CineLite** → Apply.
5. Open *Shader Pack Settings* and pick a profile:
   - **LOW** – maximum FPS
   - **MEDIUM** – default & recommended (also the file defaults)
   - **HIGH** – best visuals, still no real ray tracing

## 3. Recommended game settings (Intel UHD)

### Minecraft Video Settings
| Setting | Value | Why |
|---|---|---|
| Render Distance | **8–12 chunks** | The #1 FPS lever on iGPUs/CPU |
| Simulation Distance | 8–12 | CPU-bound, not shader-related |
| Graphics | Fast | Fewer decorative geometry passes |
| Smooth Lighting | Maximum | Free baked AO — CineLite builds on it |
| Particles | Decreased/Minimal | Particle draw calls cost CPU time |
| Entity Distance | 75% | Less vertex work |
| Max FPS | 60 (or VSync) | Smooth frame pacing, cooler laptop |
| Clouds | ON (any) | The pack re-shades vanilla clouds cheaply |

### Sodium / Iris settings
- Keep everything at defaults except: **Chunk Builder threads** = default (auto).
- If you use an FPS limiter, 60 is ideal for a 60 Hz panel.
- Do **not** enable "Use Large Frame Buffers"-style debug options; leave them off.

## 4. Presets

| Setting | LOW | MEDIUM (default) | HIGH |
|---|---|---|---|
| Fake Ray Tracing | OFF | MEDIUM | HIGH |
| Soft Shadows | LOW | MEDIUM | HIGH |
| Contact Shadows | OFF | MEDIUM | HIGH |
| Water Quality | LOW | MEDIUM | HIGH |
| Reflections | SKY ONLY | MEDIUM | HIGH |
| Bloom | OFF | SUBTLE | BRIGHT |
| Wind | LOW | LOW | HIGH |
| Fog Quality | LOW | MEDIUM | HIGH |
| Color Grading | OFF | ON | ON |

Profiles are switchable in-game (*Shader Pack Settings → Profile*). Changing most options
recompiles one small program, which takes under a second.

## 5. Performance guide — what costs what

Lower these first when FPS drops, in this order:

### VERY LOW COST (basically free — leave enabled)
- **Color grading, fog color, night blue-shift, grain** — pure math in `final`.
- **Soft Shadows (fake wrapped lighting)** — a couple of instructions per pixel, no extra passes.
- **Wind** — a few sine() calls per affected vertex only.

### LOW COST
- **Fog Quality** — one exp() per pixel.
- **Bloom SUBTLE** — two tiny 5-tap fullscreen blurs (compiled out entirely when OFF).

### MEDIUM COST
- **Fake Ray Tracing MEDIUM/HIGH** — 4–8 neighbor taps in `composite` for bounce light.
- **Contact Shadows** — 4–8 depth-tap walk toward the sun (only near lit surfaces < 96 m).

### HIGHEST COST IN THIS PACK
- **Reflections MEDIUM/HIGH + Water Quality HIGH** — the mini screen-space ray walk
  (5–8 steps) plus wave normals. Still far cheaper than any real reflection system;
  SKY ONLY mode removes the ray walk completely.
- **Render distance itself** — not a shader setting, but it dwarfs everything above.

Rule of thumb: if you are below target FPS, set **Reflections → SKY ONLY** first, then
**Contact Shadows OFF**, then **Fake Ray Tracing LOW**. That combination is roughly the
LOW preset minus wind.

## 6. How it works (the fake ray-tracing tricks)

Pipeline (all forward-rendered, three post passes):

```
gbuffers_*  ->  colortex0 (HDR color)      composite  -> contact shadows
               colortex1 (world normal)                -> neighbor-bounce GI
               colortex2 (lightmap/matId)              -> water SSR + refraction
                                                       -> bloom bright-pass
                            composite1 -> bloom blur H
                            final      -> bloom blur V + tonemap + grade
```

| Requested effect | How CineLite fakes it (cost) |
|---|---|
| Fake indirect lighting / GI | Hemispheric ambient + wrapped N·L diffuse + lightmap curves (math only) |
| Fake bounce light | Analytic ground-fill opposite the sun + up to 8 neighbor color taps so grass bleeds green / water blue / torches warm |
| Soft shadows | Wrapped diffuse terminator shaped by SHADOW_QUALITY — no shadow map exists at all |
| Contact shadows | 4–8-step screen-space walk toward the sun against opaque depth + 3-tap crevice AO |
| Fake reflections | Fresnel × analytic sky gradient, optionally refined by a ≤8-step screen-space walk; fades out by 96 m |
| Fake specular | Blinn highlight; strong on water, faint elsewhere, boosted on wet surfaces during rain |
| Sky | One analytic function reused by sky, fog, ambient and reflections — they can never mismatch |
| Stars/moon | Vanilla star quads enhanced + procedural moon disc with phase and speckle |
| Water | Sine-wave normals, depth-based body color, foam line, fresnel, refraction offset, underwater fog |
| Block lighting | Warm quadratic torch curve with micro-flicker + held-light radius + emissive lift for bloom |
| Bloom | HDR bright-pass + two 5-tap separable blurs |
| Cinematic look | ACES-fit tonemap, contrast S-curve, teal/orange split-tone, night desaturation, vignette, grain |

## 7. File structure

```
CineLite/
├── pack.mcmeta                  pack metadata
├── README.md                    this file
└── shaders/
    ├── shaders.properties       GUI layout, presets, buffer formats
    ├── block.properties         block groups (wind plants / leaves / water)
    ├── lang/en_us.lang          option labels & tooltips
    ├── lib/
    │   ├── settings.glsl        all quality options (defaults = MEDIUM)
    │   └── lighting.glsl        shared fake-lighting library (sky, fog, lights)
    ├── gbuffers_terrain.*       opaque + cutout world geometry (+wind)
    ├── gbuffers_water.*         translucent pass (waves, foam, material flags)
    ├── gbuffers_entities.*      mobs, item frames...
    ├── gbuffers_block.*         chests, signs, banners...
    ├── gbuffers_hand.*          first-person hand
    ├── gbuffers_textured.*      unlit particles
    ├── gbuffers_textured_lit.*  lit particles
    ├── gbuffers_skybasic.*      procedural gradient sky
    ├── gbuffers_skytextured.*   sun disc, phased moon, enhanced stars
    ├── gbuffers_clouds.*        re-shaded vanilla clouds
    ├── gbuffers_weather.*       rain/snow with wind slant
    ├── gbuffers_beaconbeam.*    HDR beam for bloom
    ├── composite.*              fake RT extras + bloom bright-pass
    ├── composite1.*             bloom blur (horizontal)
    └── final.*                  bloom add + tonemap + grade
```

Programs that don't exist (basic, line, damagedblock, spidereyes, armor_glint...)
fall back through Iris/OptiFine's standard chain to the programs above or to
vanilla rendering — nothing required is missing.

## 8. Troubleshooting

**"Shader failed to compile / errors in log"**
1. Open `.minecraft/logs/latest.log` and search for `error`. Iris prints the exact
   file and GLSL line number.
2. Switch the profile to **LOW** — it disables almost every optional code path.
   If LOW works, re-enable options one at a time to find the culprit.
3. Make sure you extracted/zipped correctly: the folder (or zip root) must contain
   `shaders/`, not another nested folder.
4. Update your Intel GPU driver — old drivers fail on perfectly valid GLSL.
5. Update Iris; very old Iris versions lack some properties used here.

**Black screen / pink world** — usually a failed compile (see log) or mixing an
OptiFine-only pack; CineLite targets both loaders but was built for Iris.

**Water looks flat** — WATER_QUALITY LOW flattens waves by design; raise it.

**Everything too dark/bright** — adjust Minecraft's Brightness slider; CineLite's
exposure follows it (`screenBrightness`), or tweak `expo` in `shaders/final.fsh`.

**Nether/End mood** — CineLite assumes overworld day/night lighting; other
dimensions get the dark-blue ambient look. This keeps the shader simple and fast.

## 9. Tuning further

All visual constants live in clearly-marked sections of `shaders/lib/lighting.glsl`
(palettes, torch curve, fog densities) and at the top of each program. Change,
save, and press F3+R (Iris reload hotkey varies) or re-select the pack to rebuild.

---

*CineLite is original work, MIT licensed. It contains no ray tracing, no path tracing,
and no shadow map — just carefully chosen lies.*
