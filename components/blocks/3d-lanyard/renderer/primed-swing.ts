import { hasSimulation } from "./physics";
import { primeLanyardPhysics } from "./prime-lanyard-physics";

export interface PrimedSwing {
	/** Resolves once the first swing can be drawn. */
	readonly ready: Promise<void>;
	/** Asks for `swing`: drawn at once if its physics is kept, else once a worker has simulated it. */
	want(swing: number): void;
	/** The swing to draw now: the latest asked for whose physics is in. */
	current(): number;
	dispose(): void;
}

/**
 * Keeps a stage from simulating on the main thread as its swing changes (a
 * Swing slider drag asks for one value after another, each a long task). The
 * stage draws the last swing whose physics is in while a worker simulates the
 * newest, one at a time, skipping any passed on the way; `onLanded` asks for a
 * redraw when a newer one can be drawn. Without a worker the swing asked for
 * is drawn anyway, and simulated on its first draw, as before.
 */
export function createPrimedSwing(initial: number, onLanded: () => void, prime: (swings: readonly number[]) => Promise<void> = primeLanyardPhysics): PrimedSwing {
	let drawn = initial;
	let wanted = initial;
	let priming = false;
	let disposed = false;

	function want(swing: number): Promise<void> {
		wanted = swing;
		if (hasSimulation(swing)) {
			// Kept already, so it costs nothing: the next draw shows it.
			drawn = swing;
			return Promise.resolve();
		}
		if (priming) return Promise.resolve();
		priming = true;
		return prime([swing]).then(() => {
			priming = false;
			if (disposed) return;
			const latest = wanted;
			if (latest !== swing && !hasSimulation(latest)) {
				// Asked for another while this one simulated: show this one, which is nearer, then fetch the latest.
				if (hasSimulation(swing)) {
					drawn = swing;
					onLanded();
				}
				void want(latest);
				return;
			}
			drawn = latest;
			onLanded();
		});
	}

	return {
		ready: want(initial),
		want: (swing) => void want(swing),
		current: () => drawn,
		dispose() {
			disposed = true;
		},
	};
}
