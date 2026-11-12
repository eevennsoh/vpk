import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

const AGENT_SESSION_URL = appUrl("/components/blocks/agent-session");

test("teammate disclosure header does not jump when opening or closing", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/components/blocks/agent-assignment"));
	await page.locator("#preview").getByRole("button", { name: "Edit agents", exact: true }).click();
	const trigger = page.getByRole("dialog", { name: "Agent assignment" }).getByRole("button", { name: "Sessions from your teammates" });
	for (const expanded of [true, false]) {
		const heights = await trigger.evaluate(async (button) => {
			if (!(button instanceof HTMLButtonElement)) throw new Error("Disclosure trigger must be a button");
			const before = button.getBoundingClientRect().height;
			button.click();
			await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
			return [before, button.getBoundingClientRect().height];
		});
		expect(Math.abs(heights[1] - heights[0]), `Header heights: ${heights}`).toBeLessThan(12);
		await expect(trigger).toHaveAttribute("aria-expanded", String(expanded));
		await page.waitForTimeout(250);
	}
});

test("teammate avatars move down on expansion and up on collapse", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/components/blocks/agent-assignment"));
	await page.locator("#preview").getByRole("button", { name: "Edit agents", exact: true }).click();
	const trigger = page.getByRole("dialog", { name: "Agent assignment" }).getByRole("button", { name: /Sessions from your teammates/u });
	const sampleMotion = async () => {
		await page.evaluate(() => {
			delete document.documentElement.dataset.motionTrace;
			delete document.documentElement.dataset.avatarMotionTrace;
			document.addEventListener("pointerdown", () => {
				const samples: number[] = [];
				const avatars: Array<Array<{ opacity: number; x: number }>> = [];
				const start = performance.now();
				function sample(now: number) {
					const group = document.querySelector('[aria-label="Agent assignment"] [data-slot="collapsible-trigger"] [data-slot="avatar-group"]');
					const stack = group?.parentElement;
					if (stack && group) {
						samples.push(new DOMMatrixReadOnly(getComputedStyle(stack).transform).m42);
						avatars.push([...group.querySelectorAll('[data-slot="avatar"]')].map((element) => {
							const style = getComputedStyle(element);
							return { opacity: Number(style.opacity), x: new DOMMatrixReadOnly(style.transform).m41 };
						}));
					}
					if (now - start < 250) requestAnimationFrame(sample);
					else {
						document.documentElement.dataset.avatarMotionTrace = JSON.stringify(avatars);
						document.documentElement.dataset.motionTrace = JSON.stringify(samples);
					}
				}
				requestAnimationFrame(sample);
			}, { once: true });
		});
		await trigger.click();
		await page.waitForFunction(() => document.documentElement.dataset.motionTrace !== undefined);
		return page.evaluate((): number[] => JSON.parse(document.documentElement.dataset.motionTrace ?? "[]"));
	};
	const down = await sampleMotion();
	expect(down.length).toBeGreaterThan(1);
	expect(Math.max(...down) - down[0], `Opening samples: ${JSON.stringify(down)}`).toBeGreaterThan(1);
	const up = await sampleMotion();
	expect(up.length).toBeGreaterThan(1);
	expect(up[0] - up[up.length - 1], `Closing samples: ${JSON.stringify(up)}`).toBeGreaterThan(1);
	await expect(trigger.locator('[data-slot="avatar-group"]')).toBeVisible();
	const avatarFrames = await page.evaluate((): Array<Array<{ opacity: number; x: number }>> => JSON.parse(document.documentElement.dataset.avatarMotionTrace ?? "[]"));
	expect(avatarFrames.length).toBeGreaterThan(1);
	for (const frame of avatarFrames) expect(frame).toEqual(Array.from({ length: 4 }, () => ({ opacity: 1, x: 0 })));
});

test("teammate avatars settle without movement when reduced motion is enabled", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/components/blocks/agent-assignment"));
	await page.locator("#preview").getByRole("button", { name: "Edit agents", exact: true }).click();
	const trigger = page.getByRole("dialog", { name: "Agent assignment" }).getByRole("button", { name: /Sessions from your teammates/u });
	const avatars = trigger.locator('[data-slot="avatar-group"]');
	await trigger.click();
	await expect(avatars.locator("..")).toHaveCSS("opacity", "0");
	await trigger.click();
	await expect(avatars).toBeVisible();
	const translation = await avatars.evaluate((element) => {
		if (!element.parentElement) throw new Error("Avatar stack wrapper must exist");
		return new DOMMatrixReadOnly(getComputedStyle(element.parentElement).transform).m42;
	});
	expect(translation).toBe(0);
	const avatarTranslations = await avatars.locator('[data-slot="avatar"]').evaluateAll((elements) =>
		elements.map((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41),
	);
	expect(avatarTranslations).toEqual([0, 0, 0, 0]);
});

test("teammate disclosure label stays in place when expanded", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/components/blocks/agent-assignment"));
	await page.locator("#preview").getByRole("button", { name: "Edit agents", exact: true }).click();
	const menu = page.getByRole("dialog", { name: "Agent assignment" });
	const trigger = menu.getByRole("button", { name: /Sessions from your teammates/u });
	const label = trigger.getByText("Sessions from your teammates", { exact: true });
	const labelOffset = async () => {
		const [buttonBounds, labelBounds] = await Promise.all([trigger.boundingBox(), label.boundingBox()]);
		if (!buttonBounds || !labelBounds) throw new Error("Teammate disclosure must be visible");
		return labelBounds.y - buttonBounds.y;
	};
	const collapsedOffset = await labelOffset();
	const [collapsedBounds, avatarBounds] = await Promise.all([
		trigger.boundingBox(),
		trigger.locator('[data-slot="avatar-group"]').boundingBox(),
	]);
	if (!collapsedBounds || !avatarBounds) throw new Error("Teammate avatars must be visible");
	expect(Math.abs(collapsedOffset - (collapsedBounds.y + collapsedBounds.height - avatarBounds.y - avatarBounds.height))).toBeLessThanOrEqual(1);
	await trigger.click();
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
	expect(Math.abs(await labelOffset() - collapsedOffset)).toBeLessThanOrEqual(1);
	const [expandedBounds, labelBounds] = await Promise.all([trigger.boundingBox(), label.boundingBox()]);
	if (!expandedBounds || !labelBounds) throw new Error("Teammate disclosure must be visible");
	expect(Math.abs(collapsedOffset - (expandedBounds.y + expandedBounds.height - labelBounds.y - labelBounds.height))).toBeLessThanOrEqual(1);
	await trigger.click();
	await expect(trigger).toHaveAttribute("aria-expanded", "false");
	expect(Math.abs(await labelOffset() - collapsedOffset)).toBeLessThanOrEqual(1);
});

test("assignment session rows match the menu action hover color", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/components/blocks/agent-assignment"));
	await page.locator("#preview").getByRole("button", { name: "Edit agents", exact: true }).click();
	const menu = page.locator('[aria-label="Agent assignment"]');
	const action = menu.getByRole("button", { name: "Assign agent" });
	await action.hover();
	await expect.poll(() => action.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
	const color = await action.evaluate((element) => getComputedStyle(element).backgroundColor);
	for (const row of await menu.locator("article").all()) {
		await row.hover();
		await expect(row).toHaveCSS("background-color", color);
	}
});

test("compact session and assignment status glyphs are 12px", async ({ page }) => {
	await page.goto(AGENT_SESSION_URL, { waitUntil: "domcontentloaded" });
	for (const section of ["Local — short", "Cloud — short"]) {
		const example = page.getByRole("heading", { name: section }).locator("xpath=../../..");
		const info = example.getByRole("button", { name: "Someone is using an agent. Only they can see the work." }).locator("svg");
		await expect(info).toHaveCSS("width", "12px");
		await expect(info).toHaveCSS("height", "12px");
	}
	const local = page.getByRole("heading", { name: "Local — short" }).locator("xpath=../../..");
	const finished = local.getByRole("img", { name: "Finished" }).locator("svg");
	await expect(finished).toHaveCSS("width", "12px");
	await expect(finished).toHaveCSS("height", "12px");

	await page.goto(appUrl("/components/blocks/agent-assignment"), { waitUntil: "domcontentloaded" });
	await page.locator("#preview").getByRole("button", { name: "Edit agents", exact: true }).click();
	const menu = page.locator('[aria-label="Agent assignment"]');
	for (const name of ["Finished", "Needs input", "Someone is using an agent. Only they can see the work."]) {
		const icon = menu.getByRole("button", { name, exact: true }).locator("svg");
		await expect(icon).toHaveCSS("width", "12px");
		await expect(icon).toHaveCSS("height", "12px");
	}
	const working = menu.getByRole("button", { name: "Working", exact: true }).locator('[data-slot="spinner"]');
	await expect(working).toHaveCSS("width", "16.75px");
	await expect(working).toHaveCSS("height", "16.75px");
});

test("cloud long metadata stays together before the lifecycle controls", async ({ page }) => {
	await page.goto(`${AGENT_SESSION_URL}#cloud-—-long`, { waitUntil: "domcontentloaded" });
	const cloudLong = page.getByRole("heading", { name: "Cloud — long" }).locator("xpath=../../..");
	const rows = cloudLong.locator('[data-testid^="agent-session-row-"]');
	await expect(rows).toHaveCount(7);

	for (const reducedMotion of ["no-preference", "reduce"] as const) {
		await page.emulateMedia({ reducedMotion });
		for (const viewportWidth of [1440, 900]) {
			await page.setViewportSize({ width: viewportWidth, height: 900 });
			for (const row of await rows.all()) {
				const timestamp = row.locator('span[title="Last update"]');
				await expect(timestamp).toBeVisible();
				const gaps = await timestamp.evaluate((node) => {
					const metadata = node.parentElement?.parentElement?.parentElement;
					if (metadata === null || metadata === undefined) throw new Error("Missing metadata line");
					const segments = Array.from(metadata.children);
					return segments.slice(1).map((segment, index) => {
						const previousContent = segments[index].lastElementChild;
						const separator = segment.firstElementChild;
						if (previousContent === null || separator === null) throw new Error("Missing metadata segment");
						return separator.getBoundingClientRect().left - previousContent.getBoundingClientRect().right;
					});
				});
				for (const gap of gaps) {
					expect(gap, `Metadata separates at ${viewportWidth}px (${reducedMotion})`).toBeGreaterThanOrEqual(3);
					expect(gap, `Metadata separates at ${viewportWidth}px (${reducedMotion})`).toBeLessThanOrEqual(5);
				}
			}
		}
	}
});

test("local long metadata keeps the full agent name visible", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(AGENT_SESSION_URL, { waitUntil: "domcontentloaded" });
	const localLong = page.getByRole("heading", { name: "Local — long" }).locator("xpath=../../..");

	for (const viewportWidth of [1440, 900]) {
		await page.setViewportSize({ width: viewportWidth, height: 900 });
		for (const [id, name] of [
			["lw-scope-thread", "Claude"],
			["lw-kickoff-killswitch-session", "Cursor"],
			["lw-night-suite-session", "Rovo"],
		] as const) {
			const labels = localLong.getByTestId(`agent-session-row-${id}`).locator(`span[title="${name}"]`);
			await expect(labels).toHaveCount(2);
			for (const label of await labels.all()) {
				await expect(label).toBeVisible();
				const width = await label.evaluate((node) => ({
					available: node.clientWidth,
					content: node.scrollWidth,
				}));
				expect(width.available, `${name} is truncated at ${viewportWidth}px`).toBeGreaterThanOrEqual(width.content);
			}
		}
	}
});

test("assignment metadata truncates before lifecycle and privacy controls", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/agent-assignment"), { waitUntil: "domcontentloaded" });
	const editAgents = page.locator("#preview").getByRole("button", { name: "Edit agents", exact: true });
	await editAgents.click();
	const rows = page.locator('[aria-label="Agent assignment"] article');
	await expect(rows).toHaveCount(4);

	for (const viewportWidth of [1440, 900]) {
		await page.setViewportSize({ width: viewportWidth, height: 900 });
		for (const row of await rows.all()) {
			const metadataEnd = await row.locator('span[title="Last update"]').boundingBox();
			const status = await row.getByRole("button", {
				name: /^(Working|Needs input|Finished|Someone is using an agent\. Only they can see the work\.)$/u,
			}).boundingBox();
			if (metadataEnd === null || status === null) {
				throw new Error("Session metadata and trailing control must be visible");
			}
			expect(metadataEnd.x + metadataEnd.width).toBeLessThanOrEqual(status.x - 4);
		}
		const longName = rows.filter({ hasText: "Release Notes Drafter" }).locator('span[title="Release Notes Drafter"]');
		const widths = await longName.evaluate((node) => ({ available: node.clientWidth, content: node.scrollWidth }));
		expect(widths.available).toBeGreaterThan(0);
		expect(widths.available).toBeLessThan(widths.content);
	}
});
