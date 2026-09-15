const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(
	path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"),
);

const ROOT = path.join(__dirname, "..", "..", "..");
const CARD_GLOW_SOURCE = fs.readFileSync(path.join(__dirname, "card-glow.tsx"), "utf8");
const POINTER_SOURCE = fs.readFileSync(path.join(__dirname, "card-glow-pointer.ts"), "utf8");
const SESSION_CARD_SOURCE = fs.readFileSync(
	path.join(ROOT, "components/blocks/agent-session/agent-session-card.tsx"),
	"utf8",
);
const SESSION_INDEX_SOURCE = fs.readFileSync(
	path.join(ROOT, "components/blocks/agent-session/index.tsx"),
	"utf8",
);
const SESSION_COLUMN_SOURCE = fs.readFileSync(
	path.join(ROOT, "components/blocks/agent-session-column/index.tsx"),
	"utf8",
);
const FUSION_STATE_SOURCE = fs.readFileSync(
	path.join(ROOT, "components/blocks/jira-kanban/experimental/lib/session-fusion-overlay-state.ts"),
	"utf8",
);
const MIGRATED_CONSUMERS = [
	"components/blocks/agent-bento/components/home-starter-bento.tsx",
	"components/blocks/agent-bento/components/agent-compact-operations-bento.tsx",
	"components/projects/studio/components/rovo-app-home-starter-bento.tsx",
];

async function loadCardGlow() {
	const result = await esbuild.build({
		entryPoints: [path.join(__dirname, "card-glow.tsx")],
		bundle: true,
		format: "cjs",
		platform: "node",
		write: false,
		external: ["react", "react/jsx-runtime"],
		alias: { "@": ROOT },
	});
	return loadCjsModuleFromText(result.outputFiles[0].text);
}

async function loadBundled(relPathFromRoot) {
	const result = await esbuild.build({
		entryPoints: [path.join(ROOT, relPathFromRoot)],
		bundle: true,
		format: "cjs",
		platform: "node",
		write: false,
		external: ["react", "react/jsx-runtime"],
		alias: { "@": ROOT },
	});
	return loadCjsModuleFromText(result.outputFiles[0].text);
}

function sessionFixture(agent) {
	return { agent, id: "s1", state: "complete", title: "t" };
}

// ---------------------------------------------------------------------
// Travel basis
// ---------------------------------------------------------------------

test("the default travel basis needs no size container, so a content-sized row works", async () => {
	const { cardGlowSurfaceStyle } = await loadCardGlow();
	const style = cardGlowSurfaceStyle("#D97757");

	assert.equal(style["--card-glow-tile-accent"], "#D97757");
	// `container-type: size` collapses a content-sized element such as a list
	// row, so the percentage default must not require one. Declaring nothing
	// here leaves the CSS `var(..., 50%)` fallback in charge.
	assert.equal(style["--card-glow-travel-x"], undefined);
	assert.equal(style["--card-glow-travel-y"], undefined);
	assert.match(CARD_GLOW_SOURCE, /var\(--card-glow-travel-x, 50%\)/u);
	assert.match(CARD_GLOW_SOURCE, /var\(--card-glow-travel-y, 50%\)/u);
});

test("the container travel basis preserves the bento's original drift", async () => {
	const { cardGlowSurfaceStyle } = await loadCardGlow();
	const style = cardGlowSurfaceStyle("#82B536", "container");

	assert.equal(style["--card-glow-travel-x"], "50cqi");
	assert.equal(style["--card-glow-travel-y"], "50cqh");
});

test("a container-travel consumer also declares the size container the units need", () => {
	for (const relPath of MIGRATED_CONSUMERS) {
		const source = fs.readFileSync(path.join(ROOT, relPath), "utf8");
		if (!source.includes('"container"')) {
			continue;
		}
		assert.match(
			source,
			/containerType: "size"/u,
			`${relPath} asks for cq travel units but never establishes a size container`,
		);
	}
});

// ---------------------------------------------------------------------
// Layer structure
// ---------------------------------------------------------------------

test("the bloom clips itself, so a surface keeps its descendants' focus rings", () => {
	// The bloom is scaled 3.4x and has to be clipped to the card. Clipping it on
	// the surface would also clip the hover-revealed actions' focus rings, so
	// the clip lives on the bloom's own span.
	assert.match(
		CARD_GLOW_SOURCE,
		/"pointer-events-none absolute inset-0 -z-\[1\] overflow-hidden rounded-\[inherit\]",\s*className,\s*\)\}\s*data-card-glow-bloom/u,
	);
	assert.doesNotMatch(
		SESSION_CARD_SOURCE,
		/group\/agent-row[^"]*overflow-hidden/u,
		"the session card article must not clip itself to host the glow",
	);
});

test("layers paint below in-flow content, so consumers do not lift every child", () => {
	const negativeLayers = CARD_GLOW_SOURCE.match(/-z-\[1\]/gu) ?? [];
	assert.ok(negativeLayers.length >= 3, "bloom, base ring and glow ring all paint at -z-[1]");
	// A negative z-index child escapes to the nearest stacking context, so every
	// host has to make one.
	assert.match(SESSION_CARD_SOURCE, /glow && "isolate"/u);
	// Either layer needs the stacking context, so the union is what mounts it.
	assert.match(SESSION_CARD_SOURCE, /const glow = glowStroke \|\| glowBloom;/u);
});

test("a surface with no resting border shows nothing until the pointer arrives", () => {
	// The session list is a flush stack of borderless tiles; the traced accent is
	// the only stroke it ever grows.
	assert.match(
		SESSION_CARD_SOURCE,
		/<CardGlowLayers baseBorder=\{false\} bloom=\{glowBloom\} stroke=\{glowStroke\} \/>/u,
	);
	assert.match(CARD_GLOW_SOURCE, /baseBorder = true/u);
});

// ---------------------------------------------------------------------
// Pointer cost and reduced motion
// ---------------------------------------------------------------------

test("pointer moves are coalesced to one geometry read per frame", () => {
	// A 48-row session column measuring every row on every pointermove is a
	// layout read per row per event.
	assert.match(POINTER_SOURCE, /requestAnimationFrame/u);
	assert.match(POINTER_SOURCE, /if \(frameRef\.current !== null\) \{\s*return;\s*\}/u);
	assert.match(POINTER_SOURCE, /cancelAnimationFrame/u);
	// Latest-wins: the frame resolves the most recent pointer, not the first.
	assert.match(POINTER_SOURCE, /const latest = pendingRef\.current;/u);
});

test("reduced motion keeps the affordance and drops the sweep", () => {
	// VPK's duration and easing tokens do not collapse themselves, so any motion
	// added here needs an explicit guard. Hover still lights the card; it just
	// stops following the pointer.
	assert.match(POINTER_SOURCE, /if \(reduceMotion\) \{\s*centreCardGlowPointer\(event\.currentTarget\);/u);
	assert.match(POINTER_SOURCE, /if \(reduceMotion\) \{\s*return;\s*\}/u);
	assert.match(SESSION_CARD_SOURCE, /useCardGlowPointer\(\{ reduceMotion: shouldReduceMotion \}\)/u);
});

test("an untouched surface rests fully outside the gradient", () => {
	// The effect is always mounted; it costs nothing only because the resting
	// pointer is far enough out that both the stroke and the bloom are clear.
	assert.match(POINTER_SOURCE, /CARD_GLOW_POINTER_REST = "-10"/u);
	assert.match(CARD_GLOW_SOURCE, /var\(--card-glow-pointer-x, -10\)/u);
});

test("touch input does not leave a card lit after the finger goes", () => {
	assert.match(POINTER_SOURCE, /pointerType === "touch"/u);
});

// ---------------------------------------------------------------------
// One owner
// ---------------------------------------------------------------------

test("no consumer restates the effect it now imports", () => {
	for (const relPath of [...MIGRATED_CONSUMERS, "components/blocks/agent-session/agent-session-card.tsx"]) {
		const source = fs.readFileSync(path.join(ROOT, relPath), "utf8");
		assert.match(
			source,
			/from "@\/components\/visual\/card-glow"/u,
			`${relPath} must read the effect from its shared owner`,
		);
		assert.doesNotMatch(
			source,
			/--card-glow-tile-accent 0 calc|maskComposite: "exclude"/u,
			`${relPath} still carries a local copy of the glow ring`,
		);
		assert.doesNotMatch(
			source,
			/setProperty\("--card-glow-pointer-/u,
			`${relPath} still writes pointer vars itself instead of using the shared hook`,
		);
	}
});

test("the session card reads its accent from the agent it renders", () => {
	assert.match(SESSION_CARD_SOURCE, /cardGlowSurfaceStyle\(agentSessionAccentColor\(item\)\)/u);
});

// ---------------------------------------------------------------------
// Hover glow and drop flash are one colour
// ---------------------------------------------------------------------

test("a session's hover accent is the colour it flashes when dropped on a work item", async () => {
	// Hovering a session in the column and dropping it on a work item are two
	// halves of one gesture. The flash is the authority (it echoes the rendered
	// brand mark), so the glow resolves through the exact same expression and
	// the exact same seed rather than keeping a parallel palette.
	const { AGENT_BRAND_TINT_FALLBACK, resolveAgentBrandTintColor } = await loadBundled(
		"components/blocks/agent-session/agent-brand-tint.ts",
	);
	const { agentSessionAccentColor, toSessionTransferMember } = await loadBundled(
		"components/blocks/agent-session/agent-session-transfer-member.ts",
	);

	const agents = [
		{ brandName: "claude", kind: "agent", name: "Claude" },
		{ brandName: "openai-codex", kind: "agent", name: "Codex" },
		{ brandName: "cursor", kind: "agent", name: "Cursor" },
		{ brandName: "github-copilot", kind: "agent", name: "GitHub Copilot" },
		{ kind: "agent", name: "Rovo", vpkLogo: "rovo" },
		// Unmapped: both sides must land on the same neutral, not one each.
		{ brandName: "figma", kind: "agent", name: "Figma" },
		{ avatarSrc: "/avatar-agent/dev-agents/code-reviewer.svg", kind: "agent", name: "Reviewer" },
	];

	for (const agent of agents) {
		const item = sessionFixture(agent);
		// The right-hand side is verbatim what `resolveJiraIssueLinkFlash` assigns
		// to `flash.tint`, fed by the member the drop actually transfers.
		const flashTint = resolveAgentBrandTintColor(toSessionTransferMember(item).tintSeed)
			?? AGENT_BRAND_TINT_FALLBACK;
		assert.equal(
			agentSessionAccentColor(item),
			flashTint,
			`${agent.name}: hover glow and drop flash must be the same colour`,
		);
	}
});

test("the flash still resolves its tint the way the glow assumes", () => {
	// The parity test above hard-codes the flash's expression. If the board
	// changes how it builds `flash.tint`, this catches it instead of letting the
	// two quietly diverge.
	assert.match(
		FUSION_STATE_SOURCE,
		/tint: resolveAgentBrandTintColor\(members\[0\]\.tintSeed\) \?\? AGENT_BRAND_TINT_FALLBACK,/u,
	);
	// One owner for that colour, and it is not inside an experimental variant —
	// the shared session card reads it too.
	assert.match(
		FUSION_STATE_SOURCE,
		/from "\.\.\/\.\.\/\.\.\/agent-session\/agent-brand-tint\.ts"/u,
	);
});

test("the glow is opt-in per host and large-card only", () => {
	assert.match(SESSION_CARD_SOURCE, /glowBloom = false,\n\tglowStroke = false,/u);
	assert.match(
		SESSION_INDEX_SOURCE,
		/const useCardGlow = \(glowStroke \|\| glowBloom\) && variant === "large";/u,
	);
	assert.match(SESSION_INDEX_SOURCE, /glowBloom=\{useCardGlow && glowBloom\}/u);
	assert.match(SESSION_INDEX_SOURCE, /glowStroke=\{useCardGlow && glowStroke\}/u);
	// The tuning vars belong to the list, not to each of its rows.
	assert.match(SESSION_INDEX_SOURCE, /\{ \.\.\.AGENT_SESSION_GLOW_STYLE, \.\.\.style \}/u);
	// The column opts in by default but forwards each switch, so the settings
	// menu can turn one off without the column losing its own defaults.
	assert.match(SESSION_COLUMN_SOURCE, /glowBloom=\{glowBloom\}/u);
	assert.match(SESSION_COLUMN_SOURCE, /glowStroke=\{glowStroke\}/u);
});

test("the session row dials the bloom back from the tile-tuned default", async () => {
	const { CARD_GLOW_DEFAULTS } = await loadCardGlow();
	// A 60px row is well under the 144px tile the default was tuned on, so the
	// same blob washes the whole row. The row must ask for less, not inherit it.
	assert.match(SESSION_INDEX_SOURCE, /"--card-glow-icon-opacity": 0\.18/u);
	assert.ok(
		0.18 < CARD_GLOW_DEFAULTS.iconOpacity,
		"the row override must be lighter than the shared tile default",
	);
});

// ---------------------------------------------------------------------
// Proximity reach
// ---------------------------------------------------------------------

test("proximity reaches further across the column than down it", async () => {
	const { CARD_GLOW_PROXIMITY_FALLOFF } = await loadBundled(
		"components/visual/card-glow/card-glow-pointer.ts",
	);
	// A stacked list is anisotropic. Wide horizontally is the whole point — that
	// is the axis a cursor crosses approaching from the board beside the column.
	// Wide vertically would light every row at once.
	assert.ok(
		CARD_GLOW_PROXIMITY_FALLOFF.x > CARD_GLOW_PROXIMITY_FALLOFF.y,
		"horizontal reach must exceed vertical, or approaching lights the whole column",
	);
});

test("a row reacts before the cursor arrives, and stops a couple of rows away", async () => {
	const { CARD_GLOW_PROXIMITY_FALLOFF, cardGlowProximity } = await loadBundled(
		"components/visual/card-glow/card-glow-pointer.ts",
	);
	// A session row as the column actually lays them out.
	const row = { height: 60, left: 346, right: 626, top: 400 };
	const centreY = row.top + row.height / 2;
	const at = (x, y) => cardGlowProximity(row, x, y, CARD_GLOW_PROXIMITY_FALLOFF);

	assert.equal(at(500, centreY), 1, "directly on the row is full strength");
	// The behaviour this whole change exists for: still outside the column, and
	// already responding.
	const approaching = at(row.right + 80, centreY);
	assert.ok(approaching > 0.5 && approaching < 1, `approach should be partial, got ${approaching}`);
	assert.ok(at(row.right + 200, centreY) > 0, "still reacting from a board column away");
	assert.equal(at(row.right + 400, centreY), 0, "far across the board is off");

	// Vertically it has to die out fast or the strokes read as rules between rows.
	assert.ok(at(500, centreY + 64) < approaching, "the next row down is weaker");
	assert.equal(at(500, centreY + 200), 0, "three rows away is off");
});

test("surfaces outside a plane keep a full-strength stroke", () => {
	// The var is only ever written by a proximity plane. Everything else — every
	// bento tile — must resolve to 1 and look exactly as it did before.
	assert.match(CARD_GLOW_SOURCE, /opacity: "var\(--card-glow-proximity, 1\)"/u);
	assert.doesNotMatch(
		POINTER_SOURCE,
		/applyPointerToSurfaces\(latest\.resolveSurfaces\(\), latest\.clientX, latest\.clientY, /u,
		"the shared frame — used by the per-card and group hooks — must pass no falloff",
	);
	assert.match(
		POINTER_SOURCE,
		/applyPointerToSurfaces\(latest\.resolveSurfaces\(\), latest\.clientX, latest\.clientY\);/u,
	);
});

test("a frame measures every surface before it writes any", () => {
	// Interleaving read and write per element costs one synchronous layout per
	// element. Fine for five bento tiles, not for fifty session rows.
	assert.match(
		POINTER_SOURCE,
		/const rects = surfaces\.map\(\(surface\) => surface\.getBoundingClientRect\(\)\);\s*for \(/u,
	);
});

test("an out-of-reach pointer costs one measurement and parks the column once", () => {
	// The plane listens on the window, so it sees every move on the page. The
	// gate is what keeps that affordable: one rect for the plane, none per row.
	assert.match(POINTER_SOURCE, /const planeRect = plane\.getBoundingClientRect\(\);/u);
	assert.match(POINTER_SOURCE, /distanceOutsideRect\(planeRect[\s\S]{0,60}?> reachPx/u);
	assert.match(POINTER_SOURCE, /if \(!engagedRef\.current\) \{\s*return;\s*\}/u);
});

test("a scroll re-resolves the glow without a pointer move", () => {
	// Wheeling the list slides rows under a stationary cursor. Without this the
	// accent stays pinned to where each row used to be.
	assert.match(POINTER_SOURCE, /"scroll", onScroll, \{ capture: true, passive: true \}/u);
});

// ---------------------------------------------------------------------
// Plane ownership
// ---------------------------------------------------------------------

test("a row hands pointer tracking to its plane, and keeps its own when there is none", () => {
	assert.match(SESSION_CARD_SOURCE, /const isOnGlowPlane = glow && glowPlaneSurface !== undefined;/u);
	assert.match(SESSION_CARD_SOURCE, /const tracksOwnPointer = glow && !isOnGlowPlane;/u);
	assert.match(SESSION_CARD_SOURCE, /onPointerMove=\{tracksOwnPointer \? cardGlow\.onPointerMove : undefined\}/u);
	assert.match(SESSION_CARD_SOURCE, /ref=\{isOnGlowPlane \? glowPlaneSurface : undefined\}/u);
});

test("a switched-off plane stops advertising itself so rows keep a driver", () => {
	// Regression: the provider stayed mounted while the plane was disabled for
	// reduced motion, so rows handed over their tracking to something that was
	// never going to run and the glow died completely.
	assert.match(
		SESSION_COLUMN_SOURCE,
		/const glowPlaneEnabled = \(glowStroke \|\| glowBloom\)\s*&& glowReach\s*&& !collapsed\s*&& shouldReduceMotion !== true;/u,
	);
	assert.match(
		SESSION_COLUMN_SOURCE,
		/<CardGlowSurfaceContext value=\{glowPlaneEnabled \? registerGlowSurface : undefined\}>/u,
	);
});

test("the three chrome layers are separately switchable, and reach needs one of them", () => {
	// All default on, so the settings menu turns shipped behaviour off to
	// compare it rather than turning a hidden feature on.
	assert.match(
		SESSION_COLUMN_SOURCE,
		/\tglowBloom = true,\n\tglowReach = true,\n\tglowStroke = true,/u,
	);
	// Stroke and wash are separate layers on the card and must not be collapsed
	// back into one switch on the way down.
	assert.match(SESSION_COLUMN_SOURCE, /glowBloom=\{glowBloom\}/u);
	assert.match(SESSION_COLUMN_SOURCE, /glowStroke=\{glowStroke\}/u);
	// Reach exists only to start those layers early, so with both off the plane
	// would drive nothing — the same dead-provider failure the regression above
	// guards, reached from the other switch.
	assert.match(SESSION_COLUMN_SOURCE, /const glowPlaneEnabled = \(glowStroke \|\| glowBloom\)/u);
});
