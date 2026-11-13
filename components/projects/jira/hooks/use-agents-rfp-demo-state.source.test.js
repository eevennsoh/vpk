const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const HOOK_SOURCE = fs.readFileSync(path.join(__dirname, "use-agents-rfp-demo-state.ts"), "utf8");

test("useAgentsRfpDemoState loads and persists through backend routes instead of localStorage", () => {
	assert.match(HOOK_SOURCE, /RFP_DEMO_STATE_ENDPOINT = "\/api\/agents\/rfp-demo\/state"/u);
	assert.match(HOOK_SOURCE, /RFP_DEMO_APPLY_AGENT_ENDPOINT = "\/api\/agents\/rfp-demo\/agent\/apply"/u);
	assert.match(HOOK_SOURCE, /RFP_DEMO_TICKET_EVENT_ENDPOINT = "\/api\/agents\/rfp-demo\/events\/ticket-entered-column"/u);
	assert.match(HOOK_SOURCE, /fetch\(RFP_DEMO_STATE_ENDPOINT\)/u);
	assert.match(HOOK_SOURCE, /hasPendingAgentWork/u);
	assert.match(HOOK_SOURCE, /window\.setInterval/u);
	assert.match(HOOK_SOURCE, /normalizeAgentsRfpDemoProfileMetadata/u);
	assert.match(HOOK_SOURCE, /postStateMutation\(RFP_DEMO_STATE_ENDPOINT, \{ state: nextState \}\)/u);
	assert.match(HOOK_SOURCE, /const updateState = useCallback/u);
	assert.match(HOOK_SOURCE, /stateRef\.current = nextState;\s*setState\(nextState\);/u);
	assert.match(HOOK_SOURCE, /updateState\(\(currentState\) => moveRfpDemoCard/u);
	assert.doesNotMatch(HOOK_SOURCE, /setState\(\(currentState\) => moveRfpDemoCard/u);
	assert.match(HOOK_SOURCE, /reset: \(\) => Promise<void>;/u);
	assert.match(HOOK_SOURCE, /const reset = useCallback\(\(\) => postStateMutation\(RFP_DEMO_RESET_ENDPOINT\), \[postStateMutation\]\);/u);
	assert.match(HOOK_SOURCE, /postStateMutation\(RFP_DEMO_APPLY_AGENT_ENDPOINT\)/u);
	assert.match(HOOK_SOURCE, /postStateMutation\(RFP_DEMO_TICKET_EVENT_ENDPOINT,\s*\{[\s\S]*ticketCode: cardCode,[\s\S]*targetColumn: targetColumnTitle/u);
	assert.match(HOOK_SOURCE, /void \(async \(\) => \{[\s\S]*for \(const cardCode of cardCodes\) \{[\s\S]*await postStateMutation\(RFP_DEMO_TICKET_EVENT_ENDPOINT/u);
	assert.doesNotMatch(HOOK_SOURCE, /localStorage/u);
	assert.doesNotMatch(HOOK_SOURCE, /AGENTS_RFP_DEMO_STORAGE_KEY/u);
});
