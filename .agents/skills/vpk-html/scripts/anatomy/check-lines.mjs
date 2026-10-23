#!/usr/bin/env node
/*
 * anatomy/check-lines — every texture line of every anatomy hero must end on something (ws4b spec section 6.5).
 *
 *   node .agents/skills/vpk-html/scripts/anatomy/check-lines.mjs <file.html> [--theme light|dark|both] [--motion reduced|full]
 *        [--tolerance 1] [--wait 1500] [--out [<dir>]]
 *
 * Runs the vendored anatomy LINE_ENDS check (vendor/scripts/line-ends.mjs, MIT) in headless Chromium on live
 * layout, per hero and per theme: the viewport is sized to the plate, the plate is scrolled to the centre and two
 * frames pass before hit-testing, so off-screen parts are never misreported. Defaults: both themes, reduced
 * motion (the rest pose). --out writes ringed PNGs to <dir>/<id>-<theme>.png (default
 * output/vpk-html/lines/<basename>/). Exit 1 on any floating end or a page without a hero; 2 on usage. Needs the
 * unsandboxed shell.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { LINE_ENDS } from "./vendor/scripts/line-ends.mjs";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "..", "..", "..", "..", "..");

export function defaultLinesOut(file) {
	return path.join(REPO_ROOT, "output", "vpk-html", "lines", path.basename(file, path.extname(file)));
}

export async function checkLines(file, { theme = "both", motion = "reduced", tolerance = 1, wait = 1500, out = null } = {}) {
	const abs = path.resolve(file);
	if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);
	const themes = theme === "both" ? ["light", "dark"] : [theme];
	const { chromium } = await import("@playwright/test");
	const browser = await chromium.launch();
	const results = [];
	try {
		for (const name of themes) {
			const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: motion === "full" ? "no-preference" : "reduce", colorScheme: name });
			const page = await context.newPage();
			await page.goto(pathToFileURL(abs).href, { waitUntil: "load" });
			await page.evaluate(value => {
				document.documentElement.dataset.theme = value;
			}, name);
			await page.waitForTimeout(wait);
			const ids = await page.evaluate(() => [...document.querySelectorAll('[data-vpk-engine="anatomy-hero"]')].map(root => root.getAttribute("data-vpk-figure")));
			for (const id of ids) {
				const select = `[data-vpk-figure="${id}"] .iso-plate`;
				const height = await page.evaluate(selector => document.querySelector(selector).getBoundingClientRect().height, select);
				await page.setViewportSize({ width: 1280, height: Math.max(900, Math.ceil(height + 80)) });
				await page.evaluate(selector => document.querySelector(selector).scrollIntoView({ block: "center" }), select);
				await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
				const result = await page.evaluate(`(${LINE_ENDS})(${JSON.stringify({ select, tolerance, show: Boolean(out) })})`);
				if (out) {
					fs.mkdirSync(out, { recursive: true });
					await page.locator(select).screenshot({ path: path.join(out, `${id}-${name}.png`) });
					await page.evaluate(() => document.querySelector("[data-line-ends]")?.remove());
				}
				results.push({ id, theme: name, ends: result.ends, lines: result.lines, problems: result.problems });
			}
			await context.close();
		}
	} finally {
		await browser.close();
	}
	return { file: abs, results };
}

export function formatLines(report) {
	const lines = [];
	if (!report.results.length) lines.push(`✗ ${path.basename(report.file)}: no anatomy heroes to check (run check-html for H6 marker problems)`);
	for (const result of report.results) {
		lines.push(`line ends: ${result.problems.length} of ${result.ends} ends on ${result.lines} lines float · ${result.id} · ${result.theme}`);
		for (const problem of result.problems.slice(0, 12)) {
			lines.push(`  ${problem.what}  ${problem.end}${problem.mark ? " (a mark: neither end rooted)" : ""}  ${problem.gap == null ? "nothing nearby" : `${problem.gap.toFixed(2)} px from anything`}   at card ${problem.at.join(",")}   length ${problem.length}`);
		}
	}
	return lines.join("\n");
}

async function main(argv) {
	const options = { theme: "both", motion: "reduced", tolerance: 1, wait: 1500, out: null };
	let file = null;
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--theme" && ["light", "dark", "both"].includes(argv[i + 1])) options.theme = argv[++i];
		else if (arg === "--motion" && ["reduced", "full"].includes(argv[i + 1])) options.motion = argv[++i];
		else if (arg === "--tolerance" && Number.isFinite(Number(argv[i + 1]))) options.tolerance = Number(argv[++i]);
		else if (arg === "--wait" && Number.isFinite(Number(argv[i + 1]))) options.wait = Number(argv[++i]);
		else if (arg === "--out") options.out = argv[i + 1] && !argv[i + 1].startsWith("--") ? path.resolve(argv[++i]) : "";
		else if (!arg.startsWith("--") && !file) file = arg;
		else {
			console.error("Usage: check-lines.mjs <file.html> [--theme light|dark|both] [--motion reduced|full] [--tolerance 1] [--wait 1500] [--out [<dir>]]");
			return 2;
		}
	}
	if (!file) return main(["--help"]);
	if (options.out === "") options.out = defaultLinesOut(file);
	const report = await checkLines(file, options);
	console.log(formatLines(report));
	if (options.out) console.log(`ringed captures in ${path.relative(process.cwd(), options.out)}`);
	// No hero is a failure: a page whose markers never paired (H6) has no root to check, which is not "0 float".
	return !report.results.length || report.results.some(result => result.problems.length) ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
	process.exitCode = await main(process.argv.slice(2));
}
