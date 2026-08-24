#version 120

/*
    CineLite :: gbuffers_skytextured.vsh
*/

#include "/lib/settings.glsl"

varying vec2 vUV;

varying vec3 vDir;
varying vec4 vColor;

uniform mat4 gbufferModelViewInverse;

void main(){
    vUV = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    vColor = gl_Color;
    gl_Position = ftransform();
    vDir = mat3(gbufferModelViewInverse) * (gl_ModelViewMatrix * gl_Vertex).xyz;
}
