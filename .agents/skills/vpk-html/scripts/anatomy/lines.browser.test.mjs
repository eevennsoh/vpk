// ws4b B1 (spec section 7.3): every texture line of every anatomy hero ends on something, in both themes.
// Opt-in, never in the unit manifest (R25); needs Playwright Chromium and the unsandboxed shell:
//   VPK_HTML_BROWSER=1 node --test .agents/skills/vpk-html/scripts/anatomy/lines.browser.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { checkLines, formatLines } from "./check-lines.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEMOS = path.resolve(HERE, "..", "..", "assets", "demos");
const skip = process.env.VPK_HTML_BROWSER === "1" ? false : "set VPK_HTML_BROWSER=1 to run the browser line check";

test("B1 no hero: a page whose only marker never closed exits 1 instead of reporting 0 floating ends", { skip }, () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-anatomy-lines-"));
	const file = path.join(dir, "page.html");
	fs.writeFileSync(file, '<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body><main><h1>Fixture</h1>\n<!-- vpk-anatomy-hero:start id="carriage" src="_figures/carriage.hero.mjs" -->\n</main></body></html>');
	const run = spawnSync(process.execPath, [path.join(HERE, "check-lines.mjs"), file, "--theme", "light", "--wait", "0"], { encoding: "utf8" });
	assert.equal(run.status, 1, run.stdout + run.stderr);
	assert.match(run.stdout, /✗ page\.html: no anatomy heroes to check/);
	fs.rmSync(dir, { recursive: true, force: true });
});

for (const name of ["demo-anatomy-hero.html", "demo-figure-engines.html"]) {
	const file = path.join(DEMOS, name);
	test(`B1 line ends: 0 floating ends in ${name}, light and dark, at the rest pose`, { skip: skip || (!fs.existsSync(file) && `${name} does not exist yet`) }, async () => {
		const report = await checkLines(file, { theme: "both", motion: "reduced" });
		assert.ok(report.results.length >= 2, "at least one hero checked in each theme");
		assert.deepEqual(report.results.filter(result => result.problems.length).map(result => `${result.id} · ${result.theme}`), [], formatLines(report));
		for (const result of report.results) assert.ok(result.lines > 0 && result.ends > 0, `${result.id} · ${result.theme} checked real lines`);
	});
}
