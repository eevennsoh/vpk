import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test("menu rows use consistent padding and grow with their content", async ({ page }) => {
	await page.goto(appUrl("/preview/ui/dropdown-menu"));
	await page.getByRole("button", { name: "Menu items", exact: true }).first().click();
	const row = page.getByRole("menu", { name: "Menu items" }).getByRole("menuitem", { name: "Dashboard", exact: true });
	await expect(row).toHaveCSS("padding-top", "6px");
	await expect(row).toHaveCSS("padding-bottom", "6px");
	const textHeight = await row.evaluate((element) => element.getBoundingClientRect().height);
	await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "24px avatars", exact: true }).first().click();
	const avatarRow = page.getByRole("menuitem", { name: "Venn", exact: true });
	await expect(avatarRow).toHaveCSS("padding-top", "6px");
	await expect(avatarRow).toHaveCSS("padding-bottom", "6px");
	expect(await avatarRow.evaluate((row) => row.getBoundingClientRect().height)).toBeGreaterThan(textHeight);
});

test("checkbox and radio examples share menu spacing and remain interactive", async ({ page }) => {
	await page.goto(appUrl("/components/ui/dropdown-menu"));
	await page.getByRole("button", { name: "Controlled menu", exact: true }).scrollIntoViewIfNeeded();
	await expect(page.getByRole("menu", { name: "Controlled menu" })).toBeVisible();
	await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "Menu items", exact: true }).first().click();
	const menu = page.getByRole("menu", { name: "Menu items" });
	const menuRow = menu.getByRole("menuitem", { name: "Dashboard" });
	const surfaceStyle = await menu.evaluate((element) => {
		const style = getComputedStyle(element);
		return { padding: style.padding, radius: style.borderRadius, shadow: style.boxShadow, border: style.borderTopWidth };
	});
	const rowStyle = await menuRow.evaluate((element) => {
		const style = getComputedStyle(element);
		return { padding: style.padding, radius: style.borderRadius };
	});
	await page.keyboard.press("Escape");
	for (const trigger of ["View options", "View: list"]) {
		await page.getByRole("button", { name: trigger, exact: true }).click();
		const popup = page.locator('[data-slot="popover-content"][data-open]');
		await expect(popup).toHaveCSS("padding", surfaceStyle.padding);
		await expect(popup).toHaveCSS("border-radius", surfaceStyle.radius);
		await expect(popup).toHaveCSS("box-shadow", surfaceStyle.shadow);
		await expect(popup).toHaveCSS("border-top-width", surfaceStyle.border);
		const rows = popup.locator('[data-menu-row]');
		await expect(rows).toHaveCount(3);
		for (const row of await rows.all()) {
			await expect(row).toHaveCSS("padding", rowStyle.padding);
			await expect(row).toHaveCSS("border-radius", rowStyle.radius);
		}
		await expect(rows.nth(1)).toHaveCSS("margin-top", "2px");
		if (trigger === "View options") {
			const checkbox = popup.getByRole("checkbox", { name: "Show activity panel" });
			await checkbox.check();
			await expect(checkbox).toBeChecked();
		} else {
			const radio = popup.getByRole("radio", { name: "Board" });
			await radio.check();
			await expect(radio).toBeChecked();
		}
		await page.keyboard.press("Escape");
	}
});

test("agent selector subheadings match dropdown subheadings", async ({ page }) => {
	await page.goto(appUrl("/components/blocks/agent-selector#standalone-picker"));
	const selectorHeading = page.getByText("Switch to another agent", { exact: true });
	await expect(selectorHeading).toBeVisible();
	const measure = (element: Element) => {
		const style = getComputedStyle(element);
		return { padding: style.padding, fontSize: style.fontSize, lineHeight: style.lineHeight, fontWeight: style.fontWeight, color: style.color };
	};
	const selectorStyle = await selectorHeading.evaluate(measure);
	await expect(selectorHeading).toHaveCSS("padding", "6px 8px");
	await page.goto(appUrl("/components/ui/dropdown-menu#subheading"));
	await page.getByRole("button", { name: "Controlled menu", exact: true }).scrollIntoViewIfNeeded();
	await expect(page.getByRole("menu", { name: "Controlled menu" })).toBeVisible();
	await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "View settings", exact: true }).click();
	const dropdownHeading = page.getByRole("menu", { name: "View settings" }).getByText("Layout", { exact: true });
	await expect(dropdownHeading).toBeVisible();
	expect(await dropdownHeading.evaluate(measure)).toEqual(selectorStyle);
});

test("searchable dropdown shares menu spacing and fades only its top edge", async ({ page }) => {
	await page.goto(appUrl("/components/ui/dropdown-menu#search"));
	await expect(page.getByRole("menu", { name: "Controlled menu" })).toBeVisible();
	await page.keyboard.press("Escape");
	const standardTrigger = page.getByRole("button", { name: "Menu items", exact: true }).first();
	await standardTrigger.evaluate((element) => element.scrollIntoView({ block: "center" }));
	await standardTrigger.click();
	const standardMenu = page.getByRole("menu", { name: "Menu items" });
	const standardRow = standardMenu.getByRole("menuitem", { name: "Dashboard", exact: true });
	const menuPadding = await standardMenu.evaluate((element) => getComputedStyle(element).padding);
	const rowStyle = await standardRow.evaluate((element) => {
		const style = getComputedStyle(element);
		return { padding: style.padding, radius: style.borderRadius, height: element.getBoundingClientRect().height };
	});
	await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "Choose an action", exact: true }).click();
	const menu = page.getByRole("menu", { name: "Choose an action" });
	const search = menu.getByRole("textbox", { name: "Search actions" });
	const row = menu.getByRole("menuitem", { name: "Add attachment" });
	await expect(menu).toHaveCSS("padding", menuPadding);
	expect(await row.evaluate((element) => {
		const style = getComputedStyle(element);
		return { padding: style.padding, radius: style.borderRadius, height: element.getBoundingClientRect().height };
	})).toEqual(rowStyle);
	const list = menu.locator(".overflow-y-auto");
	expect(await list.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
	const initialMask = await list.evaluate((element) => getComputedStyle(element).maskImage);
	expect(initialMask).toBe("none");
	const searchOffset = await search.evaluate((element) => element.getBoundingClientRect().top - element.closest('[role="menu"]')!.getBoundingClientRect().top);
	await list.evaluate((element) => { element.scrollTop = 160; });
	await expect.poll(() => list.evaluate((element) => getComputedStyle(element).maskImage)).not.toBe(initialMask);
	await expect.poll(() => list.evaluate((element) => getComputedStyle(element).maskImage)).toContain("rgba(0, 0, 0, 0) 0px");
	await expect.poll(() => list.evaluate((element) => element.style.maskImage)).not.toContain("transparent 100%");
	expect(await search.evaluate((element) => element.getBoundingClientRect().top - element.closest('[role="menu"]')!.getBoundingClientRect().top)).toBeCloseTo(searchOffset, 1);
	await search.fill("Duplicate");
	await expect(menu.getByRole("menuitem", { name: "Duplicate" })).toBeVisible();
	await expect(menu.getByRole("menuitem", { name: "Edit", exact: true })).toHaveCount(0);
});
