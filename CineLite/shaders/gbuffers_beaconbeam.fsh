#version 120

/*
    CineLite :: gbuffers_beaconbeam.fsh
    HDR beam so the bloom pass makes it glow softly.
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

void main(){
    vec4 tex = texture2D(gtexture, vUV);

    /* bright warm-white, above 1.0 on purpose (bloom threshold) */
    vec3 color = tex.rgb * vec3(2.60, 2.25, 1.75);

    float dist = length(vPlayerPos);
    vec3 wdir = vPlayerPos / max(dist, 1e-4);
    vec3 sunDirW = mat3(gbufferModelViewInverse) * normalize(sunPosition);
    float el = sunDirW.y;
    vec3 fc = fogColorFor(wdir, sunDirW, el, rainStrength, 1.0);
    color = mix(color, fc, fogFactor(dist, far, rainStrength) * 0.35);

    gl_FragData[0] = vec4(color, tex.a);
    gl_FragData[1] = vec4(0.0);
    gl_FragData[2] = vec4(0.0, 0.0, 1.0, 0.0);
}
