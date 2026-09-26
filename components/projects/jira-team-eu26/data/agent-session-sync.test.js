const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { readFileSync } = require("node:fs");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

const PAGE_SOURCE = readFileSync(
	path.join(__dirname, "../page.tsx"),
	"utf8",
);
const HOOK_SOURCE = readFileSync(
	path.join(__dirname, "../hooks/use-jira-team-eu26-agent-session-sync.ts"),
	"utf8",
);

let syncModulePromise;

function loadSyncModule() {
	if (!syncModulePromise) {
		syncModulePromise = esbuild
			.build({
				entryPoints: [path.join(__dirname, "agent-session-sync.ts")],
				bundle: true,
				format: "cjs",
				platform: "node",
				tsconfig: path.join(process.cwd(), "tsconfig.json"),
				write: false,
			})
			.then((result) => loadCjsModuleFromText(
				result.outputFiles[0].text,
				"jira-team-eu26-agent-session-sync-harness.cjs",
			));
	}

	return syncModulePromise;
}

test("the Jira v5 demo syncs one, two, or three new sessions per batch", async () => {
	const sync = await loadSyncModule();

	assert.equal(sync.takeJiraTeamEu26SyncBatch(0, () => 0).sessions.length, 1);
	assert.equal(sync.takeJiraTeamEu26SyncBatch(0, () => 0.5).sessions.length, 2);
	assert.equal(sync.takeJiraTeamEu26SyncBatch(0, () => 0.999).sessions.length, 3);

	const finalBatch = sync.takeJiraTeamEu26SyncBatch(
		sync.JIRA_TEAM_EU26_SYNC_SESSIONS.length - 1,
		() => 0.999,
	);
	assert.equal(finalBatch.sessions.length, 1);
	assert.equal(finalBatch.nextIndex, sync.JIRA_TEAM_EU26_SYNC_SESSIONS.length);
});

test("the Jira v5 demo pauses exactly three times so the local icon can return", async () => {
	const sync = await loadSyncModule();
	const pauseAfter = [8, 16, 24];
	let nextIndex = 0;
	const observedPauses = [];

	while (nextIndex < sync.JIRA_TEAM_EU26_SYNC_SESSIONS.length) {
		const delay = sync.getJiraTeamEu26SyncDelayMs(nextIndex, () => 0.999_999);
		if (delay > 3_000) {
			observedPauses.push(nextIndex);
			assert.ok(delay >= 7_000, "the four-second counter window must finish before syncing resumes");
		}
		const batch = sync.takeJiraTeamEu26SyncBatch(nextIndex, () => 0.999);
		assert.ok(batch.sessions.length > 0);
		nextIndex = batch.nextIndex;
	}

	assert.deepEqual(observedPauses, pauseAfter);
	assert.equal(nextIndex, 32);
	assert.equal(sync.takeJiraTeamEu26SyncBatch(7, () => 0.999).nextIndex, 8);
	assert.equal(sync.takeJiraTeamEu26SyncBatch(15, () => 0.999).nextIndex, 16);
	assert.equal(sync.takeJiraTeamEu26SyncBatch(23, () => 0.999).nextIndex, 24);
});

test("the Jira v5 demo chooses a fresh delay inside the one-to-three-second window between pauses", async () => {
	const sync = await loadSyncModule();

	assert.equal(sync.getJiraTeamEu26SyncDelayMs(0, () => 0), 1_000);
	assert.equal(sync.getJiraTeamEu26SyncDelayMs(1, () => 0.5), 2_000);
	assert.equal(sync.getJiraTeamEu26SyncDelayMs(9, () => 0.999_999), 3_000);
});

test("state changes use a quieter three-to-five-second delay", async () => {
	const sync = await loadSyncModule();

	assert.equal(sync.getJiraTeamEu26StateChangeDelayMs(() => 0), 3_000);
	assert.equal(sync.getJiraTeamEu26StateChangeDelayMs(() => 0.5), 4_000);
	assert.equal(sync.getJiraTeamEu26StateChangeDelayMs(() => 0.999_999), 5_000);
});

test("a synced session keeps its identity and returns to the top on both state changes", async () => {
	const sync = await loadSyncModule();
	const working = sync.JIRA_TEAM_EU26_SYNC_SESSIONS[0];
	const other = sync.JIRA_TEAM_EU26_SYNC_SESSIONS[1];
	const initialSessions = [other, working];
	const initialVersions = sync.addJiraTeamEu26SyncSessionInitialVersions(
		new Map(),
		initialSessions,
	);
	assert.equal(initialVersions.get(working.id), 0);
	assert.equal(initialVersions.get(other.id), 0);

	const needsInput = sync.advanceJiraTeamEu26SyncSession(
		initialSessions,
		initialVersions,
		working.id,
	);
	assert.equal(needsInput.nextState, "needs-input");
	assert.deepEqual(needsInput.sessions.map((session) => session.id), [working.id, other.id]);
	assert.equal(needsInput.sessions[0].state, "needs-input");
	assert.match(needsInput.sessions[0].title, /needs input$/u);
	assert.match(needsInput.sessions[0].detail, /waiting for a teammate to unblock this session$/u);
	assert.equal(needsInput.stateChangeVersions.get(working.id), 1);
	assert.equal(initialVersions.get(working.id), 0, "the previous revision map remains unchanged");

	const finished = sync.advanceJiraTeamEu26SyncSession(
		[other, ...needsInput.sessions.filter((session) => session.id !== other.id)],
		needsInput.stateChangeVersions,
		working.id,
	);
	assert.equal(finished.nextState, "complete");
	assert.deepEqual(finished.sessions.map((session) => session.id), [working.id, other.id]);
	assert.equal(finished.sessions[0].state, "complete");
	assert.match(finished.sessions[0].title, /finished$/u);
	assert.match(finished.sessions[0].detail, /a teammate unblocked the session; findings are ready to review$/u);
	assert.equal(finished.stateChangeVersions.get(working.id), 2);
	assert.equal(finished.sessions.length, initialSessions.length, "no new identity is created");

	const terminal = sync.advanceJiraTeamEu26SyncSession(
		finished.sessions,
		finished.stateChangeVersions,
		working.id,
	);
	assert.equal(terminal.nextState, undefined);
	assert.equal(terminal.sessions, finished.sessions);
	assert.equal(terminal.stateChangeVersions, finished.stateChangeVersions);
});

test("every queued Jira v5 session has a unique stable identity", async () => {
	const sync = await loadSyncModule();
	const sessions = sync.JIRA_TEAM_EU26_SYNC_SESSIONS;
	const codingAgentIds = new Set(["claude", "codex", "cursor"]);

	assert.equal(sessions.length, 32);
	assert.equal(new Set(sessions.map((session) => session.id)).size, sessions.length);
	assert.ok(sessions.every((session) => session.kind === "agent-session"));
	assert.ok(sessions.every((session) => codingAgentIds.has(session.agentId)));
	assert.ok(sessions.every((session) => !/Rovo/u.test(session.title)));
	assert.ok(sessions.every((session) => session.timeLabel === "Just now"));
	assert.ok(sessions.every((session) => session.issueStatus.length > 0));
	assert.ok(sessions.every((session) => session.shortTitle.length > 0));
	assert.ok(sessions.every((session) => session.sourceTitle.length > 0));
	assert.ok(sessions.every((session) => session.title.length > 0));
	assert.ok(sessions.every((session) => session.detail.length > 0));
	assert.ok(sessions.every((session) => session.machineName.length > 0));
	assert.ok(sessions.every((session) => session.memberIds.length > 0));
	assert.ok(sessions.every((session) => session.state !== undefined));
	assert.deepEqual(
		new Set(sessions.map((session) => session.state)),
		new Set(["running", "complete"]),
	);
	assert.equal(sessions.at(-1)?.state, "running");
	assert.equal(sessions.at(-2)?.state, "running");
	assert.equal(
		sessions.find((session) => session.sourceTitle === "PAY-132")?.issueStatus,
		"In review",
	);
});

test("all 48 visible Team EU26 placeholders belong to the requested four cohorts", async () => {
	const sync = await loadSyncModule();
	const seeds = [...sync.JIRA_TEAM_EU26_SEEDED_AGENT_SESSION_OVERRIDES.values()];
	const arrivals = sync.JIRA_TEAM_EU26_SYNC_SESSIONS;
	const cohorts = sync.JIRA_TEAM_EU26_SYNC_SESSION_COHORT_BY_ID;

	assert.equal(seeds.length, 16);
	assert.equal(arrivals.length, 32);
	assert.equal(cohorts.size, arrivals.length);
	assert.equal(new Set([...seeds, ...arrivals].map((session) => session.id)).size, 48);
	assert.ok(seeds.every((session) => session.kind === "agent-session"));
	for (const session of [...seeds, ...arrivals]) {
		assert.ok(["claude", "cursor", "codex"].includes(session.agentId), session.id);
		assert.doesNotMatch(session.title, /copilot/iu, session.id);
	}
	assert.ok(seeds.every((session) => session.id === sync.JIRA_TEAM_EU26_SEEDED_AGENT_SESSION_OVERRIDES.get(session.id)?.id));
	assert.ok(arrivals.every((session) => cohorts.has(session.id)));

	const cohortCounts = {
		"always-working": seeds.filter((session) => session.state === "running").length,
		"needs-input-terminal": 0,
		"finished-initially": seeds.filter((session) => session.state === "complete").length,
		"full-path": 0,
	};
	for (const session of arrivals) {
		const cohort = cohorts.get(session.id);
		cohortCounts[cohort] += 1;
		assert.equal(session.state, cohort === "finished-initially" ? "complete" : "running");
	}
	assert.deepEqual(cohortCounts, {
		"always-working": 19,
		"needs-input-terminal": 12,
		"finished-initially": 12,
		"full-path": 5,
	});
	assert.equal(cohorts.get("lw-sync-retry-headers"), "always-working");
	assert.equal(arrivals.find((session) => session.id === "lw-sync-retry-headers")?.state, "running");
	assert.ok(seeds.filter((session) => session.state === "complete").every((session) => /finished/u.test(session.title)));
	assert.ok(arrivals.filter((session) => session.state === "complete").every((session) => /finished/u.test(session.title)));
});

test("permanent Working and initially Finished sessions never revise, while terminal Needs input stops after one change", async () => {
	const sync = await loadSyncModule();
	const cohorts = sync.JIRA_TEAM_EU26_SYNC_SESSION_COHORT_BY_ID;
	const choose = (cohort) => sync.JIRA_TEAM_EU26_SYNC_SESSIONS.find((session) => cohorts.get(session.id) === cohort);
	const alwaysWorking = choose("always-working");
	const initiallyFinished = choose("finished-initially");
	const terminalNeedsInput = choose("needs-input-terminal");
	const initialSessions = [alwaysWorking, initiallyFinished, terminalNeedsInput];
	const versions = sync.addJiraTeamEu26SyncSessionInitialVersions(new Map(), initialSessions);

	for (const unchanged of [alwaysWorking, initiallyFinished]) {
		const next = sync.advanceJiraTeamEu26SyncSession(initialSessions, versions, unchanged.id);
		assert.equal(next.nextState, undefined);
		assert.equal(next.sessions, initialSessions);
		assert.equal(next.stateChangeVersions.get(unchanged.id), 0);
	}

	const needsInput = sync.advanceJiraTeamEu26SyncSession(initialSessions, versions, terminalNeedsInput.id);
	assert.equal(needsInput.nextState, "needs-input");
	assert.equal(needsInput.sessions[0].id, terminalNeedsInput.id);
	assert.equal(needsInput.sessions[0].state, "needs-input");
	assert.equal(needsInput.stateChangeVersions.get(terminalNeedsInput.id), 1);
	const terminal = sync.advanceJiraTeamEu26SyncSession(
		needsInput.sessions,
		needsInput.stateChangeVersions,
		terminalNeedsInput.id,
	);
	assert.equal(terminal.nextState, undefined);
	assert.equal(terminal.sessions, needsInput.sessions);
	assert.equal(terminal.stateChangeVersions.get(terminalNeedsInput.id), 1);
});

test("half of the queued Jira v5 sessions arrive with linked PR metadata", async () => {
	const sync = await loadSyncModule();
	const sessions = sync.JIRA_TEAM_EU26_SYNC_SESSIONS;
	const pullRequestSessions = sessions.filter((session) => session.pullRequest !== undefined);

	assert.equal(pullRequestSessions.length, sessions.length / 2);
	assert.deepEqual(
		new Set(pullRequestSessions.map((session) => session.pullRequest.status)),
		new Set(["created", "merged", "failed"]),
	);
});

/**
 * The session row only prints `#number: title`, but hovering the row opens a
 * flyout whose Artifacts chip expands into a pull-request Smart Link card — repo
 * tag, branch path, diff stats, and summary. A PR authored with only the row's
 * three fields renders that card nearly empty, so every queued PR has to carry
 * the whole payload.
 */
test("every queued Jira v5 pull request carries the full Smart Link payload", async () => {
	const sync = await loadSyncModule();
	const pullRequests = sync.JIRA_TEAM_EU26_SYNC_SESSIONS
		.map((session) => session.pullRequest)
		.filter((pullRequest) => pullRequest !== undefined);

	assert.ok(pullRequests.length > 0, "no PR-bearing sessions left to check");
	assert.equal(
		new Set(pullRequests.map((pullRequest) => pullRequest.title)).size,
		pullRequests.length,
		"every queued PR should have distinct placeholder title copy",
	);
	assert.ok(pullRequests.every((pullRequest) => pullRequest.title !== "High confidence to link"));

	for (const pullRequest of pullRequests) {
		const where = `PR #${pullRequest.number}`;
		assert.ok(pullRequest.files > 0, `${where} has no file count`);
		assert.ok(pullRequest.additions > 0, `${where} has no additions`);
		assert.ok(pullRequest.deletions > 0, `${where} has no deletions`);
		assert.match(pullRequest.branch, /^pay-\d+-[a-z0-9-]+$/u, `${where} branch`);
		assert.ok(pullRequest.description.length > 40, `${where} summary is too thin`);
	}
});

test("reviewing synced sessions clears all or only the named arrival marks", async () => {
	const sync = await loadSyncModule();
	const current = new Set(["first", "second", "third"]);

	assert.deepEqual(
		[...sync.removeReviewedJiraTeamEu26AgentSessionIds(current, ["second"])],
		["first", "third"],
	);
	assert.deepEqual(
		[...sync.removeReviewedJiraTeamEu26AgentSessionIds(current)],
		[],
	);
});

test("the route periodically syncs one to three new agent sessions into Untracked work", () => {
	assert.match(
		PAGE_SOURCE,
		/import \{ useJiraTeamEu26AgentSessionSync \} from "\.\/hooks\/use-jira-team-eu26-agent-session-sync";/u,
	);
	assert.match(
		PAGE_SOURCE,
		/const \{\s*reviewAgentSessions,\s*newAgentSessionIds,\s*stateChangeVersions,\s*syncedAgentSessions,\s*\} = useJiraTeamEu26AgentSessionSync\(\{\s*active: showBoardContent,\s*paused: agentSessionColumnInteracting,\s*\}\);/u,
	);
	assert.match(
		PAGE_SOURCE,
		/<ExperimentalJiraKanbanPage[\s\S]*additionalAgentSessions=\{syncedAgentSessions\}[\s\S]*newAgentSessionIds=\{newAgentSessionIds\}[\s\S]*stateChangeVersions=\{stateChangeVersions\}[\s\S]*onAgentSessionColumnInteractionChange=\{setAgentSessionColumnInteracting\}[\s\S]*onAgentSessionsReviewed=\{reviewAgentSessions\}/u,
	);
	assert.match(HOOK_SOURCE, /!active \|\| paused[\s\S]*return undefined;/u);
	assert.match(HOOK_SOURCE, /removeReviewedJiraTeamEu26AgentSessionIds/u);
	assert.match(HOOK_SOURCE, /advanceJiraTeamEu26SyncSession/u);
	assert.match(HOOK_SOURCE, /addJiraTeamEu26SyncSessionInitialVersions/u);
	assert.match(HOOK_SOURCE, /JIRA_TEAM_EU26_SYNC_SESSION_COHORT_BY_ID/u);
	assert.match(HOOK_SOURCE, /document\.visibilityState !== "visible"/u);
	assert.match(PAGE_SOURCE, /agentSessionSeedOverrides=\{JIRA_TEAM_EU26_SEEDED_AGENT_SESSION_OVERRIDES\}/u);
});
