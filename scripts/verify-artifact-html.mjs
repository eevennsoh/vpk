#!/usr/bin/env node
// Opens a single-file HTML artifact the way the Atlassian Artifacts viewer does — inside an
// about:srcdoc iframe under the viewer's Content Security Policy — in headless Chromium,
// then reports CSP-blocked requests, page errors, and a screenshot.
//
//   node scripts/verify-artifact-html.mjs artifacts/awake/awake.html [--wait 8000]
//
// Exits non-zero on uncaught page errors. Blocked requests are reported, not failures:
// decide per artifact whether it degrades acceptably. WebGL content needs a real GPU or
// SwiftShader, so run outside restrictive sandboxes.
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

// Observed on hello.atlassian.net/artifacts (2026-09-30): only Atlassian origins are
// connectable; inline styles draw report-only warnings. Update when the viewer changes.
export const VIEWER_CSP = [
	"connect-src 'self' hello.atlassian.net https://api.atlassian.com/metal/ingest https://api.atlassian.com/gateway/api/emoji/",
	"https://api.atlassian.com/gateway/api/elements/emoji https://api.media.atlassian.com https://as.atlassian.com",
	"https://forge-outbound-proxy.services.atlassian.com https://tdp-os.services.atlassian.com https://object-store.atlassian.com",
	"https://forge.cdn.prod.atlassian-dev.net",
].join(" ");
const VIEWER_ORIGIN = "https://artifacts-viewer.test";
const CSP_VIOLATION = /violates the (?:following|document's) Content Security Policy/u;

/**
 * Pulls the refused URL out of a Chromium CSP console message: either the directive report
 * ("Connecting to '<url>' violates …") or the fetch rejection ("Fetch API cannot load <url>. …").
 */
export function blockedUrlFromConsole(text) {
	if (!CSP_VIOLATION.test(text)) return null;
	const match = text.match(/(?:Connecting to|Refused to (?:connect to|load)[^']*) '([^']+)'|Fetch API cannot load (\S+?)\. Refused/u);
	return match?.[1] ?? match?.[2] ?? null;
}

async function main() {
	const { positionals, values } = parseArgs({
		allowPositionals: true,
		options: { out: { type: "string" }, wait: { default: "8000", type: "string" } },
	});
	const file = positionals[0];
	if (!file) {
		throw new Error("Usage: node scripts/verify-artifact-html.mjs <file.html> [--wait ms] [--out screenshot.png]");
	}
	const html = await readFile(file, "utf8");
	const screenshot = path.resolve(values.out ?? path.join("output/artifact-html", `${path.basename(file, path.extname(file))}.png`));
	const { chromium } = await import("@playwright/test");

	const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
	try {
		const page = await browser.newPage({ viewport: { height: 900, width: 1440 } });
		const blocked = new Set();
		const consoleErrors = [];
		const pageErrors = [];
		page.on("console", (message) => {
			const blockedUrl = blockedUrlFromConsole(message.text());
			if (blockedUrl) blocked.add(blockedUrl.split("?")[0]);
			else if (message.type() === "error" && !/GL Driver|Failed to load resource/u.test(message.text())) consoleErrors.push(message.text().slice(0, 300));
		});
		page.on("pageerror", (error) => pageErrors.push(error.message.slice(0, 300)));
		await page.route(`${VIEWER_ORIGIN}/**`, (route) => (route.request().url().endsWith("/artifact.html")
			? route.fulfill({ body: html, contentType: "text/html" })
			: route.fulfill({
				body: `<!doctype html><style>html,body,iframe{margin:0;border:0;width:100%;height:100%;display:block}</style><iframe title="artifact"></iframe><script>fetch("/artifact.html").then((r) => r.text()).then((t) => { document.querySelector("iframe").srcdoc = t; })</script>`,
				contentType: "text/html",
				headers: { "content-security-policy": VIEWER_CSP },
			})));
		await page.goto(`${VIEWER_ORIGIN}/`);
		await page.waitForTimeout(Number(values.wait));
		const frame = page.frames().find((candidate) => candidate.url() === "about:srcdoc");
		const rendered = frame ? await frame.evaluate(() => ({ elements: document.body.querySelectorAll("*").length, text: document.body.innerText.replace(/\s+/gu, " ").trim().slice(0, 240) })) : null;
		await mkdir(path.dirname(screenshot), { recursive: true });
		await page.screenshot({ path: screenshot });

		const report = { blockedRequests: [...blocked], consoleErrors, pageErrors, rendered, screenshot: path.relative(process.cwd(), screenshot) };
		console.log(JSON.stringify(report, null, 2));
		if (!rendered || rendered.elements === 0 || pageErrors.length > 0) process.exitCode = 1;
	} finally {
		await browser.close();
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
