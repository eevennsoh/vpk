const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
	createJiraLinkingGlowDropKeyframes,
	resolveJiraLinkingGlowColor,
	resolveJiraLinkingGlowPulseColor,
	resolveJiraLinkingGlowShadow,
	resolveJiraLinkingGlowSettleMs,
} = require("./glow-motion.ts");

test("Glow flies from the released cursor to the target center", () => {
	const frames = createJiraLinkingGlowDropKeyframes({ x: 30, y: 100 }, { x: 200, y: 300 });
	assert.equal(frames.length, 61);
	assert.deepEqual(frames[0], { offset: 0, transform: "translate3d(30px, 100px, 0) scale(1)", opacity: 1 });
	assert.deepEqual(frames[60], { offset: 1, transform: "translate3d(200px, 300px, 0) scale(0.65)", opacity: 0 });
	assert.ok(Number(frames[30].transform.match(/translate3d\(([\d.-]+)px/)[1]) > 30);
});

test("Glow reaches its 20px lift at 40 percent, then accelerates down", () => {
	const frames = createJiraLinkingGlowDropKeyframes({ x: 0, y: 100 }, { x: 0, y: 300 });
	assert.match(frames[24].transform, /^translate3d\(0px, 80px, 0\)/);
	assert.ok(Math.abs(frames[24].opacity - 0.648) < 1e-12);
	const ys = frames.map((frame) => Number(frame.transform.match(/, ([\d.-]+)px,/)[1]));
	assert.ok(ys[23] > ys[24]);
	assert.ok(ys[25] > ys[24]);
	assert.ok(ys[59] - ys[58] > ys[26] - ys[25]);
});

test("Glow continuously collapses and fades, and reduced motion settles immediately", () => {
	const frames = createJiraLinkingGlowDropKeyframes({ x: 0, y: 0 }, { x: 0, y: 0 });
	for (let index = 1; index < frames.length; index++) {
		assert.ok(frames[index].opacity < frames[index - 1].opacity);
	}
	assert.equal(resolveJiraLinkingGlowSettleMs(false), 260);
	assert.equal(resolveJiraLinkingGlowSettleMs(null), 260);
	assert.equal(resolveJiraLinkingGlowSettleMs(true), 0);
	assert.equal(resolveJiraLinkingGlowSettleMs(false, { drop: { from: { x: 0, y: 0 }, members: [], playback: "stagger" } }), 260);
	assert.equal(resolveJiraLinkingGlowSettleMs(false, {}), 0);
	assert.equal(resolveJiraLinkingGlowSettleMs(false, { drop: undefined }), 0);
});

test("Glow derives its halo and backdrop pulse from the lead avatar tint", () => {
	const claude = resolveJiraLinkingGlowColor([217 / 255, 119 / 255, 87 / 255]);
	assert.equal(claude, "rgb(217 119 87)");
	assert.match(resolveJiraLinkingGlowShadow(claude), /rgb\(217 119 87\).*28%/);
	assert.equal(
		resolveJiraLinkingGlowPulseColor(claude),
		"color-mix(in srgb, rgb(217 119 87) 28%, transparent)",
	);
	assert.equal(resolveJiraLinkingGlowColor([-1, 0.5, 2]), "rgb(0 128 255)");
});
