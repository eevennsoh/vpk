// iso/runtime — import-free browser runtime for interactive iso-kit figures (ws3 §4.8, C-iso-4).
// iso/inline.mjs inlines this file by text after runtime/frame-loop.mjs and iso/core.mjs, with `export ` stripped and
// full-line comments dropped: no imports, no module state, comments only on their own lines. Core helpers arrive through
// createIsoRuntime's `core` argument, so this module also runs under node:test without the inlined scope.
// Ported from hairline packages/hairline/src/core/motion.ts (MIT © 2026 Lucas Marques; NOTICE.md). Every clock takes an
// explicit `reduced` argument, read from window.vpkFrameLoop (integration K4) at call time. Behaviour follows hairline
// rules 01 (hit tests use rest silhouettes), 02 (neighbours stagger by distance), 04 (discrete choice = 700 ms tween,
// continuous input = spring), 07 (loops sleep) and 08 (the active state is a stroke only). Explode figures open to the full
// gap while the pointer is over them and close on leave (a tap toggles on touch); pointer distance plays no part.

// The continuous clock: one spring per moving number (k 100, c 18, m 1, eps 0.01).
export function spring(x, o = {}) {
	return { x, v: 0, t: x, k: o.k ?? 100, c: o.c ?? 18, m: o.m ?? 1, eps: o.eps ?? 0.01 };
}

// Advances by dt seconds, sub-stepped at 240 Hz; returns whether it is still moving.
export function stepS(sp, dt, reduced = false) {
	if (reduced) {
		sp.x = sp.t;
		sp.v = 0;
		return false;
	}
	const n = Math.max(1, Math.ceil(dt * 240));
	const h = dt / n;
	for (let i = 0; i < n; i++) {
		const a = (-sp.k * (sp.x - sp.t) - sp.c * sp.v) / sp.m;
		sp.v += a * h;
		sp.x += sp.v * h;
	}
	if (Math.abs(sp.x - sp.t) < sp.eps && Math.abs(sp.v) < sp.eps * 10) {
		sp.x = sp.t;
		sp.v = 0;
		return false;
	}
	return true;
}

// A CSS cubic-bezier as a function of progress. Same curve as hairline's bezier(); solved by
// bisection only (30 steps, |error| < 1e-9), which is smaller than hairline's Newton-then-bisect.
export function bezier(x1, y1, x2, y2) {
	const at = (a, b, u) => 3 * a * u * (1 - u) * (1 - u) + 3 * b * u * u * (1 - u) + u * u * u;
	return t => {
		if (t <= 0) return 0;
		if (t >= 1) return 1;
		let lo = 0;
		let hi = 1;
		for (let i = 0; i < 30; i++) {
			const u = (lo + hi) / 2;
			if (at(x1, x2, u) < t) lo = u;
			else hi = u;
		}
		return at(y1, y2, (lo + hi) / 2);
	};
}

export const EASE_LIFT = bezier(0.32, 0.72, 0, 1);

// The discrete clock: a 700 ms tween on EASE_LIFT; tset retargets from where it is after `delay`.
export const tween = (v, dur = 700) => ({ from: v, to: v, t0: -1e9, dur });
// Hover selection is quicker than other discrete moves: a slow lift and a neighbour stagger made fast pointer sweeps feel laggy.
export const SELECT_MS = 180;

export const tval = (tw, now, reduced = false) => tw.from + (tw.to - tw.from) * (reduced ? 1 : EASE_LIFT(Math.min(1, Math.max(0, (now - tw.t0) / tw.dur))));

export function tset(tw, to, now, delay = 0, reduced = false) {
	if (tw.to === to) return;
	tw.from = tval(tw, now, reduced);
	tw.to = to;
	tw.t0 = now + delay;
}

export const tdone = (tw, now, reduced = false) => reduced || now >= tw.t0 + tw.dur;

// Neighbour stagger (rule 02): |rank − reference rank| × 10 ms.
export const selectDelay = (rank, ref) => (ref === null || ref === undefined ? 0 : Math.abs(rank - ref) * 10);

// Pure select core. Units are logical parts in painter order (tray halves share one unit).
export function selectReducer(state, event) {
	const count = state.count;
	let active = state.active;
	let handled = true;
	if (event.type === "hover") active = event.unit >= 0 ? event.unit : null;
	else if (event.type === "leave") active = null;
	else if (event.type === "key") {
		const key = event.key;
		if (key === "ArrowRight" || key === "ArrowDown") active = active === null ? 0 : Math.min(count - 1, active + 1);
		else if (key === "ArrowLeft" || key === "ArrowUp") active = active === null ? count - 1 : Math.max(0, active - 1);
		else if (key === "Home") active = 0;
		else if (key === "End") active = count - 1;
		else if (key === "Escape" && active !== null) active = null;
		else handled = false;
	} else handled = false;
	return { count, active, last: active ?? state.active ?? state.last ?? null, handled, changed: active !== state.active };
}

// Pure explode core: `committed` is the slider value, `preview` the full gap while the figure is open or null. Hover opens
// it, leave closes it, a touch tap toggles it; the pointer never writes the slider.
export function explodeReducer(state, event, cfg) {
	const next = { ...state, live: null };
	if (event.type === "hover") next.preview = cfg.max;
	else if (event.type === "toggle") next.preview = state.preview === null ? cfg.max : null;
	else if (event.type === "leave") next.preview = null;
	else if (event.type === "input" || event.type === "change") {
		next.committed = event.value;
		next.preview = null;
		if (event.type === "change") next.live = `${cfg.unit} ${event.value.toFixed(2)}`;
	}
	return next;
}

export const explodeTarget = state => state.preview ?? state.committed;

// Motion at rest resumes this long after the last input (iso/accent.mjs REST_MOTION.IDLE_RESUME_MS; runtime.test.mjs pins the
// two equal: this file is import-free so the inliner can read it). restMs reads a SMIL dur ("1800ms", "2s") in ms.
export const REST_IDLE_MS = 3000;
// How long the live region holds a spoken commit before it empties (createIsoRuntime speak).
export const LIVE_CLEAR_MS = 1500;
export const restMs = dur => (parseFloat(dur) || 0) * (/ms\s*$/.test(dur) ? 1 : /s\s*$/.test(dur) ? 1000 : 0);

// Deck fit share (CSS px). `flow` is how far the slide's in-flow content runs past the room on the
// slide, `plate` how far the lowest iso plate does; the iso SVGs on the slide split the overflow
// equally. The whole flow is fitted when every SVG keeps at least half its unfitted height
// (labels stay legible); otherwise only the plates are, and content after them is the author's.
// No SVG goes below half; null where nothing has to give (no write).
export function slideFit(flow, plate, heights) {
	const share = over => over / heights.length;
	const over = heights.every(h => h - share(flow) >= h / 2) ? flow : plate;
	return heights.map(h => (over > 0.5 ? Math.floor(Math.max(h - share(over), h / 2) * 10) / 10 : null));
}

export function createIsoRuntime(win, loop, core) {
	const doc = win.document;
	const seen = new WeakSet();
	const now = () => (win.performance ? win.performance.now() : Date.now());
	const r1 = v => Math.round(v * 10) / 10;
	const fromReview = e => (e.composedPath ? e.composedPath() : []).some(n => n && n.hasAttribute && n.hasAttribute("data-vpk-review-ui"));
	const restore = el => {
		el.classList.remove("is-active");
		if (!el.classList.length) el.removeAttribute("class");
	};
	// Text updates edit the existing text node (a characterData change), not textContent (a
	// childList change): the shared enhancer observes childList and attributes only, so per-frame
	// readout updates inside the opt-out root never schedule enhancer work (K5, check 6).
	const setText = (el, text) => {
		const node = el.firstChild;
		if (node && node.nodeType === 3 && el.childNodes.length === 1) node.data = text;
		else el.textContent = text;
	};
	// The live region speaks a commit, then empties LIVE_CLEAR_MS later: left filled, the figure's text (browse mode, copy, the
	// accessible description) held the visible readout twice. Emptying is silent; a new commit restarts the clock.
	const liveTimers = new WeakMap();
	const speak = (el, text) => {
		win.clearTimeout(liveTimers.get(el));
		setText(el, text);
		liveTimers.set(el, win.setTimeout(() => setText(el, ""), LIVE_CLEAR_MS));
	};

	// data-vpk-iso-* attribute and role-selector helpers (they keep the inlined block small).
	const attr = (el, name) => el.getAttribute(`data-vpk-iso-${name}`);
	const find = (el, name) => el.querySelector(`[data-vpk-iso-${name}]`);
	const role = name => `[data-vpk-iso-role="${name}"]`;
	const line = (el, pts, pairs, movers) => ({ el, d0: el.getAttribute("d"), d: el.getAttribute("d"), pts, pairs, movers });

	// A grown part (data-vpk-iso-grow, the brief's liftMode "grow") rises like a bar extending: its base stays where it stands and
	// only its top moves. The build checked that the taller solid is the rest solid with its top-face points moved by the lift, so
	// each face path keeps its base points and moves the points it shares with the top face; anything else in the part (its marks,
	// received shadows, tags) sits on the top and moves whole. Returns null when the part has no top face (it then translates).
	const PAIR = /(-?[\d.]+) (-?[\d.]+)/g;
	function growOf(el) {
		const top = el.querySelector(role("top"));
		if (!top) return null;
		const keys = new Set(top.getAttribute("d").match(PAIR));
		return [...el.children].map(child => (/^(fill|shade|top|crease|edge)$/.test(attr(child, "role")) ? { el: child, d: child.getAttribute("d"), keys } : { el: child }));
	}
	function grow(p, value) {
		for (const item of p.grow) {
			if (!item.d) {
				if (value) item.el.setAttribute("transform", value);
				else item.el.removeAttribute("transform");
				continue;
			}
			item.el.setAttribute("d", value ? item.d.replace(PAIR, (pair, x, y) => (item.keys.has(pair) ? `${r1(+x + p.dx)} ${r1(+y + p.dy)}` : pair)) : item.d);
		}
	}

	function mount(stage) {
		let labelsFor = [];
		const root = stage.closest("[data-vpk-engine]") || stage;
		const svg = find(stage, "id");
		const behavior = attr(stage, "behavior");
		const viewBox = () => (svg.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
		const vb0 = svg ? viewBox() : [];
		if (!svg || vb0.length !== 4 || !vb0.every(Number.isFinite) || !["select", "explode", "teardown", "step", "scrub", "tour"].includes(behavior)) throw new Error("stage");
		// Teardown (illustrations.md § Teardown): the explode spring drives the parts (Spread slider, Exploded / Assembled buttons)
		// and the pointer or arrow keys name a part, as select does, without lifting it.
		const teardown = behavior === "teardown";
		let rect = null;
		const measure = () => (rect = rect || svg.getBoundingClientRect());
		const invalidate = () => {
			rect = null;
		};
		win.addEventListener("scroll", invalidate, { passive: true, capture: true });
		if (win.ResizeObserver) new win.ResizeObserver(invalidate).observe(stage);
		stage.addEventListener("pointerenter", invalidate);
		// The viewBox is read per call: a camera tour (tour-runtime.mjs) eases it, and hover must hit what is drawn there now.
		const toView = (cx, cy) => {
			const r = measure();
			const vb = viewBox();
			const s = Math.min(r.width / vb[2], r.height / vb[3]) || 1;
			return [(cx - r.left - (r.width - vb[2] * s) / 2) / s + vb[0], (cy - r.top - (r.height - vb[3] * s) / 2) / s + vb[1]];
		};
		// A camera tour (tour-runtime.mjs, data-vpk-iso-tour) rides on any behaviour as its own board; a figure with a tour and no
		// other behaviour (behavior "tour") gives the tour the stage's arrow keys too.
		const tour = stage.hasAttribute("data-vpk-iso-tour") ? core.mountTour({ win, loop, core, stage, root, svg, attr, find, setText, speak, now, fromReview, keys: behavior === "tour", clocks: { tween, tval, tdone } }) : null;
		if (tour) poses.push(tour.pose);
		if (behavior === "tour") {
			if (!tour) throw new Error("tour");
			return restMotion(stage, root, svg, tour.still);
		}
		// Step and scrub figures (state-runtime.mjs): states, variants and per-state painter order.
		if (behavior === "step" || behavior === "scrub") {
			const states = core.mountStates({ win, loop, core, stage, root, svg, attr, find, role, setText, speak, restore, now, fromReview, line, measure, toView, clocks: { tween, tset, tval, tdone, spring, stepS } });
			poses.push(on => {
				states.pose(on);
				rests.forEach(fn => fn());
			});
			const enhancer = doc.querySelector("script[data-vpkh-enhance]");
			if (enhancer && !enhancer.textContent.includes("vpkh-no-lightbox")) stage.addEventListener("click", e => e.stopPropagation());
			return restMotion(stage, root, svg, states.still);
		}
		const zd = Number(attr(svg, "zdepth")) || 0;
		const liftZ = Number(attr(svg, "lift-z")) || 0;
		// The select blink and the narrow tag leaders live in manual-runtime.mjs (core.blink, core.tagLines).
		const blinks = svg.hasAttribute("data-vpk-iso-blink");
		const readout = find(root, "readout");
		const live = find(root, "live");
		const control = find(root, "control");
		const vecKey = behavior === "select" ? "lift" : "explode";
		const units = [];
		const unitOf = new Map();
		const parts = [...svg.querySelectorAll("[data-vpk-iso-part]")].map((el, i) => {
			const id = attr(el, "part");
			const name = attr(el, "of") || id;
			// Each piece hits by its own hull (a bent tube's chunks, a tray's back and front), never the hull of its whole unit; a
			// straight wire's degenerate hull is padded; a concave prism hits by its convex solids (core.partPoly).
			const poly = core.partPoly(el);
			const plan = (attr(el, "plan") || "").split(";").map(box => box.trim().split(/\s+/).map(Number)).filter(box => box.length === 4 && box.every(Number.isFinite));
			const base = { el, i, id, name, poly, plan, depth: Number(attr(el, "depth")) || 0, depth0: Number(attr(el, "depth0")) || 0, group: el.parentNode, tw: tween(0, SELECT_MS), lv: 0, k: 0, dx: 0, dy: 0, tf: null, on: false };
			// A fixed part (data-vpk-iso-fixed) is scenery: it never moves and is no keyboard stop (unit -1). It still hits in painter
			// order by each of its faces, so drawn in front (a tray's near wall) it stops the pointer reaching the part behind it.
			if (el.hasAttribute("data-vpk-iso-fixed")) {
				poly.solids ??= [...el.querySelectorAll(role("fill"))].map(f => core.hull(core.parsePolyPath(f.getAttribute("d")) || [])).filter(q => q.length >= 3);
				return { ...base, unit: -1, vec: [0, 0] };
			}
			const vec = core.parseVec(attr(el, vecKey));
			if (!vec) throw new Error("vector");
			if (!unitOf.has(name)) {
				unitOf.set(name, units.length);
				units.push({ name, label: attr(el, "label") || name });
			}
			return { ...base, unit: unitOf.get(name), vec, grow: el.hasAttribute("data-vpk-iso-grow") && growOf(el) };
		});
		if (!units.length || parts.some(p => p.poly.length < 3)) throw new Error("polygon");
		const polys = parts.map(p => p.poly);
		const byId = new Map(parts.map(p => [p.id, p]));
		// Cast shadows stay on the ground: each moves by its cast vector times its part's motion (k: the lift, or the Gap offset).
		// A received shadow (on a part's top) rides in its receiver's group, so it moves by its caster's cast less the receiver's (cast-on).
		const shadows = [...svg.querySelectorAll(role("shadow"))].map(el => {
			const on = el.closest("[data-vpk-iso-part]");
			const cast = el.closest("[data-vpk-iso-cast]");
			return { el, vec: cast && core.parseVec(attr(cast, "cast")), less: core.parseVec(attr(el, "cast-on")), on: on && parts.find(p => p.el === on), of: parts.find(p => p.name === attr(el, "shadow-for")) };
		}).filter(s => s.vec && s.of);
		const lines = [];
		for (const el of svg.querySelectorAll(role("guide"))) {
			const pts = core.parsePolyPath(el.getAttribute("d"));
			// A guide names its parts by id; a tray is drawn as <id>:back and <id>:front, so an id falls back to the unit name.
			const end = name => byId.get(name) || parts.find(p => p.name === name);
			const from = end(attr(el, "from"));
			const to = end(attr(el, "to"));
			if (pts && from && to) lines.push(line(el, pts, true, pts.map((_, k) => (k % 2 ? to : from))));
		}
		for (const g of svg.querySelectorAll("[data-vpk-iso-label-for]")) {
			const el = g.querySelector(role("leader"));
			const name = attr(g, "label-for");
			const target = parts.find(p => p.id === name || p.name === name);
			const pts = el && core.parsePolyPath(el.getAttribute("d"));
			if (pts && target) lines.push(line(el, pts, false, pts.map((_, k) => (k === pts.length - 1 ? target : null))));
		}
		if (svg.querySelector("[data-vpk-iso-tag-for]")) lines.push(...core.tagLines(core.parsePolyPath, svg, parts, line));
		const groups = new Map();
		for (const p of parts) {
			if (!groups.has(p.group)) groups.set(p.group, []);
			groups.get(p.group).push(p);
		}
		// Footprints that overlap in plan (data-vpk-iso-plan; a part without one overlaps nothing): only such a pair can trade places
		// when one lifts.
		const overlap = (a, b) => a.plan.some(p => b.plan.some(q => p[0] < q[2] && q[0] < p[2] && p[1] < q[3] && q[1] < p[3]));
		for (const list of groups.values()) {
			list.order = list.slice();
			list.tail = list[list.length - 1].el.nextElementSibling;
			list.over = list.map(a => list.map(b => a !== b && overlap(a, b)));
		}

		const cfg = (behavior === "explode" || teardown) && control
			? { rest: Number(control.defaultValue || control.value), min: Number(control.min), max: Number(control.max), unit: teardown ? "spread" : (readout && readout.textContent.trim().split(" ")[0]) || "gap" }
			: null;
		if ((behavior === "explode" || teardown) && !cfg) throw new Error("control");
		if (teardown && control.hasAttribute("data-vpk-iso-start")) control.value = control.getAttribute("data-vpk-iso-start");
		const poseButtons = teardown ? [...root.querySelectorAll("[data-vpk-iso-pose]")] : [];
		const poseText = value => (value >= cfg.max - 1e-6 ? "exploded" : value <= cfg.min + 1e-6 ? "assembled" : `spread ${value.toFixed(2)}`);
		if (teardown) control.setAttribute("aria-valuetext", poseText(Number(control.value)));
		const restText = readout ? attr(readout, "rest") || readout.textContent : "";
		const st = { sel: { count: units.length, active: null, last: null }, ex: cfg ? { committed: Number(control.value), preview: null } : null, gap: spring(cfg ? Number(control.value) : 0), text: readout ? readout.textContent : "", said: null, liveText: null, leaveAt: null, apart: true, closed: false };
		let board = null;
		const wake = () => board && board.wake();

		const select = (next, t) => {
			st.sel = next;
			const ref = next.active === null ? next.last : next.active;
			const reduced = loop.reducedMotion();
			for (const p of parts) tset(p.tw, p.unit === next.active ? 1 : 0, t, p.unit === next.active ? 0 : selectDelay(p.unit, ref), reduced);
			if (next.changed && next.active !== null) st.liveText = units[next.active].label;
			wake();
		};
		const leave = (t, touch) => {
			// A touch "leave" follows every tap; the open/closed state belongs to the next tap, not to it.
			if (teardown) {
				if (touch) st.leaveAt = t + 1400;
				else select(selectReducer(st.sel, { type: "leave" }), t);
			} else if (cfg) {
				if (!touch) st.ex = explodeReducer(st.ex, { type: "leave" }, cfg);
			} else if (touch) st.leaveAt = t + 1400;
			else select(selectReducer(st.sel, { type: "leave" }), t);
			wake();
		};

		// A teardown part's hit polygon is drawn at the exploded pose; off it the part has moved by (dx, dy) and, past half way, the
		// parts paint in the assembled order. So hit the parts in their current paint order, each at its current offset.
		const byEl = new Map(parts.map(p => [p.el, p]));
		const teardownHit = pt => {
			const drawn = [...svg.querySelectorAll("[data-vpk-iso-part]")].map(el => byEl.get(el)).filter(Boolean);
			for (let k = drawn.length - 1; k >= 0; k--) {
				const p = drawn[k];
				if (core.topmostHit([p.poly], [pt[0] - p.dx, pt[1] - p.dy]) === 0) return p.unit;
			}
			return -1;
		};
		const move = e => {
			if (fromReview(e)) return;
			if (cfg && !teardown) {
				st.ex = explodeReducer(st.ex, { type: e.pointerType === "mouse" ? "hover" : "toggle" }, cfg);
				wake();
				return;
			}
			st.leaveAt = null;
			const pt = toView(e.clientX, e.clientY);
			const hit = teardown ? teardownHit(pt) : (top => (top < 0 ? -1 : parts[top].unit))(core.topmostHit(polys, pt));
			if ((hit < 0 ? null : hit) !== st.sel.active) select(selectReducer(st.sel, { type: "hover", unit: hit }), now());
		};
		// A finger or pen tap sends no pointermove, so non-mouse pointerdown hit-tests like a move
		// (hairline kernel `pointer().down`). On a select figure the touch leave holds the result for 1400 ms; on an explode
		// figure each tap toggles the full gap and the touch leave changes nothing.
		stage.addEventListener("pointerdown", e => {
			invalidate();
			if (e.pointerType !== "mouse") move(e);
		});
		stage.addEventListener("pointermove", e => {
			if (!cfg || teardown || e.pointerType === "mouse") move(e);
		});
		stage.addEventListener("pointerleave", e => leave(now(), e.pointerType === "touch"));
		stage.addEventListener("pointercancel", e => leave(now(), e.pointerType === "touch"));
		if (cfg) {
			control.addEventListener("input", () => {
				st.ex = explodeReducer(st.ex, { type: "input", value: Number(control.value) }, cfg);
				wake();
			});
			control.addEventListener("change", () => {
				st.ex = explodeReducer(st.ex, { type: "change", value: Number(control.value) }, cfg);
				st.liveText = teardown ? poseText(st.ex.committed) : st.ex.live;
				if (teardown) control.setAttribute("aria-valuetext", poseText(st.ex.committed));
				wake();
			});
			// Exploded / Assembled: each button sets the slider to its pose and commits it, so the slider stays the one source of truth.
			for (const button of poseButtons) button.addEventListener("click", () => {
				control.value = button.getAttribute("data-vpk-iso-pose");
				control.dispatchEvent(new win.Event("input", { bubbles: true }));
				control.dispatchEvent(new win.Event("change", { bubbles: true }));
			});
		}
		if (teardown || !cfg) {
			stage.addEventListener("keydown", e => {
				if (fromReview(e) || e.altKey || e.ctrlKey || e.metaKey) return;
				const next = selectReducer(st.sel, { type: "key", key: e.key });
				if (!next.handled) return;
				e.preventDefault();
				e.stopPropagation();
				select(next, now());
			});
		}
		const enhancer = doc.querySelector("script[data-vpkh-enhance]");
		if (enhancer && !enhancer.textContent.includes("vpkh-no-lightbox")) stage.addEventListener("click", e => e.stopPropagation());

		// Depth re-sort within a motion group (select lift); at rest the order is painter order again. A lift is straight up, so it
		// reorders only pairs whose plans overlap (one stands over the other); every other pair keeps painter order, and a card that
		// rises behind a nearer card stays behind it. The pairwise rule is a partial order: placed by a topological pass that takes
		// the earliest ready part in painter order (and breaks a cycle the same way).
		function resort() {
			const key = p => p.depth + p.lv * liftZ * zd;
			for (const [g, list] of groups) {
				const n = list.length;
				if (n < 2) continue;
				const next = list.map(() => []);
				const deg = list.map(() => 0);
				for (let a = 0; a < n; a++) {
					for (let b = a + 1; b < n; b++) {
						const [u, v] = list.over[a][b] && key(list[b]) < key(list[a]) ? [b, a] : [a, b];
						next[u].push(v);
						deg[v]++;
					}
				}
				const placed = list.map(() => false);
				const order = [];
				while (order.length < n) {
					let k = deg.findIndex((d, j) => !placed[j] && d <= 0);
					if (k < 0) k = placed.indexOf(false);
					placed[k] = true;
					order.push(list[k]);
					for (const v of next[k]) deg[v]--;
				}
				if (order.every((p, k) => p === list.order[k])) continue;
				list.order = order;
				for (const p of order) g.insertBefore(p.el, list.tail);
			}
		}

		// One translate per moved element (a part, or a shadow on the ground), written only when it changes; none at rest. A grown
		// part (p.grow) is not translated: its face paths keep their base points and move their top-face points (grow()).
		const place = (o, x, y) => {
			const value = Math.abs(x) >= 0.05 || Math.abs(y) >= 0.05 ? `translate(${r1(x)} ${r1(y)})` : null;
			if (value === o.tf) return;
			o.tf = value;
			if (o.grow) return grow(o, value);
			if (value) o.el.setAttribute("transform", value);
			else o.el.removeAttribute("transform");
		};

		function write() {
			for (const p of parts) {
				if (blinks) core.blink(p);
				place(p, p.dx, p.dy);
			}
			for (const s of shadows) {
				const k = s.less && s.on ? s.on.k : 0;
				place(s, s.vec[0] * s.of.k - (s.less ? s.less[0] * k : 0), s.vec[1] * s.of.k - (s.less ? s.less[1] * k : 0));
			}
			for (const line of lines) {
				const moved = line.movers.some(m => m && m.tf);
				const d = moved
					? line.pts.map(([x, y], k) => {
						const m = line.movers[k] && line.movers[k].tf ? line.movers[k] : null;
						return `${line.pairs ? (k % 2 ? "L" : "M") : k ? "L" : "M"}${r1(x + (m ? m.dx : 0))} ${r1(y + (m ? m.dy : 0))}`;
					}).join("")
					: line.d0;
				if (d === line.d) continue;
				line.d = d;
				line.el.setAttribute("d", d);
			}
			if (liftZ && zd) resort();
		}

		// Print pose. The print CSS forces part transforms to none, but guide and leader `d`, the
		// active class and the lift order are runtime writes it cannot reach, so printing writes one
		// rest frame synchronously (beforeprint arrives as the frame loop's `rest`; a print media
		// change, as emulation sends, through `poses`) and holds it: tick writes nothing meanwhile.
		// Leaving print wakes the board, and the next tick writes the interactive state back from
		// the clocks, which printing never touches. Idempotent both ways.
		let still = false;
		const pose = on => {
			still = on;
			rests.forEach(fn => fn());
			if (!on) return wake();
			for (const p of parts) {
				p.dx = p.dy = p.lv = p.k = 0;
				p.on = false;
				for (const el of [p.el, ...labelsFor[p.i]]) restore(el);
			}
			// Teardown prints the static (exploded) art: its painter order and its labels, whatever the spread on screen. The next
			// tick after printing re-derives both from the spread.
			if (teardown) {
				for (const [g, list] of groups) if (list.orig) for (const node of list.orig) g.appendChild(node);
				st.closed = false;
				st.apart = true;
				svg.classList.remove("vpk-iso-assembling");
				if (!svg.classList.length) svg.removeAttribute("class");
			}
			write();
		};
		poses.push(pose);

		function tick(dt, t, calm) {
			if (still) return false;
			const reduced = calm === undefined ? loop.reducedMotion() : calm;
			let busy = false;
			let text;
			if (cfg) {
				st.gap.t = explodeTarget(st.ex);
				busy = stepS(st.gap, dt, reduced);
				for (const p of parts) {
					p.k = st.gap.x - cfg.rest;
					p.dx = p.vec[0] * p.k;
					p.dy = p.vec[1] * p.k;
				}
				text = `${cfg.unit} ${st.gap.x.toFixed(2)}`;
				if (teardown) {
					if (st.leaveAt !== null && t >= st.leaveAt) {
						st.leaveAt = null;
						select(selectReducer(st.sel, { type: "leave" }), t);
					}
					busy = busy || st.leaveAt !== null;
					for (const p of parts) {
						// The select tween drives only the blink here; the part does not lift (it moves with the spread).
						p.lv = tval(p.tw, t, reduced);
						busy = busy || !tdone(p.tw, t, reduced);
						const on = p.unit === st.sel.active;
						if (on === p.on) continue;
						p.on = on;
						for (const el of [p.el, ...labelsFor[p.i]]) {
							if (on) el.classList.add("is-active");
							else restore(el);
						}
					}
					const settled = Math.abs(st.gap.x - st.gap.t) < 0.005 ? st.gap.t : st.gap.x;
					// Labels belong to the exploded drawing: hidden while the parts are out of that pose (runtime-css).
					const apart = settled >= cfg.max - 1e-6;
					// Past half way the parts are drawn in the assembled pose's painter order (data-vpk-iso-depth0), else in the exploded one.
					const closed = st.gap.x < (cfg.min + cfg.max) / 2;
					if (closed !== st.closed) {
						st.closed = closed;
						for (const [g, list] of groups) {
							// Reopening restores the group's exact original children (guides sit between parts), so the rest art returns byte for byte.
							list.orig ??= [...g.childNodes];
							if (!closed) {
								for (const node of list.orig) g.appendChild(node);
								continue;
							}
							const order = list.slice().sort((a, b) => a.depth0 - b.depth0 || a.i - b.i);
							for (const p of order) g.insertBefore(p.el, list.tail);
						}
					}
					if (apart !== st.apart) {
						st.apart = apart;
						svg.classList.toggle("vpk-iso-assembling", !apart);
						if (!svg.classList.length) svg.removeAttribute("class");
					}
					text = st.sel.active === null ? poseText(settled) : units[st.sel.active].label;
					for (const button of poseButtons) button.setAttribute("aria-pressed", String(Math.abs(Number(button.getAttribute("data-vpk-iso-pose")) - st.ex.committed) < 1e-6));
				}
			} else {
				if (st.leaveAt !== null && t >= st.leaveAt) {
					st.leaveAt = null;
					select(selectReducer(st.sel, { type: "leave" }), t);
				}
				busy = st.leaveAt !== null;
				for (const p of parts) {
					p.lv = p.k = tval(p.tw, t, reduced);
					p.dx = p.vec[0] * p.lv;
					p.dy = p.vec[1] * p.lv;
					busy = busy || !tdone(p.tw, t, reduced);
					const on = p.unit === st.sel.active;
					if (on === p.on) continue;
					p.on = on;
					for (const el of [p.el, ...labelsFor[p.i]]) {
						if (on) el.classList.add("is-active");
						else restore(el);
					}
				}
				text = st.sel.active === null ? restText : units[st.sel.active].label;
			}
			write();
			if (readout && text !== st.text) {
				st.text = text;
				setText(readout, text);
			}
			if (live && st.liveText !== null) {
				if (st.liveText !== st.said) speak(live, st.liveText);
				st.said = st.liveText;
				st.liveText = null;
			}
			return busy;
		}

		labelsFor = parts.map(p => [...svg.querySelectorAll("[data-vpk-iso-label-for], [data-vpk-iso-arrow-for]")].filter(g => [p.id, p.name].includes(attr(g, "label-for") || attr(g, "arrow-for"))));
		board = loop.register(stage, tick, { rest: () => pose(true) });
		// A teardown that starts assembled (data-vpk-iso-start below the slider's rest) must close on mount: the static art is the
		// exploded drawing, and nothing else wakes the board before the first input.
		if (teardown && Math.abs(st.gap.x - cfg.rest) > 1e-6) wake();
		restMotion(stage, root, svg, () => still);
	}

	// Motion at rest (iso/accent.mjs REST_MOTION; the keyframes are runtime-css): data-vpk-iso-rest on the stage (not the
	// svg, whose outerHTML stays the static art, R9) once the figure has been idle IDLE_RESUME_MS after its entrance (SMIL)
	// or the last input, while it is on screen, the tab is shown, motion is not reduced and it is not printing (the 3D
	// prototype starts its sway the same idle delay after its entry). No frame callback: the CSS animates. Every behaviour
	// shares it; `still()` says whether the figure is holding its print pose.
	function restMotion(stage, root, svg, still) {
		let idleAt = now() + REST_IDLE_MS + Math.max(0, ...[...svg.querySelectorAll("[dur]")].map(a => restMs(a.getAttribute("dur"))));
		let shown = !win.IntersectionObserver;
		let timer = 0;
		const rest = () => {
			win.clearTimeout(timer);
			const wait = idleAt - now();
			if (wait > 0) timer = win.setTimeout(rest, wait + 20);
			const allowed = shown && !still() && !doc.hidden && !loop.reducedMotion();
			// Input pauses the drift where it is (and it resumes from there), so the drawing never snaps back under the pointer.
			if (allowed && wait <= 0) stage.setAttribute("data-vpk-iso-rest", "");
			else if (allowed && stage.hasAttribute("data-vpk-iso-rest")) stage.setAttribute("data-vpk-iso-rest", "paused");
			else stage.removeAttribute("data-vpk-iso-rest");
		};
		const input = () => {
			idleAt = Math.max(idleAt, now() + REST_IDLE_MS);
			rest();
		};
		for (const type of ["pointerdown", "pointermove", "wheel", "keydown", "focusin", "input"]) root.addEventListener(type, input, { passive: true });
		if (!shown) new win.IntersectionObserver(list => { shown = list[list.length - 1].isIntersecting; rest(); }).observe(stage);
		doc.addEventListener("visibilitychange", rest);
		if (loop.onReducedMotionChange) loop.onReducedMotionChange(rest);
		rests.push(rest);
		rest();
	}

	// One listener pair for every figure: afterprint and a print media change both set the pose
	// from the print media query, so afterprint keeps the rest pose while print is still emulated.
	const poses = [];
	const rests = [];
	const media = win.matchMedia?.("print");
	const posePrint = () => poses.forEach(pose => pose(!!media?.matches));
	win.addEventListener("afterprint", posePrint);
	media?.addEventListener?.("change", posePrint);

	// Deck fit (ws3 risk R6). A deck slide is a fixed frame (slides.html `.slide { height: 158mm }`, scaled to the viewport
	// by a transform) and the template caps every SVG at 105 mm, so a plate below a heading runs past the slide: the Gap
	// slider and the caption leave the frame and cover the page number. A ResizeObserver on each slide that holds iso SVGs
	// fires when the slide is shown (the fit never resizes the slide, so it cannot loop), and once more after the fonts
	// load. The SVGs are reset, then the room is the slide's content box, cut at the top of any pinned (absolute) child
	// that starts below the first plate (slides.html's `.co` callout), and slideFit's share becomes each SVG's inline
	// max-height. Rects are divided by the slide's scale (rect height / offsetHeight), so values are CSS px at every
	// viewport size. Auto-height `.slide` hosts never overflow, so nothing is written there; a hidden slide keeps its last
	// fit. Only rendered SVGs share the room: one in a hidden container once took half the overflow and kept max-height 0
	// when shown, and refitting on its own visibility change loops the ResizeObserver.
	const ISO_SVG = "[data-vpk-engine=\"iso-kit\"] svg[data-vpk-iso-id]";
	const slides = [];
	const fitSlide = slide => {
		if (!slide.offsetHeight) return;
		const all = [...slide.querySelectorAll(ISO_SVG)];
		for (const svg of all) svg.style.maxHeight = "";
		const svgs = all.filter(svg => (svg.checkVisibility ? svg.checkVisibility() : svg.getClientRects().length > 0));
		if (!svgs.length) return;
		const box = slide.getBoundingClientRect();
		const k = box.height / slide.offsetHeight;
		const y = v => (v - box.top) / k;
		const plates = svgs.map(svg => svg.closest("[data-vpk-engine]").getBoundingClientRect());
		const top = Math.min(...plates.map(r => r.top));
		let room = slide.clientTop + slide.clientHeight - parseFloat(win.getComputedStyle(slide).paddingBottom);
		let flow = 0;
		for (const el of slide.children) {
			const cs = win.getComputedStyle(el);
			const r = el.getBoundingClientRect();
			if (cs.display === "none") continue;
			if (cs.position !== "absolute" && cs.position !== "fixed") flow = Math.max(flow, y(r.bottom));
			else if (r.top > top) room = Math.min(room, y(r.top));
		}
		const heights = svgs.map(svg => svg.getBoundingClientRect().height / k);
		slideFit(flow - room, Math.max(...plates.map(r => y(r.bottom))) - room, heights).forEach((h, i) => {
			if (h !== null) svgs[i].style.maxHeight = `${h}px`;
		});
	};
	const fitter = win.ResizeObserver ? new win.ResizeObserver(list => list.forEach(entry => fitSlide(entry.target))) : null;
	doc.fonts?.ready?.then(() => slides.forEach(fitSlide));

	function scan() {
		if (fitter) {
			for (const slide of doc.querySelectorAll(".slide")) {
				if (seen.has(slide) || !slide.querySelector(ISO_SVG)) continue;
				seen.add(slide);
				slides.push(slide);
				fitter.observe(slide);
			}
		}
		for (const stage of doc.querySelectorAll("[data-vpk-engine=\"iso-kit\"] [data-vpk-iso-stage][data-vpk-iso-behavior]")) {
			if (seen.has(stage)) continue;
			seen.add(stage);
			try {
				mount(stage);
			} catch (error) {
				if (win.console) win.console.warn("vpk iso: figure left static:", error && error.message ? error.message : error);
			}
		}
	}

	// Rehearsal (integration R14/K25): delegates to the canonical starter's window.vpkSmil.
	const figures = () => [...doc.querySelectorAll("svg[data-vpk-iso-id]")].filter(svg => svg.querySelector("animate, animateTransform"));
	let held = 0;
	const rehearsal = {
		hold(t) {
			held = Math.max(0, Number(t) || 0);
			if (win.vpkSmil) for (const svg of figures()) win.vpkSmil.hold(held, svg);
		},
		release() {
			if (win.vpkSmil) for (const svg of figures()) win.vpkSmil.land(svg);
		},
		time: () => held,
		get duration() {
			return win.vpkSmil ? Math.max(0, ...figures().map(svg => win.vpkSmil.duration(svg))) : 0;
		},
	};
	win.__vpkIsoRehearsal = rehearsal;
	if (!win.__vpkRehearsal) win.__vpkRehearsal = rehearsal;

	if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", scan, { once: true });
	else scan();
	return { version: 1, spring, stepS, tween, tset, tval, tdone, bezier, EASE_LIFT, scan, rehearsal };
}
