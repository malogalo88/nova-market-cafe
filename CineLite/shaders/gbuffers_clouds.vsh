#version 120

/*
    CineLite :: gbuffers_clouds.vsh
*/

#include "/lib/settings.glsl"

varying vec2 vUV;

varying vec3 vPlayerPos;
varying vec4 vColor;

uniform mat4 gbufferModelViewInverse;

void main(){
    vUV = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    vColor = gl_Color;
    vec4 viewPos = gl_ModelViewMatrix * gl_Vertex;
    vPlayerPos   = (gbufferModelViewInverse * viewPos).xyz;
    gl_Position  = gl_ProjectionMatrix * viewPos;
}
