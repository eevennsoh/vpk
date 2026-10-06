/**
 * Simulates lanyard drops off the main thread. Each swing amount is a long
 * task (hundreds of milliseconds), so a page that animates while it waits
 * asks here instead (`primeLanyardPhysics`).
 */

import { simulate } from "./physics";
import type { PhysicsRequest, PhysicsResult } from "./types";

// The project's TS lib is DOM-only; type just the worker surface this uses.
const scope = globalThis as unknown as {
	onmessage: ((event: MessageEvent<PhysicsRequest>) => void) | null;
	postMessage: (message: PhysicsResult, transfer: Transferable[]) => void;
};

scope.onmessage = (event) => {
	for (const amount of event.data.amounts) {
		const simulation = simulate(amount);
		// Moved, not copied: this worker is done with it.
		scope.postMessage({ amount, simulation }, [simulation.data.buffer]);
	}
};
