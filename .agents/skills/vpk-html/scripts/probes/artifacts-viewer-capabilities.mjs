#!/usr/bin/env node
/*
 * Re-runnable V29 probe (ws6 T16): what the Atlassian Artifacts viewer harness lets a
 * document do. It serves viewerHostHtml() and VIEWER_CSP from scripts/verify-artifact-html.mjs
 * with a probe page in the sandboxed srcdoc frame, clicks copy, exec-copy, download and popup,
 * and prints JSON per sandbox flag set. Needs Chromium, so run it unsandboxed. Not a test:
 * when the numbers change, update the viewer table in references/publish.md.
 *
 *   node .agents/skills/vpk-html/scripts/probes/artifacts-viewer-capabilities.mjs
 */

import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { resolveRepoRoot } from "../repo-root.mjs";

const SANDBOXES = ["allow-scripts", "allow-scripts allow-downloads allow-popups"];
const ORIGIN = "https://artifacts-viewer.test";
const PROBE_PAGE = `<!doctype html><html lang="en"><head><title>viewer probe</title></head><body>
<button id="copy" type="button">clipboard</button>
<button id="exec" type="button">execCommand</button>
<a id="download" download="probe.json" href="#">download</a>
<a id="popup" href="https://popup.test/" target="_blank" rel="noopener">popup</a>
<textarea id="text" aria-label="probe text">probe</textarea>
<script>
const probe = (window.__probe = { origin: String(location.origin) });
for (const name of ["localStorage", "sessionStorage"]) {
	try { window[name].setItem("vpk-probe", "1"); probe[name] = "ok"; } catch (error) { probe[name] = error.name; }
}
document.getElementById("download").href = URL.createObjectURL(new Blob(["{}"], { type: "application/json" }));
document.getElementById("copy").addEventListener("click", () => {
	navigator.clipboard.writeText("probe").then(() => { probe.clipboard = "ok"; }, error => { probe.clipboard = error.name + ": " + error.message; });
});
document.getElementById("exec").addEventListener("click", () => {
	document.getElementById("text").select();
	probe.execCommand = document.execCommand("copy");
});
</script></body></html>`;

async function srcdocFrame(page) {
	for (let attempt = 0; attempt < 50; attempt += 1) {
		const frame = page.frames().find(candidate => candidate.url() === "about:srcdoc");
		if (frame && await frame.evaluate(() => Boolean(window.__probe)).catch(() => false)) return frame;
		await page.waitForTimeout(100);
	}
	throw new Error("the srcdoc frame never loaded the probe page");
}

async function probeSandbox(browser, sandbox, { viewerHostHtml, VIEWER_CSP }) {
	const context = await browser.newContext({ acceptDownloads: true });
	try {
		const page = await context.newPage();
		let downloads = 0;
		let popups = 0;
		page.on("download", () => { downloads += 1; });
		context.on("page", () => { popups += 1; });
		await context.route("**/*", route => {
			const url = new URL(route.request().url());
			if (url.origin === ORIGIN && url.pathname === "/") {
				return route.fulfill({ body: viewerHostHtml(sandbox), contentType: "text/html", headers: { "content-security-policy": VIEWER_CSP } });
			}
			if (url.origin === ORIGIN && url.pathname === "/artifact.html") return route.fulfill({ body: PROBE_PAGE, contentType: "text/html" });
			return route.fulfill({ body: "<!doctype html><title>blank</title>", contentType: "text/html" });
		});
		await page.goto(`${ORIGIN}/`);
		const frame = await srcdocFrame(page);
		for (const id of ["copy", "exec", "download", "popup"]) await frame.click(`#${id}`);
		await page.waitForTimeout(1500);
		return { sandbox, ...(await frame.evaluate(() => window.__probe)), downloads, popups };
	} finally {
		await context.close();
	}
}

async function main() {
	const repoRoot = resolveRepoRoot();
	if (!repoRoot) throw new Error("needs the VPK repository: scripts/verify-artifact-html.mjs provides the viewer harness");
	const harness = await import(pathToFileURL(path.join(repoRoot, "scripts", "verify-artifact-html.mjs")).href);
	const { chromium } = await import("@playwright/test");
	const browser = await chromium.launch();
	try {
		const results = [];
		for (const sandbox of SANDBOXES) results.push(await probeSandbox(browser, sandbox, harness));
		console.log(JSON.stringify({ probedAt: new Date().toISOString(), chromium: browser.version(), results }, null, 2));
	} finally {
		await browser.close();
	}
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
