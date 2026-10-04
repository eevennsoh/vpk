const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function harness() {
	const calls = [], completed = [];
	let effect, cleanup, previous, stateIndex = 0;
	const states = [];
	const loaded = { exports: {} };
	vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "use-created-card-drop-motion.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
		module: loaded, exports: loaded.exports,
		require: (name) => name === "react" ? {
			useMemo: (factory) => factory(),
			useCallback: (callback) => callback,
			useState(initial) { const i = stateIndex++; if (!(i in states)) states[i] = initial; return [states[i], (next) => { states[i] = next; }]; },
			useLayoutEffect(next, deps) {
				if (previous && deps.every((dep, index) => Object.is(dep, previous[index]))) return;
				previous = deps; effect = next;
			},
		} : {
			animateIssueSolitaireDrop(root, title, codes, reduced, complete, colors) {
				const call = { root, title, codes, reduced, complete, colors, stopped: false };
				calls.push(call);
				if (reduced) complete();
				return () => { call.stopped = true; complete(); };
			},
		},
	});
	const arrival = { id: 1, columnTitle: "To do", cardCodes: ["NEW-1", "NEW-2"], appended: true, glowColors: { "NEW-1": "orange", "NEW-2": "blue" } };
	const options = { arrival, boardRef: { current: {} }, receiving: true, reducedMotion: false, onComplete: (id) => completed.push(id) };
	return { calls, completed, arrival, render(overrides = {}) {
		stateIndex = 0;
		Object.assign(options, overrides);
		const presented = loaded.exports.useCreatedCardDropMotion(options);
		if (effect) { cleanup?.(); cleanup = effect(); effect = undefined; }
		return presented;
	}, dispose() { cleanup?.(); } };
}

test("both create targets wait for the receipt, reveal final slots, and complete after the shared animation", () => {
	for (const appended of [true, false]) {
		const h = harness(); h.arrival.appended = appended;
		const pending = h.render().arrival;
		assert.equal(pending.deferred, true);
		assert.equal(pending.animatedCardCodes.length, 0, "the older scale/fade entrance must stay off");
		assert.equal(h.calls.length, 0);
		h.render({ receiving: false });
		assert.equal(h.calls.length, 1);
		assert.equal(h.calls[0].codes, h.arrival.cardCodes);
		assert.equal(h.calls[0].colors, h.arrival.glowColors);
		assert.deepEqual(h.completed, []);
		h.calls[0].complete();
		assert.deepEqual(h.completed, [1]);
	}
});

test("unrelated renders preserve playback; interrupted arrivals cancel without clearing a newer arrival", () => {
	const h = harness(); h.render({ receiving: false }); h.render();
	assert.equal(h.calls.length, 1);
	h.render({ arrival: { ...h.arrival, id: 2 } });
	assert.equal(h.calls[0].stopped, true);
	assert.deepEqual(h.completed, []);
	h.calls[0].complete();
	assert.deepEqual(h.completed, []);
	h.calls[1].complete();
	assert.deepEqual(h.completed, [2]);
	h.dispose();
});

test("reduced motion settles immediately and an idle board starts no animation", () => {
	const h = harness(); h.render({ receiving: false, reducedMotion: true });
	assert.equal(h.calls[0].reduced, true);
	assert.deepEqual(h.completed, [1]);
	const original = harness(); const presented = original.render({ arrival: undefined, receiving: false }).arrival;
	assert.equal(presented, undefined);
	assert.equal(original.calls.length, 0);
});

test("inline creation keeps only the new slots hidden until the shared linking flight lands", () => {
	const h = harness();
	h.arrival.inlineDrop = { from: { x: 500, y: 300 }, members: [{ id: "session", name: "Claude" }], cardCodes: ["NEW-2"] };
	const pending = h.render({ receiving: false });
	assert.deepEqual([...pending.arrival.pendingCardCodes], ["NEW-2"]);
	assert.equal(pending.arrival.deferred, false, "reserve the inline slot so the flight can measure it");
	assert.equal(pending.inlineFlight.drop, h.arrival.inlineDrop);
	assert.equal(h.calls.length, 0, "the glow must wait for the chip to collapse");
	pending.inlineFlight.onLanded();
	const landed = h.render();
	assert.equal(landed.inlineFlight, undefined);
	assert.equal(landed.arrival.pendingCardCodes, undefined);
	assert.equal(h.calls.length, 1);
	h.calls[0].complete();
	assert.deepEqual(h.completed, [1]);
});

test("reduced-motion inline creation never mounts a flight or holds its new cards", () => {
	const h = harness(); h.arrival.inlineDrop = { from: { x: 0, y: 0 }, members: [], cardCodes: ["NEW-1"] };
	const result = h.render({ receiving: false, reducedMotion: true });
	assert.equal(result.inlineFlight, undefined);
	assert.equal(result.arrival.pendingCardCodes, undefined);
	assert.deepEqual(h.completed, [1]);
});

function createArrivalHarness({ reject = false } = {}) {
	const states = [], refs = [], creations = [];
	let stateIndex = 0, refIndex = 0;
	const react = {
		useCallback: (callback) => callback,
		useState(initial) { const i = stateIndex++; if (!(i in states)) states[i] = initial; return [states[i], (next) => { states[i] = typeof next === "function" ? next(states[i]) : next; }]; },
		useRef(value) { return refs[refIndex++] ??= { current: value }; },
	};
	const loaded = { exports: {} };
	const receipt = { exports: {} };
	const compile = (filename) => ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
	vm.runInNewContext(compile(path.join(__dirname, "../lib/session-drop-receipt.ts")), { module: receipt, exports: receipt.exports });
	vm.runInNewContext(compile(path.join(__dirname, "use-created-card-arrival.ts")), {
		module: loaded, exports: loaded.exports,
		require(name) {
			if (name === "react") return react;
			if (name.includes("session-drop-receipt")) return receipt.exports;
			return { agentSessionTintSeed: () => "claude", resolveAgentBrandTintColor: () => "orange", JIRA_LINKING_GLOW_DEFAULT_COLOR: "blue" };
		},
	});
	const onCreate = (session, title, index) => { creations.push({ id: session.id, title, index }); return reject ? undefined : `NEW-${creations.length}`; };
	return { creations, render() {
		stateIndex = refIndex = 0;
		return loaded.exports.useBoardCreatedCardArrival({ captureSession() {}, onCreate });
	} };
}

test("inline cohort creation advances insertion order and preserves the release point and invoker in its flight", () => {
	const h = createArrivalHarness();
	const sessions = ["one", "two"].map((id) => ({ id, agent: { name: "Claude", brandName: "claude" }, invokedBy: { name: "Venn", avatarSrc: "/venn.png" } }));
	const from = { x: 450, y: 400 };
	h.render().handleGapCreate(sessions, { columnTitle: "To do", insertAtIndex: 2 }, from);
	const arrival = h.render().createdCardArrival;
	assert.deepEqual(h.creations.map((item) => item.index), [2, 3]);
	assert.deepEqual([...arrival.inlineDrop.cardCodes], ["NEW-1", "NEW-2"]);
	assert.equal(arrival.inlineDrop.from, from);
	assert.equal(arrival.inlineDrop.members.length, 2);
	assert.equal(arrival.inlineDrop.members[0].invoker, sessions[0].invokedBy);
	assert.equal(arrival.appended, false);
});

test("a refused inline creation never publishes a decorative flight", () => {
	const h = createArrivalHarness({ reject: true });
	h.render().handleGapCreate([{ id: "one", agent: { name: "Claude" } }], { columnTitle: "To do", insertAtIndex: 1 }, { x: 0, y: 0 });
	assert.equal(h.render().createdCardArrival, null);
});
