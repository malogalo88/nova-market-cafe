#version 120

/*
    CineLite :: composite.vsh
    Fullscreen pass-through vertex shader (shared by all post passes).
*/

varying vec2 texcoord;

void main(){
    gl_Position = ftransform();
    texcoord = gl_MultiTexCoord0.xy;
}
