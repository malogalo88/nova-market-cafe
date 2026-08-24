#version 120

/*
    CineLite :: gbuffers_textured.fsh
    Unlit pass-through + fog. Material id 5 => skipped by composite effects.
*/

#include "/lib/settings.glsl"

varying vec2 vUV;
#include "/lib/lighting.glsl"

varying vec4 vColor;
varying vec3 vPlayerPos;

uniform sampler2D gtexture;

uniform mat4 gbufferModelViewInverse;
uniform vec3 sunPosition;
uniform float rainStrength;
uniform int isEyeInWater;
uniform float blindness;
uniform float darknessFactor;
uniform float far;
uniform vec2 eyeBrightnessSmooth;

void main(){
    vec4 tex = texture2D(gtexture, vUV);
    if (tex.a < 0.004) discard;

    vec3 color = tex.rgb * vColor.rgb * 0.92;

    vec3 sunDirW = mat3(gbufferModelViewInverse) * normalize(sunPosition);
    float el = sunDirW.y;
    float dF = dayFactor(el);

    float dist = length(vPlayerPos);
    float eyeSky = eyeBrightnessSmooth.y / 240.0;
    vec3 wdir = vPlayerPos / max(dist, 1e-4);
    color = applyFog(color, wdir, dist, sunDirW, el, rainStrength, eyeSky,
                     dF, isEyeInWater, blindness, darknessFactor, far);

    /* material id 5 -> composite skips contact shadows / bounce / SSR */
    gl_FragData[0] = vec4(color, tex.a);
    gl_FragData[1] = vec4(0.0);
    gl_FragData[2] = vec4(0.0, 0.0, 1.0, 0.0);
}
