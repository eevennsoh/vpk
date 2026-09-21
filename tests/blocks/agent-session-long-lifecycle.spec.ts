import { expect, test } from "@playwright/test";

const AGENT_SESSION_URL = (
	process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"
) + "/components/blocks/agent-session";

test("cloud long loading text and Working controls share the metadata center", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(AGENT_SESSION_URL, { waitUntil: "domcontentloaded" });
	const cloudLongHeading = page.getByRole("heading", { name: "Cloud — long" });
	await expect(cloudLongHeading).toBeVisible();

	const workingRows = cloudLongHeading
		.locator("xpath=../../..")
		.getByTestId("agent-session-row-cloud-suspension-refactor");
	await expect(workingRows).toHaveCount(2);

	for (const row of await workingRows.all()) {
		const agent = await row.locator('[title="Claude"]').boundingBox();
		const toolCall = await row.locator("[data-agent-session-tool-call]").boundingBox();
		const working = await row.getByRole("button", { name: "Working" }).boundingBox();
		expect(agent).not.toBeNull();
		expect(toolCall).not.toBeNull();
		expect(working).not.toBeNull();
		if (agent === null || toolCall === null || working === null) {
			throw new Error("Cloud session metadata is not laid out");
		}

		const agentCenter = agent.y + agent.height / 2;
		const toolCallCenter = toolCall.y + toolCall.height / 2;
		const workingCenter = working.y + working.height / 2;
		expect(Math.abs(toolCallCenter - agentCenter)).toBeLessThanOrEqual(1);
		expect(Math.abs(workingCenter - agentCenter)).toBeLessThanOrEqual(1);
	}

	const ownerRow = workingRows.first();
	await ownerRow.scrollIntoViewIfNeeded();
	const cycle = await ownerRow.evaluate(async (row) => {
		const agent = row.querySelector('span[title="Claude"]');
		const firstTitle = row.querySelector("[data-agent-session-tool-call]")?.getAttribute("title");
		if (agent === null || firstTitle === null || firstTitle === undefined) {
			return { changed: false, maxOffset: Number.POSITIVE_INFINITY };
		}

		const started = performance.now();
		let changedAt: number | null = null;
		let maxOffset = 0;
		while (performance.now() - started < 4_500 &&
			(changedAt === null || performance.now() - changedAt < 350)) {
			const call = row.querySelector("[data-agent-session-tool-call]");
			if (call !== null) {
				const callRect = call.getBoundingClientRect();
				const agentRect = agent.getBoundingClientRect();
				maxOffset = Math.max(maxOffset, Math.abs(
					(callRect.top + callRect.bottom - agentRect.top - agentRect.bottom) / 2,
				));
				if (changedAt === null && call.getAttribute("title") !== firstTitle) {
					changedAt = performance.now();
				}
			}
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		}
		return { changed: changedAt !== null, maxOffset };
	});
	expect(cycle.changed).toBe(true);
	expect(cycle.maxOffset).toBeLessThanOrEqual(1);
});
