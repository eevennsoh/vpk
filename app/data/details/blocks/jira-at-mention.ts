import type { ComponentDetail } from "@/app/data/component-detail-types";

export const JIRA_AT_MENTION_DETAIL: ComponentDetail = {
	apiName: "Jira At-mention",
	description: "A mention travels from a comment composer to an inline reply, followed by a highlight. Replay the handoff and tune its flight and highlight in the controls. Reduced motion reveals the reply immediately.",
	importStatement: `import { useSessionMentionFlight } from "@/components/blocks/jira-at-mention";`,
	usage: `const flight = useSessionMentionFlight(bodyRef, request, active, onTraceStart, onSettled);

return <div ref={bodyRef}>{flight}{/* Activity and comment composer */}</div>;`,
	demoLayout: { previewHeight: "fit", examplesContentWidth: "bleed" },
	props: [
		{ name: "bodyRef", type: "RefObject<HTMLDivElement | null>", required: true, description: "Root containing the activity entries and comment composer. Entries use data-jira-activity-entry-id; the destination composer uses data-project-butter-comment-editor and contains a contenteditable editor and matching rich-text-mention-chip. Optional activity-header and comment-bar markers bound the visible scroll area." },
		{ name: "request", type: "MentionFlightRequest | null", required: true, description: "Unique request ID, destination activity entry ID, cloned source chip with its measured rectangle, and optional MentionFlightOptions. The host inserts the destination mention and keeps it hidden until settlement." },
		{ name: "active", type: "boolean", required: true, description: "Whether the destination reply is active. Deactivation interrupts the handoff." },
		{ name: "onTraceStart", type: "(id: number) => void", required: true, description: "Starts the destination highlight as the chip settles." },
		{ name: "onSettled", type: "(id: number, reason?: 'landed' | 'interrupted') => void", required: true, description: "Reveals the destination and restores the editor after the handoff." },
	],
	subComponents: [{ name: "MentionFlightOptions", description: "Override the flight defaults per request. Reply highlight color and duration are configured on RovoGeneration.Highlight by the host.", props: [
		{ name: "durationMs", type: "number", description: "Flight duration in milliseconds." },
		{ name: "arc", type: "number", description: "Curvature as a fraction of flight distance." },
		{ name: "lift", type: "number", description: "Peak scale increase over the original chip size." },
		{ name: "overshoot", type: "number", description: "Overshoot as a fraction of flight distance." },
		{ name: "traceOffset", type: "number", description: "Progress from 0 to 1 when the reply highlight starts." },
		{ name: "shadow", type: "boolean", description: "Whether the traveling chip casts a shadow." },
	] }],
};
