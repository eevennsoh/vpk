export type EventTimingRecord = Readonly<{
	actionId: string | null;
	durationMs: number;
	interactionId: number | null;
	name: string;
	processingEndMs: number;
	processingStartMs: number;
	startTimeMs: number;
	targetId: string | null;
}>;

export type SampleAction = Readonly<{
	armedAtMs: number;
	clickedAtMs: number | null;
	id: string;
	targetId: string;
	view: string;
	visit: "cold" | "warm";
}>;

type Timing = Readonly<{
	durationMs: number;
	eventCount: number;
	inputDelayMs: number;
	interactionId: number;
	presentationDelayMs: number;
	presentationRoundingAdjustmentMs: number;
	processingDurationMs: number;
	representativeEvent: string;
}>;

export type InteractionSample = Readonly<{
	actionId: string;
	targetId: string;
	view: string;
	visit: "cold" | "warm";
}> & (
	| Readonly<{ reason: null; status: "valid"; timing: Timing }>
	| Readonly<{ reason: string; status: "missing"; timing: null }>
);

export function selectInteractionSample({ entries, action, seenInteractionIds, supported }: {
	action: SampleAction;
	entries: readonly EventTimingRecord[];
	seenInteractionIds: Set<number>;
	supported: boolean;
}): InteractionSample {
	const identity = {
		actionId: action.id,
		targetId: action.targetId,
		view: action.view,
		visit: action.visit,
	};
	const missing = (reason: string): InteractionSample => ({ ...identity, reason, status: "missing", timing: null });
	if (!supported) return missing("event-timing-unsupported");
	if (action.clickedAtMs === null) return missing("expected-click-not-captured");
	const clickedAtMs = action.clickedAtMs;
	const attributed = entries.filter((entry) => entry.actionId === action.id
		&& entry.targetId === action.targetId
		&& entry.startTimeMs >= action.armedAtMs
		// Event timestamps may be coarsened differently from performance.now().
		&& entry.startTimeMs <= clickedAtMs + 1);
	if (attributed.length === 0) return missing("no-attributed-event-timing");
	if (attributed.some((entry) => !Number.isSafeInteger(entry.interactionId) || (entry.interactionId ?? 0) <= 0)) {
		return missing("missing-interaction-id");
	}
	const ids = new Set(attributed.map((entry) => entry.interactionId as number));
	if (ids.size !== 1) return missing("ambiguous-interaction-ids");
	const [interactionId] = ids;
	if (seenInteractionIds.has(interactionId)) return missing("interaction-already-sampled");
	const uniqueEntries = new Map<string, EventTimingRecord>();
	for (const entry of attributed) {
		const values = [entry.startTimeMs, entry.durationMs, entry.processingStartMs, entry.processingEndMs];
		const presentation = entry.startTimeMs + entry.durationMs - entry.processingEndMs;
		if (values.some((value) => !Number.isFinite(value) || value < 0)
			|| entry.processingStartMs < entry.startTimeMs
			|| entry.processingEndMs < entry.processingStartMs
			// The duration is rounded to the nearest 8ms by the Event Timing API.
			|| presentation < -4) return missing("invalid-event-timing");
		uniqueEntries.set(JSON.stringify([entry.name, ...values]), entry);
	}
	const entry = [...uniqueEntries.values()].sort((left, right) => right.durationMs - left.durationMs)[0];
	const presentation = entry.startTimeMs + entry.durationMs - entry.processingEndMs;
	seenInteractionIds.add(interactionId);
	return {
		...identity,
		status: "valid",
		reason: null,
		timing: {
			durationMs: entry.durationMs,
			eventCount: uniqueEntries.size,
			inputDelayMs: entry.processingStartMs - entry.startTimeMs,
			interactionId,
			presentationDelayMs: Math.max(0, presentation),
			presentationRoundingAdjustmentMs: Math.max(0, -presentation),
			processingDurationMs: entry.processingEndMs - entry.processingStartMs,
			representativeEvent: entry.name,
		},
	};
}

type Statistics = Readonly<{
	max: number;
	mean: number;
	median: number;
	min: number;
	p95: number;
	range: number;
	variance: number;
}>;

function statistics(values: readonly number[]): Statistics | null {
	if (values.length === 0) return null;
	const sorted = [...values].sort((left, right) => left - right);
	const midpoint = Math.floor(sorted.length / 2);
	const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
	const min = sorted[0];
	const max = sorted[sorted.length - 1];
	return {
		max,
		mean,
		median: sorted.length % 2 === 0 ? (sorted[midpoint - 1] + sorted[midpoint]) / 2 : sorted[midpoint],
		min,
		// Nearest-rank percentile; population variance describes this recorded set.
		p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
		range: max - min,
		variance: sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / sorted.length,
	};
}

export function summarizeInteractionSamples(samples: readonly InteractionSample[]) {
	const groups = new Map<string, InteractionSample[]>();
	for (const sample of samples) {
		const key = JSON.stringify([sample.view, sample.visit]);
		const group = groups.get(key) ?? [];
		group.push(sample);
		groups.set(key, group);
	}
	return [...groups.values()].map((group) => {
		const valid = group.flatMap((sample) => sample.status === "valid" ? [sample.timing] : []);
		const missingReasons: Record<string, number> = {};
		for (const sample of group) {
			if (sample.status === "missing") missingReasons[sample.reason] = (missingReasons[sample.reason] ?? 0) + 1;
		}
		return {
			view: group[0].view,
			visit: group[0].visit,
			totalCount: group.length,
			validCount: valid.length,
			missingCount: group.length - valid.length,
			missingReasons,
			durationMs: statistics(valid.map((timing) => timing.durationMs)),
			inputDelayMs: statistics(valid.map((timing) => timing.inputDelayMs)),
			processingDurationMs: statistics(valid.map((timing) => timing.processingDurationMs)),
			presentationDelayMs: statistics(valid.map((timing) => timing.presentationDelayMs)),
		};
	});
}
