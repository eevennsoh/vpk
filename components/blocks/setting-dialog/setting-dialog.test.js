const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const BLOCK_SETTING_DIALOG_SOURCE = readFileSync(
	join(__dirname, "components", "setting-dialog.tsx"),
	"utf8",
);
const SIDEBAR_13_SETTINGS_DIALOG_SOURCE = readFileSync(
	join(__dirname, "..", "sidebar", "sidebar-13", "components", "settings-dialog.tsx"),
	"utf8",
);

test("settings dialog sidebar links keep item-specific accessible names", () => {
	for (const source of [BLOCK_SETTING_DIALOG_SOURCE, SIDEBAR_13_SETTINGS_DIALOG_SOURCE]) {
		assert.match(source, /render=\{<a aria-label=\{item\.name\} href="#" \/>\}/u);
		assert.doesNotMatch(source, /aria-label="Settings" href="#"/u);
	}
});
