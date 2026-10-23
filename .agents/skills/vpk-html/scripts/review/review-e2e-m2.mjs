/*
 * review/review-e2e-m2: the M2 and P3 document scenarios of review-e2e.mjs (ws1 §8 E2E, §9 M2):
 * layout (Layout tab, Add as comment, --check-layout), owner (Owner mode, Resolve all addressed),
 * reattach (Re-attach for orphans), meter (storage meter, Clear this document), xthread (comments on
 * runtime-rendered posts, `--review` reads runtime, M2 `--review --browser` equals resolutions()) and
 * engines (comments on the figure-engine roots of demo-figure-engines). Registered into SCENARIOS by
 * review-e2e.mjs; run through that harness (unsandboxed: Chromium, writes under a temp folder).
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ANA, DEMO, FIXTURES, SKILL, cli, flush, newPage, openFile, printInnerText, selectQuote, tempCopy } from "./review-e2e-core.mjs";

const BUILD = path.join(SKILL, "scripts/build.mjs");
const UI = "document.querySelector('[data-vpk-review-ui]').shadowRoot";

function build(args) {
	const run = spawnSync(process.execPath, [BUILD, ...args], { encoding: "utf8", env: { ...process.env, OPENSSL_CONF: "/dev/null" } });
	return { code: run.status, out: `${run.stdout || ""}${run.stderr || ""}` };
}

async function identify(page, who) {
	await page.evaluate(person => window.__VPK_REVIEW__.setIdentity(person), who);
}

async function tabCounts(page) {
	return page.evaluate(`(() => { const root = ${UI}; return { threads: root.querySelectorAll('.vr-panel:not([hidden]) .vr-thread').length, text: (root.querySelector('.vr-panel:not([hidden])') || {}).textContent || '' }; })()`);
}

export const M2_SCENARIOS = {
	// M2 Layout: the overflow fixture gives findings, Add as comment makes a kind:"layout" comment,
	// --check-layout prints `- <string>` lines and --strict exits 1.
	async layout({ browser, tmp }) {
		const dir = fs.mkdtempSync(path.join(tmp, "layout-"));
		const file = tempCopy(path.join(FIXTURES, "layout-overflow.html"), "layout.html", dir);
		await cli(["--inject-review", file, "--seed", "e2e-layout"]);
		const { context, page } = await newPage(browser, { viewport: { width: 1280, height: 800 } });
		await openFile(page, file);
		await identify(page, ANA);
		await page.evaluate(() => window.__VPK_REVIEW__.open("layout"));
		const idle = await tabCounts(page);
		await page.locator(".vr-btn", { hasText: "Check this page" }).click();
		await page.waitForTimeout(300);
		const found = await page.evaluate(`[...${UI}.querySelectorAll('.vr-panel:not([hidden]) .vr-thread .vr-name')].map(node => node.textContent)`);
		const clipped = page.locator(".vr-panel:not([hidden]) .vr-thread", { hasText: "clipped-text" });
		await clipped.locator(".vr-btn", { hasText: "Add as comment" }).click();
		const area = page.locator(".vr-composer textarea[aria-label='Comment']");
		await area.waitFor({ state: "visible", timeout: 5000 });
		const prefill = await area.inputValue();
		await area.press("Control+Enter");
		await page.waitForFunction(() => window.__VPK_REVIEW__.getReview().comments.some(comment => comment.kind === "layout"), null, { timeout: 5000 });
		await flush(page);
		const comment = await page.evaluate(() => window.__VPK_REVIEW__.getReview().comments.find(entry => entry.kind === "layout"));
		await page.reload();
		await page.waitForFunction(() => window.__VPK_REVIEW__, null, { timeout: 10000 });
		const kept = await page.evaluate(() => window.__VPK_REVIEW__.getReview().comments.filter(entry => entry.kind === "layout").length);
		await page.evaluate(() => window.__VPK_REVIEW__.open("layout"));
		const afterReload = await tabCounts(page);
		const reviewFile = path.join(dir, "review.json");
		fs.writeFileSync(reviewFile, JSON.stringify(await page.evaluate(() => window.__VPK_REVIEW__.exportReview({ scope: "all" })), null, 2));
		await context.close();
		const tasksFile = path.join(dir, "tasks.json");
		await cli(["--review", reviewFile, file, "--format", "json", "--out", tasksFile]);
		const task = JSON.parse(fs.readFileSync(tasksFile, "utf8")).tasks.find(entry => entry.type === "layout");
		const strict = build(["--check-layout", path.join(FIXTURES, "layout-overflow.html"), "--strict"]);
		const clean = build(["--check-layout", DEMO]);
		const lines = strict.out.split("\n").filter(line => /^\s+- /.test(line));
		const ok = idle.threads === 0 && ["page-horizontal-overflow", "clipped-text", "overlapping-text"].every(rule => found.includes(rule))
			&& /clipped-text/.test(prefill) && comment && comment.layout.rule === "clipped-text" && comment.layout.viewportWidth === 1280 && Boolean(comment.anchor)
			&& kept === 1 && afterReload.threads === 0 && task && task.rule === "clipped-text"
			&& strict.code === 1 && lines.length >= 3 && !/\[object Object\]/.test(strict.out) && clean.code === 0 && /clean/.test(clean.out)
			&& page.errors.length === 0;
		return { ok, idle: idle.threads, found, prefill, layout: comment && comment.layout, kept, afterReload: afterReload.threads, task: task && task.rule, strictExit: strict.code, lines, cleanExit: clean.code, errors: page.errors };
	},

	// M2 Owner mode: "Resolve all addressed" resolves exactly the addressed set.
	async owner({ browser, tmp }) {
		const dir = fs.mkdtempSync(path.join(tmp, "owner-"));
		const file = tempCopy(path.join(FIXTURES, "basic.html"), "doc.html", dir);
		await cli(["--inject-review", file, "--seed", "e2e-owner"]);
		const { context, page } = await newPage(browser);
		await openFile(page, file);
		await identify(page, ANA);
		const ids = await page.evaluate(() => {
			const api = window.__VPK_REVIEW__;
			return { one: api.addComment({ quote: "retries three times", body: "Five?" }), two: api.addComment({ quote: "Undo for the last move", body: "Say how many moves." }), three: api.addComment({ quote: "Fourth quarter of 2026", body: "Name the quarter in full." }), done: api.addComment({ quote: "Rollout starts with internal teams", body: "Already settled." }) };
		});
		await page.evaluate(done => { const api = window.__VPK_REVIEW__; const review = api.getReview(); api.importReview({ ...review, comments: review.comments.map(comment => (comment.id === done ? { ...comment, status: "resolved", statusAt: new Date().toISOString() } : comment)) }); }, ids.done);
		await flush(page);
		fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("retries three times", "retries five times").replace("Undo for the last move", "Undo for the last two moves"));
		await cli(["--stamp", file, "--revision-label", "Copy fixes", "--addresses", `${ids.one},${ids.two}`]);
		await openFile(page, file);
		await page.waitForTimeout(300);
		const status = () => page.evaluate(() => Object.fromEntries(window.__VPK_REVIEW__.getReview().comments.map(comment => [comment.id, comment.status])));
		const before = await status();
		await page.evaluate(() => window.__VPK_REVIEW__.open("share"));
		const hiddenBefore = await page.locator(".vr-resolve-all").count();
		await page.locator(".vr-owner-toggle").click();
		const summary = await page.evaluate(`${UI}.querySelector('.vr-panel:not([hidden]) [aria-label="Owner tools"] .vr-where').textContent`);
		const embed = await page.evaluate(`${UI}.querySelector('.vr-panel:not([hidden]) [aria-label="Owner tools"]').textContent`);
		const importInside = await page.locator("[aria-label='Owner tools'] input[aria-label='Import review files']").count();
		await page.locator(".vr-resolve-all").click();
		await page.waitForTimeout(300);
		const after = await status();
		const second = await page.locator(".vr-resolve-all").isDisabled();
		await page.evaluate(() => window.__VPK_REVIEW__.open("comments"));
		const reloaded = await (async () => { await flush(page); await page.reload(); await page.waitForFunction(() => window.__VPK_REVIEW__, null, { timeout: 10000 }); return status(); })();
		await context.close();
		const resolved = Object.keys(after).filter(id => after[id] === "resolved").sort();
		const expected = [ids.one, ids.two, ids.done].sort();
		const ok = hiddenBefore === 0 && before[ids.one] === "open" && before[ids.three] === "open" && before[ids.done] === "resolved"
			&& JSON.stringify(resolved) === JSON.stringify(expected) && after[ids.three] === "open" && second
			&& /2 addressed/.test(summary) && /embed-review/.test(embed) && importInside === 1
			&& JSON.stringify(Object.keys(reloaded).filter(id => reloaded[id] === "resolved").sort()) === JSON.stringify(expected)
			&& page.errors.length === 0;
		return { ok, before, after, expected, summary, importInside, secondDisabled: second, errors: page.errors };
	},

	// M2 Re-attach: an orphaned thread takes a new text anchor (select + C) or a block (picker + Enter),
	// resolves exact, and keeps that after a reload.
	async reattach({ browser, tmp }) {
		const dir = fs.mkdtempSync(path.join(tmp, "reattach-"));
		const file = tempCopy(path.join(FIXTURES, "basic.html"), "doc.html", dir);
		await cli(["--inject-review", file, "--seed", "e2e-reattach"]);
		const { context, page } = await newPage(browser);
		await openFile(page, file);
		await identify(page, ANA);
		const ids = await page.evaluate(() => {
			const api = window.__VPK_REVIEW__;
			const block = [...document.querySelectorAll("p[data-vpk-id]")].find(el => el.textContent.includes("will be deleted entirely")).getAttribute("data-vpk-id");
			return { text: api.addComment({ quote: "This paragraph will be deleted entirely", body: "Text anchor." }), block: api.addComment({ blockId: block, body: "Block anchor." }) };
		});
		await flush(page);
		fs.writeFileSync(file, fs.readFileSync(path.join(FIXTURES, "edited.html"), "utf8"));
		await cli(["--stamp", file, "--revision-label", "Edits"]);
		await openFile(page, file);
		await page.waitForTimeout(300);
		const statuses = () => page.evaluate(() => Object.fromEntries(window.__VPK_REVIEW__.resolutions().map(entry => [entry.commentId, entry.status])));
		const orphaned = await statuses();
		await page.evaluate(() => window.__VPK_REVIEW__.open("comments"));
		await page.locator(".vr-chip-btn", { hasText: "Orphaned" }).click();
		const buttons = await page.locator(".vr-thread .vr-btn", { hasText: "Re-attach" }).count();
		// Text anchor: Re-attach, select other text on the page, press C.
		const textRow = page.locator(`.vr-thread[data-id="${ids.text}"]`);
		await textRow.locator(".vr-btn", { hasText: "Re-attach" }).click();
		const prompt = await textRow.textContent();
		await selectQuote(page, "Alpha teams try it first.");
		// A reviewer selecting with the pointer leaves the drawer control; C acts from the page.
		await page.evaluate(() => document.querySelector("[data-vpk-review-ui]").shadowRoot.activeElement?.blur());
		await page.waitForTimeout(250);
		await page.keyboard.press("c");
		await page.waitForTimeout(300);
		const afterText = await statuses();
		const composerOpened = await page.locator(".vr-composer").count();
		// Block anchor: Re-attach, Pick a block, Home, Enter (keyboard only).
		await page.locator(".vr-chip-btn", { hasText: "Orphaned" }).click();
		const blockRow = page.locator(`.vr-thread[data-id="${ids.block}"]`);
		await blockRow.locator(".vr-btn", { hasText: "Re-attach" }).click();
		await blockRow.locator(".vr-btn", { hasText: "Pick a block" }).click();
		await page.keyboard.press("Home");
		await page.keyboard.press("Enter");
		await page.waitForTimeout(300);
		const afterBlock = await statuses();
		const anchors = await page.evaluate(() => Object.fromEntries(window.__VPK_REVIEW__.getReview().comments.map(comment => [comment.id, { quote: comment.anchor && comment.anchor.quote ? comment.anchor.quote.exact : null, anchorAt: comment.anchorAt || null, kind: comment.kind }])));
		await flush(page);
		await page.reload();
		await page.waitForFunction(() => window.__VPK_REVIEW__, null, { timeout: 10000 });
		const reloaded = await statuses();
		// Cancel leaves the anchor alone.
		await page.evaluate(() => window.__VPK_REVIEW__.open("comments"));
		await context.close();
		const ok = orphaned[ids.text] === "orphaned" && orphaned[ids.block] === "orphaned" && buttons === 2 && /Select the text this comment belongs to/.test(prompt)
			&& afterText[ids.text] === "exact" && afterText[ids.block] === "orphaned" && composerOpened === 0
			&& afterBlock[ids.block] === "exact" && reloaded[ids.text] === "exact" && reloaded[ids.block] === "exact"
			&& anchors[ids.text].quote === "Alpha teams try it first." && Boolean(anchors[ids.text].anchorAt) && Boolean(anchors[ids.block].anchorAt)
			&& page.errors.length === 0;
		return { ok, orphaned, afterText, afterBlock, reloaded, buttons, composerOpened, anchors, errors: page.errors };
	},

	// M2 storage meter: usage numbers, and "Clear this document" removes only this document's keys.
	async meter({ browser, tmp }) {
		const dir = fs.mkdtempSync(path.join(tmp, "meter-"));
		const first = tempCopy(path.join(FIXTURES, "basic.html"), "one.html", dir);
		const second = tempCopy(path.join(FIXTURES, "basic.html"), "two.html", dir);
		await cli(["--inject-review", first, "--seed", "e2e-meter-1", "--new-doc-id", "--no-ledger"]);
		await cli(["--inject-review", second, "--seed", "e2e-meter-2", "--new-doc-id", "--no-ledger"]);
		const { context, page } = await newPage(browser);
		const keys = () => page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("vpk-review/1/")).sort());
		await openFile(page, second);
		await identify(page, ANA);
		const secondId = await page.evaluate(() => window.__VPK_REVIEW__.docId);
		await page.evaluate(() => window.__VPK_REVIEW__.addComment({ quote: "retries three times", body: "Other doc comment." }));
		await flush(page);
		await openFile(page, first);
		const firstId = await page.evaluate(() => window.__VPK_REVIEW__.docId);
		await page.evaluate(() => window.__VPK_REVIEW__.addComment({ quote: "retries three times", body: "This doc comment." }));
		await flush(page);
		const before = await keys();
		await page.evaluate(() => window.__VPK_REVIEW__.open("share"));
		const meterText = await page.evaluate(`${UI}.querySelector('.vr-panel:not([hidden])').textContent`);
		const meterNode = await page.locator("meter[aria-label]").count();
		await page.locator(".vr-clear-open").click();
		const confirm = await page.locator(".vr-clear-box").textContent();
		await page.locator(".vr-clear-box .vr-btn", { hasText: "Cancel" }).click();
		const stillThere = await page.evaluate(id => localStorage.getItem(`vpk-review/1/doc/${id}`) !== null, firstId);
		await page.locator(".vr-clear-open").click();
		await page.locator(".vr-clear-box .vr-primary").click();
		await page.waitForTimeout(300);
		const after = await keys();
		const index = await page.evaluate(() => JSON.parse(localStorage.getItem("vpk-review/1/index") || "{}"));
		const live = await page.evaluate(() => window.__VPK_REVIEW__.getReview().comments.length);
		const otherKept = await page.evaluate(id => (JSON.parse(localStorage.getItem(`vpk-review/1/doc/${id}`) || "{}").comments || []).length, secondId);
		const text = await page.evaluate(`${UI}.querySelector('.vr-panel:not([hidden])').textContent`);
		await context.close();
		const ok = before.includes(`vpk-review/1/doc/${firstId}`) && before.includes(`vpk-review/1/doc/${secondId}`)
			&& /2 reviewed documents/.test(meterText) && meterNode === 1 && /Comments embedded in the file stay/.test(confirm) && stillThere
			&& !after.includes(`vpk-review/1/doc/${firstId}`) && after.includes(`vpk-review/1/doc/${secondId}`) && after.includes("vpk-review/1/identity")
			&& !after.includes(`vpk-review/1/seen/${firstId}`) && !(firstId in index) && secondId in index && live === 0 && otherKept === 1
			&& /Cleared|Clear this document/.test(text) && page.errors.length === 0;
		return { ok, before, after, meterText: meterText.slice(-160), index: Object.keys(index), live, otherKept, errors: page.errors };
	},

	// x-thread: comments on runtime-rendered posts follow an edit; --review reads `runtime`, and
	// M2 --review --browser gives the statuses the runtime itself reports.
	async xthread({ browser, tmp }) {
		const dir = fs.mkdtempSync(path.join(tmp, "xthread-"));
		const file = tempCopy(path.join(SKILL, "assets/demos/demo-x-thread.html"), "xthread.html", dir);
		await cli(["--inject-review", file, "--seed", "e2e-xthread"]);
		const { context, page } = await newPage(browser);
		await openFile(page, file);
		await page.waitForSelector("[data-vpk-id=xtpost2]", { timeout: 10000 });
		await identify(page, ANA);
		const ids = await page.evaluate(() => {
			const api = window.__VPK_REVIEW__;
			return { quote: api.addComment({ quote: "replay in order when you reconnect", body: "Say how long the queue holds." }), block: api.addComment({ blockId: "xtpost3", body: "Link the benchmark methodology." }) };
		});
		// The quote's own line box and the pin of its comment: the pin sits on the quote's line.
		const place = () => page.evaluate(id => {
			const pin = document.querySelector("[data-vpk-review-ui]").shadowRoot.querySelector(`.vr-pin[data-id="${id}"]`);
			const walker = document.createTreeWalker(document.querySelector("[data-vpk-id=xtpost2]"), NodeFilter.SHOW_TEXT);
			let line = null;
			for (let node = walker.nextNode(); node; node = walker.nextNode()) {
				const at = node.nodeValue.indexOf("replay in order");
				if (at < 0) continue;
				const range = document.createRange();
				range.setStart(node, at);
				range.setEnd(node, at + 15);
				line = range.getBoundingClientRect();
			}
			const box = pin ? pin.getBoundingClientRect() : null;
			return { highlights: CSS.highlights ? CSS.highlights.size : -1, quoteShown: Boolean(line && line.height > 0), pinOnQuote: Boolean(box && line && line.height > 0 && Math.abs(box.top - line.top) < 32), status: window.__VPK_REVIEW__.resolutions().find(entry => entry.commentId === id).status };
		}, ids.quote);
		await page.waitForTimeout(400);
		const beforeEdit = await place();
		// Edit post 2 through the page's own editor: the island text changes and the posts re-render.
		await page.locator("[data-vpk-id=xtpost2] [data-action=edit]").first().click();
		const editor = page.locator("#xt-edit-p2");
		await editor.fill((await editor.inputValue()).replace("Offline sync first.", "Offline sync comes first now."));
		await editor.blur();
		await page.waitForFunction(() => /rendered:x-thread/.test(window.__VPK_REVIEW__.debug()), null, { timeout: 5000 });
		// Leave edit mode (the text is shown again); the highlight and pin follow the re-rendered post.
		await page.locator("[data-vpk-id=xtpost2] [data-action=edit]").first().click();
		await page.waitForTimeout(600);
		const afterEdit = await place();
		const rendered = await page.evaluate(() => window.__VPK_REVIEW__.debug());
		await flush(page);
		const reviewFile = path.join(dir, "review.json");
		fs.writeFileSync(reviewFile, JSON.stringify(await page.evaluate(() => window.__VPK_REVIEW__.exportReview({ scope: "all" })), null, 2));
		await context.close();
		// The runtime's own statuses on a fresh load of the file (the edit lives only in that session).
		const fresh = await newPage(browser);
		await openFile(fresh.page, file);
		await fresh.page.waitForSelector("[data-vpk-id=xtpost2]", { timeout: 10000 });
		await fresh.page.waitForTimeout(400);
		const runtime = await fresh.page.evaluate(review => Object.fromEntries(window.__VPK_REVIEW__.resolveAll(review).map(entry => [entry.commentId, entry.status])), JSON.parse(fs.readFileSync(reviewFile, "utf8")));
		await fresh.context.close();
		const staticFile = path.join(dir, "static.json");
		const browserFile = path.join(dir, "browser.json");
		await cli(["--review", reviewFile, file, "--format", "json", "--out", staticFile]);
		await cli(["--review", reviewFile, file, "--format", "json", "--browser", "--out", browserFile]);
		const statusOf = (target, id) => JSON.parse(fs.readFileSync(target, "utf8")).tasks.find(task => task.commentId === id)?.anchorStatus;
		const fixed = { quote: statusOf(staticFile, ids.quote), block: statusOf(staticFile, ids.block) };
		const live = { quote: statusOf(browserFile, ids.quote), block: statusOf(browserFile, ids.block) };
		const { runReviewCli } = await import("./cli.mjs");
		const failed = [];
		const code = await runReviewCli(["--review", reviewFile, file, "--browser"], { out: line => failed.push(line), err: line => failed.push(line), raw: () => {}, launch: async () => { throw new Error("no chromium here"); } });
		const ok = beforeEdit.status === "exact" && beforeEdit.pinOnQuote && ["exact", "fuzzy"].includes(afterEdit.status) && afterEdit.highlights > 0 && afterEdit.quoteShown && afterEdit.pinOnQuote && /rendered:x-thread/.test(rendered)
			&& fixed.quote === "runtime" && fixed.block === "runtime"
			&& live.quote === runtime[ids.quote] && live.block === runtime[ids.block] && live.quote === "exact" && live.block === "exact"
			&& code === 1 && /--browser needs Chromium/.test(failed.join("\n")) && page.errors.length === 0 && fresh.page.errors.length === 0;
		return { ok, beforeEdit, afterEdit, rendered, static: fixed, browser: live, runtime, failExit: code, failMessage: failed.join(" ").slice(0, 160), errors: [...page.errors, ...fresh.page.errors] };
	},

	// demo-figure-engines: block comments on each engine root, pins that track under scroll while the
	// engines animate, the stamped copy still passes the engine gates, arrows stay with the iso stage,
	// and print hides the review UI.
	async engines({ browser, tmp }) {
		const dir = fs.mkdtempSync(path.join(tmp, "engines-"));
		const source = path.join(SKILL, "assets/demos/demo-figure-engines.html");
		const file = tempCopy(source, "engines.html", dir);
		await cli(["--inject-review", file, "--seed", "e2e-engines"]);
		const gates = { source: build(["--check-figures", source, "--strict"]), injected: build(["--check-figures", file, "--strict"]) };
		const { context, page } = await newPage(browser);
		await openFile(page, file);
		await page.waitForTimeout(1500);
		await identify(page, ANA);
		const roots = await page.evaluate(() => [...document.querySelectorAll("[data-vpk-engine][data-vpk-id]")].map(el => el.getAttribute("data-vpk-id")));
		const added = await page.evaluate(list => list.map((id, at) => window.__VPK_REVIEW__.addComment({ blockId: id, body: `Engine ${at + 1} note.` })), roots);
		await page.evaluate(() => window.__VPK_REVIEW__.open("comments"));
		await page.waitForTimeout(500);
		// Each pin sits on its engine root, before and after scrolling, while the shared rAF loop runs.
		const track = () => page.evaluate(list => {
			const root = document.querySelector("[data-vpk-review-ui]").shadowRoot;
			return list.map(id => {
				const box = document.querySelector(`[data-vpk-id="${id}"]`).getBoundingClientRect();
				const pins = [...root.querySelectorAll(".vr-pin")].map(pin => pin.getBoundingClientRect()).filter(rect => rect.width > 0);
				const near = pins.some(rect => rect.left <= box.right + 48 && rect.right >= box.left - 48 && rect.top <= box.bottom + 48 && rect.bottom >= box.top - 48);
				return { id, visible: box.bottom > 0 && box.top < innerHeight, near };
			});
		}, roots);
		const tracked = [];
		for (const target of roots) {
			for (const offset of [0, 140, 420]) {
				await page.evaluate(([id, shift]) => { const box = document.querySelector(`[data-vpk-id="${id}"]`).getBoundingClientRect(); scrollBy(0, box.top - 120 + shift); }, [target, offset]);
				await page.waitForTimeout(350);
				tracked.push((await track()).find(entry => entry.id === target));
			}
		}
		await page.evaluate(() => window.__VPK_REVIEW__.close());
		// Arrows on the focused iso stage stay with the hero: no picker, no composer, no page scroll.
		const stage = page.locator(".iso-stage");
		await stage.scrollIntoViewIfNeeded();
		await stage.focus();
		const read = () => page.evaluate(() => ({ now: document.querySelector(".iso-stage").getAttribute("aria-valuenow"), scrollY: Math.round(scrollY), hash: location.hash, picker: window.__VPK_REVIEW__.debug().includes("picker:on"), composer: !!document.querySelector("[data-vpk-review-ui]").shadowRoot.querySelector(".vr-composer") }));
		const before = await read();
		await page.keyboard.press("ArrowRight");
		await page.waitForTimeout(200);
		await page.keyboard.press("c");
		await page.waitForTimeout(200);
		const arrowed = await read();
		const printed = await printInnerText(page);
		await context.close();
		const trackedOk = tracked.length === roots.length * 3 && tracked.every(entry => entry.near);
		const ok = roots.length >= 2 && added.length === roots.length && trackedOk && gates.source.code === 0 && gates.injected.code === gates.source.code
			&& arrowed.now !== before.now && !arrowed.picker && !arrowed.composer && arrowed.scrollY === before.scrollY && arrowed.hash === before.hash
			&& printed.hostDisplay === "none" && page.errors.length === 0;
		return { ok, roots, tracked, gates: { source: gates.source.code, injected: gates.injected.code, injectedOut: gates.injected.code === 0 ? "" : gates.injected.out.slice(0, 200) }, before, arrowed, hostDisplay: printed.hostDisplay, errors: page.errors };
	},
};
