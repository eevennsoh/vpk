/*
 * review/review-e2e-p3: P3 scenarios for review-e2e.mjs (ws1 §8 E2E, B2 decisions 19 and 21): toasts
 * on phones (G2.21 J3), the M2 Layout tab, Owner mode and the storage meter, and the engines and
 * xthread scenarios. Registered into SCENARIOS by review-e2e.mjs; run through that harness.
 */
import { DEMO, ANA, DEMO_QUOTE, commentOnQuote, newPage, openFile } from "./review-e2e-core.mjs";

// Toast box and every visible drawer control (or the launcher) it covers.
function toastCover(page) {
	return page.evaluate(() => {
		const root = document.querySelector("[data-vpk-review-ui]").shadowRoot;
		const toast = root.querySelector(".vr-toast");
		const box = toast.getBoundingClientRect();
		const covered = [...root.querySelectorAll(".vr-drawer button, .vr-drawer input, .vr-drawer textarea, .vr-launcher")]
			.filter(node => !toast.contains(node))
			.filter(node => {
				const rect = node.getBoundingClientRect();
				if (getComputedStyle(node).visibility === "hidden" || rect.width === 0 || rect.height === 0) return false;
				return rect.left < box.right && rect.right > box.left && rect.top < box.bottom && rect.bottom > box.top;
			})
			.map(node => (node.getAttribute("aria-label") || node.textContent || node.className).trim().slice(0, 30));
		return { on: toast.classList.contains("is-on") && box.width > 0, top: Math.round(box.top), bottom: Math.round(box.bottom), left: Math.round(box.left), right: Math.round(box.right), covered, text: toast.textContent.slice(0, 80), viewport: [innerWidth, innerHeight] };
	});
}

// What the old placement (bottom: 18px; left: 62px) covered, measured on the same page.
function oldPlacementCover(page) {
	return page.evaluate(() => {
		const toast = document.querySelector("[data-vpk-review-ui]").shadowRoot.querySelector(".vr-toast");
		toast.style.cssText = "top:auto;bottom:18px;left:62px;right:auto;max-width:calc(100vw - 80px)";
		return null;
	}).then(() => toastCover(page)).then(async result => {
		await page.evaluate(() => (document.querySelector("[data-vpk-review-ui]").shadowRoot.querySelector(".vr-toast").style.cssText = ""));
		return result;
	});
}

export const P3_SCENARIOS = {
	// G2.21 J3: at 390 px the toasts cover no drawer control or action, and stay inside the viewport.
	async "toast-mobile"({ browser }) {
		const { context, page } = await newPage(browser, { viewport: { width: 390, height: 844 }, colorScheme: "dark" });
		await openFile(page, DEMO);
		const out = {};
		await commentOnQuote(page, DEMO_QUOTE, "Say how the rollback is shown.", ANA);
		await page.waitForTimeout(300);
		out.added = await toastCover(page);
		out.addedOld = await oldPlacementCover(page);
		await page.evaluate(() => window.__VPK_REVIEW__.open("share"));
		await page.locator(".vr-btn", { hasText: /^Download all/ }).click();
		await page.waitForTimeout(300);
		out.downloaded = await toastCover(page);
		out.downloadedOld = await oldPlacementCover(page);
		out.errors = page.errors.slice();
		await context.close();
		const inside = box => box.top >= 0 && box.left >= 0 && box.right <= box.viewport[0] && box.bottom <= box.viewport[1];
		const ok = out.added.on && out.added.covered.length === 0 && inside(out.added)
			&& out.downloaded.on && out.downloaded.covered.length === 0 && inside(out.downloaded)
			&& (out.addedOld.covered.length > 0 || out.downloadedOld.covered.length > 0)
			&& out.errors.length === 0;
		return { ok, ...out };
	},
};
