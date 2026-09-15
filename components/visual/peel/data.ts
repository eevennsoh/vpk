/**
 * Peel — tuning surface, finish presets, and the derived scene geometry.
 *
 * Everything here is a plain value: no React, no three, no DOM. The scene reads
 * it, the pure motion model in `peel-model.ts` reads it, and the demo's GUI
 * writes it, so a number dialled in the demo panel is the same number you pass
 * back in as `tuning`.
 */

/**
 * Surface finish. These are print-shop terms on purpose — each one maps to a
 * real coating, and the shader parameters below are chosen to match how that
 * coating actually behaves rather than to hit an arbitrary look.
 */
export type PeelFinish = "foil" | "oil-slick" | "pearl" | "uv-gloss";

export const PEEL_FINISHES: readonly PeelFinish[] = ["foil", "oil-slick", "pearl", "uv-gloss"];

export interface PeelTuning {
	/**
	 * Film thickness, in interference orders across the angular range the
	 * cursor light sweeps. Roughly: how many times the spectrum repeats
	 * between the hot spot and the far edge of the sheet. Around 1 gives a
	 * single rainbow sweep; below 1 the coating is near-clear.
	 */
	filmScale: number;
	/**
	 * How far the gloss spreads off the ink. Spot UV varnish is applied over
	 * the printed areas only, so 0 masks the sheen to the dark parts of the
	 * artwork and 1 floods the whole sheet including the paper margin.
	 */
	glossCoverage: number;
	/** Specular intensity of the sheen. */
	sheenGain: number;
	/**
	 * Frequency of the anisotropic grain, applied as a small additive phase
	 * offset. Real foil has brushed structure and the eye reads that structure
	 * as "metal"; it is deliberately independent of `filmScale` so turning up
	 * the spectrum does not turn the mottle into stripes.
	 */
	grain: number;
	/** Ambient sheen present without a cursor, so a touch device is not left flat. */
	restSheen: number;

	/** World-unit height the grabbed corner rises to. See `PEEL_LIFT_HEIGHT`. */
	liftHeight: number;
	/**
	 * Corner-to-corner rock when the sheet is grabbed, in world units.
	 *
	 * This is the peel, and it is separate from `liftHeight` on purpose. Lift
	 * translates the whole sheet toward the camera, which scales it up; the
	 * reference barely scales at all. The pivot instead takes the grabbed
	 * corner up and the far corner down, so the sheet tilts in 3D while its
	 * footprint stays put. Set it to 0 and a grabbed sheet just floats.
	 */
	peelPivot: number;
	/** Peak z displacement of a travelling ripple, in world units. */
	waveAmplitude: number;
	/** Ripple wavelength as a fraction of the sheet's long edge. */
	waveLength: number;
	/** Ripple propagation speed, in sheet-widths per second. */
	waveSpeed: number;
	/**
	 * How hard out-of-plane bending gathers the surface in-plane. Paper does
	 * not stretch, so a bowing sheet contracts its flat footprint — this is
	 * what ripples the outline. Without it a wave is nearly invisible, because
	 * the camera looks straight down the axis the sheet is displaced along.
	 */
	waveShear: number;
	/** Amplitude of the billow while the sheet is held, scaled by drag speed. */
	flutter: number;
	/** Maximum tilt in radians the sheet takes on from drag velocity. */
	tilt: number;
	/**
	 * Peak in-plane lean, in radians, at `PEEL_TILT_REFERENCE_SPEED`.
	 *
	 * The pendulum. A carried stamp hangs from the point you grabbed it by, so
	 * it lags the hand and leans into the direction of travel; this is the only
	 * rotation channel the reference actually uses. Separate from `tilt`, which
	 * is out of plane.
	 */
	swing: number;

		/** Opacity of the contact shadow at rest. */
	shadowStrength: number;
}

/**
 * Width over height of the reference stamp's paper.
 *
 * Measured: averaging 151 at-rest frames of the reference recording, de-rotating
 * by its 5.9 degree resting angle and taking subpixel edges by coverage integral
 * puts the die-cut land lines at 196.24 x 257.21 device px = 98.12 x 128.61 CSS.
 * That is 0.7629.
 *
 * The ratio is not a free parameter, though: it is a consequence of a 0.75-aspect
 * print inside a uniform margin. 0.75 * (1 - 2 * PEEL_PAPER_MARGIN) + 2 *
 * PEEL_PAPER_MARGIN = 0.7618, which is what this constant records.
 */
export const PEEL_STAMP_RATIO = 0.7617;

/**
 * Die-cut perforation, measured off the reference.
 *
 * The bites are true semicircles centred exactly on the paper edge — phase-folding
 * all 13 periods of the top edge gives a FWHM of 6.61 device px against the 6.58 a
 * semicircle of the fitted radius predicts (ratio 1.740 vs sqrt(3) = 1.732 for a
 * zero offset; an outward-offset circle would read above 2).
 *
 * Hole centres sit at the midpoint of equal cells — fraction (k + 0.5) / COLUMNS
 * along the width — so every corner is a half-land and no hole lands on a corner.
 * Residual against that model is 0.70 px rms over the 18 holes of the left edge,
 * 0.59 px over the right.
 */

/** Holes along each horizontal edge. Counted individually on the reference. */
export const PEEL_PERF_COLUMNS = 14;

/** Holes along each vertical edge. */
export const PEEL_PERF_ROWS = 18;

/**
 * Bite radius in world units (the sheet is PEEL_SHEET_HEIGHT = 1 tall).
 *
 * 3.80 +/- 0.2 device px = 1.90 CSS px on the reference's 128.61 CSS paper, from a
 * 4-harmonic deconvolution of the edge profile against an analytic semicircular
 * bite chain, run on two differently-blurred versions of the frame (both r = 3.80,
 * PSF sigma 1.18 and 1.52). 1.90 / 128.61 = 0.01477.
 *
 * For reference, that is 0.269 of a pitch: pitch_x = PEEL_STAMP_RATIO / 14 =
 * 7.01 CSS, pitch_y = 1 / 18 = 7.15 CSS, leaving 3.21 / 3.35 CSS of land between
 * adjacent holes and half that at each corner.
 */
export const PEEL_PERF_RADIUS = 0.0148;

/**
 * Per-hole scatter, in world units, as the PEAK of a uniform distribution. The
 * die wanders, and the amount it wanders by is measured.
 *
 * This constant has been added, removed and added again, so here is the test that
 * settles it. Single-frame scatter cannot be trusted: 4:2:0 chroma is replicated
 * in 2x2 blocks, the edge climbs 0.103 px of screen y per column at -5.9 degrees,
 * and the chroma grid therefore beats against the 14.02 px tooth pitch. That beat
 * is systematic, so averaging frames does not remove it. What DOES separate a real
 * die from a grid artefact is moving the stamp: the reference is picked up and put
 * down again, so frames 20-170 and 600-700 show the same 14 teeth at pixel offsets
 * (98, 58) and (132, 80) — different chroma phase, same paper.
 *
 * Averaging each window separately, de-rotating both, and measuring every tooth
 * (centroid of the bite lobe for phase, apex-to-flanking-lands for depth):
 *
 *                       window A   window B   correlation   our render
 *   phase residual sd    0.425      0.342        0.80          0.207
 *   depth sd             0.336      0.484        0.50          0.077
 *
 * all in device px. A correlation of 0.80 across two independent pixel grids says
 * the position scatter is on the paper, not in the codec; 0.50 says most of the
 * depth scatter is too. Deconvolving the shared component out of each pair gives a
 * true sd of 0.35 px in phase and 0.28 px in depth, and the live render's own
 * numbers (0.207 / 0.077, where the shader is producing exactly zero) fix the
 * estimator floor that confirms it.
 *
 * Measuring the same edge in LUMA rather than chroma — full resolution, immune to
 * the 2x2 beat — is the independent check: the reference reads depth sd 0.262 px
 * against our 0.077, i.e. the same 0.25 px of real scatter.
 *
 * Uniform noise of peak A has sd A/sqrt(3), and one sheet-height is 257.2 device
 * px on this render, so 0.35 px sd -> peak 0.606 px -> 0.00236 world, and 0.26 px
 * sd -> peak 0.45 px -> 0.00175 world (11.8% of PEEL_PERF_RADIUS).
 *
 * The pass that deleted these read a folded-period statistic instead (fraction of
 * the period above the midline: 0.429 jittered against the reference's 0.464) and
 * concluded the die was perfect. A fold is the wrong instrument for this question —
 * it averages exactly the per-tooth variation being asked about, and phase scatter
 * shows up in it as a widened mouth that looks like the wrong radius. Two windows
 * at different pixel phases answer it directly. Keep the fold as the check on shape
 * (see sheetDistance) and these as the check on repetition.
 */
export const PEEL_PERF_PHASE_JITTER = 0.00236;

/** Radius scatter, peak of a uniform distribution. See the note above. */
export const PEEL_PERF_DEPTH_JITTER = 0.00175;

/**
 * Cream paper showing around the print, in world units, uniform on all four sides.
 *
 * 6.07 +/- 0.6 device px = 3.03 CSS on a 128.61 CSS paper. Found by aligning the
 * 384x512 source artwork to the de-rotated reference through 1-D row and column
 * luminance profiles: both axes converged independently on scale 0.4790 (row
 * correlation 0.982, column 0.912), which is the untouched 0.75-aspect source
 * placed at (20.48, 20.10) in a 226x287 frame. The margin is uniform in absolute
 * pixels, not as a fraction of each axis (x mean 6.15, y mean 5.98 device).
 */
export const PEEL_PAPER_MARGIN = 0.0236;

/**
 * Paper stock colour, i.e. the margin. Modal colour over the measured band,
 * sampling away from edge blur: (240, 224, 186).
 *
 * Deeper than the artwork's own inner cream (245, 232, 200) — the stock really is
 * a shade warmer than the print. The previous value here was
 * `color.background.accent.gray.subtlest` (#F0F1F2), which was invisible while the
 * print bled edge to edge and would read as a printer misregistration beside it.
 */
export const PEEL_PAPER_COLOUR = "#F0E0BA";

/**
 * Perspective field of view, in degrees. Wide enough that lifting the sheet
 * toward the camera reads as depth, narrow enough that a stamp sitting near the
 * edge of a scattered layout does not visibly keystone.
 */
export const PEEL_CAMERA_FOV = 28;

/**
 * Canvas overscan as a fraction of the sheet's height, on every side. The wave
 * throws geometry past the sheet's rest bounds and the lifted shadow spreads
 * further still, so the drawing surface has to be larger than the sheet. It
 * also supplies the 4px focus-ring gutter the house a11y rule asks for.
 *
 * Budget, in sheet-heights, at full lift:
 *   shadow   ~0.10  (cast offset 0.039 + its 0.062 penumbra, straight down)
 *   wave     ~0.26  (waveAmplitude, at a crest on the edge)
 *   gather   ~0.12  (the in-plane clamp in peel-material.ts)
 *
 * 0.9 clears the worst case with room to spare. It is generous on purpose: the
 * card is only 44px tall, so a fraction of *height* buys very few pixels here —
 * at the old 0.45 this was 20px of margin against an 18px shadow, and a crest
 * landing on the edge sheared straight off. Raising it costs a slightly larger
 * canvas and nothing else, because the camera distance is derived from it and
 * the sheet's on-screen size is unchanged.
 */
export const PEEL_OVERSCAN = 0.25;

/** The sheet is one world unit tall; width follows the source image's aspect. */
export const PEEL_SHEET_HEIGHT = 1;

/**
 * Camera distance that makes the overscanned viewport exactly
 * `1 + 2 * PEEL_OVERSCAN` world units tall at z = 0, so one world unit of sheet
 * lands on `stampPx` device pixels no matter what size the caller asks for.
 */
export const PEEL_CAMERA_DISTANCE =
	(PEEL_SHEET_HEIGHT * (1 + 2 * PEEL_OVERSCAN)) /
	(2 * Math.tan((PEEL_CAMERA_FOV * Math.PI) / 360));

/**
 * Lift height, as the z translation of the grabbed end of the sheet. Because
 * the camera is perspective, the growth comes free from that translation: scale
 * is `D / (D - L)`, so `L = D * (1 - 1 / scale)`.
 *
 * READ THIS WITH `peelPivot` — the two are solved together and neither is
 * meaningful alone. peel-material.ts displaces every vertex by
 * `uLift * (uLiftHeight * lifted + uPivot * (lifted - 0.55))`, where `lifted`
 * runs 0.12 at the far corner to 1.0 under the hand. So this constant is the
 * rise of the grabbed END, not of the sheet, and the sheet's mean rise — which
 * is what its projected size answers to — is about half of it.
 *
 * That is why the naming here misled three rounds of tuning. At 1.03 the whole
 * sheet grew by a mean linear 1.0107, i.e. 2.2% of area, not 6%. A blind
 * comparison of a carry frame against a rest frame put the reference at +5.4%
 * of area and ours at +2.6%, which matches that arithmetic to a third of a
 * point. Meanwhile our shadow was doing the full lift's worth of spreading, so
 * the transform said "barely lifted" while the shadow said "lifted high" — the
 * loudest single tell in the carry frame.
 *
 * 1.070 is the solution of that, jointly with dropping `peelPivot` from 0.16 to
 * 0.05. The sum `L + peelPivot` is what sets the sheet's corner-to-corner z
 * spread, and it is held at its previous 0.2476 to the fourth decimal: the
 * corner scales go from 0.981..1.056 to 1.001..1.079, a spread of 0.2176
 * against 0.2175. So the sheet lifts further without rocking any harder — the
 * far corner stops dipping below the page and the mean linear scale comes to
 * 1.0317, i.e. 6.5% of area by the same integral.
 *
 * Measured on the live route rather than left at the integral, because the
 * in-plane gather contracts the held sheet's footprint by about 1.2 points that
 * the integral does not know about: warm-pixel area rest to carry reads +3.7%
 * at 1.056 and +5.2% at 1.070, against the reference's +5.4%.
 *
 * The prior number came from tracking the warm paper pixels of the jaksenc
 * stamp through an unclipped, IN-PLACE peel (0.70-1.70s of stamp.mov), which is
 * a partial lift and reads 1.025 of area; a full carry is roughly twice that.
 * An earlier pass used 1.18, from a bounding box measured over a window the
 * stamp travelled and rotated through with its neutral shadow inside the
 * threshold — that one was an artefact of the measurement rather than motion.
 *
 * If this changes, `contactField`'s lift dilation in shadow-material.ts has to
 * change with it: the contact seam is glued to the sheet's projected edge, so
 * it dilates by half the mean linear growth, 0.0159 sheet-heights here.
 */
export const PEEL_LIFT_HEIGHT = PEEL_CAMERA_DISTANCE * (1 - 1 / 1.070);

/**
 * Visual durations, damping ratios and the spring helper live in
 * `peel-model.ts`: they are properties of the motion model rather than of the
 * print job, and keeping them there lets the model stay free of runtime
 * imports, which is what makes it loadable by Node's type-stripping test
 * runner.
 */

export const PEEL_TUNING_DEFAULTS: PeelTuning = {
	filmScale: 6,
	glossCoverage: 0.35,
	sheenGain: 1,
	grain: 22,
	restSheen: 0.06,

	liftHeight: PEEL_LIFT_HEIGHT,
	// The rock, solved jointly with PEEL_LIFT_HEIGHT above: their sum sets the
	// sheet's corner-to-corner z spread and is held at 0.2476, so cutting this
	// from 0.16 buys the lift the room to grow without the sheet rocking any
	// harder. Two things get better and nothing gets worse: the measured area
	// growth from rest to carry goes from +2.2% to +5.2% against the reference's
	// +5.4%, and the far corner stops dipping below the page plane (z -0.048 to
	// +0.002). Note the visible half of this knob is the keystone and only the
	// keystone — `bulk` is a pure z displacement, the shading reads the flex
	// term instead, so what the rock does on screen is the perspective divide.
	// The reference's carried sheet has almost none of it (0.19 deg of left/right
	// edge divergence against our 2.6), which is the standing argument for
	// cutting this rather than the lift whenever the pair has to give.
	peelPivot: 0.05,
	waveAmplitude: 0.062,
	// About one wave across the sheet. The reference bows its whole outline
	// rather than running a train of ripples down it, and shorter wavelengths
	// read as vibration instead of as paper bending.
	waveLength: 1.05,
	waveSpeed: 1.9,
	// The gather scales as amplitude squared — gradient times height — so it
	// falls away much faster than the amplitude does, and is the term that
	// decides whether the outline bows at all. Calibrated against the
	// reference: enough that the edge visibly bends, little enough that the
	// paper margin stays an even border instead of rippling like cloth.
	waveShear: 1.1,
	flutter: 0.034,
	// Out-of-plane lean from drag velocity, all but switched off. Measured: the
	// reference's silhouette keystone changes by 0.0 +- 0.2 percentage points
	// between held-still and held-moving, i.e. it does not tilt out of plane
	// while carried at all. Ours at the old 0.26 rad gained +1.7 pp (2.8% to
	// 4.5%, peaking at 7.5%) and pushed the left/right edge slopes 6.8 deg
	// apart where the reference holds 0.19 deg. Scaling 0.26 down to the
	// +-0.3 pp detection floor gives <= 0.04; the data literally supports 0,
	// and 0.04 keeps a sub-threshold hint of the sheet leaning into the drag.
	tilt: 0.04,
	// In-plane swing at 900 CSS px/s. Measured gain k = 0.00420 deg per CSS
	// px/s on the reference, so 900 * 0.00420 = 3.78 deg = 0.0660 rad.
	swing: 0.066,

	// Contact-shadow alpha at the bottom edge, and the amplitude the cast term
	// in shadow-material.ts is derived from. The reference darkens its page by
	// 29 levels out of 250 one pixel below the die-cut at rest — median over
	// every land column on the bottom edge, three frames (40 / 90 / 700), which
	// agree to 1.5 levels.
	//
	// Calibrated on the live route at 2x rather than argued. At 0.172 the same
	// estimator read 28.0 levels there, already within 4% of the reference, but
	// the bottom falloff length came down with it (0.0106 -> 0.0091, because the
	// reference decays 2.39px where we ran 2.88), and a shorter exponential is
	// lower at the pixel where it is read: 0.172 x 1.036 / 0.90 = 0.193 holds
	// the peak while the tail tightens. It was 0.042 three rounds ago, which
	// produced 11 measured levels.
	//
	// Re-profiled at 0.193 on the live route, median page darkening one device
	// px outside the die-cut's land envelope, reference in brackets:
	//   at rest  S 28.9 [29.0]  W  9.0 [ 8.7]  E  6.1 [ 4.6]  N 2.9 [1.8]
	//   held     S 43.9 [43.5]  W 15.0 [11.7]  E 15.1 [18.3]  N 3.0 [2.0]
	//   reach at rest  S 12 [11]  W 6 [6]   E  5 [ 5]  N 2 [2]
	//   reach held     S 27 [28]  W 9 [11]  E 16 [20]  N 3 [5]
	// Every side is monotonic from the die-cut outward in both states, notch
	// interiors included, and the longest flat run anywhere is 1px. The
	// residuals are lateral and in the far tail: the held east penumbra is 4px
	// short, the held west 3 levels heavy at the edge, and the held bottom runs
	// 3 levels heavy between 15 and 22px out, where a smoothstep ramp is fuller
	// in the middle than the reference's.
	shadowStrength: 0.193,
};

/**
 * Per-finish overrides. Only the optical parameters move: the motion of a sheet
 * of paper does not depend on what was printed on it.
 */
export const PEEL_FINISH_PRESETS: Readonly<Record<PeelFinish, Partial<PeelTuning>>> = {
	/** Hot-stamped metallic leaf: tight spectrum, hard specular, strong grain. */
	foil: {
		filmScale: 6,
		glossCoverage: 0.35,
		sheenGain: 1,
		grain: 22,
	},
	/** Thick, uneven film. Broad hue sweeps and low specular, like petrol on water. */
	"oil-slick": {
		filmScale: 14,
		glossCoverage: 0.8,
		sheenGain: 0.78,
		grain: 12,
		restSheen: 0.16,
	},
	/** Pearlescent varnish: a single pale hue zone, soft and wide. */
	pearl: {
		filmScale: 2,
		glossCoverage: 0.65,
		sheenGain: 0.62,
		grain: 20,
		restSheen: 0.12,
	},
	/** Clear spot gloss with no pigment. Almost no hue shift, sharp highlight. */
	"uv-gloss": {
		filmScale: 0.8,
		glossCoverage: 0,
		sheenGain: 1.25,
		grain: 46,
		restSheen: 0.04,
	},
};

/**
 * Reduce Motion overrides. The wave, the flutter, the tilt and the swing are
 * autonomous motion and all go to zero — the sheet keeps its resting angle but
 * stops leaning as it is carried. Lift survives as a static offset, because a
 * sheet that does not come off the page while you drag it is a broken
 * affordance rather than a calmer one, and the sheen survives at reduced gain
 * because it answers the cursor directly.
 */
export const PEEL_REDUCED_MOTION_TUNING: Partial<PeelTuning> = {
	waveAmplitude: 0,
	waveShear: 0,
	flutter: 0,
	tilt: 0,
	swing: 0,
	liftHeight: PEEL_LIFT_HEIGHT * 0.45,
	// Held at the same 0.44 fraction of the default rock it always was, now that
	// the default is 0.05 rather than 0.16.
	peelPivot: 0.022,
	sheenGain: 0.6,
};

export function resolvePeelTuning(
	finish: PeelFinish = "foil",
	overrides?: Partial<PeelTuning>,
	reducedMotion = false,
): PeelTuning {
	return {
		...PEEL_TUNING_DEFAULTS,
		...PEEL_FINISH_PRESETS[finish],
		...(reducedMotion ? PEEL_REDUCED_MOTION_TUNING : null),
		...overrides,
	};
}
