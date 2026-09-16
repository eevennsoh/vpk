/** Retain one intent-prepared preview; a new row retires the previous context. */
export function createSessionPeelPreparation() {
	let preparedId: string | null = null;
	const listeners = new Set<() => void>();
	const publish = (id: string | null) => {
		if (preparedId === id) return;
		preparedId = id;
		for (const listener of listeners) listener();
	};
	return {
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => { listeners.delete(listener); };
		},
		isPrepared: (id: string) => preparedId === id,
		prepare: (id: string) => publish(id),
		release(id: string) {
			if (preparedId === id) publish(null);
		},
	};
}
