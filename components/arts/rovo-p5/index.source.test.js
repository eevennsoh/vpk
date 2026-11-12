const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const read = (relativePath) => fs.readFileSync(path.join(__dirname, relativePath), "utf8");

const SHELL_SOURCE = read("index.tsx");
const CANVAS_SOURCE = read("rovo-p5-canvas.tsx");
const CONTROLS_SOURCE = read("rovo-p5-controls.tsx");
const SKETCH_SOURCE = read("lib/rovo-p5-sketch.ts");
const PARAMS_SOURCE = read("data/rovo-p5-params.ts");
const LOGO_CLOUD_SOURCE = read("lib/rovo-logo-point-cloud.ts");
const LOGO_3D_SOURCE = read("lib/rovo-logo-3d.ts");
const THEME_HOOK_SOURCE = read("hooks/use-system-theme-preference.ts");
const BACKDROP_SOURCE = read("data/rovo-p5-backdrop.ts");
const ASSIGNMENT_SOURCE = read("lib/teamwork-graph-assignment.ts");
const TIMELINE_SOURCE = read("lib/rovo-p5-timeline.ts");
const TRANSPORT_SOURCE = read("rovo-p5-transport.tsx");

test("p5 never reaches the server render", () => {
	// p5 touches `window` at import time, so a static import anywhere in the
	// server-rendered tree breaks `pnpm run build:export`.
	assert.match(
		SHELL_SOURCE,
		/dynamic\(\(\) => import\("@\/components\/arts\/rovo-p5\/rovo-p5-canvas"\),\s*\{\s*ssr: false,?\s*\}\)/,
	);
	assert.doesNotMatch(SHELL_SOURCE, /from "p5"/);
	assert.match(CANVAS_SOURCE, /import\("p5"\)\s*\n?\s*\.then/);
	// A failed chunk load must not become an unhandled rejection.
	assert.match(CANVAS_SOURCE, /\.catch\(\(error: unknown\) =>/);
	assert.match(CANVAS_SOURCE, /^import type p5 from "p5";$/m);
});

test("the sketch pauses instead of looping when motion is reduced", () => {
	assert.match(CANVAS_SOURCE, /useReducedMotion/);
	assert.match(SKETCH_SOURCE, /if \(host\.isReducedMotion\(\)\) instance\.noLoop\(\);/);
	// A paused sketch does not repaint itself, so parameter changes and resizes
	// have to drive an explicit redraw or the controls appear dead.
	assert.match(CANVAS_SOURCE, /if \(!ready \|\| !reducedMotion\) return;\s*\n\s*instanceRef\.current\?\.redraw\(\);/);
	assert.match(CANVAS_SOURCE, /if \(reducedMotionRef\.current\) instance\.redraw\(\);/);
	// Neither the sketch clock nor the camera spin may advance, and the idle
	// drift must be flat, while paused.
	assert.match(SKETCH_SOURCE, /if \(!reduced\) \{\s*\n\s*time \+= params\.speed;\s*\n\s*spin \+= params\.spin;\s*\n\s*\}/);
	assert.match(SKETCH_SOURCE, /const wobble = reduced \? 0 :/);
	assert.match(PARAMS_SOURCE, /motionOnly: true/);
	assert.match(CONTROLS_SOURCE, /control\.motionOnly && reducedMotion/);
});

test("the draw loop assigns fill colour per tier run, not per particle", () => {
	// p5 2.x `point()` allocates a Shape and a Vector per call, which is
	// unusable at 10k particles; drawing goes through the raw 2D context and
	// relies on the cloud being pre-sorted into contiguous colour runs.
	assert.doesNotMatch(SKETCH_SOURCE, /instance\.point\(/);
	assert.match(SKETCH_SOURCE, /for \(const bucket of cloud\.buckets\) \{[\s\S]{0,900}?context\.fillStyle =/);

	// Two assignments per facet: dust, then the bright/star tiers which share a
	// colour and differ only in size. Four facets, so eight per frame.
	const bucketLoop = SKETCH_SOURCE.slice(
		SKETCH_SOURCE.indexOf("const color = ROVO_FACET_COLORS[bucket.facet]"),
	);
	assert.equal(
		(bucketLoop.match(/context\.fillStyle\s*=/g) ?? []).length,
		2,
		"expected exactly two fillStyle assignments inside the facet loop",
	);

	// Every canvas state assignment forces the 2D context to flush and rebuild
	// its paint state. Doing that 10k times a frame pegs the renderer, so the
	// per-particle plot must make none at all — depth, twinkle, and starlight
	// all ride on the fillRect size instead.
	const plotStart = SKETCH_SOURCE.indexOf("const plot = (index: number");
	// Ends where the per-facet run loop begins; that loop is *allowed* to set
	// fillStyle, and anchoring past it would make this assertion vacuous.
	const plotEnd = SKETCH_SOURCE.indexOf("for (const bucket of cloud.buckets) {", plotStart);
	assert.ok(plotStart >= 0 && plotEnd > plotStart, "could not locate the per-particle plot function");
	const plotBody = SKETCH_SOURCE.slice(plotStart, plotEnd);
	for (const property of ["fillStyle", "globalAlpha", "strokeStyle", "filter", "globalCompositeOperation"]) {
		assert.doesNotMatch(
			plotBody,
			new RegExp(`\\.${property}\\s*=`),
			`${property} must not be assigned per particle`,
		);
	}
	assert.match(plotBody, /context\.fillRect\(/);
});

test("particles carry their own orbit, twinkle, and brightness tier", () => {
	// The reference sketches read as a galaxy because each particle traces a
	// path that trails smear into arcs, and because a faint majority is
	// punctuated by a bright few — not because the field itself is noisier.
	assert.match(SKETCH_SOURCE, /const hash = Math\.imul\(index \+ 1, 2246822519\) >>> 0;/);
	assert.match(SKETCH_SOURCE, /worldX \+= orbitRadius \* Math\.cos\(angle\);/);
	assert.match(SKETCH_SOURCE, /worldZ \+= orbitRadius \* Math\.cos\(angle \* 0\.7 \+ phase\);/);
	assert.match(SKETCH_SOURCE, /const twinkleMul = 1 \+ twinkleAmp \* Math\.sin\(t \* 2\.1 \+ twinklePhase\);/);

	// Tier shares must leave a genuine minority of bright points.
	const dustShare = Number(SKETCH_SOURCE.match(/const DUST_SHARE = ([\d.]+);/)?.[1]);
	const midShare = Number(SKETCH_SOURCE.match(/const MID_SHARE = ([\d.]+);/)?.[1]);
	assert.ok(dustShare > 0.5 && dustShare < 0.9, `dust share ${dustShare} should be the majority`);
	assert.ok(dustShare + midShare < 1, "some points must remain in the star tier");

	// Trails are what turn the orbits into filaments, so they ship on.
	assert.match(PARAMS_SOURCE, /trails: true/);
	// Shimmer freezes when motion is reduced; a frozen clock would otherwise
	// leave the orbits as a fixed scatter across the mark.
	assert.match(SKETCH_SOURCE, /const shimmerAmp = reduced \? 0 : params\.shimmer;/);
});

test("particle count is pure density, independent of the graph's shape", () => {
	// Each particle is assigned to the graph independently, so changing the
	// count changes how densely the same structure is sampled and nothing else.
	// The assignment has to be rebuilt whenever either side moves, or it can
	// index a node the current graph does not have.
	assert.match(SKETCH_SOURCE, /assignment && index < assignment\.count/);
	assert.match(
		CANVAS_SOURCE,
		/assignmentRef\.current = assignParticlesToGraph\(\{[\s\S]*?\}, \[params\.particles, params\.graphNodes\]\);/,
	);
	// Rebuilding the graph itself on every render would restart the layout and
	// throw away the settling motion.
	assert.match(CANVAS_SOURCE, /graphRef\.current = createTeamworkGraph\(\{[\s\S]*?\}, \[params\.graphNodes\]\);/);
});

test("the mark morphs into the teamwork graph, not the reference flow field", () => {
	// The flow field was scaffolding from the original golfed sketch; the
	// destination is now the graph, so none of its maths may linger.
	for (const dead of ["waveFreq", "ripple", "FLOW_CENTER_D", "REFERENCE_COUNT"]) {
		assert.doesNotMatch(SKETCH_SOURCE, new RegExp(`\\b${dead}\\b`), `${dead} should be gone`);
		assert.doesNotMatch(PARAMS_SOURCE, new RegExp(`key: "${dead}"`), `${dead} control should be gone`);
	}

	// Both ends of the morph are real 3D points now, so z interpolates like x
	// and y rather than collapsing to the flat field's plane.
	assert.match(SKETCH_SOURCE, /let worldZ = logoZ \+ \(graphZ - logoZ\) \* blend;/);
	assert.match(SKETCH_SOURCE, /relaxTeamworkGraph\(graph, \{/);
});

test("graph communities inherit the mark's facets", () => {
	// The whole point of the morph: an orange facet point becomes an orange
	// node cluster, so the brand reads across the whole transition.
	assert.match(CANVAS_SOURCE, /communityCount: ROVO_FACET_COUNT/);
	assert.match(ASSIGNMENT_SOURCE, /const edgeList = communityEdges\[facet\]/);
	assert.match(ASSIGNMENT_SOURCE, /const nodeList = communityNodes\[facet\]/);
});

test("the layout is relaxed per frame but only while the graph is showing", () => {
	// Running the sim behind a mark nobody can see is wasted work, and a frozen
	// clock must not advance it either.
	assert.match(SKETCH_SOURCE, /if \(graph && form > 0\.01 && !reduced\) \{/);
	assert.match(SKETCH_SOURCE, /const travelRate = reduced \? 0 :/);
	// Accretion comes from the director while it runs; the manual fallback still
	// shows a finished graph when paused, never a half-built one.
	assert.match(SKETCH_SOURCE, /const phase = direction\s*\n\s*\? direction\.growth/);
	assert.match(SKETCH_SOURCE, /reduced \|\| cycle <= 0/);
});

test("the mark is read from the shared logo data rather than re-inlined", () => {
	assert.match(
		LOGO_CLOUD_SOURCE,
		/import \{ ROVO_LOGO_PATHS, ROVO_LOGO_VIEWBOX \} from "@\/components\/ui\/data\/rovo-logo";/,
	);
	assert.doesNotMatch(LOGO_CLOUD_SOURCE, /<svg|<path|\bd="M/);
	assert.doesNotMatch(LOGO_CLOUD_SOURCE, /#FCA700|#1868DB|#AF59E1|#6A9A23/);
});

test("the canvas tears down its p5 instance and resize observer", () => {
	assert.match(CANVAS_SOURCE, /instanceRef\.current\?\.remove\(\);/);
	assert.match(CANVAS_SOURCE, /return \(\) => observer\.disconnect\(\);/);
	// The p5 import is async, so a StrictMode double-mount can resolve after
	// cleanup has already run.
	assert.match(CANVAS_SOURCE, /if \(disposed\) return;/);
});

test("every parameter is exposed through the shared GUI panel", () => {
	assert.match(CONTROLS_SOURCE, /from "@\/components\/utils\/gui"/);

	const declared = [...PARAMS_SOURCE.matchAll(/^\t(\w+): (?:number|boolean);$/gm)].map(
		(match) => match[1],
	);
	assert.ok(declared.length >= 14, `expected the full parameter set, saw ${declared.length}`);

	const wired = new Set([...PARAMS_SOURCE.matchAll(/key: "(\w+)"/g)].map((match) => match[1]));
	for (const key of declared) {
		assert.ok(wired.has(key), `parameter "${key}" has no control in ROVO_P5_SECTIONS`);
	}
});

test("typed parameter values are clamped to their slider range", () => {
	// `GUI.Control` pairs a bounded slider with a free-text box that commits any
	// parseable number, so an unclamped 1000% flings the sketch off-screen.
	assert.match(PARAMS_SOURCE, /export function clampRovoP5Param/);
	assert.match(PARAMS_SOURCE, /Math\.min\(range\.max, Math\.max\(range\.min, value\)\)/);
	assert.match(
		read("hooks/use-rovo-p5-params.ts"),
		/const value = clampRovoP5Param\(action\.key, action\.value\);/,
	);
	// Values also snap to the declared step: repeated arrow-key nudges otherwise
	// accumulate float error that renders as "55.000000" in a percent control.
	assert.match(PARAMS_SOURCE, /Math\.round\(\(clamped - range\.min\) \/ range\.step\)/);
	assert.match(PARAMS_SOURCE, /toFixed\(precisionOf\(range\.step\)\)/);
});

test("the mark is un-projected onto real cube faces, not faked with a z offset", () => {
	// The Rovo mark is drawn as an isometric cube, so making it 3D means
	// inverting that projection rather than extruding a flat silhouette.
	assert.match(LOGO_3D_SOURCE, /export const HOME_PITCH = Math\.atan\(1 \/ Math\.SQRT2\);/);
	assert.match(LOGO_3D_SOURCE, /const FACET_PLANES/);
	assert.match(SKETCH_SOURCE, /unprojectFacetPoint\(/);

	// Un-projecting with the inverse of the render rotation is what guarantees
	// the cube re-projects onto the original mark at the home orientation.
	assert.match(LOGO_3D_SOURCE, /rotateFromCamera\(1, 0, 0, HOME_YAW, HOME_PITCH\)/);
	assert.match(LOGO_3D_SOURCE, /rotateFromCamera\(0, 0, -1, HOME_YAW, HOME_PITCH\)/);

	// One scratch vector reused across particles, not an allocation per point.
	assert.match(SKETCH_SOURCE, /const world: Vec3 = \{ x: 0, y: 0, z: 0 \};/);
});

test("the camera can be orbited by dragging and is reset with the parameters", () => {
	assert.match(CANVAS_SOURCE, /container\.setPointerCapture\(event\.pointerId\);/);
	assert.match(CANVAS_SOURCE, /orbit\.yaw \+= \(event\.clientX - lastX\) \* ORBIT_SENSITIVITY;/);
	assert.match(CANVAS_SOURCE, /MAX_ORBIT_PITCH/);
	assert.match(CANVAS_SOURCE, /orbitRef\.current = \{ yaw: 0, pitch: 0 \};/);
	// touch-none keeps a drag from scrolling the page on touch devices.
	assert.match(CANVAS_SOURCE, /touch-none/);
});

test("the surface fills its container rather than collapsing to intrinsic width", () => {
	// Regression: the gallery preview centres demos in a flex row. Because the
	// canvas and the panel are both absolutely positioned, the only in-flow
	// content is the header, so without `w-full` the section collapsed to the
	// header's width and the art rendered as a narrow cropped column.
	assert.match(SHELL_SOURCE, /className=\{cn\("relative min-h-svh w-full overflow-hidden/);
	assert.match(SHELL_SOURCE, /<RovoP5Canvas\s*\n\s*backdrop=\{backdrop\}\s*\n\s*className="absolute inset-0"/);
	assert.match(SHELL_SOURCE, /pointer-events-none absolute inset-x-0 bottom-\d+ flex justify-end/);
	// A nested `main` would trip three axe landmark rules against the app shell.
	assert.doesNotMatch(SHELL_SOURCE, /\n\s*<main[\s>]/);
});

test("Rovo p5 rejects caller children that its fixed art composition discards", () => {
	assert.match(
		SHELL_SOURCE,
		/export type RovoP5Props = Omit<React\.ComponentProps<"section">, "children"> & \{\s*readonly children\?: never;/u,
	);
});

test("the control panel follows the OS colour scheme", () => {
	// ADS resolves tokens from one global `data-color-mode`, so a scoped
	// override cannot theme the panel on its own.
	assert.match(THEME_HOOK_SOURCE, /setTheme\("system"\)/);
	assert.match(THEME_HOOK_SOURCE, /if \(hasStoredThemePreference\(\)\) return;/);
	assert.match(SHELL_SOURCE, /useSystemThemePreference\(\);/);
	// The panel surface must stay a semantic token, not a hardcoded colour.
	assert.match(SHELL_SOURCE, /bg-surface-overlay/);
	assert.doesNotMatch(SHELL_SOURCE, /bg-white|bg-\[#fff/i);
});

test("trails cannot burn a permanent smear into the backdrop", () => {
	// Canvas compositing is 8-bit, so a repeated proportional fade hits a
	// rounding fixed point and stops converging. Two things keep the residue
	// imperceptible, and both are load-bearing:
	//
	// 1. `destination-out` scales alpha rather than blending RGB toward the
	//    backdrop, so the floor is expressed as opacity over a transparent
	//    canvas instead of a colour offset baked into the pixels.
	assert.match(SKETCH_SOURCE, /context\.globalCompositeOperation = "destination-out";/);
	assert.match(SKETCH_SOURCE, /context\.fillStyle = `rgba\(0, 0, 0, \$\{params\.trailFade\}\)`;/);
	// The mode must be restored, or every particle would erase instead of paint.
	assert.match(SKETCH_SOURCE, /context\.globalCompositeOperation = "source-over";/);
	assert.doesNotMatch(SKETCH_SOURCE, /backgroundFill/);

	// 2. The fade is floored. `round(a * (1 - fade))` settles at 5/255 for a
	//    0.1 fade — plainly visible as a grey disc — but at 1/255 from ~0.28.
	//    Below 0.2 the slider would let that smear be dialled straight back in.
	const control = PARAMS_SOURCE.slice(PARAMS_SOURCE.indexOf('key: "trailFade"'));
	const min = Number(control.match(/min: ([\d.]+)/)?.[1]);
	const fallback = Number(PARAMS_SOURCE.match(/trailFade: ([\d.]+),/)?.[1]);
	assert.ok(min >= 0.2, `trail fade minimum ${min} allows a permanent smear`);
	assert.ok(fallback >= 0.25, `trail fade default ${fallback} allows a visible smear`);

	// Guard the reasoning itself: settle the recurrence the way canvas does.
	const floorFor = (fade) => {
		let alpha = 255;
		let previous = -1;
		while (alpha !== previous) {
			previous = alpha;
			alpha = Math.round(alpha * (1 - fade));
		}
		return alpha;
	};
	assert.ok(floorFor(fallback) <= 1, `default fade settles at ${floorFor(fallback)}/255`);
	assert.ok(floorFor(min) <= 2, `minimum fade settles at ${floorFor(min)}/255`);
});

test("the cycle plays itself, with a transport to pause and scrub", () => {
	// The point of the timeline: you should not have to drag a slider to see
	// the transition.
	assert.match(PARAMS_SOURCE, /timeline: true,/);
	assert.match(SHELL_SOURCE, /const \[playing, setPlaying\] = useState\(true\);/);
	assert.match(TRANSPORT_SOURCE, /aria-label=\{playing \? "Pause the cycle" : "Play the cycle"\}/);
	assert.match(TRANSPORT_SOURCE, /aria-label="Restart the cycle"/);
	assert.match(TRANSPORT_SOURCE, /aria-label="Scrub the cycle"/);

	// Wall-clock deltas, capped, so a throttled tab neither drifts nor leaps
	// several stages when it comes back.
	assert.match(CANVAS_SOURCE, /const delta = Math\.min\(MAX_FRAME_SECONDS, \(now - previous\) \/ 1000\);/);
	// Pausing must forget its timestamp or the next frame jumps.
	assert.match(CANVAS_SOURCE, /playingRef\.current = playing;\s*\n\s*lastFrameRef\.current = null;/);
});

test("the timeline owns its channels and the panel says so", () => {
	// A live-looking slider the sketch is ignoring is worse than a greyed one.
	assert.match(CONTROLS_SOURCE, /if \(control\.directed && params\.timeline\) return true;/);
	assert.match(CANVAS_SOURCE, /if \(!paramsRef\.current\.timeline\) return null;/);

	for (const key of ["form", "spin", "tilt", "perspective", "extrude"]) {
		const control = PARAMS_SOURCE.slice(PARAMS_SOURCE.indexOf(`key: "${key}"`));
		assert.match(
			control.slice(0, 220),
			/directed: true/,
			`${key} is choreographed and must be marked directed`,
		);
	}
});

test("the choreography resolves the mark square-on and unfolds its facets", () => {
	// Every complaint the timeline exists to answer, asserted at the seam
	// between the director and the sketch.
	assert.match(SKETCH_SOURCE, /const facetLift = direction \? direction\.lift : null;/);
	assert.match(SKETCH_SOURCE, /facetLift \? \(facetLift\[facet\] \?\? 0\) : 0,/);
	// Lift is its own channel, slid along the view ray, so every facet grows the
	// same way. Raising a face along its own normal sent the underside the other
	// way, and the sequence appeared to reverse when it reached green.
	assert.match(LOGO_3D_SOURCE, /along \+= lift \* LIFT_REACH;/);
	assert.match(SKETCH_SOURCE, /HOME_YAW \+ \(direction \? direction\.spin : spin\)/);
	assert.match(SKETCH_SOURCE, /HOME_PITCH \+ \(direction \? direction\.tilt : params\.tilt\)/);
	assert.match(SKETCH_SOURCE, /direction \? direction\.perspective : params\.perspective/);
	// The cycle's fade rides on the same alpha the panel controls.
	assert.match(SKETCH_SOURCE, /\* cycleOpacity;/);
	// Stage order is the director's, not the sketch's.
	assert.match(TIMELINE_SOURCE, /id: "assemble"/);
	assert.match(TIMELINE_SOURCE, /id: "extrude"/);
});

test("links ease in rather than popping", () => {
	// They used to appear at full strength the instant an edge was born.
	assert.doesNotMatch(SKETCH_SOURCE, /if \(born\(graph\.edgeBirth\[edge\]\) <= 0\) continue;/);
	assert.match(SKETCH_SOURCE, /const life = born\(graph\.edgeBirth\[edge\]\);/);
	assert.match(SKETCH_SOURCE, /if \(life <= low \|\| life > high\) continue;/);
	// Quantised, so the cost stays a fixed handful of strokeStyle assignments.
	assert.match(SKETCH_SOURCE, /const LINK_FADE_TIERS = \d+;/);
});

test("the collapse is staggered and curved, not a rigid contraction", () => {
	// A straight lerp moved every particle in lockstep along a chord, which read
	// as the globe deflating rather than the cloud finding its shape.
	assert.match(SKETCH_SOURCE, /const delay = \(\(hash >>> 3\) & 0xff\) \/ 255;/);
	assert.match(SKETCH_SOURCE, /const scheduled = \(travel - delay \* MORPH_STAGGER\)/);
	assert.match(SKETCH_SOURCE, /Math\.sin\(Math\.PI \* morph\) \*\s*\n?\s*MORPH_SWIRL/);
	// The bow must vanish at both ends, or neither form would land where it should.
	assert.match(SKETCH_SOURCE, /if \(morph > 0 && morph < 1\) \{/);
});

test("the cycle resolves on the mark, with no colour-cycle stage left behind", () => {
	// The colour cycle was cut: unfolding hands straight to the settled logo, so
	// nothing should still be reaching for the removed sweep.
	assert.doesNotMatch(SKETCH_SOURCE, /flowOrder|flowMix|flowFacetAt/);
	assert.doesNotMatch(TIMELINE_SOURCE, /flowOffset|"flow"/);
	assert.match(TIMELINE_SOURCE, /\{ id: "extrude"[\s\S]*\{ id: "whole"[\s\S]*\{ id: "fade"/);
});

test("the raised facet is emphasised by dimming the others", () => {
	assert.match(SKETCH_SOURCE, /facetEmphasis \? facetEmphasis\[bucket\.facet\] \?\? 1 : 1/);
	assert.match(read("lib/rovo-p5-timeline.ts"), /function emphasisAt/);
});

test("the canvas backdrop follows the OS colour scheme", () => {
	// The reference sketch hardcodes `background(9)`; in light mode that leaves
	// a black slab on a light page.
	assert.match(BACKDROP_SOURCE, /dark: \{ shell: "#090909"/);
	assert.match(BACKDROP_SOURCE, /light: \{ shell: "#[0-9A-Fa-f]{6}"/);
	assert.match(SHELL_SOURCE, /resolveRovoP5Backdrop\(actualTheme\)/);
	assert.match(SHELL_SOURCE, /backgroundColor: backdrop\.shell/);
	assert.match(SHELL_SOURCE, /color: backdrop\.text/);

	// Nothing may bake the dark backdrop in any more.
	assert.doesNotMatch(SHELL_SOURCE, /#090909/);
	assert.doesNotMatch(SKETCH_SOURCE, /BACKGROUND_LEVEL/);
	// The canvas stays transparent so the shell is the single backdrop colour;
	// painting one into the canvas too would mean two colours that must agree.
	assert.doesNotMatch(SKETCH_SOURCE, /instance\.background\(/);
	assert.match(SKETCH_SOURCE, /instance\.clear\(\);/);
	// A paused sketch has to repaint when the scheme changes.
	assert.match(
		CANVAS_SOURCE,
		/backdropRef\.current = backdrop;\s*\n\s*if \(reducedMotionRef\.current\) instanceRef\.current\?\.redraw\(\);/,
	);

	// The four brand colours stay as they are, in both schemes.
	assert.doesNotMatch(BACKDROP_SOURCE, /ROVO_FACET_COLORS/);
});

test("the transport tucks away for capture without stranding focus", () => {
	// The bar translates off the bottom rather than unmounting, so the cycle
	// keeps playing behind it. That means the closed state has to be taken out
	// of the tab order explicitly — `aria-hidden` alone leaves the buttons and
	// the scrubber focusable, and Tab would land off-screen.
	assert.match(SHELL_SOURCE, /aria-hidden=\{!transportOpen\}/);
	assert.match(SHELL_SOURCE, /inert=\{!transportOpen\}/);
	assert.match(SHELL_SOURCE, /translate-y-\[calc\(100%\+6rem\)\] opacity-0/);

	// The handle that brings it back has to be visible at rest. It was briefly
	// hover-to-reveal, which read as the bar having disappeared for good.
	// It also anchors to the very bottom edge rather than staying at the bar's
	// own height, where it still read as chrome floating over the canvas.
	assert.match(SHELL_SOURCE, /absolute inset-x-0 bottom-0 flex justify-center/);
	assert.match(SHELL_SOURCE, /rounded-t-md bg-surface-overlay/);
	assert.match(SHELL_SOURCE, /aria-label="Show the playback controls"/);
	assert.match(SHELL_SOURCE, /aria-expanded=\{transportOpen\}/);
	assert.match(SHELL_SOURCE, /pointer-events-auto opacity-60 hover:opacity-100/);
	assert.doesNotMatch(
		SHELL_SOURCE,
		/pointer-events-auto opacity-0 hover:/,
		"the handle must not be invisible while the bar is tucked away",
	);
	// Inert while the bar is up, or it would swallow clicks meant for the bar.
	assert.match(SHELL_SOURCE, /transportOpen\s*\n?\s*\? "pointer-events-none opacity-0"/);

	assert.match(TRANSPORT_SOURCE, /aria-label="Hide the playback controls"/);
	// Motion tokens, and both directions honour reduced motion.
	for (const source of [SHELL_SOURCE]) {
		const transitions = source.match(/transition-\[transform,opacity\]|transition-opacity/g) ?? [];
		assert.ok(transitions.length >= 2, "expected the tuck and the handle to animate");
		assert.equal(
			(source.match(/motion-reduce:transition-none/g) ?? []).length,
			transitions.length,
			"every tuck transition needs a reduced-motion guard",
		);
	}
});

test("a seek is consumed once, not re-applied on every play toggle", () => {
	// Regression: the effect depended on `playing` as well as the seek, so every
	// later play/pause re-ran it and rewound the clock to a stale position —
	// after Restart, pausing later jumped back to zero. A bare number also meant
	// React deduplicated a repeat scrub to the same spot, so the request is an
	// object whose identity changes every time.
	assert.match(CANVAS_SOURCE, /readonly seekRequest: \{ readonly seconds: number \} \| null;/);
	assert.match(CANVAS_SOURCE, /\}, \[seekRequest\]\);/);
	assert.doesNotMatch(CANVAS_SOURCE, /\[seekSeconds, playing\]/);
	// The pause redraw reads the ref, so `playing` need not be a dependency.
	assert.match(CANVAS_SOURCE, /if \(!playingRef\.current\) instanceRef\.current\?\.redraw\(\);/);

	assert.match(SHELL_SOURCE, /setSeekRequest\(\{ seconds \}\)/);
	assert.match(SHELL_SOURCE, /setSeekRequest\(\{ seconds: 0 \}\)/);
});

test("toggling reduced motion drives the p5 loop, not just a ref", () => {
	// Setup calls noLoop() when reduced motion is on and nothing else restarts
	// it, so flipping the OS preference afterwards left the art frozen one way
	// and burning frames on a static frame the other.
	const effect = CANVAS_SOURCE.slice(
		CANVAS_SOURCE.indexOf("reducedMotionRef.current = reducedMotion;"),
		CANVAS_SOURCE.indexOf("}, [reducedMotion]);"),
	);
	assert.match(effect, /instance\.noLoop\(\)/);
	assert.match(effect, /instance\.loop\(\)/);
	// The clock advances by measured deltas, so it must forget the paused stamp.
	assert.match(effect, /lastFrameRef\.current = null;/);
});
