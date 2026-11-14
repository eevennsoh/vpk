// Public entry point for generative widget parsing, metadata and card presentation.
// Importers keep using this path; the implementation lives in the generative-widget-*.ts
// modules (base: types, text, spec-query; parsing: preview-body, parse; inference: actions,
// content-type, description, metadata; presentation: body-only-spec, card-copy).

export type {
	ParsedGenerativeWidgetSource,
	GenerativeWidgetActionItem,
	PreviewImageSource,
	PreviewVideoTrack,
	PreviewVideoClip,
	PreviewVideoComposition,
	PreviewExcalidrawScene,
	PreviewBody,
	ParsedGenerativeWidget,
	PreviewAudioBody,
	PreviewImageBody,
	PreviewVideoBody,
	GenerativeWidgetMetadata,
	GenerativeWidgetPrimaryActionPayload,
	GenerativeContentType,
} from "@/components/projects/shared/lib/generative-widget-types";
export {
	parseGenerativeWidget,
} from "@/components/projects/shared/lib/generative-widget-parse";
export {
	resolveGenerativeWidgetMetadata,
} from "@/components/projects/shared/lib/generative-widget-metadata";
export {
	createBodyOnlySpec,
} from "@/components/projects/shared/lib/generative-widget-body-only-spec";
export {
	buildGenerativeWidgetSubmitPrompt,
	formatGenerativeWidgetCardDescription,
} from "@/components/projects/shared/lib/generative-widget-card-copy";
