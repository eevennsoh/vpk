import { expect, test, type Locator } from "@playwright/test";

test.use({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });

async function waitForIssueSurfaceGeometry(surface: Locator) {
	await surface.evaluate((node) => new Promise<void>((resolve, reject) => {
		let previous = node.getBoundingClientRect();
		let stableFrames = 0, frames = 0;
		const sample = () => {
			const rect = node.getBoundingClientRect();
			stableFrames = Math.abs(rect.width - previous.width) < 0.01 && Math.abs(rect.height - previous.height) < 0.01 ? stableFrames + 1 : 0;
			previous = rect;
			if (stableFrames >= 3) resolve();
			else if (++frames >= 120) reject(new Error("Issue surface geometry did not settle"));
			else requestAnimationFrame(sample);
		};
		requestAnimationFrame(sample);
	}));
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	test(`native card preview leaves all rounded corner cutouts clear (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "https://26b9.localhost"}/preview/projects/jira-team-eu26`);
		await page.waitForLoadState("networkidle");
		await page.getByRole("button", { name: "Settings", exact: true }).click();
		await page.getByRole("menuitemcheckbox", { name: "Move visual", exact: true }).click();
		await page.keyboard.press("Escape");
		const card = page.locator('[data-issue-key="PAY-118"] [draggable]').first();
		const surface = card.locator('[data-slot="jira-issue-surface"]');
		const restingSurfaceColor = await surface.evaluate((node) => getComputedStyle(node).backgroundColor);
		await card.hover({ position: { x: 70, y: 30 } });
		const radius = await surface.evaluate((node) => getComputedStyle(node).borderRadius);
		const source = (await card.boundingBox())!;
		await page.mouse.move(source.x + 70, source.y + 30);
		await page.mouse.down();
		await page.mouse.move(source.x + 95, source.y + 35, { steps: 5 });
		const preview = page.locator('[data-issue-drag-preview]');
		await expect(preview).toHaveCount(1);
		await expect(preview).toHaveCSS("overflow", "hidden");
		await expect(preview).toHaveCSS("border-radius", radius);
		await expect(preview).toHaveCSS("box-shadow", "none");
		await expect(preview.locator('[data-slot="jira-issue-surface"]')).toHaveCSS("box-shadow", "none");
		await expect(preview.locator('[data-slot="jira-issue-surface"]')).toHaveCSS("background-color", restingSurfaceColor);
		await expect(preview.locator('[data-slot="jira-issue-agent-backdrop"]')).toHaveCount(0);
		await expect(preview).toHaveAttribute("aria-hidden", "true");
		await expect(preview).toHaveAttribute("inert", "");
		expect((await card.boundingBox())!.height).toBe(source.height);
		// Native drag images crop to this rectangle. Any shadow painted in its
		// rounded cutouts becomes a grey corner fragment in the captured bitmap.
		await preview.evaluate((node) => {
			const underlay = document.createElement("div");
			Object.assign(underlay.style, {
				position: "fixed", inset: "0", background: "rgb(255, 0, 255)",
				zIndex: "99998", pointerEvents: "none",
			});
			underlay.setAttribute("aria-hidden", "true");
			underlay.inert = true;
			document.body.append(underlay);
			Object.assign((node as HTMLElement).style, { left: "700px", top: "100px", zIndex: "99999" });
		});
		const bitmap = await preview.screenshot();
		const corners = await page.evaluate(async (encoded) => {
			const image = new Image();
			image.src = `data:image/png;base64,${encoded}`;
			await image.decode();
			const canvas = document.createElement("canvas");
			canvas.width = image.width;
			canvas.height = image.height;
			const context = canvas.getContext("2d")!;
			context.drawImage(image, 0, 0);
			return [
				[0, 3], [3, 0], [image.width - 1, 3], [image.width - 4, 0],
				[0, image.height - 4], [3, image.height - 1],
				[image.width - 1, image.height - 4], [image.width - 4, image.height - 1],
			]
				.map(([x, y]) => [...context.getImageData(x, y, 1, 1).data]);
		}, bitmap.toString("base64"));
		expect(corners).toEqual(Array.from({ length: 8 }, () => [255, 0, 255, 255]));
		await page.keyboard.press("Escape");
		await page.mouse.up();
		await expect(preview).toHaveCount(0);
	});

	for (const code of ["PAY-107", "PAY-123"]) {
		for (const selected of [false, true]) {
			test(`one ${selected ? "selected" : "unselected"} ${code} previews only its face (${reducedMotion})`, async ({ page }) => {
				await page.emulateMedia({ reducedMotion });
				await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "https://26b9.localhost"}/preview/blocks/jira-dragging`);
				await page.waitForLoadState("networkidle");
				const card = page.locator(`[data-issue-key="${code}"] [draggable]`).first();
				if (selected) await card.click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
				const source = card.locator('[data-slot="jira-issue-card"]');
				const restingSurfaceColor = await page.locator('[data-issue-key="PAY-130"] [data-slot="jira-issue-surface"]').evaluate((node) => getComputedStyle(node).backgroundColor);
				await waitForIssueSurfaceGeometry(source.locator('[data-slot="jira-issue-surface"]'));
				const face = (await source.locator('[data-slot="jira-issue-surface"]').boundingBox())!;
				const grab = (await card.boundingBox())!;
				await page.mouse.move(grab.x + 70, grab.y + 30);
				await page.mouse.down();
				await page.mouse.move(grab.x + 95, grab.y + 35, { steps: 5 });
				const preview = page.locator('[data-issue-cohort-preview]');
				await expect(preview).toHaveAttribute("data-issue-cohort-count", "1");
				await expect(preview).toHaveAttribute("aria-hidden", "true");
				await expect(preview).toHaveAttribute("inert", "");
				await expect(preview.locator('[data-slot="jira-issue-surface"]')).toHaveCSS("background-color", restingSurfaceColor);
				await expect(preview.locator('[data-slot="jira-issue-agent-backdrop"]')).toHaveCount(0);
				await expect(preview.locator('[data-issue-deck-layer], [data-slot="badge"], [data-slot="jira-issue-agent-row"]')).toHaveCount(0);
				await expect.poll(async () => {
					const outer = (await preview.boundingBox())!;
					const painted = (await preview.locator('[data-slot="jira-issue-surface"]').boundingBox())!;
					return [outer.x - painted.x, outer.y - painted.y, outer.width - painted.width, outer.height - painted.height].map((gap) => Math.abs(gap) < 0.5 ? 0 : Number(gap.toFixed(2)));
				}).toEqual([0, 0, 0, 0]);
				const bounds = (await preview.boundingBox())!;
				expect(bounds.width).toBeCloseTo(face.width, 1);
				expect(bounds.height).toBeCloseTo(face.height, 1);
				await page.mouse.move(1100, 750, { steps: 4 });
				if (code === "PAY-107" && !selected) await page.screenshot({ path: `output/agent-browser/single-card-preview/single-${reducedMotion}.png` });
				await page.keyboard.press("Escape");
				await page.mouse.up();
				await expect(preview).toHaveCount(0);
			});
		}
	}

	test(`multiple cards show white faces, deck and count (${reducedMotion})`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "https://26b9.localhost"}/preview/blocks/jira-dragging`);
		await page.waitForLoadState("networkidle");
		const card = (code: string) => page.locator(`[data-issue-key="${code}"] [draggable]`).first();
		for (const code of ["PAY-105", "PAY-123"]) await card(code).click({ position: { x: 70, y: 30 }, modifiers: ["Shift"] });
		await card("PAY-107").hover({ position: { x: 70, y: 30 } });
		const restingSurfaceColor = await page.locator('[data-issue-key="PAY-130"] [data-slot="jira-issue-surface"]').evaluate((node) => getComputedStyle(node).backgroundColor);
		const face = (await card("PAY-107").locator('[data-slot="jira-issue-surface"]').boundingBox())!;
		const bounds = (await card("PAY-107").boundingBox())!;
		await page.mouse.move(bounds.x + 70, bounds.y + 30);
		await page.mouse.down();
		await page.mouse.move(bounds.x + 95, bounds.y + 35, { steps: 5 });
		const preview = page.locator('[data-issue-cohort-preview]');
		await expect(preview).toHaveAttribute("data-issue-cohort-count", "3");
		await expect(preview.locator('[data-slot="jira-issue-agent-backdrop"]')).toHaveCount(0);
		for (const face of await preview.locator('[data-slot="jira-issue-surface"]').all()) await expect(face).toHaveCSS("background-color", restingSurfaceColor);
		await expect(preview.locator('[data-issue-deck-layer]')).toHaveCount(2);
		for (const sheet of await preview.locator('[data-issue-deck-layer]').all()) {
			await expect(sheet).toHaveCSS("background-color", restingSurfaceColor);
			await expect(sheet).toBeEmpty();
		}
		const lead = (await preview.locator('[data-issue-cohort-front]').boundingBox())!;
		expect(lead.width).toBeCloseTo(face.width, 1);
		expect(lead.height).toBeCloseTo(face.height, 1);
		await expect(preview.locator('[data-slot="badge"]')).toHaveText("3");
		await page.keyboard.press("Escape");
		await page.mouse.up();
		await expect(preview).toHaveCount(0);
	});
}
