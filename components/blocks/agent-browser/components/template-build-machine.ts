/**
 * Pure state machine for the template build flow. No React: the flow's timers and the host's
 * `onBuildAgent` call feed it events, and the `node:test` transition table drives it directly.
 */
import type {
	AgentBrowserTemplateBuildOptions,
	AgentBrowserTemplateBuildResult,
} from "@/components/blocks/agent-browser";
import type { TimedTransitionTable } from "@/components/hooks/use-timed-transition";

export const TEMPLATE_BUILD_STEP_LABELS = [
	"Review template",
	"Connect apps",
	"Apply instructions",
	"Configure skills",
	"Prepare knowledge",
	"Create draft agent",
] as const;
export const TEMPLATE_BUILD_STEP_DURATION_MS = 1400;

const LAST_STEP = TEMPLATE_BUILD_STEP_LABELS.length - 1;

export type TemplateBuildState =
	| { readonly phase: "connect" }
	| {
		readonly phase: "building";
		/** Index into `TEMPLATE_BUILD_STEP_LABELS` of the step in progress. */
		readonly step: number;
		readonly options: AgentBrowserTemplateBuildOptions;
	}
	| {
		readonly phase: "built";
		readonly profileId: string;
		/** The built draft's own cancel, run before the host's. */
		readonly onCancel: (() => void) | null;
	}
	| { readonly phase: "error" };

export type TemplateBuildPhase = TemplateBuildState["phase"];

export type TemplateBuildEvent =
	| { readonly type: "start"; readonly options: AgentBrowserTemplateBuildOptions }
	| { readonly type: "step-elapsed" }
	| { readonly type: "build-finished"; readonly result: AgentBrowserTemplateBuildResult | null };

export const TEMPLATE_BUILD_INITIAL_STATE: TemplateBuildState = { phase: "connect" };

export function templateBuildReducer(
	state: TemplateBuildState,
	event: TemplateBuildEvent,
): TemplateBuildState {
	switch (event.type) {
		case "start":
			return { phase: "building", step: 0, options: event.options };
		case "step-elapsed":
			if (state.phase !== "building" || state.step >= LAST_STEP) {
				return state;
			}
			return { ...state, step: state.step + 1 };
		case "build-finished":
			// The draft is created while the last step is showing, never earlier.
			if (state.phase !== "building" || state.step < LAST_STEP) {
				return state;
			}
			return event.result === null
				? { phase: "error" }
				: { phase: "built", profileId: event.result.profileId, onCancel: event.result.onCancel ?? null };
		default: {
			const _exhaustive: never = event;
			void _exhaustive;
			return state;
		}
	}
}

/** Timer key for the current step; `null` outside `building`. */
export type TemplateBuildTimerKey = `step-${number}` | "finish";

export function selectTemplateBuildTimerKey(state: TemplateBuildState): TemplateBuildTimerKey | null {
	return state.phase === "building" ? `step-${state.step}` : null;
}

/** Every step holds for the same time; the last one's hold ends in `finish` (the build). */
export const TEMPLATE_BUILD_TIMERS: TimedTransitionTable<TemplateBuildTimerKey> = Object.fromEntries(
	TEMPLATE_BUILD_STEP_LABELS.map((_, index) => [
		`step-${index}`,
		{ next: index === LAST_STEP ? "finish" : `step-${index + 1}`, delayMs: TEMPLATE_BUILD_STEP_DURATION_MS },
	]),
);

/** Which step the tracker shows as in progress (or, after an error, where it stopped). */
export function selectTemplateBuildActiveStep(state: TemplateBuildState): number {
	switch (state.phase) {
		case "connect":
			return 0;
		case "building":
			return state.step;
		case "built":
		case "error":
			return LAST_STEP;
	}
}
