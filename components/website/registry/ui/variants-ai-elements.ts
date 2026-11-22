import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export const UI_AI_ELEMENTS_VARIANT_DEMOS: Record<string, ComponentType> = {
	"shimmer-demo-marker": dynamic(
		() =>
			import("../../demos/ui/shimmer-demo").then((mod) => ({
				default: mod.ShimmerDemoMarker,
			})),
		{ ssr: false },
	),
	"shimmer-demo-color": dynamic(
		() =>
			import("../../demos/ui/shimmer-demo").then((mod) => ({
				default: mod.ShimmerDemoColor,
			})),
		{ ssr: false },
	),
	"shimmer-demo-duration": dynamic(
		() =>
			import("../../demos/ui/shimmer-demo").then((mod) => ({
				default: mod.ShimmerDemoDuration,
			})),
		{ ssr: false },
	),
	"shimmer-demo-spread": dynamic(
		() =>
			import("../../demos/ui/shimmer-demo").then((mod) => ({
				default: mod.ShimmerDemoSpread,
			})),
		{ ssr: false },
	),
	"shimmer-demo-spread-multiplier": dynamic(
		() =>
			import("../../demos/ui/shimmer-demo").then((mod) => ({
				default: mod.ShimmerDemoSpreadMultiplier,
			})),
		{ ssr: false },
	),
	"shimmer-demo-angle": dynamic(
		() =>
			import("../../demos/ui/shimmer-demo").then((mod) => ({
				default: mod.ShimmerDemoAngle,
			})),
		{ ssr: false },
	),
	"shimmer-demo-reverse": dynamic(
		() =>
			import("../../demos/ui/shimmer-demo").then((mod) => ({
				default: mod.ShimmerDemoReverse,
			})),
		{ ssr: false },
	),
	"shimmer-demo-once": dynamic(
		() =>
			import("../../demos/ui/shimmer-demo").then((mod) => ({
				default: mod.ShimmerDemoOnce,
			})),
		{ ssr: false },
	),
	"shimmer-demo-disabled": dynamic(
		() =>
			import("../../demos/ui/shimmer-demo").then((mod) => ({
				default: mod.ShimmerDemoDisabled,
			})),
		{ ssr: false },
	),
	"shimmer-demo-fallback": dynamic(
		() =>
			import("../../demos/ui/shimmer-demo").then((mod) => ({
				default: mod.ShimmerDemoFallback,
			})),
		{ ssr: false },
	),
	"shimmer-demo-rtl": dynamic(
		() =>
			import("../../demos/ui/shimmer-demo").then((mod) => ({
				default: mod.ShimmerDemoRtl,
			})),
		{ ssr: false },
	),
	"shimmer-demo-polymorphic": dynamic(
		() =>
			import("../../demos/ui/shimmer-demo").then((mod) => ({
				default: mod.ShimmerDemoPolymorphic,
			})),
		{ ssr: false },
	),
	"shimmer-demo-playground": dynamic(
		() =>
			import("../../demos/ui/shimmer-demo").then((mod) => ({
				default: mod.ShimmerDemoPlayground,
			})),
		{ ssr: false },
	),
	"suggestion-demo-follow-up": dynamic(
		() =>
			import("../../demos/ui/suggestion-demo").then((mod) => ({
				default: mod.SuggestionDemoFollowUp,
			})),
		{ ssr: false },
	),
	"trace-demo-trace-line": dynamic(
		() =>
			import("../../demos/ui/trace-demo").then((mod) => ({
				default: mod.TraceStatic,
			})),
		{ ssr: false },
	),
	"trace-demo-status": dynamic(
		() =>
			import("../../demos/ui/trace-demo").then((mod) => ({
				default: mod.TraceStatus,
			})),
		{ ssr: false },
	),
	"trace-demo-description": dynamic(
		() =>
			import("../../demos/ui/trace-demo").then((mod) => ({
				default: mod.TraceDescriptionDemo,
			})),
		{ ssr: false },
	),
	"trace-demo-collapsible": dynamic(
		() =>
			import("../../demos/ui/trace-demo").then((mod) => ({
				default: mod.TraceCollapsibleDemo,
			})),
		{ ssr: false },
	),
	"trace-demo-open-state": dynamic(
		() =>
			import("../../demos/ui/trace-demo").then((mod) => ({
				default: mod.TraceOpen,
			})),
		{ ssr: false },
	),
	"trace-demo-link": dynamic(
		() =>
			import("../../demos/ui/trace-demo").then((mod) => ({
				default: mod.TraceLink,
			})),
		{ ssr: false },
	),
	"trace-demo-dialog": dynamic(
		() =>
			import("../../demos/ui/trace-demo").then((mod) => ({
				default: mod.TraceDialog,
			})),
		{ ssr: false },
	),
	"trace-demo-sheet": dynamic(
		() =>
			import("../../demos/ui/trace-demo").then((mod) => ({
				default: mod.TraceSheet,
			})),
		{ ssr: false },
	),
	"trace-demo-group": dynamic(
		() =>
			import("../../demos/ui/trace-demo").then((mod) => ({
				default: mod.TraceGroupDemo,
			})),
		{ ssr: false },
	),
	"trace-demo-sources": dynamic(
		() =>
			import("../../demos/ui/trace-demo").then((mod) => ({
				default: mod.TraceSources,
			})),
		{ ssr: false },
	),
	"trace-demo-chain-of-thought": dynamic(
		() =>
			import("../../demos/ui/trace-demo").then((mod) => ({
				default: mod.TraceSteps,
			})),
		{ ssr: false },
	),
	"trace-demo-commit": dynamic(
		() =>
			import("../../demos/ui/trace-demo").then((mod) => ({
				default: mod.TraceCommit,
			})),
		{ ssr: false },
	),
	"trace-demo-whole-turn": dynamic(
		() =>
			import("../../demos/ui/trace-demo").then((mod) => ({
				default: mod.TraceTurn,
			})),
		{ ssr: false },
	),
	"trace-demo-reasoning": dynamic(
		() =>
			import("../../demos/ui/trace-demo-chat").then((mod) => ({
				default: mod.TraceThinking,
			})),
		{ ssr: false },
	),
	"trace-demo-tool": dynamic(
		() =>
			import("../../demos/ui/trace-demo-chat").then((mod) => ({
				default: mod.TraceToolCalls,
			})),
		{ ssr: false },
	),
	"stack-trace-demo-frame-links": dynamic(
		() =>
			import("../../demos/ui/stack-trace-demo").then((mod) => ({
				default: mod.StackTraceFrames,
			})),
		{ ssr: false },
	),
	"terminal-demo-exit-code": dynamic(
		() =>
			import("../../demos/ui/terminal-demo").then((mod) => ({
				default: mod.TerminalError,
			})),
		{ ssr: false },
	),
	"test-results-demo-suites": dynamic(
		() =>
			import("../../demos/ui/test-results-demo").then((mod) => ({
				default: mod.TestResultsSuites,
			})),
		{ ssr: false },
	),
	"subagent-demo-running": dynamic(
		() =>
			import("../../demos/ui/subagent-demo").then((mod) => ({
				default: mod.SubagentRunning,
			})),
		{ ssr: false },
	),
	"subagent-demo-details": dynamic(
		() =>
			import("../../demos/ui/subagent-demo").then((mod) => ({
				default: mod.SubagentDetails,
			})),
		{ ssr: false },
	),
	"code-block-demo-basic": dynamic(
		() =>
			import("../../demos/ui/code-block-demo").then((mod) => ({
				default: mod.CodeBlockBasic,
			})),
		{ ssr: false },
	),
	"code-block-demo-header": dynamic(
		() =>
			import("../../demos/ui/code-block-demo").then((mod) => ({
				default: mod.CodeBlockHeaderExample,
			})),
		{ ssr: false },
	),
	"code-block-demo-actions": dynamic(
		() =>
			import("../../demos/ui/code-block-demo").then((mod) => ({
				default: mod.CodeBlockActionsExample,
			})),
		{ ssr: false },
	),
	"code-block-demo-floating-actions": dynamic(
		() =>
			import("../../demos/ui/code-block-demo").then((mod) => ({
				default: mod.CodeBlockFloatingActions,
			})),
		{ ssr: false },
	),
	"code-block-demo-line-numbers": dynamic(
		() =>
			import("../../demos/ui/code-block-demo").then((mod) => ({
				default: mod.CodeBlockLineNumbers,
			})),
		{ ssr: false },
	),
	"code-block-demo-start-line": dynamic(
		() =>
			import("../../demos/ui/code-block-demo").then((mod) => ({
				default: mod.CodeBlockStartLine,
			})),
		{ ssr: false },
	),
	"code-block-demo-wrap": dynamic(
		() =>
			import("../../demos/ui/code-block-demo").then((mod) => ({
				default: mod.CodeBlockWrap,
			})),
		{ ssr: false },
	),
	"code-block-demo-highlighted-lines": dynamic(
		() =>
			import("../../demos/ui/code-block-demo").then((mod) => ({
				default: mod.CodeBlockHighlightedLines,
			})),
		{ ssr: false },
	),
	"code-block-demo-diff": dynamic(
		() =>
			import("../../demos/ui/code-block-demo").then((mod) => ({
				default: mod.CodeBlockDiff,
			})),
		{ ssr: false },
	),
	"code-block-demo-height": dynamic(
		() =>
			import("../../demos/ui/code-block-demo").then((mod) => ({
				default: mod.CodeBlockHeight,
			})),
		{ ssr: false },
	),
	"code-block-demo-show-more": dynamic(
		() =>
			import("../../demos/ui/code-block-demo").then((mod) => ({
				default: mod.CodeBlockShowMore,
			})),
		{ ssr: false },
	),
	"code-block-demo-max-height": dynamic(
		() =>
			import("../../demos/ui/code-block-demo").then((mod) => ({
				default: mod.CodeBlockShowMoreScroll,
			})),
		{ ssr: false },
	),
	"code-block-demo-size": dynamic(
		() =>
			import("../../demos/ui/code-block-demo").then((mod) => ({
				default: mod.CodeBlockSize,
			})),
		{ ssr: false },
	),
	"code-block-demo-destructive": dynamic(
		() =>
			import("../../demos/ui/code-block-demo").then((mod) => ({
				default: mod.CodeBlockDestructive,
			})),
		{ ssr: false },
	),
	"code-block-demo-trace": dynamic(
		() =>
			import("../../demos/ui/code-block-demo-advanced").then((mod) => ({
				default: mod.CodeBlockTrace,
			})),
		{ ssr: false },
	),
	"code-block-demo-tabs": dynamic(
		() =>
			import("../../demos/ui/code-block-demo-advanced").then((mod) => ({
				default: mod.CodeBlockTabs,
			})),
		{ ssr: false },
	),
	"code-block-demo-message": dynamic(
		() =>
			import("../../demos/ui/code-block-demo-advanced").then((mod) => ({
				default: mod.CodeBlockChat,
			})),
		{ ssr: false },
	),
	"code-block-demo-typeset": dynamic(
		() =>
			import("../../demos/ui/code-block-demo-advanced").then((mod) => ({
				default: mod.CodeBlockTypeset,
			})),
		{ ssr: false },
	),
	"code-block-demo-rtl": dynamic(
		() =>
			import("../../demos/ui/code-block-demo-advanced").then((mod) => ({
				default: mod.CodeBlockRtl,
			})),
		{ ssr: false },
	),
	"code-block-demo-syntax-highlighting": dynamic(
		() =>
			import("../../demos/ui/code-block-demo-advanced").then((mod) => ({
				default: mod.CodeBlockHighlighting,
			})),
		{ ssr: false },
	),
	"code-block-demo-languages": dynamic(
		() =>
			import("../../demos/ui/code-block-demo-advanced").then((mod) => ({
				default: mod.CodeBlockLanguages,
			})),
		{ ssr: false },
	),
	"code-block-demo-terminal-output": dynamic(
		() =>
			import("../../demos/ui/code-block-demo-advanced").then((mod) => ({
				default: mod.CodeBlockAnsi,
			})),
		{ ssr: false },
	),
	"code-block-demo-streaming": dynamic(
		() =>
			import("../../demos/ui/code-block-demo-advanced").then((mod) => ({
				default: mod.CodeBlockStreaming,
			})),
		{ ssr: false },
	),
	"code-block-demo-markdown": dynamic(
		() =>
			import("../../demos/ui/code-block-demo-advanced").then((mod) => ({
				default: mod.CodeBlockMarkdown,
			})),
		{ ssr: false },
	),
	"queue-demo-inline": dynamic(
		() =>
			import("../../demos/ui/queue-demo").then((mod) => ({
				default: mod.QueueDemoInline,
			})),
		{ ssr: false },
	),
	"queue-demo-prompt-queue": dynamic(
		() =>
			import("../../demos/ui/queue-demo").then((mod) => ({
				default: mod.QueueDemoPromptQueue,
			})),
		{ ssr: false },
	),
	"queue-demo-with-actions": dynamic(
		() =>
			import("../../demos/ui/queue-demo").then((mod) => ({
				default: mod.QueueDemoWithActions,
			})),
		{ ssr: false },
	),
	"queue-demo-with-attachments": dynamic(
		() =>
			import("../../demos/ui/queue-demo").then((mod) => ({
				default: mod.QueueDemoWithAttachments,
			})),
		{ ssr: false },
	),
	"queue-demo-minimal": dynamic(
		() =>
			import("../../demos/ui/queue-demo").then((mod) => ({
				default: mod.QueueDemoMinimal,
			})),
		{ ssr: false },
	),
	"plan-demo-summary-and-tasks": dynamic(
		() =>
			import("../../demos/ui/plan-demo").then((mod) => ({
				default: mod.PlanDemoSummaryAndTasks,
			})),
		{ ssr: false },
	),
	"plan-demo-tasks-only": dynamic(
		() =>
			import("../../demos/ui/plan-demo").then((mod) => ({
				default: mod.PlanDemoTasksOnly,
			})),
		{ ssr: false },
	),
	"plan-demo-inline": dynamic(
		() =>
			import("../../demos/ui/plan-demo").then((mod) => ({
				default: mod.PlanDemoInline,
			})),
		{ ssr: false },
	),
	"plan-demo-description": dynamic(
		() =>
			import("../../demos/ui/plan-demo").then((mod) => ({
				default: mod.PlanDemoDescription,
			})),
		{ ssr: false },
	),
	"reasoning-demo-duration": dynamic(
		() =>
			import("../../demos/ui/reasoning-demo").then((mod) => ({
				default: mod.ReasoningDemoDuration,
			})),
		{ ssr: false },
	),
	"reasoning-demo-streaming": dynamic(
		() =>
			import("../../demos/ui/reasoning-demo").then((mod) => ({
				default: mod.ReasoningDemoStreaming,
			})),
		{ ssr: false },
	),
	"reasoning-demo-timeline": dynamic(
		() =>
			import("../../demos/ui/reasoning-demo").then((mod) => ({
				default: mod.ReasoningDemoTimeline,
			})),
		{ ssr: false },
	),
	"tool-demo-states": dynamic(
		() =>
			import("../../demos/ui/tool-demo").then((mod) => ({
				default: mod.ToolDemoStates,
			})),
		{ ssr: false },
	),
	"tool-demo-input-output": dynamic(
		() =>
			import("../../demos/ui/tool-demo").then((mod) => ({
				default: mod.ToolDemoInputOutput,
			})),
		{ ssr: false },
	),
	"tool-demo-label": dynamic(
		() =>
			import("../../demos/ui/tool-demo").then((mod) => ({
				default: mod.ToolDemoLabel,
			})),
		{ ssr: false },
	),
	"chain-of-thought-demo-usage": dynamic(
		() =>
			import("../../demos/ui/chain-of-thought-demo").then((mod) => ({
				default: mod.ChainOfThoughtDemoUsage,
			})),
		{ ssr: false },
	),
	"chain-of-thought-demo-steps": dynamic(
		() =>
			import("../../demos/ui/chain-of-thought-demo").then((mod) => ({
				default: mod.ChainOfThoughtDemoSteps,
			})),
		{ ssr: false },
	),
	"chain-of-thought-demo-preload": dynamic(
		() =>
			import("../../demos/ui/chain-of-thought-demo-vpk").then((mod) => ({
				default: mod.ChainOfThoughtDemoPreload,
			})),
		{ ssr: false },
	),
	"chain-of-thought-demo-normal-tool-calling-replay": dynamic(
		() =>
			import("../../demos/ui/chain-of-thought-demo-replay").then((mod) => ({
				default: mod.ChainOfThoughtDemoNormalToolCallingReplay,
			})),
		{ ssr: false },
	),
	"chain-of-thought-demo-awaiting-user-response-replay": dynamic(
		() =>
			import("../../demos/ui/chain-of-thought-demo-replay").then((mod) => ({
				default: mod.ChainOfThoughtDemoAwaitingUserResponseReplay,
			})),
		{ ssr: false },
	),
	"chain-of-thought-demo-thinking": dynamic(
		() =>
			import("../../demos/ui/chain-of-thought-demo-vpk").then((mod) => ({
				default: mod.ChainOfThoughtDemoThinking,
			})),
		{ ssr: false },
	),
	"chain-of-thought-demo-completed": dynamic(
		() =>
			import("../../demos/ui/chain-of-thought-demo-vpk").then((mod) => ({
				default: mod.ChainOfThoughtDemoCompleted,
			})),
		{ ssr: false },
	),
	"chain-of-thought-demo-status-variants": dynamic(
		() =>
			import("../../demos/ui/chain-of-thought-demo-vpk").then((mod) => ({
				default: mod.ChainOfThoughtDemoStatusVariants,
			})),
		{ ssr: false },
	),
	"chain-of-thought-demo-search-results": dynamic(
		() =>
			import("../../demos/ui/chain-of-thought-demo-vpk").then((mod) => ({
				default: mod.ChainOfThoughtDemoSearchResults,
			})),
		{ ssr: false },
	),
	"chain-of-thought-demo-image-step": dynamic(
		() =>
			import("../../demos/ui/chain-of-thought-demo-vpk").then((mod) => ({
				default: mod.ChainOfThoughtDemoImageStep,
			})),
		{ ssr: false },
	),
	"chain-of-thought-demo-studio-agent-generation-flow": dynamic(
		() =>
			import("../../demos/ui/chain-of-thought-demo-vpk").then((mod) => ({
				default: mod.ChainOfThoughtDemoStudioAgentGenerationFlow,
			})),
		{ ssr: false },
	),
	"chain-of-thought-demo-automation-trigger-flow": dynamic(
		() =>
			import("../../demos/ui/chain-of-thought-demo-vpk").then((mod) => ({
				default: mod.ChainOfThoughtDemoAutomationTriggerFlow,
			})),
		{ ssr: false },
	),
	"chain-of-thought-demo-research-retrieval-flow": dynamic(
		() =>
			import("../../demos/ui/chain-of-thought-demo-vpk").then((mod) => ({
				default: mod.ChainOfThoughtDemoResearchRetrievalFlow,
			})),
		{ ssr: false },
	),
	"chain-of-thought-demo-twg-tool-call": dynamic(
		() =>
			import("../../demos/ui/chain-of-thought-demo-vpk").then((mod) => ({
				default: mod.ChainOfThoughtDemoTwgToolCall,
			})),
		{ ssr: false },
	),
	"chain-of-thought-demo-tool-call-details-flow": dynamic(
		() =>
			import("../../demos/ui/chain-of-thought-demo-vpk").then((mod) => ({
				default: mod.ChainOfThoughtDemoToolCallDetailsFlow,
			})),
		{ ssr: false },
	),
	"chain-of-thought-demo-tool-icon-table": dynamic(
		() =>
			import("../../demos/ui/chain-of-thought-demo-tool-icons").then((mod) => ({
				default: mod.ChainOfThoughtDemoToolIconTable,
			})),
		{ ssr: false },
	),
	"confirmation-demo-request": dynamic(
		() =>
			import("../../demos/ui/confirmation-demo").then((mod) => ({
				default: mod.ConfirmationDemoRequest,
			})),
		{ ssr: false },
	),
	"confirmation-demo-accepted": dynamic(
		() =>
			import("../../demos/ui/confirmation-demo").then((mod) => ({
				default: mod.ConfirmationDemoAccepted,
			})),
		{ ssr: false },
	),
	"confirmation-demo-rejected": dynamic(
		() =>
			import("../../demos/ui/confirmation-demo").then((mod) => ({
				default: mod.ConfirmationDemoRejected,
			})),
		{ ssr: false },
	),
	"inline-citation-demo-with-carousel": dynamic(
		() =>
			import("../../demos/ui/inline-citation-demo").then((mod) => ({
				default: mod.InlineCitationDemoWithCarousel,
			})),
		{ ssr: false },
	),
	"inline-citation-demo-basic": dynamic(
		() =>
			import("../../demos/ui/inline-citation-demo").then((mod) => ({
				default: mod.InlineCitationDemoBasic,
			})),
		{ ssr: false },
	),
	"inline-citation-demo-single-source": dynamic(
		() =>
			import("../../demos/ui/inline-citation-demo").then((mod) => ({
				default: mod.InlineCitationDemoSingleSource,
			})),
		{ ssr: false },
	),
};
