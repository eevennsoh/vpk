const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const INDEX_SOURCE = [
	readFileSync(join(__dirname, "index.tsx"), "utf8"),
	readFileSync(join(__dirname, "agent-session-column-surface.tsx"), "utf8"),
	readFileSync(join(__dirname, "agent-session-column-underlap.ts"), "utf8"),
].join("\n");
const RAIL_COLUMN_SOURCE = readFileSync(join(__dirname, "agent-session-column-rail.tsx"), "utf8");
const TYPES_SOURCE = readFileSync(join(__dirname, "agent-session-column-types.ts"), "utf8");
const NOTCH_MARK_SOURCE = readFileSync(
	join(__dirname, "../agent-session/agent-session-notch.tsx"),
	"utf8",
);
const NOTCH_MAGNIFY_SOURCE = readFileSync(
	join(__dirname, "../agent-session/agent-session-notch-magnify.ts"),
	"utf8",
);
const IN_FLOW_COLUMN_SOURCE = readFileSync(
	join(__dirname, "../jira-kanban/experimental/components/in-flow-agent-session-column.tsx"),
	"utf8",
);

test("the enclosed well keeps collapsed hit slop wide at rest and contained during underlap", () => {
	// Rest: the 16px in-flow band makes the expand control easy to hit beside
	// the 32px rail, even if that rect sits outside the painted well.
	// Underlap: the well is the elevated container, so the band must shrink
	// or the trigger hangs off the column.
	assert.match(INDEX_SOURCE, /const elevatePlane = showTrailingShadow && !isGutterCollapsed/u);
	assert.match(INDEX_SOURCE, /const collapsedHitSlopPx = wearEnclosedWell && elevatePlane \? 0 : collapsedRailHitSlopPx/u);
	assert.match(INDEX_SOURCE, /toAgentSessionRailHitSlopStyle\(collapsedHitSlopPx\)/u);
	assert.match(INDEX_SOURCE, /hitSlopPx=\{collapsedHitSlopPx\}/u);
	assert.doesNotMatch(
		INDEX_SOURCE,
		/const collapsedHitSlopPx = wearEnclosedWell \? 0 : collapsedRailHitSlopPx/u,
	);
	assert.doesNotMatch(
		INDEX_SOURCE,
		/toAgentSessionRailHitSlopStyle\(collapsedRailHitSlopPx\)/u,
	);
});

test("collapsed motion is tokenised and honours reduced motion", () => {
	// Standalone/panel resize keeps the tokenized width recipe; hover keeps the
	// rail compact while its flex footprint rejoins the board rhythm.
	assert.match(INDEX_SOURCE, /width var\(--duration-medium\) var\(--ease-in-out\)/u);
	assert.match(IN_FLOW_COLUMN_SOURCE, /width var\(--duration-normal\) var\(--ease-out-practical\)/u);
	assert.match(RAIL_COLUMN_SOURCE, /duration-normal ease-out-practical/u);
	assert.match(RAIL_COLUMN_SOURCE, /motion-reduce:transition-none/u);
	// The dock's fade in and out are tokenised as resolved cubic-beziers, because
	// Motion cannot read `var()`: duration-normal + ease-out-practical arriving,
	// and the shorter duration-fast + ease-in leaving, as every exit is.
	assert.match(NOTCH_MAGNIFY_SOURCE, /AGENT_SESSION_NOTCH_MAGNIFY_IN = \{\s*duration: 0\.15,\s*ease: \[0\.4, 1, 0\.6, 1\]/u);
	assert.match(NOTCH_MAGNIFY_SOURCE, /AGENT_SESSION_NOTCH_MAGNIFY_OUT = \{\s*duration: 0\.1,\s*ease: \[0\.6, 0, 0\.8, 0\.6\]/u);
	// A slope that tracks the cursor is ambient motion, so reduced motion drops
	// the dock outright rather than shortening it — the marks then fall back to
	// their own row's hover, which resolves instantly.
	assert.match(RAIL_COLUMN_SOURCE, /const isDocked = shouldReduceMotion !== true;/u);
	assert.match(RAIL_COLUMN_SOURCE, /proximity=\{isDocked \? \{/u);
	// A mark with no rail behind it keeps the transform hover it has always had.
	// The group is the row and the button inside it takes focus, so keyboard
	// parity needs `group-has-[:focus-visible]` — `group-focus-visible` never
	// matches.
	assert.match(NOTCH_MARK_SOURCE, /group-hover\/notch:scale-x-\[1\.6\]/u);
	assert.match(NOTCH_MARK_SOURCE, /group-has-\[:focus-visible\]\/notch:scale-x-\[1\.6\]/u);
	assert.doesNotMatch(NOTCH_MARK_SOURCE, /group-focus-visible\/notch:/u);
	// Clipping is scoped to the resize, so a focused card's ring is never cut.
	assert.match(
		INDEX_SOURCE,
		/!elevatePlane && \(\(collapsed && collapsedRailHitSlopPx === 0\) \|\| isResizing\)\s*\n\s*\? "overflow-hidden"\s*\n\s*: null/u,
	);
	assert.match(INDEX_SOURCE, /event\.propertyName === "width"/u);
	// A host-driven pointer resize must bypass this transition so the column edge
	// tracks the pointer instead of easing toward every intermediate width.
	assert.match(TYPES_SOURCE, /widthTransitionDisabled\?: boolean;/u);
	assert.match(INDEX_SOURCE, /expandedWidthPx = AGENT_SESSION_COLUMN_WIDTH_PX,/u);
	assert.match(INDEX_SOURCE, /widthTransitionDisabled = false,/u);
	assert.match(
		INDEX_SOURCE,
		/shouldReduceMotion \|\| widthTransitionDisabled\s*\? "none"\s*: AGENT_SESSION_COLUMN_TRANSITION/u,
	);
	assert.match(INDEX_SOURCE, /from "motion\/react"/u);
	assert.match(INDEX_SOURCE, /animate=\{\{\s*boxShadow,\s*marginBottom: marginBlock,\s*marginTop: marginBlock,\s*\}\}/u);
	assert.match(INDEX_SOURCE, /style=\{\{ borderColor \}\}/u);
	assert.match(INDEX_SOURCE, /AGENT_SESSION_WELL_STROKE = token\("color\.border\.disabled"\)/u);
	assert.match(INDEX_SOURCE, /paintWellStroke = wearEnclosedWell && !collapsed && !elevatePlane/u);
	assert.match(INDEX_SOURCE, /paintWellStroke \? AGENT_SESSION_WELL_STROKE : "transparent"/u);
	assert.match(INDEX_SOURCE, /paintWellStroke \? "border-border-disabled" : "border-transparent"/u);
	assert.doesNotMatch(INDEX_SOURCE, /const planeBorderColor = "transparent"/u);
	assert.doesNotMatch(INDEX_SOURCE, /elevatePlane \? AGENT_SESSION_WELL_STROKE/u);
	assert.doesNotMatch(INDEX_SOURCE, /animate=\{\{\s*borderColor/u);
	assert.match(INDEX_SOURCE, /AGENT_SESSION_UNDERLAP_SHADOW_ENTER: Transition = \{\s*\n\s*duration: 0\.15,/u);
	assert.match(INDEX_SOURCE, /AGENT_SESSION_UNDERLAP_SHADOW_EXIT: Transition = \{\s*\n\s*duration: 0\.1,/u);
	assert.match(INDEX_SOURCE, /shouldReduceMotion\s*\n\s*\? AGENT_SESSION_UNDERLAP_SHADOW_REDUCED/u);
	assert.match(INDEX_SOURCE, /AGENT_SESSION_UNDERLAP_GROW_PX = 8/u);
	assert.match(
		INDEX_SOURCE,
		/elevatePlane && wearEnclosedWell\s*\n\s*\? -AGENT_SESSION_UNDERLAP_GROW_PX\s*\n\s*: 0/u,
	);
});
