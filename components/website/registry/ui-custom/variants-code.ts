import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export const UI_CUSTOM_CODE_VARIANT_DEMOS: Record<string, ComponentType> = {
	"canvas-demo-workflow": dynamic(
		() =>
			import("../../demos/ui-custom/canvas-demo").then((mod) => ({
				default: mod.CanvasDemoWorkflow,
			})),
		{ ssr: false },
	),
	"canvas-demo-minimal": dynamic(
		() =>
			import("../../demos/ui-custom/canvas-demo").then((mod) => ({
				default: mod.CanvasDemoMinimal,
			})),
		{ ssr: false },
	),
	"canvas-demo-with-controls": dynamic(
		() =>
			import("../../demos/ui-custom/canvas-demo").then((mod) => ({
				default: mod.CanvasDemoWithControls,
			})),
		{ ssr: false },
	),
	"canvas-demo-with-panel": dynamic(
		() =>
			import("../../demos/ui-custom/canvas-demo").then((mod) => ({
				default: mod.CanvasDemoWithPanel,
			})),
		{ ssr: false },
	),
	"canvas-demo-with-toolbar": dynamic(
		() =>
			import("../../demos/ui-custom/canvas-demo").then((mod) => ({
				default: mod.CanvasDemoWithToolbar,
			})),
		{ ssr: false },
	),
	"toolbar-demo-with-nodes": dynamic(
		() =>
			import("../../demos/ui-custom/toolbar-demo").then((mod) => ({
				default: mod.ToolbarDemoWithNodes,
			})),
		{ ssr: false },
	),
	"image-demo-custom-styling": dynamic(
		() =>
			import("../../demos/ui-custom/image-demo").then((mod) => ({
				default: mod.ImageDemoCustomStyling,
			})),
		{ ssr: false },
	),
	"image-demo-gallery": dynamic(
		() =>
			import("../../demos/ui-custom/image-demo").then((mod) => ({
				default: mod.ImageDemoGallery,
			})),
		{ ssr: false },
	),
	"image-demo-in-message": dynamic(
		() =>
			import("../../demos/ui-custom/image-demo").then((mod) => ({
				default: mod.ImageDemoInMessage,
			})),
		{ ssr: false },
	),
	"jsx-preview-demo-basic": dynamic(
		() =>
			import("../../demos/ui-custom/jsx-preview-demo").then((mod) => ({
				default: mod.JsxPreviewDemoBasic,
			})),
		{ ssr: false },
	),
	"jsx-preview-demo-streaming": dynamic(
		() =>
			import("../../demos/ui-custom/jsx-preview-demo").then((mod) => ({
				default: mod.JsxPreviewDemoStreaming,
			})),
		{ ssr: false },
	),
	"jsx-preview-demo-with-components": dynamic(
		() =>
			import("../../demos/ui-custom/jsx-preview-demo").then((mod) => ({
				default: mod.JsxPreviewDemoWithComponents,
			})),
		{ ssr: false },
	),
	"jsx-preview-demo-with-error": dynamic(
		() =>
			import("../../demos/ui-custom/jsx-preview-demo").then((mod) => ({
				default: mod.JsxPreviewDemoWithError,
			})),
		{ ssr: false },
	),
	"jsx-preview-demo-custom-error": dynamic(
		() =>
			import("../../demos/ui-custom/jsx-preview-demo").then((mod) => ({
				default: mod.JsxPreviewDemoCustomError,
			})),
		{ ssr: false },
	),
};
