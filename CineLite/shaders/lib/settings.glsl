#ifndef CINE_SETTINGS_INCLUDED
#define CINE_SETTINGS_INCLUDED

/*
    CineLite :: settings.glsl
    -------------------------------------------------------------------------
    All user-facing quality options. Defaults = MEDIUM preset
    (the recommended preset for Intel UHD integrated graphics).

    These defines are parsed by OptiFine / Iris and become the in-game
    shader options screen. Values inside the [] lists are selectable.
*/

/* Fake ray tracing master switch (bounce fill + coloured bounce light) */
#define FAKE_RAY_TRACING 2 // [0 1 2 3]

/* Softness of the wrapped-diffuse sun shading (fake shadows, no shadowmap) */
#define SHADOW_QUALITY 1 // [0 1 2]

/* Water waves / foam / refraction detail */
#define WATER_QUALITY 1 // [0 1 2]

/* Water reflections: 0 off | 1 sky-only | 2 +small SSR | 3 longer SSR */
#define REFLECTIONS 2 // [0 1 2 3]

/* Bloom: 0 off | 1 subtle | 2 brighter */
#define BLOOM 1 // [0 1 2]

/* Screen-space contact shadows + crevice AO */
#define CONTACT_SHADOWS 1 // [0 1 2]

/* Wind animation strength for plants and leaves */
#define WIND 1 // [0 1 2]

/* Atmospheric fog quality */
#define FOG_QUALITY 1 // [0 1 2]

/* Cinematic color grading (contrast/saturation/split-tone) */
#define COLOR_GRADING

#endif /* CINE_SETTINGS_INCLUDED */
