const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

// The real Studio config panel inside the providers it needs. CSS modules only supply class
// names, so they are stubbed.
const CSS_MODULE = "export default new Proxy({}, { get: (_, key) => String(key) });";
const PANEL = `import { ThemeWrapper } from "@/components/utils/theme-wrapper";
	import { RovoChatProvider } from "@/app/contexts/context-rovo-chat";
	import { RovoAppAgentConfigPanel } from "@/components/projects/studio/components/rovo-app-agent-config-panel";
	import { createSessionAgentEntryFromResult } from "@/components/projects/rovo-core/lib/agent-records/session-agent-entry";
	const ENTRY = createSessionAgentEntryFromResult({
		agentResult: { action: "create", apps: ["Jira"], name: "Release Agent", summary: "Drafts release updates", tools: ["Jira"] },
		lastTouchedAt: 1,
		sessionAgentEntries: [],
		staticAgentProfiles: [],
	});
	export default function PanelProbe() {
		return <ThemeWrapper><RovoChatProvider>
			<RovoAppAgentConfigPanel activeView="configure" entry={ENTRY} onCommitPublishReady={() => {}} onPublish={() => {}} onTest={() => {}} onUpdateDraft={() => {}} onViewChange={() => {}} testPanel={null} />
		</RovoChatProvider></ThemeWrapper>;
	}`;

async function renderPanel() {
	const view = await renderComponent({
		mocks: {
			"@/components/projects/shared/components/chat-messages.module.css": CSS_MODULE,
			"@/components/projects/sidebar-chat/chat.module.css": CSS_MODULE,
		},
		source: PANEL,
	});
	const dialogText = () => [...document.querySelectorAll("[role=dialog]")].map((dialog) => dialog.textContent).join(" ");
	return {
		dialogCount: () => document.querySelectorAll("[role=dialog]").length,
		// The Apps directory on one app shows that app's Enabled/Remove controls; browsing shows the result count.
		appsDirectoryView: () => {
			const text = dialogText();
			if (!text.includes("Browse apps")) return "closed";
			return /Showing \d+ results/u.test(text) ? "browse" : text.includes("Remove") ? "detail" : "other";
		},
		openBrowseApps: async () => {
			await view.click(view.getByRole("button", { name: "Edit" }));
			await view.click(view.getByRole("menuitem", { name: "Browse apps" }));
		},
		view,
	};
}

test("an app chip opens the Apps directory on that app; closing forgets it, so browsing opens the list", async () => {
	const panel = await renderPanel();
	assert.equal(panel.appsDirectoryView(), "closed");
	await panel.view.click(panel.view.getAllByRole("button", { name: "Jira" })[0]);
	assert.equal(panel.appsDirectoryView(), "detail");
	await panel.view.press(null, "Escape");
	assert.equal(panel.appsDirectoryView(), "closed");
	assert.equal(panel.dialogCount(), 0);
	await panel.openBrowseApps();
	assert.equal(panel.appsDirectoryView(), "browse", "a plain browse must not reopen on the last app");
	await panel.view.press(null, "Escape");
	await panel.view.click(panel.view.getAllByRole("button", { name: "Jira" })[0]);
	assert.equal(panel.appsDirectoryView(), "detail", "the chip still focuses its app after a browse");
	await panel.view.press(null, "Escape");
	assert.equal(panel.dialogCount(), 0);
});

