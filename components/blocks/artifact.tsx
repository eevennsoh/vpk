"use client";

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- These components intentionally use slot/render-node props for icons, triggers, and adornments.

import type { ComponentProps, HTMLAttributes, ReactNode } from "react";

import { useEffect, useRef, useState, type RefObject } from "react";

import {
	GenerativeCard,
	GenerativeCardBody,
	GenerativeCardContent,
	GenerativeCardFooter,
	GenerativeCardHeader,
} from "@/components/blocks/generative-card";
import { PreviewBodyRenderer } from "@/components/projects/shared/components/preview-body-renderer";
import { buildArtifactPreviewBody } from "@/components/projects/shared/lib/artifact-preview";
import { CardIdentityTile } from "@/components/projects/shared/components/card-identity-tile";
import type { PreviewBody } from "@/components/projects/shared/lib/generative-widget";
import type { VisualIdentity } from "@/components/projects/shared/lib/visual-identity";
import { resolveArtifactCardIdentity } from "@/components/projects/shared/lib/visual-identity";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	ClockIcon,
	CopyIcon,
	MessageSquarePlusIcon,
	PencilLineIcon,
	SaveIcon,
	Trash2Icon,
	type VpkIconComponent,
	XIcon,
} from "@/components/ui/vpk-icons";
import { Spinner } from "@/components/ui/spinner";
import type {
	ArtifactAnnotation,
	ArtifactAnnotationPosition,
	PendingArtifactSelection,
} from "@/components/ui-custom/lib/artifact-annotations";
import {
	formatArtifactVersionLabel,
	formatArtifactVersionSummaryLabel,
	getArtifactVersionNumber,
	getArtifactVersionTitle,
	type ArtifactDocument,
} from "@/components/ui-custom/lib/artifact-versions";
import { cn } from "@/lib/utils";

export type ArtifactProps = HTMLAttributes<HTMLDivElement>;

export const Artifact = ({ className, ...props }: ArtifactProps) => (
  <div
    className={cn(
      "flex flex-col overflow-hidden rounded-lg border bg-background shadow-sm",
      className
    )}
    {...props}
  />
);

export type ArtifactHeaderProps = HTMLAttributes<HTMLDivElement>;

export const ArtifactHeader = ({
  className,
  ...props
}: ArtifactHeaderProps) => (
  <div
    className={cn(
      "flex items-center justify-between border-b bg-muted/50 px-4 py-3",
      className
    )}
    {...props}
  />
);

export type ArtifactCloseProps = ComponentProps<typeof Button>;

export const ArtifactClose = ({
  className,
  children,
  size = "default",
  variant = "ghost",
  ...props
}: ArtifactCloseProps) => (
  <Button
    className={cn(
      "size-8 p-0 text-muted-foreground hover:text-foreground",
      className
    )}
    size={size}
    type="button"
    variant={variant}
    {...props}
  >
    {children ?? <XIcon className="size-4" />}
    <span className="sr-only">Close</span>
  </Button>
);

export type ArtifactTitleProps = HTMLAttributes<HTMLParagraphElement>;

export const ArtifactTitle = ({ className, ...props }: ArtifactTitleProps) => (
  <p
    className={cn("font-medium text-foreground text-sm", className)}
    {...props}
  />
);

export type ArtifactDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

export const ArtifactDescription = ({
  className,
  ...props
}: ArtifactDescriptionProps) => (
  <p className={cn("text-muted-foreground text-sm", className)} {...props} />
);

export type ArtifactActionsProps = HTMLAttributes<HTMLDivElement>;

export const ArtifactActions = ({
  className,
  ...props
}: ArtifactActionsProps) => (
  <div className={cn("flex items-center gap-1", className)} {...props} />
);

export type ArtifactActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
  icon?: VpkIconComponent;
};

export const ArtifactAction = ({
  tooltip,
  label,
  icon: Icon,
  children,
  className,
  size = "default",
  variant = "ghost",
  ...props
}: ArtifactActionProps) => {
  const button = (
    <Button
      className={cn(
        "size-8 p-0 text-muted-foreground hover:text-foreground",
        className
      )}
      size={size}
      type="button"
      variant={variant}
      {...props}
    >
      {Icon ? <Icon className="size-4" /> : children}
      <span className="sr-only">{label || tooltip}</span>
    </Button>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger render={button} />
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
};

export type ArtifactContentProps = HTMLAttributes<HTMLDivElement>;

export const ArtifactContent = ({
	className,
	...props
}: ArtifactContentProps) => (
	<div className={cn("flex-1 overflow-auto p-4", className)} {...props} />
);

/* ---------------------------------------------------------------------------
 * ArtifactCard — high-level component built on GenerativeCard
 * Mirrors the design from rovo-app-artifact-card.tsx
 * --------------------------------------------------------------------------- */

export type ArtifactKind = "text" | "code" | "html" | "image" | "sheet" | "react" | "excalidraw" | "browser";

// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
export const ARTIFACT_KIND_LABELS: Record<ArtifactKind, string> = {
	browser: "Browser",
	code: "Code",
	excalidraw: "Diagram",
	html: "PDF",
	image: "Image",
	react: "App",
	sheet: "Sheet",
	text: "Document",
};

function getArtifactActionLabel(
	action: "create" | "update" | null | undefined,
	isStreaming: boolean,
): string | null {
	if (isStreaming) return "Generating";
	if (action === "update") return "Updated";
	if (action === "create") return "Created";
	return null;
}

function formatArtifactKindActionLabel(kindLabel: string): string {
	return /^[A-Z0-9]+(?:\s[A-Z0-9]+)*$/u.test(kindLabel)
		? kindLabel
		: kindLabel.toLowerCase();
}

function getArtifactDescription({
	kind,
	versionNumber,
}: Readonly<{
	kind: ArtifactKind;
	versionNumber: number;
}>): string {
	return `${ARTIFACT_KIND_LABELS[kind]} \u2022 Version ${versionNumber}`;
}

export interface ArtifactCardProps {
	/** The artifact content type. Determines icon and color. */
	kind: ArtifactKind;
	/** Optional artifact version number displayed in the card metadata. @default 1 */
	versionNumber?: number;
	/** Artifact title text. */
	title: string;
	/** Optional header description override. Defaults to kind and version metadata. */
	description?: ReactNode;
	/** Optional action context. Used for description text. */
	action?: "create" | "update" | null;
	/** Whether the artifact is currently streaming. */
	isStreaming?: boolean;
	/** Display mode. "preview" shows expanded card. "chip" shows compact inline card. @default "preview" */
	displayMode?: "preview" | "chip";
	/** Initial expanded state when uncontrolled. Defaults to preview cards expanded and chips collapsed. */
	defaultExpanded?: boolean;
	/** Controlled expanded state for callers that need to collapse the preview after a handoff. */
	expanded?: boolean;
	/** Controlled expansion callback. */
	onExpandedChange?: (expanded: boolean) => void;
	/** Optional visual identity override used in the tile instead of the kind-based icon. */
	visualIdentity?: VisualIdentity;
	/** Optional avatar image rendered in the identity tile instead of an icon tile. */
	identityAvatarSrc?: string;
	/** Optional stable seed used to keep the tile color consistent across renders. */
	identitySeed?: string;
	/** Content string for the preview (code text, image URL, etc.). */
	previewContent?: string;
	/** Optional user-facing summary for inline preview cards. */
	previewSummary?: string;
	/** Optional shared preview body override. */
	previewBody?: PreviewBody;
	/** Callback when the "Open" button is clicked. Receives the card root element. */
	onOpen?: (element: HTMLDivElement) => void;
	/** Optional visible label for the open action. */
	openCtaLabel?: string;
	/** Optional accessible label for the open action. */
	openLabel?: string;
	/** Optional accessible label for the expand action. */
	expandLabel?: string;
	/** Optional accessible label for the collapse action. */
	collapseLabel?: string;
	/** Callback when a preview-mode card mounts. Receives the card root element. */
	onRegister?: (element: HTMLDivElement) => void;
	/** Additional className for the outer wrapper. */
	className?: string;
	/** Optional children rendered inside GenerativeCardContent (overrides previewContent rendering). */
	children?: ReactNode;
}

export function ArtifactCard({
	kind,
	versionNumber = 1,
	title,
	description,
	action,
	isStreaming = false,
	displayMode = "preview",
	defaultExpanded,
	expanded,
	onExpandedChange,
	visualIdentity,
	identityAvatarSrc,
	identitySeed,
	previewContent = "",
	previewSummary,
	previewBody,
	onOpen,
	openCtaLabel,
	openLabel,
	expandLabel,
	collapseLabel,
	onRegister,
	className,
	children,
}: Readonly<ArtifactCardProps>) {
	const cardRef = useRef<HTMLDivElement>(null);
	const actionLabel = getArtifactActionLabel(action, isStreaming);
	const kindLabel = ARTIFACT_KIND_LABELS[kind];
	const cardDescription = description ?? getArtifactDescription({ kind, versionNumber });
	const resolvedIdentity = resolveArtifactCardIdentity({
		kind,
		title,
		identitySeed,
		sourceAvatarSrc: identityAvatarSrc,
		visualIdentity,
	});
	const actionKindLabel = formatArtifactKindActionLabel(kindLabel);
	const resolvedOpenLabel = openLabel ?? (actionLabel
		? `Open ${actionLabel.toLowerCase()} ${actionKindLabel} ${title}`
		: `Open ${actionKindLabel} ${title}`);
	const resolvedOpenCtaLabel = openCtaLabel ?? `Open ${actionKindLabel}`;
	const resolvedPreviewBody = previewBody ?? buildArtifactPreviewBody({
		content: previewContent,
		kind,
		summary: previewSummary,
	});

	const handleOpen = () => {
		if (!cardRef.current || !onOpen) {
			return;
		}

		onOpen(cardRef.current);
	};

	useEffect(() => {
		if (displayMode !== "preview" || !cardRef.current || !onRegister) {
			return;
		}

		onRegister(cardRef.current);
	}, [displayMode, onRegister]);

	return (
		<div
			ref={cardRef}
			className={cn(
				displayMode === "preview" ? "w-full" : "w-fit max-w-full",
				className,
			)}
		>
			<GenerativeCard
				className={cn(
					"border-border/80 bg-surface-raised shadow-xs",
					displayMode === "preview"
						? "w-full"
						: "w-fit max-w-full",
				)}
				defaultExpanded={defaultExpanded ?? displayMode === "preview"}
				expanded={expanded}
				onExpandedChange={onExpandedChange}
				size={displayMode === "chip" ? "sm" : "default"}
			>
				<GenerativeCardHeader
					action={
						displayMode === "chip" && onOpen ? (
							<Button
								aria-label={resolvedOpenLabel}
								onClick={handleOpen}
								size="compact"
								type="button"
								variant="outline"
							>
								{resolvedOpenCtaLabel}
							</Button>
						) : null
					}
					collapseLabel={collapseLabel ?? "Collapse artifact details"}
					description={cardDescription}
					expandLabel={expandLabel ?? "Expand artifact details"}
					leading={
						isStreaming ? (
							<div className="relative">
								<CardIdentityTile
									decorative
									identity={resolvedIdentity}
									label={kindLabel}
									size={displayMode === "chip" ? "small" : "medium"}
									className="animate-pulse"
								/>
								<Spinner className="absolute inset-0 m-auto text-current" />
							</div>
						) : (
							<CardIdentityTile
								decorative
								identity={resolvedIdentity}
								label={kindLabel}
								size={displayMode === "chip" ? "small" : "medium"}
							/>
						)
					}
					title={title}
				/>
				<GenerativeCardBody>
					<GenerativeCardContent>
						{children ?? (
							<PreviewBodyRenderer
								body={resolvedPreviewBody}
								isStreaming={isStreaming}
								surface="card"
								title={title}
								summary={previewSummary}
							/>
						)}
					</GenerativeCardContent>
					{onOpen ? (
						<GenerativeCardFooter className="border-t-0 bg-transparent pt-0">
							<Button
								aria-label={resolvedOpenLabel}
								className="min-w-0"
								onClick={handleOpen}
								type="button"
								variant="outline"
							>
								{resolvedOpenCtaLabel}
							</Button>
						</GenerativeCardFooter>
					) : null}
				</GenerativeCardBody>
			</GenerativeCard>
		</div>
	);
}

/* ---------------------------------------------------------------------------
 * ArtifactPanel — full-featured artifact viewer/editor with versioning,
 * annotations, and edit/preview modes.
 * Ported from RovoAppArtifactPanel.
 * --------------------------------------------------------------------------- */

function getAnnotationPinStyle(position: ArtifactAnnotationPosition): {
	left: string;
	top: string;
} {
	const pinLeft = position.left + (position.width > 0 ? position.width - 14 : 0);
	const pinTop = position.top - 10;

	return {
		left: `${Math.max(pinLeft, 8)}px`,
		top: `${Math.max(pinTop, 8)}px`,
	};
}

function getPendingSelectionStyle(
	position: ArtifactAnnotationPosition,
): {
	left: string;
	top: string;
} {
	return {
		left: `${Math.max(position.left, 8)}px`,
		top: `${Math.max(position.top + position.height + 12, 8)}px`,
	};
}

function PendingAnnotationPopover({
	onAddComment,
	onDismissSelection,
	pendingSelection,
}: Readonly<{
	onAddComment?: (comment: string) => void;
	onDismissSelection?: () => void;
	pendingSelection: PendingArtifactSelection;
}>) {
	const [commentDraft, setCommentDraft] = useState("");

	const handleSubmitComment = () => {
		const trimmedComment = commentDraft.trim();
		if (!trimmedComment) {
			return;
		}

		onAddComment?.(trimmedComment);
		setCommentDraft("");
	};

	return (
		<div
			className="pointer-events-auto absolute w-80 max-w-[calc(100%-1rem)] rounded-xl border border-border bg-background p-3 shadow-lg"
			data-artifact-annotation-ui=""
			style={getPendingSelectionStyle(pendingSelection.position)}
		>
			<div className="mb-2 flex items-center justify-between gap-3">
				<div>
					<p className="font-medium text-sm">Add annotation</p>
					<p className="text-text-subtle text-xs">
						{pendingSelection.anchor.textExcerpt || "Selected viewer element"}
					</p>
				</div>
				<Button
					onClick={onDismissSelection}
					size="icon-compact"
					type="button"
					variant="ghost"
				>
					<span className="sr-only">Dismiss annotation</span>
					<XIcon className="size-3.5" />
				</Button>
			</div>
			<Textarea
				className="min-h-20 resize-none"
				onChange={(event) => setCommentDraft(event.currentTarget.value)}
				placeholder="Describe what should change"
				value={commentDraft}
			/>
			<div className="mt-3 flex items-center justify-between gap-2">
				<p className="line-clamp-2 text-text-subtle text-xs">
					{pendingSelection.source.filePath
						? `${pendingSelection.source.filePath}${pendingSelection.source.lineNumber ? `:${pendingSelection.source.lineNumber}` : ""}`
						: "Viewer-surface annotation"}
				</p>
				<div className="flex items-center gap-2">
					<Button
						onClick={onDismissSelection}
						size="default"
						type="button"
						variant="ghost"
					>
						Cancel
					</Button>
					<Button
						disabled={commentDraft.trim().length === 0}
						onClick={handleSubmitComment}
						size="default"
						type="button"
					>
						Add note
					</Button>
				</div>
			</div>
		</div>
	);
}

export interface ArtifactAnnotationLayerProps {
	annotations?: ArtifactAnnotation[];
	onAddComment?: (comment: string) => void;
	onDismissSelection?: () => void;
	onRemoveAnnotation?: (id: string) => void;
	pendingSelection?: PendingArtifactSelection | null;
}

export function ArtifactAnnotationLayer({
	annotations = EMPTY_ANNOTATIONS,
	onAddComment,
	onDismissSelection,
	onRemoveAnnotation,
	pendingSelection = null,
}: Readonly<ArtifactAnnotationLayerProps>) {
	return (
		<div
			className="pointer-events-none absolute inset-0 z-10"
			data-artifact-annotation-ui=""
		>
			{annotations.map((annotation) => (
				<Button
					key={annotation.id}
					className={cn(
						"pointer-events-auto absolute size-7 rounded-full border border-border-selected bg-background px-0 text-[11px] font-semibold text-text shadow-sm",
					)}
					onClick={() => onRemoveAnnotation?.(annotation.id)}
					size="icon"
					style={getAnnotationPinStyle(annotation.position)}
					title={`Remove annotation #${annotation.index}: ${annotation.comment}`}
					type="button"
					variant="outline"
				>
					{annotation.index}
				</Button>
			))}

			{pendingSelection ? (
				<PendingAnnotationPopover
					key={`${pendingSelection.position.left}-${pendingSelection.position.top}-${pendingSelection.anchor.selector ?? "selection"}`}
					onAddComment={onAddComment}
					onDismissSelection={onDismissSelection}
					pendingSelection={pendingSelection}
				/>
			) : null}
		</div>
	);
}

const EMPTY_ANNOTATIONS: ArtifactAnnotation[] = [];

type ArtifactVersionHistoryItem = ArtifactDocument["versions"][number];

// Module-level formatters avoid constructing Intl.DateTimeFormat for every visible version row.
const ARTIFACT_VERSION_HISTORY_GROUP_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
	dateStyle: "medium",
	timeZone: "UTC",
});
const ARTIFACT_VERSION_HISTORY_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("en-US", {
	dateStyle: "medium",
	timeZone: "UTC",
	timeStyle: "short",
});

function isSameUtcDate(a: Date, b: Date): boolean {
	return a.getUTCFullYear() === b.getUTCFullYear()
		&& a.getUTCMonth() === b.getUTCMonth()
		&& a.getUTCDate() === b.getUTCDate();
}

function getArtifactVersionHistoryGroup(createdAt: string): string {
	const date = new Date(createdAt);

	if (!Number.isFinite(date.getTime())) {
		return "Earlier";
	}

	if (isSameUtcDate(date, new Date())) {
		return "Today";
	}

	return ARTIFACT_VERSION_HISTORY_GROUP_DATE_FORMATTER.format(date);
}

function formatArtifactVersionHistoryTimestamp(createdAt: string): string {
	const date = new Date(createdAt);
	const timestamp = date.getTime();

	if (!Number.isFinite(timestamp)) {
		return "Unknown";
	}

	const diffMs = Date.now() - timestamp;
	const absoluteDiffMs = Math.abs(diffMs);

	if (absoluteDiffMs < 60_000) {
		return "Now";
	}

	if (absoluteDiffMs < 60 * 60_000) {
		const minutes = Math.max(1, Math.round(absoluteDiffMs / 60_000));
		return `${minutes} min ago`;
	}

	if (absoluteDiffMs < 24 * 60 * 60_000) {
		const hours = Math.max(1, Math.round(absoluteDiffMs / (60 * 60_000)));
		return `${hours}h ago`;
	}

	return ARTIFACT_VERSION_HISTORY_TIMESTAMP_FORMATTER.format(date);
}

function ArtifactVersionHistoryPanel({
	document,
	onVersionChange,
	selectedVersionId,
}: Readonly<{
	document: ArtifactDocument;
	onVersionChange: (versionId: string) => void;
	selectedVersionId: string | null;
}>) {
	const currentVersionId = selectedVersionId ?? document.versions[document.versions.length - 1]?.id ?? null;
	const groupedVersions = new Map<string, ArtifactVersionHistoryItem[]>();

	for (const version of document.versions.slice().reverse()) {
		const group = getArtifactVersionHistoryGroup(version.createdAt);
		groupedVersions.set(group, [...(groupedVersions.get(group) ?? []), version]);
	}

	return (
		<aside className="flex w-[280px] shrink-0 flex-col border-border border-l bg-surface-raised">
			<div className="border-border border-b px-4 py-3">
				<p className="font-semibold text-sm text-text">Version history</p>
				<p className="mt-1 text-text-subtle text-xs">Draft activity for this artifact.</p>
			</div>
			<div className="min-h-0 flex-1 overflow-auto p-3">
				{Array.from(groupedVersions.entries()).map(([group, groupVersions]) => (
					<div key={group} className="mb-4">
						<p className="px-1 pb-2 font-semibold text-text-subtlest text-xs">{group}</p>
						<div className="space-y-2">
							{groupVersions.map((version) => {
								const isCurrent = version.id === currentVersionId;
								const versionNumber = getArtifactVersionNumber(document, version.id);

								return (
									<button
										key={version.id}
										type="button"
										aria-label={formatArtifactVersionLabel({ document, version })}
										aria-pressed={isCurrent ? true : undefined}
										onClick={() => onVersionChange(version.id)}
										className={cn(
											"w-full rounded-lg border px-3 py-2 text-left transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
											isCurrent
												? "border-border-selected bg-bg-selected text-text-selected"
												: "border-border bg-surface text-text hover:bg-surface-hovered",
										)}
									>
										<span className="flex items-start gap-2">
											<span className="grid size-7 shrink-0 place-items-center rounded-full bg-bg-neutral font-semibold text-text-subtle text-xs">
												R
											</span>
											<span className="min-w-0">
												<span className="block truncate font-medium text-sm">
													{version.changeLabel || `Version ${versionNumber}`}
												</span>
												<span className="mt-0.5 block truncate text-text-subtle text-xs">
													{version.title}
												</span>
												<span className="mt-1 block text-text-subtlest text-xs">
													{formatArtifactVersionHistoryTimestamp(version.createdAt)}
												</span>
											</span>
										</span>
									</button>
								);
							})}
						</div>
					</div>
				))}
			</div>
			<div className="border-border border-t px-3 py-3">
				<Button size="default" type="button" variant="outline" className="w-full">
					Show earlier versions
				</Button>
			</div>
		</aside>
	);
}

export { type ArtifactDocument } from "@/components/ui-custom/lib/artifact-versions";
export type { ArtifactAnnotation, PendingArtifactSelection } from "@/components/ui-custom/lib/artifact-annotations";

export interface ArtifactPanelProps {
	/** Annotation pins displayed on the preview surface. */
	annotations?: ArtifactAnnotation[];
	/** Ref forwarded to the scrollable content area (used by annotation hook). */
	contentRef?: RefObject<HTMLDivElement | null>;
	/** Whether annotation cursor mode is active (dev-only). */
	cursorMode?: boolean;
	/** The artifact document with versioned content. */
	document: ArtifactDocument;
	/** Current draft content for edit mode. */
	draftContent: string;
	/** Whether the artifact is currently streaming. */
	isStreaming?: boolean;
	/** Current display mode. */
	mode: "preview" | "edit";
	/** Callback to add an annotation comment. */
	onAddComment?: (comment: string) => void;
	/** Callback to apply all accumulated annotations as individual artifact-update tasks. */
	onApplyAnnotations?: (annotations: ArtifactAnnotation[]) => void;
	/** Callback to close the panel. */
	onClose: () => void;
	/** Callback to toggle annotation cursor mode. */
	onCursorModeChange?: (active: boolean) => void;
	/** Callback to delete the artifact. */
	onDelete: () => Promise<void>;
	/** Callback to dismiss the pending annotation selection. */
	onDismissSelection?: () => void;
	/** Callback when draft content changes in edit mode. */
	onDraftChange: (value: string) => void;
	/** Callback to switch between preview and edit mode. */
	onModeChange: (mode: "preview" | "edit") => void;
	/** Callback to remove an annotation by id. */
	onRemoveAnnotation?: (id: string) => void;
	/** Callback to save the current draft as a new version. */
	onSave: () => Promise<void>;
	/** Callback when the selected version changes. */
	onVersionChange: (versionId: string | null) => void;
	/** The pending annotation selection (shown as a comment popover). */
	pendingSelection?: PendingArtifactSelection | null;
	/** Currently selected version id (null = latest). */
	selectedVersionId: string | null;
	/** Additional className for the outer container. */
	className?: string;
}

function trackScrollingState(elements: readonly HTMLElement[]): () => void {
	let timeout: ReturnType<typeof setTimeout> | undefined;
	function onScroll(this: HTMLElement) {
		this.setAttribute("data-scrolling", "");
		if (timeout !== undefined) {
			clearTimeout(timeout);
		}
		timeout = setTimeout(() => {
			for (const element of elements) {
				element.removeAttribute("data-scrolling");
			}
		}, 1000);
	}
	for (const element of elements) {
		element.addEventListener("scroll", onScroll, { passive: true });
	}

	return () => {
		for (const element of elements) {
			element.removeEventListener("scroll", onScroll);
		}
		if (timeout !== undefined) {
			clearTimeout(timeout);
		}
	};
}

export function ArtifactPanel({
	annotations = EMPTY_ANNOTATIONS,
	contentRef,
	cursorMode = false,
	document,
	draftContent,
	isStreaming = false,
	mode,
	onAddComment,
	onApplyAnnotations,
	onClose,
	onCursorModeChange,
	onDelete,
	onDismissSelection,
	onDraftChange,
	onModeChange,
	onRemoveAnnotation,
	onSave,
	onVersionChange,
	pendingSelection = null,
	selectedVersionId,
	className,
}: Readonly<ArtifactPanelProps>) {
	const selectedVersion =
		document.versions.find((version) => version.id === selectedVersionId)
		?? document.versions[document.versions.length - 1]
		?? null;
	const selectedVersionTitle = getArtifactVersionTitle({
		document,
		version: selectedVersion,
	});
	const previewContent =
		isStreaming && draftContent.trim().length > 0
			? draftContent
			: selectedVersion?.content ?? "";
	const resolvedPreviewBody = buildArtifactPreviewBody({
		content: previewContent,
		kind: document.kind,
		summary: document.previewSummary ?? null,
	});
	const versionLabel = isStreaming
		? "Generating artifact..."
		: selectedVersion
		? formatArtifactVersionSummaryLabel({
			version: selectedVersion,
		})
		: `${document.kind} artifact`;
	const showAnnotateToggle = process.env.NODE_ENV === "development";
	const isAnnotateDisabled =
		!showAnnotateToggle
		|| isStreaming
		|| mode !== "preview"
		|| onCursorModeChange === undefined;
	const outerScrollRef = useRef<HTMLDivElement>(null);
	const [isVersionHistoryOpen, setVersionHistoryOpen] = useState(false);
	const hasVersionHistory = !isStreaming && document.versions.length > 0;
	const shouldShowVersionHistory = hasVersionHistory && isVersionHistoryOpen;

	useEffect(() => {
		const elements = [outerScrollRef.current, contentRef?.current].filter(Boolean) as HTMLElement[];
		return trackScrollingState(elements);
	}, [contentRef]);

	if (!hasVersionHistory && isVersionHistoryOpen) {
		setVersionHistoryOpen(false);
	}

	return (
		<div className={cn("flex h-full min-h-0 w-full min-w-0 flex-col bg-background", className)}>
			<div className="flex flex-wrap items-center justify-between gap-3 border-border border-b bg-background p-3">
				<div className="flex min-w-0 items-center gap-2">
					<div className="min-w-0">
						<p className="truncate font-medium text-sm">{selectedVersionTitle}</p>
						<p className="truncate text-xs leading-4 text-text-subtlest">{versionLabel}</p>
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					{hasVersionHistory ? (
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger
									render={
										<Button
											aria-label="Version history"
											aria-pressed={shouldShowVersionHistory ? true : undefined}
											onClick={() => setVersionHistoryOpen((value) => !value)}
											size="icon"
											type="button"
											variant="ghost"
										>
											<ClockIcon className="size-4" />
										</Button>
									}
								/>
								<TooltipContent>Version history</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					) : null}

					<Button
						disabled={isStreaming}
						onClick={() => onModeChange(mode === "preview" ? "edit" : "preview")}
						size="icon"
						type="button"
						variant="ghost"
					>
						<span className="sr-only">{mode === "preview" ? "Edit artifact" : "Preview artifact"}</span>
						<PencilLineIcon className="size-4" />
					</Button>
					{showAnnotateToggle ? (
						<Button
							aria-pressed={cursorMode}
							disabled={isAnnotateDisabled}
							onClick={() => onCursorModeChange?.(!cursorMode)}
							size="icon"
							title="Dev-only annotation mode for the current artifact viewer surface."
							type="button"
							variant="ghost"
						>
							<span className="sr-only">Annotate artifact</span>
							<MessageSquarePlusIcon className="size-4" />
						</Button>
					) : null}
					<Button
						onClick={() => void navigator.clipboard.writeText(previewContent)}
						size="icon"
						type="button"
						variant="ghost"
					>
						<span className="sr-only">Copy artifact content</span>
						<CopyIcon className="size-4" />
					</Button>
					<Button
						disabled={isStreaming}
						onClick={() => void onDelete()}
						size="icon"
						type="button"
						variant="ghost"
					>
						<span className="sr-only">Delete artifact</span>
						<Trash2Icon className="size-4" />
					</Button>
					<Button onClick={onClose} size="icon" type="button" variant="ghost">
						<span className="sr-only">Close artifact</span>
						<XIcon className="size-4" />
					</Button>
				</div>
			</div>

			<div ref={outerScrollRef} className="flex min-h-0 flex-1 overflow-hidden bg-background">
				{mode === "edit" && !isStreaming ? (
					<div className="flex min-h-0 flex-1 flex-col">
						<Textarea
							className="min-h-[50vh] flex-1 resize-none rounded-none border-0 p-4 shadow-none focus-visible:ring-0"
							onChange={(event) => onDraftChange(event.currentTarget.value)}
							value={draftContent}
						/>
						<div className="flex items-center justify-between border-border/70 border-t bg-bg-neutral/40 px-4 py-3">
							<p className="text-text-subtle text-xs">
								Saving creates a new local version for this artifact.
							</p>
							<Button onClick={() => void onSave()} size="default" type="button">
								<SaveIcon className="size-4" />
								Save version
							</Button>
						</div>
					</div>
				) : (
					<div
						ref={contentRef}
						className="relative flex min-h-0 flex-1 flex-col overflow-auto scrollbar-auto-hide bg-background"
					>
						<PreviewBodyRenderer
							body={resolvedPreviewBody}
							isStreaming={isStreaming}
							surface="artifact-pane"
							title={selectedVersionTitle}
							summary={document.previewSummary}
						/>

						{mode === "preview" ? (
							<ArtifactAnnotationLayer
								annotations={annotations}
								onAddComment={onAddComment}
								onDismissSelection={onDismissSelection}
								onRemoveAnnotation={onRemoveAnnotation}
								pendingSelection={pendingSelection}
							/>
						) : null}
					</div>
				)}
				{shouldShowVersionHistory ? (
					<ArtifactVersionHistoryPanel
						document={document}
						onVersionChange={onVersionChange}
						selectedVersionId={selectedVersion?.id ?? null}
					/>
				) : null}
			</div>

			{annotations.length > 0 && onApplyAnnotations ? (
				<div className="flex items-center justify-between border-border/80 border-t bg-bg-neutral/40 px-4 py-2">
					<p className="text-text-subtle text-xs">
						{annotations.length} {annotations.length === 1 ? "annotation" : "annotations"}
					</p>
					<Button
						disabled={isStreaming}
						onClick={() => onApplyAnnotations(annotations)}
						size="default"
						type="button"
					>
						Apply all
					</Button>
				</div>
			) : null}
		</div>
	);
}
