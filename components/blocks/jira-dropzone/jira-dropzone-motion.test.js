const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
	JIRA_DROPZONE_DURATION_TOKEN_MS,
	JIRA_DROPZONE_FULL_MOTION_PROFILE,
	JIRA_DROPZONE_REDUCED_MOTION_PROFILE,
	resolveFlightProfile,
	resolveJiraDropzoneArcOptions,
	createSessionChipDropKeyframes,
} = require("./lib/jira-dropzone-motion.ts");

test("create and link chips use the same release duration and path", () => {
	const { JIRA_LINKING_GLOW_DROP_DURATION_MS, createJiraLinkingGlowDropKeyframes } = require("../jira-linking/glow-motion.ts");
	assert.equal(JIRA_DROPZONE_FULL_MOTION_PROFILE.durationMs, JIRA_LINKING_GLOW_DROP_DURATION_MS);
	assert.deepEqual(createSessionChipDropKeyframes({ x: 20, y: 50 }, { x: 200, y: 300 }, "landing"),
		createJiraLinkingGlowDropKeyframes({ x: 20, y: 50 }, { x: 200, y: 300 }));
});

test("creation drops absorb chips even at the target center and converge fanned chips", () => {
	const centered = createSessionChipDropKeyframes({ x: 30, y: 100 }, { x: 30, y: 100 }, "landing");
	assert.equal(centered[0].opacity, 1);
	assert.match(centered[24].transform, /translate3d\(30px, 80px, 0\)/u);
	assert.equal(centered.at(-1).opacity, 0);
	const fanned = createSessionChipDropKeyframes({ x: -150, y: 100 }, { x: 30, y: 200 }, "landing");
	assert.equal(fanned.at(-1).transform, "translate3d(30px, 200px, 0) scale(0.65)");
});

test("a moving landing point updates the flight without restarting its clock", (t) => {
	const { animateSessionChipDrop } = require("./lib/session-chip-drop-flight.ts");
	const queued = new Map();
	let nextId = 0;
	const originalRequest = global.requestAnimationFrame;
	const originalCancel = global.cancelAnimationFrame;
	global.requestAnimationFrame = (callback) => { queued.set(++nextId, callback); return nextId; };
	global.cancelAnimationFrame = (id) => queued.delete(id);
	t.after(() => { global.requestAnimationFrame = originalRequest; global.cancelAnimationFrame = originalCancel; });
	let target = { x: 200, y: 300 };
	let frames;
	let timing;
	let settled = 0;
	const animation = new EventTarget();
	animation.currentTime = 130;
	animation.effect = { setKeyframes: (next) => { frames = next; } };
	animation.cancel = () => animation.dispatchEvent(new Event("cancel"));
	const element = { style: {}, animate: (initial, options) => { frames = initial; timing = options; return animation; } };
	const cleanup = animateSessionChipDrop(element, {
		durationMs: 260,
		from: { x: 30, y: 100 },
		onLanded: () => settled++,
		resolveLandingPoint: () => target,
	});
	const sample = () => { const [id, callback] = queued.entries().next().value; queued.delete(id); callback(); };
	target = { x: 50, y: 250 };
	sample();
	assert.equal(animation.currentTime, 130);
	assert.equal(timing.duration, 260);
	assert.equal(frames[0].transform, "translate3d(30px, 100px, 0) scale(1)");
	assert.equal(frames.at(-1).transform, "translate3d(50px, 250px, 0) scale(0.65)");
	animation.dispatchEvent(new Event("finish"));
	assert.equal(settled, 1);
	assert.equal(queued.size, 0);
	assert.equal(element.style.willChange, "");
	cleanup();
	assert.equal(settled, 1);
});

test("the production well drop is a straight tween; arc options stay on the profile for overrides", () => {
	assert.equal(JIRA_DROPZONE_FULL_MOTION_PROFILE.travel, "linear");
	assert.deepEqual(resolveJiraDropzoneArcOptions(JIRA_DROPZONE_FULL_MOTION_PROFILE), {
		peak: 0.5,
		strength: 0.42,
	});
	assert.equal(JIRA_DROPZONE_FULL_MOTION_PROFILE.arcDirection, "automatic");
	assert.equal(JIRA_DROPZONE_FULL_MOTION_PROFILE.arcRotate, 0);
});

test("locked cw and ccw directions pass through to Motion arc options", () => {
	assert.deepEqual(
		resolveJiraDropzoneArcOptions({
			...JIRA_DROPZONE_FULL_MOTION_PROFILE,
			arcDirection: "cw",
		}),
		{ direction: "cw", peak: 0.5, strength: 0.42 },
	);
	assert.deepEqual(
		resolveJiraDropzoneArcOptions({
			...JIRA_DROPZONE_FULL_MOTION_PROFILE,
			arcDirection: "ccw",
		}),
		{ direction: "ccw", peak: 0.5, strength: 0.42 },
	);
});

test("a non-zero rotate is passed through as scaled tangent following", () => {
	assert.deepEqual(
		resolveJiraDropzoneArcOptions({
			...JIRA_DROPZONE_FULL_MOTION_PROFILE,
			arcRotate: 0.9,
		}),
		{ peak: 0.5, rotate: 0.9, strength: 0.42 },
	);
	assert.deepEqual(
		resolveJiraDropzoneArcOptions({
			...JIRA_DROPZONE_FULL_MOTION_PROFILE,
			arcDirection: "cw",
			arcRotate: 0.9,
		}),
		{ direction: "cw", peak: 0.5, rotate: 0.9, strength: 0.42 },
	);
});

test("resolveFlightProfile merges live arc overrides unless motion is reduced", () => {
	assert.equal(resolveFlightProfile(false), JIRA_DROPZONE_FULL_MOTION_PROFILE);
	assert.equal(resolveFlightProfile(null), JIRA_DROPZONE_FULL_MOTION_PROFILE);
	assert.equal(resolveFlightProfile(true), JIRA_DROPZONE_REDUCED_MOTION_PROFILE);
	assert.deepEqual(
		resolveFlightProfile(false, {
			arcDirection: "ccw",
			arcPeak: 0.15,
			arcRotate: 0.9,
			arcStrength: 0.5,
			durationMs: 450,
			travel: "arc",
		}),
		{
			...JIRA_DROPZONE_FULL_MOTION_PROFILE,
			arcDirection: "ccw",
			arcPeak: 0.15,
			arcRotate: 0.9,
			arcStrength: 0.5,
			durationMs: 450,
			travel: "arc",
		},
	);
	assert.equal(
		resolveFlightProfile(true, { arcRotate: 0.9, durationMs: 450, travel: "arc" }),
		JIRA_DROPZONE_REDUCED_MOTION_PROFILE,
	);
});

test("catalog duration choices stay on the VPK motion-duration scale", () => {
	assert.deepEqual(JIRA_DROPZONE_DURATION_TOKEN_MS, {
		"duration-fast": 100,
		"duration-normal": 150,
		"duration-medium": 200,
		"duration-slow": 250,
		"duration-slower": 400,
		"duration-slowest": 600,
	});
	assert.equal(
		JIRA_DROPZONE_FULL_MOTION_PROFILE.durationMs,
		260,
	);
});
