const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

const ROVO_BUTTON_PAGE_SOURCE = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
const ROVO_BUTTON_DEMO_SOURCE = fs.readFileSync(
	path.join(__dirname, "../rovo-button-demo.tsx"),
	"utf8",
);
const ONBOARDING_HOOK_SOURCE = fs.readFileSync(
	path.join(__dirname, "hooks/use-rovo-button-demo-onboarding.ts"),
	"utf8",
);
const LIVE_CHAT_HOOK_SOURCE = fs.readFileSync(
	path.join(__dirname, "hooks/use-rovo-button-demo-live-chat.tsx"),
	"utf8",
);
const INSIGHTS_HOOK_SOURCE = fs.readFileSync(
	path.join(__dirname, "hooks/use-rovo-button-demo-insights.ts"),
	"utf8",
);

/**
 * The catalog preview renders the showcase inside a fixed-width container. The
 * whole row has to fit that, not just the browser window.
 */
const EMBEDDED_PREVIEW_WIDTH_PX = 846;
const BUTTON_SIZE_PX = 48;

const modulePromises = new Map();
function loadModule(relativePath) {
	if (!modulePromises.has(relativePath)) {
		modulePromises.set(
			relativePath,
			esbuild
				.build({
					entryPoints: [path.join(__dirname, relativePath)],
					bundle: true,
					format: "cjs",
					platform: "node",
					tsconfig: path.join(process.cwd(), "tsconfig.json"),
					write: false,
				})
				.then((result) =>
					loadCjsModuleFromText(result.outputFiles[0].text, `${path.basename(relativePath)}.cjs`),
				),
		);
	}
	return modulePromises.get(relativePath);
}

const loadPlacements = () => loadModule("data/rovo-button-demo-placements.ts");
const loadInsights = () => loadModule("data/rovo-button-demo-insights.ts");

test("showcase places five variants on one evenly spaced row", async () => {
	const placements = await loadPlacements();
	const row = [
		placements.ONBOARDING_BUTTON_PLACEMENT,
		placements.CHAT_BUTTON_PLACEMENT,
		placements.INSIGHTS_BUTTON_PLACEMENT,
		placements.SUGGESTION_BUTTON_PLACEMENT,
		placements.TOOLBAR_BUTTON_PLACEMENT,
	];

	assert.deepEqual(
		row.map((placement) => placement.right),
		["24px", "200px", "376px", "552px", "728px"],
	);
	assert.deepEqual(
		row.map((placement) => placement.bottom),
		["32px", "32px", "32px", "32px", "32px"],
	);

	const gaps = row
		.slice(1)
		.map((placement, index) => placements.getRovoButtonDemoRightPx(index + 1) - placements.getRovoButtonDemoRightPx(index));
	assert.deepEqual(gaps, [176, 176, 176, 176], "the row must stay evenly spaced");
});

test("an opened card never lands on the other card variant's button", async () => {
	const placements = await loadPlacements();
	const cardWidth = placements.ROVO_BUTTON_DEMO_CARD_WIDTH_PX;

	// Buttons are right-anchored, so a card grows leftward: it occupies
	// [right, right + cardWidth]. Anything with a larger `right` is behind it.
	assert.deepEqual([...placements.ROVO_BUTTON_DEMO_CARD_SLOTS], [0, 2]);

	for (const slot of placements.ROVO_BUTTON_DEMO_CARD_SLOTS) {
		const cardLeftEdge = placements.getRovoButtonDemoRightPx(slot) + cardWidth;
		const nextCardSlot = placements.ROVO_BUTTON_DEMO_CARD_SLOTS.find((candidate) => candidate > slot);
		const nextButtonSlot = nextCardSlot ?? slot + 2;

		assert.ok(
			cardLeftEdge < placements.getRovoButtonDemoRightPx(nextButtonSlot),
			`a card opened at slot ${slot} reaches ${cardLeftEdge}px and would cover slot ${nextButtonSlot}`,
		);
	}
});

test("the showcase row fits the fixed-width catalog preview", async () => {
	const placements = await loadPlacements();
	const leftmostButtonEdge = placements.getRovoButtonDemoRightPx(4) + BUTTON_SIZE_PX;

	assert.ok(
		leftmostButtonEdge < EMBEDDED_PREVIEW_WIDTH_PX,
		`the last button ends at ${leftmostButtonEdge}px inside a ${EMBEDDED_PREVIEW_WIDTH_PX}px preview`,
	);
});

test("daily insights fixture reads like real board copy with visible overflow", async () => {
	const insights = await loadInsights();
	const rows = insights.ROVO_BUTTON_DEMO_INSIGHT_ROWS;

	assert.equal(rows.length, 3);
	assert.ok(
		insights.ROVO_BUTTON_DEMO_INSIGHT_TOTAL_COUNT > rows.length,
		"the total must exceed the visible rows so the card's overflow branch shows",
	);

	for (const row of rows) {
		assert.match(row.id, /^rovo-button-insight-/u);
		assert.match(row.timeLabel, /^\d{2}:\d{2}$/u);
		assert.ok(row.chapterLabel.length > 0);
		assert.ok(row.title.split(" ").length >= 6, `"${row.title}" should be a full sentence`);
	}

	const times = rows.map((row) => row.timeLabel);
	assert.deepEqual(times, [...times].sort(), "rows run oldest to newest");
});

test("insights start as an unread pill with the overflow remainder", async () => {
	const insights = await loadInsights();
	const state = insights.ROVO_BUTTON_DEMO_INSIGHTS_INITIAL_STATE;

	assert.equal(state.stage, "pill");
	assert.equal(insights.selectRovoButtonDemoInsightsCount(state), 7);
	assert.equal(insights.selectRovoButtonDemoInsightsRows(state).length, 3);
	assert.equal(insights.selectRovoButtonDemoInsightsOverflowCount(state), 4);
});

test("dismissing insights falls back to the pill without marking anything read", async () => {
	const insights = await loadInsights();
	const opened = insights.reduceRovoButtonDemoInsights(
		insights.ROVO_BUTTON_DEMO_INSIGHTS_INITIAL_STATE,
		{ type: "stage-change", stage: "card" },
	);
	const dismissed = insights.reduceRovoButtonDemoInsights(opened, { type: "dismiss" });

	// "pill", not "hidden": this page exists to demonstrate the affordance, so a
	// dismissal must leave it reopenable rather than reverting the button to a
	// chat launcher and dead-ending the demo until a reload. The product does
	// the opposite — see the reducer's comment.
	assert.equal(dismissed.stage, "pill");
	assert.equal(insights.selectRovoButtonDemoInsightsCount(dismissed), 7, "dismissed is not read");
	assert.equal(insights.selectRovoButtonDemoInsightsRows(dismissed).length, 3);
	assert.equal(dismissed.isWatermarkAdvanced, false);
});

test("the insights primary action advances the watermark past everything", async () => {
	const insights = await loadInsights();
	const opened = insights.reduceRovoButtonDemoInsights(
		insights.ROVO_BUTTON_DEMO_INSIGHTS_INITIAL_STATE,
		{ type: "open-all" },
	);

	assert.equal(opened.stage, "hidden");
	assert.equal(insights.selectRovoButtonDemoInsightsCount(opened), 0);
	assert.equal(insights.selectRovoButtonDemoInsightsRows(opened).length, 0);
	assert.equal(insights.selectRovoButtonDemoInsightsOverflowCount(opened), 0);
});

test("selecting one insight reads only that row", async () => {
	const insights = await loadInsights();
	const [firstRow] = insights.ROVO_BUTTON_DEMO_INSIGHT_ROWS;
	const afterSelect = insights.reduceRovoButtonDemoInsights(
		insights.ROVO_BUTTON_DEMO_INSIGHTS_INITIAL_STATE,
		{ type: "select-row", rowId: firstRow.id },
	);

	// Also falls back to the pill, so the demo can keep going and the reader can
	// watch the count tick down as rows are read.
	assert.equal(afterSelect.stage, "pill");
	assert.equal(insights.selectRovoButtonDemoInsightsCount(afterSelect), 6);
	assert.deepEqual(
		insights.selectRovoButtonDemoInsightsRows(afterSelect).map((row) => row.id),
		insights.ROVO_BUTTON_DEMO_INSIGHT_ROWS.slice(1).map((row) => row.id),
	);
	assert.equal(insights.selectRovoButtonDemoInsightsOverflowCount(afterSelect), 4);

	const selectedTwice = insights.reduceRovoButtonDemoInsights(afterSelect, {
		type: "select-row",
		rowId: firstRow.id,
	});
	assert.equal(insights.selectRovoButtonDemoInsightsCount(selectedTwice), 6, "reading is idempotent");
});

test("Rovo button project page maps one declarative variant list", () => {
	assert.match(
		ROVO_BUTTON_PAGE_SOURCE,
		/const variants = useMemo<readonly RovoButtonDemoVariant\[\]>\(\(\) => \[/u,
	);
	assert.match(
		ROVO_BUTTON_PAGE_SOURCE,
		/\{variants\.filter\([\s\S]*<RovoButtonDemoCaption[\s\S]*detail=\{variant\.detail\}[\s\S]*liftPx=\{variant\.captionLiftPx\}[\s\S]*placement=\{variant\.placement\}[\s\S]*title=\{variant\.title\}[\s\S]*variant\.render\(\{ placement: selectedVariant \? ONBOARDING_BUTTON_PLACEMENT : variant\.placement, positioning \}\)/u,
	);

	const declaredCaptions = [
		['"toolbar"', '"Toolbar"', '"persistent bar"', "TOOLBAR_BUTTON_PLACEMENT"],
		['"proactive"', '"Proactive"', '"shows nudge"', "SUGGESTION_BUTTON_PLACEMENT"],
		['"insights"', '"Insights"', '"daily digest"', "INSIGHTS_BUTTON_PLACEMENT"],
		['"chat"', '"Chat"', '"opens chat"', "CHAT_BUTTON_PLACEMENT"],
		['"onboarding"', '"Onboarding"', '"opens panel"', "ONBOARDING_BUTTON_PLACEMENT"],
	];

	for (const [id, title, detail, placement] of declaredCaptions) {
		assert.match(
			ROVO_BUTTON_PAGE_SOURCE,
			new RegExp(
				`id: ${id},\\s*title: ${title},\\s*detail: ${detail},\\s*placement: ${placement},`,
				"u",
			),
			`variant ${id} should keep its caption and placement together`,
		);
	}

	// Placement literals belong to the data module, not the page.
	assert.doesNotMatch(ROVO_BUTTON_PAGE_SOURCE, /satisfies FloatingRovoButtonPlacement/u);
	assert.doesNotMatch(ROVO_BUTTON_PAGE_SOURCE, /right: "\d+px"/u);
	// The toolbar caption has to clear the persistent bar.
	assert.match(ROVO_BUTTON_PAGE_SOURCE, /captionLiftPx: 188/u);
});

test("Rovo button project page keeps per-variant state in hooks", () => {
	assert.doesNotMatch(ROVO_BUTTON_PAGE_SOURCE, /useState/u);
	assert.doesNotMatch(ROVO_BUTTON_PAGE_SOURCE, /useEffect/u);
	assert.match(ROVO_BUTTON_PAGE_SOURCE, /const liveChat = useRovoButtonDemoLiveChat\(\);/u);
	assert.match(ROVO_BUTTON_PAGE_SOURCE, /const insights = useRovoButtonDemoInsights\(\);/u);
	assert.match(
		ROVO_BUTTON_PAGE_SOURCE,
		/const \{ suggestion, show: showSuggestion, hide: hideSuggestion \} = useRovoButtonDemoSuggestion\(\);/u,
	);
	assert.match(
		ROVO_BUTTON_PAGE_SOURCE,
		/useRovoButtonDemoOnboarding\(\{\s*onOpened: hideSuggestion,\s*\}\);/u,
	);
	// Opening one morphing surface must stand the other one down.
	assert.match(
		ROVO_BUTTON_PAGE_SOURCE,
		/const handleSuggestionButtonClick = useCallback\(\(\) => \{\s*closeOnboarding\(\);\s*showSuggestion\(\);\s*\}, \[closeOnboarding, showSuggestion\]\);/u,
	);
	assert.match(
		ROVO_BUTTON_PAGE_SOURCE,
		/const positioning: FloatingRovoButtonPositioning = embedded \? "container" : "viewport";/u,
	);
	assert.match(
		ROVO_BUTTON_PAGE_SOURCE,
		/<AppLayout product="home" embedded=\{embedded\} embeddedHeight=\{embeddedHeight\} hideFloatingRovo>/u,
	);
	assert.match(
		ROVO_BUTTON_PAGE_SOURCE,
		/\{chatSurface === "floating" \? \([\s\S]*<RovoFloatingChat key="floating-chat" startRealtimeVoiceRequestKey=\{liveChat\.requestKey\} \/>[\s\S]*\) : null\}/u,
	);
});

test("Rovo button variants keep their distinguishing props", () => {
	const wiring = [
		['ariaLabel="Open Rovo chat demo with persistent toolbar"', /persistentBar=\{liveChat\.persistentBar\}/u],
		['ariaLabel="Show proactive suggestion demo"', /suggestion=\{suggestion\}/u],
		['ariaLabel="Open daily insights demo"', /insights=\{insights\}/u],
		['ariaLabel="Open onboarding demo"', /onboarding=\{onboarding\}/u],
	];

	for (const [ariaLabel, propPattern] of wiring) {
		assert.ok(ROVO_BUTTON_PAGE_SOURCE.includes(ariaLabel), `${ariaLabel} should still be rendered`);
		assert.match(ROVO_BUTTON_PAGE_SOURCE, propPattern);
	}

	// The plain chat button stays prop-free and yields to the floating chat.
	assert.match(
		ROVO_BUTTON_PAGE_SOURCE,
		/render: \(context\) => chatSurface === null \? \(\s*<FloatingRovoButton \{\.\.\.context\} ariaLabel="Open Rovo chat demo" forceVisible product="home" \/>\s*\) : null,/u,
	);
});

test("Rovo button onboarding hook owns the demo-only agent creation flow", () => {
	assert.match(ONBOARDING_HOOK_SOURCE, /useState<FloatingRovoButtonOnboardingStatus>\("idle"\)/u);
	assert.match(
		ONBOARDING_HOOK_SOURCE,
		/const config = useMemo<FloatingRovoButtonOnboardingConfig>\(\(\) => \(\{/u,
	);
	assert.match(ONBOARDING_HOOK_SOURCE, /id: "rovo-button-rfp-drafter-onboarding-demo"/u);
	assert.match(
		ONBOARDING_HOOK_SOURCE,
		/title: "Create a new agent"[\s\S]*agentName: "RFP Drafter"[\s\S]*prompt: "Repeating RFP review manually every time\? We can automate it\."/u,
	);
	assert.match(ONBOARDING_HOOK_SOURCE, /primaryActionLabel: getDemoPrimaryActionLabel\(status\)/u);
	assert.match(ONBOARDING_HOOK_SOURCE, /primaryActionDisabled: status !== "idle"/u);
	// Opening the panel resets the flow and stands the nudge down.
	assert.match(
		ONBOARDING_HOOK_SOURCE,
		/if \(open\) \{\s*setStatus\("idle"\);\s*onOpened\(\);\s*\}/u,
	);
	assert.doesNotMatch(ONBOARDING_HOOK_SOURCE, /RFP_AGENT_CREATION_PROMPT/u);
	assert.doesNotMatch(ONBOARDING_HOOK_SOURCE, /components\/projects\/agents/u);
});

test("the RFP Drafter artwork survives the banner crop", () => {
	// One asset serves the 42x48 hex avatar and the 168x192 banner, which the
	// panel crops to a 48px slice through the artwork's vertical middle.
	const artworkMatch = ONBOARDING_HOOK_SOURCE.match(
		/const RFP_DRAFTER_ARTWORK_SRC = "(\/avatar-agent-new\/blue\/[a-z0-9-]+\.svg)";/u,
	);
	assert.ok(artworkMatch, "the artwork should live in one named constant");

	const [, artworkSrc] = artworkMatch;
	assert.ok(
		fs.existsSync(path.join(process.cwd(), "public", artworkSrc)),
		`${artworkSrc} should exist in public/`,
	);

	// Assets with a rectangular centre plate turn its edges into hard seams
	// against the flat blue band and clip any glyph that pokes outside it, so the
	// strip reads as a mis-tiled image. Only a circular centre survives the crop.
	// These three were each tried and rejected against the rendered strip.
	const rejected = {
		"blocker-checker": "circle-and-slash reads as a no-entry sign on a card that asks you to create",
		"release-notes-drafter": "rectangular centre: hard vertical seam plus a clipped arrow fragment",
		"product-requirements-guide": "rectangular centre: hard left seam plus a clipped checkmark",
	};

	for (const [name, reason] of Object.entries(rejected)) {
		assert.notEqual(artworkSrc, `/avatar-agent/teamwork-agents/${name}.svg`, reason);
	}

	// Declared once, used for both slots, so the hex and the banner cannot desync.
	const artworkUses = ONBOARDING_HOOK_SOURCE.match(/RFP_DRAFTER_ARTWORK_SRC/gu) ?? [];
	assert.equal(artworkUses.length, 3, "declared once, used for both avatarSrc and coverSrc");
	assert.match(ONBOARDING_HOOK_SOURCE, /avatarSrc: RFP_DRAFTER_ARTWORK_SRC,\s*coverSrc: RFP_DRAFTER_ARTWORK_SRC,/u);
});

test("Rovo button persistent bar only shows the voice action", () => {
	assert.doesNotMatch(LIVE_CHAT_HOOK_SOURCE, /import CursorIcon/u);
	assert.doesNotMatch(LIVE_CHAT_HOOK_SOURCE, /rovo-button-bar-cursor/u);
	assert.doesNotMatch(LIVE_CHAT_HOOK_SOURCE, /Point and select/u);
	assert.match(LIVE_CHAT_HOOK_SOURCE, /const \[requestKey, setRequestKey\] = useState\(0\);/u);
	assert.match(
		LIVE_CHAT_HOOK_SOURCE,
		/const open = useCallback\(\(\) => \{\s*setRequestKey\(\(currentKey\) => currentKey \+ 1\);\s*openChat\("floating"\);\s*\}, \[openChat\]\);/u,
	);
	assert.match(
		LIVE_CHAT_HOOK_SOURCE,
		/useEffect\(\(\) => \{\s*if \(chatSurface !== "floating"\) \{\s*setRequestKey\(0\);\s*\}\s*\}, \[chatSurface\]\);/u,
	);
	assert.match(LIVE_CHAT_HOOK_SOURCE, /id: "rovo-button-bar-voice"/u);
	assert.match(LIVE_CHAT_HOOK_SOURCE, /ariaLabel: "Talk to Rovo"/u);
	assert.match(LIVE_CHAT_HOOK_SOURCE, /tooltipLabel: "Live chat"/u);
	assert.match(LIVE_CHAT_HOOK_SOURCE, /onClick: open/u);
});

test("Rovo button insights hook drives a controlled stage from the reducer", () => {
	assert.match(INSIGHTS_HOOK_SOURCE, /useReducer\(\s*reduceRovoButtonDemoInsights,/u);
	assert.match(INSIGHTS_HOOK_SOURCE, /id: "rovo-button-daily-insights-demo"/u);
	assert.match(INSIGHTS_HOOK_SOURCE, /count: selectRovoButtonDemoInsightsCount\(state\)/u);
	assert.match(INSIGHTS_HOOK_SOURCE, /overflowCount: selectRovoButtonDemoInsightsOverflowCount\(state\)/u);
	assert.match(INSIGHTS_HOOK_SOURCE, /spaceName: "Jira Design"/u);
	assert.match(INSIGHTS_HOOK_SOURCE, /stage: state\.stage/u);
	assert.match(INSIGHTS_HOOK_SOURCE, /onStageChange: handleStageChange/u);
	assert.match(INSIGHTS_HOOK_SOURCE, /onPrimaryAction: handlePrimaryAction/u);
	assert.match(INSIGHTS_HOOK_SOURCE, /onDismiss: handleDismiss/u);
	assert.match(INSIGHTS_HOOK_SOURCE, /dispatch\(\{ type: "select-row", rowId: row\.id \}\)/u);
	// The headline number must never be recomputed from the visible rows.
	assert.doesNotMatch(INSIGHTS_HOOK_SOURCE, /count: rows\.length/u);
});

test("Rovo button catalog demo uses parent-height embedded preview positioning", () => {
	assert.match(ROVO_BUTTON_DEMO_SOURCE, /import \{ usePathname \} from "next\/navigation";/u);
	assert.match(
		ROVO_BUTTON_DEMO_SOURCE,
		/const embeddedHeight = pathname\.startsWith\("\/components\/"\) \? "parent" : "viewport";/u,
	);
	assert.match(
		ROVO_BUTTON_DEMO_SOURCE,
		/<RovoButtonPage embedded=\{embedded\} embeddedHeight=\{embeddedHeight\} \/>/u,
	);
});
