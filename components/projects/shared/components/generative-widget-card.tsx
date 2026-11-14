"use client";

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- These components intentionally use slot/render-node props for icons, triggers, and adornments.

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import CrossIcon from "@atlaskit/icon/core/cross";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	GenerativeCard,
	GenerativeCardBody,
	GenerativeCardContent,
	GenerativeCardFooter,
	GenerativeCardHeader,
	type DistortionTintMode,
} from "@/components/blocks/generative-card";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	type GenerativeWidgetActionItem,
	type GenerativeWidgetPrimaryActionPayload,
	parseGenerativeWidget,
	resolveGenerativeWidgetMetadata,
	createBodyOnlySpec,
	formatGenerativeWidgetCardDescription,
	type ParsedGenerativeWidget,
	type GenerativeWidgetMetadata,
} from "@/components/projects/shared/lib/generative-widget";
import type { ThinkingToolCallSummary } from "@/lib/rovo-ui-messages";
import { formatContentTypeLabel } from "@/components/projects/shared/lib/generative-widget-branding";
import { enrichGenerativeWidgetProfilePhotos } from "@/components/projects/shared/lib/generative-widget-profile-photos";
import { ContentTypeTile } from "./content-type-tile";
import { GenuiExportMenu } from "./genui-export-menu";
import { PreviewBodyRenderer } from "./preview-body-renderer";

/* -------------------------------------------------------------------------- */
/*  Props                                                                     */
/* -------------------------------------------------------------------------- */

const INNER_GLOW_STYLE_ID = "gen-widget-card-inner-glow-keyframes";
const DEFAULT_INNER_GLOW_DURATION_MS = 4000;
const DEFAULT_INNER_GLOW_SPREAD = 12;
const DEFAULT_INNER_GLOW_THICKNESS = 12;
const DEFAULT_INNER_GLOW_SOFTNESS = 10;
const DEFAULT_INNER_GLOW_SATURATION = 170;
const DEFAULT_INNER_GLOW_INTENSITY = 1;

const INNER_GLOW_KEYFRAMES = `
@property --gen-widget-card-inner-angle {
	syntax: '<angle>';
	initial-value: 0deg;
	inherits: false;
}
@keyframes gen-widget-card-inner-angle-spin {
	to { --gen-widget-card-inner-angle: 1turn; }
}
@keyframes gen-widget-card-inner-opacity {
	0%   { opacity: 0; }
	8%   { opacity: var(--gen-widget-card-inner-peak, 1); }
	88%  { opacity: calc(var(--gen-widget-card-inner-peak, 1) * 0.95); }
	100% { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
	@keyframes gen-widget-card-inner-angle-spin {
		to { --gen-widget-card-inner-angle: 0deg; }
	}
	@keyframes gen-widget-card-inner-opacity {
		0%   { opacity: calc(var(--gen-widget-card-inner-peak, 1) * 0.44); }
		100% { opacity: calc(var(--gen-widget-card-inner-peak, 1) * 0.44); }
	}
}
`;

export interface GenerativeCardAnimationProps {
	distortion?: boolean;
	animateDuration?: number;
	animateDistortionScale?: number;
	animateBlur?: number;
	animateRadius?: number;
	animateEdgeSafeX?: number;
	animateSpeed?: number;
	animateScaleSmoothing?: number;
	animateSweepSmoothing?: number;
	distortionTintEnabled?: boolean;
	distortionTintMode?: DistortionTintMode;
	distortionTintPreset?: string;
	distortionTintColor?: string;
	distortionTintStrength?: number;
	innerGlow?: boolean;
	innerGlowDuration?: number;
	innerGlowSpread?: number;
	innerGlowThickness?: number;
	innerGlowSoftness?: number;
	innerGlowSaturation?: number;
	innerGlowIntensity?: number;
}

interface GenerativeWidgetCardProps {
	widgetType: string;
	widgetData: unknown;
	className?: string;
	cardAnimation?: GenerativeCardAnimationProps;
	thinkingToolCalls?: readonly ThinkingToolCallSummary[];
	onPrimaryAction?: (
		payload: GenerativeWidgetPrimaryActionPayload
	) => Promise<void> | void;
}

interface GenerativeWidgetCardShellProps {
	bodyWidget: ParsedGenerativeWidget;
	metadata: GenerativeWidgetMetadata;
	className?: string;
	previewMode?: boolean;
	onOpenPreview?: () => void;
	onAction?: (actionLabel: string) => Promise<void> | void;
	actions?: GenerativeWidgetActionItem[];
	onStateChange?: (changes: Array<{ path: string; value: unknown }>) => void;
	cardAnimation?: GenerativeCardAnimationProps;
}
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Immutable path update -- shallow-copies only the objects along the mutation
 * path instead of deep-cloning the entire state tree on every change.
 */
function immutableSetByPath(
	state: Record<string, unknown>,
	path: string,
	value: unknown,
): Record<string, unknown> {
	const segments = path.replace(/^\//, "").split("/").filter(Boolean);
	if (segments.length === 0) return state;

	if (segments.length === 1) {
		return { ...state, [segments[0]]: value };
	}

	const [first, ...rest] = segments;
	const child = state[first];
	const childObj = isObjectRecord(child) ? child : {};

	return {
		...state,
		[first]: immutableSetByPath(childObj, "/" + rest.join("/"), value),
	};
}

function toInitialGenuiState(widget: ParsedGenerativeWidget): Record<string, unknown> {
	if (widget.body.kind !== "json-render") return {};
	return isObjectRecord(widget.body.spec.state) ? { ...widget.body.spec.state } : {};
}

function slugifyFilename(value: string, fallback = "diagram"): string {
	const slug = value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.trim();

	return slug || fallback;
}

function downloadBlob(blob: Blob, filename: string) {
	const url = window.URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	window.URL.revokeObjectURL(url);
}

function getBodySpecificFooterActions({
	bodyWidget,
	metadata,
}: Readonly<{
	bodyWidget: ParsedGenerativeWidget;
	metadata: GenerativeWidgetMetadata;
}>): ReactNode[] {
	if (bodyWidget.body.kind !== "excalidraw") {
		return [];
	}

	const sceneJson = JSON.stringify(bodyWidget.body.scene, null, 2);
	const filename = `${slugifyFilename(metadata.title, "diagram")}.excalidraw`;

	return [
		<Button
			key="download-excalidraw"
			variant="outline"
			className="h-8 min-w-0 flex-shrink-0 px-3 text-sm sm:min-w-[117px]"
			onClick={() => {
				downloadBlob(
					new Blob([sceneJson], { type: "application/json" }),
					filename,
				);
			}}
			type="button"
		>
			Download .excalidraw
		</Button>,
		<Button
			key="copy-excalidraw-json"
			variant="outline"
			className="h-8 min-w-0 flex-shrink-0 px-3 text-sm sm:min-w-[117px]"
			onClick={() => void navigator.clipboard.writeText(sceneJson)}
			type="button"
		>
			Copy JSON
		</Button>,
	];
}

function useInnerGlowStyles(enabled: boolean) {
	useEffect(() => {
		if (!enabled || typeof document === "undefined") return;

		let styleEl = document.getElementById(INNER_GLOW_STYLE_ID) as HTMLStyleElement | null;
		if (!styleEl) {
			styleEl = document.createElement("style");
			styleEl.id = INNER_GLOW_STYLE_ID;
			document.head.appendChild(styleEl);
		}

		if (styleEl.textContent !== INNER_GLOW_KEYFRAMES) {
			styleEl.textContent = INNER_GLOW_KEYFRAMES;
		}
	}, [enabled]);
}

interface GenerativeCardInnerGlowShellProps {
	durationMs: number;
	spread: number;
	thickness: number;
	softness: number;
	saturation: number;
	intensity: number;
	className?: string;
	children: ReactNode;
}

function GenerativeCardInnerGlowShell({
	durationMs,
	spread,
	thickness,
	softness,
	saturation,
	intensity,
	className,
	children,
}: Readonly<GenerativeCardInnerGlowShellProps>): ReactNode {
	useInnerGlowStyles(true);

	const rovoConic = "conic-gradient(from var(--gen-widget-card-inner-angle), #1868DB, #AF59E1, #FCA700, #6A9A23, #1868DB)";
	const peakOpacity = Math.max(0, Math.min(1, intensity));
	const ringInset = -(spread + thickness * 0.5);
	const glowAnimation = `gen-widget-card-inner-angle-spin ${durationMs}ms linear forwards, gen-widget-card-inner-opacity ${durationMs}ms var(--ease-out, ease-out) forwards`;
	const glowVariables = {
		"--gen-widget-card-inner-peak": peakOpacity,
	} as CSSProperties;

	return (
		<div className={cn("relative", className)}>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-xl"
				style={glowVariables}
			>
				<div
					style={{
						position: "absolute",
						inset: ringInset,
						borderRadius: token("radius.xlarge"),
						borderWidth: thickness,
						borderStyle: "solid",
						borderColor: "transparent",
						borderImageSource: rovoConic,
						borderImageSlice: 1,
						filter: `blur(${softness}px) saturate(${saturation}%)`,
						opacity: 0,
						animation: glowAnimation,
						willChange: "opacity",
					}}
				/>
			</div>
			<div className="relative z-10">{children}</div>
		</div>
	);
}

/* -------------------------------------------------------------------------- */
/*  Card shell                                                                */
/* -------------------------------------------------------------------------- */

function GenerativeWidgetCardShell({
	bodyWidget,
	metadata,
	className,
	previewMode = false,
	onOpenPreview,
	onAction,
	actions = [],
	onStateChange,
	cardAnimation,
}: Readonly<GenerativeWidgetCardShellProps>): ReactNode {
	const contentTypeLabel = formatContentTypeLabel(metadata.contentType);
	const bodySpecificFooterActions = getBodySpecificFooterActions({
		bodyWidget,
		metadata,
	});
	const shouldAnimateDistortion =
		!previewMode &&
		bodyWidget.body.kind === "json-render" &&
		(cardAnimation?.distortion ?? false);
	const shouldRenderInnerGlow = !previewMode && Boolean(cardAnimation?.innerGlow);
	const shouldRenderDistortionTint =
		shouldAnimateDistortion && Boolean(cardAnimation?.distortionTintEnabled);

	const cardNode = (
		<GenerativeCard
			className={shouldRenderInnerGlow ? "w-full" : className}
			animate={shouldAnimateDistortion}
			animateDuration={cardAnimation?.animateDuration}
			animateDistortionScale={cardAnimation?.animateDistortionScale}
			animateBlur={cardAnimation?.animateBlur}
			animateRadius={cardAnimation?.animateRadius}
			animateEdgeSafeX={cardAnimation?.animateEdgeSafeX}
			animateSpeed={cardAnimation?.animateSpeed}
			animateScaleSmoothing={cardAnimation?.animateScaleSmoothing}
			animateSweepSmoothing={cardAnimation?.animateSweepSmoothing}
			animateTintMode={shouldRenderDistortionTint ? cardAnimation?.distortionTintMode : undefined}
			animateTintColor={shouldRenderDistortionTint ? cardAnimation?.distortionTintColor : undefined}
			animateTintStrength={shouldRenderDistortionTint ? (cardAnimation?.distortionTintStrength ?? 0) : 0}
		>
			<GenerativeCardHeader
				className="p-4"
				leading={
					<ContentTypeTile
						contentType={metadata.contentType}
						label={contentTypeLabel}
						title={metadata.title}
						description={metadata.description}
						sourceName={metadata.source?.name}
						sourceLogoSrc={metadata.source?.logoSrc}
						iconHint={metadata.iconHint}
						hintText={metadata.iconHintText}
					/>
				}
				title={metadata.title}
				description={metadata.description}
			/>
			<GenerativeCardBody>
				<GenerativeCardContent className="p-4">
					<PreviewBodyRenderer
						body={bodyWidget.body}
						surface={previewMode ? "dialog" : "card"}
						title={metadata.title}
						summary={bodyWidget.summary}
						progressive={!previewMode && !shouldAnimateDistortion}
						onStateChange={onStateChange}
						cardSpecOverride={
							!previewMode && bodyWidget.body.kind === "json-render"
								? createBodyOnlySpec(bodyWidget)
								: null
						}
					/>
				</GenerativeCardContent>
				<GenerativeCardFooter className="flex-wrap gap-2">
					<Button
						variant="outline"
						className="h-8 min-w-0 flex-shrink-0 px-3 text-sm sm:min-w-[117px]"
						disabled={previewMode}
						onClick={previewMode ? undefined : onOpenPreview}
					>
						Open preview
					</Button>
					{bodyWidget.body.kind === "json-render" ? (
						<GenuiExportMenu
							spec={bodyWidget.body.spec}
							title={metadata.title}
							contentType={metadata.contentType}
						/>
					) : null}
					{bodySpecificFooterActions}
					{actions.map((actionItem, index) => (
						actionItem.href ? (
							<a
								key={`${actionItem.label}:${index}`}
								href={actionItem.href}
								target="_blank"
								rel="noopener noreferrer"
								className={cn(
									buttonVariants({ variant: index === 0 ? "default" : "outline" }),
									"h-8 min-w-0 flex-shrink-0 px-3 text-sm sm:min-w-[117px]"
								)}
							>
								{actionItem.label}
							</a>
						) : (
							<Button
								key={`${actionItem.label}:${index}`}
								variant={index === 0 ? "default" : "outline"}
								className="h-8 min-w-0 flex-shrink-0 px-3 text-sm sm:min-w-[117px]"
								disabled={
									typeof onAction !== "function" ||
									/\b(view|edit|open)\b/i.test(actionItem.label)
								}
								onClick={
									typeof onAction === "function" &&
									!/\b(view|edit|open)\b/i.test(actionItem.label)
										? () => onAction(actionItem.label)
										: undefined
								}
							>
								{actionItem.label}
							</Button>
						)
					))}
				</GenerativeCardFooter>
			</GenerativeCardBody>
		</GenerativeCard>
	);

	if (!shouldRenderInnerGlow) {
		return cardNode;
	}

	return (
		<GenerativeCardInnerGlowShell
			className={className}
			durationMs={cardAnimation?.innerGlowDuration ?? DEFAULT_INNER_GLOW_DURATION_MS}
			spread={cardAnimation?.innerGlowSpread ?? DEFAULT_INNER_GLOW_SPREAD}
			thickness={cardAnimation?.innerGlowThickness ?? DEFAULT_INNER_GLOW_THICKNESS}
			softness={cardAnimation?.innerGlowSoftness ?? DEFAULT_INNER_GLOW_SOFTNESS}
			saturation={cardAnimation?.innerGlowSaturation ?? DEFAULT_INNER_GLOW_SATURATION}
			intensity={cardAnimation?.innerGlowIntensity ?? DEFAULT_INNER_GLOW_INTENSITY}
		>
			{cardNode}
		</GenerativeCardInnerGlowShell>
	);
}

/* -------------------------------------------------------------------------- */
/*  Main card component                                                       */
/* -------------------------------------------------------------------------- */

export function GenerativeWidgetCard({
	widgetType,
	widgetData,
	className,
	cardAnimation,
	thinkingToolCalls,
	onPrimaryAction,
}: Readonly<GenerativeWidgetCardProps>): ReactNode {
	const [previewOpen, setPreviewOpen] = useState(false);
	const parsedWidget = useMemo(
		() => parseGenerativeWidget(widgetType, widgetData),
		[widgetData, widgetType]
	);
	const resolvedWidget = useMemo(
		() =>
			parsedWidget
				? enrichGenerativeWidgetProfilePhotos(
					parsedWidget,
					thinkingToolCalls ?? [],
				)
				: null,
		[parsedWidget, thinkingToolCalls]
	);
	const metadata = useMemo(
		() => (resolvedWidget ? resolveGenerativeWidgetMetadata(resolvedWidget) : null),
		[resolvedWidget]
	);
	const displayMetadata = useMemo(
		() =>
			metadata
				? {
					...metadata,
					description: formatGenerativeWidgetCardDescription(metadata.description),
				}
				: null,
		[metadata],
	);
	const contentTypeLabel = displayMetadata ? formatContentTypeLabel(displayMetadata.contentType) : "";
	const [genuiState, setGenuiState] = useState<Record<string, unknown>>(
		() => (resolvedWidget ? toInitialGenuiState(resolvedWidget) : {})
	);

	const handleGenuiStateChange = useCallback(
		(changes: Array<{ path: string; value: unknown }>) => {
			setGenuiState((previousState) => {
				let state = previousState;
				for (const { path, value } of changes) {
					if (typeof path !== "string" || !path.startsWith("/")) continue;
					state = immutableSetByPath(state, path, value);
				}
				return state;
			});
		},
		[]
	);

	const footerActions = displayMetadata?.actions ?? [];
	const shouldShowFooterActions = footerActions.length > 0;

	const handleAction = useCallback((actionLabel: string) => {
		if (
			!resolvedWidget ||
			!actionLabel ||
			!metadata ||
			!metadata.title ||
			!metadata.description ||
			typeof onPrimaryAction !== "function"
		) {
			return;
		}

		void onPrimaryAction({
			widgetType: "genui-preview",
			actionLabel,
			title: metadata.title,
			description: metadata.description,
			formState: genuiState,
		});
	}, [resolvedWidget, metadata, onPrimaryAction, genuiState]);

	if (!resolvedWidget || !displayMetadata) return null;

	return (
		<div className={cn("pb-2", className)}>
			<Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
					<GenerativeWidgetCardShell
						bodyWidget={resolvedWidget}
						metadata={displayMetadata}
						cardAnimation={cardAnimation}
						onOpenPreview={() => setPreviewOpen(true)}
						onAction={handleAction}
						actions={shouldShowFooterActions ? footerActions : []}
						onStateChange={handleGenuiStateChange}
				/>
				<DialogContent className="max-h-[90vh] overflow-hidden gap-0 p-0 sm:max-w-5xl [grid-template-rows:auto_minmax(0,1fr)]" size="xl" showCloseButton={false}>
					<DialogHeader className="mx-0 mt-0 flex-row items-center border-b p-4 sm:p-6">
						<div className="flex min-w-0 flex-1 items-center gap-3">
								<ContentTypeTile
									contentType={displayMetadata.contentType}
									label={contentTypeLabel}
									title={displayMetadata.title}
									description={displayMetadata.description}
									sourceName={displayMetadata.source?.name}
									sourceLogoSrc={displayMetadata.source?.logoSrc}
									iconHint={displayMetadata.iconHint}
									hintText={displayMetadata.iconHintText}
								/>
							<div className="min-w-0 flex-1 space-y-1">
								<DialogTitle className="truncate">
									{displayMetadata.title}
								</DialogTitle>
								<DialogDescription className="line-clamp-2">
									{displayMetadata.description}
								</DialogDescription>
							</div>
						</div>
						<DialogClose render={<Button variant="ghost" size="icon" />}>
							<CrossIcon label="Close" />
						</DialogClose>
					</DialogHeader>
					<div className="min-h-0 overflow-y-auto p-4 sm:p-6">
						<PreviewBodyRenderer
							body={resolvedWidget.body}
							surface="dialog"
							title={displayMetadata.title}
							summary={resolvedWidget.summary}
							onStateChange={handleGenuiStateChange}
						/>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
