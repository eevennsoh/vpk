import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { ISO_THRESHOLD_DEFAULTS, ISO_THRESHOLDS, loadIsoThresholds } from "./thresholds.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS = path.join(here, "..");

test("ISO_THRESHOLDS mirrors checks-thresholds.json → iso, key by key, with defaults for missing keys", () => {
	const json = JSON.parse(fs.readFileSync(path.join(SCRIPTS, "..", "references", "checks-thresholds.json"), "utf8"));
	// null switches a limit off (Infinity); a missing key takes the default.
	for (const key of Object.keys(ISO_THRESHOLD_DEFAULTS)) assert.equal(ISO_THRESHOLDS[key], json.iso?.[key] === null ? Infinity : (json.iso?.[key] ?? ISO_THRESHOLD_DEFAULTS[key]), key);
	assert.equal(loadIsoThresholds({ iso: { partsMax: null } }).partsMax, Infinity, "null switches a limit off");
	assert.deepEqual(loadIsoThresholds({}), ISO_THRESHOLD_DEFAULTS);
	assert.deepEqual(loadIsoThresholds(null), ISO_THRESHOLD_DEFAULTS);
	assert.equal(loadIsoThresholds({ iso: { partsMax: 99, labelsMax: "x" } }).partsMax, 99);
	assert.equal(loadIsoThresholds({ iso: { labelsMax: "x" } }).labelsMax, ISO_THRESHOLD_DEFAULTS.labelsMax, "non-numeric values fall back");
});

// Regression: thresholds.mjs once read the JSON with fs.readFileSync at import, so importing the iso runtime registry
// (runtime/iso.mjs → inline.mjs → runtime-css.mjs → motion.mjs → thresholds.mjs) read a file at import time (R28).
test("importing runtime/iso.mjs and the iso modules reads no file (R28)", () => {
	const probe = `
		import fs from "node:fs";
		const original = fs.readFileSync;
		const reads = [];
		fs.readFileSync = (...args) => {
			if (!/^\\s*at (?:[^(]*\\()?node:/.test((new Error().stack ?? "").split("\\n")[2] ?? "")) reads.push(String(args[0]));
			return original(...args);
		};
		for (const file of ["runtime/iso.mjs", "iso/scene.mjs", "iso/audit.mjs", "iso/emit.mjs"]) await import(${JSON.stringify(SCRIPTS)} + "/" + file);
		console.log(JSON.stringify(reads));`;
	const result = spawnSync(process.execPath, ["--input-type=module", "-e", probe], { encoding: "utf8", env: { ...process.env, OPENSSL_CONF: "/dev/null" } });
	assert.equal(result.status, 0, result.stderr);
	assert.deepEqual(JSON.parse(result.stdout.trim()), []);
});
