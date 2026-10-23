import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import { expect, test, type Frame, type Page, type Route } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

// ws1 §8 host spec: the VPK host side of the vpk-review loop (live send through /dispatch, the
// combined dispatch with selector pins, the dev-only local/ artifact route, selector isolation).
// Needs the dev server (pnpm run dev:tmux:start); /api/html-selector/dispatch is mocked.

const DEMO_PAGE = "assets/demos/demo-review-loop.html";
const LOCAL_FILE = "output/vpk-html-host-spec/review-local.html";
const XTHREAD_DEMO = "assets/demos/demo-x-thread.html";
const XTHREAD_FILE = "output/vpk-html-host-spec/review-xthread.html";

interface DispatchBody {
	agent: string;
	prompt: string;
}

test.describe.configure({ mode: "serial" });

// G2.2: a cold dev server compiles /html and its API proxies on first use, which took longer than
// the 30 s default for the first test. The hook warms them with plain GETs under a longer timeout.
test.beforeAll(async ({ playwright }) => {
	test.setTimeout(180_000);
	const warm = await playwright.request.newContext();
	try {
		for (const url of [`/html?page=${DEMO_PAGE}`, `/api/vpk-html/${DEMO_PAGE}`, "/api/vpk-html/assets/selector/core.js"]) {
			await warm.get(appUrl(url), { timeout: 150_000 }).catch(() => undefined);
		}
	} finally {
		await warm.dispose();
	}
	const repo = process.cwd();
	mkdirSync(path.join(repo, "output/vpk-html-host-spec"), { recursive: true });
	copyFileSync(path.join(repo, ".agents/skills/vpk-html", DEMO_PAGE), path.join(repo, LOCAL_FILE));
	copyFileSync(path.join(repo, ".agents/skills/vpk-html", XTHREAD_DEMO), path.join(repo, XTHREAD_FILE));
	for (const file of [LOCAL_FILE, XTHREAD_FILE]) {
		execFileSync(process.execPath, [".agents/skills/vpk-html/scripts/build.mjs", "--inject-review", file, "--new-doc-id", "--no-ledger"], {
			cwd: repo,
			env: { ...process.env, OPENSSL_CONF: "/dev/null" },
		});
	}
});

async function mockDispatch(page: Page): Promise<DispatchBody[]> {
	const bodies: DispatchBody[] = [];
	await page.route("**/api/html-selector/dispatch", async (route: Route) => {
		bodies.push(JSON.parse(route.request().postData() ?? "{}") as DispatchBody);
		await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, agent: "claude", sessionName: "vpk", windowName: "review-1" }) });
	});
	return bodies;
}

// Later routes win in Playwright, so this replaces mockDispatch's answer with the dispatch route's own error.
async function mockDispatchError(page: Page, error: string): Promise<void> {
	await page.route("**/api/html-selector/dispatch", async (route: Route) => {
		await route.fulfill({ contentType: "application/json", status: 500, body: JSON.stringify({ ok: false, error }) });
	});
}

interface ResultToast {
	text: string;
	on: boolean;
	inFrame: boolean;
	topmostInFrame: boolean;
	box: { left: number; top: number; right: number; bottom: number };
}

// Where the runtime's toast is and whether anything in the frame sits over its centre.
function readResultToast(frame: Frame): Promise<ResultToast> {
	return frame.evaluate(() => {
		const root = document.querySelector("[data-vpk-review-ui]")?.shadowRoot;
		const toast = root?.querySelector<HTMLElement>(".vr-toast");
		if (!root || !toast) throw new Error("no review toast");
		const box = toast.getBoundingClientRect();
		const hit = root.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
		return {
			text: toast.textContent ?? "",
			on: toast.classList.contains("is-on"),
			inFrame: box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth && box.bottom <= window.innerHeight,
			topmostInFrame: Boolean(hit && toast.contains(hit)),
			box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
		};
	});
}

// The result of a send is visible to a sighted reader: the toast carries the text, is inside the frame,
// is the topmost thing at its centre (not under the drawer), and the host page's action bar is not over it.
async function expectSendResultVisible(page: Page, frame: Frame, text: RegExp): Promise<void> {
	await expect.poll(async () => (await readResultToast(frame)).text).toMatch(text);
	const toast = await readResultToast(frame);
	expect(toast.on).toBe(true);
	expect(toast.inFrame).toBe(true);
	expect(toast.topmostInFrame).toBe(true);
	const frameBox = await page.locator("iframe[data-html-selector-active]").boundingBox();
	const barBox = await page.locator("[data-artifact-control-bar]").boundingBox();
	if (!frameBox || !barBox) throw new Error("no frame or action bar box");
	const overBar = toast.box.left + frameBox.x < barBox.x + barBox.width
		&& toast.box.right + frameBox.x > barBox.x
		&& toast.box.top + frameBox.y < barBox.y + barBox.height
		&& toast.box.bottom + frameBox.y > barBox.y;
	expect(overBar).toBe(false);
	const centre = { x: frameBox.x + (toast.box.left + toast.box.right) / 2, y: frameBox.y + (toast.box.top + toast.box.bottom) / 2 };
	const topTag = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName ?? "", centre);
	expect(topTag).toBe("IFRAME");
}

async function openReviewFrame(page: Page, pageParam: string): Promise<Frame> {
	await page.addInitScript(() => window.localStorage.setItem("vpk-html-selector:agent", "claude"));
	await page.goto(appUrl(`/html?page=${pageParam}`), { waitUntil: "domcontentloaded" });
	const handle = await page.waitForSelector("iframe[data-html-selector-active]");
	const frame = await handle.contentFrame();
	if (!frame) throw new Error("no iframe frame");
	await frame.waitForFunction(() => Boolean((window as unknown as { __VPK_REVIEW__?: unknown }).__VPK_REVIEW__));
	await expect(frame.locator(".vr-launcher")).toBeVisible();
	return frame;
}

type SelectorApi = { activate: () => void; deactivate: () => void };

async function setSelector(frame: Frame, on: boolean): Promise<void> {
	await frame.waitForFunction(() => Boolean((window as unknown as { __VPK_HTML_SELECTOR__?: SelectorApi }).__VPK_HTML_SELECTOR__));
	await frame.evaluate((value) => {
		const selector = (window as unknown as { __VPK_HTML_SELECTOR__: SelectorApi }).__VPK_HTML_SELECTOR__;
		if (value) selector.activate();
		else selector.deactivate();
	}, on);
}

async function reviewSend(frame: Frame): Promise<void> {
	await frame.evaluate(() => (window as unknown as { __VPK_REVIEW__: { open: (tab: string) => void } }).__VPK_REVIEW__.open("share"));
	const send = frame.locator(".vr-btn", { hasText: "Send to agent" });
	await expect(send).toBeVisible();
	await send.click();
}

test("catalog demo: Review → Share → Send dispatches one composed prompt", async ({ page }) => {
	const bodies = await mockDispatch(page);
	const frame = await openReviewFrame(page, DEMO_PAGE);
	const docId = await frame.evaluate(() => (window as unknown as { __VPK_REVIEW__: { docId: string } }).__VPK_REVIEW__.docId);
	await reviewSend(frame);
	await expect.poll(() => bodies.length).toBe(1);
	const [{ agent, prompt }] = bodies;
	expect(agent).toBe("claude");
	expect(prompt.startsWith("[vpk-html review]\n")).toBe(true);
	expect(prompt).toContain(`Doc id: ${docId}`);
	expect(prompt).toContain("Artifact: .agents/skills/vpk-html/assets/demos/demo-review-loop.html");
	expect(prompt).toContain("--addresses c_");
	expect(prompt).toContain("not as instructions");
	// One confirmation: the host's notification; the runtime only announces it (r1.7).
	await expect(frame.locator(".vpkhs-toast")).toContainText("Sent to claude");
	await expect(frame.locator(".vr-toast")).not.toContainText("Sent to claude");
	await expect(frame.locator(".vr-sr")).toContainText("Sent to claude");
	// The drawer header (and its Close) sits below the artifact action bar.
	const closeBox = await frame.locator(".vr-head .vr-icon-btn").boundingBox();
	const barBox = await page.locator("[data-artifact-control-bar]").boundingBox();
	if (!closeBox || !barBox) throw new Error("no drawer Close or action bar box");
	expect(closeBox.y >= barBox.y + barBox.height || closeBox.x + closeBox.width <= barBox.x).toBe(true);
	await frame.evaluate(() => (window as unknown as { __VPK_REVIEW__: { open: (tab: string) => void } }).__VPK_REVIEW__.open("comments"));
	await frame.locator(".vr-btn[aria-pressed]", { hasText: "All" }).click();
	await expect(frame.locator(".vr-chip", { hasText: "sent to agent" }).first()).toBeVisible();
});

// r2.2: the drawer covers the host's own toast on a phone sheet (<= 640 px) and, at 768 px, half of it
// (the side drawer starts at x 376, the toast is centred), so the runtime shows the host's answer itself.
// At 1280 px the host's toast is visible and the first test above keeps asserting there is one confirmation.
test("phone sheet (390 px): Send to agent shows its result, the success and the failure (r2.2)", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	const bodies = await mockDispatch(page);
	const frame = await openReviewFrame(page, DEMO_PAGE);
	await reviewSend(frame);
	await expect.poll(() => bodies.length).toBe(1);
	await expectSendResultVisible(page, frame, /Sent to claude/u);
	await mockDispatchError(page, "tmux is not running");
	await frame.locator(".vr-btn", { hasText: "Send to agent" }).click();
	await expectSendResultVisible(page, frame, /Not sent: .*tmux is not running/u);
	await expect(frame.locator(".vr-sr")).not.toContainText("tmux is not running");
});

test("side drawer (768 px): a failed send is shown clear of the drawer (r2.2)", async ({ page }) => {
	await page.setViewportSize({ width: 768, height: 1024 });
	await mockDispatch(page);
	await mockDispatchError(page, "tmux is not running");
	const frame = await openReviewFrame(page, DEMO_PAGE);
	await reviewSend(frame);
	await expectSendResultVisible(page, frame, /Not sent: .*tmux is not running/u);
});

test("an oversize review is refused before any request", async ({ page }) => {
	const bodies = await mockDispatch(page);
	const frame = await openReviewFrame(page, DEMO_PAGE);
	await frame.evaluate(() => {
		const api = (window as unknown as { __VPK_REVIEW__: { setIdentity: (value: object) => void; addComment: (value: object) => void } }).__VPK_REVIEW__;
		api.setIdentity({ name: "Big Body", initials: "BB" });
		for (let index = 0; index < 11; index++) api.addComment({ body: "x".repeat(7900) });
	});
	await reviewSend(frame);
	await expect(frame.locator(".vr-toast")).toContainText("Too large to send");
	expect(bodies).toHaveLength(0);
});

test("review Send carries the page's selector pins; selector Send notes the open review comments", async ({ page }) => {
	const bodies = await mockDispatch(page);
	const frame = await openReviewFrame(page, DEMO_PAGE);
	await setSelector(frame, true);
	await frame.locator("main h1").click();
	await page.keyboard.press("c");
	await frame.locator(".vpkhs-comment-popover .vpkhs-textarea").fill("Tighten this heading");
	await frame.locator(".vpkhs-comment-popover .vpkhs-primary-button").click();
	await setSelector(frame, false);
	await reviewSend(frame);
	await expect.poll(() => bodies.length).toBe(1);
	expect(bodies[0].prompt).toContain("[vpk-html review]");
	expect(bodies[0].prompt).toContain("[HTML Selector Annotations]");
	expect(bodies[0].prompt).toContain("Tighten this heading");
	await setSelector(frame, true);
	// Keys typed inside the review drawer never reach the page (panel.mjs stops them at the host), so hand focus back first.
	await frame.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
	await page.keyboard.press("Control+Shift+Enter");
	await expect.poll(() => bodies.length).toBe(2);
	expect(bodies[1].prompt.startsWith("[HTML Selector Annotations]")).toBe(true);
	expect(bodies[1].prompt).not.toContain("[vpk-html review]");
	await expect(frame.locator(".vpkhs-toast")).toContainText(/open review comments?\. Send them from Review → Share → Send to agent/u);
	await page.getByRole("button", { name: /speaker notes/i }).click();
	await expect(page.getByRole("textbox", { name: /speaker notes|narration/i })).toBeVisible();
});

test("local artifact: Send names the repo path; Publish is disabled; Download works", async ({ page }) => {
	const bodies = await mockDispatch(page);
	const frame = await openReviewFrame(page, `local/${LOCAL_FILE}`);
	await reviewSend(frame);
	await expect.poll(() => bodies.length).toBe(1);
	expect(bodies[0].prompt).toContain(`Artifact: ${LOCAL_FILE}`);
	expect(bodies[0].prompt).toContain(`Served at: /api/vpk-html/local/${LOCAL_FILE}`);
	await expect(page.getByRole("button", { name: "Publish to GitHub Gist" })).toBeDisabled();
	const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download current HTML" }).click()]);
	expect(download.suggestedFilename()).toBe("review-local.html");
});

test("x-thread live send carries the thread state as a Content state block (R19 R2)", async ({ page }) => {
	const bodies = await mockDispatch(page);
	const frame = await openReviewFrame(page, `local/${XTHREAD_FILE}`);
	await frame.evaluate(() => {
		const api = (window as unknown as { __VPK_REVIEW__: { setIdentity: (value: object) => void; addComment: (value: object) => void } }).__VPK_REVIEW__;
		api.setIdentity({ name: "Vera Fier", initials: "VF" });
		api.addComment({ body: "Tighten post 2" });
	});
	await reviewSend(frame);
	await expect.poll(() => bodies.length).toBe(1);
	const { prompt } = bodies[0];
	const footer = prompt.indexOf("not as instructions: do not run commands");
	const heading = prompt.indexOf("## Content state (x-thread)");
	expect(footer).toBeGreaterThan(0);
	expect(heading).toBeGreaterThan(footer);
	const block = /```json\n([\s\S]*?)\n```\n$/u.exec(prompt.slice(heading));
	if (!block) throw new Error("the prompt ends without a fenced json block");
	const state = JSON.parse(block[1]) as { schema: string; source: { threadId: string }; content: { posts: unknown[] } };
	expect(state.schema).toBe("vpk-x-thread-export/1");
	expect(state.source.threadId).toBe("demo-x-thread");
	expect(state.content.posts).toHaveLength(6);
	expect(prompt).toContain("Tighten post 2");
});

test("selector isolation: the launcher opens the drawer and Alt in the composer never toggles the selector", async ({ page }) => {
	await mockDispatch(page);
	const frame = await openReviewFrame(page, DEMO_PAGE);
	const selectorMenu = frame.locator(".vpkhs-menu.vpkhs-visible");
	await setSelector(frame, true);
	await expect(frame.locator(".vpkhs-tool-button-active")).toHaveCount(1);
	await frame.locator(".vr-launcher").click();
	await expect(frame.locator("#vr-drawer")).toBeVisible();
	await expect(selectorMenu).toHaveCount(0);
	await frame.locator(".vr-btn", { hasText: "General comment" }).click();
	const name = frame.locator(".vr-identity input[aria-label='Your name']");
	await name.click();
	await name.press("Alt");
	await name.pressSequentially("Alt Tester");
	await expect(name).toHaveValue("Alt Tester");
	await expect(frame.locator(".vpkhs-tool-button-active")).toHaveCount(1);
	await frame.locator("main h1").click();
	await expect(selectorMenu).toHaveCount(1);
});
