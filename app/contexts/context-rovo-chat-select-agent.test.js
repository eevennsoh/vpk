const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const CONTEXT_SOURCE = fs.readFileSync(
	path.join(__dirname, "context-rovo-chat.tsx"),
	"utf8",
);
const AGENT_RECORD_TYPES_SOURCE = fs.readFileSync(
	path.join(
		process.cwd(),
		"components/projects/rovo-core/lib/agent-records/types.ts",
	),
	"utf8",
);
const SESSION_AGENT_REGISTRY_SOURCE = fs.readFileSync(
	path.join(
		process.cwd(),
		"components/projects/rovo-core/lib/agent-records/session-agent-registry.ts",
	),
	"utf8",
);
const RECENT_AGENTS_SOURCE = fs.readFileSync(
	path.join(
		process.cwd(),
		"components/projects/studio/lib/studio-sidebar-recent-agents.ts",
	),
	"utf8",
);

// Extract the body of the `selectAgent = useCallback(...)` declaration so we can
// assert on what selecting an agent does, without false positives from other
// callers of `touchSessionAgent` elsewhere in the file.
function getSelectAgentBody(source) {
	const start = source.indexOf("const selectAgent = useCallback(");
	assert.notEqual(start, -1, "expected a selectAgent useCallback declaration");
	// The callback body ends where the dependency array begins: `}, [deps]);`.
	const end = source.indexOf("}, [", start);
	assert.notEqual(end, -1, "expected selectAgent dependency array terminator");
	return source.slice(start, end);
}

test("recent-agents nav list is ordered by lastTouchedAt (the pin signal)", () => {
	// Guards the assumption behind this regression: "highest" is purely emergent
	// from sorting by lastTouchedAt desc. If this changes, revisit selectAgent.
	assert.match(
		RECENT_AGENTS_SOURCE,
		/second\.lastTouchedAt - first\.lastTouchedAt/u,
	);
});

test("chat surface actions synchronously maintain the ref used by floating pins", () => {
	assert.match(CONTEXT_SOURCE, /const updateChatSurface = useCallback/u);
	assert.match(CONTEXT_SOURCE, /chatSurfaceRef\.current = nextSurface;\s*setChatSurface\(nextSurface\);/u);
	assert.match(CONTEXT_SOURCE, /const closeChat = useCallback\(\(\) => updateChatSurface\(null\)/u);
	assert.match(CONTEXT_SOURCE, /if \(chatSurfaceRef\.current !== null && restored === "sidebar"\)/u);
});

test("history toggles compose from the latest queued state", () => {
	assert.match(CONTEXT_SOURCE, /setIsHistoryOpen\(\(previousOpen\) => !previousOpen\)/u);
	assert.match(CONTEXT_SOURCE, /if \(isHistoryOpen\) \{\s*void refreshThreads\(\);\s*\}/u);
});

test("selecting an agent does not bump lastTouchedAt (no pin-to-top on click)", () => {
	const selectAgentBody = getSelectAgentBody(CONTEXT_SOURCE);

	// The bug: selectAgent called touchSessionAgent, which sets lastTouchedAt to
	// Date.now() and re-sorts the clicked agent to the top of the nav list.
	// Selection must not reorder the list, so selectAgent must not touch it.
	assert.doesNotMatch(
		selectAgentBody,
		/touchSessionAgent/u,
		"selectAgent must not call touchSessionAgent — that pins the selected agent to the top of the recent-agents list",
	);

	// Selection identity is still tracked, just without reordering.
	assert.match(selectAgentBody, /setSelectedAgentIdState\(nextAgent\.id\)/u);
});

test("session-agent registry still owns intentional bumps (create/edit/test/publish)", () => {
	// Sanity check: the previous test passes for the right reason. The helper is
	// still defined and still bumps lastTouchedAt - it just isn't called on select.
	assert.match(SESSION_AGENT_REGISTRY_SOURCE, /export function touchSessionAgentEntry\(/u);
	assert.match(SESSION_AGENT_REGISTRY_SOURCE, /lastTouchedAt = Date\.now\(\)/u);
	assert.match(SESSION_AGENT_REGISTRY_SOURCE, /touchSessionAgentEntry\(entries, existingEntry\.profile\.id, lastTouchedAt\)/u);
	assert.doesNotMatch(CONTEXT_SOURCE, /const touchSessionAgent = useCallback\(/u);
	assert.match(CONTEXT_SOURCE, /registerSessionAgentFromResult/u);
	assert.match(CONTEXT_SOURCE, /updateSessionAgentDraftEntry/u);
	assert.match(CONTEXT_SOURCE, /publishSessionAgentEntry/u);
});

test("session-agent publishing increments metadata and records version history", () => {
	assert.match(AGENT_RECORD_TYPES_SOURCE, /export interface StudioAgentVersionRecord/u);
	assert.match(AGENT_RECORD_TYPES_SOURCE, /version: number;/u);
	assert.match(AGENT_RECORD_TYPES_SOURCE, /publishedVersion: number;/u);
	assert.match(AGENT_RECORD_TYPES_SOURCE, /lastPublishedAt: number \| null;/u);
	assert.match(AGENT_RECORD_TYPES_SOURCE, /versionHistory: readonly StudioAgentVersionRecord\[\];/u);
	assert.match(SESSION_AGENT_REGISTRY_SOURCE, /const versionKind: StudioAgentVersionRecord\["kind"\] = existing\.publishedResult \? "update" : "publish";/u);
	assert.match(SESSION_AGENT_REGISTRY_SOURCE, /const nextPublishedVersion = existing\.publishedResult[\s\S]*\? Math\.max\(existing\.publishedVersion, 1\) \+ 1[\s\S]*: 1;/u);
	assert.match(SESSION_AGENT_REGISTRY_SOURCE, /version: nextPublishedVersion/u);
	assert.match(SESSION_AGENT_REGISTRY_SOURCE, /publishedVersion: nextPublishedVersion/u);
	assert.match(SESSION_AGENT_REGISTRY_SOURCE, /versionHistory: \[versionRecord, \.\.\.existing\.versionHistory\]/u);
	assert.match(CONTEXT_SOURCE, /publishSessionAgentEntry\(\{[\s\S]*entries: sessionAgentEntriesRef\.current,[\s\S]*profileId,[\s\S]*\}\)/u);
});

test("session-agent rollback restores a historical snapshot into the draft only", () => {
	assert.match(CONTEXT_SOURCE, /restoreSessionAgentVersion: \(profileId: string, versionId: string\) => StudioSessionAgentEntry \| null;/u);
	assert.match(CONTEXT_SOURCE, /const restoreSessionAgentVersion = useCallback/u);
	assert.match(CONTEXT_SOURCE, /restoreSessionAgentVersionEntry\(\{[\s\S]*entries: sessionAgentEntriesRef\.current,[\s\S]*profileId,[\s\S]*versionId,[\s\S]*\}\)/u);
	assert.match(SESSION_AGENT_REGISTRY_SOURCE, /export function restoreSessionAgentVersionEntry/u);
	assert.match(SESSION_AGENT_REGISTRY_SOURCE, /const restoredDraft = normalizeSessionAgentResult\(version\.snapshot\);/u);
	assert.match(SESSION_AGENT_REGISTRY_SOURCE, /draftResult: restoredDraft/u);
	assert.match(SESSION_AGENT_REGISTRY_SOURCE, /versionHistory: \[rollbackRecord, \.\.\.existing\.versionHistory\]/u);
	assert.doesNotMatch(
		SESSION_AGENT_REGISTRY_SOURCE.slice(
			SESSION_AGENT_REGISTRY_SOURCE.indexOf("export function restoreSessionAgentVersionEntry"),
			SESSION_AGENT_REGISTRY_SOURCE.indexOf("export function removeSessionAgentEntry"),
		),
		/publishedResult: restoredDraft/u,
	);
});

test("session-agent autosave is debounced instead of writing on every draft change", () => {
	assert.match(SESSION_AGENT_REGISTRY_SOURCE, /export const STUDIO_SESSION_AGENT_SAVE_DEBOUNCE_MS = 900;/u);
	assert.match(CONTEXT_SOURCE, /STUDIO_SESSION_AGENT_SAVE_DEBOUNCE_MS,[\s\S]*\} from "@\/components\/projects\/rovo-core\/lib\/agent-records\/session-agent-registry";/u);
});
