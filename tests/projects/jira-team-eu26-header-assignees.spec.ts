import { expect, test } from "@playwright/test";

test.use({ ignoreHTTPSErrors: true });
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const agentNames = ["Claude", "Jira Coding Agent", "Cursor"];

test("an open lanyard swaps content and position without replaying its entrance", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.goto(`${baseURL}/jira-team-eu26`, { waitUntil: "domcontentloaded" });
	const header = page.locator("header");
	await header.getByRole("button", { name: "Preview Claude", exact: true }).hover();
	const popup = page.locator('[data-slot="hover-card-content"]').filter({ has: page.locator('[data-slot="agent-lanyard"]') });
	await expect(popup).toBeVisible();
	const originalPopup = await popup.elementHandle();
	// Even a switch during the first entrance must immediately show the new card.
	await header.getByRole("button", { name: "Preview Jira Coding Agent", exact: true }).hover();
	await expect(popup.getByRole("heading", { name: "Jira Coding Agent", exact: true })).toBeVisible();
	expect(await popup.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
	expect(await popup.evaluate((element) => element.getAnimations().length)).toBe(0);
	await expect(popup.locator("mask circle")).toHaveAttribute("r", "154");
	await expect(popup.locator("mask circle")).toHaveCSS("opacity", "0");
	let previousGrid = await popup.locator('[data-slot="agent-lanyard-grid"]').elementHandle();
	await popup.evaluate((element) => {
		element.setAttribute("data-entrance-replays", "0");
		new MutationObserver((records) => {
			for (const record of records) {
				if (record.attributeName === "data-starting-style" && element.hasAttribute("data-starting-style")) {
					element.setAttribute("data-entrance-replays", String(Number(element.getAttribute("data-entrance-replays")) + 1));
				}
			}
		}).observe(element, { attributes: true, attributeFilter: ["data-starting-style"] });
	});

	for (const name of ["Cursor", "Claude", "Jira Coding Agent", "Cursor"]) {
		const avatar = header.getByRole("button", { name: `Preview ${name}`, exact: true });
		await avatar.hover();
		await expect(popup.getByRole("heading", { name, exact: true })).toBeVisible();
		expect(await popup.evaluate((element, original) => element === original, originalPopup)).toBe(true);
		expect(await popup.locator('[data-slot="agent-lanyard-grid"]').evaluate((element, previous) => element === previous, previousGrid)).toBe(false);
		await expect(popup).toHaveAttribute("data-entrance-replays", "0");
		await expect(popup).toHaveCSS("opacity", "1");
		await expect(popup).toHaveCSS("translate", "none");
		await expect(popup.locator('[data-slot="agent-lanyard-grid"]')).toHaveAttribute("data-animated", "true");
		await expect(popup.locator("mask circle")).toHaveAttribute("r", "154");
		await expect(popup.locator("mask circle")).toHaveCSS("opacity", "0");
		previousGrid = await popup.locator('[data-slot="agent-lanyard-grid"]').elementHandle();
		await expect(page.locator('[data-slot="agent-lanyard"]')).toHaveCount(1);
		await expect.poll(async () => {
			const anchorBounds = (await avatar.boundingBox())!;
			const popupBounds = (await popup.boundingBox())!;
			return Math.abs(anchorBounds.x + anchorBounds.width / 2 - popupBounds.x - popupBounds.width / 2);
		}).toBeLessThan(1);
	}
	await page.keyboard.press("Escape");
	await expect(popup).toBeHidden();
});

for (const width of [1200, 1600]) {
	for (const reducedMotion of ["no-preference", "reduce"] as const) {
		test(`header lanyards center on their avatars at ${width}px with motion=${reducedMotion}`, async ({ page }) => {
			await page.setViewportSize({ width, height: 1000 });
			await page.emulateMedia({ reducedMotion });
			await page.goto(`${baseURL}/jira-team-eu26`, { waitUntil: "domcontentloaded" });
			const header = page.locator("header");
			await expect(header.getByRole("button", { name: "Preview Claude", exact: true })).toBeVisible();
			await expect(header.getByRole("button", { name: "Filter board by Codex", exact: true })).toHaveCount(0);
			await expect(header.getByRole("button", { name: "Filter board by GitHub Copilot", exact: true })).toHaveCount(0);
			const overlayShadow = await page.evaluate(() => {
				const probe = document.createElement("div");
				probe.style.boxShadow = "var(--ds-shadow-overlay)";
				document.body.append(probe);
				const shadow = getComputedStyle(probe).boxShadow;
				probe.remove();
				const startTimes = new WeakMap<Element, number>();
				new MutationObserver((records) => {
					for (const { target, attributeName, oldValue } of records) {
						if (target instanceof HTMLElement && target.dataset.slot === "hover-card-content" && attributeName === "data-starting-style" && oldValue !== null && !target.hasAttribute("data-starting-style")) {
							target.dataset.measuredEntrance = JSON.stringify(target.getAnimations().filter((animation) => animation instanceof CSSTransition).map((animation) => ({
								property: (animation as CSSTransition).transitionProperty,
								duration: animation.effect?.getTiming().duration,
								frames: animation.effect instanceof KeyframeEffect ? animation.effect.getKeyframes() : [],
							})));
						}
						if (!(target instanceof SVGCircleElement)) continue;
						const grid = target.closest<SVGElement>('[data-slot="agent-lanyard-grid"]');
						const radius = Number(target.getAttribute("r"));
						if (!grid || radius <= 0) continue;
						if (!startTimes.has(target)) startTimes.set(target, performance.now());
						if (radius >= 153) {
							grid.dataset.measuredWaveDuration = String(performance.now() - startTimes.get(target)!);
						}
					}
				}).observe(document.body, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ["r", "data-starting-style"] });
				return shadow;
			});

			for (const name of agentNames) {
				const trigger = header.getByRole("button", { name: `Preview ${name}`, exact: true });
				await trigger.hover();
				const card = page.getByRole("article", { name: `${name} agent`, exact: true });
				await expect(card).toBeVisible();
				await expect(card.getByRole("button", { name: `Chat with ${name}`, exact: true })).toBeDisabled();
				await expect(card.getByRole("button", { name: `More actions for ${name}`, exact: true })).toBeDisabled();
				const popup = page.locator('[data-slot="hover-card-content"]').filter({ has: card });
				await expect(popup).toHaveCSS("box-shadow", overlayShadow);
				await expect(card.locator('[data-slot="agent-lanyard-surface"]')).toHaveCSS("border-top-width", "0px");
				await expect(card.locator('[data-slot="agent-lanyard-surface"]')).toHaveCSS("box-shadow", /^(?:none|(?:rgba\(0, 0, 0, 0\)[^,]*(?:, )?)+)$/);
				if (reducedMotion === "no-preference") {
					await expect.poll(async () => {
						const transitions = JSON.parse(await popup.getAttribute("data-measured-entrance") ?? "[]") as { property: string; duration: number; frames: Record<string, unknown>[] }[];
						return transitions.map(({ property, duration, frames }) => ({ property, duration, start: frames[0]?.[property] }));
					}).toEqual([
						{ property: "opacity", duration: 150, start: "0" },
						{ property: "translate", duration: 150, start: "0px -8px" },
					]);
				} else {
					await expect(popup).toHaveCSS("transition-property", "none");
				}
				await expect(card).toHaveAttribute("data-perspective-tilt", "false");
				await expect(card.locator('[data-slot="agent-lanyard-grid"]')).toHaveAttribute("data-animated", String(reducedMotion === "no-preference"));
				await expect.poll(async () => {
					const avatarBounds = (await trigger.boundingBox())!;
					const cardBounds = (await card.boundingBox())!;
					return Math.abs(avatarBounds.x + avatarBounds.width / 2 - cardBounds.x - cardBounds.width / 2);
				}).toBeLessThan(1);
				await expect(card.locator('[data-slot="agent-lanyard-surface"]')).toHaveCSS("transform", "none");
				if (reducedMotion === "no-preference") {
					// Protect the original 600ms wave from becoming a 150ms flash.
					await expect.poll(async () => Number(await card.locator('[data-slot="agent-lanyard-grid"]').getAttribute("data-measured-wave-duration"))).toBeGreaterThan(350);
				}
				// The pointer can enter and read the card without dismissing it.
				await card.hover();
				await expect(card).toBeVisible();
				await expect(card.locator('[data-slot="agent-lanyard-surface"]')).toHaveCSS("box-shadow", /^(?:none|(?:rgba\(0, 0, 0, 0\)[^,]*(?:, )?)+)$/);
				await page.keyboard.press("Escape");
				await expect(card).toBeHidden();
				await page.mouse.move(width - 20, 140);
				// Keyboard focus reveals the same preview and repeats the reveal wave.
				await trigger.focus();
				await page.keyboard.press("Shift+Tab");
				await page.keyboard.press("Tab");
				await expect(card).toBeVisible();
				await expect(card.locator('[data-slot="agent-lanyard-grid"]')).toHaveAttribute("data-animated", String(reducedMotion === "no-preference"));
				if (reducedMotion === "reduce") {
					await expect(card.locator("mask circle")).toHaveAttribute("r", "0");
				}
				await page.keyboard.press("Escape");
				await expect(card).toBeHidden();
				await trigger.blur();
			}

			for (const name of ["Venn", "Diego Santos", "Priya Raman"]) {
				const person = header.getByRole("button", { name: `Filter board by ${name}`, exact: true });
				await person.hover();
				await expect(page.locator('[data-slot="tooltip-content"]')).toHaveText(name);
				await expect(page.locator('[data-slot="agent-lanyard"]')).toHaveCount(0);
				await page.mouse.move(width - 20, 140);
				await expect(page.locator('[data-slot="tooltip-content"]')).toBeHidden();
			}
			const human = header.getByRole("button", { name: "Filter board by Diego Santos", exact: true });
			await human.focus();
			await page.keyboard.press("Shift+Tab");
			await page.keyboard.press("Tab");
			await expect(page.locator('[data-slot="tooltip-content"]')).toHaveText("Diego Santos");
			await human.click();
			await expect(human).toHaveAttribute("aria-pressed", "true");
			await human.click();
			await expect(human).toHaveAttribute("aria-pressed", "false");
			const claudePreview = header.getByRole("button", { name: "Preview Claude", exact: true });
			await claudePreview.click();
			await expect(claudePreview).not.toHaveAttribute("aria-pressed");
			await expect(page.getByRole("button", { name: /^PAY-105:/ })).toBeVisible();
		});
	}
}
