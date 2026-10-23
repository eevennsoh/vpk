// vpk shared frame loop, window.vpkFrameLoop (integration K4). Runtimes inline it with `export `
// stripped, so: no imports, three top-level names. Frozen after B1 (R29).
export const FRAME_LOOP_VERSION = 1;

export function createFrameLoop(env = {}) {
	const g = env.global || globalThis;
	const later = env.setTimeout || ((fn, ms) => g.setTimeout(fn, ms));
	const now = env.now || (() => (g.performance ? g.performance.now() : Date.now()));
	const raf = env.raf || (fn => g.requestAnimationFrame(fn));
	const caf = env.caf || (!env.raf && g.cancelAnimationFrame ? id => g.cancelAnimationFrame(id) : null);
	const IO = "IO" in env ? env.IO : g.IntersectionObserver;
	const mm = "matchMedia" in env ? env.matchMedia : g.matchMedia && (q => g.matchMedia(q));
	const mql = mm ? mm("(prefers-reduced-motion: reduce)") : null;
	const boards = new Set();
	const stages = new Map();
	const listeners = new Set();
	let io = null, pending = false, handle = null, gen = 0, frames = 0, override = null;
	const rethrow = error => later(() => { throw error; }, 0);
	const safely = (fn, arg) => { try { return fn(arg); } catch (error) { rethrow(error); } };
	const reducedMotion = () => (override === null ? !!mql?.matches : override);
	const due = () => [...boards].some(b => b.awake && b.visible);
	const count = key => [...boards].filter(b => b[key]).length;
	let calm = reducedMotion();

	function schedule() {
		if (pending || !due()) return;
		pending = true;
		const mine = ++gen;
		handle = raf(() => mine === gen && run());
	}

	function cancel() {
		if (!pending) return;
		pending = false;
		gen += 1;
		if (caf && handle != null) caf(handle);
	}

	function run() {
		pending = false;
		frames += 1;
		const t = now();
		const c = reducedMotion();
		for (const b of [...boards]) {
			if (!b.awake || !b.visible) continue;
			const dt = Math.min(0.05, Math.max(0, (t - b.last) / 1000));
			b.last = t;
			if (!safely(() => b.tick(dt, t, c))) b.awake = false;
		}
		schedule();
	}

	function update() {
		const next = reducedMotion();
		if (next === calm) return;
		calm = next;
		const t = now();
		for (const b of boards) {
			if (!b.awake) b.last = t;
			b.awake = true;
		}
		for (const fn of [...listeners]) safely(fn, next);
		schedule();
	}

	mql?.addEventListener?.("change", update);

	function onEntries(entries) {
		const t = now();
		for (const entry of entries) {
			const visible = !!(entry.isIntersecting || entry.intersectionRatio > 0);
			for (const b of stages.get(entry.target) || []) {
				if (visible && !b.visible) b.last = t;
				b.visible = visible;
			}
		}
		if (due()) schedule();
		else cancel();
	}

	function onPrint() {
		for (const b of [...boards]) if (b.rest) safely(b.rest);
	}

	function listenPrint(on) {
		if (typeof g.addEventListener === "function") g[on ? "addEventListener" : "removeEventListener"]("beforeprint", onPrint);
	}

	function register(stage, tick, opts) {
		if (!stage || typeof tick !== "function") throw new TypeError("vpkFrameLoop.register: stage and tick required");
		const rest = opts && typeof opts.rest === "function" ? opts.rest : null;
		const board = { tick, rest, visible: !IO, awake: false, last: 0, live: true };
		let peers = stages.get(stage);
		if (peers) board.visible = [...peers][0].visible;
		else {
			stages.set(stage, peers = new Set());
			if (IO) (io ||= new IO(onEntries, { rootMargin: "120px 0px" })).observe(stage);
		}
		peers.add(board);
		boards.add(board);
		if (boards.size === 1) listenPrint(true);
		return Object.freeze({
			wake() {
				if (!board.live || board.awake) return;
				board.awake = true;
				board.last = now();
				schedule();
			},
			unregister() {
				if (!board.live) return;
				board.live = board.awake = false;
				boards.delete(board);
				peers.delete(board);
				if (!peers.size) {
					stages.delete(stage);
					io?.unobserve(stage);
				}
				if (!boards.size) {
					io?.disconnect();
					io = null;
					listenPrint(false);
				}
				if (!due()) cancel();
			},
		});
	}

	return Object.freeze({
		version: FRAME_LOOP_VERSION,
		register,
		reducedMotion,
		setReducedMotion(on) {
			override = on == null ? null : !!on;
			update();
		},
		onReducedMotionChange(fn) {
			if (typeof fn !== "function") throw new TypeError("vpkFrameLoop.onReducedMotionChange: fn required");
			listeners.add(fn);
			return () => void listeners.delete(fn);
		},
		stats: () => ({ boards: boards.size, visible: count("visible"), awake: count("awake"), frames }),
	});
}

export function getFrameLoop(win = globalThis) {
	return (win.vpkFrameLoop ??= createFrameLoop({ global: win }));
}
