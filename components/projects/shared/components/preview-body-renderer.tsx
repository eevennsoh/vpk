"use client";

// oxlint-disable react-doctor/media-has-caption -- These media previews render generated or user-supplied media where no caption asset is available; transcript or metadata is rendered separately when provided.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { JsonRenderView } from "@/lib/json-render/renderer";
import { useProgressiveSpec } from "@/lib/json-render/use-progressive-spec";
import { cn } from "@/lib/utils";
import { MessageResponse } from "@/components/ui-custom/message";
import { CodeBlock } from "@/components/ui/code-block";
import { HighlightedCodeContent } from "@/components/ui-custom/highlighted-code-content";
import {
	Transcription,
	TranscriptionSegment,
} from "@/components/ui-custom/transcription";
import { VideoPreviewBody } from "@/components/projects/shared/components/video-preview-body";
import { ExcalidrawPreview } from "@/components/projects/shared/components/excalidraw-preview";
import type {
	PreviewBody,
	PreviewVideoBody,
} from "@/components/projects/shared/lib/generative-widget";
import type { BundledLanguage } from "shiki";

const SUMMARY_STREAM_INTERVAL_MS = 24;
const SUMMARY_STREAM_STEP_CHARS = 18;
const VPK_HTML_GENERATOR_META_PATTERN = /<meta\s+name=["']generator["']\s+content=["']vpk-html["'][^>]*>/iu;
const ARTIFACT_PANE_PREVIEW_ATTR = "data-vpk-artifact-pane-preview";
const ARTIFACT_PANE_PREVIEW_STYLE = `<style ${ARTIFACT_PANE_PREVIEW_ATTR}>
@media screen {
	html[${ARTIFACT_PANE_PREVIEW_ATTR}="true"] body > .page:first-child {
		margin-left: 0 !important;
		margin-right: auto !important;
		padding-top: 0 !important;
	}

	html[${ARTIFACT_PANE_PREVIEW_ATTR}="true"] body > .page:first-child > .masthead:first-child {
		padding-top: 0 !important;
	}
}
</style>`;

type PreviewSurface = "card" | "dialog" | "artifact-pane";

interface PreviewBodyRendererProps {
	body: PreviewBody;
	surface: PreviewSurface;
	title: string;
	summary?: string;
	isStreaming?: boolean;
	progressive?: boolean;
	onStateChange?: (changes: Array<{ path: string; value: unknown }>) => void;
	cardSpecOverride?: import("@json-render/react").Spec | null;
}

function estimateTranscriptSegments(
	text: string,
	duration: number,
): Array<{ text: string; startSecond: number; endSecond: number }> {
	const words = text.split(/\s+/).filter(Boolean);
	if (words.length === 0 || duration <= 0) {
		return [];
	}

	const totalChars = words.reduce((sum, word) => sum + word.length, 0);
	let cursor = 0;

	return words.map((word) => {
		const fraction = word.length / totalChars;
		const wordDuration = fraction * duration;
		const segment = {
			text: word,
			startSecond: cursor,
			endSecond: cursor + wordDuration,
		};
		cursor += wordDuration;
		return segment;
	});
}

function StreamingSummaryPreview({ summary }: Readonly<{ summary: string }>): ReactNode {
	const [cursor, setCursor] = useState(0);

	useEffect(() => {
		if (!summary) {
			return;
		}

		let nextCursor = 0;
		const intervalId = window.setInterval(() => {
			nextCursor = Math.min(summary.length, nextCursor + SUMMARY_STREAM_STEP_CHARS);
			setCursor(nextCursor);
			if (nextCursor >= summary.length) {
				window.clearInterval(intervalId);
			}
		}, SUMMARY_STREAM_INTERVAL_MS);

		return () => {
			window.clearInterval(intervalId);
		};
	}, [summary]);

	return (
		<div className="whitespace-pre-wrap text-sm leading-6 text-text">
			{summary.slice(0, cursor)}
		</div>
	);
}

function inferCodeLanguage(code: string): BundledLanguage {
	if (code.trim().startsWith("{") || code.trim().startsWith("[")) {
		return "json";
	}

	if (/<!doctype html>|<html[\s>]|<head[\s>]|<body[\s>]|<style[\s>]/iu.test(code)) {
		return "html";
	}

	if (/^\s*[.#@]?[a-z0-9_-]+\s*\{[\s\S]*\}\s*$/imu.test(code)) {
		return "css";
	}

	return "tsx";
}

function resolveCodeLanguage(language: string | undefined, code: string): BundledLanguage {
	if (language === "html" || language === "css" || language === "tsx" || language === "json") {
		return language;
	}

	return inferCodeLanguage(code);
}

function getArtifactPaneHtmlPreview(html: string): string {
	if (
		!VPK_HTML_GENERATOR_META_PATTERN.test(html) ||
		html.includes(ARTIFACT_PANE_PREVIEW_ATTR)
	) {
		return html;
	}

	const htmlWithPreviewAttribute = html.replace(
		/<html\b([^>]*)>/iu,
		`<html$1 ${ARTIFACT_PANE_PREVIEW_ATTR}="true">`,
	);

	if (htmlWithPreviewAttribute === html) {
		return html;
	}

	return htmlWithPreviewAttribute.replace(
		/<\/head>/iu,
		`${ARTIFACT_PANE_PREVIEW_STYLE}\n</head>`,
	);
}

function AudioPreview({
	audioUrl,
	surface,
	transcript,
}: Readonly<{
	audioUrl: string;
	surface: PreviewSurface;
	transcript?: string;
}>): ReactNode {
	const audioRef = useRef<HTMLAudioElement>(null);
	const [duration, setDuration] = useState(0);
	const [currentTime, setCurrentTime] = useState(0);

	const segments = useMemo(
		() => (transcript && duration > 0 ? estimateTranscriptSegments(transcript, duration) : []),
		[duration, transcript],
	);

	return (
		<div className={cn("rounded-md bg-surface", surface !== "card" && "p-4")}>
				<audio
					aria-label="Audio preview"
					ref={audioRef}
				className="w-full"
				controls
				src={audioUrl}
				onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
				onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
			/>
			{segments.length > 0 && surface !== "card" ? (
				<Transcription
					className="mt-4"
					currentTime={currentTime}
					onSeek={(time) => {
						if (audioRef.current) {
							audioRef.current.currentTime = time;
						}
					}}
					segments={segments}
				>
					{(segment, index) => (
						<TranscriptionSegment
							index={index}
							key={`${segment.startSecond}-${segment.text}`}
							segment={segment}
						/>
					)}
				</Transcription>
			) : null}
		</div>
	);
}

function ImagePreview({
	images,
	surface,
	title,
}: Readonly<{
	images: Array<{ url: string; mimeType?: string }>;
	surface: PreviewSurface;
	title: string;
}>): ReactNode {
	const primaryImage = images[0];
	if (!primaryImage) {
		return null;
	}

	return (
		<div className={cn("relative overflow-hidden rounded-md bg-card", surface === "card" ? "aspect-[16/10] w-full" : "min-h-[320px]")}>
			<Image
				alt={title}
				className={cn("h-full w-full", surface === "card" ? "object-cover" : "object-contain")}
				height={900}
				src={primaryImage.url}
				unoptimized
				width={1200}
			/>
		</div>
	);
}

function TextPreview({
	isStreaming,
	markdown = false,
	surface,
	text,
}: Readonly<{
	isStreaming: boolean;
	markdown?: boolean;
	surface: PreviewSurface;
	text: string;
}>): ReactNode {
	if (surface === "card") {
		return (
			<div className="rounded-md">
				<div className="max-h-36 overflow-hidden whitespace-pre-wrap text-left font-mono text-[12px] leading-5 text-text">
					{text}
				</div>
			</div>
		);
	}

	if (markdown) {
		return <MessageResponse isAnimating={isStreaming}>{text}</MessageResponse>;
	}

	return (
		<pre className="whitespace-pre-wrap break-words font-mono text-sm leading-6 text-text">
			{text}
		</pre>
	);
}

function CodePreview({
	code,
	language,
	surface,
}: Readonly<{
	code: string;
	language?: string;
	surface: PreviewSurface;
}>): ReactNode {
	if (surface === "card") {
		return (
			<div className="rounded-md">
				<div className="max-h-36 overflow-hidden whitespace-pre-wrap text-left font-mono text-[12px] leading-5 text-text">
					{code}
				</div>
			</div>
		);
	}

	return (
		<CodeBlock className={surface === "artifact-pane" ? "ring-0" : undefined}>
			<HighlightedCodeContent
				code={code}
				language={resolveCodeLanguage(language, code)}
				lineNumbers
			/>
		</CodeBlock>
	);
}

function AppUrlPreview({
	summary,
	surface,
	url,
}: Readonly<{
	summary?: string;
	surface: PreviewSurface;
	url: string;
}>): ReactNode {
	if (surface === "card") {
		return (
			<div className="rounded-md">
				<p className="text-left text-sm leading-6 text-text">
					{summary?.trim() || "Generated app preview ready to open"}
				</p>
			</div>
		);
	}

	const isArtifactPane = surface === "artifact-pane";

	return (
		<div className={cn("flex h-full w-full flex-col overflow-hidden bg-surface", isArtifactPane ? "min-h-0" : "min-h-[420px] rounded-md border border-border")}>
			<iframe
				title="Generated app preview"
				className={cn("h-full w-full flex-1 border-0 bg-surface", isArtifactPane ? "min-h-0" : "min-h-[420px]")}
				sandbox="allow-forms allow-modals allow-popups allow-scripts"
				src={url}
			/>
		</div>
	);
}

export function HtmlPreviewFrame({
	className,
	html,
	title,
}: Readonly<{
	className?: string;
	html: string;
	title: string;
}>): ReactNode {
	return (
		<iframe
			title={title}
			className={cn("h-full min-h-[520px] w-full flex-1 border-0 bg-surface", className)}
			sandbox=""
			srcDoc={html}
		/>
	);
}

function HtmlPreview({
	html,
	summary,
	surface,
	title,
}: Readonly<{
	html: string;
	summary?: string;
	surface: PreviewSurface;
	title: string;
}>): ReactNode {
	if (surface === "card") {
		return (
			<div className="rounded-md">
				<p className="text-left text-sm leading-6 text-text">
					{summary?.trim() || "PDF ready to open"}
				</p>
			</div>
		);
	}

	const isArtifactPane = surface === "artifact-pane";

	return (
		<div className={cn("flex h-full w-full flex-col overflow-hidden bg-surface", isArtifactPane ? "min-h-0" : "min-h-[520px] rounded-md border border-border")}>
			<HtmlPreviewFrame
				className={isArtifactPane ? "min-h-0" : undefined}
				html={isArtifactPane ? getArtifactPaneHtmlPreview(html) : html}
				title={title}
			/>
		</div>
	);
}

function JsonRenderPreview({
	body,
	cardSpecOverride,
	onStateChange,
	progressive = false,
	summary,
	surface,
}: Readonly<{
	body: Extract<PreviewBody, { kind: "json-render" }>;
	cardSpecOverride?: import("@json-render/react").Spec | null;
	onStateChange?: (changes: Array<{ path: string; value: unknown }>) => void;
	progressive?: boolean;
	summary?: string;
	surface: PreviewSurface;
}>): ReactNode {
	const spec = surface === "card" && cardSpecOverride ? cardSpecOverride : body.spec;
	const { progressiveSpec, isProgressing } = useProgressiveSpec(spec, progressive);
	const summaryText = summary?.trim() ?? "";
	const shouldStreamSummary = surface === "card" && progressive && isProgressing && summaryText.length > 0;

	if (shouldStreamSummary) {
		return (
			<div className="rounded-md bg-surface p-3 sm:p-4">
				<StreamingSummaryPreview summary={summaryText} />
			</div>
		);
	}

	return (
		<div className="rounded-md">
			<JsonRenderView
				spec={progressiveSpec ?? spec}
				skipValidation={isProgressing}
				onStateChange={onStateChange}
			/>
		</div>
	);
}

export function PreviewBodyRenderer({
	body,
	surface,
	title,
	summary,
	isStreaming = false,
	progressive = false,
	onStateChange,
	cardSpecOverride,
}: Readonly<PreviewBodyRendererProps>): ReactNode {
	if (body.kind === "json-render") {
		return (
			<JsonRenderPreview
				body={body}
				cardSpecOverride={cardSpecOverride}
				onStateChange={onStateChange}
				progressive={progressive}
				summary={summary}
				surface={surface}
			/>
		);
	}

	if (body.kind === "audio") {
		return (
			<AudioPreview
				audioUrl={body.audioUrl}
				surface={surface}
				transcript={body.transcript}
			/>
		);
	}

	if (body.kind === "image") {
		return (
			<ImagePreview
				images={body.images}
				surface={surface}
				title={title}
			/>
		);
	}

	if (body.kind === "video") {
		return (
			<VideoPreviewBody
				body={body as PreviewVideoBody}
				withContainer={surface !== "artifact-pane"}
			/>
		);
	}

	if (body.kind === "text") {
		return (
			<TextPreview
				isStreaming={isStreaming}
				markdown={body.markdown}
				surface={surface}
				text={body.text}
			/>
		);
	}

	if (body.kind === "code") {
		return (
			<CodePreview
				code={body.code}
				language={body.language}
				surface={surface}
			/>
		);
	}

	if (body.kind === "app-url") {
		return (
			<AppUrlPreview
				summary={body.summary ?? summary}
				surface={surface}
				url={body.url}
			/>
		);
	}

	if (body.kind === "html") {
		return (
			<HtmlPreview
				html={body.html}
				summary={body.summary ?? summary}
				surface={surface}
				title={title}
			/>
		);
	}

	if (body.kind === "excalidraw") {
		return (
			<ExcalidrawPreview
				scene={body.scene}
				heightClassName={surface === "card" ? "h-[280px]" : "h-[520px]"}
			/>
		);
	}

	return (
		<CodePreview
			code={JSON.stringify(body.value, null, 2)}
			language="json"
			surface={surface}
		/>
	);
}
