"use client";

import { useCallback, useState } from "react";

interface ArrivalInput {
	items: readonly { id: string }[];
	newItemIds?: ReadonlySet<string>;
	presentation: string;
	reduceMotion: boolean;
}

interface ArrivalState {
	input: ArrivalInput;
	seen: ReadonlySet<string>;
	arriving: ReadonlySet<string>;
}

/** First appearance consumes the entrance, including an interrupted or reduced-motion one. */
export function advanceAgentSessionArrivals(previous: ArrivalState | undefined, input: ArrivalInput): ArrivalState {
	const seen = new Set(previous?.seen);
	const arriving = new Set<string>();
	for (const { id } of input.items) {
		if (!input.reduceMotion && input.newItemIds?.has(id) && (
			!seen.has(id)
			|| (previous?.input.presentation === input.presentation && previous.arriving.has(id))
		)) {
			arriving.add(id);
		}
		seen.add(id);
	}
	return { input, seen, arriving };
}

export function useAgentSessionArrivals(input: ArrivalInput) {
	const [state, setState] = useState(() => advanceAgentSessionArrivals(undefined, input));
	let current = state;
	if (state.input.items !== input.items
		|| state.input.newItemIds !== input.newItemIds
		|| state.input.presentation !== input.presentation
		|| state.input.reduceMotion !== input.reduceMotion) {
		// Adjust before rendering children: an effect would allow a remounted
		// avatar to flash its entrance before learning it had already appeared.
		current = advanceAgentSessionArrivals(state, input);
		setState(current);
	}
	const onArrivalComplete = useCallback((id: string) => {
		setState((previous) => {
			if (!previous.arriving.has(id)) return previous;
			const arriving = new Set(previous.arriving);
			arriving.delete(id);
			return { ...previous, arriving };
		});
	}, []);
	return { arrivingItemIds: current.arriving, onArrivalComplete };
}
