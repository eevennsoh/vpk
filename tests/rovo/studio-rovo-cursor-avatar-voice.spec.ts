import { expect, test, type Page } from "@playwright/test";

import { appUrl } from "@/tests/helpers/origin";

const STUDIO_URL = appUrl("/studio");

const STORAGE_KEY = "vpk:studio:session-agents:v1";
const SEEDED_AGENT_ID = "voice-avatar-blue-agent";
const SEEDED_AGENT_NAME = "Voice Avatar Blue Agent";
const INITIAL_AVATAR_SRC = "/avatar-agent/dev-agents/feature-flag-cleaner.svg";
const BLUE_AVATAR_SRC = "/avatar-agent/teamwork-agents/blocker-checker.svg";
const AVATAR_TRIGGER_TARGET_ID = "studio-agent-config:avatar";
const BLUE_AVATAR_TARGET_ID = "studio-agent-config:avatar:teamwork-agents:blocker-checker";

declare global {
	interface Window {
		__VPK_E2E_SCREEN_ASSISTANT__?: boolean;
		__vpkStudioScreenAssistantTest?: {
			callTool: (call: { args?: Record<string, unknown>; name: string }) => Promise<unknown>;
			streamAssistantText: (chunks: string[]) => Promise<{ ok: true }>;
		};
	}
}

type ScreenAssistantToolOutput = {
	activated?: { id?: string; label?: string } | null;
	ok?: boolean;
	pointed?: { id?: string; label?: string } | null;
	visibleTargets?: unknown;
};

function buildSeedRecord() {
	const agentResult = {
		action: "create" as const,
		agentId: SEEDED_AGENT_ID,
		avatarSrc: INITIAL_AVATAR_SRC,
		description: "Verifies fake voice can drive the Rovo cursor avatar picker.",
		name: SEEDED_AGENT_NAME,
		summary: "Verifies fake voice can drive the Rovo cursor avatar picker.",
	};

	return {
		draftResult: agentResult,
		lastPublishedAt: null,
		lastPublishedBy: null,
		lastTouchedAt: 1748332800000,
		profileId: SEEDED_AGENT_ID,
		publishReadyResult: agentResult,
		publishStatus: "testing" as const,
		publishedResult: null,
		publishedVersion: 0,
		resultKey: `${SEEDED_AGENT_ID}::1`,
		sourceResult: agentResult,
		versionHistory: [],
	};
}

async function seedStudioAgentAndEnableScreenAssistantTestHook(page: Page) {
	const record = buildSeedRecord();
	await page.addInitScript(
		({ key, value }) => {
			window.__VPK_E2E_SCREEN_ASSISTANT__ = true;
			window.localStorage.setItem(key, JSON.stringify([value]));
		},
		{ key: STORAGE_KEY, value: record },
	);
}

async function callScreenAssistantTool(
	page: Page,
	name: string,
	args: Record<string, unknown> = {},
): Promise<ScreenAssistantToolOutput> {
	const output = await page.evaluate(
		async ({ toolArgs, toolName }) => {
			const testApi = window.__vpkStudioScreenAssistantTest;
			if (!testApi) {
				throw new Error("Studio screen-assistant test hook was not registered.");
			}
			return testApi.callTool({ args: toolArgs, name: toolName });
		},
		{ toolArgs: args, toolName: name },
	);
	return output as ScreenAssistantToolOutput;
}

test.describe("Studio Rovo cursor fake voice avatar flow", () => {
	test("streams assistant text into the cursor response panel without a microphone", async ({ page }) => {
		const expectedText = "Rovo is typing this message in the Clicky panel.";
		await page.addInitScript(() => {
			window.__VPK_E2E_SCREEN_ASSISTANT__ = true;
		});

		await page.goto(`${STUDIO_URL}?agent=rfp-drafting-agent`, { waitUntil: "networkidle" });
		await page.waitForFunction(() => Boolean(window.__vpkStudioScreenAssistantTest));

		await page.evaluate(async (chunks) => {
			const testApi = window.__vpkStudioScreenAssistantTest;
			if (!testApi) {
				throw new Error("Studio screen-assistant test hook was not registered.");
			}
			await testApi.streamAssistantText(chunks);
		}, ["Rovo is ", "typing this ", "message in ", "the Clicky panel."]);

		const responseOverlay = page.locator("[data-clicky-response-overlay]");
		await expect(responseOverlay).toBeVisible();
		await expect(responseOverlay).toContainText(expectedText);
		await expect(page.getByText("Conversation", { exact: true })).toBeHidden();
	});

	test("points at the agent avatar and picks a blue avatar through screen-assistant tools", async ({ page }) => {
		await seedStudioAgentAndEnableScreenAssistantTestHook(page);

		await page.goto(`${STUDIO_URL}?agent=${encodeURIComponent(SEEDED_AGENT_ID)}`, { waitUntil: "networkidle" });

		const avatarTrigger = page.locator(`[data-screen-assistant-target="${AVATAR_TRIGGER_TARGET_ID}"]`);
		await expect(avatarTrigger).toBeVisible();
		await expect(page.locator(`img[src*="${INITIAL_AVATAR_SRC}"]`).first()).toBeVisible();
		await page.waitForFunction(() => Boolean(window.__vpkStudioScreenAssistantTest));

		const firstSnapshot = await callScreenAssistantTool(page, "get_screen_state");
		expect(firstSnapshot).toHaveProperty("visibleTargets");

		const avatarPoint = await callScreenAssistantTool(page, "point_at_target", {
			targetId: AVATAR_TRIGGER_TARGET_ID,
		});
		expect(avatarPoint.ok).toBe(true);
		expect(avatarPoint.pointed?.id).toBe(AVATAR_TRIGGER_TARGET_ID);

		const avatarOpen = await callScreenAssistantTool(page, "activate_screen_target", {
			targetId: AVATAR_TRIGGER_TARGET_ID,
		});
		expect(avatarOpen.ok).toBe(true);
		expect(avatarOpen.activated?.id).toBe(AVATAR_TRIGGER_TARGET_ID);
		await expect(page.getByRole("menuitemradio", { name: "Use Basic Coding Agent Template avatar" })).toBeVisible();

		await page.locator(`[data-screen-assistant-target="${BLUE_AVATAR_TARGET_ID}"]`).waitFor({ state: "attached" });
		await callScreenAssistantTool(page, "get_screen_state");
		const bluePoint = await callScreenAssistantTool(page, "point_at_target", {
			targetId: BLUE_AVATAR_TARGET_ID,
		});
		expect(bluePoint.ok).toBe(true);

		const bluePick = await callScreenAssistantTool(page, "activate_screen_target", {
			targetId: BLUE_AVATAR_TARGET_ID,
		});
		expect(bluePick.ok).toBe(true);
		expect(bluePick.activated?.id).toBe(BLUE_AVATAR_TARGET_ID);

		await expect(page.getByRole("menuitemradio", { name: "Use Basic Coding Agent Template avatar" })).toBeHidden();
		await expect(page.locator(`img[src*="${BLUE_AVATAR_SRC}"]`).first()).toBeVisible();
		await expect.poll(
			async () =>
				page.evaluate(
					({ agentId, key }) => {
						const raw = window.localStorage.getItem(key);
						const records = raw ? JSON.parse(raw) : [];
						const record = records.find((item: { profileId?: string }) => item.profileId === agentId);
						return record?.draftResult?.avatarSrc ?? null;
					},
					{ agentId: SEEDED_AGENT_ID, key: STORAGE_KEY },
				),
		).toBe(BLUE_AVATAR_SRC);
	});
});
