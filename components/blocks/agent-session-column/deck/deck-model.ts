import type { Transition } from "motion/react";

// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension here.
import { SCROLLING_DEPTH_LIFT_PX, SCROLLING_DEPTH_MIN_SCALE, SCROLLING_DEPTH_ZONE_PX } from "../../../visual/scrolling/data.ts";
// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension here.
import { FAN_OPACITY_INPUT, fanOffset, fanOpacity } from "../../../visual/scrolling/lib.ts";
// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension here.
import { cardTopFrom, depthGate, depthLift, depthProgress, depthScale, fanAnchor, fansIn, type ScrollingDepth, type ScrollingEntranceOrigin, type ScrollingStackOrder } from "../../../visual/scrolling/stack-layout.ts";

export interface AgentSessionDeckEntrance {
	readonly origin: ScrollingEntranceOrigin;
	readonly transition: Transition;
}

/**
 * The column has no Ticker drag, so there is no inertia throw; native scroll momentum remains.
 */
export interface AgentSessionDeck {
	readonly depth: ScrollingDepth;
	readonly stackOrder: ScrollingStackOrder;
	readonly entrance: AgentSessionDeckEntrance | null;
}

export const AGENT_SESSION_DECK_FLAT: AgentSessionDeck = {
	depth: "none",
	entrance: null,
	stackOrder: "first-on-top",
};

export const AGENT_SESSION_DECK_STACKED: AgentSessionDeck = {
	depth: "bottom",
	entrance: null,
	stackOrder: "first-on-top",
};

/**
 * One complete depth zone after the final row. At maximum scroll the last
 * session can therefore leave the bottom tuck, returning to its laid-out
 * position and full scale instead of ending inside the effect.
 */
export const AGENT_SESSION_DECK_END_SPACE_PX = SCROLLING_DEPTH_ZONE_PX;

export function resolveAgentSessionDeckMotion(
	deck: AgentSessionDeck,
	shouldReduceMotion: boolean,
): AgentSessionDeck {
	if (!shouldReduceMotion) {
		return deck;
	}
	return {
		depth: "none",
		entrance: null,
		stackOrder: deck.stackOrder,
	};
}

export function isAgentSessionDeckActive(deck: AgentSessionDeck): boolean {
	return deck.depth !== "none" || deck.entrance !== null;
}

/**
 * Collapse belongs only to the optional entrance. A depth-only deck must stay
 * fully laid out across scrollport remounts or its depth gate remains closed.
 */
export function resolveAgentSessionDeckCollapse(
	deck: AgentSessionDeck,
	entrancePlayed: boolean,
): 0 | 1 {
	return deck.entrance !== null && !entrancePlayed ? 1 : 0;
}

export interface DeckRow {
	readonly marked: boolean;
	readonly top: number;
	readonly height: number;
}

export interface DeckRun {
	readonly rows: readonly DeckRow[];
	readonly top: number;
	readonly height: number;
}

export interface DeckRunFrame {
	readonly y: number;
	readonly scale: number;
	readonly opacity: number;
	readonly originTop: number;
}

function isFiniteNumber(value: number): boolean {
	return Number.isFinite(value);
}

function identityFrame(originTop: number): DeckRunFrame {
	return {
		opacity: 1,
		originTop,
		scale: 1,
		y: 0,
	};
}

function runOriginTop(depth: ScrollingDepth, run: DeckRun, centre: number): number {
	switch (depth) {
		case "bottom":
			return run.top + run.height;
		case "both":
			return centre;
		case "none":
			return centre;
		default: {
			const exhaustive: never = depth;
			return exhaustive;
		}
	}
}

export function groupDeckRuns(rows: readonly DeckRow[]): readonly DeckRun[] {
	const runs: DeckRun[] = [];
	let start = 0;
	for (let index = 0; index < rows.length; index++) {
		const current = rows[index];
		const next = rows[index + 1];
		if (current === undefined) {
			break;
		}
		if (current.marked && next !== undefined && next.marked) {
			continue;
		}
		const first = rows[start];
		if (first === undefined) {
			break;
		}
		runs.push({
			height: current.top + current.height - first.top,
			rows: rows.slice(start, index + 1),
			top: first.top,
		});
		start = index + 1;
	}
	return runs;
}

export function deckRunFrame(
	run: DeckRun,
	portLength: number,
	scrollTop: number,
	collapse: number,
	deck: AgentSessionDeck,
): DeckRunFrame {
	const top = cardTopFrom(-scrollTop, run.top, 0);
	const centre = top + run.height / 2;
	if (
		!isFiniteNumber(portLength) ||
		portLength <= 0 ||
		!isFiniteNumber(scrollTop) ||
		!isFiniteNumber(collapse)
	) {
		return identityFrame(centre);
	}

	let fanY = 0;
	let opacity = 1;
	// pitch is 0: a finite list has no loop period, so fansIn is a plain on-screen
	// test. Ticker uses it only for the entrance fan — depth must still run for
	// cards just below the clip, or depthLift cannot pull them into the tail.
	if (
		deck.entrance !== null &&
		collapse > 0 &&
		fansIn(top, run.height, portLength, 0)
	) {
		const anchor = fanAnchor(deck.entrance.origin, portLength, run.height);
		fanY = fanOffset(collapse, centre, anchor);
		opacity = fanOpacity(collapse);
	}

	// A fused selection taller than the depth zone cannot tuck as one card.
	// Scaling about its distant bottom shrinks visible rows and pulls the first
	// row down into the viewport. Keep that run flat while preserving its joins.
	const depth = run.rows.length > 1 && run.height > SCROLLING_DEPTH_ZONE_PX
		? "none"
		: deck.depth;
	const raw = depthProgress(centre, portLength, SCROLLING_DEPTH_ZONE_PX, depth);
	const tail = raw * depthGate(collapse, FAN_OPACITY_INPUT[1]);
	const y = fanY + depthLift(tail, SCROLLING_DEPTH_LIFT_PX);
	const scale = depthScale(tail, SCROLLING_DEPTH_MIN_SCALE);

	// Fused marked rows scale about one point; originTop is shared across the run.
	return {
		opacity,
		originTop: runOriginTop(deck.depth, run, run.top + run.height / 2),
		scale,
		y,
	};
}

export function isIdentityFrame(frame: DeckRunFrame): boolean {
	return frame.y === 0 && frame.scale === 1 && frame.opacity === 1;
}
