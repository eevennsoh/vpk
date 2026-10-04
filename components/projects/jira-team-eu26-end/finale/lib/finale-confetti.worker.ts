/**
 * Runs the finale confetti off the main thread. The burst flies while the main
 * thread prints the Done column and mounts the finale (both long tasks), so
 * only a worker-owned OffscreenCanvas keeps it at the display's frame rate.
 */

import { createFinaleConfettiPlayer, type FinaleConfettiCommand, type FinaleConfettiEvent } from "./finale-confetti-renderer";

// The project's TS lib is DOM-only; type just the worker surface this uses.
const scope = globalThis as unknown as {
	onmessage: ((event: MessageEvent<FinaleConfettiCommand>) => void) | null;
	postMessage: (event: FinaleConfettiEvent) => void;
};

const player = createFinaleConfettiPlayer((event) => scope.postMessage(event));
scope.onmessage = (event) => player.handle(event.data);
