const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");

const {
	isSessionDragIdentitySettled,
	measureSessionDragGeometry,
	resolveSessionDragMorph,
	resolveSessionDragAvatarMorph,
	resolveSessionDragSurfaceStart,
	sessionDragGeometryRelativeToPointer,
	SESSION_DRAG_CHIP_ENTER_TRANSITION,
	SESSION_PEEL_CHIP_ENTER_TRANSITION,
	SESSION_DRAG_IDENTITY_SELECTOR,
} = require("./agent-session-drag-motion.ts");

const CARD_SOURCE = readFileSync(join(__dirname, "agent-session-card.tsx"), "utf8");
const MEDIUM_CARD_SOURCE = readFileSync(join(__dirname, "agent-session-medium-card.tsx"), "utf8");
const MEDIUM_DRAG_SOURCE = readFileSync(join(__dirname, "agent-session-medium-drag.tsx"), "utf8");
const OVERLAY_SOURCE = readFileSync(join(__dirname, "agent-session-drag-overlay.tsx"), "utf8");
const PICKUP_SOURCE = readFileSync(join(__dirname, "agent-session-motion-pickup.ts"), "utf8");
const GLOW_SOURCE = readFileSync(join(__dirname, "../../../app/jira-agent-motion.css"), "utf8");

test("the glow sweep keeps its shared 400ms timing independently of pickup geometry", () => {
	assert.match(GLOW_SOURCE, /animation: session-drag-face-flash var\(--duration-slower\) linear both;/u);
	assert.doesNotMatch(PICKUP_SOURCE, /data-session-drag-flash-beam|animationDuration/u);
});

test("pickup starts with corrected corners and keeps their visible radius within a quarter pixel", () => {
	// At 140%, linear radius interpolation differs from the exact inverse
	// by at most 0.23px mid-flight; both endpoint radii remain exactly 8px.
	for (const [scaleX, scaleY] of [[1.4, 1.4], [0.9, 0.95]]) {
		const pose = resolveSessionDragSurfaceStart(scaleX, scaleY, 8);
		assert.equal(pose.transform, `scale(${scaleX}, ${scaleY})`);
		for (let progress = 0; progress <= 1; progress += 0.05) {
			const x = scaleX + (1 - scaleX) * progress;
			const y = scaleY + (1 - scaleY) * progress;
			assert.ok(Math.abs((pose.radiusX + (8 - pose.radiusX) * progress) * x - 8) < 0.25);
			assert.ok(Math.abs((pose.radiusY + (8 - pose.radiusY) * progress) * y - 8) < 0.25);
		}
	}
});

test("drag lighting retains gesture origin and direction with immediate tracking and spring recoil", () => {
	const source = readFileSync(join(__dirname, "../jira-issue/use-session-drag-chip-pointer.ts"), "utf8");
	const motionValue = (initial) => {
		let value = initial;
		return { get: () => value, set: (next) => { value = next; }, jump: (next) => { value = next; } };
	};
	for (const tracking of ["spring", "direct"]) for (const direction of [-1, 1]) {
		const springs = [];
		const loaded = { exports: {} };
		runInNewContext(ts.transpileModule(source, {
			compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
		}).outputText, {
			module: loaded,
			exports: loaded.exports,
			require: (name) => {
				if (name === "react") return { useRef: (initial) => ({ current: initial }) };
				if (name === "motion/react") return {
					useMotionValue: motionValue,
					useSpring: (input) => {
						const spring = motionValue(typeof input === "number" ? input : input.get());
						// Setting a spring changes its target; painted motion arrives later.
						spring.set = () => {};
						springs.push(spring);
						return spring;
					},
				};
				if (name === "@/components/blocks/jira-issue/agent-session-drag") return {};
				if (name === "@/components/visual/peel/peel-geometry") return require("../../visual/peel/peel-geometry.ts");
				throw new Error(`Unexpected import ${name}`);
			},
		});
		const pointer = loaded.exports.useSessionDragChipPointer(false, tracking === "direct" ? tracking : undefined);
		pointer.beginGesture({ x: 400, y: 200 });
		const destination = 400 + direction * 100;
		pointer.followPointer({ x: destination, y: 200 });
		pointer.snapToPointer({ x: destination, y: 200 });
		assert.equal(pointer.originX.get(), 400, "the publishing snap cannot discard the pointerdown origin");
		assert.equal(pointer.direction.get(), direction, "a quick coalesced move remains available to a later capture handoff");
		for (const recoil of [1, 0.2, 0.001, 0]) {
			springs[0].jump(destination + direction * recoil);
			assert.equal(pointer.direction.get(), direction, "spring overshoot never changes lighting's gesture direction");
			assert.equal(pointer.x.get(), tracking === "direct" ? destination : destination + direction * recoil, "direct tracking cannot lag behind the input or recoil after it stops");
		}
		pointer.followPointer({ x: destination - direction * 2, y: 200 });
		assert.equal(pointer.direction.get(), direction, "a tiny correction during preparation keeps the intended edge");
		pointer.followPointer({ x: destination - direction * 20, y: 200 });
		assert.equal(pointer.direction.get(), -direction, "real pointer reversal arrives without waiting for the spring or capture");
		assert.equal(pointer.originX.get(), 400, "reversal preserves the original gesture displacement");
		assert.equal(pointer.x.get(), tracking === "direct" ? destination - direction * 20 : destination, "direct tracking acknowledges a reversal immediately");
		pointer.beginGesture({ x: 800, y: 300 });
		assert.equal(pointer.direction.get(), 0, "the next gesture clears the previous direction");
		assert.equal(pointer.originX.get(), 800);
		assert.equal(pointer.x.get(), 800);
	}
});

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
		assert.equal(pointer.x + target.surface.left + morph.x - (source.surface.width - target.surface.width) / 2, source.surface.left);
		assert.equal(pointer.y + target.surface.top + morph.y - (source.surface.height - target.surface.height) / 2, source.surface.top);
	}
});

test("compact pickup stays near the final size at the pointer for every grab point", () => {
	const target = {
		surface: { left: -66, top: -22, width: 132, height: 44 },
		identity: { left: -58, top: -16, width: 32, height: 32 },
	};
	for (const [width, height] of [[270, 60], [560, 160], [120, 40]]) {
		const source = {
			surface: { left: 29, top: 280, width, height },
			identity: { left: 41, top: 294, width: 32, height: 32 },
		};
		for (const pointer of [{ x: 100, y: 310 }, { x: 600, y: 380 }]) {
			const morph = resolveSessionDragMorph(sessionDragGeometryRelativeToPointer(source, pointer), target, "compact");
			assert.equal(morph.x, 0, "right-side pickups cannot slide the whole chip across from the source avatar");
			assert.equal(morph.y, 0);
			assert.ok(Math.abs(target.surface.width * morph.scaleX - Math.min(width, target.surface.width * 1.4)) < 0.001);
			assert.ok(Math.abs(target.surface.height * morph.scaleY - Math.min(height, target.surface.height * 1.4)) < 0.001);
			assert.equal(morph.identityX, 0, "the smaller surface starts with the identity already inset");
			assert.equal(morph.identityY, 0);
		}
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

test("each avatar preserves its captured source composition inside the chip for every grab point", () => {
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
		for (const role of ["human", "agent"]) {
			const avatar = resolveSessionDragAvatarMorph(captured.avatars[role], target.avatars[role], captured.identity, target.identity);
			assert.equal(target.avatars[role].left + avatar.x - target.identity.left, source.avatars[role].left - source.identity.left);
			assert.equal(target.avatars[role].top + avatar.y - target.identity.top, source.avatars[role].top - source.identity.top);
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

test("Motion pickup shares one 400ms timeline and restores styles on completion and cancellation", async () => {
	for (const cancelEarly of [false, true]) {
		const style = () => ({ transform: "", borderRadius: "", transformOrigin: "center", opacity: "", willChange: "opacity" });
		const element = (rect) => ({ style: style(), getBoundingClientRect: () => rect });
		const faces = [element({}), element({}), element({})];
		const label = element({});
		const agent = element({ left: 122, top: 214, width: 16, height: 16 });
		const human = element({ left: 110, top: 214, width: 16, height: 16 });
		const identity = { ...element({ left: 108, top: 206, width: 32, height: 32 }), querySelector: (selector) => selector.includes('"agent"') ? agent : human };
		const pill = { ...element({ left: 100, top: 200, width: 132, height: 44 }), querySelector: (selector) => selector.includes("surface") ? faces[0] : selector.includes("identity") ? identity : label };
		const follower = { ...element({ left: 166, top: 222 }), querySelector: () => pill, querySelectorAll: () => faces };
		const source = { surface: { left: 0, top: 0, width: 270, height: 60 }, identity: { left: 12, top: 14, width: 32, height: 32 },
			avatars: { agent: { left: 13, top: 15, width: 30, height: 30 }, human: { left: 30, top: 32, width: 16, height: 16 } } };
		const moving = [...faces, agent, human, label];
		const previous = moving.map((node) => ({ ...node.style }));
		let resolveFinished;
		let cancelled = 0;
		let completed = 0;
		const calls = [];
		const playback = { finished: new Promise((resolve) => { resolveFinished = resolve; }), cancel: () => { cancelled++; } };
		const loaded = { exports: {} };
		runInNewContext(ts.transpileModule(PICKUP_SOURCE, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
			module: loaded, exports: loaded.exports, getComputedStyle: () => ({ borderTopLeftRadius: "8px" }),
			require: (name) => {
				if (name === "motion") return { animate: (sequence, options) => { calls.push({ sequence, options }); return playback; } };
				if (name === "./agent-session-drag-motion") return require("./agent-session-drag-motion.ts");
				throw new Error(`Unexpected import ${name}`);
			},
		});
		const cleanup = loaded.exports.startSessionDragMotionPickup(follower, source, () => { completed++; });
		assert.equal(completed, 0, "carry cannot start before playback finishes");
		assert.equal(calls.length, 1);
		const { sequence, options } = calls[0];
		assert.equal(sequence.length, 4);
		assert.deepEqual([...sequence[0][0]], faces, "every background/light face belongs to the same segment");
		for (const segment of sequence) assert.equal(segment[2].at, 0);
		assert.deepEqual(options.defaultTransition, { duration: 0.4, ease: [0.4, 0, 0, 1] });
		for (const face of faces) assert.equal(face.style.transform, "scale(1.4, 1.3636363636363635)");
		if (cancelEarly) cleanup();
		resolveFinished();
		await Promise.resolve();
		assert.equal(completed, cancelEarly ? 0 : 1, "a cancelled pickup cannot enable carry later");
		if (!cancelEarly) {
			for (const node of moving) assert.equal(node.style.willChange, "");
			cleanup();
		}
		assert.equal(cancelled, 1);
		moving.forEach((node, index) => assert.deepEqual(node.style, previous[index]));
	}
	assert.doesNotMatch(PICKUP_SOURCE + OVERLAY_SOURCE, /setKeyframes|updateTiming|resolveSessionDragSurfaceRadii/u);
});

test("paper keeps its fast entrance independent of the slower avatar transformation", () => {
	assert.equal(SESSION_PEEL_CHIP_ENTER_TRANSITION.duration, 0.1);
	assert.deepEqual(SESSION_PEEL_CHIP_ENTER_TRANSITION.ease, [0.4, 1, 0.6, 1]);
	assert.deepEqual(SESSION_DRAG_CHIP_ENTER_TRANSITION, { duration: 0.4, ease: [0.4, 0, 0, 1] });
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
