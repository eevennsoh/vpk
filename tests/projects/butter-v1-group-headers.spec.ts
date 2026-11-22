import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ ignoreHTTPSErrors: true });

for (const view of ["List", "Backlog"] as const) {
	test(`${view} grouping matches picker visuals and aligns hierarchy chevrons`, async ({ page }) => {
		await page.setViewportSize({ width: 1800, height: 1100 });
		await page.goto(appUrl("/butter-v1"));
		await page.getByRole("tab", { name: view, exact: true }).click();
		await page.getByRole("button", { name: "Group", exact: true }).click();
		await page.getByRole("menuitemradio", { name: "Assignee", exact: true }).click();
		const header = page.getByRole("button", { name: "Collapse Diego Santos", exact: true }).first();
		const groupRow = header.locator("xpath=ancestor::tr");
		const avatar = groupRow.locator('[data-slot="avatar"]');
		await expect(avatar).toBeVisible();
		await expect(avatar).toHaveCSS("width", "16px");
		await expect(avatar).toHaveCSS("height", "16px");
		await expect(groupRow).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
		const tableIndex = await header.evaluate((element) => [...document.querySelectorAll("table")].indexOf(element.closest("table")!));
		const table = page.locator("table").nth(tableIndex);
		const expandAll = table.getByRole("button", { name: /all subtasks/ }).first();
		const groupBox = await header.boundingBox();
		const allBox = await expandAll.boundingBox();
		if (!groupBox || !allBox) throw new Error("Expected visible hierarchy buttons");
		expect(Math.abs(groupBox.x - allBox.x)).toBeLessThanOrEqual(1);
		const rowChevron = table.getByRole("button", { name: "Expand PAY-118", exact: true });
		if (await rowChevron.count()) {
			const rowBox = await rowChevron.boundingBox();
			if (!rowBox) throw new Error("Expected a visible work item chevron");
			expect(Math.abs(groupBox.x - rowBox.x)).toBeLessThanOrEqual(1);
		}
		await header.click();
		const collapsedHeader = table.getByRole("button", { name: "Expand Diego Santos", exact: true });
		await expect(collapsedHeader).toHaveAttribute("aria-expanded", "false");
		const nextHeader = table.getByRole("button", { name: "Collapse Jordan Okafor", exact: true });
		const [collapsedBox, collapsedRowBox, nextBox] = await Promise.all([
			collapsedHeader.boundingBox(), collapsedHeader.locator("xpath=ancestor::tr").boundingBox(), nextHeader.boundingBox(),
		]);
		if (!collapsedBox || !collapsedRowBox || !nextBox) throw new Error("Expected visible adjacent group headers");
		expect(nextBox.y - collapsedBox.y - collapsedRowBox.height).toBeCloseTo(32, 0);
		await page.getByRole("button", { name: "Group by Assignee", exact: true }).click();
		await page.getByRole("menuitemradio", { name: "Labels", exact: true }).click();
		const labelHeader = page.getByRole("button", { name: "Collapse checkout-web", exact: true }).first().locator("xpath=ancestor::tr");
		await expect(labelHeader.locator('[data-slot="tag"]')).toHaveText("checkout-web");
		await expect(labelHeader).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
		await page.getByRole("button", { name: "Group by Labels", exact: true }).click();
		await expect(page.getByRole("menuitemradio", { name: "Epic", exact: true })).toHaveCount(1);
		await expect(page.getByRole("menuitemradio", { name: "Parent", exact: true })).toHaveCount(0);
		await page.getByRole("menuitemradio", { name: "Epic", exact: true }).click();
		await expect(page.getByRole("button", { name: "Group by Epic", exact: true })).toBeVisible();
		const epicHeader = page.getByRole("button", { name: "Collapse Uncategorised", exact: true }).first().locator("xpath=ancestor::tr");
		const epicTag = epicHeader.locator('[data-slot="tag"]');
		await expect(epicTag).toHaveText("Uncategorised");
		await expect(epicTag.locator("svg")).toHaveCount(0);
		await expect(epicTag).toHaveClass(/border-border-accent-gray-subtle/);
		await expect(epicTag).toHaveCSS("font-size", "12px");
		await page.getByRole("button", { name: "Group by Epic", exact: true }).click();
		await page.getByRole("menuitemradio", { name: "Work type", exact: true }).click();
		const typeHeader = page.getByRole("button", { name: "Collapse Task", exact: true }).first().locator("xpath=ancestor::tr");
		await expect(typeHeader.getByRole("img", { name: "task", exact: true })).toBeVisible();
		await page.getByRole("button", { name: "Group by Work type", exact: true }).click();
		await page.getByRole("menuitemradio", { name: "Priority", exact: true }).click();
		const priorityHeader = page.getByRole("button", { name: "Collapse Major", exact: true }).first().locator("xpath=ancestor::tr");
		await expect(priorityHeader.getByRole("img", { name: "major priority", exact: true })).toBeVisible();
		await page.getByRole("button", { name: "Group by Priority", exact: true }).click();
		await page.getByRole("menuitemradio", { name: "Status", exact: true }).click();
		const statusHeader = page.getByRole("button", { name: "Collapse To do", exact: true }).first().locator("xpath=ancestor::tr");
		await expect(statusHeader.locator("svg").last()).toBeVisible();
		await page.getByRole("button", { name: "Group by Status", exact: true }).click();
		await page.getByRole("menuitemradio", { name: "Subtask", exact: true }).click();
		const subtaskHeader = page.getByRole("button", { name: "Collapse Uncategorised", exact: true }).first().locator("xpath=ancestor::tr");
		await expect(subtaskHeader.getByRole("img", { name: "subtask", exact: true })).toBeVisible();
		await page.getByRole("button", { name: "Group by Subtask", exact: true }).click();
		await page.getByRole("menuitemradio", { name: "Agent", exact: true }).click();
		const agentHeader = page.getByRole("button", { name: "Collapse Claude", exact: true }).first().locator("xpath=ancestor::tr");
		const agentAvatar = agentHeader.getByRole("img", { name: "Claude", exact: true });
		await expect(agentAvatar).toBeVisible();
		await expect(agentAvatar).toHaveCSS("width", "16px");
		await expect(agentAvatar.locator("svg, img")).toHaveCount(1);
		for (const [name, color] of [["Claude", "rgb(217, 119, 87)"], ["Cursor", "rgb(20, 18, 11)"], ["GitHub Copilot", "rgb(0, 0, 0)"]] as const) {
			const group = page.getByRole("button", { name: `Collapse ${name}`, exact: true }).first().locator("xpath=ancestor::tr");
			const picture = group.getByRole("img", { name, exact: true });
			await expect(picture.locator('[data-slot="avatar-hexagon-artwork"] > span[aria-hidden="true"]').first()).toHaveCSS("background-color", color);
		}
		const codex = page.getByRole("button", { name: "Collapse Codex", exact: true }).first().locator("xpath=ancestor::tr").getByRole("img", { name: "Codex", exact: true });
		await expect(codex.locator('[data-slot="logo-third-party-local"] img')).toHaveAttribute("src", /codex/);
	});
}
