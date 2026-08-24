#version 120

/*
    CineLite :: gbuffers_skybasic.fsh
    Replaces the vanilla sky with the analytic procedural gradient.
    Zero texture lookups - pure math, extremely cheap.
*/

#include "/lib/settings.glsl"
#include "/lib/lighting.glsl"

varying vec3 vDir;                /* world-space direction of this sky vertex */

uniform mat4 gbufferModelViewInverse;
uniform vec3 sunPosition;
uniform float rainStrength;

void main(){
    vec3 dir    = normalize(vDir);
    vec3 sunDirW = mat3(gbufferModelViewInverse) * normalize(sunPosition);
    float el    = sunDirW.y;

    vec3 color = skyGradient(dir, sunDirW, el, rainStrength);

    gl_FragData[0] = vec4(color, 1.0);
}
