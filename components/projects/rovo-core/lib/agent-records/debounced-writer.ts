/**
 * One owner for a debounced write and its flush. `schedule` restarts the wait, `flush` writes
 * now if a write is waiting, and `cancel` drops it. There is one timer, so a flush can never
 * race a cleanup that already cleared it.
 */
export interface DebouncedWriter {
	readonly schedule: () => void;
	readonly flush: () => void;
	readonly cancel: () => void;
}

export function createDebouncedWriter(write: () => void, delayMs: number): DebouncedWriter {
	let timer: ReturnType<typeof setTimeout> | null = null;
	const run = () => {
		timer = null;
		write();
	};
	return {
		schedule: () => {
			if (timer !== null) {
				clearTimeout(timer);
			}
			timer = setTimeout(run, delayMs);
		},
		flush: () => {
			if (timer === null) {
				return;
			}
			clearTimeout(timer);
			run();
		},
		cancel: () => {
			if (timer !== null) {
				clearTimeout(timer);
				timer = null;
			}
		},
	};
}
