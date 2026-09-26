import { expect, test } from "@playwright/test";

const AGENT_LOADING_URL = `${
	process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"
}/components/ui-custom/agent-loading`;

test("Claude avatars use the brand background and a white starburst", async ({ page }) => {
	await page.goto(AGENT_LOADING_URL, { waitUntil: "domcontentloaded" });
	await page.getByRole("button", { name: "4 agents", exact: true }).click();
	const claude = page.locator('[data-agent-id="claude"] [data-slot="avatar-hexagon-artwork"]').first();
	for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
		await page.setViewportSize(viewport);
		await expect(claude.locator(":scope > span")).toHaveCSS("background-color", "rgb(217, 119, 87)");
		await expect(claude.locator("svg")).toHaveCSS("filter", "brightness(0) invert(1)");
		const cursor = page.locator('[data-agent-id="cursor"] [data-slot="avatar-hexagon-artwork"]').first();
		await expect(cursor.locator(":scope > span")).not.toHaveCSS("background-color", "rgb(217, 119, 87)");
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
