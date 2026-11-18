import { expect, test } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

test.use({ ignoreHTTPSErrors: true });

test("the Bubble and Message previews use the VPK user-message treatment", async ({ page }) => {
	await page.goto(appUrl("/components/ui/bubble"));
	const bubble = page.locator('#preview [data-slot="bubble-content"]').first();
	await expect(bubble).toBeVisible();
	const appearance = await bubble.evaluate((element) => {
		const style = getComputedStyle(element);
		return {
			background: style.backgroundColor,
			color: style.color,
			padding: style.padding,
			fontSize: style.fontSize,
			lineHeight: style.lineHeight,
			fontWeight: style.fontWeight,
			topLeftRadius: style.borderTopLeftRadius,
			bottomRightRadius: style.borderBottomRightRadius,
		};
	});
	const reference = await page.evaluate(() => {
		const element = document.createElement("div");
		element.className = "bg-bg-neutral text-text px-4 py-3 text-sm leading-5 font-medium rounded-xl rounded-br-none";
		document.body.append(element);
		const style = getComputedStyle(element);
		const value = {
			background: style.backgroundColor,
			color: style.color,
			padding: style.padding,
			fontSize: style.fontSize,
			lineHeight: style.lineHeight,
			fontWeight: style.fontWeight,
			topLeftRadius: style.borderTopLeftRadius,
			bottomRightRadius: style.borderBottomRightRadius,
		};
		element.remove();
		return value;
	});
	expect(appearance).toEqual(reference);
	const primaryBubble = page.locator('#variants [data-variant="primary"] [data-slot="bubble-content"]');
	await expect(primaryBubble).toHaveCSS("padding", "8px 12px");
	await expect(primaryBubble).toHaveCSS("font-weight", "400");
	const primaryBackground = await page.evaluate(() => {
		const element = document.createElement("div");
		element.className = "bg-primary";
		document.body.append(element);
		const background = getComputedStyle(element).backgroundColor;
		element.remove();
		return background;
	});
	await expect(primaryBubble).toHaveCSS("background-color", primaryBackground);

	await page.goto(appUrl("/components/ui/message"));
	const preview = page.locator("#preview");
	const userBubble = preview.locator('[data-slot="bubble-content"]').first();
	await expect(userBubble).toHaveText("Get Figma design context");
	const messageAppearance = await userBubble.evaluate((element) => {
		const style = getComputedStyle(element);
		return {
			background: style.backgroundColor,
			color: style.color,
			padding: style.padding,
			fontSize: style.fontSize,
			lineHeight: style.lineHeight,
			fontWeight: style.fontWeight,
			topLeftRadius: style.borderTopLeftRadius,
			bottomRightRadius: style.borderBottomRightRadius,
		};
	});
	expect(messageAppearance).toEqual(reference);
	await userBubble.hover();
	const hoveredBackground = await page.evaluate(() => {
		const element = document.createElement("div");
		element.className = "bg-bg-neutral-hovered";
		document.body.append(element);
		const background = getComputedStyle(element).backgroundColor;
		element.remove();
		return background;
	});
	await expect(userBubble).toHaveCSS("background-color", hoveredBackground);
	await expect(preview.getByRole("button", { name: "Copy", exact: true })).toBeVisible();
	const edit = preview.getByRole("button", { name: "Edit", exact: true });
	await expect(edit).toBeVisible();
	await edit.click();
	await expect(preview.locator("textarea")).toHaveValue("Get Figma design context");
	const nestedUserBubble = page.locator('#attachment [data-slot="message"][data-align="end"] [data-slot="bubble-content"]').first();
	await expect(nestedUserBubble).toHaveCSS("border-bottom-right-radius", "0px");
	const widthRatio = await nestedUserBubble.evaluate((element) => {
		const message = element.closest('[data-slot="message"]');
		return message ? element.getBoundingClientRect().width / message.getBoundingClientRect().width : Infinity;
	});
	expect(widthRatio).toBeLessThanOrEqual(0.81);
});
