#version 120

/*
    CineLite :: gbuffers_block.fsh
    Same fake-lighting model as terrain.
*/

#include "/lib/settings.glsl"

varying vec2 vUV;
#include "/lib/lighting.glsl"

varying vec2 vLM;
varying vec4 vColor;
varying vec3 vNormalW;
varying vec3 vPlayerPos;

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
    if (tex.a < 0.102) discard;

    vec3 sunDirW = mat3(gbufferModelViewInverse) * normalize(sunPosition);
    float el = sunDirW.y;
    float dF = dayFactor(el);

    vec3 albedo  = tex.rgb * vColor.rgb;
    vec3 Vw      = -normalize(vPlayerPos);
    float camDist = length(vPlayerPos);

    vec3 spec;
    vec3 emis;
    vec3 light = sceneLight(vNormalW, Vw, sunDirW, el, vLM, 0.0,
                            rainStrength, wetness, heldBlockLightRange,
                            camDist, frameTimeCounter, spec, emis);

    vec3 color = albedo * light + albedo * emis + spec;

    float eyeSky = eyeBrightnessSmooth.y / 240.0;
    vec3 wdir = vPlayerPos / max(camDist, 1e-4);
    color = applyFog(color, wdir, camDist, sunDirW, el, rainStrength, eyeSky,
                     dF, isEyeInWater, blindness, darknessFactor, far);

    if (nightVision > 0.001) color *= 1.0 + nightVision * 0.9;

    gl_FragData[0] = vec4(color, 1.0);
    gl_FragData[1] = vec4(vNormalW, 1.0);
    gl_FragData[2] = vec4(vLM, 0.0, 0.0);
}
