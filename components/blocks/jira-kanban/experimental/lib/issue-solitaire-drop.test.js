const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function fixture(count, column = "Done", { surfaceHeight = 96, slotHeight = 104, step = 112 } = {}) {
	const animations = [], nodes = [], reads = [], frames = new Map(), frameEvents = [];
	let frameId = 0, inFrame = false, sharedGlow;
	class Node {
		constructor(name) { this.name = name; this.style = {}; this.attributes = {}; this.children = []; this.dataset = {}; }
		setAttribute(key, value) { this.attributes[key] = value; if (inFrame) frameEvents.push("write"); }
		append(node) { this.children.push(node); node.parentElement = this; }
		remove() { this.removed = true; }
		animate(keyframes, options) {
			const animation = { node: this, keyframes, options, cancel() { this.cancelled = true; this.oncancel?.(); } };
			animations.push(animation); return animation;
		}
		getBoundingClientRect() { reads.push(this); if (inFrame) frameEvents.push("read"); else assert.equal(animations.length, 0, "measure every final slot before applying motion"); return this.rect; }
		get ownerDocument() { return doc; }
		querySelector(selector) { return selector.includes("backdrop") ? this.backdrop : this.surface; }
		closest() { return destination; }
	}
	const doc = { body: new Node("body"), createElement: (name) => { const node = new Node(name); nodes.push(node); return node; }, createElementNS: (_, name) => { const node = new Node(name); nodes.push(node); return node; } };
	const rect = (top, height) => ({ left: 100, right: 380, width: 280, top, bottom: top + height, height });
	const issues = Array.from({ length: count }, (_, index) => {
		const node = new Node("slot"); node.style = { zIndex: "auto", willChange: "opacity" }; node.rect = rect(100 + index * step, slotHeight);
		const issue = new Node("issue"); issue.dataset = { issueKey: `K${index}`, boardColumnTitle: column }; issue.parentElement = node;
		node.backdrop = new Node("backdrop");
		issue.surface = new Node("surface"); issue.surface.rect = rect(node.rect.top + 4, surfaceHeight);
		return issue;
	});
	const destination = { querySelectorAll: () => issues };
	const loaded = { exports: {} };
	vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "issue-solitaire-drop.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
		requestAnimationFrame: (callback) => { const id = ++frameId; frames.set(id, callback); return id; },
		cancelAnimationFrame: (id) => frames.delete(id),
		module: loaded, exports: loaded.exports, getComputedStyle: () => ({ borderTopLeftRadius: "8px" }),
		require(name) {
			if (name.includes("card-glow")) {
				const glow = { exports: {} };
				vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "../../../jira-linking/card-glow.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
					module: glow, exports: glow.exports, require: () => require("../../../jira-linking/glow-motion.ts"),
				});
				sharedGlow = glow.exports; return sharedGlow;
			}
			if (name.includes("glow-motion")) return require("../../../jira-linking/glow-motion.ts");
			return { token: (name) => `token:${name}` };
		},
	});
	let complete = 0;
	const start = (reduced = false, codes = issues.map((issue) => issue.dataset.issueKey), glowColors) => loaded.exports.animateIssueSolitaireDrop({ querySelectorAll: () => issues, ownerDocument: doc }, column, codes, reduced, () => complete++, glowColors);
	return { start, animations, nodes, issues, reads, doc, frames, frameEvents, linkGlow: () => sharedGlow.createJiraLinkingCardGlow({ haloRoot: issues[0].surface, backdropRoot: issues[0].parentElement.backdrop, color: "orange" }), complete: () => complete,
		runFrame() {
			const pending = [...frames.values()]; frames.clear(); frameEvents.length = 0; inFrame = true;
			for (const callback of pending) callback();
			inFrame = false;
		},
	};
}

test("every later card starts under the fixed first card and finishes at 420ms", () => {
	const h = fixture(6, "In progress"); h.start();
	assert.equal(h.animations.length, 6);
	assert.equal(h.issues[0].parentElement.style.zIndex, "2");
	h.animations.slice(1).forEach((animation, index) => {
		assert.equal(animation.keyframes[0].transform, `translate3d(0, ${-(index + 1) * 112}px, 0)`);
		assert.equal(animation.keyframes[1].transform, "translate3d(0, 0, 0)");
		assert.equal(animation.options.delay, Math.min((index + 1) * 24, 72));
		assert.equal(animation.options.delay + animation.options.duration, 420);
		assert.equal(animation.options.fill, "backwards");
		assert.equal(animation.options.easing, "cubic-bezier(0.22, 1, 0.36, 1)");
		animation.onfinish();
	});
	h.animations[0].onfinish();
	assert.equal(h.complete(), 1);
	for (const issue of h.issues) assert.equal(issue.parentElement.style.zIndex, "auto");
	for (const issue of h.issues.slice(1)) assert.equal(issue.parentElement.style.willChange, "opacity");
});

test("Done traces one measured collection with 1px success outlines and a push-pull band", () => {
	const h = fixture(4); h.start();
	const svg = h.doc.body.children[0];
	assert.equal(h.doc.body.children.length, 1);
	assert.equal(svg.attributes["aria-hidden"], "true");
	assert.equal(svg.style.pointerEvents, "none");
	assert.equal(svg.style.zIndex, "45");
	assert.equal(svg.attributes.height, String(3 * 112 + 96));
	const outlines = h.nodes.filter((node) => node.attributes.stroke);
	assert.equal(outlines.length, 4);
	for (const outline of outlines) {
		assert.equal(outline.attributes.stroke, "token:color.border.success");
		assert.equal(outline.attributes["stroke-width"], "1");
		assert.equal(outline.attributes["vector-effect"], "non-scaling-stroke");
		assert.equal(outline.attributes.rx, "8");
		assert.equal(outline.attributes.width, "279");
	}
	assert.deepEqual(h.nodes.filter((node) => node.name === "stop").map((node) => [node.attributes.offset, node.attributes["stop-opacity"]]), [["0%", "0"], ["45%", "0.18"], ["72%", "0.5"], ["92%", "1"], ["100%", "0.25"]]);
	const band = h.animations[0];
	assert.equal(band.options.duration, 620);
	assert.equal(band.options.easing, "cubic-bezier(0.42, 0, 0.9, 1)");
	assert.equal(band.keyframes[0].transform, "translateY(0px) scaleY(0.55)");
	assert.match(band.keyframes[1].transform, /scaleY\(1.18\)/u);
	assert.match(band.keyframes[2].transform, /scaleY\(0.68\)/u);
	assert.equal(band.keyframes[3].transform, "translateY(752px) scaleY(1.08)");
	assert.equal(band.node.style.transformOrigin, "center bottom");
	for (const animation of h.animations.slice(1)) animation.onfinish();
	assert.equal(h.complete(), 0);
	band.onfinish();
	assert.equal(svg.removed, true);
	assert.equal(h.complete(), 1);
});

test("cancel restores every style and removes the trace exactly once", () => {
	const h = fixture(4); const stop = h.start(); stop(); stop();
	assert.equal(h.complete(), 1);
	assert.equal(h.doc.body.children[0].removed, true);
	for (const issue of h.issues) assert.equal(issue.parentElement.style.zIndex, "auto");
	for (const issue of h.issues.slice(1)) assert.equal(issue.parentElement.style.willChange, "opacity");
	assert.ok(h.animations.every((animation) => animation.cancelled));
});

test("single cards trace in every column, skip the reveal, and motion-off does no decoration", () => {
	for (const column of ["Done", "In review"]) {
		const single = fixture(1, column); single.start();
		assert.equal(single.animations.length, 1);
		assert.equal(single.issues[0].parentElement.style.zIndex, "auto");
		const reduced = fixture(6, column); reduced.start(true);
		assert.equal(reduced.animations.length, 0);
		assert.equal(reduced.doc.body.children.length, 0);
		assert.equal(reduced.reads.length, 0);
		assert.equal(reduced.complete(), 1);
	}
});

for (const column of ["To do", "In progress", "In review", "Done"]) {
	test(`${column} automatically sweeps both sides using its semantic destination color`, () => {
		const h = fixture(2, column); h.start();
		const outlines = h.nodes.filter((node) => node.attributes.stroke);
		assert.equal(outlines.length, 2);
		for (const outline of outlines) {
			assert.equal(outline.attributes.stroke, column === "Done" ? "token:color.border.success" : "token:color.border.brand");
			assert.equal(outline.attributes.x, "0.5");
			assert.equal(outline.attributes.width, "279");
		}
		const trace = h.animations[0];
		assert.match(trace.keyframes[0].transform, /^translateY\(0px\)/u);
		assert.match(trace.keyframes.at(-1).transform, /^translateY\([0-9]/u);
		assert.equal(trace.options.duration, 620);
		trace.onfinish();
		assert.equal(h.doc.body.children[0].removed, true);
	});
}

test("single and bulk traces use the upstream timing and band geometry", () => {
	for (const count of [1, 2, 3, 4, 13]) {
		for (const surfaceHeight of [64, 120, 400]) {
			const h = fixture(count, "Done", { surfaceHeight, slotHeight: surfaceHeight, step: surfaceHeight + 8 }); h.start();
			const trace = h.animations[0];
			const height = (count - 1) * (surfaceHeight + 8) + surfaceHeight;
			const bandLength = count === 1 ? Math.min(220, Math.max(112, height * 0.72)) : Math.min(160, Math.max(72, height * 0.45));
			assert.equal(trace.options.duration, count === 1 ? 500 : 620);
			assert.equal(trace.node.attributes.height, String(bandLength));
			assert.equal(trace.node.attributes.y, String(-bandLength));
			assert.equal(h.nodes.find((node) => node.name === "mask").attributes["mask-type"], "luminance");
		}
	}
});

test("outlines follow the unfolding cards and existing destination cards are excluded", () => {
	const h = fixture(3); h.start(false, ["K0", "K2"]);
	const outlines = h.nodes.filter((node) => node.attributes.stroke);
	const exclusion = h.nodes.find((node) => node.attributes["data-issue-drop-trace-exclusion"] !== undefined);
	assert.equal(outlines.length, 2);
	assert.equal(exclusion.attributes.fill, "black");
	assert.equal(exclusion.attributes.y, "111");
	assert.equal(exclusion.attributes.width, "282");
	assert.equal(outlines[1].attributes.y, "224.5");
	// The later card starts under the lead; its outline must move with it.
	Object.assign(h.issues[2].surface.rect, { top: 104, bottom: 200 });
	Object.assign(h.issues[1].surface.rect, { top: 240, bottom: 336 });
	h.runFrame();
	assert.equal(outlines[1].attributes.y, "0.5");
	assert.equal(exclusion.attributes.y, "135");
	const firstWrite = h.frameEvents.indexOf("write");
	assert.equal(firstWrite, 3, "read all dropped and excluded surface bounds before writing SVG geometry");
	assert.ok(h.frameEvents.slice(firstWrite).every((event) => event === "write"));
});

for (const event of ["finish", "cancel", "dispose"]) {
	test(`${event} stops outline tracking and removes the overlay`, () => {
		const h = fixture(2); const stop = h.start();
		assert.equal(h.frames.size, 1);
		const staleFrame = [...h.frames.values()][0];
		if (event === "dispose") stop(); else h.animations[0][`on${event}`]();
		assert.equal(h.frames.size, 0);
		assert.equal(h.doc.body.children[0].removed, true);
		staleFrame();
		assert.equal(h.frames.size, 0, "a late frame cannot restart a completed trace");
	});
}

for (const count of [1, 4]) {
	test(`session creation reveals ${count} cards with the linking glow sweeping upward`, () => {
		const h = fixture(count); h.start(false, undefined, { K0: "#d97757" });
		assert.equal(h.nodes.some((node) => node.name === "svg"), false, "creation must not trace borders");
		const halos = h.animations.filter((item) => item.node.attributes["data-jira-linking-glow-halo"] !== undefined);
		const pulses = h.animations.filter((item) => item.options.duration === 800);
		assert.equal(halos.length, count);
		assert.match(halos[0].node.style.boxShadow, /#d97757 28%/u);
		assert.equal(pulses.length, count);
		for (const pulse of pulses) {
			assert.equal(pulse.node.style.top, "100%");
			assert.equal(pulse.keyframes.at(-1).transform, "translateY(-200%)");
			assert.equal(pulse.node.parentElement.attributes["aria-hidden"], "true");
		}
		const moves = h.animations.filter((item) => item.options.delay !== undefined);
		assert.equal(moves.length, count - 1);
		for (const [index, move] of moves.entries()) {
			assert.equal(move.keyframes[0].transform, `translate3d(0, ${-(index + 1) * 112}px, 0)`);
			assert.equal(move.options.duration + move.options.delay, 420);
		}
		for (const animation of h.animations) animation.onfinish();
		assert.equal(h.complete(), 1);
		assert.ok(halos.every((halo) => halo.node.removed));
		assert.ok(pulses.every((pulse) => pulse.node.parentElement.removed));
	});
}

test("reduced motion and cancellation leave no creation glow or moving slots", () => {
	const reduced = fixture(4); reduced.start(true, undefined, {});
	assert.equal(reduced.animations.length, 0);
	assert.equal(reduced.complete(), 1);
	const h = fixture(4); const stop = h.start(false, undefined, {}); stop(); stop();
	assert.equal(h.complete(), 1);
	assert.ok(h.animations.every((animation) => animation.cancelled));
	for (const issue of h.issues) assert.equal(issue.parentElement.style.zIndex, "auto");
});

test("linking retains the same glow recipe with its original upward direction", () => {
	const h = fixture(1); h.start();
	const effects = h.linkGlow();
	assert.equal(effects[0].animation.options.duration, 420);
	const pulse = effects[1].animation;
	assert.equal(pulse.options.duration, 800);
	assert.equal(pulse.node.style.top, "100%");
	assert.equal(pulse.keyframes.at(-1).transform, "translateY(-200%)");
	for (const effect of effects) effect.restore();
	assert.ok(effects[0].animation.node.removed);
	assert.ok(pulse.node.parentElement.removed);
});
