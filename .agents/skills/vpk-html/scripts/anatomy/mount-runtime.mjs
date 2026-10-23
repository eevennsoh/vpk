// vpk anatomy mount runtime (ws4b spec sections 4.4 and 6.3; integration K4, K15, K26, R33).
// Inlined into <script data-vpk-anatomy-runtime> with `export `, indentation and full-line comments
// stripped, so: no imports, browser APIs only through `win`, no multi-line strings, and no top-level name
// shared with the kit subset or the frame loop. Motion helpers follow upstream anatomy references/motion.md.

export function follow(x, target, dt, seconds, calm) {
	if (calm || seconds <= 0) return target;
	const next = x + (target - x) * (1 - Math.exp(-dt / seconds));
	return Math.abs(target - next) < 5e-4 ? target : next;
}

// Four sub-steps on state = { x, v }; true while moving, snaps once error and velocity are under 5e-4.
export function spring(state, target, dt, stiffness, damping, calm) {
	if (!calm) {
		for (let i = 0; i < 4; i++) {
			state.v += ((target - state.x) * stiffness - state.v * damping) * dt / 4;
			state.x += state.v * dt / 4;
		}
		if (Math.abs(target - state.x) >= 5e-4 || Math.abs(state.v) >= 5e-4) return true;
	}
	state.x = target;
	state.v = 0;
	return false;
}

// Critically damped spring with time constant `seconds`.
export function settle(state, target, dt, seconds, calm) {
	const w = 1 / Math.max(1e-3, seconds);
	return spring(state, target, dt, w * w, 2 * w, calm);
}

export function smooth(a, b, x) {
	const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
}

export function burst(age, rise, fall) {
	return age < 0 ? 0 : age < rise ? smooth(0, rise, age) : Math.exp(-(age - rise) / fall);
}

export function createAnatomyRuntime(win, loop, kit) {
	const doc = win.document;
	const queue = (win.vpkAnatomyQueue ??= []);
	const entries = new Map();
	const heroes = new Map();
	const drops = [];
	const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
	// K26: never react to events from the review UI.
	const foreign = event => event.composedPath().some(node => node.matches?.("[data-vpk-review-ui]"));
	// Every stage handler goes through `on`, so none can forget the guard (decision 18e).
	const on = (node, names, fn) => names.split(" ").forEach(name => node.addEventListener(name, event => {
		if (!foreign(event)) fn(event);
	}));

	// Mount-owned slider: pointer, keys, ARIA and the idle tour (R33).
	function slider(hero) {
		const { stage, control: { min, max, step, rest, pointer, tour } } = hero;
		const big = hero.control.bigStep || step * 5;
		const fix = v => Number(clamp(v, min, max).toFixed((String(step).split(".")[1] || "").length));
		const held = { hover: false, focus: false };
		let target = rest, touring = false, time = 0, stop = -1, resumeAt = Infinity, timer = 0, rect = null;
		const aria = () => {
			stage.setAttribute("aria-valuenow", String(fix(target)));
			if (hero.entry) stage.setAttribute("aria-valuetext", hero.entry.present(hero.entry.model(target, hero.data), hero.data).valueText);
		};
		const set = (value, announce) => {
			value = clamp(value, min, max);
			if (value !== target) {
				target = value;
				hero.wake();
			}
			if (announce) aria();
		};
		const take = () => {
			touring = false;
			resumeAt = Infinity;
			win.clearTimeout(timer);
		};
		// The tour restarts `seconds` after the last input, never while held or under reduced motion.
		const resume = seconds => {
			take();
			if (!tour || held.hover || held.focus || loop.reducedMotion()) return;
			resumeAt = win.performance.now() + seconds * 1000;
			timer = win.setTimeout(hero.wake, seconds * 1000 + 20);
		};
		const release = name => {
			held[name] = false;
			resume(tour?.resume);
		};
		// Fractions of the drawing, not the stage: the svg is capped to the viewport height and centred (css.mjs).
		const map = event => {
			rect ||= hero.svg.getBoundingClientRect();
			const u = pointer.axis === "y" ? (event.clientY - rect.top) / rect.height : (event.clientX - rect.left) / rect.width;
			return min + (max - min) * clamp((u - pointer.from) / (pointer.to - pointer.from), 0, 1);
		};
		const drop = () => (rect = null);
		drops.push(drop);
		if (win.ResizeObserver) new win.ResizeObserver(drop).observe(hero.svg);
		on(stage, "pointerenter pointerdown pointermove", event => {
			if (event.type !== "pointermove") rect = null;
			held.hover = true;
			take();
			if (pointer && event.type !== "pointerenter") set(map(event), false);
		});
		on(stage, "pointerup pointercancel", aria);
		on(stage, "pointerleave", () => {
			aria();
			release("hover");
		});
		// Keyboard focus brings the whole plate into view (its scroll-margin clears the shell's fades), so the
		// readout and hint below the stage stay visible while the stage owns the arrow and Page keys.
		on(stage, "focus", () => {
			held.focus = true;
			take();
			if (stage.matches(":focus-visible")) stage.closest(".iso-plate")?.scrollIntoView({ block: "nearest" });
		});
		on(stage, "blur", () => release("focus"));
		on(stage, "keydown", event => {
			if (event.ctrlKey || event.metaKey || event.altKey) return;
			const by = event.shiftKey ? big : step;
			const steps = { ArrowRight: by, ArrowUp: by, ArrowLeft: -by, ArrowDown: -by, PageUp: big, PageDown: -big };
			const jumps = { Home: min, End: max, Escape: rest };
			const next = event.key in steps ? fix(target + steps[event.key]) : jumps[event.key];
			if (next === undefined) return;
			event.preventDefault();
			take();
			set(next, true);
		});
		return {
			input: Object.freeze({ min, max, step, rest, get target() { return target; }, get touring() { return touring; } }),
			advance(dt, calm, now) {
				if (calm) {
					take();
					return false;
				}
				if (tour && !touring && now >= resumeAt) {
					take();
					touring = true;
					time = -dt;
					stop = -1;
				}
				if (!touring) return resumeAt - now < 250;
				time += dt;
				const index = Math.floor(time / tour.dwell) % tour.stops.length;
				if (index !== stop) {
					stop = index;
					set(tour.stops[index], true);
				}
				return true;
			},
			rest() {
				take();
				set(rest, true);
			},
			resume,
			state: () => ({ target, touring }),
		};
	}

	function context(hero) {
		const { root, svg, P, data } = hero;
		const parts = new Map();
		let shown = null, said = null, live = null;
		return {
			id: hero.id, root, stage: hero.stage, svg, readout: hero.readout, P, data, kit,
			input: hero.ctl ? hero.ctl.input : null,
			part: name => (parts.has(name) ? parts : parts.set(name, svg.querySelector(`[data-part="${name}"]`))).get(name),
			model: input => hero.entry.model(input, data),
			present: state => hero.entry.present(state, data),
			// The visible readout, written only when the presented text changes (safe in tick). Editing the text
			// node's data is a characterData change, which the enhancer's observer never schedules work for.
			show(state) {
				const text = hero.entry.present(state, data).readout;
				const node = hero.readout?.firstChild;
				if (text === shown || !hero.readout) return;
				if (node?.nodeType === 3 && !node.nextSibling) node.data = text;
				else hero.readout.textContent = text;
				shown = text;
			},
			// Print-safe delta from the rest pose: a transform only while the screen delta is >= 0.05.
			offset(el, delta) {
				if (!el) return;
				const next = Math.hypot(...kit.axisVector(P, delta)) >= 0.05 ? kit.translateAlong(P, delta) : null;
				if (next === el.getAttribute("transform")) return;
				if (next) el.setAttribute("transform", next);
				else el.removeAttribute("transform");
			},
			// Polite, change-only announcements for the group role; never call it from tick.
			announce(text) {
				if (text === said) return;
				said = text;
				if (!live) {
					live = root.appendChild(doc.createElement("span"));
					live.setAttribute("data-vpk-generated", "");
					live.setAttribute("aria-live", "polite");
					live.style.cssText = "position:absolute;clip-path:inset(50%)";
				}
				live.textContent = text;
			},
			wake: () => hero.wake(),
			calm: () => loop.reducedMotion(),
			follow, spring, settle, smooth, burst,
		};
	}

	const warn = (id, error) => win.console.warn(`vpk anatomy hero ${id}: ${error?.message || error}`);

	function attach(hero) {
		if (hero.handle !== undefined || !hero.entry) return false;
		try {
			hero.handle = hero.entry.live?.(context(hero)) || null;
		} catch (error) {
			hero.handle = null;
			warn(hero.id, error);
		}
		return true;
	}

	// Bad data warns once and leaves an inert hero; nothing throws at load.
	function mount(root) {
		const id = root.getAttribute("data-vpk-figure");
		if (!id || heroes.has(id)) return;
		try {
			const island = root.querySelector("[data-vpk-anatomy-data]");
			const { P, control, data } = JSON.parse(island?.textContent || "null") || {};
			const stage = root.querySelector(".iso-stage");
			const svg = stage?.querySelector("svg");
			if (!P || !svg) throw new Error("no projection or stage svg");
			const hero = { id, root, stage, svg, P, control, data, readout: root.querySelector("[data-readout]"), entry: entries.get(id) };
			hero.wake = () => hero.board?.wake();
			const ctl = (hero.ctl = control?.role === "slider" ? slider(hero) : null);
			heroes.set(id, hero);
			hero.board = loop.register(stage, (dt, now, calm) => {
				let keep = ctl ? ctl.advance(dt, calm, now) : false;
				if (hero.handle?.tick) keep = hero.handle.tick(dt, now, calm) || keep;
				return keep;
			}, {
				rest() {
					ctl?.rest();
					hero.handle?.rest?.();
				},
			});
			attach(hero);
			hero.wake();
			ctl?.resume(control.tour?.delay);
		} catch (error) {
			warn(id, error);
		}
	}

	function add(entry) {
		if (typeof entry?.id !== "string") return;
		entries.set(entry.id, entry);
		const hero = heroes.get(entry.id);
		if (hero && !hero.entry && ((hero.entry = entry), attach(hero))) hero.wake();
	}

	const resumeAll = calm => calm || heroes.forEach(hero => hero.ctl?.resume(hero.control.tour?.resume));
	queue.splice(0).forEach(add);
	queue.push = (...items) => (items.forEach(add), 0);
	const start = () => doc.querySelectorAll('[data-vpk-engine="anatomy-hero"]').forEach(mount);
	if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start, { once: true });
	else start();
	win.addEventListener("scroll", () => drops.forEach(drop => drop()), { capture: true, passive: true });
	win.addEventListener("afterprint", () => resumeAll(false));
	loop.onReducedMotionChange(resumeAll);
	// Chromium drops a MediaQueryList's change event when its .matches is read before the event is dispatched,
	// and the frame loop reads its own list every frame while a board ticks, so a reduce-then-clear mid-tour never
	// reached the loop's listeners. This list is never read, so its events always arrive (R33).
	win.matchMedia?.("(prefers-reduced-motion: reduce)").addEventListener("change", event => resumeAll(event.matches));

	return Object.freeze({
		version: 1,
		kit,
		inspect(id) {
			const hero = heroes.get(id);
			if (!hero) return null;
			const { target = null, touring = false } = hero.ctl?.state() || {};
			return { target, readout: hero.readout?.textContent ?? null, touring };
		},
	});
}
