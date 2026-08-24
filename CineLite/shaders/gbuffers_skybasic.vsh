#version 120

/*
    CineLite :: gbuffers_skybasic.vsh
    Passes the world-space direction of each sky-dome vertex.
*/

#include "/lib/settings.glsl"

varying vec3 vDir;

uniform mat4 gbufferModelViewInverse;

void main(){
    gl_Position = ftransform();
    vDir = mat3(gbufferModelViewInverse) * (gl_ModelViewMatrix * gl_Vertex).xyz;
}
