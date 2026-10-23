// vpk-html media · capture-clock: the page-side scripts and mouse paths behind capture.mjs's `virtual` segment and the
// screencast cursor (references/media-pipeline.md, Virtual capture and Cursor). Importing this module launches nothing.
//
// VIRTUAL_CLOCK_INIT_SCRIPT (page.addInitScript) wraps requestAnimationFrame, setTimeout/setInterval, performance.now and
// Date.now. Until __vpkVirtual.arm() the page runs on the real clock; armed, nothing advances until step(ms): timers due
// by then run in order, CSS and Web Animations are paused and set to their elapsed time, then the rAF batch runs with the
// virtual timestamp. Limits: a timer or rAF registered before arm() stays on the real clock until it re-registers
// (`new Date()` without arguments is not wrapped), and worker and iframe clocks are not virtual.
// CURSOR_OVERLAY_INIT_SCRIPT draws a grayscale arrow (and a press ring) that follows the mouse, because CDP screencasts
// never include the system cursor; glide(x, y, ms) moves the real mouse along an eased path so the arrow travels.

/** The virtual clock, serialised into the page; it must not reference anything outside its own body. */
function installVirtualClock() {
	if (self.__vpkVirtual) return;
	const real = { raf: self.requestAnimationFrame.bind(self), caf: self.cancelAnimationFrame.bind(self), now: performance.now.bind(performance), date: Date.now.bind(Date), st: self.setTimeout.bind(self), si: self.setInterval.bind(self), ct: self.clearTimeout.bind(self), ci: self.clearInterval.bind(self) };
	const BASE = 1e9;
	const clock = { armed: false, now: 0, dateOrigin: 0, id: 0 };
	const frames = new Map();
	const timers = new Map();
	const pinned = new WeakMap();
	const run = (fn, args) => {
		try { fn(...args); } catch (error) { real.st(() => { throw error; }, 0); }
	};
	const virtualId = () => BASE + (clock.id += 1);
	const timer = (fn, delay, args, every) => {
		const id = virtualId();
		timers.set(id, { fn, args, at: clock.now + Math.max(0, Number(delay) || 0), every });
		return id;
	};
	self.requestAnimationFrame = fn => {
		if (!clock.armed) return real.raf(fn);
		const id = virtualId();
		frames.set(id, fn);
		return id;
	};
	self.cancelAnimationFrame = id => (id >= BASE ? frames.delete(id) : real.caf(id));
	self.setTimeout = (fn, delay, ...args) => (clock.armed && typeof fn === "function" ? timer(fn, delay, args, null) : real.st(fn, delay, ...args));
	self.setInterval = (fn, delay, ...args) => (clock.armed && typeof fn === "function" ? timer(fn, delay, args, Math.max(1, Number(delay) || 0)) : real.si(fn, delay, ...args));
	self.clearTimeout = id => (id >= BASE ? timers.delete(id) : real.ct(id));
	self.clearInterval = self.clearTimeout;
	performance.now = () => (clock.armed ? clock.now : real.now());
	Date.now = () => (clock.armed ? clock.dateOrigin + clock.now : real.date());
	// Pause every animation and drive it from the virtual clock. Those running at arm() keep their own time; one created
	// later (by a hook, timer or frame callback) starts at 0 when it is first seen, whatever real time passed meanwhile.
	const pin = (target, previous, existing = false) => {
		for (const animation of document.getAnimations()) {
			if (animation.timeline !== document.timeline) continue; // scroll- and view-driven animations follow the scroll offset
			let own = pinned.get(animation);
			if (!own) {
				own = { base: existing ? Number(animation.currentTime) || 0 : 0, at: previous };
				pinned.set(animation, own);
				animation.pause();
			}
			animation.currentTime = own.base + (target - own.at);
		}
	};
	self.__vpkVirtual = {
		get armed() { return clock.armed; },
		get now() { return clock.armed ? clock.now : real.now(); },
		arm() {
			if (clock.armed) return;
			clock.now = real.now();
			clock.dateOrigin = real.date() - clock.now;
			clock.armed = true;
			pin(clock.now, clock.now, true);
		},
		sync() { pin(clock.now, clock.now); }, // pin animations a hook just created

		step(ms) {
			if (!clock.armed) throw new Error("vpk capture: __vpkVirtual.step before arm()");
			const previous = clock.now;
			const target = previous + ms;
			for (;;) {
				let due = null;
				for (const [id, item] of timers) if (item.at <= target && (!due || item.at < due.item.at || (item.at === due.item.at && id < due.id))) due = { id, item };
				if (!due) break;
				clock.now = Math.max(clock.now, due.item.at);
				if (due.item.every == null) timers.delete(due.id);
				else due.item.at += due.item.every;
				run(due.item.fn, due.item.args);
				pin(clock.now, clock.now);
			}
			clock.now = target;
			pin(target, previous);
			const batch = [...frames.values()];
			frames.clear();
			for (const fn of batch) run(fn, [target]);
			pin(target, target);
		},
		disarm() {
			clock.armed = false;
			for (const animation of document.getAnimations()) if (pinned.has(animation) && animation.playState === "paused") animation.play();
		},
		realFrame: () => new Promise(resolve => real.raf(() => real.raf(resolve))),
	};
}

/** The cursor overlay, serialised into the page with its options as the argument. */
function installCursorOverlay(options) {
	if (self.__vpkCursor) return;
	const build = () => {
		const ns = "http://www.w3.org/2000/svg";
		const host = document.createElement("div");
		host.setAttribute("data-vpk-capture-cursor", "");
		host.style.cssText = `position:fixed;left:0;top:0;width:${options.size}px;height:${options.size}px;z-index:2147483647;pointer-events:none;opacity:0;will-change:transform`;
		const svg = document.createElementNS(ns, "svg");
		svg.setAttribute("viewBox", "0 0 24 24");
		svg.setAttribute("width", String(options.size));
		svg.setAttribute("height", String(options.size));
		const arrow = document.createElementNS(ns, "path");
		arrow.setAttribute("d", "M3 2v17l4.5-4.2 3 6.7 2.6-1.2-3-6.5H17z");
		arrow.setAttribute("style", "fill:white;stroke:black;stroke-width:1.4;stroke-linejoin:round");
		svg.append(arrow);
		const ring = document.createElement("div");
		ring.style.cssText = `position:absolute;left:${-options.size / 2 + 3}px;top:${-options.size / 2 + 2}px;width:${options.size}px;height:${options.size}px;border-radius:50%;background:black;opacity:0`;
		host.append(ring, svg);
		document.documentElement.append(host);
		const place = event => {
			host.style.transform = `translate(${event.clientX - 3}px, ${event.clientY - 2}px)`;
			host.style.opacity = "1";
			self.__vpkCursor.x = event.clientX;
			self.__vpkCursor.y = event.clientY;
		};
		addEventListener("mousemove", place, true);
		addEventListener("mouseup", place, true);
		addEventListener("mousedown", event => {
			place(event);
			ring.animate([{ transform: "scale(0.3)", opacity: 0.35 }, { transform: "scale(1.5)", opacity: 0 }], { duration: 350, easing: "ease-out" });
		}, true);
	};
	self.__vpkCursor = { x: null, y: null, size: options.size };
	if (document.documentElement) build();
	else document.addEventListener("readystatechange", build, { once: true });
}

export const VIRTUAL_CLOCK_INIT_SCRIPT = `(${installVirtualClock})();`;
export const CURSOR_DEFAULTS = Object.freeze({ size: 24 });
/** The init script string for the cursor overlay at `size` px. */
export const CURSOR_OVERLAY_INIT_SCRIPT = (size = CURSOR_DEFAULTS.size) => `(${installCursorOverlay})(${JSON.stringify({ size })});`;

/** Mouse points for a glide from `from` to `to` over `ms`: smoothstep-eased, one point per ~16 ms, each with its wait. */
export function glidePath(from, to, ms, { stepMs = 16 } = {}) {
	const steps = Math.max(1, Math.round(Math.max(0, ms) / stepMs));
	const ease = u => u * u * (3 - 2 * u);
	return Array.from({ length: steps }, (_, index) => {
		const u = ease((index + 1) / steps);
		return { x: from.x + (to.x - from.x) * u, y: from.y + (to.y - from.y) * u, wait: Math.max(0, ms) / steps };
	});
}

/** `glide(x, y, ms = 400)` for a screencast drive: moves the real mouse along glidePath, starting at `start` ([x, y]). */
export function makeGlide(page, { start = [0, 0] } = {}) {
	let at = { x: start[0], y: start[1] };
	let placed = false;
	return async function glide(x, y, ms = 400) {
		if (!placed) {
			await page.mouse.move(at.x, at.y);
			placed = true;
		}
		for (const point of glidePath(at, { x, y }, ms)) {
			await page.mouse.move(point.x, point.y);
			if (point.wait) await page.waitForTimeout(point.wait);
		}
		at = { x, y };
	};
}

/** Normalise a spec's `cursor`: false (off), true or `{ size, start }` → `{ size, start }`. `fail(message)` must throw. */
export function normalizeCursor(value, viewport, fail = message => { throw new RangeError(message); }) {
	if (!value) return false;
	const options = value === true ? {} : value;
	const size = Number(options.size ?? CURSOR_DEFAULTS.size);
	if (!(size >= 8 && size <= 96)) fail(`size must be 8–96 px (got ${options.size})`);
	const start = options.start ?? [Math.round(viewport.width / 2), Math.round(viewport.height / 2)];
	if (!Array.isArray(start) || start.length !== 2 || !start.every(Number.isFinite)) fail("start must be [x, y]");
	return { size, start };
}

/** Before the first goto: install the virtual clock when any segment is `virtual`, and the cursor overlay when asked. */
export async function installCaptureScripts(page, spec) {
	if (spec.segments.some(segment => segment.kind === "virtual")) await page.addInitScript(VIRTUAL_CLOCK_INIT_SCRIPT);
	if (spec.cursor) await page.addInitScript(CURSOR_OVERLAY_INIT_SCRIPT(spec.cursor.size));
}

/** Advance an armed virtual clock by `ms` and let the compositor paint it (two real frames). */
export async function stepVirtual(page, ms) {
	await page.evaluate(async delta => {
		globalThis.__vpkVirtual.step(delta);
		await globalThis.__vpkVirtual.realFrame();
	}, ms);
}
