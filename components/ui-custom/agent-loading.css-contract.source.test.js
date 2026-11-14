// Stylesheet contract for AgentLoading: happy-dom applies no CSS, so the rendered behaviour suite
// can prove `data-size="small"` is set but not that the stylesheet scales the visual for it. A
// browser check of the rendered small visual's size (16px) would replace this file.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const AGENT_LOADING_CSS_SOURCE = fs.readFileSync(path.join(process.cwd(), "app/tailwind-theme-agent-loading.css"), "utf8");

test("the small agent-loading visual scales its 24px canvas down to 16px", () => {
	assert.match(
		AGENT_LOADING_CSS_SOURCE,
		/&\s*\[data-size="small"\]\s+\[data-agent-loading-canvas\]\s*\{[^}]*transform:\s*scale\(\s*calc\(\s*4\s*\/\s*6\s*\)\s*\)/u,
	);
});
