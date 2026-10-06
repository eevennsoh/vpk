import { hasSimulation, primeSimulation, simulationKey } from "./physics";
import type { PhysicsRequest, PhysicsResult } from "./types";

/** Swings a worker is simulating now, by `simulationKey`. */
const inFlight = new Map<number, Promise<void>>();

/**
 * Simulates the drop for each of `swings` in a worker and primes the
 * renderer's cache with it, so no frame drawn at those swings ever runs the
 * physics (a long task) on the main thread. Resolves once every one is in.
 * A swing already kept resolves at once; one the cache has since dropped (it
 * keeps three) is simulated again. Without a worker, or if it fails, it
 * resolves anyway and each swing is simulated on its first draw, as before.
 */
export function primeLanyardPhysics(swings: readonly number[]): Promise<void> {
	const keys = [...new Set(swings.map(simulationKey))];
	const wanted = keys.filter((key) => !inFlight.has(key) && !hasSimulation(key));
	if (wanted.length > 0) {
		const settled = new Map<number, () => void>();
		for (const key of wanted) {
			inFlight.set(key, new Promise<void>((resolve) => settled.set(key, resolve)).finally(() => inFlight.delete(key)));
		}
		const finish = () => {
			for (const resolve of settled.values()) resolve();
			settled.clear();
		};
		try {
			const worker = new Worker(new URL("./physics.worker.ts", import.meta.url), { type: "module" });
			const close = () => {
				worker.terminate();
				finish();
			};
			worker.onmessage = (event: MessageEvent<PhysicsResult>) => {
				const { amount, simulation } = event.data;
				const key = simulationKey(amount);
				primeSimulation(key, simulation);
				settled.get(key)?.();
				settled.delete(key);
				if (settled.size === 0) worker.terminate();
			};
			worker.onerror = close;
			worker.onmessageerror = close;
			worker.postMessage({ amounts: wanted } satisfies PhysicsRequest);
		} catch {
			finish();
		}
	}
	return Promise.all(keys.map((key) => inFlight.get(key))).then(() => undefined);
}
