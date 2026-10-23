#!/usr/bin/env node
/*
 * screenshot: review captures at the contract viewport, plus 390 px mobile, in each requested
 * theme (ws6 §5.7, C14). Chromium launches the way gates.mjs, pdf.mjs and landing.mjs do.
 *
 *   node scripts/build.mjs --screenshot <file> [--out <dir>] [--theme light|dark|both] [--viewport WxH]
 *
 * Output: --out (against cwd); else files inside the skill go to <repo>/output/vpk-html/<stem>/screenshots/
 * (tmpdir when the skill is installed standalone), and any other file to <dir>/screenshots/.
 * Nothing is ever written under the skill folder, whatever the cwd.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { resolveRepoRoot, SKILL_ROOT } from "./repo-root.mjs";

export const REVIEW_CHECKLIST = Object.freeze([
	"the quick-read decision or action is visible in the first viewport",
	"no overflow, clipping or colliding labels (figures included)",
	"Geist and Geist Mono rendered, with no fallback face",
	"one focal element per figure, and figures stay grayscale",
	"dark theme: no invisible text and no lost hairlines",
	"no empty template regions or placeholder residue",
	"mobile: no horizontal scroll, and every control is reachable",
]);
export const DEFAULT_VIEWPORT = Object.freeze({ width: 1440, height: 900 });
export const MOBILE_VIEWPORT = Object.freeze({ width: 390, height: 844 });
export const THEMES = Object.freeze(["light", "dark", "both"]);
const THEME_STORAGE_KEY = "vpk-html-theme";
const CAPTURE_CSS = ".vpkh-scroll-fade { display: none !important; } *, *::before, *::after { animation-timeline: auto !important; }";

const relPath = file => path.relative(process.cwd(), file).split(path.sep).join("/") || file;
const realpath = file => { try { return fs.realpathSync(file); } catch { return path.resolve(file); } };

export function parseViewport(value) {
	const match = /^\s*(\d{3,4})\s*[x×]\s*(\d{3,4})\s*$/i.exec(String(value ?? ""));
	const viewport = match ? { width: Number(match[1]), height: Number(match[2]) } : null;
	if (!viewport || viewport.width < 320 || viewport.width > 3840 || viewport.height < 320 || viewport.height > 3000) {
		throw new Error(`--viewport must look like 1440x900, within 320–3840 by 320–3000 (got ${value})`);
	}
	return viewport;
}

export function screenshotDirFor(file, { repoRoot = resolveRepoRoot(), skillRoot = SKILL_ROOT, out = null, cwd = process.cwd(), tmpdir = os.tmpdir() } = {}) {
	if (out) return path.resolve(cwd, out);
	const abs = realpath(path.resolve(cwd, file));
	const stem = path.basename(abs).replace(/\.html?$/i, "");
	const fromSkill = path.relative(realpath(skillRoot), abs);
	const insideSkill = fromSkill !== "" && !fromSkill.startsWith("..") && !path.isAbsolute(fromSkill);
	if (!insideSkill) return path.join(path.dirname(abs), "screenshots");
	return repoRoot ? path.join(repoRoot, "output", "vpk-html", stem, "screenshots") : path.join(tmpdir, "vpk-html", stem, "screenshots");
}

// --viewport, else the sidecar's brief.viewport, else the eval viewport 1440×900.
export function resolveViewport(file, requested = null, { fileSystem = fs } = {}) {
	if (requested) return parseViewport(requested);
	const sidecar = path.join(path.dirname(path.resolve(file)), `${path.basename(file).replace(/\.html?$/i, "")}.content.json`);
	try {
		const viewport = JSON.parse(String(fileSystem.readFileSync(sidecar, "utf8")))?.brief?.viewport;
		if (Number.isInteger(viewport?.width) && Number.isInteger(viewport?.height)) return parseViewport(`${viewport.width}x${viewport.height}`);
	} catch { /* no usable sidecar: fall through */ }
	return { ...DEFAULT_VIEWPORT };
}

export function contextOptionsFor({ viewport, theme }) {
	return { viewport: { width: viewport.width, height: viewport.height }, colorScheme: theme, reducedMotion: "reduce" };
}

export function capturePlan(file, { theme = "both", viewport = DEFAULT_VIEWPORT } = {}) {
	if (!THEMES.includes(theme)) throw new Error(`--theme must be one of ${THEMES.join(", ")} (got ${theme})`);
	const stem = path.basename(file).replace(/\.html?$/i, "");
	const themes = theme === "both" ? ["light", "dark"] : [theme];
	const plan = themes.map(name => ({ theme: name, viewport, name: `${stem}-${name}-${viewport.width}.png` }));
	// Mobile in every requested theme, unless the contract viewport already is the mobile width
	// (then its own captures are the mobile ones and a second pass would overwrite them).
	if (viewport.width !== MOBILE_VIEWPORT.width) {
		for (const name of themes) plan.push({ theme: name, viewport: MOBILE_VIEWPORT, name: `${stem}-${name}-${MOBILE_VIEWPORT.width}.png` });
	}
	return plan;
}

export async function captureScreenshots(file, { outDir, theme = "both", viewport = DEFAULT_VIEWPORT } = {}, { chromium = null } = {}) {
	const abs = path.resolve(file);
	const browserType = chromium ?? (await import("@playwright/test")).chromium;
	const plan = capturePlan(abs, { theme, viewport });
	fs.mkdirSync(outDir, { recursive: true });
	const browser = await browserType.launch();
	const shots = [];
	const problems = [];
	try {
		for (const capture of plan) {
			const context = await browser.newContext(contextOptionsFor(capture));
			try {
				await context.addInitScript(([key, value]) => {
					try { localStorage.setItem(key, value); } catch { /* storage blocked: colorScheme still applies */ }
				}, [THEME_STORAGE_KEY, capture.theme]);
				const page = await context.newPage();
				page.on("pageerror", error => problems.push(`${capture.name}: pageerror: ${error.message}`));
				page.on("console", message => { if (message.type() === "error") problems.push(`${capture.name}: console.error: ${message.text()}`); });
				await page.goto(pathToFileURL(abs).href, { waitUntil: "load", timeout: 30_000 });
				await page.evaluate(async () => {
					try { await document.fonts.ready; } catch { /* noop */ }
					await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
				});
				const applied = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
				if (capture.theme === "dark" ? applied !== "dark" : applied !== null) problems.push(`${capture.name}: theme runtime did not apply ${capture.theme}`);
				// A full-page capture renders at scroll 0: move scroll-driven reveals (view() timelines) to
				// the document timeline and finish every finite animation, and drop the fixed scroll-fade
				// overlays, which would otherwise blur mid-page content.
				await page.addStyleTag({ content: CAPTURE_CSS });
				await page.evaluate(async () => {
					for (const animation of document.getAnimations()) {
						try { animation.finish(); } catch { /* infinite animations cannot finish */ }
					}
					await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
				});
				const target = path.join(outDir, capture.name);
				await page.screenshot({ path: target, fullPage: true });
				shots.push(target);
			} finally {
				await context.close();
			}
		}
	} finally {
		await browser.close();
	}
	return { ok: problems.length === 0, shots, problems };
}

// Returns an exit code: 0 captured clean, 1 page/console errors or launch failure, 2 usage.
export async function runScreenshot(args = {}, { log = console.log, error = console.error, repoRoot = resolveRepoRoot(), chromium = null } = {}) {
	if (!args.file || !fs.existsSync(args.file)) { error(`--screenshot needs an existing HTML file (got ${args.file ?? "nothing"})`); return 2; }
	let viewport;
	let outDir;
	try {
		viewport = resolveViewport(args.file, args.viewport);
		capturePlan(args.file, { theme: args.theme ?? "both", viewport });
		outDir = screenshotDirFor(args.file, { out: args.out, repoRoot });
	} catch (problem) {
		error(problem.message);
		return 2;
	}
	let result;
	try {
		result = await captureScreenshots(args.file, { outDir, theme: args.theme ?? "both", viewport }, { chromium });
	} catch (problem) {
		error(`✗ screenshot failed: ${String(problem?.message ?? problem).split("\n")[0]}`);
		error("  If Chromium could not start inside an OS sandbox, run unsandboxed; build.mjs --doctor checks it.");
		return 1;
	}
	for (const shot of result.shots) log(`✓ ${relPath(shot)}`);
	for (const problem of result.problems) error(`✗ ${problem}`);
	log("Review checklist:");
	REVIEW_CHECKLIST.forEach((item, index) => log(`  ${index + 1}. ${item}`));
	log("State the visual verdict only after viewing every image.");
	return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	const argv = process.argv.slice(2);
	const valueOf = flag => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);
	const flagValues = new Set(["--out", "--theme", "--viewport"].map(valueOf));
	const file = argv.find(arg => !arg.startsWith("--") && !flagValues.has(arg));
	process.exitCode = await runScreenshot({ file, out: valueOf("--out"), theme: valueOf("--theme"), viewport: valueOf("--viewport") });
}
