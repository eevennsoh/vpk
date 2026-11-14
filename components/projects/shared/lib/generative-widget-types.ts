import type { Spec } from "@json-render/react";

export interface ParsedGenerativeWidgetSource {
	name?: string;
	logoSrc?: string;
}

export interface GenerativeWidgetActionItem {
	label: string;
	href?: string;
}

export interface ParsedGenerativeWidgetBase {
	title?: string;
	description?: string;
	primaryActionLabel?: string;
	actions?: GenerativeWidgetActionItem[];
	source: ParsedGenerativeWidgetSource | null;
	contentTypeHint?: string;
	iconHint?: string;
}

export interface PreviewImageSource {
	url: string;
	mimeType?: string;
}

export interface PreviewVideoTrack {
	id: string;
	name: string;
	type: string;
	enabled: boolean;
}

export interface PreviewVideoClip {
	id: string;
	trackId: string;
	component: string;
	props: Record<string, unknown>;
	from: number;
	durationInFrames: number;
}

export interface PreviewVideoComposition {
	id: string;
	fps: number;
	width: number;
	height: number;
	durationInFrames: number;
}

export interface PreviewVideoFile {
	videoUrl: string;
	mimeType?: string;
	posterUrl?: string;
	fileName?: string;
}

export interface PreviewExcalidrawScene {
	type?: string;
	version?: number;
	source?: string;
	elements: unknown[];
	appState?: Record<string, unknown> | null;
	files?: Record<string, unknown>;
}

export type PreviewBody =
	| {
		kind: "json-render";
		spec: Spec;
	}
	| {
		kind: "audio";
		audioUrl: string;
		mimeType?: string;
		transcript?: string;
	}
	| {
		kind: "image";
		images: PreviewImageSource[];
		prompt?: string;
	}
	| {
		kind: "video";
		videoUrl?: string;
		mimeType?: string;
		posterUrl?: string;
		fileName?: string;
		composition?: PreviewVideoComposition;
		tracks?: PreviewVideoTrack[];
		clips?: PreviewVideoClip[];
		audio?: { tracks: unknown[] };
	}
	| {
		kind: "text";
		text: string;
		markdown?: boolean;
	}
	| {
		kind: "code";
		code: string;
		language?: string;
	}
	| {
		kind: "html";
		html: string;
		summary?: string;
	}
	| {
		kind: "app-url";
		url: string;
		summary?: string;
	}
	| {
		kind: "excalidraw";
		scene: PreviewExcalidrawScene;
	}
	| {
		kind: "json";
		value: unknown;
	};

export interface ParsedGenerativeWidget extends ParsedGenerativeWidgetBase {
	type: "genui-preview";
	body: PreviewBody;
	summary?: string;
}

export interface PreviewAudioBody {
	kind: "audio";
	audioUrl: string;
	mimeType?: string;
	transcript?: string;
}

export interface PreviewImageBody {
	kind: "image";
	images: PreviewImageSource[];
	prompt?: string;
}

export interface PreviewVideoBody {
	kind: "video";
	videoUrl?: string;
	mimeType?: string;
	posterUrl?: string;
	fileName?: string;
	composition?: PreviewVideoComposition;
	tracks?: PreviewVideoTrack[];
	clips?: PreviewVideoClip[];
	audio?: { tracks: unknown[] };
}

type JsonRenderPreviewBody = Extract<PreviewBody, { kind: "json-render" }>;

export function isJsonRenderBody(body: PreviewBody): body is JsonRenderPreviewBody {
	return body.kind === "json-render";
}

export interface GenerativeWidgetMetadata {
	contentType: GenerativeContentType;
	title: string;
	description: string;
	primaryActionLabel?: string;
	actions?: GenerativeWidgetActionItem[];
	actionLabels?: string[];
	source: ParsedGenerativeWidgetSource | null;
	iconHint?: string;
	iconHintText?: string;
}

export interface GenerativeWidgetPrimaryActionPayload {
	widgetType: "genui-preview";
	actionLabel: string;
	title: string;
	description: string;
	formState: Record<string, unknown>;
}

export type GenerativeContentType =
	| "image"
	| "memory"
	| "skill"
	| "text"
	| "translation"
	| "message"
	| "calendar"
	| "chart-bar"
	| "chart-line"
	| "chart-area"
	| "chart-pie"
	| "chart-radar"
	| "chart-scatter"
	| "chart"
	| "feed"
	| "sound"
	| "video"
	| "work-item"
	| "page"
	| "board"
	| "table"
	| "code"
	| "ui"
	| "other";
