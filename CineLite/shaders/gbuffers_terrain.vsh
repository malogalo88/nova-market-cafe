#version 120

/*
    CineLite :: gbuffers_terrain.vsh
    World geometry. Applies cheap vertex wind for plants/leaves and
    passes everything the fake-lighting model needs.
*/

#include "/lib/settings.glsl"

varying vec2 vUV;

varying vec2 vLM;          /* lightmap coords        */
varying vec4 vColor;       /* biome tint + baked AO  */
varying vec3 vNormalW;     /* world-space normal     */
varying vec3 vPlayerPos;   /* camera-relative world pos */
varying float vMat;        /* material: 0 none | 1 plant | 2 leaves */

attribute vec4 mc_Entity;
attribute vec4 mc_midTexCoord;

uniform mat4 gbufferModelView;
uniform mat4 gbufferModelViewInverse;
uniform float frameTimeCounter;

#if WIND > 0
float windWave(vec3 p, float t){
    return sin(p.x * 1.7 + t * 1.9) * 0.50
         + sin(p.z * 1.3 - t * 1.4) * 0.30
         + sin((p.x + p.z) * 0.9 + t * 2.6) * 0.20;
}
#endif

void main(){
    vUV = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    vLM    = (gl_TextureMatrix[1] * gl_MultiTexCoord1).xy;
    vColor = gl_Color;

    vec4 viewPos   = gl_ModelViewMatrix * gl_Vertex;
    vec3 playerPos = (gbufferModelViewInverse * viewPos).xyz;
    vNormalW = normalize(mat3(gbufferModelViewInverse) * (gl_NormalMatrix * gl_Normal));

    vMat = 0.0;

#if WIND > 0
    /* top-vertex detection: sprite tops have smaller v than their centre */
    float id = mc_Entity.x;
    if (id > 10000.5 && id < 10001.5) {                 /* plants & crops */
        float top = clamp((mc_midTexCoord.t - gl_MultiTexCoord0.t) * 4.0, 0.0, 1.0);
        float w = windWave(playerPos, frameTimeCounter);
#if WIND == 1
        playerPos.x += w * 0.030 * top;
        playerPos.z += w * 0.020 * top;
#else
        playerPos.x += w * 0.050 * top;
        playerPos.z += w * 0.034 * top;
        playerPos.y += sin(frameTimeCounter * 1.3 + playerPos.x * 1.1) * 0.012 * top;
#endif
        vMat = 1.0;
    } else if (id > 10001.5 && id < 10002.5) {          /* leaves */
        float w = windWave(playerPos * 0.60, frameTimeCounter * 0.80);
#if WIND == 1
        playerPos += vec3(w * 0.020, sin(frameTimeCounter + playerPos.z * 1.4) * 0.008, w * 0.016);
#else
        playerPos += vec3(w * 0.034, sin(frameTimeCounter * 1.2 + playerPos.z * 1.8) * 0.014, w * 0.026);
#endif
        vMat = 2.0;
    }
#endif

    vPlayerPos = playerPos;
    gl_Position = gl_ProjectionMatrix * (gbufferModelView * vec4(playerPos, 1.0));
}
