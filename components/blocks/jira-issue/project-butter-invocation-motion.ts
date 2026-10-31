import { motionDuration, motionEase, referenceEase } from "@/lib/motion";

// Source KanbanCardComponent at 6627c513: CHIN_REVEAL_MS=280, handoff/name carousel=200.
export const BUTTER_INVOCATION_REVEAL = { duration: 0.28, ease: motionEase.inOut };
export const BUTTER_INVOCATION_CYCLE = { duration: motionDuration.medium, ease: motionEase.inOut };
export const BUTTER_INVOCATION_HANDOFF = { duration: motionDuration.medium, ease: referenceEase.agentInvocationHandoff };
