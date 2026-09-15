"use client";

import { useCallback, useState } from "react";

interface StatusDepartureInput<Item extends { id: string }> {
	items: readonly Item[];
	stateChangeVersions?: ReadonlyMap<string, number>;
	stateChangedItemIds?: ReadonlySet<string>;
	reduceMotion: boolean;
}

interface StatusDepartureState<Item extends { id: string }> {
	input: StatusDepartureInput<Item>;
	visualItems: readonly Item[];
	seenVersions: ReadonlyMap<string, number>;
	exitingItemIds: ReadonlySet<string>;
}

/** Hold the old visual order until its changed rows have faded at their old slots. */
export function advanceAgentSessionStatusDeparture<Item extends { id: string }>(
	previous: StatusDepartureState<Item> | undefined,
	input: StatusDepartureInput<Item>,
): StatusDepartureState<Item> {
	const seenVersions = new Map(previous?.seenVersions);
	const previousIds = new Set(previous?.visualItems.map(({ id }) => id));
	const currentIds = new Set(input.items.map(({ id }) => id));
	const exitingItemIds = new Set<string>();
	for (const [id, version] of input.stateChangeVersions ?? []) {
		const previousVersion = seenVersions.get(id);
		if (previousVersion !== undefined && version > previousVersion
			&& input.stateChangedItemIds?.has(id)
			&& previousIds.has(id) && currentIds.has(id) && !input.reduceMotion
			&& !(previous?.visualItems[0]?.id === id && input.items[0]?.id === id)) {
			exitingItemIds.add(id);
		}
		seenVersions.set(id, version);
	}
	if (previous?.exitingItemIds.size) {
		if (input.reduceMotion) {
			return { input, visualItems: input.items, seenVersions, exitingItemIds: new Set<string>() };
		}
		// The current data can keep changing during a departure. Preserve the
		// old painted order and release the latest data when the fade finishes.
		return { input, visualItems: previous.visualItems, seenVersions, exitingItemIds: previous.exitingItemIds };
	}
	if (exitingItemIds.size) {
		return { input, visualItems: previous?.visualItems ?? input.items, seenVersions, exitingItemIds };
	}
	return { input, visualItems: input.items, seenVersions, exitingItemIds };
}

export function completeAgentSessionStatusDeparture<Item extends { id: string }>(
	previous: StatusDepartureState<Item>,
	id: string,
): StatusDepartureState<Item> {
	if (!previous.exitingItemIds.has(id)) return previous;
	const exitingItemIds = new Set(previous.exitingItemIds);
	exitingItemIds.delete(id);
	return {
		...previous,
		exitingItemIds,
		visualItems: exitingItemIds.size ? previous.visualItems : previous.input.items,
	};
}

export function useAgentSessionStatusDeparture<Item extends { id: string }>(input: StatusDepartureInput<Item>) {
	const [state, setState] = useState(() => advanceAgentSessionStatusDeparture(undefined, input));
	let current = state;
	if (state.input.items !== input.items
		|| state.input.stateChangeVersions !== input.stateChangeVersions
		|| state.input.stateChangedItemIds !== input.stateChangedItemIds
		|| state.input.reduceMotion !== input.reduceMotion) {
		current = advanceAgentSessionStatusDeparture(state, input);
		setState(current);
	}
	const onDepartureComplete = useCallback((id: string) => {
		setState((previous) => completeAgentSessionStatusDeparture(previous, id));
	}, []);
	return {
		items: current.visualItems,
		exitingItemIds: current.exitingItemIds,
		onDepartureComplete,
	};
}
