import type { JiraInsightCheckpoint } from "@/components/blocks/jira-insight/jira-insight-types";

const MIN_TICK_HEIGHT = 16;
const MAX_TICK_HEIGHT = 44;

type TimelineCheckpoint = Pick<JiraInsightCheckpoint, "capturedAtMs" | "sources">;

export type JiraInsightTimelineTick =
	| { kind: "activity"; capturedAtMs: number }
	| { kind: "insight"; capturedAtMs: number; checkpointIndex: number };

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function median(values: readonly number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0
		? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
		: sorted[middle] ?? 0;
}

export function buildJiraInsightTimelineTicks(
	checkpoints: readonly TimelineCheckpoint[],
	activityTimestamps: readonly number[] = [],
): JiraInsightTimelineTick[] {
	const insightTimestamps = new Set(checkpoints.map((checkpoint) => checkpoint.capturedAtMs));
	const uniqueActivityTimestamps = [...new Set(activityTimestamps)]
		.filter((capturedAtMs) => Number.isFinite(capturedAtMs) && !insightTimestamps.has(capturedAtMs));
	return [
		...checkpoints.map((checkpoint, checkpointIndex) => ({
			kind: "insight" as const,
			capturedAtMs: checkpoint.capturedAtMs,
			checkpointIndex,
		})),
		...uniqueActivityTimestamps.map((capturedAtMs) => ({
			kind: "activity" as const,
			capturedAtMs,
		})),
	].sort((left, right) => left.capturedAtMs - right.capturedAtMs);
}

function getLocalDensity(checkpoints: readonly TimelineCheckpoint[], index: number): number {
	if (checkpoints.length < 3) return 0;
	const gaps = checkpoints
		.slice(1)
		.map((checkpoint, gapIndex) => checkpoint.capturedAtMs - checkpoints[gapIndex].capturedAtMs)
		.filter((gap) => gap > 0);
	const typicalGap = median(gaps);
	if (typicalGap <= 0) return 0;

	const previousGap = index > 0
		? checkpoints[index].capturedAtMs - checkpoints[index - 1].capturedAtMs
		: Number.POSITIVE_INFINITY;
	const nextGap = index < checkpoints.length - 1
		? checkpoints[index + 1].capturedAtMs - checkpoints[index].capturedAtMs
		: Number.POSITIVE_INFINITY;
	const nearestGap = Math.min(previousGap, nextGap);
	return clamp(1 - nearestGap / typicalGap, 0, 1);
}

export function getTimelineTickHeight(
	checkpoints: readonly TimelineCheckpoint[],
	index: number,
	explicitImportance?: number,
): number {
	const checkpoint = checkpoints[index];
	if (!checkpoint) return MIN_TICK_HEIGHT;
	const score = explicitImportance === undefined
		? Math.min(checkpoint.sources.length / 4, 1) * 0.7 + getLocalDensity(checkpoints, index) * 0.3
		: clamp(explicitImportance, 0, 1);
	return Math.round(MIN_TICK_HEIGHT + score * (MAX_TICK_HEIGHT - MIN_TICK_HEIGHT));
}

export function getTimelineKeyTargetIndex(
	key: string,
	currentIndex: number,
	checkpointCount: number,
): number | null {
	if (checkpointCount <= 0) return null;
	switch (key) {
		case "ArrowLeft":
			return Math.max(0, currentIndex - 1);
		case "ArrowRight":
			return Math.min(checkpointCount - 1, currentIndex + 1);
		case "Home":
			return 0;
		case "End":
			return checkpointCount - 1;
		default:
			return null;
	}
}

export function getTimelineWheelDelta({
	deltaX,
	deltaY,
}: Readonly<{ deltaX: number; deltaY: number }>): number {
	return Math.abs(deltaY) > Math.abs(deltaX) ? deltaY : 0;
}

export function findNearestTimelineCheckpointIndex(
	position: number,
	trackWidth: number,
	checkpointCount: number,
): number | null {
	if (trackWidth <= 0 || checkpointCount <= 0) return null;
	const normalizedPosition = clamp(position / trackWidth, 0, 1 - Number.EPSILON);
	return Math.min(checkpointCount - 1, Math.floor(normalizedPosition * checkpointCount));
}

interface TimelineViewportGeometry {
	clientWidth: number;
	scrollLeft: number;
	getBoundingClientRect: () => Pick<DOMRect, "left">;
}

interface TimelineButtonGeometry {
	getBoundingClientRect: () => Pick<DOMRect, "left" | "width">;
}

export function findNearestVisibleTimelineButtonIndex(
	viewport: TimelineViewportGeometry,
	buttons: readonly (TimelineButtonGeometry | null)[],
): number | null {
	const viewportCenter = viewport.scrollLeft + viewport.clientWidth / 2;
	const viewportLeft = viewport.getBoundingClientRect().left;
	let closestIndex: number | null = null;
	let closestDistance = Number.POSITIVE_INFINITY;

	for (let index = 0; index < buttons.length; index += 1) {
		const button = buttons[index];
		if (button === null) continue;
		const buttonRect = button.getBoundingClientRect();
		const buttonCenter = viewport.scrollLeft + buttonRect.left - viewportLeft + buttonRect.width / 2;
		const distance = Math.abs(buttonCenter - viewportCenter);
		if (distance < closestDistance) {
			closestDistance = distance;
			closestIndex = index;
		}
	}

	return closestIndex;
}
