// Behaviour of the shared enhancement block (integration K5, R6) in happy-dom: E1 idle, E2 opt-out,
// E3 static figures stay zoomable, E4 childList writes inside an opt-out root. The block's script runs as written; layout is stubbed because
// happy-dom computes none. Assertions compare numbers, strings and booleans only.
import assert from "node:assert/strict";
import test from "node:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { ENHANCEMENT_BLOCK, injectEnhancements } from "./inject-enhancements.mjs";

test("minimal pages omit enhancement code and remove previously injected chrome", () => {
	for (const attribute of ['data-vpk-enhancements="off"', "data-vpk-enhancements='off'", 'data-vpk-enhancements=off']) {
		const page = `<!doctype html><html><head></head><body ${attribute}><main>Reader</main></body></html>`;
		assert.equal(injectEnhancements(page), page);
		const enhanced = page.replace('</body>', `${ENHANCEMENT_BLOCK}\n</body>`);
		assert.equal(injectEnhancements(enhanced), page);
		assert.equal(injectEnhancements(injectEnhancements(enhanced)), page);
	}
});

test("minimal chrome is an explicit body option and leaves normal artifacts enhanced", () => {
	for (const body of ['<body>', '<body data-vpk-enhancements="on">', '<body><p>data-vpk-enhancements="off"</p>']) {
		const page = `<html><head></head>${body}<main>Content</main></body></html>`;
		assert.ok(injectEnhancements(page).includes(ENHANCEMENT_BLOCK));
	}
});

const SCRIPT = ENHANCEMENT_BLOCK.match(/<script data-vpkh-enhance>([\s\S]*?)<\/script>/)?.[1];
const RECT = { left: 0, top: 0, right: 640, bottom: 360, width: 640, height: 360, x: 0, y: 0 };
const FIGURE = `<figure><svg viewBox="0 0 640 360" width="640" height="360" role="img" aria-label="Static figure"><rect x="20" y="20" width="200" height="120"></rect></svg><figcaption>A static figure</figcaption></figure>`;
const OPT_OUT = `<div data-vpkh-no-lightbox data-test="live"><figure class="vpkh-zoomable"><svg viewBox="0 0 640 360" width="640" height="360" role="img" aria-label="Interactive figure"><circle cx="40" cy="40" r="12"></circle></svg></figure></div>`;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Load `body` into a fresh happy-dom window, count requestAnimationFrame calls, run the enhancer.
async function withPage(body, run) {
	GlobalRegistrator.register({ url: "http://localhost/", width: 1280, height: 800 });
	try {
		const raf = globalThis.requestAnimationFrame.bind(globalThis);
		const frames = { count: 0 };
		globalThis.requestAnimationFrame = callback => {
			frames.count += 1;
			return raf(callback);
		};
		globalThis.Element.prototype.getBoundingClientRect = () => ({ ...RECT });
		document.body.innerHTML = body;
		new Function(SCRIPT)();
		await run({ frames, document, window });
	} finally {
		await GlobalRegistrator.unregister();
	}
}

const click = node => node.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

// Re-run the enhancer once through `trigger`, then require it to go idle again. A settled page that is
// never re-triggered cannot show a missing write guard: a no-op `classList.add("vpkh-zoomable")` on a
// re-run still queues a mutation record, and that record schedules the next run forever.
async function assertSettlesAfter(frames, trigger, label) {
	frames.count = 0;
	trigger();
	await wait(500);
	assert.ok(frames.count >= 1, `${label} scheduled the enhancer (${frames.count} frames)`);
	frames.count = 0;
	await wait(1000);
	assert.equal(frames.count, 0, `after ${label} the enhancer requested ${frames.count} frames in the next 1000 ms instead of settling`);
}

test("the enhancement block exports one script to evaluate", () => {
	assert.equal(typeof SCRIPT, "string");
	assert.ok(SCRIPT.length > 1000);
});

// The block's stylesheet with comments removed, and the body of each top-level `@media <query> { ... }`.
const STYLE = ENHANCEMENT_BLOCK.match(/<style data-vpkh-enhance>([\s\S]*?)<\/style>/)?.[1].replace(/\/\*[\s\S]*?\*\//g, "") ?? "";

function mediaBodies(css, query) {
	const bodies = [];
	let from = 0;
	for (;;) {
		const at = css.indexOf(`@media ${query}`, from);
		if (at === -1) return bodies;
		const open = css.indexOf("{", at);
		let depth = 0;
		let end = open;
		for (; end < css.length; end += 1) {
			if (css[end] === "{") depth += 1;
			else if (css[end] === "}") {
				depth -= 1;
				if (depth === 0) break;
			}
		}
		bodies.push(css.slice(open + 1, end));
		from = end;
	}
}

test("P1 (B2 decision 13): the fixed scroll-fade overlays never print", () => {
	const bodies = mediaBodies(STYLE, "print");
	assert.equal(bodies.length, 1, "exactly one @media print block in the shared enhancement style");
	const rule = bodies[0].match(/\.vpkh-scroll-fade\s*\{([^}]*)\}/)?.[1] ?? "";
	assert.match(rule, /display:\s*none\s*!important/, "the print rule hides .vpkh-scroll-fade with !important so no inline or attribute rule can win");
	// The screen rule stays: the overlays still exist on screen (the print block is the only place they are hidden).
	assert.match(STYLE, /\.vpkh-scroll-fade\s*\{[^}]*position:\s*fixed/, "the screen rule still positions the fades");
	assert.equal(/display:\s*none/.test(STYLE.replace(/@media print\s*\{[\s\S]*$/, "").match(/\.vpkh-scroll-fade\s*\{[^}]*\}/)?.[0] ?? ""), false, "the screen rule does not hide the fades");
});

test("E1: an idle page with a substantial figure schedules 0 enhancer frames after settling", async () => {
	await withPage(`<main>${FIGURE}</main>`, async ({ frames, document, window }) => {
		await wait(500);
		assert.equal(document.querySelectorAll(".vpkh-scroll-fade").length, 2, "the enhancer initialised its scroll fades");
		assert.ok(document.querySelectorAll(".vpkh-zoomable").length > 0, "the static figure became zoomable");
		frames.count = 0;
		await wait(1000);
		assert.equal(frames.count, 0, `idle enhancer requested ${frames.count} frames in 1000 ms (pre-R6 runtimes loop forever)`);
		// One re-run (a resize) must also settle back to 0: this is what catches a missing add-loop guard.
		await assertSettlesAfter(frames, () => window.dispatchEvent(new window.Event("resize")), "one resize event");
		assert.ok(document.querySelectorAll(".vpkh-zoomable").length > 0, "the static figure is still zoomable after the re-run");
	});
});

test("E2: an opt-out subtree rewritten every 16 ms schedules no frames, gets no zoom class and opens no lightbox", async () => {
	await withPage(`<main>${FIGURE}${OPT_OUT}</main>`, async ({ frames, document, window }) => {
		const circle = document.querySelector("[data-vpkh-no-lightbox] circle");
		let writes = 0;
		const timer = window.setInterval(() => {
			writes += 1;
			circle.setAttribute("cx", String(40 + (writes % 50)));
			circle.closest("[data-vpkh-no-lightbox]").setAttribute("data-step", String(writes));
		}, 16);
		try {
			await wait(500);
			frames.count = 0;
			await wait(1000);
			assert.ok(writes > 20, `the live figure was rewritten (${writes} writes)`);
			assert.equal(frames.count, 0, `attribute writes inside the opt-out root scheduled ${frames.count} enhancer frames`);
		} finally {
			window.clearInterval(timer);
		}
		assert.equal(document.querySelectorAll("[data-vpkh-no-lightbox] .vpkh-zoomable, [data-vpkh-no-lightbox].vpkh-zoomable").length, 0, "nothing inside the opt-out root is zoomable, including authored classes");
		assert.equal(document.querySelectorAll(".vpkh-zoomable").length > 0, true, "the static figure outside is still zoomable");
		click(document.querySelector("[data-vpkh-no-lightbox] svg"));
		click(document.querySelector("[data-vpkh-no-lightbox] circle"));
		assert.equal(document.querySelector(".vpkh-lightbox") === null, true, "a click inside the opt-out root opens no lightbox");
		// Control: the observer still reacts to attribute changes outside opt-out roots, and that run settles.
		await assertSettlesAfter(frames, () => document.querySelector("main > figure figcaption").setAttribute("data-note", "changed"), "an attribute change outside opt-out roots");
	});
});

test("E3: a click on a static figure outside any opt-out root still opens the lightbox", async () => {
	await withPage(`<main>${OPT_OUT}${FIGURE}</main>`, async ({ document }) => {
		await wait(50);
		const figure = document.querySelector("main > figure");
		assert.equal(figure.classList.contains("vpkh-zoomable"), true);
		click(figure.querySelector("rect"));
		const lightbox = document.querySelector(".vpkh-lightbox");
		assert.equal(lightbox === null, false, "the lightbox opened");
		assert.equal(lightbox.getAttribute("role"), "dialog");
		assert.equal(lightbox.querySelector(".vpkh-lightbox__visual")?.getAttribute("aria-label"), "Static figure");
		assert.equal(document.body.classList.contains("vpkh-lightbox-open"), true);
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
		assert.equal(document.querySelector(".vpkh-lightbox") === null, true, "Escape closes it");
	});
});

test("E4 (B3 decision 26b): childList writes inside an opt-out root (a live region's first textContent) schedule no frames", async () => {
	const live = `<div data-vpkh-no-lightbox data-test="live"><p data-test="status"></p><svg viewBox="0 0 640 360" width="640" height="360" role="img" aria-label="Live figure"><circle cx="40" cy="40" r="12"></circle></svg></div>`;
	await withPage(`<main>${FIGURE}${live}</main>`, async ({ frames, document, window }) => {
		await wait(500);
		frames.count = 0;
		await wait(500);
		assert.equal(frames.count, 0, "the page settled before the writes");
		const status = document.querySelector("[data-vpkh-no-lightbox] p");
		let writes = 0;
		const timer = window.setInterval(() => {
			writes += 1;
			status.textContent = `Step ${writes}`;
			status.appendChild(document.createElement("span"));
		}, 16);
		try {
			await wait(500);
			frames.count = 0;
			await wait(1000);
			assert.ok(writes > 20, `the live region was rewritten (${writes} writes)`);
			assert.equal(frames.count, 0, `childList writes inside the opt-out root scheduled ${frames.count} enhancer frames`);
		} finally {
			window.clearInterval(timer);
		}
		// Controls: a childList change outside any opt-out root, and the arrival of a whole opt-out root (a change to
		// its parent), both still schedule a run, and that run settles.
		await assertSettlesAfter(frames, () => document.querySelector("main > figure figcaption").appendChild(document.createElement("em")), "a childList change outside opt-out roots");
		await assertSettlesAfter(frames, () => {
			const root = document.createElement("div");
			root.setAttribute("data-vpkh-no-lightbox", "");
			document.querySelector("main").appendChild(root);
		}, "a new opt-out root arriving in its parent");
	});
});
