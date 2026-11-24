import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test("third-party session lanyards show a centered, legible brand mark", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/agent-session"));
	const cloud = page.getByRole("region", { name: "Cloud sessions" });
	for (const brand of ["Canva", "Figma"]) {
		await cloud.getByRole("button", { name: `Preview ${brand}`, exact: true }).hover();
		const lanyard = page.locator(`[data-agent-id="${brand.toLowerCase()}"]`).filter({ visible: true });
		const frame = lanyard.locator('[data-slot="agent-lanyard-avatar"]');
		const logo = frame.locator("svg");
		await expect(logo).toBeVisible();
		const [frameBox, logoBox] = await Promise.all([frame.boundingBox(), logo.boundingBox()]);
		if (!frameBox || !logoBox) throw new Error(`${brand} lanyard avatar must be visible`);
		expect(logoBox.width).toBeGreaterThanOrEqual(32);
		expect(logoBox.width).toBeLessThanOrEqual(frameBox.width);
		expect(Math.abs((logoBox.x + logoBox.width / 2) - (frameBox.x + frameBox.width / 2))).toBeLessThan(1);
		expect(Math.abs((logoBox.y + logoBox.height / 2) - (frameBox.y + frameBox.height / 2))).toBeLessThan(1);
	}
});

test("avatar is centered below the lanyard hole", { tag: "@smoke" }, async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/agent-lanyard"));
	// Claude appears in the agent card, both recommendations, and the MCP setup card.
	const cards = page.locator('[data-agent-id="claude"]');
	await expect(cards).toHaveCount(4);
	for (const card of await cards.all()) {
		const variant = await card.getAttribute("data-variant");
		const cover = await card.locator('[data-slot="agent-lanyard-cutout"]').locator("..").boundingBox();
		const avatar = await card.locator('[data-slot="agent-lanyard-avatar"]').boundingBox();
		expect(cover, `${variant} cover`).not.toBeNull();
		expect(avatar, `${variant} avatar`).not.toBeNull();
		if (!cover || !avatar) return;
		expect(avatar.y + avatar.height / 2, variant ?? "").toBeCloseTo(cover.y + (16 + cover.height) / 2, 1);
		if (variant === "agent") {
			const [outer, surface] = await Promise.all([card.boundingBox(), card.locator('[data-slot="agent-lanyard-surface"]').boundingBox()]);
			if (!outer || !surface) throw new Error("The lanyard surface must be visible");
			expect(outer.y).toBeCloseTo(surface.y, 1);
			expect(outer.y + outer.height).toBeCloseTo(surface.y + surface.height, 1);
		}
	}
});

test("lanyard slots reveal the surface behind every card throughout the chin entrance", async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/agent-lanyard"));
	const cards = page.locator('article[data-agent-id="claude"]');
	await expect(cards).toHaveCount(4);
	for (const card of await cards.all()) {
		await card.evaluate((element) => {
			const outer = element.closest('[data-slot="agent-lanyard-mcp-setup"]') ?? element;
			if (outer.parentElement) outer.parentElement.style.backgroundColor = "rgb(255, 0, 255)";
		});
		const chin = card.locator(".agent-lanyard-chin");
		const times = await chin.count() ? [0, 125, 250] : [null];
		for (const time of times) {
			if (time !== null) await chin.evaluate((element, at) => {
				const animation = element.getAnimations()[0];
				if (!animation) throw new Error("Chin entrance animation is missing");
				animation.pause();
				animation.currentTime = at;
			}, time);
			const screenshot = await card.locator('[data-slot="agent-lanyard-cutout"]').screenshot();
			const pixel = await page.evaluate(async (base64) => {
				const image = new Image();
				image.src = `data:image/png;base64,${base64}`;
				await image.decode();
				const canvas = document.createElement("canvas");
				canvas.width = image.width;
				canvas.height = image.height;
				const context = canvas.getContext("2d");
				if (!context) throw new Error("Canvas context unavailable");
				context.drawImage(image, 0, 0);
				return Array.from(context.getImageData(Math.floor(image.width / 2), Math.floor(image.height / 2), 1, 1).data);
			}, screenshot.toString("base64"));
			expect(pixel).toEqual([255, 0, 255, 255]);
			if (time === 0) {
				const fullCard = await card.screenshot();
				const bottom = await page.evaluate(async (base64) => {
					const image = new Image();
					image.src = `data:image/png;base64,${base64}`;
					await image.decode();
					const canvas = document.createElement("canvas");
					canvas.width = image.width;
					canvas.height = image.height;
					const context = canvas.getContext("2d");
					if (!context) throw new Error("Canvas context unavailable");
					context.drawImage(image, 0, 0);
					return Array.from(context.getImageData(Math.floor(image.width / 2), image.height - 4, 1, 1).data);
				}, fullCard.toString("base64"));
				expect(bottom).toEqual([255, 0, 255, 255]);
			}
		}
	}
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`Butter picker keeps the lanyard cutout and card bounds correct when switching agents (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.setViewportSize({ width: 1600, height: 1000 });
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("button", { name: "Select Board", exact: true }).click();
		await page.getByRole("button", { name: "Close gallery" }).click();
		await page.locator('[data-issue-key="PAY-118"][data-board-column-title]').getByRole("button", { name: "Add agent to PAY-118" }).focus();
		await page.keyboard.press("Enter");
		await page.evaluate(() => {
			const backdrop = document.createElement("div");
			backdrop.style.cssText = "position:fixed;inset:0;z-index:699;background:rgb(255,0,255);pointer-events:none";
			document.body.append(backdrop);
		});
		for (const [index, [name, id]] of [["Claude (Recommended)", "claude"], ["Jira Coding Agent", "jira-coding"], ["Cursor", "cursor"], ["Claude (Recommended)", "claude"]].entries()) {
			const trigger = page.getByRole("button", { name, exact: true });
			if (index === 0) await trigger.hover();
			await trigger.focus();
			if (index === 0) await page.mouse.move(1, 1);
			const card = page.locator(`article[data-agent-id="${id}"]`).filter({ visible: true });
			await expect(card).toBeVisible();
			const popup = card.locator('xpath=ancestor::*[@data-slot="hover-card-content"]');
			await expect(popup).toHaveCSS("opacity", "1");
			await expect(popup).toHaveCSS("box-shadow", /^(none|rgba\(0, 0, 0, 0\))/u);
			const surface = card.locator('[data-slot="agent-lanyard-surface"]');
			const [outer, inner, overlay] = await Promise.all([card.boundingBox(), surface.boundingBox(), popup.boundingBox()]);
			if (!outer || !inner || !overlay) throw new Error("The lanyard and its popup must be visible");
			for (const rect of [inner, overlay]) {
				expect(Math.abs(outer.y - rect.y), `${name} top`).toBeLessThan(1);
				expect(Math.abs(outer.y + outer.height - rect.y - rect.height), `${name} bottom`).toBeLessThan(1);
			}
			const chin = card.locator(".agent-lanyard-chin");
			if (id === "claude" && reducedMotion === "no-preference") {
				await chin.evaluate((element) => {
					const animation = element.getAnimations()[0];
					if (!animation) throw new Error("Chin entrance animation is missing");
					animation.pause();
					animation.currentTime = 0;
				});
				const bottom = await page.screenshot({ clip: { x: Math.floor(outer.x + outer.width / 2), y: Math.floor(outer.y + outer.height - 4), width: 1, height: 1 } });
				const pixel = await page.evaluate(async (base64) => {
					const img = new Image();
					img.src = `data:image/png;base64,${base64}`;
					await img.decode();
					const canvas = document.createElement("canvas");
					canvas.width = img.width;
					canvas.height = img.height;
					const context = canvas.getContext("2d");
					if (!context) throw new Error("Canvas context unavailable");
					context.drawImage(img, 0, 0);
					return Array.from(context.getImageData(0, 0, 1, 1).data);
				}, bottom.toString("base64"));
				expect(pixel, "No stationary card beneath the entering chin").toEqual([255, 0, 255, 255]);
				await chin.evaluate((element) => { const animation = element.getAnimations()[0]; if (animation) animation.currentTime = 250; });
			}
			const slot = card.locator('[data-slot="agent-lanyard-cutout"]');
			const bounds = await slot.boundingBox();
			if (!bounds) throw new Error("The lanyard cutout must be visible");
			const image = await page.screenshot({ clip: bounds });
			const pixels = await page.evaluate(async (base64) => {
				const img = new Image();
				img.src = `data:image/png;base64,${base64}`;
				await img.decode();
				const canvas = document.createElement("canvas");
				canvas.width = img.width;
				canvas.height = img.height;
				const context = canvas.getContext("2d");
				if (!context) throw new Error("Canvas context unavailable");
				context.drawImage(img, 0, 0);
				return [0.2, 0.5, 0.8].map((fraction) => Array.from(context.getImageData(Math.floor(img.width * fraction), Math.floor(img.height / 2), 1, 1).data));
			}, image.toString("base64"));
			for (const pixel of pixels) expect(pixel, `${name} cutout`).toEqual([255, 0, 255, 255]);
		}
	});
}

test("the MCP setup prompt wraps its URLs, scrolls vertically, and confirms copy", async ({ context, page }) => {
	await context.grantPermissions(["clipboard-write"], { origin: new URL(appUrl("/")).origin });
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(appUrl("/components/blocks/agent-lanyard"));
	await page.getByRole("button", { name: "Close sidebar", exact: true }).click();
	const setup = page.getByRole("region", { name: "Atlassian MCP setup", exact: true });
	const prompt = setup.locator("pre");
	await expect(prompt).toBeVisible();
	await expect.poll(() => prompt.evaluate((element) => ({
		horizontalOverflow: element.scrollWidth - element.clientWidth,
		verticalOverflow: element.scrollHeight > element.clientHeight,
	}))).toEqual({ horizontalOverflow: 0, verticalOverflow: true });
	await expect(prompt).toHaveCSS("overflow-x", "hidden");
	await prompt.press("End");
	await expect.poll(() => prompt.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
	await setup.getByRole("button", { name: "Copy setup prompt" }).click();
	await expect(page.locator('[data-slot="tooltip-content"]').filter({ hasText: /^Prompt copied$/u })).toBeVisible();
});

test("card selection and built-in actions remain independently clickable", { tag: "@smoke" }, async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/agent-lanyard"));
	const card = page.locator('[data-agent-id="claude"][data-variant="agent"]');
	await card.getByRole("button", { name: "Chat with Claude" }).click({ timeout: 5000 });
	await expect(page.locator('[data-slot="agent-lanyard-demo"]').getByRole("status")).toHaveText("Selected: Chat with Claude");
	await card.getByRole("button", { name: "More actions for Claude" }).click();
	await expect(page.getByRole("menuitem", { name: "View profile" })).toBeVisible();
	await page.keyboard.press("Escape");
	await card.getByRole("button", { name: "View Claude" }).click();
	await expect(page.getByRole("dialog")).toBeVisible();
	await expect(page.getByRole("dialog").getByRole("heading", { name: "Claude" })).toBeVisible();
});
