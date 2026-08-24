#version 120

/*
    CineLite :: gbuffers_weather.vsh
    Rain/snow with a subtle wind slant.
*/

#include "/lib/settings.glsl"

varying vec2 vUV;

varying vec3 vPlayerPos;
varying vec4 vColor;

uniform mat4 gbufferModelView;
uniform mat4 gbufferModelViewInverse;
uniform float frameTimeCounter;

void main(){
    vUV = (gl_TextureMatrix[0] * gl_MultiTexCoord0).xy;
    vColor = gl_Color;
    vec4 viewPos = gl_ModelViewMatrix * gl_Vertex;
    vec3 pp = (gbufferModelViewInverse * viewPos).xyz;

#if WIND > 0
#if WIND == 2
    pp.x += sin(frameTimeCounter * 1.6 + pp.y * 0.9) * 0.07;
#else
    pp.x += sin(frameTimeCounter * 1.6 + pp.y * 0.9) * 0.04;
#endif
#endif

    vPlayerPos  = pp;
    gl_Position = gl_ProjectionMatrix * (gbufferModelView * vec4(pp, 1.0));
}
