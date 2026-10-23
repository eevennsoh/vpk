// Dial indicator anatomy hero (ws4b spec section 6.8): the Figure-tier demo, 45 parts.
//
// Adapted from anatomy examples/dial-indicator/build.mjs (MIT License, Copyright (c) 2026 Ryan,
// github.com/wheresryan22/anatomy @ dbf697a). vpk changes: a pure truth model and presenter; every solid is
// recorded for the audit; moving parts are built at rest and moved by delta; the shared 45/30 camera;
// halos, blur and the page's own rAF and IntersectionObserver are gone; seven parts added (a thumbscrew on
// the dial mount, a back lug and four bezel screws); contacts reworked so nothing interpenetrates.

const PLATE = { x: -128, y: -64, w: 262, d: 128, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;
const MAG = { x: -112, y: -20, w: 44, d: 40, r: 3 };
const MAG_H = 24;
const POST = [-98, 0];
const POST_TOP = 122;
const CLAMP_Z = 100;
const RAIL_FROM = 2;
const RAIL_TO = 124;
const CARRIAGE = { x: -28, y: -24, w: 56, d: 48, r: 3 };
const CARRIAGE_Z = 3;

export const data = {
	reach: [36.2, 80.2],
	dial: [58, 0],
	dialR: 20,
	dialZ: 82,
	dialTop: 92,
	perTurn: 20,
	tipR: 2.6,
	base: 8,
	blocks: [18, 14, 10],
	blockW: 15.6,
	pitch: 16,
	offset: -24,
};

export const hero = {
	id: "dial",
	tier: "figure",
	width: 600,
	height: 380,
	label: "A dial indicator on a surface plate. A magnetic base holds a post and an arm; the arm carries a dial whose plunger rests on three gauge blocks, 18, 14 and 10 tall, on a carriage that slides along two rails. Wherever the carriage stops, the plunger rises to the block under it and the needle turns by the same amount.",
	plate: {
		fig: "Fig 1",
		title: "Dial indicator",
		hint: "Hover or use arrow keys to slide the carriage",
		keys: [
			{ mark: "lit", label: "Plunger and needle: what moves when the height changes" },
			{ mark: "raised", label: "Three gauge blocks, 18, 14 and 10 tall" },
		],
		caption: "A dial indicator on a surface plate. Slide the carriage and the plunger rides onto the block beneath it; one needle turn is 20 px of travel, so every block reads its own height.",
	},
	stage: {
		role: "slider",
		label: "Dial indicator. Arrow keys slide the carriage across the gauge blocks; Page Up and Page Down jump one block.",
		input: { min: 0, max: 44, step: 2, bigStep: 16, rest: 38 },
		pointer: { axis: "x", from: 0.15, to: 0.85 },
		tour: { stops: [38, 22, 6], dwell: 2.2, delay: 1.4, resume: 3.6 },
	},
};

// Carriage travel (px from the left reach) → where the carriage is and what the plunger reads.
export function model(input, data) {
	const x = data.reach[0] + input;
	const [dialX] = data.dial;
	let reading = 0;
	let block = -1;
	data.blocks.forEach((height, index) => {
		const from = x + data.offset + data.pitch * index;
		const to = from + data.blockW;
		if (to > dialX - data.tipR && from < dialX + data.tipR) reading = Math.max(reading, height);
		if (dialX >= from && dialX <= to) block = index;
	});
	return { travel: input, x, block, reading, turn: reading / data.perTurn };
}

export function present(state) {
	const reads = `${state.reading.toFixed(1)} px`;
	return {
		readout: `${state.block < 0 ? "between blocks" : `block ${state.block + 1}`} · reads ${reads}`,
		valueText: `${state.block < 0 ? "Between blocks" : `Block ${state.block + 1} under the plunger`}: the needle reads ${reads}`,
	};
}

export function build(kit, { state, data }) {
	const { A, S, L, D, camera, k } = kit;
	const [dialX, dialY] = data.dial;
	const { dialR, dialZ, dialTop } = data;
	const tipZ = data.base + state.reading;
	const P = camera.fit([...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [POST[0], POST[1], POST_TOP + 2], [dialX + dialR, 0, dialTop]], hero.width, hero.height, { pad: 30 });
	const R = A.recorder(P);
	const at = point => k.iso(point, P);
	const put = (name, center, svg, shape, extra = {}) => R.put({ name, at: center, svg, shapes: [R.solid({ ...shape, name })], ...extra });
	const byDepth = points => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

	// Surface plate on four feet; the feet are the ground.
	byDepth(k.corners(PLATE, 22)).forEach(([x, y], index) => {
		const z0 = -PLATE_H - FOOT_H;
		put(`stand.foot${index + 1}.pad`, [x, y, z0 + 0.8], S(k.cylinder(x, y, 7, z0, 1.6, P, 28), { tone: "lo" }), A.cylinder(x, y, 7, z0, 1.6));
		put(`stand.foot${index + 1}`, [x, y, z0 + 3.3], S(k.cylinder(x, y, 5.4, z0 + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }), A.cylinder(x, y, 5.4, z0 + 1.6, FOOT_H - 1.6));
	});
	const screws = k.corners(PLATE, 10);
	put("plate", [PLATE.x + PLATE.w / 2, 0, -PLATE_H / 2], [
		S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }),
		L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }),
		L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }),
		D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }),
	].join(""), A.slab(PLATE, -PLATE_H, PLATE_H, {}, 8));
	const strip = { x: -110, y: PLATE.y + PLATE.d - 15, w: 230, d: 7, r: 1 };
	const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [2, 3.6], P);
	put("scale", [strip.x + strip.w / 2, strip.y + strip.d / 2, 0.3], [
		S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }),
		L(ticks.minor, { tone: "lo" }),
		L(ticks.major, { tone: "mid" }),
		D([at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])], { size: 0.45 }),
	].join(""), A.slab(strip, 0, 0.6, {}, 3));

	// Two rails and their end stops.
	for (const [index, y] of [-20, 15].entries()) {
		const plan = { x: RAIL_FROM, y, w: RAIL_TO - RAIL_FROM, d: 5, r: 1 };
		put(`rail${index + 1}`, [(RAIL_FROM + RAIL_TO) / 2, y + 2.5, 1.5], S(k.slabOf(plan, 0, 3, P, 3, 0.4), { tone: "mid" }) + D([RAIL_FROM + 6, RAIL_TO - 6].map(x => at([x, y + 2.5, 3])), { size: 0.4 }), A.slab(plan, 0, 3, {}, 3));
	}
	for (const [index, x] of [RAIL_FROM - 5, RAIL_TO].entries()) {
		const plan = { x, y: -23, w: 5, d: 46, r: 1.2 };
		put(`stop${index + 1}`, [x + 2.5, 0, 3.5], S(k.slabOf(plan, 0, 7, P, 3, 0.5), { tone: "mid" }) + D([at([x + 2.5, -18, 7]), at([x + 2.5, 18, 7])], { size: 0.45 }), A.slab(plan, 0, 7, {}, 3));
	}

	// Magnetic base, post, clamp and arm.
	const upper = k.insetPlan(MAG, 0.8);
	put("base.lower", [MAG.x + MAG.w / 2, 0, 5.5], S(k.slabOf(MAG, 0, 11, P, 6, 0.8), { tone: "mid" }), A.slab(MAG, 0, 11, {}, 6));
	put("base.upper", [MAG.x + MAG.w / 2, 0, 17.5], [
		S(k.slabOf(upper, 11, MAG_H - 11, P, 6, 0.8), { tone: "mid" }),
		L(k.planOutline(k.insetPlan(MAG, 3), MAG_H, P), { tone: "faint" }),
		D([at([MAG.x + 5, MAG.y + 5, MAG_H]), at([MAG.x + 5, MAG.y + MAG.d - 5, MAG_H]), at([MAG.x + MAG.w - 5, MAG.y + 5, MAG_H])], { size: 0.45 }),
	].join(""), A.slab(upper, 11, MAG_H - 11, {}, 6));
	const knob = [MAG.x + 32, MAG.y + 28];
	put("base.switch", [knob[0], knob[1], MAG_H + 2], [
		S(k.cylinder(knob[0], knob[1], 6, MAG_H, 4, P, 32), { tone: "mid" }),
		L(k.knurl(knob[0], knob[1], 6, MAG_H, MAG_H + 4, 36, P), { tone: "lo" }),
		L(k.lineOnTop([knob[0], knob[1]], [knob[0] + 6, knob[1]], MAG_H + 4, P), { tone: "hi" }),
		D([at([knob[0], knob[1], MAG_H + 4])], { size: 0.5, tone: "hi" }),
	].join(""), A.cylinder(knob[0], knob[1], 6, MAG_H, 4));
	put("post.foot", [POST[0], POST[1], MAG_H + 2], S(k.cylinder(POST[0], POST[1], 5, MAG_H, 4, P, 28), { tone: "mid" }), A.cylinder(POST[0], POST[1], 5, MAG_H, 4));
	const clamp = { x: POST[0] - 7, y: POST[1] - 7, w: 14, d: 14, r: 2.5 };
	put("post.lower", [POST[0], POST[1], 62], S(k.cylinder(POST[0], POST[1], 3.2, MAG_H + 4, CLAMP_Z - 4 - MAG_H - 4, P, 28), { tone: "mid", crease: "none" }) + L([60, 80].map(z => k.sideArc(POST[0], POST[1], 3.2, z, P, 16)).join(""), { tone: "faint" }), A.cylinder(POST[0], POST[1], 3.2, MAG_H + 4, CLAMP_Z - 4 - MAG_H - 4));
	put("clamp", [POST[0], POST[1], CLAMP_Z + 2], S(k.slabOf(clamp, CLAMP_Z - 4, 12, P, 4, 0.6), { tone: "mid" }), A.slab(clamp, CLAMP_Z - 4, 12, {}, 4));
	put("post.upper", [POST[0], POST[1], 115], S(k.cylinder(POST[0], POST[1], 3.2, CLAMP_Z + 8, POST_TOP - CLAMP_Z - 8, P, 28), { tone: "mid", crease: "none" }), A.cylinder(POST[0], POST[1], 3.2, CLAMP_Z + 8, POST_TOP - CLAMP_Z - 8));
	put("post.cap", [POST[0], POST[1], POST_TOP + 1], S(k.cylinder(POST[0], POST[1], 3.8, POST_TOP, 2, P, 28), { tone: "mid" }), A.cylinder(POST[0], POST[1], 3.8, POST_TOP, 2));
	const mount = { x: dialX - dialR - 8, y: -4, w: 8, d: 8, r: 1.5 };
	const arm = { x: POST[0] + 7, y: -3, w: mount.x + mount.w - POST[0] - 7, d: 6, r: 2 };
	put("arm", [arm.x + arm.w / 2, 0, CLAMP_Z + 2], S(k.slabOf(arm, CLAMP_Z, 4, P, 4, 0.5), { tone: "mid" }) + D([at([arm.x + 4, 0, CLAMP_Z + 4]), at([arm.x + arm.w - 5, 0, CLAMP_Z + 4])], { size: 0.45 }), A.slab(arm, CLAMP_Z, 4, {}, 4));
	const thumb = [clamp.x + 7, clamp.y + clamp.d + 3];
	const shank = { x: thumb[0] - 1.4, y: clamp.y + clamp.d, w: 2.8, d: 3, r: 0.8 };
	put("clamp.screw", [thumb[0], shank.y + 1.5, CLAMP_Z + 3], S(k.slabOf(shank, CLAMP_Z + 1, 4, P, 2), { tone: "mid", crease: "none" }), A.slab(shank, CLAMP_Z + 1, 4, { owner: "clamp" }, 2));
	put("clamp.knob", [thumb[0], thumb[1] + 1.4, CLAMP_Z + 3], S(k.cylinder(thumb[0], thumb[1] + 1.4, 2.6, CLAMP_Z, 6, P, 20), { tone: "mid" }) + L(k.knurl(thumb[0], thumb[1] + 1.4, 2.6, CLAMP_Z, CLAMP_Z + 6, 18, P), { tone: "lo" }), A.cylinder(thumb[0], thumb[1] + 1.4, 2.6, CLAMP_Z, 6, { owner: "clamp" }));

	// Carriage and gauge blocks, built at rest and moved by delta (data-piece="carriage").
	const cx = state.x;
	const piece = (name, svg) => `<g data-piece="${name}">${svg}</g>`;
	const deck = { ...CARRIAGE, x: cx + CARRIAGE.x };
	const top = CARRIAGE_Z + 5;
	put("carriage", [cx, 0, CARRIAGE_Z + 2.5], piece("carriage", [
		S(k.slabOf(deck, CARRIAGE_Z, top - CARRIAGE_Z, P, 5, 0.6), { tone: "mid" }),
		D([-22, -8, 8, 22].map(x => at([cx + x, deck.y + deck.d - 2.6, top])), { size: 0.4, tone: "lo" }),
		L(k.lineOnTop([deck.x, -15.5], [deck.x + deck.w, -15.5], top, P), { tone: "faint" }),
		L(k.lineOnTop([deck.x, 15.5], [deck.x + deck.w, 15.5], top, P), { tone: "faint" }),
	].join("")), A.slab(deck, CARRIAGE_Z, top - CARRIAGE_Z, { owner: "carriage" }, 5), { piece: "carriage" });
	data.blocks.forEach((height, index) => {
		const plan = { x: cx + data.offset + data.pitch * index, y: -12, w: data.blockW, d: 24, r: 1 };
		put(`block${index + 1}`, [plan.x + plan.w / 2, 0, top + height / 2], piece("carriage", S(k.slabOf(plan, top, height, P, 3, 0.5), { tone: "hi", crease: "lo" }) + L(k.planOutline(k.insetPlan(plan, 2), top + height, P, 3), { tone: "faint" })), A.slab(plan, top, height, {}, 3), { piece: "carriage" });
	});
	const handle = [deck.x + deck.w - 8, deck.y + deck.d + 3];
	const neck = { x: handle[0] - 2, y: deck.y + deck.d, w: 4, d: 3, r: 1 };
	put("carriage.neck", [handle[0], neck.y + 1.5, CARRIAGE_Z + 2.5], piece("carriage", S(k.slabOf(neck, CARRIAGE_Z + 1, 3, P, 2), { tone: "mid", crease: "none" })), A.slab(neck, CARRIAGE_Z + 1, 3, { owner: "carriage" }, 2), { piece: "carriage" });
	put("carriage.knob", [handle[0], handle[1] + 1, CARRIAGE_Z + 2.5], piece("carriage", S(k.cylinder(handle[0], handle[1] + 1, 3, CARRIAGE_Z, 5, P, 20), { tone: "mid" }) + L(k.knurl(handle[0], handle[1] + 1, 3, CARRIAGE_Z, CARRIAGE_Z + 5, 18, P), { tone: "lo" })), A.cylinder(handle[0], handle[1] + 1, 3, CARRIAGE_Z, 5, { owner: "carriage" }), { piece: "carriage" });

	// Plunger: the lit part, resting on the block under it and sliding inside the dial stem.
	const lit = (name, svg) => `<g data-piece="plunger" data-focal="plunger">${svg}</g>`;
	put("plunger.tip", [dialX, dialY, tipZ + 1.2], lit("tip", S(k.cylinder(dialX, dialY, data.tipR, tipZ, 2.4, P, 20), { tone: "hi", lit: true })), A.cylinder(dialX, dialY, data.tipR, tipZ, 2.4, { owner: "dial" }), { piece: "plunger", bias: 40 });
	put("plunger.rod", [dialX, dialY, tipZ + 27.4], lit("rod", S(k.cylinder(dialX, dialY, 1.4, tipZ + 2.4, 50, P, 16), { tone: "hi", crease: "none", lit: true })), A.cylinder(dialX, dialY, 1.4, tipZ + 2.4, 50, { owner: "dial" }), { piece: "plunger", bias: 40 });

	// The dial: stem, body with bezel, mount block and its thumbscrew, back lug and crown.
	put("dial.stem", [dialX, dialY, 68], S(k.cylinder(dialX, dialY, 2.9, 54, dialZ - 54, P, 20), { tone: "mid" }) + L(k.sideArc(dialX, dialY, 2.9, 60, P, 12), { tone: "lo" }), A.cylinder(dialX, dialY, 2.9, 54, dialZ - 54, { owner: "dial" }));
	const dialTicks = k.radialTicks(dialX, dialY, dialR - 3, 50, 5, dialTop, [1.3, 2.8], P);
	put("dial.body", [dialX, dialY, dialZ + 5], [
		S(k.cylinder(dialX, dialY, dialR, dialZ, dialTop - dialZ, P, 64, 0.8), { tone: "hi", crease: "lo" }),
		L(k.knurl(dialX, dialY, dialR, dialTop - 3.4, dialTop, 84, P, 0.3), { tone: "lo" }),
		L(k.sideArc(dialX, dialY, dialR, dialTop - 3.4, P, 40), { tone: "faint" }),
		L(k.ring(dialX, dialY, dialR - 2.2, dialTop, P, 64), { tone: "lo" }),
		L(dialTicks.minor, { tone: "lo" }),
		L(dialTicks.major, { tone: "mid" }),
		L(k.ring(dialX, dialY, 1.6, dialTop, P, 16), { tone: "mid" }),
		kit.faceTextSvg(k.topMatrix([dialX, dialY + 9], dialTop, P, "x"), "0.01", { size: 2.4, tone: "lo", anchor: "middle" }),
	].join(""), A.cylinder(dialX, dialY, dialR, dialZ, dialTop - dialZ, { owner: "dial" }));
	[45, 135, 225, 315].forEach((degrees, index) => {
		const angle = (degrees * Math.PI) / 180;
		const [x, y] = [dialX + Math.cos(angle) * 18.6, dialY + Math.sin(angle) * 18.6];
		put(`dial.screw${index + 1}`, [x, y, dialTop + 0.3], S(k.cylinder(x, y, 0.8, dialTop, 0.6, P, 12), { tone: "mid", crease: "none" }), A.cylinder(x, y, 0.8, dialTop, 0.6, { owner: "dial" }));
	});
	put("dial.mount", [mount.x + mount.w / 2, 0, (dialZ + 2 + CLAMP_Z) / 2], S(k.slabOf(mount, dialZ + 2, CLAMP_Z - dialZ - 2, P, 3, 0.4), { tone: "mid" }), A.slab(mount, dialZ + 2, CLAMP_Z - dialZ - 2, { owner: "dial" }, 3));
	const lock = { x: mount.x + 2.8, y: mount.y + mount.d, w: 2.4, d: 3, r: 0.6 };
	put("dial.lock", [lock.x + 1.2, lock.y + 1.5, 91.5], S(k.slabOf(lock, 90, 3, P, 2), { tone: "mid", crease: "none" }), A.slab(lock, 90, 3, { owner: "dial" }, 2));
	put("dial.lock-knob", [lock.x + 1.2, lock.y + 4.6, 91.5], S(k.cylinder(lock.x + 1.2, lock.y + 4.6, 2.2, 89, 5, P, 20), { tone: "mid" }) + L(k.knurl(lock.x + 1.2, lock.y + 4.6, 2.2, 89, 94, 16, P), { tone: "lo" }), A.cylinder(lock.x + 1.2, lock.y + 4.6, 2.2, 89, 5, { owner: "dial" }));
	const lug = { x: dialX - 4, y: dialY - dialR - 6, w: 8, d: 6, r: 1.5 };
	put("dial.lug", [dialX, lug.y + 3, dialZ + 5], S(k.slabOf(lug, dialZ + 2, 6, P, 3, 0.4), { tone: "mid" }), A.slab(lug, dialZ + 2, 6, { owner: "dial" }, 3));
	const crown = { x: dialX + dialR, y: -2.4, w: 4, d: 4.8, r: 1.2 };
	put("dial.crown", [crown.x + 2, 0, dialZ + 4.5], S(k.slabOf(crown, dialZ + 2, 5, P, 3), { tone: "mid" }), A.slab(crown, dialZ + 2, 5, { owner: "dial" }, 3));
	const cap = { x: crown.x + crown.w - 0.4, y: -3.2, w: 2.6, d: 6.4, r: 1.2 };
	put("dial.crown-cap", [cap.x + 1.3, 0, dialZ + 4.5], S(k.slabOf(cap, dialZ + 1.2, 6.6, P, 3), { tone: "mid" }), A.slab(cap, dialZ + 1.2, 6.6, { owner: "dial" }, 3));

	// The needle is drawn over everything and rebuilt from the sprung reading by live().
	const angle = state.turn * Math.PI * 2;
	const needle = k.lineOnTop([dialX - Math.sin(angle) * 3.4, dialY + Math.cos(angle) * 3.4], [dialX + Math.sin(angle) * (dialR - 4), dialY - Math.cos(angle) * (dialR - 4)], dialTop + 0.2, P);
	const after = [`<path data-part="needle" data-focal="plunger" class="iso-line" data-tone="lit" data-free="start" d="${needle}" style="stroke-width:1.1"/>`];
	return { P, R, before: [], after };
}

export function live(ctx) {
	const { kit, P, data } = ctx;
	const carriage = [...ctx.svg.querySelectorAll('[data-piece="carriage"]')];
	const plunger = [...ctx.svg.querySelectorAll('[data-piece="plunger"]')];
	const needle = ctx.part("needle");
	const home = ctx.model(ctx.input.rest);
	const [dialX, dialY] = data.dial;
	const reach = data.dialR - 4;
	const needleAt = reading => {
		const angle = (reading / data.perTurn) * Math.PI * 2;
		return kit.lineOnTop([dialX - Math.sin(angle) * 3.4, dialY + Math.cos(angle) * 3.4], [dialX + Math.sin(angle) * reach, dialY - Math.cos(angle) * reach], data.dialTop + 0.2, P);
	};
	let travel = ctx.input.rest;
	let path = needle.getAttribute("d");
	const tip = { x: home.reading, v: 0 };
	const draw = () => {
		const state = ctx.model(travel);
		for (const el of carriage) ctx.offset(el, [state.x - home.x, 0, 0]);
		for (const el of plunger) ctx.offset(el, [0, 0, tip.x - home.reading]);
		const d = needleAt(tip.x);
		if (d !== path) needle.setAttribute("d", (path = d));
		ctx.show(state);
	};
	return {
		tick(dt, now, calm) {
			travel = ctx.follow(travel, ctx.input.target, dt, 0.28, calm);
			const moving = ctx.spring(tip, ctx.model(travel).reading, dt, 420, 26, calm);
			draw();
			return moving || travel !== ctx.input.target;
		},
		rest() {
			travel = ctx.input.rest;
			tip.x = home.reading;
			tip.v = 0;
			draw();
		},
	};
}

export const auditOptions = { allow: [], crowd: [], cover: [] };
