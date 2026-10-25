// hairline/runtime/loop — hairline's register() on the shared window.vpkFrameLoop (figure-engines.md § 5).
//
// Vendored core/stage.ts runs its own rAF loop, IntersectionObserver and reduced-motion query. The bundle
// swaps in this register() for every figure (runtime/stage.mjs re-exports stage.ts with this one name
// overridden), so the figures share the one vpk loop. The contract is upstream's: the tick runs once at
// registration, so the figure is drawn before it is on screen; it then runs while its stage is near the
// viewport and it keeps returning true; wake() asks for frames again. Reduced motion is upstream's module flag
// (core/motion.ts setReducedMotion), written from the loop's query, and a change wakes every board as
// upstream's onMotion does. `getFrameLoop` is the inlined runtime/frame-loop.mjs, outside the bundle scope.
import { setReducedMotion } from "../vendor/packages/hairline/src/core/motion.ts";

const boards = new Set();
let loop = null;

function shared() {
	if (loop) return loop;
	// eslint-disable-next-line no-undef -- declared by the inlined frame loop around the bundle
	loop = getFrameLoop(window);
	setReducedMotion(loop.reducedMotion());
	loop.onReducedMotionChange(on => {
		setReducedMotion(on);
		for (const board of boards) board.wake();
	});
	return loop;
}

export function register(stage, tick) {
	const board = shared().register(stage, (dt, now) => tick(dt, now));
	boards.add(board);
	tick(0, performance.now());
	board.wake();
	let gone = false;
	return {
		wake: () => {
			if (!gone) board.wake();
		},
		unregister: () => {
			if (gone) return;
			gone = true;
			boards.delete(board);
			board.unregister();
		},
	};
}
