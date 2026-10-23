#!/usr/bin/env node
/*
 * pdf — optional, derived PDF export for vpk-html artifacts.
 *
 * Renders a finished single-file HTML artifact to PDF via headless Chromium
 * (Playwright page.pdf), NOT WeasyPrint — vpk-html stays Node-only, no Python.
 * PDF is a *derived* output: the single-file HTML remains the source of truth
 * and its offline invariants are untouched. Chromium emulates print media for
 * page.pdf(), so the export naturally consumes each template's print-mode CSS
 * layer; base64-inlined fonts embed into the PDF, so the result stays offline.
 *
 * Programmatic use:  import { exportPdf } from "./pdf.mjs";
 * CLI is exposed through scripts/build.mjs --pdf <file> [--out <file.pdf>].
 *
 * Reduced motion keeps SMIL starters and CSS entrances idle, so the PDF shows each figure's
 * assembled base pose.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const PDF_PAGE_OPTIONS = { reducedMotion: "reduce" };

/**
 * Export a single HTML file to PDF.
 * @param {string} htmlPath  path to the finished single-file HTML artifact
 * @param {string} [outPath] output .pdf path (defaults to the input with a .pdf extension)
 * @returns {Promise<{ ok: boolean, out: string, bytes: number }>}
 */
export async function exportPdf(htmlPath, outPath) {
	const abs = path.resolve(htmlPath);
	if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);
	const out = path.resolve(outPath || abs.replace(/\.html?$/i, "") + ".pdf");

	const { chromium } = await import("@playwright/test");
	const browser = await chromium.launch();
	try {
		const page = await browser.newPage(PDF_PAGE_OPTIONS);
		await page.goto(pathToFileURL(abs).href, { waitUntil: "domcontentloaded", timeout: 15_000 });
		try { await page.waitForLoadState("networkidle", { timeout: 4_000 }); } catch { /* fine */ }
		// Ensure embedded fonts are resolved before snapshotting to PDF.
		await page.evaluate(async () => { try { await document.fonts.ready; } catch { /* noop */ } });
		// vpk-lab documents: wait for the kit's ready signal (labs drawn, runtime thumbnails done), capped at 5 s.
		await page.evaluate(() => Promise.race([window.vpkLab?.ready, new Promise(resolve => setTimeout(resolve, 5000))]));
		await page.pdf({
			path: out,
			printBackground: true,
			// Honour a template's own @page size when it declares one; otherwise A4.
			preferCSSPageSize: true,
			format: "A4",
			margin: { top: "0", right: "0", bottom: "0", left: "0" },
		});
	} finally {
		await browser.close();
	}

	const bytes = fs.statSync(out).size;
	return { ok: bytes > 0, out, bytes };
}
