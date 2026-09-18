const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const {
	isSessionDragIdentitySettled,
	measureSessionDragGeometry,
	resolveSessionDragMorph,
	resolveSessionDragAvatarMorph,
	sessionDragGeometryRelativeToPointer,
	SESSION_DRAG_CHIP_ENTER_TRANSITION,
	SESSION_PEEL_CHIP_ENTER_TRANSITION,
	SESSION_DRAG_IDENTITY_SELECTOR,
} = require("./agent-session-drag-motion.ts");

const CARD_SOURCE = readFileSync(join(__dirname, "agent-session-card.tsx"), "utf8");
const MEDIUM_CARD_SOURCE = readFileSync(join(__dirname, "agent-session-medium-card.tsx"), "utf8");
const MEDIUM_DRAG_SOURCE = readFileSync(join(__dirname, "agent-session-medium-drag.tsx"), "utf8");
const OVERLAY_SOURCE = readFileSync(join(__dirname, "agent-session-drag-overlay.tsx"), "utf8");

/** A host whose marked identity measures to the given box. */
function hostWithIdentity(rect) {
	return {
		querySelector: (selector) =>
			selector === SESSION_DRAG_IDENTITY_SELECTOR
				? { getBoundingClientRect: () => rect }
				: null,
	};
}

test("paper handoff waits for the visible avatar to match its horizontal print", () => {
	const positions = [{ x: 2, y: 8, width: 16, height: 16 }, { x: 14, y: 8, width: 16, height: 16 }];
	const identity = (composition, boxes, origin = { x: 100, y: 200 }) => ({
		querySelector: () => ({
			dataset: { composition },
			getBoundingClientRect: () => origin,
			children: [{
				getAttribute: () => null,
				querySelectorAll: () => boxes.map((box) => ({ getBoundingClientRect: () => ({ ...box, x: box.x + origin.x, y: box.y + origin.y }) })),
			}],
		}),
	});
	const captured = identity("group", positions, { x: 600, y: 400 });
	assert.equal(isSessionDragIdentitySettled(identity("group", positions), captured), true);
	assert.equal(isSessionDragIdentitySettled(identity("compact", positions), captured), false);
	assert.equal(isSessionDragIdentitySettled(identity("group", [positions[0], { ...positions[1], y: 11 }]), captured), false);
	assert.equal(isSessionDragIdentitySettled(identity("group", []), captured), false);
	assert.equal(isSessionDragIdentitySettled(identity("group", positions), null), false);
	assert.equal(isSessionDragIdentitySettled({ querySelector: () => null }, null), true);
});

test("the morph starts the avatar at its source box, rather than centring the whole pill there", () => {
	const source = {
		surface: { left: 349, top: 280, width: 270, height: 60 },
		identity: { left: 361, top: 294, width: 32, height: 32 },
	};
	const target = {
		surface: { left: -79, top: -22, width: 158, height: 44 },
		identity: { left: -71, top: -16, width: 32, height: 32 },
	};
	// A coalesced first move can publish far from pointerdown.
	for (const pointer of [{ x: 520, y: 310 }, { x: 720, y: 380 }]) {
		const morph = resolveSessionDragMorph(sessionDragGeometryRelativeToPointer(source, pointer), target);
		assert.equal(pointer.x + target.identity.left + morph.x + morph.identityX, source.identity.left);
		assert.equal(pointer.y + target.identity.top + morph.y + morph.identityY, source.identity.top);
		assert.equal(target.surface.width * morph.scaleX, source.surface.width);
		assert.ok(Math.abs(target.surface.height * morph.scaleY - source.surface.height) < 0.001);
	}
});

test("surface and identity measurements reject missing or collapsed geometry", () => {
	const rect = { left: 10, top: 20, width: 32, height: 32 };
	const host = { ...hostWithIdentity(rect), getBoundingClientRect: () => rect };
	assert.deepEqual(measureSessionDragGeometry(host), { surface: rect, identity: rect });
	assert.equal(measureSessionDragGeometry({ ...host, querySelector: () => null }), null);
	assert.equal(measureSessionDragGeometry({ ...host, getBoundingClientRect: () => ({ ...rect, width: 0 }) }), null);
	for (const dimension of ["width", "height"]) {
		assert.equal(measureSessionDragGeometry({
			...host,
			...hostWithIdentity({ ...rect, [dimension]: 0 }),
		}), null);
	}
});

test("each avatar starts at its own captured source box for every grab point", () => {
	const source = {
		surface: { left: 29, top: 280, width: 270, height: 60 },
		identity: { left: 41, top: 294, width: 32, height: 32 },
		avatars: {
			agent: { left: 42, top: 295, width: 30, height: 30 },
			human: { left: 59, top: 312, width: 16, height: 16 },
		},
	};
	const target = {
		surface: { left: -66, top: -22, width: 132, height: 44 },
		identity: { left: -58, top: -16, width: 32, height: 32 },
		avatars: {
			human: { left: -56, top: -8, width: 16, height: 16 },
			agent: { left: -44, top: -8, width: 16, height: 16 },
		},
	};
	for (const pointer of [{ x: 118, y: 345 }, { x: 282, y: 333 }, { x: 282, y: 363 }]) {
		const captured = sessionDragGeometryRelativeToPointer(source, pointer);
		const parent = resolveSessionDragMorph(captured, target);
		for (const role of ["human", "agent"]) {
			const avatar = resolveSessionDragAvatarMorph(captured.avatars[role], target.avatars[role], parent);
			assert.equal(pointer.x + target.avatars[role].left + parent.x + parent.identityX + avatar.x, source.avatars[role].left);
			assert.equal(pointer.y + target.avatars[role].top + parent.y + parent.identityY + avatar.y, source.avatars[role].top);
			assert.equal(target.avatars[role].width * avatar.scaleX, source.avatars[role].width);
		}
	}
});

test("both drag hosts mark an identity for the chip to fly out of", () => {
	// `measureSessionDragGeometry` returns null when this marker is
	// missing and the chip then fades in place with no error and no warning, so
	// the marker itself is the contract.
	assert.equal(SESSION_DRAG_IDENTITY_SELECTOR, "[data-session-drag-identity]");
	assert.match(CARD_SOURCE, /data-session-drag-identity=""/u);
	assert.match(MEDIUM_CARD_SOURCE, /data-session-drag-identity=""/u);
	// The large card marks outside the select-mark branch, so a markable row and
	// a plain one share one origin.
	assert.match(
		CARD_SOURCE,
		/data-session-drag-identity=""[\s\S]*mark === undefined \|\| mark === null/u,
	);
});

test("the normal avatar transformation uses the slower in-place token pair", () => {
	// duration-slower + ease-in-out keeps the requested composition change readable.
	assert.deepEqual(SESSION_DRAG_CHIP_ENTER_TRANSITION, {
		duration: 0.4,
		ease: [0.4, 0, 0, 1],
	});
});

test("paper keeps its fast entrance independent of the slower avatar transformation", () => {
	assert.equal(SESSION_PEEL_CHIP_ENTER_TRANSITION.duration, 0.1);
	assert.deepEqual(SESSION_PEEL_CHIP_ENTER_TRANSITION.ease, [0.4, 1, 0.6, 1]);
	assert.equal(SESSION_DRAG_CHIP_ENTER_TRANSITION.duration, 0.4);
});

test("the origin is captured on pointerdown and cleared on both drag endings", () => {
	// Measured in the same pointerdown that already reads the source height, and
	// held absolute in a ref. The delta against the publishing pointer is
	// resolved later, on the move that mounts the chip — see the anchoring test
	// below for why pointerdown is the wrong place to subtract.
	assert.match(
		MEDIUM_DRAG_SOURCE,
		/setSourceHeight\(event\.currentTarget\.getBoundingClientRect\(\)\.height\);\s*\n\s*sourceGeometryRef\.current = measureSessionDragGeometry\(event\.currentTarget\);/u,
	);
	// A stale origin would make the next gesture's chip fly from the previous
	// row, so both endSessionDrag and cancelSessionDrag clear it.
	assert.equal(
		MEDIUM_DRAG_SOURCE.match(/setChipOrigin\(null\);/gu)?.length,
		2,
		"endSessionDrag and cancelSessionDrag must both clear the origin",
	);
});

test("reduced motion zeroes the chip entrance instead of just shortening it", () => {
	// The host resolves the flag; the overlay consumes it. Both halves are
	// pinned so neither can start honouring reduced motion on its own.
	assert.match(MEDIUM_DRAG_SOURCE, /const reduceChipMotion = Boolean\(shouldReduceMotion\);/u);
	assert.match(CARD_SOURCE, /useMediaQuery\("\(prefers-reduced-motion: reduce\)", true\)/u);
	assert.match(MEDIUM_CARD_SOURCE, /useMediaQuery\("\(prefers-reduced-motion: reduce\)", true\)/u);
	assert.match(MEDIUM_DRAG_SOURCE, /reduceMotion=\{reduceChipMotion\}/u);
	assert.match(OVERLAY_SOURCE, /if \(!dragging \|\| !follower \|\| reduceMotion\) return;/u);
	assert.match(OVERLAY_SOURCE, /for \(const animation of animations\) animation\.cancel\(\);/u);
	assert.match(OVERLAY_SOURCE, /element\.style\.willChange = ""/u);

	// Timing comes from the shared token module, never inlined at the callsite.
	assert.match(OVERLAY_SOURCE, /from "\.\/agent-session-drag-motion"/u);
	assert.doesNotMatch(OVERLAY_SOURCE, /duration: 0\.15/u);
	assert.doesNotMatch(OVERLAY_SOURCE, /cubic-bezier/u);
});

test("the chip entrance anchors to the pointer that publishes, not to pointerdown", () => {
	// The chip mounts on the first qualifying pointermove, by which time the
	// portal has already followed the pointer there. Resolving the delta at
	// pointerdown starts the chip at `identityOrigin + firstMoveDelta`, which
	// reads as a jump rather than a FLIP out of the avatar — worst with
	// coalesced touch and stylus moves that clear the 2px threshold in one step.
	assert.match(
		MEDIUM_DRAG_SOURCE,
		/sourceGeometryRef\.current = measureSessionDragGeometry\(event\.currentTarget\);/u,
	);

	const pointerDownBlock = MEDIUM_DRAG_SOURCE.slice(
		MEDIUM_DRAG_SOURCE.indexOf("onPointerDown: (event"),
		MEDIUM_DRAG_SOURCE.indexOf("onPointerMove: (event"),
	);
	assert.ok(pointerDownBlock.length > 0, "the pointerdown handler is findable");
	assert.doesNotMatch(
		pointerDownBlock,
		/setChipOrigin/u,
		"pointerdown stores the absolute origin and resolves no delta",
	);

	// The publishing move resolves it, once, against its own client position.
	assert.match(
		MEDIUM_DRAG_SOURCE,
		/if \(!didPublishDragRef\.current\) \{\s*\n\s*const sourceGeometry = sourceGeometryRef\.current;/u,
	);
	assert.match(MEDIUM_DRAG_SOURCE, /sessionDragGeometryRelativeToPointer\(sourceGeometry, \{ x: event\.clientX, y: event\.clientY \}\)/u);
	assert.match(MEDIUM_DRAG_SOURCE, /chipPointer\.snapToPointer\(\{ x: event\.clientX, y: event\.clientY \}\);/u);

	// A stale origin must not survive into the next gesture.
	assert.equal(
		(MEDIUM_DRAG_SOURCE.match(/sourceGeometryRef\.current = null;/gu) ?? []).length,
		2,
		"both end and cancel clear the identity origin",
	);
});
