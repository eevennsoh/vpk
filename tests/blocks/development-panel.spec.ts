import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test("development rows align their icons and labels with the heading", async ({ page }) => {
	await page.goto(appUrl("/preview/blocks/development-panel"));
	await page.getByRole("button", { name: "Pull requests created" }).click();

	const panel = page.getByRole("region", { name: "Development" });
	const heading = await panel.getByRole("heading", { name: "Development" }).boundingBox();
	const rows = panel.getByRole("button").filter({ hasText: /#\d+|View development activity/ });
	await expect(rows).toHaveCount(4);
	const positions = await rows.evaluateAll((elements) => elements.map((element) => {
		const icon = element.querySelector<HTMLElement>('[data-slot="icon"]');
		const label = element.querySelector<HTMLElement>(":scope > span:last-child");
		return { icon: icon?.getBoundingClientRect().left, label: label?.getBoundingClientRect().left };
	}));
	if (!heading || positions[0]?.icon == null || positions[0]?.label == null) throw new Error("Development rows did not render");
	for (const position of positions) {
		expect(position.icon).toBeCloseTo(heading.x, 0);
		expect(position.label).toBeCloseTo(positions[0].label, 0);
	}
});
