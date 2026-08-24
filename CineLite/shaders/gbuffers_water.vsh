#version 120

/*
    CineLite :: gbuffers_water.vsh
    Translucent pass (water, glass, ...). Water is flagged as material 3
    so composite.fsh can add fake reflections and refraction.
    No vertex wind here - waves are done per-pixel in the fragment stage.
*/

#include "/lib/settings.glsl"

varying vec2 vUV;

varying vec2 vLM;
varying vec4 vColor;
varying vec3 vNormalW;
varying vec3 vPlayerPos;
varying float vMat;        /* 3 = water | 4 = other translucent */

attribute vec4 mc_Entity;

uniform mat4 gbufferModelView;
uniform mat4 gbufferModelViewInverse;

void main(){
    vUV = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    vLM    = (gl_TextureMatrix[1] * gl_MultiTexCoord1).xy;
    vColor = gl_Color;

    vec4 viewPos   = gl_ModelViewMatrix * gl_Vertex;
    vec3 playerPos = (gbufferModelViewInverse * viewPos).xyz;
    vNormalW = normalize(mat3(gbufferModelViewInverse) * (gl_NormalMatrix * gl_Normal));

    float id = mc_Entity.x;
    if (id > 10003.5 && id < 10004.5) {
        vMat = 3.0;                                   /* water */
    } else {
        vMat = 4.0;                                   /* stained glass etc. */
    }

    vPlayerPos = playerPos;
    gl_Position = gl_ProjectionMatrix * (gbufferModelView * vec4(playerPos, 1.0));
}
