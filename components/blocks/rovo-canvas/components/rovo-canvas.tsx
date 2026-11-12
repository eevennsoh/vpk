"use client";

// oxlint-disable react-doctor/no-chain-state-updates -- Related state fields are updated together to preserve atomic UI transitions and avoid partial interaction states.
// oxlint-disable react-doctor/no-derived-state -- These components maintain local derived display state for controlled animations, measurements, or draft editing that cannot be represented as render-only values without changing UX.
// oxlint-disable react-doctor/no-pass-data-to-parent -- Callbacks in this file intentionally report measured, generated, or selected data to an owning parent component.
// oxlint-disable react-doctor/no-pass-live-state-to-parent -- Callbacks in this file intentionally stream live interaction state to the parent owner.

// oxlint-disable react-doctor/no-event-handler -- Effects in this file bridge external systems, animation/media state, timers, or parent-controlled state rather than user event handlers.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import ClockIcon from "@atlaskit/icon/core/clock";
import CopyIcon from "@atlaskit/icon/core/copy";
import CursorIcon from "@atlaskit/icon-lab/core/cursor";
import RefreshIcon from "@atlaskit/icon/core/refresh";

import { Button } from "@/components/ui/button";
import { CardDescription } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
} from "@/components/ui/dialog";
import { Icon as VpkIcon } from "@/components/ui/icon";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArtifactAnnotationLayer } from "@/components/blocks/artifact";
import { useArtifactAnnotations } from "@/components/ui-custom/hooks/use-artifact-annotations";
import type { ArtifactAnnotationKind } from "@/components/ui-custom/lib/artifact-annotations";
import { cn } from "@/lib/utils";

import { RovoCanvasHeader } from "./rovo-canvas-header";
import { RovoCanvasRightRail } from "./rovo-canvas-right-rail";
import {
	RovoCanvasViewSwitcher,
	type RovoCanvasView,
	type RovoCanvasViewIcon,
	type RovoCanvasToolbarMode,
} from "./rovo-canvas-view-switcher";

export type { RovoCanvasToolbarMode, RovoCanvasView, RovoCanvasViewIcon };

const ROVO_CANVAS_OPEN_INSTANCES_KEY = "__vpkRovoCanvasOpenInstances";

interface RovoCanvasGlobalScope {
	[ROVO_CANVAS_OPEN_INSTANCES_KEY]?: Set<symbol>;
}

function getActiveRovoCanvasInstances(): Set<symbol> {
	const globalScope = globalThis as typeof globalThis & RovoCanvasGlobalScope;
	globalScope[ROVO_CANVAS_OPEN_INSTANCES_KEY] ??= new Set<symbol>();
	return globalScope[ROVO_CANVAS_OPEN_INSTANCES_KEY];
}

function syncRovoCanvasOpenAttribute(): void {
	if (typeof document === "undefined") {
		return;
	}

	if (getActiveRovoCanvasInstances().size > 0) {
		document.documentElement.dataset.rovoCanvasOpen = "true";
		return;
	}

	delete document.documentElement.dataset.rovoCanvasOpen;
}

export type RovoCanvasArtefactKind =
	| "dashboard"
	| "report"
	| "app"
	| "integration"
	| "script"
	| "script-py"
	| "script-js"
	| "agent"
	| "automation";

export type RovoCanvasStatus =
	| "idle"
	| "planning"
	| "executing"
	| "ready"
	| "editing"
	| "error";

export interface RovoCanvasVersion {
	id: string;
	label: string;
	summary: string;
	timestamp: string;
	author?: string;
	isCurrent?: boolean;
	group?: string;
}

export interface RovoCanvasProps {
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	kind?: RovoCanvasArtefactKind;
	status?: RovoCanvasStatus;
	title?: string;
	headerStart?: ReactNode;
	primaryActionLabel?: string;
	onPrimaryAction?: () => void;
	/** Optional menu items for a split primary-action button; only canvases with
	 * secondary primary-action commands (e.g. code review) supply this. */
	primaryActionMenu?: ReactNode;
	views?: ReadonlyArray<RovoCanvasView>;
	viewId?: string;
	defaultViewId?: string;
	onViewChange?: (viewId: string) => void;
	artefactLabel?: string;
	artefactMetadata?: string;
	showArtefactIdentity?: boolean;
	rightRail?: ReactNode;
	feedbackBanner?: ReactNode;
	versionHistory?: ReadonlyArray<RovoCanvasVersion>;
	onVersionSelect?: (versionId: string) => void;
	onRefresh?: (viewId: string) => void;
	onCopy?: (view: RovoCanvasView) => void;
	onSelectModeChange?: (isSelectMode: boolean) => void;
	annotationDocumentId?: string | null;
	annotationDocumentKind?: ArtifactAnnotationKind | null;
	annotationDocumentVersionId?: string | null;
	className?: string;
}

const DEFAULT_VERSIONS: ReadonlyArray<RovoCanvasVersion> = [
	{
		id: "current",
		label: "Current draft",
		summary: "Canvas shell",
		timestamp: "Now",
		author: "You",
		isCurrent: true,
		group: "Today",
	},
	{
		id: "generated",
		label: "Initial artefact",
		summary: "First generated version",
		timestamp: "2 min ago",
		author: "Rovo",
		group: "Today",
	},
];

const VIEW_SETS: Record<RovoCanvasArtefactKind, ReadonlyArray<RovoCanvasView>> = {
	dashboard: [
		{ id: "plan", label: "Plan", toolbar: "none" },
		{ id: "preview", label: "Preview", toolbar: "preview" },
		{ id: "html", label: "HTML", toolbar: "source" },
	],
	report: [
		{ id: "plan", label: "Plan", toolbar: "none" },
		{ id: "preview", label: "Preview", toolbar: "preview" },
		{ id: "html", label: "HTML", toolbar: "source" },
	],
	app: [
		{ id: "plan", label: "Plan", toolbar: "none" },
		{ id: "preview", label: "Preview", toolbar: "preview" },
		{ id: "html", label: "HTML", toolbar: "source" },
	],
	integration: [
		{ id: "plan", label: "Plan", toolbar: "none" },
		{ id: "preview", label: "Preview", toolbar: "preview" },
		{ id: "html", label: "HTML", toolbar: "source" },
	],
	script: [
		{ id: "plan", label: "Plan", toolbar: "none" },
		{ id: "code", label: "Code", toolbar: "source" },
	],
	"script-py": [
		{ id: "plan", label: "Plan", toolbar: "none" },
		{ id: "code", label: "Code", toolbar: "source" },
	],
	"script-js": [
		{ id: "plan", label: "Plan", toolbar: "none" },
		{ id: "code", label: "Code", toolbar: "source" },
	],
	agent: [
		{ id: "agent-details", label: "Details", toolbar: "none" },
		{ id: "agent-preview", label: "Preview", toolbar: "preview" },
		{ id: "agent-surface", label: "Surfaces", toolbar: "none" },
	],
	automation: [
		{ id: "automation-setup", label: "Setup", toolbar: "none" },
		{ id: "automation-rule", label: "Rule", toolbar: "none" },
	],
};

function isScriptKind(kind: RovoCanvasArtefactKind): boolean {
	return kind === "script" || kind === "script-py" || kind === "script-js";
}

function getDefaultAnnotationKind(kind: RovoCanvasArtefactKind): ArtifactAnnotationKind {
	if (isScriptKind(kind)) {
		return "code";
	}

	return "html";
}

function getDefaultViewId(kind: RovoCanvasArtefactKind): string {
	if (kind === "agent") {
		return "agent-details";
	}

	if (kind === "automation") {
		return "automation-rule";
	}

	if (isScriptKind(kind)) {
		return "code";
	}

	return "preview";
}

function getArtefactLabel(kind: RovoCanvasArtefactKind): string {
	if (kind === "agent") {
		return "Agent artefact";
	}

	if (kind === "automation") {
		return "Automation rule";
	}

	return "Code artefact";
}

function getToolbarMode(view: RovoCanvasView | undefined): RovoCanvasToolbarMode {
	if (view?.toolbar !== undefined) {
		return view.toolbar;
	}

	if (view?.id === "preview" || view?.id === "agent-preview") {
		return "preview";
	}

	if (view?.id === "html" || view?.id === "code") {
		return "source";
	}

	return "none";
}

function isWorkingStatus(status: RovoCanvasStatus): boolean {
	return status === "planning" || status === "executing";
}

function getRovoCanvasDefaultCopyText(): string {
	return "";
}

export function RovoCanvasArtefactIdentity({
	label,
	metadata,
}: Readonly<{
	label: string;
	metadata?: ReactNode;
}>): React.ReactElement {
	return (
		<div className="min-w-0">
			<p className="truncate font-medium text-sm">{label}</p>
			{metadata ? (
				<CardDescription className="line-clamp-2 text-xs leading-4">{metadata}</CardDescription>
			) : null}
		</div>
	);
}

function useControllableOpen({
	open,
	defaultOpen = false,
	onOpenChange,
}: Pick<RovoCanvasProps, "open" | "defaultOpen" | "onOpenChange">) {
	const [internalOpen, setInternalOpen] = useState(defaultOpen);
	const isControlled = open !== undefined;
	const resolvedOpen = isControlled ? open : internalOpen;

	function setOpen(nextOpen: boolean): void {
		if (!isControlled) {
			setInternalOpen(nextOpen);
		}

		onOpenChange?.(nextOpen);
	}

	return [resolvedOpen, setOpen] as const;
}

function useControllableView({
	viewId,
	defaultViewId,
	onViewChange,
}: Pick<RovoCanvasProps, "viewId" | "defaultViewId" | "onViewChange">) {
	const [internalViewId, setInternalViewId] = useState(defaultViewId);
	const isControlled = viewId !== undefined;
	const resolvedViewId = isControlled ? viewId : internalViewId;

	function setViewId(nextViewId: string): void {
		if (!isControlled) {
			setInternalViewId(nextViewId);
		}

		onViewChange?.(nextViewId);
	}

	return [resolvedViewId, setViewId] as const;
}

function CanvasToolbarAction({
	label,
	children,
	onClick,
	disabled = false,
	isSelected = false,
}: Readonly<{
	label: string;
	children: ReactNode;
	onClick?: () => void;
	disabled?: boolean;
	isSelected?: boolean;
}>): React.ReactElement {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						aria-label={label}
						aria-pressed={isSelected ? true : undefined}
						disabled={disabled}
						size="icon"
						variant="ghost"
						onClick={onClick}
					>
						{children}
					</Button>
				}
			/>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}

function LoadingScreen(): React.ReactElement {
	return (
		<div className="absolute inset-0 z-20 flex items-center justify-center bg-surface">
			<div className="flex w-[min(360px,calc(100%-48px))] flex-col items-center gap-4 rounded-lg border border-border bg-surface-raised px-6 py-8 text-center shadow-lg">
				<div className="grid size-11 place-items-center rounded-full bg-surface-accent-blue-subtle text-icon-information">
					<span className="text-lg font-semibold">R</span>
				</div>
				<div className="space-y-1">
					<p className="text-sm font-semibold text-text">Creating artefact</p>
					<p className="text-sm text-text-subtle">Rovo is preparing the canvas.</p>
				</div>
			</div>
		</div>
	);
}

function ShimmerOverlay(): React.ReactElement {
	return (
		<div className="pointer-events-none absolute inset-0 z-10 p-10">
			<svg className="size-full animate-pulse" aria-hidden focusable="false">
				<rect
					x="10%"
					y="14%"
					width="80%"
					height="64%"
					rx="12"
					fill="none"
					stroke="var(--ds-border-selected)"
					strokeWidth="2"
					strokeDasharray="18 14"
				/>
				<rect
					x="10%"
					y="14%"
					width="80%"
					height="64%"
					rx="12"
					fill="none"
					stroke="var(--ds-border-discovery)"
					strokeWidth="2"
					strokeDasharray="2 18"
					strokeDashoffset="10"
				/>
				<rect
					x="10%"
					y="14%"
					width="80%"
					height="64%"
					rx="12"
					fill="none"
					stroke="var(--ds-border-success)"
					strokeWidth="2"
					strokeDasharray="12 20"
					strokeDashoffset="20"
				/>
			</svg>
		</div>
	);
}

export function RovoCanvasPlaceholder({
	isEditing = false,
}: Readonly<{
	isEditing?: boolean;
}>): React.ReactElement {
	return (
		<section
			aria-label="Blank canvas surface"
			className="relative size-full overflow-auto bg-surface"
		>
			{isEditing ? <ShimmerOverlay /> : null}
		</section>
	);
}

function RovoCanvasDefaultView({
	status,
}: Readonly<{
	status: RovoCanvasStatus;
}>): React.ReactElement {
	return (
		<RovoCanvasPlaceholder
			isEditing={status === "editing"}
		/>
	);
}

function VersionHistoryPanel({
	onVersionSelect,
	versions,
}: Readonly<{
	onVersionSelect?: (versionId: string) => void;
	versions: ReadonlyArray<RovoCanvasVersion>;
}>): React.ReactElement {
	const groupedVersions = useMemo(() => {
		const groups = new Map<string, RovoCanvasVersion[]>();

		for (const version of versions) {
			const group = version.group ?? "Earlier";
			groups.set(group, [...(groups.get(group) ?? []), version]);
		}

		return Array.from(groups.entries());
	}, [versions]);

	return (
		<aside className="flex w-[280px] shrink-0 flex-col border-l border-border bg-surface-raised">
			<div className="border-b border-border px-4 py-3">
				<p className="text-sm font-semibold text-text">Version history</p>
				<p className="mt-1 text-xs text-text-subtle">Draft activity for this artefact.</p>
			</div>
			<div className="min-h-0 flex-1 overflow-auto p-3">
				{groupedVersions.map(([group, groupVersions]) => (
					<div key={group} className="mb-4">
						<p className="px-1 pb-2 text-xs font-semibold text-text-subtlest">{group}</p>
						<div className="space-y-2">
							{groupVersions.map((version) => (
								<button
									key={version.id}
									type="button"
									aria-label={`Select ${version.label}`}
									aria-pressed={version.isCurrent ? true : undefined}
									onClick={() => onVersionSelect?.(version.id)}
									className={cn(
										"w-full rounded-lg border px-3 py-2 text-left transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
										version.isCurrent
											? "border-border-selected bg-bg-selected text-text-selected"
											: "border-border bg-surface text-text hover:bg-surface-hovered",
									)}
								>
									<span className="flex items-start gap-2">
										<span className="grid size-7 shrink-0 place-items-center rounded-full bg-bg-neutral text-xs font-semibold text-text-subtle">
											{version.author?.charAt(0) ?? "R"}
										</span>
										<span className="min-w-0">
											<span className="block truncate text-sm font-medium">{version.label}</span>
											<span className="mt-0.5 block truncate text-xs text-text-subtle">{version.summary}</span>
											<span className="mt-1 block text-xs text-text-subtlest">{version.timestamp}</span>
										</span>
									</span>
								</button>
							))}
						</div>
					</div>
				))}
			</div>
			<div className="border-t border-border px-3 py-3">
				<Button size="default" variant="outline" className="w-full">
					Show earlier versions
				</Button>
			</div>
		</aside>
	);
}

function CanvasToolbar({
	activeView,
	isVersionHistoryOpen,
	isSelectMode,
	isCopied,
	showSelectModeControl,
	isSelectModeDisabled,
	onRefresh,
	onToggleVersionHistory,
	onToggleSelectMode,
	onCopy,
}: Readonly<{
	activeView: RovoCanvasView | undefined;
	isVersionHistoryOpen: boolean;
	isSelectMode: boolean;
	isCopied: boolean;
	showSelectModeControl: boolean;
	isSelectModeDisabled: boolean;
	onRefresh: () => void;
	onToggleVersionHistory: () => void;
	onToggleSelectMode: () => void;
	onCopy: () => void;
}>): React.ReactElement {
	const toolbarMode = getToolbarMode(activeView);

	if (toolbarMode === "none") {
		return <div className="h-7" />;
	}

	return (
		<div className="flex items-center justify-end gap-1">
			<CanvasToolbarAction label="Refresh" onClick={onRefresh}>
				<VpkIcon render={<RefreshIcon label="" />} />
			</CanvasToolbarAction>
			<CanvasToolbarAction
				label="Version history"
				isSelected={isVersionHistoryOpen}
				onClick={onToggleVersionHistory}
			>
				<VpkIcon render={<ClockIcon label="" />} />
			</CanvasToolbarAction>
			{toolbarMode === "preview" && showSelectModeControl ? (
				<CanvasToolbarAction
					label={isSelectMode ? "Exit select mode" : "Select element"}
					disabled={isSelectModeDisabled}
					isSelected={isSelectMode}
					onClick={onToggleSelectMode}
				>
					<VpkIcon render={<CursorIcon label="" />} />
				</CanvasToolbarAction>
			) : null}
			{toolbarMode === "source" ? (
				<CanvasToolbarAction label={isCopied ? "Copied" : "Copy code"} onClick={onCopy}>
					<VpkIcon render={isCopied ? <CheckMarkIcon label="" /> : <CopyIcon label="" />} />
				</CanvasToolbarAction>
			) : null}
		</div>
	);
}

export function RovoCanvas({
	open,
	defaultOpen,
	onOpenChange,
	kind = "dashboard",
	status = "ready",
	title = "Canvas draft",
	headerStart,
	primaryActionLabel = "Save",
	onPrimaryAction,
	primaryActionMenu,
	views,
	viewId,
	defaultViewId,
	onViewChange,
	artefactLabel,
	artefactMetadata,
	showArtefactIdentity = true,
	rightRail,
	feedbackBanner,
	versionHistory = DEFAULT_VERSIONS,
	onVersionSelect,
	onRefresh,
	onCopy,
	onSelectModeChange,
	annotationDocumentId,
	annotationDocumentKind,
	annotationDocumentVersionId,
	className,
}: Readonly<RovoCanvasProps>): React.ReactElement {
	const resolvedViews = views ?? VIEW_SETS[kind];
	const defaultViewForKind = defaultViewId ?? getDefaultViewId(kind);
	const [isOpen, setOpen] = useControllableOpen({ open, defaultOpen, onOpenChange });
	const [activeViewId, setActiveViewId] = useControllableView({
		viewId,
		defaultViewId: defaultViewForKind,
		onViewChange,
	});
	const [isVersionHistoryOpen, setVersionHistoryOpen] = useState(false);
	const [isSelectMode, setSelectMode] = useState(false);
	const [isCopied, setCopied] = useState(false);
	const annotationContainerRef = useRef<HTMLDivElement>(null);
	const canvasInstanceIdRef = useRef<symbol | null>(null);
	const activeView = useMemo(
		() => resolvedViews.find((view) => view.id === activeViewId) ?? resolvedViews[0],
		[activeViewId, resolvedViews],
	);
	const resolvedActiveViewId = activeView?.id ?? resolvedViews[0]?.id ?? defaultViewForKind;
	const resolvedArtefactLabel = artefactLabel ?? getArtefactLabel(kind);
	const shouldShowVersionHistory = isVersionHistoryOpen && getToolbarMode(activeView) !== "none";
	const activeToolbarMode = getToolbarMode(activeView);
	const isPreviewToolbarActive = activeToolbarMode === "preview";
	const showSelectModeControl = process.env.NODE_ENV === "development";
	const isAnnotationModeAvailable =
		showSelectModeControl
		&& isOpen
		&& isPreviewToolbarActive
		&& !isWorkingStatus(status);
	const resolvedAnnotationDocumentId = annotationDocumentId === undefined
		? `rovo-canvas:${kind}:${title}`
		: annotationDocumentId;
	const resolvedAnnotationDocumentKind = annotationDocumentKind === undefined
		? getDefaultAnnotationKind(kind)
		: annotationDocumentKind;
	const resolvedAnnotationDocumentVersionId = annotationDocumentVersionId === undefined
		? resolvedActiveViewId
		: annotationDocumentVersionId;
	const {
		annotations,
		addComment,
		clearAnnotations,
		dismissSelection,
		pendingSelection,
		removeAnnotation,
	} = useArtifactAnnotations({
		active: isAnnotationModeAvailable && isSelectMode,
		documentId: resolvedAnnotationDocumentId,
		documentKind: resolvedAnnotationDocumentKind,
		documentVersionId: resolvedAnnotationDocumentVersionId,
		containerRef: annotationContainerRef,
	});

	if (canvasInstanceIdRef.current === null) {
		canvasInstanceIdRef.current = Symbol("rovo-canvas");
	}

	// oxlint-disable react-doctor/no-adjust-state-on-prop-change -- annotation availability is bridged to canvas selection and parent state.
	useEffect(() => {
		const instanceId = canvasInstanceIdRef.current;
		if (instanceId === null) {
			return;
		}

		const activeRovoCanvasInstances = getActiveRovoCanvasInstances();
		if (isOpen) {
			activeRovoCanvasInstances.add(instanceId);
		} else {
			activeRovoCanvasInstances.delete(instanceId);
		}
		syncRovoCanvasOpenAttribute();

		return () => {
			getActiveRovoCanvasInstances().delete(instanceId);
			syncRovoCanvasOpenAttribute();
		};
	}, [isOpen]);

	useEffect(() => {
		if (resolvedViews.some((view) => view.id === activeViewId)) {
			return;
		}

		const fallbackViewId = resolvedViews.some((view) => view.id === defaultViewForKind)
			? defaultViewForKind
			: resolvedViews[0]?.id;

		if (fallbackViewId !== undefined) {
			setActiveViewId(fallbackViewId);
		}
	}, [activeViewId, defaultViewForKind, resolvedViews, setActiveViewId]);

	useEffect(() => {
		if (isAnnotationModeAvailable) {
			return;
		}

		clearAnnotations();

		if (isSelectMode) {
			setSelectMode(false);
			onSelectModeChange?.(false);
		}
	}, [clearAnnotations, isAnnotationModeAvailable, isSelectMode, onSelectModeChange]);
	// oxlint-enable react-doctor/no-adjust-state-on-prop-change

	function handleToggleSelectMode(): void {
		if (!isAnnotationModeAvailable) {
			return;
		}

		const nextSelectMode = !isSelectMode;
		setSelectMode(nextSelectMode);
		onSelectModeChange?.(nextSelectMode);
	}

	function handleRefresh(): void {
		onRefresh?.(resolvedActiveViewId);
	}

	function handleCopy(): void {
		if (activeView === undefined) {
			return;
		}

		if (onCopy !== undefined) {
			onCopy(activeView);
			return;
		}

		const copyText = activeView.copyText ?? getRovoCanvasDefaultCopyText();
		try {
			void navigator.clipboard?.writeText(copyText).catch(() => undefined);
		} catch {
			// Clipboard access can be blocked in embedded previews.
		}
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1600);
	}

	return (
		<Dialog open={isOpen} onOpenChange={setOpen}>
			<DialogContent
				showCloseButton={false}
				className={cn(
					"inset-4 flex h-auto w-auto !max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-2xl bg-surface-sunken px-4 pt-4 pb-4 sm:!max-w-none",
					"data-open:zoom-in-100 data-closed:zoom-out-100",
					className,
				)}
			>
				<DialogDescription className="sr-only">
					Full-screen Rovo canvas with artefact views and a chat rail.
				</DialogDescription>
				<TooltipProvider>
					<div className="flex size-full min-h-0 flex-col gap-4">
						<RovoCanvasHeader
							title={title}
							start={headerStart}
							primaryActionLabel={primaryActionLabel}
							onPrimaryAction={onPrimaryAction}
							primaryActionMenu={primaryActionMenu}
							onClose={() => setOpen(false)}
						/>

						{feedbackBanner !== undefined ? feedbackBanner : null}

						<div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_400px] lg:overflow-hidden">
							<section className="flex min-h-[420px] min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-surface lg:min-h-0">
								<div className="flex size-full min-h-0 flex-col gap-0">
									{showArtefactIdentity ? (
										<div className="grid min-h-[60px] shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-b border-border bg-surface px-4 py-3">
											<RovoCanvasArtefactIdentity
												label={resolvedArtefactLabel}
												metadata={artefactMetadata}
											/>
											{resolvedViews.length > 1 ? (
												<RovoCanvasViewSwitcher
													onValueChange={setActiveViewId}
													value={resolvedActiveViewId}
													views={resolvedViews}
												/>
											) : (
												<div aria-hidden="true" />
											)}
											<CanvasToolbar
												activeView={activeView}
												isVersionHistoryOpen={shouldShowVersionHistory}
												isSelectMode={isSelectMode}
												isCopied={isCopied}
												showSelectModeControl={showSelectModeControl}
												isSelectModeDisabled={!isAnnotationModeAvailable}
												onRefresh={handleRefresh}
												onToggleVersionHistory={() => setVersionHistoryOpen((value) => !value)}
												onToggleSelectMode={handleToggleSelectMode}
												onCopy={handleCopy}
											/>
										</div>
									) : null}

									<div className="flex min-h-0 flex-1">
										<div className="relative min-w-0 flex-1">
											{resolvedViews.map((view) => {
												const isActivePreviewView =
													view.id === resolvedActiveViewId && getToolbarMode(view) === "preview";

												return (
													<div
														key={view.id}
														hidden={view.id !== resolvedActiveViewId}
														className="size-full"
													>
														<div
															ref={isActivePreviewView ? annotationContainerRef : undefined}
															className="relative size-full min-h-0 overflow-hidden"
														>
															{view.content === undefined ? (
																<RovoCanvasDefaultView status={status} />
															) : view.content}
															{isActivePreviewView ? (
																<ArtifactAnnotationLayer
																	annotations={annotations}
																	onAddComment={addComment}
																	onDismissSelection={dismissSelection}
																	onRemoveAnnotation={removeAnnotation}
																	pendingSelection={pendingSelection}
																/>
															) : null}
														</div>
													</div>
												);
											})}
											{isWorkingStatus(status) ? <LoadingScreen /> : null}
										</div>
										{shouldShowVersionHistory ? (
											<VersionHistoryPanel
												onVersionSelect={onVersionSelect}
												versions={versionHistory}
											/>
										) : null}
									</div>
								</div>
							</section>

							<section className="min-h-[520px] min-w-0 overflow-hidden lg:min-h-0">
								{rightRail ?? (
									<RovoCanvasRightRail
										artifactTitle={title}
										onClose={() => setOpen(false)}
									/>
								)}
							</section>
						</div>
					</div>
				</TooltipProvider>
			</DialogContent>
		</Dialog>
	);
}
