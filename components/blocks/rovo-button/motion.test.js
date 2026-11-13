const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const MOTION_SOURCE = fs.readFileSync(path.join(__dirname, "motion.ts"), "utf8");
const SURFACE_SOURCE = fs.readFileSync(path.join(__dirname, "surface.tsx"), "utf8");
const DAILY_INSIGHTS_PANEL_SOURCE = fs.readFileSync(path.join(__dirname, "daily-insights-panel.tsx"), "utf8");

test("floating Rovo button content exit uses the shared fast practical-exit token", () => {
	assert.match(
		MOTION_SOURCE,
		/export const FLOATING_ROVO_BUTTON_CONTENT_EXIT = \{\s*duration: 0\.1,\s*ease: motionEase\.in,\s*\} as const;/u,
	);
	assert.match(SURFACE_SOURCE, /transition: FLOATING_ROVO_BUTTON_CONTENT_EXIT/u);
	assert.match(DAILY_INSIGHTS_PANEL_SOURCE, /transition: FLOATING_ROVO_BUTTON_CONTENT_EXIT/u);
});
