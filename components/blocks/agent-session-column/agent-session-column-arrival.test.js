const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const INDEX_SOURCE = readFileSync(join(__dirname, "index.tsx"), "utf8");
const ARRIVAL_HOOK_SOURCE = readFileSync(
	join(__dirname, "use-agent-session-user-notch-arrival.ts"),
	"utf8",
);
const RAIL_COLUMN_SOURCE = readFileSync(join(__dirname, "agent-session-column-rail.tsx"), "utf8");
const USER_NOTCH_SOURCE = RAIL_COLUMN_SOURCE.slice(
	RAIL_COLUMN_SOURCE.indexOf("function AgentSessionUserNotch"),
	RAIL_COLUMN_SOURCE.indexOf("function AgentSessionNotch"),
);
const NOTCH_MARK_SOURCE = readFileSync(
	join(__dirname, "../agent-session/agent-session-notch.tsx"),
	"utf8",
);
const NOTCH_MAGNIFY_SOURCE = readFileSync(
	join(__dirname, "../agent-session/agent-session-notch-magnify.ts"),
	"utf8",
);
const ARRIVAL_MOTION_SOURCE = readFileSync(
	join(__dirname, "../agent-session/agent-session-arrival-motion.ts"),
	"utf8",
);
const PAGE_SOURCE = readFileSync(join(__dirname, "page.tsx"), "utf8");
const PANEL_DEMO_SOURCE = readFileSync(
	join(__dirname, "agent-session-column-panel-demo.tsx"),
	"utf8",
);
const CARD_SOURCE = readFileSync(
	join(__dirname, "../agent-session/agent-session-card.tsx"),
	"utf8",
);
const SESSION_INDEX_SOURCE = readFileSync(
	join(__dirname, "../agent-session/index.tsx"),
	"utf8",
);
const SESSION_TYPES_SOURCE = readFileSync(
	join(__dirname, "../agent-session/agent-session-types.ts"),
	"utf8",
);
const DETAIL_SOURCE = readFileSync(
	join(__dirname, "../../../app/data/details/blocks/agent-session-column.ts"),
	"utf8",
);

test("newly synced work reaches the rail; expanded column cards omit the unreviewed dot", () => {
	// One set still feeds the collapsed rail and the header new-count. The
	// expanded list keeps the arrival beat via `arrivingItemIds` and drops
	// the persistent card mark — Unattached rows do not paint the blue dot.
	assert.match(INDEX_SOURCE, /<AgentSessionColumnRail[\s\S]{0,700}?newItemIds=\{newItemIds\}/u);
	const columnList = INDEX_SOURCE.match(/<AgentSession\n[\s\S]*?visibilityLabel=\{/u)?.[0] ?? "";
	assert.match(columnList, /arrivingItemIds=\{arrivingItemIds\}/u);
	assert.doesNotMatch(columnList, /newItemIds=/u);
	// Destructured rather than left in `...sessionProps`, or the rail could not
	// see it.
	assert.match(INDEX_SOURCE, /^\tnewItemIds,$/mu);
	assert.match(SESSION_TYPES_SOURCE, /newItemIds\?: ReadonlySet<string>;/u);
});

test("an arrival is a transient beat plus a mark that outlives it", () => {
	// The mark is the load-bearing half: it has to survive a backgrounded tab, a
	// collapsed column, and reduced motion, so it is never the animation alone.
	assert.match(CARD_SOURCE, /<span className="sr-only">Newly synced, not yet reviewed<\/span>/u);
	assert.match(CARD_SOURCE, /size-1\.5 -translate-y-1\/2 rounded-full bg-icon-information/u);
	assert.match(CARD_SOURCE, /absolute left-1\.5 top-1\/2/u);
	assert.doesNotMatch(CARD_SOURCE, /top-1\.5/u);
	assert.doesNotMatch(CARD_SOURCE, /bg-icon-discovery/u);
	assert.match(
		RAIL_COLUMN_SOURCE,
		/backgroundColor: isNew\s*\? AGENT_SESSION_NOTCH_TONE\.unread/u,
	);
	assert.match(RAIL_COLUMN_SOURCE, /AGENT_SESSION_NOTCH_TONE\.rest/u);
	// A reviewed session rests as a quiet 4px `icon.disabled` dot; hover and
	// keyboard focus reveal the same human face used by the expanded card,
	// capped at 12x12. Newly synced sessions rest at that same 4px in
	// `color.icon.subtle` after the arrival face morphs down.
	assert.match(RAIL_COLUMN_SOURCE, /size-3[^"\n]*rounded-full object-cover/u);
	assert.match(RAIL_COLUMN_SOURCE, /"size-1 rounded-full/u);
	assert.doesNotMatch(RAIL_COLUMN_SOURCE, /isNew \? "size-3" : "size-1"/u);
	assert.match(RAIL_COLUMN_SOURCE, /isNew=\{isNew\}/u);
	assert.match(RAIL_COLUMN_SOURCE, /group-data-\[hovered\]\/notch:opacity-100/u);
	assert.match(RAIL_COLUMN_SOURCE, /group-has-\[:focus-visible\]\/notch:opacity-100/u);
	assert.match(RAIL_COLUMN_SOURCE, /avatarSrc=\{visibleIdentity\.avatarSrc\}/u);
	assert.match(RAIL_COLUMN_SOURCE, /toAgentSessionVisibleIdentity\(item\)/u);
	// State is spoken, not painted — no per-lifecycle hue on the dot.
	assert.doesNotMatch(RAIL_COLUMN_SOURCE, /bg-icon-warning|bg-icon-information/u);
	// Arrival recolours the same solid frame rather than replacing the border.
	assert.doesNotMatch(CARD_SOURCE, /dash-4-2/u);
	// Reduced motion drops the beat and keeps the mark. The beat is keyed on
	// `isArriving`, never on `isNew` — see the one-shot test below.
	assert.match(CARD_SOURCE, /const shouldPlayArrival = isArriving && !isDeparting && !shouldReduceMotion;/u);
	assert.match(ARRIVAL_HOOK_SOURCE, /const shouldPlayArrival = isArriving && !shouldReduceMotion;/u);
	assert.match(ARRIVAL_HOOK_SOURCE, /AGENT_SESSION_USER_NOTCH_ARRIVAL_HIDE_MS/u);
	assert.match(ARRIVAL_HOOK_SOURCE, /AGENT_SESSION_USER_NOTCH_ARRIVAL_COMPLETE_MS/u);
	// A settled card must not replay its entrance on an unrelated re-render.
	assert.match(CARD_SOURCE, /initial: shouldPlayArrival && !isStateChanged \? \{ opacity: 0, transform: AGENT_SESSION_TOP_ARRIVAL_TRANSFORM \} : false/u);
	assert.match(CARD_SOURCE, /initial=\{rowMotion\.initial\}/u);
});

test("settled rail avatars reveal immediately while arrival morphing stays animated", () => {
	const avatarStart = USER_NOTCH_SOURCE.indexOf("{avatarSrc ? (");
	const avatarEnd = USER_NOTCH_SOURCE.indexOf("width={12}", avatarStart);
	assert.notEqual(avatarStart, -1);
	assert.notEqual(avatarEnd, -1);
	const hoverRevealSource = USER_NOTCH_SOURCE.slice(
		avatarStart,
		avatarEnd,
	);

	assert.match(hoverRevealSource, /group-data-\[hovered\]\/notch:scale-100 group-data-\[hovered\]\/notch:opacity-100/u);
	assert.match(hoverRevealSource, /group-has-\[:focus-visible\]\/notch:scale-100 group-has-\[:focus-visible\]\/notch:opacity-100/u);
	assert.doesNotMatch(hoverRevealSource, /transition-\[opacity,scale\]/u);
	// The morph is the only thing on this element that animates, and it is an
	// inline transition because its two properties ride different curves.
	assert.match(
		hoverRevealSource,
		/transition: isMorphing\s*\n?\s*\? AGENT_SESSION_USER_NOTCH_MORPH_TRANSITION/u,
	);
});

test("the rest disc is already under the face when the morph starts", () => {
	// The regression: the rest disc was held at opacity-0 through
	// `arrivalExiting` too, so the face dissolved onto bare plane and a separate
	// dot then faded up from zero behind it — 150ms of `bg-surface` showing
	// through, which reads as a white flash. The disc is now hidden only for the
	// pre-reveal frame, when there is no face to sit under; from reveal onward an
	// opaque 12px face covers it while its own fade-in plays out unseen.
	assert.match(
		ARRIVAL_HOOK_SOURCE,
		/hideTimer = window\.setTimeout\(\(\) => \{\s*setArrivalExiting\(true\);/u,
	);
	assert.doesNotMatch(
		ARRIVAL_HOOK_SOURCE,
		/setArrivalReveal\(false\);\s*setArrivalExiting\(true\);/u,
	);
	assert.match(ARRIVAL_HOOK_SOURCE, /arrivalPending/u);
	assert.match(RAIL_COLUMN_SOURCE, /const hasArrivalVisual = Boolean\(avatarSrc\) \|\| hasStateGlyph;/u);
	assert.match(
		RAIL_COLUMN_SOURCE,
		/const hideRestDisc = hasArrivalVisual && \(/u,
	);
	assert.match(
		RAIL_COLUMN_SOURCE,
		/\(arrivalPending && !arrivalReveal\) \|\| isHighlighted/u,
	);
	// The morph must never be able to hide its own destination again.
	const hideRestDiscExpression = RAIL_COLUMN_SOURCE.split("const hideRestDisc =")[1]?.split(";")[0];
	assert.ok(hideRestDiscExpression, "the lifecycle owner must keep the resting disc available during the morph");
	assert.doesNotMatch(hideRestDiscExpression, /arrivalExiting/u);
	assert.match(RAIL_COLUMN_SOURCE, /hideRestDisc \? "opacity-0" : null/u);
	assert.match(RAIL_COLUMN_SOURCE, /data-arrival-rest-hidden=\{hideRestDisc \|\| undefined\}/u);
	assert.match(RAIL_COLUMN_SOURCE, /data-arrival-reveal=\{arrivalReveal \|\| undefined\}/u);
	assert.match(
		RAIL_COLUMN_SOURCE,
		/"--agent-session-user-notch-morph": String\(arrivalMorphScale\)/u,
	);
	assert.match(
		RAIL_COLUMN_SOURCE,
		/AGENT_SESSION_USER_NOTCH_DIAMETER\.rest\s*\/ AGENT_SESSION_USER_NOTCH_DIAMETER\.peak/u,
	);
	assert.match(
		RAIL_COLUMN_SOURCE,
		/scale-\[var\(--agent-session-user-notch-morph\)\] opacity-0/u,
	);
	assert.doesNotMatch(RAIL_COLUMN_SOURCE, /scale-75/u);
});

test("circle unread rest uses icon subtle color", () => {
	assert.match(CARD_SOURCE, /<span className="sr-only">Newly synced, not yet reviewed<\/span>/u);
	assert.match(RAIL_COLUMN_SOURCE, /isNew \? ", newly synced" : ""/u);
	// Size is no longer the persistent unread mark. Circle rests stay 4px;
	// unread paints `color.icon.subtle`, reviewed stays `icon.disabled`. Line
	// mode already used selected/new tone.
	assert.match(
		RAIL_COLUMN_SOURCE,
		/backgroundColor: isNew\s*\? AGENT_SESSION_NOTCH_TONE\.unread/u,
	);
	assert.match(NOTCH_MAGNIFY_SOURCE, /toAgentSessionNotchTone\(isSelected: boolean, isNew: boolean\)/u);
	assert.match(NOTCH_MAGNIFY_SOURCE, /return isNew \|\| isSelected/u);
	// Gutter rest hides the total. An inspected column presentation keeps
	// that same total visible.
	assert.match(INDEX_SOURCE, /hideGutterCount = isGutterCollapsed/u);
	assert.match(INDEX_SOURCE, /<AgentSessionColumnCountMorph count=\{sessionCount\} \/>/u);
	assert.match(INDEX_SOURCE, /\$\{sessionCount\} \$\{allLocalSessions \? "local " : ""\}sessions, \$\{newCount\} newly synced/u);
	assert.doesNotMatch(INDEX_SOURCE, /`\+\$\{newCount\}`/u);
});

test("arrival motion is tokenised, capped, and spatially anchored", () => {
	// duration-slow + bold ease-out: the flag recipe, because an arrival is a
	// notification of work showing up.
	assert.match(ARRIVAL_MOTION_SOURCE, /duration: 0\.25,\s*ease: \[0, 0\.4, 0, 1\]/u);
	// Enters from above, where sync lives; two properties, never three.
	assert.match(ARRIVAL_MOTION_SOURCE, /AGENT_SESSION_ARRIVAL_OFFSET_PX = -8/u);
	// Past the cap the group lands together instead of stepping in.
	assert.match(SESSION_INDEX_SOURCE, /ARRIVAL_STAGGER_LIMIT = 4/u);
	assert.match(SESSION_INDEX_SOURCE, /shouldStagger \? index \* ARRIVAL_STAGGER_SECONDS : 0/u);
	// The rail's avatar arrival reuses hover's face, then shrinks that same
	// disc to the 4px rest. Scale-from-zero stays only for notches with no
	// face to reveal.
	assert.match(RAIL_COLUMN_SOURCE, /initial=\{shouldPlayScaleArrival \? \{ scale: 0 \} : false\}/u);
	assert.match(RAIL_COLUMN_SOURCE, /animate=\{shouldPlayScaleArrival \? \{ scale: 1 \} : undefined\}/u);
	assert.match(
		RAIL_COLUMN_SOURCE,
		/showAvatar && !isMorphing\s*\n?\s*\? "opacity-100 scale-100"\s*\n?\s*: "scale-\[var\(--agent-session-user-notch-morph\)\] opacity-0"/u,
	);
	assert.match(ARRIVAL_MOTION_SOURCE, /lingerMs: 800/u);
	assert.match(ARRIVAL_MOTION_SOURCE, /enterMs: 150/u);
	assert.match(ARRIVAL_MOTION_SOURCE, /exitMs: 150/u);
	// Morphing and settled share one class target, so completing the beat only
	// drops the transition — the face never re-snaps at the end.
	assert.match(RAIL_COLUMN_SOURCE, /const isMorphing = arrivalExiting && !isHighlighted;/u);
	// Two properties, two curves. Matched easing puts the face at `12 - 8p` px
	// and `1 - p` opacity for every p, so halfway through it is an 8px ghost at
	// 50% over a 4px dot — the two-layer read. `ease-out` front-loads the
	// collapse, `ease-in` holds it opaque until it is dot-sized.
	assert.match(
		ARRIVAL_MOTION_SOURCE,
		/"scale var\(--duration-normal\) var\(--ease-out\), opacity var\(--duration-normal\) var\(--ease-in\)"/u,
	);
	// Tailwind v4 `scale-*` sets the standalone `scale` property; a `transform`
	// entry in that list would animate nothing.
	assert.doesNotMatch(ARRIVAL_MOTION_SOURCE, /transform var\(--duration/u);
	assert.match(
		RAIL_COLUMN_SOURCE,
		/group-data-\[hovered\]\/notch:scale-100 group-data-\[hovered\]\/notch:opacity-100/u,
	);
	assert.match(
		RAIL_COLUMN_SOURCE,
		/group-has-\[:focus-visible\]\/notch:scale-100 group-has-\[:focus-visible\]\/notch:opacity-100/u,
	);
	assert.doesNotMatch(
		RAIL_COLUMN_SOURCE,
		/arrivalExiting\s*\n?\s*\? "transition-\[opacity,scale\] duration-fast ease-in"/u,
	);
	assert.doesNotMatch(NOTCH_MAGNIFY_SOURCE, /newRest: 8/u);
	assert.doesNotMatch(NOTCH_MAGNIFY_SOURCE, /newRest: 12/u);
	assert.doesNotMatch(RAIL_COLUMN_SOURCE, /toAgentSessionUserNotchDiameter\(value, isNew\)/u);
	assert.match(RAIL_COLUMN_SOURCE, /useAgentSessionUserNotchArrival/u);
	assert.match(RAIL_COLUMN_SOURCE, /data-arrival-reveal=\{arrivalReveal \|\| undefined\}/u);
	assert.match(DETAIL_SOURCE, /the face collapses 12→4 onto the rest disc already waiting beneath it/u);
	assert.doesNotMatch(DETAIL_SOURCE, /shrinks 12→4 as one disc/u);
	assert.doesNotMatch(DETAIL_SOURCE, /resting at 8px/u);
	assert.doesNotMatch(DETAIL_SOURCE, /fade to a 12px grey rest/u);
	assert.doesNotMatch(DETAIL_SOURCE, /fade to a 4px rest in default icon color/u);
	assert.doesNotMatch(USER_NOTCH_SOURCE, /scale: \[/u);
	assert.doesNotMatch(USER_NOTCH_SOURCE, /times:/u);
	// Standalone arriving notches push the ones below them down.
	// The scrollport stays a plain `ul` so mask-image can fade the marks;
	// layout lives on each notch, while the board column disables reflow travel.
	assert.match(RAIL_COLUMN_SOURCE, /layout=\{shouldReduceMotion \|\| !animateLayout \|\| isLeaving \|\| isStatusReentering \? false : "position"\}/u);
	assert.match(INDEX_SOURCE, /animateLayout = true,/u);
	assert.doesNotMatch(RAIL_COLUMN_SOURCE, /layoutScroll/u);
});

test("the panel demo drives an arrival through the Panel wrap", () => {
	assert.match(PANEL_DEMO_SOURCE, /ARRIVAL_BATCHES/u);
	const newIdUses = PANEL_DEMO_SOURCE.match(/newItemIds=\{newIds\}/gu) ?? [];
	assert.equal(newIdUses.length, 1, "expected the panel column to receive the arrivals");
	// Arrivals prepend, matching the entrance that starts above the list.
	assert.match(PANEL_DEMO_SOURCE, /\[\.\.\.batch, \.\.\.currentItems\]/u);
	// Reviewing decays the mark, standing in for the watermark advancing.
	assert.match(PANEL_DEMO_SOURCE, /handleMarkReviewed/u);
	// Sync / Mark reviewed / Reset stay on the panel variant only.
	assert.match(PANEL_DEMO_SOURCE, /Sync new work/u);
	assert.doesNotMatch(PAGE_SOURCE, /Sync new work/u);
	// Updaters stay pure: no sibling setState from inside one.
	assert.doesNotMatch(PANEL_DEMO_SOURCE, /setSyncedBatches\(\(/u);
	assert.match(DETAIL_SOURCE, /name: "newItemIds"/u);
});

test("the arrival target survives until Motion finishes, then stays one-shot", () => {
	// Collapsing swaps the cards for the rail and back, remounting them — and a
	// mount re-arms `initial`. The column survives the toggle, so it owns the
	// history of which ids have already played; the two branches only render it.
	assert.match(INDEX_SOURCE, /useAgentSessionArrivals\(\{/u);
	// Do not eagerly mirror every new id into played history. That removes the
	// card's animate target one effect after mount and strands it at opacity 0.
	assert.doesNotMatch(INDEX_SOURCE, /new Set<string>\(newItemIds\)/u);
	assert.match(INDEX_SOURCE, /onArrivalComplete: handleArrivalComplete/u);
	assert.match(CARD_SOURCE, /onAnimationComplete=\{shouldPlayDeparture \? onDepartureComplete : handleArrivalComplete\}/u);
	assert.match(NOTCH_MARK_SOURCE, /onAnimationComplete=\{handleArrivalComplete\}/u);
	// Both branches report completion and keep the beat set distinct from the mark.
	assert.match(
		INDEX_SOURCE,
		/<AgentSessionColumnRail[\s\S]{0,800}?onArrivalComplete=\{handleArrivalComplete\}/u,
	);
	assert.match(
		INDEX_SOURCE,
		/<AgentSession[\s\S]{0,400}?onArrivalComplete=\{handleArrivalComplete\}/u,
	);
	assert.match(SESSION_TYPES_SOURCE, /arrivingItemIds\?: ReadonlySet<string>;/u);
	assert.match(SESSION_TYPES_SOURCE, /onArrivalComplete\?: \(itemId: string\) => void;/u);
	// Defaulting to the mark keeps a host that never unmounts the list correct.
	assert.match(SESSION_INDEX_SOURCE, /const beatItemIds = arrivingItemIds \?\? newItemIds;/u);
});
