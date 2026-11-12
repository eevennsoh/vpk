const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const HOOK_SOURCE = fs.readFileSync(path.join(__dirname, "use-agent-url-sync.ts"), "utf8");
const SHELL_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "components", "projects", "studio", "components", "rovo-app-shell.tsx"),
	"utf8",
);

// Regression: restoring an agent from `?agent=` on load/back-forward must let the
// surface restore its per-agent view (the studio config pane). Without this the
// deep-linked / reloaded agent only re-selects for chat and the studio falls
// through to a full-screen chat surface with no config pane / AgentHeader.
test("useAgentUrlSync accepts and forwards an onAgentRestored callback", () => {
	assert.match(HOOK_SOURCE, /onAgentRestored\?:\s*\(agentId:\s*string\s*\|\s*null\)\s*=>\s*void/u);
	assert.match(HOOK_SOURCE, /const onAgentRestoredRef = useLatestRef\(onAgentRestored\);/u);
});

// Regression: the URL must track the agent being EDITED (the config pane), not
// the chat-selected agent. Reading `selectedAgentId`/`isCustomAgentSelected` here
// is what made the studio flip the Ask Rovo panel onto the custom agent on
// re-select/reload (a visible "swap"). The hook takes the edited id + the set of
// resolvable ids explicitly and never selects an agent for chat.
test("useAgentUrlSync is driven by the edited agent, not chat selection", () => {
	assert.match(HOOK_SOURCE, /editingAgentId\?:\s*string\s*\|\s*null/u);
	assert.match(HOOK_SOURCE, /selectableAgentIds:\s*readonly string\[\]/u);
	// It must not read or mutate chat-selection state from the registry.
	assert.doesNotMatch(HOOK_SOURCE, /useRovoSelectedAgent/u);
	assert.doesNotMatch(HOOK_SOURCE, /selectAgent/u);
	assert.doesNotMatch(HOOK_SOURCE, /isCustomAgentSelected/u);
	// The URL write reflects the edited agent id directly.
	assert.match(HOOK_SOURCE, /const desiredAgentId = editingAgentId;/u);
});

test("useAgentUrlSync notifies onAgentRestored from the mount seed", () => {
	// The seed-apply effect must call back once the named agent resolves.
	assert.match(
		HOOK_SOURCE,
		/if \(selectableAgentIds\.includes\(seedAgentId\)\) \{[\s\S]*onAgentRestoredRef\.current\?\.\(seedAgentId\);/u,
	);
});

test("useAgentUrlSync notifies onAgentRestored from popstate (agent and default)", () => {
	assert.match(HOOK_SOURCE, /onAgentRestoredRef\.current\?\.\(nextAgentId\);/u);
	assert.match(HOOK_SOURCE, /onAgentRestoredRef\.current\?\.\(null\);/u);
});

test("studio shell opens the config pane for the URL-restored agent", () => {
	// Handler maps a restored agent id to activeAgentConfig (and clears it for null).
	assert.match(
		SHELL_SOURCE,
		/const handleAgentRestoredFromUrl = useCallback\(\(agentId: string \| null\) => \{[\s\S]*setActiveAgentConfigState\(agentId \? \{ profileId: agentId, sourceMessageId: null \} : null\);/u,
	);
	// Handler is wired into the URL sync hook, driven by the edited agent.
	assert.match(
		SHELL_SOURCE,
		/useAgentUrlSync\(\{[\s\S]*enabled: !embedded,[\s\S]*editingAgentId: activeAgentConfig\?\.profileId \?\? null,[\s\S]*selectableAgentIds,[\s\S]*onAgentRestored: handleAgentRestoredFromUrl,[\s\S]*\}\)/u,
	);
});
