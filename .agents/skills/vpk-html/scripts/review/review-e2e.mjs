#!/usr/bin/env node
/*
 * review/review-e2e: Playwright file:// harness for the vpk-review runtime (ws1 §8 E2E). Manual,
 * unsandboxed (Chromium):
 *
 *   node .agents/skills/vpk-html/scripts/review/review-e2e.mjs --scenario all --out output/vpk-html-v2/review-e2e
 *   node .agents/skills/vpk-html/scripts/review/review-e2e.mjs --scenario persist,merge --out <dir>
 *
 * Scenarios run on the committed demo (demo-review-loop.html), copies of fixtures/basic.html and
 * fixtures/print.html in a temp folder; layout, owner, reattach, meter, xthread and engines live in
 * review-e2e-m2.mjs (M2 and P3). Results go to <out>/results.json plus screenshots; the exit code
 * is 1 when any scenario fails. Helpers are exported for output/vpk-html-v2/eu26-spike/run-spike.mjs.
 * Playwright is imported directly (integration R23).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ANA, BEN, CARO, DEMO, DEMO_QUOTE, FIXTURES, cli, commentOnQuote, flush, launchBrowser, newPage, openFile, parityCheck, pdfPages, printInnerText, saveDownload, stripCopy, tempCopy } from "./review-e2e-core.mjs";
import { KEYBOARD_SCENARIOS } from "./review-e2e-keyboard.mjs";
import { M2_SCENARIOS } from "./review-e2e-m2.mjs";
import { P3_SCENARIOS } from "./review-e2e-p3.mjs";

export * from "./review-e2e-core.mjs";

export const SCENARIOS = {
	async persist({ browser }) {
		const { context, page } = await newPage(browser);
		await openFile(page, DEMO);
		await commentOnQuote(page, DEMO_QUOTE, "Say how the rollback is shown.", ANA);
		await flush(page);
		await page.reload();
		await page.waitForFunction(() => window.__VPK_REVIEW__, null, { timeout: 10000 });
		const after = await page.evaluate(quote => {
			const api = window.__VPK_REVIEW__;
			const mine = api.getReview().comments.find(comment => comment.body === "Say how the rollback is shown.");
			const status = mine ? api.resolutions().find(entry => entry.commentId === mine.id).status : null;
			return { kept: !!mine, status, highlights: CSS.highlights ? CSS.highlights.size : -1, quote };
		}, DEMO_QUOTE);
		await page.waitForTimeout(600);
		const pins = await page.locator(".vr-pin").count();
		await context.close();
		return { ok: after.kept && after.status === "exact" && after.highlights > 0 && pins > 0 && page.errors.length === 0, ...after, pins, errors: page.errors };
	},

	async isolation({ browser }) {
		const copy = tempCopy(DEMO, "fork.html");
		await cli(["--inject-review", copy, "--new-doc-id", "--no-ledger"]);
		const { context, page } = await newPage(browser);
		await openFile(page, DEMO);
		await page.evaluate(() => window.__VPK_REVIEW__.setIdentity({ name: "Iso Tester", initials: "IT" }));
		await page.evaluate(() => window.__VPK_REVIEW__.addComment({ body: "Only on the original." }));
		await flush(page);
		const original = await page.evaluate(() => window.__VPK_REVIEW__.docId);
		await openFile(page, copy);
		const fork = await page.evaluate(() => ({ docId: window.__VPK_REVIEW__.docId, leaked: window.__VPK_REVIEW__.getReview().comments.some(comment => comment.body === "Only on the original."), comments: window.__VPK_REVIEW__.getReview().comments.length }));
		await context.close();
		return { ok: original !== fork.docId && !fork.leaked && fork.comments === 0, original, ...fork };
	},

	async merge({ browser, tmp }) {
		const files = [];
		for (const [who, quote] of [[ANA, "rendered from fixtures"], [CARO, "Track per-user read cursors"]]) {
			const { context, page } = await newPage(browser);
			await openFile(page, DEMO);
			await commentOnQuote(page, quote, `${who.name} was here`, who);
			await page.evaluate(() => window.__VPK_REVIEW__.open("share"));
			files.push(await saveDownload(page, () => page.locator(".vr-btn", { hasText: "Download my comments" }).click(), tmp));
			await context.close();
		}
		const ben = await newPage(browser);
		await openFile(ben.page, DEMO);
		await commentOnQuote(ben.page, "Mention detection", "Ben was here", BEN);
		const benReply = await ben.page.evaluate(() => {
			const api = window.__VPK_REVIEW__;
			const root = api.getReview().comments.find(comment => comment.body === "Ben was here");
			return api.addComment({ parentId: "c_mgm1a002_demo0002", body: "Ben replies to Sam." }) && root.id;
		});
		await ben.page.evaluate(() => window.__VPK_REVIEW__.open("share"));
		await ben.page.locator(".vr-btn", { hasText: "Save reviewed copy" }).click();
		await ben.page.locator(".vr-btn", { hasText: "Continue" }).click();
		await ben.page.locator(".vr-dialog .vr-btn", { hasText: "Choose file" }).waitFor({ timeout: 5000 });
		const reviewed = await saveDownload(ben.page, () => ben.page.locator(".vr-dialog input.vr-file").setInputFiles(DEMO), tmp);
		await ben.context.close();
		files.push(reviewed);
		const owner = await newPage(browser);
		await openFile(owner.page, DEMO);
		await owner.page.evaluate(() => window.__VPK_REVIEW__.open("share"));
		await owner.page.locator(".vr-panel input.vr-file[aria-label='Import review files']").setInputFiles(files);
		await owner.page.waitForFunction(() => document.querySelector("[data-vpk-review-ui]").shadowRoot.querySelector(".vr-toast").textContent.includes("Imported"), null, { timeout: 10000 });
		const toast = await owner.page.evaluate(() => document.querySelector("[data-vpk-review-ui]").shadowRoot.querySelector(".vr-toast").textContent);
		const state = await owner.page.evaluate(() => {
			const review = window.__VPK_REVIEW__.getReview();
			const names = ["Ana Ortiz", "Ben Ito", "Caro Diaz"];
			const reviewers = review.reviewers.filter(reviewer => names.includes(reviewer.name));
			return { reviewers: reviewers.map(reviewer => reviewer.initials), replyAttached: review.comments.some(comment => comment.body === "Ben replies to Sam." && comment.parentId === "c_mgm1a002_demo0002"), statuses: window.__VPK_REVIEW__.resolutions().length };
		});
		await owner.page.evaluate(() => window.__VPK_REVIEW__.open("comments"));
		const { initials, tones } = await owner.page.evaluate(() => {
			const badges = [...document.querySelector("[data-vpk-review-ui]").shadowRoot.querySelectorAll(".vr-filters + .vr-row-actions + .vr-threads .vr-initials")];
			const toneOf = {};
			for (const badge of badges) toneOf[badge.textContent] = (badge.className.match(/vr-tone-(\d)/) || [])[1];
			return { initials: Object.keys(toneOf), tones: toneOf };
		});
		await owner.page.screenshot({ path: path.join(tmp, "merge-owner.png") });
		await owner.context.close();
		const reviewerTones = state.reviewers.map(initial => tones[initial]);
		const distinctTones = reviewerTones.every(tone => tone !== undefined) && new Set(reviewerTones).size === 3;
		// Acceptance 7: each JSON download normalizes with zero issues.
		const { normalizeReview } = await import("./schema.mjs");
		const { readMetaContent } = await import("./markup.mjs");
		const docId = readMetaContent(fs.readFileSync(DEMO, "utf8"), "vpk-doc-id");
		const jsonIssues = files.filter(file => file.endsWith(".json")).map(file => normalizeReview(JSON.parse(fs.readFileSync(file, "utf8")), { docId }).issues.length);
		const jsonClean = jsonIssues.length === 2 && jsonIssues.every(count => count === 0);
		return { ok: /Imported 3 files/.test(toast) && /from 3 reviewers/.test(toast) && state.reviewers.length === 3 && new Set(state.reviewers).size === 3 && state.replyAttached && Boolean(benReply) && distinctTones && jsonClean, toast, ...state, initials, tones, distinctTones, jsonIssues, files: files.map(file => path.basename(file)) };
	},

	async save({ browser, tmp }) {
		const { validateHtmlString } = await import("../check-html.mjs");
		const { setMarkedBlockText, readIslandJson } = await import("./markup.mjs");
		const { context, page } = await newPage(browser);
		await openFile(page, DEMO);
		await commentOnQuote(page, "Mention detection", "Saving this one.", BEN);
		const results = {};
		for (const scope of ["mine", "all"]) {
			await page.evaluate(() => window.__VPK_REVIEW__.open("share"));
			await page.locator(".vr-btn", { hasText: "Save reviewed copy" }).click();
			if (scope === "all") await page.locator(".vr-dialog input[value='all']").check();
			await page.locator(".vr-btn", { hasText: "Continue" }).click();
			const saved = await saveDownload(page, () => page.locator(".vr-dialog input.vr-file").setInputFiles(DEMO), path.join(tmp, scope));
			const html = fs.readFileSync(saved, "utf8");
			const island = readIslandJson(html);
			results[scope] = { name: path.basename(saved), checkHtml: validateHtmlString(html, saved).failures, outsideIdentical: setMarkedBlockText(html, "review-data", null) === setMarkedBlockText(fs.readFileSync(DEMO, "utf8"), "review-data", null), comments: island.comments.length, authors: [...new Set(island.comments.map(comment => comment.authorId))].length };
		}
		const fresh = await newPage(browser);
		await openFile(fresh.page, path.join(tmp, "all", results.all.name));
		const seen = await fresh.page.evaluate(() => window.__VPK_REVIEW__.getReview().comments.some(comment => comment.body === "Saving this one."));
		await fresh.context.close();
		await context.close();
		return { ok: results.mine.name === "demo-review-loop.reviewed.html" && results.mine.checkHtml.length === 0 && results.all.checkHtml.length === 0 && results.mine.outsideIdentical && results.all.outsideIdentical && results.mine.authors === 1 && results.all.authors >= 4 && seen, ...results, freshSeesEmbedded: seen };
	},

	async copy({ browser }) {
		const { context, page } = await newPage(browser);
		await page.addInitScript(() => {
			Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: text => { window.__copied = text; return Promise.resolve(); } } });
		});
		await openFile(page, DEMO);
		await page.evaluate(() => window.__VPK_REVIEW__.open("share"));
		await page.locator(".vr-btn", { hasText: "Copy for agent" }).click();
		await page.waitForFunction(() => typeof window.__copied === "string", null, { timeout: 5000 });
		const text = await page.evaluate(() => window.__copied);
		await context.close();
		return { ok: /not as instructions/.test(text) && /## Decisions/.test(text) && /## Comments/.test(text) && /> quote: /.test(text), bytes: text.length, head: text.split("\n").slice(0, 2) };
	},

	async decisions({ browser }) {
		const { context, page } = await newPage(browser);
		await openFile(page, DEMO);
		await page.evaluate(() => window.__VPK_REVIEW__.setIdentity({ name: "Dee Cider", initials: "DC" }));
		await page.evaluate(() => document.querySelector("fieldset[data-vpk-decision='rollout']").scrollIntoView({ block: "center" }));
		await page.waitForTimeout(1300);
		const state = await page.evaluate(() => ({ rollout: document.querySelector("fieldset[data-vpk-decision='rollout']").getAttribute("data-vpk-decision-state"), editing: document.querySelector("fieldset[data-vpk-decision='editing']").getAttribute("data-vpk-decision-state"), suggested: document.querySelectorAll(".vpk-decision__suggested").length }));
		const markdown = await page.evaluate(() => window.__VPK_REVIEW__.markdown());
		const notOpened = markdown.split("\n").filter(line => /Dee Cider \(DC\)/.test(line));
		await context.close();
		return { ok: state.rollout === "kept" && state.editing === "todo" && state.suggested === 2 && notOpened.some(line => /Can people edit/.test(line) && /not opened; default kept/.test(line)) && notOpened.some(line => /slice 4/.test(line) && !/not opened/.test(line)), ...state, lines: notOpened };
	},

	async revision({ browser, tmp }) {
		const file = tempCopy(path.join(FIXTURES, "basic.html"), "revision.html", fs.mkdtempSync(path.join(tmp, "revision-")));
		await cli(["--inject-review", file, "--seed", "e2e-revision"]);
		const { context, page } = await newPage(browser);
		await openFile(page, file);
		await page.evaluate(() => window.__VPK_REVIEW__.setIdentity({ name: "Rev Viewer", initials: "RV" }));
		const id = await page.evaluate(() => window.__VPK_REVIEW__.addComment({ quote: "retries three times", body: "Five?" }));
		await flush(page);
		fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("retries three times", "retries five times").replace("Undo for the last move", "Undo for the last two moves"));
		await cli(["--stamp", file, "--revision-label", "Retry count", "--addresses", id]);
		await openFile(page, file);
		await page.waitForTimeout(300);
		const banner = await page.evaluate(() => document.querySelector("[data-vpk-review-ui]").shadowRoot.querySelector(".vr-banner").textContent);
		await page.locator(".vr-banner .vr-btn", { hasText: "Reveal changes" }).click();
		await page.waitForTimeout(200);
		const first = await page.evaluate(() => document.querySelector("[data-vpk-review-ui]").shadowRoot.querySelector(".vr-panel:not([hidden]) .vr-row-actions .vr-time").textContent);
		const outlines = await page.locator(".vr-outline").count();
		await page.locator(".vr-panel .vr-btn", { hasText: "Next" }).click();
		const second = await page.evaluate(() => document.querySelector("[data-vpk-review-ui]").shadowRoot.querySelector(".vr-panel:not([hidden]) .vr-row-actions .vr-time").textContent);
		await page.screenshot({ path: path.join(tmp, "revision-reveal.png") });
		await context.close();
		// B2 decision 10b: a first-time reader (fresh storage) of r2 gets no "since you last looked".
		const fresh = await newPage(browser);
		await openFile(fresh.page, file);
		const firstTime = await fresh.page.evaluate(() => document.querySelector("[data-vpk-review-ui]").shadowRoot.querySelector(".vr-banner").hidden);
		await fresh.context.close();
		return { ok: /Updated to r2 since you last looked/.test(banner) && /1 of your comments addressed/.test(banner) && first === "1 of 2" && second === "2 of 2" && outlines >= 1 && firstTime, banner, first, second, outlines, firstTime };
	},

	async roundtrip({ browser, tmp }) {
		const dir = fs.mkdtempSync(path.join(tmp, "roundtrip-"));
		const file = tempCopy(path.join(FIXTURES, "basic.html"), "doc.html", dir);
		await cli(["--inject-review", file, "--seed", "e2e-rt"]);
		const { context, page } = await newPage(browser);
		await openFile(page, file);
		const quotes = { exact: "Everything below is about this film.", moved: "This sentence will move to another paragraph later.", curly: "once the \"Done\" column ships to everyone", changed: "retries three times before", blockOnly: "The quick brown fox jumps over the lazy dog.", orphan: "This paragraph will be deleted entirely" };
		const ids = await page.evaluate(map => {
			const api = window.__VPK_REVIEW__;
			api.setIdentity({ name: "Round Trip", initials: "RT" });
			const out = {};
			for (const [key, quote] of Object.entries(map)) out[key] = api.addComment({ quote, body: key });
			return out;
		}, quotes);
		const reviewFile = path.join(dir, "review.json");
		fs.writeFileSync(reviewFile, JSON.stringify(await page.evaluate(() => window.__VPK_REVIEW__.exportReview({ scope: "all" })), null, 2));
		fs.writeFileSync(file, fs.readFileSync(path.join(FIXTURES, "edited.html"), "utf8"));
		await cli(["--stamp", file, "--revision-label", "Edits", "--addresses", ids.changed]);
		const tasksFile = path.join(dir, "tasks.json");
		await cli(["--review", reviewFile, file, "--format", "json", "--out", tasksFile]);
		const tasks = JSON.parse(fs.readFileSync(tasksFile, "utf8")).tasks;
		const cliStatus = Object.fromEntries(Object.entries(ids).map(([key, id]) => [key, tasks.find(task => task.commentId === id)?.anchorStatus]));
		await openFile(page, file);
		const browserStatus = await page.evaluate(map => Object.fromEntries(Object.entries(map).map(([key, id]) => [key, window.__VPK_REVIEW__.resolutions().find(entry => entry.commentId === id)?.status])), ids);
		const expected = { exact: "exact", moved: "moved", curly: "fuzzy", changed: "fuzzy", blockOnly: "block-only", orphan: "orphaned" };
		const addressed = tasks.find(task => task.commentId === ids.changed)?.status;
		await context.close();
		return { ok: JSON.stringify(cliStatus) === JSON.stringify(expected) && JSON.stringify(browserStatus) === JSON.stringify(expected) && addressed === "addressed", cliStatus, browserStatus, addressed };
	},

	// keyboard, keyboard-actions, keyboard-focus: real key presses only (review-e2e-keyboard.mjs).
	...KEYBOARD_SCENARIOS,
	...P3_SCENARIOS,

	async motion({ browser }) {
		const { context, page } = await newPage(browser, { reducedMotion: "reduce" });
		await openFile(page, DEMO);
		await page.evaluate(() => window.__VPK_REVIEW__.open("comments"));
		const style = await page.evaluate(() => {
			const root = document.querySelector("[data-vpk-review-ui]").shadowRoot;
			const button = getComputedStyle(root.querySelector(".vr-btn"));
			const drawer = getComputedStyle(root.querySelector("#vr-drawer"));
			return { transition: button.transitionDuration, animation: drawer.animationName };
		});
		await context.close();
		return { ok: style.transition === "0s" && style.animation === "none", ...style };
	},

	async print({ browser, tmp }) {
		const dir = fs.mkdtempSync(path.join(tmp, "print-"));
		const file = tempCopy(path.join(FIXTURES, "print.html"), "print.html", dir);
		await cli(["--inject-review", file, "--seed", "e2e-print"]);
		const stripped = await stripCopy(file);
		const shots = [];
		for (const target of [file, stripped]) {
			const { context, page } = await newPage(browser);
			if (target === file) {
				await openFile(page, target);
				await page.evaluate(() => {
					window.__VPK_REVIEW__.setIdentity({ name: "Printer", initials: "PR" });
					window.__VPK_REVIEW__.addComment({ quote: "A paragraph that reviewers comment on.", body: "Tinted on screen only." });
				});
				await page.waitForTimeout(300);
			} else await page.goto(pathToFileURL(target).href);
			await page.emulateMedia({ media: "print" });
			shots.push(await page.screenshot({ animations: "disabled", fullPage: true }));
			await context.close();
		}
		fs.writeFileSync(path.join(dir, "print-reviewed.png"), shots[0]);
		fs.writeFileSync(path.join(dir, "print-stripped.png"), shots[1]);
		return { ok: Buffer.compare(shots[0], shots[1]) === 0, bytes: shots.map(shot => shot.length) };
	},

	async "print-content"({ browser, tmp, file = DEMO }) {
		const copy = tempCopy(file, path.basename(file), fs.mkdtempSync(path.join(tmp, "print-content-")));
		const stripped = await stripCopy(copy);
		const a = await newPage(browser);
		await openFile(a.page, copy);
		await a.page.waitForTimeout(400);
		const reviewed = await printInnerText(a.page);
		await a.context.close();
		const b = await newPage(browser);
		await b.page.goto(pathToFileURL(stripped).href);
		await b.page.waitForTimeout(400);
		const plain = await printInnerText(b.page);
		await b.context.close();
		return { ok: reviewed.hostDisplay === "none" && reviewed.suggestedHidden && reviewed.text === plain.text, hostDisplay: reviewed.hostDisplay, suggestedHidden: reviewed.suggestedHidden, textEqual: reviewed.text === plain.text, chars: reviewed.text.length };
	},

	async pdf({ tmp, file = DEMO }) {
		const dir = fs.mkdtempSync(path.join(tmp, "pdf-"));
		const copy = tempCopy(file, path.basename(file), dir);
		const stripped = await stripCopy(copy);
		const reviewedPages = await pdfPages(copy, path.join(dir, "reviewed.pdf"));
		const strippedPages = await pdfPages(stripped, path.join(dir, "stripped.pdf"));
		return { ok: reviewedPages > 0 && reviewedPages === strippedPages, reviewedPages, strippedPages };
	},

	async dark({ browser, out }) {
		const shots = {};
		for (const scheme of ["light", "dark"]) {
			const { context, page } = await newPage(browser, { colorScheme: scheme });
			await openFile(page, DEMO);
			await page.evaluate(theme => document.documentElement.setAttribute("data-theme", theme), scheme);
			await page.evaluate(() => window.__VPK_REVIEW__.open("comments"));
			await page.waitForTimeout(400);
			shots[scheme] = path.join(out, `drawer-${scheme}.png`);
			await page.screenshot({ path: shots[scheme] });
			await context.close();
		}
		return { ok: Object.values(shots).every(file => fs.statSync(file).size > 10000), shots };
	},

	async nostorage({ browser }) {
		const html = fs.readFileSync(DEMO, "utf8");
		const blank = await newPage(browser);
		await blank.page.goto("about:blank");
		await blank.page.setContent(html, { waitUntil: "load" });
		await blank.page.waitForFunction(() => window.__VPK_REVIEW__, null, { timeout: 10000 });
		const blankState = await blank.page.evaluate(() => ({ debug: window.__VPK_REVIEW__.debug(), notice: document.querySelector("[data-vpk-review-ui]").shadowRoot.querySelector(".vr-notice").textContent }));
		const blankErrors = blank.page.errors.slice();
		await blank.context.close();
		const framed = await newPage(browser);
		await framed.page.setContent("<!doctype html><html><body><iframe id=f sandbox=\"allow-scripts\" style=\"width:1200px;height:800px\"></iframe></body></html>");
		await framed.page.evaluate(source => (document.getElementById("f").srcdoc = source), html);
		const frame = await (await framed.page.waitForSelector("#f")).contentFrame();
		await frame.waitForFunction(() => window.__VPK_REVIEW__, null, { timeout: 10000 });
		const frameState = await frame.evaluate(() => {
			window.__VPK_REVIEW__.setIdentity({ name: "No Store", initials: "NS" });
			window.__VPK_REVIEW__.addComment({ body: "In memory only." });
			return { debug: window.__VPK_REVIEW__.debug(), comments: window.__VPK_REVIEW__.getReview().comments.length };
		});
		const frameErrors = framed.page.errors.slice();
		await framed.context.close();
		return { ok: /storage:memory/.test(blankState.debug) && /kept only while this page is open/.test(blankState.notice) && /storage:memory/.test(frameState.debug) && blankErrors.length === 0 && frameErrors.length === 0, blankState, frameState, errors: [...blankErrors, ...frameErrors] };
	},

	async parity({ browser, file = DEMO }) {
		const { context, page } = await newPage(browser);
		await openFile(page, file);
		await page.waitForTimeout(500);
		const result = await parityCheck(page, fs.readFileSync(file, "utf8"));
		await context.close();
		return { ok: result.textEqual && result.mismatched.length === 0, ...result, mismatched: result.mismatched.slice(0, 20) };
	},

	// Below 640 px the drawer is a bottom sheet: Jump, Reveal changes and the block picker must
	// leave their target visible above it (light, and dark with reduced motion; real taps).
	async mobile({ browser, file = DEMO }) {
		const runs = [];
		for (const [theme, motion] of [["light", "no-preference"], ["dark", "reduce"]]) {
			const { context, page } = await newPage(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: theme, reducedMotion: motion });
			await openFile(page, file);
			const settle = () => page.waitForTimeout(motion === "reduce" ? 200 : 900);
			const view = () => page.evaluate(() => {
				const root = document.querySelector("[data-vpk-review-ui]").shadowRoot;
				const box = (node) => (node ? { top: Math.round(node.getBoundingClientRect().top), bottom: Math.round(node.getBoundingClientRect().bottom) } : null);
				const shown = (selector) => [...root.querySelectorAll(selector)].find((node) => node.getClientRects().length);
				const active = [...((window.CSS && CSS.highlights && CSS.highlights.get("vpk-review-active")) || [])][0];
				return { sheet: Math.round(root.querySelector("#vr-drawer").getBoundingClientRect().top), active: box(active), changed: box(shown(".vr-outline-one")), pick: box(shown(".vr-outline-pick")), scrollY: Math.round(scrollY) };
			});
			const above = (rect, sheet) => !!rect && rect.top >= 0 && rect.top < sheet - 16;
			await page.locator(".vr-launcher").tap();
			await page.locator(".vr-thread[data-id='c_mgm1a002_demo0002'] button", { hasText: /^Jump$/ }).tap();
			await settle();
			const jump = await view();
			await page.locator("#vr-tab-changes").tap();
			await page.locator("#vr-panel-changes button", { hasText: /^Reveal changes$/ }).tap();
			await settle();
			const reveal = await view();
			await page.locator("#vr-tab-comments").tap();
			await page.locator("#vr-panel-comments button", { hasText: /^Comment on a block$/ }).tap();
			await settle();
			const picker = await view();
			const ok = above(jump.active, jump.sheet) && above(reveal.changed, reveal.sheet) && above(picker.pick, picker.sheet);
			runs.push({ theme, motion, ok, jump, reveal, picker, errors: page.errors.slice() });
			await context.close();
		}
		return { ok: runs.every((run) => run.ok && run.errors.length === 0), runs };
	},

	// Without CSS.highlights the marks are drawn in a fixed layer above the page: the quote's glyph
	// pixels must survive (>= 90% keep 70% of their distance from the background), plain and active.
	async overlay({ browser, file = DEMO, out }) {
		const QUOTE = "The read cursor update is fire-and-forget";
		const runs = [];
		for (const scheme of ["light", "dark"]) {
			const { context, page } = await newPage(browser, { colorScheme: scheme, reducedMotion: "reduce" });
			await page.addInitScript(() => Object.defineProperty(CSS, "highlights", { value: undefined, configurable: true }));
			await openFile(page, file);
			const measure = async (name) => {
				const clip = await page.evaluate(text => {
					const walker = document.createTreeWalker(document.querySelector("main"), NodeFilter.SHOW_TEXT);
					for (let node = walker.nextNode(); node; node = walker.nextNode()) {
						const at = node.nodeValue.indexOf(text);
						if (at < 0) continue;
						const range = document.createRange();
						range.setStart(node, at);
						range.setEnd(node, at + text.length);
						const box = range.getClientRects()[0];
						return { x: Math.max(0, box.x - 2), y: Math.max(0, box.y - 2), width: box.width + 4, height: box.height + 4 };
					}
					return null;
				}, QUOTE);
				const layer = hidden => page.evaluate(value => { for (const node of document.querySelector("[data-vpk-review-ui]").shadowRoot.querySelectorAll(".vr-layer")) node.style.visibility = value ? "hidden" : ""; }, hidden);
				const luminance = async () => page.evaluate(async src => {
					const image = new Image();
					image.src = `data:image/png;base64,${src}`;
					await image.decode();
					const canvas = Object.assign(document.createElement("canvas"), { width: image.width, height: image.height });
					const context2d = canvas.getContext("2d");
					context2d.drawImage(image, 0, 0);
					const data = context2d.getImageData(0, 0, canvas.width, canvas.height).data;
					const lin = v => (v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
					const values = [];
					for (let index = 0; index < data.length; index += 4) values.push(0.2126 * lin(data[index]) + 0.7152 * lin(data[index + 1]) + 0.0722 * lin(data[index + 2]));
					return values;
				}, (await page.screenshot({ clip })).toString("base64"));
				const marks = await page.evaluate(() => document.querySelector("[data-vpk-review-ui]").shadowRoot.querySelectorAll(".vr-mark").length);
				const shown = await luminance();
				await page.screenshot({ path: path.join(out, `overlay-${scheme}-${name}.png`), clip: { x: Math.max(0, clip.x - 40), y: Math.max(0, clip.y - 20), width: clip.width + 80, height: clip.height + 40 } });
				await layer(true);
				const bare = await luminance();
				await layer(false);
				const median = list => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
				const [bgBare, bgShown] = [median(bare), median(shown)];
				const peak = Math.max(...bare.map(value => Math.abs(value - bgBare)));
				let glyphs = 0;
				let kept = 0;
				bare.forEach((value, index) => {
					const was = value - bgBare;
					if (Math.abs(was) < peak * 0.35) return;
					glyphs++;
					const now = shown[index] - bgShown;
					if (Math.sign(now) === Math.sign(was) && Math.abs(now) >= Math.abs(was) * 0.7) kept++;
				});
				return { marks, glyphs, kept: glyphs ? Number((kept / glyphs).toFixed(3)) : 0 };
			};
			await page.evaluate(text => [...document.querySelectorAll("main p")].find(node => node.textContent.includes(text)).scrollIntoView({ block: "center" }), QUOTE);
			await page.waitForTimeout(300);
			const plain = await measure("plain");
			await page.locator(".vr-launcher").click();
			await page.locator(".vr-thread[data-id='c_mgm1a002_demo0002'] button", { hasText: /^Jump$/ }).click();
			await page.waitForTimeout(400);
			const active = await measure("active");
			const ok = plain.marks > 0 && plain.kept >= 0.9 && active.kept >= 0.9 && page.errors.length === 0;
			runs.push({ scheme, ok, plain, active, errors: page.errors.slice() });
			await context.close();
		}
		return { ok: runs.every(run => run.ok), runs };
	},

	// layout, owner, reattach, meter, xthread, engines (review-e2e-m2.mjs).
	...M2_SCENARIOS,
};

export async function runScenarios(names, { out }) {
	fs.mkdirSync(out, { recursive: true });
	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-review-e2e-"));
	const browser = await launchBrowser();
	const results = [];
	try {
		for (const name of names) {
			const started = Date.now();
			let result;
			try {
				result = await SCENARIOS[name]({ browser, out, tmp });
			} catch (error) {
				result = { ok: false, error: error && error.stack ? error.stack.split("\n").slice(0, 4).join(" | ") : String(error) };
			}
			result.ms = Date.now() - started;
			results.push({ name, ...result });
			console.log(`${result.ok ? "PASS" : "FAIL"} ${name}${result.skipped ? ` (skipped: ${result.skipped})` : ""} · ${result.ms} ms`);
			if (!result.ok) console.log(`  ${JSON.stringify(result).slice(0, 1200)}`);
		}
	} finally {
		await browser.close();
	}
	fs.writeFileSync(path.join(out, "results.json"), `${JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2)}\n`);
	return results;
}

async function main() {
	const argv = process.argv.slice(2);
	const pick = (flag, fallback) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : fallback);
	const wanted = pick("--scenario", "all");
	const names = wanted === "all" ? Object.keys(SCENARIOS) : wanted.split(",");
	const unknown = names.filter(name => !SCENARIOS[name]);
	if (unknown.length) {
		console.error(`unknown scenario: ${unknown.join(", ")} (known: ${Object.keys(SCENARIOS).join(", ")})`);
		process.exitCode = 1;
		return;
	}
	const results = await runScenarios(names, { out: path.resolve(pick("--out", "output/vpk-html-v2/review-e2e")) });
	if (results.some(result => !result.ok)) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
