// Gate measurers that need layout. Opt-in, never in the unit manifest (R25); needs Playwright Chromium and the
// unsandboxed shell:
//   VPK_HTML_BROWSER=1 node --test .agents/skills/vpk-html/scripts/gates.browser.test.mjs
// Orphans (P4 cycle 2 item 4): a heading of 3+ words whose last word wraps alone ("one / clock") is widowed, and
// `text-wrap: balance` clears it. The headings sit in a fixed monospace measure, so the wrap is the same everywhere.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runGates } from "./gates.mjs";

const skip = process.env.VPK_HTML_BROWSER === "1" ? false : "set VPK_HTML_BROWSER=1 to run the browser suite";

/** Orphan findings for one page whose body is `body`, styled with `css`. */
async function orphans(css, body) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-gates-browser-"));
	try {
		const file = path.join(dir, "page.html");
		// line-height 1, tighter than the glyph boxes (the case-study h2 uses 1.05), so the boxes of two lines overlap.
		fs.writeFileSync(file, `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fixture</title><style>h1, h2, h3 { font: 20px/1 monospace; width: 14ch; margin: 0 0 12px; } ${css}</style></head><body><main>${body}</main></body></html>`);
		const { results } = await runGates(file, { gates: ["orphans"] });
		return results[0].findings;
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

test("P4 cycle 2 item 4: a heading whose last word wraps alone is widowed; balance clears it", { skip }, async () => {
	const widowed = await orphans("", "<h2>Two films one clock</h2>");
	assert.equal(widowed.length, 1, widowed.join("; "));
	assert.match(widowed[0], /^widowed heading \("clock" alone on the last line\)/);
	assert.deepEqual(await orphans("h2 { text-wrap: balance; }", "<h2>Two films one clock</h2>"), [], "balanced: two words on each line");
});

test("headings that fit one line, carry two words, or end on a shared line are not widowed", { skip }, async () => {
	const body = [
		"<h1>One clock</h1>",
		"<h2>Two films</h2>",
		"<h2>Films and clocks</h2>",
		"<h3>Two <em>films</em> one clock</h3>",
		"<h3>Two films one <code>clock</code></h3>",
	].join("");
	const findings = await orphans("h3 { text-wrap: balance; }", body);
	assert.deepEqual(findings, []);
});

test("an inline element at the end of a heading is still checked", { skip }, async () => {
	const findings = await orphans("", "<h3>Two films one <em>clock</em></h3>");
	assert.equal(findings.length, 1, findings.join("; "));
	assert.match(findings[0], /"clock" alone on the last line/);
});
