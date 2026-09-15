const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const INDEX_SOURCE = readFileSync(join(__dirname, "index.tsx"), "utf8");

/**
 * Well framing owns which node clips the list/footer region, and that choice
 * decides whether the plane's own 1px stroke survives the scroll fades.
 */

test("the enclosed body clip carries the well radius, so the fade cannot wash the bottom corners", () => {
	// Enclosed keeps overflow-hidden off the well so header focus rings are not
	// sliced, which leaves the clip a rectangle inset 1px inside the stroke.
	// radius.xlarge curves inward from that rectangle's bottom corners, putting
	// the arc and the tail of each side stroke inside the opaque end of the
	// bottom scroll fade. Matching the well's bottom radius keeps the fade off
	// the arc, so both corners close instead of reading as a detached hairline.
	assert.match(INDEX_SOURCE, /const AGENT_SESSION_ENCLOSED_BODY =/u);
	assert.match(
		INDEX_SOURCE,
		/const AGENT_SESSION_ENCLOSED_BODY =\s*\n?\s*"[^"]*overflow-hidden[^"]*rounded-b-xl/u,
	);
	assert.match(
		INDEX_SOURCE,
		/className=\{cn\(\s*\n\s*AGENT_SESSION_ENCLOSED_BODY,\s*\n\s*bodyHidden \? "invisible" : null,\s*\n\s*\)\}[\s\S]{0,80}\{body\}/u,
	);
	// The old rectangular clip must not come back alongside the rounded one.
	assert.doesNotMatch(
		INDEX_SOURCE,
		/className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"/u,
	);
});

test("caption framing still clips at the well itself, so it needs no body radius", () => {
	// Caption puts overflow-hidden on the painted well, so the plane's own
	// rounded clip already keeps every fade inside the stroke. Enclosed is the
	// only frame that hands the clip to a descendant.
	assert.match(
		INDEX_SOURCE,
		/const AGENT_SESSION_WELL = cn\(\s*AGENT_SESSION_PLANE,\s*"overflow-hidden rounded-xl border border-solid border-transparent",/u,
	);
	assert.match(
		INDEX_SOURCE,
		/const AGENT_SESSION_WELL_PAINT = cn\(\s*AGENT_SESSION_PLANE,\s*"rounded-xl border border-solid border-transparent",/u,
	);
	assert.match(INDEX_SOURCE, /case "caption":\s*\n\s*return collapsed \? AGENT_SESSION_PLANE : AGENT_SESSION_WELL;/u);
	assert.match(INDEX_SOURCE, /case "enclosed":\s*\n\s*return isGutterCollapsed \? AGENT_SESSION_PLANE : AGENT_SESSION_WELL_PAINT;/u);
});
