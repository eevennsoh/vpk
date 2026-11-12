const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const SOURCE = fs.readFileSync(
	path.join(__dirname, "use-clicky-voice.ts"),
	"utf8",
);
const CORE_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/rovo-core/hooks/use-clicky-voice.ts"),
	"utf8",
);

test("Clicky deactivation does not disconnect the Realtime voice session", () => {
	assert.doesNotMatch(SOURCE, /disconnectRealtime/u);
	assert.match(SOURCE, /Cursor deactivation must NOT tear down/u);
	assert.match(SOURCE, /useClickyVoiceCore/u);
	assert.match(CORE_SOURCE, /connectedForClickyRef\.current/u);
});

test("Clicky must use point_at_target before claiming the cursor is pointing", () => {
	assert.match(SOURCE, /call get_screen_state, then call point_at_target/u);
	assert.match(SOURCE, /Do not claim the cursor moved/u);
	assert.match(SOURCE, /point_at_target returns ok: true/u);
	assert.match(SOURCE, /If it returns ok: false/u);
	assert.match(SOURCE, /activate_screen_target/u);
	assert.match(SOURCE, /Prefer targetId or fieldId/u);
	assert.match(SOURCE, /activeRegion/u);
	assert.match(SOURCE, /targetHints inside activeRegion/u);
	assert.match(SOURCE, /Never infer raw screen coordinates, screenshots, CUA actions, or arbitrary clicks from a painted region/u);
	assert.doesNotMatch(SOURCE, /sendImageInput|captureViewport|\[POINT/u);
});

test("Clicky replaces painted instructions through draft patching", () => {
	assert.match(SOURCE, /activeRegion\.targetHints contains the Studio agent instructions field/u);
	assert.match(SOURCE, /call apply_agent_draft_patch with patch\.instructions/u);
	assert.match(SOURCE, /Treat patch\.instructions as a complete replacement body/u);
	assert.match(SOURCE, /make this say X/u);
	assert.match(SOURCE, /replace this with X/u);
	assert.match(SOURCE, /Do not use set_composer_text for painted instructions updates/u);
});
