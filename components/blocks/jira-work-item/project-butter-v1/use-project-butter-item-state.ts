"use client";

import { useCallback, useState, type SetStateAction } from "react";

export function useProjectButterItemState<T extends object>(itemKey: string, initialState: T) {
	const [items, setItems] = useState<ReadonlyMap<string, T>>(() => new Map());
	const updateState = useCallback((update: (previous: T) => T) => {
		setItems((current) => new Map(current).set(itemKey, update(current.get(itemKey) ?? initialState)));
	}, [initialState, itemKey]);
	const fieldSetter = useCallback(<K extends keyof T>(field: K) => (update: SetStateAction<T[K]>) => {
		setItems((current) => {
			const previous = current.get(itemKey) ?? initialState;
			const value = typeof update === "function"
				? (update as (value: T[K]) => T[K])(previous[field])
				: update;
			return new Map(current).set(itemKey, { ...previous, [field]: value });
		});
	}, [initialState, itemKey]);
	return { state: items.get(itemKey) ?? initialState, fieldSetter, updateState };
}
