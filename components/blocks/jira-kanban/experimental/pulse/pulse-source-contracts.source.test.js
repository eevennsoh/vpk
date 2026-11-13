/**
 * Pulse source contracts — what Node cannot execute.
 *
 * The behavioural half of this suite lives in `pulse.source.test.js` and runs the real
 * hooks against the real fixture. What is left here is everything a Node
 * harness cannot reach: that the default board variant stays free of Pulse,
 * that every animating file carries explicit reduced-motion handling, that the
 * article composes the same pure helpers rather than a second definition of
 * "scoped", and the layout, token and focus contracts that only exist as
 * markup. Split from `pulse.source.test.js` because one file cannot hold both and
 * stay inside the repo file-size budget.
 */

const { test } = require("node:test");

const {
	assert,
	DEFAULT_BOARD_SOURCE,
	DEFAULT_HEADER_SOURCE,
	DEFAULT_PAGE_SOURCE,
	existsSync,
	EXPERIMENTAL_DIR,
	EXPERIMENTAL_HEADER_SOURCE,
	EXPERIMENTAL_PAGE_SOURCE,
	PULSE_MODE_CONTROLS_SOURCE,
	join,
	loadInsightsToggleMarkupHarness,
	loadRosterMarkupHarness,
	PULSE_DIR,
	readdirSync,
	readFileSync,
	relative,
	SOURCES,
} = require("./pulse-test-harness");

/**
 * Executable text only.
 *
 * Several Pulse files name a retired mechanism in a comment in order to record
 * that it was deleted and why. A ban on the mechanism has to read the code, not
 * the note explaining its absence. URLs inside string literals lose their tail
 * to the line-comment rule, which can only ever remove text from a scan.
 */
function withoutComments(source) {
	return source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/\/\/[^\n]*/gu, "");
}

/* ------------------------------------------------------------------ */
/* Source contracts — what Node cannot execute                          */
/* ------------------------------------------------------------------ */

test("Pulse animation carries explicit reduced-motion handling in every animating file", () => {
	const animating = /AnimatePresence|(?:^|[\s"'`])motion\.|transition-\[|transition-(?:all|colors|opacity|transform)|\banimate-/u;
	const reducedMotion = /motion-reduce:|useReducedMotion\(\)/u;
	const files = [];

	function collect(directory) {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const entryPath = join(directory, entry.name);
			if (entry.isDirectory()) {
				collect(entryPath);
				continue;
			}
			if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
				files.push(entryPath);
			}
		}
	}
	collect(PULSE_DIR);

	assert.ok(files.length >= 7, "expected the whole Pulse tree to be scanned");
	const animatingFiles = [];
	for (const file of files) {
		// Prose is not code. A file whose header explains *why it deliberately does
		// not animate* contains the sentence "No motion." — which matches ` motion.`
		// and then fails the file for lacking a guard on motion it does not have.
		const source = withoutComments(readFileSync(file, "utf8"));
		if (!animating.test(source)) {
			continue;
		}
		animatingFiles.push(relative(PULSE_DIR, file));
		assert.match(source, reducedMotion, `${file} animates without reduced-motion handling`);
		// VPK motion tokens do not auto-honour reduced motion, so hardcoded
		// timings would be unreviewable as well as unguarded.
		assert.doesNotMatch(source, /duration-\d|duration-\[|ease-\[/u, `${file} hardcodes a motion value`);
	}
	// Naming the animating owners proves the scan actually reached them. The
	// shell is deliberately absent: it composes, it does not animate. The work
	// columns left the list when the roster moved out of them — nothing in a
	// read-out of cards transitions any more. The stream joined it: the article
	// no longer crossfades between insights, but it does fade the one being read
	// up against its neighbours.
	for (const expected of [
		join("components", "pulse-mode-controls.tsx"),
		join("components", "pulse-scrubber.tsx"),
		join("components", "pulse-story.tsx"),
		join("components", "pulse-stream.tsx"),
	]) {
		assert.ok(animatingFiles.includes(expected), `${expected} was not recognised as animating`);
	}
});

test("Pulse deleted the overscroll state machine rather than keeping it beside the scroll", () => {
	// Continuity between separately mounted snapshots used to be faked with an
	// overscroll gesture: a wheel accumulator, a dwell gate, a momentum lock and
	// a landing window, all in `hooks/use-pulse-scroll.ts` with its own suite.
	// Native scrolling does it better and cannot fight the page, so the hook and
	// its tests are gone. Nothing may quietly grow a second one — two things
	// deciding where the reader is would put the old fight straight back.
	assert.ok(!existsSync(join(PULSE_DIR, "hooks", "use-pulse-scroll.ts")), "the overscroll hook should be deleted, not parked");
	assert.ok(!existsSync(join(PULSE_DIR, "pulse-scroll.test.js")), "its suite should go with it");

	const machinery = /accumulat|dwell|momentum|landingWindow|deltaY|onWheel|wheelDelta/iu;
	for (const [name, source] of Object.entries(SOURCES)) {
		// Comments are stripped first: several files name the machinery in order
		// to record that it was deleted, which is exactly what this suite asks
		// them to do. Only executable text is scanned.
		assert.doesNotMatch(withoutComments(source), machinery, `${name} is rebuilding the overscroll state machine`);
	}
	// One owner for the reading position, and it reads live geometry rather than
	// intercepting the gesture.
	assert.match(SOURCES.shell, /const reading = usePulseReading\(/u);
	assert.equal(SOURCES.shell.match(/usePulseReading\(/gu).length, 1);
	assert.match(SOURCES.shell, /activeIndex: reading\.activeSnapshotIndex,/u);
});

test("Pulse anchors exactly the parts the outline made marks for", () => {
	// The ruler and the article address the same elements by construction: both
	// call `toPulseAnchorId`, and the article decides what is anchored with
	// `toPulseSections` — the same helper `buildPulseOutline` uses to decide what
	// earns a mark. A mark with no anchor scrolls the reader nowhere.
	assert.match(SOURCES.story, /toPulseAnchorId,/u);
	assert.match(SOURCES.story, /toPulseSections,/u);
	assert.match(SOURCES.story, /toPulseSectionStats,/u);
	assert.match(SOURCES.story, /const anchoredSections = new Set\(toPulseSections\(snapshot\)\);/u);
	assert.match(SOURCES.story, /const insightId = toPulseAnchorId\(snapshot\.id\);/u);
	assert.match(SOURCES.story, /id=\{insightId\}\s*ref=\{anchorRef\(insightId\)\}/u);
	for (const section of ["artifacts", "attention", "actions"]) {
		assert.match(
			SOURCES.story,
			new RegExp(`anchored=\\{anchoredSections\\.has\\("${section}"\\)\\}\\s*\\n\\s*id=\\{${section}Id\\}`, "u"),
			`the ${section} section is not anchored the way the outline marks it`,
		);
	}
	// An unanchored part renders identically; it simply gets no wrapper, so the
	// article never carries a dangling id the ruler could point at.
	assert.match(SOURCES.story, /if \(!anchored\) \{\s*return children;/u);
	// The registrar is threaded from the one hook that owns it, unchanged.
	assert.match(SOURCES.shell, /anchorRef=\{reading\.registerAnchor\}/u);
	assert.match(SOURCES.stream, /anchorRef=\{anchorRef\}/u);
});

test("Pulse story stats jump to the same section anchors the outline marked", () => {
	// The ruled list under the faces is a TOC, not a second set of numbers: each
	// row is an in-page link to a section the outline already made a mark for,
	// using the same id helper, and the down arrow is the affordance rather than
	// a second control. Native hash scrolling would miss the article's scrollport,
	// so the click is intercepted and handed to the one jump the ruler uses.
	assert.match(SOURCES.story, /toPulseSectionStats\(snapshot, \{/u);
	assert.match(SOURCES.story, /href=\{`#\$\{link\.id\}`\}/u);
	assert.match(SOURCES.story, /event\.preventDefault\(\);\s*onGoToEntry\(link\.id\);/u);
	assert.match(
		SOURCES.story,
		/min-w-0 truncate transition-colors duration-xxshort ease-out-practical group-hover\/stat-link:text-text group-focus-visible\/stat-link:text-text motion-reduce:transition-none/u,
	);
	assert.match(
		SOURCES.story,
		/opacity-0 transition-opacity duration-xxshort ease-out-practical group-hover\/stat-link:opacity-100 group-focus-visible\/stat-link:opacity-100 motion-reduce:transition-none/u,
	);
	assert.match(SOURCES.story, /render=\{<ArrowDownIcon label="" size="small" \/>\}/u);
	assert.doesNotMatch(
		SOURCES.story.replaceAll("aria-hidden", ""),
		/hidden[\s\S]{0,80}ArrowDownIcon|ArrowDownIcon[\s\S]{0,80}hidden/u,
	);
	assert.match(SOURCES.stream, /onGoToEntry=\{onGoToEntry\}/u);
	assert.match(SOURCES.shell, /onGoToEntry=\{handleSelectEntry\}/u);
	assert.doesNotMatch(SOURCES.stream, /stats: snapshot\.stats/u);
	assert.doesNotMatch(SOURCES.story, /PulseStat/u);
});

test("Pulse absorbs sub-pixel jump rounding in the outline, not in the shell", () => {
	// A jump parks its anchor exactly on the reading line and browser scroll
	// rounding then leaves it a hundredth of a pixel short — measured at
	// +0.005px, enough to light the mark above the one just clicked. The shell
	// used to take that hair back with a 1px nudge after every jump, because
	// `toActiveOutlineIndex` counted an anchor as read only at `<= 0`.
	//
	// That threshold now defaults to a pixel, so the correction lives with the
	// arithmetic that needs it. The shell wraps the handlers to suppress the
	// top fade on a start-aligned jump; it still must not nudge the scrollport.
	assert.doesNotMatch(SOURCES.shell, /JUMP_SETTLE_PX/u);
	assert.doesNotMatch(SOURCES.shell, /scrollBy\(/u, "the shell no longer corrects the outline's rounding");
	assert.match(SOURCES.shell, /scrollToEntry\(id, \{ align: "start" \}\)/u);
	assert.match(SOURCES.shell, /scrollToSnapshot\(snapshotIndex, options\)/u);
});

test("Pulse mounts every insight, so nothing crossfades and the position is a treatment", () => {
	// This test used to pin the story's crossfade: `AnimatePresence`,
	// `mode="popLayout"`, a `STORY_ENTER` practical entrance and a shorter
	// `STORY_EXIT` on the exit variant. There is nothing to cross-fade any more —
	// all seven insights are mounted at once and the reader scrolls — so the
	// whole apparatus went with the swap it existed to smooth. Keeping the old
	// assertions would have demanded an animation that can no longer be correct.
	assert.doesNotMatch(SOURCES.story, /AnimatePresence|STORY_ENTER|STORY_EXIT|mode="(?:wait|popLayout)"/u);
	assert.doesNotMatch(SOURCES.story, /(?:^|[\s"'`(<])motion\./u, "no insight enters or leaves, so nothing animates in");
	assert.doesNotMatch(SOURCES.stream, /AnimatePresence|(?:^|[\s"'`(<])motion\./u);

	// What replaced it is a read/unread treatment on a permanently mounted
	// element: the insight being read sits at full strength and its neighbours
	// drop a little quieter. Deliberately shallow — this marks position, it does
	// not gate content, and a reader must still be able to read ahead.
	assert.match(SOURCES.stream, /const SNAPSHOT_READING = "opacity-100";/u);
	assert.match(SOURCES.stream, /const SNAPSHOT_QUIET = "opacity-80";/u);
	assert.match(
		SOURCES.stream,
		/index === activeSnapshotIndex \|\| index === previewEntry\?\.snapshotIndex[\s\S]*\? SNAPSHOT_READING[\s\S]*: SNAPSHOT_QUIET,/u,
	);
	// One property, token timings, and an explicit reduced-motion guard: VPK's
	// duration tokens resolve to literal ms and play regardless of the setting.
	assert.match(
		SOURCES.stream,
		/"min-w-0 transition-opacity duration-medium ease-out-practical motion-reduce:transition-none"/u,
	);

	// Scrolling is the reader's own gesture, so the article must not animate it.
	// A smooth `scroll-behavior` would also lag a frame behind a hover-scrub.
	assert.match(SOURCES.shell, /scrollBehavior: "auto",/u);
	// The jump itself is instant too — set in the reading hook, which owns the
	// only programmatic scroll left now that the shell's settle nudge is gone.
	assert.match(SOURCES.reading, /behavior: "auto", top: offset/u);
});

test("Pulse keeps focus alive through in-place commits, and pins header jumps to the top", () => {
	// The snapshot-swap chevrons are gone with the gesture they drove: the
	// article is scrolled, and the ruler is the primary navigation. The header
	// pair that replaced them jumps by whole insights through the same scroll
	// owner but explicitly selects start alignment, and keeps both buttons
	// mounted at the ends —
	// `aria-disabled={isFirst}`/`{isLast}` rather than a native `disabled` that
	// drops the focused control out of the tab order.
	// The frozen `PulseStoryProps` still describes the stepper; the view type
	// omits that half rather than accepting props nothing can honour, and names
	// the article position separately.
	assert.match(SOURCES.story, /extends Omit<PulseStoryProps, "index" \| "onNext" \| "onPrevious" \| "total"> \{/u);
	assert.match(SOURCES.story, /insightIndex: number;/u);
	assert.match(SOURCES.story, /insightCount: number;/u);
	assert.doesNotMatch(SOURCES.story, /onNext\(|onPrevious\(|onNext=|onPrevious=/u);
	assert.doesNotMatch(SOURCES.story, /disabled=\{index/u);
	assert.match(SOURCES.stream, /insightCount=\{entries\.length\}/u);
	assert.match(SOURCES.stream, /insightIndex=\{index\}/u);
	assert.match(SOURCES.story, /aria-label="Previous insight"/u);
	assert.match(SOURCES.story, /aria-label="Next insight"/u);
	assert.match(SOURCES.story, /aria-disabled=\{isFirst\}/u);
	assert.match(SOURCES.story, /aria-disabled=\{isLast\}/u);
	assert.match(SOURCES.story, /<ChevronUpIcon label="" size="small" \/>/u);
	assert.match(SOURCES.story, /<ChevronDownIcon label="" size="small" \/>/u);
	assert.match(SOURCES.story, /toAdjacentInsightIndex\(insightIndex, insightCount, "previous"\)/u);
	assert.match(SOURCES.story, /toAdjacentInsightIndex\(insightIndex, insightCount, "next"\)/u);
	assert.match(SOURCES.story, /onGoToIndex\(previousIndex, \{ align: "start" \}\)/u);
	assert.match(SOURCES.story, /onGoToIndex\(nextIndex, \{ align: "start" \}\)/u);
	assert.match(SOURCES.reading, /scrollToEntry\(entry\.id, options\)/u);
	assert.match(SOURCES.reading, /Number\.parseFloat\(scrollportStyle\.paddingTop\) \|\| 0/u);
	assert.match(SOURCES.reading, /measureAlignmentRef\.current = align/u);
	assert.match(SOURCES.reading, /toPulseMeasureLineY\(/u);
	assert.match(SOURCES.reading, /addEventListener\("scroll", handleUserScroll/u);
	assert.match(SOURCES.reading, /new ResizeObserver\(schedule\)/u);
	assert.match(SOURCES.shell, /scrollToEntry\(id, \{ align: "start" \}\)/u);
	assert.match(SOURCES.shell, /runStartAlignedJump\(\(\) => \{\s*scrollToEntry\(id, \{ align: "start" \}\);/u);
	assert.match(SOURCES.shell, /runStartAlignedJump\(\(\) => \{\s*scrollToSnapshot\(snapshotIndex, options\);/u);
	// The story column owns the gap between insight and section blocks, so a
	// subsection jump parks the heading rather than the 32px spacer that used
	// to live inside the scroll target.
	assert.match(SOURCES.story, /className="flex min-w-0 flex-col gap-8"/u);
	assert.doesNotMatch(SOURCES.story, /className=\{cn\("mt-8/u);
	// Start alignment pins the destination section to the scroller top (plus
	// the 4px focus-ring inset). Header chevrons and ruler scrubs share that
	// pin. A reserved fade-band scroll-padding used to jump the row 52px down
	// so a CSS top mask would not cover the buttons — the top fade is an
	// overlay now, so that offset is gone. The overlay still veils the
	// destination if it paints, so the shell suppresses it for the start-
	// aligned jump and shows it for every other clipped rest state.
	assert.doesNotMatch(SOURCES.shell, /scrollPaddingTop/u);
	assert.doesNotMatch(SOURCES.shell, /buildScrollMaskStyle/u);
	assert.doesNotMatch(SOURCES.shell, /fadeTop: false/u);
	assert.match(SOURCES.shell, /onScroll=\{handleArticleScroll\}/u);
	assert.doesNotMatch(SOURCES.shell, /onScrollEnd=/u);
	assert.match(SOURCES.shell, /toPulseArticleTopFadeVisible\(showTopScrollMask, suppressTopFade\)/u);
	assert.match(SOURCES.shell, /isPulseChevronHeaderJump\(options\)/u);
	assert.match(SOURCES.shell, /"opacity-0 transition-opacity motion-reduce:transition-none"/u);
	assert.match(SOURCES.shell, /"visible opacity-100 duration-normal ease-out-practical"/u);
	assert.match(SOURCES.shell, /"invisible duration-fast ease-in"/u);
	assert.match(SOURCES.shell, /data-pulse-article-top-fade=""/u);
	assert.match(SOURCES.shell, /data-pulse-article-bottom-fade=""/u);
	assert.match(SOURCES.shell, /edge="bottom"/u);
	assert.match(SOURCES.shell, /<ScrollMaskEdgeOverlay/u);
	assert.match(SOURCES.story, /size="icon-compact"/u);
	// The jump stays on the header row the reader selected, not a one-off in the
	// shell — the stream only hands the article position down.
	assert.match(
		SOURCES.story,
		/<div className=\{cn\("flex min-h-6 min-w-0 items-center", MEASURE\)\}>[\s\S]*<PulseStoryInsightNav/u,
	);
	assert.doesNotMatch(SOURCES.shell, /Previous insight|Next insight|ChevronUp|ChevronDown/u);
	// Requested actions stay on the same NextBestAction row; a second
	// activation is a no-op so focus cannot jump to the document body.
	assert.match(SOURCES.signals, /if \(requestedActionIds\.has\(item\.id\)\) return;/u);
	assert.match(SOURCES.signals, /<NextBestAction className="mt-3" items=\{items\} onAct=\{handleAct\} \/>/u);
	assert.match(SOURCES.rail, /captured=\{capturedIds\.has\(item\.id\)\}/u);
	assert.match(SOURCES.rail, /onCreateWorkItem=\{\(\) => onCapture\(item\)\}/u);
	assert.match(SOURCES.rail, /onLinkWorkItem=\{\(\) => onCapture\(item\)\}/u);
	assert.match(SOURCES.rail, /suggestedWorkItemKey=\{suggestPulseLooseWorkItemKey\(item, workItems\)\}/u);
	assert.doesNotMatch(SOURCES.rail, /aria-disabled|aria-live/u, "the shared Jira Issue variant owns the action contract");

	// Scroll position is not a focus change, so the reading position still needs
	// announcing — but once for the document, not once per insight. Seven live
	// regions on one page would each fire as the reader passed them.
	assert.doesNotMatch(SOURCES.story, /aria-live/u);
	assert.match(SOURCES.stream, /<p aria-live="polite" className="sr-only" role="status">/u);
	assert.match(SOURCES.stream, /Insight \$\{activeSnapshotIndex \+ 1\} of \$\{entries\.length\}/u);
	assert.equal(SOURCES.stream.match(/aria-live/gu).length, 1, "one status for the whole article");
});

test("Pulse Insights always paints a bottom scroll mask above the composer", () => {
	// The ask dock is a static sibling under the article. Overflow-gated fades
	// only paint while scrolling, so a rest-state article would cut off flush
	// against the composer. The bottom overlay is the seam and stays on
	// whether or not the column is overflowing or currently scrolling.
	assert.doesNotMatch(SOURCES.shell, /isArticleScrolling/u);
	assert.doesNotMatch(SOURCES.shell, /showBottomScrollMask/u);
	assert.doesNotMatch(
		SOURCES.shell,
		/pulseArticleFadeClassName\([^)]*showBottomScrollMask/u,
	);
	assert.match(
		SOURCES.shell,
		/<ScrollMaskEdgeOverlay\s+data-pulse-article-bottom-fade=""\s+edge="bottom"\s+fadeSize=\{PULSE_FADE_SIZE\}\s*\/>/u,
	);
	assert.match(
		SOURCES.shell,
		/data-pulse-article-bottom-fade=""[\s\S]*<PulseInsightsComposer/u,
	);
	assert.match(
		SOURCES.shell,
		/pulseArticleFadeClassName\(\s*toPulseArticleTopFadeVisible\(showTopScrollMask, suppressTopFade\),\s*\)/u,
	);
});

test("Pulse keeps repeated story sections out of landmark navigation", () => {
	// The whole timeline is already one named region with a ruler for navigation.
	// Repeating a named region for every insight and subsection creates several
	// indistinguishable landmarks, so the semantic headings stay unlabelled.
	assert.doesNotMatch(SOURCES.story, /<section aria-labelledby=/u);
	assert.doesNotMatch(SOURCES.signals, /<section aria-labelledby=/u);
	assert.match(SOURCES.story, /<h2 className=\{cn\("mt-6 text-pretty text-text", MEASURE\)\} style=\{HEADLINE_STYLE\}>/u);
	assert.match(SOURCES.story, /<PulseSectionLabel>\{toSectionHeading\("artifacts"\)\}<\/PulseSectionLabel>/u);
	assert.match(SOURCES.signals, /<PulseSectionLabel>\{toSectionHeading\("attention"\)\}<\/PulseSectionLabel>/u);
	assert.match(SOURCES.signals, /<PulseSectionLabel>\{toSectionHeading\("actions"\)\}<\/PulseSectionLabel>/u);
});

test("Pulse styles stay on semantic tokens and never render with a logical AND", () => {
	for (const [name, source] of Object.entries(SOURCES)) {
		assert.doesNotMatch(source, /(?:bg|text|border)-\[var\(--ds-/u, `${name} bypasses the semantic token classes`);
		assert.doesNotMatch(source, /&&\s*</u, `${name} renders with && instead of a ternary`);
		assert.doesNotMatch(source, /forwardRef|useContext\(|\.Provider/u, `${name} uses a pre-React-19 idiom`);
	}
});

test("Pulse keeps a quiet member selectable and lets absence carry the signal", () => {
	// Quiet is a fact about the window, and it survived the roster's move out of
	// the rail. The header facepile carries EVERY member, so a person who had a
	// quiet day is still selectable; the faces above the story carry only the
	// members active in this window, so absence from that row is the signal.
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /members=\{PULSE_TIMELINE\.members\}/u);
	// The contributor faces used to be derived in the shell, from the one mounted
	// snapshot. Every insight carries its own row now, so the derivation moved
	// into the article beside the insight it describes.
	assert.match(SOURCES.stream, /timeline\.members\.filter\(\(candidate\) => snapshot\.memberIds\.includes\(candidate\.id\)\)/u);
	assert.doesNotMatch(SOURCES.shell, /activeMemberIds/u);
	// A hard-disabled face is keyboard-unreachable, which would lock the filter
	// on exactly the snapshot that needs explaining most.
	assert.match(PULSE_MODE_CONTROLS_SOURCE, /aria-pressed=\{isSelected\}/u);
	assert.doesNotMatch(PULSE_MODE_CONTROLS_SOURCE, /disabled=|cursor-not-allowed/u);
	// Clicking the pressed header face is the way out of the filter.
	assert.match(PULSE_MODE_CONTROLS_SOURCE, /onSelectedMemberIdChange\(isSelected \? null : member\.id\)/u);
	assert.doesNotMatch(SOURCES.story, /onSelectMember\(isSelected \? null : member\.id\)/u);
	assert.match(PULSE_MODE_CONTROLS_SOURCE, /aria-label=\{isSelected\s*\?\s*`Clear filter: \$\{member\.name\}`/u);
	// The work columns are a read-out: no tab stop, no drag affordance.
	assert.match(SOURCES.rail, /draggable=\{false\}/u);
	assert.match(SOURCES.rail, /tabIndex=\{isInteractive \? undefined : -1\}/u);
	// Work-item cards share the experimental board's stroke chrome.
	assert.match(SOURCES.rail, /<JiraIssue[\s\S]*chrome="stroke"/u);
	assert.match(SOURCES.rail, /<JiraIssue[\s\S]*variant="uncaptured-work"/u);
	// Agent assignees on work-item cards reuse the roster hexagon, not a circle photo.
	assert.match(SOURCES.rail, /assigneeAvatarShape=\{face\.kind === "agent" \? "hexagon" : "circle"\}/u);
	assert.match(SOURCES.rail, /resolvePulseWorkItemFace\(workItem, memberLookup, selectedMember\)/u);
	assert.match(SOURCES.shell, /selectedMember=\{pulse\.selectedMember\}/u);
});

test("Pulse rail hangs everything off one left edge and one right edge", () => {
	// 776/784/785/789 used to coexist inside a 384px rail. Rows now pad outward
	// into a bleed gutter, and nothing else carries horizontal padding.
	assert.match(SOURCES.rail, /className="flex min-w-0 flex-col gap-3"/u);
	assert.match(
		SOURCES.rail,
		/className="-m-1 grid min-w-0 grid-cols-1 gap-10 p-1 lg:box-content lg:h-full lg:min-h-0 lg:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1fr\)\] lg:gap-2 lg:overflow-y-auto lg:overscroll-y-contain"/u,
	);
	assert.equal([...SOURCES.rail.matchAll(/overflow-y-auto/gu)].length, 1, "the rail parent is the only work scroller");
	// The roster and the window's numbers moved out of the rail entirely; the
	// two columns left do one job each.
	assert.doesNotMatch(SOURCES.rail, /Roster/u);
	assert.doesNotMatch(SOURCES.rail, /PulseRailStats|PulseRosterGroup|PulseRailMemberWeek/u);
	// Uncaptured cards are the shared Jira Issue variant, not a second inline
	// implementation inside Pulse.
	assert.doesNotMatch(SOURCES.rail, /Produced in this window but never landed in a work item/u);
	assert.doesNotMatch(SOURCES.rail, /Capture it before it disappears/u);
	assert.doesNotMatch(SOURCES.rail, /touched in this window/u);
	assert.doesNotMatch(SOURCES.rail, /scopedToFirstName/u);
	assert.doesNotMatch(SOURCES.shell, /scopedToFirstName/u);
	assert.match(SOURCES.rail, /<JiraIssue[\s\S]*variant="uncaptured-work"/u);
	assert.match(SOURCES.rail, /captured=\{capturedIds\.has\(item\.id\)\}/u);
	assert.match(SOURCES.rail, /onCreateWorkItem=\{\(\) => onCapture\(item\)\}/u);
	assert.match(SOURCES.rail, /onLinkWorkItem=\{\(\) => onCapture\(item\)\}/u);
	assert.match(SOURCES.rail, /suggestedWorkItemKey=\{suggestPulseLooseWorkItemKey\(item, workItems\)\}/u);
	assert.match(SOURCES.rail, /githubWork = looseWork\.filter\(isPulseGithubLooseWork\);/u);
	assert.match(
		SOURCES.rail,
		/const sessionItems = toPulseSessionItems\(\s*looseWork,\s*members,\s*workItems,\s*\);/u,
	);
	assert.match(
		SOURCES.rail,
		/<JiraIssue[\s\S]*variant="uncaptured-work"[\s\S]*<AgentSession[\s\S]*items=\{sessionItems\}/u,
	);
	assert.match(SOURCES.rail, /capturedItemIds=\{capturedIds\}/u);
	assert.match(SOURCES.sessions, /onCopyResume: onResume === undefined \? undefined : \(item: AgentSessionItem\) => \{/u);
	assert.doesNotMatch(SOURCES.rail, /variant="compact"/u);
	assert.match(SOURCES.rail, /const participants = toUncapturedParticipants\(item, memberLookup\);/u);
	assert.match(SOURCES.rail, /participants=\{participants\}/u);
	assert.match(SOURCES.rail, /sourceLink=\{createPulseLooseWorkSmartLink\(item, participants\)\}/u);
	assert.match(SOURCES.rail, /toPullRequestSmartLink/u);
	assert.match(SOURCES.rail, /GITHUB_BRANCH_SMART_LINK_ICON/u);
	assert.match(SOURCES.rail, /GITHUB_COMMIT_SMART_LINK_ICON/u);
	assert.match(SOURCES.rail, /PULSE_GITHUB_SOURCE_VISUAL: SmartLinkVisual = \{ kind: "third-party", name: "github" \}/u);
	assert.doesNotMatch(SOURCES.rail, /name: "claude"/u);
	assert.doesNotMatch(SOURCES.rail, /Slack: \{ kind: "third-party", name: "slack" \}/u);
	assert.doesNotMatch(SOURCES.rail, /Loom: \{ kind: "atlassian", name: "loom" \}/u);
	assert.match(SOURCES.data, /export \{ PULSE_SPACE_REPOSITORY, PULSE_VIEWER_MACHINE_NAME \} from "\.\/pulse-loose-work"/u);
	assert.match(SOURCES.looseWork, /export const PULSE_SPACE_REPOSITORY = "acme\/storefront"/u);
	// Resume is gated on the viewer's own device, so the fixture names it once
	// and the machine name on a row is the only thing that grants the action.
	assert.match(SOURCES.looseWork, /export const PULSE_VIEWER_MACHINE_NAME = "Venn’s MacBook"/u);
	assert.match(SOURCES.looseWork, /machineName: PULSE_VIEWER_MACHINE_NAME/u);
	assert.match(SOURCES.looseWork, /kind: "pull-request"/u);
	assert.match(SOURCES.looseWork, /kind: "agent-session"/u);
	assert.match(SOURCES.looseWork, /kind: "commit"/u);
	assert.match(SOURCES.looseWork, /host: "local"/u);
	assert.doesNotMatch(SOURCES.rail, /PulseLooseWorkRow|suggestedAction/u);
	assert.doesNotMatch(SOURCES.rail, /Create work item|AvatarGroup|CheckMarkIcon/u);
});

test("Pulse header roster locks one SSR and first-render structure", async () => {
	const { renderRosterMarkup } = await loadRosterMarkupHarness();
	const serverMarkup = renderRosterMarkup();

	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/facepile=\{isPulse \? \(\s*<PulseRosterFacepile[\s\S]*members=\{PULSE_TIMELINE\.members\}[\s\S]*\/>\s*\) : undefined\}/u,
	);
	assert.match(EXPERIMENTAL_HEADER_SOURCE, /\{facepile \?\? \(/u);
	assert.match(serverMarkup, /data-slot="avatar-group" role="group" aria-label="Filter by person or agent"/u);
	assert.equal([...serverMarkup.matchAll(/<button /gu)].length, 7);
	assert.equal([...serverMarkup.matchAll(/aria-pressed="false"/gu)].length, 7);
	assert.match(serverMarkup, /aria-label="Show only Venn, Software engineer"/u);
	assert.match(serverMarkup, /aria-label="Show only Maya Ferreira, Staff engineer"/u);
	assert.doesNotMatch(serverMarkup, /Board assignees|data-unassigned|aria-label="Unassigned"/u);
});

test("Pulse is a toggle on the board's own control row, not a separate tab", () => {
	// Pulse is a lens over the board rather than a sibling view, so it is a
	// pressed toggle beside Filter and Group. The retired tab component would
	// have put the filter facepile and the mode switch on two different rows.
	assert.match(PULSE_MODE_CONTROLS_SOURCE, /export type ExperimentalJiraKanbanMode = "board" \| "pulse";/u);
	assert.match(PULSE_MODE_CONTROLS_SOURCE, /export function PulseModeToggle\(/u);
	assert.match(PULSE_MODE_CONTROLS_SOURCE, /aria-pressed=\{active\}/u);
	assert.match(
		PULSE_MODE_CONTROLS_SOURCE,
		/>\s*Insights\s*\{unreadCount > 0 \? <Badge variant="information">\{unreadCount\}<\/Badge> : null\}/u,
	);
	assert.ok(!existsSync(join(PULSE_DIR, "..", "experimental-view-tabs.tsx")), "the tab component should be retired, not left beside its replacement");

	assert.match(EXPERIMENTAL_PAGE_SOURCE, /const ExperimentalPulse = dynamic\(\(\) => import\("\.\/pulse\/experimental-pulse"\)\.then\(\(module\) => module\.ExperimentalPulse\)\);/u);
	// The mode may be driven from outside — the route mounts a floating insights
	// nudge that opens Insights — so the local state is the fallback half of a
	// controlled pair rather than the only owner.
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /const \[localMode, setLocalMode\] = useState<ExperimentalJiraKanbanMode>\("board"\);/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /const mode = controlledMode \?\? localMode;/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /const isPulse = insightsEnabled && mode === "pulse";/u);
	// The control row stays up in Pulse. Board mode keeps the board assignee
	// facepile, with Venn promoted so the presentation persona is visible;
	// Pulse swaps in its roster. Both faces write the same Filter assignee field.
	assert.doesNotMatch(EXPERIMENTAL_PAGE_SOURCE, /showBoardControls=\{!isPulse\}/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /<PulseModeToggle/u);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/facepile=\{isPulse \? \(\s*<PulseRosterFacepile[\s\S]*members=\{PULSE_TIMELINE\.members\}[\s\S]*\/>\s*\) : undefined\}/u,
	);
	assert.match(EXPERIMENTAL_HEADER_SOURCE, /facepile\?: ReactNode;/u);
	assert.match(EXPERIMENTAL_HEADER_SOURCE, /modeToggle\?: ReactNode;/u);
	assert.match(EXPERIMENTAL_HEADER_SOURCE, /\{facepile \?\? \(/u);
});

test("Experimental board consumers can disable the complete Insights surface", () => {
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /insightsEnabled\?: boolean;/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /insightsEnabled = true/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /const isPulse = insightsEnabled && mode === "pulse";/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /modeToggle=\{insightsEnabled \? \(/u);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/if \(insightsEnabled && \(fieldId === "parent" \|\| fieldId === "sprint"\)\)/u,
	);
});

test("the pressed Insights label uses selected blue text on its selected surface", () => {
	assert.match(
		PULSE_MODE_CONTROLS_SOURCE,
		/border-border-selected text-text-selected! \[&_svg\]:text-icon-selected!/u,
	);
	assert.doesNotMatch(PULSE_MODE_CONTROLS_SOURCE, /text-text-accent-blue-bolder/u);
});

test("Experimental board mode supports controlled and uncontrolled composition", () => {
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /mode\?: ExperimentalJiraKanbanMode;/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /onModeChange\?: \(mode: ExperimentalJiraKanbanMode\) => void;/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /mode: controlledMode,/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /const \[localMode, setLocalMode\] = useState<ExperimentalJiraKanbanMode>\("board"\);/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /const mode = controlledMode \?\? localMode;/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /if \(controlledMode === undefined\) \{\s*setLocalMode\(nextMode\);\s*\}/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /onModeChange\?\.\(nextMode\);/u);
});

test("Insights routes only opted-in work items and local sessions", () => {
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /onInsightsWorkItemClick\?: \(workItem: PulseWorkItem\) => void;/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /isInsightsWorkItemInteractive\?: \(workItem: PulseWorkItem\) => boolean;/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /onContinueLooseWork\?: \(item: PulseLooseWork\) => void;/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /onContinue: onContinueLooseWork,/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /onResumeLooseWork\?: \(item: PulseLooseWork\) => void;/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /isLooseWorkResumable\?: \(item: PulseLooseWork\) => boolean;/u);
	assert.match(SOURCES.rail, /data-work-item-key=\{workItem\.key\}/u);
	assert.match(SOURCES.rail, /const isInteractive = onWorkItemClick !== undefined/u);
	assert.match(SOURCES.rail, /isWorkItemInteractive\?\.\(workItem\) \?\? true/u);
	assert.match(SOURCES.rail, /onClick=\{isInteractive \? \(\) => onWorkItemClick\(workItem\) : undefined\}/u);
	assert.match(SOURCES.rail, /disabled=\{!isInteractive\}/u);
	assert.match(SOURCES.rail, /showMoreAction=\{false\}/u);
	assert.match(SOURCES.rail, /tabIndex=\{isInteractive \? undefined : -1\}/u);
	assert.match(SOURCES.rail, /data-loose-work-id=\{item\.id\}/u);
	// Session row -> loose work resolution and the resume gate moved into the
	// shared adapter, so the rail and the v2 board's untracked-work column
	// cannot drift apart on either rule.
	assert.match(SOURCES.sessions, /looseWork\.filter\(isPulseAgentSession\)/u);
	assert.match(SOURCES.sessions, /isLooseWorkResumable\?\.\(session\) \?\? true/u);
	assert.match(SOURCES.rail, /toPulseSessionHandlers/u);
	assert.match(SOURCES.sessions, /onContinueInAgent: continueSession,/u);
	assert.match(SOURCES.sessions, /onView: onResume === undefined \? undefined : \(item: AgentSessionItem\)/u);
	assert.doesNotMatch(SOURCES.rail, /canViewItem=/u);
	assert.match(SOURCES.stream, /onWorkItemClick\?: \(workItem: PulseWorkItem\) => void;/u);
	assert.match(SOURCES.stream, /onViewAttention=\{handleViewAttention\}/u);
	assert.match(SOURCES.shell, /<PulseStream[\s\S]*onWorkItemClick=\{onWorkItemClick\}/u);
});

test("Insights owns the unread activity pill instead of a separate Timeline button", async () => {
	const { renderInsightsToggleMarkup } = await loadInsightsToggleMarkupHarness();
	const unread = renderInsightsToggleMarkup({ unreadCount: 3 });
	const idle = renderInsightsToggleMarkup({ unreadCount: 0 });
	const pressed = renderInsightsToggleMarkup({ active: true, unreadCount: 0 });

	assert.match(unread, /aria-label="Insights, 3 new updates since you last viewed"/u);
	assert.match(unread, /aria-pressed="false"/u);
	assert.match(unread, />Insights</u);
	assert.match(unread, /data-slot="badge">3</u);
	assert.doesNotMatch(unread, /Timeline/u);

	assert.doesNotMatch(idle, /aria-label=/u);
	assert.doesNotMatch(idle, /data-slot="badge"/u);
	assert.match(idle, />Insights</u);

	assert.match(pressed, /aria-pressed="true"/u);
	assert.doesNotMatch(pressed, /data-slot="badge"/u);
});

test("Experimental board header keeps Filter clickable and badges new timeline activity", () => {
	assert.match(EXPERIMENTAL_HEADER_SOURCE, /filterControl\?: ReactNode;/u);
	assert.match(EXPERIMENTAL_HEADER_SOURCE, /endSlot\?: ReactNode;/u);
	assert.match(EXPERIMENTAL_HEADER_SOURCE, /\{filterControl\}/u);
	assert.match(EXPERIMENTAL_HEADER_SOURCE, /\{endSlot \? endSlot : null\}/u);
	assert.match(
		EXPERIMENTAL_HEADER_SOURCE,
		/if \(!onSelectedAssigneeIdsChange\) \{\s*return \(\s*<span className="rounded-full">/u,
	);
	assert.doesNotMatch(EXPERIMENTAL_HEADER_SOURCE, /disableAssigneeFilter|aria-disabled[\s\S]*Filter board is unavailable/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /<BoardFilterPopover/u);
	assert.doesNotMatch(EXPERIMENTAL_PAGE_SOURCE, /TimelineActivityBadge|timeline-activity-badge/u);
	assert.ok(
		!existsSync(join(EXPERIMENTAL_DIR, "components", "timeline-activity-badge.tsx")),
		"the standalone Timeline button should be deleted, not parked",
	);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /unreadCount=\{isPulse \? 0 : timelineUnreadCount\}/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /useBoardFilter\(/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /filterPulseTimelineByDays/u);
	assert.match(
		readFileSync(join(EXPERIMENTAL_DIR, "data", "board-filter-options.ts"), "utf8"),
		/Filter by days/u,
	);
	assert.match(
		readFileSync(join(EXPERIMENTAL_DIR, "components", "board-filter-popover.tsx"), "utf8"),
		/aria-expanded=\{model\.open\}[\s\S]*aria-label=\{filterLabel\}[\s\S]*aria-pressed=\{hasSelection \|\| model\.open\}/u,
	);
	assert.doesNotMatch(
		readFileSync(join(EXPERIMENTAL_DIR, "components", "board-filter-popover.tsx"), "utf8"),
		/Filter board is unavailable/u,
	);
});

test("Kanban column add-agent controls use the AI agent add icon", () => {
	assert.match(DEFAULT_BOARD_SOURCE, /import AiAgentAddIcon from "@atlaskit\/icon-lab\/core\/ai-agent-add"/u);
	assert.match(DEFAULT_BOARD_SOURCE, /render=\{<AiAgentAddIcon label="" \/>\}/u);
	assert.doesNotMatch(DEFAULT_BOARD_SOURCE, /import AiAgentIcon from "@atlaskit\/icon\/core\/ai-agent"/u);
	const experimentalBoard = [
		readFileSync(join(EXPERIMENTAL_DIR, "experimental-jira-kanban.tsx"), "utf8"),
		readFileSync(join(EXPERIMENTAL_DIR, "components", "board-column-agent-assignment.tsx"), "utf8"),
	].join("\n");
	assert.match(experimentalBoard, /import AiAgentAddIcon from "@atlaskit\/icon-lab\/core\/ai-agent-add"/u);
	assert.match(experimentalBoard, /render=\{<AiAgentAddIcon label="" \/>\}/u);
	assert.doesNotMatch(experimentalBoard, /import AiAgentIcon from "@atlaskit\/icon\/core\/ai-agent"/u);
});

test("Pulse keeps one member filter on the header facepile, not the story attribution faces", () => {
	// One selection, two places it can be driven from: the header facepile and
	// the story's own clear control. Attribution faces under the headline name
	// who worked in the window; they are not a second roster.
	// The filter used to be one more thing `usePulseTimeline` owned; it is its
	// own hook now, so exactly one hook owns each piece of state and the shell
	// can resolve the filter first — the reading position re-keys on it.
	assert.match(SOURCES.hook, /export function usePulseMemberFilter\(/u);
	assert.match(SOURCES.hook, /const isControlled = selectedMemberId !== undefined;/u);
	assert.match(SOURCES.hook, /onSelectedMemberIdChange\?\.\(memberId\);/u);
	assert.match(SOURCES.hook, /export interface PulseTimelineOptions/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /toPulseMemberId\(selectedAssigneeIds, PULSE_MEMBER_IDS\)/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /toInsightsAssigneeIds\(selectedAssigneeIds, PULSE_MEMBER_IDS\)/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /insightsDefaultAssigneeIds\?: readonly string\[\];/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /: new Set\(insightsDefaultAssigneeIds\);/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /controlledMode === "pulse"[\s\S]*markTimelineViewed\(PULSE_TIMELINE\)/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /handlePulseMemberChange/u);
	assert.doesNotMatch(EXPERIMENTAL_PAGE_SOURCE, /const \[pulseMemberId, setPulseMemberId\] = useState<string \| null>\(null\);/u);
	assert.match(SOURCES.shell, /usePulseMemberFilter\(\{ onSelectedMemberIdChange, selectedMemberId \}\)/u);
	// Composition order is the contract: filter, then reading position, then pure
	// derivation on top of both. Reversing any two of them puts the old circular
	// dependency back.
	const shellOrder = ["usePulseMemberFilter(", "usePulseReading(", "usePulseTimeline("]
		.map((call) => SOURCES.shell.indexOf(call));
	assert.deepEqual([...shellOrder].sort((a, b) => a - b), shellOrder, "the shell composes its hooks out of order");
	assert.ok(shellOrder.every((index) => index > 0));
	assert.match(PULSE_MODE_CONTROLS_SOURCE, /export function PulseRosterFacepile\(/u);
	// The shared group supplies the shape-aware separator to nested hexagons,
	// while fixed-size flex buttons remove inline baseline drift between SVG
	// agents and photo-backed humans.
	assert.match(PULSE_MODE_CONTROLS_SOURCE, /import \{ Avatar, AvatarFallback, AvatarGroup, AvatarImage \} from "@\/components\/ui\/avatar";/u);
	assert.match(PULSE_MODE_CONTROLS_SOURCE, /<AvatarGroup[\s\S]*className=\{JIRA_KANBAN_HEADER_FACEPILE_CLASS_NAME\}/u);
	assert.match(PULSE_MODE_CONTROLS_SOURCE, /className="focus-visible:ring-ring\/50 flex size-6 shrink-0 items-center justify-center/u);
	assert.match(PULSE_MODE_CONTROLS_SOURCE, /member\.kind === "human" \? "ring-2 ring-surface" : null/u);
	assert.doesNotMatch(PULSE_MODE_CONTROLS_SOURCE, /"ring-2 ring-surface transition-opacity/u);
	// The contributor facepile uses the same primitive and a 16px wrapper.
	// Keeping the avatar as a direct child of a 16px flex span removes the
	// inline list baseline that made the old row 29px and top-heavy.
	assert.match(SOURCES.story, /import \{ Avatar, AvatarFallback, AvatarGroup, AvatarImage \} from "@\/components\/ui\/avatar";/u);
	assert.match(SOURCES.story, /<span aria-hidden className=\{cn\("shrink-0", PULSE_ROW_META\)\}>By<\/span>/u);
	assert.match(SOURCES.story, /<AvatarGroup[\s\S]*label="By contributors in this window"[\s\S]*size="xs"/u);
	assert.match(SOURCES.story, /className="flex size-4 shrink-0 items-center justify-center"/u);
	assert.match(SOURCES.story, /size="xs"/u);
	assert.match(SOURCES.story, /member\.kind === "human" \? "ring-2 ring-surface" : undefined/u);
	assert.doesNotMatch(SOURCES.story, /ring-border-selected!/u);
	assert.doesNotMatch(SOURCES.story, /Clear filter:/u);
	assert.doesNotMatch(SOURCES.story, /"duration-normal ease-out-practical ring-2 ring-surface transition-opacity/u);
	// Agents keep the hexagon everywhere the roster is drawn.
	assert.match(PULSE_MODE_CONTROLS_SOURCE, /shape=\{member\.kind === "agent" \? "hexagon" : "circle"\}/u);
	assert.match(SOURCES.story, /shape=\{member\.kind === "agent" \? "hexagon" : "circle"\}/u);
	assert.match(SOURCES.rail, /assigneeAvatarShape=\{face\.kind === "agent" \? "hexagon" : "circle"\}/u);
});

test("Pulse stays inside the experimental variant", () => {
	// `lib/` and the reading hook arrived with the continuous article, so the
	// containment check has to name them too.
	const pulseImport = /pulse\/(?:experimental-pulse|components|data|hooks|lib|types)|ExperimentalPulse|PULSE_TIMELINE|usePulseTimeline|usePulseReading|buildPulseOutline/u;

	for (const [name, source] of [
		["index.tsx", DEFAULT_BOARD_SOURCE],
		["page.tsx", DEFAULT_PAGE_SOURCE],
		["board-header.tsx", DEFAULT_HEADER_SOURCE],
	]) {
		assert.doesNotMatch(source, pulseImport, `the default ${name} reaches into Pulse`);
		assert.doesNotMatch(source, /experimental/iu, `the default ${name} reaches into the experimental variant`);
	}

	// Pulse only imports from the experimental tree and shared primitives, never
	// from the default variant's board or header.
	for (const [name, source] of Object.entries(SOURCES)) {
		assert.doesNotMatch(source, /from "\.\.\/\.\.\/(?:board-header|page)"/u, `${name} imports the default variant`);
		assert.doesNotMatch(
			source,
			/from "@\/components\/blocks\/jira-kanban\/(?:board-header|page)"/u,
			`${name} imports the default variant`,
		);
	}
});

test("Pulse tiles three columns full-bleed, with the story taking the slack", () => {
	const pxValue = (source, pattern) => {
		const match = source.match(pattern);
		assert.ok(match, `expected ${pattern} in the source`);
		return Number.parseInt(match[1], 10);
	};

	// Full-bleed by design: capping the row would strand the combined work rail
	// against the right edge on a wide screen. The story is the only flexible
	// column, and its prose measure is capped separately inside PulseStory.
	assert.match(SOURCES.shell, /const SHELL_MEASURE = "w-full min-w-0";/u);
	// The article is the flexible column and the one real scrollport. It used to
	// scroll only from `lg` up, with the page scrolling everything below it;
	// `usePulseReading` listens on the scrollport element, so under the stacked
	// layout the compact ruler would neither follow nor jump. It is a bounded
	// reading pane below `lg` instead — a ruler whose marks do nothing is worse
	// than a nested scroll region.
	//
	// The column is a flex column holding two children now: the bounded
	// scrollport and the ask dock beneath it. The dock is a static sibling
	// rather than a sticky overlay, so the article's own bottom fade stays the
	// only seam between them.
	assert.match(
		SOURCES.shell,
		/className="flex min-h-0 min-w-0 flex-1 flex-col lg:mr-10 lg:h-full"/u,
		"the article column is the flexible one",
	);
	// `flex-1 min-h-0` and not `h-full`. A percentage height needs a containing
	// block with a *specified* height; this wrapper's comes from `max-height`
	// clamping a flex-grown box, which is definite enough for flexbox and not
	// for percentage resolution. Under `lg` the scrollport fell back to `auto`,
	// grew to the article's full ~12,700px, and painted out of its
	// `overflow: visible` parent straight over the ask dock beneath it.
	assert.match(
		SOURCES.shell,
		/className="relative -m-1 flex max-h-\[70svh\] min-h-0 min-w-0 flex-1 flex-col lg:max-h-none"/u,
		"the scrollport stays a bounded reading pane below lg",
	);
	assert.match(
		SOURCES.shell,
		/className="min-h-0 flex-1 overflow-y-auto p-1 lg:overscroll-y-contain lg:pr-10 lg:pb-6"/u,
		"the nested region is the reading scrollport, bounded by flex and not by a percentage",
	);
	assert.doesNotMatch(
		SOURCES.shell,
		/className="h-full overflow-y-auto/u,
		"a percentage height cannot bound the reading pane under lg",
	);
	assert.match(
		SOURCES.shell,
		/className="min-w-0 shrink-0 px-1 lg:pr-10"/u,
		"the ask dock is a static sibling on the article's own horizontal rails",
	);
	assert.doesNotMatch(
		SOURCES.shell,
		/className="[^"]*\b(?:sticky|fixed)\b/u,
		"the dock must not overlay the article — the bottom fade is the seam",
	);
	assert.doesNotMatch(SOURCES.shell, /lg:max-w-\[[\d.]+rem\] lg:overflow-y-auto/u, "the story must not re-cap itself in the shell");
	assert.match(SOURCES.story, /const MEASURE = "max-w-\[36rem\]";/u, "the prose measure still holds at 576px");
	assert.match(
		SOURCES.stream,
		/className=\{cn\("mx-auto flex min-w-0 flex-col", MEASURE\)\}/u,
		"the article column is centered in the scrollport at the prose measure",
	);

	const scrubber = pxValue(SOURCES.scrubber, /className="pointer-events-none relative h-full min-h-\[24rem\] w-(\d+)"/u) * 4;
	assert.strictEqual(scrubber, 144);

	// The work rail defaults to 320 / 8 / 300 and is resizable from `lg`. The
	// story remains the flexible column; one handle lives in the 40px article
	// gutter, as a sibling of the overflow grid.
	assert.match(SOURCES.rail, /lg:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1fr\)\]/u);
	assert.match(SOURCES.rail, /lg:w-\[var\(--pulse-work-rail-width\)\]/u);
	assert.match(SOURCES.rail, /lg:box-content/u, "padding sits outside the track measure so overflow-y cannot clip the uncaptured stroke");
	assert.match(SOURCES.rail, /grid-cols-1 gap-10/u, "40px stacked gutter below lg");
	assert.match(SOURCES.rail, /lg:gap-2/u, "8px gutter matching experimental kanban columns");
	assert.match(SOURCES.rail, /testId="jira-pulse-insights-resize-handle"/u);
	assert.doesNotMatch(SOURCES.rail, /testId="jira-pulse-work-items-resize-handle"/u);
	assert.match(SOURCES.rail, /ariaLabel="Resize insights and work items"/u);
	assert.doesNotMatch(SOURCES.rail, /ariaLabel="Resize work items and uncaptured work"/u);
	assert.equal(
		[...SOURCES.rail.matchAll(/<PulseResizeHandle/gu)].length,
		1,
		"only the insights/work-items gutter carries a resize handle",
	);
	assert.match(SOURCES.rail, /after:w-10/u, "the insights handle's hit area covers the 40px article gutter");
	assert.match(SOURCES.rail, /left-\[-1\.25rem\]!/u, "the insights handle sits in the centre of the article gutter");
	assert.match(SOURCES.rail, /group-hover\/pulse-work-rail:\[&>div\]:opacity-100/u, "the pill reveals while the work rail is hovered");
	assert.match(
		SOURCES.resizeHandle,
		/bg-transparent! hover:bg-transparent! data-\[active\]:bg-transparent!/u,
		"the 1px track never paints a full-height separator",
	);
	assert.match(
		SOURCES.resizeHandle,
		/\[&>div\]:origin-center \[&>div\]:bg-neutral-100/u,
		"the pill is a grey bar when revealed",
	);
	assert.match(
		SOURCES.resizeHandle,
		/focus-visible:\[&>div\]:opacity-100/u,
		"keyboard focus still reveals the pill without pointer hover",
	);
	assert.match(
		SOURCES.resizeHandle,
		/hover:\[&>div\]:scale-105 hover:\[&>div\]:bg-bg-selected-bold/u,
		"the pill turns blue and scales on hover",
	);
	assert.doesNotMatch(SOURCES.shell, /lg:w-10 lg:shrink-0/u, "the inter-column spacer left with the two independent rails");
	assert.match(SOURCES.shell, /<PulseWorkRail/u);
	assert.match(SOURCES.rail, /chat === undefined \?/u, "the work rail swaps cards for embedded chat");
	assert.match(SOURCES.rail, /data-pulse-embedded-chat=""/u);
	assert.match(SOURCES.shell, /<PulseEmbeddedChat/u);
	assert.match(SOURCES.shell, /lg:mr-10/u, "the article scrollport keeps a 40px gutter before the work rail");
	assert.match(SOURCES.shell, /lg:pr-10/u, "the story content remains inset from its scrollbar");
	assert.match(SOURCES.shell, /lg:h-full lg:min-h-0 lg:flex-row/u);
});

test("Pulse Insights hides the viewport Rovo launcher and embeds chat in the work rail", () => {
	assert.match(SOURCES.chatContext, /PULSE_OPEN_DATASET_KEY = "jiraPulseOpen"/u);
	assert.match(
		SOURCES.insightsChat,
		/document\.documentElement\.dataset\[PULSE_OPEN_DATASET_KEY\] = "true"/u,
	);
	assert.match(SOURCES.insightsChat, /openChat\("floating"\)/u);
	assert.match(SOURCES.insightsChat, /sendPrompt\(question\)/u);
	assert.match(SOURCES.embeddedChat, /placement="embedded"/u);
	assert.match(SOURCES.embeddedChat, /showAgentBackButton=\{false\}/u);
	assert.match(SOURCES.embeddedChat, /headerClassName=\{PULSE_EMBEDDED_CHAT_HEADER_CLASS\}/u);
	assert.match(SOURCES.embeddedChat, /compactHeader/u);
	assert.match(SOURCES.embeddedChat, /overflow-visible/u);
	assert.match(SOURCES.layout, /PULSE_EMBEDDED_CHAT_HEADER_CLASS = "h-6 px-1 py-0"/u);
	assert.doesNotMatch(SOURCES.embeddedChat, /FloatingRovoButton/u);
	assert.doesNotMatch(SOURCES.shell, /FloatingRovoButton/u);
	assert.match(SOURCES.shell, /insightsChatEnabled \? undefined : \(/u, "article answers stay the no-chat fallback");
});

test("Pulse scroll surface keeps a 24px content-side inset at the bottom", () => {
	// Artifacts / last work-item cards used to sit flush with the fold because
	// `lg:overflow-hidden` clipped the padded row. The inset is `pb-6`
	// (space.300) on the scroll content, not a collapsing spacer, and the
	// surface keeps `overflow-y-auto` so that gap stays visible at max scroll.
	assert.match(
		SOURCES.shell,
		/className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-6 pt-10 lg:pt-12"/u,
		"the fold surface stays the scroll owner at every width",
	);
	assert.doesNotMatch(SOURCES.shell, /lg:overflow-hidden/u, "hidden overflow must not clip the 24px inset");
	assert.match(
		SOURCES.shell,
		/flex flex-col gap-10 pb-6 lg:h-full lg:min-h-0 lg:flex-row lg:gap-0/u,
		"the row carries pb-6 (24px) on the scroll content and stays fold-height at lg",
	);
	assert.doesNotMatch(SOURCES.shell, /px-6 py-10 lg:overflow-hidden lg:py-12/u);
});

test("Pulse eyebrow and section labels match the Activity heading rung", () => {
	// Both tokens share the work-item Activity treatment: 12px semibold,
	// sentence case, no tracking. They are defined once and imported everywhere.
	const type = readFileSync(join(PULSE_DIR, "components", "pulse-type.ts"), "utf8");
	assert.match(type, /PULSE_EYEBROW =\s*\n?\s*"text-xs leading-4 font-semibold text-text-subtlest"/u);
	assert.match(type, /PULSE_SECTION_LABEL =\s*\n?\s*"text-xs leading-4 font-semibold text-text-subtlest"/u);
	assert.match(type, /PULSE_ITEM_TITLE = "text-sm font-medium leading-5 tracking-\[-0\.006em\] text-text"/u);
	assert.doesNotMatch(type, /PULSE_EYEBROW[\s\S]*?uppercase/u);
	assert.doesNotMatch(type, /PULSE_SECTION_LABEL[\s\S]*?uppercase/u);

	for (const [name, source] of [["rail", SOURCES.rail], ["signals", SOURCES.signals], ["story", SOURCES.story]]) {
		assert.doesNotMatch(source, /text-\[11px\] font-semibold uppercase[^"]*text-text-subtlest/u, `${name} re-declares a label rung`);
		assert.doesNotMatch(source, /tracking-\[0\.14em\]|tracking-\[0\.12em\]|tracking-\[0\.09em\]|tracking-\[0\.06em\]/u, `${name} keeps a retired label rung`);
		assert.doesNotMatch(source, /uppercase/u, `${name} does not uppercase labels`);
	}
	// The eyebrow names the chapter and when this outcome was last updated.
	// A roster filter must not prefix the selected member — that name lives
	// on the facepile, not in this label.
	assert.match(SOURCES.story, /className=\{cn\("min-w-0 truncate", PULSE_EYEBROW\)\}/u);
	assert.match(SOURCES.story, /toPulseInsightEyebrow\(snapshot\)/u);
	assert.doesNotMatch(SOURCES.story, /toPulseInsightEyebrow\(snapshot, member/u);
	assert.match(SOURCES.marks, /export function toPulseInsightEyebrow\(snapshot: PulseInsightEyebrow\): string/u);
	assert.doesNotMatch(SOURCES.marks, /memberName \? `\$\{memberName\} · \$\{base\}`/u);
	assert.match(SOURCES.story, /toPulseInsightHeadline\(snapshot, contribution\)/u);
	assert.doesNotMatch(SOURCES.story, /headline = member === null \? snapshot\.title : member\.name/u);
	assert.doesNotMatch(SOURCES.story, /snapshot\.rangeLabel/u);
	// Row data is not a label: the quiet marker and the group names are sentence
	// case. The roster's own group labels left with it, and so did the "3 of 7"
	// counter that sat beside the retired chevrons — the reading position is
	// carried by the ruler's pill and the article's own status now, neither of
	// which is a rung on this scale.
	assert.match(PULSE_MODE_CONTROLS_SOURCE, /title=\{`\$\{member\.name\} · \$\{member\.role\}`\}/u);
	assert.doesNotMatch(PULSE_MODE_CONTROLS_SOURCE, /uppercase/u);
	assert.doesNotMatch(SOURCES.story, /tabular-nums text-text-subtlest"/u, "the snapshot counter left with the chevrons");
	assert.doesNotMatch(SOURCES.stream, /uppercase/u, "the article's separators are rules, not labels");
	// The epic brief still hangs keys off a reserved track. Actions left that
	// row shape for the shared next-best-action block.
	assert.match(type, /PULSE_ROW_KEY_TRACK =\s*\n?\s*"mt-0\.5 w-16 shrink-0/u);
	assert.doesNotMatch(type, /PULSE_ROW_ACTION_TRACK/u);
	assert.doesNotMatch(SOURCES.signals, /PULSE_ROW_KEY_TRACK/u);
	assert.doesNotMatch(SOURCES.signals, /PULSE_ROW_ACTION_TRACK/u);
	assert.doesNotMatch(SOURCES.signals, /border-l-2/u, "the two signal sections share one list rhythm");
	// Section labels restate their sentence-case name for the accessibility tree.
	assert.match(SOURCES.signals, /<h3 aria-label=\{children\}/u);
	assert.match(SOURCES.rail, /<PulseSectionLabel>\{label\}<\/PulseSectionLabel>/u);
	// Prose is set to avoid one-word last lines rather than balanced into a
	// bottom-heavy rag.
	assert.doesNotMatch(SOURCES.story, /text-balance/u);
	assert.match(SOURCES.story, /text-base\/6 tracking-\[-0\.011em\] text-pretty text-text/u);
	assert.match(SOURCES.story, /className=\{cn\("mt-6 text-pretty text-text", MEASURE\)\}/u);
	// Eyebrow → title → contributors. Kickoff line to title is `mt-6` (24px);
	// title to the By row is `mt-4` (16px).
	assert.match(
		SOURCES.story,
		/<p className=\{cn\("min-w-0 truncate", PULSE_EYEBROW\)\}>\{eyebrow\}<\/p>[\s\S]*<h2 className=\{cn\("mt-6 text-pretty text-text", MEASURE\)\}[\s\S]*<div className="mt-4 min-w-0">\s*<PulseStoryContributors/u,
	);
	assert.doesNotMatch(
		SOURCES.story,
		/<PulseStoryContributors[\s\S]*<h2 className=\{cn\("mt-6 text-pretty text-text", MEASURE\)\}/u,
	);
});
