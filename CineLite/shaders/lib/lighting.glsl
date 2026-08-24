#ifndef CINE_LIGHTING_INCLUDED
#define CINE_LIGHTING_INCLUDED

/*
    CineLite :: lighting.glsl
    -------------------------------------------------------------------------
    Shared "fake ray tracing" lighting library.
    Everything here is analytic math or tiny screen-space taps.
    No shadow map, no ray marching against geometry beyond a few steps,
    no volumetrics, no multi-bounce transport.

    Sections:
      1. utilities            4. procedural sky
      2. time of day          5. fog
      3. palettes             6. surface / particle lighting + water waves
*/

#include "/lib/settings.glsl"

/* ============================ 1. utilities ============================ */

float luminance(vec3 c){
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

float hash12(vec2 p){
    vec3 p3 = fract(vec3(p.x, p.y, p.x) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float hash13(vec3 p){
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
}

/* linear view distance from hardware depth (standard perspective) */
float linZ(float d, float nzr, float fzr){
    return (2.0 * nzr * fzr) / (fzr + nzr - (d * 2.0 - 1.0) * (fzr - nzr));
}

/* ========================== 2. time of day ============================ */

float dayFactor(float el)  { return smoothstep(-0.06, 0.16, el); }
float nightFactor(float el){ return 1.0 - smoothstep(-0.16, 0.02, el); }
float duskFactor(float el) { return pow(clamp(1.0 - abs(el) * 4.0, 0.0, 1.0), 1.4); }

/* =========================== 3. palettes ============================== */

vec3 sunColor(float el){
    vec3 dawn = vec3(1.00, 0.44, 0.20);
    vec3 noon = vec3(1.00, 0.97, 0.90);
    return mix(dawn, noon, smoothstep(0.00, 0.30, el));
}

vec3 moonTint(){ return vec3(0.45, 0.55, 0.80); }
vec3 torchTint(){ return vec3(1.00, 0.58, 0.28); }

vec3 ambientColor(float el, float rain){
    vec3 day   = vec3(0.360, 0.510, 0.760);
    vec3 night = vec3(0.050, 0.062, 0.105);
    vec3 dusk  = vec3(0.520, 0.360, 0.320);
    vec3 c = mix(night, day, dayFactor(el));
    c = mix(c, dusk, duskFactor(el) * 0.45);
    float l = luminance(c);
    c = mix(c, vec3(l) * vec3(0.85, 0.89, 0.95), rain * 0.6);
    return c;
}

/* ====================== 4. procedural sky ============================= */
/* Analytic gradient sky with horizon haze and sunset glow.
   Used for: the visible sky, fog colour, ambient light and reflections. */

vec3 skyGradient(vec3 dir, vec3 sunDir, float el, float rain){
    float dF  = dayFactor(el);
    float duF = duskFactor(el);
    float y   = clamp(dir.y, -1.0, 1.0);

    vec3 zenDay   = vec3(0.125, 0.320, 0.680);
    vec3 horDay   = vec3(0.660, 0.800, 0.940);
    vec3 zenNight = vec3(0.007, 0.011, 0.027);
    vec3 horNight = vec3(0.032, 0.048, 0.090);
    vec3 zenDusk  = vec3(0.150, 0.165, 0.330);
    vec3 horDusk  = vec3(0.960, 0.480, 0.250);

    vec3 zen = mix(mix(zenNight, zenDay, dF), zenDusk, duF * 0.40);
    vec3 hor = mix(mix(horNight, horDay, dF), horDusk, duF * 0.70);

    /* vertical gradient, brighter towards the horizon */
    float hw = pow(1.0 - clamp(y, 0.0, 1.0), 3.0);
    vec3 col = mix(zen, hor, hw);

    /* warm scattering around the sun near the horizon (fake inscatter) */
    vec3 sd = normalize(sunDir + vec3(1e-5, 0.0, 0.0));
    float sa = clamp(dot(dir, sd), 0.0, 1.0);
    col += vec3(1.00, 0.52, 0.24) * (duF * (pow(sa, 4.0) * hw * 0.50 + pow(sa, 24.0) * 0.28));
    col += sunColor(el) * (dF * pow(sa, 24.0) * 0.10);

    /* rain flattens and darkens the sky */
    float l = luminance(col);
    col = mix(col, vec3(l) * vec3(0.84, 0.88, 0.94), rain * 0.65);
    col *= 1.0 - rain * 0.35;

    /* below-horizon fade into void darkness */
    vec3 voidC = mix(hor * 0.22, vec3(0.004, 0.006, 0.010), clamp(-y * 2.5, 0.0, 1.0));
    col = mix(col, voidC, clamp(-y * 4.0, 0.0, 1.0));
    return col;
}

/* ============================== 5. fog ================================ */

float fogFactor(float dist, float farDist, float rain){
#if FOG_QUALITY == 0
    return smoothstep(farDist * 0.55, farDist * 0.98, dist);
#else
    float f = smoothstep(farDist * mix(0.62, 0.45, rain),
                         farDist * mix(0.995, 0.86, rain), dist);
#if FOG_QUALITY >= 2
    f += (1.0 - exp(-dist * 0.0015)) * 0.10;
#endif
    return clamp(f, 0.0, 1.0);
#endif
}

/* Fog colour follows the sky so fog always blends seamlessly.
   Darkened by eyeSkyLight so caves do not glow grey. */
vec3 fogColorFor(vec3 wdir, vec3 sunDir, float el, float rain, float eyeSky){
    vec3 fd = normalize(vec3(wdir.x, max(wdir.y, -0.06), wdir.z) + vec3(1e-5, 0.0, 0.0));
    vec3 fc = skyGradient(fd, sunDir, el, rain);
    fc *= mix(0.05, 1.0, eyeSky);
    return fc;
}

vec3 applyFog(vec3 color, vec3 wdir, float dist, vec3 sunDir, float el,
              float rain, float eyeSky, float dF, int eyeInWater,
              float blind, float dark, float farDist){
    if (eyeInWater == 2) {                       /* lava */
        return mix(color, vec3(0.38, 0.09, 0.01), clamp(1.0 - exp(-dist * 1.10), 0.0, 1.0));
    }
    if (eyeInWater == 3) {                       /* powder snow */
        return mix(color, vec3(0.60, 0.68, 0.76), clamp(1.0 - exp(-dist * 0.65), 0.0, 1.0));
    }
    if (eyeInWater == 1) {                       /* water */
        float wf = clamp(1.0 - exp(-dist * 0.10), 0.0, 1.0);
        vec3 wc = vec3(0.020, 0.105, 0.155) * (0.10 + 0.90 * eyeSky) * (0.35 + 0.65 * dF);
        return mix(color, wc, wf);
    }

    vec3 fc = fogColorFor(wdir, sunDir, el, rain, eyeSky);
    float ff = fogFactor(dist, farDist, rain);
    vec3 oc = mix(color, fc, ff);

    /* blindness / darkness effects close in to black */
    float bd = max(blind, dark);
    if (bd > 0.001) oc = mix(oc, vec3(0.0), bd * smoothstep(0.0, 10.0, dist));
    return oc;
}

/* ===================== 6. surface & particle light ==================== */

/*
    The heart of the fake ray tracing look.

      * blockPart : warm torch/lantern light curve (+ optional held light)
      * direct    : wrapped N*dot*L sunlight -> soft fake shadow edges
      * ambient   : hemispheric sky ambient (fake GI)
      * fillCol   : FAKE BOUNCE LIGHT from the ground opposite the sun
      * spec/emis : blinn specular + emissive boost near strong torches

    No textures sampled, no loops, no rays. Runs per-pixel in every
    gbuffer program.
*/
vec3 sceneLight(vec3 Nw, vec3 Vw, vec3 sunDirW, float el, vec2 lm, float matId,
                float rain, float wet, float heldRange, float camDist, float ft,
                out vec3 spec, out vec3 emis){
    float bl   = clamp((lm.x - 0.03125) * 1.0695, 0.0, 1.0);   /* block light  */
    float skyl = clamp((lm.y - 0.03125) * 1.0695, 0.0, 1.0);   /* sky light    */

    float dF  = dayFactor(el);
    float nF  = nightFactor(el);
    float rainDim = 1.0 - rain * 0.55;

    /* ---- warm block light with a hint of flicker ---- */
    float flick = 1.0 + sin(ft * 2.7) * 0.02 + sin(ft * 4.9) * 0.015;
    vec3 blockPart = torchTint() * (bl * bl * 2.05 * flick);

    /* held torch / lantern dynamic light (one length() per pixel) */
    if (heldRange > 0.5) {
        float hl = clamp(1.0 - camDist / heldRange, 0.0, 1.0);
        blockPart += torchTint() * (pow(hl, 1.6) * 1.15);
    }

    /* ---- sky light curve ---- */
    float skyQ = skyl * sqrt(skyl);
    float minAmb = 0.030;
    vec3 ambC = ambientColor(el, rain);

    /* ---- direct sun/moon, wrapped diffuse => soft shadow edges ---- */
    float ndl = dot(Nw, sunDirW);
#if SHADOW_QUALITY == 0
    float wrap = clamp(ndl * 0.80 + 0.20, 0.0, 1.0);
#elif SHADOW_QUALITY == 1
    float wrap = smoothstep(-0.30, 0.55, ndl);
#else
    float wrap = smoothstep(-0.50, 0.75, ndl);
#endif

    vec3 direct = sunColor(el) * (wrap * dF * 1.35 * rainDim * skyQ)
                + moonTint()  * (clamp(ndl * 0.5 + 0.5, 0.0, 1.0) * nF * 0.16 * skyQ);

    /* ---- hemispheric ambient: fake global illumination ---- */
    float hemi = Nw.y * 0.5 + 0.5;
    vec3 ambient = ambC * (skyQ * (0.40 + 0.40 * hemi) + minAmb);

    /* ---- fake bounce fill from the ground opposite the sun ---- */
    vec3 fillCol = vec3(0.0);
#if FAKE_RAY_TRACING >= 1
    vec3 fillDir = normalize(vec3(-sunDirW.x, 0.45, -sunDirW.z) + vec3(1e-4, 0.0, 0.0));
    float fdot = clamp(dot(Nw, fillDir), 0.0, 1.0);
#if FAKE_RAY_TRACING == 1
    fillCol = sunColor(el) * (fdot * 0.10 * dF * skyQ);
#elif FAKE_RAY_TRACING == 2
    fillCol = sunColor(el) * (fdot * 0.16 * dF * skyQ);
#else
    fillCol = sunColor(el) * (fdot * 0.22 * dF * skyQ);
#endif
#endif

    vec3 light = blockPart + direct + ambient + fillCol;

    /* ---- cheap specular: strong on water, faint elsewhere,
            boosted when surfaces are wet (rain) ---- */
    spec = vec3(0.0);
    {
        vec3 H = normalize(Vw + sunDirW);
        float ndh = clamp(dot(Nw, H), 0.0, 1.0);
        float dl  = clamp(ndl, 0.0, 1.0);

        float shininess;
        float sStr;
        if (matId > 2.5 && matId < 3.5) {          /* water */
            shininess = 220.0;
            sStr = 0.85;
        } else {
            float wetSheen = wet * clamp(Nw.y, 0.0, 1.0) * skyQ;
            shininess = 56.0;
            sStr = 0.045 + wetSheen * 0.22;
        }

        spec  = sunColor(el) * (pow(ndh, shininess) * sStr * dl * dF * rainDim * skyQ);
        spec += moonTint()  * (pow(ndh, shininess) * sStr * nF * 0.10 * skyQ);
    }

    /* ---- emissive lift around strong block light (torch glow feel) ---- */
    emis = torchTint() * (pow(clamp(bl * 1.25 - 0.78, 0.0, 1.0), 2.0) * 1.35);

    return light;
}

/* Simplified lighting for particles (no usable normals). */
vec3 particleLight(vec2 lm, float el, float rain, float ft){
    float bl   = clamp((lm.x - 0.03125) * 1.0695, 0.0, 1.0);
    float skyl = clamp((lm.y - 0.03125) * 1.0695, 0.0, 1.0);

    float dF = dayFactor(el);
    float nF = nightFactor(el);
    float flick = 1.0 + sin(ft * 2.7) * 0.02;

    vec3 blockPart = torchTint() * (bl * bl * 1.90 * flick);
    float skyQ = skyl * sqrt(skyl);
    vec3 amb = ambientColor(el, rain) * (skyQ * 0.75 + 0.03);
    vec3 direct = sunColor(el) * (0.72 * dF * (1.0 - rain * 0.55) * skyQ);
    direct += moonTint() * (nF * 0.12 * skyQ);

    return blockPart + amb + direct;
}

/* ------------------------- water wave normals ------------------------- */
/* Returns a small XZ perturbation; the caller builds the final normal.
   Pure sines: no noise texture fetches at all. */
vec2 waterWaveOffset(vec2 xz, float t){
    vec2 w = vec2(0.0);
#if WATER_QUALITY >= 1
    w.x += sin(xz.x * 1.90 + t * 1.55) + sin((xz.x + xz.y) * 1.15 - t * 1.05);
    w.y += sin(xz.y * 2.10 - t * 1.35) + sin((xz.x - xz.y) * 1.35 + t * 1.25);
    w *= 0.032;
#if WATER_QUALITY >= 2
    w.x += sin(xz.x * 3.70 - t * 2.20) * 0.014;
    w.y += sin(xz.y * 3.30 + t * 1.95) * 0.014;
#endif
#endif
    return w;
}

#endif /* CINE_LIGHTING_INCLUDED */
