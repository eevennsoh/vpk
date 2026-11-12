const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const USE_SCROLL_ANCHOR_SOURCE = fs.readFileSync(
	path.join(__dirname, "use-scroll-anchor.ts"),
	"utf8",
);

test("compact chat scroll anchor uses the Rovo bottom/target follow lifecycle", () => {
	assert.match(USE_SCROLL_ANCHOR_SOURCE, /resolveRovoAppScrollAnchorLayout/);
	assert.match(USE_SCROLL_ANCHOR_SOURCE, /isGenerationActive: boolean;/);
	assert.match(USE_SCROLL_ANCHOR_SOURCE, /enableTargetFollow\?: boolean;/);
	assert.match(USE_SCROLL_ANCHOR_SOURCE, /enableTargetFollow = true,/);
	assert.match(
		USE_SCROLL_ANCHOR_SOURCE,
		/useReducer\(\s*reduceScrollAnchor,/,
	);
	assert.match(USE_SCROLL_ANCHOR_SOURCE, /dispatchScrollAnchor\(\{ type: "follow-target", messageId: latestUserMessageId \}\)/);
	assert.match(USE_SCROLL_ANCHOR_SOURCE, /dispatchScrollAnchor\(\{ type: "follow-bottom" \}\)/);
	assert.match(
		USE_SCROLL_ANCHOR_SOURCE,
		/scrollSpacerRef\.current\.style\.height = "0px"/,
	);
	assert.match(
		USE_SCROLL_ANCHOR_SOURCE,
		/const pendingAnchorScrollAnimationRef = useRef<ScrollToBottomOptions\["animation"\]>\("instant"\)/,
	);
	assert.match(
		USE_SCROLL_ANCHOR_SOURCE,
		/pendingAnchorScrollAnimationRef\.current = hasInitializedScrollRef\.current\s+\? FAST_TURN_SCROLL_ANIMATION\s+\: "instant"/,
	);
	assert.match(
		USE_SCROLL_ANCHOR_SOURCE,
		/conversationContextRef\.current\?\.scrollToBottom\(\{\s+animation: pendingAnchorScrollAnimationRef\.current,\s+ignoreEscapes: true,/,
	);
	assert.match(
		USE_SCROLL_ANCHOR_SOURCE,
		/const shouldActivateTargetFollow =\s+enableTargetFollow &&\s+isGenerationActive/u,
	);
	assert.doesNotMatch(
		USE_SCROLL_ANCHOR_SOURCE,
		/target: "bottom"/,
	);
});
