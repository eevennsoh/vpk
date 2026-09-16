/** Latest input, one geometry/update pass per frame, with explicit retirement. */
export function createLatestAnimationFrame<T>({ requestFrame, cancelFrame, onFrame }: Readonly<{
	requestFrame: (callback: () => void) => number;
	cancelFrame: (id: number) => void;
	onFrame: (value: T) => void;
}>) {
	let frameId: number | null = null;
	let latest: { value: T } | null = null;
	let disposed = false;
	const cancel = () => {
		if (frameId !== null) cancelFrame(frameId);
		frameId = null;
		latest = null;
	};
	return {
		schedule(value: T) {
			if (disposed) return;
			latest = { value };
			if (frameId !== null) return;
			frameId = requestFrame(() => {
				frameId = null;
				const pending = latest;
				latest = null;
				if (!disposed && pending) onFrame(pending.value);
			});
		},
		cancel,
		dispose() { disposed = true; cancel(); },
	};
}
