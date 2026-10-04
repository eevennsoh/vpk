import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { EVOLVE_DEFAULTS, MOVE_DEFAULTS, resolveDissolveTimings, resolveDissolveTuning, resolveMorphTuning, resolveMoveTuning } from "./tuning-model.ts";

test("pins the current upstream engine and exposes all four effects", () => {
	const indexSource = fs.readFileSync(new URL("./index.ts", import.meta.url), "utf8");
	const packageSource = fs.readFileSync(new URL("../../../package.json", import.meta.url), "utf8");
	assert.match(indexSource, /liquid-gooey 0\.2\.1 at commit 37835a9/u);
	assert.match(indexSource, /LiquidEffect as GooeyEffect/u);
	assert.match(indexSource, /BendTuning/u);
	assert.match(indexSource, /ImageMeltOptions/u);
	assert.match(packageSource, /"liquid-gooey": "0\.2\.1"/u);
});

test("resolves dissolve timing compatibility", () => {
	assert.deepEqual(resolveDissolveTimings(0, 0), { lifetimeMs: 0, fadeMs: 0 });
	assert.deepEqual(resolveDissolveTimings(110, 240), { lifetimeMs: 240, fadeMs: 240 });
});

test("maps normalized morph, move, and dissolve tuning into raw engine values", () => {
	assert.deepEqual(resolveMorphTuning(undefined), {
		massStiffness: EVOLVE_DEFAULTS.massStiffness,
		massDamping: EVOLVE_DEFAULTS.massDamping,
		sizeStiffness: EVOLVE_DEFAULTS.sizeStiffness,
		sizeDamping: EVOLVE_DEFAULTS.sizeDamping,
		radiusStiffness: EVOLVE_DEFAULTS.radiusStiffness,
		radiusDamping: EVOLVE_DEFAULTS.radiusDamping,
		cornerDuration: EVOLVE_DEFAULTS.cornerDuration,
		contentBlur: EVOLVE_DEFAULTS.contentBlur,
	});
	const fastMorph = resolveMorphTuning({ speed: 2, bounce: 0.5 });
	assert.equal(fastMorph.massStiffness, EVOLVE_DEFAULTS.massStiffness * 4);
	assert.equal(fastMorph.massDamping, EVOLVE_DEFAULTS.massDamping * 2);

	const defaultMove = resolveMoveTuning(undefined);
	assert.equal(defaultMove.stiffness, MOVE_DEFAULTS.stiffness);
	assert.equal(defaultMove.damping, MOVE_DEFAULTS.damping);
	assert.equal(defaultMove.stretch, 0.18);
	assert.ok(Math.abs((defaultMove.tail ?? 0) - 0.46) < 0.000001);
	assert.equal(resolveMoveTuning({ advanced: { stiffness: 777 } }).stiffness, 777);
	assert.equal(resolveDissolveTuning(4).strength, 1);
	assert.equal(resolveDissolveTuning(-1).strength, 0);
});
