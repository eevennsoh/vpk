#!/usr/bin/env node
/*
 * gates — optional content-quality gates for vpk-html artifacts.
 *
 * kami's gates are PDF/pixel-based; vpk-html is HTML-first, so these are
 * re-grounded on the same headless-Chromium page that --verify already opens.
 * They are DOM-measurement heuristics, ADVISORY by default (warnings) and only
 * fail the process under --strict. They never modify the artifact.
 *
 *   density        per-section trailing whitespace (a section padded with empty
 *                  space rather than content)
 *   resume-balance content spilling slightly onto a near-empty extra page
 *   rhythm         >=N consecutive slides with an identical layout fingerprint
 *   orphans        widowed last lines (a single short word ending a paragraph)
 *   focal          ordinary SVG diagrams with too many darkest-ink focal elements
 *   motion-budget  long authored CSS durations that make artifacts feel slow
 *   caption-echo   figure captions that restate the nearby title
 *   layout         sideways page overflow, clipped text or controls, and overlapping text
 *                  at the gate viewport (review/layout-audit.mjs, the same audit as the review
 *                  runtime's Layout tab)
 *
 * Thresholds: references/checks-thresholds.json
 * Semantics:  references/quality-gates.md
 *
 * CLI is exposed through scripts/build.mjs:
 *   node scripts/build.mjs --check-density <file> [--strict]
 *   node scripts/build.mjs --check-resume-balance <file> [--strict]
 *   node scripts/build.mjs --check-rhythm <file> [--strict]
 *   node scripts/build.mjs --check-orphans <file> [--strict]
 *   node scripts/build.mjs --check-focal <file> [--strict]
 *   node scripts/build.mjs --check-motion-budget <file> [--strict]
 *   node scripts/build.mjs --check-caption-echo <file> [--strict]
 *   node scripts/build.mjs --check-layout <file> [--strict]
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { measureLayout } from "./review/layout-audit.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const THRESHOLDS_FILE = path.join(__dirname, "..", "references", "checks-thresholds.json");

export function loadThresholds() {
	return JSON.parse(fs.readFileSync(THRESHOLDS_FILE, "utf8"));
}

/* ---- in-page measurement (runs in the browser; must be self-contained) ---- */

function measureDensity(t) {
	const sections = [...document.querySelectorAll("main section, body > section, article > section, section")];
	const seen = new Set();
	const findings = [];
	sections.forEach((sec, i) => {
		if (seen.has(sec)) return; seen.add(sec);
		const rect = sec.getBoundingClientRect();
		if (rect.height < t.minSectionHeightPx) return;
		const kids = [...sec.children].filter(c => c.getBoundingClientRect().height > 0);
		if (kids.length === 0) return;
		const lastBottom = Math.max(...kids.map(c => c.getBoundingClientRect().bottom));
		const trailing = rect.bottom - lastBottom;
		const ratio = trailing / rect.height;
		const isLast = i === sections.length - 1;
		if (!isLast && ratio > t.maxTrailingRatio) {
			findings.push(`section #${i + 1} (${sec.className || sec.tagName.toLowerCase()}): ${Math.round(ratio * 100)}% trailing empty space`);
		}
	});
	return findings;
}

function measureResumeBalance(t) {
	const contentHeight = document.body.scrollHeight;
	const pages = contentHeight / t.pageHeightPx;
	if (pages < t.onlyWhenPagesAtLeast) return [];
	const lastPageFill = pages - Math.floor(pages);
	// A near-empty trailing page (small remainder) means a little content spilled over.
	if (lastPageFill > 0 && lastPageFill < t.minLastPageFill) {
		return [`content is ${pages.toFixed(2)} pages — the last page is only ${Math.round(lastPageFill * 100)}% full (tighten to fit ${Math.floor(pages)} page${Math.floor(pages) === 1 ? "" : "s"})`];
	}
	return [];
}

function measureRhythm(t) {
	const slides = [...document.querySelectorAll('.slide, section.slide, [class*="slide"], .deck-slide, section[data-slide]')];
	if (slides.length < t.maxIdenticalConsecutive) return [];
	const fingerprint = (el) => {
		const kids = [...el.children];
		const headings = el.querySelectorAll("h1,h2,h3,h4,h5,h6").length;
		return `${kids.length}:${headings}:${kids.map(c => c.tagName).join(",")}`;
	};
	const fps = slides.map(fingerprint);
	const findings = [];
	let run = 1;
	for (let i = 1; i <= fps.length; i++) {
		if (i < fps.length && fps[i] === fps[i - 1]) { run++; continue; }
		if (run >= t.maxIdenticalConsecutive) {
			findings.push(`${run} consecutive slides share an identical layout (slides ${i - run + 1}–${i})`);
		}
		run = 1;
	}
	return findings;
}

function measureOrphans(t) {
	const blocks = [...document.querySelectorAll("p, li")];
	const findings = [];
	for (const el of blocks) {
		const text = (el.textContent || "").trim();
		if (text.length < 40) continue; // short blocks legitimately end short
		const range = document.createRange();
		range.selectNodeContents(el);
		const rects = [...range.getClientRects()].filter(r => r.width > 0);
		if (rects.length < 2) continue; // single-line block can't widow
		const widest = Math.max(...rects.map(r => r.width));
		const last = rects[rects.length - 1];
		const lastWords = text.split(/\s+/).slice(-1)[0] || "";
		if (last.width / widest < t.minLastLineWidthRatio && lastWords.length < t.minLastLineChars) {
			findings.push(`widowed last line ("${lastWords}") in: "${text.slice(0, 48)}${text.length > 48 ? "…" : ""}"`);
			if (findings.length >= 12) break;
		}
	}
	// Headings are too short for the 40-character floor, so they get their own test: a heading of 3+ words that wraps
	// with its last word alone on a narrow last line ("one / clock") is widowed. `text-wrap: balance` fixes it.
	for (const el of document.querySelectorAll("h1, h2, h3")) {
		if (findings.length >= 12) break;
		const text = (el.textContent || "").trim().replace(/\s+/g, " ");
		if (text.split(" ").length < 3) continue;
		const range = document.createRange();
		range.selectNodeContents(el);
		// Group the boxes into lines. Glyph boxes of a tight line-height overlap the next line, so a box joins a line
		// when its vertical centre falls inside that line, not when the boxes merely touch.
		const lines = [];
		for (const r of [...range.getClientRects()].filter(box => box.width > 0).sort((a, b) => a.top - b.top)) {
			const line = lines[lines.length - 1];
			if (line && (r.top + r.bottom) / 2 < line.bottom) {
				line.left = Math.min(line.left, r.left);
				line.right = Math.max(line.right, r.right);
				line.bottom = Math.max(line.bottom, r.bottom);
			} else lines.push({ left: r.left, right: r.right, bottom: r.bottom });
		}
		if (lines.length < 2) continue;
		const last = lines[lines.length - 1];
		if (last.right - last.left >= t.minHeadingLastLineWidthRatio * Math.max(...lines.map(line => line.right - line.left))) continue;
		const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
		let node = null;
		for (let next = walker.nextNode(); next; next = walker.nextNode()) if (/\S/.test(next.data)) node = next;
		const end = node ? node.data.trimEnd().length : 0;
		const start = node ? node.data.slice(0, end).search(/\S+$/) : -1;
		if (start < 0) continue;
		const word = document.createRange();
		word.setStart(node, start);
		word.setEnd(node, end);
		const box = [...word.getClientRects()].filter(r => r.width > 0).pop();
		if (box && box.left - last.left < 1) {
			findings.push(`widowed heading ("${node.data.slice(start, end)}" alone on the last line) in: "${text.slice(0, 48)}${text.length > 48 ? "…" : ""}"`);
		}
	}
	return findings;
}

function measureFocal(t) {
	const svgs = [...document.querySelectorAll("svg:not([data-vpk-illustration])")];
	const findings = [];
	for (const [index, svg] of svgs.entries()) {
		const focalElements = [...svg.querySelectorAll("*")].filter(el => {
			const value = [
				el.getAttribute("fill"),
				el.getAttribute("stroke"),
				el.getAttribute("style"),
			].filter(Boolean).join(" ");
			return /var\(--focal\)/.test(value);
		});
		if (focalElements.length > t.maxFocalElements) {
			const label = svg.getAttribute("aria-label") || svg.getAttribute("aria-labelledby") || `svg #${index + 1}`;
			findings.push(`${label}: ${focalElements.length} focal elements (ordinary diagrams should keep one darkest-ink focal element)`);
		}
	}
	return findings;
}

// Runs in the page (runGates serialises it), so it must stay self-contained. Exported for the happy-dom test.
export function measureMotionBudget(t) {
	const findings = [];
	// The shared house style (the shared CSS, the Algebrica v2 layer and the presentation/docnav CSS the pipeline
	// appends) ships in every document, so its durations are not the author's. Skip it and report authored motion only.
	const authored = css => css
		.replace(/\/\* vpk-shared:start \*\/[\s\S]*?\/\* vpk-shared:end \*\//g, "")
		.replace(/\/\* vpk-algebrica-v2:start \*\/[\s\S]*?\/\* vpk-algebrica-v2:end \*\//g, "")
		.replace(/\/\* vpk presentation mode \*\/[\s\S]*$/, "");
	const durationPattern = /\b(?:animation|transition)(?:-duration)?\s*:\s*([^;}]*)/gi;
	const tokenPattern = /var\((--[^),\s]+)/g;
	const numericPattern = /(\d*\.?\d+)\s*(ms|s)\b/gi;
	const toMs = (value, unit) => unit.toLowerCase() === "s" ? Number(value) * 1000 : Number(value);
	const customProperties = getComputedStyle(document.documentElement);
	const seen = new Set();
	const scan = (css, label) => {
		durationPattern.lastIndex = 0;
		let match;
		while ((match = durationPattern.exec(css)) !== null) {
			const propertyValue = match[1];
			const durations = [];
			numericPattern.lastIndex = 0;
			let numeric;
			while ((numeric = numericPattern.exec(propertyValue)) !== null) {
				durations.push(toMs(numeric[1], numeric[2]));
			}
			tokenPattern.lastIndex = 0;
			let token;
			while ((token = tokenPattern.exec(propertyValue)) !== null) {
				const resolved = customProperties.getPropertyValue(token[1]);
				numericPattern.lastIndex = 0;
				while ((numeric = numericPattern.exec(resolved)) !== null) {
					durations.push(toMs(numeric[1], numeric[2]));
				}
			}
			for (const duration of durations) {
				if (duration <= t.maxDurationMs) continue;
				const key = `${label}:${match[0]}:${duration}`;
				if (seen.has(key)) continue;
				seen.add(key);
				findings.push(`${label}: ${Math.round(duration)}ms exceeds ${t.maxDurationMs}ms motion budget`);
				if (findings.length >= t.maxFindings) return;
			}
		}
	};
	document.querySelectorAll("style").forEach((style, index) => scan(authored(style.textContent || ""), `style block #${index + 1}`));
	document.querySelectorAll("[style]").forEach((el, index) => scan(el.getAttribute("style") || "", `inline style #${index + 1}`));
	return findings;
}

// Runs in the page (runGates serialises it), so it must stay self-contained. Exported for the happy-dom test.
export function measureCaptionEcho(t) {
	const normalize = (value) => (value || "")
		.toLowerCase()
		.replace(/\b(?:fig(?:ure)?|diagram|chart|table|illustration|of|the|a|an|this|that|shows?|showing|illustrates?|illustrating)\b/g, " ")
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
	// Distinct content words: a repeated word counts once, and words of 2 characters or fewer ("on", "to") never count.
	const words = (value) => [...new Set(normalize(value).split(/\s+/).filter(word => word.length > 2))];
	const findHeading = (figure) => {
		const scope = figure.closest("section, article, main") || document.body;
		const headings = [...scope.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter(heading => {
			const order = heading.compareDocumentPosition(figure);
			return order & Node.DOCUMENT_POSITION_FOLLOWING;
		});
		return headings.at(-1);
	};
	const findings = [];
	for (const figure of document.querySelectorAll("figure")) {
		const caption = figure.querySelector("figcaption");
		if (!caption) continue;
		const captionText = caption.textContent.trim();
		if (captionText.length < t.minCaptionChars) continue;
		// A heading is short, so sharing minSharedWords of its words is an echo. An SVG title or aria-label is a long
		// sentence, so any caption naming its subject shares 3 words; there the shared words must also make up
		// minCaptionCoverage of the caption's own content words.
		const references = [
			{ text: findHeading(figure)?.textContent || "", coverage: false },
			{ text: figure.querySelector("svg title")?.textContent || "", coverage: true },
			{ text: figure.querySelector("svg")?.getAttribute("aria-label") || "", coverage: true },
		].filter(reference => reference.text);
		const captionWords = new Set(words(captionText));
		for (const { text, coverage } of references) {
			const referenceWords = words(text);
			if (referenceWords.length < t.minSharedWords) continue;
			const shared = referenceWords.filter(word => captionWords.has(word));
			if (shared.length < t.minSharedWords) continue;
			if (coverage && shared.length < t.minCaptionCoverage * captionWords.size) continue;
			findings.push(`caption echoes "${text.trim().slice(0, 60)}": "${captionText.slice(0, 72)}${captionText.length > 72 ? "..." : ""}"`);
			break;
		}
		if (findings.length >= t.maxFindings) break;
	}
	return findings;
}

const GATES = {
	density: { label: "density", key: "density" },
	"resume-balance": { label: "resume-balance", key: "resumeBalance" },
	rhythm: { label: "rhythm", key: "rhythm" },
	orphans: { label: "orphans", key: "orphans" },
	focal: { label: "focal", key: "focal" },
	"motion-budget": { label: "motion-budget", key: "motionBudget" },
	"caption-echo": { label: "caption-echo", key: "captionEcho" },
	layout: { label: "layout", key: "layout" },
};
const MEASURERS = {
	density: measureDensity,
	"resume-balance": measureResumeBalance,
	rhythm: measureRhythm,
	orphans: measureOrphans,
	focal: measureFocal,
	"motion-budget": measureMotionBudget,
	"caption-echo": measureCaptionEcho,
	layout: measureLayout,
};

/**
 * Run one or more gates against a single HTML file.
 * @returns {Promise<{ ok: boolean, results: Array<{gate,findings}> }>} ok=false only
 *          signals findings exist; the CLI decides warn-vs-error via --strict.
 */
export async function runGates(htmlPath, { gates = Object.keys(GATES), thresholds = loadThresholds() } = {}) {
	const abs = path.resolve(htmlPath);
	if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);
	const { chromium } = await import("@playwright/test");
	const browser = await chromium.launch();
	const results = [];
	try {
		const page = await browser.newPage();
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto(pathToFileURL(abs).href, { waitUntil: "domcontentloaded", timeout: 15_000 });
		try { await page.waitForLoadState("networkidle", { timeout: 4_000 }); } catch { /* fine */ }
		await page.evaluate(async () => { try { await document.fonts.ready; } catch { /* noop */ } });
		for (const g of gates) {
			const def = GATES[g];
			if (!def) throw new Error(`Unknown gate: ${g}`);
			const findings = await page.evaluate(
				([src, th]) => {
					const fn = new Function(`return (${src})`)();
					return fn(th);
				},
				[MEASURERS[g].toString(), thresholds[def.key]],
			);
			results.push({ gate: def.label, findings });
		}
	} finally {
		await browser.close();
	}
	return { ok: results.every(r => r.findings.length === 0), results };
}

/* ----------------------------- CLI ----------------------------- */

async function main() {
	const argv = process.argv.slice(2);
	const strict = argv.includes("--strict");
	const positional = argv.filter(a => !a.startsWith("--"));
	const flagGates = argv.filter(a => a.startsWith("--check-")).map(a => a.replace("--check-", ""));
	const file = positional[0];
	if (!file) {
		console.error("Usage: gates.mjs <file.html> [--check-density|--check-resume-balance|--check-rhythm|--check-orphans|--check-focal|--check-motion-budget|--check-caption-echo|--check-layout] [--strict]");
		process.exitCode = 1;
		return;
	}
	const gates = flagGates.length > 0 ? flagGates : Object.keys(GATES);
	const { results } = await runGates(file, { gates });
	let total = 0;
	for (const { gate, findings } of results) {
		if (findings.length === 0) {
			console.log(`✓ ${gate}: clean`);
		} else {
			total += findings.length;
			console.log(`${strict ? "✗" : "⚠"} ${gate}: ${findings.length} finding${findings.length === 1 ? "" : "s"}`);
			for (const f of findings) console.log(`    - ${f}`);
		}
	}
	if (total > 0 && strict) process.exitCode = 1;
	else if (total > 0) console.log(`\n${total} advisory finding(s) — warnings only (pass --strict to fail).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
	await main();
}
