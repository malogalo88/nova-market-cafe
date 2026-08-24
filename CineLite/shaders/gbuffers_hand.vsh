#version 120

/*
    CineLite :: gbuffers_hand.vsh
    First-person hand and held items.
*/

#include "/lib/settings.glsl"

varying vec2 vUV;

varying vec2 vLM;
varying vec4 vColor;
varying vec3 vNormalW;
varying vec3 vPlayerPos;

uniform mat4 gbufferModelViewInverse;

void main(){
    vUV = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    vLM    = (gl_TextureMatrix[1] * gl_MultiTexCoord1).xy;
    vColor = gl_Color;

    vec4 viewPos   = gl_ModelViewMatrix * gl_Vertex;
    vPlayerPos     = (gbufferModelViewInverse * viewPos).xyz;
    vNormalW       = normalize(mat3(gbufferModelViewInverse) * (gl_NormalMatrix * gl_Normal));

    gl_Position = gl_ProjectionMatrix * viewPos;
}
