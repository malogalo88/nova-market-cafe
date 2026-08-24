#version 120

/*
    CineLite :: gbuffers_weather.fsh
    Rain and snow: cool tint, light fog blending.
*/

#include "/lib/settings.glsl"

varying vec2 vUV;
#include "/lib/lighting.glsl"

varying vec3 vPlayerPos;
varying vec4 vColor;

uniform sampler2D gtexture;

uniform mat4 gbufferModelViewInverse;
uniform vec3 sunPosition;
uniform float rainStrength;
uniform float far;
uniform vec2 eyeBrightnessSmooth;

void main(){
    vec4 tex = texture2D(gtexture, vUV);
    if (tex.a < 0.01) discard;

    vec3 sunDirW = mat3(gbufferModelViewInverse) * normalize(sunPosition);
    float el = sunDirW.y;

    vec3 color = tex.rgb * vColor.rgb * vec3(0.74, 0.80, 0.92);

    /* rain falls in thick air - blend it into the fog a little */
    float dist = length(vPlayerPos);
    float eyeSky = eyeBrightnessSmooth.y / 240.0;
    vec3 wdir = vPlayerPos / max(dist, 1e-4);
    vec3 fc = fogColorFor(wdir, sunDirW, el, max(rainStrength, 0.4), eyeSky);
    color = mix(color, fc, fogFactor(dist, far, 1.0) * 0.55);

    gl_FragData[0] = vec4(color, tex.a * 0.82);
    gl_FragData[1] = vec4(0.0);
    gl_FragData[2] = vec4(0.0, 0.0, 1.0, 0.0);
}
