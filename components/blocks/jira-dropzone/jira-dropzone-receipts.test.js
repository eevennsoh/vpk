const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
	JIRA_DROPZONE_FULL_MOTION_PROFILE,
	JIRA_DROPZONE_REDUCED_MOTION_PROFILE,
	resolveJiraDropzoneLandingPoint,
} = require("./lib/jira-dropzone-motion.ts");
const {
	JIRA_DROPZONE_FIELD_INITIAL_STATE,
	classifyReceipt,
	flightsFromReceipt,
	isReceiving,
	jiraDropzoneFieldReducer,
	settlingChannelTitles,
	resolveJiraDropzoneBounce,
	resolveJiraDropzoneCollapseMs,
	resolveJiraDropzoneCopy,
	resolveJiraDropzoneDrop,
	resolveJiraDropzonePhase,
	resolveJiraDropzoneSurface,
	sessionReceiptId,
	shouldImpulseDropzoneChrome,
} = require("./lib/jira-dropzone-receipts.ts");

function member(id, name = id) {
	return { id, name };
}

function receipt(overrides = {}) {
	const members = overrides.members ?? [member("s1")];
	const from = overrides.from ?? { x: 10, y: 20 };
	const title = overrides.title ?? "To Do";
	const cohortKey = members.map((item) => item.id).sort().join("|");
	return {
		from,
		id: overrides.id ?? sessionReceiptId({ cohortKey, from, title }),
		bounce: overrides.bounce,
		drop: overrides.drop,
		members,
		title,
	};
}

function reduce(events, initial = JIRA_DROPZONE_FIELD_INITIAL_STATE) {
	return events.reduce((state, event) => jiraDropzoneFieldReducer(state, event), initial);
}

test("sessionReceiptId is a pure function of cohort, title, and pixel", () => {
	const parts = { cohortKey: "a|b", from: { x: 4, y: 8 }, title: "To Do" };
	assert.equal(sessionReceiptId(parts), sessionReceiptId(parts));
	assert.notEqual(
		sessionReceiptId(parts),
		sessionReceiptId({ ...parts, from: { x: 5, y: 8 } }),
	);
});

test("register twice keeps one channel", () => {
	const state = reduce([
		{ kind: "register", title: "To Do" },
		{ kind: "register", title: "To Do" },
	]);
	assert.equal(state.channels.size, 1);
	assert.equal(state.channels.get("To Do").flights.length, 0);
});

test("receive to an unregistered title is no-dropzone and a no-op", () => {
	const next = receipt();
	assert.equal(classifyReceipt(JIRA_DROPZONE_FIELD_INITIAL_STATE, next), "no-dropzone");
	const state = jiraDropzoneFieldReducer(
		JIRA_DROPZONE_FIELD_INITIAL_STATE,
		{ kind: "receive", profile: JIRA_DROPZONE_FULL_MOTION_PROFILE, receipt: next },
	);
	assert.equal(state.channels.size, 0);
	assert.equal(state.seen.size, 0);
});

test("duplicate receipt id is a no-op", () => {
	const next = receipt();
	const state = reduce([
		{ kind: "register", title: "To Do" },
		{ kind: "receive", profile: JIRA_DROPZONE_FULL_MOTION_PROFILE, receipt: next },
		{ kind: "receive", profile: JIRA_DROPZONE_FULL_MOTION_PROFILE, receipt: next },
	]);
	assert.equal(classifyReceipt(state, next), "duplicate");
	assert.equal(state.channels.get("To Do").flights.length, 1);
	assert.deepEqual(state.channels.get("To Do").queued, []);
});

test("a new id arriving mid-flight queues", () => {
	const first = receipt();
	const second = receipt({
		from: { x: 11, y: 20 },
		members: [member("s2")],
	});
	const state = reduce([
		{ kind: "register", title: "To Do" },
		{ kind: "receive", profile: JIRA_DROPZONE_FULL_MOTION_PROFILE, receipt: first },
		{ kind: "receive", profile: JIRA_DROPZONE_FULL_MOTION_PROFILE, receipt: second },
	]);
	const channel = state.channels.get("To Do");
	assert.equal(channel.flights.length, 1);
	assert.equal(channel.flights[0].members[0].id, "s1");
	assert.equal(channel.queued.length, 1);
	assert.equal(channel.queued[0].receipt.id, second.id);
	assert.equal(isReceiving(channel), true);
});

test("land on an absent key is a no-op", () => {
	const next = receipt();
	const started = reduce([
		{ kind: "register", title: "To Do" },
		{ kind: "receive", profile: JIRA_DROPZONE_FULL_MOTION_PROFILE, receipt: next },
	]);
	const flightKey = started.channels.get("To Do").flights[0].key;
	const afterMissing = jiraDropzoneFieldReducer(started, {
		flightKey: "missing:s1:0",
		kind: "land",
		title: "To Do",
	});
	assert.equal(afterMissing.channels.get("To Do").impacts, 0);
	const afterLand = jiraDropzoneFieldReducer(started, {
		flightKey,
		kind: "land",
		title: "To Do",
	});
	assert.equal(afterLand.channels.get("To Do").impacts, 1);
	assert.equal(afterLand.channels.get("To Do").settling, true);
	assert.equal(afterLand.channels.get("To Do").flights.length, 0);
});

test("settle dequeues a waiting receipt", () => {
	const first = receipt();
	const second = receipt({
		from: { x: 12, y: 20 },
		members: [member("s2")],
	});
	const started = reduce([
		{ kind: "register", title: "To Do" },
		{ kind: "receive", profile: JIRA_DROPZONE_FULL_MOTION_PROFILE, receipt: first },
		{ kind: "receive", profile: JIRA_DROPZONE_FULL_MOTION_PROFILE, receipt: second },
	]);
	const flightKey = started.channels.get("To Do").flights[0].key;
	const settled = reduce(
		[
			{ flightKey, kind: "land", title: "To Do" },
			{ kind: "settle", title: "To Do" },
		],
		started,
	);
	const channel = settled.channels.get("To Do");
	assert.deepEqual(channel.queued, []);
	assert.equal(channel.settling, false);
	assert.equal(channel.flights.length, 1);
	assert.equal(channel.flights[0].members[0].id, "s2");
});

test("a four-member receipt is one flight from the drop origin", () => {
	const next = receipt({
		members: [member("a"), member("b"), member("c"), member("d")],
	});
	const flights = flightsFromReceipt(next, JIRA_DROPZONE_FULL_MOTION_PROFILE);
	assert.equal(flights.length, 1);
	assert.equal(flights[0].delayMs, 0);
	assert.deepEqual(flights[0].from, next.from);
	assert.deepEqual(
		flights[0].members.map((item) => item.id),
		["a", "b", "c", "d"],
	);
	assert.equal(resolveJiraDropzoneDrop(next), "cohort");
	assert.equal(resolveJiraDropzoneBounce(next), "once");
});

test("landing a four-member receipt bounces the well once", () => {
	const four = receipt({
		members: [member("a"), member("b"), member("c"), member("d")],
	});
	const started = reduce([
		{ kind: "register", title: "To Do" },
		{ kind: "receive", profile: JIRA_DROPZONE_FULL_MOTION_PROFILE, receipt: four },
	]);
	const channel = started.channels.get("To Do");
	assert.equal(channel.flights.length, 1);
	assert.equal(channel.impacts, 0);
	const afterLand = jiraDropzoneFieldReducer(started, {
		flightKey: channel.flights[0].key,
		kind: "land",
		title: "To Do",
	});
	assert.equal(afterLand.channels.get("To Do").impacts, 1);
	assert.equal(afterLand.channels.get("To Do").flights.length, 0);
	assert.equal(afterLand.channels.get("To Do").settling, true);
});

test("a second queued receipt still bounces again", () => {
	const first = receipt({
		members: [member("a"), member("b"), member("c"), member("d")],
	});
	const second = receipt({
		from: { x: 11, y: 20 },
		members: [member("e")],
	});
	const started = reduce([
		{ kind: "register", title: "To Do" },
		{ kind: "receive", profile: JIRA_DROPZONE_FULL_MOTION_PROFILE, receipt: first },
		{ kind: "receive", profile: JIRA_DROPZONE_FULL_MOTION_PROFILE, receipt: second },
	]);
	const firstKey = started.channels.get("To Do").flights[0].key;
	const afterFirst = reduce(
		[
			{ flightKey: firstKey, kind: "land", title: "To Do" },
			{ kind: "settle", title: "To Do" },
		],
		started,
	);
	assert.equal(afterFirst.channels.get("To Do").impacts, 1);
	assert.equal(afterFirst.channels.get("To Do").flights.length, 1);
	assert.equal(afterFirst.channels.get("To Do").flights[0].members[0].id, "e");
	const afterSecond = jiraDropzoneFieldReducer(afterFirst, {
		flightKey: afterFirst.channels.get("To Do").flights[0].key,
		kind: "land",
		title: "To Do",
	});
	assert.equal(afterSecond.channels.get("To Do").impacts, 2);
	assert.equal(afterSecond.channels.get("To Do").flights.length, 0);
});

test("reduced profile still emits one flight with no bounce", () => {
	const next = receipt({
		members: [member("a"), member("b")],
	});
	const flights = flightsFromReceipt(next, JIRA_DROPZONE_REDUCED_MOTION_PROFILE);
	assert.equal(flights.length, 1);
	assert.equal(flights[0].delayMs, 0);
	assert.equal(JIRA_DROPZONE_REDUCED_MOTION_PROFILE.travel, "none");
	assert.equal(JIRA_DROPZONE_REDUCED_MOTION_PROFILE.durationMs, 0);
	assert.equal(JIRA_DROPZONE_REDUCED_MOTION_PROFILE.impact, null);
});

test("a third receipt queues behind the second instead of replacing it", () => {
	const first = receipt();
	const second = receipt({
		from: { x: 11, y: 20 },
		members: [member("s2")],
	});
	const third = receipt({
		from: { x: 12, y: 20 },
		members: [member("s3")],
	});
	const started = reduce([
		{ kind: "register", title: "To Do" },
		{ kind: "receive", profile: JIRA_DROPZONE_FULL_MOTION_PROFILE, receipt: first },
		{ kind: "receive", profile: JIRA_DROPZONE_FULL_MOTION_PROFILE, receipt: second },
		{ kind: "receive", profile: JIRA_DROPZONE_FULL_MOTION_PROFILE, receipt: third },
	]);
	assert.deepEqual(
		started.channels.get("To Do").queued.map((item) => item.receipt.members[0].id),
		["s2", "s3"],
	);
	const afterFirst = reduce(
		[
			{ flightKey: started.channels.get("To Do").flights[0].key, kind: "land", title: "To Do" },
			{ kind: "settle", title: "To Do" },
		],
		started,
	);
	assert.equal(afterFirst.channels.get("To Do").flights[0].members[0].id, "s2");
	assert.equal(afterFirst.channels.get("To Do").queued[0].receipt.members[0].id, "s3");
	const afterSecond = reduce(
		[
			{ flightKey: afterFirst.channels.get("To Do").flights[0].key, kind: "land", title: "To Do" },
			{ kind: "settle", title: "To Do" },
		],
		afterFirst,
	);
	assert.equal(afterSecond.channels.get("To Do").flights[0].members[0].id, "s3");
	assert.deepEqual(afterSecond.channels.get("To Do").queued, []);
});

test("comma-bearing titles stay one settle channel", () => {
	const title = "Review, blocked";
	const next = receipt({ title });
	const started = reduce([
		{ kind: "register", title },
		{ kind: "receive", profile: JIRA_DROPZONE_FULL_MOTION_PROFILE, receipt: next },
	]);
	const afterLand = jiraDropzoneFieldReducer(started, {
		flightKey: started.channels.get(title).flights[0].key,
		kind: "land",
		title,
	});
	assert.deepEqual(settlingChannelTitles(afterLand), [title]);
	const settled = jiraDropzoneFieldReducer(afterLand, { kind: "settle", title });
	assert.equal(settled.channels.get(title).settling, false);
	assert.deepEqual(settlingChannelTitles(settled), []);
});

test("latestReceipt follows receive order, not lexicographic ids", () => {
	const older = receipt({
		from: { x: 1, y: 1 },
		members: [member("z")],
		title: "To Do",
	});
	const newer = receipt({
		from: { x: 9, y: 9 },
		members: [member("a")],
		title: "In Progress",
	});
	assert.equal(newer.id < older.id, true);
	const state = reduce([
		{ kind: "register", title: "To Do" },
		{ kind: "register", title: "In Progress" },
		{ kind: "receive", profile: JIRA_DROPZONE_FULL_MOTION_PROFILE, receipt: older },
		{ kind: "receive", profile: JIRA_DROPZONE_FULL_MOTION_PROFILE, receipt: newer },
	]);
	assert.equal(state.latestReceipt.id, newer.id);
	assert.equal(state.latestReceipt.title, "In Progress");
});

function landAll(started, title = "To Do") {
	return started.channels.get(title).flights.reduce((state, flight) => (
		jiraDropzoneFieldReducer(state, {
			flightKey: flight.key,
			kind: "land",
			title,
		})
	), started);
}

function receiveFour(flags = {}) {
	const four = receipt({
		bounce: flags.bounce,
		drop: flags.drop,
		members: [member("a"), member("b"), member("c"), member("d")],
	});
	return reduce([
		{ kind: "register", title: "To Do" },
		{ kind: "receive", profile: JIRA_DROPZONE_FULL_MOTION_PROFILE, receipt: four },
	]);
}

test("matrix: cohort drop + bounce once is one flight and one impact", () => {
	const started = receiveFour({ bounce: "once", drop: "cohort" });
	assert.equal(started.channels.get("To Do").flights.length, 1);
	const after = landAll(started);
	assert.equal(after.channels.get("To Do").impacts, 1);
});

test("matrix: cohort drop + bounce each is still one flight and one impact", () => {
	const started = receiveFour({ bounce: "each", drop: "cohort" });
	assert.equal(started.channels.get("To Do").flights.length, 1);
	const after = landAll(started);
	assert.equal(after.channels.get("To Do").impacts, 1);
});

test("matrix: stagger drop + bounce once is N flights and one first-land impact", () => {
	const started = receiveFour({ bounce: "once", drop: "stagger" });
	const channel = started.channels.get("To Do");
	assert.equal(channel.flights.length, 4);
	const staggerMs = JIRA_DROPZONE_FULL_MOTION_PROFILE.staggerMs;
	assert.deepEqual(
		channel.flights.map((flight) => flight.delayMs),
		[0, staggerMs, staggerMs * 2, staggerMs * 3],
	);
	const afterFirst = jiraDropzoneFieldReducer(started, {
		flightKey: channel.flights[0].key,
		kind: "land",
		title: "To Do",
	});
	assert.equal(afterFirst.channels.get("To Do").impacts, 1);
	assert.equal(
		shouldImpulseDropzoneChrome({
			bounce: "once",
			impacts: afterFirst.channels.get("To Do").impacts,
			receiving: isReceiving(afterFirst.channels.get("To Do")),
		}),
		true,
	);
	const afterAll = landAll(started);
	assert.equal(afterAll.channels.get("To Do").impacts, 1);
	assert.equal(afterAll.channels.get("To Do").flights.length, 0);
});

test("matrix: stagger drop + bounce each is N flights and N impacts", () => {
	const started = receiveFour({ bounce: "each", drop: "stagger" });
	assert.equal(started.channels.get("To Do").flights.length, 4);
	const after = landAll(started);
	assert.equal(after.channels.get("To Do").impacts, 4);
});

test("a four-member stagger receipt fans launch points", () => {
	const next = receipt({
		drop: "stagger",
		members: [member("a"), member("b"), member("c"), member("d")],
	});
	const flights = flightsFromReceipt(next, JIRA_DROPZONE_FULL_MOTION_PROFILE);
	assert.deepEqual(
		flights.map((flight) => flight.members.map((item) => item.id)),
		[["a"], ["b"], ["c"], ["d"]],
	);
	const spread = JIRA_DROPZONE_FULL_MOTION_PROFILE.launchSpreadPx;
	assert.deepEqual(
		flights.map((flight) => flight.from.x - next.from.x),
		[-1.5, -0.5, 0.5, 1.5].map((step) => step * spread),
	);
});

test("queued second receipt still works for stagger drop + bounce once", () => {
	const first = receipt({
		bounce: "once",
		drop: "stagger",
		members: [member("a"), member("b"), member("c"), member("d")],
	});
	const second = receipt({
		bounce: "once",
		drop: "stagger",
		from: { x: 11, y: 20 },
		members: [member("e")],
	});
	const started = reduce([
		{ kind: "register", title: "To Do" },
		{ kind: "receive", profile: JIRA_DROPZONE_FULL_MOTION_PROFILE, receipt: first },
		{ kind: "receive", profile: JIRA_DROPZONE_FULL_MOTION_PROFILE, receipt: second },
	]);
	assert.equal(started.channels.get("To Do").flights.length, 4);
	const afterFirst = landAll(started);
	assert.equal(afterFirst.channels.get("To Do").impacts, 1);
	const settled = jiraDropzoneFieldReducer(afterFirst, { kind: "settle", title: "To Do" });
	assert.equal(settled.channels.get("To Do").flights[0].members[0].id, "e");
	const afterSecond = landAll(settled);
	assert.equal(afterSecond.channels.get("To Do").impacts, 2);
});

test("queued second receipt still works for stagger drop + bounce each", () => {
	const first = receipt({
		bounce: "each",
		drop: "stagger",
		members: [member("a"), member("b"), member("c"), member("d")],
	});
	const second = receipt({
		bounce: "each",
		drop: "stagger",
		from: { x: 11, y: 20 },
		members: [member("e")],
	});
	const started = reduce([
		{ kind: "register", title: "To Do" },
		{ kind: "receive", profile: JIRA_DROPZONE_FULL_MOTION_PROFILE, receipt: first },
		{ kind: "receive", profile: JIRA_DROPZONE_FULL_MOTION_PROFILE, receipt: second },
	]);
	const afterFirst = landAll(started);
	assert.equal(afterFirst.channels.get("To Do").impacts, 4);
	const settled = jiraDropzoneFieldReducer(afterFirst, { kind: "settle", title: "To Do" });
	const afterSecond = landAll(settled);
	assert.equal(afterSecond.channels.get("To Do").impacts, 5);
});

test("matrix: bounce off lands without an impact and settles immediately", () => {
	const started = receiveFour({ bounce: "off", drop: "stagger" });
	assert.equal(started.channels.get("To Do").flights.length, 4);
	const after = landAll(started);
	assert.equal(after.channels.get("To Do").impacts, 0);
	assert.equal(after.channels.get("To Do").settling, false);
	assert.deepEqual(settlingChannelTitles(after), []);
	assert.equal(isReceiving(after.channels.get("To Do")), false);
});

test("bounce off dequeues the next receipt immediately instead of holding", () => {
	const first = receipt({
		bounce: "off",
		drop: "cohort",
		members: [member("a")],
	});
	const second = receipt({
		bounce: "off",
		drop: "cohort",
		from: { x: 11, y: 20 },
		members: [member("e")],
	});
	const started = reduce([
		{ kind: "register", title: "To Do" },
		{ kind: "receive", profile: JIRA_DROPZONE_FULL_MOTION_PROFILE, receipt: first },
		{ kind: "receive", profile: JIRA_DROPZONE_FULL_MOTION_PROFILE, receipt: second },
	]);
	const afterFirst = landAll(started);
	assert.equal(afterFirst.channels.get("To Do").settling, false);
	assert.equal(afterFirst.channels.get("To Do").flights[0].members[0].id, "e");
	assert.deepEqual(afterFirst.channels.get("To Do").queued, []);
});

test("chrome impulse is receiving-gated so idle remounts do not bounce", () => {
	assert.equal(
		shouldImpulseDropzoneChrome({ bounce: "once", impacts: 0, receiving: true }),
		false,
	);
	assert.equal(
		shouldImpulseDropzoneChrome({ bounce: "once", impacts: 1, receiving: false }),
		false,
	);
	assert.equal(
		shouldImpulseDropzoneChrome({ bounce: "once", impacts: 1, receiving: true }),
		true,
	);
	assert.equal(
		shouldImpulseDropzoneChrome({ bounce: "off", impacts: 1, receiving: true }),
		false,
	);
});

test("reduced stagger profile keeps member flights without delay or spread", () => {
	const next = receipt({
		drop: "stagger",
		members: [member("a"), member("b")],
	});
	const flights = flightsFromReceipt(next, JIRA_DROPZONE_REDUCED_MOTION_PROFILE);
	assert.equal(flights.length, 2);
	assert.deepEqual(flights.map((flight) => flight.delayMs), [0, 0]);
	assert.deepEqual(flights.map((flight) => flight.from), [next.from, next.from]);
});

test("an active session drag opens every well before proximity", () => {
	assert.equal(
		resolveJiraDropzonePhase({ drag: "active", proximate: false, receiving: false }),
		"active",
	);
	assert.equal(resolveJiraDropzoneSurface("active", false), "open");
	assert.equal(resolveJiraDropzoneCopy("active"), "label");
});

test("receiving outranks armed and proximate", () => {
	assert.equal(
		resolveJiraDropzonePhase({ drag: "armed", proximate: true, receiving: true }),
		"receiving",
	);
	assert.equal(
		resolveJiraDropzonePhase({ drag: "armed", proximate: true, receiving: false }),
		"armed",
	);
	assert.equal(
		resolveJiraDropzonePhase({ drag: "active", proximate: true, receiving: false }),
		"proximate",
	);
	assert.equal(
		resolveJiraDropzonePhase({ drag: "idle", proximate: true, receiving: false }),
		"resting",
	);
	assert.equal(
		resolveJiraDropzonePhase({ drag: "idle", proximate: false, receiving: true }),
		"receiving",
	);
});

test("resting keeps the open well while collapse is holding", () => {
	assert.equal(resolveJiraDropzoneSurface("resting", false), "resting");
	assert.equal(resolveJiraDropzoneSurface("resting", true), "open");
	assert.equal(resolveJiraDropzoneSurface("receiving", false), "open");
	assert.equal(resolveJiraDropzoneSurface("armed", true), "open");
	assert.equal(resolveJiraDropzoneSurface("active", false), "open");
});

test("an immediate-collapse consumer returns to resting while its drop receipt is still playing", () => {
	for (const proximate of [false, true]) {
		const phase = resolveJiraDropzonePhase({
			drag: "idle",
			holdOpenWhileReceiving: false,
			proximate,
			receiving: true,
		});
		assert.equal(phase, "resting");
		assert.equal(resolveJiraDropzoneSurface(phase, false), "resting");
		assert.equal(resolveJiraDropzoneCopy(phase), "none");
	}
});

test("a new drag can reopen an immediate-collapse consumer during receipt playback", () => {
	assert.equal(resolveJiraDropzonePhase({
		drag: "active",
		holdOpenWhileReceiving: false,
		proximate: false,
		receiving: true,
	}), "active");
	assert.equal(resolveJiraDropzonePhase({
		drag: "armed",
		holdOpenWhileReceiving: false,
		proximate: true,
		receiving: true,
	}), "armed");
});

test("collapse hold matches duration-normal unless motion is reduced", () => {
	assert.equal(resolveJiraDropzoneCollapseMs(false), 150);
	assert.equal(resolveJiraDropzoneCollapseMs(null), 150);
	assert.equal(resolveJiraDropzoneCollapseMs(true), 0);
});

test("expanded copy unmounts on the first resting frame", () => {
	assert.equal(resolveJiraDropzoneCopy("receiving"), "label");
	assert.equal(resolveJiraDropzoneCopy("armed"), "label");
	assert.equal(resolveJiraDropzoneCopy("proximate"), "label");
	assert.equal(resolveJiraDropzoneCopy("active"), "label");
	assert.equal(resolveJiraDropzoneCopy("resting"), "none");
});

test("flight landing is the geometric center of the well", () => {
	assert.deepEqual(
		resolveJiraDropzoneLandingPoint({
			height: 64,
			left: 100,
			top: 40,
			width: 240,
		}),
		{ x: 220, y: 72 },
	);
});
