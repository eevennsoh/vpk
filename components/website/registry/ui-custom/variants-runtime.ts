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
