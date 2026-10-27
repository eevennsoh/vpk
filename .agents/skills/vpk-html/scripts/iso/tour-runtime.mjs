// iso/tour-runtime — the camera tour in the browser (illustrations.md § Camera tour; build side iso/tour.mjs). Import-free like
// runtime.mjs: iso/inline.mjs inlines it into the kit scope and runtime.mjs calls core.mountTour for a stage that carries
// data-vpk-iso-tour. Step 0 is the Overview: the emitted viewBox, no class, the static art (R9). Step k eases the SVG viewBox
// over TOUR_CAMERA_MS (iso/accent.mjs ENTRY.STEP_CAMERA_MS) on the discrete clock to frame that step's parts, keeping the
// viewBox's aspect so the svg box never changes size; its parts (and their owned arrows) take .is-tour, which the CSS paints in
// the accent while every other part, the focal one included, is neutral; the title restarts a grey-to-ink CSS fade
// (ENTRY.TITLE_FADE_MS) and the caption shows the step text. Reduced motion jumps in one tick with no fade. Printing writes the
// Overview and holds it; afterprint brings the step back. Motion runs only in vpkFrameLoop ticks (rule R14).

// The camera ease and the title fade (iso/accent.mjs ENTRY.STEP_CAMERA_MS, ENTRY.TITLE_FADE_MS; tour.test.mjs pins them equal).
export const TOUR_CAMERA_MS = 600;
export const TOUR_TITLE_MS = 400;
// The camera frames a step at most this many times closer than the Overview, so a screw or a key still shows its surroundings.
export const TOUR_MAX_ZOOM = 4;

// Pure tour core: `at` is the step (0 = Overview, 1..n the steps). Next and the forward arrows go on, Previous and the back
// arrows go back (no wrap), Home is the Overview, End the last step, Escape the Overview.
export function tourReducer(at, event, n) {
	let next = at;
	let handled = true;
	if (event.type === "go") next = at + event.by;
	else if (event.type === "key") {
		const key = event.key;
		if (key === "ArrowRight" || key === "ArrowDown" || key === "PageDown") next = at + 1;
		else if (key === "ArrowLeft" || key === "ArrowUp" || key === "PageUp") next = at - 1;
		else if (key === "Home" || key === "Escape") next = 0;
		else if (key === "End") next = n;
		else handled = false;
	} else handled = false;
	next = Math.min(n, Math.max(0, next));
	return { at: next, handled, changed: next !== at };
}

// The viewBox that frames `points` (viewBox units) with `pad` around them, at the Overview's aspect (vb = [x, y, w, h]), no
// closer than TOUR_MAX_ZOOM and kept inside the Overview where it fits. No points frames the Overview.
export function tourFrame(points, pad, vb) {
	if (!points.length) return vb.slice();
	const xs = points.map(p => p[0]);
	const ys = points.map(p => p[1]);
	let x0 = Math.min(...xs) - pad;
	let y0 = Math.min(...ys) - pad;
	let w = Math.max(...xs) + pad - x0;
	let h = Math.max(...ys) + pad - y0;
	const aspect = vb[2] / vb[3];
	const cx = x0 + w / 2;
	const cy = y0 + h / 2;
	if (w / h < aspect) w = h * aspect;
	else h = w / aspect;
	if (w < vb[2] / TOUR_MAX_ZOOM) {
		w = vb[2] / TOUR_MAX_ZOOM;
		h = w / aspect;
	}
	if (w >= vb[2]) return vb.slice();
	x0 = Math.min(vb[0] + vb[2] - w, Math.max(vb[0], cx - w / 2));
	y0 = Math.min(vb[1] + vb[3] - h, Math.max(vb[1], cy - h / 2));
	return [x0, y0, w, h];
}

// The DOM side. `x` carries what runtime.mjs mount() built: { win, loop, core, stage, root, svg, attr, find, setText, speak,
// now, fromReview, keys, clocks: { tween, tval, tdone } }. `keys` says whether the stage's own arrow keys tour (a figure with no
// behaviour; otherwise the behaviour owns them and the tour buttons take the keys). Returns the print pose and the stillness
// getter for the shared rest motion.
export function mountTour(x) {
	const { loop, core, stage, root, svg, attr, find, setText, speak, fromReview, keys, clocks: C } = x;
	const cfg = JSON.parse(attr(stage, "tour") || "null");
	if (!cfg || !Array.isArray(cfg.s) || !cfg.s.length) throw new Error("tour");
	const n = cfg.s.length;
	const vb0 = svg.getAttribute("viewBox");
	const home = vb0.trim().split(/[\s,]+/).map(Number);
	const title = find(root, "tour-title");
	const text = find(root, "tour-text");
	const count = find(root, "tour-count");
	const live = find(root, "live");
	const buttons = [...root.querySelectorAll("[data-vpk-iso-tour-go]")];
	const group = find(root, "tour-controls");
	// The parts a step names: a piece matches by its part id or the unit it belongs to (a tray half, a variant, a turned solid).
	const pieces = [...svg.querySelectorAll("[data-vpk-iso-part]")].map(el => ({ el, names: [attr(el, "part"), attr(el, "of")].filter(Boolean) }));
	const marked = new Set();
	const owned = [...svg.querySelectorAll("[data-vpk-iso-arrow-for]")];
	const st = { at: 0, shown: -1, box: home.slice(), from: home.slice(), to: home.slice(), cam: C.tween(1, TOUR_CAMERA_MS), fade: 0, liveText: null };
	let board = null;
	let still = false;
	const wake = () => board && board.wake();
	const offset = el => {
		const m = /translate\(\s*([-\d.e]+)[\s,]+([-\d.e]+)\s*\)/.exec(el.getAttribute("transform") || "");
		return m ? [Number(m[1]), Number(m[2])] : [0, 0];
	};
	// A step's frame: the silhouettes of its shown pieces where they are drawn now (a teardown part off its exploded pose, a moved state).
	const frameOf = k => {
		if (!k) return home.slice();
		const want = new Set(cfg.s[k - 1].p);
		const points = [];
		for (const p of pieces) {
			if (!p.names.some(name => want.has(name)) || p.el.hasAttribute("display")) continue;
			const [dx, dy] = offset(p.el);
			for (const [px, py] of core.partPoly(p.el)) points.push([px + dx, py + dy]);
		}
		return tourFrame(points, cfg.s[k - 1].d, home);
	};
	const mark = (el, on) => {
		if (on === marked.has(el)) return;
		if (on) {
			marked.add(el);
			el.classList.add("is-tour");
			return;
		}
		marked.delete(el);
		el.classList.remove("is-tour");
		if (!el.classList.length) el.removeAttribute("class");
	};
	// Accent the step's pieces and their owned arrows (step 0: none), and mark the stage while a step shows (runtime-css hides the
	// labels and turns the focal part neutral then).
	const paint = k => {
		const want = new Set(k ? cfg.s[k - 1].p : []);
		for (const p of pieces) mark(p.el, p.names.some(name => want.has(name)));
		for (const el of owned) mark(el, want.has(attr(el, "arrow-for")));
		if (k) stage.setAttribute("data-vpk-iso-touring", "");
		else stage.removeAttribute("data-vpk-iso-touring");
	};
	const writeBox = box => {
		const r = v => Math.round(v * 10) / 10;
		const same = box.every((v, i) => Math.abs(v - home[i]) < 0.05);
		const value = same ? vb0 : box.map(r).join(" ");
		if (svg.getAttribute("viewBox") !== value) svg.setAttribute("viewBox", value);
	};
	// The caption, counter and buttons for step k; the title restarts its fade (two keyframe names, so no reflow is needed).
	const caption = (k, reduced) => {
		const s = k ? cfg.s[k - 1] : null;
		if (title) {
			setText(title, s ? s.t : "Overview");
			st.fade = reduced ? 0 : st.fade === 1 ? 2 : 1;
			if (st.fade) title.setAttribute("data-vpk-iso-tour-fade", String(st.fade));
			else title.removeAttribute("data-vpk-iso-tour-fade");
		}
		if (text) setText(text, s ? s.x : cfg.o);
		if (count) setText(count, `${k} / ${n}`);
		for (const b of buttons) {
			const by = Number(b.getAttribute("data-vpk-iso-tour-go"));
			b.setAttribute("aria-disabled", String(k + by < 0 || k + by > n));
		}
	};
	const go = event => {
		const next = tourReducer(st.at, event, n);
		if (!next.handled) return next;
		if (next.changed) {
			st.at = next.at;
			const s = next.at ? cfg.s[next.at - 1] : null;
			st.liveText = s ? `Step ${next.at} of ${n}: ${s.t}. ${s.x}` : `Overview. ${cfg.o}`;
			wake();
		}
		return next;
	};
	for (const b of buttons) b.addEventListener("click", e => {
		if (fromReview(e)) return;
		go({ type: "go", by: Number(b.getAttribute("data-vpk-iso-tour-go")) });
	});
	const onKey = e => {
		if (fromReview(e) || e.altKey || e.ctrlKey || e.metaKey) return;
		if (go({ type: "key", key: e.key }).handled) {
			e.preventDefault();
			e.stopPropagation();
		}
	};
	if (group) group.addEventListener("keydown", onKey);
	if (keys) stage.addEventListener("keydown", onKey);

	function tick(dt, t, calm) {
		if (still) return false;
		const reduced = calm === undefined ? loop.reducedMotion() : calm;
		if (st.at !== st.shown) {
			st.shown = st.at;
			st.from = st.box.slice();
			st.to = frameOf(st.at);
			st.cam = { from: 0, to: 1, t0: t, dur: TOUR_CAMERA_MS };
			paint(st.at);
			caption(st.at, reduced);
		}
		const f = C.tval(st.cam, t, reduced);
		st.box = st.from.map((v, i) => v + (st.to[i] - v) * f);
		writeBox(st.box);
		if (live && st.liveText !== null) {
			speak(live, st.liveText);
			st.liveText = null;
		}
		return !C.tdone(st.cam, t, reduced);
	}

	// Print pose: the Overview (the static art) at once, held; leaving print re-applies the step from its clock.
	const pose = on => {
		still = on;
		if (!on) {
			st.shown = -1;
			st.box = home.slice();
			return wake();
		}
		paint(0);
		writeBox(home);
	};
	// The emitter writes the Overview's caption, counter and button states, so mounting writes nothing (R9).
	board = loop.register(stage, tick, { rest: () => pose(true) });
	return { pose, still: () => still };
}
