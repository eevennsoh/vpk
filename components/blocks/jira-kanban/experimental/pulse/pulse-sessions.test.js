/**
 * Pulse — local coding sessions as an agent list.
 *
 * Uncaptured GitHub work stays a dashed card. A coding session uses the same
 * card chrome through AgentList `variant="uncaptured"`, mapped from the fixture
 * onto the shared row model. Only the rail composition is a source contract.
 */

const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

	const {
		assert,
		findSnapshotIndex,
		loadSessionsHarness,
		snapshotAt,
		SOURCES,
		EXPERIMENTAL_PAGE_SOURCE,
	} = require("./pulse-test-harness");

const CARD_SOURCE = readFileSync(
	join(__dirname, "../../../agent-list/agent-list-card.tsx"),
	"utf8",
);

async function sessionRows(snapshotId) {
	const { PULSE_TIMELINE, toPulseSessionItems } = await loadSessionsHarness();
	const index = findSnapshotIndex(PULSE_TIMELINE, snapshotId);
	const snapshot = snapshotAt(PULSE_TIMELINE, index);
	const contributors = PULSE_TIMELINE.members.filter((member) =>
		snapshot.memberIds.includes(member.id),
	);
	const looseWork = snapshot.looseWorkIds.map((id) =>
		PULSE_TIMELINE.looseWork.find((item) => item.id === id),
	);

	return {
		items: toPulseSessionItems(looseWork, contributors, PULSE_TIMELINE.workItems),
		sessions: looseWork.filter((item) => item.kind === "agent-session"),
		snapshot,
	};
}

test("every local session becomes one agent-list row with fixture identity", async () => {
	const {
		PULSE_TIMELINE,
		toPulseSessionAgent,
		toPulseSessionIssueStatus,
		toPulseSessionItems,
		toPulseSessionWorktree,
	} = await loadSessionsHarness();

	for (const snapshot of PULSE_TIMELINE.snapshots) {
		const { items, sessions } = await sessionRows(snapshot.id);
		assert.equal(items.length, sessions.length, `${snapshot.id} dropped a session`);

		items.forEach((item, index) => {
			const session = sessions[index];
			const where = `${snapshot.id}/${session.id}`;
			const agent = toPulseSessionAgent(session.agentId);

			assert.equal(item.id, session.id, where);
			assert.equal(item.title, session.title, where);
			assert.equal(item.host, "local", where);
			assert.equal(item.state, session.state ?? "complete", where);
			assert.equal(item.agent.id, agent.id, where);
			assert.equal(item.agent.name, agent.name, where);
			assert.equal(item.agent.brandName, agent.brandName, where);
			assert.equal(item.agent.vpkLogo, agent.vpkLogo, where);
			assert.equal(item.metadataPrefix, undefined, where);
			assert.ok(typeof item.timeLabel === "string" && item.timeLabel.length > 0, where);
			assert.equal(item.timeLabel, session.timeLabel, where);
			assert.ok(typeof item.machineName === "string" && item.machineName.length > 0, where);
			assert.equal(item.machineName, session.machineName, where);
			assert.equal(item.sessionDetails.issueKey, session.sourceTitle, where);
			assert.equal(
				item.sessionDetails.issueStatus,
				toPulseSessionIssueStatus(session.sourceTitle, PULSE_TIMELINE.workItems),
				where,
			);
			assert.equal(
				item.sessionDetails.worktreePath,
				toPulseSessionWorktree(session.detail),
				where,
			);
		});
	}

	const githubOnly = toPulseSessionItems(
		PULSE_TIMELINE.looseWork.filter((item) => item.kind !== "agent-session"),
		PULSE_TIMELINE.members,
	);
	assert.equal(githubOnly.length, 0, "GitHub artifacts must not become session rows");

	const allItems = toPulseSessionItems(
		PULSE_TIMELINE.looseWork,
		PULSE_TIMELINE.members,
		PULSE_TIMELINE.workItems,
	);
	assert.equal(allItems.length, 16, "the untracked-work column should have sixteen sessions");
	assert.deepEqual(
		new Set(allItems.map((item) => item.state)),
		new Set(["running", "needs-input", "complete"]),
		"baseline sessions should cover every untracked-work lifecycle",
	);
	const pullRequestItems = allItems.filter(
		(item) => item.sessionDetails.pullRequestNumber !== undefined,
	);
	assert.equal(pullRequestItems.length, 8, "half of baseline sessions should expose linked PRs");
	assert.deepEqual(
		new Set(pullRequestItems.map((item) => item.prStatus)),
		new Set(["created", "merged", "failed"]),
		"baseline session PRs should cover open, merged, and failed lifecycles",
	);
	for (const item of pullRequestItems) {
		assert.ok(item.sessionDetails.pullRequestTitle, `${item.id} needs a PR title`);
		assert.equal(
			item.sessionDetails.pullRequestUrl,
			`https://github.com/acme/storefront/pull/${item.sessionDetails.pullRequestNumber}`,
			`${item.id} should link to its PR`,
		);
	}
	assert.equal(
		allItems.find((item) => item.sessionDetails.issueKey === "PAY-101")?.sessionDetails.issueStatus,
		"Done",
	);
	assert.equal(
		allItems.find((item) => item.sessionDetails.issueKey === "PAY-121")?.sessionDetails.issueStatus,
		"In review",
	);
	assert.deepEqual(
		allItems.find((item) => item.id === "lw-night-suite-session")?.invokedBy,
		{
			avatarSrc: PULSE_TIMELINE.members.find((member) => member.id === "venn")?.avatarSrc,
			name: "Venn",
		},
		"the overnight test session should name its human invoker",
	);
	assert.deepEqual(
		allItems.find((item) => item.id === "lw-night-killswitch-session")?.invokedBy,
		{
			avatarSrc: PULSE_TIMELINE.members.find((member) => member.id === "priya")?.avatarSrc,
			name: "Priya Raman",
		},
		"the kill-switch session should name its human invoker",
	);

	const timeLabels = new Set(allItems.map((item) => item.timeLabel));
	const machineNames = new Set(allItems.map((item) => item.machineName));
	const agentNames = new Set(allItems.map((item) => item.agent.name));
	const calendarStamp = /Aug|Mon |Tue |Wed |Thu |Fri /u;
	const relativeStamp = /^(Just now|\d+m ago|\d+hr ago|Yesterday|\d+d ago|Last week)$/u;
	for (const item of allItems) {
		assert.doesNotMatch(item.timeLabel, calendarStamp, `${item.id} must not use a calendar stamp`);
		assert.match(item.timeLabel, relativeStamp, `${item.id} timeLabel "${item.timeLabel}" is not relative`);
	}
	assert.ok(timeLabels.size > 1, "timestamps must not all be identical");
	assert.ok(machineNames.size > 1, "machine names must not all be identical");
	// A couple of rows sit on the viewer's own machine so Untracked work has
	// something to resume; the rest must still belong to teammates.
	assert.ok(
		allItems.filter((item) => item.machineName === "Venn’s MacBook").length < allItems.length / 2,
		"do not stamp every row as Venn’s MacBook",
	);
	for (const name of ["Claude", "Codex", "Cursor", "GitHub Copilot"]) {
		assert.ok(agentNames.has(name), `timeline is missing ${name}`);
	}
	assert.ok(!agentNames.has("Rovo"), "Jira v4 examples should use coding agents instead of Rovo");

	const metadataIdentitySource = /function AgentListMetadataIdentity[\s\S]*?(?=\nexport function AgentListActivityHeader)/u.exec(
		CARD_SOURCE,
	)?.[0];
	assert.ok(metadataIdentitySource, "expected AgentListMetadataIdentity in the shared row");
	assert.match(metadataIdentitySource, /<DevicesIcon color="currentColor" label="" size="small" \/>/u);
	assert.doesNotMatch(metadataIdentitySource, /InvokerAvatar/u);
	assert.doesNotMatch(metadataIdentitySource, /item\.invokedBy \?/u);
});

test("session rows name a human invoker when the roster can place one", async () => {
	const { items, sessions } = await sessionRows("s1-kickoff");
	const { PULSE_TIMELINE } = await loadSessionsHarness();
	const byId = new Map(PULSE_TIMELINE.members.map((member) => [member.id, member]));

	items.forEach((item, index) => {
		const session = sessions[index];
		const invoker = session.memberIds
			.map((id) => byId.get(id))
			.find((member) => member !== undefined && member.kind === "human");

		if (invoker === undefined) {
			assert.equal(item.invokedBy, undefined, session.id);
			return;
		}

		assert.equal(item.invokedBy.name, invoker.name, session.id);
		assert.equal(item.invokedBy.avatarSrc, invoker.avatarSrc, session.id);
	});
});

test("every catalog session has a human invoker for its visible avatar", async () => {
	const { PULSE_TIMELINE, toPulseSessionItems } = await loadSessionsHarness();
	const items = toPulseSessionItems(
		PULSE_TIMELINE.looseWork,
		PULSE_TIMELINE.members,
		PULSE_TIMELINE.workItems,
	);

	for (const item of items) {
		assert.ok(item.invokedBy?.avatarSrc, `${item.id} needs a human avatar`);
	}
});

test("session activation is omitted when the host cannot resume it", async () => {
	const { PULSE_TIMELINE, toPulseSessionHandlers, toPulseSessionItems } = await loadSessionsHarness();
	const session = PULSE_TIMELINE.looseWork.find((item) => item.kind === "agent-session");
	assert.ok(session !== undefined, "fixture should include a local agent session");
	const item = toPulseSessionItems([session], PULSE_TIMELINE.members)[0];
	const handlers = toPulseSessionHandlers({
		looseWork: [session],
		onCapture() {},
	});

	assert.equal(handlers.onView, undefined);
	assert.equal(handlers.onCopyResume, undefined);
	assert.equal(handlers.onContinueInAgent, undefined);
	assert.equal(handlers.isResumable(item), false);
	assert.equal(typeof handlers.onCreateWorkItem, "function");
	assert.equal(typeof handlers.onLinkWorkItem, "function");
	assert.equal(typeof handlers.onSubtasks, "function");
});

test("session callbacks ignore stale rows and host-denied resume requests", async () => {
	const { PULSE_TIMELINE, toPulseSessionHandlers, toPulseSessionItems } = await loadSessionsHarness();
	const session = PULSE_TIMELINE.looseWork.find((item) => item.kind === "agent-session");
	assert.ok(session !== undefined, "fixture should include a local agent session");
	const [item] = toPulseSessionItems([session], PULSE_TIMELINE.members);
	const calls = [];
	const handlers = toPulseSessionHandlers({
		isLooseWorkResumable: () => false,
		looseWork: [session],
		onCapture(looseWork) {
			calls.push(`capture:${looseWork.id}`);
		},
		onResume(looseWork) {
			calls.push(`resume:${looseWork.id}`);
		},
	});
	const staleItem = { ...item, id: "lw-session-no-longer-on-this-board" };

	// Rows can outlive a timeline update. A stale id must not capture or resume
	// another session just because its display payload still looks legitimate.
	handlers.onCreateWorkItem(staleItem);
	handlers.onLinkWorkItem(staleItem);
	handlers.onSubtasks(staleItem);
	handlers.onCopyResume(staleItem);
	handlers.onView(staleItem);
	handlers.onContinueInAgent?.(staleItem);
	assert.deepEqual(calls, []);

	// The host decision gates both resume entry points. Capture remains available
	// because it is the independent recovery path for an uncaptured session.
	assert.equal(handlers.isResumable(item), false);
	handlers.onCopyResume(item);
	handlers.onView(item);
	handlers.onCreateWorkItem(item);
	assert.deepEqual(calls, [`capture:${session.id}`]);
});

test("create, link, and subtask capture through the same host callback", async () => {
	const { PULSE_TIMELINE, toPulseSessionHandlers, toPulseSessionItems } = await loadSessionsHarness();
	const session = PULSE_TIMELINE.looseWork.find((item) => item.kind === "agent-session");
	assert.ok(session !== undefined, "fixture should include a local agent session");
	const item = toPulseSessionItems([session], PULSE_TIMELINE.members)[0];
	const captured = [];
	const handlers = toPulseSessionHandlers({
		looseWork: [session],
		onCapture(looseWork) {
			captured.push(looseWork.id);
		},
	});

	handlers.onCreateWorkItem(item);
	handlers.onLinkWorkItem(item);
	handlers.onSubtasks(item);
	assert.deepEqual(captured, [session.id, session.id, session.id]);
});

test("continue-in is omitted until the host supplies it, then ignores stale rows", async () => {
	const { PULSE_TIMELINE, toPulseSessionHandlers, toPulseSessionItems } = await loadSessionsHarness();
	const session = PULSE_TIMELINE.looseWork.find((item) => item.kind === "agent-session");
	assert.ok(session !== undefined, "fixture should include a local agent session");
	const [item] = toPulseSessionItems([session], PULSE_TIMELINE.members);
	const withoutContinue = toPulseSessionHandlers({
		looseWork: [session],
		onCapture() {},
		onResume() {},
	});
	assert.equal(withoutContinue.onContinueInAgent, undefined);

	const continued = [];
	const handlers = toPulseSessionHandlers({
		looseWork: [session],
		onCapture() {},
		onContinue(looseWork) {
			continued.push(looseWork.id);
		},
	});
	const staleItem = { ...item, id: "lw-session-no-longer-on-this-board" };

	assert.equal(typeof handlers.onContinueInAgent, "function");
	handlers.onContinueInAgent(staleItem);
	assert.deepEqual(continued, []);
	handlers.onContinueInAgent(item);
	assert.deepEqual(continued, [session.id]);
});

/**
 * A session's PR is a Smart Link, not a bare link: the flyout's Artifacts chip
 * expands into a card with the repo tag, the `branch → main` path, the diff
 * stats, and the summary. The mapper used to forward only number, title and
 * URL, so every one of those cards opened nearly empty. Assert the whole
 * payload survives the fixture → row → flyout hop for every authored PR.
 */
test("every session pull request maps to a complete Smart Link payload", async () => {
	const { PULSE_SPACE_REPOSITORY, PULSE_TIMELINE, toPulseSessionItems } = await loadSessionsHarness();
	const sessions = PULSE_TIMELINE.looseWork.filter(
		(item) => item.kind === "agent-session" && item.pullRequest !== undefined,
	);
	const items = toPulseSessionItems(sessions, PULSE_TIMELINE.members, PULSE_TIMELINE.workItems);

	assert.ok(sessions.length > 0, "no PR-bearing sessions left to check");
	assert.equal(items.length, sessions.length);

	items.forEach((item, index) => {
		const { pullRequest } = sessions[index];
		const details = item.sessionDetails;
		const repository = pullRequest.repository ?? PULSE_SPACE_REPOSITORY;
		const where = `${sessions[index].id}/#${pullRequest.number}`;

		assert.equal(details.pullRequestNumber, pullRequest.number, where);
		assert.equal(details.pullRequestTitle, pullRequest.title, where);
		assert.equal(details.pullRequestDescription, pullRequest.description, where);
		assert.equal(
			details.pullRequestReviewerCount,
			pullRequest.status === "merged" ? 3 : 2,
			where,
		);
		assert.equal(
			details.pullRequestUpdatedLabel,
			pullRequest.status === "merged"
				? "5h ago"
				: pullRequest.status === "failed"
					? "2h ago"
					: "1h ago",
			where,
		);
		assert.equal(details.files, pullRequest.files, where);
		assert.equal(details.additions, pullRequest.additions, where);
		assert.equal(details.deletions, pullRequest.deletions, where);
		assert.equal(details.branch, pullRequest.branch, where);
		assert.equal(details.repository, repository, where);
		// Every PR in the fixture merges into the space's trunk, and the URL is
		// built from the resolved repo so an overridden one cannot link elsewhere.
		assert.equal(details.targetBranch, "main", where);
		assert.equal(
			details.pullRequestUrl,
			`https://github.com/${repository}/pull/${pullRequest.number}`,
			where,
		);
	});
});

test("the uncaptured column renders sessions through the Agent Session block", () => {
	assert.match(SOURCES.rail, /import \{ AgentSession \} from "@\/components\/blocks\/agent-session";/u);
	assert.match(
		SOURCES.rail,
		/const sessionItems = toPulseSessionItems\(\s*looseWork,\s*members,\s*workItems,\s*\);/u,
	);
	assert.match(SOURCES.rail, /githubWork = looseWork\.filter\(isPulseGithubLooseWork\)/u);
	assert.match(
		SOURCES.rail,
		/<JiraIssue[\s\S]*variant="uncaptured-work"[\s\S]*<AgentSession[\s\S]*items=\{sessionItems\}/u,
	);
	assert.match(SOURCES.rail, /capturedItemIds=\{capturedIds\}/u);
	// The row -> loose work callbacks live in the shared adapter, so the rail and
	// the v2 board's untracked-work column apply one set of rules.
	assert.match(SOURCES.rail, /\{\.\.\.sessionHandlers\}/u);
	assert.match(SOURCES.sessions, /onContinueInAgent: continueSession,/u);
	assert.match(SOURCES.sessions, /onCopyResume: onResume === undefined \? undefined : \(item: AgentSessionItem\) => \{/u);
	assert.match(SOURCES.sessions, /onCreateWorkItem: captureSession,/u);
	assert.match(SOURCES.sessions, /onLinkWorkItem: captureSession,/u);
	assert.match(SOURCES.sessions, /onSubtasks: captureSession,/u);
	assert.doesNotMatch(SOURCES.rail, /variant="compact"/u);
	assert.doesNotMatch(SOURCES.rail, /canViewItem=/u);
	assert.match(SOURCES.sessions, /onView: onResume === undefined \? undefined : \(item: AgentSessionItem\) => \{/u);
	assert.match(SOURCES.sessions, /isLooseWorkResumable\?\.\(session\) \?\? true/u);
	// Resumability is declared up front so non-resumable rows never render an
	// enabled Resume control; the callback guard alone runs after the copy.
	assert.match(SOURCES.sessions, /isResumable: \(item: AgentSessionItem\) => resolveResumable\(item\) !== undefined/u);
	assert.doesNotMatch(SOURCES.rail, /onResumeAgentSession/u);
	assert.doesNotMatch(SOURCES.rail, /sourceFacts/u);
	assert.doesNotMatch(SOURCES.rail, /JiraIssueUncapturedWork/u);
});

test("lw-spike-webhook-session is the Copilot session that uses its third-party brand mark", async () => {
	const { PULSE_TIMELINE, toPulseSessionAgent, toPulseSessionItems } = await loadSessionsHarness();
	const session = PULSE_TIMELINE.looseWork.find((item) => item.id === "lw-spike-webhook-session");
	assert.ok(session !== undefined, "fixture should include lw-spike-webhook-session");
	assert.equal(session.kind, "agent-session");
	assert.equal(session.agentId, "copilot");
	const agent = toPulseSessionAgent("copilot");
	assert.equal(agent.name, "GitHub Copilot");
	assert.equal(agent.vpkLogo, undefined);
	assert.equal(agent.brandName, "github-copilot");
	const [item] = toPulseSessionItems([session], PULSE_TIMELINE.members);
	assert.equal(item.id, "lw-spike-webhook-session");
	assert.equal(item.agent.vpkLogo, undefined);
	assert.equal(item.agent.brandName, "github-copilot");
});

test("the roster filter narrows sessions the way the header narrows board cards", async () => {
	const { filterPulseLooseWorkByMember, PULSE_TIMELINE } = await loadSessionsHarness();
	const all = PULSE_TIMELINE.looseWork;

	// No roster member selected means no filter.
	assert.equal(filterPulseLooseWorkByMember(all, null).length, all.length);

	// Regression: the board's untracked-work column used to map every session
	// regardless of the header selection, so picking one person hid their
	// teammates' cards while leaving every teammate's session on screen.
	const memberId = all.find((item) => item.memberIds.length > 0)?.memberIds[0];
	assert.ok(memberId !== undefined, "fixture should attribute loose work to a member");

	const filtered = filterPulseLooseWorkByMember(all, memberId);
	assert.ok(filtered.length > 0, "the selected member should keep their own loose work");
	assert.ok(filtered.length < all.length, "other members' loose work should drop out");
	for (const item of filtered) {
		assert.ok(item.memberIds.includes(memberId), `${item.id} is not attributable to the selection`);
	}

	// Only a roster-resolved id ever reaches this helper. `toPulseMemberId`
	// answers null for a selection made in the board's own assignee id space,
	// so the column is never emptied by a selection it cannot express.
	const boardOnlyIds = new Set(["maya-chen", "jordan-lee"]);
	const pulseMemberIds = new Set(PULSE_TIMELINE.members.map((member) => member.id));
	for (const id of boardOnlyIds) {
		assert.ok(!pulseMemberIds.has(id), `${id} should not name a roster member`);
	}
});

test("session flyout status resolves from the unscoped work-item collection", async () => {
	const { PULSE_TIMELINE, toPulseSessionIssueStatus, toPulseSessionItems } =
		await loadSessionsHarness();
	const session = PULSE_TIMELINE.looseWork.find((item) => item.kind === "agent-session");
	assert.ok(session !== undefined, "fixture should include a local session");
	const fullStatus = toPulseSessionIssueStatus(session.sourceTitle, PULSE_TIMELINE.workItems);
	assert.ok(fullStatus !== undefined, `${session.id} should resolve a board status`);
	const [scopedOut] = toPulseSessionItems([session], PULSE_TIMELINE.members, []);
	assert.equal(scopedOut.sessionDetails.issueStatus, undefined);
	const [scopedIn] = toPulseSessionItems(
		[session],
		PULSE_TIMELINE.members,
		PULSE_TIMELINE.workItems,
	);
	assert.equal(scopedIn.sessionDetails.issueStatus, fullStatus);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/agentSessionMembers = PULSE_TIMELINE\.members/u,
	);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/toPulseSessionItems\(\s*filterPulseLooseWorkByMember\(agentSessionLooseWork, agentSessionMemberId\),\s*agentSessionMembers,\s*PULSE_TIMELINE\.workItems,/u,
	);
	assert.match(SOURCES.shell, /workItems=\{sourceTimeline\.workItems\}/u);
	assert.doesNotMatch(SOURCES.shell, /workItems=\{pulse\.workItems\}/u);
});

test("an authored session status overrides the static Pulse work-item collection", async () => {
	const { PULSE_TIMELINE, toPulseSessionItems } = await loadSessionsHarness();
	const session = PULSE_TIMELINE.looseWork.find((item) => item.kind === "agent-session");
	assert.ok(session !== undefined, "fixture should include a local session");

	const [item] = toPulseSessionItems(
		[{ ...session, issueStatus: "In review" }],
		PULSE_TIMELINE.members,
		[],
	);
	assert.equal(item.sessionDetails.issueStatus, "In review");
});
