// vpk-lab runtime · loop adapter: EU26's makeLoop semantics over the one shared frame loop, window.vpkFrameLoop
// (runtime/frame-loop.mjs, integration K4/R1). It owns no animation frame and no IntersectionObserver: the shared
// loop runs one chain for every lab, iso figure and anatomy hero on the page, pauses boards that are off screen and
// clamps dt to 0.05 s. lab/kit.mjs inlines frame-loop.mjs first, so getFrameLoop() always exists in a built block.

/** The page's shared loop, or null when no runtime has installed it (a document without a lab block). */
export function getLoop(env = globalThis) {
	return env.vpkFrameLoop ?? null;
}

/** Reduced motion as the shared loop sees it ("calm"), else the media query. */
export function reducedMotion(env = globalThis) {
	const loop = getLoop(env);
	if (loop) return loop.reducedMotion();
	return Boolean(env.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

/**
 * EU26's makeLoop over the shared loop: `step(dt, now, calm)` returns false to stop. Registration is lazy (first
 * start()); start() never calls `step` synchronously; stop() lets the next frame return false so the board sleeps;
 * off-screen boards pause and resume through the shared loop's observer. `rest` runs on beforeprint.
 * Returns `{ start(), stop(), destroy(), get running }`; without a loop, start() is a no-op and running stays false.
 */
export function makeLoop(element, step, { loop = getLoop(), rest } = {}) {
	let running = false;
	let handle = null;
	const tick = (dt, now, calm) => {
		if (!running) return false;
		if (step(dt, now, calm) === false) {
			running = false;
			return false;
		}
		return running;
	};
	return {
		start() {
			if (!loop) return;
			handle ??= loop.register(element, tick, { rest });
			running = true;
			handle.wake();
		},
		stop() {
			running = false;
		},
		destroy() {
			running = false;
			handle?.unregister();
			handle = null;
		},
		get running() {
			return running;
		},
	};
}
