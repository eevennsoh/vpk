import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const requireRegistrySource = createRequire(import.meta.url);
const { readWebsiteRegistrySource } = requireRegistrySource(
	process.cwd() + "/components/website/registry/test-source.cjs",
);
const ROOT = process.cwd();

function readProjectFile(filePath) {
	return readFileSync(path.join(ROOT, filePath), "utf8");
}

/**
 * `VISUAL_COMPONENTS` is hand-duplicated across `components.ts` (which feeds the
 * routes) and `component-manifest.ts` (which the catalog verifier validates).
 * Nothing keeps the two in step, so registering in only one silently produces a
 * component that either has no page or no docs entry.
 */
test("Peel is registered in both the visual catalog and the manifest", () => {
	const pattern = /visualComponent\("peel", "Peel", "@\/components\/visual\/peel"\)/u;

	assert.match(readProjectFile("app/data/components.ts"), pattern);
	assert.match(readProjectFile("app/data/component-manifest.ts"), pattern);
});

test("Peel has a detail record wired into the visual barrel", () => {
	const barrel = readProjectFile("app/data/details/visual.ts");

	assert.match(barrel, /import \{ PEEL_DETAIL \} from "\.\/visual\/peel";/u);
	// Unlike the hyphenated slugs around it, `peel` is a valid identifier and
	// so goes into the map unquoted.
	assert.match(barrel, /^\tpeel: PEEL_DETAIL,$/mu);
	// The export name is derived by the catalog verifier, not chosen freely.
	assert.match(
		readProjectFile("app/data/details/visual/peel.ts"),
		/export const PEEL_DETAIL: ComponentDetail/u,
	);
});

/**
 * The demo has to be reached through `next/dynamic` with `ssr: false`: it mounts
 * a WebGL canvas, and a static import would also drag three.js into whichever
 * route shell reaches it.
 */
test("Peel's demo is registered as an SSR-disabled dynamic import", () => {
	const registrySource = readWebsiteRegistrySource();

	assert.match(
		registrySource,
		/peel: dynamic\(\(\) => import\("\.\/demos\/visual\/peel-demo"\), \{\s*ssr: false,/u,
	);
});

/**
 * The motion contract lives in `peel-model.test.ts`, which only runs in CI if it
 * is classified in the manifest — an unlisted `components/**` suite silently
 * defaults to `legacy-drift` and is skipped.
 */
test("the motion model's contract suite is classified for CI", () => {
	assert.match(
		readProjectFile("scripts/js-unit-test-manifest.mjs"),
		/"components\/visual\/peel\/peel-model\.test\.ts"/u,
	);
});

/**
 * The model is loaded by Node's type-stripping test runner, which resolves
 * relative specifiers literally and cannot find an extensionless `./data`. A
 * type-only import is erased before resolution, so it stays safe; adding a
 * runtime one would break the whole suite with a module-not-found thrown from
 * a file the test never mentions.
 */
test("the motion model takes nothing but types from its neighbours", () => {
	const source = readProjectFile("components/visual/peel/peel-model.ts");
	const relativeImports = [...source.matchAll(/^import\s+(type\s+)?.*from "\.\/.*$/gmu)];

	assert.ok(relativeImports.length > 0, "expected the model to import its tuning type");
	for (const match of relativeImports) {
		assert.ok(
			match[1],
			`peel-model.ts must only import types from siblings, found: ${match[0]}`,
		);
	}
});

/**
 * React Three Fiber writes `pointer-events: auto` inline on its container,
 * which beats the `none` inherited from the wrapper around it. The canvas
 * overscans the stamp on every side, so without an explicit override its
 * invisible margin silently swallows clicks on whatever is behind it — a
 * neighbouring stamp, or the paragraph a scattered layout sits over. Nothing
 * about the page looks wrong when this regresses; things just stop being
 * clickable near a stamp.
 */
test("the canvas is explicitly opted out of pointer events", () => {
	const source = readProjectFile("components/visual/peel/index.tsx");

	assert.match(source, /style=\{\{ pointerEvents: "none" \}\}/u);
	// The wrapper class alone is not enough, but it should still be there: it
	// covers the container before the canvas mounts.
	assert.match(source, /className="pointer-events-none absolute"/u);
});

/**
 * Peel's width and height feed its WebGL aspect, pointer geometry and canvas
 * overscan as well as the outer layout box. Letting the forwarded style win
 * only on the DOM node would make those two coordinate systems disagree.
 */
test("Peel keeps style overrides from desynchronizing its owned dimensions", () => {
	const source = readProjectFile("components/visual/peel/index.tsx");

	assert.match(source, /style\?: CSSProperties;/u);
	assert.match(source, /style=\{\{ \.\.\.style, width, height: sheetHeight \}\}/u);
});

/**
 * Peel has exactly one silhouette: the stamp die-cut. It has carried a plain
 * square, a three-shape switch and a Jira agent-session card at various points;
 * this pins the current shape so none of them creep back.
 *
 * The counts and the radius are measured off the reference and documented in
 * `data.ts`; the shader interpolates them rather than repeating the literals, so
 * this checks the wiring, not the numbers.
 */
test("the silhouette is the measured die-cut, and no leftovers from the shapes it replaced", () => {
	const material = readProjectFile("components/visual/peel/peel-material.ts");
	const tuning = readProjectFile("components/visual/peel/data.ts");

	// The bites are subtracted from the rectangle on all four edges. Positive-
	// inside means min() is intersection, so each one is min(sheet, d - radius),
	// which is what perfBite() returns.
	assert.match(material, /float sheet = roundedRect\(p, extent, 0\.004\);/u);
	const bites = [...material.matchAll(/sheet = min\(sheet, perfBite\([^)]*\)\);/gu)];
	assert.equal(bites.length, 4, "expected a bite chain on each of the four edges");

	// Every hole is a circle at its cell midpoint, moved and resized by a measured
	// hair. The scatter was here, was deleted on the strength of a folded-period
	// statistic, and is back because folding is the one estimator that cannot see
	// per-tooth variation: the reference's two rest windows sit on different pixel
	// grids and their per-tooth phase residuals still correlate at 0.80. Pinned as
	// an expression so the geometry cannot drift back to either extreme.
	assert.match(
		material,
		/float perfBite\(float along, float across, float index, float seed\) \{\s*float shift = \(perfHash\(index, seed\) \* 2\.0 - 1\.0\) \* PERF_PHASE_JITTER;\s*float swell = \(perfHash\(index, seed \+ 4\.0\) \* 2\.0 - 1\.0\) \* PERF_DEPTH_JITTER;\s*return length\(vec2\(along - shift, across\)\) - \(PERF_RADIUS \+ swell\);\s*\}/u,
	);

	// Each edge draws its own scatter, so opposite edges do not wander in step.
	const seeds = [...material.matchAll(/perfBite\([^)]*, (\d\.0)\)\);/gu)].map(
		(match) => match[1],
	);
	assert.deepEqual(seeds, ["0.0", "1.0", "2.0", "3.0"]);

	// Interpolated from data.ts, not retyped into the shader.
	assert.match(material, /const float PERF_RADIUS = \$\{PEEL_PERF_RADIUS\.toFixed\(5\)\};/u);
	assert.match(material, /const float PERF_COLUMNS = \$\{PEEL_PERF_COLUMNS\.toFixed\(1\)\};/u);
	assert.match(material, /const float PERF_ROWS = \$\{PEEL_PERF_ROWS\.toFixed\(1\)\};/u);
	assert.match(
		material,
		/const float PERF_PHASE_JITTER = \$\{PEEL_PERF_PHASE_JITTER\.toFixed\(5\)\};/u,
	);
	assert.match(
		material,
		/const float PERF_DEPTH_JITTER = \$\{PEEL_PERF_DEPTH_JITTER\.toFixed\(5\)\};/u,
	);
	assert.match(material, /const float MARGIN = \$\{PEEL_PAPER_MARGIN\.toFixed\(5\)\};/u);

	assert.match(tuning, /export const PEEL_PERF_COLUMNS = 14;/u);
	assert.match(tuning, /export const PEEL_PERF_ROWS = 18;/u);
	assert.match(tuning, /export const PEEL_PERF_RADIUS = 0\.0148;/u);
	// 0.35 and 0.26 device px of sd, as the peak of a uniform draw (sd = peak /
	// sqrt(3)) on a sheet 257.2 device px tall.
	assert.match(tuning, /export const PEEL_PERF_PHASE_JITTER = 0\.00236;/u);
	assert.match(tuning, /export const PEEL_PERF_DEPTH_JITTER = 0\.00175;/u);
	assert.match(tuning, /export const PEEL_PAPER_MARGIN = 0\.0236;/u);

	// The die-cut's antialias band. fwidth is abs(dFdx) + abs(dFdy), which runs
	// 1.0-1.41x the true fragment footprint depending on edge orientation, so the
	// 0.7 scale puts the ramp at the same width whichever way the edge runs and
	// the 0.0030 cap is where a 45-degree edge lands anyway at the size this
	// renders (238.7 buffer px per sheet-height, one fragment = 0.00419 sheet).
	// Only the gather's stretch ever reaches the cap. This was
	// clamp(fwidth(sheet), 0.0006, 0.0020) — a fixed 0.92-fragment ramp, slightly
	// under-antialiased, which staircased the -5.9 degree die-cut.
	assert.match(material, /float aa = clamp\(fwidth\(sheet\) \* 0\.7, 0\.0006, 0\.0030\);/u);

	// Inward edge darkening at the die-cut. Measured against the reference's
	// margin, which is flat to within 2-3 levels once the page's blur bleeding
	// back across the cut is subtracted; 0.93 put a 10-level rim on ours.
	assert.match(material, /albedo \*= mix\(0\.975, 1\.0, smoothstep\(0\.0, 0\.010, sheet\)\);/u);

	for (const filePath of [
		"components/visual/peel/data.ts",
		"components/visual/peel/index.tsx",
		"components/visual/peel/peel-scene.tsx",
		"components/visual/peel/peel-material.ts",
		"components/visual/peel/shadow-material.ts",
		"components/website/demos/visual/peel-demo.tsx",
	]) {
		const source = readProjectFile(filePath);
		// `perforation` came off this list when the die-cut landed; `biteNoise`,
		// `PEEL_PERF_JITTER` and `PEEL_PERF_RADIUS_JITTER` came off it when the
		// measured scatter came back under the names the assertions above pin
		// (`PEEL_PERF_PHASE_JITTER` / `PEEL_PERF_DEPTH_JITTER`), which is where the
		// amount now lives. The rest are still dead. `uPerforations` and
		// `paperInset` in particular: the die-cut and the margin are compile-time
		// constants shared by both materials, not per-instance uniforms, so a
		// uniform by either name means a second, divergent copy of the geometry has
		// appeared.
		for (const dead of [
			"PeelShape",
			"uShape",
			"dragCollapse",
			"cornerRadiusPx",
			"uPerforations",
			"paperInset",
		]) {
			assert.doesNotMatch(
				source,
				new RegExp(`\\b${dead}\\b`, "u"),
				`${filePath} still references "${dead}", which the die-cut does not have`,
			);
		}
	}
});

/**
 * A backtick inside a GLSL comment terminates the `/* glsl *\/` template literal
 * it lives in, and TypeScript then parses the rest of the shader as TypeScript.
 * The parse error surfaces on a line of perfectly valid GLSL, tens of lines from
 * the real cause, which makes it slow to diagnose every single time.
 *
 * Two house conventions collide here: heavy prose comments that backtick their
 * identifiers, and shaders written inline as template literals. This is the
 * cheap guard, copied from dropzone-effect where it has earned its keep.
 */
test("no shader source contains a backtick, which would close its template literal", () => {
	const shaderFiles = [
		"components/visual/peel/peel-material.ts",
		"components/visual/peel/shadow-material.ts",
	];

	for (const filePath of shaderFiles) {
		const source = readProjectFile(filePath);
		const markers = [...source.matchAll(/\/\* glsl \*\/\s*`/gu)];
		assert.ok(markers.length > 0, `${filePath} declares no /* glsl */ literal`);

		for (const marker of markers) {
			const open = marker.index + marker[0].length;
			const close = source.indexOf("`", open);
			assert.notEqual(close, -1, `${filePath} has an unterminated GLSL literal`);

			// Matching on the closing delimiter alone cannot detect a stray
			// backtick — it just closes earlier and still looks well formed.
			// What gives it away is the text *after* the close: a real literal is
			// followed by an expression terminator, while an early close is
			// followed by whatever GLSL happened to come next.
			const after = source.slice(close + 1).trimStart()[0];
			assert.ok(
				after === ";" || after === "," || after === ")",
				`${filePath} has a backtick inside a GLSL literal — it closes the string early, ` +
					`and TypeScript then parses the rest of the shader as TypeScript. ` +
					`Found ${JSON.stringify(after)} after the closing delimiter.`,
			);
		}
	}
});

/**
 * `half` is a reserved word in GLSL ES and some drivers reject `distance` as a
 * local because it shadows the built-in. `cast` is on the reserved list too,
 * which is why the shadow's two terms are named contactTerm and castTerm.
 * None of these fail at build time — they fail as a blank canvas on someone
 * else's machine.
 */
test("no shader declares a variable that collides with GLSL reserved or built-in names", () => {
	const shaderFiles = [
		"components/visual/peel/peel-material.ts",
		"components/visual/peel/shadow-material.ts",
	];
	const collisions = ["half", "fixed", "distance", "length", "sample", "input", "output", "cast"];

	for (const filePath of shaderFiles) {
		const source = readProjectFile(filePath);
		for (const name of collisions) {
			assert.doesNotMatch(
				source,
				new RegExp(`\\b(?:float|vec2|vec3|vec4|int|bool|mat2|mat3|mat4)\\s+${name}\\b`, "u"),
				`${filePath} declares "${name}", which GLSL ES reserves or already defines`,
			);
		}
	}
});

/**
 * The grey rectangle, as a contract.
 *
 * The shadow used to sample its silhouette at `p /= 1.0 + uLift * 0.1`, growing
 * the shadow to 110% of a sheet that itself only grows 3%. That pushed the
 * shadow's solid core out from under the sheet on every side — a measured
 * 226 x 292px slab of flat 21.8-level grey around a 200 x 263px stamp, with a
 * hard square outline and no internal gradient. It reads as a card, not a
 * shadow, and the reference exposes zero flat alpha on any side at any frame.
 *
 * The invariant that prevents it is narrow and worth pinning: the silhouette is
 * sampled at sheet scale, so only penumbra can ever escape from under the
 * sheet. Translating the sample point is how the cast term offsets and how the
 * contact term tracks the lifted sheet's projection; scaling it is the bug.
 *
 * The shadow reads the silhouette through its own `shadowField()` now, which
 * corrects the exterior distance around the die-cut's bites, so both entry
 * points are checked.
 *
 * Tracking the sheet's projected growth is done by translating the sample point
 * by the sheet's own height field divided by the camera distance — the exact
 * inverse of the perspective divide the sheet gets, so the shadow's silhouette
 * lands on the sheet's outline and by construction cannot overtake it. That is
 * a per-sample displacement rather than a factor, which is what the call-site
 * check below admits. The second assertion pins WHERE the displacement comes
 * from: a bare figure would pass the first one while going straight back to
 * growing the shadow by a number of its own.
 */
test("the shadow samples the sheet's silhouette at sheet scale, never scaled by lift", () => {
	const source = readProjectFile("components/visual/peel/shadow-material.ts");
	const shader = source.slice(source.indexOf("const fragmentShader"));
	// Comments name both functions in prose, and shadowField declares itself, so
	// strip those before counting call sites.
	const code = shader
		.replace(/\/\*[\s\S]*?\*\//gu, "")
		.replace(/\/\/[^\n]*/gu, "")
		.replace(/float\s+shadowField\s*\([^)]*\)\s*\{/u, "");

	const samples = [...code.matchAll(/(?:sheetDistance|shadowField)\(/gu)];
	assert.ok(samples.length >= 1, "the shadow no longer samples the sheet silhouette");

	// Every sample has to open with a bare p, closed or continued by a + or a -.
	// That admits the cast term's translation, p - lift * vec2(...), and rejects
	// any factor applied to p itself.
	const translated = [...code.matchAll(/(?:sheetDistance|shadowField)\(\s*p\s*[)+\-]/gu)];
	assert.equal(
		translated.length,
		samples.length,
		"a silhouette sample scales its point instead of translating it; only translation " +
			"keeps the shadow's core under the sheet",
	);

	assert.doesNotMatch(
		shader,
		/\bp\s*[*/]=/u,
		"the shadow's sample point is rescaled in place, which grows the silhouette off the sheet",
	);

	assert.match(
		code,
		/vec2\s+seam\s*=\s*p\s*\*\s*\(\s*sheetHeight\(p\)\s*\/\s*CAMERA_DISTANCE\s*\)/u,
		"the silhouette's displacement must be the inverse of the sheet's own perspective " +
			"divide, so the shadow can never grow past the sheet's projected outline",
	);
});

/**
 * Two pose channels that live only in the scene's frame loop, where no unit test
 * can reach them, and that both look like dead weight to anyone tidying it.
 *
 * The resting tilt is why the sheet reads as lying in space rather than as a
 * rotated bitmap. Without it the silhouette is a mathematically perfect 2D
 * rotation — top edge = bottom edge and left = right to a hundredth of a degree
 * — which three blind critiques picked out as the sprite tell. It has to be a
 * mesh rotation and not a DOM one: it is out of plane, so the die-cut has to
 * keystone with it.
 *
 * The landing shear has to be a skew and has to come after the rotate. CSS
 * composes left to right, so `rotate(a) skewX(b)` shears the point first and
 * rotates the result, which puts the shear in the sheet's own frame; the other
 * order shears it in the page's and the trailing corner comes out wrong.
 */
test("the scene applies the resting out-of-plane tilt and the landing shear", () => {
	const scene = readProjectFile("components/visual/peel/peel-scene.tsx");
	const model = readProjectFile("components/visual/peel/peel-model.ts");

	assert.match(model, /export const PEEL_REST_TILT_Y = 0\.0617;/u);
	assert.match(
		scene,
		/rotation\.set\(state\.tiltX, state\.tiltY \+ \(shape === "stamp" \? PEEL_REST_TILT_Y : 0\), 0\)/u,
		"stamps keep their resting keystone; captured DOM surfaces begin flat so their original pixels stay aligned",
	);

	assert.match(
		scene,
		/rotate\(\$\{degrees\.toFixed\(3\)\}deg\) skewX\(\$\{skew\.toFixed\(3\)\}deg\)/u,
		"the landing shear must be a skewX written after the rotate",
	);
});
