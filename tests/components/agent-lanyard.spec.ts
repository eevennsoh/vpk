import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

for (const colorScheme of ["light", "dark"] as const) {
	for (const deviceScaleFactor of [1, 1.25, 2]) {
		test.describe(`recommended lanyard ${colorScheme} at DPR ${deviceScaleFactor}`, () => {
			test.use({ colorScheme, deviceScaleFactor, reducedMotion: "reduce", ignoreHTTPSErrors: true });
			test("catalog retains description, caller reason and the content-hugging perforated surface", async ({ page }, testInfo) => {
				await page.setViewportSize({ width: 1440, height: 1000 });
				await page.goto(appUrl("/components/blocks/agent-lanyard"));
				const themeToggle = page.getByRole("button", { name: /^(Light|Dark|System) theme$/ });
				const originalTheme = await themeToggle.getAttribute("aria-label");
				for (let attempt = 0; attempt < 3 && await themeToggle.getAttribute("aria-label") !== `${colorScheme === "light" ? "Light" : "Dark"} theme`; attempt += 1) {
					await themeToggle.click();
				}
				await expect(page.locator("html")).toHaveAttribute("data-color-mode", colorScheme);
				const preview = page.locator('[data-slot="agent-lanyard-demo"]');
				const card = preview.getByRole("article", { name: "Claude recommended" });
				await card.scrollIntoViewIfNeeded();
				await expect(card.getByText("Collaborate on code with an AI that gives smart suggestions and reviews.", { exact: true })).toBeVisible();
				const heading = card.getByRole("heading", { name: "Why recommended", level: 4 });
				await expect(heading).toBeVisible();
				await expect(heading).toHaveCSS("font-size", "12px");
				await expect(heading).toHaveCSS("font-weight", "600");
				await expect(heading).toHaveCSS("line-height", "16px");
				const subtlestColor = await heading.evaluate((element) => {
					const probe = document.createElement("span");
					probe.style.color = "var(--ds-text-subtlest)";
					element.appendChild(probe);
					const color = getComputedStyle(probe).color;
					probe.remove();
					return color;
				});
				await expect(heading).toHaveCSS("color", subtlestColor);
				await expect(card.getByText("Claude can help with code suggestions and reviews.", { exact: true })).toBeVisible();
				await expect(card.locator("button, a, input, [tabindex]")).toHaveCount(0);
				await expect(card).toHaveAttribute("data-perspective-tilt", "false");
				await expect(card.locator('[data-slot="agent-lanyard-grid"]')).toHaveAttribute("data-animated", "false");
				await expect(card.locator('[data-slot="agent-lanyard-appstack"]')).toHaveCount(0);
				const surface = card.locator('[data-slot="agent-lanyard-surface"]');
				await expect(surface).toHaveCSS("border-top-width", "0px");
				await expect(surface).toHaveCSS("mask-image", /radial-gradient/);
				await expect(surface).toHaveCSS("--recommendation-notch-radius", "5px");
				await expect(card.locator('[data-slot="agent-lanyard-tear-line"]')).toHaveCSS("mask-image", /repeating-linear-gradient/);
				await expect.poll(() => card.evaluate((element) => {
					const surface = element.querySelector('[data-slot="agent-lanyard-surface"]')!;
					const identity = element.querySelector('[data-slot="agent-lanyard-recommended-identity"]')!;
					const description = identity.querySelector(":scope > div:last-child > p")!;
					const section = element.querySelector('[data-slot="agent-lanyard-recommendation-section"]')!;
					const heading = section.querySelector("h4")!;
					const paragraph = section.querySelector("p")!;
					return {
						width: element.getBoundingClientRect().width,
						belowDescription: section.getBoundingClientRect().top - description.getBoundingClientRect().bottom,
						aboveHeading: heading.getBoundingClientRect().top - section.getBoundingClientRect().top,
						bottom: surface.getBoundingClientRect().bottom - paragraph.getBoundingClientRect().bottom,
						fontSize: getComputedStyle(paragraph).fontSize,
						lineHeight: getComputedStyle(paragraph).lineHeight,
						descriptionLineHeight: getComputedStyle(description).lineHeight,
						headingPadding: getComputedStyle(heading).padding,
					};
				})).toEqual({ width: 252, belowDescription: 24, aboveHeading: 16, bottom: 12, fontSize: "12px", lineHeight: "16px", descriptionLineHeight: "16px", headingPadding: "0px" });
				await expect(page.locator("html")).toHaveAttribute("data-color-mode", colorScheme);
				await expect(preview.getByText(/Illustrative demo reason based on the catalog description/)).toBeVisible();
				await expect(preview.getByRole("article", { name: "Claude agent" }).getByRole("button", { name: "Chat with Claude" })).toHaveCount(1);
				await card.screenshot({ path: testInfo.outputPath("recommended.png") });
				for (let attempt = 0; attempt < 3 && await themeToggle.getAttribute("aria-label") !== originalTheme; attempt += 1) {
					await themeToggle.click();
				}
			});
		});
	}
}
