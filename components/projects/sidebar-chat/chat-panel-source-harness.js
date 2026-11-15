// Source-contract tests that used to read the single 2,000-line ChatPanel
// `page.tsx` read the whole ChatPanel module group through this harness, so
// their assertions follow the code into the hooks, helpers and subcomponents it
// was split into. Add a file here when ChatPanel gains a new owned module.
//
// The joined source is for presence and absence checks only: its file order is
// arbitrary, so an ordering regex over it tests the array, not the code. Read the
// one owning module with readChatPanelModule() for ordering checks.
const fs = require("node:fs");
const path = require("node:path");

const CHAT_PANEL_SOURCE_FILES = [
	"page.tsx",
	"lib/chat-panel-types.ts",
	"lib/chat-panel-layout.ts",
	"lib/chat-panel-local-conversation.ts",
	"lib/chat-panel-messages.ts",
	"data/chat-panel-defaults.ts",
	"hooks/use-agent-version-selection.ts",
	"hooks/use-context-bar-open-state.ts",
	"hooks/use-chat-panel-width.ts",
	"hooks/use-local-conversation-voice.ts",
	"hooks/use-chat-panel-prompt-actions.ts",
	"hooks/use-chat-panel-clicky.ts",
	"hooks/use-composer-prompt-bridge.ts",
	"hooks/use-chat-panel-screen-assistant.ts",
	"hooks/use-chat-panel-realtime.ts",
	"hooks/use-chat-panel-decisions.ts",
	"hooks/use-chat-panel-artifacts.ts",
	"components/chat-panel-conversation.tsx",
	"components/chat-panel-composer-area.tsx",
	"components/custom-agent-tabs.tsx",
	"components/agent-version-menu.tsx",
].map((relativePath) => path.join(__dirname, relativePath));

function readChatPanelSource() {
	return CHAT_PANEL_SOURCE_FILES.map((filePath) => fs.readFileSync(filePath, "utf8")).join("\n");
}

function readChatPanelModule(relativePath) {
	const filePath = path.join(__dirname, relativePath);
	if (!CHAT_PANEL_SOURCE_FILES.includes(filePath)) {
		throw new Error(`${relativePath} is not a ChatPanel module; add it to CHAT_PANEL_SOURCE_FILES first.`);
	}
	return fs.readFileSync(filePath, "utf8");
}

module.exports = { CHAT_PANEL_SOURCE_FILES, readChatPanelModule, readChatPanelSource };
