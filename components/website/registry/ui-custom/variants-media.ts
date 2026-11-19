import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export const UI_CUSTOM_MEDIA_VARIANT_DEMOS: Record<string, ComponentType> = {
	"live-waveform-demo-scrolling": dynamic(
		() => import("../../demos/ui-custom/live-waveform-demo").then((mod) => ({ default: mod.LiveWaveformDemoScrolling })),
		{ ssr: false },
	),
	"pixel-loader-demo-shapes": dynamic(
		() =>
			import("../../demos/ui-custom/pixel-loader-demo").then((mod) => ({
				default: mod.PixelLoaderDemoShapes,
			})),
		{ ssr: false },
	),
	"pixel-loader-demo-directions": dynamic(
		() =>
			import("../../demos/ui-custom/pixel-loader-demo").then((mod) => ({
				default: mod.PixelLoaderDemoDirections,
			})),
		{ ssr: false },
	),
	"pixel-loader-demo-rovo": dynamic(
		() =>
			import("../../demos/ui-custom/pixel-loader-demo").then((mod) => ({
				default: mod.PixelLoaderDemoRovo,
			})),
		{ ssr: false },
	),
	"pixel-loader-demo-inline": dynamic(
		() =>
			import("../../demos/ui-custom/pixel-loader-demo").then((mod) => ({
				default: mod.PixelLoaderDemoInline,
			})),
		{ ssr: false },
	),
	"pixel-loader-playground-demo": dynamic(
		() => import("../../demos/ui-custom/pixel-loader-playground-demo"),
		{ ssr: false },
	),
	"audio-player-demo-full": dynamic(
		() =>
			import("../../demos/ui-custom/audio-player-demo").then((mod) => ({
				default: mod.AudioPlayerDemoFull,
			})),
		{ ssr: false },
	),
	"audio-player-demo-compact": dynamic(
		() =>
			import("../../demos/ui-custom/audio-player-demo").then((mod) => ({
				default: mod.AudioPlayerDemoCompact,
			})),
		{ ssr: false },
	),
	"audio-player-demo-with-volume": dynamic(
		() =>
			import("../../demos/ui-custom/audio-player-demo").then((mod) => ({
				default: mod.AudioPlayerDemoWithVolume,
			})),
		{ ssr: false },
	),
	"animated-dot-demo-variants": dynamic(
		() =>
			import("../../demos/ui-custom/animated-dot-demo").then((mod) => ({
				default: mod.AnimatedDotDemoVariants,
			})),
		{ ssr: false },
	),
	"animated-dot-demo-custom-colors": dynamic(
		() =>
			import("../../demos/ui-custom/animated-dot-demo").then((mod) => ({
				default: mod.AnimatedDotDemoCustomColors,
			})),
		{ ssr: false },
	),
	"animated-dot-demo-timing": dynamic(
		() =>
			import("../../demos/ui-custom/animated-dot-demo").then((mod) => ({
				default: mod.AnimatedDotDemoTiming,
			})),
		{ ssr: false },
	),
	"animated-dot-demo-sizes": dynamic(
		() =>
			import("../../demos/ui-custom/animated-dot-demo").then((mod) => ({
				default: mod.AnimatedDotDemoSizes,
			})),
		{ ssr: false },
	),
	"animated-rovo-demo": dynamic(
		() => import("../../demos/ui-custom/animated-rovo-demo"),
		{ ssr: false },
	),
	"rovo-cursor-demo": dynamic(
		() => import("../../demos/ui-custom/rovo-cursor-demo"),
		{ ssr: false },
	),
	"twg-loader-demo-sizes": dynamic(
		() =>
			import("../../demos/ui-custom/twg-loader-demo").then((mod) => ({
				default: mod.TWGLoaderDemoSizes,
			})),
		{ ssr: false },
	),
	"twg-loader-demo-on-dark": dynamic(
		() =>
			import("../../demos/ui-custom/twg-loader-demo").then((mod) => ({
				default: mod.TWGLoaderDemoOnDark,
			})),
		{ ssr: false },
	),
	"rovo-generation-demo-default": dynamic(
		() =>
			import("../../demos/ui-custom/rovo-generation-demo").then((mod) => ({
				default: mod.RovoGenerationDemoDefault,
			})),
		{ ssr: false },
	),
	"rovo-generation-demo-rainbow-glow": dynamic(
		() =>
			import("../../demos/ui-custom/rovo-generation-demo").then((mod) => ({
				default: mod.RovoGenerationDemoRainbowGlow,
			})),
		{ ssr: false },
	),
	"rovo-generation-demo-rainbow-border": dynamic(
		() =>
			import("../../demos/ui-custom/rovo-generation-demo").then((mod) => ({
				default: mod.RovoGenerationDemoRainbowBorder,
			})),
		{ ssr: false },
	),
	"rovo-generation-demo-rainbow-glow-and-border": dynamic(
		() =>
			import("../../demos/ui-custom/rovo-generation-demo").then((mod) => ({
				default: mod.RovoGenerationDemoRainbowGlowAndBorder,
			})),
		{ ssr: false },
	),
	"rovo-generation-demo-highlight": dynamic(
		() =>
			import("../../demos/ui-custom/rovo-generation-demo").then((mod) => ({
				default: mod.RovoGenerationDemoHighlight,
			})),
		{ ssr: false },
	),
	"confirmation-demo-request": dynamic(
		() =>
			import("../../demos/ui-custom/confirmation-demo").then((mod) => ({
				default: mod.ConfirmationDemoRequest,
			})),
		{ ssr: false },
	),
	"confirmation-demo-accepted": dynamic(
		() =>
			import("../../demos/ui-custom/confirmation-demo").then((mod) => ({
				default: mod.ConfirmationDemoAccepted,
			})),
		{ ssr: false },
	),
	"confirmation-demo-rejected": dynamic(
		() =>
			import("../../demos/ui-custom/confirmation-demo").then((mod) => ({
				default: mod.ConfirmationDemoRejected,
			})),
		{ ssr: false },
	),
	"context-demo-with-cost": dynamic(
		() =>
			import("../../demos/ui-custom/context-demo").then((mod) => ({
				default: mod.ContextDemoWithCost,
			})),
		{ ssr: false },
	),
	"context-demo-minimal": dynamic(
		() =>
			import("../../demos/ui-custom/context-demo").then((mod) => ({
				default: mod.ContextDemoMinimal,
			})),
		{ ssr: false },
	),
	"context-demo-high-usage": dynamic(
		() =>
			import("../../demos/ui-custom/context-demo").then((mod) => ({
				default: mod.ContextDemoHighUsage,
			})),
		{ ssr: false },
	),
	"context-demo-custom-trigger": dynamic(
		() =>
			import("../../demos/ui-custom/context-demo").then((mod) => ({
				default: mod.ContextDemoCustomTrigger,
			})),
		{ ssr: false },
	),
	"context-bar-demo-collapsible": dynamic(
		() =>
			import("../../demos/ui-custom/context-bar-demo").then((mod) => ({
				default: mod.ContextBarDemoCollapsible,
			})),
		{ ssr: false },
	),
	"context-bar-demo-dismissible": dynamic(
		() =>
			import("../../demos/ui-custom/context-bar-demo").then((mod) => ({
				default: mod.ContextBarDemoDismissible,
			})),
		{ ssr: false },
	),
	"context-bar-demo-trigger": dynamic(
		() =>
			import("../../demos/ui-custom/context-bar-demo").then((mod) => ({
				default: mod.ContextBarDemoTrigger,
			})),
		{ ssr: false },
	),
	"context-bar-demo-animated": dynamic(
		() =>
			import("../../demos/ui-custom/context-bar-demo").then((mod) => ({
				default: mod.ContextBarDemoAnimated,
			})),
		{ ssr: false },
	),
	"context-bar-demo-multi-pill": dynamic(
		() =>
			import("../../demos/ui-custom/context-bar-demo").then((mod) => ({
				default: mod.ContextBarDemoMultiPill,
			})),
		{ ssr: false },
	),
	"context-bar-demo-create-pull-request": dynamic(
		() =>
			import("../../demos/ui-custom/context-bar-demo").then((mod) => ({
				default: mod.ContextBarDemoCreatePullRequest,
			})),
		{ ssr: false },
	),
	"context-bar-demo-pull-request": dynamic(
		() =>
			import("../../demos/ui-custom/context-bar-demo").then((mod) => ({
				default: mod.ContextBarDemoPullRequest,
			})),
		{ ssr: false },
	),
	"context-bar-demo-prompt-flyout": dynamic(
		() =>
			import("../../demos/ui-custom/context-bar-demo").then((mod) => ({
				default: mod.ContextBarDemoPromptFlyout,
			})),
		{ ssr: false },
	),
	"environment-variable-demo-with-copy": dynamic(
		() =>
			import("../../demos/ui-custom/environment-variable-demo").then((mod) => ({
				default: mod.EnvironmentVariableDemoWithCopy,
			})),
		{ ssr: false },
	),
	"environment-variable-demo-with-required": dynamic(
		() =>
			import("../../demos/ui-custom/environment-variable-demo").then((mod) => ({
				default: mod.EnvironmentVariableDemoWithRequired,
			})),
		{ ssr: false },
	),
	"environment-variable-demo-revealed": dynamic(
		() =>
			import("../../demos/ui-custom/environment-variable-demo").then((mod) => ({
				default: mod.EnvironmentVariableDemoRevealed,
			})),
		{ ssr: false },
	),
	"environment-variable-demo-minimal": dynamic(
		() =>
			import("../../demos/ui-custom/environment-variable-demo").then((mod) => ({
				default: mod.EnvironmentVariableDemoMinimal,
			})),
		{ ssr: false },
	),
	"control-demo-default": dynamic(
		() =>
			import("../../demos/ui-custom/control-demo").then((mod) => ({
				default: mod.ControlDemoDefault,
			})),
		{ ssr: false },
	),
	"control-demo-position": dynamic(
		() =>
			import("../../demos/ui-custom/control-demo").then((mod) => ({
				default: mod.ControlDemoPosition,
			})),
		{ ssr: false },
	),
	"control-demo-zoom-only": dynamic(
		() =>
			import("../../demos/ui-custom/control-demo").then((mod) => ({
				default: mod.ControlDemoZoomOnly,
			})),
		{ ssr: false },
	),
	"control-demo-fit-only": dynamic(
		() =>
			import("../../demos/ui-custom/control-demo").then((mod) => ({
				default: mod.ControlDemoFitOnly,
			})),
		{ ssr: false },
	),
	"edge-demo-animated": dynamic(
		() =>
			import("../../demos/ui-custom/edge-demo").then((mod) => ({
				default: mod.EdgeDemoAnimated,
			})),
		{ ssr: false },
	),
	"edge-demo-temporary": dynamic(
		() =>
			import("../../demos/ui-custom/edge-demo").then((mod) => ({
				default: mod.EdgeDemoTemporary,
			})),
		{ ssr: false },
	),
	"edge-demo-mixed": dynamic(
		() =>
			import("../../demos/ui-custom/edge-demo").then((mod) => ({
				default: mod.EdgeDemoMixed,
			})),
		{ ssr: false },
	),
	"file-tree-demo-custom-icons": dynamic(
		() =>
			import("../../demos/ui-custom/file-tree-demo").then((mod) => ({
				default: mod.FileTreeDemoCustomIcons,
			})),
		{ ssr: false },
	),
	"file-tree-demo-with-actions": dynamic(
		() =>
			import("../../demos/ui-custom/file-tree-demo").then((mod) => ({
				default: mod.FileTreeDemoWithActions,
			})),
		{ ssr: false },
	),
	"file-explorer-demo-path-first": dynamic(
		() =>
			import("../../demos/ui-custom/file-explorer-demo").then((mod) => ({
				default: mod.FileExplorerDemoPathFirst,
			})),
		{ ssr: false },
	),
	"file-explorer-demo-flatten-empty-directories": dynamic(
		() =>
			import("../../demos/ui-custom/file-explorer-demo").then((mod) => ({
				default: mod.FileExplorerDemoFlattenEmptyDirectories,
			})),
		{ ssr: false },
	),
	"file-explorer-demo-git-status": dynamic(
		() =>
			import("../../demos/ui-custom/file-explorer-demo").then((mod) => ({
				default: mod.FileExplorerDemoGitStatus,
			})),
		{ ssr: false },
	),
	"file-explorer-demo-drag-and-drop": dynamic(
		() =>
			import("../../demos/ui-custom/file-explorer-demo").then((mod) => ({
				default: mod.FileExplorerDemoDragAndDrop,
			})),
		{ ssr: false },
	),
	"file-explorer-demo-icon-rules": dynamic(
		() =>
			import("../../demos/ui-custom/file-explorer-demo").then((mod) => ({
				default: mod.FileExplorerDemoIconRules,
			})),
		{ ssr: false },
	),
};
