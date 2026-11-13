const test = require("node:test");
const assert = require("node:assert/strict");

const {
	restoreFloatingRovoButtonFocus,
	shouldRestoreFocusAfterCardClose,
} = require("./focus-restore.ts");

// `cardOpen` in the surface is `onboardingOpen || insightsStage === "card"`.
// These name the caller's intent so the cases stay readable.
const CARD_OPEN = true;
const CARD_CLOSED = false;

function createFocusTarget() {
	const calls = [];
	return {
		calls,
		focus: (options) => {
			calls.push(options);
		},
	};
}

test("dismissing the insights card returns focus to the collapsed launcher", () => {
	const launcher = createFocusTarget();

	const moved = restoreFloatingRovoButtonFocus(CARD_OPEN, CARD_CLOSED, launcher);

	assert.equal(moved, true);
	assert.equal(launcher.calls.length, 1);
});

test("the secondary action collapsing card -> pill returns focus to the pill", () => {
	// `cardOpen` goes true -> false on this path too, even though the insights
	// stage lands on "pill" rather than "hidden".
	const pill = createFocusTarget();

	const moved = restoreFloatingRovoButtonFocus(CARD_OPEN, CARD_CLOSED, pill);

	assert.equal(moved, true);
	assert.equal(pill.calls.length, 1);
});

test("closing the onboarding panel restores focus the same way", () => {
	// The onboarding panel is the other card on the same surface. It had the
	// identical defect and is covered by the identical transition.
	const launcher = createFocusTarget();

	const moved = restoreFloatingRovoButtonFocus(CARD_OPEN, CARD_CLOSED, launcher);

	assert.equal(moved, true);
	assert.deepEqual(launcher.calls[0], { preventScroll: true });
});

test("focus is restored without scrolling the page to the fixed surface", () => {
	const launcher = createFocusTarget();

	restoreFloatingRovoButtonFocus(CARD_OPEN, CARD_CLOSED, launcher);

	assert.deepEqual(launcher.calls[0], { preventScroll: true });
});

test("opening a card does not steal focus back from it", () => {
	// Both panels take focus themselves via `autoFocus` on their dismiss button;
	// moving focus to the pill or launcher here would fight them.
	const target = createFocusTarget();

	assert.equal(restoreFloatingRovoButtonFocus(CARD_CLOSED, CARD_OPEN, target), false);
	assert.equal(target.calls.length, 0);
});

test("transitions that never had a card open leave focus alone", () => {
	// Covers button -> pill, pill -> button, and every idle re-render.
	const target = createFocusTarget();

	assert.equal(restoreFloatingRovoButtonFocus(CARD_CLOSED, CARD_CLOSED, target), false);
	assert.equal(target.calls.length, 0);
});

test("a card staying open does not re-focus on every re-render", () => {
	const target = createFocusTarget();

	assert.equal(restoreFloatingRovoButtonFocus(CARD_OPEN, CARD_OPEN, target), false);
	assert.equal(target.calls.length, 0);
});

test("a missing replacement control is not a failure", () => {
	// The surface unmounts entirely when the secondary action falls back to
	// opening chat, so on that path there is no control left to focus.
	assert.equal(restoreFloatingRovoButtonFocus(CARD_OPEN, CARD_CLOSED, null), false);
	assert.equal(restoreFloatingRovoButtonFocus(CARD_OPEN, CARD_CLOSED, undefined), false);
});

test("the close predicate fires only on open -> closed", () => {
	assert.equal(shouldRestoreFocusAfterCardClose(CARD_OPEN, CARD_CLOSED), true);
	assert.equal(shouldRestoreFocusAfterCardClose(CARD_OPEN, CARD_OPEN), false);
	assert.equal(shouldRestoreFocusAfterCardClose(CARD_CLOSED, CARD_OPEN), false);
	assert.equal(shouldRestoreFocusAfterCardClose(CARD_CLOSED, CARD_CLOSED), false);
});
