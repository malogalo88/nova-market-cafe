#version 120

/*
    CineLite :: composite1.fsh
    Bloom horizontal blur: colortex3 -> colortex4.
    5 taps, quarter-effect radius. Compiles to a trivial write when
    BLOOM is OFF.
*/

#include "/lib/settings.glsl"

varying vec2 texcoord;

uniform sampler2D colortex3;
uniform float viewWidth;
uniform float viewHeight;

void main(){
#if BLOOM > 0
    vec2 px = 1.0 / vec2(viewWidth, viewHeight);
#if BLOOM == 2
    vec2 st = px * 1.6;
#else
    vec2 st = px;
#endif

    vec3 c = texture2D(colortex3, texcoord).rgb * 0.294;
    c += texture2D(colortex3, texcoord - vec2(st.x * 1.408, 0.0)).rgb * 0.233;
    c += texture2D(colortex3, texcoord + vec2(st.x * 1.408, 0.0)).rgb * 0.233;
    c += texture2D(colortex3, texcoord - vec2(st.x * 3.294, 0.0)).rgb * 0.120;
    c += texture2D(colortex3, texcoord + vec2(st.x * 3.294, 0.0)).rgb * 0.120;

    gl_FragData[4] = vec4(c, 1.0);
#else
    gl_FragData[4] = vec4(0.0);
#endif
}
