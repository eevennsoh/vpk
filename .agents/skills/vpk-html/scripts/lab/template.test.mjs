// assets/templates/motion-case-study.html and its generator lab/build-template.mjs (ws4a-labs.md §9 template).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateHtmlFile } from "../check-html.mjs";
import { TEMPLATE_HEADER, TEMPLATE_PATH, assembleTemplate, ownedParts, runtimeTail, templateDrift } from "./build-template.mjs";
import { LAB_MARKERS, checkLabHtml, collectLabMarkupIssues } from "./kit.mjs";
import { REGION_NAMES, regionMarkers } from "./render-case-study.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const HTML = fs.readFileSync(TEMPLATE_PATH, "utf8");
const count = (text, needle) => text.split(needle).length - 1;

test("the template passes check-html and carries the kit contract", () => {
	const result = validateHtmlFile(TEMPLATE_PATH);
	assert.deepEqual(result.failures, []);
	assert.deepEqual(result.warnings, []);
	for (const needle of [LAB_MARKERS.start, "data-vpk-film ", "data-vpk-gantt ", "data-vpk-cues ", 'data-vpk-lab="easing"', "data-vpk-lab-source", "<script data-vpk-lab-doc>", "<style data-vpk-case-study>"]) {
		assert.ok(HTML.includes(needle), needle);
	}
	assert.equal(count(HTML, LAB_MARKERS.start), 1);
	assert.ok(HTML.includes("<!-- figure slot: place vpk-figure markers here when the contract picks iso-kit, anatomy-hero or both (references/figure-engines.md) -->"));
	for (const name of REGION_NAMES) {
		const { start, end } = regionMarkers(name);
		assert.equal(count(HTML, start), 1, start);
		assert.equal(count(HTML, end), 1, end);
		assert.ok(HTML.indexOf(start) < HTML.indexOf(end));
	}
	assert.doesNotMatch(HTML, /(^|[^-])ease-in(?!-)/i, "no bare ease-in");
	assert.match(HTML, /<meta name="generator" content="vpk-html">/);
	assert.ok(HTML.includes(TEMPLATE_HEADER), "this template's header comment");
	assert.match(HTML, /<html lang="en" data-vpk-literal-double-braces="true">/);
	assert.match(HTML, /<body data-vpk-motion="document" data-vpk-docnav="true">/);
	assert.deepEqual(collectLabMarkupIssues(HTML), []);
	assert.equal(checkLabHtml(HTML).ok, true);
});

test("the film is empty: no src and no placeholders on the video, so --verify makes no requests", () => {
	const video = /<video\b[^>]*>/.exec(HTML)[0];
	assert.doesNotMatch(video, /\ssrc=|poster=|\{\{/);
	assert.match(video, /data-vpk-film-video/);
	assert.match(video, /\smuted\b/);
	assert.match(video, /\splaysinline\b/);
	assert.doesNotMatch(video, /autoplay/);
	const data = JSON.parse(/<script type="application\/json" data-vpk-film-data>([\s\S]*?)<\/script>/.exec(HTML)[1]);
	assert.equal(data.fps, 30);
	assert.equal(data.segments.length, 1);
	assert.equal(data.segments[0].kind, "real");
	assert.equal(data.chapters.length, 1);
});

test("every main > section ends with speaker notes, and the sections follow the skeleton", () => {
	const main = ownedParts(HTML).main;
	const ids = [...main.matchAll(/<section id="([^"]+)">/g)].map(match => match[1]);
	assert.deepEqual(ids, ["film", "brief", "process", "run-of-show", "lab-1", "engineering", "discards", "credits"]);
	for (const section of main.split(/<section id=/).slice(1)) {
		const body = section.slice(0, section.indexOf("</section>")).trimEnd();
		assert.match(body, /<aside class="speaker-notes" aria-hidden="true">[^<]*<\/aside>$/, `section ${section.slice(1, 20)}`);
	}
	assert.match(main, /<header class="essay-header" id="opening">[\s\S]*<dl class="fact-strip">/);
});

test("the tail is feature-essay's runtime tail; the doc script sits between </main> and the theme runtime", () => {
	const shell = fs.readFileSync(path.join(here, "..", "..", "assets", "templates", "feature-essay.html"), "utf8");
	const tail = runtimeTail(shell);
	assert.match(tail, /^\n<!-- vpk-theme-runtime:start -->/);
	assert.ok(HTML.indexOf("<script data-vpk-lab-doc>") > HTML.indexOf("</main>"));
	assert.ok(HTML.indexOf("<script data-vpk-lab-doc>") < HTML.indexOf("<!-- vpk-theme-runtime:start -->"));
	assert.ok(HTML.indexOf(LAB_MARKERS.end) < HTML.indexOf("<!-- vpkh-enhance:begin -->"), "the enhancement block stays last");
	const assembled = assembleTemplate();
	assert.equal(count(assembled, "</body>"), 1);
	assert.doesNotMatch(assembled, /TEMPLATE - editorial document/);
});

test("--check compares owned parts only and catches a hand edit", async () => {
	assert.deepEqual(await templateDrift(HTML), []);
	const editedMain = HTML.replace("{{Brief heading}}", "Edited");
	assert.deepEqual(await templateDrift(editedMain), ["main"]);
	const editedHead = HTML.replace("<title>{{DOC_TITLE}}</title>", "<title>Other</title>");
	assert.deepEqual(await templateDrift(editedHead), [], "the head is the pipeline's, not this script's");
	const staleLab = HTML.replace("installLab(globalThis);", "installLab(globalThis); ");
	assert.deepEqual(await templateDrift(staleLab), ["lab", "lab (kit.mjs)"]);
	const cli = spawnSync(process.execPath, [path.join(here, "build-template.mjs"), "--check"], { encoding: "utf8", env: { ...process.env, OPENSSL_CONF: "/dev/null" } });
	assert.equal(cli.status, 0, cli.stderr);
	assert.equal(spawnSync(process.execPath, [path.join(here, "build-template.mjs"), "--bogus"], { encoding: "utf8" }).status, 2);
});
