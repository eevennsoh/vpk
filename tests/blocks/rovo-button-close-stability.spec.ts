import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

for (const variant of ["button", "dot"] as const) {
	test(`the Rovo launcher stays in place while the ${variant} panel closes`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "no-preference" });
		if (variant === "button") {
			await page.goto(appUrl("/butter-v1"));
			await page.getByRole("button", { name: "Select AI suggestions", exact: true }).click();
		} else await page.goto(appUrl("/components/blocks/rovo-button#notification-dot-transition"));
		const scope = variant === "dot" ? page.locator("#notification-dot-transition") : page.locator("body");
		const launcher = scope.getByRole("button", { name: "Review AI suggestions", exact: true });
		const review = scope.getByRole("button", { name: "Review suggestions", exact: true });
		await launcher.scrollIntoViewIfNeeded();
		await page.mouse.move(0, 0);
		await expect.poll(async () => Math.round((await launcher.boundingBox())?.width ?? 0)).toBe(48);
		const original = await launcher.evaluate((button) => {
			const bounds = button.getBoundingClientRect();
			const container = button.closest("#notification-dot-transition")?.getBoundingClientRect();
			return { x: bounds.x - (container?.x ?? 0), y: bounds.y - (container?.y ?? 0), width: bounds.width, height: bounds.height };
		});
		if (!original) throw new Error("Missing launcher");
		await review.click();
		const dialog = scope.getByRole("dialog", { name: /^Work item suggestions/ });
		await expect(dialog.getByRole("list", { name: "Suggestions" })).toBeVisible();
		const frames = page.evaluate((which) => new Promise<{ x: number; y: number; width: number; height: number; opacity: number; buttonOpacity: number; radius: number; filter: string; wrapperBackground: string; wrapperShadow: string }[]>((resolve) => {
			const samples: { x: number; y: number; width: number; height: number; opacity: number; buttonOpacity: number; radius: number; filter: string; wrapperBackground: string; wrapperShadow: string }[] = [];
			const start = performance.now();
			function sample() {
				const button = document.querySelector<HTMLElement>(`${which === "dot" ? "#notification-dot-transition " : ""}[aria-label="Review AI suggestions"]`);
				if (button) {
					const bounds = button.getBoundingClientRect();
					const container = button.closest("#notification-dot-transition")?.getBoundingClientRect();
					const wrapper = button.closest<HTMLElement>("[data-notification-launchers]");
					const style = getComputedStyle(button);
					let opacity = 1;
					for (let node: HTMLElement | null = button; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
					if (opacity > 0.05) samples.push({ x: bounds.x - (container?.x ?? 0), y: bounds.y - (container?.y ?? 0), width: bounds.width, height: bounds.height, opacity, buttonOpacity: Number(style.opacity), radius: parseFloat(style.borderTopLeftRadius), filter: style.filter, wrapperBackground: wrapper ? getComputedStyle(wrapper).backgroundColor : "rgba(0, 0, 0, 0)", wrapperShadow: wrapper ? getComputedStyle(wrapper).boxShadow : "none" });
				}
				if (performance.now() - start < 1500) requestAnimationFrame(sample);
				else resolve(samples);
			}
			requestAnimationFrame(sample);
		}), variant);
		await dialog.getByRole("button", { name: "Close suggestions" }).click();
		const samples = await frames;
		expect(samples.length).toBeGreaterThan(5);
		expect(samples.some((sample) => sample.opacity < 0.9)).toBe(true);
		expect(samples.some((sample) => sample.width < original.width - 1)).toBe(true);
		for (const sample of samples) {
			expect(Math.abs(sample.x + sample.width / 2 - original.x - original.width / 2)).toBeLessThan(2);
			expect(Math.abs(sample.y + sample.height / 2 - original.y - original.height / 2)).toBeLessThan(2);
			expect(sample.width).toBeGreaterThan(original.width * 0.91);
			expect(sample.width).toBeLessThan(original.width + 2);
			expect(sample.buttonOpacity).toBeGreaterThan(0.99);
			expect(Math.abs(sample.radius - 16)).toBeLessThan(0.5);
			expect(["none", "blur(0px)"]).toContain(sample.filter);
			expect(sample.wrapperBackground).toBe("rgba(0, 0, 0, 0)");
			expect(sample.wrapperShadow).toBe("none");
		}
	});
}

test("the notification controls remain anchored while the page scrolls during closing", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/components/blocks/rovo-button#notification-dot-transition"));
	const example = page.locator("#notification-dot-transition");
	const review = example.getByRole("button", { name: "Review suggestions", exact: true });
	const launcher = example.getByRole("button", { name: "Review AI suggestions", exact: true });
	await review.scrollIntoViewIfNeeded();
	await page.mouse.move(0, 0);
	await expect.poll(async () => Math.round((await launcher.boundingBox())?.width ?? 0)).toBe(48);
	const original = await example.evaluate((root) => {
		const container = root.getBoundingClientRect();
		return [...root.querySelectorAll<HTMLElement>('[aria-label="Review suggestions"], [aria-label="Review AI suggestions"]')].map((button) => {
			const rect = button.getBoundingClientRect();
			return { name: button.getAttribute("aria-label"), x: rect.x + rect.width / 2 - container.x, y: rect.y + rect.height / 2 - container.y };
		});
	});
	await review.click();
	const dialog = example.getByRole("dialog", { name: /^Work item suggestions/ });
	await expect(dialog.getByRole("list", { name: "Suggestions" })).toBeVisible();
	const samples = await example.evaluate(async (root) => {
		const scroller = [...(function* () { for (let node: HTMLElement | null = root as HTMLElement; node; node = node.parentElement) yield node; })()].find((node) => node.scrollHeight > node.clientHeight + 100 && /auto|scroll/u.test(getComputedStyle(node).overflowY)) ?? document.scrollingElement as HTMLElement;
		const initialScroll = scroller.scrollTop;
		scroller.scrollTop += 80;
		const beforeClose = scroller.scrollTop;
		const frames: { name: string | null; x: number; y: number }[] = [];
		const start = performance.now();
		let scrolledDuringClose = false;
		(root.querySelector('[aria-label="Close suggestions"]') as HTMLElement).click();
		return await new Promise<{ initialScroll: number; beforeClose: number; finalScroll: number; frames: typeof frames }>((resolve) => {
			function sample() {
				const elapsed = performance.now() - start;
				if (elapsed >= 150 && !scrolledDuringClose) {
					scroller.scrollTop += 80;
					scrolledDuringClose = true;
				}
				const container = root.getBoundingClientRect();
				for (const button of root.querySelectorAll<HTMLElement>('[aria-label="Review suggestions"], [aria-label="Review AI suggestions"]')) {
					let opacity = 1;
					for (let node: HTMLElement | null = button; node && node !== root; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
					if (opacity < 0.05) continue;
					const rect = button.getBoundingClientRect();
					frames.push({ name: button.getAttribute("aria-label"), x: rect.x + rect.width / 2 - container.x, y: rect.y + rect.height / 2 - container.y });
				}
				if (elapsed < 1200) requestAnimationFrame(sample);
				else resolve({ initialScroll, beforeClose, finalScroll: scroller.scrollTop, frames });
			}
			requestAnimationFrame(sample);
		});
	});
	expect(samples.beforeClose).not.toBe(samples.initialScroll);
	expect(samples.finalScroll).not.toBe(samples.beforeClose);
	for (const item of original) {
		const frames = samples.frames.filter((frame) => frame.name === item.name);
		expect(frames.length).toBeGreaterThan(5);
		for (const frame of frames) {
			expect(Math.abs(frame.x - item.x)).toBeLessThan(3);
			expect(Math.abs(frame.y - item.y)).toBeLessThan(3);
		}
	}
});
