import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { iso } from "../anatomy/vendor/kit/iso-kit.mjs";
import { FIGURE_CAMERA } from "../figures/camera.mjs";
import { pointInPolygon } from "./core.mjs";
import { homePiece } from "./manual-scene.mjs";
import { NARROW_STAGE_PX, renderRegion, renderSvg, TAG_FONT } from "./emit.mjs";
import { clipConvex, nearerSide } from "./layout.mjs";
import { BriefError, buildScene, CAMERA_PRESETS, DEFAULT_VIEWBOX, projectionFor, supportOf, validateBrief } from "./scene.mjs";

const EXEMPLAR = JSON.parse(fs.readFileSync(new URL("./briefs/exploded-stack.json", import.meta.url), "utf8"));
const clone = value => structuredClone(value);
const KINDS_BRIEF = {
	schema: "vpk-iso-brief/1",
	id: "kinds",
	figId: "FIG_002",
	title: "Kinds",
	label: "A tray holding two cards, a flash ring, a drum and a reserved slot.",
	parts: [
		{ id: "tray", kind: "tray", at: [0, 0, 0], size: [60, 100, 6], label: "tray" },
		{ id: "card-a", kind: "plate", at: [5, 8, 4], size: [50, 32, 2], label: "card a", marks: [[[4, 6], [30, 6]]] },
		{ id: "card-b", kind: "plate", at: [5, 50, 4], size: [50, 32, 2], label: "card b" },
		{ id: "ring", kind: "ring", at: [30, 90, 6], size: [8, 8, 0], clipTo: "tray", label: "flash ring" },
		{ id: "drum", kind: "cylinder", at: [100, 30, 0], size: [14, 14, 20], label: "drum" },
		{ id: "slot", kind: "gap", at: [80, 70, 0], size: [30, 24, 0], label: "slot" },
	],
	focal: "ring",
	labels: [{ text: "Drum", target: "drum" }, { text: "Tray", target: "tray", side: "left" }],
	assemble: { layers: [["tray", "slot"], ["card-a", "card-b"], ["ring", "drum"]], staggerMs: 300 },
	interact: { behavior: "select", rest: "rest" },
};

test("CAMERA_PRESETS.dimetric deep-equals FIGURE_CAMERA (K12)", () => {
	assert.deepEqual(CAMERA_PRESETS.dimetric, FIGURE_CAMERA);
	assert.deepEqual(CAMERA_PRESETS["true-iso"], { azimuth: 45, elevation: 35.26 });
	assert.deepEqual(CAMERA_PRESETS.front, { azimuth: 90, elevation: 0 });
	assert.deepEqual(CAMERA_PRESETS.top, { azimuth: 90, elevation: 90 });
});

test("projectionFor keeps every point inside the viewBox minus pad and gutters", () => {
	const points = [[0, 0, 0], [120, 0, 0], [120, 84, 0], [0, 84, 0], [0, 0, 60], [120, 84, 60]];
	for (const [left, right] of [[0, 0], [120, 40], [0, 200]]) {
		const P = projectionFor({ preset: "dimetric", pad: 24 }, [720, 450], points, [left, right]);
		for (const point of points) {
			const [x, y] = iso(point, P);
			assert.ok(x >= left + 24 - 1e-6 && x <= 720 - right - 24 + 1e-6, `x ${x} inside [${left + 24}, ${720 - right - 24}]`);
			assert.ok(y >= 24 - 1e-6 && y <= 450 - 24 + 1e-6, `y ${y}`);
		}
	}
	const fixed = projectionFor({ preset: "dimetric", scale: 2 }, [720, 450], points);
	assert.equal(fixed.scale, 2);
});

test("front and top are orthographic (vendored iso)", () => {
	const front = { origin: [0, 0], scale: 1, ...CAMERA_PRESETS.front };
	const k = Math.sqrt(1.6);
	const [fx, fy] = iso([10, 7, 4], front);
	assert.ok(Math.abs(fx - 10 * k) < 1e-9 && Math.abs(fy + 4 * k) < 1e-9, "front: screen = [x, -z]·k");
	const top = { origin: [0, 0], scale: 1, ...CAMERA_PRESETS.top };
	const [tx, ty] = iso([10, 7, 4], top);
	assert.ok(Math.abs(tx - 10 * k) < 1e-9 && Math.abs(ty - 7 * k) < 1e-9, "top: screen = [x, y]·k");
});

test("golden 45/30 values (V13): +x runs down-right at 26.57°, z is up", () => {
	const P = { origin: [0, 0], scale: 1, ...FIGURE_CAMERA };
	const [x, y] = iso([1, 0, 0], P);
	assert.ok(Math.abs(Math.atan2(y, x) * 180 / Math.PI - 26.565) < 0.01);
	assert.ok(Math.abs(x - 0.894427) < 1e-5 && Math.abs(y - 0.447214) < 1e-5);
	const [zx, zy] = iso([0, 0, 1], P);
	assert.ok(Math.abs(zx) < 1e-12 && zy < 0, "z projects straight up");
});

test("validateBrief accepts the exemplar and rejects bad briefs", () => {
	assert.deepEqual(validateBrief(EXEMPLAR), []);
	assert.deepEqual(validateBrief(KINDS_BRIEF), []);
	const cases = [
		[brief => (brief.id = "Bad_Id"), /id "Bad_Id"/],
		[brief => (brief.focal = "nope"), /focal "nope"/],
		[brief => (brief.assemble.layers = [["base"], ["core"], ["module"], ["shell"], [], [], []]), /layers/],
		[brief => {
			brief.parts = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, kind: "slab", at: [0, 0, i * 10], size: [10, 10, 2] }));
			brief.focal = "p0";
			brief.labels = [];
			brief.assemble.layers = brief.parts.map(part => [part.id]);
		}, /7 layers; at most 6/],
		[brief => (brief.interact = { behavior: "field" }), /behavior "field"/],
		[brief => (brief.style = "current"), /style "current"/],
		[brief => (brief.figId = "FIG_1"), /figId/],
		[brief => (brief.assemble.layers = [["base"], ["core"], ["module"]]), /"shell" is missing/],
		[brief => (brief.labels[0].target = "ghost"), /labels\[0\]\.target/],
		[brief => (brief.interact.explode.rest = 2), /min ≤ rest ≤ max/],
		[brief => (brief.parts[0].size = [10, 10, -1]), /size/],
		// The schema's round sizes (ws3 §4.4): cylinder [r, r, h], ring [r, r, 0]; the kit reads r only.
		[brief => Object.assign(brief.parts[0], { kind: "cylinder", at: [60, 42, 0], size: [40, 30, 6] }), /a cylinder is \[r, r, h\]/],
		[brief => Object.assign(brief.parts[0], { kind: "ring", at: [60, 42, 0], size: [20, 20, 4] }), /a ring is \[r, r, 0\]/],
	];
	for (const [mutate, pattern] of cases) {
		const brief = clone(EXEMPLAR);
		mutate(brief);
		const errors = validateBrief(brief);
		assert.ok(errors.some(error => pattern.test(error)), `${pattern} in ${JSON.stringify(errors)}`);
	}
	assert.throws(() => buildScene({ ...clone(EXEMPLAR), style: "current" }), BriefError);
});

test("style: absent and \"manual\" validate; any other value is the pinned one-style error", () => {
	const { style, ...bare } = clone(EXEMPLAR);
	assert.equal(style, undefined, "the committed brief omits style");
	assert.deepEqual(validateBrief(bare), []);
	assert.deepEqual(validateBrief({ ...bare, style: "manual" }), []);
	for (const value of ["hairline", "makingsoftware"]) {
		assert.deepEqual(validateBrief({ ...bare, style: value }), [`style "${value}" is not supported; the iso kit has one style: "manual"`]);
		assert.throws(() => buildScene(bare, { style: value }), BriefError);
	}
	assert.equal(buildScene(bare).style, "manual");
	assert.equal(buildScene({ ...bare, style: "manual" }).style, "manual");
});

test("validateBrief rejects an explode rest off the slider's step grid (the range input would snap it; R9)", () => {
	const withExplode = explode => {
		const brief = clone(EXEMPLAR);
		Object.assign(brief.interact.explode, explode);
		return validateBrief(brief).filter(error => /step grid/.test(error));
	};
	// The round-5 case: Chromium loads the slider at 0.55 while the figure's rest pose is 0.6.
	const [error] = withExplode({ rest: 0.6, min: 0.4, max: 1, step: 0.15 });
	assert.match(error, /interact\.explode\.rest 0\.6 is off the slider's step grid \(min \+ n × step\): use 0\.55 or 0\.7/);
	assert.match(withExplode({ rest: 1, min: 0.4, max: 1, step: 0.25 })[0], /rest 1 .*use 0\.9\b/, "rest = max off the grid; the next stop is past max");
	// On-grid values pass, including steps that are not exact in binary floating point.
	for (const explode of [{}, { rest: 0.4 }, { rest: 1 }, { rest: 0.7, step: 0.15 }, { rest: 0.3, min: 0.1, step: 0.1 }, { rest: 0.85, min: 0.4, max: 1, step: 0.15 }, { rest: 0.9, min: 0.4, max: 1, step: 0.25 }]) {
		assert.deepEqual(withExplode(explode), [], JSON.stringify(explode));
	}
	assert.throws(() => buildScene({ ...clone(EXEMPLAR), interact: { behavior: "explode", explode: { ...EXEMPLAR.interact.explode, step: 0.15 } } }), /step grid/);
});

test("tray halves sort back < contents < front, and carry data-vpk-iso-of", () => {
	const scene = buildScene(KINDS_BRIEF);
	const order = scene.pieces.map(piece => piece.id);
	const at = id => order.indexOf(id);
	assert.ok(at("tray:back") < at("card-a") && at("tray:back") < at("card-b"));
	assert.ok(at("tray:front") > at("card-a") && at("tray:front") > at("card-b"));
	assert.equal(scene.pieces[at("tray:back")].of, "tray");
	assert.equal(scene.pieces[at("tray:front")].of, "tray");
	const layersOfTray = scene.groups.filter(group => group.pieces.some(index => scene.pieces[index].partId === "tray")).map(group => group.layer);
	assert.deepEqual([...new Set(layersOfTray)], [0], "both tray halves share layer 0 timing");
	assert.ok(scene.groups.length >= 3);
});

test("painter order is by depth; explode guides drop from the extreme corners to the part beneath", () => {
	const scene = buildScene(EXEMPLAR);
	const depths = scene.pieces.map(piece => piece.depth);
	assert.deepEqual(depths, [...depths].sort((a, b) => a - b));
	assert.deepEqual(scene.pieces.map(piece => piece.id), ["base", "core", "module", "shell"]);
	const pairs = scene.guides.map(guide => `${guide.from}>${guide.to}`).sort();
	assert.deepEqual(pairs, ["core>base", "module>core", "shell>base"]);
	for (const guide of scene.guides) for (const { from, to } of guide.ends) assert.ok(Math.abs(from[0] - to[0]) < 1e-9 && from[1] < to[1], "vertical, top to bottom");
	assert.ok(scene.pieces.every(piece => Array.isArray(piece.explode)), "explode vectors on every part");
	assert.equal(scene.camera.attr, "45 30");
	assert.equal(scene.zdepth, 0.5);
});

test("labels anchor on a visible point of their target and sit in the gutters", () => {
	const scene = buildScene(EXEMPLAR);
	assert.deepEqual(scene.warnings, []);
	assert.equal(scene.labels.length, 4);
	const [width] = scene.viewBox;
	for (const label of scene.labels) {
		assert.ok(label.box.x >= 0 && label.box.x + label.box.w <= width, `${label.text} inside the viewBox`);
		assert.notEqual(label.text, label.text.toUpperCase(), `${label.text} keeps the brief's sentence case`);
	}
});

test("every pose (explode range, lift, assembly start) is fitted into the frame", () => {
	const scene = buildScene(EXEMPLAR);
	const { min, max, rest } = scene.explode;
	for (const piece of scene.pieces) {
		for (const k of [min - rest, max - rest]) {
			for (const [x, y] of piece.hit) {
				const px = x + piece.explode[0] * k;
				const py = y + piece.explode[1] * k;
				assert.ok(px >= -0.5 && px <= 720.5 && py >= -0.5 && py <= 450.5, `${piece.id} at ${k}: ${px}, ${py}`);
			}
		}
	}
	const select = buildScene(KINDS_BRIEF);
	assert.ok(select.pieces.every(piece => piece.lift[1] < 0), "lift moves up on screen");
	assert.ok(select.enterOffset[1] < 0, "assembly starts above rest (drops into place)");
});

test("buildScene is deterministic", () => {
	const strip = scene => JSON.stringify({ ...scene, widthOf: undefined });
	assert.equal(strip(buildScene(EXEMPLAR)), strip(buildScene(clone(EXEMPLAR))));
	assert.equal(strip(buildScene(KINDS_BRIEF)), strip(buildScene(clone(KINDS_BRIEF))));
});

// G2 J4: callout text renders near 4 px on a phone, so each label also gets a numbered tag on its anchor and the
// figure carries the crop that drops the empty label gutters.
test("labels get numbered narrow-stage tags whose leaders end on their anchors, and the figure gets a gutter crop", () => {
	const scene = buildScene(EXEMPLAR);
	assert.equal(scene.tags.length, scene.labels.length);
	scene.tags.forEach((tag, index) => {
		const label = scene.labels[index];
		assert.equal(tag.n, index + 1);
		assert.deepEqual([tag.text, tag.target], [label.text, label.target]);
		assert.ok(scene.pieces.some(piece => piece.partId === label.target && pointInPolygon(tag.point, piece.hit)), `tag ${tag.n} ends on its target`);
	});
	assert.ok(scene.crop, "the figure carries a crop");
	const kinds = buildScene(KINDS_BRIEF);
	assert.deepEqual(kinds.tags.map(tag => tag.target), ["drum", "tray"]);
	const bare = buildScene({ ...clone(EXEMPLAR), labels: [] });
	assert.deepEqual(bare.tags, []);
});

// F1 (ws3-B): a flash ring several times the column, clipped to the tray top, used to set the fit extent
// and the silhouette, so the column shrank to a speck and every label "overlapped the figure".
test("clipConvex clips a convex subject to a convex window of either winding", () => {
	const subject = [[-10, -10], [20, -10], [20, 20], [-10, 20]];
	const window = [[0, 0], [10, 0], [10, 10], [0, 10]];
	const bounds = poly => [Math.min(...poly.map(p => p[0])), Math.max(...poly.map(p => p[0])), Math.min(...poly.map(p => p[1])), Math.max(...poly.map(p => p[1]))];
	assert.deepEqual(bounds(clipConvex(subject, window)), [0, 10, 0, 10]);
	assert.deepEqual(bounds(clipConvex(subject, [...window].reverse())), [0, 10, 0, 10], "clockwise window");
	assert.deepEqual(clipConvex(window, window).length, 4, "a subject inside the window is unchanged");
	assert.deepEqual(clipConvex([[30, 30], [40, 30], [40, 40]], window), [], "a disjoint subject clips to nothing");
	assert.deepEqual(clipConvex([[0, 0], [1, 1]], window), [], "fewer than three points");
});

test("a clipped ring fits and silhouettes as its clip target, not as the whole disc", () => {
	const tray = { id: "column", kind: "tray", at: [0, 0, 0], size: [60, 150, 6], label: "column" };
	const base = { schema: "vpk-iso-brief/1", id: "clip", figId: "FIG_001", title: "Clip", label: "A tray under a large flash ring.", focal: "ring" };
	const withRing = buildScene({ ...base, parts: [tray, { id: "ring", kind: "ring", at: [30, 3, 4], size: [171.3, 171.3, 0], clipTo: "column", label: "ring" }] });
	const without = buildScene({ ...base, focal: "column", parts: [tray] });
	assert.equal(withRing.P.scale, without.P.scale, "the disc does not shrink the fit");
	assert.deepEqual(withRing.P.origin, without.P.origin);
	const ring = withRing.pieces.find(piece => piece.partId === "ring");
	const floor = withRing.pieces.find(piece => piece.id === "column:back");
	const xs = floor.hit.map(([x]) => x);
	const ys = floor.hit.map(([, y]) => y);
	assert.ok(ring.hit.length >= 3 && ring.hit.every(([x, y]) => x >= Math.min(...xs) - 0.5 && x <= Math.max(...xs) + 0.5 && y >= Math.min(...ys) - 0.5 && y <= Math.max(...ys) + 0.5), "the ring's hit polygon lies inside the tray");
	const sceneXs = withRing.hull.map(([x]) => x);
	assert.ok(Math.min(...sceneXs) >= 24 - 1e-6 && Math.max(...sceneXs) <= 720 - 24 + 1e-6, "the silhouette stays inside the padded viewBox");
	assert.deepEqual(withRing.hull, without.hull, "the silhouette is the tray's alone");
});

// P5 (ws3-manual): the brief fields `marks`, `dims`, `scale` and a part's `state`, the label floor at 390 px, the
// near-label fit.
const MANUAL_FIELDS = {
	marks: [{ target: "card-a" }, { target: "tray", at: [10, 10, 6], offset: [12, -8], n: 7 }],
	dims: [{ from: [0, 0, 0], to: [60, 0, 0], text: "Tray · 60 px", offset: 14 }],
	scale: { length: 50, text: "50 px" },
};
const withFields = extra => ({ ...clone(KINDS_BRIEF), ...clone(MANUAL_FIELDS), ...extra });

test("marks, dims and scale validate (vpk-iso-brief/1 additions)", () => {
	assert.deepEqual(validateBrief(withFields({})), []);
	const errors = extra => validateBrief(withFields(extra)).join("\n");
	assert.match(errors({ marks: [{ target: "nope" }] }), /marks\[0\]\.target "nope" must name a part/);
	assert.match(errors({ marks: [{ target: "tray", n: 2 }, { target: "card-a", n: 2 }] }), /marks\[1\]\.n 2 is used by another mark/);
	assert.match(errors({ marks: [{ target: "tray", n: 0 }] }), /n must be an integer within 1–99/);
	assert.match(errors({ marks: [{ target: "tray", offset: [500, 0] }] }), /offset must be \[dx, dy\] within ±200/);
	assert.match(errors({ marks: Array.from({ length: 13 }, () => ({ target: "tray" })) }), /marks must be an array of at most 12/);
	assert.match(errors({ dims: [{ from: [0, 0, 0], to: [1, 0, 0], text: "" }] }), /dims\[0\]\.text must be a non-empty string/);
	assert.match(errors({ dims: [{ from: [0, 0], to: [1, 0, 0], text: "X" }] }), /dims\[0\] needs from and to as \[x, y, z\]/);
	assert.match(errors({ dims: [{ from: [0, 0, 0], to: [1, 0, 0], text: "X", offset: 200 }] }), /dims\[0\]\.offset must be within ±80/);
	assert.match(errors({ scale: { length: 0, text: "0 px" } }), /scale\.length must be a positive number/);
	assert.match(errors({ scale: { length: 5, text: "X".repeat(25) } }), /scale\.text must be a non-empty string of ≤ 24 chars/);
	assert.match(errors({ scale: "1 ft" }), /scale must be an object/);
});

test("marks, dims and the scale bar are drawn", () => {
	const manual = buildScene(withFields({}));
	assert.equal(manual.marks.length, 2);
	assert.equal(manual.dims.length, 1);
	assert.ok(manual.scaleBar, "the scale bar is placed");
	assert.deepEqual(manual.marks.map(mark => mark.n), [1, 7], "unnumbered marks take the next free number; an explicit n is kept");
});

test("part state new/active validates and reaches the scene; the focal never takes a state", () => {
	const brief = clone(KINDS_BRIEF);
	brief.parts.find(part => part.id === "card-b").state = "new";
	assert.deepEqual(validateBrief(brief), []);
	brief.parts.find(part => part.id === "card-a").state = "loud";
	assert.match(validateBrief(brief).join("\n"), /state/);
	brief.parts.find(part => part.id === "card-a").state = "active";
	brief.parts.find(part => part.id === "ring").state = "new";
	const scene = buildScene(brief);
	assert.ok(scene.pieces.some(piece => piece.partId === "card-b" && piece.state === "new"));
	assert.ok(scene.pieces.filter(piece => piece.focal).every(piece => piece.state === null));
});

// G2 J4: the callouts swap for numbered tags below 720 px; the tag type must still render at 9 px or more at 390.
const FIXTURES = ["eu26-done-column", "eu26-mega-bento"].map(name => JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8")));
test("labels are 10-11 px on the desktop plate and its narrow tags render at 9 px or more at 390 px", () => {
	const STAGE_390 = NARROW_STAGE_PX; // 390 less the page gutters and the frame's padding and border
	for (const brief of FIXTURES) {
		const scene = buildScene(brief);
		assert.ok(scene.font.size >= 10 && scene.font.size <= 11, `${brief.id}: label type is ${scene.font.size} px`);
		assert.equal(scene.tags.length, scene.labels.length, `${brief.id}: one tag per label`);
		const zoom = scene.crop ? scene.crop.width / 100 : 1;
		const tagScale = Number(/--vpk-iso-tag-scale: ([\d.]+)/.exec(renderSvg(scene))?.[1] ?? 1);
		const rendered = TAG_FONT * tagScale * ((STAGE_390 * zoom) / scene.viewBox[0]);
		assert.ok(rendered >= 9, `${brief.id}: a tag numeral renders ${rendered.toFixed(1)} px at 390 (tag scale ${tagScale})`);
	}
});

test("the figure fits the drawing to its labels: every label stays inside the pad, the gutters shrink below the widest label, a side is a hint", () => {
	const manual = buildScene(FIXTURES[1]);
	for (const label of manual.labels) {
		assert.ok(label.box.x >= manual.pad - 0.5 && label.box.x + label.box.w <= manual.viewBox[0] - manual.pad + 0.5, `"${label.text}" stays inside the camera pad`);
	}
	const widest = Math.max(...manual.labels.map(label => label.box.w)) + 16;
	assert.ok(manual.gutters.left < widest && manual.gutters.right < widest, "the near fit shrank the reserved gutters");
	// nearerSide keeps the hint unless the other side is at least a third nearer.
	const hull = [[0, 0], [100, 0], [100, 100], [0, 100]];
	const font = { size: 11 };
	assert.equal(nearerSide(hull, [20, 50], "right", font), "left");
	assert.equal(nearerSide(hull, [80, 50], "left", font), "right");
	assert.equal(nearerSide(hull, [50, 50], "right", font), "right");
	assert.equal(nearerSide(hull, [50, 50], "left", font), "left");
	// a label never takes the long way round: its leader is shorter than half the figure's width
	for (const label of manual.labels) {
		const [a, b] = label.leader.points;
		assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < (Math.max(...manual.hull.map(([x]) => x)) - Math.min(...manual.hull.map(([x]) => x))) / 2, `"${label.text}" leader is short`);
	}
});

// OR1 (P5): a figure fills its frame, so the viewBox height shrinks to the drawing plus a margin; the width stays the brief's.
test("the viewBox height is cropped to the drawing: the width stays, everything drawn or reachable stays inside", () => {
	for (const brief of FIXTURES) {
		const [width, height] = brief.viewBox ?? DEFAULT_VIEWBOX;
		const manual = buildScene(brief);
		assert.equal(manual.viewBox[0], width, `${brief.id}: the width is the brief's`);
		assert.ok(manual.viewBox[1] < height - 40 && manual.viewBox[1] >= 160, `${brief.id}: height ${manual.viewBox[1]} is cropped from ${height}`);
		const h = manual.viewBox[1];
		const ys = [
			...manual.poseYs,
			...manual.hull.map(([, y]) => y),
			...manual.labels.flatMap(({ box }) => [box.y, box.y + box.h]),
			...manual.dims.flatMap(({ box }) => [box.y, box.y + box.h]),
			...manual.marks.flatMap(({ disc }) => [disc[1] - 10, disc[1] + 10]),
		];
		const span = Math.max(...ys) - Math.min(...ys);
		assert.ok(Math.min(...ys) >= 4 && Math.max(...ys) <= h - 4, `${brief.id}: the drawing spans ${Math.min(...ys).toFixed(0)}–${Math.max(...ys).toFixed(0)} in a ${h} px frame`);
		// A wide, shallow figure lands close to its drawing: no band of empty paper above and below.
		assert.ok(span >= h * 0.7, `${brief.id}: the drawing fills ${((100 * span) / h).toFixed(0)}% of the height`);
	}
});

// A narrow tag is a gutter disc on a leader to its part; a mark rides in the last of its target's pieces that holds its
// point, so a tag on a tray's near wall is not painted under that wall.
test("narrow tags are gutter discs outside the hull, on leaders that end on the part", () => {
	for (const brief of FIXTURES) {
		const manual = buildScene(brief);
		assert.equal(manual.tags.length, manual.labels.length);
		for (const tag of manual.tags) {
			assert.equal(tag.piece, -1, `${brief.id} tag ${tag.n} rides in no part group`);
			assert.ok(!pointInPolygon(tag.disc, manual.hull), `${brief.id} tag ${tag.n} disc sits in the gutter, off the figure`);
			assert.ok(Math.hypot(tag.start[0] - tag.disc[0], tag.start[1] - tag.disc[1]) > 0, "the leader leaves the disc edge");
			assert.ok(pointInPolygon(tag.point, manual.pieces[homePiece(manual.pieces, tag.target, tag.point)[1]].hit), `${brief.id} tag ${tag.n} dot sits on its part`);
		}
		const discs = manual.tags.map(tag => tag.disc);
		for (const [i, a] of discs.entries()) for (const b of discs.slice(i + 1)) assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) >= 28, `${brief.id}: discs do not touch`);
	}
});

// Cast shadows (illustrations.md § Shadows; iso/accent.mjs SHADOW): every part with faces casts one flat shadow onto the
// figure's ground, along a light from the upper left, so the shadow falls down and to the right and is as long as the part is
// high; gaps and rings are line work and cast none.
test("cast shadows: one per part with faces, down and to the right on screen, height / tan(elevation) long", async () => {
	const { shadowStep, castShadow, castsShadow, shadowMove } = await import("./solids.mjs");
	const P = { ...FIGURE_CAMERA, origin: [0, 0], scale: 1 };
	const [sx, sy] = shadowStep();
	const { SHADOW } = await import("./accent.mjs");
	assert.ok(Math.abs(Math.hypot(sx, sy) - 1 / Math.tan((SHADOW.LIGHT_ELEVATION * Math.PI) / 180)) < 1e-9, "the shadow is height / tan(elevation) long");
	assert.ok(Math.hypot(sx, sy) < 0.6, "a high sun: a shadow is about half as long as its part is high");
	const tip = iso([sx * 10, sy * 10, 0], P);
	assert.ok(tip[0] > 0 && tip[1] > 0, `a shadow falls down and to the right on screen (${tip})`);
	assert.ok(tip[1] < tip[0], "below the horizontal, shallower than 45 degrees");
	assert.deepEqual(shadowMove([2, 3, 0]), [2, 3, 0], "a plan move moves the shadow the same way");
	assert.equal(castsShadow({ kind: "gap" }), false);
	assert.equal(castsShadow({ kind: "ring" }), false);
	for (const kind of ["slab", "box", "plate", "cylinder", "tray"]) assert.equal(castsShadow({ kind }), true, kind);
	const post = { kind: "box", at: [0, 0, 0], size: [2, 2, 40] };
	const poly = castShadow(post, P);
	const xs = poly.map(([x]) => x);
	assert.ok(Math.max(...xs) - Math.min(...xs) > 4 + 40 * Math.hypot(sx, sy) * 0.6, "a thin post casts a long thin shadow (height / tan elevation)");
	const scene = buildScene(KINDS_BRIEF);
	const casters = KINDS_BRIEF.parts.filter(part => !["gap", "ring"].includes(part.kind)).map(part => part.id);
	assert.deepEqual(scene.shadows.map(entry => entry.partId).sort(), casters.sort(), "one shadow per part with faces, none for gaps and rings");
	assert.equal(scene.ground, Math.min(...KINDS_BRIEF.parts.filter(part => !["gap", "ring"].includes(part.kind)).map(part => part.at[2])));
	assert.ok(scene.shadows.every(entry => entry.hit.length >= 3));
});

test("cast shadows move with their part: select shadows by the lift along the light, explode shadows by the Gap vector", () => {
	const select = buildScene({ ...clone(KINDS_BRIEF), interact: { behavior: "select", lift: 8 } });
	const lift = select.pieces[0].lift;
	for (const entry of select.shadows) assert.ok(entry.cast[0] > 0 && entry.cast[1] > lift[1], `${entry.partId}: a lifted part's shadow moves right and stays below the part (${entry.cast} vs lift ${lift})`);
	assert.equal(new Set(select.shadows.map(entry => entry.cast.join(" "))).size, 1, "every lift casts the same shadow move");
	const exploded = buildScene(EXEMPLAR);
	const shell = exploded.shadows.find(entry => entry.partId === "shell");
	const base = exploded.shadows.find(entry => entry.partId === "base");
	assert.deepEqual(base.cast, [0, 0], "a part that does not move keeps its shadow still");
	assert.ok(shell.cast[0] > 0 && shell.cast[1] > 0, "an exploded part's shadow slides down and to the right as it rises");
	assert.ok(buildScene({ ...clone(EXEMPLAR), interact: null, assemble: null }).shadows.every(entry => entry.cast === null), "a static figure's shadows never move");
});

// Hatching was removed from the kit: a part that still says `cut` fails with a message naming the field (no silent fallback).
test("a brief part with `cut` is a validation error, never silently ignored", () => {
	for (const cut of [true, "dense", "sparse", false]) {
		const brief = structuredClone(EXEMPLAR);
		brief.parts[0].cut = cut;
		assert.match(validateBrief(brief).join("\n"), /parts\[0\]\.cut is no longer supported: the iso kit draws every side face as a plain flat face/, JSON.stringify(cut));
	}
});

// Redline 1: physical cast shadows from one distant light (accent.mjs SHADOW). A part's shadow lands on the first surface below
// it along the light: the top face of a lower part (clipped to that face) or the ground; it is offset by the caster's height
// above that surface; shadows on one surface share one flat fill, so overlaps never darken.
test("received shadows: the parts above shadow the receiving top, clipped to it, offset by height, one flat tone", async () => {
	const { renderRegion } = await import("./emit.mjs");
	const { shadowStep } = await import("./solids.mjs");
	const { SHADOW } = await import("./accent.mjs");
	const scene = buildScene(structuredClone(EXEMPLAR));
	const piece = id => scene.pieces.find(p => p.id === id);
	// The base receives the core, module and shell; the core the module and shell; the module the shell; the shell nothing.
	assert.deepEqual(piece("base").received.shadows.map(s => s.partId).sort(), ["core", "module", "shell"]);
	assert.deepEqual(piece("core").received.shadows.map(s => s.partId).sort(), ["module", "shell"]);
	assert.deepEqual(piece("module").received.shadows.map(s => s.partId), ["shell"]);
	assert.equal(piece("shell").received, undefined);
	// The clip window is the receiver's top face.
	const base = EXEMPLAR.parts.find(p => p.id === "base");
	const topZ = base.at[2] + base.size[2];
	const corner = iso([base.at[0] + base.size[0] / 2, base.at[1] + base.size[1] / 2, topZ], scene.P);
	assert.ok(pointInPolygon(corner, piece("base").received.clip), "the window is the base's top face");
	// Offset grows with the caster's height above the receiving plane: the module's shadow on the base sits further along the
	// light than its shadow on the core, by exactly the core top's height step.
	// (The receiving plane is also dz lower, so the screen move is the light step plus that drop.)
	const centroid = poly => [Math.min(...poly.map(([x]) => x)), Math.min(...poly.map(([, y]) => y))];
	const onBase = centroid(piece("base").received.shadows.find(s => s.partId === "module").hit);
	const onCore = centroid(piece("core").received.shadows.find(s => s.partId === "module").hit);
	const core = EXEMPLAR.parts.find(p => p.id === "core");
	const dz = core.at[2] + core.size[2] - topZ;
	const step = shadowStep();
	const moved = iso([dz * step[0], dz * step[1], -dz], scene.P);
	const origin = iso([0, 0, 0], scene.P);
	const expected = [moved[0] - origin[0], moved[1] - origin[1]];
	assert.ok(Math.hypot(onBase[0] - onCore[0] - expected[0], onBase[1] - onCore[1] - expected[1]) < 1, "offset = height above the receiving plane");
	assert.ok(expected[0] > 0 && expected[1] > 0, "a higher caster throws further down-right");
	// The base's own ground shadow is only its 6-unit thickness long.
	const ground = scene.shadows.find(s => s.partId === "base").hit;
	const xs = ground.map(([x]) => x);
	const baseXs = piece("base").hit.map(([x]) => x);
	assert.ok(Math.max(...xs) - Math.max(...baseXs) < 12, "the base plate's ground shadow is modest");
	// Markup: one received group per receiver, clipped to its top, one fill; shadows inside carry no fill of their own (no
	// overlap darkening), no stroke, filter, opacity or blur; the explode figure moves each by caster minus receiver.
	const region = renderRegion(scene);
	const groups = [...region.matchAll(/<g data-vpk-iso-received clip-path="url\(#([^)]+)\)" fill="([^"]+)">/g)];
	assert.equal(groups.length, 3);
	for (const [, clip, fill] of groups) {
		assert.equal(fill, SHADOW.RECEIVED);
		assert.match(region, new RegExp(`<clipPath id="${clip}">`));
	}
	const received = [...region.matchAll(/<g data-vpk-iso-received[\s\S]*?<path data-vpk-iso-role="(?:crease|edge)"/g)].map(m => m[0]);
	for (const block of received) {
		assert.doesNotMatch(block, /<path data-vpk-iso-role="shadow"[^>]*\s(fill|stroke|opacity|filter|style)=/);
	}
	// The base never moves, so its received shadows move by their caster's cast alone; the core and module move under the Gap,
	// so the shadows on them carry the receiver's cast too (the runtime moves them by caster minus receiver).
	assert.doesNotMatch(received.find(b => b.includes("recv-base")), /data-vpk-iso-cast-on=/);
	assert.match(received.find(b => b.includes("recv-core")), /data-vpk-iso-cast-on="[\d. -]+"/);
	assert.match(received.find(b => b.includes("recv-module")), /data-vpk-iso-cast-on="[\d. -]+"/);
	assert.doesNotMatch(region, /<(filter|linearGradient|radialGradient|feGaussianBlur)\b|mix-blend/);
});

// Hover physics: fixed parts, the support default, grow, and select guides (illustrations.md § Using the kit).
const HOVER = {
	schema: "vpk-iso-brief/1",
	id: "hover-kinds",
	figId: "FIG_005",
	title: "Hover kinds",
	label: "Pillars on a plinth.",
	parts: [
		{ id: "plinth", kind: "tray", at: [0, 0, 0], size: [100, 60, 4] },
		{ id: "a", kind: "box", at: [10, 10, 4], size: [12, 12, 10], r: 0 },
		{ id: "b", kind: "cylinder", at: [50, 30, 4], size: [8, 8, 14] },
		{ id: "c", kind: "slab", at: [70, 10, 4], size: [12, 12, 4], r: 2, bevel: 1 },
	],
	focal: "a",
	interact: { behavior: "select", liftMode: "grow" },
};

test("fixed and liftMode validate: booleans, known modes, prisms for grow, select only, not every part fixed", () => {
	const at = (patch, index = 1) => validateBrief({ ...HOVER, parts: HOVER.parts.map((part, i) => (i === index ? { ...part, ...patch } : part)) });
	assert.deepEqual(validateBrief(HOVER), []);
	assert.match(at({ fixed: "yes" }).join("\n"), /parts\[1\]\.fixed must be true or false/);
	assert.match(at({ liftMode: "float" }).join("\n"), /parts\[1\]\.liftMode must be one of raise, grow/);
	assert.match(at({ liftMode: "grow" }, 0).join("\n"), /needs a vertical prism/);
	assert.match(at({ fixed: true, liftMode: "raise" }).join("\n"), /a fixed part never lifts/);
	assert.match(validateBrief({ ...HOVER, interact: { behavior: "select", liftMode: "up" } }).join("\n"), /interact\.liftMode must be one of raise, grow/);
	assert.match(validateBrief({ ...HOVER, interact: { behavior: "select", guides: "on" } }).join("\n"), /interact\.guides must be true or false/);
	assert.match(validateBrief({ ...HOVER, interact: null, parts: HOVER.parts.map(part => (part.id === "a" ? { ...part, liftMode: "grow" } : part)) }).join("\n"), /liftMode needs interact\.behavior "select"/);
	assert.match(validateBrief({ ...HOVER, parts: HOVER.parts.map(part => ({ ...part, fixed: true })) }).join("\n"), /every part is fixed/);
});

test("the support (one lowest part holding every other plan) is fixed by default on a select figure; fixed: false opts out", () => {
	assert.equal(supportOf(HOVER), "plinth");
	assert.equal(supportOf({ ...HOVER, focal: "plinth" }), null, "the focal is never fixed by default");
	assert.equal(supportOf({ ...HOVER, parts: [...HOVER.parts, { id: "out", kind: "box", at: [120, 0, 0], size: [5, 5, 5] }] }), null, "a part outside its plan: no support");
	const scene = buildScene(HOVER);
	const fixed = scene.pieces.filter(piece => piece.fixed).map(piece => piece.id).sort();
	assert.deepEqual(fixed, ["plinth:back", "plinth:front"]);
	assert.ok(scene.pieces.filter(piece => piece.fixed).every(piece => !piece.lift), "a fixed part has no lift vector");
	const region = renderRegion(scene);
	assert.equal((region.match(/data-vpk-iso-fixed/g) ?? []).length, 2);
	assert.doesNotMatch(region, /data-vpk-iso-lift-z/, "no lift re-sort input");
	const open = buildScene({ ...HOVER, parts: HOVER.parts.map(part => (part.id === "plinth" ? { ...part, fixed: false } : part)) });
	assert.equal(open.pieces.filter(piece => piece.fixed).length, 0, "fixed: false keeps the support selectable");
	const explode = buildScene({ ...HOVER, interact: { behavior: "explode", explode: { rest: 0, min: 0, max: 1, step: 0.5 } } });
	assert.equal(explode.pieces.filter(piece => piece.fixed).length, 0, "no default on an explode figure");
	const marked = buildScene({ ...HOVER, interact: { behavior: "explode", explode: { rest: 0, min: 0, max: 1, step: 0.5 } }, parts: HOVER.parts.map(part => (part.id === "plinth" ? { ...part, fixed: true } : part)) });
	assert.ok(marked.pieces.filter(piece => piece.partId === "plinth").every(piece => piece.fixed && piece.explode[0] === 0 && piece.explode[1] === 0), "a fixed part never separates");
});

test("grow: vertical prisms grow in place (the build checks the taller solid), a bevelled slab raises with a warning", () => {
	const scene = buildScene(HOVER);
	const by = id => scene.pieces.find(piece => piece.id === id);
	assert.equal(by("a").grow, true);
	assert.equal(by("b").grow, true, "a cylinder grows");
	assert.notEqual(by("c").grow, true, "the bevelled slab cannot be drawn by moving its top points");
	assert.ok(by("c").lift, "so it raises");
	assert.ok(scene.warnings.some(text => text.includes('part "c"')), scene.warnings.join("; "));
	// A grown caster's ground shadow holds still; a raised one moves.
	const cast = id => scene.shadows.find(entry => entry.partId === id).cast;
	assert.equal(cast("a"), null);
	assert.ok(cast("c"));
	const raised = buildScene({ ...HOVER, interact: { behavior: "select" } });
	assert.equal(raised.pieces.some(piece => piece.grow), false, "raise is the default");
	assert.match(renderRegion(scene), /data-vpk-iso-part="a"[^>]*data-vpk-iso-grow/);
});

test("select guides are opt-in and drop from a floating part to the tray under it, named by the tray id", () => {
	const brief = { ...HOVER, parts: [...HOVER.parts, { id: "card", kind: "slab", at: [10, 30, 30], size: [20, 20, 2] }], interact: { behavior: "select" } };
	assert.equal(buildScene(brief).guides.length, 0);
	const guides = buildScene({ ...brief, interact: { behavior: "select", guides: true } }).guides;
	assert.ok(guides.some(guide => guide.from === "card" && guide.to === "plinth"), JSON.stringify(guides.map(guide => [guide.from, guide.to])));
});
