const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROVO_GENERATION_SOURCE = fs.readFileSync(path.join(__dirname, "rovo-generation-components.tsx"), "utf8");
const ROVO_GENERATION_API_SOURCE = fs.readFileSync(path.join(__dirname, "rovo-generation.ts"), "utf8");

test("RovoGeneration rainbow stops are sourced from theme variables", () => {
	assert.match(ROVO_GENERATION_SOURCE, /--rovo-generation-stop-orange": "var\(--color-orange-300\)"/u);
	assert.match(ROVO_GENERATION_SOURCE, /--rovo-generation-stop-lime": "var\(--color-lime-400\)"/u);
	assert.match(ROVO_GENERATION_SOURCE, /--rovo-generation-stop-blue": "var\(--color-blue-600\)"/u);
	assert.match(ROVO_GENERATION_SOURCE, /--rovo-generation-stop-purple": "var\(--color-purple-500\)"/u);
	assert.match(ROVO_GENERATION_SOURCE, /var\(--rovo-generation-stop-orange\) 0deg 73deg/u);
	assert.doesNotMatch(ROVO_GENERATION_SOURCE, /#fca700|#6a9a23|#1868db|#af59e0|#AF59E1/u);
});

test("RovoGeneration exposes a Highlight sub-component", () => {
	assert.match(ROVO_GENERATION_API_SOURCE, /Highlight: RovoGenerationHighlight/u);
	assert.match(ROVO_GENERATION_SOURCE, /function RovoGenerationHighlight\(/u);
});

test("RovoGeneration.Highlight band reuses the token-backed rainbow stops", () => {
	assert.match(ROVO_GENERATION_SOURCE, /ROVO_GENERATION_HIGHLIGHT_STOPS\s*=\s*\[/u);
	assert.match(ROVO_GENERATION_SOURCE, /"var\(--rovo-generation-stop-orange\)"/u);
	assert.match(ROVO_GENERATION_SOURCE, /"var\(--rovo-generation-stop-purple\)"/u);
	// The highlight must not introduce hardcoded mosaic hex values.
	assert.doesNotMatch(ROVO_GENERATION_SOURCE, /#fca700|#6a9a23|#1868db|#af59e0/iu);
});

test("RovoGeneration.Highlight makes one legible 12 o'clock-to-12 o'clock perimeter pass", () => {
	// The larger suggestion surface needs a slower trace than the reference shimmer.
	assert.match(ROVO_GENERATION_SOURCE, /HIGHLIGHT_DURATION_MS = 2400/u);
	assert.match(ROVO_GENERATION_SOURCE, /HIGHLIGHT_DELAY_MS = 200/u);
	assert.match(ROVO_GENERATION_SOURCE, /HIGHLIGHT_BAND_FRAC = 0\.35/u);
	// The closed path begins and ends at the top-center rather than a corner.
	assert.match(ROVO_GENERATION_SOURCE, /`M \$\{width \/ 2\} 0`[\s\S]*`L \$\{width \/ 2\} 0`[\s\S]*"Z"/u);
	// Travels once and dissolves — no infinite repeat.
	assert.doesNotMatch(ROVO_GENERATION_SOURCE, /repeat:\s*Infinity/u);
	// Reduced motion hides the band and reports completion.
	assert.match(ROVO_GENERATION_SOURCE, /shouldReduceMotion/u);
});

function highlightHarness(props = {}, reducedMotion = false) {
	const ts = require("typescript");
	const vm = require("node:vm");
	const frames = new Map(), effects = [], completed = [];
	let frameId = 0, effectIndex = 0;
	const paths = Array.from({ length: 32 }, () => ({
		attributes: {},
		setAttribute(name, value) { this.attributes[name] = value; },
	}));
	const wrapperRef = { current: { offsetWidth: 32, offsetHeight: 16 } };
	const pathRefs = { current: paths };
	const completeRef = { current: undefined };
	const compiled = ts.transpileModule(ROVO_GENERATION_SOURCE, {
		compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
	}).outputText;
	const loaded = { exports: {} };
	vm.runInNewContext(compiled, {
		module: loaded, exports: loaded.exports,
		requestAnimationFrame(callback) { const id = ++frameId; frames.set(id, callback); return id; },
		cancelAnimationFrame(id) { frames.delete(id); },
		require(name) {
			if (name === "react/jsx-runtime") return require(name);
			if (name === "react") return {
				useRef: () => wrapperRef,
				useState: initial => [initial, () => {}],
				useLayoutEffect() {},
				useEffect(effect, deps) {
					const index = effectIndex++, previous = effects[index];
					if (previous && deps.every((dep, i) => Object.is(dep, previous.deps[i]))) return;
					previous?.cleanup?.(); effects[index] = { deps, cleanup: effect() };
				},
			};
			if (name === "motion/react") return { useReducedMotion: () => reducedMotion };
			if (name.includes("use-latest-ref")) return { useLatestRef: value => { completeRef.current = value; return completeRef; } };
			if (name.includes("use-lazy-ref")) return { useLazyRef: () => pathRefs };
			return { cn: (...values) => values.filter(Boolean).join(" ") };
		},
	});
	let currentProps = props;
	function render(nextProps = {}) {
		effectIndex = 0;
		currentProps = { ...currentProps, ...nextProps };
		return loaded.exports.RovoGenerationHighlight({ radius: 4, onHighlightComplete: () => completed.push("done"), ...currentProps });
	}
	render();
	return {
		completed, frames, paths,
		update: render,
		tick(now) { const callbacks = [...frames.values()]; frames.clear(); for (const callback of callbacks) callback(now); },
		unmount() { for (const effect of effects) effect.cleanup?.(); },
	};
}

test("a compact highlight finishes its eased lap sooner while the default duration remains unchanged", () => {
	for (const [props, endTime] of [[{ duration: 0.6 }, 900], [{}, 2700]]) {
		const h = highlightHarness(props);
		h.tick(100); // First animation frame plus the shared 200ms entrance delay.
		h.tick((300 + endTime) / 2);
		assert.ok(h.paths.some(path => Number(path.attributes.opacity) > 0));
		assert.deepEqual(h.completed, []);
		h.tick(endTime);
		assert.deepEqual(h.completed, ["done"]);
		assert.equal(h.frames.size, 0);
		assert.ok(h.paths.every(path => path.attributes.opacity === "0"));
	}
});

test("compact highlights cancel their frame on unmount and remain still under reduced motion", () => {
	const h = highlightHarness({ duration: 0.6 });
	h.unmount();
	assert.equal(h.frames.size, 0);
	assert.deepEqual(h.completed, []);
	const reduced = highlightHarness({ duration: 0.6 }, true);
	assert.equal(reduced.frames.size, 0);
	assert.deepEqual(reduced.completed, ["done"]);
	assert.ok(reduced.paths.every(path => path.attributes.opacity === "0"));
});

test("a new token retraces after the count-morph delay without remounting the wrapped content", () => {
	const child = { identity: "persistent badge" };
	const h = highlightHarness({ duration: 0.6, delay: 0.4, playToken: 1, children: child });
	h.tick(100);
	h.tick(700);
	assert.ok(h.paths.some(path => Number(path.attributes.opacity) > 0));
	h.tick(1100);
	assert.deepEqual(h.completed, ["done"]);
	assert.equal(h.frames.size, 0);
	assert.equal(h.update({ playToken: 2 }).props.children[0], child);
	assert.equal(h.frames.size, 1);
	h.tick(1200);
	h.tick(2200);
	assert.deepEqual(h.completed, ["done", "done"]);
	h.update({ playToken: 2 });
	assert.equal(h.frames.size, 0, "unchanged values do not restart the lap");
});
