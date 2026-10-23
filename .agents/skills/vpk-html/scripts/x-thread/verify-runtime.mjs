// T7 (ws5-xthread): Chromium smoke for an x-thread page. Node-only; not a *.test.* file, so the
// sandboxed unit gate never launches a browser. Run unsandboxed:
//
//   node .agents/skills/vpk-html/scripts/x-thread.mjs verify <artifact.html> [--out <dir>]
//
// Every http(s) request is aborted and counted (the page itself must make none). Intent links
// are clicked like a user would: each click opens one popup whose x.com request is aborted, and
// the popup is closed; synthetic post links are then pasted. Nothing reaches x.com.
// Playwright is imported directly (integration R23).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildIntentUrl } from "./thread-model.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..", "..", "..", "..");
const THREAD_MD = path.join(HERE, "fixtures", "thread.md");
const EXPECTED = path.join(HERE, "fixtures", "thread.expected.json");

async function openPage(browser, url, options, session) {
	const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options });
	await context.route(/^https?:/, route => { session.network.push(route.request().url()); return route.abort(); });
	const page = await context.newPage();
	page.on("pageerror", error => session.errors.push(`pageerror: ${error.message}`));
	page.on("console", message => { if (message.type() === "error") session.errors.push(`console.error: ${message.text()}`); });
	page.on("dialog", dialog => dialog.accept());
	await page.goto(url, { waitUntil: "load" });
	await page.waitForTimeout(400);
	return { context, page };
}

const order = page => page.$$eval("#xt-posts > li", items => items.map(li => li.getAttribute("data-post-id")).join(","));
const action = (page, id, name) => page.locator(`li[data-post-id="${id}"] [data-action="${name}"]`);
const textOf = (page, selector) => page.locator(selector).first().innerText();

async function demoFlow(browser, url, session, check, outDir) {
	const { context, page } = await openPage(browser, url, { colorScheme: "light" }, session);
	const { verifyRegisteredFonts } = await import("../font-faces.mjs");
	const fonts = await verifyRegisteredFonts(page);
	check("fonts load", fonts.every(font => font.loaded), fonts.filter(font => !font.loaded).map(font => font.family).join(", "));
	// B3 decision 29a: grayscale only, so a native checkbox draws the ink token, never the browser's blue accent.
	const accent = await page.evaluate(() => { const probe = document.body.appendChild(document.createElement("i")); probe.style.color = "var(--ink)"; const ink = getComputedStyle(probe).color; probe.remove(); return { ink, accents: [...document.querySelectorAll(".xt-check input")].map(node => getComputedStyle(node).accentColor) }; });
	check("checkboxes use the ink accent, not the browser blue", accent.accents.length > 0 && accent.accents.every(value => value === accent.ink), JSON.stringify(accent));
	const content = await page.evaluate(() => window.__VPK_CONTENT__["x-thread"].getContent());
	const first = content.posts[0];
	check("read mode shows post text as DOM text", (await page.locator(`li[data-post-id="${first.id}"] .xt-post__text`).textContent()) === first.text);
	await action(page, first.id, "edit").click();
	check("edit opens the editor", await page.locator(`li[data-post-id="${first.id}"] .xt-post__editor`).isVisible());
	await action(page, first.id, "edit").click();
	check("done returns to read mode", (await page.locator(`li[data-post-id="${first.id}"]`).getAttribute("data-mode")) === "read");
	await page.locator('[data-action="approve-all"]').click();
	const over = await page.$$eval(".xt-post__reason:not([hidden])", nodes => nodes.map(node => node.closest("li").getAttribute("data-post-id")));
	check("approve all blocks over-limit posts with a reason", over.length >= (content.posts.some(post => post.text.length > 280) ? 1 : 0), over.join(","));
	for (const id of over) {
		// The last sentence end that leaves the first half within 280 (ASCII posts weigh 1 per character).
		const post = content.posts.find(item => item.id === id), end = post.text.lastIndexOf(". ", 278), cut = end > 0 ? end + 2 : Math.floor(post.text.length / 2);
		await action(page, id, "edit").click();
		await page.locator(`li[data-post-id="${id}"] .xt-post__editor`).evaluate((editor, at) => editor.setSelectionRange(at, at), cut);
		await action(page, id, "split").click();
	}
	const states = await page.$$eval(".xt-count", nodes => nodes.map(node => node.getAttribute("data-state")));
	check("splitting at a sentence boundary makes every post valid", !states.includes("over"), states.join(","));
	await page.locator('[data-action="approve-all"]').click();
	const total = await page.locator("#xt-posts > li").count();
	check("approve all then approves every post", (await page.locator('#xt-posts > li[data-status="approved"]').count()) === total, `${total} posts`);
	const ids = (await order(page)).split(",");
	const moved = await page.locator(`li[data-post-id="${ids[2]}"]`).elementHandle();
	await action(page, ids[2], "move-up").click();
	check("move up reorders and reuses the element", (await order(page)).startsWith(`${ids[0]},${ids[2]},${ids[1]}`) && await page.evaluate(([node, id]) => node === document.querySelector(`li[data-post-id="${id}"]`), [moved, ids[2]]));
	// Playwright scrolls between mouse down and move when the target is off screen, which cancels
	// Chromium's drag start; a tall viewport keeps both posts in view (a harness limit, not the page's).
	await page.setViewportSize({ width: 1280, height: 3200 });
	await action(page, ids[1], "drag").dragTo(page.locator(`li[data-post-id="${ids[0]}"]`), { targetPosition: { x: 20, y: 4 } });
	await page.setViewportSize({ width: 1280, height: 900 });
	check("drag reorders", (await order(page)).startsWith(`${ids[1]},${ids[0]}`), await order(page));
	await page.setViewportSize({ width: 1280, height: 800 }); // a laptop height: the done rail is taller than the fold
	await postingFlow(page, context, session, check);
	// r2: the last record hands focus to Export JSON on screen; mid-page the stuck rail ends inside the viewport.
	const reach = () => page.evaluate(() => {
		const rail = document.querySelector(".xt-rail").getBoundingClientRect(), button = document.querySelector('#xt-queue-body [data-action="export-json"]').getBoundingClientRect();
		return { focus: document.activeElement.getAttribute("data-action"), shown: button.top >= Math.max(0, rail.top) && button.bottom <= Math.min(innerHeight, rail.bottom), railBottom: Math.round(rail.bottom), height: innerHeight };
	});
	const last = await reach();
	check("1280x800: the last record moves focus to Export JSON and scrolls it into view", last.focus === "export-json" && last.shown, JSON.stringify(last));
	await page.evaluate(() => scrollTo(0, (document.documentElement.scrollHeight - innerHeight) / 2));
	const mid = await reach();
	check("1280x800 mid-page: the stuck rail ends inside the viewport and shows Export JSON", mid.railBottom <= mid.height && mid.shown, JSON.stringify(mid));
	await page.reload({ waitUntil: "load" });
	await page.waitForTimeout(300);
	const done = await textOf(page, "#xt-queue-body strong");
	check("a reload restores the posted records", done === `${total} of ${total} posted`, done);
	const exported = await page.evaluate(() => window.__VPK_CONTENT__["x-thread"].exportState());
	check("recorded URLs survive the reload and appear in the export", Object.values(exported.state.posts).filter(entry => entry.posted?.url.startsWith("https://x.com/vpkdemo/status/")).length === total);
	await page.screenshot({ path: path.join(outDir, "posted-light.png"), fullPage: true });
	// Posted cards carry long status links; they must wrap on a phone too (not only the fresh page).
	await page.setViewportSize({ width: 375, height: 812 });
	await page.waitForTimeout(200);
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
	check("375px with every post posted: no horizontal overflow", overflow <= 1, `${overflow}px`);
	// B3 decision 29b: a long unbroken link in a banner message wraps instead of widening the page.
	const banner = await page.evaluate(() => { const node = document.getElementById("xt-banner"), was = [node.hidden, node.textContent]; node.hidden = false; node.textContent = `https://x.com/${"a".repeat(240)}`; const wide = document.documentElement.scrollWidth - window.innerWidth; [node.hidden, node.textContent] = was; return wide; });
	check("375px with a long link in the banner: no horizontal overflow", banner <= 1, `${banner}px`);
	await page.screenshot({ path: path.join(outDir, "posted-375.png"), fullPage: true });
	await context.close();
}

async function postingFlow(page, context, session, check) {
	const posted = [];
	let popups = 0;
	context.on("page", () => { popups += 1; });
	for (let n = 1; ; n += 1) {
		const link = page.locator('#xt-queue-body a[data-role="intent"]').first();
		if (!(await link.count())) break;
		const { postId, text, inReplyTo } = await page.evaluate(() => {
			const provider = window.__VPK_CONTENT__["x-thread"], exported = provider.exportState({ includeImages: false });
			const thread = exported.content.posts.filter(post => exported.state.posts[post.id]?.status !== "skipped");
			const index = thread.findIndex(post => exported.state.posts[post.id]?.status !== "posted");
			return { postId: thread[index].id, text: thread[index].text, inReplyTo: index > 0 ? exported.state.posts[thread[index - 1].id].posted.id : null };
		});
		const href = await link.getAttribute("href");
		check(`post ${n}: the intent href is buildIntentUrl(text, in_reply_to)`, href === buildIntentUrl({ text, inReplyTo }), href.slice(0, 90));
		const [popup] = await Promise.all([context.waitForEvent("page"), link.click()]);
		await popup.waitForLoadState().catch(() => {});
		await popup.close();
		const id = `18440000000000000${String(n).padStart(2, "0")}`.slice(-19);
		const input = page.locator('[data-role="posted-url"]');
		await input.waitFor();
		if (n % 2) {
			await input.fill(`https://x.com/vpkdemo/status/${id}`);
			await page.locator('[data-action="record-url"]').click();
		} else {
			await input.evaluate((node, value) => { node.value = value; node.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertFromPaste" })); }, `https://x.com/vpkdemo/status/${id}?s=46`);
		}
		posted.push({ postId, id });
		await page.waitForTimeout(50);
	}
	check("each intent needs its own click: one popup per click, none unprompted", popups === posted.length, `${popups} popups, ${posted.length} posts`);
	const exported = await page.evaluate(() => window.__VPK_CONTENT__["x-thread"].exportState({ includeImages: false }));
	const chainOk = posted.every((item, index) => exported.state.posts[item.postId].posted.id === item.id && (index === 0 ? !exported.state.posts[item.postId].posted.inReplyTo : exported.state.posts[item.postId].posted.inReplyTo === posted[index - 1].id));
	check("pasted links record the in_reply_to chain", chainOk && posted.length > 0, `${posted.length} posted`);
	check("the summary reads N of N posted", (await textOf(page, "#xt-queue-body strong")) === `${posted.length} of ${posted.length} posted`);
	session.posted = posted.length;
}

async function composerFlow(browser, url, session, check) {
	const { context, page } = await openPage(browser, url, {}, session), locked = await page.evaluate(() => Object.values(window.__VPK_CONTENT__["x-thread"].exportState().state.posts).some(entry => entry.status === "posted"));
	if (!locked) {
		await page.locator("#xt-composer summary").click();
		await page.locator("#xt-source").fill(fs.readFileSync(THREAD_MD, "utf8"));
		await page.locator('[data-action="composer-replace"]').click();
		const texts = await page.$$eval("#xt-posts .xt-post__text", nodes => nodes.map(node => node.textContent));
		check("composer: pasting thread.md gives thread.expected.json", JSON.stringify(texts) === JSON.stringify(JSON.parse(fs.readFileSync(EXPECTED, "utf8")).posts.map(post => post.text)));
		await page.locator("#xt-source").fill(Array.from({ length: 22 }, (_, i) => `${i + 1}. item ${i + 1}`).join("\n"));
		await page.locator('[data-action="composer-append"]').click(); // r3: 6 + 22 > 25 is refused whole, on screen
		check("composer: an Append past 25 posts changes nothing and says why on screen", (await page.locator("#xt-posts > li").count()) === texts.length && await page.locator("#xt-composer-preview .xt-error").getByText("Nothing was added").isVisible());
	}
	await context.close();
}

// A7 through the real file inputs: add a PNG to a valid post without media, then fill a planned slot.
const PNG_1PX = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
async function mediaFlow(browser, url, session, check) {
	const { context, page } = await openPage(browser, url, {}, session);
	const { threadId, posts } = await page.evaluate(() => {
		const exported = window.__VPK_CONTENT__["x-thread"].exportState({ includeImages: false });
		return { threadId: exported.source.threadId, posts: exported.content.posts.map(post => ({ id: post.id, media: post.media || [], valid: exported.counts[post.id]?.valid, status: exported.state.posts[post.id]?.status || "draft" })) };
	});
	const png = { name: "shot.png", mimeType: "image/png", buffer: Buffer.from(PNG_1PX, "base64") }, open = post => post.status !== "posted" && post.status !== "skipped";
	const at = posts.findIndex(post => open(post) && post.valid && !post.media.length);
	if (at >= 0) {
		const { id } = posts[at], card = page.locator(`li[data-post-id="${id}"]`), name = `${threadId}-post-${String(at + 1).padStart(2, "0")}-1.png`;
		await card.locator('input[data-role="media-input"]:not([data-index])').setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
		check("media: a non-image file is refused on screen, in the post's media box", await card.locator(".xt-media__note").getByText("notes.txt is not a PNG, JPEG, GIF or WebP image").isVisible());
		await card.locator('input[data-role="media-input"]:not([data-index])').setInputFiles(png);
		await card.locator("img.xt-media__preview").waitFor();
		const shown = { preview: await card.locator("img.xt-media__preview").count(), alt: await card.locator('input[data-role="media-alt"]').count(), copyAlt: await card.locator('[data-action="copy-alt"]').count(), download: await card.locator('a[data-role="download"]').getAttribute("download") };
		check("media: an added PNG shows a preview, an alt field, Copy alt text and its own download", shown.preview === 1 && shown.alt === 1 && shown.copyAlt === 1 && shown.download === name, JSON.stringify(shown));
		check("media: a missing alt blocks Approve", (await action(page, id, "approve").getAttribute("aria-disabled")) === "true");
		await card.locator('input[data-role="media-alt"]').fill("A screenshot of the new panel");
		await action(page, id, "approve").click();
		check("media: with alt text the post approves", (await card.getAttribute("data-status")) === "approved");
		if (at === posts.findIndex(open)) check("media: the queue lists the image to attach in X", (await page.locator('#xt-queue-body a[data-role="download"]').evaluateAll(links => links.map(link => link.getAttribute("download")))).includes(name));
	}
	const slot = posts.find(post => open(post) && post.media.some(item => !item.asset));
	if (slot) {
		const card = page.locator(`li[data-post-id="${slot.id}"]`), planned = slot.media.findIndex(item => !item.asset);
		check("media: a planned slot reads [DATA NEEDED: image · …]", (await card.locator(".xt-media__planned").first().innerText()).startsWith("[DATA NEEDED: image · "));
		await card.locator(`input[data-role="media-input"][data-index="${planned}"]`).setInputFiles(png);
		await card.locator("img.xt-media__preview").first().waitFor();
		const filled = await page.evaluate(([id, index]) => window.__VPK_CONTENT__["x-thread"].getContent().posts.find(post => post.id === id).media[index], [slot.id, planned]);
		check("media: adding an image fills the planned slot and keeps its alt", Boolean(filled.asset) && filled.alt === slot.media[planned].alt, filled.asset);
	}
	await page.waitForTimeout(400);
	await page.reload({ waitUntil: "load" });
	if (at >= 0 || slot) check("media: a reload keeps the added images", (await page.locator("img.xt-media__preview").count()) === (at >= 0 ? 1 : 0) + (slot ? 1 : 0));
	await context.close();
}

// Tab through every control in main: DOM order, visible focus ring (the hidden file inputs ring their label).
async function tabWalk(page) {
	const expected = await page.evaluate(() => [...document.querySelectorAll("#xt-main a[href], #xt-main button, #xt-main input, #xt-main select, #xt-main textarea, #xt-main summary")]
		.filter(node => node.getAttribute("tabindex") !== "-1" && !node.disabled && (node.matches("summary") || node.checkVisibility())).length);
	const seen = [];
	for (let i = 0; i < 400 && seen.length < expected; i += 1) {
		await page.keyboard.press("Tab");
		const info = await page.evaluate(() => {
			const node = document.activeElement;
			if (!node || !node.closest("#xt-main")) return null;
			const ring = node.classList.contains("xt-sr-only") ? node.closest("label") : node, style = getComputedStyle(ring);
			const index = [...document.querySelectorAll("#xt-main *")].indexOf(node);
			return { index, ring: style.boxShadow !== "none" || (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0), label: `${node.tagName.toLowerCase()} ${node.getAttribute("data-action") || node.getAttribute("data-role") || node.id || ""}` };
		});
		if (info) seen.push(info);
	}
	const inOrder = seen.every((item, index) => index === 0 || item.index > seen[index - 1].index);
	return { expected, reached: seen.length, inOrder, missingRing: seen.filter(item => !item.ring).map(item => item.label) };
}

async function renderMatrix(browser, url, session, check, outDir) {
	for (const scheme of ["light", "dark"]) {
		const { context, page } = await openPage(browser, url, { colorScheme: scheme }, session);
		const walk = await tabWalk(page);
		check(`${scheme}: Tab reaches every control in DOM order`, walk.reached === walk.expected && walk.inOrder, `${walk.reached}/${walk.expected}`);
		check(`${scheme}: every focused control shows a focus ring`, walk.missingRing.length === 0, walk.missingRing.slice(0, 6).join("; "));
		await page.screenshot({ path: path.join(outDir, `${scheme}.png`) });
		if (scheme === "light") {
			await page.emulateMedia({ media: "print" });
			const print = await page.evaluate(() => ({ rail: getComputedStyle(document.querySelector(".xt-rail")).display, actions: getComputedStyle(document.querySelector(".xt-post__actions")).display, text: getComputedStyle(document.querySelector(".xt-post__text")).display }));
			check("print hides controls and shows post text", print.rail === "none" && print.actions === "none" && print.text !== "none", JSON.stringify(print));
			await page.emulateMedia({ media: "screen" });
			await page.setViewportSize({ width: 375, height: 812 });
			await page.waitForTimeout(200);
			const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
			check("375px: no horizontal overflow", overflow <= 1, `${overflow}px`);
			await page.screenshot({ path: path.join(outDir, "mobile-375.png") });
		}
		await context.close();
	}
	const { context, page } = await openPage(browser, url, { reducedMotion: "reduce" }, session);
	await page.waitForTimeout(400);
	const ids = (await order(page)).split(",");
	await action(page, ids[ids.length - 1], "move-up").click();
	await page.waitForTimeout(300);
	check("reduced motion: no running animations after a move", (await page.evaluate(() => document.getAnimations().filter(item => item.playState === "running").length)) === 0);
	// Keyboard only: Delete moves focus to Undo, and Undo hands it to the restored post (A5).
	await action(page, ids[1], "delete").focus();
	await page.keyboard.press("Enter");
	await page.keyboard.press("Enter");
	const focus = await page.evaluate(() => { const node = document.activeElement; return `${node.getAttribute("data-action") || node.tagName}@${node.closest("li")?.getAttribute("data-post-id") || ""}`; });
	check("keyboard: Undo after a delete focuses the restored post", focus === `edit@${ids[1]}`, focus);
	// r3: a moved post and the copy box keep focus on screen, and Close hands focus back (A5, A13).
	const seen = () => page.evaluate(() => { const node = document.activeElement, box = node.getBoundingClientRect(); return { focus: `${node.getAttribute("data-action") || node.id}@${node.closest("li")?.getAttribute("data-post-id") || ""}`, shown: box.top >= 0 && box.bottom <= innerHeight }; });
	await action(page, ids[3], "move-up").focus();
	await action(page, ids[3], "move-up").evaluate(node => scrollBy(0, node.getBoundingClientRect().top - 90));
	for (const key of ["Enter", "Enter"]) await page.keyboard.press(key);
	const moved = await seen();
	check("keyboard: Move up twice from the top of the window keeps the moved control in view", moved.focus === `move-up@${ids[3]}` && moved.shown, JSON.stringify(moved));
	await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error("denied")); document.execCommand = () => false; });
	await action(page, ids[3], "copy").focus();
	await page.keyboard.press("Enter");
	await page.waitForTimeout(100);
	const box = await seen();
	for (const key of ["Tab", "Enter"]) await page.keyboard.press(key); // Tab reaches the box's Close button
	const back = await seen();
	check("copy fallback: the copy box takes focus in view, and Close hands it back to Copy", box.focus === "xt-copy-text@" && box.shown && back.focus === `copy@${ids[3]}` && back.shown, JSON.stringify([box, back]));
	// A skipped card steps back through its words only: enabled controls keep full opacity (WCAG 1.4.3).
	await action(page, ids[ids.length - 1], "skip").click();
	await page.waitForTimeout(300); // let the reduced-motion crossfades settle before reading opacity
	const skipped = await page.evaluate(id => {
		const li = document.querySelector(`li[data-post-id="${id}"]`), opacity = node => { let value = 1; for (let at = node; at && at !== li.parentElement; at = at.parentElement) value *= Number(getComputedStyle(at).opacity); return value; };
		const controls = [...li.querySelectorAll("button, a, input, label")].filter(node => node.checkVisibility() && node.getAttribute("aria-disabled") !== "true");
		return { status: li.getAttribute("data-status"), dimmed: controls.filter(node => opacity(node) < 1).map(node => node.getAttribute("data-action") || node.tagName.toLowerCase()) };
	}, ids[ids.length - 1]);
	check("skipped post: its enabled controls keep full opacity", skipped.status === "skipped" && skipped.dimmed.length === 0, skipped.dimmed.join(",") || skipped.status);
	await context.close();
}

// Returns an exit code: 0 every check passed, 1 a check failed.
export async function runVerify({ file, out, log = console.log, error = console.error } = {}) {
	if (!file || !fs.existsSync(file)) { error(`verify: file not found: ${file}`); return 2; }
	const { chromium } = await import("@playwright/test");
	const outDir = path.resolve(out || path.join(REPO_ROOT, "output", "vpk-html-v2", "x-thread"));
	fs.mkdirSync(outDir, { recursive: true });
	const url = pathToFileURL(path.resolve(file)).href, session = { network: [], errors: [], posted: 0 }, checks = [];
	const check = (name, ok, detail = "") => checks.push({ name, ok: Boolean(ok), detail: String(detail) });
	const browser = await chromium.launch();
	try {
		await composerFlow(browser, url, session, check);
		await mediaFlow(browser, url, session, check);
		await demoFlow(browser, url, session, check, outDir);
		await renderMatrix(browser, url, session, check, outDir);
	} catch (problem) {
		check("the smoke ran to the end", false, problem.message.split("\n")[0]);
	} finally {
		await browser.close();
	}
	const ownRequests = session.network.filter(request => !/^https:\/\/x\.com\/intent\/tweet\?/.test(request));
	check("the page makes no network requests (only the clicked intents reach the route)", ownRequests.length === 0, ownRequests.slice(0, 3).join(" "));
	check("no console errors or page errors", session.errors.length === 0, session.errors.slice(0, 3).join(" | "));
	fs.writeFileSync(path.join(outDir, "verify.json"), `${JSON.stringify({ file: path.relative(REPO_ROOT, path.resolve(file)), checks, network: session.network.length, posted: session.posted }, null, 2)}\n`);
	for (const item of checks) (item.ok ? log : error)(`${item.ok ? "✓" : "✗"} ${item.name}${item.detail ? ` (${item.detail})` : ""}`);
	const failed = checks.filter(item => !item.ok).length;
	log(`${checks.length - failed}/${checks.length} checks passed · screenshots and verify.json in ${path.relative(process.cwd(), outDir)}`);
	return failed ? 1 : 0;
}
