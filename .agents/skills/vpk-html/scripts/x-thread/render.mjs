// renderXThreadHtml: the one renderer for x-thread HTML (template, demo and every filled artifact).
// Node-only. Deterministic from current sources: head metas, the shared CSS and x-thread.css,
// body.html with its @@TOKENS@@ filled by one function replacer, both islands, the bundled
// runtime, then the ws0 runtime pipeline (theme, fonts, enhancements; docnav is opted out).
// WS1's metas and marked blocks from an earlier render are re-inserted verbatim (C6): fill never
// mints or bumps them. Every splice is a slice or a function replacer, never a replacement string.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildFaviconLinkBlock, buildFontFaceBlock, readStylesCss, wrapSharedCss } from "../shared.mjs";
import { inlineIcon } from "../icons.mjs";
import { escapeRegExp, markerPair } from "../runtime/blocks.mjs";
import { applyRuntimePipeline, classifyTarget } from "../runtime/pipeline.mjs";
import { bundleRuntime } from "./bundle.mjs";
import { contentIslandTag, escapeHtmlText, stateIslandTag } from "./islands.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BODY_FILE = path.join(HERE, "body.html");
export const CSS_FILE = path.join(HERE, "x-thread.css");
export const PRESERVED_METAS = Object.freeze(["vpk-doc-id", "vpk-doc-revision"]);
export const PRESERVED_HEAD_BLOCKS = Object.freeze(["review-content"]);
export const PRESERVED_BODY_BLOCKS = Object.freeze(["revisions", "review-data", "review"]);
const ENHANCE_START = "<!-- vpkh-enhance:begin -->";

const block = id => {
	const { start, end } = markerPair(id);
	return new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`);
};

// WS1's parts of an earlier render, verbatim and in document order.
export function extractPreserved(html) {
	const source = String(html ?? "");
	const metas = (source.match(/<meta\b[^>]*>/gi) || []).filter(tag => PRESERVED_METAS.some(name => new RegExp(`\\bname=["']${name}["']`, "i").test(tag)));
	const pick = ids => ids.map(id => block(id).exec(source)).filter(Boolean).sort((a, b) => a.index - b.index).map(match => match[0]);
	return { metas, headBlocks: pick(PRESERVED_HEAD_BLOCKS), bodyBlocks: pick(PRESERVED_BODY_BLOCKS) };
}

// First non-empty post, whitespace collapsed, cut at a word boundary to at most 150 characters.
export function describeThread(content) {
	const first = (content?.posts || []).map(post => String(post.text || "").replace(/\s+/g, " ").trim()).find(Boolean) || String(content?.title || "");
	if ([...first].length <= 150) return first;
	const cut = [...first].slice(0, 149).join("");
	return `${cut.replace(/\s+\S*$/, "") || cut}…`;
}

function iconHtml(token) {
	return inlineIcon(token.slice("ICON_".length).toLowerCase().replace(/_/g, "-"));
}

function bylineHtml(author) {
	const name = author?.name ? escapeHtmlText(author.name) : "";
	const handle = author?.handle ? `<span class="xt-handle">@${escapeHtmlText(author.handle.replace(/^@/, ""))}</span>` : "";
	return name || handle ? `By ${[name, handle].filter(Boolean).join(" ")}` : "X thread";
}

function headComment(kind) {
	if (kind === "template") return "<!-- TEMPLATE · X Thread (vpk-html) · regenerate with node .agents/skills/vpk-html/scripts/x-thread/build-template.mjs -->";
	if (kind === "demo") return "<!-- DEMO · X Thread (vpk-html) · regenerate with node .agents/skills/vpk-html/scripts/x-thread/build-template.mjs -->";
	return "<!-- X Thread (vpk-html) · rendered from <slug>.content.json; re-render with node .agents/skills/vpk-html/scripts/x-thread.mjs fill -->";
}

export function renderXThreadHtml({ content, state, lang = "en", filePath, placeholders = false, preserved = {} }) {
	if (!filePath) throw new Error("renderXThreadHtml requires filePath (it picks the pipeline kind)");
	const kind = placeholders ? "template" : classifyTarget(path.resolve(filePath));
	const { metas = [], headBlocks = [], bodyBlocks = [] } = preserved;
	const title = placeholders ? "{{DOC_TITLE}}" : escapeHtmlText(content.title);
	const values = {
		TITLE_HTML: title,
		BYLINE_HTML: placeholders ? "By {{AUTHOR}}" : bylineHtml(content.author),
		CONTENT_ISLAND: contentIslandTag(content),
		STATE_ISLAND: stateIslandTag(state),
		RUNTIME: bundleRuntime(),
	};
	const body = fs.readFileSync(BODY_FILE, "utf8").trimEnd().replace(/@@([A-Z0-9_]+)@@/g, (_, name) => {
		if (name.startsWith("ICON_")) return iconHtml(name);
		if (!Object.hasOwn(values, name)) throw new Error(`body.html uses an unknown token @@${name}@@`);
		return values[name];
	});
	const authorMeta = placeholders ? "{{AUTHOR}}" : escapeHtmlText(content.author?.name || content.author?.handle || "vpk-html");
	const description = placeholders ? "{{DESCRIPTION}}" : escapeHtmlText(describeThread(content));
	const head = [
		"<!doctype html>",
		headComment(kind),
		`<html lang="${escapeHtmlText(lang)}">`,
		"<head>",
		"<meta charset=\"utf-8\">",
		`<title>${title}</title>`,
		`<meta name="author" content="${authorMeta}">`,
		`<meta name="description" content="${description}">`,
		"<meta name=\"generator\" content=\"vpk-html\">",
		...metas,
		buildFaviconLinkBlock(),
		"<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
		"<style>",
		buildFontFaceBlock(),
		wrapSharedCss(readStylesCss()),
		fs.readFileSync(CSS_FILE, "utf8").trimEnd(),
		"</style>",
		...headBlocks,
		"</head>",
	].join("\n");
	let html = applyRuntimePipeline(`${head}\n${body}\n</html>\n`, { filePath, kind });
	if (bodyBlocks.length) {
		const at = html.lastIndexOf(ENHANCE_START);
		const cut = at >= 0 ? at : html.toLowerCase().lastIndexOf("</body>");
		html = applyRuntimePipeline(`${html.slice(0, cut)}${bodyBlocks.join("\n")}\n${html.slice(cut)}`, { filePath, kind });
	}
	return html;
}
