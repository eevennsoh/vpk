import {
	Reasoning,
	ReasoningContent,
	AdsReasoningTrigger,
} from "@/components/ui-custom/reasoning";
import {
	REASONING_LABELS,
} from "@/components/ui-custom/lib/reasoning-labels";

const SAMPLE_TIMELINE_REASONING =
	"Invoking mcp_invoke_tool\nInvoking search\nTool call failed: mcp_atlassian_mcp__invoke_tool";

export default function ReasoningDemo() {
	return (
		<Reasoning
			isStreaming
			streamingWave
			streamingWaveGradientColor={["#1868db", "#bf63f3", "#fca700"]}
			animatedDots={false}
			defaultOpen={false}
		>
			<AdsReasoningTrigger label={REASONING_LABELS.trigger.preloadShimmer} showChevron={false} />
			<ReasoningContent>{SAMPLE_TIMELINE_REASONING}</ReasoningContent>
		</Reasoning>
	);
}

export function ReasoningDemoPreload() {
	return (
		<Reasoning
			isStreaming
			streamingWave
			streamingWaveGradientColor={["#1868db", "#bf63f3", "#fca700"]}
			animatedDots={false}
			defaultOpen={false}
		>
			<AdsReasoningTrigger label={REASONING_LABELS.trigger.preloadShimmer} showChevron={false} />
			<ReasoningContent>{SAMPLE_TIMELINE_REASONING}</ReasoningContent>
		</Reasoning>
	);
}

export function ReasoningDemoThinking() {
	return (
		<Reasoning isStreaming open>
			<AdsReasoningTrigger streaming />
			<ReasoningContent>{SAMPLE_TIMELINE_REASONING}</ReasoningContent>
		</Reasoning>
	);
}

export function ReasoningDemoCompleted() {
	return (
		<Reasoning open duration={5}>
			<AdsReasoningTrigger />
			<ReasoningContent>{SAMPLE_TIMELINE_REASONING}</ReasoningContent>
		</Reasoning>
	);
}
