import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });

test("collapsed nudges share the front shape and reveal their content widths on hover", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/rovo-button#proactive-suggestion"));
	const example = page.locator("#proactive-suggestion");
	const launcher = example.getByRole("button", { name: "Show proactive suggestion demo" });
	for (let index = 0; index < 4; index += 1) await launcher.click();
	const stack = example.getByRole("region", { name: "Rovo suggestions" });
	const cards = stack.locator('button[aria-label^="Dismiss "]');
	await expect(cards).toHaveCount(4);
	await expect.poll(() => cards.evaluateAll((buttons) => {
		const [front, middle, back] = buttons.map((button) => button.parentElement!.firstElementChild!.getBoundingClientRect());
		return Math.abs((middle.left - front.left) - (front.right - middle.right)) < 1
			&& Math.abs((back.left - front.left) - (front.right - back.right)) < 1
			&& Math.abs(middle.width / front.width - 0.95) < 0.01
			&& Math.abs(back.width / front.width - 0.9) < 0.01
			&& Math.abs(new DOMMatrix(getComputedStyle(buttons[1].parentElement!).transform).m42 + 14) < 1
			&& Math.abs(new DOMMatrix(getComputedStyle(buttons[2].parentElement!).transform).m42 + 28) < 1
			&& getComputedStyle(buttons[1]).opacity === "0";
	})).toBe(true);
	await example.getByRole("button", { name: "Draft a status update", exact: true }).hover();
	await expect.poll(() => cards.evaluateAll((buttons) => {
		const [front, middle, back] = buttons.map((button) => button.parentElement!.getBoundingClientRect());
		return Math.abs(front.right - middle.right) < 1 && Math.abs(front.right - back.right) < 1
			&& middle.width > front.width && back.width > front.width
			&& Math.abs((front.top - middle.top) - 54) < 1
			&& Math.abs((front.top - back.top) - 108) < 1
			&& getComputedStyle(buttons[1]).opacity === "1";
	})).toBe(true);
});

test("a long expanded nudge stack grows without an internal scroll area", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/rovo-button#proactive-suggestion"));
	const example = page.locator("#proactive-suggestion");
	const launcher = example.getByRole("button", { name: "Show proactive suggestion demo" });
	for (let index = 0; index < 10; index += 1) await launcher.click();
	const stack = example.getByRole("region", { name: "Rovo suggestions" });
	const dismissButtons = stack.getByRole("button", { name: /^Dismiss / });
	await expect(dismissButtons).toHaveCount(10);
	await stack.getByRole("button", { name: "Review the project timeline" }).first().hover();
	await expect.poll(() => stack.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThan(320);
	await expect.poll(() => stack.evaluate((element) => Array.from(element.querySelectorAll("*")).some((child) => {
			const style = getComputedStyle(child);
			return ["auto", "scroll"].includes(style.overflowY) && child.scrollHeight > child.clientHeight;
	}))).toBe(false);
});

test("card labels stay untruncated while the stack collapses", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/rovo-button#proactive-suggestion"));
	const example = page.locator("#proactive-suggestion");
	const launcher = example.getByRole("button", { name: "Show proactive suggestion demo" });
	for (let index = 0; index < 4; index += 1) await launcher.click();
	await example.getByRole("button", { name: "Draft a status update", exact: true }).hover();
	const label = example.locator('button[aria-label="Review the project timeline"] span.truncate');
	await expect(label).toBeVisible();
	await expect.poll(() => label.evaluate((element) => getComputedStyle(element.parentElement!).opacity)).toBe("1");
	await label.evaluate((element) => {
		const frames: { opacity: number; clipped: boolean }[] = [];
		const end = performance.now() + 700;
		const sample = () => {
			frames.push({ opacity: Number(getComputedStyle(element.parentElement!).opacity), clipped: element.scrollWidth > element.clientWidth + 1 });
			if (performance.now() < end) requestAnimationFrame(sample);
			else element.setAttribute("data-motion-samples", JSON.stringify(frames));
		};
		requestAnimationFrame(sample);
	});
	await page.mouse.move(10, 100);
	await expect(label).toHaveAttribute("data-motion-samples", /\[/u);
	const frames: { opacity: number; clipped: boolean }[] = JSON.parse(await label.getAttribute("data-motion-samples") ?? "[]");
	expect(frames.some((frame) => frame.opacity > 0.1 && frame.opacity < 0.9)).toBe(true);
	expect(frames.some((frame) => frame.opacity > 0.1 && frame.clipped)).toBe(false);
});

test("the stack collapses when the pointer leaves after dismissing a nudge", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/rovo-button#proactive-suggestion"));
	const example = page.locator("#proactive-suggestion");
	const launcher = example.getByRole("button", { name: "Show proactive suggestion demo" });
	for (let index = 0; index < 4; index += 1) await launcher.click();
	const stack = example.getByRole("region", { name: "Rovo suggestions" });
	await example.getByRole("button", { name: "Draft a status update", exact: true }).hover();
	await example.getByRole("button", { name: "Dismiss Review the project timeline" }).click();
	await page.mouse.move(10, 100);
	await expect.poll(() => stack.evaluate((element) => element.getBoundingClientRect().height)).toBe(40);
});

test("keyboard focus expands the stack until focus leaves", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/rovo-button#proactive-suggestion"));
	const example = page.locator("#proactive-suggestion");
	const launcher = example.getByRole("button", { name: "Show proactive suggestion demo" });
	for (let index = 0; index < 3; index += 1) await launcher.click();
	const stack = example.getByRole("region", { name: "Rovo suggestions" });
	await page.mouse.move(10, 100);
	await launcher.focus();
	await page.keyboard.press("Shift+Tab");
	await page.keyboard.press("Shift+Tab");
	await expect(example.getByRole("button", { name: "Dismiss Find outstanding decisions" })).toBeFocused();
	await expect.poll(() => stack.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThan(40);
	await page.keyboard.press("Shift+Tab");
	await page.keyboard.press("Shift+Tab");
	await expect.poll(() => stack.evaluate((element) => element.getBoundingClientRect().height)).toBe(40);
});
