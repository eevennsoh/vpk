import type { ComponentDetail } from "@/app/data/component-detail-types";

export const REASONING_DETAIL: ComponentDetail = {
	description:
		"The agent's thinking as it streams. Reasoning is a collapsible Trace: it reads “Thinking” with a shimmer and opens while the model thinks, then reads “Thought for Ns” and closes when it is done.",
	usage: `import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ui/reasoning";

<Reasoning isStreaming={part.state === "streaming"}>
  <ReasoningTrigger showChevron={part.text.length > 0} />
  <ReasoningContent>{part.text}</ReasoningContent>
</Reasoning>`,
	props: [
		{
			name: "isStreaming",
			type: "boolean",
			default: "false",
			description: "Reasoning only. Opens the line, shimmers the title and times the stream; the duration is kept when it ends.",
		},
		{
			name: "duration",
			type: "number",
			description: "Reasoning only. Seconds spent thinking, for persisted messages. The trigger then reads “Thought for Ns”.",
		},
		{
			name: "open / defaultOpen / onOpenChange",
			type: "boolean / boolean / (open: boolean) => void",
			description: "Reasoning only. Controlled or initial open state. defaultOpen={false} stops it opening itself while streaming.",
		},
		{
			name: "allowAutoCollapse / collapseDelayMs",
			type: "boolean / number",
			default: "true / 1000",
			description: "Reasoning only. Closes the line this long after streaming ends, unless the person opened or closed it.",
		},
		{
			name: "autoExpandOnDetails / hasDetails",
			type: "boolean",
			default: "false",
			description: "Reasoning only. Opens the line once details arrive during a stream.",
		},
		{
			name: "toolsRunning",
			type: "boolean",
			description: "Reasoning only. Opens while tools run and closes once they go idle.",
		},
		{
			name: "maxVisibleTimelineItems / autoCollapseAtCount",
			type: "number",
			default: "5",
			description: "Reasoning only. How many status lines a timeline shows, and the count at which it closes while streaming.",
		},
		{
			name: "label / completedLabel",
			type: "string / (duration?: number) => ReactNode",
			description: "ReasoningTrigger only. Title while thinking, and once finished. A finished label such as “Used search” shows as complete.",
		},
		{
			name: "showChevron",
			type: "boolean",
			default: "true",
			description: "ReasoningTrigger only. When false, renders the line without a trigger, for reasoning with no text yet.",
		},
		{
			name: "timelineMode",
			type: '"auto" | "always" | "never"',
			default: '"auto"',
			description: "ReasoningContent only. Renders text made only of status lines (“Invoking search”) as trace lines.",
		},
	],
	subComponents: [
		{ name: "Reasoning", description: "Trace with a TraceCollapsible that owns the open, auto-collapse and duration rules." },
		{ name: "ReasoningTrigger", description: "TraceCollapsibleTrigger with the Rovo icon and the Thinking / Thought for Ns title." },
		{ name: "ReasoningContent", description: "TraceCollapsibleContent with the reasoning text or a status-line timeline." },
	],
	examples: [
		{ title: "Duration", description: "A finished line reads how long the model thought.", demoSlug: "reasoning-demo-duration" },
		{ title: "Streaming", description: "While streaming the title shimmers and the line stays open.", demoSlug: "reasoning-demo-streaming" },
		{ title: "Timeline", description: "Reasoning made only of tool status lines renders as trace lines.", demoSlug: "reasoning-demo-timeline" },
	],
};
