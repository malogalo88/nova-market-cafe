#version 120

/*
    CineLite :: gbuffers_terrain.fsh
    Forward "fake ray tracing" lighting for all opaque/cutout terrain.
    Writes:
      colortex0 = lit HDR colour
      colortex1 = world normal
      colortex2 = lightmap + material id
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
uniform float far;

void main(){
    vec4 tex = texture2D(gtexture, vUV);
    if (tex.a < 0.102) discard;                       /* cutout blocks */

    vec3 sunDirW = mat3(gbufferModelViewInverse) * normalize(sunPosition);
    float el = sunDirW.y;
    float dF = dayFactor(el);

    vec3 albedo  = tex.rgb * vColor.rgb;
    vec3 Vw      = -normalize(vPlayerPos);            /* surface -> camera */
    float camDist = length(vPlayerPos);

    vec3 spec;
    vec3 emis;
    vec3 light = sceneLight(vNormalW, Vw, sunDirW, el, vLM, 0.0,
                            rainStrength, wetness, heldBlockLightRange,
                            camDist, frameTimeCounter, spec, emis);

    /* subtle foliage translucency when looking towards the sun */
    float skyRaw = clamp((vLM.y - 0.03125) * 1.0695, 0.0, 1.0);
#if FAKE_RAY_TRACING >= 1
    if (vMat > 0.5) {
        float tr = pow(clamp(dot(Vw, -sunDirW), 0.0, 1.0), 3.0);
        light += sunColor(el) * tr * 0.22 * skyRaw * dF;
    }
#endif

    vec3 color = albedo * light + albedo * emis + spec;

    /* atmospheric fog (sky-matched colour, underwater / blindness aware) */
    float eyeSky = eyeBrightnessSmooth.y / 240.0;
    vec3 wdir = vPlayerPos / max(camDist, 1e-4);
    color = applyFog(color, wdir, camDist, sunDirW, el, rainStrength, eyeSky,
                     dF, isEyeInWater, blindness, darknessFactor, far);

    if (nightVision > 0.001) color *= 1.0 + nightVision * 0.9;

    gl_FragData[0] = vec4(color, 1.0);
    gl_FragData[1] = vec4(vNormalW, 1.0);
    gl_FragData[2] = vec4(vLM, 0.0, 0.0);             /* matId 0 */
}
