/**
 * Reads the board now and on every following frame until a reading is due:
 * for waits that must see the page hold still across frames rather than trust
 * one reading. `settle` gets the previous frame's reading (null on the first)
 * and the current one, and returns the result once it is due. `read` returning
 * null ends the wait with null: there is nothing left to wait for. An abort
 * ends it with null at once, as does `timeoutMs` when given; without one it
 * waits for as long as the page has frames. The frame loop never outlives the
 * wait.
 */
export function waitForFinaleStillFrames<Reading, Result>(
	read: () => Reading | null,
	settle: (previous: Reading | null, next: Reading) => Result | null,
	{ signal, timeoutMs }: Readonly<{ signal?: AbortSignal; timeoutMs?: number }> = {},
): Promise<Result | null> {
	return new Promise((resolve) => {
		let frame = 0;
		let timeout: ReturnType<typeof setTimeout> | undefined;
		let previous: Reading | null = null;
		const finish = (result: Result | null) => {
			cancelAnimationFrame(frame);
			if (timeout !== undefined) clearTimeout(timeout);
			signal?.removeEventListener("abort", abort);
			resolve(result);
		};
		const abort = () => finish(null);
		const check = () => {
			if (signal?.aborted) { finish(null); return; }
			const reading = read();
			if (reading === null) { finish(null); return; }
			const result = settle(previous, reading);
			if (result !== null) { finish(result); return; }
			previous = reading;
			frame = requestAnimationFrame(check);
		};
		signal?.addEventListener("abort", abort, { once: true });
		if (timeoutMs !== undefined) timeout = setTimeout(abort, timeoutMs);
		check();
	});
}
