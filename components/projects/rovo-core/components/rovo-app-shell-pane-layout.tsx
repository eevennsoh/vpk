"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
	ROVO_APP_MAX_CHAT_PANE_WIDTH,
	ROVO_APP_MIN_ARTIFACT_PANE_WIDTH,
	ROVO_APP_MIN_CHAT_PANE_WIDTH,
	getRovoAppShellLayout,
} from "@/components/projects/rovo-core/lib/rovo-app-shell-layout";
import { useLazyRef } from "@/lib/use-lazy-ref";
import { clamp } from "@/lib/utils";

const ARTIFACT_PANEL_ID = "rovo-app-artifact-pane";
const CHAT_PANEL_ID = "rovo-app-chat-pane";
const paneLayoutState = Symbol("RovoAppShellPanePresentation");

interface ShellSize {
	height: number;
	width: number;
}

interface ArtifactOrigin extends ShellSize {
	left: number;
	top: number;
}

interface PaneLayoutState {
	artifactOrigin: ArtifactOrigin;
	onArtifactSplitLayoutChanged: (layout: Record<string, number>) => void;
	shellSize: ShellSize;
	splitArtifactPaneDefaultSize: number;
	splitChatPaneDefaultSize: number;
	splitChatPaneMaxSize: number;
}

export interface RovoAppShellPanePresentation {
	shouldSplitArtifactPane: boolean;
	registerArtifactCard: (documentId: string, element: HTMLElement) => void;
	prepareArtifactOpen: (element: HTMLElement) => void;
	[paneLayoutState]: PaneLayoutState;
}

interface PanePresentationOptions {
	artifact: {
		isOpen: boolean;
		documentId: string | null;
	};
	composerRef: RefObject<HTMLDivElement | null>;
	priorityActive?: boolean;
	shellRef: RefObject<HTMLDivElement | null>;
	shellSize: ShellSize;
}

export function useRovoAppShellSize(shellRef: RefObject<HTMLDivElement | null>): ShellSize {
	const [shellSize, setShellSize] = useState<ShellSize>({ width: 0, height: 0 });

	useEffect(() => {
		const shellElement = shellRef.current;
		if (!shellElement || typeof ResizeObserver === "undefined") {
			return;
		}

		const updateBounds = () => {
			const width = shellElement.clientWidth;
			const height = shellElement.clientHeight;
			setShellSize((previous) => (
				previous.width === width && previous.height === height ? previous : { width, height }
			));
		};

		updateBounds();
		const observer = new ResizeObserver(updateBounds);
		observer.observe(shellElement);
		return () => observer.disconnect();
	}, [shellRef]);

	return shellSize;
}

function measureRelativeOrigin(shellElement: HTMLElement | null, element: HTMLElement): ArtifactOrigin | null {
	if (!shellElement) {
		return null;
	}
	const shellRect = shellElement.getBoundingClientRect();
	const elementRect = element.getBoundingClientRect();
	return {
		left: elementRect.left - shellRect.left,
		top: elementRect.top - shellRect.top,
		width: elementRect.width,
		height: elementRect.height,
	};
}

function clampCardOrigin(origin: ArtifactOrigin, maxHeight: number): ArtifactOrigin {
	return {
		left: Math.max(origin.left, 16),
		top: Math.max(origin.top, 16),
		width: clamp(origin.width, 260, 420),
		height: clamp(origin.height, 40, maxHeight),
	};
}

export function useRovoAppShellPanePresentation({
	artifact: { isOpen, documentId },
	composerRef,
	priorityActive = false,
	shellRef,
	shellSize,
}: Readonly<PanePresentationOptions>): RovoAppShellPanePresentation {
	const clickedOriginRef = useRef<ArtifactOrigin | null>(null);
	const previewOriginsRef = useLazyRef<Map<string, ArtifactOrigin>>(() => new Map());
	const [artifactOrigin, setArtifactOrigin] = useState<ArtifactOrigin>({
		left: 0,
		top: 0,
		width: 320,
		height: 96,
	});
	const [rememberedChatPaneWidth, setRememberedChatPaneWidth] = useState<number | null>(null);
	const artifactLayout = getRovoAppShellLayout(shellSize.width);
	const shouldSplitArtifactPane = !priorityActive && isOpen && artifactLayout.mode === "split";
	const hasSplitOccupancy = (priorityActive || isOpen) && artifactLayout.mode === "split";
	const sizingKey = `${shellSize.width}:${priorityActive ? "priority" : isOpen ? "artifact" : "chat"}`;
	const [splitDefaults, setSplitDefaults] = useState({
		key: sizingKey,
		chatPaneWidth: rememberedChatPaneWidth,
	});
	// Resize memory applies at the next presentation/width transition. Live defaults
	// stay fixed so the separator's double-click reset retains its opening target.
	if (splitDefaults.key !== sizingKey) {
		setSplitDefaults({ key: sizingKey, chatPaneWidth: rememberedChatPaneWidth });
	}
	const defaultChatPaneWidth = splitDefaults.key === sizingKey
		? splitDefaults.chatPaneWidth
		: rememberedChatPaneWidth;
	const splitChatPaneMaxSize = hasSplitOccupancy
		? Math.min(ROVO_APP_MAX_CHAT_PANE_WIDTH, Math.max(ROVO_APP_MIN_CHAT_PANE_WIDTH, shellSize.width - ROVO_APP_MIN_ARTIFACT_PANE_WIDTH))
		: ROVO_APP_MAX_CHAT_PANE_WIDTH;
	const splitChatPaneDefaultSize = hasSplitOccupancy
		? clamp(defaultChatPaneWidth ?? artifactLayout.chatPaneWidth ?? ROVO_APP_MIN_CHAT_PANE_WIDTH, ROVO_APP_MIN_CHAT_PANE_WIDTH, splitChatPaneMaxSize)
		: ROVO_APP_MIN_CHAT_PANE_WIDTH;
	const splitArtifactPaneDefaultSize = hasSplitOccupancy
		? Math.max(ROVO_APP_MIN_ARTIFACT_PANE_WIDTH, shellSize.width - splitChatPaneDefaultSize)
		: ROVO_APP_MIN_ARTIFACT_PANE_WIDTH;

	const prepareArtifactOpen = useCallback((element: HTMLElement) => {
		const origin = measureRelativeOrigin(shellRef.current, element);
		if (origin) {
			clickedOriginRef.current = origin;
		}
	}, [shellRef]);

	const registerArtifactCard = useCallback((id: string, element: HTMLElement) => {
		const origin = measureRelativeOrigin(shellRef.current, element);
		if (origin) {
			previewOriginsRef.current.set(id, origin);
		}
	}, [previewOriginsRef, shellRef]);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		const clickedOrigin = clickedOriginRef.current;
		if (clickedOrigin) {
			clickedOriginRef.current = null;
			setArtifactOrigin(clampCardOrigin(clickedOrigin, 140));
			return;
		}

		const previewOrigin = documentId ? previewOriginsRef.current.get(documentId) : null;
		if (previewOrigin) {
			setArtifactOrigin(clampCardOrigin(previewOrigin, 220));
			return;
		}

		const composerElement = composerRef.current;
		if (!composerElement) {
			return;
		}
		const composerOrigin = measureRelativeOrigin(shellRef.current, composerElement);
		if (composerOrigin) {
			setArtifactOrigin({
				left: Math.max(composerOrigin.left + 28, 16),
				top: Math.max(composerOrigin.top + 8, 16),
				width: clamp(composerOrigin.width - 56, 260, 420),
				height: clamp(composerOrigin.height, 72, 140),
			});
		}
	}, [composerRef, documentId, isOpen, previewOriginsRef, shellRef]);

	const onArtifactSplitLayoutChanged = useCallback((layout: Record<string, number>) => {
		const percentage = layout[CHAT_PANEL_ID];
		// The chat-only group's 100% layout is not a remembered artifact split.
		if (!shouldSplitArtifactPane || !Number.isFinite(percentage) || shellSize.width <= 0) {
			return;
		}
		setRememberedChatPaneWidth(Math.round((shellSize.width * percentage) / 100));
	}, [shellSize.width, shouldSplitArtifactPane]);

	return {
		shouldSplitArtifactPane,
		registerArtifactCard,
		prepareArtifactOpen,
		[paneLayoutState]: {
			artifactOrigin,
			onArtifactSplitLayoutChanged,
			shellSize,
			splitArtifactPaneDefaultSize,
			splitChatPaneDefaultSize,
			splitChatPaneMaxSize,
		},
	};
}

export interface RovoAppShellPaneLayoutCoreProps {
	artifactPane: ReactNode;
	chatPane: ReactNode;
	presentation: RovoAppShellPanePresentation;
	priorityPane?: ReactNode;
}

export function RovoAppShellPaneLayoutCore({
	artifactPane,
	chatPane,
	presentation,
	priorityPane,
}: Readonly<RovoAppShellPaneLayoutCoreProps>) {
	const { shouldSplitArtifactPane } = presentation;
	const {
		artifactOrigin,
		onArtifactSplitLayoutChanged,
		shellSize,
		splitArtifactPaneDefaultSize,
		splitChatPaneDefaultSize,
		splitChatPaneMaxSize,
	} = presentation[paneLayoutState];
	if (priorityPane) {
		return (
			<div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">
				{priorityPane}
			</div>
		);
	}

	return (
		<>
			<ResizablePanelGroup
				className="h-full min-h-0 min-w-0 w-full overflow-visible"
				orientation="horizontal"
				onLayoutChanged={onArtifactSplitLayoutChanged}
				resizeTargetMinimumSize={{ coarse: 36, fine: 16 }}
			>
				{shouldSplitArtifactPane && artifactPane ? (
					<>
						<ResizablePanel
							className="min-h-0"
							defaultSize={splitArtifactPaneDefaultSize}
							id={ARTIFACT_PANEL_ID}
							minSize={ROVO_APP_MIN_ARTIFACT_PANE_WIDTH}
						>
							<div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background">
								{artifactPane}
							</div>
						</ResizablePanel>
						<ResizableHandle className="z-20" withHandle />
					</>
				) : null}

				<ResizablePanel
					className="min-h-0"
					defaultSize={shouldSplitArtifactPane ? splitChatPaneDefaultSize : undefined}
					groupResizeBehavior={
						shouldSplitArtifactPane ? "preserve-pixel-size" : undefined
					}
					id={CHAT_PANEL_ID}
					maxSize={shouldSplitArtifactPane ? splitChatPaneMaxSize : undefined}
					minSize={shouldSplitArtifactPane ? ROVO_APP_MIN_CHAT_PANE_WIDTH : undefined}
					style={{ overflow: "visible" }}
				>
					{chatPane}
				</ResizablePanel>
			</ResizablePanelGroup>

			<AnimatePresence>
				{!shouldSplitArtifactPane && artifactPane ? (
					<motion.div
						animate={{
							opacity: 1,
							x: 0,
							y: 0,
							scaleX: 1,
							scaleY: 1,
							borderRadius: 0,
							transition: {
								delay: 0,
								type: "spring",
								stiffness: 300,
								damping: 30,
							},
						}}
						className="absolute top-0 left-0 z-40 flex h-full flex-col overflow-hidden border-border bg-background md:border-l"
						exit={{
							opacity: 0,
							scale: 0.5,
							transition: {
								delay: 0.1,
								type: "spring",
								stiffness: 600,
								damping: 30,
							},
						}}
						initial={{
							opacity: 1,
							x: artifactOrigin.left,
							y: artifactOrigin.top,
							scaleX: shellSize.width > 0 ? artifactOrigin.width / shellSize.width : 1,
							scaleY: shellSize.height > 0 ? artifactOrigin.height / shellSize.height : 1,
							borderRadius: 32,
						}}
						style={{
							height: shellSize.height || "100%",
							transformOrigin: "top left",
							width: shellSize.width || "100%",
							willChange: "transform, opacity",
						}}
					>
						{artifactPane}
					</motion.div>
				) : null}
			</AnimatePresence>
		</>
	);
}
