import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export const UI_CUSTOM_AGENT_VARIANT_DEMOS: Record<string, ComponentType> = {
	"human-agent-avatar-demo-horizontal-group": dynamic(() => import("../../demos/ui-custom/human-agent-avatar-demo").then((mod) => ({ default: mod.HumanAgentAvatarDemoHorizontalGroup })), { ssr: false }),
	"human-agent-avatar-demo-animated": dynamic(
		() => import("../../demos/ui-custom/human-agent-avatar-demo").then((mod) => ({ default: mod.HumanAgentAvatarDemoAnimated })),
		{ ssr: false },
	),
	"human-agent-avatar-demo-human-first": dynamic(
		() => import("../../demos/ui-custom/human-agent-avatar-demo").then((mod) => ({ default: mod.HumanAgentAvatarDemoHumanFirst })),
		{ ssr: false },
	),
	"agent-loading-demo-finished": dynamic(
		() =>
			import("../../demos/ui-custom/agent-loading-demo").then((mod) => ({
				default: mod.AgentLoadingDemoFinished,
			})),
		{ ssr: false },
	),
	"agent-loading-demo-small": dynamic(
		() =>
			import("../../demos/ui-custom/agent-loading-demo").then((mod) => ({
				default: mod.AgentLoadingDemoSmall,
			})),
		{ ssr: false },
	),
	"prompt-input-demo-chat-composer": dynamic(
		() =>
			import("../../demos/ui-custom/prompt-input-demo").then((mod) => ({
				default: mod.PromptInputDemoChatComposer,
			})),
		{ ssr: false },
	),
	"prompt-input-demo-chat-composer-live-voice": dynamic(
		() =>
			import("../../demos/ui-custom/prompt-input-demo").then((mod) => ({
				default: mod.PromptInputDemoChatComposerLiveVoice,
			})),
		{ ssr: false },
	),
	"prompt-input-demo-floating-bar": dynamic(
		() =>
			import("../../demos/ui-custom/prompt-input-demo").then((mod) => ({
				default: mod.PromptInputDemoFloatingBar,
			})),
		{ ssr: false },
	),
	"prompt-input-demo-floating-bar-dark-cta": dynamic(
		() =>
			import("../../demos/ui-custom/prompt-input-demo").then((mod) => ({
				default: mod.PromptInputDemoFloatingBarDarkCta,
			})),
		{ ssr: false },
	),
	"prompt-input-demo-floating-bar-text-send": dynamic(
		() =>
			import("../../demos/ui-custom/prompt-input-demo").then((mod) => ({
				default: mod.PromptInputDemoFloatingBarTextSend,
			})),
		{ ssr: false },
	),
	"prompt-input-demo-floating-bar-text-send-icon-xs": dynamic(
		() =>
			import("../../demos/ui-custom/prompt-input-demo").then((mod) => ({
				default: mod.PromptInputDemoFloatingBarTextSendIconXs,
			})),
		{ ssr: false },
	),
	"list-demo-basic": dynamic(
		() =>
			import("../../demos/ui-custom/list-demo").then((mod) => ({
				default: mod.ListDemoBasic,
			})),
		{ ssr: false },
	),
	"list-demo-with-status": dynamic(
		() =>
			import("../../demos/ui-custom/list-demo").then((mod) => ({
				default: mod.ListDemoWithStatus,
			})),
		{ ssr: false },
	),
	"queue-demo-prompt-queue": dynamic(
		() =>
			import("../../demos/ui-custom/queue-demo").then((mod) => ({
				default: mod.QueueDemoPromptQueue,
			})),
		{ ssr: false },
	),
	"queue-demo-with-actions": dynamic(
		() =>
			import("../../demos/ui-custom/queue-demo").then((mod) => ({
				default: mod.QueueDemoWithActions,
			})),
		{ ssr: false },
	),
	"queue-demo-with-attachments": dynamic(
		() =>
			import("../../demos/ui-custom/queue-demo").then((mod) => ({
				default: mod.QueueDemoWithAttachments,
			})),
		{ ssr: false },
	),
	"queue-demo-minimal": dynamic(
		() =>
			import("../../demos/ui-custom/queue-demo").then((mod) => ({
				default: mod.QueueDemoMinimal,
			})),
		{ ssr: false },
	),
	"reasoning-demo-preload": dynamic(
		() =>
			import("../../demos/ui-custom/reasoning-demo").then((mod) => ({
				default: mod.ReasoningDemoPreload,
			})),
		{ ssr: false },
	),
	"reasoning-demo-thinking": dynamic(
		() =>
			import("../../demos/ui-custom/reasoning-demo").then((mod) => ({
				default: mod.ReasoningDemoThinking,
			})),
		{ ssr: false },
	),
	"reasoning-demo-completed": dynamic(
		() =>
			import("../../demos/ui-custom/reasoning-demo").then((mod) => ({
				default: mod.ReasoningDemoCompleted,
			})),
		{ ssr: false },
	),
	"sandbox-demo-running": dynamic(
		() =>
			import("../../demos/ui-custom/sandbox-demo").then((mod) => ({
				default: mod.SandboxDemoRunning,
			})),
		{ ssr: false },
	),
	"sandbox-demo-error": dynamic(
		() =>
			import("../../demos/ui-custom/sandbox-demo").then((mod) => ({
				default: mod.SandboxDemoError,
			})),
		{ ssr: false },
	),
	"sandbox-demo-collapsed": dynamic(
		() =>
			import("../../demos/ui-custom/sandbox-demo").then((mod) => ({
				default: mod.SandboxDemoCollapsed,
			})),
		{ ssr: false },
	),
	"inline-citation-demo-with-carousel": dynamic(
		() =>
			import("../../demos/ui-custom/inline-citation-demo").then((mod) => ({
				default: mod.InlineCitationDemoWithCarousel,
			})),
		{ ssr: false },
	),
	"inline-citation-demo-basic": dynamic(
		() =>
			import("../../demos/ui-custom/inline-citation-demo").then((mod) => ({
				default: mod.InlineCitationDemoBasic,
			})),
		{ ssr: false },
	),
	"inline-citation-demo-multiple": dynamic(
		() =>
			import("../../demos/ui-custom/inline-citation-demo").then((mod) => ({
				default: mod.InlineCitationDemoMultiple,
			})),
		{ ssr: false },
	),
	"inline-citation-demo-single-source": dynamic(
		() =>
			import("../../demos/ui-custom/inline-citation-demo").then((mod) => ({
				default: mod.InlineCitationDemoSingleSource,
			})),
		{ ssr: false },
	),
	"mic-selector-demo-controlled": dynamic(
		() =>
			import("../../demos/ui-custom/mic-selector-demo").then((mod) => ({
				default: mod.MicSelectorDemoControlled,
			})),
		{ ssr: false },
	),
	"mic-selector-demo-with-checkmark": dynamic(
		() =>
			import("../../demos/ui-custom/mic-selector-demo").then((mod) => ({
				default: mod.MicSelectorDemoWithCheckmark,
			})),
		{ ssr: false },
	),
	"mic-selector-demo-compact": dynamic(
		() =>
			import("../../demos/ui-custom/mic-selector-demo").then((mod) => ({
				default: mod.MicSelectorDemoCompact,
			})),
		{ ssr: false },
	),
	"model-selector-demo-with-search": dynamic(
		() =>
			import("../../demos/ui-custom/model-selector-demo").then((mod) => ({
				default: mod.ModelSelectorDemoWithSearch,
			})),
		{ ssr: false },
	),
	"model-selector-demo-with-logos": dynamic(
		() =>
			import("../../demos/ui-custom/model-selector-demo").then((mod) => ({
				default: mod.ModelSelectorDemoWithLogos,
			})),
		{ ssr: false },
	),
	"model-selector-demo-multi-provider": dynamic(
		() =>
			import("../../demos/ui-custom/model-selector-demo").then((mod) => ({
				default: mod.ModelSelectorDemoMultiProvider,
			})),
		{ ssr: false },
	),
	"model-selector-demo-reasoning-modes": dynamic(
		() =>
			import("../../demos/ui-custom/model-selector-demo").then((mod) => ({
				default: mod.ModelSelectorDemoReasoningModes,
			})),
		{ ssr: false },
	),
	"node-demo-full": dynamic(
		() =>
			import("../../demos/ui-custom/node-demo").then((mod) => ({
				default: mod.NodeDemoFull,
			})),
		{ ssr: false },
	),
	"node-demo-header-only": dynamic(
		() =>
			import("../../demos/ui-custom/node-demo").then((mod) => ({
				default: mod.NodeDemoHeaderOnly,
			})),
		{ ssr: false },
	),
	"node-demo-with-action": dynamic(
		() =>
			import("../../demos/ui-custom/node-demo").then((mod) => ({
				default: mod.NodeDemoWithAction,
			})),
		{ ssr: false },
	),
	"node-demo-with-badge": dynamic(
		() =>
			import("../../demos/ui-custom/node-demo").then((mod) => ({
				default: mod.NodeDemoWithBadge,
			})),
		{ ssr: false },
	),
	"open-in-chat-demo-all-providers": dynamic(
		() =>
			import("../../demos/ui-custom/open-in-chat-demo").then((mod) => ({
				default: mod.OpenInChatDemoAllProviders,
			})),
		{ ssr: false },
	),
	"open-in-chat-demo-minimal": dynamic(
		() =>
			import("../../demos/ui-custom/open-in-chat-demo").then((mod) => ({
				default: mod.OpenInChatDemoMinimal,
			})),
		{ ssr: false },
	),
	"open-in-chat-demo-custom-trigger": dynamic(
		() =>
			import("../../demos/ui-custom/open-in-chat-demo").then((mod) => ({
				default: mod.OpenInChatDemoCustomTrigger,
			})),
		{ ssr: false },
	),
	"open-in-chat-demo-grouped": dynamic(
		() =>
			import("../../demos/ui-custom/open-in-chat-demo").then((mod) => ({
				default: mod.OpenInChatDemoGrouped,
			})),
		{ ssr: false },
	),
	"package-info-demo-full": dynamic(
		() =>
			import("../../demos/ui-custom/package-info-demo").then((mod) => ({
				default: mod.PackageInfoDemoFull,
			})),
		{ ssr: false },
	),
	"package-info-demo-change-types": dynamic(
		() =>
			import("../../demos/ui-custom/package-info-demo").then((mod) => ({
				default: mod.PackageInfoDemoChangeTypes,
			})),
		{ ssr: false },
	),
	"package-info-demo-with-dependencies": dynamic(
		() =>
			import("../../demos/ui-custom/package-info-demo").then((mod) => ({
				default: mod.PackageInfoDemoWithDependencies,
			})),
		{ ssr: false },
	),
	"package-info-demo-minimal": dynamic(
		() =>
			import("../../demos/ui-custom/package-info-demo").then((mod) => ({
				default: mod.PackageInfoDemoMinimal,
			})),
		{ ssr: false },
	),
	"flow-panel-demo-status-lozenge": dynamic(
		() =>
			import("../../demos/ui-custom/flow-panel-demo").then((mod) => ({
				default: mod.FlowPanelDemoStatusLozenge,
			})),
		{ ssr: false },
	),
	"flow-panel-demo-positions": dynamic(
		() =>
			import("../../demos/ui-custom/flow-panel-demo").then((mod) => ({
				default: mod.FlowPanelDemoPositions,
			})),
		{ ssr: false },
	),
	"persona-demo-states": dynamic(
		() =>
			import("../../demos/ui-custom/persona-demo").then((mod) => ({
				default: mod.PersonaDemoStates,
			})),
		{ ssr: false },
	),
	"persona-demo-variants": dynamic(
		() =>
			import("../../demos/ui-custom/persona-demo").then((mod) => ({
				default: mod.PersonaDemoVariants,
			})),
		{ ssr: false },
	),
	"persona-demo-custom-styling": dynamic(
		() =>
			import("../../demos/ui-custom/persona-demo").then((mod) => ({
				default: mod.PersonaDemoCustomStyling,
			})),
		{ ssr: false },
	),
};
