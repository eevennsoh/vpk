const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");
const { renderComponent } = require(process.cwd() + "/scripts/lib/render-component.js");

const ENTRY = `
export * from "./lib/finale-trigger";
export * from "./lib/finale-math";
export * from "./lib/finale-card-motion";
export { finaleCameraRig, identityRig, heroAnchor, cameraSpeed } from "./lib/finale-camera";
export * from "./lib/finale-drag-order";
export * from "./data/finale-cues";
export * from "./data/finale-stories";
export * from "./data/finale-palette";
export { findFinaleCard, freezeFinalePrintScroll, loadFinalePrintImages, settleFinaleColumnCopy } from "./hooks/use-finale-prints";
export { captureJiraTeamEu26DoneColumn, isFinaleColumnCaptureReady, waitForFinaleColumnCapture } from "./lib/capture-done-column";
export { JIRA_TEAM_EU26_END_KEYNOTE_ISSUE_CODES } from "../data/keynote-board";
`;

let finale;
function loadFinale() {
	finale ??= loadCjsModuleFromText(esbuild.buildSync({
		stdin: { contents: ENTRY, resolveDir: __dirname, loader: "ts" },
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	}).outputFiles[0].text, "jira-team-eu26-end-finale-harness.cjs");
	return finale;
}

function columns(done, rest = []) {
	return [
		{ title: "Context", cards: rest.map((code) => ({ code })) },
		{ title: "Done", cards: done.map((code) => ({ code })) },
	];
}

test("finale prints and handoff identify a real card with its footer metadata hidden", async (t) => {
	const { findFinaleCard, captureJiraTeamEu26DoneColumn } = loadFinale();
	const view = await renderComponent({
		source: `
import { JiraIssue } from "@/components/blocks/jira-issue";
import { CreatedCardArrivalMotion } from "@/components/blocks/jira-kanban/experimental/components/created-card-arrival-motion";
export function FinaleCard(props) {
	return <CreatedCardArrivalMotion
		cardCode={props.issueKey}
		cardCount={1}
		cardIndex={0}
		columnTitle="Done"
		cardInsertion={null}
		dropTarget={null}
		onArrivalComplete={() => {}}
		shouldAnimateCardMoves={false}
	>
		<JiraIssue {...props} />
	</CreatedCardArrivalMotion>;
}
`,
		exportName: "FinaleCard",
		props: {
			issueKey: "TEU-1",
			summary: "Search across your work",
			agentActivityMode: "none",
			showFooterMetadata: false,
		},
	});
	view.container.dataset.jiraKanbanColumn = "Done";
	view.container.getBoundingClientRect = () => DOMRect.fromRect({ x: 900, y: 200, width: 320, height: 600 });
	const card = view.container.querySelector('[data-slot="jira-issue-card"]');
	assert.ok(card);
	card.getBoundingClientRect = () => DOMRect.fromRect({ x: 908, y: 248, width: 304, height: 200 });
	assert.equal(card.textContent.includes("TEU-1"), false, "the hidden footer cannot supply identity");
	assert.equal(view.container.querySelectorAll("[data-issue-key]").length, 1, "board geometry keeps one identity marker on the full card wrapper");
	assert.equal(findFinaleCard("TEU-1", "board") === card, true, "idle preprints find the card");
	assert.equal(findFinaleCard("TEU-1") === card, true, "completion prints find the same card in Done");
	// happy-dom does not perform hit testing; this fixture has no floating chrome.
	const elementsFromPoint = document.elementsFromPoint;
	document.elementsFromPoint = () => [];
	t.after(() => { document.elementsFromPoint = elementsFromPoint; });
	assert.deepEqual(captureJiraTeamEu26DoneColumn().cards, [{
		code: "TEU-1",
		rect: { x: 908, y: 248, width: 304, height: 200 },
	}], "the printed sheet starts at its original card's position");
});

test("capture waits for native drop cleanup and every destination card's layout", () => {
	const { isFinaleColumnCaptureReady } = loadFinale();
	let blocked = true;
	let width = 0;
	const column = {
		ownerDocument: { querySelector: () => null },
		querySelector: () => blocked ? {} : null,
		querySelectorAll: () => [{ getBoundingClientRect: () => ({ width, height: 199 }) }],
	};
	assert.equal(isFinaleColumnCaptureReady(column), false, "transition/header and arrival states cannot be frozen");
	blocked = false;
	assert.equal(isFinaleColumnCaptureReady(column), false, "hidden or deferred destinations are not a valid capture");
	width = 316;
	assert.equal(isFinaleColumnCaptureReady(column), true, "capture begins as soon as the destination is rendered");
});

test("capture does not freeze the tail of the drop's layout projection", async () => {
	const { waitForFinaleColumnCapture } = loadFinale();
	const previous = { document: globalThis.document, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
	const frames = [];
	let y = 280;
	const column = { ownerDocument: { querySelector: () => null }, querySelector: () => null, querySelectorAll: () => [], getBoundingClientRect: () => ({ x: 1085, y, width: 330, height: 821 }) };
	globalThis.document = { querySelector: () => column };
	globalThis.requestAnimationFrame = (callback) => { frames.push(callback); return frames.length; };
	globalThis.cancelAnimationFrame = () => {};
	try {
		let captured = false;
		const pending = waitForFinaleColumnCapture().then((result) => { captured = true; return result; });
		y = 283;
		frames.shift()();
		await Promise.resolve();
		assert.equal(captured, false, "moving bounds are not yet a valid immutable snapshot");
		frames.shift()();
		assert.equal(await pending, column, "the next stable paint frame releases capture");
	} finally {
		for (const [key, value] of Object.entries(previous)) {
			if (value === undefined) delete globalThis[key];
			else globalThis[key] = value;
		}
	}
});

test("finale capture waits for the Done border trace before taking over the board", async () => {
	const { waitForFinaleColumnCapture } = loadFinale();
	const previous = { document: globalThis.document, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
	const frames = [];
	let tracing = true;
	const column = {
		ownerDocument: { querySelector: (selector) => tracing && selector.includes('data-board-column-title="Done"') ? {} : null },
		querySelector: () => null,
		querySelectorAll: () => [],
		getBoundingClientRect: () => ({ x: 1000, y: 300, width: 300, height: 600 }),
	};
	globalThis.document = { querySelector: () => column };
	globalThis.requestAnimationFrame = (callback) => { frames.push(callback); return frames.length; };
	globalThis.cancelAnimationFrame = () => {};
	try {
		let captured = false;
		const pending = waitForFinaleColumnCapture().then((result) => { captured = true; return result; });
		frames.shift()();
		frames.shift()();
		await Promise.resolve();
		assert.equal(captured, false, "stable card geometry must not let the shader obscure an active trace");
		tracing = false;
		frames.shift()();
		frames.shift()();
		assert.equal(await pending, column, "trace completion releases the existing stable-layout gate");
	} finally {
		for (const [key, value] of Object.entries(previous)) {
			if (value === undefined) delete globalThis[key];
			else globalThis[key] = value;
		}
	}
});

test("offscreen print copies load their images before decode instead of waiting for lazy visibility", async () => {
	const { loadFinalePrintImages } = loadFinale();
	let decoded = 0;
	const images = [false, true].map((failed) => ({
		loading: "lazy",
		decode() {
			assert.equal(this.loading, "eager", "an offscreen image cannot wait for viewport visibility");
			decoded += 1;
			return failed ? Promise.reject(new Error("unavailable image")) : Promise.resolve();
		},
	}));
	await loadFinalePrintImages({ querySelectorAll: () => images });
	assert.equal(decoded, 2, "missing imagery never holds the column capture hostage");
});

test("an immediate completion print contains the landed cards while the live drop still shows its ghost", () => {
	const { settleFinaleColumnCopy } = loadFinale();
	const liveStyle = { opacity: "0", transform: "scale(0.8)" };
	const face = { style: { ...liveStyle } };
	const ghost = { style: { opacity: "1" } };
	const slot = { style: { height: "0px" } };
	const transient = { removed: false, remove() { this.removed = true; } };
	const resting = { style: { opacity: "0", transform: "translateY(100%)" } };
	settleFinaleColumnCopy({ querySelectorAll: (selector) => {
		if (selector.includes('copy-layer="label"')) return [transient];
		if (selector.includes('copy-layer="add"')) return [resting];
		return selector.includes("placeholder") ? [ghost] : selector.includes("jira-creating-slot") ? [slot] : [face];
	} });
	assert.equal(face.style.opacity, "1", "the printed face is visible immediately");
	assert.equal(face.style.transform, "none", "the print uses its landed size");
	assert.equal(ghost.style.opacity, "0", "the neutral drop ghost cannot cover the printed card");
	assert.equal(slot.style.height, "auto", "its final layout is reserved");
	assert.equal(transient.removed, true, "drag captions and incoming-count badges are excluded");
	assert.equal(resting.style.opacity, "1", "the real Done label/count remains visible");
	assert.deepEqual(liveStyle, { opacity: "0", transform: "scale(0.8)" }, "the live drop remains untouched");
});

test("a scrolled board's print keeps the column in its visible position", () => {
	const { freezeFinalePrintScroll } = loadFinale();
	class Element {
		constructor(children = [], scrollLeft = 0, scrollTop = 0, transform = "none") {
			Object.assign(this, { children, scrollLeft, scrollTop, style: { transform } });
		}
	}
	const previous = globalThis.HTMLElement;
	globalThis.HTMLElement = Element;
	try {
		const originalFace = new Element();
		const original = new Element([originalFace], 214, 80);
		const face = new Element([], 0, 0, "rotate(4deg)");
		const copy = new Element([face]);
		freezeFinalePrintScroll(original, copy);
		assert.equal(face.style.transform, "translate(-214px, -80px) rotate(4deg)");
		assert.equal(originalFace.style.transform, "none", "only the detached print is adjusted");
	} finally {
		if (previous === undefined) delete globalThis.HTMLElement;
		else globalThis.HTMLElement = previous;
	}
});

test("the finale is ready only once every keynote announcement sits in Done", () => {
	const { isJiraTeamEu26FinaleReady, JIRA_TEAM_EU26_END_KEYNOTE_ISSUE_CODES: codes } = loadFinale();
	assert.equal(codes.length, 25);
	assert.equal(isJiraTeamEu26FinaleReady(columns(codes), codes), true);
	assert.equal(isJiraTeamEu26FinaleReady(columns(codes.slice(0, -1), codes.slice(-1)), codes), false);
	// Cards created live during the demo neither block nor trigger the finale.
	assert.equal(isJiraTeamEu26FinaleReady(columns([...codes, "TEU-99"], ["TEU-100"]), codes), true);
	assert.equal(isJiraTeamEu26FinaleReady([{ title: "Context", cards: codes.map((code) => ({ code })) }], codes), false);
	assert.equal(isJiraTeamEu26FinaleReady(columns([]), []), false);
});

test("rehearsal URLs arm, seek and freeze the finale", () => {
	const { parseFinaleSearch } = loadFinale();
	assert.deepEqual(parseFinaleSearch(""), { autostart: false, seek: 0, hold: false });
	assert.deepEqual(parseFinaleSearch("?finale"), { autostart: true, seek: 0, hold: false });
	assert.deepEqual(parseFinaleSearch("?finale=2.35&hold"), { autostart: true, seek: 2.35, hold: true });
	assert.deepEqual(parseFinaleSearch("?finale=soon"), { autostart: true, seek: 0, hold: false });
	assert.deepEqual(parseFinaleSearch("?finale=-4"), { autostart: true, seek: 0, hold: false });
});

test("the cue sheet runs in order, stays silent for now, and fits the transition budget", () => {
	const { CUE, FINALE_SOUND_ENABLED, touchdownTime } = loadFinale();
	const order = [CUE.hit, CUE.burst, CUE.recoil, CUE.wide, CUE.sweep, CUE.zoom, CUE.zoomEnd, CUE.heroLand, CUE.title, CUE.yearStart, CUE.yearLand, CUE.end];
	order.forEach((time, index) => {
		if (index > 0) assert.ok(time > order[index - 1], `cue ${index} at ${time}s must follow ${order[index - 1]}s`);
	});
	assert.equal(FINALE_SOUND_ENABLED, false, "sound stays parked until the score is re-cut");
	assert.ok(CUE.end >= 5 && CUE.end <= 12, `finale runs ${CUE.end}s`);
	// The title waits until the bento is nearly assembled: after all but the last tile has landed.
	assert.ok(CUE.title > touchdownTime(4) && CUE.title < touchdownTime(5) + 0.5, "title arrives as the last tiles land");
});

test("drag order records arrivals in Done, forgets cards dragged back out, and re-appends returns", () => {
	const { nextFinaleDragOrder } = loadFinale();
	let order = nextFinaleDragOrder([], ["TEU-3"]);
	order = nextFinaleDragOrder(order, ["TEU-8", "TEU-3"]);
	order = nextFinaleDragOrder(order, ["TEU-1", "TEU-8", "TEU-3"]);
	assert.deepEqual(order, ["TEU-3", "TEU-8", "TEU-1"], "column order does not matter, arrival order does");
	order = nextFinaleDragOrder(order, ["TEU-1", "TEU-3"]);
	assert.deepEqual(order, ["TEU-3", "TEU-1"]);
	order = nextFinaleDragOrder(order, ["TEU-8", "TEU-1", "TEU-3"]);
	assert.deepEqual(order, ["TEU-3", "TEU-1", "TEU-8"]);
	assert.equal(nextFinaleDragOrder(order, ["TEU-8", "TEU-1", "TEU-3"]), order, "unchanged input keeps identity");
});

test("any drop into Done short of completing the board earns the small confetti, bulk drags included", () => {
	const { finaleArrivals, finaleSmallConfettiDue, nextFinaleDragOrder } = loadFinale();
	const drop = (previous, done) => finaleArrivals(previous, nextFinaleDragOrder(previous, done));
	assert.deepEqual(drop([], ["TEU-1"]), ["TEU-1"], "one card");
	assert.deepEqual(drop(["TEU-1"], ["TEU-1", "TEU-2", "TEU-3"]), ["TEU-2", "TEU-3"], "a bulk drag of two");
	assert.equal(finaleSmallConfettiDue(["TEU-1"], false), true);
	assert.equal(finaleSmallConfettiDue(["TEU-2", "TEU-3"], false), true, "a bulk drag celebrates too");
	assert.equal(finaleSmallConfettiDue(["TEU-4", "TEU-5", "TEU-6"], false), true);
	assert.equal(finaleSmallConfettiDue(["TEU-12", "TEU-13"], true), false, "the drop that completes the board opens the finale instead");
	assert.deepEqual(drop(["TEU-1", "TEU-2"], ["TEU-1"]), [], "dragging a card back out is no arrival");
	assert.equal(finaleSmallConfettiDue(drop(["TEU-1", "TEU-2"], ["TEU-2", "TEU-1"]), false), false, "nor is reordering within Done");
});

test("the bento shows the Figma's six features in its slots, each a keynote story", () => {
	const { FINALE_FEATURES, FINALE_SLOT_COUNT, FINALE_STORIES, finaleBentoLayout } = loadFinale();
	assert.equal(FINALE_FEATURES.length, FINALE_SLOT_COUNT);
	// Landing order is slot order: a, e, c, b, f, d.
	const slots = finaleBentoLayout({ width: 1920, height: 1080 }, 1).slots.map((slot) => slot.id);
	const bySlot = Object.fromEntries(FINALE_FEATURES.map((story, order) => [slots[order], story.title]));
	assert.deepEqual(bySlot, {
		a: "Agent Session Tracking",
		e: "Artifacts",
		c: "Agent Effectiveness",
		b: "AI Capital Management",
		f: "Rovo For Work",
		d: "Loom Record for Agent",
	});
	for (const feature of FINALE_FEATURES) assert.ok(FINALE_STORIES.includes(feature), `${feature.code} is a keynote story`);
});

test("the recap retains each reference story's issue identity and updated name", () => {
	const { FINALE_STORIES } = loadFinale();
	assert.equal(FINALE_STORIES.length, 25);
	assert.deepEqual(FINALE_STORIES.filter((story) => ["TEU-4", "TEU-101", "TEU-107", "TEU-10"].includes(story.code)).map((story) => [story.code, story.title, story.chapter]), [
		["TEU-4", "Artifacts", "Context"],
		["TEU-101", "Data Context", "Context"],
		["TEU-107", "ChatGPT Codex from Jira", "Collaboration"],
		["TEU-10", "Agent Session Tracking", "Confidence"],
	]);
});

test("the bento fills any screen shape with 40px clear on every side and nothing overlapping", () => {
	const { finaleBentoLayout, FINALE_BENTO_MARGIN, FINALE_SLOT_COUNT } = loadFinale();
	for (const viewport of [{ width: 1920, height: 1080 }, { width: 1618, height: 1025 }, { width: 1280, height: 960 }]) {
		const scale = Math.min(viewport.width / 1920, viewport.height / 1080);
		const { slots, title } = finaleBentoLayout(viewport, scale);
		assert.equal(slots.length, FINALE_SLOT_COUNT);
		const rects = [...slots.map((slot) => [slot.id, slot.rect]), ["title", title]];
		const edges = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
		for (const [id, rect] of rects) {
			edges.left = Math.min(edges.left, rect.x);
			edges.top = Math.min(edges.top, rect.y);
			edges.right = Math.max(edges.right, rect.x + rect.width);
			edges.bottom = Math.max(edges.bottom, rect.y + rect.height);
			assert.ok(rect.width > 0 && rect.height > 0, `${id} has room at ${viewport.width}×${viewport.height}`);
		}
		const label = `${viewport.width}×${viewport.height}`;
		assert.ok(Math.abs(edges.left - FINALE_BENTO_MARGIN) < 1e-6 && Math.abs(edges.top - FINALE_BENTO_MARGIN) < 1e-6, `40px top-left at ${label}`);
		assert.ok(Math.abs(viewport.width - edges.right - FINALE_BENTO_MARGIN) < 1e-6 && Math.abs(viewport.height - edges.bottom - FINALE_BENTO_MARGIN) < 1e-6, `40px bottom-right at ${label}`);
		for (const [index, [idA, a]] of rects.entries()) {
			for (const [idB, b] of rects.slice(index + 1)) {
				const overlaps = a.x < b.x + b.width - 1e-6 && b.x < a.x + a.width - 1e-6 && a.y < b.y + b.height - 1e-6 && b.y < a.y + a.height - 1e-6;
				assert.ok(!overlaps, `${idA} overlaps ${idB} at ${label}`);
			}
		}
	}
});

function fieldInput(role, rect, fieldIndex = 0) {
	return { rect, fieldIndex, fieldCount: 13, burstIndex: fieldIndex, role };
}

function rigsEqual(a, b) {
	const keys = ["x", "y", "z"];
	return keys.every((key) => Math.abs(a.position[key] - b.position[key]) < 1e-6 && Math.abs(a.target[key] - b.target[key]) < 1e-6) && Math.abs(a.roll - b.roll) < 1e-9;
}

test("the camera rests on the slide at frame 0 and from the hero's landing on, and truly travels in between", () => {
	const { CUE, cameraDistance, finaleCameraRig, identityRig } = loadFinale();
	const viewport = { width: 1920, height: 1080 };
	const subject = { x: 0, y: 0, width: 436, height: 199 };
	const rest = identityRig(viewport);
	for (const time of [0, CUE.heroLand, CUE.heroLand + 0.5, CUE.end]) {
		assert.ok(rigsEqual(finaleCameraRig(time, viewport, subject), rest), `camera at rest at ${time}s`);
	}
	const distance = cameraDistance(viewport);
	const reveal = finaleCameraRig(CUE.burst + 1.4, viewport, subject);
	assert.ok(Math.hypot(reveal.position.x, reveal.position.y, reveal.position.z - distance) > distance * 0.3, "the reveal cranes well away from the slide camera");
	assert.ok(Math.abs(reveal.roll) > 0.03, "and banks");
	// Every shot the audience sees is continuous: no frame-to-frame jump through
	// the rush's arrival. (The return to the slide happens once the field has
	// cleared, with the hero placed in screen space, so it is never seen.)
	let previous = finaleCameraRig(0, viewport, subject);
	for (let time = 1 / 60; time <= CUE.zoomEnd; time += 1 / 60) {
		const rig = finaleCameraRig(time, viewport, subject);
		const step = Math.hypot(rig.position.x - previous.position.x, rig.position.y - previous.position.y, rig.position.z - previous.position.z);
		assert.ok(step < distance * 0.08, `camera jumps ${step.toFixed(0)}px at ${time.toFixed(2)}s`);
		previous = rig;
	}
});

test("each card is one continuous layer from the Done column to its bento tile, as the camera films it", () => {
	const { CUE, finaleBentoLayout, cameraDistance, cardPose, finaleCameraRig, projectPose, tileFallStart, tileHandoff, touchdownTime } = loadFinale();
	const fit = { scale: 0.5, x: 0, y: 30 };
	const viewport = { width: 960, height: 600 };
	const card = { x: 708, y: 160, width: 224, height: 150 };
	const slots = finaleBentoLayout(viewport, fit.scale).slots.map((slot) => slot.rect);
	const roles = [
		{ kind: "hero", slot: slots[0] },
		{ kind: "tile", order: 3, slot: slots[3] },
		{ kind: "extra" },
	];
	const distance = cameraDistance(viewport);
	for (const [fieldIndex, role] of roles.entries()) {
		const pose = (time) => cardPose(time, fieldInput(role, card, fieldIndex), viewport);
		// Frame 0 sits exactly on the DOM card: flat, card face, clipped to the column.
		const start = pose(0);
		assert.deepEqual([start.x - start.width / 2, start.y - start.height / 2, start.width, start.height, start.z], [card.x, card.y, card.width, card.height, 0], role.kind);
		assert.equal(start.face, 0);
		assert.equal(start.clip, 1);
		assert.equal(pose(CUE.burst + CUE.burstSpread + 0.2).clip, 0, `${role.kind} is clear of the column clip once it has been tossed out`);
		if (role.kind === "extra") {
			assert.equal(pose(CUE.heroLand).opacity, 0, "extras have left by the time the camera is back on the slide");
			continue;
		}
		// Lands exactly on its slot, flat, as its tile, then hands over to the DOM tile.
		const order = role.kind === "hero" ? 0 : role.order;
		// Its card until it flies for its slot, then its tile within a fifth of a second: the
		// two pictures never sit over each other long enough to read as a double exposure.
		const flight = role.kind === "hero" ? CUE.zoomEnd : tileFallStart(order);
		assert.equal(pose(flight).face, 0, `${role.kind} is still its card as its flight starts`);
		let turning = null;
		let turned = null;
		for (let time = flight; time <= touchdownTime(order); time += 0.005) {
			const { face } = pose(time);
			if (turning === null && face > 0.05) turning = time;
			if (turned === null && face >= 0.95) turned = time;
		}
		assert.ok(turning !== null && turned !== null && turned - turning < 0.25, `${role.kind} turns into its tile in ${Math.round(((turned ?? Infinity) - (turning ?? 0)) * 1000)} ms`);
		const rest = projectPose(pose(touchdownTime(order) + 0.01), viewport);
		for (const key of ["x", "y", "width", "height"]) assert.ok(Math.abs(rest[key] - role.slot[key]) < 0.5, `${role.kind} ${key}`);
		assert.equal(pose(touchdownTime(order) + 0.01).face, 1);
		assert.ok(pose(touchdownTime(order) + 0.2).waveAge > 0, "Peel landing wave runs after touchdown");
		assert.equal(tileHandoff(touchdownTime(order) + 0.2, order), 0, "GL sheet still owns the wave");
		assert.equal(tileHandoff(touchdownTime(order) + CUE.handoff + 0.2, order), 1, "crisp DOM tile once settled");
		// No teleporting on screen while the card is in front of the lens and not a fly-by.
		let previous = null;
		for (let time = 0; time < CUE.end; time += 1 / 60) {
			const frame = pose(time);
			const rig = finaleCameraRig(time, viewport, card);
			const next = projectPose(frame, viewport, rig);
			const centre = { x: next.x + next.width / 2, y: next.y + next.height / 2 };
			const onScreen = centre.x > -viewport.width && centre.x < viewport.width * 2 && centre.y > -viewport.height && centre.y < viewport.height * 2;
			if (role.kind === "hero" && previous && onScreen) {
				const step = Math.hypot(centre.x - previous.x, centre.y - previous.y);
				assert.ok(step < 90, `hero jumps ${step.toFixed(1)}px on screen at ${time.toFixed(2)}s`);
			}
			assert.ok(frame.z < distance * 0.8, `${role.kind} never bursts past the resting lens at ${time.toFixed(2)}s`);
			previous = centre;
		}
	}
});

test("the camera finds the hero far off, then rushes in and arrives face-on with it filling the frame", () => {
	const { CUE, cameraDistance, finaleBentoLayout, cardPose, finaleCameraRig, projectPose } = loadFinale();
	const viewport = { width: 1920, height: 1080 };
	const slots = finaleBentoLayout(viewport, 1).slots.map((slot) => slot.rect);
	const card = { x: 1450, y: 300, width: 436, height: 199 };
	const hero = (time) => cardPose(time, fieldInput({ kind: "hero", slot: slots[0] }, card), viewport);
	const framed = (time) => projectPose(hero(time), viewport, finaleCameraRig(time, viewport, card));
	const far = framed(CUE.zoom);
	const near = framed(CUE.zoomEnd);
	assert.ok(far.width < viewport.width * 0.2, `small and far away as the rush begins (${far.width.toFixed(0)}px)`);
	assert.ok(Math.abs(near.x + near.width / 2 - viewport.width / 2) < 2 && Math.abs(near.y + near.height / 2 - viewport.height / 2) < 2, "centred when the rush arrives");
	assert.ok(Math.abs(near.width - viewport.width * 0.52) < viewport.width * 0.02, `fills the frame (${near.width.toFixed(0)}px)`);
	const pose = hero(CUE.zoomEnd);
	assert.ok(Math.abs(pose.rotateX) < 1e-6 && Math.abs(pose.rotateY) < 1e-6, "face-on");
	assert.ok(hero(CUE.zoom).z < -cameraDistance(viewport), "the hero waits deep in the field");
	for (let order = 1; order < slots.length; order += 1) {
		const role = { kind: "tile", order, slot: slots[order] };
		const held = projectPose(cardPose(CUE.tiles, fieldInput(role, card, order), viewport), viewport);
		const outside = held.x + held.width < 0 || held.x > viewport.width || held.y + held.height < 0 || held.y > viewport.height;
		assert.ok(outside, `tile ${order} waits out of frame for its swoop`);
	}
});

test("tiles land one by one and every heading has built with a hold before the final frame", () => {
	const { CUE, FINALE_SLOT_COUNT, touchdownTime, tileRevealStart } = loadFinale();
	const landings = Array.from({ length: FINALE_SLOT_COUNT }, (_, order) => touchdownTime(order));
	landings.forEach((time, order) => {
		if (order > 0) assert.ok(time > landings[order - 1], "tiles land one after another");
	});
	const lastHeadingBuilt = tileRevealStart(FINALE_SLOT_COUNT - 1) + CUE.reveal;
	// A short hold: the title turns into its black card soon after, without a wait.
	const hold = CUE.end - lastHeadingBuilt;
	assert.ok(hold >= 0.5 && hold <= 0.8, `final frame holds ${hold.toFixed(2)}s after the last heading builds`);
	assert.ok(CUE.end - CUE.yearLand >= 1, "the year has landed well before the final frame");
});

test("the dot grid only exists as one pulse per tile touchdown", () => {
	const { finaleBentoLayout, fieldRipples, touchdownTime } = loadFinale();
	const slots = finaleBentoLayout({ width: 1920, height: 1080 }, 1).slots.map((slot) => slot.rect);
	const ripples = fieldRipples(slots);
	assert.equal(ripples.length, slots.length);
	slots.forEach((rect, order) => {
		assert.ok(ripples.some((ripple) => ripple.from === rect && ripple.start === touchdownTime(order)), `tile ${order} pulses on landing`);
	});
});

test("the chromatic smear is off on frame 0 and the final bento, and peaks on the rush", () => {
	const { CUE, chromaStrength, touchdownTime } = loadFinale();
	const viewport = { width: 1920, height: 1080 };
	const subject = { x: 0, y: 0, width: 436, height: 199 };
	const chroma = (time) => chromaStrength(time, viewport, subject);
	assert.equal(chroma(0), 0);
	assert.equal(chroma(CUE.burst), 0, "the burst starts from a clean frame");
	assert.equal(chroma(touchdownTime(5) + 0.01), 0, "clean once the last tile lands");
	assert.equal(chroma(CUE.end), 0);
	let peak = 0;
	let peakAt = 0;
	for (let time = 0; time < CUE.end; time += 0.01) {
		if (chroma(time) > peak) [peak, peakAt] = [chroma(time), time];
	}
	assert.ok(peakAt >= CUE.zoom && peakAt <= CUE.zoomEnd, `strongest on the rush (peak at ${peakAt.toFixed(2)}s)`);
	assert.ok(chroma(CUE.burst + 0.4) > 0.3, "the burst smears at the edges");
});

test("the cloth feels motion as the camera sees it, and only while airborne", () => {
	const { CUE, finaleBentoLayout, cardVelocity, touchdownTime } = loadFinale();
	const viewport = { width: 1920, height: 1080 };
	const card = { x: 1450, y: 300, width: 280, height: 180 };
	const input = { rect: card, fieldIndex: 2, fieldCount: 13, burstIndex: 2, role: { kind: "tile", order: 2, slot: finaleBentoLayout(viewport, 1).slots[2].rect } };
	const speed = (time) => {
		const velocity = cardVelocity(time, input, viewport, card);
		return Math.hypot(velocity.x, velocity.y, velocity.z);
	};
	assert.equal(speed(0), 0, "at rest on frame 0");
	assert.ok(speed(CUE.burst + 0.5) > 100, "bursting sheets feel the air");
	assert.ok(speed(CUE.burst + 1.95) > 100, "a floating sheet still bends as the camera sweeps past it");
	assert.equal(cardVelocity(touchdownTime(2) + 0.3, input, viewport, card).weight, 0, "a landed tile is paper again, not cloth");
});

test("the deck is tossed out of the column at once, tumbling, as cloth from the first frame", () => {
	const { CUE, cardPose } = loadFinale();
	const viewport = { width: 1920, height: 1080 };
	const card = { x: 1460, y: 300, width: 420, height: 190 };
	const inputs = Array.from({ length: 13 }, (_, index) => ({ rect: card, fieldIndex: index, fieldCount: 13, burstIndex: index, role: { kind: "extra" } }));
	let flipped = 0;
	for (const input of inputs) {
		const start = cardPose(0, input, viewport);
		assert.deepEqual([start.x, start.y, start.z, start.rotateX + 0, start.rotateY + 0, start.rotateZ + 0, start.clip], [card.x + card.width / 2, card.y + card.height / 2, 0, 0, 0, 0, 1], "frame 0 is the DOM card");
		// Everyone is in the air within a hair of the throw: a toss, not a queue.
		const early = cardPose(CUE.burst + CUE.burstSpread + 0.1, input, viewport);
		assert.ok(early.lift > 0.99, "cloth from the first frame");
		const away = cardPose(CUE.burst + CUE.burstSpread + 0.3, input, viewport);
		assert.ok(Math.hypot(away.x - start.x, away.y - start.y, away.z) > 40, `card ${input.burstIndex} has left the column`);
		assert.equal(cardPose(CUE.burst + CUE.burstSpread + 0.2, input, viewport).clip, 0, "cards scrolled out of the column come into view as they fly");
		let spin = 0;
		let previous = start;
		for (let time = 0; time < CUE.burst + CUE.burstDuration * 1.2; time += 1 / 120) {
			const pose = cardPose(time, input, viewport);
			spin += Math.abs(pose.rotateX - previous.rotateX) + Math.abs(pose.rotateY - previous.rotateY) + Math.abs(pose.rotateZ - previous.rotateZ);
			previous = pose;
		}
		if (spin > Math.PI * 1.8) flipped += 1;
	}
	assert.ok(flipped >= 2 && flipped <= 11, `some cards flip or spin a whole turn, not all (${flipped} of 13)`);
});

test("the frame warps onto a sphere only while the camera is out in the field, deepest on the rush", () => {
	const { CUE, sphereWarp } = loadFinale();
	assert.equal(sphereWarp(0), 0, "the column hand-off is flat");
	assert.equal(sphereWarp(CUE.heroLand), 0, "the bento is flat");
	assert.equal(sphereWarp(CUE.end), 0);
	assert.ok(sphereWarp(CUE.wide) > 0.15, "the field bulges");
	assert.ok(sphereWarp(CUE.zoom + 0.45) > sphereWarp(CUE.wide), "the rush deepens the warp");
});

function shadowPose(overrides = {}) {
	return { x: 960, y: 540, z: 0, width: 480, height: 360, rotateX: 0, rotateY: 0, rotateZ: 0, opacity: 1, face: 1, lift: 0, waveAge: -1, clip: 0, ...overrides };
}

const SHADOW_VIEWPORT = { width: 1920, height: 1080 };

test("a landing tile casts a real-world drop shadow only while it comes down onto the slide", () => {
	const { CUE, landingShadow, tileFallStart, touchdownTime } = loadFinale();
	const order = 3;
	const high = shadowPose({ z: 600, lift: 0.85 });
	assert.equal(landingShadow(tileFallStart(order) - 0.01, order, high, SHADOW_VIEWPORT), null, "no table, no shadow, while the card is out in the field");
	const start = landingShadow(tileFallStart(order) + 0.01, order, high, SHADOW_VIEWPORT);
	const later = landingShadow(tileFallStart(order) + 0.2, order, high, SHADOW_VIEWPORT);
	assert.ok(start && later && start.opacity < later.opacity * 0.1, "it fades in as the card starts down, never pops");
	const down = landingShadow(touchdownTime(order), order, shadowPose(), SHADOW_VIEWPORT);
	const fading = landingShadow(touchdownTime(order) + 0.3, order, shadowPose(), SHADOW_VIEWPORT);
	assert.ok(down && fading && fading.opacity < down.opacity, "it fades once the card lies flat");
	assert.equal(landingShadow(touchdownTime(order) + CUE.handoff, order, shadowPose(), SHADOW_VIEWPORT), null, "gone before the hand-off to the flat DOM tile");
	assert.equal(landingShadow(touchdownTime(order) + 0.5, order, shadowPose(), SHADOW_VIEWPORT), null);
	assert.ok(landingShadow(CUE.zoomEnd + 0.3, 0, shadowPose({ lift: 0.5 }), SHADOW_VIEWPORT), "the hero casts one as it comes down onto the slide");
});

test("higher up, a card's shadow is softer, bigger, fainter and thrown away from the top-left light", () => {
	const { landingShadow, tileFallStart } = loadFinale();
	const order = 2;
	const time = tileFallStart(order) + 0.35;
	const low = landingShadow(time, order, shadowPose({ z: 30 }), SHADOW_VIEWPORT);
	const mid = landingShadow(time, order, shadowPose({ z: 250 }), SHADOW_VIEWPORT);
	const high = landingShadow(time, order, shadowPose({ z: 650 }), SHADOW_VIEWPORT);
	assert.ok(low && mid && high);
	assert.ok(low.blur < mid.blur && mid.blur < high.blur, `penumbra grows with height (${low.blur}, ${mid.blur}, ${high.blur})`);
	assert.ok(high.blur > 40 && low.blur < 10, "contact-hard near the slide, broad up high");
	assert.ok(low.scale < mid.scale && mid.scale < high.scale && high.scale > 1.05, "a nearer light enlarges a higher card's shadow");
	assert.ok(high.bounds.width > low.bounds.width + 100, "and its blur spreads it much wider");
	assert.ok(low.opacity > mid.opacity && mid.opacity > high.opacity, "energy spreads out, so the peak fades");
	assert.ok(low.falloff.contact > 0 && high.falloff.contact === 0, "contact occlusion only near the slide");
	assert.ok(Math.hypot(high.offset.x, high.offset.y) > Math.hypot(mid.offset.x, mid.offset.y) * 2, "thrown further as it rises");
	// World axes are y up: the light is up and to the left, so the shadow falls down and to the right.
	assert.ok(high.offset.x > 100 && high.offset.y < -100, `away from the light (${high.offset.x}, ${high.offset.y})`);
});

test("the paper's folds are lit by the very key light the landing shadows are cast from", () => {
	const { FINALE_LIGHT_DIRECTION: light, landingShadow, tileFallStart } = loadFinale();
	assert.ok(Math.abs(Math.hypot(light.x, light.y, light.z) - 1) < 1e-12, "a unit vector, as the sheet shader expects");
	assert.ok(light.x < 0 && light.y > 0 && light.z > 0.8, "up and to the top left, well above the slide");
	// A flat card's shadow falls straight away from that light, so fold shading and shadow agree.
	const order = 2;
	const cast = landingShadow(tileFallStart(order) + 0.35, order, shadowPose({ z: 400 }), SHADOW_VIEWPORT);
	assert.ok(cast);
	const along = Math.hypot(cast.offset.x, cast.offset.y);
	const toward = Math.hypot(light.x, light.y);
	assert.ok(Math.abs(cast.offset.x / along + light.x / toward) < 1e-6 && Math.abs(cast.offset.y / along + light.y / toward) < 1e-6, `shadow thrown opposite the light (${cast.offset.x}, ${cast.offset.y})`);
});

test("a tilted card casts a foreshortened trapezoid, a flat one a copy of itself", () => {
	const { landingShadow, tileFallStart } = loadFinale();
	const order = 4;
	const time = tileFallStart(order) + 0.3;
	const edge = (points, from, to) => Math.hypot(points[to].x - points[from].x, points[to].y - points[from].y);
	const flat = landingShadow(time, order, shadowPose({ z: 300 }), SHADOW_VIEWPORT);
	const tilted = landingShadow(time, order, shadowPose({ z: 300, rotateX: -0.3 }), SHADOW_VIEWPORT);
	assert.ok(flat && tilted);
	const flatFoot = flat.cast.footprint;
	const tiltFoot = tilted.cast.footprint;
	assert.ok(Math.abs(edge(flatFoot, 0, 1) - edge(flatFoot, 3, 2)) < 0.01, "flat: opposite edges match");
	assert.ok(Math.abs(edge(tiltFoot, 0, 1) - edge(tiltFoot, 3, 2)) > 5, "tilted: the edge nearer the light's height is longer (a trapezoid)");
	assert.ok(Math.abs(edge(tiltFoot, 1, 2) - edge(flatFoot, 1, 2)) > 10, "and it is foreshortened along the tilt");
	const [a, b, c] = tilted.heightPlane;
	assert.ok(Math.abs(a) < 1e-9 && Math.abs(b) > 0.2 && Math.abs(c - 300) < 1e-6, "tilted about x: height varies down the card, so its penumbra does too");
	const spun = landingShadow(time, order, shadowPose({ z: 300, rotateZ: 0.4 }), SHADOW_VIEWPORT);
	assert.ok(spun && Math.abs(Math.atan2(spun.cast.footprint[1].y - spun.cast.footprint[0].y, spun.cast.footprint[1].x - spun.cast.footprint[0].x) + 0.4) < 1e-6, "a spun card's shadow spins with it");
});

test("at touchdown the shadow sits right under the card, tight and dark, and its homography maps back onto the card", () => {
	const { landingShadow, touchdownTime } = loadFinale();
	const order = 1;
	const pose = shadowPose({ x: 700, y: 400 });
	const shadow = landingShadow(touchdownTime(order), order, pose, SHADOW_VIEWPORT, undefined, 24);
	assert.ok(shadow);
	assert.ok(Math.hypot(shadow.offset.x, shadow.offset.y) < 1e-6 && shadow.height === 0, "no throw at contact");
	assert.ok(shadow.blur < 2, "sharp at contact");
	assert.ok(shadow.opacity > 0.4, `and dark (${shadow.opacity})`);
	assert.equal(shadow.radius, 24);
	// Card rect in world axes (y up), centred at poseToWorld.
	const centre = { x: pose.x - 960, y: 540 - pose.y };
	const expected = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => ({ x: centre.x + (sx * pose.width) / 2, y: centre.y + (sy * pose.height) / 2 }));
	for (const layer of [shadow.cast, shadow.contact]) {
		layer.footprint.forEach((point, index) => {
			assert.ok(Math.hypot(point.x - expected[index].x, point.y - expected[index].y) < 1e-6, "footprint is the card itself");
			const m = layer.toCard;
			const w = m[6] * point.x + m[7] * point.y + m[8];
			const u = { x: (m[0] * point.x + m[1] * point.y + m[2]) / w, y: (m[3] * point.x + m[4] * point.y + m[5]) / w };
			assert.ok(Math.hypot(u.x - (expected[index].x - centre.x), u.y - (expected[index].y - centre.y)) < 1e-6, "ground → card inverts card → ground");
		});
	}
});

test("the hero's shadow falls on a lens-square plane that becomes the slide as it lands", () => {
	const { CUE, heroShadowGround, landingShadow } = loadFinale();
	const basis = { right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 }, forward: { x: 0, y: 0, z: -1 } };
	const world = { x: 0, y: 0, z: 0 };
	const high = heroShadowGround(world, basis, 2000, 1);
	const flat = heroShadowGround(world, basis, 2000, 0);
	assert.ok(high.origin.z < -500, "behind the card along the lens while it is high");
	assert.deepEqual(flat.origin, world, "on the card once it has landed");
	const lifted = landingShadow(CUE.zoomEnd + 0.3, 0, shadowPose({ lift: 1 }), SHADOW_VIEWPORT, high);
	assert.ok(lifted && lifted.height > 500 && lifted.offset.x > 0 && lifted.offset.y < 0, "cast down and right, away from the light");
});

test("colour parsing reads hex and rgb() alike (the slide never eases to black)", () => {
	const { parseRgb, FINALE_COLORS } = loadFinale();
	assert.deepEqual(parseRgb("#F1F2F4"), [241, 242, 244]);
	assert.deepEqual(parseRgb(FINALE_COLORS.slide), [255, 255, 255]);
	assert.deepEqual(parseRgb("rgb(248, 248, 248)"), [248, 248, 248]);
	assert.deepEqual(parseRgb("rgba(9, 30, 66, 0.14)"), [9, 30, 66]);
});

test("easing and spring helpers are bounded and settle", () => {
	const { EASE, cubicBezier, spring } = loadFinale();
	for (const [name, ease] of Object.entries(EASE)) {
		assert.equal(ease(0), 0, name);
		assert.equal(ease(1), 1, name);
	}
	// Cross-check the solver against a brute-force sampled Bézier (ADS ease-in-out).
	const [x1, y1, x2, y2] = [0.4, 0, 0, 1];
	const solve = cubicBezier(x1, y1, x2, y2);
	const bezier = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3;
	for (let step = 1; step < 200; step += 1) {
		const t = step / 200;
		assert.ok(Math.abs(solve(bezier(x1, x2, t)) - bezier(y1, y2, t)) < 1e-3, `solver drifts at t=${t}`);
	}
	assert.equal(spring(0), 0);
	assert.ok(Math.abs(spring(1.5) - 1) < 0.01, "spring settles within 1.5 s");
	assert.ok(Math.max(...Array.from({ length: 60 }, (_, index) => spring(index / 60))) > 1, "spring overshoots once");
});

test("a tossed card's column clip rides on the sheet, never on screen", () => {
	const { restClipUv } = loadFinale();
	// Regression: the clip used to stay screen-fixed while it released, so for
	// ~0.3s of the burst the flying cards were opaque inside the column's rect and
	// ghosted outside it: a hard-edged, column-shaped block over the field.
	const list = { x: 1200, y: 280, width: 380, height: 560 };
	const inside = restClipUv({ x: 1208, y: 300, width: 364, height: 190 }, list);
	assert.ok(inside[0] < 0 && inside[1] < 0 && inside[2] > 1 && inside[3] > 1, "a card the viewport fully showed is never clipped once tossed");
	// Straddling the bottom of the viewport: its lower 100 of 190 px were hidden (uv v is up).
	const straddling = restClipUv({ x: 1208, y: 750, width: 364, height: 190 }, list);
	assert.ok(Math.abs(straddling[1] - 100 / 190) < 1e-9, "the hidden lower part stays clipped on the sheet");
	assert.ok(straddling[3] > 1 && straddling[0] < 0 && straddling[2] > 1, "the shown part is untouched");
	// Scrolled out entirely: the whole sheet is outside, so it fades in as a whole.
	const hidden = restClipUv({ x: 1208, y: 1200, width: 364, height: 190 }, list);
	assert.ok(hidden[1] > 1, "a card scrolled out of the column is hidden on its whole sheet");
});
