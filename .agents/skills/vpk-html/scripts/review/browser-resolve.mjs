/*
 * review/browser-resolve: `build.mjs --review ... --browser` (ws1 M2, 4.15). Loads the artifact in
 * headless Chromium, asks the review runtime to resolve every comment of a merged review against the
 * live DOM (window.__VPK_REVIEW__.resolveAll), and returns the statuses. This is how comments on
 * runtime-rendered content (x-thread posts and similar) read `exact` instead of the static `runtime`.
 * Playwright is imported here directly (integration R23, no shared launch helper). Node only, not
 * serialized into the page.
 */

import { pathToFileURL } from "node:url";
import { ReviewError } from "./stamp.mjs";

const LOAD_TIMEOUT_MS = 20000;
const SETTLE_MS = 400;

/**
 * Resolves every root comment of `review` in the page at `file` (an absolute path). Returns
 * Map<commentId, { status, blockId }>. Throws a ReviewError (exit 1) when Chromium cannot be
 * launched or the page has no review runtime.
 */
export async function resolveInBrowser(file, review, { launch } = {}) {
	let browser = null;
	try {
		if (typeof launch === "function") browser = await launch();
		else {
			const { chromium } = await import("@playwright/test");
			browser = await chromium.launch();
		}
	} catch (error) {
		const reason = String((error && error.message) || error).split("\n")[0];
		throw new ReviewError(`--browser needs Chromium (${reason}); run \`pnpm exec playwright install chromium\` or drop --browser for static statuses`, 1);
	}
	try {
		const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
		await page.goto(pathToFileURL(file).href, { waitUntil: "load", timeout: LOAD_TIMEOUT_MS });
		try {
			await page.waitForFunction(() => window.__VPK_REVIEW__ && typeof window.__VPK_REVIEW__.resolveAll === "function", null, { timeout: LOAD_TIMEOUT_MS });
		} catch {
			throw new ReviewError("--browser: the page has no review runtime (run --inject-review first)", 2);
		}
		// Runtime-rendered content emits vpk:content-rendered; give the render a frame to land.
		await page.waitForTimeout(SETTLE_MS);
		const entries = await page.evaluate((value) => window.__VPK_REVIEW__.resolveAll(value), review);
		return new Map(entries.map((entry) => [entry.commentId, { status: entry.status, blockId: entry.blockId || null }]));
	} finally {
		await browser.close();
	}
}
