import assert from "node:assert/strict";
import test from "node:test";

import { isAdditiveSelectionModifier, selectionGestureFromModifierKeys } from "../agent-session/agent-session-selection-gesture.ts";
import { interpretSelectionKey } from "./untracked-selection.ts";

function keyEvent(
	key: string,
	modifiers: Readonly<{
		altKey?: boolean;
		ctrlKey?: boolean;
		metaKey?: boolean;
		repeat?: boolean;
		shiftKey?: boolean;
	}> = {},
) {
	return {
		altKey: modifiers.altKey ?? false,
		ctrlKey: modifiers.ctrlKey ?? false,
		key,
		metaKey: modifiers.metaKey ?? false,
		repeat: modifiers.repeat ?? false,
		shiftKey: modifiers.shiftKey ?? false,
	};
}

test("Command is additive on Apple platforms; Control is additive elsewhere", () => {
	assert.equal(
		isAdditiveSelectionModifier({ ctrlKey: false, metaKey: true }, "MacIntel"),
		true,
	);
	assert.equal(
		isAdditiveSelectionModifier({ ctrlKey: true, metaKey: false }, "MacIntel"),
		false,
	);
	assert.equal(
		isAdditiveSelectionModifier({ ctrlKey: true, metaKey: false }, "Win32"),
		true,
	);
	assert.equal(
		isAdditiveSelectionModifier({ ctrlKey: false, metaKey: true }, "Win32"),
		false,
	);
});

test("gesture mapping matches Finder click modifiers", () => {
	assert.deepEqual(
		selectionGestureFromModifierKeys(
			{ ctrlKey: false, metaKey: false, shiftKey: false },
			"MacIntel",
		),
		{ additive: false, range: false },
	);
	assert.deepEqual(
		selectionGestureFromModifierKeys(
			{ ctrlKey: false, metaKey: false, shiftKey: true },
			"MacIntel",
		),
		{ additive: false, range: true },
	);
	assert.deepEqual(
		selectionGestureFromModifierKeys(
			{ ctrlKey: false, metaKey: true, shiftKey: false },
			"MacIntel",
		),
		{ additive: true, range: false },
	);
	assert.deepEqual(
		selectionGestureFromModifierKeys(
			{ ctrlKey: false, metaKey: true, shiftKey: true },
			"MacIntel",
		),
		{ additive: true, range: true },
	);
});

test("row keys move and extend; Command-A selects all; Escape clears", () => {
	assert.deepEqual(
		interpretSelectionKey(keyEvent("ArrowDown"), {
			additive: false,
			fromRowSurface: true,
		}),
		{ direction: "next", extend: false, kind: "move" },
	);
	assert.deepEqual(
		interpretSelectionKey(keyEvent("ArrowUp", { shiftKey: true }), {
			additive: false,
			fromRowSurface: true,
		}),
		{ direction: "previous", extend: true, kind: "move" },
	);
	assert.deepEqual(
		interpretSelectionKey(keyEvent("Home"), {
			additive: false,
			fromRowSurface: true,
		}),
		{ direction: "first", extend: false, kind: "move" },
	);
	assert.deepEqual(
		interpretSelectionKey(keyEvent("End", { shiftKey: true }), {
			additive: false,
			fromRowSurface: true,
		}),
		{ direction: "last", extend: true, kind: "move" },
	);
	assert.deepEqual(
		interpretSelectionKey(keyEvent("a", { metaKey: true }), {
			additive: isAdditiveSelectionModifier(keyEvent("a", { metaKey: true }), "MacIntel"),
			fromRowSurface: false,
		}),
		{ kind: "select-all" },
	);
	assert.deepEqual(
		interpretSelectionKey(keyEvent("a", { ctrlKey: true }), {
			additive: isAdditiveSelectionModifier(keyEvent("a", { ctrlKey: true }), "Win32"),
			fromRowSurface: true,
		}),
		{ kind: "select-all" },
	);
	assert.deepEqual(
		interpretSelectionKey(keyEvent("Escape"), {
			additive: false,
			fromRowSurface: false,
		}),
		{ kind: "clear" },
	);
});

test("arrows on a child control, Command-arrows, and typing targets stay inert", () => {
	assert.equal(
		interpretSelectionKey(keyEvent("ArrowDown"), {
			additive: false,
			fromRowSurface: false,
		}),
		null,
	);
	assert.equal(
		interpretSelectionKey(keyEvent("ArrowDown", { metaKey: true }), {
			additive: true,
			fromRowSurface: true,
		}),
		null,
	);
	assert.equal(
		interpretSelectionKey(keyEvent("a", { metaKey: true, repeat: true }), {
			additive: true,
			fromRowSurface: true,
		}),
		null,
	);
});
