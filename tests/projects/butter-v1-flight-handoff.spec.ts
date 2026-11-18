import { expect, test, type Page } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ viewport: { width: 1800, height: 1100 }, ignoreHTTPSErrors: true });

const flightSelector = "[data-project-butter-mention-flight]";
const threadSelector = '[data-jira-activity-entry-id="invocation-butter-claude-onboarding-feedback"]';

async function chooseClaudeSession(page: Page) {
	const editor = page.getByRole("textbox", { name: "Comment editor" });
	await editor.focus();
	await editor.pressSequentially("@Claude");
	await page.getByRole("listbox", { name: "Mention" }).getByRole("option", { name: "Claude", exact: true }).click();
	await page.getByRole("option", { name: "Continue in existing session" }).click();
	const session = page.getByRole("list", { name: "Choose a session" }).getByRole("button", { name: /Summarize onboarding feedback/ });
	await session.focus();
	return { editor, session };
}

async function openClaudeSessionChoice(page: Page, reducedMotion: "reduce" | "no-preference" = "no-preference", colorMode: "light" | "dark" = "light") {
	await page.emulateMedia({ reducedMotion });
	await page.goto(appUrl("/butter-v1"));
	if (colorMode === "dark") {
		await page.getByRole("button", { name: "Cycle theme, current theme: Light" }).click();
		await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
	}
	await page.getByRole("button", { name: "Select Duplicative sessions" }).click();
	await page.getByRole("button", { name: "Close gallery" }).click();
	await page.getByRole("heading", { name: "Activity", exact: true }).scrollIntoViewIfNeeded();
	await page.keyboard.press("m");
	return chooseClaudeSession(page);
}

function observeHandoff(page: Page) {
	return page.evaluate(({ flightSelector, threadSelector }) => {
		function visible(element: HTMLElement | null | undefined) {
			if (!element?.getClientRects().length) return false;
			for (let node: HTMLElement | null = element; node; node = node.parentElement) {
				const style = getComputedStyle(node);
				if (Number(style.opacity) <= 0.01 || style.visibility === "hidden" || style.display === "none") return false;
			}
			return true;
		}
		function geometry(element: HTMLElement) {
			const rect = element.getBoundingClientRect();
			const style = getComputedStyle(element);
			return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, fontSize: style.fontSize, fontFamily: style.fontFamily, background: style.backgroundColor, borderRadius: style.borderRadius };
		}
		function read() {
			const flight = document.querySelector<HTMLElement>(flightSelector);
			const chip = flight?.querySelector<HTMLElement>(".rich-text-mention-chip");
			const form = document.querySelector<HTMLElement>(`${threadSelector} [data-project-butter-comment-editor]`);
			const target = [...(form?.querySelectorAll<HTMLElement>(".rich-text-mention-chip") ?? [])].find((chip) => chip.textContent === "Claude");
			const unrelated = [...(form?.querySelectorAll<HTMLElement>(".rich-text-mention-chip") ?? [])].filter((chip) => chip.textContent !== "Claude");
			const field = form?.querySelector<HTMLElement>('[contenteditable="true"]');
			const bottom = document.querySelector<HTMLElement>('[data-project-butter-comment-bar] [contenteditable="true"]');
			const bottomBounds = bottom?.getBoundingClientRect();
			const source = bottom?.querySelector<HTMLElement>(".rich-text-mention-chip");
			const caretColor = field ? getComputedStyle(field).caretColor : "transparent";
			const trace = form?.closest('[data-rovo-generation="highlight"]');
			const tracePaths = [...(trace?.querySelectorAll(':scope > div[aria-hidden="true"] > svg > path') ?? [])];
			let scrollport = document.querySelector("[data-project-butter-activity-feed]")?.parentElement;
			while (scrollport && !/(auto|scroll)/u.test(getComputedStyle(scrollport).overflowY)) scrollport = scrollport.parentElement;
			return {
				time: performance.now(),
				phase: flight?.dataset.flightPhase ?? null,
				animationTime: Number(flight?.getAnimations()[0]?.currentTime ?? 0),
				animationDuration: Number(flight?.getAnimations()[0]?.effect?.getTiming().duration ?? 0),
				activeElement: document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.tagName ?? null,
				scrollTop: scrollport?.scrollTop ?? 0,
				source: source ? geometry(source) : null,
				sourceVisible: visible(source),
				flight: flight && chip && visible(flight) ? geometry(chip) : null,
				flightBacking: flight ? geometry(flight) : null,
				target: target ? geometry(target) : null,
				targetVisible: visible(target),
				caretVisible: Boolean(field && document.activeElement === field && caretColor !== "transparent" && caretColor !== "rgba(0, 0, 0, 0)"),
				bottomUsable: Boolean(visible(bottom) && bottom?.isContentEditable && !bottom.closest("[inert]") && bottomBounds && bottomBounds.top >= 0 && bottomBounds.bottom <= innerHeight),
				unrelatedVisible: unrelated.every(visible),
				unrelatedCount: unrelated.length,
				tracing: tracePaths.some((path) => Number(path.getAttribute("opacity")) > 0.01),
				traceColors: tracePaths.map((path) => path.getAttribute("stroke")),
				viewport: { width: innerWidth, height: innerHeight },
			};
		}
		return new Promise<ReturnType<typeof read>[]>((resolve, reject) => {
			const frames: ReturnType<typeof read>[] = [];
			const started = performance.now();
			function sample() {
				const value = read();
				frames.push(value);
				if (value.targetVisible && value.caretVisible && !value.flight) resolve(frames);
				else if (performance.now() - started > 4000) reject(new Error("The mention and caret were not revealed after handoff"));
				else requestAnimationFrame(sample);
			}
			sample();
		});
	}, { flightSelector, threadSelector });
}

test("the mention grows along its arc, then settles exactly before revealing the reply", async ({ page }, testInfo) => {
	const { session } = await openClaudeSessionChoice(page);
	const observation = observeHandoff(page);
	await session.press("Enter");
	const frames = await observation;
	await testInfo.attach("mention-flight-frames", { body: JSON.stringify(frames, null, 2), contentType: "application/json" });
	const flying = frames.flatMap((frame) => frame.flight && frame.target ? [{ ...frame, flight: frame.flight, target: frame.target }] : []);
	const first = flying.at(0);
	const last = flying.at(-1);
	if (!first || !last) throw new Error("The handoff never presented a flying chip");
	const dx = last.target.x - first.flight.x;
	const dy = last.target.y - first.flight.y;
	const distance = Math.hypot(dx, dy);
	expect(distance).toBeGreaterThan(30);
	expect(frames.filter((frame) => !frame.sourceVisible && !frame.flight && !frame.targetVisible), "Every painted frame must have a visible owner for the mention").toEqual([]);
	expect(frames.every((frame) => frame.bottomUsable)).toBe(true);
	expect(frames.every((frame) => frame.targetVisible === frame.caretVisible)).toBe(true);
	expect(flying.every((frame) => !frame.targetVisible && !frame.caretVisible)).toBe(true);
	const scrollDistance = Math.abs(frames.at(-1)!.scrollTop - frames[0]!.scrollTop);
	const consecutiveFrames = frames.slice(1).flatMap((frame, index) => frame.time - frames[index]!.time <= 34 ? [Math.abs(frame.scrollTop - frames[index]!.scrollTop)] : []);
	const largestScrollStep = Math.max(0, ...consecutiveFrames);
	expect(largestScrollStep).toBeLessThan(Math.max(24, scrollDistance * 0.6));
	for (const { flight, target, viewport } of flying) {
		const scale = flight.width / target.width;
		expect(scale).toBeGreaterThanOrEqual(0.999);
		expect(scale).toBeLessThanOrEqual(1.151);
		expect(scale).toBeCloseTo(flight.height / target.height, 2);
		expect(flight.fontSize).toBe(target.fontSize);
		expect(flight.fontFamily).toBe(target.fontFamily);
		expect(flight.x).toBeGreaterThanOrEqual(-0.5);
		expect(flight.y).toBeGreaterThanOrEqual(-0.5);
		expect(flight.x + flight.width).toBeLessThanOrEqual(viewport.width + 0.5);
		expect(flight.y + flight.height).toBeLessThanOrEqual(viewport.height + 0.5);
	}
	expect(Math.max(...flying.map(({ flight, target }) => flight.width / target.width))).toBeGreaterThan(1.12);
	expect(flying.some(({ flight, target }) => flight.width / target.width > 1.03 && Math.hypot(flight.x - target.x, flight.y - target.y) > distance * 0.2)).toBe(true);
	const progress = flying.map(({ flight }) => ((flight.x - first.flight.x) * dx + (flight.y - first.flight.y) * dy) / distance);
	expect(Math.max(...progress) - distance).toBeGreaterThan(Math.min(8, distance * 0.06));
	const deviation = flying.map(({ flight }) => Math.abs(dx * (first.flight.y - flight.y) - (first.flight.x - flight.x) * dy) / distance);
	expect(Math.max(...deviation)).toBeGreaterThan(3);
	const firstTrace = flying.find((frame) => frame.tracing);
	expect(firstTrace && firstTrace.animationTime < firstTrace.animationDuration && firstTrace.flight.width > firstTrace.target.width, "The border stroke must begin while the tag is still settling into the reply").toBe(true);
	expect(flying.filter((frame) => frame.tracing).every((frame) => frame.traceColors.every((color) => color === "#d97757"))).toBe(true);
	expect(Math.hypot(last.flight.x - last.target.x, last.flight.y - last.target.y)).toBeLessThan(2);
	expect(last.flight.width / last.target.width).toBeCloseTo(1, 2);
	await expect(page.getByRole("textbox", { name: "Leave a reply..." })).toBeFocused();
	await expect(page.locator(flightSelector)).toHaveCount(0);
});

for (const viewport of [{ width: 900, height: 700 }, { width: 1170, height: 650 }]) {
	test(`the complete handoff stays inside a ${viewport.width} by ${viewport.height} viewport`, async ({ page }) => {
		await page.setViewportSize(viewport);
		const { session } = await openClaudeSessionChoice(page);
		const observation = observeHandoff(page);
		await session.press("Enter");
		const frames = await observation;
		const flying = frames.flatMap((frame) => frame.flight ? [frame.flight] : []);
		expect(flying.length).toBeGreaterThan(0);
		for (const chip of flying) {
			expect(chip.x).toBeGreaterThanOrEqual(-0.5);
			expect(chip.y).toBeGreaterThanOrEqual(-0.5);
			expect(chip.x + chip.width).toBeLessThanOrEqual(viewport.width + 0.5);
			expect(chip.y + chip.height).toBeLessThanOrEqual(viewport.height + 0.5);
		}
		expect(frames.filter((frame) => !frame.sourceVisible && !frame.flight && !frame.targetVisible), "Every painted frame must have a visible owner for the mention").toEqual([]);
		expect(frames.every((frame) => frame.bottomUsable)).toBe(true);
	});
}

test("dark theme preserves the opaque chip surface and agent-accent landing trace", async ({ page }, testInfo) => {
	const { session } = await openClaudeSessionChoice(page, "no-preference", "dark");
	const observation = observeHandoff(page);
	await session.press("Enter");
	const frames = await observation;
	await testInfo.attach("mention-flight-dark", { body: JSON.stringify(frames, null, 2), contentType: "application/json" });
	const source = frames.find((frame) => frame.source)?.source;
	if (!source) throw new Error("The source mention appearance was not captured");
	const flying = frames.flatMap((frame) => frame.flight && frame.flightBacking ? [{ ...frame, flight: frame.flight, backing: frame.flightBacking }] : []);
	expect(flying.length).toBeGreaterThan(0);
	expect(frames.filter((frame) => !frame.sourceVisible && !frame.flight && !frame.targetVisible)).toEqual([]);
	for (const { flight, backing } of flying) {
		expect(backing.width).toBeCloseTo(flight.width, 1);
		expect(backing.height).toBeCloseTo(flight.height, 1);
		expect(flight.background).toBe(source.background);
		expect(flight.borderRadius).toBe(source.borderRadius);
		expect(flight.fontSize).toBe(source.fontSize);
		expect(flight.fontFamily).toBe(source.fontFamily);
		const channels = backing.background.match(/^rgb\((\d+), (\d+), (\d+)\)$/u);
		if (!channels) throw new Error(`The dark flying chip backing is not opaque: ${backing.background}`);
		expect(Math.max(Number(channels[1]), Number(channels[2]), Number(channels[3]))).toBeLessThan(128);
	}
	expect(flying.some((frame) => frame.tracing && frame.traceColors.every((color) => color === "#d97757"))).toBe(true);
	await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
	await expect(page.getByRole("textbox", { name: "Leave a reply..." }).locator(".rich-text-mention-chip")).toBeVisible();
	await expect(page.locator(flightSelector)).toHaveCount(0);
	const screenshot = testInfo.outputPath("dark-flight-reply.png");
	await page.screenshot({ path: screenshot });
	await testInfo.attach("dark-flight-reply", { path: screenshot, contentType: "image/png" });
});

test("typing before landing keeps the first key in the focused destination", async ({ page }) => {
	const { editor, session } = await openClaudeSessionChoice(page);
	await session.press("Enter");
	await expect(page.locator(flightSelector)).toBeVisible();
	const reply = page.getByRole("textbox", { name: "Leave a reply..." });
	await expect(reply).toBeFocused();
	await page.keyboard.type("Keep this first key");
	await expect(reply).toContainText("Keep this first key");
	await expect(reply).toBeFocused();
	await expect(reply.locator(".rich-text-mention-chip")).toBeVisible();
	await expect(editor).not.toContainText("Keep this first key");
	await expect(page.locator(flightSelector)).toHaveCount(0);
});

test("beforeinput text insertion interrupts the flight and preserves its first text", async ({ page }, testInfo) => {
	const { editor, session } = await openClaudeSessionChoice(page);
	const observation = observeHandoff(page);
	await session.press("Enter");
	const reply = page.getByRole("textbox", { name: "Leave a reply..." });
	await expect(page.locator(flightSelector)).toBeVisible();
	await expect(reply).toBeFocused();
	await expect(reply).toHaveCSS("caret-color", "rgba(0, 0, 0, 0)");
	await page.keyboard.insertText("Inserted through beforeinput");
	const frames = await observation;
	await testInfo.attach("mention-flight-beforeinput", { body: JSON.stringify(frames, null, 2), contentType: "application/json" });
	expect(frames.some((frame) => frame.flight)).toBe(true);
	expect(frames.filter((frame) => !frame.sourceVisible && !frame.flight && !frame.targetVisible)).toEqual([]);
	await expect(reply).toContainText("Inserted through beforeinput");
	await expect(reply).toBeFocused();
	await expect(reply.locator(".rich-text-mention-chip")).toBeVisible();
	await expect(editor).not.toContainText("Inserted through beforeinput");
	await expect(page.locator(flightSelector)).toHaveCount(0);
});

for (const change of ["programmatic scroll", "destination width change"]) {
	test(`${change} interrupts an active flight without a reveal gap`, async ({ page }, testInfo) => {
		const { session } = await openClaudeSessionChoice(page);
		const observation = observeHandoff(page);
		await session.press("Enter");
		await page.waitForFunction(({ flightSelector, threadSelector }) => {
			const flight = document.querySelector<HTMLElement>(`${flightSelector} .rich-text-mention-chip`)?.getBoundingClientRect();
			const target = document.querySelector<HTMLElement>(`${threadSelector} [contenteditable] .rich-text-mention-chip`)?.getBoundingClientRect();
			return Boolean(flight && target && flight.width / target.width > 1.02);
		}, { flightSelector, threadSelector }, { polling: "raf" });
		const reply = page.getByRole("textbox", { name: "Leave a reply..." });
		const mutation = await reply.evaluate((field, change) => {
			const flight = document.querySelector<HTMLElement>("[data-project-butter-mention-flight]");
			const animation = flight?.getAnimations()[0];
			const elapsed = Number(animation?.currentTime ?? 0);
			const duration = Number(animation?.effect?.getTiming().duration ?? 0);
			if (change === "programmatic scroll") {
				let scrollport = field.parentElement;
				while (scrollport && (!/(auto|scroll)/u.test(getComputedStyle(scrollport).overflowY) || scrollport.scrollHeight <= scrollport.clientHeight)) scrollport = scrollport.parentElement;
				if (!scrollport) throw new Error("Activity scrollport is unavailable");
				const before = scrollport.scrollTop;
				scrollport.scrollTop += before > 0 ? -32 : 32;
				return { elapsed, duration, before, after: scrollport.scrollTop };
			}
			const target = field.querySelector<HTMLElement>(".rich-text-mention-chip");
			if (!target) throw new Error("Destination mention is unavailable");
			const before = target.getBoundingClientRect().width;
			target.style.width = `${before + 24}px`;
			return { elapsed, duration, before, after: target.getBoundingClientRect().width };
		}, change);
		const frames = await observation;
		expect(mutation.elapsed).toBeGreaterThan(0);
		expect(mutation.elapsed).toBeLessThan(mutation.duration);
		expect(Math.abs(mutation.after - mutation.before)).toBeGreaterThan(20);
		await testInfo.attach(`mention-flight-${change.replaceAll(" ", "-")}`, { body: JSON.stringify({ mutation, frames }, null, 2), contentType: "application/json" });
		expect(frames.some((frame) => frame.flight)).toBe(true);
		expect(frames.filter((frame) => !frame.sourceVisible && !frame.flight && !frame.targetVisible)).toEqual([]);
		expect(frames.at(-1)?.targetVisible).toBe(true);
		expect(frames.at(-1)?.caretVisible).toBe(true);
		await expect(reply.locator(".rich-text-mention-chip")).toBeVisible();
		await expect(page.locator(flightSelector)).toHaveCount(0);
	});
}

test("unrelated reply mentions stay visible throughout another agent's handoff", async ({ page }) => {
	const initial = await openClaudeSessionChoice(page, "reduce");
	await initial.session.press("Enter");
	const reply = page.getByRole("textbox", { name: "Leave a reply..." });
	await expect(reply).toBeFocused();
	await reply.fill("");
	await reply.pressSequentially("@Cursor");
	await page.getByRole("listbox", { name: "Mention" }).getByRole("option", { name: "Cursor", exact: true }).click();
	await reply.pressSequentially(" Existing reply draft");
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await initial.editor.click();
	const { session } = await chooseClaudeSession(page);
	const observation = observeHandoff(page);
	await session.press("Enter");
	const frames = await observation;
	expect(frames.some((frame) => frame.flight)).toBe(true);
	expect(frames.every((frame) => frame.unrelatedVisible)).toBe(true);
	expect(frames.every((frame) => frame.unrelatedCount === 1)).toBe(true);
	await expect(reply).toContainText("Existing reply draft");
	await expect(reply.locator(".rich-text-mention-chip")).toHaveText(["Claude", "Cursor"]);
});

test("wheel input during travel reveals the reply and preserves the user's next focus", async ({ page }) => {
	const { editor, session } = await openClaudeSessionChoice(page);
	await session.press("Enter");
	await expect(page.locator(flightSelector)).toBeVisible();
	await page.mouse.wheel(0, 80);
	await expect(page.locator(flightSelector)).toHaveCount(0);
	await expect(page.getByRole("textbox", { name: "Leave a reply..." }).locator(".rich-text-mention-chip")).toBeVisible();
	await editor.click();
	await editor.pressSequentially("Keep typing here until the original flight would have finished", { delay: 15 });
	await expect(editor).toBeFocused();
	await expect(editor).toContainText("Keep typing here until the original flight would have finished");
	await expect(page.getByRole("textbox", { name: "Leave a reply..." })).not.toContainText("Keep typing here");
});

test("a viewport resize during the overshoot return removes the stale overlay", async ({ page }) => {
	const { editor, session } = await openClaudeSessionChoice(page);
	await session.press("Enter");
	await page.evaluate(({ flightSelector, threadSelector }) => new Promise<void>((resolve, reject) => {
		let source: { x: number; y: number } | null = null;
		let furthest = 0;
		const started = performance.now();
		function sample() {
			const flight = document.querySelector<HTMLElement>(`${flightSelector} .rich-text-mention-chip`)?.getBoundingClientRect();
			const target = document.querySelector<HTMLElement>(`${threadSelector} [contenteditable] .rich-text-mention-chip`)?.getBoundingClientRect();
			if (flight && target) {
				const point = { x: flight.x + flight.width / 2, y: flight.y + flight.height / 2 };
				source ??= point;
				const dx = target.x + target.width / 2 - source.x;
				const dy = target.y + target.height / 2 - source.y;
				const distance = Math.hypot(dx, dy);
				const beyond = ((point.x - source.x) * dx + (point.y - source.y) * dy) / distance - distance;
				furthest = Math.max(furthest, beyond);
				if (furthest > 3 && beyond < furthest - 0.25) { resolve(); return; }
			}
			if (performance.now() - started > 4000) reject(new Error("The mention did not return from its overshoot"));
			else requestAnimationFrame(sample);
		}
		sample();
	}), { flightSelector, threadSelector });
	await page.setViewportSize({ width: 1500, height: 900 });
	await expect(page.locator(flightSelector)).toHaveCount(0);
	await expect(page.getByRole("textbox", { name: "Leave a reply..." }).locator(".rich-text-mention-chip")).toBeVisible();
	await editor.click();
	await editor.pressSequentially("After resizing", { delay: 15 });
	await expect(editor).toBeFocused();
	await expect(editor).toContainText("After resizing");
});

test("reduced motion reveals the mention and caret without a flight", async ({ page }) => {
	const { session } = await openClaudeSessionChoice(page, "reduce");
	const observation = observeHandoff(page);
	await session.press("Enter");
	const frames = await observation;
	expect(frames.some((frame) => frame.flight)).toBe(false);
	await expect(page.getByRole("textbox", { name: "Leave a reply..." })).toBeFocused();
	await expect(page.locator(flightSelector)).toHaveCount(0);
});

test("a reduced-motion handoff keeps a long offscreen session's full reply above the bottom prompt", async ({ page }) => {
	await page.setViewportSize({ width: 1170, height: 650 });
	await openClaudeSessionChoice(page, "reduce");
	const session = page.getByRole("list", { name: "Choose a session" }).getByRole("button", { name: /Rewrite the incident postmortem/ });
	await session.focus();
	await session.press("Enter");
	const reply = page.getByRole("textbox", { name: "Leave a reply..." });
	await expect(reply).toBeFocused();
	await expect(reply.locator(".rich-text-mention-chip")).toBeVisible();
	await expect.poll(() => reply.evaluate((field) => {
		const composer = field.closest("form");
		let scrollport = composer?.parentElement;
		while (scrollport && !/(auto|scroll)/u.test(getComputedStyle(scrollport).overflowY)) scrollport = scrollport.parentElement;
		const bar = document.querySelector("[data-project-butter-comment-bar]");
		const header = document.querySelector("[data-project-butter-activity-header]");
		if (!composer || !scrollport || !bar || !header) throw new Error("Reply visibility boundaries are unavailable");
		const replyRect = composer.getBoundingClientRect();
		const scrollRect = scrollport.getBoundingClientRect();
		return replyRect.top >= Math.max(scrollRect.top, header.getBoundingClientRect().bottom) - 1 && replyRect.bottom <= Math.min(scrollRect.bottom, bar.getBoundingClientRect().top) + 1;
	})).toBe(true);
	await expect(page.locator(flightSelector)).toHaveCount(0);
});

test("switching gallery views interrupts the flight and does not replay it on return", async ({ page }) => {
	const { session } = await openClaudeSessionChoice(page);
	await session.press("Enter");
	await expect(page.locator(flightSelector)).toBeVisible();
	await page.getByRole("button", { name: "Open gallery" }).click();
	await page.getByRole("button", { name: "Select Work item", exact: true }).click();
	await page.getByRole("button", { name: "Select Duplicative sessions" }).click();
	await page.getByRole("button", { name: "Close gallery" }).click();
	await expect(page.locator(flightSelector)).toHaveCount(0);
	await expect(page.getByRole("textbox", { name: "Leave a reply..." }).locator(".rich-text-mention-chip")).toBeVisible();
	await expect(page.locator(`${threadSelector} [data-rovo-generation="highlight"]`)).toHaveAttribute("data-rovo-generation-active", "false");
});
