"use client";

import { useCallback, useState } from "react";

interface ArrivalInput {
	items: readonly { id: string }[];
	newItemIds?: ReadonlySet<string>;
	stateChangeVersions?: ReadonlyMap<string, number>;
	presentation: string;
	reduceMotion: boolean;
}

interface ArrivalState {
	input: ArrivalInput;
	seen: ReadonlySet<string>;
	arriving: ReadonlySet<string>;
	seenStateChangeVersions: ReadonlyMap<string, number>;
	stateChanged: ReadonlySet<string>;
}

/** First appearance consumes the entrance, including an interrupted or reduced-motion one. */
export function advanceAgentSessionArrivals(previous: ArrivalState | undefined, input: ArrivalInput): ArrivalState {
	const seen = new Set(previous?.seen);
	const arriving = new Set<string>();
	const stateChanged = new Set<string>();
	const iconOnlyChanges = new Set<string>();
	const seenStateChangeVersions = new Map(previous?.seenStateChangeVersions);
	const visibleIds = new Set(input.items.map(({ id }) => id));
	const expanded = input.presentation.startsWith("expanded:");
	for (const [id, version] of input.stateChangeVersions ?? []) {
		const previousVersion = seenStateChangeVersions.get(id);
		const changed = previousVersion !== undefined && version > previousVersion;
		// A filtered-out change is consumed now, so revealing the row later does
		// not mistake a filter toggle for a newly changed session.
		if (changed && visibleIds.has(id) && seen.has(id) && !input.reduceMotion) {
			const remainsFirst = expanded
				&& previous?.input.items[0]?.id === id
				&& input.items[0]?.id === id;
			if (remainsFirst) iconOnlyChanges.add(id);
			else arriving.add(id);
			if (expanded) stateChanged.add(id);
		}
		seenStateChangeVersions.set(id, version);
	}
	for (const { id } of input.items) {
		if (!input.reduceMotion && input.newItemIds?.has(id) && !seen.has(id)) {
			arriving.add(id);
		}
		if (!input.reduceMotion && !iconOnlyChanges.has(id)
			&& previous?.input.presentation === input.presentation && previous.arriving.has(id)) {
			arriving.add(id);
		}
		if (!input.reduceMotion && previous?.input.presentation === input.presentation && previous.stateChanged.has(id)) {
			stateChanged.add(id);
		}
		seen.add(id);
	}
	return { input, seen, arriving, seenStateChangeVersions, stateChanged };
}

export function useAgentSessionArrivals(input: ArrivalInput) {
	const [state, setState] = useState(() => advanceAgentSessionArrivals(undefined, input));
	let current = state;
	if (state.input.items !== input.items
		|| state.input.newItemIds !== input.newItemIds
		|| state.input.stateChangeVersions !== input.stateChangeVersions
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
	const onStateChangeComplete = useCallback((id: string) => {
		setState((previous) => {
			if (!previous.stateChanged.has(id)) return previous;
			const stateChanged = new Set(previous.stateChanged);
			stateChanged.delete(id);
			return { ...previous, stateChanged };
		});
	}, []);
	return {
		arrivingItemIds: current.arriving,
		stateChangedItemIds: current.stateChanged,
		onArrivalComplete,
		onStateChangeComplete,
	};
}
