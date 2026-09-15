import { expect, test } from "@playwright/test";

interface MorphFrame {
	agentSize: number;
	identity: { x: number; y: number; width: number; height: number };
	surface: { x: number; y: number; width: number; height: number };
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
	for (const firstMove of [4, 80]) {
		test(`session drag keeps avatar continuity: ${reducedMotion}, ${firstMove}px first move`, async ({ page }) => {
			await page.setViewportSize({ width: firstMove === 4 ? 1440 : 1100, height: 920 });
			await page.emulateMedia({ reducedMotion, colorScheme: firstMove === 4 ? "dark" : "light" });
			await page.addInitScript((theme) => localStorage.setItem("ui-theme", theme), firstMove === 4 ? "dark" : "light");
			await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"}/jira-team-eu26`);
			await expect(page.getByRole("heading", { name: "Jira Design" })).toBeVisible({ timeout: 15_000 });
			await expect(page.locator("html")).toHaveAttribute("data-color-mode", firstMove === 4 ? "dark" : "light");
			const expand = page.getByRole("button", { name: "Expand Unlink sessions column" });
			await expect(expand).toBeVisible();
			await expand.click();
			const session = page.locator("[data-agent-session-column]").getByTestId("agent-session-row-lw-scope-thread");
			const article = session.locator("article");
			await article.scrollIntoViewIfNeeded();
			const source = await article.boundingBox();
			const identity = await article.locator("[data-session-drag-identity]").boundingBox();
			expect(source).not.toBeNull();
			expect(identity).not.toBeNull();
			if (!source || !identity) return;
			const x = source.x + source.width / 2;
			const y = source.y + source.height / 2;
			await page.mouse.move(x, y);
			await page.mouse.down();
			await page.evaluate(() => {
				const frames: MorphFrame[] = [];
				(window as Window & { dragMorphFrames?: MorphFrame[] }).dragMorphFrames = frames;
				let sampling = false;
				const sample = () => {
					const overlay = document.querySelector("[data-session-drag-overlay]");
					const identityNode = overlay?.querySelector("[data-session-drag-identity]");
					const surfaceNode = overlay?.querySelector("[data-session-drag-surface]");
					if (identityNode && surfaceNode) {
						const identityRect = identityNode.getBoundingClientRect();
						const surfaceRect = surfaceNode.getBoundingClientRect();
						frames.push({
							agentSize: identityNode.querySelector('[data-avatar-role="agent"]')?.getBoundingClientRect().width ?? 0,
							identity: { x: identityRect.x, y: identityRect.y, width: identityRect.width, height: identityRect.height },
							surface: { x: surfaceRect.x, y: surfaceRect.y, width: surfaceRect.width, height: surfaceRect.height },
						});
						if (frames.length < 24) requestAnimationFrame(sample);
					}
				};
				const observer = new MutationObserver(() => {
					if (!sampling && document.querySelector("[data-session-drag-overlay]")) {
						sampling = true;
						observer.disconnect();
						requestAnimationFrame(sample);
					}
				});
				observer.observe(document.body, { childList: true, subtree: true });
			});
			await page.mouse.move(x + firstMove, y);
			const overlay = page.locator("[data-session-drag-overlay]");
			await expect(overlay).toHaveCount(1);
			await expect(overlay).toHaveAttribute("aria-hidden", "true");
			expect(await overlay.evaluate((node) => node.parentElement === document.body)).toBe(true);
			await expect.poll(() => page.evaluate(() => (
				(window as Window & { dragMorphFrames?: MorphFrame[] }).dragMorphFrames?.length ?? 0
			))).toBeGreaterThan(12);
			const frames = await page.evaluate(() => (window as Window & { dragMorphFrames?: MorphFrame[] }).dragMorphFrames ?? []);
			const first = frames[0];
			const last = frames[frames.length - 1];
			await test.info().attach("drag-morph-frames", { body: JSON.stringify({ source, identity, frames }), contentType: "application/json" });
			for (const frame of frames) {
				expect(frame.identity.width).toBeCloseTo(32, 1);
				expect(frame.identity.height).toBeCloseTo(32, 1);
			}
			if (reducedMotion === "no-preference") {
				expect(frames.some((frame) => frame.agentSize > 16.2 && frame.agentSize < 23.8)).toBe(true);
				expect(Math.abs(first.identity.x - identity.x)).toBeLessThan(2);
				expect(Math.abs(first.identity.y - identity.y)).toBeLessThan(2);
				expect(first.surface.width).toBeCloseTo(source.width, 0);
				expect(first.surface.height).toBeCloseTo(source.height, 0);
				expect(last.surface.width).toBeLessThan(first.surface.width - 40);
			} else {
				expect(first.surface.width).toBeCloseTo(last.surface.width, 1);
				expect(first.identity.x).toBeCloseTo(last.identity.x, 1);
			}
			expect(last.surface.height).toBeCloseTo(44, 1);
			const avatar = overlay.locator('[data-slot="human-agent-avatar"]');
			await expect(avatar).toHaveAttribute("data-composition", "group");
			const group = avatar.locator('[data-slot="avatar-group"]');
			await expect(overlay.locator("[data-session-drag-label]")).toHaveText("Priya Raman");
			await expect.poll(() => group.locator('[data-avatar-role]').evaluateAll((nodes) =>
				nodes.map((node) => {
					const rect = node.getBoundingClientRect();
					return { role: (node as HTMLElement).dataset.avatarRole, width: rect.width, height: rect.height };
				}),
			)).toEqual([
				{ role: "human", width: 16, height: 16 },
				{ role: "agent", width: 16, height: 16 },
			]);
			// The destination holds for the gesture beyond the demo's repeat pause.
			await page.waitForTimeout(1_600);
			await expect(avatar).toHaveAttribute("data-composition", "group");
			await expect(overlay.locator('[data-avatar-role]')).toHaveCount(2);
			await page.screenshot({ path: `output/agent-browser/session-drag-morph-${reducedMotion}-${firstMove}.png` });
			await expect.poll(() => overlay.locator("[data-session-drag-surface]").evaluate((node) => (
				(node as HTMLElement).style.willChange
			))).toBe("");
			// Cancel during a subsequent gesture as well as releasing this one.
			await page.getByRole("heading", { name: "Jira Design" }).hover();
			await page.mouse.up();
			await expect(overlay).toHaveCount(0);
			await expect(article).toBeVisible();
			await article.scrollIntoViewIfNeeded();
			const restored = await article.boundingBox();
			if (!restored) return;
			await page.mouse.move(restored.x + restored.width / 2, restored.y + restored.height / 2);
			await page.mouse.down();
			await page.mouse.move(restored.x + restored.width / 2 + 4, restored.y + restored.height / 2);
			await expect(overlay).toHaveCount(1);
			if (reducedMotion === "no-preference") {
				await page.emulateMedia({ reducedMotion: "reduce" });
				await expect.poll(() => overlay.locator("[data-session-drag-surface]").evaluate((node) => (
					(node as HTMLElement).style.transform
				))).toBe("");
			}
			await article.dispatchEvent("pointercancel");
			await page.mouse.up();
			await expect(overlay).toHaveCount(0);
			await expect(article).toBeVisible();
		});
	}
}
