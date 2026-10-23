#!/usr/bin/env node
// Generator for the committed x-thread template and demo (Node-only, entry-guarded).
//
//   node .agents/skills/vpk-html/scripts/x-thread/build-template.mjs           # write when changed (unsandboxed)
//   node .agents/skills/vpk-html/scripts/x-thread/build-template.mjs --check   # exit 1 on drift
//
// The template carries placeholders ({{DOC_TITLE}}, {{AUTHOR}}, {{DESCRIPTION}}) and the template
// thread id; it exists for the catalog, --check-templates and placeholder safety. Artifacts are
// rendered from <slug>.content.json by x-thread.mjs fill, never copied from it. The demo renders
// references/schemas/examples/x-thread.content.json, so its island equals the example by construction.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { DEMOS, ROOT, TEMPLATES } from "../shared.mjs";
import { TEMPLATE_THREAD_ID, emptyState } from "./islands.mjs";
import { renderXThreadHtml } from "./render.mjs";

export const TEMPLATE_PATH = path.join(TEMPLATES, "x-thread.html");
export const DEMO_PATH = path.join(DEMOS, "demo-x-thread.html");
export const EXAMPLE_PATH = path.join(ROOT, "references", "schemas", "examples", "x-thread.content.json");
export const DEMO_THREAD_ID = "demo-x-thread";

// Never bundled into the page; the content island escapes "{{" anyway.
export const TEMPLATE_CONTENT = Object.freeze({
	title: "{{DOC_TITLE}}",
	author: Object.freeze({ name: "{{AUTHOR}}" }),
	posts: Object.freeze([Object.freeze({ id: "p1", text: "{{POST_1}}" })]),
});

export function readExample() {
	return JSON.parse(fs.readFileSync(EXAMPLE_PATH, "utf8"));
}

export function buildTargets() {
	const example = readExample();
	return [
		{ path: TEMPLATE_PATH, html: renderXThreadHtml({ content: TEMPLATE_CONTENT, state: emptyState(TEMPLATE_THREAD_ID), lang: "en", filePath: TEMPLATE_PATH, placeholders: true }) },
		{ path: DEMO_PATH, html: renderXThreadHtml({ content: example.content, state: emptyState(DEMO_THREAD_ID), lang: example.lang || "en", filePath: DEMO_PATH }) },
	];
}

function main(argv) {
	const check = argv.includes("--check");
	let drift = 0;
	for (const target of buildTargets()) {
		const rel = path.relative(process.cwd(), target.path);
		const current = fs.existsSync(target.path) ? fs.readFileSync(target.path, "utf8") : null;
		if (current === target.html) {
			console.log(`✓ ${rel} is current`);
			continue;
		}
		drift += 1;
		if (check) {
			console.log(`✗ ${rel} is ${current === null ? "missing" : "out of date"}; run node .agents/skills/vpk-html/scripts/x-thread/build-template.mjs`);
		} else {
			fs.writeFileSync(target.path, target.html, "utf8");
			console.log(`wrote ${rel} (${Buffer.byteLength(target.html)} bytes)`);
		}
	}
	return check && drift ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	process.exitCode = main(process.argv.slice(2));
}
