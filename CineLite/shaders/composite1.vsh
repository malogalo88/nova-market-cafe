#version 120

/*
    CineLite :: composite1.vsh
*/

varying vec2 texcoord;

void main(){
    gl_Position = ftransform();
    texcoord = gl_MultiTexCoord0.xy;
}
