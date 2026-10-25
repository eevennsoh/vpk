// iso/state-runtime — step and scrub figures (plan § 2 I; illustrations.md R12, R13, R16). A figure with
// interact.behavior "step" or "scrub" carries its state model on the stage as data-vpk-iso-states (JSON, built by
// states.mjs): every state's screen moves per unit ([dx, dy] of the part, [sx, sy] of its cast shadow), its hidden parts and
// variants, its turn per rotating unit, its values, readout text and painter order (piece indices in DOM order). Step tweens
// between whole states (the 700 ms discrete clock); scrub follows a continuous position t in state units on the spring
// (k 100, c 18): moves, values and turns interpolate, and the discrete parts (hidden, variant, order, name) switch at the
// middle of each segment; a rotating unit shows the sample nearest its interpolated turn. The rest state is the static art:
// at rest no part carries a transform, every display attribute is the emitted one and the DOM order is the emitted order.
// Import-free like runtime.mjs: iso/inline.mjs inlines it into the kit scope, runtime.mjs calls core.mountStates, and
// states.mjs imports the pure helpers (formatReadout, stateText) so build time and runtime format alike.

const ZERO4 = [0, 0, 0, 0];

// "{name} · {kN:0.1} kN": {name} the state's name, {n} its 1-based number, {count} the state count, {t} the position 0–1,
// any values key. ":0.1" gives one decimal, ":1" none; a value without a spec takes `decimals[key]` (the most its values
// have). Unknown keys stay as written (validation rejects them).
export function formatReadout(template, ctx, decimals = {}) {
	return String(template).replace(/\{([A-Za-z]\w*)(?::(\d+)(?:\.(\d+))?)?\}/g, (whole, key, spec, frac) => {
		const own = { name: ctx.name, n: ctx.n, count: ctx.count, t: ctx.t };
		const value = key in own ? own[key] : ctx.values && key in ctx.values ? ctx.values[key] : undefined;
		if (value === undefined || value === null) return whole;
		if (typeof value === "string") return value;
		const d = spec !== undefined ? (frac ? frac.length : 0) : key === "t" ? 2 : key === "n" || key === "count" ? 0 : decimals[key] || 0;
		const text = value.toFixed(d);
		return /^-0\.?0*$/.test(text) ? text.slice(1) : text;
	});
}

// The readout of state k: its own readout, else the template at its values, else its name.
export function stateText(cfg, k) {
	const s = cfg.states[k];
	if (s.readout) return s.readout;
	if (!cfg.template) return s.name;
	return formatReadout(cfg.template, { name: s.name, n: k + 1, count: cfg.states.length, t: cfg.states.length > 1 ? k / (cfg.states.length - 1) : 0, values: s.values || {} }, cfg.d || {});
}

// Pure step core: `at` is the committed state. Click, Enter, Space and the forward arrows go to the next state (wrapping
// unless cfg.loop is false), the back arrows to the previous one, Home and End to the ends, Escape to rest.
export function stepReducer(state, event, cfg) {
	const n = cfg.count;
	let at = state.at;
	let handled = true;
	const next = () => (at + 1 < n ? at + 1 : cfg.loop === false ? at : 0);
	const prev = () => (at > 0 ? at - 1 : cfg.loop === false ? at : n - 1);
	if (event.type === "click") at = next();
	else if (event.type === "key") {
		const key = event.key;
		if (key === "ArrowRight" || key === "ArrowDown" || key === "PageDown" || key === "Enter" || key === " ") at = next();
		else if (key === "ArrowLeft" || key === "ArrowUp" || key === "PageUp") at = prev();
		else if (key === "Home") at = 0;
		else if (key === "End") at = n - 1;
		else if (key === "Escape") at = cfg.rest;
		else handled = false;
	} else handled = false;
	return { at, handled, changed: at !== state.at };
}

// Pure scrub core: `committed` is the resting position (state units, 0 to count − 1), `preview` the pointer's position while it
// hovers (input "pointer-x") or drags, or null. A drag or a click commits on release; keys move to the next or previous whole
// state (slider semantics: Right and Up forward); the slider control commits on change. `commit` marks a discrete commit (the
// live region speaks then, and only then).
export function scrubReducer(state, event, cfg) {
	const max = cfg.count - 1;
	const clamp = v => Math.min(max, Math.max(0, v));
	const next = { ...state, commit: false, handled: true };
	const at = state.preview === null ? state.committed : state.preview;
	if (event.type === "hover") {
		if (!state.drag && cfg.input === "pointer-x") next.preview = clamp(event.x * max);
	} else if (event.type === "down") {
		next.drag = true;
		next.preview = clamp(event.x * max);
	} else if (event.type === "move") {
		if (state.drag) next.preview = clamp(event.x * max);
		else if (cfg.input === "pointer-x") next.preview = clamp(event.x * max);
	} else if (event.type === "up") {
		if (state.drag) {
			next.drag = false;
			next.committed = at;
			next.preview = null;
			next.commit = true;
		}
	} else if (event.type === "leave") {
		if (!state.drag) next.preview = null;
	} else if (event.type === "cancel") {
		next.drag = false;
		next.preview = null;
	} else if (event.type === "input" || event.type === "change") {
		next.committed = clamp(event.value);
		next.preview = null;
		next.commit = event.type === "change";
	} else if (event.type === "key") {
		const key = event.key;
		let to = null;
		if (key === "ArrowRight" || key === "ArrowUp" || key === "PageUp") to = Math.min(max, Math.floor(at + 1e-6) + 1);
		else if (key === "ArrowLeft" || key === "ArrowDown" || key === "PageDown") to = Math.max(0, Math.ceil(at - 1e-6) - 1);
		else if (key === "Home") to = 0;
		else if (key === "End") to = max;
		else if (key === "Escape") to = cfg.rest;
		if (to === null) next.handled = false;
		else {
			next.committed = to;
			next.preview = null;
			next.drag = false;
			next.commit = true;
		}
	} else next.handled = false;
	return next;
}

export const scrubTarget = state => (state.preview === null ? state.committed : state.preview);

// A pose: per-unit screen moves (vec), values, turns, the state whose discrete parts show (near), the position t (state units)
// and whether it sits exactly on a state (exact).
export function statePose(cfg, k) {
	const s = cfg.states[k];
	const turn = {};
	for (const unit in cfg.turns || {}) turn[unit] = s.p && s.p[unit] && s.p[unit].r !== undefined ? s.p[unit].r : cfg.turns[unit][0];
	return { vec: s.m || {}, values: s.values || {}, turn, near: k, t: k, exact: true };
}

const lerpMap = (a, b, f, zero) => {
	const out = {};
	for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
		const p = key in a ? a[key] : zero(b[key]);
		const q = key in b ? b[key] : zero(a[key]);
		out[key] = Array.isArray(p) ? p.map((v, i) => v + (q[i] - v) * f) : p + (q - p) * f;
	}
	return out;
};

export function blendPose(a, b, f) {
	if (f <= 0) return a;
	if (f >= 1) return b;
	return {
		vec: lerpMap(a.vec, b.vec, f, () => ZERO4),
		values: lerpMap(a.values, b.values, f, v => v),
		turn: lerpMap(a.turn, b.turn, f, v => v),
		near: f < 0.5 ? a.near : b.near,
		t: a.t + (b.t - a.t) * f,
		exact: false,
	};
}

export function scrubPose(cfg, t) {
	const a = Math.max(0, Math.min(cfg.states.length - 1, Math.floor(t)));
	const b = Math.min(cfg.states.length - 1, a + 1);
	return blendPose(statePose(cfg, a), statePose(cfg, b), t - a);
}

// The readout of a pose: a state's own text on the state, the template in between (else the nearer state's text).
export function poseText(cfg, pose) {
	if (pose.exact || !cfg.template) return cfg.states[pose.near].text;
	const n = cfg.states.length;
	return formatReadout(cfg.template, { name: cfg.states[pose.near].name, n: pose.near + 1, count: n, t: n > 1 ? pose.t / (n - 1) : 0, values: pose.values }, cfg.d || {});
}

// The painter order of a pose: a state's own order on the state; between two scrub states, the segment order (cfg.states[a].s,
// [[f, order], …] from states.mjs segmentOrders) whose fraction the pose has passed; else the nearer state's order.
export function orderOf(cfg, pose) {
	if (pose.exact) return cfg.states[pose.near].o;
	const a = Math.max(0, Math.min(cfg.states.length - 1, Math.floor(pose.t)));
	const seg = cfg.states[a].s;
	if (!seg || !seg.length) return cfg.states[pose.near].o;
	const f = pose.t - a;
	let o = seg[0][1];
	for (const [f0, order] of seg) if (f0 <= f) o = order;
	return o;
}

// What a unit shows in a pose: hidden, or which variant ("base", a named variant, or the turn sample nearest its turn).
export function unitView(cfg, pose, unit) {
	const spec = (cfg.states[pose.near].p || {})[unit] || {};
	if (spec.h) return { hidden: true, variant: null };
	const samples = cfg.turns && cfg.turns[unit];
	if (samples) {
		const r = pose.turn[unit];
		let best = 0;
		samples.forEach((deg, i) => {
			if (Math.abs(deg - r) < Math.abs(samples[best] - r) - 1e-9) best = i;
		});
		return { hidden: false, variant: `turn-${best}` };
	}
	return { hidden: false, variant: spec.v || "base" };
}

// The DOM side. `x` carries what runtime.mjs mount() already built: { win, loop, core, stage, root, svg, attr, find, role,
// setText, restore, now, fromReview, line, measure, toView, clocks: { tween, tset, tval, tdone, spring, stepS } }. Returns the
// print pose and the stillness getter for the shared rest motion.
export function mountStates(x) {
	const { loop, core, stage, root, svg, attr, find, role, setText, restore, now, fromReview, line, measure, toView, clocks: C } = x;
	const cfg = JSON.parse(attr(stage, "states") || "null");
	if (!cfg || !Array.isArray(cfg.states) || cfg.states.length < 2) throw new Error("states");
	const step = attr(stage, "behavior") === "step";
	const n = cfg.states.length;
	const model = { count: n, rest: cfg.rest, loop: cfg.loop, input: cfg.input };
	const readout = find(root, "readout");
	const live = find(root, "live");
	const control = find(root, "control");
	const r1 = v => Math.round(v * 10) / 10;
	const units = [];
	const unitOf = new Map();
	const parts = [...svg.querySelectorAll("[data-vpk-iso-part]")].map((el, i) => {
		const id = attr(el, "part");
		const name = attr(el, "of") || id;
		if (!unitOf.has(name)) {
			unitOf.set(name, units.length);
			units.push({ name, label: attr(el, "label") || name });
		}
		const poly = core.partPoly(el);
		return { el, i, id, name, unit: unitOf.get(name), variant: attr(el, "variant"), poly, group: el.parentNode, dx: 0, dy: 0, tf: null, on: false, shown: !el.hasAttribute("display") };
	});
	if (cfg.states.some(s => s.o.split(" ").length !== parts.length || (s.s || []).some(([, o]) => o.split(" ").length !== parts.length))) throw new Error("order");
	const shadows = [...svg.querySelectorAll(role("shadow"))].map(el => {
		const on = el.closest("[data-vpk-iso-part]");
		return { el, of: attr(el, "shadow-for"), on: on ? attr(on, "of") || attr(on, "part") : null, variant: attr(el, "variant"), tf: null, shown: !el.hasAttribute("display") };
	});
	const lines = [];
	const labels = [...svg.querySelectorAll("[data-vpk-iso-label-for], [data-vpk-iso-arrow-for]")].map(el => ({ el, name: attr(el, "label-for") || attr(el, "arrow-for"), shown: !el.hasAttribute("display") }));
	for (const lab of labels) {
		const el = lab.el.querySelector(role("leader"));
		const target = parts.find(p => p.id === lab.name || p.name === lab.name);
		const pts = el && core.parsePolyPath(el.getAttribute("d"));
		if (pts && target) lines.push(line(el, pts, false, pts.map((_, k) => (k === pts.length - 1 ? target : null))));
	}
	if (svg.querySelector("[data-vpk-iso-tag-for]")) lines.push(...core.tagLines(core.parsePolyPath, svg, parts, units, line));
	const groups = new Map();
	for (const p of parts) {
		if (!groups.has(p.group)) groups.set(p.group, []);
		groups.get(p.group).push(p);
	}
	// Each piece moves with the whitespace in front of it, before the node right after the group's last piece, so returning to the
	// rest order restores the emitted markup byte for byte (R9: at rest the outerHTML is the static art).
	for (const list of groups.values()) list.tail = list[list.length - 1].el.nextSibling;
	let order = cfg.states[cfg.rest].o;
	let ranked = parts.slice();
	const moveTo = (g, el, tail) => {
		const ws = el.previousSibling;
		if (ws && ws.nodeType === 3 && !ws.data.trim()) g.insertBefore(ws, tail);
		g.insertBefore(el, tail);
	};
	const applyOrder = o => {
		if (o === order) return;
		order = o;
		const rank = new Map(o.split(" ").map((v, k) => [Number(v), k]));
		ranked = parts.slice().sort((a, b) => rank.get(a.i) - rank.get(b.i));
		for (const [g, list] of groups) for (const p of list.slice().sort((a, b) => rank.get(a.i) - rank.get(b.i))) moveTo(g, p.el, list.tail);
	};
	const place = (o, px, py) => {
		const value = Math.abs(px) >= 0.05 || Math.abs(py) >= 0.05 ? `translate(${r1(px)} ${r1(py)})` : null;
		if (value === o.tf) return;
		o.tf = value;
		if (value) o.el.setAttribute("transform", value);
		else o.el.removeAttribute("transform");
	};
	const show = (o, on) => {
		if (on === o.shown) return;
		o.shown = on;
		if (on) o.el.removeAttribute("display");
		else o.el.setAttribute("display", "none");
	};

	function write(pose) {
		const views = units.map(u => unitView(cfg, pose, u.name));
		const viewOf = name => (unitOf.has(name) ? views[unitOf.get(name)] : null);
		for (const p of parts) {
			const v = pose.vec[p.name];
			p.dx = v ? v[0] : 0;
			p.dy = v ? v[1] : 0;
			place(p, p.dx, p.dy);
			const view = views[p.unit];
			show(p, !view.hidden && (p.variant === null || p.variant === view.variant));
		}
		for (const s of shadows) {
			const a = pose.vec[s.of] || ZERO4;
			const b = (s.on && pose.vec[s.on]) || ZERO4;
			place(s, a[2] - b[2], a[3] - b[3]);
			const view = viewOf(s.of);
			if (view) show(s, !view.hidden && (s.variant === null || s.variant === view.variant));
		}
		for (const lab of labels) {
			const view = viewOf(lab.name);
			show(lab, !(view && view.hidden));
		}
		for (const ln of lines) {
			const moved = ln.movers.some(m => m && m.tf);
			const d = moved ? ln.pts.map(([px, py], k) => {
				const m = ln.movers[k] && ln.movers[k].tf ? ln.movers[k] : null;
				return `${k ? "L" : "M"}${r1(px + (m ? m.dx : 0))} ${r1(py + (m ? m.dy : 0))}`;
			}).join("") : ln.d0;
			if (d === ln.d) continue;
			ln.d = d;
			ln.el.setAttribute("d", d);
		}
		applyOrder(orderOf(cfg, pose));
	}

	const rest = statePose(cfg, cfg.rest);
	const st = { at: cfg.rest, from: rest, cur: rest, tw: C.tween(1), sc: { committed: cfg.rest, preview: null, drag: false }, sp: C.spring(cfg.rest), text: readout ? readout.textContent : "", said: null, liveText: null, hover: null, block: null };
	let board = null;
	const wake = () => board && board.wake();
	const target = () => (step ? statePose(cfg, st.at) : scrubPose(cfg, scrubTarget(st.sc)));
	const syncControl = () => {
		if (!control) return;
		control.value = String(st.sc.committed);
		control.setAttribute("aria-valuetext", poseText(cfg, scrubPose(cfg, st.sc.committed)));
	};
	const commitStep = next => {
		if (!next.changed) return;
		st.from = st.cur;
		st.at = next.at;
		st.tw = C.tween(0);
		C.tset(st.tw, 1, now(), 0, loop.reducedMotion());
		st.liveText = cfg.states[st.at].text;
		st.hover = null;
		wake();
	};
	const scrub = event => {
		const next = scrubReducer(st.sc, event, model);
		st.sc = next;
		if (next.commit) {
			st.liveText = poseText(cfg, scrubPose(cfg, next.committed));
			if (event.type !== "input" && event.type !== "change") syncControl();
		}
		wake();
		return next;
	};
	const xOf = e => {
		const r = measure();
		return r.width ? Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) : 0;
	};
	// Hover outlines the part under the pointer and names it in the readout; the hit test uses the silhouettes of the state the
	// figure is heading for, among the parts that state shows, in its painter order.
	const hover = e => {
		const goal = target();
		const [vx, vy] = toView(e.clientX, e.clientY);
		let hit = null;
		for (let k = ranked.length - 1; k >= 0; k--) {
			const p = ranked[k];
			const view = unitView(cfg, goal, p.name);
			if (view.hidden || (p.variant !== null && p.variant !== view.variant) || p.poly.length < 3) continue;
			const v = goal.vec[p.name] || ZERO4;
			if (core.topmostHit([p.poly], [vx - v[0], vy - v[1]]) >= 0) {
				hit = p.unit;
				break;
			}
		}
		if (hit !== st.block) st.block = null;
		const next = st.block === null ? hit : null;
		if (next !== st.hover) {
			st.hover = next;
			wake();
		}
	};
	const hoverable = step || cfg.input !== "pointer-x";
	stage.addEventListener("pointermove", e => {
		if (fromReview(e)) return;
		if (!step) {
			if (st.sc.drag) return void scrub({ type: "move", x: xOf(e) });
			if (e.pointerType === "mouse" && cfg.input === "pointer-x") scrub({ type: "hover", x: xOf(e) });
		}
		if (hoverable && e.pointerType === "mouse") hover(e);
	});
	stage.addEventListener("pointerleave", () => {
		st.hover = null;
		st.block = null;
		if (!step) scrub({ type: "leave" });
		wake();
	});
	if (step) {
		stage.addEventListener("click", e => {
			if (fromReview(e)) return;
			st.block = st.hover;
			commitStep(stepReducer({ at: st.at }, { type: "click" }, model));
		});
	} else {
		stage.addEventListener("pointerdown", e => {
			if (fromReview(e) || cfg.input === "keys" || (e.pointerType === "mouse" && e.button)) return;
			if (stage.setPointerCapture && e.pointerId !== undefined) try {
				stage.setPointerCapture(e.pointerId);
			} catch (error) {
				void error;
			}
			st.hover = null;
			scrub({ type: "down", x: xOf(e) });
		});
		stage.addEventListener("pointerup", () => scrub({ type: "up" }));
		stage.addEventListener("pointercancel", () => scrub({ type: "cancel" }));
		if (control) {
			control.addEventListener("input", () => scrub({ type: "input", value: Number(control.value) }));
			control.addEventListener("change", () => scrub({ type: "change", value: Number(control.value) }));
		}
	}
	stage.addEventListener("keydown", e => {
		if (fromReview(e) || e.altKey || e.ctrlKey || e.metaKey) return;
		if (step) {
			const next = stepReducer({ at: st.at }, { type: "key", key: e.key }, model);
			if (!next.handled) return;
			e.preventDefault();
			e.stopPropagation();
			commitStep(next);
		} else {
			const next = scrubReducer(st.sc, { type: "key", key: e.key }, model);
			if (!next.handled) return;
			e.preventDefault();
			e.stopPropagation();
			scrub({ type: "key", key: e.key });
		}
	});

	// Print pose: the rest state, written synchronously and held (tick writes nothing meanwhile); leaving print wakes the board.
	let still = false;
	const pose = on => {
		still = on;
		if (!on) return wake();
		for (const p of parts) restore(p.el);
		for (const lab of labels) restore(lab.el);
		write(rest);
	};

	function tick(dt, t, calm) {
		if (still) return false;
		const reduced = calm === undefined ? loop.reducedMotion() : calm;
		let busy;
		let current;
		if (step) {
			const f = C.tval(st.tw, t, reduced);
			current = blendPose(st.from, statePose(cfg, st.at), f);
			busy = !C.tdone(st.tw, t, reduced);
		} else {
			st.sp.t = scrubTarget(st.sc);
			busy = C.stepS(st.sp, dt, reduced);
			current = scrubPose(cfg, Math.min(n - 1, Math.max(0, st.sp.x)));
		}
		st.cur = current;
		write(current);
		for (const p of parts) {
			const on = p.unit === st.hover;
			if (on === p.on) continue;
			p.on = on;
			for (const el of [p.el, ...labels.filter(lab => lab.name === p.name || lab.name === p.id).map(lab => lab.el)]) {
				if (on) el.classList.add("is-active");
				else restore(el);
			}
		}
		const text = st.hover !== null ? units[st.hover].label : poseText(cfg, current);
		if (readout && text !== st.text) {
			st.text = text;
			setText(readout, text);
		}
		if (live && st.liveText !== null) {
			if (st.liveText !== st.said) setText(live, st.liveText);
			st.said = st.liveText;
			st.liveText = null;
		}
		return busy;
	}

	board = loop.register(stage, tick, { rest: () => pose(true) });
	return { pose, still: () => still };
}
