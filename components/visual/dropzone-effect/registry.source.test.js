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
test("Dropzone Effect is registered in both the visual catalog and the manifest", () => {
	const pattern =
		/visualComponent\("dropzone-effect", "Dropzone Effect", "@\/components\/visual\/dropzone-effect"\)/u;

	assert.match(readProjectFile("app/data/components.ts"), pattern);
	assert.match(readProjectFile("app/data/component-manifest.ts"), pattern);
});

test("Dropzone Effect has a detail record wired into the visual barrel", () => {
	const barrel = readProjectFile("app/data/details/visual.ts");

	assert.match(barrel, /import \{ DROPZONE_EFFECT_DETAIL \} from "\.\/visual\/dropzone-effect";/u);
	assert.match(barrel, /"dropzone-effect": DROPZONE_EFFECT_DETAIL,/u);
	// The export name is derived by the catalog verifier, not chosen freely.
	assert.match(
		readProjectFile("app/data/details/visual/dropzone-effect.ts"),
		/export const DROPZONE_EFFECT_DETAIL: ComponentDetail/u,
	);
});

/**
 * The demo has to be reached through `next/dynamic` with `ssr: false`: it mounts
 * a WebGL canvas, and a static import would also drag three.js into whichever
 * route shell reaches it.
 */
test("Dropzone Effect's demo is registered as an SSR-disabled dynamic import", () => {
	const registrySource = readWebsiteRegistrySource();

	assert.match(
		registrySource,
		/"dropzone-effect": dynamic\(\(\) => import\("\.\/demos\/visual\/dropzone-effect-demo"\)/u,
	);
	assert.match(
		registrySource,
		/"dropzone-effect": dynamic\(\(\) => import\("\.\/demos\/visual\/dropzone-effect-demo"\), \{\s*ssr: false,/u,
	);
});

/**
 * The motion contract lives in `flow-model.test.ts`, which only runs in CI while
 * it stays classified in the manifest rather than the skipped `legacy-drift` baseline.
 */
test("the flow model's contract suite is classified for CI", () => {
	assert.match(
		readProjectFile("scripts/js-unit-test-manifest.mjs"),
		/"components\/visual\/dropzone-effect\/flow-model\.test\.ts"/u,
	);
});

/**
 * A backtick inside a GLSL comment terminates the `/* glsl *\/` template literal
 * it lives in, and TypeScript then parses the rest of the shader as TypeScript.
 * The parse error surfaces on a line of perfectly valid GLSL, tens of lines from
 * the real cause, which makes it slow to diagnose every single time.
 *
 * It has bitten this component three times, because two house conventions
 * collide here: heavy prose comments that backtick their identifiers, and
 * shaders written inline as template literals. This is the cheap guard.
 */
test("no shader source contains a backtick, which would close its template literal", () => {
	const shaderFiles = [
		"components/visual/dropzone-effect/orb-material.ts",
		"components/visual/dropzone-effect/post-pass.ts",
		"components/visual/dropzone-effect/starfield.ts",
		"components/visual/dropzone-effect/sticker-material.ts",
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
