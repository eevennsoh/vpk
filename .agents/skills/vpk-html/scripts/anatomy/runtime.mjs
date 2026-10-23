// Anatomy hero runtime sources and the two document blocks (ws4b spec sections 4.4 and 4.8; integration K2).
//
// The hero runtime is one IIFE: a curated subset of the vendored kit (camera, solids, lines on faces,
// parts, translateAlong, holdStill, topMatrix, sideMatrix, screenRise, fitProjection), the shared frame loop
// (runtime/frame-loop.mjs, `export ` stripped, K4) and the mount runtime. refreshAnatomyRuntime() keeps one
// CSS block in <head> and one runtime block before </body> while any hero root exists, and removes both
// once none remains. Sources are read lazily and memoized (R28): importing this module reads no file.
import fs from "node:fs";
import { engineRoots } from "../figures/check-figures.mjs";
import { markerPair, removeMarkedBlock, upsertMarkedBlock, upsertMarkedHeadBlock } from "../runtime/blocks.mjs";
import { anatomyCss } from "./css.mjs";

const KIT_URL = new URL("./vendor/kit/iso-kit.mjs", import.meta.url);
const FRAME_LOOP_URL = new URL("../runtime/frame-loop.mjs", import.meta.url);
const MOUNT_URL = new URL("./mount-runtime.mjs", import.meta.url);

export const CSS_MARKERS = markerPair("anatomy-css");
export const RUNTIME_MARKERS = markerPair("anatomy-runtime");
export const ANATOMY_BLOCKS_BUDGET_BYTES = 40960;

// Top-level declarations that stay out of pages: markup builders, page CSS and halos (17 of 70).
export const RUNTIME_EXCLUDE = Object.freeze([
	"escape", "attrs", "solidSvg", "lineSvg", "dotsSvg", "fadedSvg", "fadeLineSvg", "wireSvg", "faceTextSvg",
	"groupSvg", "figureSvg", "swatchSvg", "plateHtml", "pageHtml", "PAGE_CSS", "ISO_CSS", "haloOf",
]);

const DECLARATION = /^(?:export )?(?:function|const|let) (\w+)/;
const memo = new Map();
const once = (key, make) => (memo.has(key) ? memo.get(key) : memo.set(key, make()).get(key));
const read = url => fs.readFileSync(url, "utf8");

// Every top-level declaration of the vendored kit, in source order: { name, source } with `export ` stripped.
export function kitDeclarations() {
	return once("declarations", () => {
		const out = [];
		for (const line of read(KIT_URL).split("\n")) {
			const match = line.match(DECLARATION);
			if (match) out.push({ name: match[1], lines: [line.replace(/^export /, "")] });
			else if (out.length) out[out.length - 1].lines.push(line);
		}
		return out.map(({ name, lines }) => ({ name, source: lines.join("\n").trimEnd() }));
	});
}

export function kitRuntimeNames() {
	return kitDeclarations().map(({ name }) => name).filter(name => !RUNTIME_EXCLUDE.includes(name));
}

// The kit subset as one script fragment. Leading indentation is dropped (the kept declarations hold no
// multi-line strings), which keeps both blocks inside their 40,960 B budget; T4 proves parity.
export function kitRuntimeSource() {
	return once("kit", () => kitDeclarations()
		.filter(({ name }) => !RUNTIME_EXCLUDE.includes(name))
		.map(({ source }) => source.split("\n").map(line => line.trimStart()).join("\n"))
		.join("\n"));
}

// Full-line comments and leading indentation dropped, `export ` stripped. Safe for the frame loop and the mount
// runtime because neither holds a multi-line string or template literal (T5 runs the result).
const inlineLines = text => text
	.split("\n")
	.filter(line => !/^\s*\/\//.test(line))
	.map(line => line.trimStart())
	.join("\n")
	.replace(/^export /gm, "")
	.trim();

export function frameLoopSource() {
	return once("loop", () => inlineLines(read(FRAME_LOOP_URL)));
}

export function mountRuntimeSource() {
	return once("mount", () => inlineLines(read(MOUNT_URL)));
}

export function anatomyRuntimeScript() {
	return once("script", () => [
		"<script data-vpk-anatomy-runtime>",
		"(() => {",
		"\"use strict\";",
		"/* anatomy iso-kit runtime subset — MIT License, Copyright (c) 2026 Ryan, github.com/wheresryan22/anatomy @ dbf697a */",
		kitRuntimeSource(),
		`const kit = Object.freeze({ ${kitRuntimeNames().join(", ")} });`,
		"/* vpk shared frame loop (integration K4) */",
		frameLoopSource(),
		"/* vpk anatomy mount runtime */",
		mountRuntimeSource(),
		"self.vpkAnatomy = createAnatomyRuntime(self, getFrameLoop(self), kit);",
		"})();",
		"</script>",
	].join("\n"));
}

export function anatomyCssBlock({ flow = false, pulse = false } = {}) {
	return `${CSS_MARKERS.start}\n<style data-vpk-anatomy-css>\n${anatomyCss({ flow, pulse })}\n</style>\n${CSS_MARKERS.end}`;
}

export function anatomyRuntimeBlock() {
	return `${RUNTIME_MARKERS.start}\n${anatomyRuntimeScript()}\n${RUNTIME_MARKERS.end}`;
}

// True when an anatomy-hero root exists outside script and style text (CSS selectors never count).
export function hasAnatomyHeroes(html) {
	return html.includes("anatomy-hero") && engineRoots(html).some(root => root.engine === "anatomy-hero");
}

const REGION = /<!-- vpk-anatomy-hero:start\b[^>]*-->[\s\S]*?<!-- vpk-anatomy-hero:end\b[^>]*-->/g;

// Flow and pulse CSS ship only when a hero region uses them (claim 21), so the output is deterministic.
export function heroMotionFlags(html) {
	const regions = (html.match(REGION) ?? []).join("\n");
	return { flow: /\sdata-flow(?:[\s=>/])/.test(regions), pulse: /\sdata-pulse(?:[\s=>/])/.test(regions) };
}

// The registry step body: idempotent, in place, and both blocks removed once no hero remains.
export function refreshAnatomyRuntime(html) {
	if (!hasAnatomyHeroes(html)) {
		return removeMarkedBlock(removeMarkedBlock(html, CSS_MARKERS.start, CSS_MARKERS.end), RUNTIME_MARKERS.start, RUNTIME_MARKERS.end);
	}
	const withCss = upsertMarkedHeadBlock(html, { ...CSS_MARKERS, block: anatomyCssBlock(heroMotionFlags(html)) });
	return upsertMarkedBlock(withCss, { ...RUNTIME_MARKERS, block: anatomyRuntimeBlock() });
}
