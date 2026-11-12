const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");

const { loadCjsModuleFromText } = require(
	path.join(process.cwd(), "scripts", "lib", "esbuild-cjs-loader.js"),
);

// The trigger catalog is a pure-TS data/logic module (icon types only); bundle it
// to CJS so the inference helpers can be exercised at runtime under `node --test`.
let modulePromise;
function loadCatalog() {
	modulePromise ??= esbuild
		.build({
			entryPoints: [path.join(process.cwd(), "components/blocks/trigger/data/trigger-catalog.ts")],
			bundle: true,
			format: "cjs",
			platform: "node",
			tsconfig: path.join(process.cwd(), "tsconfig.json"),
			loader: { ".css": "empty" },
			write: false,
		})
		.then((result) => loadCjsModuleFromText(result.outputFiles[0].text));
	return modulePromise;
}

test("daily-at-7am scheduled event exists in the catalog", async () => {
	const { getTriggerEvent } = await loadCatalog();
	const event = getTriggerEvent("scheduled", "daily-at-7am");
	assert.ok(event, "daily-at-7am event should exist on the scheduled provider");
	assert.match(event.label, /7:00\s*AM/i);
});

test("inferScheduledEventId maps natural-language schedules", async () => {
	const { inferScheduledEventId } = await loadCatalog();
	assert.equal(inferScheduledEventId("Every day at 7:00 AM"), "daily-at-7am");
	assert.equal(inferScheduledEventId("each morning at 7am give me a readout"), "daily-at-7am");
	assert.equal(inferScheduledEventId("Run hourly"), "every-hour");
	assert.equal(inferScheduledEventId("every weekday morning"), "every-weekday-morning");
	assert.equal(inferScheduledEventId("when a Jira issue is created"), undefined);
});

test("inferScheduledTriggerDefinitions builds a structured 7am definition", async () => {
	const { inferScheduledTriggerDefinitions } = await loadCatalog();

	const defs = inferScheduledTriggerDefinitions(["Every morning at 7am, send the readout"]);
	assert.ok(Array.isArray(defs) && defs.length === 1, "should infer one definition");
	assert.equal(defs[0].providerId, "scheduled");
	assert.equal(defs[0].eventId, "daily-at-7am");

	// A mixed list (some non-schedule) bails out to keep label alignment.
	assert.equal(
		inferScheduledTriggerDefinitions(["Every day at 7am", "when a PR is opened"]),
		undefined,
	);
	assert.equal(inferScheduledTriggerDefinitions([]), undefined);
});

test("inferTriggerDefinitions maps each trigger to its provider (per-trigger)", async () => {
	const { inferTriggerDefinitions } = await loadCatalog();

	const defs = inferTriggerDefinitions([
		"A new DACI doc is shared in Confluence",
		"A Jira issue is marked blocked",
		"An alert pages on-call in PagerDuty",
		"A message in #launch (Slack)",
		"An error spikes in Sentry",
		"A release is cut in GitHub",
		"The weekly recap is due (scheduled)",
	]);
	assert.ok(Array.isArray(defs) && defs.length === 7, "every trigger should resolve");
	assert.deepEqual(
		defs.map((d) => d.providerId),
		["confluence", "jira", "pagerduty", "slack", "sentry", "github-gitlab", "scheduled"],
	);
	// Event selection reflects phrasing cues.
	assert.equal(defs[1].eventId, "status-changed"); // "marked blocked"
	assert.equal(defs[2].eventId, "incident-triggered");
	assert.equal(defs[5].eventId, "push-to-branch"); // "release is cut"
});

test("inferTriggerDefinitions stays index-aligned 1:1 with input", async () => {
	const { inferTriggerDefinitions } = await loadCatalog();
	const input = ["A Jira issue is created", "A page is updated in Confluence"];
	const defs = inferTriggerDefinitions(input);
	assert.equal(defs.length, input.length);
});

test("inferTriggerDefinitions always resolves a non-empty input (universal fallback)", async () => {
	const { inferTriggerDefinitions } = await loadCatalog();
	// No provider keyword and no schedule cue -> universal webhook fallback, so the
	// trigger still gets a structured, editable definition (never an empty rule builder).
	const defs = inferTriggerDefinitions(["a recording finishes processing"]);
	assert.ok(Array.isArray(defs) && defs.length === 1);
	assert.equal(defs[0].providerId, "webhook");
	assert.ok(defs[0].eventId, "fallback definition carries an eventId");
	// Empty input still returns undefined (nothing to infer).
	assert.equal(inferTriggerDefinitions([]), undefined);
});

test("connection helpers are session-scoped per provider", async () => {
	const { isSessionProviderConnected, markSessionProviderConnected, createAgentTriggerValue } = await loadCatalog();
	assert.equal(isSessionProviderConnected("slack"), false);
	// A fresh slack trigger needs connection until the provider is connected.
	const before = createAgentTriggerValue("slack", "new-message", 1);
	assert.equal(before.connectionState, "needs-connection");
	markSessionProviderConnected("slack");
	assert.equal(isSessionProviderConnected("slack"), true);
	// New triggers for an already-connected provider seed as connected.
	const after = createAgentTriggerValue("slack", "mention", 2);
	assert.equal(after.connectionState, "connected");
});
