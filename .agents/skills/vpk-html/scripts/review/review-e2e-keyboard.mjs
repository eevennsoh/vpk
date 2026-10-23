/*
 * review/review-e2e-keyboard: keyboard scenarios for review-e2e.mjs (ws1 §8 E2E, acceptance #6).
 *
 * Every step uses real key presses. Focus is never placed with page.evaluate: a scenario starts
 * from the page (Tab) or from one locator.focus() that stands in for a click, and after every
 * action the focused element is read back and must sit in the drawer, never on the body.
 * Registered into SCENARIOS by review-e2e.mjs; run through that harness.
 */
import fs from "node:fs";
import path from "node:path";
import { DEMO, newPage, openFile, saveDownload, selectQuote, shadowButtons } from "./review-e2e-core.mjs";

const DEMO_QUOTE = "Optimistic insert on submit, rollback on failure";

// A returning reader who saw r1 of `file` in this browser: only they get the revision banner
// (B2 decision 10b), so banner scenarios seed the seen receipt before the page loads.
export function sawR1(context, file) {
	const docId = /<meta name="vpk-doc-id" content="([a-z0-9]+)">/.exec(fs.readFileSync(file, "utf8"))[1];
	return context.addInitScript(key => localStorage.setItem(key, JSON.stringify({ lastSeenRevision: "r1", seenAt: "2026-10-11T09:00:00.000Z" })), `vpk-review/1/seen/${docId}`);
}

// "shadow:<class>::<name>|drawer" for review UI focus, else "<tag>[type=value]".
export function focusOf(page) {
	return page.evaluate(() => {
		const host = document.querySelector("[data-vpk-review-ui]");
		const active = document.activeElement;
		if (active === host) {
			const inner = host.shadowRoot.activeElement;
			if (!inner) return "shadow:none";
			return `shadow:${inner.className || inner.localName}::${(inner.getAttribute("aria-label") || inner.textContent || "").trim().slice(0, 60)}${inner.closest("#vr-drawer") ? "|drawer" : ""}${inner.closest(".vr-dialog") ? "|dialog" : ""}`;
		}
		return active ? `${active.localName}${active.type ? `[${active.type}=${active.value}]` : ""}` : "none";
	});
}

export async function tabTo(page, pattern, { back = false, limit = 80 } = {}) {
	for (let step = 0; step < limit; step++) {
		if (pattern.test(await focusOf(page))) return true;
		await page.keyboard.press(back ? "Shift+Tab" : "Tab");
	}
	return pattern.test(await focusOf(page));
}

function liveText(page) {
	return page.evaluate(() => document.querySelector("[data-vpk-review-ui]").shadowRoot.querySelector(".vr-sr").textContent);
}

function toastText(page) {
	return page.evaluate(() => document.querySelector("[data-vpk-review-ui]").shadowRoot.querySelector(".vr-toast").textContent);
}

const pause = (page) => page.waitForTimeout(120);

export const KEYBOARD_SCENARIOS = {
	// Delete is a tombstone with a 5 s Undo toast (§4.8). Undo from the keyboard puts focus on the
	// restored thread; when the toast expires with focus on Undo, focus moves to the drawer's tab.
	async "keyboard-toast"({ browser }) {
		const runs = {};
		for (const variant of ["undo", "expire"]) {
			const { context, page } = await newPage(browser);
			await openFile(page, DEMO);
			await page.evaluate(() => {
				window.__VPK_REVIEW__.setIdentity({ name: "Del Ete", initials: "DE" });
				window.__VPK_REVIEW__.addComment({ body: "Delete me from the keyboard" });
			});
			const out = { toLauncher: await tabTo(page, /^shadow:vr-launcher/, { limit: 300 }) };
			await page.keyboard.press("Enter");
			out.toMore = await tabTo(page, /::More actions\|drawer$/);
			await page.keyboard.press("Enter");
			out.toDelete = await tabTo(page, /::Delete\|drawer$/);
			await page.keyboard.press("Enter");
			await pause(page);
			out.afterDelete = await focusOf(page);
			out.toUndo = await tabTo(page, /::Undo$/, { limit: 60 });
			if (variant === "undo") await page.keyboard.press("Enter");
			else await page.waitForTimeout(5400);
			await pause(page);
			out.after = await focusOf(page);
			out.deleted = await page.evaluate(() => window.__VPK_REVIEW__.getReview().comments.find(comment => comment.body === "Delete me from the keyboard").deleted === true);
			out.errors = page.errors.slice();
			await context.close();
			const landed = variant === "undo" ? /^shadow:vr-thread.*\|drawer$/.test(out.after) && !out.deleted : /^shadow:vr-tab::Comments\|drawer$/.test(out.after) && out.deleted;
			runs[variant] = { ok: out.toLauncher && out.toMore && out.toDelete && /\|drawer$/.test(out.afterDelete) && out.toUndo && landed && out.errors.length === 0, ...out };
		}
		return { ok: runs.undo.ok && runs.expire.ok, ...runs };
	},

	async keyboard({ browser }) {
		const { context, page } = await newPage(browser);
		const popups = [];
		page.on("popup", popup => popups.push(popup.url()));
		await openFile(page, DEMO);
		await page.evaluate(() => {
			window.__docKeys = [];
			document.addEventListener("keydown", event => window.__docKeys.push(event.key));
		});
		const reached = await tabTo(page, /^shadow:vr-launcher/, { limit: 300 });
		await page.keyboard.press("Enter");
		const inDrawer = /\|drawer$/.test(await focusOf(page));
		await page.keyboard.press("Escape");
		const back = /^shadow:vr-launcher/.test(await focusOf(page));
		// A click on plain text (not page.evaluate) takes focus off the launcher, as a reader would.
		await page.locator("main p").first().click({ position: { x: 2, y: 2 } });
		await page.evaluate(() => {
			getSelection().removeAllRanges();
			window.__docKeys.length = 0;
		});
		await page.keyboard.press("c");
		const picker = await toastText(page);
		for (const key of ["ArrowDown", "ArrowDown", "ArrowUp", "Home", "End", "p"]) await page.keyboard.press(key);
		await page.keyboard.press("Escape");
		const leakedPicker = await page.evaluate(() => window.__docKeys.filter(key => key !== "c"));
		await selectQuote(page, DEMO_QUOTE);
		await page.waitForTimeout(250);
		await page.keyboard.press("c");
		const composerOpen = await page.locator(".vr-composer").isVisible();
		const nameFocused = /::Your name\|drawer$/.test(await focusOf(page));
		await page.evaluate(() => (window.__docKeys.length = 0));
		for (const key of ["p", "ArrowUp", "ArrowDown", "Alt"]) await page.keyboard.press(key);
		const leakedComposer = await page.evaluate(() => window.__docKeys.slice());
		const unnamed = (await shadowButtons(page)).filter(button => !button.name).length;
		await context.close();
		return { ok: reached && inDrawer && back && /Pick a block/.test(picker) && leakedPicker.length === 0 && composerOpen && nameFocused && leakedComposer.length === 0 && popups.length === 0 && unnamed === 0, reached, inDrawer, back, picker, leakedPicker, composerOpen, nameFocused, leakedComposer, popups, unnamed };
	},

	async "keyboard-actions"({ browser, tmp }) {
		const { context, page } = await newPage(browser);
		await page.addInitScript(() => {
			Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: text => { window.__copied = text; return Promise.resolve(); } } });
		});
		await openFile(page, DEMO);
		await page.evaluate(() => window.__VPK_REVIEW__.setIdentity({ name: "Kay Board", initials: "KB" }));
		const trail = {};
		const step = async (name) => {
			await pause(page);
			trail[name] = await focusOf(page);
			return /\|drawer/.test(trail[name]);
		};
		const toLauncher = await tabTo(page, /^shadow:vr-launcher/, { limit: 300 });
		await page.keyboard.press("Enter");
		await page.keyboard.press("Tab");
		const toFirstRow = await tabTo(page, /^shadow:vr-thread/);
		await page.keyboard.press("ArrowDown");
		const toThread = toFirstRow && /^shadow:vr-thread[^:]*::.*Sam Roe/.test(await focusOf(page));
		await page.keyboard.press("r");
		await page.keyboard.type("Keyboard reply");
		await page.keyboard.press("Control+Enter");
		const replied = await page.evaluate(() => window.__VPK_REVIEW__.getReview().comments.some(comment => comment.body === "Keyboard reply" && comment.parentId));
		const afterReply = await step("afterReply");
		const toResolve = await tabTo(page, /::Resolve\|drawer$/);
		await page.keyboard.press("Enter");
		const resolved = await page.evaluate(() => window.__VPK_REVIEW__.getReview().comments.some(comment => comment.status === "resolved" && comment.statusBy));
		const afterResolve = await step("afterResolve");
		const toChip = await tabTo(page, /vr-chip-btn::Resolved\|drawer$/, { back: true });
		await page.keyboard.press("Enter");
		const afterChip = (await step("afterChip")) && /::Resolved\|drawer$/.test(trail.afterChip);
		const toTab = await tabTo(page, /^shadow:vr-tab::/, { back: true });
		for (let count = 0; count < 3; count++) await page.keyboard.press("ArrowRight");
		const onShare = /vr-tab::Share/.test(await focusOf(page));
		const toDownload = await tabTo(page, /::Download all/);
		const downloaded = await saveDownload(page, () => page.keyboard.press("Enter"), path.join(tmp, "keyboard"));
		const afterDownload = await step("afterDownload");
		const toCopy = await tabTo(page, /::Copy for agent/, { back: true });
		await page.keyboard.press("Enter");
		await page.waitForFunction(() => typeof window.__copied === "string", null, { timeout: 5000 });
		const toSave = await tabTo(page, /::Save reviewed copy/);
		await page.keyboard.press("Enter");
		const dialogFocused = (await step("afterSaveOpen")) && /\|dialog$/.test(trail.afterSaveOpen);
		const toCancel = await tabTo(page, /::Cancel\|drawer\|dialog$/);
		await page.keyboard.press("Enter");
		const backToSave = (await step("afterCancel")) && /::Save reviewed copy\|drawer$/.test(trail.afterCancel);
		const toImport = await tabTo(page, /::Import reviews/);
		const [chooser] = await Promise.all([page.waitForEvent("filechooser", { timeout: 5000 }), page.keyboard.press("Enter")]);
		await chooser.setFiles(downloaded);
		await page.waitForFunction(() => document.querySelector("[data-vpk-review-ui]").shadowRoot.querySelector(".vr-toast").textContent.includes("Imported"), null, { timeout: 5000 });
		const afterImport = await step("afterImport");
		await page.keyboard.press("Escape");
		const closed = /^shadow:vr-launcher/.test(await focusOf(page));
		await context.close();
		const reached = toLauncher && toThread && toResolve && toChip && toTab && onShare && toDownload && toCopy && toSave && toCancel && toImport;
		const kept = afterReply && afterResolve && afterChip && afterDownload && dialogFocused && backToSave && afterImport && closed;
		return { ok: reached && kept && replied && resolved, reached, kept, replied, resolved, download: path.basename(downloaded), trail };
	},

	// Round-1 verifier journeys (r1.3-r1.6), fresh reader with no name yet.
	async "keyboard-focus"({ browser }) {
		const out = {};
		{
			// Banner "Reveal changes": focus lands on the Changes tab; Esc then closes the drawer.
			const { context, page } = await newPage(browser, { viewport: { width: 1280, height: 800 } });
			await sawR1(context, DEMO);
			await openFile(page, DEMO);
			out.toReveal = await tabTo(page, /vr-link::Reveal changes/, { limit: 300 });
			await page.keyboard.press("Enter");
			await pause(page);
			out.afterReveal = await focusOf(page);
			await page.keyboard.press("Escape");
			out.afterRevealEsc = await focusOf(page);
			out.drawerClosed = await page.evaluate(() => document.querySelector("[data-vpk-review-ui]").shadowRoot.querySelector("#vr-drawer").hidden);
			out.errorsBanner = page.errors.slice();
			await context.close();
		}
		const { context, page } = await newPage(browser, { viewport: { width: 1280, height: 800 } });
		await openFile(page, DEMO);
		// r1.6: changing a decision keeps focus on the control (WCAG 3.2.2).
		const rollout = "fieldset[data-vpk-decision='rollout']";
		await page.locator(`${rollout} input:checked`).focus();
		const before = await page.evaluate(sel => document.querySelector(`${sel} input:checked`).value, rollout);
		await page.keyboard.press("ArrowDown");
		await pause(page);
		out.afterDecision = await focusOf(page);
		const changed = await page.evaluate(sel => document.querySelector(`${sel} input:checked`).value, rollout);
		await page.keyboard.press("ArrowUp");
		await page.keyboard.press("ArrowDown");
		await pause(page);
		out.afterDecision2 = await focusOf(page);
		out.decisionToast = await toastText(page);
		out.decisionKept = changed !== before && /^input\[radio=/.test(out.afterDecision) && /^input\[radio=/.test(out.afterDecision2);
		// r1.5: a first reply before any name keeps its text and parent.
		out.toLauncher = await tabTo(page, /^shadow:vr-launcher/, { limit: 300 });
		await page.keyboard.press("Enter");
		out.toRow = await tabTo(page, /^shadow:vr-thread/);
		await page.keyboard.press("r");
		await page.keyboard.type("My important reply text");
		await page.keyboard.press("Control+Enter");
		await pause(page);
		out.afterReplySubmit = await focusOf(page);
		await page.keyboard.type("Rae Dio");
		await page.keyboard.press("Enter");
		await pause(page);
		out.afterIdentity = await focusOf(page);
		out.reply = await page.evaluate(() => window.__VPK_REVIEW__.getReview().comments.filter(comment => comment.body === "My important reply text").map(comment => ({ parentId: !!comment.parentId })));
		out.decisionRecorded = await page.evaluate(() => window.__VPK_REVIEW__.getReview().decisions.some(decision => decision.key === "rollout" && decision.changed));
		// r1.3: "Comment on a block" from the drawer works from the keyboard; Esc leaves the picker first.
		out.toBlockButton = await tabTo(page, /::Comment on a block\|drawer$/, { back: true });
		await page.keyboard.press("Enter");
		await pause(page);
		const live1 = await liveText(page);
		await page.keyboard.press("ArrowDown");
		await page.keyboard.press("ArrowDown");
		await pause(page);
		const live2 = await liveText(page);
		out.pickerMoves = live1 !== live2 && /\d+ of \d+/.test(live2);
		await page.keyboard.press("Escape");
		await pause(page);
		out.afterPickerEsc = await focusOf(page);
		out.pickerClosedLive = await liveText(page);
		await page.keyboard.press("Enter");
		await page.keyboard.press("ArrowDown");
		await page.keyboard.press("Enter");
		await pause(page);
		out.afterPick = await focusOf(page);
		out.composerWhere = await page.locator(".vr-composer > p").first().textContent().catch(() => "");
		await page.keyboard.type("Block note from the keyboard");
		await page.keyboard.press("Control+Enter");
		await pause(page);
		out.afterBlockSubmit = await focusOf(page);
		out.blockSaved = await page.evaluate(() => window.__VPK_REVIEW__.getReview().comments.some(comment => comment.body === "Block note from the keyboard" && comment.kind === "block" && !!comment.anchor));
		// closePanel ends a running picker: start it, close with the Close button, arrows do nothing.
		out.toBlockButton2 = await tabTo(page, /::Comment on a block\|drawer$/, { back: true });
		await page.keyboard.press("Enter");
		out.toClose = await tabTo(page, /::Close review\|drawer$/, { back: true });
		await page.keyboard.press("Enter");
		await pause(page);
		out.afterClose = await focusOf(page);
		const liveClosed = await liveText(page);
		await page.keyboard.press("ArrowDown");
		await pause(page);
		out.pickerEndedOnClose = (await liveText(page)) === liveClosed;
		out.errors = page.errors.slice();
		await context.close();
		const ok = out.toReveal && /^shadow:vr-tab::Changes\|drawer$/.test(out.afterReveal) && /^shadow:vr-launcher/.test(out.afterRevealEsc) && out.drawerClosed
			&& out.decisionKept && /Add your name/.test(out.decisionToast)
			&& out.toLauncher && out.toRow && /::Your name\|drawer$/.test(out.afterReplySubmit) && /\|drawer$/.test(out.afterIdentity) && out.reply.length === 1 && out.reply[0].parentId && out.decisionRecorded
			&& out.toBlockButton && out.pickerMoves && /::Comment on a block\|drawer$/.test(out.afterPickerEsc) && /picker closed/.test(out.pickerClosedLive)
			&& /::Your name|::Comment\|drawer$/.test(out.afterPick) && /^Block: /.test(out.composerWhere) && out.blockSaved && /^shadow:vr-thread.*\|drawer$/.test(out.afterBlockSubmit)
			&& out.toBlockButton2 && out.toClose && /^shadow:vr-launcher/.test(out.afterClose) && out.pickerEndedOnClose
			&& out.errors.length === 0 && out.errorsBanner.length === 0;
		return { ok, ...out };
	},

	// B2 decision 19a (P2-ws1-M1.14): the block picker is not a keyboard trap. Tab leaves it (and
	// removes its window click/pointermove capture listeners); focus moving to a link ends it, so
	// Enter follows the link; a synthetic click (detail 0) on a link is never swallowed; a real
	// pointer click on a block still picks it.
	async "keyboard-picker"({ browser }) {
		const { context, page } = await newPage(browser);
		await openFile(page, DEMO);
		const cdp = await context.newCDPSession(page);
		const state = () => page.evaluate(() => /picker:(on|off)/.exec(window.__VPK_REVIEW__.debug())[1]);
		const captures = async () => {
			const { result } = await cdp.send("Runtime.evaluate", { expression: "window" });
			const { listeners } = await cdp.send("DOMDebugger.getEventListeners", { objectId: result.objectId });
			return listeners.filter(entry => entry.useCapture && ["click", "pointermove"].includes(entry.type)).map(entry => entry.type).sort();
		};
		await page.evaluate(() => {
			const holder = document.querySelector("main p[data-vpk-id]");
			const link = document.createElement("a");
			link.id = "e2e-link";
			link.href = "#e2e-target";
			link.textContent = " link inside a block";
			holder.appendChild(link);
			const target = document.createElement("div");
			target.id = "e2e-target";
			document.querySelector("main").appendChild(target);
		});
		const start = async () => {
			await page.locator("main p").nth(2).click({ position: { x: 2, y: 2 } });
			await page.evaluate(() => getSelection().removeAllRanges());
			await page.keyboard.press("c");
			await pause(page);
		};
		const out = { baseline: await captures() };
		await start();
		out.started = await state();
		out.capturesOn = await captures();
		await page.keyboard.press("Tab");
		await pause(page);
		out.afterTab = await state();
		out.capturesAfterTab = await captures();
		await page.keyboard.press("Escape");
		out.afterEsc = await state();
		await start();
		out.restarted = await state();
		await page.evaluate(() => document.getElementById("e2e-link").click());
		await pause(page);
		out.syntheticHash = await page.evaluate(() => location.hash);
		out.syntheticComposer = await page.locator(".vr-composer").isVisible();
		out.syntheticPicker = await state();
		await page.locator("main p").nth(3).click({ position: { x: 2, y: 2 } });
		await pause(page);
		out.pointerPick = await page.locator(".vr-composer > p").first().textContent().catch(() => "");
		await page.keyboard.press("Escape");
		await page.evaluate(() => history.replaceState(null, "", location.pathname));
		await start();
		await page.locator("#e2e-link").focus();
		await pause(page);
		out.afterLinkFocus = await state();
		await page.keyboard.press("Enter");
		await pause(page);
		out.enterHash = await page.evaluate(() => location.hash);
		out.composerAfterEnter = await page.locator(".vr-composer").isVisible();
		out.capturesEnd = await captures();
		out.errors = page.errors.slice();
		await context.close();
		const ok = out.started === "on" && out.capturesOn.length === out.baseline.length + 2 && out.afterTab === "off" && out.capturesAfterTab.join() === out.baseline.join() && out.afterEsc === "off"
			&& out.restarted === "on" && out.syntheticHash === "#e2e-target" && !out.syntheticComposer && out.syntheticPicker === "on" && /^Block: /.test(out.pointerPick)
			&& out.afterLinkFocus === "off" && out.enterHash === "#e2e-target" && !out.composerAfterEnter && out.capturesEnd.join() === out.baseline.join() && out.errors.length === 0;
		return { ok, ...out };
	},

	// WCAG 2.4.11: with the drawer open, no focused control is entirely hidden by review UI. Tab and
	// Shift+Tab 40 steps each from the open drawer (sheet at 390, side drawer at 768 and 1024); the
	// banner hides while the drawer is open, the sheet hides the launcher, and Esc on the launcher closes.
	async "keyboard-obscured"({ browser, file = DEMO }) {
		const runs = [];
		for (const [width, height] of [[390, 844], [768, 1024], [1024, 768]]) {
			const mobile = width <= 640;
			const { context, page } = await newPage(browser, { viewport: { width, height }, isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce" });
			await sawR1(context, file);
			await openFile(page, file);
			const visible = () => focusVisible(page);
			const run = { size: `${width}x${height}`, hidden: [] };
			for (const key of ["Tab", "Shift+Tab"]) {
				await page.locator(".vr-launcher").focus();
				await page.keyboard.press("Enter");
				await pause(page);
				run.bannerHiddenOpen = await page.evaluate(() => document.querySelector("[data-vpk-review-ui]").shadowRoot.querySelector(".vr-banner").hidden);
				run.launcherShownOpen = await page.locator(".vr-launcher").isVisible();
				for (let step = 0; step < 40; step++) {
					await page.keyboard.press(key);
					await page.waitForTimeout(40);
					const seen = await visible();
					if (!seen.points) run.hidden.push(`${key} ${step + 1} ${seen.name}`);
				}
				await page.evaluate(() => window.__VPK_REVIEW__.close());
			}
			await page.locator(".vr-launcher").focus();
			await page.keyboard.press("Enter");
			await pause(page);
			if (!mobile) {
				await page.locator(".vr-launcher").focus();
				await page.keyboard.press("Escape");
				await pause(page);
				run.escOnLauncherCloses = await page.evaluate(() => document.querySelector("[data-vpk-review-ui]").shadowRoot.querySelector("#vr-drawer").hidden);
			}
			await page.evaluate(() => window.__VPK_REVIEW__.close());
			run.bannerShownClosed = await page.evaluate(() => !document.querySelector("[data-vpk-review-ui]").shadowRoot.querySelector(".vr-banner").hidden);
			run.errors = page.errors.slice();
			run.ok = run.hidden.length === 0 && run.bannerHiddenOpen && run.launcherShownOpen === !mobile && run.bannerShownClosed && (mobile || run.escOnLauncherCloses) && run.errors.length === 0;
			runs.push(run);
			await context.close();
		}
		return { ok: runs.every(run => run.ok), runs };
	},

	// WCAG 2.4.11 with the drawer closed and the revision banner shown (a returning reader): Tab 60
	// steps from the top of the page. Page focus under the banner hides it (the first stop, the
	// rollout radio at 1200-1600 x 800, sits under it), it returns once focus moves clear, and no stop
	// is hidden; an arrow key on the first stop changes a control the reader can see.
	async "keyboard-obscured-closed"({ browser, file = DEMO }) {
		const runs = [];
		const banner = page => page.evaluate(() => !document.querySelector("[data-vpk-review-ui]").shadowRoot.querySelector(".vr-banner").hidden);
		for (const [width, height] of [[1280, 800], [1200, 800], [1600, 800], [1024, 768], [390, 844]]) {
			const mobile = width <= 640;
			const { context, page } = await newPage(browser, { viewport: { width, height }, isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce" });
			await sawR1(context, file);
			await openFile(page, file);
			const run = { size: `${width}x${height}`, hidden: [], bannerAtStart: await banner(page), yielded: 0, returned: 0 };
			let shown = run.bannerAtStart;
			for (let step = 0; step < 60; step++) {
				await page.keyboard.press("Tab");
				await page.waitForTimeout(40);
				const seen = await focusVisible(page);
				if (!seen.points) run.hidden.push(`Tab ${step + 1} ${seen.name}`);
				if (step === 0) run.first = seen.name;
				const now = await banner(page);
				if (shown && !now) run.yielded++;
				if (!shown && now) run.returned++;
				shown = now;
			}
			await page.locator(".vr-launcher").focus();
			await pause(page);
			run.bannerWithUiFocus = await banner(page);
			run.errors = page.errors.slice();
			run.ok = run.bannerAtStart && run.hidden.length === 0 && run.bannerWithUiFocus && run.yielded === run.returned && run.errors.length === 0;
			runs.push(run);
			await context.close();
		}
		const at1280 = runs[0];
		return { ok: runs.every(run => run.ok) && at1280.yielded > 0 && /^input::/.test(at1280.first || ""), runs };
	},
};

// How much of the focused control (page or review UI) is painted: 0 to 5 probe points.
function focusVisible(page) {
	return page.evaluate(() => {
		let active = document.activeElement;
		let shadow = false;
		while (active && active.shadowRoot && active.shadowRoot.activeElement) [active, shadow] = [active.shadowRoot.activeElement, true];
		if (!active || active === document.body) return { name: "body", points: 5 };
		const root = document.querySelector("[data-vpk-review-ui]").shadowRoot;
		const box = active.getBoundingClientRect();
		const points = [[box.x + 2, box.y + 2], [box.right - 2, box.y + 2], [box.x + 2, box.bottom - 2], [box.right - 2, box.bottom - 2], [box.x + box.width / 2, box.y + box.height / 2]].filter(([x, y]) => {
			if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false;
			const hit = (shadow ? root : document).elementFromPoint(x, y);
			return hit === active || (hit && active.contains(hit));
		}).length;
		return { name: `${active.localName}::${(active.getAttribute("aria-label") || active.textContent || active.value || "").trim().slice(0, 30)}`, points };
	});
}
