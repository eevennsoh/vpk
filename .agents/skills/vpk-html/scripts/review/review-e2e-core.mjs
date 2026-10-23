/*
 * review/review-e2e-core: shared helpers for the Playwright file:// harness (review-e2e.mjs and its
 * scenario modules). Split out of review-e2e.mjs in P3 (B2 decision 19g) so the harness has room
 * for the M2 scenarios. review-e2e.mjs re-exports everything here, so
 * output/vpk-html-v2/eu26-spike/run-spike.mjs keeps importing from review-e2e.mjs.
 * Playwright is imported directly (integration R23).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SKILL = path.resolve(HERE, "../..");
export const DEMO = path.join(SKILL, "assets/demos/demo-review-loop.html");
export const FIXTURES = path.join(HERE, "fixtures");
const CORE_MODULES = ["text", "anchor", "anchor-dom"];

export async function launchBrowser() {
	const { chromium } = await import("@playwright/test");
	return chromium.launch();
}

export async function newPage(browser, options = {}) {
	const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true, ...options });
	const page = await context.newPage();
	page.errors = [];
	page.on("pageerror", error => page.errors.push(`pageerror: ${error.message}`));
	page.on("console", message => {
		if (message.type() === "error") page.errors.push(`console.error: ${message.text()}`);
	});
	return { context, page };
}

export async function openFile(page, file) {
	await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
	await page.waitForFunction(() => window.__VPK_REVIEW__ && document.querySelector("[data-vpk-review-ui]"), null, { timeout: 15000 });
}

export async function selectQuote(page, quote, occurrence = 1) {
	return page.evaluate(([text, nth]) => {
		const root = document.querySelector("main") || document.body;
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
		let count = 0;
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			const at = node.nodeValue.indexOf(text);
			if (at >= 0 && ++count === nth) {
				node.parentElement.scrollIntoView({ block: "center" });
				const range = document.createRange();
				range.setStart(node, at);
				range.setEnd(node, at + text.length);
				const selection = getSelection();
				selection.removeAllRanges();
				selection.addRange(range);
				return true;
			}
		}
		return false;
	}, [quote, occurrence]);
}

// Comment on a quote through the UI: select, C, identity form (first time), composer, Ctrl+Enter.
export async function commentOnQuote(page, quote, body, identity) {
	if (!(await selectQuote(page, quote))) throw new Error(`quote not found: ${quote}`);
	await page.waitForTimeout(250);
	await page.keyboard.press("c");
	const name = page.locator(".vr-identity input[aria-label='Your name']");
	if (identity && await name.isVisible().catch(() => false)) {
		await name.fill(identity.name);
		await page.locator(".vr-identity input[aria-label='Initials']").fill(identity.initials);
		await name.press("Enter");
	}
	const area = page.locator(".vr-composer textarea[aria-label='Comment']");
	await area.waitFor({ state: "visible", timeout: 5000 });
	await area.fill(body);
	await area.press("Control+Enter");
	await page.waitForFunction(text => window.__VPK_REVIEW__.getReview().comments.some(comment => comment.body === text), body, { timeout: 5000 });
}

export async function flush(page) {
	await page.evaluate(() => window.__VPK_REVIEW__.flush());
}

export async function saveDownload(page, trigger, dir) {
	const [download] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), trigger()]);
	const target = path.join(dir, download.suggestedFilename());
	await download.saveAs(target);
	return target;
}

export async function shadowButtons(page) {
	return page.evaluate(() => [...document.querySelector("[data-vpk-review-ui]").shadowRoot.querySelectorAll("button")].map(button => ({ name: (button.getAttribute("aria-label") || button.textContent || "").trim() })));
}

export async function cli(argv) {
	const { runReviewCli } = await import("./cli.mjs");
	const lines = [];
	const code = await runReviewCli(argv, { out: line => lines.push(line), err: line => lines.push(line), raw: text => lines.push(text) });
	if (code !== 0) throw new Error(`${argv[0]} exited ${code}: ${lines.join("\n")}`);
	return lines;
}

export function tempCopy(source, name, dir = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-review-e2e-"))) {
	const target = path.join(dir, name || path.basename(source));
	fs.copyFileSync(source, target);
	return target;
}

// The serialized text/anchor functions as a page script exposing window.__vpkParity.
export async function parityScript() {
	const fns = [];
	for (const name of CORE_MODULES) fns.push(...Object.values(await import(`./${name}.mjs`)));
	return `(() => {\n${fns.map(fn => fn.toString()).join("\n")}\nwindow.__vpkParity = { buildTextIndex, blockFields, hashText, createTextAnchor, resolveAnchor, findQuote };\n})();`;
}

// Node (linkedom, source bytes) vs Chromium (live DOM) text index and block hashes.
export async function parityCheck(page, html) {
	const { parseDocument } = await import("./stamp.mjs");
	const { buildTextIndex, blockFields } = await import("./anchor.mjs");
	const { hashText } = await import("./text.mjs");
	const doc = parseDocument(html);
	const index = buildTextIndex(doc.querySelector("main") || doc.body);
	const node = { text: hashText(index.text), blocks: Object.fromEntries([...index.elements].map(([id, el]) => [id, blockFields(index, el).blockHash])) };
	await page.evaluate(await parityScript());
	const browser = await page.evaluate(() => {
		const { buildTextIndex, blockFields, hashText } = window.__vpkParity;
		const live = buildTextIndex(document.querySelector("main") || document.body);
		return { text: hashText(live.text), blocks: Object.fromEntries([...live.elements].map(([id, el]) => [id, blockFields(live, el).blockHash])), sample: live.text.slice(0, 80) };
	});
	const ids = Object.keys(node.blocks);
	const mismatched = ids.filter(id => node.blocks[id] !== browser.blocks[id]);
	return { textEqual: node.text === browser.text, blocks: ids.length, mismatched };
}

export async function printInnerText(page) {
	await page.emulateMedia({ media: "print" });
	const result = await page.evaluate(() => {
		const host = document.querySelector("[data-vpk-review-ui]");
		const hidden = [...document.querySelectorAll(".vpk-decision__suggested")].every(el => getComputedStyle(el).display === "none");
		return { text: document.documentElement.innerText, hostDisplay: host ? getComputedStyle(host).display : "absent", suggestedHidden: hidden };
	});
	await page.emulateMedia({ media: "screen" });
	return result;
}

export async function stripCopy(file) {
	const stripped = file.replace(/\.html$/, ".stripped.html");
	await cli(["--strip-review", file, "--out", stripped]);
	return stripped;
}

export async function pdfPages(file, out) {
	const { exportPdf } = await import("../pdf.mjs");
	const result = await exportPdf(file, out);
	const bytes = fs.readFileSync(result.out, "latin1");
	return (bytes.match(/\/Type\s*\/Page(?!s)/g) || []).length;
}

export const DEMO_QUOTE = "Optimistic insert on submit, rollback on failure";
export const ANA = { name: "Ana Ortiz", initials: "AO" };
export const BEN = { name: "Ben Ito", initials: "BI" };
export const CARO = { name: "Caro Diaz", initials: "CD" };
