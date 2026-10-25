// iso/accent — the one accent alias pair and the motion-at-rest constants, shared by the SVG iso kit and the interactive 3D
// prototype (output/vpk-html-v2/assembly-interactive/build.mjs imports ACCENT_TOKENS_CSS and REST_MOTION from here, so the
// two never drift). The pair is the VPK app's ADS orange (scripts/ads-tokens.mjs ADS_ACCENT_MAP checks it against
// @atlaskit/tokens): the app's bright orange #FCA700 (tailwind-theme orange-300) in both themes, which ADS names
// color.background.accent.orange.subtle in light and orange.bolder in dark, with dark ink on it (color.text in light,
// color.text.inverse in dark). palette.test.mjs computes the WCAG ratio of the pair in both themes and covers the allowlist.
// Import-free, so iso/inline.mjs could inline it by text; the inliner reads only the strings below.

export const ACCENT = Object.freeze({
	light: Object.freeze({ accent: "#fca700", ink: "#292a2e" }),
	dark: Object.freeze({ accent: "#fca700", ink: "#1f1f21" }),
});

// The token layer for the two aliases, one declaration per line so check-html's raw-colour scan reads them as token
// declarations (references/tokens.json carries the same values as illAccent / illAccentInk). The dark selector is the skill's
// own theme switch (styles.css [data-theme="dark"]).
export const ACCENT_TOKENS_CSS = [
	"/* the one accent alias pair (iso/accent.mjs): ADS orange bold background, inverse text on it (AA in both themes) */",
	":root {",
	`\t--ill-accent: ${ACCENT.light.accent};`,
	`\t--ill-accent-ink: ${ACCENT.light.ink};`,
	"}",
	'[data-theme="dark"] {',
	`\t--ill-accent: ${ACCENT.dark.accent};`,
	`\t--ill-accent-ink: ${ACCENT.dark.ink};`,
	"}",
].join("\n");

export const ACCENT_TOKENS = Object.freeze(["--ill-accent", "--ill-accent-ink"]);

// The spectrum rays (plan § 2 X: a light ray split into red, green and blue at a lens or prism). ADS icon accents red, green and
// blue in each theme (scripts/ads-tokens.mjs ADS_RAY_MAP; references/tokens.json illRayR / illRayG / illRayB). They are an
// explicit, scoped exception to the grayscale figure: only a `line` annotation with `spectrum` paints them, in role "ray", on a
// root marked data-vpk-iso-spectrum (audit A1; check-html ISO_RAY_TOKENS). Declared after the accent pair, one per line.
export const RAY = Object.freeze({
	light: Object.freeze({ r: "#c9372c", g: "#22a06b", b: "#357de8" }),
	dark: Object.freeze({ r: "#e2483d", g: "#2abb7f", b: "#4688ec" }),
});
export const RAY_TOKENS = Object.freeze({ r: "--ill-ray-r", g: "--ill-ray-g", b: "--ill-ray-b" });
export const RAY_TOKENS_CSS = [
	"/* the spectrum ray tokens (iso/accent.mjs RAY): ADS icon accents red, green and blue, rays only */",
	":root {",
	...Object.entries(RAY_TOKENS).map(([k, token]) => `\t${token}: ${RAY.light[k]};`),
	"}",
	'[data-theme="dark"] {',
	...Object.entries(RAY_TOKENS).map(([k, token]) => `\t${token}: ${RAY.dark[k]};`),
	"}",
].join("\n");

// Motion at rest (prototype runtime3d.js idle sway). The 3D figure sways its camera; the SVG cannot orbit, so it drifts the
// whole drawing by DRIFT_PX on a Lissajous path (x over DRIFT_X_MS, y over DRIFT_Y_MS) and bobs the focal part BOB_PX on y
// over BOB_PERIOD_MS. Any input stops it at once; it resumes IDLE_RESUME_MS after the last input. SWAY_DEG and SWAY_PERIOD_MS
// are the 3D camera's share of the same idea.
export const REST_MOTION = Object.freeze({
	IDLE_RESUME_MS: 3000,
	BOB_PX: 2,
	BOB_PERIOD_MS: 2500,
	DRIFT_PX: 1.5,
	DRIFT_X_MS: 8000,
	DRIFT_Y_MS: 11000,
	SWAY_DEG: 1.5,
	SWAY_PERIOD_MS: 8000,
});

// Selective colour (reference video: a white and very light grey scene in which only the current step's parts are orange). The
// parts that are not accented recede a little towards the paper through their line work: edges are the ink at 60% over the
// paper (it was 72%) and creases 38% (was 45%), so the accented part and its 2 px outline lead. The faces keep the shared tone
// map (tops lightest in both themes; anatomy and the iso kit resolve the same face tones, K13), which already reads as the
// reference's white and very light grey. The SVG kit (palette.mjs ISO_PRESET) and the 3D prototype (engine/css3d.mjs --vb-edge)
// paint the same strings.
export const NEUTRAL_LINES = Object.freeze({
	edge: "color-mix(in srgb, var(--ill-line) 60%, var(--paper))",
	crease: "color-mix(in srgb, var(--ill-line) 38%, var(--paper))",
});

// The accented part's three faces (prototype engine/css3d.mjs --vb-accent / --vb-accentLight / --vb-accentDark): the top takes
// the accent, the near side the accent pulled 62% towards the raised surface, the far side the accent pulled 70% towards ink.
// `edge` is the one stroke of an accented part (--vb-accentEdge): its outline, creases and marks are a darker shade of the accent
// itself (the barrel-sauna frame: orange lines on orange faces, never ink or grey), darker than the far face so it still draws the
// silhouette there. The SVG focal part (emit via palette.rolesFor), the hovered or selected part and the dropping entry layer
// (runtime-css) paint the same strings.
export const ACCENT_FACES = Object.freeze({
	top: "var(--ill-accent)",
	light: "color-mix(in srgb, var(--ill-accent) 62%, var(--surface-raised))",
	dark: "color-mix(in srgb, var(--ill-accent) 70%, var(--ill-line))",
	edge: "color-mix(in srgb, var(--ill-accent) 55%, var(--ill-line))",
});

// Cast shadows (reference video: soft, flat, pale grey shadows falling down and to the right from a sun at the upper left).
// One light for both engines. LIGHT_AZIMUTH is the ground-plane direction the light comes from, in the figure camera's frame
// (degrees from world +x towards +y, the frame in which the dimetric camera sits at azimuth 45); LIGHT_ELEVATION is its height
// above the ground. At the dimetric camera 190 / 75 puts a high sun behind the figure's upper left, so a shadow falls down and to
// the right and is about a quarter as long as its part is high (1 / tan 75 = 0.27). At 45 the exploded stack's ground shadow ran
// about twice the plate's depth past it; at 62 (0.53) the top shell's shadow still spilled past the base plate onto the floor at
// full gap, so a reader could not tell which part cast it (user image 14). At 75 every shadow sits close under its caster. The SVG kit projects flat shadow shapes onto
// the ground along this light (iso/solids.mjs castShadow), the 3D prototype aims its shadow-casting light the same way (kit x, y,
// z are three.js x, z, y). TONE is the light-theme fill (a grey 12% of the ink into the white paper: paler than every line, never the
// accent, never a filter, blur, gradient or opacity); DARK_TONE is the dark theme's (ADS elevation.surface.sunken, one subtle step below the dark surface).
// SOFT_RADIUS is the 3D figure's PCF filter radius (the SVG shadow is flat). Shadows of separate parts share one fill, so where
// they overlap they merge instead of darkening.
export const SHADOW = Object.freeze({
	LIGHT_AZIMUTH: 190,
	LIGHT_ELEVATION: 75,
	TONE: "color-mix(in srgb, var(--ill-line) 12%, var(--paper))",
	DARK_TONE: "var(--surface-sunken)",
	// A shadow that lands on a part's top face (a part above blocks the light) is one flat fill clipped to that face. RECEIVED is
	// the light theme's: the ink 12% into the raised surface the tops are drawn in, the same step below the top as the ground
	// shadow is below the paper. DARK_RECEIVED is the dark theme's: tone 1, one step below the dark tops (tone 2). On an accented
	// top (the focal part, a hovered part, the dropping entry layer) the shadow is RECEIVED_ACCENT, the accent pulled 85% towards
	// ink: a deeper orange instead of grey, and still lighter than the far-side face (70%), so the top keeps its edge.
	RECEIVED: "color-mix(in srgb, var(--ill-line) 12%, var(--surface-raised))",
	DARK_RECEIVED: "var(--ill-tone1)",
	RECEIVED_ACCENT: "color-mix(in srgb, var(--ill-accent) 85%, var(--ill-line))",
	SOFT_RADIUS: 4,
});

// The entry (reference videos: the barrel sauna and fall-bed step guides, trimmed by the user's redline). Each layer drops from
// DROP_Z world units above its rest over PART_MS on the ease-out curve and lands; its cast shadow slides in on the ground under
// it. No arrow and no ghost: the falling part shows the direction, and nothing paints over a moving part. The dropping layer is
// drawn in the accent (the current step) for ACCENT_HOLD_MS from its start, then hands off to the neutral tone map over
// HANDOFF_MS (the focal part keeps its accent). The hold is the same for every layer, the last included, so each hands back at
// the same point of its own drop (it was "when the next layer starts", which left the last one orange until it fully landed). TITLE_FADE_MS is the 3D tour title's grey-to-ink fade on a step change and STEP_CAMERA_MS the
// camera ease that frames the new step. The SVG kit (motion.mjs, emit.mjs, runtime-css.mjs) and the 3D prototype (build.mjs ->
// runtime3d.js) read these numbers, so the two entries match.
export const ENTRY = Object.freeze({
	PART_MS: 700,
	// Uniform gap between layer starts: each layer starts when the previous one is about 80% of the way down its ease-out drop,
	// so the drops overlap slightly and keep an even rhythm (an accelerating stagger read as slow, then rushed).
	STAGGER_MS: 180,
	DROP_Z: 30,
	// Accented for 180 ms from its start: the ease-out drop is 83% down by then and reads as landed (one stagger, so one layer
	// is the current step at a time), then a 300 ms fade back to neutral, ending 480 ms after the start, 220 ms before the drop ends.
	ACCENT_HOLD_MS: 180,
	HANDOFF_MS: 300,
	TITLE_FADE_MS: 400,
	STEP_CAMERA_MS: 600,
});
