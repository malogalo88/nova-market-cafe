#version 120

/*
    CineLite :: gbuffers_skytextured.fsh
    Procedural sun + moon (with phase), and enhanced vanilla stars.
*/

#include "/lib/settings.glsl"

varying vec2 vUV;
#include "/lib/lighting.glsl"

varying vec3 vDir;
varying vec4 vColor;

uniform sampler2D gtexture;

uniform mat4 gbufferModelViewInverse;
uniform vec3 sunPosition;
uniform vec3 moonPosition;
uniform int moonPhase;
uniform float rainStrength;
uniform float frameTimeCounter;

void main(){
    vec3 d = normalize(vDir);
    vec3 sunDirW  = mat3(gbufferModelViewInverse) * normalize(sunPosition);
    vec3 moonDirW = mat3(gbufferModelViewInverse) * normalize(moonPosition);

    float cs = dot(d, sunDirW);
    float cm = dot(d, moonDirW);
    float dim = 1.0 - rainStrength * 0.9;

    /* Which celestial quad is this fragment on? Sun and moon are drawn as
       separate quads; anything else reaching this shader is a star quad.
       Disambiguating first prevents vanilla sun/moon textures leaking
      through around our procedural discs. */
    vec3 color;

    if (cs > cm) {
        /* ---- sun quad: procedural HDR disc ---- */
        float a = smoothstep(0.99930, 0.99975, cs);
        color = vec3(3.20, 2.55, 1.80) * a * dim;
    } else if (cm > 0.99930) {
        /* ---- moon quad: speckled surface + rough phase brightness ---- */
        float a = smoothstep(0.99930, 0.99975, cm);
        float illum = abs(float(moonPhase) - 4.0) / 4.0;   /* 1 full, 0 new */
        float crater = 0.86 + 0.14 * hash13(floor(d * 240.0));
        color = vec3(0.92, 0.94, 1.00) * (a * crater * mix(0.40, 1.0, illum) * 1.7 * dim);
    } else {
        /* ---- vanilla star quads, brightened + twinkle ---- */
        vec4 st = texture2D(gtexture, vUV);
        float tw = 0.75 + 0.25 * sin(frameTimeCounter * 2.4 + hash12(gl_FragCoord.xy) * 31.4);
        color = st.rgb * vColor.rgb * (0.9 + 1.5 * tw)
                * vec3(0.88, 0.93, 1.08) * dim;
    }

    gl_FragData[0] = vec4(color, 1.0);
}
