#version 120

/*
    CineLite :: composite.fsh
    The "Fake Ray Tracing" post pass. One single fullscreen pass that adds:

      1. Contact shadows  - tiny screen-space walk towards the sun/moon
                            against depthtex1 (opaque depth only).
      2. Crevice AO       - 3 taps around the pixel (HIGH preset).
      3. Fake bounce GI   - a few neighbour colour taps; nearby grass
                            bleeds green, water bleeds blue, torch light
                            bleeds warm.
      4. Water reflections- analytic sky reflection + small screen-space
                            ray walk (SSR) + fresnel + distance fade.
      5. Water refraction - subtle normal-based distortion of the scene
                            behind the surface.
      6. Bloom bright-pass- HDR pixels extracted into colortex3.

    Everything is branch-guarded so LOW preset compiles down to nearly
    a passthrough.
*/

#include "/lib/settings.glsl"
#include "/lib/lighting.glsl"

varying vec2 texcoord;

uniform sampler2D colortex0;      /* HDR scene            */
uniform sampler2D colortex1;      /* world normals        */
uniform sampler2D colortex2;      /* lightmap / matId / delta */
uniform sampler2D depthtex0;      /* full depth           */
uniform sampler2D depthtex1;      /* opaque-only depth    */

uniform mat4 gbufferProjection;
uniform mat4 gbufferProjectionInverse;
uniform mat4 gbufferModelView;
uniform mat4 gbufferModelViewInverse;

uniform vec3 sunPosition;
uniform vec3 shadowLightPosition;

uniform float viewWidth;
uniform float viewHeight;
uniform float near;
uniform float far;
uniform float rainStrength;
uniform int isEyeInWater;

void main(){
    vec3 color  = texture2D(colortex0, texcoord).rgb;
    float depth = texture2D(depthtex0, texcoord).r;

    vec3 sunDirW = mat3(gbufferModelViewInverse) * normalize(sunPosition);
    float el = sunDirW.y;
    float dF = dayFactor(el);
    float nF = nightFactor(el);

    /* bloom bright-pass for every pixel (sky included) */
    vec3 bright = vec3(0.0);
#if BLOOM > 0
    bright = color * smoothstep(0.70, 1.05, luminance(color));
#endif

    if (depth < 1.0) {
        vec4 dat  = texture2D(colortex2, texcoord);
        vec3 Nw   = texture2D(colortex1, texcoord).rgb;
        float nLen = dot(Nw, Nw);
        float matId = floor(dat.b * 5.0 + 0.5);

        /* reconstruct view-space position */
        vec2 ndc = texcoord * 2.0 - 1.0;
        vec4 vp4 = gbufferProjectionInverse * vec4(ndc, depth * 2.0 - 1.0, 1.0);
        vec3 vpos = vp4.xyz / vp4.w;
        float dist = length(vpos);

        /* ============================================================
           FAKE CONTACT SHADOWS + crevice AO
           ============================================================ */
#if CONTACT_SHADOWS > 0
        if (nLen > 0.25 && matId != 3.0 && matId != 5.0 && dist > 0.6 && dist < 96.0) {
            vec3 Lw = mat3(gbufferModelViewInverse) * normalize(shadowLightPosition);
            float face = smoothstep(-0.05, 0.35, dot(Nw, Lw));
            float lightFac = max(dF, nF * 0.35);      /* moon shadows are faint */

            if (face * lightFac > 0.02) {
                vec3 Lv = normalize(shadowLightPosition);
                float occ = 0.0;
#if CONTACT_SHADOWS == 1
                for (int i = 1; i <= 4; i++){
                    float fi = float(i) / 4.0;
#else
                for (int i = 1; i <= 8; i++){
                    float fi = float(i) / 8.0;
#endif
                    float t  = 0.10 + fi * 1.45;
                    vec3 sp  = vpos + Lv * t;
                    vec4 cp  = gbufferProjection * vec4(sp, 1.0);
                    vec3 sn  = cp.xyz / cp.w * 0.5 + 0.5;
                    if (sn.x < 0.0 || sn.x > 1.0 || sn.y < 0.0 || sn.y > 1.0) break;
                    float sl = linZ(texture2D(depthtex1, sn.xy).r, near, far);
                    if (sl < length(sp) - 0.04) occ += 1.0 - fi * 0.6;
                }
#if CONTACT_SHADOWS == 1
                occ /= 4.0;
#else
                occ /= 8.0;
#endif
                color *= 1.0 - clamp(occ * 0.42 * face * lightFac, 0.0, 0.42);
            }

#if CONTACT_SHADOWS == 2
            /* cheap 3-tap crevice AO */
            float ao  = 0.0;
            float rot = hash12(gl_FragCoord.xy) * 6.2831;
            for (int i = 0; i < 3; i++){
                float ang = rot + float(i) * 2.0944;
                vec2 o  = vec2(cos(ang), sin(ang)) * (3.0 + float(i) * 2.5)
                        / vec2(viewWidth, viewHeight);
                float sl = linZ(texture2D(depthtex1, clamp(texcoord + o, 0.0, 1.0)).r, near, far);
                float dd = dist - sl;                 /* >0: sample is closer */
                ao += clamp(dd * 3.0, 0.0, 1.0)
                    * clamp(1.0 - dd * 1.4, 0.0, 1.0)
                    * step(0.02, dd);
            }
            color *= 1.0 - clamp(ao * 0.045, 0.0, 0.14);
#endif
        }
#endif

        /* ============================================================
           FAKE COLOURED BOUNCE LIGHT (neighbour bleed)
           Nearby lit pixels are re-added at low strength: grass tints
           green, water blue, torches warm. Rotated per-pixel to hide
           the tap pattern.
           ============================================================ */
#if FAKE_RAY_TRACING >= 2
        if (nLen > 0.25 && matId != 5.0 && dist < 64.0) {
            float rad;
            float str;
            float taps;
#if FAKE_RAY_TRACING == 2
            rad = 2.0; str = 0.050; taps = 4.0;
#else
            rad = 3.5; str = 0.070; taps = 8.0;
#endif
            float rot = hash12(gl_FragCoord.xy) * 6.2831;
            vec3 acc = vec3(0.0);
            for (int i = 0; i < 8; i++){
                if (float(i) >= taps) break;
                float a = rot + 6.2831 * float(i) / taps;
                vec2 o = vec2(cos(a), sin(a)) * rad / vec2(viewWidth, viewHeight);
                acc += texture2D(colortex0, clamp(texcoord + o, 0.0, 1.0)).rgb;
            }
            vec3 nb = acc / taps;

            float upF    = clamp(Nw.y * 0.5 + 0.5, 0.0, 1.0);
            float skyRaw = clamp((dat.g - 0.03125) * 1.0695, 0.0, 1.0);
            float blkRaw = clamp((dat.r - 0.03125) * 1.0695, 0.0, 1.0);

            vec3 env = ambientColor(el, rainStrength) * (skyRaw * skyRaw) * max(dF, 0.30);
            env += torchTint() * (blkRaw * blkRaw) * 0.8;

            color += nb * (str * upF) * env;
        }
#endif

        /* ============================================================
           WATER: fake reflections (sky + mini SSR), fresnel, refraction
           ============================================================ */
        if (matId == 3.0 && nLen > 0.25) {
            float delta = dat.a * 64.0;
            vec3 Vw = mat3(gbufferModelViewInverse) * normalize(-vpos);

            float fres = 0.025 + 0.975 * pow(1.0 - clamp(dot(Vw, Nw), 0.0, 1.0), 5.0);

            vec3 R = reflect(-Vw, Nw);
            if (R.y < 0.02) R.y = 0.02;               /* keep rays above water */
            R = normalize(R);

            /* analytic sky reflection (also used as SSR fallback) */
            vec3 refl = skyGradient(R, sunDirW, el, rainStrength);
            float rs = clamp(dot(R, sunDirW), 0.0, 1.0);
            refl += sunColor(el) * (pow(rs, 320.0) * 2.40 * dF);
            refl += moonTint()   * (pow(rs, 320.0) * 0.55 * nF);

#if REFLECTIONS >= 2
            /* tiny screen-space ray walk against opaque depth */
            vec3 Rv = mat3(gbufferModelView) * R;
            float tl = 0.30;
#if REFLECTIONS == 2
            for (int i = 0; i < 5; i++){
#else
            for (int i = 0; i < 8; i++){
#endif
                vec3 sp = vpos + Rv * tl;
                vec4 cp = gbufferProjection * vec4(sp, 1.0);
                vec3 sn = cp.xyz / cp.w * 0.5 + 0.5;
                if (sn.x <= 0.0 || sn.x >= 1.0 || sn.y <= 0.0 || sn.y >= 1.0 || sn.z >= 1.0) break;
                float sl = linZ(texture2D(depthtex1, sn.xy).r, near, far);
                float plen = length(sp);
                if (sl < plen && sl > plen - 2.2) {   /* hit something close behind the ray */
                    refl = mix(refl, texture2D(colortex0, sn.xy).rgb, 0.85);
                    break;
                }
                tl *= 1.75;
            }
#endif

            float rAmt;
#if REFLECTIONS == 0
            rAmt = 0.0;
#elif REFLECTIONS == 1
            rAmt = 0.45;
#elif REFLECTIONS == 2
            rAmt = 0.68;
#else
            rAmt = 0.88;
#endif
            rAmt *= fres
                  * (1.0 - rainStrength * 0.4)
                  * (1.0 - smoothstep(48.0, 96.0, dist));   /* distance fade */
            if (isEyeInWater == 1) rAmt *= 0.25;
            color = mix(color, refl, clamp(rAmt, 0.0, 0.92));

#if WATER_QUALITY >= 1
            /* gentle normal-driven distortion of what is under the water */
            vec3 refr = texture2D(colortex0,
                clamp(texcoord + Nw.xz * 0.0012 * clamp(delta, 0.0, 3.0), 0.0, 1.0)).rgb;
            color = mix(color, refr, 0.20 * clamp(delta * 0.8, 0.0, 1.0));
#endif
        }
    }

    /* colortex0 is auto-flipped by OptiFine/Iris when composites write it */
    gl_FragData[0] = vec4(color, 1.0);
    gl_FragData[3] = vec4(bright, 1.0);
}
