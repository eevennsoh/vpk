const test = require("node:test");
const assert = require("node:assert/strict");

const {
	createInitialClickSuppressionState,
	armClickSuppression,
	handleClickWithSuppression,
} = require("./floating-rovo-button-click-suppression.ts");

test("a plain click (no drag) is not suppressed", () => {
	const state = createInitialClickSuppressionState();
	const decision = handleClickWithSuppression(state);

	assert.equal(decision.suppress, false);
	assert.equal(decision.next.active, false);
});

test("the single synthetic click after a drag is swallowed", () => {
	const state = armClickSuppression();
	const decision = handleClickWithSuppression(state);

	assert.equal(decision.suppress, true);
});

test("regression: the click after a dragged button opens (suppression is one-shot)", () => {
	// Drag arms suppression, the trailing drag-click is swallowed, and the very
	// next click must pass through so the chat can open in the new location.
	let state = armClickSuppression();

	const trailingDragClick = handleClickWithSuppression(state);
	assert.equal(trailingDragClick.suppress, true, "trailing drag-click should be swallowed");
	state = trailingDragClick.next;

	const retryClick = handleClickWithSuppression(state);
	assert.equal(retryClick.suppress, false, "the next click must open the chat");
});

test("regression: repeated clicks never keep suppression alive forever", () => {
	// The original bug re-armed suppression on every intercepted click, so a user
	// clicking repeatedly (because nothing happened) could never open the button.
	let state = armClickSuppression();

	// First click is consumed.
	let decision = handleClickWithSuppression(state);
	assert.equal(decision.suppress, true);
	state = decision.next;

	// Every subsequent click must pass through — suppression must not regrow.
	for (let i = 0; i < 5; i += 1) {
		decision = handleClickWithSuppression(state);
		assert.equal(decision.suppress, false, `click #${i + 2} must not be suppressed`);
		state = decision.next;
	}
});
