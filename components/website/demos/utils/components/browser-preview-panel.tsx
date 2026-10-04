"use client";

// oxlint-disable react-doctor/exhaustive-deps -- Effects in this file intentionally coordinate refs, external animation loops, timers, subscriptions, or measured DOM state; dependencies are constrained to avoid restarting those bridges.
// oxlint-disable react-doctor/no-initialize-state -- These components intentionally seed local interactive state from props once before user edits take ownership.
// oxlint-disable react-doctor/no-noninteractive-tabindex -- This viewport intentionally receives keyboard focus for application-style keyboard and paste handling without button semantics.

// oxlint-disable react-doctor/no-event-handler -- Effects in this file bridge external systems, animation/media state, timers, or parent-controlled state rather than user event handlers.

import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type ClipboardEvent as ReactClipboardEvent,
	type KeyboardEvent as ReactKeyboardEvent,
	type PointerEvent as ReactPointerEvent,
	type WheelEvent as ReactWheelEvent,
} from "react";
import { Input } from "@/components/ui/input";
import { API_ENDPOINTS } from "@/lib/api-config";
import { cn } from "@/lib/utils";
import { BrowserPreviewOverlay } from "@/components/projects/shared/components/browser-preview-overlay";
import {
	ArrowLeftIcon as ArrowLeft,
	ArrowRightIcon as ArrowRight,
	ExternalLinkIcon as ExternalLink,
	PlusIcon,
	RefreshCwIcon,
	RotateCwIcon as RotateCw,
	TreePineIcon as TreePine,
	TriangleAlertIcon,
	XIcon,
} from "@/components/ui/vpk-icons";
import { Spinner } from "@/components/ui/spinner";
import type { UseBrowserWorkspaceResult } from "@/components/website/demos/utils/hooks/use-browser-workspace";
import { useBrowserPreviewSession } from "@/components/website/demos/utils/hooks/use-browser-preview-session";
import { dispatchBrowserControl, type BrowserControlCommand } from "@/components/website/demos/utils/lib/browser-control-dispatch";

type PreviewPanelTab = "browser" | "snapshot";

interface BrowserPreviewPanelProps {
	workspace: UseBrowserWorkspaceResult;
	onClose: () => void;
}

function getTabLabel(url: string, title: string) {
	if (title.trim()) {
		return title.trim();
	}

	if (!url || url === "about:blank") {
		return "New tab";
	}

	try {
		return new URL(url).hostname;
	} catch {
		return url;
	}
}

function SnapshotView({
	isLoading,
	onRefresh,
	snapshotError,
	snapshotText,
}: Readonly<{
	isLoading: boolean;
	onRefresh: () => void;
	snapshotError: string | null;
	snapshotText: string | null;
}>) {
	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden">
			<div className="flex items-center justify-between border-b border-border px-3 py-2">
				<p className="text-xs font-medium text-text">Accessibility snapshot</p>
				<button
					type="button"
					onClick={onRefresh}
					className="text-text-subtle hover:text-text hover:bg-surface-raised inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors"
					aria-label="Refresh accessibility snapshot"
				>
					<RefreshCwIcon className="size-3.5" />
				</button>
			</div>

			<div className="min-h-0 flex-1 overflow-auto p-4">
				{snapshotText ? (
					<pre className="min-h-0 overflow-auto rounded-lg border border-border bg-surface-raised p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-text">
						{snapshotText}
					</pre>
				) : snapshotError ? (
					<div className="flex h-full flex-col items-center justify-center gap-3 text-center">
						<p className="text-sm text-text-subtle">{snapshotError}</p>
						<button
							type="button"
							onClick={onRefresh}
							className="text-brand text-sm font-medium hover:underline"
						>
							Retry
						</button>
					</div>
				) : (
					<div className="flex h-full flex-col items-center justify-center gap-3 text-center">
						{isLoading ? (
							<Spinner className="size-7 text-text-subtle" />
						) : null}
						<p className="text-sm text-text-subtle">
							{isLoading
								? "Capturing accessibility tree..."
								: "No snapshot yet. Open the Snapshot tab to inspect the active browser tab."}
						</p>
					</div>
				)}
			</div>
		</div>
	);
}

function EmbeddedBrowserWorkspacePreview({
	workspace,
}: Readonly<{
	workspace: UseBrowserWorkspaceResult;
}>) {
	const {
		workspaceId,
		workspaceState,
		workspaceError,
		isWorkspaceInitializing,
		isWorkspaceMutating,
		refreshWorkspace,
		resetWorkspace,
		runWorkspaceAction,
		createWorkspaceTab,
		activateWorkspaceTab,
		closeWorkspaceTab,
	} = workspace;

	const [draftUrl, setDraftUrl] = useState("");
	const [isDraftUrlDirty, setIsDraftUrlDirty] = useState(false);
	const [containerViewportSize, setContainerViewportSize] = useState({
		width: 1280,
		height: 900,
	});
	const [displayedScreenshotSrc, setDisplayedScreenshotSrc] = useState<
		string | null
	>(null);

	const liveViewportRef = useRef<HTMLDivElement | null>(null);
	const pendingWheelRef = useRef({
		x: 0,
		y: 0,
		deltaX: 0,
		deltaY: 0,
	});
	const wheelFlushTimerRef = useRef<number | null>(null);

	const {
		liveCanvasRef,
		status: previewStatus,
		error: previewError,
		sourceMetadata,
		overlayState,
		canSendControl,
		sendControlMessage,
	} = useBrowserPreviewSession(workspaceId, {
		onMissingWorkspace: async () => {
			await resetWorkspace();
		},
	});
	const dispatchControl = useCallback((command: BrowserControlCommand) => dispatchBrowserControl(command, {
		preview: canSendControl ? sendControlMessage : null,
		workspace: runWorkspaceAction,
	}), [canSendControl, runWorkspaceAction, sendControlMessage]);
	const previousPreviewStatusRef = useRef(previewStatus);

	const currentUrl = workspaceState?.url ?? "";
	const displayedUrl = isDraftUrlDirty ? draftUrl : currentUrl;

	useEffect(() => {
		const previousPreviewStatus = previousPreviewStatusRef.current;
		previousPreviewStatusRef.current = previewStatus;
		if (!workspaceId) {
			return;
		}

		if (previewStatus === "steady" && previousPreviewStatus !== "steady") {
			void refreshWorkspace();
		}
	}, [previewStatus, refreshWorkspace, workspaceId]);

	useEffect(() => {
		const container = liveViewportRef.current;
		if (!container || typeof ResizeObserver === "undefined") {
			return;
		}

		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) {
				return;
			}

			const nextWidth = Math.max(320, Math.round(entry.contentRect.width));
			const nextHeight = Math.max(240, Math.round(entry.contentRect.height));
			setContainerViewportSize((current) => {
				if (current.width === nextWidth && current.height === nextHeight) {
					return current;
				}

				return {
					width: nextWidth,
					height: nextHeight,
				};
			});
		});

		observer.observe(container);
		return () => observer.disconnect();
	}, []);

	useLayoutEffect(() => {
		const container = liveViewportRef.current;
		if (!container) {
			return;
		}

		const rect = container.getBoundingClientRect();
		const nextWidth = Math.max(320, Math.round(rect.width));
		const nextHeight = Math.max(240, Math.round(rect.height));
		setContainerViewportSize((current) => {
			if (current.width === nextWidth && current.height === nextHeight) {
				return current;
			}

			return {
				width: nextWidth,
				height: nextHeight,
			};
		});
	}, []);

	useEffect(() => {
		return () => {
			if (wheelFlushTimerRef.current !== null) {
				window.clearTimeout(wheelFlushTimerRef.current);
			}
		};
	}, []);

	const preferredScreenshotRevision = useMemo(() => {
		if (previewStatus === "fallback") {
			return workspaceState?.updatedAt ?? null;
		}
		return null;
	}, [previewStatus, workspaceState?.updatedAt]);

	const preferredScreenshotSrc = useMemo(() => {
		if (!workspaceId || preferredScreenshotRevision === null) {
			return null;
		}

		return API_ENDPOINTS.browserWorkspaceScreenshot(
			workspaceId,
			undefined,
			undefined,
			preferredScreenshotRevision,
		);
	}, [preferredScreenshotRevision, workspaceId]);

	useEffect(() => {
		if (!preferredScreenshotSrc) {
			return;
		}

		let cancelled = false;
		const image = new window.Image();
		image.decoding = "sync";
		image.onload = () => {
			if (!cancelled) {
				setDisplayedScreenshotSrc(preferredScreenshotSrc);
			}
		};
		image.src = preferredScreenshotSrc;

		return () => {
			cancelled = true;
		};
	}, [preferredScreenshotSrc, previewStatus]);

	const handleNavigate = useCallback(async () => {
		const nextUrl = displayedUrl.trim();
		if (!nextUrl) {
			return;
		}

		const nextState = await runWorkspaceAction("navigate", { url: nextUrl });
		if (nextState) {
			setDraftUrl("");
			setIsDraftUrlDirty(false);
		}
	}, [displayedUrl, runWorkspaceAction]);

	const handleUrlKeyDown = useCallback(
		(event: ReactKeyboardEvent<HTMLInputElement>) => {
			if (event.key !== "Enter") {
				return;
			}

			event.preventDefault();
			void handleNavigate();
		},
		[handleNavigate],
	);

	const currentWorkspaceUrl = workspaceState?.url;
	const handleOpenInNewTab = useCallback(() => {
		if (!currentWorkspaceUrl || currentWorkspaceUrl === "about:blank") {
			return;
		}

		window.open(currentWorkspaceUrl, "_blank", "noopener,noreferrer");
	}, [currentWorkspaceUrl]);

	const previewGeometry = useMemo(() => {
		const sourceWidth =
			sourceMetadata?.width ??
			workspaceState?.viewportWidth ??
			containerViewportSize.width;
		const sourceHeight =
			sourceMetadata?.height ??
			workspaceState?.viewportHeight ??
			containerViewportSize.height;
		const availableWidth = containerViewportSize.width;
		const availableHeight = containerViewportSize.height;
		const scale = Math.min(
			availableWidth / Math.max(sourceWidth, 1),
			availableHeight / Math.max(sourceHeight, 1),
		);
		const renderedWidth = Math.max(1, Math.round(sourceWidth * scale));
		const renderedHeight = Math.max(1, Math.round(sourceHeight * scale));
		const offsetLeft = Math.max(
			0,
			Math.round((availableWidth - renderedWidth) / 2),
		);

		return {
			offsetTop: 0,
			sourceWidth,
			sourceHeight,
			renderedWidth,
			renderedHeight,
			offsetLeft,
		};
	}, [
		containerViewportSize.height,
		containerViewportSize.width,
		sourceMetadata?.height,
		sourceMetadata?.width,
		workspaceState?.viewportHeight,
		workspaceState?.viewportWidth,
	]);

	const renderedMediaStyle = useMemo(
		() => ({
			left: previewGeometry.offsetLeft,
			top: previewGeometry.offsetTop,
			width: previewGeometry.renderedWidth,
			height: previewGeometry.renderedHeight,
		}),
		[
			previewGeometry.offsetLeft,
			previewGeometry.offsetTop,
			previewGeometry.renderedHeight,
			previewGeometry.renderedWidth,
		],
	);

	const resolvePreviewPoint = useCallback(
		(clientX: number, clientY: number) => {
			const container = liveViewportRef.current;
			if (!container) {
				return null;
			}

			const bounds = container.getBoundingClientRect();
			const xWithinImage = clientX - bounds.left - previewGeometry.offsetLeft;
			const yWithinImage = clientY - bounds.top;

			if (
				xWithinImage < 0 ||
				yWithinImage < 0 ||
				xWithinImage > previewGeometry.renderedWidth ||
				yWithinImage > previewGeometry.renderedHeight
			) {
				return null;
			}

			const scaleX =
				previewGeometry.sourceWidth / Math.max(previewGeometry.renderedWidth, 1);
			const scaleY =
				previewGeometry.sourceHeight / Math.max(previewGeometry.renderedHeight, 1);

			return {
				x: Math.round(xWithinImage * scaleX),
				y: Math.round(yWithinImage * scaleY),
			};
		},
		[
			previewGeometry.offsetLeft,
			previewGeometry.renderedHeight,
			previewGeometry.renderedWidth,
			previewGeometry.sourceHeight,
			previewGeometry.sourceWidth,
		],
	);

	const resolvePreviewPointOrCenter = useCallback(
		(clientX: number, clientY: number) => {
			const resolvedPoint = resolvePreviewPoint(clientX, clientY);
			if (resolvedPoint) {
				return resolvedPoint;
			}

			return {
				x: Math.round(previewGeometry.sourceWidth / 2),
				y: Math.round(previewGeometry.sourceHeight / 2),
			};
		},
		[
			previewGeometry.sourceHeight,
			previewGeometry.sourceWidth,
			resolvePreviewPoint,
		],
	);

	const handleLivePointerDown = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (event.button !== 0) {
				return;
			}

			const point = resolvePreviewPoint(event.clientX, event.clientY);
			if (!point) {
				return;
			}

			event.preventDefault();
			liveViewportRef.current?.focus();
			void dispatchControl({ type: "click", x: point.x, y: point.y });
		},
		[dispatchControl, resolvePreviewPoint],
	);

	const handleLiveWheel = useCallback(
		(event: ReactWheelEvent<HTMLDivElement>) => {
			const point = resolvePreviewPointOrCenter(event.clientX, event.clientY);
			event.preventDefault();

			pendingWheelRef.current.x = point.x;
			pendingWheelRef.current.y = point.y;
			pendingWheelRef.current.deltaX += Math.round(event.deltaX);
			pendingWheelRef.current.deltaY += Math.round(event.deltaY);

			if (wheelFlushTimerRef.current !== null) {
				return;
			}

			wheelFlushTimerRef.current = window.setTimeout(() => {
				wheelFlushTimerRef.current = null;
				const nextWheel = pendingWheelRef.current;
				pendingWheelRef.current = {
					x: nextWheel.x,
					y: nextWheel.y,
					deltaX: 0,
					deltaY: 0,
				};

				if (!nextWheel.deltaX && !nextWheel.deltaY) {
					return;
				}

				void dispatchControl({ type: "wheel", ...nextWheel });
			}, 40);
		},
		[dispatchControl, resolvePreviewPointOrCenter],
	);

	const handleLiveKeyDown = useCallback(
		(event: ReactKeyboardEvent<HTMLDivElement>) => {
			event.preventDefault();
			void dispatchControl({
				type: "key", key: event.key, code: event.code,
				ctrlKey: event.ctrlKey, metaKey: event.metaKey, altKey: event.altKey, shiftKey: event.shiftKey,
			});
		},
		[dispatchControl],
	);

	const handlePaste = useCallback(
		(event: ReactClipboardEvent<HTMLDivElement>) => {
			const pastedText = event.clipboardData?.getData("text/plain");
			if (!pastedText) {
				return;
			}

			event.preventDefault();
			void dispatchControl({ type: "paste", text: pastedText });
		},
		[dispatchControl],
	);

	const activeTab = workspaceState?.tabs.find((tab) => tab.active) ?? null;
	const combinedPreviewError = workspaceError ?? previewError;
	const isBusy =
		isWorkspaceInitializing ||
		isWorkspaceMutating ||
		previewStatus === "connecting";
	const showFallbackScreenshot =
		previewStatus === "fallback" && Boolean(displayedScreenshotSrc);

	return (
		<div className="flex h-full min-h-0 w-full min-w-0 flex-col">
			<div className="flex items-center gap-2 border-b border-border px-2 py-2">
				<div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
					{workspaceState?.tabs.map((tab) => (
						<div
							key={`${workspaceId ?? "workspace"}-${tab.index}`}
							className={cn(
								"flex max-w-[180px] shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
								tab.active
									? "border-border bg-background text-text shadow-sm"
									: "border-transparent bg-surface-raised text-text-subtle hover:bg-surface-raised-hovered hover:text-text",
							)}
						>
							<button
								type="button"
								onClick={() => void activateWorkspaceTab(tab.index)}
								className="truncate text-left"
								title={tab.title || tab.url || `Tab ${tab.index + 1}`}
							>
								{getTabLabel(tab.url, tab.title)}
							</button>
							{(workspaceState?.tabs.length ?? 0) > 1 ? (
								<button
									type="button"
									onClick={(event) => {
										event.stopPropagation();
										void closeWorkspaceTab(tab.index);
									}}
									className="text-text-subtle hover:text-text inline-flex h-4 w-4 items-center justify-center rounded-sm"
									aria-label={`Close ${getTabLabel(tab.url, tab.title)}`}
								>
									<XIcon className="size-3" />
								</button>
							) : null}
						</div>
					))}
				</div>

				<button
					type="button"
					onClick={() => void createWorkspaceTab()}
					className="text-text-subtle hover:text-text hover:bg-surface-raised inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors"
					aria-label="Create browser tab"
				>
					<PlusIcon className="size-4" />
				</button>
			</div>

			<div className="flex items-center gap-1 border-b border-border p-2">
				<button
					type="button"
					onClick={() => void runWorkspaceAction("back")}
					disabled={!workspaceState?.canGoBack}
					className="text-text-subtle hover:text-text hover:bg-surface-raised disabled:text-text-subtlest inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:pointer-events-none"
					aria-label="Back"
				>
					<ArrowLeft className="size-4" />
				</button>
				<button
					type="button"
					onClick={() => void runWorkspaceAction("forward")}
					disabled={!workspaceState?.canGoForward}
					className="text-text-subtle hover:text-text hover:bg-surface-raised disabled:text-text-subtlest inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:pointer-events-none"
					aria-label="Forward"
				>
					<ArrowRight className="size-4" />
				</button>
				<button
					type="button"
					onClick={() => void runWorkspaceAction("reload")}
					className="text-text-subtle hover:text-text hover:bg-surface-raised inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors"
					aria-label="Reload"
				>
					<RotateCw className="size-4" />
				</button>
					<Input
						className="h-8 flex-1 text-sm"
						value={displayedUrl}
						onChange={(event) => {
							setDraftUrl(event.target.value);
							setIsDraftUrlDirty(true);
						}}
						onKeyDown={handleUrlKeyDown}
						placeholder="Enter URL..."
						aria-label="Enter URL"
				/>
				<button
					type="button"
					onClick={handleOpenInNewTab}
					className="text-text-subtle hover:text-text hover:bg-surface-raised inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors"
					aria-label="Open in browser tab"
				>
					<ExternalLink className="size-4" />
				</button>
			</div>

			<div
				ref={liveViewportRef}
				className="relative min-h-0 flex-1 overflow-hidden bg-surface-raised/40 outline-none"
				role="application"
				aria-label={workspaceState?.title || "Browser preview"}
				tabIndex={0}
				onPointerDown={handleLivePointerDown}
				onWheel={handleLiveWheel}
				onKeyDown={handleLiveKeyDown}
				onPaste={handlePaste}
			>
					<canvas
						ref={liveCanvasRef}
						className={cn(
							"pointer-events-none absolute block select-none",
							previewStatus === "fallback" && "hidden",
						)}
						aria-label={workspaceState?.title || "Live browser preview"}
						role="img"
						style={renderedMediaStyle}
					/>

				{displayedScreenshotSrc && showFallbackScreenshot ? (
					/* eslint-disable-next-line @next/next/no-img-element */
					<img
						key={displayedScreenshotSrc}
						src={displayedScreenshotSrc}
						alt={workspaceState?.title || "Browser preview"}
						decoding="sync"
						loading="eager"
						className="pointer-events-none absolute block select-none"
						style={renderedMediaStyle}
					/>
				) : null}

				{!displayedScreenshotSrc &&
				(previewStatus === "fallback" || previewStatus === "connecting") ? (
					<div className="text-text-subtle flex size-full flex-col items-center justify-center gap-3 text-sm">
						{isWorkspaceInitializing || previewStatus === "connecting" ? (
							<Spinner className="size-7" />
						) : null}
						<p>
							{isWorkspaceInitializing
								? "Launching browser workspace..."
								: previewStatus === "connecting"
									? "Connecting live browser preview..."
									: "Browser preview fell back to screenshot mode."}
						</p>
					</div>
				) : null}

				{isBusy ? (
					<div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/20 backdrop-blur-[1px]">
						<Spinner className="size-7 text-text-subtle" />
					</div>
				) : null}

				<BrowserPreviewOverlay
					geometry={previewGeometry}
					overlayState={overlayState}
				/>

				{combinedPreviewError ? (
					<div className="absolute inset-x-4 bottom-4 flex items-start gap-3 rounded-lg border border-border bg-background/90 p-3 shadow-sm">
						<TriangleAlertIcon className="text-text-warning mt-0.5 size-4 shrink-0" />
						<div className="min-w-0">
							<p className="text-text text-sm font-medium">
								Browser preview unavailable
							</p>
							<p className="text-text-subtle mt-1 text-xs">
								{combinedPreviewError}
							</p>
						</div>
					</div>
				) : null}

				{!combinedPreviewError && activeTab ? (
					<div className="pointer-events-none absolute right-3 bottom-3 rounded-md bg-background/85 px-2 py-1 text-[11px] text-text-subtle shadow-sm">
						{getTabLabel(activeTab.url, activeTab.title)}
					</div>
				) : null}
			</div>
		</div>
	);
}

export function BrowserPreviewPanel({
	workspace,
	onClose,
}: Readonly<BrowserPreviewPanelProps>) {
	const { fetchWorkspaceSnapshot, workspaceId, workspaceState } = workspace;
	const [activePanelTab, setActivePanelTab] = useState<PreviewPanelTab>("browser");
	const [snapshotText, setSnapshotText] = useState<string | null>(null);
	const [snapshotError, setSnapshotError] = useState<string | null>(null);
	const [isSnapshotLoading, setIsSnapshotLoading] = useState(false);

	const loadSnapshot = useCallback(async () => {
		setIsSnapshotLoading(true);
		setSnapshotError(null);

		try {
			const snapshot = await fetchWorkspaceSnapshot(true);
			setSnapshotText(snapshot?.snapshot ?? null);
		} catch (error) {
			setSnapshotError(
				error instanceof Error
					? error.message
					: "Failed to capture browser snapshot.",
			);
		} finally {
			setIsSnapshotLoading(false);
		}
	}, [fetchWorkspaceSnapshot]);

	useEffect(() => {
		if (activePanelTab !== "snapshot") {
			return;
		}

		void loadSnapshot();
	}, [
		activePanelTab,
		loadSnapshot,
		workspaceId,
		workspaceState?.activeTabIndex,
		workspaceState?.updatedAt,
	]);

	return (
		<div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-background">
			<div className="flex items-center justify-between border-b border-border px-2 py-1.5">
				<div className="flex gap-1">
					{(["browser", "snapshot"] as const).map((tab) => (
						<button
							key={tab}
							type="button"
							onClick={() => setActivePanelTab(tab)}
							className={cn(
								"rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
								activePanelTab === tab
									? "bg-surface-raised text-text shadow-sm"
									: "text-text-subtle hover:bg-surface-raised hover:text-text",
							)}
						>
							{tab === "snapshot" ? (
								<span className="flex items-center gap-1">
									<TreePine className="size-3" />
									Snapshot
								</span>
							) : (
								tab
							)}
						</button>
					))}
				</div>

				<button
					type="button"
					onClick={onClose}
					className="text-text-subtle hover:text-text hover:bg-surface-raised inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors"
					aria-label="Close browser preview"
				>
					<XIcon className="size-4" />
				</button>
			</div>

			<div className="min-h-0 flex-1 overflow-hidden">
				{activePanelTab === "browser" ? (
					<EmbeddedBrowserWorkspacePreview
						key={workspace.workspaceId ?? "browser-workspace-preview"}
						workspace={workspace}
					/>
				) : (
					<SnapshotView
						isLoading={isSnapshotLoading}
						onRefresh={() => void loadSnapshot()}
						snapshotError={snapshotError}
						snapshotText={snapshotText}
					/>
				)}
			</div>
		</div>
	);
}
