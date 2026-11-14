"use client";

import type { ReactNode } from "react";
import type { getThinkingToolCallSummaries } from "@/lib/rovo-ui-messages";
import type { ReasoningPhaseProps } from "@/components/projects/shared/hooks/use-reasoning-phase";
import { Message } from "@/components/ui-custom/message";
import {
	ChainOfThought,
	ChainOfThoughtContent,
	ChainOfThoughtHeader,
	ChainOfThoughtStep,
} from "@/components/ui-custom/chain-of-thought";
import { CodeBlock } from "@/components/ui-custom/code-block";
import { AssistantThinkingToolsSection } from "@/components/projects/shared/components/assistant-thinking-tools-section";
import { getReasoningSectionTitle } from "@/components/ui-custom/lib/reasoning-labels";
import { cn } from "@/lib/utils";

interface StreamingThinkingIndicatorProps {
	reasoningKey: string;
	label: string;
	hasDetails: boolean;
	hasReasoningContent: boolean;
	trimmedReasoningContent: string;
	hasThinkingToolCalls: boolean;
	thinkingToolCalls: ReturnType<typeof getThinkingToolCallSummaries>;
	allowAutoCollapse: boolean;
	lastMessageId?: string;
	containerClassName?: string;
	containerStyle?: React.CSSProperties;
	phaseProps: ReasoningPhaseProps;
}

function getChainOfThoughtHeaderState(
	phaseProps: ReasoningPhaseProps,
): "preload" | "thinking" | "completed" {
	if (!phaseProps.isStreaming) {
		return "completed";
	}

	return phaseProps.animatedDots ? "thinking" : "preload";
}

export function StreamingThinkingIndicator({
	reasoningKey,
	label,
	hasDetails,
	hasReasoningContent,
	trimmedReasoningContent,
	hasThinkingToolCalls,
	thinkingToolCalls,
	lastMessageId,
	containerClassName,
	containerStyle,
	phaseProps,
}: Readonly<StreamingThinkingIndicatorProps>): ReactNode {
	const headerState = getChainOfThoughtHeaderState(phaseProps);
	const stepStatus = phaseProps.isStreaming ? "active" : "complete";
	const shouldUseDefaultHeaderLabel = headerState === "completed";

	return (
		<div className={cn(containerClassName)} style={containerStyle}>
			<Message from="assistant" className="max-w-full">
				<ChainOfThought
					key={`${reasoningKey}-${headerState}`}
					className="mb-0"
					defaultOpen={false}
				>
					<ChainOfThoughtHeader
						state={headerState}
						duration={phaseProps.duration}
						showChevron={hasDetails}
					>
						{shouldUseDefaultHeaderLabel ? undefined : label}
					</ChainOfThoughtHeader>
					{hasDetails ? (
						<ChainOfThoughtContent>
							{hasReasoningContent ? (
								<ChainOfThoughtStep
									label={getReasoningSectionTitle("thinking")}
									status={stepStatus}
								>
									<CodeBlock
										code={trimmedReasoningContent}
										language="markdown"
										size="sm"
									/>
								</ChainOfThoughtStep>
							) : null}
							{hasThinkingToolCalls ? (
								<ChainOfThoughtStep
									label={getReasoningSectionTitle("tools")}
									status={stepStatus}
								>
									<AssistantThinkingToolsSection
										defaultOpenMode="running"
										idPrefix={lastMessageId ?? "stream"}
										thinkingToolCalls={thinkingToolCalls}
									/>
								</ChainOfThoughtStep>
							) : null}
						</ChainOfThoughtContent>
					) : null}
				</ChainOfThought>
			</Message>
		</div>
	);
}
