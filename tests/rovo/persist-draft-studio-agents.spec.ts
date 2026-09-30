import { expect, test, type Page } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

const STUDIO_URL = appUrl("/studio");

const STORAGE_KEY = "vpk:studio:session-agents:v1";

const SEEDED_AGENT_NAME = "Draft Persistence Probe";
const SEEDED_AGENT_ID = "draft-persistence-probe";
const SEEDED_RESULT_KEY = "draft-persistence-probe::1";

function buildSeedRecord() {
	const agentResult = {
		agentId: SEEDED_AGENT_ID,
		name: SEEDED_AGENT_NAME,
		summary: "Verifies draft agents survive browser refresh.",
		action: "create" as const,
	};

	return {
		profileId: SEEDED_AGENT_ID,
		resultKey: SEEDED_RESULT_KEY,
		sourceResult: agentResult,
		draftResult: agentResult,
		publishReadyResult: agentResult,
		publishedResult: null,
		publishStatus: "testing" as const,
		lastTouchedAt: 1748332800000,
	};
}

async function seedSessionAgent(page: Page) {
	const record = buildSeedRecord();
	await page.addInitScript(
		({ key, value }) => {
			window.localStorage.setItem(key, JSON.stringify([value]));
		},
		{ key: STORAGE_KEY, value: record },
	);
}

async function expectSeededAgentInSidebar(page: Page) {
	const sidebarNav = page.getByRole("navigation", { name: /studio/i });
	await expect(sidebarNav.getByText(SEEDED_AGENT_NAME).first()).toBeVisible();
}

test.describe("Studio draft agent persistence", () => {
	test("seeded draft agent appears in the left-hand Agents nav on first load", async ({ page }) => {
		await seedSessionAgent(page);

		await page.goto(STUDIO_URL, { waitUntil: "networkidle" });

		await expectSeededAgentInSidebar(page);
	});

	test("seeded draft agent survives a full page reload", async ({ page }) => {
		await seedSessionAgent(page);

		await page.goto(STUDIO_URL, { waitUntil: "networkidle" });
		await expectSeededAgentInSidebar(page);

		await page.reload({ waitUntil: "networkidle" });
		await expectSeededAgentInSidebar(page);

		const stored = await page.evaluate(
			(key) => window.localStorage.getItem(key),
			STORAGE_KEY,
		);
		expect(stored).not.toBeNull();
		expect(stored).toContain(SEEDED_AGENT_ID);
	});
});
