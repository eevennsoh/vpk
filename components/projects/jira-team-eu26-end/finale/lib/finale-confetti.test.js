const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

async function load() {
	const result = await esbuild.build({
		stdin: { contents: 'export * from "./finale-confetti"; export * from "./play-finale-confetti"; export { probe } from "motion";', resolveDir: __dirname, loader: "ts" },
		bundle: true, format: "cjs", platform: "node", write: false,
		plugins: [{ name: "motion-probe", setup(build) {
			build.onResolve({ filter: /^motion$/ }, () => ({ path: "motion", namespace: "probe" }));
			build.onLoad({ filter: /.*/, namespace: "probe" }, () => ({ contents: `
				export const probe = [];
				export function animate(element, keyframes, options) {
					let finish;
					const pending = new Promise(resolve => { finish = resolve; });
					const control = { element, keyframes, options, finish, cancelled: false };
					pending.cancel = () => { control.cancelled = true; };
					probe.push(control);
					return pending;
				}
			` }));
		} }],
	});
	return loadCjsModuleFromText(result.outputFiles[0].text, "finale-confetti-harness.cjs");
}

test("burst and fade timing compose the resolved VPK duration tokens", async () => {
	const { FINALE_CONFETTI_DURATION, createFinaleConfettiBurst } = await load();
	const css = readFileSync("app/tailwind-theme.css", "utf8");
	const seconds = name => Number(css.match(new RegExp(`--duration-${name}:\\s*(\\d+)ms`))[1]) / 1000;
	assert.equal(FINALE_CONFETTI_DURATION, seconds("slowest") * 2);
	const opacity = createFinaleConfettiBurst(900, () => 0.5)[0].keyframes.opacity;
	const steps = opacity.length - 1;
	const fadeDuration = (FINALE_CONFETTI_DURATION / steps) / opacity.at(-2);
	assert.ok(Math.abs(fadeDuration - seconds("slower") * 2) < 1e-12);
});

test("one burst mirrors both corners, uses only the four Rovo colours, and fades every piece to zero", async () => {
	const { createFinaleConfettiBurst } = await load();
	const particles = createFinaleConfettiBurst(900, () => 0.5);
	assert.equal(particles.length, 360);
	assert.equal(particles.filter(particle => particle.corner === "left").length, 180);
	assert.deepEqual(new Set(particles.map(particle => particle.color)), new Set(["#1868DB", "#AF59E1", "#FCA700", "#6A9A23"]));
	const position = (particle, step) => particle.keyframes.transform[step].match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/).slice(1).map(Number);
	assert.ok(position(particles[0], 10)[0] > 0, "left cannon travels inward");
	assert.ok(position(particles[180], 10)[0] < 0, "right cannon travels inward");
	assert.ok(position(particles[0], 10)[1] < 0, "both cannons launch upward from the foot of the viewport");
	for (const particle of particles) {
		assert.equal(particle.keyframes.transform.length, 41);
		assert.equal(particle.keyframes.opacity[13], 1, "the launch stays vivid for the first 0.4 seconds");
		assert.ok(particle.keyframes.opacity[20] > 0.7 && particle.keyframes.opacity[20] < 0.8, "fade already underway at 0.6 seconds");
		assert.ok(particle.keyframes.opacity[30] > 0.3 && particle.keyframes.opacity[30] < 0.4, "a gradual tail stays visible at 0.9 seconds");
		assert.ok(Math.abs(particle.keyframes.opacity.at(-1)) < 1e-9);
		assert.ok(particle.keyframes.opacity.every((value, index, values) => value <= (values[index - 1] ?? 1)), "the fade never flashes back");
	}
});

test("the forceful broad fans rise diagonally across viewport heights", async () => {
	const { createFinaleConfettiBurst } = await load();
	for (const height of [400, 768, 900, 1100, 1600]) {
		for (const random of [0, 0.5, 0.99999]) {
			for (const particle of createFinaleConfettiBurst(height, () => random)) {
				const positions = particle.keyframes.transform.map(frame => frame.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/).slice(1).map(Number));
				assert.ok(positions[4][1] < 0, "every piece launches upward from its corner");
			}
		}
	}
	// Guard strength, width and diagonal pitch against the gentler and
	// vertically compressed variants.
	let index = 0;
	const leading = createFinaleConfettiBurst(900, () => index++ === 0 ? 0 : 0.99999)[0];
	const x = Number(leading.keyframes.transform[20].match(/translate\(([-\d.]+)px/)[1]);
	assert.ok(x > 900, "the forceful fan reaches farther across the screen");
	const central = createFinaleConfettiBurst(900, () => 0.5)[0];
	const [cx, cy] = central.keyframes.transform[10].match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/).slice(1).map(Number);
	assert.ok(-cy > cx, "the central trajectory shoots diagonally upward");
	const peak = Math.min(...central.keyframes.transform.map(frame => Number(frame.match(/translate\([-\d.]+px, ([-\d.]+)px\)/)[1])));
	assert.ok(peak < -900 * 0.6, "the stronger central trajectory reaches well into the upper half");
});

test("both corners retain a gentle trail near their origin through the fade", async () => {
	const { createFinaleConfettiBurst } = await load();
	const particles = createFinaleConfettiBurst(900, () => 0.5);
	for (const corner of ["left", "right"]) {
		for (const step of [15, 30]) {
			const nearOrigin = particles.filter(particle => {
				if (particle.corner !== corner) return false;
				const [x, y] = particle.keyframes.transform[step].match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/).slice(1).map(Number);
				return Math.abs(x) < 180 && y < 0 && y > -225;
			});
			assert.ok(nearOrigin.length >= 45, "a substantial trail fills the corner at 450 and 900 ms");
			assert.deepEqual(new Set(nearOrigin.map(particle => particle.color)), new Set(["#1868DB", "#AF59E1", "#FCA700", "#6A9A23"]));
		}
	}
});

test("shader handoff waits for all pieces; abort, resize and reduced motion clear the entire burst", async (t) => {
	const previous = { document: globalThis.document, window: globalThis.window };
	const layers = [];
	const listeners = new Map();
	globalThis.document = {
		createElement: () => ({ style: {}, dataset: {}, children: [], setAttribute() {}, appendChild(node) { this.children.push(node); }, remove() { layers.splice(layers.indexOf(this), 1); } }),
		body: { appendChild: layer => layers.push(layer) },
	};
	globalThis.window = { innerHeight: 900, addEventListener: (name, handler) => listeners.set(name, handler), removeEventListener: name => listeners.delete(name) };
	t.after(() => Object.assign(globalThis, previous));
	for (const action of ["finish", "abort", "resize"]) {
		const { playFinaleConfetti, probe } = await load();
		const controller = new AbortController();
		let handedOff = false;
		const pending = playFinaleConfetti(controller.signal, false).then(() => { handedOff = true; });
		assert.equal(layers.length, 1);
		assert.equal(layers[0].children.length, 360);
		assert.equal(probe.length, 360, "both cannons fire exactly once");
		assert.ok(probe.every(animation => animation.options.duration === 1.2));
		probe[0].finish();
		await Promise.resolve();
		assert.equal(handedOff, false, "the first piece cannot start the shader early");
		if (action === "finish") for (const animation of probe) animation.finish();
		else if (action === "abort") controller.abort();
		else listeners.get("resize")();
		await pending;
		assert.equal(layers.length, 0, "no particles survive the handoff");
		assert.equal(listeners.size, 0);
		assert.ok(probe.every(animation => animation.cancelled), "no animation remains alive");
	}
	const { playFinaleConfetti, probe } = await load();
	await playFinaleConfetti(new AbortController().signal, true);
	const aborted = new AbortController();
	aborted.abort();
	await playFinaleConfetti(aborted.signal, false);
	assert.equal(probe.length, 0);
	assert.equal(layers.length, 0);
});
