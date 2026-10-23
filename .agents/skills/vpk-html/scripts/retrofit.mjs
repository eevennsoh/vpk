#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
	SHARED_CSS_END,
	SHARED_CSS_START,
	addLabeledMainLandmark,
	buildChartInteractionScriptBlock,
	ensureFaviconLinks,
	readStylesCss,
	wrapSharedCss,
} from "./shared.mjs";
import { isDeck, retrofitDeck, retrofitDocumentNav } from "./presentation.mjs";
import { escapeRegExp } from "./runtime/blocks.mjs";

function replaceRange(source, start, end, replacement) {
	return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

function findBlockEnd(source, openBraceIndex) {
	let depth = 0;
	for (let index = openBraceIndex; index < source.length; index++) {
		const char = source[index];
		if (char === "{") depth += 1;
		else if (char === "}") {
			depth -= 1;
			if (depth === 0) return index + 1;
		}
	}
	return -1;
}

function findSharedRange(html) {
	const marked = new RegExp(`${escapeRegExp(SHARED_CSS_START)}[\\s\\S]*?${escapeRegExp(SHARED_CSS_END)}`).exec(html);
	if (marked) {
		return { start: marked.index, end: marked.index + marked[0].length };
	}

	const rootMatches = [...html.matchAll(/\n[\t ]*:root\s*\{/g)];
	const root = rootMatches.find(match => html.slice(match.index, match.index + 180).includes("color-scheme: light dark"));
	if (!root) return null;

	const start = root.index + 1;
	const localRoot = rootMatches.find(match => match.index > start + 20 && !html.slice(match.index, match.index + 220).includes("color-scheme: light dark"));
	if (localRoot) {
		return { start, end: localRoot.index + 1 };
	}

	const reducedMotion = html.indexOf("@media (prefers-reduced-motion: reduce)", start);
	if (reducedMotion < 0) return null;
	const mediaOpen = html.indexOf("{", reducedMotion);
	if (mediaOpen < 0) return null;
	const mediaEnd = findBlockEnd(html, mediaOpen);
	if (mediaEnd < 0) return null;
	return { start, end: mediaEnd };
}

export function refreshSharedCss(html) {
	const range = findSharedRange(html);
	if (!range) return html;
	const shared = wrapSharedCss(readStylesCss());
	return replaceRange(html, range.start, range.end, shared);
}

export function refreshChartRuntime(html) {
	if (!/<script\b[^>]*\bdata-vpk-chart-runtime\b/i.test(html)) return html;
	return html.replace(/<script\b[^>]*\bdata-vpk-chart-runtime\b[^>]*>[\s\S]*?<\/script>/gi, buildChartInteractionScriptBlock());
}

function markLiteralDoubleBraces(html) {
	if (/data-vpk-literal-double-braces=["']true["']/.test(html)) return html;
	return html.replace(/<html\b([^>]*)>/i, '<html$1 data-vpk-literal-double-braces="true">');
}

function ensureFirstSvgLabel(html, label) {
	return html.replace(/<svg\b(?![^>]*\baria-(?:label|hidden|labelledby)=)([^>]*)>/i, `<svg aria-label="${label}"$1>`);
}

function normalizeDiagramPage(html, filePath) {
	if (!filePath.includes(`${path.sep}assets${path.sep}diagrams${path.sep}`)) return html;
	const name = path.basename(filePath, ".html").replace(/-/g, " ");
	let output = markLiteralDoubleBraces(html);
	output = addLabeledMainLandmark(output, "vpk-html diagram primitive");
	output = ensureFirstSvgLabel(output, `${name} diagram primitive`);
	return output;
}

// Pure: the shared-CSS, chart-runtime, favicon, deck/docnav, and diagram-page refresh for one
// committed file. html-effectiveness snapshots are returned unchanged. runtime/pipeline.mjs
// runs this as its `retrofit` step for templates, demos, index, diagrams, and illustrations.
export function retrofitHtml(html, filePath) {
	if (/[/\\]assets[/\\]html-effectiveness[/\\]/.test(filePath)) return html;
	let after = refreshSharedCss(html);
	after = refreshChartRuntime(after);
	after = ensureFaviconLinks(after);

	const speakerNotePlaceholders = path.basename(filePath) === "slides.html" && filePath.includes(`${path.sep}assets${path.sep}templates${path.sep}`);
	if (isDeck(after)) {
		after = retrofitDeck(after, { speakerNotePlaceholders });
	} else if (!filePath.includes(`${path.sep}assets${path.sep}diagrams${path.sep}`) && !filePath.includes(`${path.sep}assets${path.sep}illustrations${path.sep}`)) {
		after = retrofitDocumentNav(after);
	} else {
		after = after.replace(/<body\b(?![^>]*\bdata-vpk-motion=)([^>]*)>/i, `<body$1 data-vpk-motion="document">`);
	}
	return normalizeDiagramPage(after, filePath);
}

// Alias CLI: the per-file retrofit now runs inside the full library refresh.
async function main() {
	const { runLibraryRefreshCli } = await import("./runtime/pipeline.mjs");
	process.exitCode = await runLibraryRefreshCli({ script: "retrofit.mjs", argv: process.argv.slice(2) });
}

function isMainModule() {
	try {
		return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
	} catch {
		return false;
	}
}

// Not awaited: pipeline.mjs imports this module, so its evaluation must finish first.
if (isMainModule()) {
	main().catch(error => { console.error(error); process.exitCode = 1; });
}
