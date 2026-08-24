#version 120

/*
    CineLite :: final.fsh
    Last pass. Does the vertical bloom blur on the fly, adds bloom,
    filmic tonemap, cinematic color grading, night blue-shift,
    vignette and a touch of grain (which also kills 8-bit banding).
*/

#include "/lib/settings.glsl"
#include "/lib/lighting.glsl"

varying vec2 texcoord;

uniform sampler2D colortex0;      /* composed scene */
uniform sampler2D colortex4;      /* horizontally blurred bloom */

uniform mat4 gbufferModelViewInverse;
uniform vec3 sunPosition;
uniform float viewWidth;
uniform float viewHeight;
uniform float frameTimeCounter;
uniform float screenBrightness;
uniform float nightVision;
uniform int isEyeInWater;

void main(){
    vec3 color = texture2D(colortex0, texcoord).rgb;

    /* ---------------- bloom: vertical blur + add ---------------- */
#if BLOOM > 0
    vec2 px = 1.0 / vec2(viewWidth, viewHeight);
#if BLOOM == 2
    vec2 st = px * 1.6;
    float bStr = 0.30;
#else
    vec2 st = px;
    float bStr = 0.18;
#endif

    vec3 bloom = texture2D(colortex4, texcoord).rgb * 0.294;
    bloom += texture2D(colortex4, texcoord - vec2(0.0, st.y * 1.408)).rgb * 0.233;
    bloom += texture2D(colortex4, texcoord + vec2(0.0, st.y * 1.408)).rgb * 0.233;
    bloom += texture2D(colortex4, texcoord - vec2(0.0, st.y * 3.294)).rgb * 0.120;
    bloom += texture2D(colortex4, texcoord + vec2(0.0, st.y * 3.294)).rgb * 0.120;

    color += bloom * bStr;
#endif

    /* ---------------- exposure ---------------- */
    vec3 sunDirW = mat3(gbufferModelViewInverse) * normalize(sunPosition);
    float el = sunDirW.y;
    float nF = nightFactor(el);

    float expo = mix(0.92, 1.22, screenBrightness) * mix(1.00, 1.10, nF);
    if (nightVision > 0.001) expo *= 1.0 + nightVision * 1.6;
    color *= expo;

    /* ---------------- filmic tonemap (ACES fit) ---------------- */
    color = color * (2.51 * color + 0.03)
          / (color * (2.43 * color + 0.59) + 0.14);
    color = clamp(color, 0.0, 1.0);

#ifdef COLOR_GRADING
    /* gentle contrast S-curve */
    color = mix(color, color * color * (3.0 - 2.0 * color), 0.22);

    /* saturation */
    float l = luminance(color);
    color = mix(vec3(l), color, 1.07);

    /* split-tone: teal shadows, warm highlights (very subtle) */
    color += vec3(-0.012, 0.002, 0.016) * (1.0 - smoothstep(0.00, 0.50, l));
    color += vec3( 0.018, 0.006,-0.012) * smoothstep(0.55, 1.00, l);
#endif

    /* night blue-shift in the shadows only */
    float l2 = luminance(color);
    color = mix(color, vec3(l2) * vec3(0.80, 0.88, 1.14), nF * 0.20 * (1.0 - l2));

    if (isEyeInWater == 1) color *= vec3(0.84, 0.95, 1.07);

    /* ---------------- vignette ---------------- */
    vec2 vc = texcoord - 0.5;
    color *= 1.0 - 0.16 * smoothstep(0.35, 0.95, dot(vc, vc) * 2.4);

    /* ---------------- fine grain / dither ---------------- */
    color += (hash12(gl_FragCoord.xy + fract(frameTimeCounter) * 61.7) - 0.5) * 0.008;

    gl_FragData[0] = vec4(clamp(color, 0.0, 1.0), 1.0);
}
