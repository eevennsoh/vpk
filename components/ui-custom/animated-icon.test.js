const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function timingModule(file) {
	const loaded = { exports: {} };
	const source = ts.transpileModule(readFileSync(join(__dirname, "lib", file), "utf8"), {
		compilerOptions: { module: ts.ModuleKind.CommonJS },
	}).outputText;
	vm.runInNewContext(source, { module: loaded, exports: loaded.exports });
	return loaded.exports;
}

const sparkleTiming = timingModule("ai-sparkle-timing.ts");
const waveTiming = timingModule("shimmer-wave-timing.ts");

function harness() {
	const hooks = [], effects = [], timers = new Map();
	let cursor = 0, timerId = 0, dirty = false;
	const compiled = ts.transpileModule(readFileSync(join(__dirname, "animated-icon.tsx"), "utf8"), {
		compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
	}).outputText;
	const loaded = { exports: {} };
	vm.runInNewContext(compiled, {
		module: loaded, exports: loaded.exports,
		setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
		clearTimeout(id) { timers.delete(id); },
		require(name) {
			if (name === "react/jsx-runtime") return require(name);
			if (name.includes("animated-icon-registry")) return { ANIMATED_ICONS: { "ai-sparkle": () => null } };
			if (name.includes("ai-sparkle-timing")) return sparkleTiming;
			if (name.includes("utils")) return { cn: (...values) => values.filter(Boolean).join(" ") };
			const reactHooks = {
				useState(initial) {
					const index = cursor++;
					if (!(index in hooks)) hooks[index] = initial;
					return [hooks[index], (value) => { dirty = !Object.is(hooks[index], value); hooks[index] = value; }];
				},
				useRef(initial) { const index = cursor++; return hooks[index] ??= { current: initial }; },
				useEffect(effect, deps) {
					const index = cursor++, previous = hooks[index];
					if (previous && deps.every((dep, i) => Object.is(dep, previous.deps[i]))) return;
					effects.push(() => { previous?.cleanup?.(); hooks[index] = { deps, effect, cleanup: effect() }; });
				},
			};
			reactHooks.useLayoutEffect = reactHooks.useEffect;
			return reactHooks;
		},
	});
	return {
		timers,
		render(props) {
			let result;
			do {
				dirty = false; cursor = 0;
				result = loaded.exports.AnimatedIcon({ name: "ai-sparkle", ...props });
				while (effects.length) effects.shift()();
			} while (dirty);
			return result;
		},
		finish() { const pending = [...timers.values()]; timers.clear(); for (const timer of pending) timer.callback(); },
		unmount() { for (const hook of hooks) hook?.cleanup?.(); },
		replayEffects() { for (const hook of hooks) { if (hook?.effect) { hook.cleanup?.(); hook.cleanup = hook.effect(); } } },
	};
}

test("a changed token plays once and reports completion only after its return to rest", () => {
	const h = harness(), completed = [];
	const props = { playToken: 0, onReplayComplete: () => completed.push("done"), replayOnHover: false, replayOnFocus: false };
	assert.equal(h.render(props).props.children.props.hovered, false);
	assert.equal(h.timers.size, 0);
	props.playToken = 1;
	const playing = h.render(props);
	assert.equal(playing.props.children.props.hovered, true);
	assert.equal([...h.timers.values()][0].delay, 1000);
	assert.deepEqual(completed, []);
	h.finish();
	assert.equal(h.render(props).props.children.props.hovered, false);
	assert.deepEqual(completed, []);
	assert.equal([...h.timers.values()][0].delay, 400);
	h.finish();
	assert.deepEqual(completed, ["done"]);
	playing.props.onMouseEnter({}); playing.props.onFocus({});
	assert.equal(h.render(props).props.children.props.hovered, false);
});

test("a mounted sparkle starts with the shimmer and scales its whole cycle to the final glyph", () => {
	const duration = waveTiming.getShimmerWaveEndTime("Auto arrange", 1, 3);
	const timing = sparkleTiming.resolveAiSparkleTiming(duration);
	assert.ok(Math.abs(duration - 1.3055555555555556) < 0.000001);
	assert.ok(timing.scale >= 1, "the complete sparkle sequence must not be sped up to fit the wave");
	assert.equal(waveTiming.getShimmerWaveEndTime("   ", 0.4, 3), 0);
	assert.equal(waveTiming.getShimmerWaveEndTime("A ", 0.4, 3), 0.4);
	const h = harness(), phases = [];
	const props = { playOnMount: true, replayDuration: duration,
		onReplayReturn: () => phases.push("return"), onReplayComplete: () => phases.push("complete") };
	const playing = h.render(props);
	assert.equal(playing.props.children.props.hovered, true);
	assert.equal(playing.props.children.props.duration, duration);
	assert.equal([...h.timers.values()][0].delay, timing.playSeconds * 1000);
	h.finish();
	assert.equal(h.render(props).props.children.props.hovered, false);
	assert.deepEqual(phases, ["return"]);
	assert.equal([...h.timers.values()][0].delay, timing.returnSeconds * 1000);
	assert.ok(Math.abs(timing.playSeconds + timing.returnSeconds - duration) < 0.000001);
	h.finish();
	assert.deepEqual(phases, ["return", "complete"]);
});

test("unmount during the return cancels completion", () => {
	const h = harness(), phases = [];
	h.render({ playOnMount: true, onReplayReturn: () => phases.push("return"), onReplayComplete: () => phases.push("complete") });
	h.finish();
	assert.deepEqual(phases, ["return"]);
	h.unmount();
	h.finish();
	assert.deepEqual(phases, ["return"]);
});

test("Strict Mode effect replay restarts the cancelled mount timer", () => {
	const h = harness(), completed = [];
	const props = { playOnMount: true, onReplayComplete: () => completed.push("done") };
	h.render(props);
	h.replayEffects();
	assert.equal(h.timers.size, 1);
	h.finish();
	h.render(props);
	h.finish();
	assert.deepEqual(completed, ["done"]);
});

test("callback updates do not restart playback and completion uses the latest callback", () => {
	const h = harness(), completed = [];
	h.render({ playOnMount: true, onReplayComplete: () => completed.push("old") });
	const timer = [...h.timers.keys()][0];
	h.render({ playOnMount: true, onReplayComplete: () => completed.push("new") });
	assert.equal([...h.timers.keys()][0], timer);
	h.finish(); h.finish();
	assert.deepEqual(completed, ["new"]);
});

test("a newer replay cancels the older timer and unmount cancels its completion callback", () => {
	const h = harness(), completed = [];
	const props = { playToken: 0, onReplayComplete: () => completed.push("done") };
	h.render(props);
	h.render({ ...props, playToken: 1 });
	h.render({ ...props, playToken: 2 });
	assert.equal(h.timers.size, 1);
	h.unmount();
	assert.equal(h.timers.size, 0);
	h.finish();
	assert.deepEqual(completed, []);
});
