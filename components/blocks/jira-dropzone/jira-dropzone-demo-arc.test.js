const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
	JIRA_DROPZONE_FULL_MOTION_PROFILE,
	JIRA_DROPZONE_DURATION_TOKEN_MS,
} = require("./lib/jira-dropzone-motion.ts");
const {
	JIRA_DROPZONE_DEMO_ARC_DEFAULTS,
	JIRA_DROPZONE_DEMO_TRAVEL_DEFAULT,
	toFlightProfileOverride,
} = require("./lib/jira-dropzone-demo-arc.ts");

test("the catalog defaults to the direct Team EU26 drop", () => {
	assert.equal(JIRA_DROPZONE_DEMO_TRAVEL_DEFAULT, "linear");
	assert.deepEqual(
		toFlightProfileOverride(JIRA_DROPZONE_DEMO_ARC_DEFAULTS, {
			bounce: true,
			travel: "linear",
		}),
		{
			durationMs: JIRA_DROPZONE_FULL_MOTION_PROFILE.durationMs,
			travel: "linear",
		},
	);
});

test("arc is an opt-in override that keeps bounce unless it is turned off", () => {
	assert.deepEqual(
		toFlightProfileOverride(JIRA_DROPZONE_DEMO_ARC_DEFAULTS, {
			bounce: true,
			travel: "arc",
		}),
		{
			arcDirection: JIRA_DROPZONE_DEMO_ARC_DEFAULTS.direction,
			arcPeak: JIRA_DROPZONE_DEMO_ARC_DEFAULTS.peak,
			arcRotate: JIRA_DROPZONE_DEMO_ARC_DEFAULTS.rotate,
			arcStrength: JIRA_DROPZONE_DEMO_ARC_DEFAULTS.strength,
			durationMs: JIRA_DROPZONE_DURATION_TOKEN_MS["duration-slower"],
			travel: "arc",
		},
	);
	assert.deepEqual(
		toFlightProfileOverride(JIRA_DROPZONE_DEMO_ARC_DEFAULTS, {
			bounce: false,
			travel: "linear",
		}),
		{
			durationMs: JIRA_DROPZONE_FULL_MOTION_PROFILE.durationMs,
			impact: null,
			travel: "linear",
		},
	);
});
