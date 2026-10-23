import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateHtmlFile } from "../check-html.mjs";
import { auditHtmlFile } from "./audit.mjs";
import { injectIsoFigures, renderIsoFigure } from "./build-figure.mjs";

const CLI = fileURLToPath(new URL("./build-figure.mjs", import.meta.url));
const BRIEF = fileURLToPath(new URL("./briefs/exploded-stack.json", import.meta.url));
const EXEMPLAR = JSON.parse(fs.readFileSync(BRIEF, "utf8"));
const run = args => spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: { ...process.env, OPENSSL_CONF: "/dev/null" }, cwd: os.tmpdir() });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "vpk-iso-build-"));
const count = (text, needle) => text.split(needle).length - 1;

test("CLI: brief → page that passes check-html and the iso audit", () => {
	const out = path.join(tmp(), "fig.html");
	const result = run(["--brief", BRIEF, "--out", out, "--print-bytes"]);
	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stderr, /bytes: region \d+, svg \d+, page \d+/);
	const check = validateHtmlFile(out);
	assert.deepEqual(check.failures, []);
	const audit = auditHtmlFile(out);
	assert.equal(audit.figures, 1);
	assert.deepEqual(audit.findings.filter(f => f.severity === "error"), []);
	const html = fs.readFileSync(out, "utf8");
	assert.equal(count(html, "<!-- vpk-iso:start -->"), 1);
	assert.equal(count(html, "<!-- vpk-smil-starter:start -->"), 1);
	assert.match(html, /<meta name="vpk-figure-engine" content="iso-kit">/);
});

test("CLI: --fragment prints the region only (markers, no runtime)", () => {
	const result = run(["--brief", BRIEF, "--fragment"]);
	assert.equal(result.status, 0, result.stderr);
	assert.ok(result.stdout.startsWith('<!-- vpk-figure:begin engine="iso-kit" id="exploded-stack" -->'));
	assert.match(result.stdout, /<!-- vpk-figure:end id="exploded-stack" -->\n$/);
	assert.doesNotMatch(result.stdout, /vpk-iso:start|<!doctype/i);
});

test("CLI: validation and usage errors", () => {
	const dir = tmp();
	const bad = path.join(dir, "bad.json");
	fs.writeFileSync(bad, JSON.stringify({ ...EXEMPLAR, focal: "ghost" }));
	const invalid = run(["--brief", bad, "--out", path.join(dir, "x.html")]);
	assert.equal(invalid.status, 1);
	assert.match(invalid.stderr, /focal "ghost" must name a part/);
	assert.equal(fs.existsSync(path.join(dir, "x.html")), false, "nothing written on failure");
	assert.equal(run([]).status, 2);
	assert.equal(run(["--brief"]).status, 2);
	assert.equal(run(["--brief", BRIEF, "--check"]).status, 2, "--check needs --inject");
	assert.equal(run(["--bogus"]).status, 2);
	// The kit has one style: --style manual is accepted, any other value is a usage error naming it.
	const other = run(["--brief", BRIEF, "--style", "hairline", "--fragment"]);
	assert.equal(other.status, 2);
	assert.match(other.stderr, /style "hairline" is not supported; the iso kit has one style: "manual"/);
	assert.equal(run(["--brief", BRIEF, "--style", "manual", "--fragment"]).status, 0);
});

test("importing build-figure.mjs prints nothing and runs nothing (main guard)", () => {
	const result = spawnSync(process.execPath, ["--input-type=module", "-e", `await import(${JSON.stringify(pathToFileURL(CLI).href)});`], { encoding: "utf8", env: { ...process.env, OPENSSL_CONF: "/dev/null" }, cwd: os.tmpdir() });
	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.stdout, "");
	assert.equal(result.stderr, "");
});

test("renderIsoFigure is deterministic and reports sizes (ws4b engine demo API)", () => {
	const a = renderIsoFigure(EXEMPLAR, { src: "_figures/exploded-stack.iso.json" });
	const b = renderIsoFigure(structuredClone(EXEMPLAR), { src: "_figures/exploded-stack.iso.json" });
	assert.equal(a.region, b.region);
	assert.deepEqual(Object.keys(a.sizes).sort(), ["region", "svg"]);
	assert.equal(a.sizes.region, Buffer.byteLength(a.region));
	assert.match(a.region, /src="_figures\/exploded-stack\.iso\.json"/);
	assert.match(a.region, /data-vpk-iso-style="manual"/);
	assert.equal(renderIsoFigure(EXEMPLAR, { style: "manual" }).region, renderIsoFigure(EXEMPLAR).region);
	assert.throws(() => renderIsoFigure(EXEMPLAR, { style: "makingsoftware" }), /the iso kit has one style: "manual"/);
});

function documentFixture(dir, { meta = "" } = {}) {
	fs.mkdirSync(path.join(dir, "_figures"), { recursive: true });
	fs.writeFileSync(path.join(dir, "_figures", "fig-one.iso.json"), JSON.stringify({ ...EXEMPLAR, id: "fig-one", figId: "FIG_001" }, null, "\t"));
	// A hand-copied kit region with no src: --inject must leave it byte-identical.
	const manual = renderIsoFigure({ ...EXEMPLAR, id: "manual", figId: "FIG_002", interact: null }, { indent: "\t" }).region;
	const html = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Doc</title>${meta}\n<style>body { color: var(--ink); }</style>\n</head>\n<body>\n<main>\n\t<h1>Doc</h1>\n\t<!-- vpk-figure:begin engine="iso-kit" id="fig-one" src="_figures/fig-one.iso.json" --><!-- vpk-figure:end id="fig-one" -->\n\t${manual}\n</main>\n</body>\n</html>\n`;
	const file = path.join(dir, "doc.html");
	fs.writeFileSync(file, html);
	return { file, manual };
}

test("--inject rebuilds src regions only, keeps others, inserts the meta, and is idempotent", async () => {
	const dir = tmp();
	const { file, manual } = documentFixture(dir);
	const first = run(["--inject", file]);
	assert.equal(first.status, 0, first.stderr);
	assert.match(first.stderr, /region "manual" has no src brief; left as is/);
	assert.match(first.stdout, /wrote .*\(1 rebuilt, 1 without src\)/);
	const html = fs.readFileSync(file, "utf8");
	assert.ok(html.includes(manual), "the region without src is untouched");
	assert.match(html, /\t<!-- vpk-figure:begin engine="iso-kit" id="fig-one" src="_figures\/fig-one\.iso\.json" -->\n\t<figure class="vpk-iso-plate vpk-iso-plate--manual"/);
	assert.match(html, /<meta name="vpk-figure-engine" content="iso-kit">/);
	assert.equal(count(html, "<!-- vpk-iso:start -->"), 1);
	assert.equal(count(html, "<!-- vpk-smil-starter:start -->"), 1);
	const again = run(["--inject", file]);
	assert.equal(again.status, 0, again.stderr);
	assert.match(again.stdout, /^unchanged /);
	assert.equal(fs.readFileSync(file, "utf8"), html, "idempotent");
	assert.equal(run(["--inject", file, "--check"]).status, 0, "--check is clean when current");

	const briefPath = path.join(dir, "_figures", "fig-one.iso.json");
	fs.writeFileSync(briefPath, JSON.stringify({ ...JSON.parse(fs.readFileSync(briefPath, "utf8")), caption: "A changed caption that says something new." }));
	const stale = run(["--inject", file, "--check"]);
	assert.equal(stale.status, 1);
	assert.match(stale.stdout, /regions are stale/);
	assert.equal(fs.readFileSync(file, "utf8"), html, "--check writes nothing");
});

test("--inject carries data-vpk-id / data-vpk-revision over byte-exact (R20) and never overwrites the meta (R4)", async () => {
	const dir = tmp();
	const { file } = documentFixture(dir, { meta: '\n<meta name="vpk-figure-engine" content="both">' });
	await injectIsoFigures(file);
	const stamped = fs.readFileSync(file, "utf8").replace(/(<figure class="vpk-iso-plate vpk-iso-plate--manual"[^>]*data-vpk-figure="fig-one"[^>]*?)>/, '$1 data-vpk-id="fig:fig-one" data-vpk-revision="3">');
	fs.writeFileSync(file, stamped);
	const result = await injectIsoFigures(file, { check: true });
	assert.equal(result.changed, false, "a stamped file is current under --check");
	await injectIsoFigures(file);
	const html = fs.readFileSync(file, "utf8");
	assert.match(html, /data-vpk-figure="fig-one"[^>]* data-vpk-id="fig:fig-one" data-vpk-revision="3">/);
	assert.equal(count(html, 'name="vpk-figure-engine"'), 1);
	assert.match(html, /<meta name="vpk-figure-engine" content="both">/, "an existing meta is never overwritten");
});

test("--inject leaves region markers inside <script> text alone and warns", async () => {
	const dir = tmp();
	fs.mkdirSync(path.join(dir, "_figures"), { recursive: true });
	fs.writeFileSync(path.join(dir, "_figures", "fig-one.iso.json"), JSON.stringify({ ...EXEMPLAR, id: "fig-one" }));
	const marker = '<!-- vpk-figure:begin engine="iso-kit" id="fig-one" src="_figures/fig-one.iso.json" --><!-- vpk-figure:end id="fig-one" -->';
	const script = `<script>const tpl = '${marker}'; window.tpl = tpl;</script>`;
	const file = path.join(dir, "doc.html");
	const html = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Doc</title>\n</head>\n<body>\n<main>\n\t<h1>Doc</h1>\n\t${script}\n</main>\n</body>\n</html>\n`;
	fs.writeFileSync(file, html);
	const result = await injectIsoFigures(file);
	assert.deepEqual(result.rebuilt, []);
	assert.match(result.warnings.join("\n"), /region marker "fig-one" is inside <script> or <style> text; ignored/);
	const out = fs.readFileSync(file, "utf8");
	assert.ok(out.includes(script), "the script text is byte-identical, so it still parses");
	assert.doesNotMatch(out, /vpk-iso-plate|vpk-figure-engine|vpk-iso:start/, "no figure, meta or iso block for a marker in script text");
});

test("the derived engine meta counts element roots only, never CSS selectors or script strings (R4)", async () => {
	const { deriveFigureEngine, ensureFigureEngineMeta } = await import("../figures/page.mjs");
	const root = renderIsoFigure(EXEMPLAR).region;
	const css = '<style>[data-vpk-engine="anatomy-hero"] { margin: 0; }</style>';
	const js = '<script>const sel = \'[data-vpk-engine="iso-kit"]\';</script>';
	assert.equal(deriveFigureEngine(`${css}${js}`), "none");
	assert.equal(deriveFigureEngine(`${css}${root}`), "iso-kit");
	assert.equal(deriveFigureEngine(`${root}<div data-vpk-engine="anatomy-hero" data-vpk-figure="hero"></div>`), "both");
	const page = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n${css}\n</head>\n<body>\n${root}\n</body>\n</html>\n`;
	assert.match(ensureFigureEngineMeta(page), /<meta name="vpk-figure-engine" content="iso-kit">/);
	assert.equal(ensureFigureEngineMeta(`<html><head>${css}${js}</head><body></body></html>`), `<html><head>${css}${js}</head><body></body></html>`, "no roots: no meta");
});

test("--brief and --inject both fail a brief whose Gap range hides the focal part (A7 at every slider stop)", async () => {
	const dir = tmp();
	const wide = { ...EXEMPLAR, interact: { ...EXEMPLAR.interact, explode: { ...EXEMPLAR.interact.explode, min: 0 } } };
	const briefPath = path.join(dir, "wide.json");
	fs.writeFileSync(briefPath, JSON.stringify(wide));
	const built = run(["--brief", briefPath, "--out", path.join(dir, "wide.html")]);
	assert.equal(built.status, 1);
	assert.match(built.stderr, /✗ A7 FIG_001: label "Module" leader ends under "shell".* at gap 0\.00…0\.15/);
	assert.equal(fs.existsSync(path.join(dir, "wide.html")), false, "nothing written");
	const { file } = documentFixture(dir);
	const src = path.join(dir, "_figures", "fig-one.iso.json");
	fs.writeFileSync(src, JSON.stringify({ ...JSON.parse(fs.readFileSync(src, "utf8")), interact: wide.interact }));
	const result = await injectIsoFigures(file, { check: true });
	assert.ok(result.findings.some(f => f.rule === "A7" && f.severity === "error" && /at gap 0\.00…0\.15/.test(f.message)), JSON.stringify(result.findings));
	const cli = run(["--inject", file, "--check"]);
	assert.equal(cli.status, 1);
	assert.match(cli.stderr, /✗ A7 /);
});

test("--inject without --check leaves the document byte-identical when the rebuilt figure fails the audit (C-iso-10)", async () => {
	const dir = tmp();
	const { file } = documentFixture(dir);
	const src = path.join(dir, "_figures", "fig-one.iso.json");
	const wide = brief => ({ ...brief, interact: { ...brief.interact, explode: { ...brief.interact.explode, min: 0 } } });
	fs.writeFileSync(src, JSON.stringify(wide(JSON.parse(fs.readFileSync(src, "utf8")))));
	const before = fs.readFileSync(file);
	const api = await injectIsoFigures(file);
	assert.ok(api.findings.some(f => f.rule === "A7" && f.severity === "error"), JSON.stringify(api.findings));
	assert.equal(api.changed, true, "the rebuilt document differs");
	assert.equal(api.written, false);
	assert.ok(fs.readFileSync(file).equals(before), "API: nothing written");
	const cli = run(["--inject", file]);
	assert.equal(cli.status, 1);
	assert.match(cli.stderr, /✗ A7 /);
	assert.doesNotMatch(cli.stdout, /^wrote /m);
	assert.match(cli.stdout, /not written \(1 audit error\)/);
	assert.ok(fs.readFileSync(file).equals(before), "CLI: nothing written");
	// A document that already holds a current figure keeps it when its brief turns bad.
	fs.writeFileSync(src, JSON.stringify({ ...EXEMPLAR, id: "fig-one", figId: "FIG_001" }));
	assert.equal(run(["--inject", file]).status, 0);
	const good = fs.readFileSync(file);
	assert.match(good.toString("utf8"), /min="0\.4"/);
	fs.writeFileSync(src, JSON.stringify(wide({ ...EXEMPLAR, id: "fig-one", figId: "FIG_001" })));
	assert.equal(run(["--inject", file]).status, 1);
	assert.ok(fs.readFileSync(file).equals(good), "the passing figure stays");
});

// B2 decision 17a (G2 verifier ws3-A.10): `--inject --check` printed both the audit errors and "iso-kit
// regions are current" with exit 1. One status line now: with audit errors the regions are neither
// current nor stale (they cannot be built), and without errors exactly one of the two.
test("--inject --check prints exactly one status line: current, stale, or the audit failure (decision 17a)", () => {
	const dir = tmp();
	const { file } = documentFixture(dir);
	assert.equal(run(["--inject", file]).status, 0);
	const statusLines = text => text.split("\n").filter(line => /regions are (current|stale)|audit error|not written/.test(line));
	const current = run(["--inject", file, "--check"]);
	assert.equal(current.status, 0);
	assert.equal(statusLines(current.stdout).length, 1);
	assert.match(current.stdout, /^✓ .*doc\.html: iso-kit regions are current\n$/);
	assert.doesNotMatch(current.stderr, /✗|✓/, "stderr carries warnings only");

	const src = path.join(dir, "_figures", "fig-one.iso.json");
	const brief = JSON.parse(fs.readFileSync(src, "utf8"));
	fs.writeFileSync(src, JSON.stringify({ ...brief, caption: "A changed caption that says something new." }));
	const stale = run(["--inject", file, "--check"]);
	assert.equal(stale.status, 1);
	assert.equal(statusLines(stale.stdout).length, 1);
	assert.match(stale.stdout, /regions are stale/);
	assert.doesNotMatch(stale.stdout, /regions are current/);

	// The failing brief: the document on disk is current for the old brief, the new one cannot be built.
	fs.writeFileSync(src, JSON.stringify({ ...brief, interact: { ...brief.interact, explode: { ...brief.interact.explode, min: 0 } } }));
	const before = fs.readFileSync(file);
	const failing = run(["--inject", file, "--check"]);
	assert.equal(failing.status, 1);
	assert.match(failing.stderr, /✗ A7 /);
	assert.doesNotMatch(failing.stdout, /regions are (current|stale)/, "neither current nor stale while the audit fails");
	assert.match(failing.stdout, /✗ .*: 1 audit error; fix the brief, then run build-figure\.mjs --inject /);
	assert.equal(statusLines(failing.stdout).length, 1);
	assert.ok(fs.readFileSync(file).equals(before), "--check writes nothing");
	// Without --check the same failure writes nothing and says so once (decision 17a, refuse to write).
	const write = run(["--inject", file]);
	assert.equal(write.status, 1);
	assert.equal(statusLines(write.stdout).length, 1);
	assert.match(write.stdout, /^✗ .*doc\.html: not written \(1 audit error\)\n$/);
	assert.ok(fs.readFileSync(file).equals(before), "nothing written on audit errors");
	// The document-level audit now sees the failure by itself: the same slider range, hand-edited into the file.
	const handEdited = fs.readFileSync(file, "utf8").replace('min="0.4"', 'min="0"');
	fs.writeFileSync(path.join(dir, "edited.html"), handEdited);
	assert.equal(auditHtmlFile(path.join(dir, "edited.html")).findings.filter(f => f.rule === "A7" && f.severity === "error").length, 1);
});

// B2 decision 17c (G2 verifier ws3-A.11): --inject exited 0 after adding an iso root to a document whose
// meta is "none" or "anatomy-hero", and check-html then failed with E2. R4 keeps the meta as authored; the
// build now says what to change.
test("--inject warns when the document's vpk-figure-engine meta does not cover iso-kit (decision 17c)", async () => {
	const warningFor = async meta => {
		const dir = tmp();
		const { file } = documentFixture(dir, { meta: meta === null ? "" : `\n<meta name="vpk-figure-engine" content="${meta}">` });
		const result = await injectIsoFigures(file);
		return { result, html: fs.readFileSync(file, "utf8"), cli: run(["--inject", file]) };
	};
	for (const meta of ["none", "anatomy-hero"]) {
		const { result, html, cli } = await warningFor(meta);
		assert.equal(result.warnings.filter(text => /does not cover the iso-kit figures/.test(text)).length, 1, `${meta}: ${result.warnings.join(" | ")}`);
		assert.match(result.warnings.join("\n"), new RegExp(`content="${meta}"> does not cover the iso-kit figures.*check-html fails with E2\\); set it to "iso-kit"`));
		assert.match(html, new RegExp(`<meta name="vpk-figure-engine" content="${meta}">`), "the meta is never overwritten (R4)");
		assert.equal(cli.status, 0, "a warning, not a failure");
		assert.match(cli.stderr, /warn <meta name="vpk-figure-engine" content="/);
	}
	for (const meta of ["iso-kit", "both", null]) {
		const { result } = await warningFor(meta);
		assert.deepEqual(result.warnings.filter(text => /does not cover/.test(text)), [], String(meta));
	}
	// A document that also carries an anatomy hero is told to use "both".
	const dir = tmp();
	const { file } = documentFixture(dir, { meta: '\n<meta name="vpk-figure-engine" content="anatomy-hero">' });
	fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("</main>", '<div data-vpk-engine="anatomy-hero" data-vpk-figure="hero"></div>\n</main>'));
	const result = await injectIsoFigures(file, { check: true });
	assert.match(result.warnings.join("\n"), /set it to "both"/);
});

test("--inject rejects id collisions and escaping src paths", async () => {
	const dir = tmp();
	const { file } = documentFixture(dir);
	fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace('data-vpk-fig-id="FIG_002"', 'data-vpk-fig-id="FIG_001"'));
	await assert.rejects(injectIsoFigures(file), /FIG_001 is used by iso-kit regions/);
	const escape = documentFixture(tmp()).file;
	fs.writeFileSync(escape, fs.readFileSync(escape, "utf8").replace('src="_figures/fig-one.iso.json"', 'src="../fig-one.iso.json"'));
	const result = run(["--inject", escape]);
	assert.equal(result.status, 1);
	assert.match(result.stderr, /relative path inside the artifact folder/);
});
