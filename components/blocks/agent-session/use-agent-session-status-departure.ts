"use client";

import { useCallback, useState } from "react";

interface StatusDepartureInput<Item extends { id: string }> {
	items: readonly Item[];
	arrivingItemIds?: ReadonlySet<string>;
	stateChangeVersions?: ReadonlyMap<string, number>;
	stateChangedItemIds?: ReadonlySet<string>;
	reduceMotion: boolean;
}

interface StatusDepartureState<Item extends { id: string }> {
	input: StatusDepartureInput<Item>;
	target: StatusDepartureInput<Item>;
	queued: readonly StatusDepartureInput<Item>[];
	visualItems: readonly Item[];
	visualArrivingItemIds?: ReadonlySet<string>;
	seenVersions: ReadonlyMap<string, number>;
	departingItemIds: ReadonlySet<string>;
	exitingItemIds: ReadonlySet<string>;
}

function isRevision(
	id: string,
	versions: ReadonlyMap<string, number> | undefined,
	input: StatusDepartureInput<{ id: string }>,
) {
	const before = versions?.get(id);
	const after = input.stateChangeVersions?.get(id);
	return before !== undefined && after !== undefined && after > before && input.stateChangedItemIds?.has(id);
}

function present<Item extends { id: string }>(
	previous: StatusDepartureState<Item> | undefined,
	target: StatusDepartureInput<Item>,
): StatusDepartureState<Item> {
	const before = new Set(previous?.visualItems.map(({ id }) => id));
	const exitingItemIds = new Set<string>();
	const arrivals = target.arrivingItemIds === undefined ? undefined : new Set<string>();
	if (!target.reduceMotion) {
		for (const { id } of target.items) {
			if (isRevision(id, previous?.seenVersions, target) && before.has(id)
				&& !(previous?.visualItems[0]?.id === id && target.items[0]?.id === id)) {
				exitingItemIds.add(id);
				arrivals?.add(id);
			} else if (!before.has(id) && target.arrivingItemIds?.has(id)) {
				arrivals?.add(id);
			}
		}
	}
	return {
		input: target,
		target,
		queued: [],
		visualItems: exitingItemIds.size && previous ? previous.visualItems : target.items,
		visualArrivingItemIds: arrivals,
		seenVersions: new Map([...previous?.seenVersions ?? [], ...target.stateChangeVersions ?? []]),
		departingItemIds: exitingItemIds,
		exitingItemIds,
	};
}

function presentNext<Item extends { id: string }>(state: StatusDepartureState<Item>): StatusDepartureState<Item> {
	const [next, ...queued] = state.queued;
	if (next === undefined) return present(state, state.input);
	return { ...present(state, next), input: state.input, queued };
}

/** Give each sync update its own departure and entrance, in the order received. */
export function advanceAgentSessionStatusDeparture<Item extends { id: string }>(
	previous: StatusDepartureState<Item> | undefined,
	input: StatusDepartureInput<Item>,
): StatusDepartureState<Item> {
	if (!previous || input.reduceMotion) return present(previous, input);
	if (!previous.exitingItemIds.size && !previous.visualArrivingItemIds?.size) return present(previous, input);

	const before = new Set(previous.input.items.map(({ id }) => id));
	const after = new Set(input.items.map(({ id }) => id));
	if ([...before].some((id) => !after.has(id))) {
		// Filters and user removals take effect immediately, even mid-animation.
		return present(previous, input);
	}
	const syncUpdate = input.items.some(({ id }) => (
		(!before.has(id) && input.arrivingItemIds?.has(id)) || isRevision(id, previous.input.stateChangeVersions, input)
	));
	return {
		...previous,
		input,
		queued: syncUpdate ? [...previous.queued, input] : previous.queued,
	};
}

export function completeAgentSessionStatusDeparture<Item extends { id: string }>(
	previous: StatusDepartureState<Item>, id: string,
): StatusDepartureState<Item> {
	if (!previous.exitingItemIds.has(id)) return previous;
	const exitingItemIds = new Set(previous.exitingItemIds);
	exitingItemIds.delete(id);
	if (exitingItemIds.size) return { ...previous, exitingItemIds };
	const entered = {
		...previous,
		exitingItemIds,
		departingItemIds: exitingItemIds,
		visualItems: previous.queued.length ? previous.target.items : previous.input.items,
	};
	return entered.visualArrivingItemIds?.size ? entered : presentNext(entered);
}

export function completeAgentSessionArrival<Item extends { id: string }>(
	previous: StatusDepartureState<Item>, id: string,
): StatusDepartureState<Item> {
	if (previous.exitingItemIds.size || !previous.visualArrivingItemIds?.has(id)) return previous;
	const visualArrivingItemIds = new Set(previous.visualArrivingItemIds);
	visualArrivingItemIds.delete(id);
	const settled = { ...previous, visualArrivingItemIds };
	return visualArrivingItemIds.size ? settled : presentNext(settled);
}

export function useAgentSessionStatusDeparture<Item extends { id: string }>(input: StatusDepartureInput<Item>) {
	const [state, setState] = useState(() => advanceAgentSessionStatusDeparture(undefined, input));
	let current = state;
	if (state.input.items !== input.items
		|| state.input.arrivingItemIds !== input.arrivingItemIds
		|| state.input.stateChangeVersions !== input.stateChangeVersions
		|| state.input.stateChangedItemIds !== input.stateChangedItemIds
		|| state.input.reduceMotion !== input.reduceMotion) {
		current = advanceAgentSessionStatusDeparture(state, input);
		setState(current);
	}
	const onDepartureComplete = useCallback((id: string) => {
		setState((previous) => completeAgentSessionStatusDeparture(previous, id));
	}, []);
	const onArrivalComplete = useCallback((id: string) => {
		setState((previous) => completeAgentSessionArrival(previous, id));
	}, []);
	return {
		items: current.visualItems,
		arrivingItemIds: current.visualArrivingItemIds,
		stateChangedItemIds: current.target.stateChangedItemIds,
		seenVersions: current.seenVersions,
		exitingItemIds: current.departingItemIds,
		onDepartureComplete,
		onArrivalComplete,
	};
}
