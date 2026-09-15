/** The tucked gutter rail shows the latest ten sessions at rest; older sessions stay scrollable. Hover preview omits the cap. */
export const AGENT_SESSION_RAIL_MAX_VISIBLE_ITEMS = 10;
export const AGENT_SESSION_RAIL_ITEM_HEIGHT_PX = 24;
export const AGENT_SESSION_RAIL_ITEM_GAP_PX = 0;
// The visual 20px anchors add another 2px at each end inside their targets.
export const AGENT_SESSION_RAIL_FOCUS_GUTTER_PX = 4;

export interface AgentSessionRailOrderStage<Item extends { id: string; state: string }> {
	inputItems: readonly Item[];
	inputVersions?: ReadonlyMap<string, number>;
	visibleItems: readonly Item[];
	phase: "rest" | "exit" | "enter";
	changingItemId: string | null;
}

/** Keep the previous order long enough to retire its mark before the new top arrival. */
export function advanceAgentSessionRailOrder<Item extends { id: string; state: string }>(
	previous: AgentSessionRailOrderStage<Item> | undefined,
	items: readonly Item[],
	versions: ReadonlyMap<string, number> | undefined,
	reduceMotion: boolean,
): AgentSessionRailOrderStage<Item> {
	if (previous === undefined) {
		return { inputItems: items, inputVersions: versions, visibleItems: items, phase: "rest", changingItemId: null };
	}
	if (previous.inputItems === items && previous.inputVersions === versions && !reduceMotion) {
		return previous;
	}
	if (reduceMotion) {
		return { inputItems: items, inputVersions: versions, visibleItems: items, phase: "rest", changingItemId: null };
	}
	if (previous.phase === "exit" && previous.changingItemId !== null) {
		const stillVisible = items.some((item) => item.id === previous.changingItemId);
		return {
			inputItems: items,
			inputVersions: versions,
			visibleItems: stillVisible ? previous.visibleItems : items,
			phase: stillVisible ? "exit" : "rest",
			changingItemId: stillVisible ? previous.changingItemId : null,
		};
	}
	const previousItems = new Map(previous.visibleItems.map((item) => [item.id, item]));
	const changingItem = items.find((item) => {
		const oldItem = previousItems.get(item.id);
		const oldVersion = previous.inputVersions?.get(item.id);
		const nextVersion = versions?.get(item.id);
		return oldItem !== undefined
			&& oldItem.state !== item.state
			&& oldVersion !== undefined
			&& nextVersion !== undefined
			&& nextVersion > oldVersion;
	});
	if (changingItem !== undefined) {
		if (previous.visibleItems[0]?.id === changingItem.id && items[0]?.id === changingItem.id) {
			return {
				inputItems: items,
				inputVersions: versions,
				visibleItems: items,
				phase: "rest",
				changingItemId: null,
			};
		}
		return {
			inputItems: items,
			inputVersions: versions,
			visibleItems: previous.visibleItems,
			phase: "exit",
			changingItemId: changingItem.id,
		};
	}
	return {
		inputItems: items,
		inputVersions: versions,
		visibleItems: items,
		phase: previous.phase === "enter" ? "enter" : "rest",
		changingItemId: previous.phase === "enter" ? previous.changingItemId : null,
	};
}

export function releaseAgentSessionRailOrder<Item extends { id: string; state: string }>(
	stage: AgentSessionRailOrderStage<Item>,
): AgentSessionRailOrderStage<Item> {
	return stage.phase === "exit"
		? { ...stage, visibleItems: stage.inputItems, phase: "enter" }
		: stage;
}

export function settleAgentSessionRailOrder<Item extends { id: string; state: string }>(
	stage: AgentSessionRailOrderStage<Item>,
): AgentSessionRailOrderStage<Item> {
	return stage.phase === "enter"
		? { ...stage, phase: "rest", changingItemId: null }
		: stage;
}

/**
 * Extra pointer space on each side of a collapsed rail target. The 32px
 * column stays put; notches, the header count, and the list all share this
 * so a hover-scaled gutter preview is one 24px-tall, 56px-wide band.
 */
export function toAgentSessionRailHitSlopStyle(hitSlopPx: number): {
	marginInline: number;
	width: string;
} {
	return {
		marginInline: -hitSlopPx,
		width: `calc(100% + ${hitSlopPx * 2}px)`,
	};
}

/**
 * Caps the collapsed gutter rail to a ten-notch window at rest. Hover
 * preview and column presentation omit `maxVisibleItems` so the list can
 * show every session inside the column height instead of faking a ten-dot
 * viewport.
 */
export function toAgentSessionRailViewportMaxHeight(
	itemCount: number,
	maxVisibleItems: number | undefined,
): number | undefined {
	if (maxVisibleItems === undefined) {
		return undefined;
	}

	const visibleItemCount = Math.min(itemCount, maxVisibleItems);
	if (visibleItemCount === 0) {
		return 0;
	}

	return visibleItemCount * AGENT_SESSION_RAIL_ITEM_HEIGHT_PX
		+ (visibleItemCount - 1) * AGENT_SESSION_RAIL_ITEM_GAP_PX
		+ AGENT_SESSION_RAIL_FOCUS_GUTTER_PX;
}
