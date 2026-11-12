import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import esbuild from "esbuild";

const { loadCjsModuleFromText } = await import(
	path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js")
);

async function loadFadeGuard() {
	const result = await esbuild.build({
		entryPoints: [
			path.join(process.cwd(), "components/visual/border-beam/fade-guard.ts"),
		],
		bundle: true,
		format: "cjs",
		platform: "node",
		write: false,
	});
	return loadCjsModuleFromText(result.outputFiles[0].text);
}

const ROOT = process.cwd();
const DIR = "components/visual/border-beam";

function readProjectFile(filePath) {
	return readFileSync(path.join(ROOT, filePath), "utf8");
}

const INDEX_SOURCE = readProjectFile(`${DIR}/index.tsx`);
const PACKAGE_JSON = JSON.parse(readProjectFile("package.json"));

test("Border Beam consumes the pinned upstream package, not a fork", () => {
	assert.equal(
		PACKAGE_JSON.dependencies["border-beam"],
		"1.3.0",
		"the library must stay pinned to an exact version",
	);
	assert.match(INDEX_SOURCE, /from "border-beam"/u);
	assert.match(INDEX_SOURCE, /border-beam 1\.3\.0/u);
	assert.match(INDEX_SOURCE, /github\.com\/Jakubantalik\/border-beam/u);
});

test("Border Beam keeps no vendored copy of upstream source", () => {
	// These were the fork: a reimplementation of upstream's CSS generation
	// plus its own pulse driver. They must not come back.
	for (const stale of [
		"styles.ts",
		"styles-generated.ts",
		"pulse-driver.ts",
		"types.ts",
	]) {
		assert.equal(
			existsSync(path.join(ROOT, DIR, stale)),
			false,
			`${stale} is upstream's job — it must not be re-vendored`,
		);
	}
	// types come from the package, never from a local redeclaration
	assert.match(INDEX_SOURCE, /export type \{[\s\S]*?\} from "border-beam";/u);
});

test("Border Beam suppresses only the fade names upstream mis-matches", async () => {
	const { shouldSuppressAnimationEnd } = await loadFadeGuard();

	// Upstream matches `animationName.includes("fade-in"/"fade-out")` on a
	// bubbling animationend with no target check, so a descendant hijacks
	// the beam. Those names, from a descendant, must be suppressed.
	for (const name of [
		"beam-fade-in-abc",
		"beam-fade-out-abc",
		"stagger-fade-in",
		"my-fade-out-thing",
	]) {
		assert.equal(
			shouldSuppressAnimationEnd(name, false),
			true,
			`${name} from a descendant should be suppressed`,
		);
	}

	// Anything else from a descendant must pass through untouched — the
	// child's own listeners and React's delegated handler still need it.
	for (const name of ["spin", "pulse", "slide-up", "fadein", "my-fade"]) {
		assert.equal(
			shouldSuppressAnimationEnd(name, false),
			false,
			`${name} from a descendant must not be suppressed`,
		);
	}

	// The beam's own events are never suppressed, whatever they are named.
	for (const name of ["beam-fade-in-abc", "beam-fade-out-abc", "spin"]) {
		assert.equal(shouldSuppressAnimationEnd(name, true), false);
	}
});

test("Border Beam installs the fade guard in the capture phase", () => {
	// capture is what gets us ahead of upstream's bubble-phase handler
	assert.match(INDEX_SOURCE, /addEventListener\("animationend", onAnimationEnd, true\)/u);
	assert.match(
		INDEX_SOURCE,
		/removeEventListener\("animationend", onAnimationEnd, true\)/u,
	);
});

test("Border Beam resolves upstream's active default before syncing opacity", () => {
	// `active` is optional upstream and defaults to true. Reading it raw
	// would write opacity 0 for every caller that omits it, hiding the
	// beam under reduced motion — the very bug this wrapper fixes.
	assert.match(INDEX_SOURCE, /const isActive = active \?\? true;/u);
	assert.match(INDEX_SOURCE, /isActive \? "1" : "0"/u);
	assert.doesNotMatch(INDEX_SOURCE, /property, active \? "1" : "0"/u);
});

test("Border Beam stays visible when motion is reduced", () => {
	// `--beam-opacity-<id>` is registered `initial-value: 0` and only ever
	// raised inside the fade-in keyframe, which upstream's reduced-motion
	// block disables — leaving the beam invisible. It inherits, so we set
	// it on the beam element directly.
	assert.match(
		INDEX_SOURCE,
		/matchMedia\("\(prefers-reduced-motion: reduce\)"\)/u,
	);
	assert.match(INDEX_SOURCE, /--beam-opacity-\$\{id\}/u);
	assert.match(
		INDEX_SOURCE,
		/query\.matches\) beam\.style\.setProperty\(property, isActive \? "1" : "0"\)/u,
	);
	assert.match(INDEX_SOURCE, /beam\.style\.removeProperty\(property\)/u);
	// and it tracks live changes to the media query rather than reading once
	assert.match(INDEX_SOURCE, /query\.addEventListener\("change", sync\)/u);
	assert.match(INDEX_SOURCE, /query\.removeEventListener\("change", sync\)/u);
});

test("Border Beam forwards a consumer ref alongside its own", () => {
	assert.match(INDEX_SOURCE, /typeof ref === "function"\) ref\(node\)/u);
	assert.match(INDEX_SOURCE, /else if \(ref\) ref\.current = node/u);
});
