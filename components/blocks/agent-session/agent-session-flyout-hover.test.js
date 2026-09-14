const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const CARD_SOURCE = readFileSync(join(__dirname, "agent-session-card.tsx"), "utf8");
const INDEX_SOURCE = readFileSync(join(__dirname, "index.tsx"), "utf8");
const SELECT_MARK_SOURCE = readFileSync(join(__dirname, "agent-session-select-mark.tsx"), "utf8");
const SCROLL_PREVIEW_SOURCE = readFileSync(
	join(__dirname, "use-agent-session-scroll-preview.ts"),
	"utf8",
);

test("an open session overlay keeps its source row in the complete hover state", () => {
	// The session flyout, more-actions menu, and nested Smart Link preview are
	// portalled, so CSS `:hover` cannot keep the source article lit while the
	// pointer crosses them. Their controlled open state must pin every visual
	// part of the row hover until the active overlay closes or changes.
	assert.match(SCROLL_PREVIEW_SOURCE, /const \[activeItemId, setActiveItemId\] = useState<string \| null>\(null\);/u);
	assert.match(
		SCROLL_PREVIEW_SOURCE,
		/setActiveItemId\(open \? details\.trigger\?\.getAttribute\("data-session-id"\) \?\? null : null\);/u,
	);
	assert.match(SCROLL_PREVIEW_SOURCE, /return \{ activeItemId, onOpenChange \};/u);
	assert.match(CARD_SOURCE, /isFlyoutActive = false,/u);
	assert.match(CARD_SOURCE, /const isHoverStateActive = isFlyoutActive \|\| menu\.isOpen;/u);
	assert.match(CARD_SOURCE, /data-hovered=\{isHoverStateActive \|\| undefined\}/u);
	assert.match(CARD_SOURCE, /isHighlighted \|\| isHoverStateActive/u);
	assert.match(
		CARD_SOURCE,
		/pinned: isFlyoutActive \|\| \(showMoreMenu && role === "owner" && \(menu\.isOpen \|\| menu\.copied\)\),/u,
	);
	assert.match(CARD_SOURCE, /data-session-id=\{item\.id\}/u);
	assert.match(INDEX_SOURCE, /isFlyoutActive=\{item\.id === scrollPreview\.activeItemId\}/u);
	assert.match(SELECT_MARK_SOURCE, /group-data-\[hovered\]\/agent-row:opacity-0/u);
	assert.match(SELECT_MARK_SOURCE, /group-data-\[hovered\]\/agent-row:pointer-events-auto/u);
	assert.match(SELECT_MARK_SOURCE, /group-data-\[hovered\]\/agent-row:opacity-100/u);
});
