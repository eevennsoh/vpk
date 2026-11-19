import { expect, test, type Locator, type Page } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

// BrandLogoMark (components/ui/logo-mark.tsx) resolves a third-party brand from `name`
// (or a /3p/ asset `src`) to the lazily loaded @atlassian/logo-third-party mark, an inline
// svg; any other `src` renders an <img>. A lazy mark holds an empty box until its module
// arrives and keeps that box if the module fails, so "has a logo" means a drawn svg or a
// decoded image, never just a box.
const ROUTE = "/components/blocks/app-directory";
const BY_COMPANIES = "By companies";
// DEFAULT_APP_DIRECTORY_SIDEBAR_GROUPS (components/blocks/app-directory/data/sidebar-groups.ts) lists 11 apps.
const BY_COMPANIES_COUNT = 11;

type LogoState = "svg" | "img" | "empty";

function logoState(container: Locator): Promise<LogoState> {
	return container.evaluate((node): LogoState => {
		const svg = node.querySelector("svg");
		if (svg) {
			const { width, height } = svg.getBoundingClientRect();
			if (width > 0 && height > 0) return "svg";
		}
		const img = node.querySelector("img");
		return img?.complete && img.naturalWidth > 0 ? "img" : "empty";
	});
}

async function openStandardDirectory(page: Page) {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(appUrl(ROUTE));
	// The Preview and the Standard example both render this trigger; the Preview comes first.
	await page.getByRole("button", { name: "Open standard directory", exact: true }).first().click();
	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();
	const companies = dialog
		.getByRole("navigation", { name: "Tool categories", exact: true })
		.getByText(BY_COMPANIES, { exact: true })
		.locator("xpath=following-sibling::ul[1]")
		.locator('[data-slot="sidebar-nav-item"]');
	await expect(companies).toHaveCount(BY_COMPANIES_COUNT);
	return { dialog, companies };
}

// The logo tile in an app card's header: EntityCardAppCard wraps the app logo in a Tile.
function cardLogo(page: Page, dialog: Locator, appName: string): Locator {
	return dialog
		.locator('[data-slot="card-directory-header"]')
		.filter({ has: page.getByRole("heading", { name: appName, exact: true }) })
		.first()
		.locator('[data-slot="tile"]')
		.first();
}

test("App Directory draws brand marks for package brands, asset paths and Atlassian", { tag: "@smoke" }, async ({ page }) => {
	const { dialog, companies } = await openStandardDirectory(page);

	// Sidebar: the Atlassian entry renders AtlassianLogoMark.
	const atlassian = companies.filter({ hasText: "Atlassian" }).locator('[data-slot="sidebar-nav-item-leading"]');
	await expect.poll(() => logoState(atlassian), { message: "Atlassian sidebar entry logo" }).toBe("svg");

	// Cards: Slack is BrandLogoMark name="slack" (package svg); Focus Flow is a non-/3p/ src (<img>).
	for (const [appName, expected] of [["Slack", "svg"], ["Focus Flow", "img"]] as const) {
		const logo = cardLogo(page, dialog, appName);
		await logo.scrollIntoViewIfNeeded();
		await expect.poll(() => logoState(logo), { message: `${appName} card logo` }).toBe(expected);
	}
});

test("every By companies sidebar entry shows a logo", { tag: "@smoke" }, async ({ page }) => {
	// Known gap, older than PR 2403: getSidebarGroupItems (components/blocks/app-directory/components/app-directory.tsx)
	// copies avatarSrc and logoName but not brandName, so SidebarToolAvatar returns null for the 10
	// package-brand apps and their leading slot stays empty. Remove this line once that mapping keeps brandName.
	test.fail(true, "getSidebarGroupItems drops brandName, so package-brand sidebar entries have no logo");
	const { companies } = await openStandardDirectory(page);
	const emptyEntries = () => companies.evaluateAll((items) => items
		.filter((item) => {
			const leading = item.querySelector('[data-slot="sidebar-nav-item-leading"]');
			const svg = leading?.querySelector("svg");
			const img = leading?.querySelector("img");
			const drawn = (svg && svg.getBoundingClientRect().width > 0) || (img?.complete && img.naturalWidth > 0);
			return !drawn;
		})
		.map((item) => item.textContent?.trim() ?? ""));
	await expect.poll(emptyEntries, { message: "By companies entries with an empty logo slot", timeout: 5_000 }).toEqual([]);
});
