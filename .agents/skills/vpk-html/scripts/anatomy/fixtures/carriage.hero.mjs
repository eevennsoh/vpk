// 12-part CI audit fixture (ws4b spec section 5, T6, T7, T10): a surface plate on four feet, two rails, a
// carriage with two gauge blocks, and a post whose probe arm reads the block under it. Slider role.
// Parts: plate, 4 feet, 2 rails, carriage, 2 blocks, post, probe.

const PLATE = { x: -60, y: -30, w: 120, d: 60, r: 4 };
const POST = [0, -26];

export const hero = {
	id: "carriage",
	tier: "figure",
	width: 480,
	height: 300,
	label: "A carriage on two rails carries two gauge blocks, 12 and 6 tall, under a probe arm fixed to a post.",
	plate: {
		fig: "Fig 1",
		title: "Carriage",
		hint: "Use arrow keys to slide the carriage",
		keys: [{ mark: "lit", label: "probe" }],
		caption: "A carriage slides two gauge blocks under a fixed probe; the readout names the block under it.",
	},
	stage: {
		role: "slider",
		label: "Carriage. Arrow keys slide it along the rails.",
		input: { min: 0, max: 40, step: 1, bigStep: 10, rest: 27 },
		pointer: { axis: "x", from: 0.15, to: 0.85 },
		tour: { stops: [27, 13], dwell: 2.2, delay: 1.4, resume: 3.6 },
	},
};

export const data = { from: -20, blocks: [{ at: -12, w: 10, h: 12 }, { at: 2, w: 10, h: 6 }], probe: 0 };

export function model(input, data) {
	const cx = data.from + input;
	const block = data.blocks.findIndex(b => cx + b.at <= data.probe && data.probe <= cx + b.at + b.w);
	return { travel: input, cx, block, height: block < 0 ? 0 : data.blocks[block].h };
}

export function present(state) {
	const name = state.block < 0 ? "no block" : `block ${state.block + 1}`;
	return { readout: `${name} · ${state.height} px`, valueText: `${state.block < 0 ? "No block" : `Block ${state.block + 1}`} under the probe, ${state.height} px tall` };
}

export function build(kit, { state, data }) {
	const { A, S, camera, k } = kit;
	const P = camera.fit([...k.boxCorners(PLATE, -12, 0), [POST[0], POST[1], 36]], hero.width, hero.height, { pad: 24 });
	const R = A.recorder(P);
	const put = (name, at, svg, shapes, extra = {}) => R.put({ name, at, svg, shapes: shapes.map(shape => R.solid(shape)), ...extra });
	k.corners(PLATE, 10).forEach(([x, y], index) => {
		const name = `stand.foot${index + 1}`;
		put(name, [x, y, -10], S(k.cylinder(x, y, 4, -12, 4, P, 24), { tone: "mid" }), [A.cylinder(x, y, 4, -12, 4, { name })]);
	});
	put("plate", [0, 0, -4], S(k.slabOf(PLATE, -8, 8, P, 6), { tone: "mid" }), [A.slab(PLATE, -8, 8, { name: "plate" }, 6)]);
	for (const [index, y] of [-14, 10].entries()) {
		const plan = { x: -50, y, w: 100, d: 4, r: 1 };
		put(`rail${index + 1}`, [0, y + 2, 1.5], S(k.slabOf(plan, 0, 3, P, 3), { tone: "mid" }), [A.slab(plan, 0, 3, { name: `rail${index + 1}` }, 3)]);
	}
	const cx = state.cx;
	const carriage = { x: cx - 14, y: -18, w: 28, d: 36, r: 2 };
	const piece = svg => `<g data-piece="carriage">${svg}</g>`;
	put("carriage", [cx, 0, 5], piece(S(k.slabOf(carriage, 3, 4, P, 4), { tone: "mid" })), [A.slab(carriage, 3, 4, { name: "carriage" }, 4)], { piece: "carriage" });
	data.blocks.forEach((block, index) => {
		const plan = { x: cx + block.at, y: -8, w: block.w, d: 16, r: 1 };
		put(`block${index + 1}`, [cx + block.at + block.w / 2, 0, 7 + block.h / 2], piece(S(k.slabOf(plan, 7, block.h, P, 3), { tone: "hi", crease: "lo" })), [A.slab(plan, 7, block.h, { name: `block${index + 1}` }, 3)], { piece: "carriage" });
	});
	put("post", [POST[0], POST[1], 16], S(k.cylinder(POST[0], POST[1], 3, 0, 32, P, 24), { tone: "mid" }), [A.cylinder(POST[0], POST[1], 3, 0, 32, { name: "post" })]);
	const arm = { x: -2, y: POST[1] - 3, w: 4, d: 29, r: 1 };
	put("probe", [0, POST[1] + 11.5, 34], `<g data-focal="probe">${S(k.slabOf(arm, 32, 4, P, 3), { tone: "hi", lit: true })}</g>`, [A.slab(arm, 32, 4, { name: "probe" }, 3)]);
	return { P, R, before: [], after: [] };
}

export function live(ctx) {
	const pieces = [...ctx.svg.querySelectorAll('[data-piece="carriage"]')];
	const home = ctx.model(ctx.input.rest).cx;
	let shown = ctx.input.rest;
	const draw = () => {
		const state = ctx.model(shown);
		for (const el of pieces) ctx.offset(el, [state.cx - home, 0, 0]);
		ctx.show(state);
	};
	return {
		tick(dt, now, calm) {
			shown = ctx.follow(shown, ctx.input.target, dt, 0.25, calm);
			draw();
			return shown !== ctx.input.target;
		},
		rest() {
			shown = ctx.input.rest;
			draw();
		},
	};
}

export const auditOptions = { allow: [], crowd: [], cover: [] };
