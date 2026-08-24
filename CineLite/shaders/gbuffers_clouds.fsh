#version 120

/*
    CineLite :: gbuffers_clouds.fsh
    Keeps vanilla's cheap cloud geometry but re-lights it:
    day/night tint, sunset colouring, distance fade into the sky.
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
    if (tex.a < 0.02) discard;

    vec3 sunDirW = mat3(gbufferModelViewInverse) * normalize(sunPosition);
    float el = sunDirW.y;
    float dF = dayFactor(el);
    float duF = duskFactor(el);
    float rain = rainStrength;

    /* base: dark blue-grey at night, bright white at day */
    vec3 cc = mix(vec3(0.070, 0.082, 0.125), vec3(1.03, 1.01, 0.98), dF);

    /* sunset / sunrise pink-orange tint */
    cc = mix(cc, cc * vec3(1.30, 0.82, 0.60), duF * 0.55);

    /* rain flattens clouds */
    float lc = luminance(cc);
    cc = mix(cc, vec3(lc) * vec3(0.80, 0.83, 0.88), rain * 0.75);
    cc *= 1.0 - rain * 0.30;

    /* fade far clouds out so the sky stays clean */
    float dist = length(vPlayerPos);
    float fade = 1.0 - smoothstep(far * 0.40, far * 0.95, dist);

    vec3 wdir = vPlayerPos / max(dist, 1e-4);
    vec3 fc = fogColorFor(wdir, sunDirW, el, rain, 1.0);
    cc = mix(cc, fc, smoothstep(far * 0.30, far * 0.90, dist) * 0.7);

    gl_FragData[0] = vec4(cc, tex.a * fade * 0.88);
    gl_FragData[1] = vec4(0.0);
    gl_FragData[2] = vec4(0.0, 0.0, 1.0, 0.0);
}
