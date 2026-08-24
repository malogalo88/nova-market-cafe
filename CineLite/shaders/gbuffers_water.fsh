#version 120

/*
    CineLite :: gbuffers_water.fsh
    Water: sine-wave normals, depth-based body colour, shoreline foam.
    Reflections + refraction are added later in composite.fsh.
*/

#include "/lib/settings.glsl"

varying vec2 vUV;
#include "/lib/lighting.glsl"

varying vec2 vLM;
varying vec4 vColor;
varying vec3 vNormalW;
varying vec3 vPlayerPos;
varying float vMat;

uniform sampler2D gtexture;
uniform sampler2D depthtex1;      /* opaque-only depth: safe to read here */

uniform mat4 gbufferModelViewInverse;
uniform vec3 sunPosition;
uniform float rainStrength;
uniform float wetness;
uniform float frameTimeCounter;
uniform int isEyeInWater;
uniform float blindness;
uniform float darknessFactor;
uniform float nightVision;
uniform float heldBlockLightRange;
uniform vec2 eyeBrightnessSmooth;
uniform float near;
uniform float far;
uniform float viewWidth;
uniform float viewHeight;

void main(){
    vec4 tex = texture2D(gtexture, vUV);
    if (tex.a < 0.004) discard;

    vec3 sunDirW = mat3(gbufferModelViewInverse) * normalize(sunPosition);
    float el = sunDirW.y;
    float dF = dayFactor(el);

    bool isWater = vMat > 2.5;
    vec3 Nw;

    if (isWater) {
        /* animated wave normal - pure sines, no texture lookups */
        vec2 ww = waterWaveOffset(vPlayerPos.xz, frameTimeCounter);
        float upSign = gl_FrontFacing ? 1.0 : -1.0;
        Nw = normalize(vec3(ww.x, upSign, ww.y));
    } else {
        Nw = vNormalW;
    }

    vec3 albedo  = tex.rgb * vColor.rgb;
    vec3 Vw      = -normalize(vPlayerPos);
    float camDist = length(vPlayerPos);

    /* ---- water body colour from depth behind the surface ---- */
    float delta = 0.0;
    if (isWater) {
        vec2 suv   = gl_FragCoord.xy / vec2(viewWidth, viewHeight);
        float bgLin = linZ(texture2D(depthtex1, suv).r, near, far);
        float myLin = linZ(gl_FragCoord.z, near, far);
        delta = max(bgLin - myLin, 0.0);

        float dd = clamp(delta / 7.0, 0.0, 1.0);
        vec3 wBody = mix(vec3(0.28, 0.58, 0.62), vec3(0.04, 0.16, 0.28), dd);

        float skyRaw = clamp((vLM.y - 0.03125) * 1.0695, 0.0, 1.0);
        float blkRaw = clamp((vLM.x - 0.03125) * 1.0695, 0.0, 1.0);
        float lite = skyRaw * (0.25 + 0.85 * dF) + blkRaw * 0.55;

        albedo = mix(albedo * 0.35, wBody, 0.72) * max(lite, 0.05);

#if WATER_QUALITY >= 1
        /* bright foam line where water meets blocks */
        float foam = 1.0 - smoothstep(0.0, 0.45, delta);
        albedo += vec3(0.55) * (foam * foam) * (0.25 + 0.75 * dF);
#endif
    }

    vec3 spec;
    vec3 emis;
    vec3 light = sceneLight(Nw, Vw, sunDirW, el, vLM, isWater ? 3.0 : 4.0,
                            rainStrength, wetness, heldBlockLightRange,
                            camDist, frameTimeCounter, spec, emis);

    vec3 color = albedo * light + albedo * emis + spec;

    float eyeSky = eyeBrightnessSmooth.y / 240.0;
    vec3 wdir = vPlayerPos / max(camDist, 1e-4);
    color = applyFog(color, wdir, camDist, sunDirW, el, rainStrength, eyeSky,
                     dF, isEyeInWater, blindness, darknessFactor, far);

    if (nightVision > 0.001) color *= 1.0 + nightVision * 0.9;

    gl_FragData[0] = vec4(color, tex.a * 0.92);
    gl_FragData[1] = vec4(Nw, 1.0);
    gl_FragData[2] = vec4(vLM.x, vLM.y, (isWater ? 3.0 : 4.0) / 5.0,
                          clamp(delta / 64.0, 0.0, 1.0));
}
