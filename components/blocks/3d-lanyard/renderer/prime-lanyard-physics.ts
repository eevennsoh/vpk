import { primeSimulation } from "./physics";
import type { PhysicsRequest, PhysicsResult } from "./types";

const primed = new Map<number, Promise<void>>();

/**
 * Simulates the drop for each of `swings` in a worker and primes the
 * renderer's cache with it, so no frame drawn at those swings ever runs the
 * physics (a long task) on the main thread. Resolves once every one is in.
 * Without a worker, or if it fails, it resolves anyway and each swing is
 * simulated on its first draw, as before. The cache keeps three swings.
 */
export function primeLanyardPhysics(swings: readonly number[]): Promise<void> {
	const wanted = [...new Set(swings)].filter((swing) => !primed.has(swing));
	if (wanted.length > 0) {
		const settled = new Map<number, () => void>();
		for (const swing of wanted) primed.set(swing, new Promise((resolve) => settled.set(swing, resolve)));
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
				primeSimulation(amount, simulation);
				settled.get(amount)?.();
				settled.delete(amount);
				if (settled.size === 0) worker.terminate();
			};
			worker.onerror = close;
			worker.onmessageerror = close;
			worker.postMessage({ amounts: wanted } satisfies PhysicsRequest);
		} catch {
			finish();
		}
	}
	return Promise.all(swings.map((swing) => primed.get(swing))).then(() => undefined);
}
