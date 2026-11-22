import { useEffect, useMemo, useState } from "react";

import type { RovoUIMessage, ThinkingEventUpdate } from "@/lib/rovo-ui-messages";

import {
	STUDIO_AGENT_CREATION_FIRST_TURN_STEPS,
	STUDIO_AGENT_CREATION_FOLLOW_UP_STEPS,
	STUDIO_REPLAY_ANSWER_HOLD_MS,
	STUDIO_REPLAY_ANSWER_RESULT,
	STUDIO_REPLAY_DESIGNING_AGENT_CONTENT,
	STUDIO_REPLAY_DESIGNING_AGENT_LABEL,
	STUDIO_REPLAY_MESSAGE_ID,
	STUDIO_REPLAY_NARRATION_ROW_DELAY_MS,
	STUDIO_REPLAY_RESPONSE_HOLD_MS,
	STUDIO_REPLAY_TOOL_CALL_DELAY_MS,
	type ReplayMode,
	type RovoMessagePart,
	type StudioReplayContentRow,
	type StudioReplayPhase,
	type StudioReplayStep,
	type StudioReplayTimelineEntry,
} from "./chain-of-thought-demo-replay-steps";

function createReplayTimestamp(baseTimestampMs: number, offsetMs: number): string {
	return new Date(baseTimestampMs + offsetMs).toISOString();
}

function hasStudioReplayStepResult(step: StudioReplayStep): boolean {
	return step.output !== undefined || Boolean(step.outputPreview);
}

function createDesigningAgentStatusPart(
	turnId: string,
	timestamp: string
): RovoMessagePart {
	return {
		type: "data-thinking-status",
		id: `${turnId}-designing-agent-status`,
		data: {
			label: STUDIO_REPLAY_DESIGNING_AGENT_LABEL,
			content: STUDIO_REPLAY_DESIGNING_AGENT_CONTENT,
			activity: "data",
			source: "backend",
			timestamp,
		},
	} as RovoMessagePart;
}

function createStudioReplayStatusPart(
	step: StudioReplayStep,
	row: StudioReplayContentRow,
	rowIndex: number,
	timestamp: string
): RovoMessagePart {
	const output = row.output ?? row.outputPreview;
	const data: Record<string, unknown> = {
		label: step.label,
		content: row.content,
		toolCallId: step.toolCallId,
		activity: "data",
		source: "backend",
		timestamp,
	};

	if (row.input !== undefined) {
		data.input = row.input;
	}
	if (output !== undefined) {
		data.output = output;
	}

	return {
		type: "data-thinking-status",
		id: `${step.toolCallId}-status-${rowIndex}`,
		data,
	} as RovoMessagePart;
}

function createStudioReplayEventPart(
	step: StudioReplayStep,
	phase: "start" | "result",
	timestamp: string
): RovoMessagePart {
	const data: ThinkingEventUpdate = {
		eventId: `${step.toolCallId}-${phase}`,
		phase,
		toolName: step.toolName,
		label: step.label,
		toolCallId: step.toolCallId,
		timestamp,
	};

	if (phase === "start" && step.input !== undefined) {
		data.input = step.input;
	}
	if (phase === "result") {
		data.output = step.output ?? step.outputPreview ?? "Completed.";
		if (step.outputPreview) {
			data.outputPreview = step.outputPreview;
		}
	}

	return {
		type: "data-thinking-event",
		id: `${step.toolCallId}-${phase}`,
		data,
	} as RovoMessagePart;
}

function createResolvedQuestionEventPart(timestamp: string): RovoMessagePart {
	const askStep = STUDIO_AGENT_CREATION_FIRST_TURN_STEPS[1];

	return {
		type: "data-thinking-event",
		id: `${askStep.toolCallId}-resolved`,
		data: {
			eventId: `${askStep.toolCallId}-resolved`,
			phase: "result",
			toolName: askStep.toolName,
			label: askStep.label,
			toolCallId: askStep.toolCallId,
			output: STUDIO_REPLAY_ANSWER_RESULT,
			outputPreview: STUDIO_REPLAY_ANSWER_RESULT,
			timestamp,
		},
	} as RovoMessagePart;
}

function createTurnCompletePart(timestamp: string): RovoMessagePart {
	return {
		type: "data-turn-complete",
		data: { timestamp },
	} as RovoMessagePart;
}

function appendStudioStepTimelineEntries({
	baseTimestampMs,
	entries,
	startAt,
	steps,
}: Readonly<{
	baseTimestampMs: number;
	entries: StudioReplayTimelineEntry[];
	startAt: number;
	steps: readonly StudioReplayStep[];
}>): number {
	let currentAt = startAt;

	for (const step of steps) {
		const [firstRow, ...restRows] = step.contentRows;
		const stepStartTimestamp = createReplayTimestamp(baseTimestampMs, currentAt);

		if (firstRow) {
			entries.push({
				at: currentAt,
				part: createStudioReplayStatusPart(step, firstRow, 0, stepStartTimestamp),
			});
		}
		entries.push({
			at: currentAt,
			part: createStudioReplayEventPart(step, "start", stepStartTimestamp),
		});

		const narrationBudgetMs = Math.min(
			restRows.length * STUDIO_REPLAY_NARRATION_ROW_DELAY_MS,
			Math.round(STUDIO_REPLAY_TOOL_CALL_DELAY_MS * 0.6),
		);
		const perRowDelayMs = restRows.length > 0
			? Math.round(narrationBudgetMs / restRows.length)
			: 0;

		for (const [offset, row] of restRows.entries()) {
			const rowAt = currentAt + perRowDelayMs * (offset + 1);
			entries.push({
				at: rowAt,
				part: createStudioReplayStatusPart(
					step,
					row,
					offset + 1,
					createReplayTimestamp(baseTimestampMs, rowAt),
				),
			});
		}

		const remainingRunMs = Math.max(0, STUDIO_REPLAY_TOOL_CALL_DELAY_MS - narrationBudgetMs);
		const hasResult = hasStudioReplayStepResult(step);
		const resultDelayMs = hasResult ? Math.round(remainingRunMs * 0.7) : remainingRunMs;
		const resultAt = currentAt + narrationBudgetMs + resultDelayMs;

		if (hasResult) {
			entries.push({
				at: resultAt,
				part: createStudioReplayEventPart(
					step,
					"result",
					createReplayTimestamp(baseTimestampMs, resultAt),
				),
			});
		}

		currentAt += STUDIO_REPLAY_TOOL_CALL_DELAY_MS;
	}

	return currentAt;
}

function buildStudioReplayTimeline(
	mode: ReplayMode,
	baseTimestampMs: number
): StudioReplayTimelineEntry[] {
	const entries: StudioReplayTimelineEntry[] = [
		{
			at: 0,
			part: createDesigningAgentStatusPart(
				"studio-agent-replay-turn-1",
				createReplayTimestamp(baseTimestampMs, 0),
			),
		},
	];
	const firstTurnEndAt = appendStudioStepTimelineEntries({
		baseTimestampMs,
		entries,
		startAt: 0,
		steps: STUDIO_AGENT_CREATION_FIRST_TURN_STEPS,
	});

	if (mode === "awaiting") {
		entries.push({
			at: firstTurnEndAt,
			part: createTurnCompletePart(createReplayTimestamp(baseTimestampMs, firstTurnEndAt)),
		});
		entries.push({
			at: firstTurnEndAt,
			phase: "awaiting",
		});
		return entries;
	}

	const answerAt = firstTurnEndAt + STUDIO_REPLAY_ANSWER_HOLD_MS;
	entries.push({
		at: answerAt,
		part: createResolvedQuestionEventPart(createReplayTimestamp(baseTimestampMs, answerAt)),
	});

	const followUpStartAt = answerAt + STUDIO_REPLAY_ANSWER_HOLD_MS;
	entries.push({
		at: followUpStartAt,
		part: createDesigningAgentStatusPart(
			"studio-agent-replay-turn-2",
			createReplayTimestamp(baseTimestampMs, followUpStartAt),
		),
	});

	const followUpEndAt = appendStudioStepTimelineEntries({
		baseTimestampMs,
		entries,
		startAt: followUpStartAt,
		steps: STUDIO_AGENT_CREATION_FOLLOW_UP_STEPS,
	});
	entries.push({
		at: followUpEndAt,
		phase: "generating",
	});

	const completedAt = followUpEndAt + STUDIO_REPLAY_RESPONSE_HOLD_MS;
	entries.push({
		at: completedAt,
		part: createTurnCompletePart(createReplayTimestamp(baseTimestampMs, completedAt)),
	});
	entries.push({
		at: completedAt,
		phase: "completed",
		duration: Math.ceil(completedAt / 1000),
	});

	return entries;
}

/** Runs each entry at its offset; the returned function cancels every pending entry. */
function scheduleTimeline<Entry extends { at: number }>(entries: readonly Entry[], run: (entry: Entry) => void): () => void {
	const timeoutIds = entries.map((entry) => window.setTimeout(() => run(entry), entry.at));
	return () => {
		for (const timeoutId of timeoutIds) {
			window.clearTimeout(timeoutId);
		}
	};
}

export function useStudioReplayMessage(mode: ReplayMode): {
	duration: number | undefined;
	message: RovoUIMessage;
	phase: StudioReplayPhase;
} {
	const [parts, setParts] = useState<RovoMessagePart[]>([]);
	const [phase, setPhase] = useState<StudioReplayPhase>("playing");
	const [duration, setDuration] = useState<number | undefined>(undefined);

	useEffect(() => {
		const baseTimestampMs = Date.now();
		// Each replay mounts fresh (the demo re-keys it on Reset), so state starts empty.
		const timeline = buildStudioReplayTimeline(mode, baseTimestampMs);

		return scheduleTimeline(timeline, (entry) => {
			if ("part" in entry) {
				setParts((currentParts) => [...currentParts, entry.part]);
				return;
			}
			setPhase(entry.phase);
			setDuration(entry.duration);
		});
	}, [mode]);

	const message = useMemo<RovoUIMessage>(() => ({
		id: STUDIO_REPLAY_MESSAGE_ID,
		role: "assistant",
		metadata: {},
		parts,
	}), [parts]);

	return { duration, message, phase };
}
