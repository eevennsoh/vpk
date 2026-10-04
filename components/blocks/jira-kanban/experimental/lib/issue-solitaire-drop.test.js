const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function fixture(count, column = "Done", { surfaceHeight = 96, slotHeight = 104, step = 112, clipTop = 0, clipBottom = 10000, viewportHeight = 10000 } = {}) {
	const animations = [], nodes = [], reads = [], frames = new Map(), frameEvents = [], styleReads = [];
	let frameId = 0, inFrame = false, sharedGlow;
	class Node {
		constructor(name) { this.name = name; this.style = {}; this.attributes = {}; this.children = []; this.dataset = {}; this.inert = false; }
		setAttribute(key, value) { this.attributes[key] = value; if (inFrame) frameEvents.push("write"); }
		getAttribute(key) { return this.attributes[key] ?? null; }
		removeAttribute(key) { delete this.attributes[key]; }
		append(node) { this.children.push(node); node.parentElement = this; }
		remove() { this.removed = true; }
		animate(keyframes, options) {
			const animation = { node: this, keyframes, options, cancel() { this.cancelled = true; this.oncancel?.(); } };
			animations.push(animation); return animation;
		}
		getBoundingClientRect() { reads.push(this); if (inFrame) frameEvents.push("read"); else assert.equal(animations.length, 0, "measure every final slot before applying motion"); return this.rect; }
		get ownerDocument() { return doc; }
		querySelector(selector) { return selector.includes("agent-shell") ? this.shell : selector.includes("backdrop") ? this.backdrop : this.surface; }
		closest(selector) { return selector.includes("card-list") ? list : destination; }
	}
	const doc = { defaultView: { innerWidth: 1000, innerHeight: viewportHeight }, body: new Node("body"), createElement: (name) => { const node = new Node(name); nodes.push(node); return node; }, createElementNS: (_, name) => { const node = new Node(name); nodes.push(node); return node; } };
	const rect = (top, height) => ({ left: 100, right: 380, width: 280, top, bottom: top + height, height });
	const issues = Array.from({ length: count }, (_, index) => {
		const node = new Node("slot"); node.style = { zIndex: "auto", willChange: "opacity" }; node.rect = rect(100 + index * step, slotHeight);
		const issue = new Node("issue"); issue.dataset = { issueKey: `K${index}`, boardColumnTitle: column }; issue.parentElement = node;
		issue.shell = new Node("shell"); issue.shell.style = { backgroundColor: "", backgroundImage: "", transitionProperty: "" };
		node.backdrop = new Node("backdrop");
		issue.surface = new Node("surface"); issue.surface.rect = rect(node.rect.top + 4, surfaceHeight);
		return issue;
	});
	const columnSurface = new Node("column-surface");
	const destination = { querySelectorAll: () => issues, querySelector: () => columnSurface };
	const list = { getBoundingClientRect: () => rect(clipTop, clipBottom - clipTop) };
	const loaded = { exports: {} };
	vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "issue-solitaire-drop.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
		requestAnimationFrame: (callback) => { const id = ++frameId; frames.set(id, callback); return id; },
		cancelAnimationFrame: (id) => frames.delete(id),
		module: loaded, exports: loaded.exports, getComputedStyle: (node) => { styleReads.push({ node, animations: animations.length, appended: doc.body.children.length }); return { borderTopLeftRadius: "8px", backgroundColor: "rgb(248, 248, 248)" }; },
		require(name) {
			if (name.includes("card-motion")) return { JIRA_KANBAN_CARD_REFLOW: { duration: 0.15, ease: [0.4, 0, 0, 1] } };
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
	const start = (reduced = false, codes = issues.map((issue) => issue.dataset.issueKey), glowColors, feedback, reflowBefore) => loaded.exports.animateIssueSolitaireDrop({ querySelectorAll: () => issues, ownerDocument: doc }, column, codes, reduced, () => complete++, glowColors, feedback, reflowBefore);
	return { start, animations, nodes, issues, reads, doc, frames, frameEvents, styleReads, columnSurface, linkGlow: () => sharedGlow.createJiraLinkingCardGlow({ haloRoot: issues[0].surface, backdropRoot: issues[0].parentElement.backdrop, color: "orange" }), complete: () => complete,
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
	assert.deepEqual(h.issues.map((issue) => issue.parentElement.style.zIndex), ["6", "5", "4", "3", "2", "1"], "every card stays behind the card above it during the reveal");
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

for (const event of ["finish", "cancel"]) {
	test(`bulk drops back translucent activity rows with the column surface until ${event}`, () => {
		const h = fixture(4);
		const existing = { backgroundColor: "navy", backgroundImage: "none", transitionProperty: "opacity" };
		Object.assign(h.issues[0].shell.style, existing);
		const stop = h.start();
		for (const issue of h.issues) {
			assert.equal(issue.shell.style.backgroundColor, "token:elevation.surface", "an opaque base hides the next card's text");
			assert.equal(issue.shell.style.backgroundImage, "linear-gradient(rgb(248, 248, 248), rgb(248, 248, 248))", "retain the destination column's tint");
			assert.equal(issue.shell.style.transitionProperty, "none", "the backing must be opaque from the first frame");
		}
		if (event === "finish") {
			h.animations[0].onfinish();
			assert.equal(h.issues[0].shell.style.backgroundColor, "token:elevation.surface", "retain backing while any cards still overlap");
			for (const animation of h.animations.slice(1)) animation.onfinish();
		} else {
			stop(); stop();
		}
		assert.deepEqual(h.issues[0].shell.style, existing);
		for (const issue of h.issues.slice(1)) assert.deepEqual(issue.shell.style, { backgroundColor: "", backgroundImage: "", transitionProperty: "" });
		assert.equal(h.complete(), 1);
	});
}

test("bulk drops trace and unfold only cards intersecting the column and viewport", () => {
	for (const bounds of [{ clipBottom: 340 }, { viewportHeight: 340 }]) {
		const h = fixture(13, "Done", bounds); h.start();
		assert.equal(h.nodes.filter((node) => node.attributes.stroke).length, 3, "partially visible cards keep their trace");
		assert.equal(h.animations.length, 3, "fully offscreen slots never unfold into the visible stack");
		assert.equal(h.doc.body.children[0].attributes.height, String(2 * 112 + 96), "hidden cards add no sweep distance");
		h.runFrame();
		assert.equal(h.frameEvents.filter((event) => event === "read").length, 3, "hidden cards add no per-frame geometry work");
		for (const issue of h.issues.slice(3)) assert.equal(issue.parentElement.style.zIndex, "auto");
		for (const animation of h.animations) animation.onfinish();
		assert.equal(h.complete(), 1);
	}
});

test("fully clipped cards complete immediately without allocating a trace or animation", () => {
	const h = fixture(13, "Done", { clipBottom: 104 }); h.start();
	assert.equal(h.animations.length, 0, "touching the clip edge is not a visible intersection");
	assert.equal(h.doc.body.children.length, 0);
	assert.equal(h.frames.size, 0);
	assert.equal(h.complete(), 1);
});

test("a single moved card waits for surrounding reflow before becoming visible and interactive", () => {
	const h = fixture(3); h.start(false, ["K0"]);
	assert.equal(h.animations.length, 2, "the trace and delayed reveal share completion ownership");
	const entry = h.animations[1];
	assert.equal(entry.node, h.issues[0].parentElement);
	assert.deepEqual(JSON.parse(JSON.stringify(entry.keyframes)), [{ opacity: 0 }, { opacity: 1 }]);
	assert.equal(entry.options.delay, 150, "the card stays hidden until neighboring layout movement finishes");
	assert.equal(entry.options.duration, 0, "the card appears at rest without an entrance fade");
	assert.equal(entry.options.fill, "backwards");
	assert.equal(entry.node.inert, true);
	assert.equal(entry.node.getAttribute("aria-hidden"), "true");
	entry.onfinish();
	assert.equal(entry.node.inert, false);
	assert.equal(entry.node.getAttribute("aria-hidden"), null);
	assert.equal(h.complete(), 0, "the card is interactive before its longer trace completes");
	assert.notEqual(h.doc.body.children[0].removed, true);
	h.animations[0].onfinish();
	assert.equal(h.complete(), 1);
});

test("cancelling a pending single-card entry restores its existing accessibility state once", () => {
	const h = fixture(2);
	const slot = h.issues[0].parentElement;
	slot.setAttribute("aria-hidden", "false");
	const stop = h.start(false, ["K0"]);
	assert.equal(slot.inert, true);
	stop(); stop();
	assert.equal(slot.inert, false);
	assert.equal(slot.getAttribute("aria-hidden"), "false");
	assert.equal(h.complete(), 1);
});

test("a scrolled cohort starts its sweep at the first visible destination card", () => {
	const h = fixture(13, "Done", { clipTop: 328, clipBottom: 440 }); h.start();
	assert.equal(h.nodes.filter((node) => node.attributes.stroke).length, 1);
	assert.equal(h.animations.length, 1);
	assert.equal(h.doc.body.children[0].style.top, "328px");
	assert.equal(h.animations[0].options.duration, 650);
});

test("assignment arrivals retain their face reveal without a trace or a duplicate glow", () => {
	const h = fixture(1, "In progress");
	h.start(false, undefined, undefined, "none");
	assert.equal(h.nodes.some((node) => "data-issue-drop-trace" in node.attributes), false);
	assert.equal(h.nodes.some((node) => "data-jira-linking-glow-halo" in node.attributes), false);
	assert.equal(h.animations.length, 1);
	assert.deepEqual(structuredClone(h.animations[0].keyframes), [{ opacity: 0 }, { opacity: 1 }]);
	h.animations[0].onfinish();
	assert.equal(h.complete(), 1);
	assert.equal(h.issues[0].parentElement.inert, false);
});

test("existing cards share the delayed reveal's native 150ms reflow clock", () => {
	const h = fixture(3, "In progress");
	const before = [{ code: "K1", columnTitle: "In progress", bounds: { ...h.issues[1].parentElement.rect, top: 100, bottom: 212 } }];
	h.start(false, ["K0"], undefined, "none", before);
	const reflow = h.animations.find((animation) => animation.keyframes[0].transform);
	assert.equal(reflow.node, h.issues[1].parentElement);
	assert.equal(reflow.keyframes[0].transform, "translate3d(0px, -112px, 0)");
	assert.equal(reflow.options.duration, 150);
	const reveal = h.animations.find((animation) => animation.keyframes[0].opacity !== undefined);
	assert.equal(reveal.options.delay, reflow.options.duration);
	assert.equal(reveal.options.duration, 0);
	reflow.onfinish(); reveal.onfinish();
	assert.equal(h.complete(), 1);
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
	assert.equal(band.options.duration, 650);
	assert.equal(band.options.easing, "cubic-bezier(0.6, 0, 0.8, 0.6)");
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

test("single cards trace in every column, skip deck unfolding, and motion-off does no decoration", () => {
	for (const column of ["Done", "In review"]) {
		const single = fixture(1, column); single.start();
		assert.equal(single.animations.length, 2);
		assert.equal(single.issues[0].parentElement.style.zIndex, "auto");
		const reduced = fixture(6, column); reduced.start(true);
		assert.equal(reduced.animations.length, 0);
		assert.equal(reduced.doc.body.children.length, 0);
		assert.equal(reduced.reads.length, 0);
		assert.equal(reduced.complete(), 1);
	}
});

test("a drop whose committed cards have disappeared completes without creating an overlay", () => {
	const h = fixture(2);
	h.start(false, ["STALE-ISSUE"]);
	assert.equal(h.complete(), 1);
	assert.equal(h.animations.length, 0);
	assert.equal(h.doc.body.children.length, 0);
	assert.equal(h.reads.length, 0);
});

for (const column of ["To do", "In progress", "In review", "Done"]) {
	test(`${column} automatically sweeps both sides using its semantic destination color`, () => {
		const h = fixture(2, column); h.start();
		const outlines = h.nodes.filter((node) => node.attributes.stroke);
		assert.equal(outlines.length, 2);
		for (const outline of outlines) {
			assert.equal(outline.attributes.stroke, column === "Done" ? "token:color.border.success" : "token:color.border.bold");
			assert.equal(outline.attributes.x, "0.5");
			assert.equal(outline.attributes.width, "279");
		}
		const trace = h.animations[0];
		assert.match(trace.keyframes[0].transform, /^translateY\(0px\)/u);
		assert.match(trace.keyframes.at(-1).transform, /^translateY\([0-9]/u);
		assert.equal(trace.options.duration, 650);
		trace.onfinish();
		assert.equal(h.doc.body.children[0].removed, true);
	});
}

test("bulk Done borders get their full sweep after the card stack has unfolded", () => {
	const h = fixture(4, "Done"); h.start();
	const trace = h.animations[0];
	const settledAt = Math.max(...h.animations.slice(1).map(animation => animation.options.delay + animation.options.duration));
	assert.equal(trace.options.delay, settledAt, "the border sweep cannot start while the card borders are still moving");
	assert.equal(trace.options.duration, 650, "the entire existing trace plays after the reveal");
	for (const animation of h.animations.slice(1)) animation.onfinish();
	assert.equal(h.complete(), 0, "settled cards cannot release the celebration while their border is pending");
	trace.onfinish();
	assert.equal(h.complete(), 1);
	assert.equal(h.doc.body.children[0].removed, true, "the finale gate releases only after the full sweep");
	const other = fixture(4, "In review"); other.start();
	assert.equal(other.animations[0].options.delay, 0, "other destinations keep their existing timing");
	const single = fixture(1, "Done"); single.start();
	assert.equal(single.animations[0].options.delay, 150, "a single card's feedback starts once surrounding reflow has settled");
});

test("single and bulk traces use slower feedback timing with the existing band geometry", () => {
	for (const count of [1, 2, 3, 4, 13]) {
		for (const surfaceHeight of [64, 120, 400]) {
			const h = fixture(count, "Done", { surfaceHeight, slotHeight: surfaceHeight, step: surfaceHeight + 8 }); h.start();
			const trace = h.animations[0];
			const height = (count - 1) * (surfaceHeight + 8) + surfaceHeight;
			const bandLength = count === 1 ? Math.min(220, Math.max(112, height * 0.72)) : Math.min(160, Math.max(72, height * 0.45));
			assert.equal(trace.options.duration, 650);
			assert.equal(trace.options.easing, count === 1 ? "cubic-bezier(0.42, 0, 0.9, 1)" : "cubic-bezier(0.6, 0, 0.8, 0.6)");
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

test("a bulk reveal reads the column tint with its slots, before any motion or trace is written", () => {
	const h = fixture(4, "Done"); h.start();
	const tint = h.styleReads.filter((read) => read.node === h.columnSurface);
	assert.equal(tint.length, 1);
	assert.deepEqual({ ...tint[0], node: undefined }, { node: undefined, animations: 0, appended: 0 }, "a style read after a write forces an extra style pass");
	assert.ok(h.issues.every((issue) => issue.shell.style.backgroundImage === "linear-gradient(rgb(248, 248, 248), rgb(248, 248, 248))"));
});

// The settled release pins the traveller where the lead will land, so the
// resolver must agree with `moveJiraKanbanCardsToDropTarget`'s insertion.
function landing({ slots = [], collapsed = false, overflowing = false, listTop = 276, listBottom = 928, contentTop = 280, boardBottom = 950, innerHeight = 982 } = {}) {
	const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
	const slotNodes = slots.map(({ code, column = "Done", top, height = 199 }) => ({
		querySelector: () => ({ dataset: { issueKey: code, boardColumnTitle: column } }),
		getBoundingClientRect: () => rect(1146.5, top, 334.5, height),
	}));
	const content = { children: slotNodes, getBoundingClientRect: () => rect(1146.5, contentTop, 334.5, 0) };
	const list = { scrollHeight: overflowing ? 2000 : 8, clientHeight: overflowing ? 652 : 8, querySelector: () => content, getBoundingClientRect: () => rect(1142.5, listTop, 342.5, listBottom - listTop) };
	const done = { dataset: { jiraKanbanColumn: "Done", ...(collapsed ? { collapsed: "true" } : {}) }, querySelector: () => list };
	const other = { dataset: { jiraKanbanColumn: "To do" }, querySelector: () => null };
	const root = { querySelectorAll: () => [other, done], ownerDocument: { defaultView: { innerHeight } }, getBoundingClientRect: () => rect(0, 240, 1512, boardBottom - 240) };
	const loaded = { exports: {} };
	vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "issue-solitaire-drop.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
		module: loaded, exports: loaded.exports, getComputedStyle: () => ({ rowGap: "4px" }), require: () => ({ token: (name) => name, JIRA_KANBAN_CARD_REFLOW: { duration: 0.15, ease: [0, 0, 1, 1] } }),
	});
	return (codes, beforeCardCode, height = 199) => {
		const result = loaded.exports.resolveIssueSolitaireLanding(root, "Done", codes, beforeCardCode, height);
		return result && { ...result };
	};
}

test("the settled lead lands where the drop target inserts the cohort", () => {
	const empty = landing();
	assert.deepEqual(empty(["K1", "K2"], null), { left: 1146.5, top: 280, width: 334.5, depth: 2 }, "an empty column's first slot is its content box");
	assert.deepEqual(empty(["K1", "K2"], undefined), { left: 1146.5, top: 280, width: 334.5, depth: 2 });
	const filled = landing({ slots: [{ code: "D1", top: 280 }, { code: "D2", top: 483 }] });
	assert.deepEqual(filled(["K1"], "D2"), { left: 1146.5, top: 483, width: 334.5, depth: 1 }, "inserted before a card, the lead takes its slot");
	assert.deepEqual(filled(["K1"], undefined), { left: 1146.5, top: 280, width: 334.5, depth: 1 }, "an undefined target inserts at the top");
	assert.deepEqual(filled(["K1"], null, 100), { left: 1146.5, top: 686, width: 334.5, depth: 1 }, "appended, it follows the last slot and the list gap");
	const keynote = Array.from({ length: 13 }, (_, index) => `TEU-${index + 1}`);
	assert.equal(empty(keynote, null).depth, 4, "only the four slots the column shows join the first stack (280, 483, 686, 889)");
});

test("the settled lead defers to the commit whenever only the commit knows its slot", () => {
	const filled = landing({ slots: [{ code: "D1", top: 280 }, { code: "K2", top: 483 }] });
	assert.equal(filled(["K1", "K2"], "D1"), null, "a cohort issue already in the column shifts the slot when it leaves");
	assert.equal(landing({ slots: [{ code: "D1", top: 280 }] })(["K1"], "missing"), null);
	assert.equal(landing({ collapsed: true })(["K1"], null), null);
	assert.equal(landing({ slots: [{ code: "D1", top: 700 }], overflowing: true })(["K1"], null), null, "an overflowing list clips an appended lead");
	assert.equal(landing({ slots: [{ code: "D1", top: 600 }] })(["K1"], null), null, "a lead below the board would be clipped once the column grows");
	assert.equal(landing({ contentTop: 200 })(["K1"], null), null, "a lead scrolled above the list is not painted");
	assert.deepEqual(landing({ slots: [{ code: "D1", top: 280 }], overflowing: true })(["K1"], "D1"), { left: 1146.5, top: 280, width: 334.5, depth: 1 });
});
