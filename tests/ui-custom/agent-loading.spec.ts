import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

const AGENT_LOADING_URL = appUrl("/components/ui-custom/agent-loading");

test("vertical variation cycles through agents and respects reduced motion", async ({ page }) => {
	await page.goto(AGENT_LOADING_URL, { waitUntil: "domcontentloaded" });
	const vertical = page.locator(".agent-loading-vertical");
	await expect(vertical).toBeVisible();
	const seen = new Set<string>();
	await expect.poll(async () => {
		const ids = await vertical.locator("[data-agent-id]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-agent-id")));
		for (const id of ids) if (id) seen.add(id);
		return seen.size;
	}, { timeout: 9_000, intervals: [200] }).toBe(3);
	await expect(vertical.locator(".agent-loading-vertical-mask")).toHaveCSS("mask-image", /linear-gradient/);

	await page.emulateMedia({ reducedMotion: "reduce" });
	await expect(vertical).toHaveAttribute("data-reduced-motion", "true");
	await expect(vertical.locator("[data-agent-id]")).toHaveCount(1);
	const agent = await vertical.locator("[data-agent-id]").getAttribute("data-agent-id");
	await page.waitForTimeout(2_700);
	await expect(vertical.locator("[data-agent-id]")).toHaveAttribute("data-agent-id", agent ?? "");
});

test("Claude avatars use the brand background and a white starburst", async ({ page }) => {
	await page.goto(AGENT_LOADING_URL, { waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: "4 agents", exact: true }).click();
	const claude = page.locator('[data-agent-id="claude"] [data-slot="avatar-hexagon-artwork"]').first();
	for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
		await page.setViewportSize(viewport);
		await expect(claude.locator(":scope > span").first()).toHaveCSS("background-color", "rgb(217, 119, 87)");
		await expect(claude.locator("svg")).toHaveCSS("filter", "brightness(0) invert(1)");
		const cursor = page.locator('[data-agent-id="cursor"] [data-slot="avatar-hexagon-artwork"]').first();
		await expect(cursor.locator(":scope > span").first()).not.toHaveCSS("background-color", "rgb(217, 119, 87)");
	}
});

test("the live demo can cycle two, three, and four agents", async ({ page }) => {
	await page.goto(AGENT_LOADING_URL, { waitUntil: "domcontentloaded" });

	const demo = page.getByRole("status").filter({ hasText: "Needs input" }).first();
	await expect(demo).toContainText("3 agents working");

	await page.getByRole("button", { name: "2 agents" }).click();
	await expect(page.getByRole("status").filter({ hasText: "Needs input" }).first()).toContainText(
		"2 agents working",
	);

	await page.getByRole("button", { name: "4 agents" }).click();
	await expect(page.getByRole("status").filter({ hasText: "Needs input" }).first()).toContainText(
		"4 agents working",
	);
});

test("adding and replaying an agent shows the Butter handoff before cycling", async ({ page }) => {
	await page.goto(AGENT_LOADING_URL, { waitUntil: "domcontentloaded" });
	const demo = page.getByRole("status").filter({ hasText: "Needs input" }).first();
	await page.getByRole("button", { name: "Add Claude" }).click();
	await expect(demo).toContainText("4 agents working. Claude");
	const claude = demo.locator('[data-agent-id="claude"][data-agent-loading-slot="front"]');
	await expect(claude.locator(".agent-loading-intro-front")).toHaveAttribute("data-agent-loading-intro-size", "20");
	await expect(page.getByRole("button", { name: "Replay Claude" })).toBeFocused();
	await page.getByRole("button", { name: "Replay Rovo" }).click();
	await expect(demo).toContainText("4 agents working. Rovo");
	await expect(demo.locator('[data-agent-id="rovo"][data-agent-loading-slot="front"] .agent-loading-intro-front')).toHaveAttribute("data-agent-loading-intro-size", "24");
	await expect(demo.locator(".agent-loading-intro-front")).toHaveCount(0, { timeout: 3_000 });
	await expect(demo.locator('[data-agent-loading-slot="front"]:not([data-agent-id="rovo"])')).toHaveCount(1, { timeout: 4_000 });
});

test("adding an agent honors reduced motion", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(AGENT_LOADING_URL, { waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: "Add Claude" }).click();
	const demo = page.getByRole("status").filter({ hasText: "Needs input" }).first();
	await expect(demo).toContainText("4 agents working. Claude");
	await expect(demo.locator(".agent-loading")).toHaveAttribute("data-reduced-motion", "true");
	await expect(demo.locator(".agent-loading-intro-front")).toHaveCount(0);
});

test("two avatars stay visible while three and four agents rotate through", async ({ page }) => {
	test.setTimeout(45_000);
	await page.goto(AGENT_LOADING_URL, { waitUntil: "domcontentloaded" });
	const loading = page.getByRole("status").filter({ hasText: "Needs input" }).first().locator(".agent-loading");
	for (const slot of ["front", "back"]) {
		await expect(loading.locator(`[data-agent-loading-slot="${slot}"]`)).toHaveCSS("opacity", /^(1|0\.8)$/);
	}
	await expect(loading.locator('[data-agent-loading-slot="hidden"]')).toHaveCSS("opacity", "0");
	const threeSeen = new Set<string>();
	await expect.poll(async () => {
		const id = await loading.locator('[data-agent-loading-slot="front"]').last().getAttribute("data-agent-id");
		if (id) threeSeen.add(id);
		return threeSeen.size;
	}, { timeout: 12_000, intervals: [300] }).toBe(3);

	await page.getByRole("button", { name: "4 agents" }).click();
	const seen = new Set<string>();
	await expect.poll(async () => {
		const id = await loading.locator('[data-agent-loading-slot="front"]').last().getAttribute("data-agent-id");
		if (id) seen.add(id);
		return seen.size;
	}, { timeout: 15_000, intervals: [300] }).toBe(4);
	for (const slot of ["front", "back"]) {
		await expect(loading.locator(`[data-agent-loading-slot="${slot}"]`).last()).toHaveCSS("opacity", /^(1|0\.8)$/);
	}
	await expect(loading.locator('[data-agent-loading-slot="hidden"]').last()).toHaveCSS("opacity", "0");
});

test("rotation follows the original back-to-front sequence and coordinated fade", async ({ page }) => {
	await page.goto(AGENT_LOADING_URL, { waitUntil: "domcontentloaded" });
	const loading = page.getByRole("status").filter({ hasText: "Needs input" }).first().locator(".agent-loading");
	for (const count of [2, 3, 4]) {
		await page.getByRole("button", { name: `${count} agents` }).click();
		const previousBack = await loading.locator('[data-agent-loading-slot="back"]').getAttribute("data-agent-id");
		const motion = await loading.evaluate(async (element, agentCount) => {
			const start = performance.now();
			let faded = false;
			let coordinated = false;
			let restHasTwo = true;
			const frontAgents = new Set<string>();
			while (performance.now() - start < 3_100) {
				const avatars = [...element.querySelectorAll<HTMLElement>("[data-agent-loading-slot]")];
				const opacities = avatars
					.map((avatar) => Number(getComputedStyle(avatar).opacity));
				const front = avatars.find((avatar) => avatar.dataset.agentLoadingSlot === "front");
				if (front?.dataset.agentId) frontAgents.add(front.dataset.agentId);
				if (element.getAttribute("data-swapping") === "true") {
					const partial = opacities.filter((opacity) => agentCount === 2 ? opacity > 0.81 && opacity < 0.99 : opacity > 0.05 && opacity < 0.75);
					faded ||= partial.length > 0;
					coordinated ||= partial.length > 1;
				} else {
					restHasTwo &&= opacities.filter((opacity) => opacity > 0.01).length === 2;
				}
				await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
			}
			return { frontAgents: [...frontAgents], faded, coordinated, restHasTwo };
		}, count);
		expect(motion.faded).toBe(true);
		expect(motion.coordinated).toBe(true);
		expect(motion.restHasTwo).toBe(true);
		expect(motion.frontAgents).toContain(previousBack);
	}
});

test("a live reduced-motion preference stops Agent Loading before it resumes", async ({ page }) => {
	await page.goto(AGENT_LOADING_URL, { waitUntil: "domcontentloaded" });

	const activeStatus = page.getByRole("status").filter({ hasText: "Needs input" }).first();
	const finishButton = page.getByRole("button", { name: "Finish all agents" });
	await expect(activeStatus).toHaveCount(1);

	await finishButton.focus();
	await page.keyboard.press("Enter");
	await expect(page.getByRole("button", { name: "Resume agents" })).toBeFocused();

	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.evaluate(() => new Promise<void>((resolve) =>
		requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
	));
	await page.getByRole("button", { name: "Resume agents" }).press("Enter");

	const resumedStatus = page.getByRole("status").filter({ hasText: "Needs input" }).first();
	const loading = resumedStatus.locator(".agent-loading");
	await expect(loading).toHaveAttribute("data-reduced-motion", "true");
	const frontAvatar = resumedStatus.locator('[data-agent-loading-slot="front"]');
	const initialFrontAgentId = await frontAvatar.getAttribute("data-agent-id");
	await page.waitForTimeout(2_300);

	expect(await frontAvatar.getAttribute("data-agent-id")).toBe(initialFrontAgentId);
	expect(await loading.getAttribute("data-swapping")).not.toBe("true");
});

test("re-enabling motion after an interrupted swap does not resurface a mid-flight layout", async ({ page }) => {
	await page.clock.install();
	await page.goto(AGENT_LOADING_URL, { waitUntil: "domcontentloaded" });

	const cycling = page
		.getByRole("status")
		.filter({ hasText: "Needs input" })
		.first()
		.locator(".agent-loading");
	await expect(cycling).toHaveAttribute("data-cycling", "true");

	await expect(async () => {
		await page.clock.runFor(50);
		expect(await cycling.getAttribute("data-swapping")).toBe("true");
	}).toPass({ timeout: 30_000 });

	await page.emulateMedia({ reducedMotion: "reduce" });
	await expect.poll(async () => cycling.getAttribute("data-swapping")).not.toBe("true");

	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.waitForTimeout(1_000);

	expect(await cycling.getAttribute("data-swapping")).not.toBe("true");
});
