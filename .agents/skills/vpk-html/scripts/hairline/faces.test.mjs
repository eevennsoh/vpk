// hairline tone map and cast shadows (runtime/faces.mjs, runtime/iso.mjs, runtime/paint.mjs, the stylesheet in inline.mjs).
//   OPENSSL_CONF=/dev/null node --test .agents/skills/vpk-html/scripts/hairline/faces.test.mjs
// runtime/iso.mjs imports the vendored core/iso.ts; Node loads it by stripping its types (22.18+), so these run without esbuild.
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

const { facesOf, LIGHT, shadowPoints, shadowStep, toneOf } = await import("./runtime/faces.mjs");
const iso = await import("./runtime/iso.mjs");
const { recalled } = await import("./runtime/paint.mjs");
const inline = await import("./inline.mjs");

const camera = (S = 1.5) => iso.proj(iso.Cam(45, 0.5, S));

test("HF1 a face's tone comes from its normal against the iso camera: top, near (screen-left) side, far side", () => {
	const { view } = camera();
	assert.equal(toneOf([0, 0, 1], view), "t");
	assert.equal(toneOf([0, 1, 0], view), "l", "+y turns screen-left at azimuth 45");
	assert.equal(toneOf([1, 0, 0], view), "r", "+x turns screen-right at azimuth 45");
	assert.equal(toneOf([0.3, 0, 0.95], view), "t", "a face tilted less than 60 degrees from up is a top");
	assert.ok(view.V[2] > 0, "the viewer is above the ground");
});

test("HF2 a hull keeps its solid: a prism gets both side bands and its lid, a hand-made outline is classified too", () => {
	const P = camera(), ring = iso.rrect(0, 0, 40, 20, 2);
	const sil = iso.hull(iso.ringAt(P, ring, 10).concat(iso.ringAt(P, ring, 0)));
	const box = facesOf(sil, sil.src, P, P.view);
	assert.ok(box.l.length && box.r.length && box.cap, "near and far bands and the visible lid");
	assert.equal(box.world.length, ring.length * 2, "the shadow is cast from every point the hull was taken over");
	// a tapered keycap (keyboard.ts): foot ring at z 1, a smaller top ring at z 12, rings sampled alike
	const cap = iso.hull(iso.ringAt(P, iso.rrect(0, 0, 14, 14, 2.6), 1).concat(iso.ringAt(P, iso.rrect(2, 2, 12, 12, 2), 12)));
	const key = facesOf(cap, cap.src, P, P.view);
	assert.ok(key.l.length && key.r.length, "a frustum's sides are toned");
	// an upright riffle card in the plane y = 5: one flat face, the near side
	const card = [[0, 5, 0], [30, 5, 0], [30, 5, 20], [0, 5, 20]].map(p => P(...p));
	assert.equal(facesOf(card, null, P, P.view).tone, "l");
	// the same plane wound the other way round: the face is toned by the side that faces the viewer, not by its winding
	const door = [[0, 0, 0], [0, 0, 20], [30, 0, 20], [30, 0, 0]].map(p => P(...p));
	assert.equal(facesOf(door, null, P, P.view).tone, "l");
	// a face in the plane x = 30 is the far side
	const end = [[30, 0, 0], [30, 20, 0], [30, 20, 20], [30, 0, 20]].map(p => P(...p));
	assert.equal(facesOf(end, null, P, P.view).tone, "r");
	// screen points with no world points (a tube drawn in screen space) have no faces
	assert.equal(facesOf([[1, 2], [3, 4], [5, 1]], null, P, P.view), null);
});

test("HF3 a drum moved up the screen by hand (sieve) is found and re-tagged at its lifted height", () => {
	const P = camera(), ring = iso.circ(20, 24);
	const drum = iso.hull(iso.ringAt(P, ring, 0).concat(iso.ringAt(P, ring, 10)));
	const dy = P(0, 0, 7)[1] - P(0, 0, 0)[1];
	const d = iso.poly(drum.map(p => [p[0], p[1] + dy]));
	assert.match(d, /^M.*Z$/);
	// poly() handed paint.mjs the lifted, tagged points: their heights run from 7 to 17
	const pts = recalled(d);
	assert.ok(pts?.[0]?.w, "the shifted outline is tagged");
	const zs = pts.src.map(p => p.w[2]);
	assert.deepEqual([Math.min(...zs), Math.max(...zs)].map(z => Math.round(z * 1e6) / 1e6), [7, 17]);
});

test("HF4 shadows use the iso kit's light: down and to the right, a quarter of the height, flat on the ground", async () => {
	const { SHADOW } = await import("../iso/accent.mjs");
	const solids = await import("../iso/solids.mjs");
	assert.equal(LIGHT.LIGHT_AZIMUTH, SHADOW.LIGHT_AZIMUTH);
	assert.equal(LIGHT.LIGHT_ELEVATION, SHADOW.LIGHT_ELEVATION);
	const P = camera(1), step = shadowStep(P.view), kit = solids.shadowStep();
	assert.ok(Math.abs(step[0] - kit[0]) < 1e-9 && Math.abs(step[1] - kit[1]) < 1e-9, "the same step as iso/solids at azimuth 45");
	const [foot, top] = shadowPoints([[0, 0, 0], [0, 0, 20]], P, P.view, 0);
	assert.ok(top[0] > foot[0] && top[1] > foot[1], "a raised point's shadow lands down and to the right");
	assert.ok(Math.abs(Math.hypot(top[0] - foot[0], top[1] - foot[1]) - 20 * Math.hypot(...P(...step, 0).map((v, i) => v - P(0, 0, 0)[i]))) < 1e-6);
	assert.deepEqual(shadowPoints([[3, 4, -5]], P, P.view, 0)[0], P(3, 4, 0), "a point below the ground stays put");
	assert.deepEqual(shadowPoints([[3, 4, 9]], P, P.view, 9)[0], P(3, 4, 9), "the ground is the figure's lowest drawn point");
});

test("HF5 the stylesheet paints tones, accent faces and one flat shadow fill from tokens; shadows go first", () => {
	const text = inline.hairlineCss();
	assert.match(text, /\[data-hl-shadows\] path \{ fill: color-mix\(in srgb, var\(--ill-line\) 12%, var\(--paper\)\); stroke: none; \}/);
	assert.match(text, /\[data-theme="dark"\][^{]*\[data-hl-shadows\] path \{ fill: var\(--surface-sunken\); \}/);
	assert.ok(!/data-hl-shadows[^}]*(filter|opacity|blur)/.test(text), "shadows are flat");
	assert.match(text, /\[data-hl-tone="c"\]\) \{ fill: var\(--ill-tone1\); \}/, "a screen-space tube takes the tube body tone");
	assert.match(text, /\[data-vpk-hairline\]:is\(:hover, :focus-visible\) > svg \.hi \+ \[data-hl-faces\] > \[data-hl-edge\] \{ stroke: color-mix\(in srgb, var\(--ill-accent\) 55%, var\(--ill-line\)\)/, "the active outline is the darker accent, while the figure is hovered or focused");
	assert.match(text, /\[data-vpk-hairline\] > svg \.hi:not\(\.nf\) \{ stroke: var\(--hl-edge\); \}/, "at rest an active filled part keeps the neutral edge");
	for (const rule of text.split("\n").filter(line => line.includes("var(--ill-accent) 55%") && /stroke:/.test(line))) assert.match(rule, /:is\(:hover, :focus-visible\)/, `no accent outline at rest: ${rule}`);
	assert.match(text, /color-mix\(in srgb, var\(--ill-accent\) 62%, var\(--surface-raised\)\)/, "the active near side");
	assert.match(text, /color-mix\(in srgb, var\(--ill-accent\) 70%, var\(--ill-line\)\)/, "the active far side");
	const paint = fs.readFileSync(new URL("./runtime/paint.mjs", import.meta.url), "utf8");
	assert.match(paint, /svg\.insertBefore\(shadows, svg\.firstChild\)/, "the shadow layer is the svg's first child, before every part");
});
