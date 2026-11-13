const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const PAGE_SOURCE = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");

test("waveform color controls register value keys for GUI copy filtering", () => {
	const colorKeys = [
		"idleColor1",
		"idleColor2",
		"idleColor3",
		"idleColor4",
		"userColor1",
		"userColor2",
		"userColor3",
		"userColor4",
		"aiColor1",
		"aiColor2",
		"aiColor3",
		"aiColor4",
	];

	for (const key of colorKeys) {
		assert.match(
			PAGE_SOURCE,
			new RegExp(`<GUI\\.RgbaColorInput[^>]+value=\\{${key}\\}[^>]+valueKeys="${key}"`),
		);
	}
});
