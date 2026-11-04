import { motionDuration, motionEase, referenceEase } from "@/lib/motion";

// Source KanbanCardComponent at 6627c513: CHIN_REVEAL_MS=280, handoff/name carousel=200.
export const BUTTER_INVOCATION_REVEAL = { duration: 0.28, ease: motionEase.inOut };
export const BUTTER_INVOCATION_CYCLE = { duration: motionDuration.medium, ease: motionEase.inOut };
export const BUTTER_INVOCATION_HANDOFF = { duration: motionDuration.medium, ease: referenceEase.agentInvocationHandoff };
export const BUTTER_INVOCATION_PUZZLE_ENTER = motionDuration.normal;
export const BUTTER_INVOCATION_PUZZLE_HOLD = motionDuration.slowest + motionDuration.slow;
export const BUTTER_INVOCATION_PUZZLE_EXIT = motionDuration.slowest;
export const BUTTER_INVOCATION_PUZZLE_DURATION = BUTTER_INVOCATION_PUZZLE_ENTER + BUTTER_INVOCATION_PUZZLE_HOLD + BUTTER_INVOCATION_PUZZLE_EXIT;
