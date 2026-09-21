const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

const {
	agentDragIdentityLabel,
	agentIdentityLabel,
	agentSessionIdentityLabel,
} = require("./agent-session-identity-label.ts");

/** Rendered once and shared: the chip bundle pulls the whole avatar stack in. */
let harnessPromise;

function loadDragChipHarness() {
	harnessPromise ??= (async () => {
		const result = await esbuild.build({
			stdin: {
				contents: `
					import React from "react";
					import { renderToStaticMarkup } from "react-dom/server";
					import {
						AgentSessionDragChip,
						AgentSessionDragPill,
					} from "./components/blocks/agent-session/agent-session-drag-chip.tsx";
					import { AgentSessionCohortChip } from "./components/blocks/agent-session/agent-session-cohort-chip.tsx";

					export function renderChip(props) {
						return renderToStaticMarkup(React.createElement(AgentSessionDragChip, props));
					}

					export function renderCohortChip(props) {
						return renderToStaticMarkup(React.createElement(AgentSessionCohortChip, props));
					}

					export function renderPill(props) {
						return renderToStaticMarkup(React.createElement(AgentSessionDragPill, props));
					}
				`,
				loader: "tsx",
				resolveDir: process.cwd(),
				sourcefile: "agent-session-drag-chip-harness.tsx",
			},
			bundle: true,
			format: "cjs",
			loader: {
				".css": "empty",
			},
			platform: "node",
			tsconfig: path.join(process.cwd(), "tsconfig.json"),
			write: false,
		});

		return loadCjsModuleFromText(result.outputFiles[0].text);
	})();

	return harnessPromise;
}

function session(id, invoker) {
	return {
		agent: { brandName: "claude", id: "claude", kind: "agent", name: "Claude" },
		host: "local",
		id,
		invokedBy: invoker,
		sessionDetails: { host: "local", issueSummary: `${id} work` },
		state: "complete",
		title: `${id} title`,
	};
}

const ANNIE = { name: "Annie Chen" };

function cohort(...members) {
	return { key: members.map((member) => member.id).join("|"), members };
}

/** Every opening tag in the markup, so an attribute can be pinned to one node. */
function openTag(markup, attribute) {
	return markup.match(new RegExp(`<[a-z]+[^>]*\\b${attribute}\\b[^>]*>`, "u"))?.[0];
}

function countMatches(markup, needle) {
	return markup.match(new RegExp(needle, "gu"))?.length ?? 0;
}

test("the label names the agent and the human who invoked it", () => {
	assert.equal(
		agentIdentityLabel({ name: "Claude" }, { name: "Annie Chen" }),
		"Claude with Annie Chen",
	);
	assert.equal(agentIdentityLabel({ name: "Claude" }), "Claude");
	assert.equal(agentIdentityLabel({ name: "Claude" }, undefined), "Claude");
	assert.equal(agentSessionIdentityLabel(session("lw-a", ANNIE)), "Claude with Annie Chen");
	assert.equal(agentSessionIdentityLabel(session("lw-a")), "Claude");
});

test("the visible drag label is the person name with an agent-only fallback", () => {
	assert.equal(agentDragIdentityLabel({ name: "Claude" }, ANNIE), "Annie Chen");
	assert.equal(agentDragIdentityLabel({ name: "Claude" }), "Claude");
});

test("a single session is one pill carrying the agent, its invoker, and the label", async () => {
	const harness = await loadDragChipHarness();
	const markup = harness.renderChip({ cohort: cohort(session("lw-a", ANNIE)), elevated: true });

	assert.equal(countMatches(markup, "data-session-drag-pill"), 1);
	// Static/reduced-motion copies show the agent-first horizontal destination.
	assert.match(markup, /aria-label="Claude, used by Annie Chen"/u);
	assert.match(markup, /data-slot="avatar-group"/u);
	assert.match(markup, />Annie Chen</u);
	assert.doesNotMatch(markup, />Claude with Annie Chen</u);
	// One session is one pill: no deck, no count badge, no cohort wrapper.
	assert.doesNotMatch(markup, /data-session-deck-layer/u);
	assert.doesNotMatch(markup, /data-slot="badge"/u);
	assert.doesNotMatch(markup, /data-session-cohort-chip/u);
});

test("untracked and tracked chips share the equal-size agent-first group", async () => {
	const harness = await loadDragChipHarness();
	const untracked = harness.renderChip({ cohort: cohort(session("lw-a", ANNIE)) });
	const tracked = harness.renderPill({
		agent: { brandName: "claude", name: "Claude" },
		attributedBy: ANNIE,
	});

	assert.ok(
		untracked.indexOf('data-shape="hexagon"') < untracked.indexOf('data-shape="circle"'),
		"untracked drag groups lead with the agent",
	);
	assert.ok(
		tracked.indexOf('data-shape="hexagon"') < tracked.indexOf('data-shape="circle"'),
		"tracked drag groups lead with the agent",
	);
	for (const markup of [untracked, tracked]) {
		assert.equal(countMatches(markup, 'data-size="xs"'), 2);
		assert.doesNotMatch(markup, /data-size="sm"/u);
	}
});

test("an elevated pill paints the overlay surface; a resting one stays flat", async () => {
	const harness = await loadDragChipHarness();
	const elevated = harness.renderChip({ cohort: cohort(session("lw-a", ANNIE)), elevated: true });
	const resting = harness.renderChip({ cohort: cohort(session("lw-a", ANNIE)) });

	// The fill is the semantic class, per `.agents/rules/token-priority.md`;
	// only the shadow has no Tailwind mapping and stays inline.
	assert.match(elevated, /bg-surface/u);
	assert.match(elevated, /box-shadow:/u);
	assert.doesNotMatch(elevated, /background-color:/u);
	assert.doesNotMatch(elevated, /bg-bg-neutral/u);

	// jira-dropzone's in-flow chip is not travelling, so it must not sprout an
	// overlay shadow on the page.
	assert.match(resting, /bg-bg-neutral/u);
	assert.doesNotMatch(resting, /box-shadow:/u);
});

test("a session with no invoker degrades to the agent mark and its name alone", async () => {
	const harness = await loadDragChipHarness();
	const markup = harness.renderChip({ cohort: cohort(session("lw-a")), elevated: true });

	assert.equal(countMatches(markup, "data-session-drag-pill"), 1);
	assert.match(markup, />Claude</u);
	assert.doesNotMatch(markup, /used by/u);
	assert.doesNotMatch(markup, / with /u);
	// The bare hexagon, not the attribution frame.
	assert.match(markup, /aria-label="Claude"/u);
	assert.doesNotMatch(markup, /data-shape="circle"/u);
});

test("the pill can be drawn from a raw agent, as the Jira chin row does", async () => {
	const harness = await loadDragChipHarness();
	const markup = harness.renderPill({
		agent: { brandName: "claude", name: "Claude" },
		attributedBy: ANNIE,
		elevated: true,
		isFusionSource: true,
	});

	assert.equal(countMatches(markup, "data-session-drag-pill"), 1);
	assert.equal(countMatches(markup, "data-session-fusion-chip"), 1);
	assert.match(markup, />Annie Chen</u);
});

test("a pill is only a fusion source when the caller says so", async () => {
	const harness = await loadDragChipHarness();
	const markup = harness.renderPill({ agent: { name: "Claude" }, attributedBy: ANNIE });

	assert.doesNotMatch(markup, /data-session-fusion-chip/u);
});

test("five marked sessions stack three sheets behind a badge carrying the total", async () => {
	const harness = await loadDragChipHarness();
	const markup = harness.renderChip({
		cohort: cohort(
			session("lw-a", ANNIE),
			session("lw-b", ANNIE),
			session("lw-c", ANNIE),
			session("lw-d", ANNIE),
			session("lw-e", ANNIE),
		),
		elevated: true,
	});

	// One lead pill plus two blank receding deck layers: a second pill's content
	// would be entirely occluded by the lead, so the layers are artwork.
	assert.equal(countMatches(markup, "data-session-drag-pill"), 1);
	assert.equal(countMatches(markup, "data-session-deck-layer"), 2);
	assert.match(markup, /data-session-deck-layer="1"/u);
	assert.match(markup, /data-session-deck-layer="2"/u);
	assert.doesNotMatch(markup, /data-session-deck-layer="3"/u);

	// Overlay elevation is the sheet edge. A border on the same surface
	// doubles it into a thick outline, so the layers stay borderless.
	assert.doesNotMatch(openTag(markup, "data-session-deck-layer"), /border/u);
	assert.match(openTag(markup, "data-session-deck-layer"), /box-shadow:/u);

	// The badge counts every dragged session, not the three that are drawn.
	assert.match(markup, /data-slot="badge"[^>]*>5<\/span>/u);

	// Only the lead pill draws a label; the layers are inert artwork.
	assert.equal(countMatches(markup, ">Annie Chen<"), 1);
	assert.equal(countMatches(markup, "aria-label=\"Claude, used by Annie Chen\""), 1);
});

test("two sessions stack a single layer behind the lead", async () => {
	const harness = await loadDragChipHarness();
	const markup = harness.renderChip({
		cohort: cohort(session("lw-a", ANNIE), session("lw-b", ANNIE)),
		elevated: true,
	});

	assert.equal(countMatches(markup, "data-session-deck-layer"), 1);
	assert.match(markup, /data-slot="badge"[^>]*>2<\/span>/u);
});

test("a resting stack keeps a border because it has no overlay shadow", async () => {
	const harness = await loadDragChipHarness();
	const markup = harness.renderChip({
		cohort: cohort(session("lw-a", ANNIE), session("lw-b", ANNIE), session("lw-c", ANNIE)),
	});

	const sheet = openTag(markup, "data-session-deck-layer");
	assert.match(sheet, /border border-border/u);
	assert.match(sheet, /bg-bg-neutral/u);
	assert.doesNotMatch(sheet, /box-shadow:/u);
	assert.doesNotMatch(sheet, /bg-surface/u);
});

test("deck sheets paint a solid fill instead of fading into the page", async () => {
	const harness = await loadDragChipHarness();
	const markup = harness.renderChip({
		cohort: cohort(session("lw-a", ANNIE), session("lw-b", ANNIE), session("lw-c", ANNIE)),
		elevated: true,
	});

	// A translucent sheet lets the page show through, which reads as a smudge
	// under the stack rather than as a card behind a card. Depth is the offset
	// and the overlay shadow — never opacity, never a border.
	for (const sheet of markup.match(/<span[^>]*data-session-deck-layer="\d+"[^>]*>/gu) ?? []) {
		assert.doesNotMatch(sheet, /opacity/u, `sheet is fully opaque: ${sheet}`);
		assert.doesNotMatch(sheet, /border/u, `sheet has no extra border: ${sheet}`);
		assert.match(sheet, /box-shadow:/u, `sheet uses overlay elevation: ${sheet}`);
	}

	// Sheets carry the lead pill's own fill, so the stack is one material.
	const leadFill = /bg-surface/u.test(openTag(markup, "data-session-drag-surface"));
	assert.ok(leadFill, "elevated lead pill paints bg-surface");
	assert.match(openTag(markup, "data-session-deck-layer"), /bg-surface/u);
});

test("the count badge is the shared VPK Badge, not a reshaped copy", async () => {
	const harness = await loadDragChipHarness();
	const markup = harness.renderChip({
		cohort: cohort(session("lw-a", ANNIE), session("lw-b", ANNIE), session("lw-c", ANNIE)),
		elevated: true,
	});

	const badge = markup.match(/<span[^>]*data-slot="badge"[^>]*>/u)?.[0];
	assert.ok(badge !== undefined, "the deck renders the shared Badge");

	// Badge owns its own height, min-width, radius, and fill. Overriding those
	// here is what made the count stop looking like every other VPK badge, so
	// only placement classes are allowed on it.
	assert.match(badge, /h-4/u);
	assert.match(badge, /min-w-6/u);
	assert.match(badge, /rounded-xs/u);
	assert.doesNotMatch(badge, /rounded-full/u);
});

test("deck sheets fan irregularly instead of stepping down one diagonal", async () => {
	const harness = await loadDragChipHarness();
	const markup = harness.renderChip({
		cohort: cohort(session("lw-a", ANNIE), session("lw-b", ANNIE), session("lw-c", ANNIE)),
		elevated: true,
	});

	const transforms = [...markup.matchAll(/data-session-deck-layer="\d+"[^>]*?transform:([^;"]+)/gu)]
		.map((match) => match[1].trim());
	assert.equal(transforms.length, 2, "both sheets carry a transform");
	// Every sheet is rotated, and no two share an angle. Equal steps along one
	// diagonal read as a machine-cut drop shadow; the deck is meant to read as a
	// handful of cards picked up at once.
	const angles = transforms.map((value) => {
		const rotate = /rotate\((-?[\d.]+)deg\)/u.exec(value);
		assert.ok(rotate, `sheet is rotated: ${value}`);
		return Number(rotate[1]);
	});
	assert.notEqual(angles[0], angles[1], "sheets do not share a rotation");
	assert.ok(
		angles.some((angle) => angle > 0) && angles.some((angle) => angle < 0),
		`sheets fan to both sides, got ${angles.join(", ")}`,
	);

	// Both sheets sit below the lead so neither corner climbs into the count
	// badge pinned at the top right.
	const offsets = transforms.map((value) => {
		const translate = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/u.exec(value);
		assert.ok(translate, `sheet is offset: ${value}`);
		return { x: Number(translate[1]), y: Number(translate[2]) };
	});
	assert.ok(offsets.every((offset) => offset.y > 0), "sheets fan downward");
	assert.notEqual(
		Math.sign(offsets[0].x),
		Math.sign(offsets[1].x),
		"sheets lean to opposite sides rather than stacking down one diagonal",
	);
});

test("the fusion overlay measures the lead pill, never the deck wrapper", async () => {
	const harness = await loadDragChipHarness();
	const markup = harness.renderChip({
		cohort: cohort(session("lw-a", ANNIE), session("lw-b", ANNIE), session("lw-c", ANNIE)),
		elevated: true,
		isFusionSource: true,
	});

	// The Jira fusion overlay getBoundingClientRect()s this node every frame; on
	// the wrapper the stack offsets would inflate the goo's source rect.
	assert.equal(countMatches(markup, "data-session-fusion-chip"), 1);

	const wrapper = openTag(markup, "data-session-cohort-chip");
	assert.ok(wrapper !== undefined);
	assert.doesNotMatch(wrapper, /data-session-fusion-chip/u);

	const pill = openTag(markup, "data-session-drag-pill");
	assert.ok(pill !== undefined);
	assert.match(pill, /data-session-fusion-chip/u);
});

test("a resting chip is not a fusion source unless a drag overlay says so", async () => {
	const harness = await loadDragChipHarness();
	const members = cohort(session("lw-a", ANNIE), session("lw-b", ANNIE));

	// `jira-dropzone-demo-chip` renders this chip in normal page flow inside a
	// real button. If it answered `[data-session-fusion-chip]` there, an
	// unscoped query would find the resting handle before the travelling chip.
	for (const markup of [
		harness.renderChip({ cohort: members }),
		harness.renderChip({ cohort: cohort(session("lw-a", ANNIE)) }),
		harness.renderCohortChip({ cohort: members }),
		harness.renderCohortChip({ cohort: cohort(session("lw-a", ANNIE)), elevated: true }),
	]) {
		assert.doesNotMatch(markup, /data-session-fusion-chip/u);
	}

	// The overlay hosts opt in through the cohort entry point too.
	assert.equal(
		countMatches(
			harness.renderCohortChip({ cohort: members, elevated: true, isFusionSource: true }),
			"data-session-fusion-chip",
		),
		1,
	);
});

test("the cohort keeps its count sentence readable and addressable", async () => {
	const harness = await loadDragChipHarness();
	const members = cohort(session("lw-a", ANNIE), session("lw-b", ANNIE));

	// The sentence lives in the drag chip alone, so the cohort entry point and a
	// direct caller cannot drift apart.
	const delegated = harness.renderCohortChip({ cohort: members, elevated: true });
	const direct = harness.renderChip({ cohort: members, elevated: true });
	assert.equal(delegated, direct);

	for (const markup of [delegated, direct]) {
		// Pinned by tests/projects/jira-*-untracked-board.spec.ts, which read the
		// overlay's text content and locate the labelled cohort wrapper.
		assert.match(markup, /<span class="sr-only">2 sessions<\/span>/u);
		const wrapper = openTag(markup, "data-session-cohort-chip");
		assert.match(wrapper, /aria-label="2 sessions"/u);
		// A label is only legal on a node with a role; without one AT drops it and
		// the `sr-only` sentence would be the only voice.
		assert.match(wrapper, /role="img"/u);
	}

	// A single member is one self-labelling pill: no cohort sentence at all.
	assert.doesNotMatch(
		harness.renderCohortChip({ cohort: cohort(session("lw-a", ANNIE)), elevated: true }),
		/1 sessions/u,
	);
});
