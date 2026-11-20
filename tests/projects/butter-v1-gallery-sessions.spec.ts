import { expect, test } from "@playwright/test";
import { appUrl } from "@/tests/helpers/origin";

test.use({ actionTimeout: 7000, ignoreHTTPSErrors: true });

test("large session cards keep the status label when More actions replaces the icon", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	await expect(page.getByRole("button", { name: "Large", exact: true })).toHaveAttribute("aria-pressed", "true");
	for (const section of ["Local sessions", "Cloud sessions"]) {
		const rows = page.getByRole("region", { name: section }).locator("article");
		for (const [state, label] of [["running", "Working"], ["needs-input", "Needs input"], ["complete", "Finished"]] as const) {
			const row = rows.filter({ has: page.locator(`[data-agent-session-lifecycle-label="${state}"]`) });
			const status = row.getByText(label, { exact: true });
			const glyph = row.locator("[data-agent-session-lifecycle-glyph]");
			const more = row.getByRole("button", { name: /^More actions for/ });
			await page.mouse.move(0, 0);
			await expect(status).toBeVisible();
			await expect(glyph).toBeVisible();
			const statusButton = row.getByRole("button", { name: label, exact: true });
			await expect(statusButton).toHaveCSS("width", "24px");
			expect(await status.evaluate((element) => element.closest("button") === null)).toBe(true);
			if (section === "Cloud sessions" && state === "complete") {
				await statusButton.focus();
				await statusButton.press("Space");
				await expect(statusButton).toHaveAttribute("aria-pressed", "true");
				await expect(status).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
			}
			const restingStatus = await status.boundingBox();
			const restingGlyph = await glyph.boundingBox();
			await row.hover();
			await expect(status).toBeVisible();
			await expect(glyph).toBeHidden();
			await expect(more.locator("..")).toHaveCSS("opacity", "1");
			expect(await status.boundingBox()).toEqual(restingStatus);
			const action = await more.boundingBox();
			if (!restingGlyph || !action) throw new Error("Missing status icon or menu trigger");
			expect(Math.abs(action.x - restingGlyph.x)).toBeLessThanOrEqual(1);
			expect(action).toMatchObject({ y: restingGlyph.y, width: restingGlyph.width, height: restingGlyph.height });
			if (section === "Cloud sessions" && state === "complete") {
				await more.click();
				await expect(page.getByRole("menu")).toBeVisible();
				await expect(status).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
				await page.keyboard.press("Escape");
			}
		}
	}

	await page.mouse.move(0, 0);
	await page.keyboard.press("Tab");
	const local = page.getByRole("region", { name: "Local sessions" }).locator("article").first();
	const more = local.getByRole("button", { name: /^More actions for/ });
	await more.focus();
	await expect(more.locator("..")).toHaveCSS("opacity", "1");
	await expect(local.locator("[data-agent-session-lifecycle-glyph]")).toBeHidden();
	await more.press("Enter");
	await expect(page.getByRole("menu")).toBeVisible();
	await expect(local.getByText("Working", { exact: true })).toBeVisible();
	await expect(local.locator("[data-agent-session-lifecycle-glyph]")).toBeHidden();
	await page.keyboard.press("Escape");
	await expect(more).toBeFocused();
});

test("team session rows do not reveal an access tooltip on hover", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1200 });
	await page.clock.install();
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	await page.getByRole("button", { name: "Team session", exact: true }).click();
	for (const label of ["Cloud (Owner) sessions", "Cloud (Viewer) sessions"]) {
		const rows = page.getByRole("region", { name: label }).locator("article");
		for (const row of await rows.all()) {
			await row.hover({ position: { x: 8, y: 8 } });
			await page.clock.fastForward(1000);
			await expect(page.getByRole("tooltip").filter({ hasText: "You can see this session" })).toHaveCount(0);
		}
	}
	await page.getByRole("region", { name: "Cloud (Viewer) sessions" }).locator("article").first().click();
	await expect(page.locator('[data-rovo-chat-placement="floating"]').getByRole("group", { name: "Claude, used by Priya Raman" })).toBeVisible();
});

test("private and team access icons show who started the session", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1200 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	await page.getByRole("button", { name: "Private session", exact: true }).click();
	const privateIcon = page.getByRole("region", { name: "Cloud sessions" }).locator("article").first().locator('[data-access-mark="private"]');
	await privateIcon.hover();
	await expect(page.getByRole("tooltip").filter({ hasText: "Session by Priya Raman" })).toHaveText("Session by Priya Raman");
	await page.getByRole("button", { name: "Team session", exact: true }).click();
	const teamIcon = page.getByRole("region", { name: "Cloud (Owner) sessions" }).locator("article").first().locator('[data-access-mark="team"]');
	await teamIcon.hover();
	await expect(page.getByRole("tooltip").filter({ hasText: "Session by Priya Raman" })).toHaveText("Session by Priya Raman for the team");
	await page.mouse.move(0, 0);
	await page.keyboard.press("Tab");
	await teamIcon.focus();
	await expect(page.getByRole("tooltip").filter({ hasText: "Session by Priya Raman" })).toHaveText("Session by Priya Raman for the team");
	await page.getByRole("button", { name: "Team session", exact: true }).focus();
	await page.mouse.move(0, 0);
	const viewerIcon = page.getByRole("region", { name: "Cloud (Viewer) sessions" }).locator("article").first().locator('[data-access-mark="team"]');
	await viewerIcon.hover();
	await expect(page.getByRole("tooltip").filter({ hasText: "Session by Priya Raman" })).toHaveText("Session by Priya Raman for the team");
});

test("session metadata previews its timestamp and pull request", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	const row = page.getByRole("region", { name: "Local sessions" }).locator("article").first();
	const timestamp = row.locator("[data-last-update]");
	await timestamp.hover();
	await expect(timestamp).toHaveCSS("text-decoration-line", "underline");
	await expect(page.getByRole("tooltip")).toHaveText("Last run on Nov 10, 2026, 10:00 GMT+8");
	await page.mouse.move(0, 0);
	const pr = row.getByRole("group", { name: /Pull request #1306/ });
	const icon = pr.getByRole("img", { name: "PR created" });
	const restColor = await icon.evaluate((element) => getComputedStyle(element).color);
	await row.hover({ position: { x: 20, y: 10 } });
	await expect.poll(() => icon.evaluate((element) => getComputedStyle(element).color)).not.toBe(restColor);
	await pr.hover();
	await expect(pr.locator("[data-session-pr-title]")).toHaveCSS("text-decoration-line", "underline");
	await expect(page.getByRole("region", { name: "Pull request #1306 details" })).toBeVisible();
	await pr.click();
	await expect(page.getByRole("menu")).toHaveCount(0);
	await expect(page.getByRole("textbox", { name: "Chat message input" })).toHaveCount(0);
	await page.mouse.move(0, 0);
	await page.keyboard.press("Tab");
	await timestamp.focus();
	await expect(page.getByRole("tooltip")).toHaveText("Last run on Nov 10, 2026, 10:00 GMT+8");
	await pr.focus();
	await expect(page.getByRole("region", { name: "Pull request #1306 details" })).toBeVisible();
});

test("gallery expansion keeps session content in place", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	const row = page.getByRole("region", { name: "Cloud sessions" }).locator("article").first();
	const expanded = await row.boundingBox();
	if (!expanded) throw new Error("Missing cloud session row");
	await page.getByRole("button", { name: "Close gallery" }).click();
	await expect.poll(async () => (await row.boundingBox())?.y).toBe(expanded.y);
	await page.getByRole("button", { name: "Open gallery" }).click();
	await expect.poll(async () => (await row.boundingBox())?.y).toBe(expanded.y);
});

test("cloud sessions open their own scripted Rovo conversations", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	const launcher = page.getByRole("button", { name: "Open Rovo chat" });
	await expect(launcher).toBeVisible();
	await launcher.click();
	await expect(page.getByRole("textbox", { name: "Chat message input" })).toBeVisible();
	await page.getByRole("button", { name: "Close", exact: true }).click();
	const cloud = page.getByRole("region", { name: "Cloud sessions" });
	for (const [title, finished] of [["Refactor active air suspension dampening logic for off-road mode", false], ["Hand off the off-road suspension controls to engineering", true]] as const) {
		const row = cloud.locator("article").filter({ hasText: title });
		await row.click();
		const chat = page.locator('[data-rovo-chat-placement="floating"]');
		await expect(chat.getByText(finished ? "The work is complete. The relevant details are ready for the team to review." : `I’m reviewing the context for ${title}. I’ll check the relevant details and prepare the next steps.`)).toBeVisible();
		if (finished) {
			const artifacts = chat.getByRole("region", { name: "Generated artifacts" });
			await expect(artifacts.getByText("Off-road suspension controls", { exact: true })).toBeVisible();
			await expect(artifacts.getByText("Suspension controls handoff", { exact: true })).toBeVisible();
			await expect(artifacts.getByText("Off-road control acceptance criteria", { exact: true })).toBeVisible();
			await expect(chat.getByText("Checking the related work", { exact: true })).toHaveCount(0);
			await expect(chat.getByRole("button", { name: /^(Thinking|Working)/ })).toHaveCount(0);
		} else {
			await expect(chat.getByText("Checking the related work", { exact: true })).toBeVisible();
			await expect(chat.getByRole("region", { name: "Generated artifacts" })).toHaveCount(0);
		}
		await page.mouse.move(0, 0);
		await expect(row).not.toHaveAttribute("data-selected", "true");
		await expect(row).toHaveCSS("background-color", await page.getByRole("region", { name: "Local sessions" }).locator("article").first().evaluate((element) => getComputedStyle(element).backgroundColor));
	}
	await page.getByRole("button", { name: "Close", exact: true }).click();
	await expect(launcher).toBeVisible();
	await cloud.locator("article").last().click();
	await expect(page.getByText("The work is complete. The relevant details are ready for the team to review.")).toBeVisible();
});

test("a cloud session needing input opens a question and resumes after an answer", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	const row = page.getByRole("region", { name: "Cloud sessions" }).locator("article").filter({ hasText: "Active air suspension roadmap" });
	await row.click();
	await expect(page.getByRole("heading", { name: "What should the suspension roadmap prioritize?" })).toBeVisible();
	await page.getByRole("button", { name: /Prioritize off-road performance/ }).click();
	await expect(page.getByText("Thanks — I’ll continue with that direction.")).toBeVisible();
	await expect(row.getByText("Working", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Close", exact: true }).click();
	await row.click();
	await expect(page.getByText("Thanks — I’ll continue with that direction.")).toBeVisible();
	await expect(page.getByRole("heading", { name: "What should the suspension roadmap prioritize?" })).toHaveCount(0);
});

test("team viewers can answer questions while their composer remains disabled", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1200 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	await page.getByRole("button", { name: "Team session", exact: true }).click();
	const owner = page.getByRole("region", { name: "Cloud (Owner) sessions" });
	const viewer = page.getByRole("region", { name: "Cloud (Viewer) sessions" });
	await expect(owner.locator("article")).toHaveCount(3);
	await expect(viewer.locator("article")).toHaveCount(3);
	await owner.locator("article").first().hover();
	await expect(owner.getByRole("button", { name: /^More actions for/ }).first()).toBeVisible();
	await expect(viewer.getByRole("button", { name: /^More actions for/ })).toHaveCount(0);
	await viewer.locator("article").first().click();
	const input = page.getByRole("textbox", { name: "Chat message input" });
	await expect(input).toHaveCount(0);
	const chat = page.locator('[data-rovo-chat-placement="floating"]');
	const oldBar = chat.getByRole("group", { name: "Session owner and status" });
	await expect(chat.getByRole("group", { name: "Claude, used by Priya Raman" })).toBeVisible();
	await expect(oldBar).toHaveCount(0);
	const contextBar = chat.locator("[data-chat-context-bar]");
	await expect(contextBar).toHaveCount(0);
	await expect(chat.getByText("Uses AI. Verify results.", { exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
	await expect(page.getByRole("button", { name: "More", exact: true })).toHaveCount(0);
	await viewer.locator("article").last().click();
	await expect(input).toHaveCount(0);
	await expect(chat.getByRole("group", { name: "Figma, used by Austin Lee" })).toBeVisible();
	await expect(chat.getByText("The work is complete. The relevant details are ready for the team to review.")).toBeVisible();
	await expect(chat.getByText("Checking the related work", { exact: true })).toHaveCount(0);
	await expect(chat.getByRole("button", { name: /^(Thinking|Working)/ })).toHaveCount(0);
	const roadmap = viewer.locator("article").filter({ hasText: "Active air suspension roadmap" });
	await roadmap.click();
	const question = page.getByRole("region", { name: "Clarification questions — answer or skip to continue chatting" });
	await expect(chat.getByRole("group", { name: "Canva, used by Jordan Okafor" })).toBeVisible();
	await expect(roadmap.getByText("Needs input", { exact: true })).toBeVisible();
	await expect(oldBar).toHaveCount(0);
	const questionCard = question.getByRole("dialog");
	await expect(questionCard).toHaveCSS("box-shadow", /^(?:none|(?:rgba\(0, 0, 0, 0\) 0px 0px 0px 0px(?:, )?)+)$/);
	const shortcuts = chat.locator('[data-slot="footer"]');
	await expect(shortcuts).toHaveCount(1);
	await expect(shortcuts).toContainText("Enter to select");
	await expect(chat.getByText("Uses AI. Verify results.", { exact: true })).toHaveCount(0);
	await expect(question.getByRole("button", { name: /Prioritize off-road performance/ })).toBeEnabled();
	await expect(question.getByRole("button", { name: "Dismiss questions" })).toHaveCount(0);
	await expect(question.getByRole("textbox", { name: /custom answer/ })).toBeEnabled();
	await expect(shortcuts).not.toContainText("Esc to skip");
	let chatRequests = 0;
	page.on("request", (request) => { if (request.method() === "POST" && new URL(request.url()).pathname.includes("/api/chat")) chatRequests++; });
	await questionCard.focus();
	await page.keyboard.press("Escape");
	await expect(questionCard).toBeVisible();
	await expect(roadmap.getByText("Needs input", { exact: true })).toBeVisible();
	await expect.poll(() => chatRequests).toBe(0);
	await question.getByRole("button", { name: /Prioritize off-road performance/ }).click();
	await expect(page.getByText("Thanks — I’ll continue with that direction.")).toBeVisible();
	await expect(chat.getByText("Uses AI. Verify results.", { exact: true })).toBeVisible();
	await expect(chat.getByText("Enter to select", { exact: true })).toHaveCount(0);
	await expect(input).toHaveCount(0);
	await expect(roadmap.getByText("Working", { exact: true })).toBeVisible();
	await expect(owner.getByText("Working", { exact: true })).toHaveCount(2);
	await viewer.locator("article").first().click();
	await expect(input).toHaveCount(0);
	await owner.locator("article").first().click();
	await expect(input).toBeEnabled();
	await expect(contextBar).toBeVisible();
});

test("viewer chat header explains why the prompt input is hidden", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1200 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	await page.getByRole("button", { name: "Team session", exact: true }).click();
	const viewer = page.getByRole("region", { name: "Cloud (Viewer) sessions" });
	await viewer.locator("article").filter({ hasText: "Active air suspension roadmap" }).click();
	const chat = page.locator('[data-rovo-chat-placement="floating"]');
	const identity = chat.getByRole("group", { name: "Canva", exact: true });
	const message = "Only Jordan Okafor, the session owner, can steer this session. You can unblock it and review the outcome.";
	const explanation = page.getByRole("tooltip").filter({ hasText: message });
	await expect(identity).toHaveAccessibleDescription(message);
	await expect(explanation).toHaveCount(0);
	await identity.getByText("Canva", { exact: true }).hover();
	await expect(explanation).toBeVisible();
	await page.mouse.move(0, 0);
	await expect(explanation).toHaveCount(0);
	await chat.getByRole("button", { name: "Close", exact: true }).focus();
	await page.keyboard.press("Shift+Tab");
	await page.keyboard.press("Shift+Tab");
	await expect(identity).toBeFocused();
	await expect(explanation).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(explanation).toHaveCount(0);
});

test("team owners retain the question dismiss control", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1200 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	await page.getByRole("button", { name: "Team session", exact: true }).click();
	await page.getByRole("region", { name: "Cloud (Owner) sessions" }).locator("article").filter({ hasText: "Active air suspension roadmap" }).click();
	const question = page.getByRole("region", { name: "Clarification questions — answer or skip to continue chatting" });
	await expect(question.getByRole("dialog")).toHaveCSS("box-shadow", /^(?:none|(?:rgba\(0, 0, 0, 0\) 0px 0px 0px 0px(?:, )?)+)$/);
	await expect(question.getByRole("button", { name: "Dismiss questions" })).toBeEnabled();
});

test("viewer attribution and question shortcuts fit at a compact viewport", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 720 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	await page.getByRole("button", { name: "Team session", exact: true }).click();
	const viewer = page.getByRole("region", { name: "Cloud (Viewer) sessions" });
	await viewer.locator("article").filter({ hasText: "Active air suspension roadmap" }).click();
	const chat = page.locator('[data-rovo-chat-placement="floating"]');
	const attribution = chat.getByRole("group", { name: "Canva, used by Jordan Okafor" });
	await expect(chat.getByRole("heading", { name: "What should the suspension roadmap prioritize?" })).toBeVisible();
	await expect(attribution).toBeVisible();
	await expect(chat.getByRole("group", { name: "Session owner and status" })).toHaveCount(0);
	await expect.poll(() => chat.evaluate((element) => {
		const bounds = element.getBoundingClientRect();
		const footer = element.querySelector('[data-slot="footer"]')?.getBoundingClientRect();
		return footer ? footer.bottom - bounds.bottom : Infinity;
	})).toBeLessThanOrEqual(1);
	await chat.getByRole("button", { name: /Balance both goals/ }).click();
	await expect(attribution).toBeVisible();
});

test("team viewers can submit a custom question answer", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1200 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	await page.getByRole("button", { name: "Team session", exact: true }).click();
	await page.getByRole("region", { name: "Cloud (Viewer) sessions" }).locator("article").filter({ hasText: "Active air suspension roadmap" }).click();
	const answer = page.getByRole("textbox", { name: /custom answer/ });
	await answer.fill("Start with a pilot on rough terrain.");
	await answer.press("Enter");
	await expect(page.getByText("Start with a pilot on rough terrain.")).toBeVisible();
	await expect(page.getByText("Thanks — I’ll continue with that direction.")).toBeVisible();
	await expect(page.getByRole("textbox", { name: "Chat message input" })).toHaveCount(0);
});

test("Small joins the avatar stack directly to metadata and keeps the PR-time separator", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	await page.getByRole("button", { name: "Small", exact: true }).click();
	const rows = page.getByRole("region", { name: /^(Local|Cloud) sessions$/ }).locator("article");
	await expect(rows).toHaveCount(6);
	const separators = await rows.evaluateAll((elements) => elements.map((row) => {
		const identity = row.querySelector("[data-agent-session-agent]")?.parentElement;
		const metadata = identity?.parentElement;
		return {
			leadingDot: identity?.nextElementSibling?.firstElementChild?.textContent === "·",
			dots: [...(metadata?.querySelectorAll('span[aria-hidden="true"]') ?? [])].filter((element) => element.textContent === "·").length,
		};
	}));
	expect(separators).toEqual([
		{ leadingDot: false, dots: 1 }, { leadingDot: false, dots: 1 }, { leadingDot: false, dots: 1 },
		{ leadingDot: false, dots: 1 }, { leadingDot: false, dots: 0 }, { leadingDot: false, dots: 0 },
	]);
});

test("session identity shows names in Large and states in Medium", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	const identities = page.getByRole("region", { name: /^(Local|Cloud) sessions$/ }).locator("[data-agent-session-agent]");
	for (const size of ["Large", "Medium", "Small", "Large"]) {
		await page.getByRole("button", { name: size, exact: true }).click();
		await expect(identities).toHaveText(size === "Large" ? ["Claude", "Cursor", "Rovo", "Claude", "Canva", "Figma"] : size === "Medium" ? ["Working", "Needs input", "Finished", "Working", "Needs input", "Finished"] : ["", "", "", "", "", ""]);
	}
	await expect(page.getByRole("region", { name: /^(Local|Cloud) sessions$/ }).locator("[data-agent-session-tool-call]")).toHaveCount(0);
});

test("Medium puts shimmering state text after the avatars and keeps Small status glyphs", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	await page.getByRole("button", { name: "Medium", exact: true }).click();
	const rows = page.getByRole("region", { name: /^(Local|Cloud) sessions$/ }).locator("article");
	for (const [index, state] of ["Working", "Needs input", "Finished", "Working", "Needs input", "Finished"].entries()) {
		const row = rows.nth(index);
		const identity = row.locator("[data-agent-session-agent]");
		await expect(identity).toHaveText(state);
		const stack = identity.locator(":scope > *").first();
		const label = identity.locator(":scope > span[title]");
		const [stackBounds, labelBounds] = await Promise.all([stack.boundingBox(), label.boundingBox()]);
		if (!stackBounds || !labelBounds) throw new Error("Missing avatar stack or state text");
		expect(labelBounds.x - stackBounds.x - stackBounds.width).toBe(4);
		expect(labelBounds.y + labelBounds.height / 2).toBe(stackBounds.y + stackBounds.height / 2);
		await expect(identity.locator(".shimmer")).toHaveCount(state === "Working" ? 1 : 0);
		await expect(row.locator("[data-agent-session-lifecycle-current]")).toHaveCount(1);
	}
	const glyphs = () => rows.evaluateAll((elements) => elements.map((row) => {
		const indicator = row.querySelector("[data-agent-session-lifecycle-current]");
		if (!indicator) throw new Error("Missing status indicator");
		const box = indicator.getBoundingClientRect();
		return { state: indicator.getAttribute("data-agent-session-lifecycle-current"), width: box.width, height: box.height, glyphs: [...indicator.querySelectorAll("svg")].map((svg) => ({ width: getComputedStyle(svg).width, height: getComputedStyle(svg).height, viewBox: svg.getAttribute("viewBox"), color: getComputedStyle(svg).color })) };
	}));
	const mediumGlyphs = await glyphs();
	await page.getByRole("button", { name: "Small", exact: true }).click();
	expect(await glyphs()).toEqual(mediumGlyphs);
});

test("My session menus show owner actions with icons and a separator before Delete", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	await page.getByRole("button", { name: "My session", exact: true }).click();
	await page.getByRole("button", { name: "Small", exact: true }).click();
	for (const host of ["Local", "Cloud"]) {
		const row = page.getByRole("region", { name: `${host} sessions`, exact: true }).locator("article").first();
		await row.getByRole("button", { name: /^More actions for/ }).focus();
		await page.keyboard.press("Enter");
		const menu = page.getByRole("menu");
		await expect(menu.getByRole("menuitem")).toHaveText(["Stop session", "Pin", "Rename", "Delete"]);
		await expect(menu.getByRole("separator")).toHaveCount(1);
		for (const label of ["Stop session", "Pin", "Rename", "Delete"]) {
			const action = menu.getByRole("menuitem", { name: label, exact: true });
			await expect(action).toBeEnabled();
			await expect(action.locator("svg")).toBeVisible();
			await expect(action.locator("svg")).toHaveCSS("width", "16px");
			await expect(action.locator("svg")).toHaveCSS("height", "16px");
			await expect(action.locator(":scope > span").first()).toHaveCSS("width", "16px");
			await expect(action.locator(":scope > span").first()).toHaveCSS("height", "16px");
		}
		await expect(menu.getByRole("menuitem", { name: "Delete", exact: true })).toHaveAttribute("data-variant", "destructive");
		await page.keyboard.press("Escape");
		await expect(menu).toBeHidden();
	}
});

test("session timestamps remain last in the metadata at every size", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	const rows = page.getByRole("region", { name: /^(Local|Cloud) sessions$/ }).locator("article");
	for (const size of ["Large", "Medium", "Small"]) {
		await page.getByRole("button", { name: size, exact: true }).click();
		await expect.poll(() => rows.evaluateAll((elements) => elements.map((row) => {
			const identity = row.querySelector("[data-agent-session-agent]")?.getBoundingClientRect();
			const time = row.querySelector('[data-last-update]')?.getBoundingClientRect();
			const artifact = row.querySelector('[data-session-pr-title]')?.getBoundingClientRect();
			return identity !== undefined && time !== undefined && time.x >= identity.right && (artifact === undefined || time.x >= artifact.right);
		})), size).toEqual([true, true, true, true, true, true]);
	}
});

test("private sessions keep their status on hover and focus without owner actions", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	await page.getByRole("button", { name: "Private session", exact: true }).click();
	for (const size of ["Large", "Medium", "Small"]) {
		await page.getByRole("button", { name: size, exact: true }).click();
		for (const host of ["Local", "Cloud"]) {
			const sessions = page.getByRole("region", { name: `${host} sessions`, exact: true });
			const rows = sessions.locator("article");
			await expect(rows).toHaveCount(3);
			for (const [index, state] of ["Working", "Needs input", "Finished"].entries()) {
				const row = rows.nth(index);
				const indicator = size === "Medium" ? row.locator("[data-agent-session-agent]").getByText(state, { exact: true }) : row.getByRole("img", { name: state, exact: true });
				await row.hover();
				await expect(indicator).toBeVisible();
				await row.focus();
				await expect(indicator).toBeVisible();
				await expect(row.locator('[data-access-mark="private"]')).toBeVisible();
				await expect(row.locator('[data-access-mark="team"]')).toHaveCount(0);
				await expect(row.getByRole("button")).toHaveCount(0);
			}
			await expect(sessions.getByRole("button", { name: /^More actions for/ })).toHaveCount(0);
		}
	}
	await page.getByRole("button", { name: "My session", exact: true }).click();
	const ownedRow = page.getByRole("region", { name: "Local sessions", exact: true }).locator("article").first();
	await ownedRow.hover();
	await expect(ownedRow.getByRole("button", { name: /^More actions for/ })).toBeVisible();
});

test("session size controls stay centered over the card column", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	const controls = page.getByRole("group", { name: "Session card size", exact: true });
	const card = page.getByRole("region", { name: "Cloud sessions", exact: true }).locator("article").first();
	for (const size of ["Large", "Medium", "Small"]) {
		await controls.getByRole("button", { name: size, exact: true }).click();
		await expect.poll(async () => {
			const [controlBounds, cardBounds] = await Promise.all([controls.boundingBox(), card.boundingBox()]);
			if (!controlBounds || !cardBounds) throw new Error("Missing session size control or card");
			return Math.abs(controlBounds.x + controlBounds.width / 2 - cardBounds.x - cardBounds.width / 2);
		}).toBeLessThan(1);
	}
});

test("large session metadata reveals more text when the card has space", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	const row = page.getByRole("region", { name: "Local sessions", exact: true }).locator("article").first();
	const artifact = row.locator('[data-session-pr-title]');
	await page.getByRole("button", { name: "Medium", exact: true }).click();
	const mediumWidth = await artifact.evaluate((element) => element.getBoundingClientRect().width);
	await page.getByRole("button", { name: "Large", exact: true }).click();
	await expect.poll(() => artifact.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(mediumWidth);
	await expect.poll(() => artifact.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
	const timestamp = row.locator('[data-last-update]');
	await expect(timestamp).toBeVisible();
	const bounds = await row.boundingBox();
	const timeBounds = await timestamp.boundingBox();
	if (!bounds || !timeBounds) throw new Error("Missing session metadata geometry");
	expect(timeBounds.x + timeBounds.width).toBeLessThan(bounds.x + bounds.width);
});

test("session cards do not expose individual tool calls at any size", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 1100 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Agent sessions", exact: true }).click();
	const sessions = page.getByRole("region", { name: /^(Local|Cloud) sessions$/ });
	for (const size of ["Large", "Medium", "Small"]) {
		await page.getByRole("button", { name: size, exact: true }).click();
		await expect(sessions.locator("article")).toHaveCount(6);
		await expect(sessions.locator("[data-agent-session-tool-call]")).toHaveCount(0);
		await expect(sessions.getByText("Tool call:")).toHaveCount(0);
		await expect(sessions.getByText("Editing the shared implementation.", { exact: true })).toHaveCount(0);
	}
});

test("board and journey session menus show private marks for other people's sessions", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	for (const view of ["Board", "e2e Journey"]) {
		await page.getByRole("button", { name: `Select ${view}`, exact: true }).click();
		for (const [key, button, owners] of [
			["PAY-107", "Using agents", ["Maya Ferreira", "Jordan Okafor"]],
			["PAY-123", "Claude: Working", ["Jordan Okafor"]],
		] as const) {
			const card = page.locator(`[data-issue-key="${key}"][data-board-column-title]`).filter({ visible: true });
			await card.getByRole("button", { name: button }).click();
			const menu = page.getByRole("dialog", { name: "Agent assignment" });
			if (key === "PAY-107") await expect(menu.getByText(/use an agent|using agents|other agent activity/iu)).toHaveCount(0);
			else await expect(menu.getByRole("button", { name: "Other agent activity", exact: true })).toBeVisible();
			for (const owner of owners) await expect(menu.getByRole("img", { name: `Private session by ${owner}` })).toBeVisible();
			await expect(menu.locator('[data-access-mark="team"]')).toHaveCount(0);
			await page.keyboard.press("Escape");
		}
	}
});

test("session menu keeps the divider inset equal to the row side inset", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board", exact: true }).click();
	await page.getByRole("region", { name: "Payments SDK v2 Kanban board" }).locator('[data-issue-key="PAY-123"][data-board-column-title]').getByRole("button", { name: "Claude: Working", exact: true }).click();
	const menu = page.getByRole("dialog", { name: "Agent assignment" });
	const row = menu.locator("article").first();
	const separator = menu.locator('[data-slot="dropdown-menu-separator"]').first();
	await expect(separator).toBeVisible();
	const gaps = await menu.evaluate((element) => {
		const rowBox = element.querySelector("article")?.getBoundingClientRect();
		const separatorBox = element.querySelector('[data-slot="dropdown-menu-separator"]')?.getBoundingClientRect();
		const menuBox = element.getBoundingClientRect();
		if (!rowBox || !separatorBox) throw new Error("Missing session row or divider");
		return { side: rowBox.left - menuBox.left, bottom: separatorBox.top - rowBox.bottom };
	});
	await expect(row).toBeVisible();
	expect(Math.abs(gaps.bottom - gaps.side)).toBeLessThan(0.5);
});

test("teammate sessions keep their popover alignment while expanding near the viewport edge", async ({ page }) => {
	await page.setViewportSize({ width: 1398, height: 1236 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board", exact: true }).click();
	await page.getByRole("region", { name: "Payments SDK v2 Kanban board" }).locator('[data-issue-key="PAY-123"][data-board-column-title]').getByRole("button", { name: "Claude: Working", exact: true }).click();
	const popup = page.getByRole("dialog", { name: "Agent assignment" });
	const disclosure = popup.getByRole("button", { name: /^(?:Use an agent|Using agents|Other agent activity)$/u });
	await expect(disclosure).toHaveAttribute("aria-expanded", "true");
	await disclosure.click();
	await expect(disclosure).toHaveAttribute("aria-expanded", "false");
	await page.setViewportSize({ width: 1398, height: 900 });
	await expect(popup).toHaveAttribute("data-align", "start");
	await disclosure.click();
	await expect(disclosure).toHaveAttribute("aria-expanded", "true");
	const panel = popup.locator('[data-slot="collapsible-content"]');
	await expect.poll(() => panel.evaluate((element) => Math.abs(element.getBoundingClientRect().height - element.scrollHeight))).toBeLessThan(1);
	await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
	await expect(popup).toHaveAttribute("data-align", "start");
	await expect(popup.getByText("Recording decline-code fixtures")).toBeVisible();
	await disclosure.press("Escape");
	await expect(disclosure).toHaveAttribute("aria-expanded", "false");
	await expect(disclosure).toBeFocused();
});

test("Butter session menus name the work instead of the agent", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board", exact: true }).click();
	const board = page.getByRole("region", { name: "Payments SDK v2 Kanban board" });
	const issue = board.locator('[data-issue-key="PAY-105"][data-board-column-title]');
	await issue.getByRole("button", { name: /^(?:2 agents|Cursor): Working$/u }).click();
	const assignment = page.getByRole("dialog", { name: "Agent assignment" });
	await expect(assignment.getByText("Replaying 3-D Secure fixtures", { exact: true })).toBeVisible();
	for (const agent of ["Cursor", "Claude"]) {
		const identity = assignment.getByRole("group", { name: `${agent}, used by Venn`, exact: true });
		await expect(identity.getByRole("img", { name: "Venn", exact: true })).toBeVisible();
	}
	await expect(assignment.getByText("Cursor", { exact: true })).toHaveCount(0);
	await expect(assignment.getByRole("button", { name: "Add agent", exact: true })).toHaveCount(0);
	await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "Select e2e Journey" }).click();
	const journeyCard = page.locator('[data-butter-board-surface] [data-issue-key="PAY-105"][data-board-column-title]');
	await journeyCard.getByRole("button", { name: /^(?:2 agents|Cursor): Working$/u }).click();
	const journeyAssignment = page.getByRole("dialog", { name: "Agent assignment" });
	await expect(journeyAssignment.getByText("Replaying 3-D Secure fixtures", { exact: true })).toBeVisible();
	await expect(journeyAssignment.getByRole("button", { name: "Add agent", exact: true })).toHaveCount(0);
});

test("board session flyout reveals more actions when hovering the status", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board", exact: true }).click();
	const issue = page.getByRole("region", { name: "Payments SDK v2 Kanban board" }).locator('[data-issue-key="PAY-105"][data-board-column-title]');
	await issue.getByRole("button", { name: "2 agents: Working" }).click();
	const flyout = page.getByRole("dialog", { name: "Agent assignment" });
	const row = flyout.locator("article").filter({ hasText: "Replaying 3-D Secure fixtures" });
	await expect(row).toBeVisible();
	await page.mouse.move(0, 0);
	const status = row.getByRole("img", { name: "Working" });
	await expect(status).toBeVisible();
	const statusBounds = await status.boundingBox();
	if (!statusBounds) throw new Error("Session status is not rendered");
	await page.mouse.move(statusBounds.x + statusBounds.width / 2, statusBounds.y + statusBounds.height / 2);
	const more = row.getByRole("button", { name: "More actions for Replaying 3-D Secure fixtures" });
	await expect(more).toBeVisible();
	await expect(status).toBeHidden();
	await expect(more.locator("[data-slot=icon]")).toBeVisible();
	await more.click();
	await expect(page.getByRole("menu")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(more).toBeFocused();
});

test("the original Butter session menu shows sessions without an Add agent footer", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter"));
	await page.locator('[data-issue-key="PAY-105"][data-board-column-title]').getByRole("button", { name: "Cursor: Working" }).click();
	await expect(page.getByRole("dialog", { name: "Agent assignment" }).getByRole("button", { name: "Add agent", exact: true })).toHaveCount(0);
});

test("session titles describe their work in grouped, review, and List views", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select e2e Journey" }).click();
	const unlinked = page.getByRole("region", { name: /Unlink sessions/ });
	await expect(unlinked.getByText("Keep or delete the adapter", { exact: true })).toBeHidden();
	await unlinked.getByRole("button", { name: "Expand Unlink sessions column" }).click();
	await expect(unlinked.getByText("Keep or delete the adapter", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Select Board", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery" }).click();
	const board = page.getByRole("region", { name: "Payments SDK v2 Kanban board" });
	const grouped = board.locator('[data-issue-key="PAY-123"][data-board-column-title]');
	await grouped.getByRole("button", { name: "2 agents: Needs input" }).click();
	let assignment = page.getByRole("dialog", { name: "Agent assignment" });
	await expect(assignment.getByText("Checking decline fixture coverage", { exact: true })).toBeVisible();
	await expect(assignment.getByText("Recording decline-code fixtures", { exact: true })).toBeVisible();
	await page.keyboard.press("Escape");
	const review = board.locator('[data-issue-key="PAY-112"][data-board-column-title]');
	await review.getByRole("button", { name: "Codex: Needs input" }).click();
	assignment = page.getByRole("dialog", { name: "Agent assignment" });
	await expect(assignment.getByText("Review sandbox key retention", { exact: true })).toBeVisible();
	await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "Open gallery" }).click();
	await page.getByRole("button", { name: "Select e2e Journey" }).click();
	await page.getByRole("tab", { name: "List", exact: true }).click();
	const row = page.getByRole("region", { name: "Payments SDK v2 migration work items list" }).locator("tr").filter({ hasText: "PAY-105" });
	await row.getByRole("button", { name: "Cursor: Working" }).click();
	assignment = page.getByRole("dialog", { name: "Agent assignment" });
	await expect(assignment.getByText("Replaying 3-D Secure fixtures", { exact: true })).toBeVisible();
	await page.keyboard.press("Escape");
	await row.getByRole("button", { name: "Add agent to PAY-105" }).click();
	const picker = page.getByRole("dialog", { name: "Agents" });
	await picker.getByRole("button", { name: "Claude (Recommended)" }).click();
	await expect(picker).toBeHidden();
	const sessions = row.getByRole("button", { name: "2 agents: Working" });
	await expect(sessions).toBeVisible();
	await sessions.focus();
	await page.keyboard.press("Enter");
	await expect(assignment.getByText("Replaying 3-D Secure fixtures", { exact: true })).toBeVisible();
	await expect(assignment.getByText("Port confirmPaymentIntent and the 3-D Secure challenge flow", { exact: true })).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(assignment).toBeHidden();
	await expect(sessions).toBeFocused();
});

test("Venn's unlinked session matches the teammate agent avatar size with no human badge", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select e2e Journey", exact: true }).click();
	const unlinked = page.getByRole("region", { name: /Unlink sessions/ });
	await unlinked.getByRole("button", { name: "Expand Unlink sessions column" }).click();
	const own = unlinked.locator("article").filter({ hasText: "Kill switch as port gate" });
	const teammate = unlinked.locator("article").filter({ hasText: "Keep or delete the adapter" });
	await expect(own.locator('[data-session-drag-identity] [data-slot="human-agent-avatar"]')).toHaveCount(0);
	const ownAvatar = own.locator('[data-session-drag-identity] [data-slot="avatar"][aria-label="Cursor"]');
	const teammateIdentity = teammate.locator('[data-session-drag-identity] [data-slot="human-agent-avatar"]');
	await expect(ownAvatar).toBeVisible();
	await expect(teammateIdentity).toHaveAttribute("aria-label", "Claude, used by Priya Raman");
	for (const avatar of [ownAvatar, teammateIdentity.locator('[data-avatar-role="agent"] [data-slot="avatar"]')]) {
		await expect(avatar).toHaveCSS("width", "30px");
		await expect(avatar).toHaveCSS("height", "30px");
	}
});

test("a revised unlinked session scales out before returning from the top", async ({ page }) => {
	test.setTimeout(90_000);
	await page.setViewportSize({ width: 1800, height: 1100 });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select e2e Journey", exact: true }).click();
	const column = page.getByRole("region", { name: /Unlink sessions/ });
	await column.getByRole("button", { name: "Expand Unlink sessions column" }).click();
	await page.getByRole("heading", { name: "Jira Design" }).click();
	const trace = await page.evaluateHandle(() => {
		const samples: { id: string; departing: boolean; index: number; scale: number; y: number; opacity: number }[] = [];
		const departures = new Map<string, { index: number; reorderedOpacity?: number; maxTravel: number }>();
		let stopped = false;
		const sample = () => {
			for (const row of document.querySelectorAll<HTMLElement>('[data-agent-session-column] [data-testid^="agent-session-row-"]')) {
				const box = row.getBoundingClientRect();
				if (box.bottom < 0 || box.top > innerHeight) continue;
				const style = getComputedStyle(row);
				const matrix = style.transform === "none" ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(style.transform);
				const id = row.dataset.testid ?? "";
				const index = Array.from(row.parentElement?.children ?? []).indexOf(row);
				const departing = row.hasAttribute("data-departing");
				if (departing && !departures.has(id)) departures.set(id, { index, maxTravel: 0 });
				const departure = departures.get(id);
				if (departure && departing) departure.maxTravel = Math.max(departure.maxTravel, Math.abs(matrix.m42));
				if (departure && departure.reorderedOpacity === undefined && index !== departure.index) departure.reorderedOpacity = Number(style.opacity);
				samples.push({ id, departing, index, scale: matrix.a, y: matrix.m42, opacity: Number(style.opacity) });
			}
			if (!stopped) requestAnimationFrame(sample);
		};
		requestAnimationFrame(sample);
		return { samples, departures, stop: () => { stopped = true; } };
	});
	try {
		await expect.poll(() => trace.evaluate(({ samples }) => samples.some((sample, index) => {
			if (!sample.departing || sample.index <= 0 || sample.scale >= 0.98) return false;
			return samples.slice(index + 1).some((later) => later.id === sample.id && !later.departing && later.index === 0 && later.y < -1 && later.opacity < 1 && Math.abs(later.scale - 1) < 0.01);
		})), { timeout: 60_000 }).toBe(true);
		const departures = await trace.evaluate(({ departures }) => [...departures.values()].filter((departure) => departure.reorderedOpacity !== undefined));
		expect(departures.length).toBeGreaterThan(0);
		for (const departure of departures) {
			expect(departure.reorderedOpacity, "the row must finish fading before it moves to the top").toBeLessThan(0.02);
			expect(departure.maxTravel, "the scale-out stays in its old slot").toBeLessThan(1);
		}
	} finally {
		await trace.evaluate((value) => value.stop());
		await trace.dispose();
	}
});

test("a new board session uses the work-item summary as its title", async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 1000 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto(appUrl("/butter-v1"));
	await page.getByRole("button", { name: "Select Board", exact: true }).click();
	await page.getByRole("button", { name: "Close gallery" }).click();
	const card = page.getByRole("region", { name: "Payments SDK v2 Kanban board" }).locator('[data-issue-key="PAY-118"][data-board-column-title]');
	await card.getByRole("button", { name: "Add agent to PAY-118" }).focus();
	await page.keyboard.press("Enter");
	const picker = page.getByRole("dialog", { name: "Agents" });
	const search = picker.getByRole("textbox", { name: "Search agents" });
	await search.fill("Cursor");
	const cursor = picker.getByRole("button", { name: "Cursor", exact: true });
	await cursor.click();
	await expect(picker).toBeHidden();
	await card.getByRole("button", { name: /^Cursor: / }).click();
	await expect(page.getByRole("dialog", { name: "Agent assignment" }).getByText("Carry card-artwork metadata into the next wallet epic", { exact: true })).toBeVisible();
});
