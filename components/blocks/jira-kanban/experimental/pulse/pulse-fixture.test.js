/**
 * Pulse fixture integrity — a dangling id is a rendered hole.
 *
 * The fixture is walked as data rather than asserted from source: every id it
 * references has to resolve, every active member has to have a contribution,
 * and every avatar path has to exist on disk. A 404 avatar or a work-item key
 * with nothing behind it renders as a gap in the page, which no type can catch.
 *
 * Split out of `pulse.test.js` when the continuous-article reshape pushed that
 * file past the repo's 1000-line budget. It reads only the fixture, so it was
 * the one block with no coupling to the rest of the suite.
 */

const { test } = require("node:test");

const {
	assert,
	existsSync,
	join,
	loadTimelineHarness,
} = require("./pulse-test-harness");

/* ------------------------------------------------------------------ */
/* Fixture integrity — a dangling id is a rendered hole                 */
/* ------------------------------------------------------------------ */

test("Pulse fixture resolves every id it references", async () => {
	const { PULSE_TIMELINE } = await loadTimelineHarness();
	const workItemKeys = new Set(PULSE_TIMELINE.workItems.map((item) => item.key));
	const looseWorkIds = new Set(PULSE_TIMELINE.looseWork.map((item) => item.id));
	const memberIds = new Set(PULSE_TIMELINE.members.map((member) => member.id));

	assert.equal(workItemKeys.size, PULSE_TIMELINE.workItems.length, "duplicate work-item key");
	assert.equal(looseWorkIds.size, PULSE_TIMELINE.looseWork.length, "duplicate loose-work id");
	assert.equal(memberIds.size, PULSE_TIMELINE.members.length, "duplicate member id");
	assert.equal(
		new Set(PULSE_TIMELINE.snapshots.map((snapshot) => snapshot.id)).size,
		PULSE_TIMELINE.snapshots.length,
		"duplicate snapshot id",
	);

	for (const workItem of PULSE_TIMELINE.workItems) {
		for (const memberId of workItem.memberIds) {
			assert.ok(memberIds.has(memberId), `${workItem.key} credits an unknown member "${memberId}"`);
		}
	}
	for (const item of PULSE_TIMELINE.looseWork) {
		assert.ok(item.memberIds.length > 0, `${item.id} belongs to nobody`);
		for (const memberId of item.memberIds) {
			assert.ok(memberIds.has(memberId), `${item.id} credits an unknown member "${memberId}"`);
		}
	}

	PULSE_TIMELINE.snapshots.forEach((snapshot, index) => {
		const label = `${snapshot.id} (index ${index})`;
		const artifactIds = new Set(snapshot.artifacts.map((artifact) => artifact.id));
		assert.equal(artifactIds.size, snapshot.artifacts.length, `${label} has a duplicate artifact id`);

		for (const key of snapshot.workItemKeys) {
			assert.ok(workItemKeys.has(key), `${label} references a missing work item "${key}"`);
		}
		for (const id of snapshot.looseWorkIds) {
			assert.ok(looseWorkIds.has(id), `${label} references missing loose work "${id}"`);
		}
		for (const memberId of snapshot.memberIds) {
			assert.ok(memberIds.has(memberId), `${label} references an unknown member "${memberId}"`);
		}
		for (const entry of [...snapshot.attention, ...snapshot.nextActions]) {
			if (entry.workItemKey !== undefined) {
				assert.ok(workItemKeys.has(entry.workItemKey), `${label}/${entry.id} points at "${entry.workItemKey}"`);
			}
		}
	});
});

test("Pulse fixture gives every active member a contribution that resolves", async () => {
	const { findContribution, PULSE_TIMELINE } = await loadTimelineHarness();
	const workItemKeys = new Set(PULSE_TIMELINE.workItems.map((item) => item.key));
	const looseWorkIds = new Set(PULSE_TIMELINE.looseWork.map((item) => item.id));

	PULSE_TIMELINE.snapshots.forEach((snapshot) => {
		const artifactIds = new Set(snapshot.artifacts.map((artifact) => artifact.id));

		for (const memberId of snapshot.memberIds) {
			const contribution = findContribution(snapshot, memberId);
			assert.notEqual(
				contribution,
				null,
				`${snapshot.id} lists "${memberId}" as active but has no contribution for them`,
			);
			assert.ok(
				contribution.summary.trim().length > 0,
				`${snapshot.id}/${memberId} has an empty summary`,
			);
		}

		for (const contribution of snapshot.contributions) {
			const where = `${snapshot.id}/${contribution.memberId}`;
			assert.ok(
				snapshot.memberIds.includes(contribution.memberId),
				`${where} contributes but is not listed as active`,
			);
			for (const key of contribution.workItemKeys) {
				assert.ok(workItemKeys.has(key), `${where} references a missing work item "${key}"`);
			}
			for (const id of contribution.looseWorkIds) {
				assert.ok(looseWorkIds.has(id), `${where} references missing loose work "${id}"`);
				assert.ok(snapshot.looseWorkIds.includes(id), `${where} claims loose work outside its snapshot`);
			}
			// Artifact ids are snapshot-local, so they must exist in this snapshot.
			for (const id of contribution.artifactIds) {
				assert.ok(artifactIds.has(id), `${where} references an artifact "${id}" this snapshot does not have`);
			}
		}
	});
});

test("Pulse fixture keeps the story shape the timeline mode depends on", async () => {
	const { PULSE_TIMELINE } = await loadTimelineHarness();

	assert.match(PULSE_TIMELINE.projectLabel, /^PAY · /u);
	assert.ok(PULSE_TIMELINE.snapshots.length >= 7, "the arc needs its seven decision points");

	let previousTime = Number.NEGATIVE_INFINITY;
	PULSE_TIMELINE.snapshots.forEach((snapshot) => {
		const generated = new Date(snapshot.timestamp).getTime();
		assert.ok(Number.isFinite(generated), `${snapshot.id} has an unparseable timestamp`);
		assert.ok(generated > previousTime, `${snapshot.id} is not in chronological order`);
		previousTime = generated;

		for (const field of ["chapterLabel", "dateLabel", "rangeLabel", "timeLabel", "title", "updatedDateLabel", "updatedTimeLabel"]) {
			assert.ok(snapshot[field].trim().length > 0, `${snapshot.id}.${field} is empty`);
		}
		const updated = new Date(snapshot.updatedAt).getTime();
		assert.ok(Number.isFinite(updated), `${snapshot.id} has an unparseable updatedAt`);
		assert.ok(updated >= generated, `${snapshot.id} was last updated before it was generated`);
		assert.equal(snapshot.paragraphs.length, 1, `${snapshot.id} should be one paragraph, not multiple`);
		assert.ok(snapshot.paragraphs[0].trim().length > 0, `${snapshot.id} has empty prose`);
		assert.doesNotMatch(snapshot.paragraphs[0], /^\s*[-•*]\s/u, `${snapshot.id} slipped into a bullet list`);
		assert.ok(snapshot.artifacts.length > 0, `${snapshot.id} produced no artifacts`);
		assert.ok(snapshot.workItemKeys.length > 0, `${snapshot.id} moved no work items`);
		assert.ok(snapshot.looseWorkIds.length > 0, `${snapshot.id} has no uncaptured work, which is the whole point`);
		assert.ok(snapshot.stats.length > 0, `${snapshot.id} has no headline numbers`);
		assert.ok(snapshot.attention.length > 0, `${snapshot.id} surfaces nothing to attend to`);
		assert.ok(snapshot.nextActions.length > 0, `${snapshot.id} offers no next best action`);
		for (const action of snapshot.nextActions) {
			assert.ok(action.actionLabel.trim().length > 0, `${snapshot.id}/${action.id} has no button copy`);
			assert.ok(action.rationale.trim().length > 0, `${snapshot.id}/${action.id} has no rationale`);
		}
		for (const signal of snapshot.attention) {
			assert.ok(
				["attention", "decision", "risk", "shipped"].includes(signal.tone),
				`${snapshot.id}/${signal.id} has an unknown tone "${signal.tone}"`,
			);
		}
	});

	assert.ok(
		PULSE_TIMELINE.snapshots.some((snapshot) => snapshot.updatedAt !== snapshot.timestamp),
		"the fixture must show that an insight can be revised after it is generated",
	);
	assert.ok(
		PULSE_TIMELINE.snapshots.some((snapshot) => snapshot.updatedAt === snapshot.timestamp),
		"the fixture must also keep an insight that has not been revised",
	);
});

test("Venn's filtered insights keep authored insight titles, never the member name", async () => {
	const { findContribution, PULSE_TIMELINE } = await loadTimelineHarness();
	const venn = PULSE_TIMELINE.members.find((member) => member.id === "venn");
	assert.ok(venn);

	const titles = [];
	for (const snapshot of PULSE_TIMELINE.snapshots) {
		const contribution = findContribution(snapshot, "venn");
		if (contribution === null) {
			continue;
		}

		assert.ok(contribution.title?.trim(), `${snapshot.id} venn has no insight title`);
		assert.notEqual(contribution.title, venn.name, `${snapshot.id} titles the insight after Venn`);
		assert.notEqual(contribution.title, snapshot.title, `${snapshot.id} venn title is just the team title`);
		assert.ok(contribution.title.includes(" "), `${snapshot.id} headline is not a sentence`);
		titles.push(contribution.title);
	}

	assert.equal(titles.length, PULSE_TIMELINE.snapshots.length, "Venn authors every window, including the overnight shift");
	assert.equal(new Set(titles).size, titles.length, "Venn insight titles are not unique across the week");
});

test("Venn's Insights filter keeps every authored window fully stocked", async () => {
	const { findContribution, PULSE_TIMELINE, scopeByWorkItem } = await loadTimelineHarness();
	const looseById = new Map(PULSE_TIMELINE.looseWork.map((item) => [item.id, item]));
	const quietIds = [];

	for (const snapshot of PULSE_TIMELINE.snapshots) {
		const contribution = findContribution(snapshot, "venn");
		if (contribution === null) {
			quietIds.push(snapshot.id);
			continue;
		}

		const where = snapshot.id;
		const looseWork = contribution.looseWorkIds.map((id) => looseById.get(id));
		const kinds = new Set(looseWork.map((item) => item?.kind));
		const attention = scopeByWorkItem(snapshot.attention, new Set(contribution.workItemKeys));
		const nextActions = scopeByWorkItem(snapshot.nextActions, new Set(contribution.workItemKeys));

		assert.ok(contribution.artifactIds.length > 0, `${where} has no artifacts for Venn`);
		assert.ok(contribution.workItemKeys.length > 0, `${where} moved no work items for Venn`);
		assert.ok(contribution.looseWorkIds.length > 0, `${where} has no uncaptured work for Venn`);
		assert.ok(kinds.has("agent-session"), `${where} has no local Claude session for Venn`);
		assert.ok(
			kinds.has("pull-request") || kinds.has("commit") || kinds.has("branch"),
			`${where} has no GitHub uncaptured work for Venn`,
		);
		assert.ok(attention.length > 0, `${where} needs no input from Venn`);
		assert.ok(nextActions.length > 0, `${where} offers Venn no next best action`);
		assert.ok(
			contribution.looseWorkIds.length >= 2,
			`${where} uncaptured column is a single card`,
		);

		if (snapshot.id === "s4-night-shift") {
			assert.equal(contribution.artifactIds.length, snapshot.artifacts.length, `${where} dropped an overnight artifact`);
			assert.equal(attention.length, snapshot.attention.length, `${where} dropped an overnight Needs input row`);
			assert.equal(nextActions.length, snapshot.nextActions.length, `${where} dropped an overnight next best action`);
		}
	}

	assert.deepEqual(quietIds, [], "Venn is never quiet — Learn defaults to this face");
});

test("Venn's kickoff contribution includes PAY-101 so a Venn Insights filter still opens Build", async () => {
	const { findContribution, PULSE_TIMELINE } = await loadTimelineHarness();
	const kickoff = PULSE_TIMELINE.snapshots.find((snapshot) => snapshot.id === "s1-kickoff");
	assert.ok(kickoff);
	const contribution = findContribution(kickoff, "venn");
	assert.ok(contribution);

	assert.ok(kickoff.workItemKeys.includes("PAY-101"));
	assert.ok(contribution.workItemKeys.includes("PAY-101"));
});

test("Pulse fixture gives every attention signal its own honest event time", async () => {
	const { PULSE_TIMELINE } = await loadTimelineHarness();
	// "Wed 19 Aug 01:14" — same pre-formatted shape as every other fixture clock,
	// because formatting at render time drifts between server and client.
	const stamp = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{2} [A-Z][a-z]{2} \d{2}:\d{2}$/u;

	PULSE_TIMELINE.snapshots.forEach((snapshot) => {
		const windowClose = `${snapshot.dateLabel} ${snapshot.timeLabel}`;

		for (const signal of snapshot.attention) {
			const where = `${snapshot.id}/${signal.id}`;
			assert.match(signal.timeLabel, stamp, `${where} has an unreadable time "${signal.timeLabel}"`);

			// The row labels this field as the last update, so a time quoted in the
			// copy and the time on the row have to be the same time.
			const quoted = /\b(?:Posted|since|at) (\d{2}:\d{2})\b/u.exec(signal.detail);
			if (quoted !== null) {
				assert.ok(
					signal.timeLabel.endsWith(quoted[1]),
					`${where} says "${quoted[1]}" in its detail but is stamped "${signal.timeLabel}"`,
				);
			}
		}

		// Stamping every row with the window's closing boundary is what this
		// replaced; at least one signal in a window must predate its close.
		assert.ok(
			snapshot.attention.some((signal) => signal.timeLabel !== windowClose),
			`${snapshot.id} dates every signal to the moment the window closed`,
		);
	});
});

test("Pulse fixture attributes every attention signal to somebody in the window", async () => {
	const { PULSE_TIMELINE } = await loadTimelineHarness();
	const byId = new Map(PULSE_TIMELINE.members.map((member) => [member.id, member]));
	const kinds = new Set();

	PULSE_TIMELINE.snapshots.forEach((snapshot) => {
		for (const signal of snapshot.attention) {
			const where = `${snapshot.id}/${signal.id}`;
			const member = byId.get(signal.memberId);
			// "Needs input" leads with a face, so an unattributed signal — or
			// one from somebody who was not in the window — has no row to render.
			assert.ok(member !== undefined, `${where} names an unknown member "${signal.memberId}"`);
			assert.ok(
				snapshot.memberIds.includes(signal.memberId),
				`${where} comes from "${signal.memberId}", who the window does not list as active`,
			);
			kinds.add(member.kind);
		}
	});

	// The point of the section is that both kinds are waiting on you: agents
	// that stopped, and teammates who commented or @mentioned you.
	assert.deepEqual([...kinds].sort(), ["agent", "human"]);
});

test("Pulse fixture surfaces both agent and human attention across the week", async () => {
	const { PULSE_TIMELINE } = await loadTimelineHarness();
	const byId = new Map(PULSE_TIMELINE.members.map((member) => [member.id, member]));
	const mixed = PULSE_TIMELINE.snapshots.filter((snapshot) => {
		const kinds = new Set(snapshot.attention.map((signal) => byId.get(signal.memberId)?.kind));
		return kinds.has("agent") && kinds.has("human");
	});

	// Not every window can mix — the night shift is deliberately agents only —
	// but most should, or the mixed list is a claim the fixture never makes.
	assert.ok(
		mixed.length >= PULSE_TIMELINE.snapshots.length - 2,
		`only ${mixed.length} of ${PULSE_TIMELINE.snapshots.length} windows mix agent and human attention`,
	);

	const nightShift = PULSE_TIMELINE.snapshots.find((snapshot) => snapshot.id === "s4-night-shift");
	assert.ok(
		nightShift.attention.every((signal) => byId.get(signal.memberId).kind === "agent"),
		"the night shift is the agents-only window; a human signal there contradicts the prose",
	);

	// At least one row must be a teammate @mentioning the reader, which is the
	// human half of the section in its most literal form.
	const mentions = PULSE_TIMELINE.snapshots.flatMap((snapshot) =>
		snapshot.attention.filter((signal) => signal.detail.includes("@you")),
	);
	assert.ok(mentions.length >= 3, "the week should contain several unanswered @mentions");
	for (const mention of mentions) {
		assert.equal(byId.get(mention.memberId).kind, "human", `${mention.id} @mentions you but is not a person`);
	}
});

test("Pulse fixture points every avatar at a file that exists", async () => {
	const { PULSE_TIMELINE } = await loadTimelineHarness();
	const publicDir = join(process.cwd(), "public");
	const sources = new Set();

	for (const member of PULSE_TIMELINE.members) {
		assert.match(
			member.avatarSrc,
			member.kind === "agent" ? /^\/avatar-agent\//u : /^\/avatar-user\//u,
			`${member.id} uses an avatar from the wrong family`,
		);
		sources.add(member.avatarSrc);
	}
	for (const workItem of PULSE_TIMELINE.workItems) {
		if (workItem.assigneeAvatarSrc !== undefined) {
			sources.add(workItem.assigneeAvatarSrc);
		}
	}

	assert.ok(sources.size > 0);
	for (const source of sources) {
		assert.ok(source.startsWith("/"), `${source} must be an absolute public path`);
		assert.ok(existsSync(join(publicDir, source)), `${source} does not exist under public/`);
	}
});

test("Pulse work-item assignees resolve to a roster member and keep agent hex art", async () => {
	const { PULSE_TIMELINE } = await loadTimelineHarness();
	const membersById = new Map(PULSE_TIMELINE.members.map((member) => [member.id, member]));
	let agentAssignees = 0;

	for (const workItem of PULSE_TIMELINE.workItems) {
		assert.ok(workItem.assigneeId, `${workItem.key} has no assigneeId`);
		const assignee = membersById.get(workItem.assigneeId);
		assert.ok(assignee, `${workItem.key} assigneeId "${workItem.assigneeId}" is not on the roster`);
		assert.equal(assignee.name, workItem.assigneeName, `${workItem.key} assignee name does not match the roster`);
		assert.equal(assignee.avatarSrc, workItem.assigneeAvatarSrc, `${workItem.key} assignee art does not match the roster`);
		if (assignee.kind === "agent") {
			agentAssignees += 1;
			assert.match(assignee.avatarSrc, /^\/avatar-agent\//u, `${workItem.key} agent assignee uses human art`);
		} else {
			assert.match(assignee.avatarSrc, /^\/avatar-user\//u, `${workItem.key} human assignee uses agent art`);
		}
	}

	assert.ok(agentAssignees > 0, "the fixture has no agent-assigned work items");
});

test("Pulse uncaptured work is only GitHub PRs, branches, commits, or local coding-agent sessions", async () => {
	const { PULSE_TIMELINE, PULSE_SPACE_REPOSITORY, pulseLooseWorkCanCreateWorkItem, pulseLooseWorkHostLabel, pulseLooseWorkSource } = await loadTimelineHarness();
	const kinds = new Set(["pull-request", "branch", "commit", "agent-session"]);
	const byId = new Map(PULSE_TIMELINE.looseWork.map((item) => [item.id, item]));

	assert.equal(PULSE_SPACE_REPOSITORY, "acme/storefront");
	assert.equal(PULSE_TIMELINE.looseWork.length, 51);

	for (const item of PULSE_TIMELINE.looseWork) {
		assert.ok(kinds.has(item.kind), `${item.id} has unknown kind "${item.kind}"`);
		assert.doesNotMatch(item.title, /<br\s*\/?>/u, `${item.id} uses a break hack instead of real wrap`);
		assert.ok(
			item.title.length >= 54,
			`${item.id} title is ${item.title.length} chars and will sit on one line at 300px`,
		);

		const source = pulseLooseWorkSource(item.kind);
		if (item.kind === "agent-session") {
			assert.equal(source, "Claude", `${item.id} should brand as Claude`);
			assert.equal(item.host, "local", `${item.id} is not a local session`);
			assert.match(item.sourceTitle, /^PAY-\d+$/u, `${item.id} sourceTitle should be the issue key`);
			assert.equal(pulseLooseWorkHostLabel(item.host), "Local");
			assert.equal(pulseLooseWorkCanCreateWorkItem(item.kind), false, `${item.id} must not create a work item`);
			assert.match(item.detail, /host local/u, `${item.id} detail should name the local host`);
			assert.ok(item.agentId, `${item.id} is missing a coding agent`);
			assert.ok(item.machineName.trim().length > 0, `${item.id} is missing a machine name`);
			assert.ok(item.timeLabel.trim().length > 0, `${item.id} is missing a timestamp`);
			assert.doesNotMatch(item.sourceTitle, /Slack|Loom|Figma|Confluence/u);
			continue;
		}

		assert.equal(source, "GitHub", `${item.id} should brand as GitHub`);
		assert.equal(pulseLooseWorkCanCreateWorkItem(item.kind), true, `${item.id} should be capturable`);
		assert.match(item.detail, /acme\/storefront/u, `${item.id} is not on the space repo`);
		if (item.kind === "pull-request") {
			assert.ok(item.pullRequest, `${item.id} is a PR without pullRequest fields`);
			assert.match(item.sourceTitle, /^PRs? #/u, `${item.id} sourceTitle should be PR #N`);
		}
	}

	const sessions = PULSE_TIMELINE.looseWork.filter((item) => item.kind === "agent-session");
	assert.equal(sessions.length, 16, "the untracked-work column should have sixteen sessions");
	const sessionTimeLabels = new Set(sessions.map((item) => item.timeLabel));
	const sessionMachines = new Set(sessions.map((item) => item.machineName));
	const sessionAgents = new Set(sessions.map((item) => item.agentId));
	const calendarStamp = /Aug|Mon |Tue |Wed |Thu |Fri /u;
	const relativeStamp = /^(Just now|\d+m ago|\d+h ago|Yesterday|\d+d ago|Last week)$/u;
	for (const item of sessions) {
		assert.doesNotMatch(item.timeLabel, calendarStamp, `${item.id} must not use a calendar stamp`);
		assert.match(item.timeLabel, relativeStamp, `${item.id} timeLabel "${item.timeLabel}" is not relative`);
	}
	assert.ok(sessionTimeLabels.size > 1, "session timestamps must not all be identical");
	assert.ok(sessionMachines.size > 1, "session machine names must not all be identical");
	// The viewer's own machine is what grants Resume, so a couple of rows carry
	// it on purpose. The fixture still has to look like a team's week, not one
	// laptop: most sessions belong to somebody else.
	assert.ok(
		sessions.filter((item) => item.machineName === "Venn’s MacBook").length < sessions.length / 2,
		"do not stamp every row as Venn’s MacBook",
	);
	for (const agentId of ["claude", "codex", "copilot", "cursor"]) {
		assert.ok(sessionAgents.has(agentId), `sessions are missing ${agentId}`);
	}

	for (const id of [
		"lw-adapter-branch",
		"lw-night-prs",
		"lw-loom-spike",
		"lw-flag-edits",
		"lw-killswitch-loom",
		"lw-oncall-note",
		"lw-copy-doc",
		"lw-p95-screenshot",
		"lw-scope-thread",
		"lw-sandbox-triage",
		"lw-figma-parked",
		"lw-rehearsal-draft",
	]) {
		assert.ok(byId.has(id), `original uncaptured item "${id}" is missing`);
	}

	for (const snapshot of PULSE_TIMELINE.snapshots) {
		const kindsInWindow = new Set(snapshot.looseWorkIds.map((id) => byId.get(id)?.kind));
		assert.ok(kindsInWindow.has("agent-session"), `${snapshot.id} has no coding agent session`);
		assert.ok(kindsInWindow.has("pull-request"), `${snapshot.id} has no pull request`);
		assert.ok(kindsInWindow.has("commit"), `${snapshot.id} has no code commit`);
		assert.ok(snapshot.looseWorkIds.length >= 5, `${snapshot.id} is still a thin uncaptured column`);
	}
});

test("Pulse work-item summaries are long enough to wrap to two lines at 320px", async () => {
	const { PULSE_TIMELINE } = await loadTimelineHarness();

	for (const workItem of PULSE_TIMELINE.workItems) {
		assert.doesNotMatch(workItem.summary, /<br\s*\/?>/u, `${workItem.key} uses a break hack instead of real wrap`);
		assert.ok(
			workItem.summary.length >= 54,
			`${workItem.key} summary is ${workItem.summary.length} chars and will sit on one line at 320px`,
		);
	}
});

test("Pulse fixture credits a few humans and agents per outcome, not the whole roster", async () => {
	const { PULSE_TIMELINE } = await loadTimelineHarness();
	const byId = new Map(PULSE_TIMELINE.members.map((member) => [member.id, member]));
	const processLabels = /Kickoff|The spike|Regression|Night shift|Design review|Rehearsal|Ship readiness/u;

	for (const snapshot of PULSE_TIMELINE.snapshots) {
		const words = snapshot.chapterLabel.trim().split(/\s+/u);
		assert.ok(
			words.length >= 1 && words.length <= 3,
			`${snapshot.id} microheader "${snapshot.chapterLabel}" is not 1–3 words`,
		);
		assert.doesNotMatch(snapshot.chapterLabel, processLabels, `${snapshot.id} microheader is still a process name`);
		assert.doesNotMatch(snapshot.chapterLabel, /Venn|Last updated/u, `${snapshot.id} microheader still names a person or a clock`);

		assert.ok(snapshot.memberIds.length >= 2, `${snapshot.id} credits nobody`);
		assert.ok(
			snapshot.memberIds.length <= 5,
			`${snapshot.id} credits ${snapshot.memberIds.length} people, which is the whole room`,
		);

		const kinds = new Set(snapshot.memberIds.map((memberId) => byId.get(memberId)?.kind));
		assert.ok(
			kinds.has("human") && kinds.has("agent"),
			`${snapshot.id} should mix a few humans and agents`,
		);
	}
});
