// lab/render-case-study.mjs: content IR → regions, the content island, authored film data and lab parts
// (ws4a-labs.md §9 render-case-study, integration R8/R20).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateHtmlString } from "../check-html.mjs";
import { checkIslands, loadSchema, validateEnvelope, validateNode } from "../content-ir.mjs";
import { findJsonIslands, parseJsonIsland } from "../json-island.mjs";
import {
	CONTENT_TYPE, REGION_NAMES, applyCaseStudy, authoredFilmData, caseStudyContentIssues, caseStudyDrift, checkCaseStudyHtml, contentOf,
	labPartRange, mergeFilmData, regionRange, renderCaseStudy,
} from "./render-case-study.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.join(here, "..", "..");
const FIXTURE = path.join(SKILL, "assets", "lab", "fixtures", "demo.content.json");
const IR = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
const TEMPLATE = fs.readFileSync(path.join(SKILL, "assets", "templates", "motion-case-study.html"), "utf8");
const CLI = path.join(here, "render-case-study.mjs");
const island = html => findJsonIslands(html, "data-vpk-content").find(entry => entry.attrs["data-vpk-content"] === CONTENT_TYPE);

test("the fixture IR is a valid motion-case-study envelope, and the schema example is its byte copy (R8, A7)", () => {
	const { schema, issues } = loadSchema(CONTENT_TYPE);
	assert.deepEqual(issues, []);
	assert.deepEqual(validateNode(IR.content, schema, "content"), []);
	const { findings } = validateEnvelope(IR);
	assert.deepEqual(findings.filter(item => item.severity === "error"), []);
	const example = path.join(SKILL, "references", "schemas", "examples", "motion-case-study.content.json");
	assert.equal(fs.readFileSync(example, "utf8"), fs.readFileSync(FIXTURE, "utf8"));
	const broken = structuredClone(IR.content);
	broken.labs[0].source = "";
	assert.ok(validateNode(broken, schema, "content").some(issue => issue.path === "content.labs[0].source"), "a lab needs its maths source");
});

test("cues carry IR ids and data-film or data-clock + data-t (§4.13); no data-vpk-id is written", () => {
	const rendered = renderCaseStudy(IR);
	const ids = [...rendered.regions.cues.matchAll(/data-vpk-cue="([^"]+)"/g)].map(match => match[1]);
	assert.deepEqual(ids, IR.content.cues.map(cue => cue.id));
	assert.match(rendered.regions.cues, /data-vpk-cue="t1-throw" data-act="Throw 1" data-clock="clock" data-t="0.6"/);
	const filmCue = renderCaseStudy({ ...IR.content, cues: [{ id: "a", act: "Act", film_s: 12.5, title: "At film time" }] });
	assert.match(filmCue.regions.cues, /data-vpk-cue="a" data-act="Act" data-film="12.5"/);
	for (const html of Object.values(rendered.regions)) assert.doesNotMatch(String(html), /data-vpk-id|data-vpk-revision/);
	assert.match(rendered.regions.process, /data-vpk-filters="process"[^>]*data-vpkh-no-lightbox/);
	assert.match(rendered.regions.gantt, /data-vpk-gantt[^>]*data-vpkh-no-lightbox[^>]*role="slider"/);
	assert.match(rendered.regions.layers, /data-vpk-layers data-vpkh-no-lightbox/);
	assert.match(rendered.regions.discards, /data-vpk-flip-deck data-vpkh-no-lightbox/);
	assert.equal(contentOf(IR), IR.content);
});

test("the island round-trips through parseJsonIsland and rendering is deterministic", () => {
	const a = renderCaseStudy(IR);
	const b = renderCaseStudy(structuredClone(IR));
	assert.deepEqual(a, b);
	const parsed = parseJsonIsland(island(a.island).raw);
	assert.deepEqual(parsed, IR.content);
	assert.equal(applyCaseStudy(TEMPLATE, a), applyCaseStudy(applyCaseStudy(TEMPLATE, a), a), "applying twice changes nothing");
});

test("authored film data: a clock segment from clock_offset_s, chapters in film time, posterTime", () => {
	const data = authoredFilmData(IR.content);
	assert.deepEqual(data.segments, [{ id: "clock", label: "clock", kind: "hold", clock: { kind: "linear", start: 0, rate: 1 }, film: [0, 6.0333] }]);
	assert.deepEqual(data.chapters, [{ label: "Throw 1", film: 0 }, { label: "Throw 2", film: 2 }, { label: "Throw 3", film: 4 }]);
	assert.equal(data.posterTime, 3.3);
	const offset = authoredFilmData({ film: { duration_s: 82.03, fps: 30, clock_offset_s: 20.3, clock_label: "finale" }, chapters: [] });
	assert.deepEqual(offset.segments.map(segment => [segment.id, segment.kind, segment.film]), [["real", "real", [0, 20.3]], ["clock", "hold", [20.3, 82.03]]]);
	assert.deepEqual(authoredFilmData({ film: { duration_s: 5, fps: 24 }, chapters: [] }).segments.map(segment => segment.kind), ["real"]);
	const embedded = { version: 1, fps: 30, duration: 6.033333, segments: [{ id: "clock", kind: "hold", film: [0, 6.033333] }], marks: { throw: 1 } };
	const merged = mergeFilmData(embedded, data);
	assert.equal(merged.duration, 6.033333, "after embed, duration and segments belong to embed.mjs");
	assert.deepEqual(merged.marks, { throw: 1 });
	assert.deepEqual(merged.chapters, data.chapters, "chapters stay authored");
	assert.deepEqual(mergeFilmData({ duration: 0 }, data).segments, data.segments, "before embed, segments come from the IR");
});

test("applying into the template replaces regions, lab parts, film data and inserts the island; prose is untouched", () => {
	const out = applyCaseStudy(TEMPLATE, renderCaseStudy(IR));
	for (const name of REGION_NAMES) assert.ok(regionRange(out, name), `region ${name}`);
	assert.match(out.slice(...regionRange(out, "cues")), /The throw, eased vpkOut/);
	assert.doesNotMatch(out.slice(...regionRange(out, "cues")), /\{\{Cue title\}\}/);
	assert.equal(out.slice(...labPartRange(out, "easing", "data-vpk-lab-source")), 'Maths ported from <code class="vpk-code">assets/lab/fixtures/rehearsal-target.html:26-66</code>');
	assert.equal(out.slice(...labPartRange(out, "easing", 'class="vpk-lab-title"')), "Easing the throw");
	const film = parseJsonIsland(findJsonIslands(out, "data-vpk-film-data")[0].raw);
	assert.equal(film.duration, 6.0333);
	assert.equal(film.chapters.length, 3);
	assert.ok(/<main class="essay-page">\n<script type="application\/json" data-vpk-content="motion-case-study">/.test(out), "the island sits right after <main>");
	const prose = html => html.replace(/<!-- vpk-region (\S+) -->[\s\S]*?<!-- \/vpk-region \1 -->/g, "").replace(/\n?<script type="application\/json"[\s\S]*?<\/script>/g, "").replace(/<p class="vpk-lab-source"[\s\S]*?<\/p>/, "").replace(/<h3 class="vpk-lab-title">[^<]*<\/h3>/, "");
	assert.equal(prose(out), prose(TEMPLATE), "nothing outside the owned parts changes");
	const result = validateHtmlString(out, "rendered.html");
	assert.deepEqual(result.failures, []);
});

test("hostile text stays check-html clean: '#feed {{x}} rgb(1,2,3)' in a cue title and a lab source", () => {
	const hostile = structuredClone(IR);
	hostile.content.cues[0].title = "#feed {{x}} rgb(1,2,3)";
	hostile.content.labs[0].source = "#beef.mjs:1-2 (rgb(0,0,0))";
	const out = applyCaseStudy(TEMPLATE, renderCaseStudy(hostile));
	const result = validateHtmlString(out.replace(' data-vpk-literal-double-braces="true"', ""), "hostile.html");
	assert.deepEqual(result.failures.filter(failure => !/placeholder/.test(failure)), []);
	assert.doesNotMatch(out.slice(...regionRange(out, "cues")), /\{\{x\}\}|#feed|rgb\(/, "escaped as entities");
	assert.equal(parseJsonIsland(island(out).raw).cues[0].title, "#feed {{x}} rgb(1,2,3)", "the island keeps the exact text");
});

test("drift: a hand-edited region, lab source or island is reported; ws1 stamps are ignored (R20)", () => {
	const rendered = renderCaseStudy(IR);
	const out = applyCaseStudy(TEMPLATE, rendered);
	assert.deepEqual(caseStudyDrift(out, rendered), []);
	assert.deepEqual(caseStudyDrift(out.replace('<span class="vpk-cue-name">The throw, eased vpkOut', '<span class="vpk-cue-name">The throw, edited'), rendered), ["region cues"]);
	assert.deepEqual(caseStudyDrift(out.replace("rehearsal-target.html:26-66</code>", "elsewhere.js:1</code>"), rendered), ["lab easing source"]);
	assert.deepEqual(caseStudyDrift(out.replace('"title":"Three throws, one clock"', '"title":"Other"'), rendered), ["content island"]);
	const stamped = out.replace('<button type="button" class="vpk-cue" data-vpk-cue="t1-lift"', '<button type="button" class="vpk-cue" data-vpk-id="k3x9q2" data-vpk-revision="r2" data-vpk-cue="t1-lift"');
	assert.notEqual(stamped, out);
	assert.deepEqual(caseStudyDrift(stamped, rendered), [], "stamped ids do not count as drift");
	assert.deepEqual(caseStudyDrift(TEMPLATE, rendered).slice(0, 2), ["region process", "region gantt"]);
});

test("CLI: --into writes, --check exits 0 then 1 after an edit, and prints the --stamp hint beside a ledger", () => {
	const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "vpk-render-")));
	try {
		const file = path.join(dir, "case.html");
		fs.writeFileSync(file, TEMPLATE);
		const run = (...args) => spawnSync(process.execPath, [CLI, FIXTURE, ...args], { encoding: "utf8", cwd: dir, env: { ...process.env, OPENSSL_CONF: "/dev/null" } });
		assert.equal(run("--into", file, "--check").status, 1, "the template differs before rendering");
		const write = run("--into", file);
		assert.equal(write.status, 0, write.stderr);
		assert.match(write.stdout, /✓ rendered case\.html/);
		assert.equal(run("--into", file, "--check").status, 0);
		assert.match(run("--into", file).stdout, /^unchanged case\.html$/m);
		fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace('<span class="vpk-cue-name">A spring landing', '<span class="vpk-cue-name">A spring landing (edited)'));
		fs.writeFileSync(path.join(dir, "case.vpk-blocks.json"), "{}");
		const check = run("--into", file, "--check");
		assert.equal(check.status, 1);
		assert.match(check.stderr, /differs from .* in region cues/);
		assert.match(check.stdout, /--stamp case\.html to restore block ids/);
		assert.equal(run().status, 0, "without --into it prints the regions");
		assert.equal(spawnSync(process.execPath, [CLI], { encoding: "utf8" }).status, 2);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("duplicate cue, lab or timeline-kind ids are refused: render, --into, and the island hook ws6's checkIslands runs (B2 12(c))", async () => {
	const dup = structuredClone(IR);
	dup.content.cues[1].id = dup.content.cues[0].id;
	dup.content.timeline.kinds[2].id = "design";
	assert.deepEqual(caseStudyContentIssues(IR.content), [], "the fixture is clean");
	assert.deepEqual(caseStudyContentIssues(dup.content), [
		{ severity: "error", path: "content.cues[1].id", message: 'duplicate id "t1-lift" (first at cues[0]); ids must be unique' },
		{ severity: "error", path: "content.timeline.kinds[2].id", message: 'duplicate id "design" (first at timeline.kinds[0]); ids must be unique' },
	]);
	assert.throws(() => renderCaseStudy(dup), /^Error: render-case-study: nothing rendered: content\.cues\[1\]\.id: duplicate id "t1-lift"/);
	const good = applyCaseStudy(TEMPLATE, renderCaseStudy(IR));
	assert.deepEqual(checkCaseStudyHtml(good), { ok: true, errors: [], warnings: [] });
	const swapped = good.replace(island(good).raw, island(good).raw.replace('"id":"t1-throw"', '"id":"t1-lift"'));
	assert.notEqual(swapped, good);
	assert.match(checkCaseStudyHtml(swapped).errors.join("\n"), /^content\.cues\[1\]\.id: duplicate id "t1-lift"/);
	const buttons = good.replace('data-vpk-cue="t1-throw"', 'data-vpk-cue="t1-lift"');
	assert.deepEqual(checkCaseStudyHtml(buttons).errors, ['2 cue buttons share data-vpk-cue="t1-lift"; cue ids must be unique (fix cues[].id in the content IR and re-render)']);
	// The registration the B2 integrator adds to CONTENT_TYPE_HOOKS, run through ws6's own hook runner.
	const hooks = { "motion-case-study": { template: "motion-case-study.html", module: "./lab/render-case-study.mjs", check: "checkCaseStudyHtml" } };
	assert.deepEqual((await checkIslands(good, { hooks })).findings, []);
	const { islands, findings } = await checkIslands(swapped, { hooks });
	assert.deepEqual(islands, [{ type: CONTENT_TYPE, ok: false }]);
	assert.match(findings.map(item => `${item.severity} ${item.path} ${item.message}`).join("\n"), /^error island\[motion-case-study\] content\.cues\[1\]\.id: duplicate id "t1-lift"/);
	const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "vpk-render-dup-")));
	try {
		const [file, sidecar] = [path.join(dir, "case.html"), path.join(dir, "dup.content.json")];
		fs.writeFileSync(file, TEMPLATE);
		fs.writeFileSync(sidecar, JSON.stringify(dup));
		for (const args of [["--into", file], ["--into", file, "--check"]]) {
			const result = spawnSync(process.execPath, [CLI, sidecar, ...args], { encoding: "utf8", env: { ...process.env, OPENSSL_CONF: "/dev/null" } });
			assert.equal(result.status, 1, args.join(" "));
			assert.match(result.stderr, /nothing rendered: content\.cues\[1\]\.id: duplicate id "t1-lift"/);
		}
		assert.equal(fs.readFileSync(file, "utf8"), TEMPLATE, "nothing written");
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});
