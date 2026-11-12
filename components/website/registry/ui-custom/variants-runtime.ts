import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export const UI_CUSTOM_RUNTIME_VARIANT_DEMOS: Record<string, ComponentType> = {
	"schema-display-demo-with-params": dynamic(
		() =>
			import("../../demos/ui-custom/schema-display-demo").then((mod) => ({
				default: mod.SchemaDisplayDemoWithParams,
			})),
		{ ssr: false },
	),
	"schema-display-demo-with-body": dynamic(
		() =>
			import("../../demos/ui-custom/schema-display-demo").then((mod) => ({
				default: mod.SchemaDisplayDemoWithBody,
			})),
		{ ssr: false },
	),
	"schema-display-demo-nested": dynamic(
		() =>
			import("../../demos/ui-custom/schema-display-demo").then((mod) => ({
				default: mod.SchemaDisplayDemoNested,
			})),
		{ ssr: false },
	),
	"schema-display-demo-methods": dynamic(
		() =>
			import("../../demos/ui-custom/schema-display-demo").then((mod) => ({
				default: mod.SchemaDisplayDemoMethods,
			})),
		{ ssr: false },
	),
	"schema-display-demo-custom-composition": dynamic(
		() =>
			import("../../demos/ui-custom/schema-display-demo").then((mod) => ({
				default: mod.SchemaDisplayDemoCustomComposition,
			})),
		{ ssr: false },
	),
	"shimmer-demo-custom-duration": dynamic(
		() =>
			import("../../demos/ui-custom/shimmer-demo").then((mod) => ({
				default: mod.ShimmerDemoCustomDuration,
			})),
		{ ssr: false },
	),
	"shimmer-demo-custom-spread": dynamic(
		() =>
			import("../../demos/ui-custom/shimmer-demo").then((mod) => ({
				default: mod.ShimmerDemoCustomSpread,
			})),
		{ ssr: false },
	),
	"shimmer-demo-color": dynamic(
		() =>
			import("../../demos/ui-custom/shimmer-demo").then((mod) => ({
				default: mod.ShimmerDemoColor,
			})),
		{ ssr: false },
	),
	"shimmer-demo-duration-utility": dynamic(
		() =>
			import("../../demos/ui-custom/shimmer-demo").then((mod) => ({
				default: mod.ShimmerDemoDurationUtility,
			})),
		{ ssr: false },
	),
	"shimmer-demo-spread-utility": dynamic(
		() =>
			import("../../demos/ui-custom/shimmer-demo").then((mod) => ({
				default: mod.ShimmerDemoSpreadUtility,
			})),
		{ ssr: false },
	),
	"shimmer-demo-angle": dynamic(
		() =>
			import("../../demos/ui-custom/shimmer-demo").then((mod) => ({
				default: mod.ShimmerDemoAngle,
			})),
		{ ssr: false },
	),
	"shimmer-demo-once": dynamic(
		() =>
			import("../../demos/ui-custom/shimmer-demo").then((mod) => ({
				default: mod.ShimmerDemoOnce,
			})),
		{ ssr: false },
	),
	"shimmer-demo-disabled": dynamic(
		() =>
			import("../../demos/ui-custom/shimmer-demo").then((mod) => ({
				default: mod.ShimmerDemoDisabled,
			})),
		{ ssr: false },
	),
	"shimmer-demo-rtl": dynamic(
		() =>
			import("../../demos/ui-custom/shimmer-demo").then((mod) => ({
				default: mod.ShimmerDemoRtl,
			})),
		{ ssr: false },
	),
	"shimmer-demo-marker": dynamic(
		() =>
			import("../../demos/ui-custom/shimmer-demo").then((mod) => ({
				default: mod.ShimmerDemoMarker,
			})),
		{ ssr: false },
	),
	"shimmer-wave-demo-basic": dynamic(
		() =>
			import("../../demos/ui-custom/shimmer-wave-demo").then((mod) => ({
				default: mod.ShimmerWaveDemoBasic,
			})),
		{ ssr: false },
	),
	"shimmer-wave-demo-colors": dynamic(
		() =>
			import("../../demos/ui-custom/shimmer-wave-demo").then((mod) => ({
				default: mod.ShimmerWaveDemoColors,
			})),
		{ ssr: false },
	),
	"shimmer-wave-demo-geometry": dynamic(
		() =>
			import("../../demos/ui-custom/shimmer-wave-demo").then((mod) => ({
				default: mod.ShimmerWaveDemoGeometry,
			})),
		{ ssr: false },
	),
	"shimmer-wave-demo-depth": dynamic(
		() =>
			import("../../demos/ui-custom/shimmer-wave-demo").then((mod) => ({
				default: mod.ShimmerWaveDemoDepth,
			})),
		{ ssr: false },
	),
	"shimmer-wave-demo-timing-spread": dynamic(
		() =>
			import("../../demos/ui-custom/shimmer-wave-demo").then((mod) => ({
				default: mod.ShimmerWaveDemoTimingSpread,
			})),
		{ ssr: false },
	),
	"shimmer-wave-demo-full-config": dynamic(
		() =>
			import("../../demos/ui-custom/shimmer-wave-demo").then((mod) => ({
				default: mod.ShimmerWaveDemoFullConfig,
			})),
		{ ssr: false },
	),
	"shimmer-demo-heading": dynamic(
		() =>
			import("../../demos/ui-custom/shimmer-demo").then((mod) => ({
				default: mod.ShimmerDemoHeading,
			})),
		{ ssr: false },
	),
	"snippet-demo-plain": dynamic(
		() =>
			import("../../demos/ui-custom/snippet-demo").then((mod) => ({
				default: mod.SnippetDemoPlain,
			})),
		{ ssr: false },
	),
	"snippet-demo-multiple": dynamic(
		() =>
			import("../../demos/ui-custom/snippet-demo").then((mod) => ({
				default: mod.SnippetDemoMultiple,
			})),
		{ ssr: false },
	),
	"snippet-demo-callbacks": dynamic(
		() =>
			import("../../demos/ui-custom/snippet-demo").then((mod) => ({
				default: mod.SnippetDemoCallbacks,
			})),
		{ ssr: false },
	),
	"source-demo-custom-rendering": dynamic(
		() =>
			import("../../demos/ui-custom/source-demo").then((mod) => ({
				default: mod.SourceDemoCustomRendering,
			})),
		{ ssr: false },
	),
	"source-demo-preview-menu": dynamic(
		() => import("../../demos/ui-custom/source-demo-preview-menu"),
		{ ssr: false },
	),
	"speech-input-demo-with-transcript": dynamic(
		() =>
			import("../../demos/ui-custom/speech-input-demo").then((mod) => ({
				default: mod.SpeechInputDemoWithTranscript,
			})),
		{ ssr: false },
	),
	"speech-input-demo-sizes": dynamic(
		() =>
			import("../../demos/ui-custom/speech-input-demo").then((mod) => ({
				default: mod.SpeechInputDemoSizes,
			})),
		{ ssr: false },
	),
	"speech-input-demo-disabled": dynamic(
		() =>
			import("../../demos/ui-custom/speech-input-demo").then((mod) => ({
				default: mod.SpeechInputDemoDisabled,
			})),
		{ ssr: false },
	),
	"terminal-demo-streaming": dynamic(
		() =>
			import("../../demos/ui-custom/terminal-demo").then((mod) => ({
				default: mod.TerminalDemoStreaming,
			})),
		{ ssr: false },
	),
	"terminal-demo-clearable": dynamic(
		() =>
			import("../../demos/ui-custom/terminal-demo").then((mod) => ({
				default: mod.TerminalDemoClearable,
			})),
		{ ssr: false },
	),
	"terminal-demo-composed": dynamic(
		() =>
			import("../../demos/ui-custom/terminal-demo").then((mod) => ({
				default: mod.TerminalDemoComposed,
			})),
		{ ssr: false },
	),
	"terminal-demo-ansi": dynamic(
		() =>
			import("../../demos/ui-custom/terminal-demo").then((mod) => ({
				default: mod.TerminalDemoAnsi,
			})),
		{ ssr: false },
	),
	"test-result-demo-with-progress": dynamic(
		() =>
			import("../../demos/ui-custom/test-result-demo").then((mod) => ({
				default: mod.TestResultDemoWithProgress,
			})),
		{ ssr: false },
	),
	"test-result-demo-with-errors": dynamic(
		() =>
			import("../../demos/ui-custom/test-result-demo").then((mod) => ({
				default: mod.TestResultDemoWithErrors,
			})),
		{ ssr: false },
	),
	"test-result-demo-running": dynamic(
		() =>
			import("../../demos/ui-custom/test-result-demo").then((mod) => ({
				default: mod.TestResultDemoRunning,
			})),
		{ ssr: false },
	),
	"stack-trace-demo-open": dynamic(
		() =>
			import("../../demos/ui-custom/stack-trace-demo").then((mod) => ({
				default: mod.StackTraceDemoOpen,
			})),
		{ ssr: false },
	),
	"stack-trace-demo-filter-internals": dynamic(
		() =>
			import("../../demos/ui-custom/stack-trace-demo").then((mod) => ({
				default: mod.StackTraceDemoFilterInternals,
			})),
		{ ssr: false },
	),
	"stack-trace-demo-clickable": dynamic(
		() =>
			import("../../demos/ui-custom/stack-trace-demo").then((mod) => ({
				default: mod.StackTraceDemoClickable,
			})),
		{ ssr: false },
	),
	"suggestion-demo-vertical": dynamic(
		() =>
			import("../../demos/ui-custom/suggestion-demo").then((mod) => ({
				default: mod.SuggestionDemoVertical,
			})),
		{ ssr: false },
	),
	"suggestion-demo-with-icons": dynamic(
		() =>
			import("../../demos/ui-custom/suggestion-demo").then((mod) => ({
				default: mod.SuggestionDemoWithIcons,
			})),
		{ ssr: false },
	),
	"tool-demo-running": dynamic(
		() =>
			import("../../demos/ui-custom/tool-demo").then((mod) => ({
				default: mod.ToolDemoRunning,
			})),
		{ ssr: false },
	),
	"tool-demo-error": dynamic(
		() =>
			import("../../demos/ui-custom/tool-demo").then((mod) => ({
				default: mod.ToolDemoError,
			})),
		{ ssr: false },
	),
	"tool-demo-collapsed": dynamic(
		() =>
			import("../../demos/ui-custom/tool-demo").then((mod) => ({
				default: mod.ToolDemoCollapsed,
			})),
		{ ssr: false },
	),
	"tool-demo-pending": dynamic(
		() =>
			import("../../demos/ui-custom/tool-demo").then((mod) => ({
				default: mod.ToolDemoPending,
			})),
		{ ssr: false },
	),
	"tool-demo-approval": dynamic(
		() =>
			import("../../demos/ui-custom/tool-demo").then((mod) => ({
				default: mod.ToolDemoApproval,
			})),
		{ ssr: false },
	),
	"twg-tool-demo-single-source": dynamic(
		() =>
			import("../../demos/ui-custom/twg-tool-demo").then((mod) => ({
				default: mod.TwgToolDemoSingleSource,
			})),
		{ ssr: false },
	),
	"twg-tool-demo-multiple-sources": dynamic(
		() =>
			import("../../demos/ui-custom/twg-tool-demo").then((mod) => ({
				default: mod.TwgToolDemoMultipleSources,
			})),
		{ ssr: false },
	),
	"twg-tool-demo-completed": dynamic(
		() =>
			import("../../demos/ui-custom/twg-tool-demo").then((mod) => ({
				default: mod.TwgToolDemoCompleted,
			})),
		{ ssr: false },
	),
	"twg-appstack-demo-static": dynamic(
		() =>
			import("../../demos/ui-custom/twg-appstack-demo").then((mod) => ({
				default: mod.TWGAppstackDemoStatic,
			})),
		{ ssr: false },
	),
	"twg-appstack-demo-overflow": dynamic(
		() =>
			import("../../demos/ui-custom/twg-appstack-demo").then((mod) => ({
				default: mod.TWGAppstackDemoOverflow,
			})),
		{ ssr: false },
	),
	"twg-appstack-demo-overflow-grow": dynamic(
		() =>
			import("../../demos/ui-custom/twg-appstack-demo").then((mod) => ({
				default: mod.TWGAppstackDemoOverflowGrow,
			})),
		{ ssr: false },
	),
	"twg-appstack-demo-sizes": dynamic(
		() =>
			import("../../demos/ui-custom/twg-appstack-demo").then((mod) => ({
				default: mod.TWGAppstackDemoSizes,
			})),
		{ ssr: false },
	),
	"transcription-demo-static": dynamic(
		() =>
			import("../../demos/ui-custom/transcription-demo").then((mod) => ({
				default: mod.TranscriptionDemoStatic,
			})),
		{ ssr: false },
	),
	"transcription-demo-with-seek": dynamic(
		() =>
			import("../../demos/ui-custom/transcription-demo").then((mod) => ({
				default: mod.TranscriptionDemoWithSeek,
			})),
		{ ssr: false },
	),
	"voice-selector-demo-with-attributes": dynamic(
		() =>
			import("../../demos/ui-custom/voice-selector-demo").then((mod) => ({
				default: mod.VoiceSelectorDemoWithAttributes,
			})),
		{ ssr: false },
	),
	"voice-selector-demo-multi-provider": dynamic(
		() =>
			import("../../demos/ui-custom/voice-selector-demo").then((mod) => ({
				default: mod.VoiceSelectorDemoMultiProvider,
			})),
		{ ssr: false },
	),
	"voice-selector-demo-with-preview": dynamic(
		() =>
			import("../../demos/ui-custom/voice-selector-demo").then((mod) => ({
				default: mod.VoiceSelectorDemoWithPreview,
			})),
		{ ssr: false },
	),
	"web-preview-demo-basic": dynamic(
		() =>
			import("../../demos/ui-custom/web-preview-demo").then((mod) => ({
				default: mod.WebPreviewDemoBasic,
			})),
		{ ssr: false },
	),
	"web-preview-demo-with-console": dynamic(
		() =>
			import("../../demos/ui-custom/web-preview-demo").then((mod) => ({
				default: mod.WebPreviewDemoWithConsole,
			})),
		{ ssr: false },
	),
	"web-preview-demo-fullscreen": dynamic(
		() =>
			import("../../demos/ui-custom/web-preview-demo").then((mod) => ({
				default: mod.WebPreviewDemoFullscreen,
			})),
		{ ssr: false },
	),
	"web-preview-demo-url-change": dynamic(
		() =>
			import("../../demos/ui-custom/web-preview-demo").then((mod) => ({
				default: mod.WebPreviewDemoUrlChange,
			})),
		{ ssr: false },
	),
	"web-preview-demo-external": dynamic(
		() =>
			import("../../demos/ui-custom/web-preview-demo").then((mod) => ({
				default: mod.WebPreviewDemoExternal,
			})),
		{ ssr: false },
	),
};
