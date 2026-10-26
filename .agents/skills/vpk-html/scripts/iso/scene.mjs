// iso/scene — brief validation (vpk-iso-brief/1), camera presets and fit, and the scene graph:
// painter order, motion groups, guides, labels and behaviour vectors (illustrations.md § Using the
// kit). Projection is the vendored anatomy iso()/fitProjection(), so the camera is the one figure
// camera (figures/camera.mjs FIGURE_CAMERA, integration K12).

import { cameraAttr, FIGURE_CAMERA } from "../figures/camera.mjs";
import { fitProjection, iso } from "../anatomy/vendor/kit/iso-kit.mjs";
import { hull, parsePolyPath, pointInPolygon } from "./core.mjs";
import { clipConvex, dimGeometry, gutterWidthsNear, placeLabelsNear, segmentBoxes, textWidth } from "./layout.mjs";
import { buildMarks, fitHeight, fitNear, homePiece, narrowTagLayout, scaleGeometry } from "./manual-scene.mjs";
import { manualTiming } from "./motion.mjs";
import { EMPHASES, KIT_STYLE, presetFor } from "./palette.mjs";
import { boundsOf, contains, isLegacy, planCentre, TUBE_KINDS } from "./geometry.mjs";
import { painterKeys } from "./painter.mjs";
import { padHull } from "./core.mjs";
import { castShadows, castsShadow, clipWindowPath, receivingTop, depthKey, guideCorners, guideSegments, shadowMove, shadowStep, solidFor, supportZs } from "./solids.mjs";
import { drawEntries, hasVariants, pieceShows, restGeometry, stateConfig, stateModelOf, statePoses, viewIn } from "./states.mjs";

export { EMPHASES };

export {
	BRIEF_SCHEMA_ID,
	BriefError,
	CAMERA_PRESETS,
	CROP_PAD,
	DEFAULT_PAD,
	DEFAULT_VIEWBOX,
	emphasisOf,
	ENGINE_ID,
	FIG_ID,
	FIGURE_ID,
	FIT_FROM_Z,
	focalIdsOf,
	LABEL_MODES,
	labelModeOf,
	labelSpecsOf,
	MANUAL_FROM,
	MAX_LABELS,
	MAX_PARTS,
	MIN_CROP_ZOOM,
	PART_KINDS,
	PART_STATES,
	PART_TONES,
	validateBrief,
	WARN_PARTS,
} from "./schema.mjs";
export { expandBrief } from "./expand.mjs";
import { BriefError, CAMERA_PRESETS, CROP_PAD, DEFAULT_PAD, DEFAULT_VIEWBOX, emphasisOf, FIT_FROM_Z, focalIdsOf, labelModeOf, labelSpecsOf, MANUAL_FROM, MAX_PARTS, MIN_CROP_ZOOM, validateBrief, WARN_PARTS } from "./schema.mjs";
import { expandBrief } from "./expand.mjs";
import { assembledBrief, explodedBrief, isTeardown } from "./teardown.mjs";
const SCALE_GAP = 14;

const round = (value, step = 10) => Math.round(value * step) / step;

export function resolveCamera(camera = {}) {
	const preset = camera?.preset ?? "dimetric";
	const base = CAMERA_PRESETS[preset] ?? CAMERA_PRESETS.dimetric;
	return {
		preset,
		azimuth: camera?.azimuth ?? base.azimuth,
		elevation: camera?.elevation ?? base.elevation,
		scale: camera?.scale ?? "fit",
		pad: camera?.pad ?? DEFAULT_PAD,
	};
}

// "fit" (default): fit the points into the viewBox minus the label gutters; a number keeps that
// scale and centres the points' projected box in the gutter-reduced frame.
export function projectionFor(camera, [width, height], points, [gutterLeft, gutterRight] = [0, 0]) {
	const cam = resolveCamera(camera);
	const inner = width - gutterLeft - gutterRight;
	if (cam.scale === "fit") {
		const fitted = fitProjection(points, inner, height, { pad: cam.pad, azimuth: cam.azimuth, elevation: cam.elevation });
		return { ...fitted, origin: [fitted.origin[0] + gutterLeft, fitted.origin[1]] };
	}
	const unit = { origin: [0, 0], scale: cam.scale, azimuth: cam.azimuth, elevation: cam.elevation };
	const flat = points.map(point => iso(point, unit));
	const xs = flat.map(([x]) => x);
	const ys = flat.map(([, y]) => y);
	return {
		origin: [gutterLeft + inner / 2 - (Math.min(...xs) + Math.max(...xs)) / 2, height / 2 - (Math.min(...ys) + Math.max(...ys)) / 2],
		scale: cam.scale,
		azimuth: cam.azimuth,
		elevation: cam.elevation,
	};
}

export const cameraAttrOf = projection => cameraAttr({ azimuth: projection.azimuth, elevation: projection.elevation });

// Fit, support, anchor and guide geometry comes from geometry.mjs boundsOf (one model for every kind; the legacy kinds keep their
// old corners exactly).
const partCorners = part => boundsOf(part).samples3;
const bottomZ = part => boundsOf(part).bottom;

// The part a clipped ring shows inside: its target, grown by `clipPad` world units on every side of the plan.
export function clipWindowPart(part, byId) {
	const target = byId.get(part.clipTo);
	const pad = part.clipPad ?? 0;
	if (!pad) return target;
	if (target.kind === "cylinder" || target.kind === "ring") return { ...target, size: [target.size[0] + pad, target.size[0] + pad, target.size[2]] };
	return { ...target, at: [target.at[0] - pad, target.at[1] - pad, target.at[2]], size: [target.size[0] + 2 * pad, target.size[1] + 2 * pad, target.size[2]] };
}

const topZ = part => boundsOf(part).top;
const planBox = part => boundsOf(part).plan;

// Candidate anchor points on the visible faces of a part (top grid plus the sides facing the viewer); a new kind offers its
// surface samples and its centre.
function anchorCandidates(part, P) {
	if (!isLegacy(part)) return [boundsOf(part).centre, ...boundsOf(part).samples3].map(point => iso(point, P));
	const [x0, y0, x1, y1] = planBox(part);
	const zTop = topZ(part);
	const steps = [0.15, 0.35, 0.5, 0.65, 0.85];
	const points = [];
	for (const u of steps) for (const v of steps) points.push([x0 + (x1 - x0) * u, y0 + (y1 - y0) * v, zTop]);
	const h = zTop - part.at[2];
	if (h >= 2) {
		const zMid = part.at[2] + h / 2;
		const cosA = Math.cos((P.azimuth * Math.PI) / 180);
		const sinA = Math.sin((P.azimuth * Math.PI) / 180);
		for (const s of steps) {
			if (cosA > 0.01) points.push([x1, y0 + (y1 - y0) * s, zMid]);
			if (sinA > 0.01) points.push([x0 + (x1 - x0) * s, y1, zMid]);
		}
	}
	return points.map(point => iso(point, P));
}

function distanceToPolygon([px, py], poly) {
	let best = Infinity;
	for (let i = 0; i < poly.length; i++) {
		const [ax, ay] = poly[i];
		const [bx, by] = poly[(i + 1) % poly.length];
		const dx = bx - ax;
		const dy = by - ay;
		const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
		best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
	}
	return best;
}

// A visible point of the target nearest the label side; falls back to the top centre.
function chooseAnchor(part, side, pieces, P, override) {
	if (override) return { point: iso(override, P), visible: true };
	const own = pieces.filter(piece => piece.partId === part.id && !piece.restHidden);
	const lastOwn = Math.max(...own.map(piece => pieces.indexOf(piece)));
	const covering = pieces.slice(lastOwn + 1).filter(piece => piece.partId !== part.id && !piece.restHidden);
	const ownHull = hull(own.flatMap(piece => piece.hit));
	// A cutaway's front shell covers nothing inside its window (piece.window: the open part of its hull).
	const covers = (piece, point) => (pointInPolygon(point, piece.hit) || distanceToPolygon(point, piece.hit) < 4) && !(piece.window && pointInPolygon(point, piece.window) && distanceToPolygon(point, piece.window) >= 4);
	const visible = anchorCandidates(part, P).filter(point => pointInPolygon(point, ownHull) && distanceToPolygon(point, ownHull) >= 3
		&& covering.every(piece => !covers(piece, point)));
	if (!visible.length) {
		const [x0, y0, x1, y1] = planBox(part);
		return { point: iso([(x0 + x1) / 2, (y0 + y1) / 2, topZ(part)], P), visible: false };
	}
	visible.sort((a, b) => (side === "left" ? a[0] - b[0] : b[0] - a[0]) || a[1] - b[1]);
	return { point: visible[0], visible: true };
}

function layerIndexMap(brief) {
	const map = new Map();
	(brief.assemble?.layers ?? []).forEach((layer, index) => layer.forEach(id => map.set(id, index)));
	return map;
}

function screenVector(world, P) {
	const a = iso([0, 0, 0], P);
	const b = iso(world, P);
	return [round(b[0] - a[0]), round(b[1] - a[1])];
}

// A figure is built, then fitted to its frame: gutters first, then the viewBox height.
export function buildScene(input, { style = input?.style } = {}) {
	const errors = validateBrief({ ...input, style });
	if (errors.length) throw new BriefError(errors);
	// Repeat, instances and vary expand once; the scene (and scene.brief) holds the expanded parts.
	// A teardown brief is written assembled; the scene draws it exploded (teardown.mjs), so the static art is the teardown.
	const brief = explodedBrief(expandBrief(input));
	const scene = buildSceneAt(brief, style, null);
	const rebuild = (gutters, viewBox) => buildSceneAt(brief, style, gutters, viewBox);
	const fitted = fitHeight(scene.labels.length ? fitNear(scene, rebuild) : scene, rebuild);
	// Teardown: the painter order of the assembled pose too (depth0), so the runtime redraws a cover over the parts it closes on.
	if (isTeardown(input)) {
		const assembled = buildSceneAt(assembledBrief(expandBrief(input)), style, null);
		const depth0 = new Map(assembled.pieces.map(piece => [piece.id, piece.depth]));
		for (const piece of fitted.pieces) piece.depth0 = depth0.get(piece.id);
	}
	return fitted;
}

function buildSceneAt(source, style, gutterOverride, viewBoxOverride = null) {
	const errors = validateBrief({ ...source, style });
	if (errors.length) throw new BriefError(errors);
	// Step and scrub figures (states.mjs): the scene's fit, supports, anchors and shadows read each part's rest geometry; the
	// piece loop draws every variant and turn sample.
	const stateModel = stateModelOf(source);
	const brief = stateModel && source.parts.some(hasVariants) ? { ...source, parts: source.parts.map(part => (hasVariants(part) ? restGeometry(part, stateModel) : part)) } : source;
	const drawOf = new Map(source.parts.map(part => [part.id, part]));
	const preset = presetFor(style);
	style = KIT_STYLE;
	const warnings = [];
	const viewBox = viewBoxOverride ?? brief.viewBox ?? DEFAULT_VIEWBOX;
	const cam = resolveCamera(brief.camera);
	const interact = brief.interact ?? null;
	const behavior = interact?.behavior ?? null;
	// A teardown figure is an explode figure whose rest pose is the exploded one: spread 1 is the brief's `at` values, spread 0
	// moves every part back by its travel to its assembled place (illustrations.md § Teardown).
	const teardown = behavior === "teardown" ? { step: 0.05, start: "exploded", ...interact.teardown } : null;
	const explode = behavior === "explode" ? { unit: "gap", ...interact.explode } : teardown ? { unit: "spread", rest: 1, min: 0, max: 1, step: teardown.step } : null;
	const liftWorld = behavior === "select" ? interact.lift ?? 8 : 0;
	const layers = layerIndexMap(brief);
	const zRank = new Map([...brief.parts].sort((a, b) => bottomZ(a) - bottomZ(b)).map((part, index) => [part.id, index]));
	// A part without its own explode vector that sits on another part (its base on that part's top, inside its plan; a tray's
	// floor counts as its top) moves with that part: window controls stay on the window, pins on their bed. Only a part that
	// rests on nothing falls back to its assembly layer, 12 units per layer.
	const restsOn = part => brief.parts.find(other => other !== part && supportZs(other).some(z => Math.abs(z - bottomZ(part)) < 1e-6) && contains(other, planCentre(part)));
	const vectors = new Map();
	const vectorOf = (part, seen = new Set()) => {
		if (part.explode) return part.explode;
		if (vectors.has(part.id)) return vectors.get(part.id);
		const support = castsShadow(part) && !seen.has(part.id) ? restsOn(part) : null;
		const vector = support && !seen.has(support.id) ? vectorOf(support, seen.add(part.id)) : [0, 0, (layers.get(part.id) ?? zRank.get(part.id)) * 12];
		vectors.set(part.id, vector);
		return vector;
	};
	const assemble = brief.assemble ?? null;
	const from = assemble?.from ?? MANUAL_FROM;

	const byId = new Map(brief.parts.map(part => [part.id, part]));
	const emphasis = emphasisOf(brief);
	const focalSet = new Set(focalIdsOf(brief));
	// Cast shadows fall on the figure's ground, the lowest base of a part that casts one (illustrations.md § Shadows): one plane,
	// so the shadow group paints first, under every part.
	const casters = brief.parts.filter(castsShadow);
	const ground = casters.length ? Math.min(...casters.map(bottomZ)) : 0;
	const step = shadowStep();
	const shadowCorners = (part, [mx, my, mz] = [0, 0, 0]) => partCorners(part).map(([x, y, z]) => [x + mx + (z + mz - ground) * step[0], y + my + (z + mz - ground) * step[1], ground]);
	// Fit every pose the figure can reach (explode, lift, assembly start). A clipped ring shows only inside its clip window,
	// so its fit extent is the window's (a flash ring several times the column would shrink the column to a speck).
	const poses = [];
	const shadowPoses = [];
	for (const part of brief.parts) {
		const corners = partCorners(part.kind === "ring" && part.clipTo ? clipWindowPart(part, byId) : part);
		poses.push(...corners);
		if (stateModel) {
			// Every state's pose, every variant and every turn sample is in frame.
			const all = hasVariants(drawOf.get(part.id)) ? drawEntries(drawOf.get(part.id)).flatMap(entry => partCorners(entry.geom)) : corners;
			poses.push(...all, ...statePoses(stateModel, part, all));
		}
		if (explode) {
			const e = vectorOf(part);
			for (const k of [explode.min - explode.rest, explode.max - explode.rest]) poses.push(...corners.map(([x, y, z]) => [x + e[0] * k, y + e[1] * k, z + e[2] * k]));
		}
		if (liftWorld) poses.push(...corners.map(([x, y, z]) => [x, y, z + liftWorld]));
		if (assemble) poses.push(...corners.map(([x, y, z]) => [x + from[0], y + from[1], z + Math.min(from[2], FIT_FROM_Z)]));
		// The rest pose's shadows are fitted; a lifted or exploded shadow may run past the frame, which clips it (the stage clips).
		if (castsShadow(part)) shadowPoses.push(...shadowCorners(part));
	}
	const solidPoses = poses.length;
	poses.push(...shadowPoses);
	for (const note of brief.annotations ?? []) poses.push(note.from, ...(note.via ?? []), note.to);

	// A `dimension` annotation is drawn as a boxed label on a tick-ended line, like a `dims` entry.
	const dimSpecs = [...(brief.dims ?? []), ...(brief.annotations ?? []).filter(note => note.kind === "dimension")];
	const markSpecs = brief.marks ?? [];
	const scaleSpec = brief.scale ?? null;
	for (const spec of dimSpecs) poses.push(spec.from, spec.to);
	let scaleAt = null;
	if (scaleSpec) {
		const solids = brief.parts.filter(part => part.kind !== "ring");
		scaleAt = scaleSpec.at ?? [Math.min(...solids.map(part => planBox(part)[0])), Math.max(...solids.map(part => planBox(part)[3])) + SCALE_GAP, 0];
		poses.push(scaleAt, [scaleAt[0] + scaleSpec.length, scaleAt[1], scaleAt[2]]);
	}

	const font = { size: preset.label.size, spacingEm: preset.label.spacingEm };
	const labelSpecs = labelSpecsOf(brief);
	const P0 = projectionFor(cam, viewBox, poses);
	const flat0 = poses.map(point => iso(point, P0)[0]);
	const centre0 = (Math.min(...flat0) + Math.max(...flat0)) / 2;
	const sides = labelSpecs.map(label => {
		if (label.side === "left" || label.side === "right") return label.side;
		const [x0, y0, x1, y1] = planBox(byId.get(label.target));
		return iso([(x0 + x1) / 2, (y0 + y1) / 2, topZ(byId.get(label.target))], P0)[0] < centre0 ? "left" : "right";
	});
	const labelItems = labelSpecs.map((label, index) => ({ text: label.text, side: sides[index] }));
	const gutters = gutterOverride ?? gutterWidthsNear(labelItems, font);
	const P = projectionFor(cam, viewBox, poses, [gutters.left, gutters.right]);

	const pieces = [];
	if (brief.parts.length > WARN_PARTS) warnings.push(`${brief.parts.length} parts; above ${WARN_PARTS} a figure gets heavy${Number.isFinite(MAX_PARTS) ? ` (at most ${MAX_PARTS})` : ""}`);
	for (const part of brief.parts) {
		const drawn = drawOf.get(part.id);
		for (const entry of drawEntries(drawn)) {
			for (const built of solidFor(entry.geom, P, preset)) {
				const piece = entry.variant === null ? built : { ...built, id: `${built.id}@${entry.variant}`, of: part.id, variant: entry.variant };
				// The hit polygon comes from the fills, else the line work, else a glow's halo or a section face's polygon.
				const points = piece.solids.flatMap(solid => parsePolyPath(solid.fill ?? solid.edge ?? solid.glow ?? solid.cut) ?? []);
				const outline = hull(points);
				// A piece the rest state does not show (another variant, a turn sample, a hidden part) is emitted with display="none" and
				// takes no part in the rest painter order; its shapes order the states that show it (states.mjs stateOrder).
				const restHidden = stateModel ? !pieceShows(stateModel, stateModel.rest, piece, drawn) : false;
				pieces.push({ ...piece, partId: part.id, label: part.label, geomTone: entry.geom.tone ?? null, z: bottomZ(entry.geom), depth: depthKey(piece, P), hit: outline.length >= 3 ? outline : padHull(points), restHidden, allShapes: piece.shapes, shapes: restHidden ? [] : piece.shapes });
				for (const note of piece.detail?.skipped ?? []) warnings.push(`part "${part.id}": ${note}; skipped`);
			}
		}
	}
	for (const piece of pieces) piece.baseDepth = piece.depth;
	// Painter order (painter.mjs): the vendored depth audit orders every pair of pieces that overlap on screen by which one is in
	// front; the keys stay in depth units and become data-vpk-iso-depth.
	const byOld = (a, b) => a.depth - b.depth || a.z - b.z || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
	pieces.sort(byOld);
	const painted = painterKeys(pieces, P);
	pieces.forEach((piece, index) => (piece.depth = painted.keys[index]));
	// A piece with no painter shape (a gap outline, a flat ring, a glow halo) keeps its old key while the audit pushes shaped keys
	// forward, so a gap above a tray fell behind the whole tray. It stays in front of every shaped piece that was behind it before.
	const shaped = pieces.filter(piece => piece.shapes?.length);
	for (const piece of pieces) {
		if (piece.shapes?.length) continue;
		const behind = shaped.filter(other => other.baseDepth < piece.baseDepth || (other.baseDepth === piece.baseDepth && other.z < piece.z));
		if (behind.length) piece.depth = Math.max(piece.depth, Math.max(...behind.map(other => other.depth)) + 0.01);
	}
	pieces.sort(byOld);
	for (const piece of pieces) {
		const part = byId.get(piece.partId);
		piece.focal = focalSet.has(part.id);
		piece.state = piece.focal && emphasis === "accent" ? null : part.state ?? null;
		// A variant may carry its own tone (a nozzle that glows only in afterburner), so the tone is the drawn geometry's.
		piece.tone = piece.geomTone;
		piece.layer = assemble ? layers.get(part.id) : null;
		if (explode) piece.explode = screenVector(vectorOf(part), P);
		if (liftWorld) piece.lift = screenVector([0, 0, liftWorld], P);
		if (part.clipTo) piece.clipTo = part.clipTo;
	}
	// Glow (plan § 2 W): each glowing piece's faces share one radial gradient centred on the piece, reaching its farthest corner
	// (userSpaceOnUse, so it moves with the part); a glow halo takes the one shared halo gradient. An accent focal keeps its accent.
	let glows = 0;
	for (const piece of pieces) {
		if (piece.kind === "glow") piece.halo = true;
		else if (piece.tone === "glow" && !(piece.focal && emphasis === "accent")) {
			const xs = piece.hit.map(([x]) => x);
			const ys = piece.hit.map(([, y]) => y);
			const [cx, cy] = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
			piece.glow = { k: glows++, cx, cy, r: Math.max(1, ...piece.hit.map(([x, y]) => Math.hypot(x - cx, y - cy))) };
		}
	}
	// One flat shadow per part that casts one, in painter order of its first piece; `cast` is the screen move of the shadow per
	// unit of the figure's motion (the lift for select, a Gap unit for explode), so the runtime moves it with its part.
	const shadows = [];
	const shadowed = new Set();
	for (const piece of pieces) {
		const part = byId.get(piece.partId);
		const key = piece.variant ? `${part.id}@${piece.variant}` : part.id;
		if (!castsShadow(part) || shadowed.has(key)) continue;
		shadowed.add(key);
		const move = explode ? vectorOf(part) : liftWorld ? [0, 0, liftWorld] : null;
		// A variant or turn sample casts its own shadow, shown and hidden with it (state-runtime.mjs).
		const geom = piece.variant ? drawEntries(drawOf.get(part.id)).find(entry => entry.variant === piece.variant).geom : part;
		if (!castsShadow(geom)) continue;
		for (const hit of castShadows(geom, P, { ground, r: geom.r ?? preset.radius, step })) {
			shadows.push({ partId: part.id, layer: piece.layer, hit, cast: move ? screenVector(shadowMove(move, step), P) : null, variant: piece.variant ?? null, restHidden: piece.restHidden });
		}
	}
	// Shadows on the parts below (illustrations.md § Shadows): one light, so a point on a part's top face is in shadow when any
	// part above it blocks the light, and the union of those casters' projections onto the face's plane is its shadow. Each pair
	// is the caster's full shadow on that plane, clipped live to the face (the emitter's clipPath), kept when it touches the face
	// at some reachable pose; it moves by the caster's cast times its motion less the receiver's (runtime place()).
	const castOf = part => {
		const move = explode ? vectorOf(part) : liftWorld ? [0, 0, liftWorld] : null;
		return move ? screenVector(shadowMove(move, step), P) : null;
	};
	const reach = explode ? [explode.min - explode.rest, 0, explode.max - explode.rest].map(k => [k, k]) : liftWorld ? [[0, 0], [1, 0]] : [[0, 0]];
	const area = poly => Math.abs(poly.reduce((sum, [x, y], i) => sum + x * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * y, 0)) / 2;
	// An ink part's top is darker than any received shadow, so it receives none. In a step or scrub figure only the parts that
	// keep one shape and show at rest cast and receive these (a variant's received shadow would not follow its swap).
	const settled = part => !stateModel || (!hasVariants(drawOf.get(part.id)) && !viewIn(stateModel, stateModel.rest, drawOf.get(part.id)).hidden);
	for (const receiver of casters.filter(part => part.tone !== "ink" && receivingTop(part) && settled(part))) {
		const top = receivingTop(receiver, receiver.r ?? preset.radius);
		const face = top.ring.map(([x, y]) => iso([x, y, top.z], P));
		const castOn = castOf(receiver);
		const list = [];
		for (const caster of casters) {
			if (caster === receiver || bottomZ(caster) < top.z - 1e-6 || !settled(caster)) continue;
			const cast = castOf(caster);
			const off = (v, k) => (v ? [v[0] * k, v[1] * k] : [0, 0]);
			for (const hit of castShadows(caster, P, { ground: top.z, r: caster.r ?? preset.radius, step })) {
				const touches = reach.some(([kc, kr]) => {
					const [cx, cy] = off(cast, kc);
					const [rx, ry] = off(castOn, kr);
					return area(clipConvex(hit.map(([x, y]) => [x + cx - rx, y + cy - ry]), face)) > 1;
				});
				if (touches) list.push({ partId: caster.id, hit, cast, castOn, layer: assemble ? layers.get(caster.id) : null });
			}
		}
		const home = pieces.find(piece => piece.id === (top.piece ? `${receiver.id}:${top.piece}` : receiver.id));
		// A caster painted entirely before the receiver stands behind it (painter order), so it cannot shadow the receiver's top (A21).
		const homeAt = pieces.indexOf(home);
		const inFront = list.filter(entry => Math.max(...pieces.map((piece, at) => (piece.partId === entry.partId ? at : -1))) > homeAt);
		if (inFront.length && home) home.received = { clip: face, shadows: inFront, solid: top.solid ?? 0 };
	}
	// A clipped piece shows only inside its clip window: its target's top face, or that plan grown by `clipPad`. That
	// window is its silhouette and hit polygon, and the emitted clipPath is the same path (`clipD`).
	for (const piece of pieces) {
		if (!piece.clipTo) continue;
		const part = byId.get(piece.partId);
		const target = pieces.find(other => other.partId === piece.clipTo && other.solids[0]?.top) ?? pieces.find(other => other.partId === piece.clipTo);
		piece.clipD = part.clipPad ? clipWindowPath(part, clipWindowPart(part, byId), P) : target.solids[0].top ?? target.solids[0].fill ?? target.solids[0].edge;
		const clipped = clipConvex(piece.hit, parsePolyPath(piece.clipD) ?? []);
		if (clipped.length >= 3) piece.hit = clipped;
	}

	// Explode guides: each extreme base corner drops to the highest part whose footprint lies under it.
	const guides = [];
	if (explode) {
		for (const part of brief.parts) {
			// guides: false keeps repeated detail (fins, keys, chips) from drawing a curtain of dashed guides.
			if (part.guides === false || part.tone === "glass" || (["ring", "gap", "tray", "wire", "leg", ...TUBE_KINDS].includes(part.kind) && !(part.kind === "ring" && part.thickness))) continue;
			const byTarget = new Map();
			for (const corner of guideCorners(part, P, part.r ?? preset.radius)) {
				const below = brief.parts
					.filter(other => other !== part && other.kind !== "gap" && topZ(other) <= bottomZ(part) + 1e-6 && contains(other, corner))
					.sort((a, b) => topZ(b) - topZ(a) || (a.id < b.id ? -1 : 1))[0];
				if (!below) continue;
				if (!byTarget.has(below.id)) byTarget.set(below.id, { below, corners: [] });
				byTarget.get(below.id).corners.push(corner);
			}
			for (const { below, corners } of byTarget.values()) {
				const segment = guideSegments(corners, bottomZ(part), topZ(below), P);
				if (segment) guides.push({ from: part.id, to: below.id, ...segment });
			}
		}
	}

	const groups = [];
	pieces.forEach((piece, index) => {
		const last = groups.at(-1);
		if (last && last.layer === piece.layer) last.pieces.push(index);
		else groups.push({ layer: piece.layer, pieces: [index] });
	});

	// A select lift reorders only pieces that stand over one another in plan within a motion group (runtime resort()); a
	// piece that overlaps none keeps painter order and emits no plan.
	if (liftWorld) {
		const overlap = (a, b) => a.plan.some(p => b.plan.some(q => p[0] < q[2] && q[0] < p[2] && p[1] < q[3] && q[1] < p[3]));
		for (const group of groups) for (const index of group.pieces) pieces[index].stacks = group.pieces.some(other => other !== index && overlap(pieces[index], pieces[other]));
	}

	const sceneHull = hull(pieces.filter(piece => !piece.restHidden).flatMap(piece => piece.hit));
	const xs = sceneHull.map(([x]) => x);
	const hullBox = { minX: Math.min(...xs), maxX: Math.max(...xs) };
	const anchors = labelSpecs.map((label, index) => {
		const choice = chooseAnchor(byId.get(label.target), sides[index], pieces, P, label.anchor);
		if (!choice.visible) warnings.push(`label "${label.text}": no visible point on "${label.target}"; anchored at its top centre (set labels[${index}].anchor)`);
		return choice.point;
	});
	// Boxed dimension labels and the scale bar are placed first, because they do not move and the labels route around them.
	const hullCentre = [(hullBox.minX + hullBox.maxX) / 2, (Math.min(...sceneHull.map(([, y]) => y)) + Math.max(...sceneHull.map(([, y]) => y))) / 2];
	const dims = dimSpecs.map(spec => ({ ...dimGeometry({ a: iso(spec.from, P), b: iso(spec.to, P), text: spec.text, offset: spec.offset, centre: hullCentre }, font), text: spec.text }));
	const scaleBar = scaleSpec ? scaleGeometry(scaleSpec, scaleAt, P, font) : null;
	// A motion arrow or a line (a ray) is not a part, but a label that sat on it would read as its caption; labels route around it.
	const notePoints = note => [note.from, ...(note.via ?? []), note.to].map(point => iso(point, P));
	const arrowBoxes = (brief.annotations ?? []).filter(note => note.kind === "arrow" || note.kind === "line").flatMap(note => {
		const points = notePoints(note);
		return points.slice(1).flatMap((point, i) => segmentBoxes(points[i], point));
	});
	const avoid = [...dims.map(dim => dim.box), ...(scaleBar ? [scaleBar.box] : []), ...arrowBoxes];
	const labelRows = labelSpecs.map((label, index) => ({ text: label.text, target: label.target, side: sides[index], anchor: anchors[index] }));
	const labels = placeLabelsNear({ viewBox, hull: sceneHull, pad: cam.pad, avoid }, labelRows, font);

	const annotations = [];
	for (const note of brief.annotations ?? []) {
		if (note.kind === "dimension") continue;
		annotations.push({ ...note, a: iso(note.from, P), b: iso(note.to, P), points: notePoints(note), text: note.text });
	}

	// Narrow stages (illustrations.md § Narrow stages, G2 J4): 11-unit callout text renders near 4 px on a phone, so below
	// 720 px the callouts give way to numbered tags (on the target's anchor, inside its part group) plus an HTML legend, and
	// the empty label gutters are cropped. `tags` and `crop` carry the data; the emitter writes it, runtime-css switches it on.
	let tags = labels.map((label, index) => {
		const point = label.leader.points.at(-1);
		const home = homePiece(pieces, label.target, point);
		return { n: index + 1, text: label.text, target: label.target, point, piece: home ? home[1] : -1 };
	});
	const marks = buildMarks(markSpecs, { pieces, hullCentre, warnings, anchorFor: spec => chooseAnchor(byId.get(spec.target), "right", pieces, P, spec.at) });
	let crop = null;
	if (labels.length || dims.length) {
		// The narrow-stage crop spans the drawing, not its shadows: a shadow's tail may fall outside the cropped stage, which keeps
		// the parts and their tags at full size on a phone.
		const xs = poses.filter((_, index) => index < solidPoses || index >= solidPoses + shadowPoses.length).map(point => iso(point, P)[0]);
		const x0 = Math.max(0, Math.min(...xs) - CROP_PAD);
		const x1 = Math.min(viewBox[0], Math.max(...xs) + CROP_PAD);
		if (viewBox[0] / (x1 - x0) >= MIN_CROP_ZOOM) crop = { width: round((viewBox[0] / (x1 - x0)) * 100), offset: round((-x0 / (x1 - x0)) * 100) };
		if (labels.length) ({ tags, crop } = narrowTagLayout({ tags, labels, hull: sceneHull, width: viewBox[0], height: viewBox[1], xs, cropPad: CROP_PAD, minZoom: MIN_CROP_ZOOM }));
	}

	let timing = null;
	if (assemble) timing = manualTiming({ layers: assemble.layers.length });
	const scene = {
		brief,
		id: brief.id,
		figId: brief.figId,
		style,
		preset,
		viewBox,
		pad: cam.pad,
		P,
		camera: { preset: cam.preset, azimuth: P.azimuth, elevation: P.elevation, attr: cameraAttrOf(P) },
		zdepth: Math.round(Math.sin((P.elevation * Math.PI) / 180) * 1000) / 1000,
		liftWorld,
		behavior,
		explode,
		teardown,
		interact,
		pieces,
		groups,
		shadows,
		ground,
		guides,
		labels,
		tags,
		crop,
		font,
		annotations,
		dims,
		marks,
		scaleBar,
		timing,
		enterOffset: timing ? screenVector(from, P) : null,
		// A landing part's shadow slides in on the ground from where the start pose casts it.
		shadowOffset: timing ? screenVector(shadowMove(from, step), P) : null,
		texture: preset.texture && brief.texture === "dots" ? preset.texture : null,
		hull: sceneHull,
		poseYs: poses.map(point => iso(point, P)[1]),
		gutters,
		warnings,
		// Pairs of pieces that each cover the other (interpenetrating solids); they keep the old depth-point order (audit A5 warns).
		painterCycles: painted.cycles,
		emphasis,
		// A figure with a spectrum ray carries data-vpk-iso-spectrum (audit A1 and check-html admit the ray tokens only then).
		spectrum: annotations.some(note => note.kind === "line" && note.spectrum),
		labelMode: labelModeOf(brief),
		widthOf: text => textWidth(text, font),
		stateModel,
		states: null,
	};
	// The stage's state model: per state, the screen moves (part and cast shadow), discrete views, values, text and painter order.
	if (stateModel) scene.states = stateConfig(scene, { byId: drawOf, screen: move => screenVector(move, P), shadowScreen: move => screenVector(shadowMove(move, step), P), P });
	return scene;
}
