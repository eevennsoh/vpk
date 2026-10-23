// Sample lab for motion-case-study.html (references/lab-kit.md, Authoring a lab). scripts/lab/build-template.mjs
// inlines this file as <script data-vpk-lab-doc>. It registers through self.vpkLabQueue, so it can run before or
// after the kit block. Grayscale: every colour comes from api.tokens, focal only on the moving card (decision 2).
// The maths is the fixture's (assets/lab/fixtures/rehearsal-target.html, cardBox): lift 0-0.6 s on vpkOut, an arc
// throw 0.6-1.6 s on the chosen curve, then a spring landing (k 220, c 20).
(self.vpkLabQueue ??= []).push(["easing", {
	time: { param: "t", min: 0, max: 1.95, reducedMotion: 1.95 },
	setup(api) {
		api.state.geometry = { x0: 70, x1: 770, ground: 170, cardW: 120, cardH: 72, lift: 30, arc: 90 };
	},
	pose(api, t) {
		const L = self.vpkLab;
		const g = api.state.geometry;
		const ease = L.EASE[api.params.curve] ?? L.EASE.vpkOut;
		if (t < 0.6) return { x: g.x0, y: g.ground - g.lift * L.EASE.vpkOut(L.progress(t, 0, 0.6)), u: 0 };
		if (t < 1.6) {
			const u = ease(L.progress(t, 0.6, 1.6));
			return { x: L.lerp(g.x0, g.x1, u), y: g.ground - g.lift - g.arc * Math.sin(Math.PI * u), u };
		}
		return { x: g.x1, y: g.ground - g.lift * (1 - L.spring(t - 1.6, 220, 20)), u: 1 };
	},
	draw(api) {
		const { ctx, w, h, tokens: c } = api;
		if (!ctx) return;
		const L = self.vpkLab;
		const g = api.state.geometry;
		// k = canvas units per CSS px once the canvas renders below its authored width (1 on wide screens), so strokes and
		// labels keep their CSS size on phones; there the canvas also grows taller (data-vpk-canvas-min-height) and the
		// scene sits centred above the axis.
		const k = api.px(1);
		ctx.clearRect(0, 0, w, h);
		ctx.fillStyle = c.raised;
		ctx.fillRect(0, 0, w, h);
		ctx.save();
		ctx.translate(0, Math.max(0, (h - 300) / 2));
		ctx.setLineDash([5 * k, 5 * k]);
		ctx.strokeStyle = c.ruleStrong;
		ctx.lineWidth = k;
		for (const x of [g.x0, g.x1]) {
			L.roundRect(ctx, x, g.ground, g.cardW, g.cardH, 8);
			ctx.stroke();
		}
		ctx.setLineDash([]);
		ctx.fillStyle = c.guide;
		for (let t = 0; t <= 1.95 + 1e-9; t += 0.05) {
			const p = this.pose(api, t);
			ctx.beginPath();
			ctx.arc(p.x + g.cardW / 2, p.y + g.cardH / 2, Math.max(2, 1.5 * k), 0, Math.PI * 2);
			ctx.fill();
		}
		const now = this.pose(api, api.t);
		L.roundRect(ctx, now.x, now.y, g.cardW, g.cardH, 8);
		ctx.fillStyle = c.tone2;
		ctx.fill();
		ctx.lineWidth = 2 * k;
		ctx.strokeStyle = c.focal;
		ctx.stroke();
		ctx.restore();
		const axisY = h - 34 * k;
		ctx.strokeStyle = c.line;
		ctx.lineWidth = k;
		ctx.beginPath();
		ctx.moveTo(g.x0, axisY);
		ctx.lineTo(w - 120, axisY);
		ctx.stroke();
		ctx.fillStyle = c.muted;
		ctx.font = `${12 * k}px ${c.mono}`;
		const stops = [[0, "lift"], [0.6, "throw"], [1.6, "land"], [1.95, "rest"]].map(([t, name]) => ({ t, name, x: L.lerp(g.x0, w - 120, t / 1.95) }));
		stops.forEach((stop, index) => {
			const full = `${stop.name} ${L.fixed(stop.t)}`;
			const room = (stops[index + 1]?.x ?? w) - 6 * k - (stop.x + 4 * k);
			ctx.fillRect(stop.x, axisY - 4 * k, k, 8 * k);
			ctx.fillText(ctx.measureText(full).width <= room ? full : stop.name, stop.x + 4 * k, axisY + 18 * k);
		});
		const head = L.lerp(g.x0, w - 120, api.t / 1.95);
		ctx.fillStyle = c.ink;
		ctx.fillRect(head - k, axisY - 8 * k, 2 * k, 16 * k);
	},
	readout(api) {
		const now = this.pose(api, api.t);
		return [["clock", `${self.vpkLab.fixed(api.t)} s`], ["eased", self.vpkLab.fixed(now.u)], ["x", `${Math.round(now.x)} px`]];
	},
}]);
