#version 120

/*
    CineLite :: gbuffers_textured.vsh
    Unlit particles and overlays (portal particles, name tags...).
*/

#include "/lib/settings.glsl"

varying vec2 vUV;

varying vec4 vColor;
varying vec3 vPlayerPos;

uniform mat4 gbufferModelViewInverse;

void main(){
    vUV = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    vColor = gl_Color;
    vec4 viewPos = gl_ModelViewMatrix * gl_Vertex;
    vPlayerPos   = (gbufferModelViewInverse * viewPos).xyz;
    gl_Position  = gl_ProjectionMatrix * viewPos;
}
