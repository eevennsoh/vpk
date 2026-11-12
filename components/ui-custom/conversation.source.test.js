const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const CONVERSATION_SOURCE = fs.readFileSync(
	path.join(__dirname, "conversation.tsx"),
	"utf8",
);

test("Conversation resize follow yields while the user is actively scrolling", () => {
	assert.doesNotMatch(
		CONVERSATION_SOURCE,
		/initial === false \|\| hasInitializedScrollRef\.current/,
	);
	assert.match(
		CONVERSATION_SOURCE,
		/hasInitializedScrollRef\.current = true\s+if \(initial === false\)/,
	);
	assert.match(
		CONVERSATION_SOURCE,
		/const hasActiveUserScrollIntent = useCallback\(\(\) => \{[\s\S]*lastUserScrollIntentAtRef\.current <= USER_SCROLL_INTENT_TIMEOUT_MS/,
	);
	assert.match(
		CONVERSATION_SOURCE,
		/const didUserInitiateScroll = hasActiveUserScrollIntent\(\)/,
	);
	assert.match(
		CONVERSATION_SOURCE,
		/if \(didUserInitiateScroll\) \{\s+isFollowPausedRef\.current = !nextIsAtBottom\s+return\s+\}/,
	);
	assert.doesNotMatch(CONVERSATION_SOURCE, /const expectedFollowTop = getScrollTargetTop\(scrollElement\)/);
	assert.match(
		CONVERSATION_SOURCE,
		/const shouldYieldToUserScroll =\s*hasInitializedScrollRef\.current && hasActiveUserScrollIntent\(\)/,
	);
	assert.match(
		CONVERSATION_SOURCE,
		/const shouldFollowContent =\s*!shouldYieldToUserScroll &&/,
	);
});

test("Conversation scroll indicator resolves against the actual bottom", () => {
	assert.doesNotMatch(CONVERSATION_SOURCE, /getExpectedFollowTop/);
	assert.match(
		CONVERSATION_SOURCE,
		/const actualBottomTop = getDefaultTargetTop\(scrollElement\)/,
	);
	assert.match(
		CONVERSATION_SOURCE,
		/const distanceFromActualBottom = Math\.abs\(scrollElement\.scrollTop - actualBottomTop\)/,
	);
	assert.match(
		CONVERSATION_SOURCE,
		/const nextIsAtBottom = distanceFromActualBottom <= DEFAULT_SCROLL_THRESHOLD_PX/,
	);
});

test("Conversation only uses a custom target while target follow mode is active", () => {
	assert.match(
		CONVERSATION_SOURCE,
		/if \(resolvedFollowMode === "target" && targetScrollTop\) \{\s+return targetScrollTop\(defaultTargetTop, \{ scrollElement \}\)\s+\}/,
	);
	assert.match(
		CONVERSATION_SOURCE,
		/return defaultTargetTop/,
	);
	assert.match(
		CONVERSATION_SOURCE,
		/const targetTop = targetMode === "bottom"\s+\? getDefaultTargetTop\(scrollElement\)\s+\: getScrollTargetTop\(scrollElement\)/,
	);
	assert.match(
		CONVERSATION_SOURCE,
		/void scrollToBottom\(\{ ignoreEscapes: true, target: "bottom" \}\)/,
	);
});

test("Conversation resize follow uses the active follow target while content streams", () => {
	assert.doesNotMatch(CONVERSATION_SOURCE, /shouldFollowActualBottomRef/);
	assert.match(CONVERSATION_SOURCE, /resize = "smooth"/);
	assert.match(CONVERSATION_SOURCE, /resizeTarget = "follow"/);
	assert.match(
		CONVERSATION_SOURCE,
		/lastKnownScrollHeightRef\.current = nextScrollHeight\s+if \(resize === false \|\| !shouldFollowContent\) \{\s+updateIsAtBottom\(\)\s+return\s+\}/,
	);
	assert.match(
		CONVERSATION_SOURCE,
		/void scrollToBottom\(\{ animation: resize, target: resizeTarget \}\)/,
	);
});

test("Conversation gives its scroll viewport a constrained flex height", () => {
	assert.match(
		CONVERSATION_SOURCE,
		/className=\{cn\("relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden", className\)\}/,
	);
	assert.match(
		CONVERSATION_SOURCE,
		/className="min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto scrollbar-auto-hide"/,
	);
	assert.doesNotMatch(
		CONVERSATION_SOURCE,
		/className="h-full w-full overflow-x-hidden overflow-y-auto scrollbar-auto-hide"/,
	);
});

test("Conversation can opt out of the reserved scrollbar gutter", () => {
	assert.match(
		CONVERSATION_SOURCE,
		/reserveScrollbarGutter\?: boolean/,
	);
	assert.match(
		CONVERSATION_SOURCE,
		/reserveScrollbarGutter = true/,
	);
	assert.match(
		CONVERSATION_SOURCE,
		/scrollbarGutter: reserveScrollbarGutter \? undefined : "auto"/,
	);
});

test("Conversation can keep the auto-hidden scrollbar from revealing", () => {
	assert.match(
		CONVERSATION_SOURCE,
		/revealScrollbarOnScroll\?: boolean/,
	);
	assert.match(
		CONVERSATION_SOURCE,
		/revealScrollbarOnScroll = true/,
	);
	assert.match(
		CONVERSATION_SOURCE,
		/if \(!revealScrollbarOnScroll\) \{[\s\S]*el\.removeAttribute\("data-scrolling"\)[\s\S]*return[\s\S]*\}/u,
	);
});

test("Conversation only fades edges when overflow is actually scrolled", () => {
	// Bottom fade requires real overflow with content still hidden below.
	assert.match(
		CONVERSATION_SOURCE,
		/const maskImage = context\?\.showBottomScrollMask\s*\?\s*"linear-gradient\(to bottom, black 92%, transparent 100%\)"\s*:\s*undefined/,
	);
	assert.match(CONVERSATION_SOURCE, /maskImage,\s+WebkitMaskImage: maskImage,/);
	assert.match(CONVERSATION_SOURCE, /getVerticalOverflowState/);
	assert.match(CONVERSATION_SOURCE, /showTopScrollMask/);
	assert.match(CONVERSATION_SOURCE, /showBottomScrollMask/);
	// Top fade under chrome stays off until the thread has been scrolled from the top.
	assert.match(
		CONVERSATION_SOURCE,
		/<StickyRowScrollFade[\s\S]*className=\{cn\("top-0 z-10", showTopScrollMask \? "opacity-100" : null\)\}[\s\S]*data-slot="conversation-top-scroll-fade"/,
	);
	// Guard against reverting to an always-on mask in the inline style object.
	assert.doesNotMatch(
		CONVERSATION_SOURCE,
		/maskImage: "linear-gradient\(to bottom, black 92%, transparent 100%\)"/,
	);
});
