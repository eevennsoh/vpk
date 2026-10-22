"use client";

// oxlint-disable react-doctor/exhaustive-deps -- Effects in this file intentionally coordinate refs, external animation loops, timers, subscriptions, or measured DOM state; dependencies are constrained to avoid restarting those bridges.
// oxlint-disable react-doctor/no-chain-state-updates -- Related state fields are updated together to preserve atomic UI transitions and avoid partial interaction states.
// oxlint-disable react-doctor/no-derived-state -- These components maintain local derived display state for controlled animations, measurements, or draft editing that cannot be represented as render-only values without changing UX.
// oxlint-disable react-doctor/no-event-handler -- Effects in this file bridge external systems, animation/media state, timers, or parent-controlled state rather than user event handlers.
// oxlint-disable react-doctor/only-export-components -- This module intentionally exports colocated component API, variant contracts, context contracts, or metadata used by consumers.
// oxlint-disable react-doctor/prefer-module-scope-static-value -- These values are intentionally colocated with the component/demo contract for readability and token context.
// oxlint-disable react-doctor/prefer-tag-over-role -- This file uses ARIA roles for custom generated visuals or composite widgets where the suggested native tag would change semantics or behavior.

/* eslint-disable react-hooks/exhaustive-deps -- These callbacks/effects intentionally read stable refs that bridge external animation, drag, preview, and editor state. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValue, useMotionValueEvent, useReducedMotion, useSpring } from "motion/react";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import CopyIcon from "@atlaskit/icon/core/copy";
import CrossIcon from "@atlaskit/icon/core/cross";
import LinkExternalIcon from "@atlaskit/icon/core/link-external";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { useTheme } from "@/components/utils/theme-wrapper";
import Graph from "@/components/website/demos/visual/graph";
import { ROVO_GRAPH_DEFAULT_PARAMS } from "@/components/website/demos/visual/graph-defaults";
import { cn } from "@/lib/utils";
import { useGraphSource } from "./hooks/use-graph-source";
import { usePersonalGraphIntro } from "./hooks/use-personal-graph-intro";
import { useTwgChat } from "./hooks/use-twg-chat";
import { useVaultExplorer } from "./hooks/use-vault-explorer";
import { useVaultSettings } from "./hooks/use-vault-settings";
import { DEFAULT_NEURAL_GRAPH_INTERACTION_SETTINGS } from "./lib/neural-graph/interaction-dynamics";
import { DEFAULT_NEURAL_RAY_SOUND_SETTINGS } from "./lib/neural-graph/ray-sound";
import { useLazyRef } from "@/lib/use-lazy-ref";
import {
	RESPONSIVE_PERSONAL_GRAPH_WIDTHS,
	areResponsivePersonalGraphParamsEqual,
	getResponsivePersonalGraphParams,
	shouldAnimateResponsivePersonalGraphParams,
	type ResponsivePersonalGraphViewport,
} from "./lib/neural-graph/responsive-params";
import { createNeuralGraphStore } from "./lib/neural-graph/store";
import { expandTwgNode } from "./lib/personal-graph-api";
import { mergeSelectedNodeExpansion } from "./lib/personal-graph-explorer-merge";
import {
	getPersonalGraphLabelStrategy,
	getPersonalGraphParamsForVisualMode,
	getPersonalGraphVisualMode,
	isAutomationWorkflowExplorer,
} from "./lib/personal-graph-visual-mode";
import {
	usePersonalGraphModeTransition,
	type PersonalGraphModeTransitionSnapshot,
} from "./lib/use-personal-graph-mode-transition";
import type { NeuralGraphParams } from "./lib/neural-graph/params";
import type { VaultExplorer, VaultNode } from "./lib/personal-graph-types";
import { PersonalGraphBackdrop } from "./personal-graph-backdrop";
import type { PersonalGraphControlFlyoutAction } from "./personal-graph-control-flyout";
import { PersonalGraphDropzone } from "./personal-graph-dropzone";
import {
	PersonalGraphGlassPanel,
	PersonalGraphLiquidGlassIconButton,
	PersonalGraphLiquidGlassStageProvider,
} from "./personal-graph-glass-panel";
import { PersonalGraphIngestButton } from "./personal-graph-ingest-button";
import { PersonalGraphLog } from "./personal-graph-log";
import {
	PixelDarkIcon,
	PixelIngestIcon,
	PixelLightIcon,
	PixelRefreshIcon,
	PixelResetIcon,
	PixelSystemIcon,
} from "./personal-graph-pixel-icons";
import { PersonalGraphSearch } from "./personal-graph-search";
import { PersonalGraphSourcePicker } from "./personal-graph-source-picker";
import { PersonalGraphSummaryPanel } from "./personal-graph-summary-panel";
import { PersonalGraphTitle } from "./personal-graph-title-scramble";
import { PersonalGraphTwgAuthError } from "./personal-graph-twg-auth-error";
import {
	getGraphStatsText,
	getRelatedNodes,
	getSelectedNode,
	getTwgGraphStatsText,
	isTwgAuthRequiredError,
} from "./personal-graph-surface-data";
import { GraphNodeMarker } from "./personal-graph-surface-helpers";

type PersonalGraphSurfaceProps = React.ComponentProps<"main">;

const PERSONAL_GRAPH_TITLE_FONT_STYLE = {
	fontFamily: "var(--font-affigere), Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif",
	fontWeight: 400,
} satisfies React.CSSProperties;

const PERSONAL_GRAPH_META_FONT_STYLE = {
	fontFamily: "var(--font-departure-mono), 'Courier New', monospace",
} satisfies React.CSSProperties;

const PERSONAL_GRAPH_SETTLED_TITLE_SCRAMBLE_LINE_CHAR_COUNT = 8;
const PERSONAL_GRAPH_TITLE_LINE_COUNT = 2;
const PERSONAL_GRAPH_TITLE_LINE_HEIGHT = 0.8;
const PERSONAL_GRAPH_HEADER_INITIAL_Y = "35svh";
const PERSONAL_GRAPH_HEADER_SETTLED_Y = "0px";
const PERSONAL_GRAPH_TITLE_INK_TOP_PADDING = "0px";
const PERSONAL_GRAPH_SETTLED_TITLE_SIZE =
	`min(3rem, calc((100cqw - 1rem) / ${PERSONAL_GRAPH_SETTLED_TITLE_SCRAMBLE_LINE_CHAR_COUNT}))`;
const PERSONAL_GRAPH_INITIAL_TITLE_SCALE = 2.4;
const PERSONAL_GRAPH_SETTLED_TITLE_RESERVED_HEIGHT =
	`calc(${PERSONAL_GRAPH_SETTLED_TITLE_SIZE} * ${PERSONAL_GRAPH_TITLE_LINE_HEIGHT} * ${PERSONAL_GRAPH_TITLE_LINE_COUNT})`;
const PERSONAL_GRAPH_INITIAL_TITLE_RESERVED_HEIGHT =
	`calc(${PERSONAL_GRAPH_SETTLED_TITLE_SIZE} * ${PERSONAL_GRAPH_TITLE_LINE_HEIGHT} * ${PERSONAL_GRAPH_TITLE_LINE_COUNT} * ${PERSONAL_GRAPH_INITIAL_TITLE_SCALE})`;
const PERSONAL_GRAPH_HEADER_SETTLE_DURATION_SECONDS = 0.7;
const PERSONAL_GRAPH_BYLINE_REVEAL_DELAY_SECONDS = 0.4;
const PERSONAL_GRAPH_PROMPT_INPUT_BOTTOM_PX = 24;
const PERSONAL_GRAPH_PROMPT_INPUT_HEIGHT_PX = 64;
const PERSONAL_GRAPH_TAIL_PROMPT_GAP_PX = 8;
const PERSONAL_GRAPH_TAIL_MARKER_SIZE_PX = ROVO_GRAPH_DEFAULT_PARAMS.originMarkerSize;
const PERSONAL_GRAPH_STAGE_TRANSLATE_Y_PX = -10;
const PERSONAL_GRAPH_RAY_TAIL_BOTTOM_OFFSET_PX =
	PERSONAL_GRAPH_PROMPT_INPUT_BOTTOM_PX +
	PERSONAL_GRAPH_PROMPT_INPUT_HEIGHT_PX +
	PERSONAL_GRAPH_TAIL_PROMPT_GAP_PX +
	PERSONAL_GRAPH_TAIL_MARKER_SIZE_PX / 2 +
	PERSONAL_GRAPH_STAGE_TRANSLATE_Y_PX;
const PERSONAL_GRAPH_RESPONSIVE_PARAMS_SPRING = {
	damping: 28,
	mass: 0.7,
	restDelta: 0.5,
	stiffness: 150,
} as const;
const PERSONAL_GRAPH_RESPONSIVE_PARAMS_INSTANT = {
	damping: 200,
	mass: 0.05,
	restDelta: 0.5,
	stiffness: 4000,
} as const;
const PERSONAL_GRAPH_RESPONSIVE_INITIAL_VIEWPORT = {
	height: 720,
	width: RESPONSIVE_PERSONAL_GRAPH_WIDTHS.wide,
} satisfies ResponsivePersonalGraphViewport;
const PERSONAL_GRAPH_RESET_FLYOUT_COLLAPSE_DELAY_MS = 420;
const PERSONAL_GRAPH_UNCONFIGURED_BYLINE = "Select a folder to get started.";
const PERSONAL_GRAPH_DEFAULT_TWG_WORK_WINDOW = "7d";

function useResponsivePersonalGraphParams(stageRef: React.RefObject<HTMLDivElement | null>) {
	const reduceMotion = Boolean(useReducedMotion());
	const targetWidthMV = useMotionValue<number>(PERSONAL_GRAPH_RESPONSIVE_INITIAL_VIEWPORT.width);
	const smoothWidthMV = useSpring(
		targetWidthMV,
		reduceMotion ? PERSONAL_GRAPH_RESPONSIVE_PARAMS_INSTANT : PERSONAL_GRAPH_RESPONSIVE_PARAMS_SPRING,
	);
	const didMeasureViewportRef = useRef(false);
	const viewportRef = useRef<ResponsivePersonalGraphViewport>(PERSONAL_GRAPH_RESPONSIVE_INITIAL_VIEWPORT);
	const [viewport, setViewport] = useState<ResponsivePersonalGraphViewport>(PERSONAL_GRAPH_RESPONSIVE_INITIAL_VIEWPORT);
	const [params, setParams] = useState<NeuralGraphParams>(() =>
		getResponsivePersonalGraphParams(PERSONAL_GRAPH_RESPONSIVE_INITIAL_VIEWPORT, ROVO_GRAPH_DEFAULT_PARAMS),
	);
	const setResponsiveParamsForViewport = useCallback((nextViewport: ResponsivePersonalGraphViewport) => {
		setParams((currentParams) => {
			const nextParams = getResponsivePersonalGraphParams(nextViewport, ROVO_GRAPH_DEFAULT_PARAMS);
			return areResponsivePersonalGraphParamsEqual(currentParams, nextParams) ? currentParams : nextParams;
		});
	}, []);

	useEffect(() => {
		const stageElement = stageRef.current;
		if (!stageElement) {
			return;
		}

		function updateViewport() {
			const currentStageElement = stageRef.current;
			if (!currentStageElement) {
				return;
			}

			const rect = currentStageElement.getBoundingClientRect();
			const nextViewport = {
				height: Math.max(1, rect.height),
				width: Math.max(1, rect.width),
			} satisfies ResponsivePersonalGraphViewport;

			setViewport((currentViewport) => {
				if (
					Math.abs(currentViewport.height - nextViewport.height) < 1 &&
					Math.abs(currentViewport.width - nextViewport.width) < 1
				) {
					return currentViewport;
				}

				return nextViewport;
			});
		}

		updateViewport();
		if (typeof ResizeObserver === "undefined") {
			window.addEventListener("resize", updateViewport);
			return () => {
				window.removeEventListener("resize", updateViewport);
			};
		}

		const resizeObserver = new ResizeObserver(updateViewport);
		resizeObserver.observe(stageElement);
		return () => resizeObserver.disconnect();
	}, [stageRef]);

	useMotionValueEvent(smoothWidthMV, "change", (width) => {
			setResponsiveParamsForViewport({ ...viewportRef.current, width });
	});

	useEffect(() => {
		viewportRef.current = viewport;
		const shouldAnimateParams = shouldAnimateResponsivePersonalGraphParams({
			hasMeasuredViewport: didMeasureViewportRef.current,
			prefersReducedMotion: reduceMotion,
		});

		if (!shouldAnimateParams) {
			targetWidthMV.jump(viewport.width);
			smoothWidthMV.jump(viewport.width);
			setResponsiveParamsForViewport(viewport);
			didMeasureViewportRef.current = true;
			return;
		}

		targetWidthMV.set(viewport.width);
	}, [reduceMotion, setResponsiveParamsForViewport, smoothWidthMV, targetWidthMV, viewport]);

	return params;
}

function PersonalGraphInspector({
	explorer,
	isExpanding = false,
	node,
	onClose,
	onSelectNode,
}: Readonly<{
	explorer: VaultExplorer | null;
	isExpanding?: boolean;
	node: VaultNode | null;
	onClose: () => void;
	onSelectNode: (nodeId: string) => void;
}>) {
	if (!node) return null;
	const relatedNodes = getRelatedNodes(explorer, node);
	const showRelatedSection = isExpanding || relatedNodes.length > 0;

	return (
		<aside
			aria-label="Knowledge Graph details"
			className="absolute right-6 top-[320px] z-30 hidden w-[min(340px,calc(100vw-48px))] text-text lg:block xl:top-[112px]"
		>
			<PersonalGraphGlassPanel contentClassName="p-4" radius={24}>
				<div className="mb-5 flex items-start justify-between gap-4">
					<h2 className="text-base font-semibold leading-5">{node.title}</h2>
					<Button
						aria-label="Close graph details"
						className="size-8 rounded-full bg-bg-neutral-subtle text-text shadow-none hover:bg-bg-neutral-subtle-hovered"
						onClick={onClose}
						size="icon"
						variant="ghost"
					>
						<CrossIcon label="" />
					</Button>
				</div>
				<div className="border-b border-border pb-4">
					<div className="mb-3 text-xs font-medium text-text-subtlest">Kind</div>
					<div className="flex items-center gap-3 text-sm">
						<GraphNodeMarker kind={node.kind} />
						<span>{node.kind.replace("_", " ")}</span>
					</div>
				</div>
				<div className="border-b border-border py-4">
					<div className="mb-3 text-xs font-medium text-text-subtlest">Links</div>
					<div className="flex items-center justify-between text-sm">
						<span>{node.connectionCount}</span>
						<ChevronRightIcon label="" />
					</div>
				</div>
				<div className="border-b border-border py-4">
					<div className="mb-2 text-xs font-medium text-text-subtlest">Excerpt</div>
					<p className="text-sm leading-6 text-text-subtle">{node.bodyPreview || node.relativePath}</p>
				</div>
				{showRelatedSection ? (
					<div className="py-4">
						<div className="mb-3 text-xs font-medium text-text-subtlest">Related pages</div>
						{isExpanding ? (
							<div
								aria-live="polite"
								className="mb-2 flex items-center gap-2 text-xs text-text-subtle"
								data-personal-graph-related-loading="true"
								role="status"
							>
								<Spinner label="Expanding related pages" size="xs" />
								<span>Expanding…</span>
							</div>
						) : null}
						{relatedNodes.length > 0 ? (
							<div className="space-y-2">
								{relatedNodes.map((relatedNode) => (
									<button
										className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-bg-neutral-subtle px-3 py-3 text-left text-sm text-text transition-colors duration-normal hover:bg-bg-neutral-subtle-hovered"
										key={relatedNode.id}
										onClick={() => onSelectNode(relatedNode.id)}
										type="button"
									>
										<span className="flex min-w-0 items-center gap-3">
											<GraphNodeMarker kind={relatedNode.kind} />
											<span className="truncate">{relatedNode.title}</span>
										</span>
										<ChevronRightIcon label="" />
									</button>
								))}
							</div>
						) : null}
					</div>
				) : null}
				<div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-4">
					<div className="flex gap-2">
						<Button
							aria-label="Copy node title"
							className="size-8 rounded-full bg-bg-neutral-subtle text-text shadow-none hover:bg-bg-neutral-subtle-hovered"
							onClick={() => void navigator.clipboard?.writeText(node.title)}
							size="icon"
							variant="ghost"
						>
							<CopyIcon label="" />
						</Button>
						{node.externalUrl ? (
							<Button
								aria-label="Open node source"
								className="size-8 rounded-full bg-bg-neutral-subtle text-text shadow-none hover:bg-bg-neutral-subtle-hovered"
								onClick={() => window.open(node.externalUrl as string, "_blank", "noopener,noreferrer")}
								size="icon"
								variant="ghost"
							>
								<LinkExternalIcon label="" />
							</Button>
						) : node.provider === "vault" ? (
							<Button
								aria-label="Open node source"
								className="size-8 rounded-full bg-bg-neutral-subtle text-text shadow-none hover:bg-bg-neutral-subtle-hovered"
								onClick={() => window.open(`/api/personal-graph/page/${node.slug}`, "_blank", "noopener,noreferrer")}
								size="icon"
								variant="ghost"
							>
								<LinkExternalIcon label="" />
							</Button>
						) : null}
					</div>
					<Button
						aria-label="More graph detail actions"
						className="size-8 rounded-full bg-bg-neutral-subtle text-text shadow-none hover:bg-bg-neutral-subtle-hovered"
						size="icon"
						variant="ghost"
					>
						<ShowMoreHorizontalIcon label="" />
					</Button>
				</div>
			</PersonalGraphGlassPanel>
		</aside>
	);
}

function PersonalGraphCaptureQueue({
	onRawAdded,
	refreshKey,
}: Readonly<{
	onRawAdded: () => void;
	refreshKey: number;
}>) {
	return (
		<div className="space-y-4">
			<div>
				<h2 className="text-base font-semibold text-text">Add data</h2>
			</div>
			<PersonalGraphDropzone onRawAdded={onRawAdded} />
			<PersonalGraphIngestButton onDone={onRawAdded} refreshKey={refreshKey} />
			<PersonalGraphLog refreshKey={refreshKey} />
		</div>
	);
}

export function PersonalGraphSurface({
	className,
	style,
	...props
}: Readonly<PersonalGraphSurfaceProps>) {
	const {
		error: vaultSettingsError,
		isResetting: isVaultResetting,
		isSelecting: isVaultSelecting,
		resetFolder: resetVault,
		selectFolder: selectVault,
		settings: vaultSettings,
	} = useVaultSettings();
	const {
		error: graphSourceError,
		generatedAt: twgGeneratedAt,
		isRefreshingTwg,
		isSwitching: isSourceSwitching,
		refresh: refreshSource,
		refreshTwg,
		setSource,
		source,
		twgRefreshError,
	} = useGraphSource();
	const isTwgMode = source === "twg";
	const explorerEnabled = isTwgMode || vaultSettings?.status === "ready";
	const { error, explorer: rawExplorer, isLoading, refresh } = useVaultExplorer({ enabled: explorerEnabled });
	const [chatExplorer, setChatExplorer] = useState<VaultExplorer | null>(null);
	const [expandedExplorer, setExpandedExplorer] = useState<VaultExplorer | null>(null);
	const [expandingTwgNodeIds, setExpandingTwgNodeIds] = useState<ReadonlySet<string>>(() => new Set());
	const explorer = isTwgMode ? (chatExplorer ?? expandedExplorer ?? rawExplorer) : rawExplorer;
	const twgChat = useTwgChat({
		onGraph: (focusedExplorer) => {
			if (focusedExplorer.nodes.length > 0) {
				if (isAutomationWorkflowExplorer(focusedExplorer)) {
					setSelectedNodeId(null);
					setIsInspectorOpen(false);
				}
				setChatExplorer(focusedExplorer);
			}
		},
	});
	const lastAssistantMessage = twgChat.messages.findLast((message) => message.role === "assistant")?.content ?? null;
	const isTwgAuthError = isTwgMode && isTwgAuthRequiredError(error);
	const isTwgRefreshAuthError = isTwgMode && isTwgAuthRequiredError(twgRefreshError);
	const shouldShowTwgAuthError = isTwgAuthError || isTwgRefreshAuthError;
	const { actualTheme, setTheme, theme } = useTheme();
	const [introReplayKey, setIntroReplayKey] = useState(0);
	const [flyoutCollapseKey, setFlyoutCollapseKey] = useState(0);
	const [isResetFlyoutCollapsing, setIsResetFlyoutCollapsing] = useState(false);
	const [isTwgConnecting, setIsTwgConnecting] = useState(false);
	const [twgWorkWindow, setTwgWorkWindow] = useState(PERSONAL_GRAPH_DEFAULT_TWG_WORK_WINDOW);
	const { phase } = usePersonalGraphIntro(introReplayKey);
	const isHeaderRevealed = phase === "title" || phase === "subtext" || phase === "controls" || phase === "settle" || phase === "search" || phase === "graph" || phase === "done";
	const isSubtextRevealed = phase === "subtext" || phase === "controls" || phase === "settle" || phase === "search" || phase === "graph" || phase === "done";
	const isIntroSettled = phase === "settle" || phase === "search" || phase === "graph" || phase === "done";
	const isGraphIntroPhase = phase === "graph" || phase === "done";
	const isVaultReady = vaultSettings?.status === "ready";
	const isTwgReady = isTwgMode && Boolean(twgGeneratedAt) && !isTwgConnecting && !isTwgAuthError;
	const isReady = isTwgMode ? isTwgReady : isVaultReady;
	const isVaultReadyForLayout = isReady || isResetFlyoutCollapsing;
	const shouldShowVaultOnboarding = Boolean(vaultSettings) && !isVaultReadyForLayout && !isTwgMode;
	const shouldShowSourcePicker =
		!isVaultReadyForLayout &&
		!shouldShowTwgAuthError &&
		(vaultSettings === null ||
			Boolean(vaultSettingsError) ||
			vaultSettings.status === "unconfigured" ||
			(isTwgMode && (!twgGeneratedAt || isTwgConnecting)));
	const sourcePickerError = shouldShowSourcePicker ? (vaultSettingsError ?? graphSourceError) : null;
	const isPostSettle = isVaultReadyForLayout && isIntroSettled;
	const isSearchRevealed = isVaultReadyForLayout && (phase === "search" || phase === "graph" || phase === "done");
	const isGraphRevealed = isVaultReadyForLayout && isGraphIntroPhase;
	const isBylineRevealed = isPostSettle;
	const easeOut: [number, number, number, number] = [0, 0.4, 0, 1];
	const shouldReduceMotion = Boolean(useReducedMotion());
	const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
	const [isInspectorOpen, setIsInspectorOpen] = useState(false);
	const visualMode = isTwgMode ? getPersonalGraphVisualMode(chatExplorer) : "default";
	const [refreshKey, setRefreshKey] = useState(0);
	const [isCaptureQueueOpen, setIsCaptureQueueOpen] = useState(false);
	const liquidGlassStageRef = useRef<HTMLElement | null>(null);
	const graphStageRef = useRef<HTMLDivElement | null>(null);
	const resetFlyoutCollapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const explorerRef = useRef<VaultExplorer | null>(null);
	const chatExplorerRef = useRef<VaultExplorer | null>(null);
	const expandedTwgNodeIdsRef = useLazyRef<Set<string>>(() => new Set());
	const expandingTwgNodeIdsRef = useLazyRef<Set<string>>(() => new Set());
	const twgExpansionGenerationRef = useRef(0);
	const previousSourceRef = useRef(source);
	const responsiveGraphParams = useResponsivePersonalGraphParams(graphStageRef);
	const graphParams = useMemo(
		() => getPersonalGraphParamsForVisualMode(responsiveGraphParams, visualMode, explorer),
		[explorer, responsiveGraphParams, visualMode],
	);
	const graphLabelStrategy = getPersonalGraphLabelStrategy(visualMode);
	const currentGraphTransitionSnapshot = useMemo<PersonalGraphModeTransitionSnapshot | null>(() => {
		if (!explorer) return null;
		return {
			explorer,
			key: "current",
			labelStrategy: graphLabelStrategy,
			params: graphParams,
			visualMode,
		};
	}, [explorer, graphLabelStrategy, graphParams, visualMode]);
	const graphModeTransition = usePersonalGraphModeTransition(currentGraphTransitionSnapshot, shouldReduceMotion);
	const accessibleGraph = useMemo(() => createNeuralGraphStore(explorer), [explorer]);
	const displayedNode = useMemo(() => getSelectedNode(explorer, selectedNodeId), [explorer, selectedNodeId]);
	const isExpandingDisplayedNode =
		isTwgMode && displayedNode?.provider === "twg" && expandingTwgNodeIds.has(displayedNode.id);

	useEffect(() => {
		if (visualMode === "automation-workflow-radial") {
			setSelectedNodeId(null);
			setIsInspectorOpen(false);
		}
	}, [visualMode]);

	useEffect(() => {
		if (selectedNodeId && !accessibleGraph.nodesById.has(selectedNodeId)) {
			setSelectedNodeId(null);
			setIsInspectorOpen(false);
		}
	}, [accessibleGraph, selectedNodeId]);

	const handleSelectedNodeIdChange = useCallback((nodeId: string | null) => {
		setSelectedNodeId(nodeId);
		setIsInspectorOpen(Boolean(nodeId));
	}, []);

	const handleSelectRelatedNode = useCallback((nodeId: string) => {
		setSelectedNodeId(nodeId);
		setIsInspectorOpen(true);
	}, []);

	const handleCloseInspector = useCallback(() => {
		setIsInspectorOpen(false);
		setSelectedNodeId(null);
	}, []);

	const clearTwgExpansionState = useCallback(() => {
		twgExpansionGenerationRef.current += 1;
		expandedTwgNodeIdsRef.current.clear();
		expandingTwgNodeIdsRef.current.clear();
		setExpandingTwgNodeIds(new Set());
		setExpandedExplorer(null);
	}, []);
	const handleRefreshAll = useCallback(async () => {
		setRefreshKey((current) => current + 1);
		setChatExplorer(null);
		if (isTwgMode) {
			await refreshTwg({ since: twgWorkWindow });
		}
		await refresh();
		clearTwgExpansionState();
	}, [clearTwgExpansionState, isTwgMode, refresh, refreshTwg, twgWorkWindow]);
	const handleCaptureQueueOpenChange = useCallback((isOpen: boolean) => {
		setIsCaptureQueueOpen(isOpen);
	}, []);
	const handleChooseVault = useCallback(async () => {
		clearTwgExpansionState();
		await setSource("vault");
		setChatExplorer(null);
		const next = await selectVault();
		if (next?.status === "ready") {
			handleRefreshAll();
		}
	}, [clearTwgExpansionState, handleRefreshAll, selectVault, setSource]);
	const handleConnectTwg = useCallback(async () => {
		setIsTwgConnecting(true);
		try {
			clearTwgExpansionState();
			setChatExplorer(null);
			const next = await setSource("twg");
			if (next?.source === "twg") {
				await refreshTwg({ since: twgWorkWindow });
				await handleRefreshAll();
			}
		} finally {
			setIsTwgConnecting(false);
		}
	}, [clearTwgExpansionState, handleRefreshAll, refreshTwg, setSource, twgWorkWindow]);
	const handleAskChat = useCallback((prompt: string) => {
		void twgChat.send(prompt);
	}, [twgChat]);
	const handleClearChatFilter = useCallback(() => {
		setChatExplorer(null);
		clearTwgExpansionState();
		void refresh();
	}, [clearTwgExpansionState, refresh]);
	const handleRetryTwg = useCallback(async () => {
		await refreshTwg({ since: twgWorkWindow });
		await refreshSource();
		handleRefreshAll();
	}, [handleRefreshAll, refreshSource, refreshTwg, twgWorkWindow]);
	const handleTwgWorkWindowChange = useCallback((nextWorkWindow: string) => {
		setTwgWorkWindow(nextWorkWindow);
		if (!isTwgMode) {
			return;
		}
		setChatExplorer(null);
		clearTwgExpansionState();
		void refreshTwg({ since: nextWorkWindow })
			.then(refreshSource)
			.then(refresh);
	}, [clearTwgExpansionState, isTwgMode, refresh, refreshSource, refreshTwg]);
	const handleResetVault = useCallback(async () => {
		setFlyoutCollapseKey((current) => current + 1);
		setIsResetFlyoutCollapsing(true);
		if (resetFlyoutCollapseTimerRef.current) {
			clearTimeout(resetFlyoutCollapseTimerRef.current);
			resetFlyoutCollapseTimerRef.current = null;
		}

		setChatExplorer(null);
		clearTwgExpansionState();
		twgChat.stop();
		setIsInspectorOpen(false);
		if (isTwgMode) {
			await setSource("vault");
			setSelectedNodeId(null);
			setIsCaptureQueueOpen(false);
			const collapseDelay = shouldReduceMotion ? 0 : PERSONAL_GRAPH_RESET_FLYOUT_COLLAPSE_DELAY_MS;
			resetFlyoutCollapseTimerRef.current = setTimeout(() => {
				resetFlyoutCollapseTimerRef.current = null;
				setIsResetFlyoutCollapsing(false);
				setIntroReplayKey((current) => current + 1);
			}, collapseDelay);
			return;
		}

		const next = await resetVault();
		if (next) {
			setSelectedNodeId(null);
			setIsCaptureQueueOpen(false);
			const collapseDelay = shouldReduceMotion ? 0 : PERSONAL_GRAPH_RESET_FLYOUT_COLLAPSE_DELAY_MS;
			resetFlyoutCollapseTimerRef.current = setTimeout(() => {
				resetFlyoutCollapseTimerRef.current = null;
				setIsResetFlyoutCollapsing(false);
				setIntroReplayKey((current) => current + 1);
			}, collapseDelay);
			return;
		}

		setIsResetFlyoutCollapsing(false);
	}, [clearTwgExpansionState, isTwgMode, resetVault, setSource, shouldReduceMotion, twgChat]);
	const handleToggleTheme = useCallback(() => {
		if (theme === "light") {
			setTheme("dark");
		} else if (theme === "dark") {
			setTheme("system");
		} else {
			setTheme("light");
		}
	}, [setTheme, theme]);

	const graphStatusText = isVaultReadyForLayout
		? isTwgMode
			? getTwgGraphStatsText(explorer, twgGeneratedAt)
			: getGraphStatsText(explorer)
		: isTwgConnecting
			? "Connecting to Team Work Graph…"
			: shouldShowSourcePicker
			? PERSONAL_GRAPH_UNCONFIGURED_BYLINE
			: isTwgMode
				? "Connecting to Team Work Graph…"
				: vaultSettings?.message ?? getGraphStatsText(explorer);
	const visibleError = shouldShowVaultOnboarding || shouldShowSourcePicker || shouldShowTwgAuthError ? null : error;
	const themeLabel = theme === "system" ? "System theme" : theme === "dark" ? "Dark theme" : "Light theme";

	const flyoutActions = useMemo<ReadonlyArray<PersonalGraphControlFlyoutAction>>(() => {
		const actions: PersonalGraphControlFlyoutAction[] = [];

		if (isVaultReady) {
			actions.push({
				key: "capture",
				label: "Add data",
				render: (
					<Popover open={isCaptureQueueOpen} onOpenChange={handleCaptureQueueOpenChange}>
						<PopoverTrigger
							render={
								<PersonalGraphLiquidGlassIconButton
									aria-label="Add data"
									type="button"
								/>
							}
						>
							<PixelIngestIcon />
						</PopoverTrigger>
						<PopoverContent
							align="end"
							aria-label="Add data"
							className="w-[min(320px,calc(100vw-32px))] bg-transparent p-0 text-text shadow-none"
							sideOffset={10}
						>
							<PersonalGraphGlassPanel contentClassName="max-h-[min(70svh,560px)] overflow-y-auto p-4" radius={24}>
								<PersonalGraphCaptureQueue onRawAdded={handleRefreshAll} refreshKey={refreshKey} />
							</PersonalGraphGlassPanel>
						</PopoverContent>
					</Popover>
				),
			});
		}
		if (isReady) {
			actions.push({
				key: "refresh",
				label: "Refresh",
				render: (
					<PersonalGraphLiquidGlassIconButton
						aria-label="Refresh"
						disabled={isLoading || isRefreshingTwg}
						isLoading={isLoading || isRefreshingTwg}
						onClick={handleRefreshAll}
					>
						<PixelRefreshIcon />
					</PersonalGraphLiquidGlassIconButton>
				),
			});
		}

		actions.push({
			key: "theme",
			label: themeLabel,
			render: (
				<PersonalGraphLiquidGlassIconButton
					aria-label={themeLabel}
					onClick={handleToggleTheme}
				>
					{theme === "system" ? <PixelSystemIcon /> : actualTheme === "dark" ? <PixelDarkIcon /> : <PixelLightIcon />}
				</PersonalGraphLiquidGlassIconButton>
			),
		});

		if (isReady) {
			actions.push({
				key: "clear-vault",
				label: "Reset",
				render: (
					<PersonalGraphLiquidGlassIconButton
						aria-label="Reset"
						disabled={isVaultResetting}
						isLoading={isVaultResetting}
						onClick={handleResetVault}
					>
						<PixelResetIcon />
					</PersonalGraphLiquidGlassIconButton>
				),
			});
		}

		return actions;
	}, [
		actualTheme,
		handleCaptureQueueOpenChange,
		handleRefreshAll,
		handleResetVault,
		handleToggleTheme,
		isCaptureQueueOpen,
		isLoading,
		isRefreshingTwg,
		isReady,
		isVaultReady,
		isVaultResetting,
		refreshKey,
		theme,
		themeLabel,
	]);

	useEffect(() => {
		explorerRef.current = explorer;
	}, [explorer]);

	useEffect(() => {
		chatExplorerRef.current = chatExplorer;
	}, [chatExplorer]);

	useEffect(() => {
		if (previousSourceRef.current === source) {
			return;
		}
		previousSourceRef.current = source;
		setChatExplorer(null);
		setIsInspectorOpen(false);
		clearTwgExpansionState();
	}, [clearTwgExpansionState, source]);

	useEffect(() => {
		if (!isTwgMode || !selectedNodeId || isLoading) {
			return;
		}

		const selectedNode = explorerRef.current?.nodes.find((node) => node.id === selectedNodeId);
		if (!selectedNode || selectedNode.provider !== "twg") {
			return;
		}
		if (expandedTwgNodeIdsRef.current.has(selectedNodeId) || expandingTwgNodeIdsRef.current.has(selectedNodeId)) {
			return;
		}

		const controller = new AbortController();
		const expansionGeneration = twgExpansionGenerationRef.current;
		expandingTwgNodeIdsRef.current.add(selectedNodeId);
		setExpandingTwgNodeIds((current) => {
			if (current.has(selectedNodeId)) return current;
			const next = new Set(current);
			next.add(selectedNodeId);
			return next;
		});

		void expandTwgNode(selectedNodeId, { signal: controller.signal })
			.then((result) => {
				if (controller.signal.aborted || expansionGeneration !== twgExpansionGenerationRef.current) {
					return;
				}

				expandedTwgNodeIdsRef.current.add(selectedNodeId);
				expandedTwgNodeIdsRef.current.add(result.expandedNodeId);

				const currentChatExplorer = chatExplorerRef.current;
				if (currentChatExplorer) {
					if (currentChatExplorer.nodes.some((node) => node.id === selectedNodeId)) {
						setChatExplorer((current) =>
							current ? mergeSelectedNodeExpansion(current, result.explorer, selectedNodeId) : current,
						);
						return;
					}
					setChatExplorer(null);
				}

				setExpandedExplorer(result.explorer);
			})
			.catch((nextError) => {
				if (controller.signal.aborted || expansionGeneration !== twgExpansionGenerationRef.current) {
					return;
				}
				expandedTwgNodeIdsRef.current.add(selectedNodeId);
				console.warn("TWG node expansion failed", nextError);
			})
			.finally(() => {
				expandingTwgNodeIdsRef.current.delete(selectedNodeId);
				if (expansionGeneration !== twgExpansionGenerationRef.current) {
					return;
				}
				setExpandingTwgNodeIds((current) => {
					if (!current.has(selectedNodeId)) return current;
					const next = new Set(current);
					next.delete(selectedNodeId);
					return next;
				});
			});

		return () => {
			controller.abort();
		};
	}, [isLoading, isTwgMode, selectedNodeId]);

	useEffect(() => {
		if (!isInspectorOpen) {
			return;
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				handleCloseInspector();
			}
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [handleCloseInspector, isInspectorOpen]);

	useEffect(() => {
		void refresh();
	}, [refresh, source, twgGeneratedAt]);

	useEffect(() => {
		return () => {
			if (resetFlyoutCollapseTimerRef.current) {
				clearTimeout(resetFlyoutCollapseTimerRef.current);
			}
		};
	}, []);

	const outgoingGraphSnapshot = graphModeTransition?.isActive ? graphModeTransition.snapshot : null;
	const graphTransitionKey = graphModeTransition?.key ?? "steady";
	const incomingGraphInitial = outgoingGraphSnapshot && !shouldReduceMotion
		? {
			clipPath: visualMode === "automation-workflow-radial" ? "circle(12% at 50% 50%)" : "circle(150% at 50% 50%)",
			filter: "blur(12px)",
			opacity: 0,
			scale: visualMode === "automation-workflow-radial" ? 0.88 : 1.03,
		}
		: false;
	const incomingGraphTransition = shouldReduceMotion
		? { duration: 0.18, ease: easeOut }
		: { clipPath: { duration: 0.9, ease: [0.16, 1, 0.3, 1] }, filter: { duration: 0.56, ease: easeOut }, opacity: { duration: 0.48, ease: easeOut }, scale: { duration: 0.9, ease: [0.16, 1, 0.3, 1] } };

	return (
		<main
			aria-label="Personal Graph"
			className={cn("relative isolate w-full min-h-svh overflow-hidden bg-surface text-text", className)}
			ref={liquidGlassStageRef}
			style={style}
			{...props}
		>
			<PersonalGraphLiquidGlassStageProvider stageRef={liquidGlassStageRef}>
				<PersonalGraphBackdrop className="z-0" />
				<header className="absolute inset-x-4 top-6 z-30 sm:inset-x-6 lg:inset-x-8">
					<motion.div
						className={cn("relative flex flex-col items-center", isPostSettle ? "gap-4" : "gap-6")}
						initial={{ y: PERSONAL_GRAPH_HEADER_INITIAL_Y }}
						animate={{
							y: isPostSettle ? PERSONAL_GRAPH_HEADER_SETTLED_Y : PERSONAL_GRAPH_HEADER_INITIAL_Y,
						}}
						layout
						transition={{
							y: { duration: PERSONAL_GRAPH_HEADER_SETTLE_DURATION_SECONDS, ease: easeOut },
							layout: { duration: 0.45, ease: easeOut },
						}}
						style={{ willChange: "transform" }}
					>
						<motion.div
							className="mx-auto w-full min-w-0 max-w-full text-center text-text [container-type:inline-size]"
							initial={{ opacity: 0, y: 20, filter: "blur(20px)" }}
							animate={{
								opacity: isHeaderRevealed ? 1 : 0,
								y: isHeaderRevealed ? 0 : 20,
								filter: isHeaderRevealed ? "blur(0px)" : "blur(20px)",
							}}
							transition={{ duration: 1.0, ease: easeOut }}
							style={{ willChange: "filter, opacity" }}
						>
							<motion.div
								className="flex justify-center"
								initial={{
									minHeight: PERSONAL_GRAPH_INITIAL_TITLE_RESERVED_HEIGHT,
								}}
								animate={{
									minHeight: isPostSettle
										? PERSONAL_GRAPH_SETTLED_TITLE_RESERVED_HEIGHT
										: PERSONAL_GRAPH_INITIAL_TITLE_RESERVED_HEIGHT,
								}}
								transition={{
									minHeight: {
										duration: PERSONAL_GRAPH_HEADER_SETTLE_DURATION_SECONDS,
										ease: easeOut,
									},
								}}
							>
								<PersonalGraphTitle
									key={`personal-graph-title-${introReplayKey}`}
									className="text-text"
									style={{
										...PERSONAL_GRAPH_TITLE_FONT_STYLE,
										fontSize: PERSONAL_GRAPH_SETTLED_TITLE_SIZE,
										lineHeight: PERSONAL_GRAPH_TITLE_LINE_HEIGHT,
										paddingTop: PERSONAL_GRAPH_TITLE_INK_TOP_PADDING,
										transformOrigin: "center top",
										willChange: "transform",
									}}
									initial={{ scale: PERSONAL_GRAPH_INITIAL_TITLE_SCALE }}
									animate={{
										scale: isPostSettle ? 1 : PERSONAL_GRAPH_INITIAL_TITLE_SCALE,
									}}
									transition={{
										duration: PERSONAL_GRAPH_HEADER_SETTLE_DURATION_SECONDS,
										ease: easeOut,
									}}
									play={isHeaderRevealed}
								/>
							</motion.div>
							<motion.p
								className="truncate leading-none tracking-normal text-text"
								style={{
									...PERSONAL_GRAPH_META_FONT_STYLE,
									fontSize: "0.75rem",
									marginTop: "0.5rem",
									willChange: "filter, opacity, transform",
								}}
								initial={{ opacity: 0, y: 10, filter: "blur(10px)" }}
								animate={{
									opacity: isBylineRevealed ? 1 : 0,
									y: isBylineRevealed ? 0 : 10,
									filter: isBylineRevealed ? "blur(0px)" : "blur(10px)",
								}}
								transition={{
									opacity: {
										delay: isBylineRevealed ? PERSONAL_GRAPH_BYLINE_REVEAL_DELAY_SECONDS : 0,
										duration: 0.45,
										ease: easeOut,
									},
									y: {
										delay: isBylineRevealed ? PERSONAL_GRAPH_BYLINE_REVEAL_DELAY_SECONDS : 0,
										duration: 0.45,
										ease: easeOut,
									},
									filter: {
										delay: isBylineRevealed ? PERSONAL_GRAPH_BYLINE_REVEAL_DELAY_SECONDS : 0,
										duration: 0.45,
										ease: easeOut,
									},
								}}
							>
								{graphStatusText}
							</motion.p>
						</motion.div>
						{visibleError ? (
							<motion.p
								className="max-w-[360px] truncate text-xs text-text-danger"
								initial={{ opacity: 0 }}
								animate={{ opacity: isSubtextRevealed ? 1 : 0 }}
								transition={{ duration: 0.4, ease: easeOut }}
							>
								{visibleError.message}
							</motion.p>
						) : null}
						{shouldShowSourcePicker ? (
							<motion.div
								initial={{ opacity: 0, y: 12, filter: "blur(12px)" }}
								animate={{
									opacity: isSubtextRevealed ? 1 : 0,
									y: isSubtextRevealed ? 0 : 12,
									filter: isSubtextRevealed ? "blur(0px)" : "blur(12px)",
								}}
								transition={{ duration: 0.45, ease: easeOut }}
							>
								<PersonalGraphSourcePicker
									isBusy={isVaultSelecting || isSourceSwitching || isTwgConnecting}
									onPickTwg={handleConnectTwg}
									onPickVault={handleChooseVault}
								/>
								{sourcePickerError ? (
									<p className="mx-auto mt-2 max-w-[360px] text-center text-xs text-text-danger" role="alert">
										{sourcePickerError.message}
									</p>
								) : null}
							</motion.div>
						) : null}
						{shouldShowTwgAuthError ? (
							<motion.div
								initial={{ opacity: 0, y: 12, filter: "blur(12px)" }}
								animate={{
									opacity: isSubtextRevealed ? 1 : 0,
									y: isSubtextRevealed ? 0 : 12,
									filter: isSubtextRevealed ? "blur(0px)" : "blur(12px)",
								}}
								transition={{ duration: 0.45, ease: easeOut }}
							>
								<PersonalGraphTwgAuthError isRetrying={isLoading || isRefreshingTwg} onRetry={handleRetryTwg} />
							</motion.div>
						) : null}
					</motion.div>
				</header>

				<motion.section
					className="absolute inset-0 z-10"
					aria-label="Vault graph"
					initial={shouldReduceMotion ? false : { opacity: 0, transform: "translateY(72px) scale(0.94)", filter: "blur(24px)" }}
					animate={{
						opacity: isGraphRevealed ? 1 : 0,
						transform: isGraphRevealed || shouldReduceMotion ? "translateY(0px) scale(1)" : "translateY(72px) scale(0.94)",
						filter: isGraphRevealed || shouldReduceMotion ? "blur(0px)" : "blur(24px)",
					}}
					transition={{
						opacity: { duration: shouldReduceMotion ? 0 : 0.9, ease: easeOut },
						transform: { duration: shouldReduceMotion ? 0 : 1.1, ease: [0.16, 1, 0.3, 1] },
						filter: { duration: shouldReduceMotion ? 0 : 0.85, ease: easeOut },
					}}
					style={{ transformOrigin: "50% 92%", willChange: "transform, opacity, filter" }}
				>
					<div
						className="relative h-full overflow-hidden"
						data-personal-graph-visual-mode={visualMode}
						ref={graphStageRef}
						style={{ transform: `translateY(${PERSONAL_GRAPH_STAGE_TRANSLATE_Y_PX}px)` }}
					>
						{outgoingGraphSnapshot ? (
							<motion.div
								aria-hidden="true"
								className="pointer-events-none absolute inset-0 z-0"
								initial={false}
								animate={shouldReduceMotion
									? { opacity: 0 }
									: { filter: "blur(18px)", opacity: 0, scale: 0.84 }}
								transition={shouldReduceMotion
									? { duration: 0.18, ease: easeOut }
									: { filter: { duration: 0.6, ease: easeOut }, opacity: { duration: 0.54, ease: easeOut }, scale: { duration: 0.9, ease: [0.16, 1, 0.3, 1] } }}
								key={outgoingGraphSnapshot.key}
							>
								<Graph
									allowEmptySelection
									background="transparent"
									className="h-full"
									explorer={outgoingGraphSnapshot.explorer}
									interactionSettings={DEFAULT_NEURAL_GRAPH_INTERACTION_SETTINGS}
									isLoading={false}
									labelStrategy={outgoingGraphSnapshot.labelStrategy}
									params={outgoingGraphSnapshot.params}
									rayOriginBottomOffset={PERSONAL_GRAPH_RAY_TAIL_BOTTOM_OFFSET_PX}
									raySoundSettings={DEFAULT_NEURAL_RAY_SOUND_SETTINGS}
									selectedNodeId={null}
									showControls={false}
									showSelectionOverlay={false}
									variant="fill"
								/>
							</motion.div>
						) : null}
						<motion.div
							className="absolute inset-0 z-10"
							initial={incomingGraphInitial}
							animate={{ clipPath: "circle(150% at 50% 50%)", filter: "blur(0px)", opacity: 1, scale: 1 }}
							transition={incomingGraphTransition}
							key={`${visualMode}-${graphTransitionKey}`}
						>
							<Graph
								allowEmptySelection
								background="transparent"
								className="h-full"
								explorer={explorer}
								isLoading={isLoading}
								interactionSettings={DEFAULT_NEURAL_GRAPH_INTERACTION_SETTINGS}
								labelStrategy={graphLabelStrategy}
								onSelectedNodeIdChange={handleSelectedNodeIdChange}
								params={graphParams}
								rayOriginBottomOffset={PERSONAL_GRAPH_RAY_TAIL_BOTTOM_OFFSET_PX}
								raySoundSettings={DEFAULT_NEURAL_RAY_SOUND_SETTINGS}
								selectedNodeId={selectedNodeId}
								showControls={false}
								showSelectionOverlay={false}
								store={accessibleGraph}
								variant="fill"
							/>
						</motion.div>
					</div>
				</motion.section>

				<motion.section
					aria-hidden={!isSearchRevealed}
					aria-label="Personal Graph search and chat"
					className="pointer-events-none absolute left-4 right-4 z-40 flex justify-center sm:inset-x-6 lg:left-[360px] lg:right-[360px]"
					inert={!isSearchRevealed}
					initial={{ y: 144 }}
					animate={{
						y: isSearchRevealed ? 0 : 144,
					}}
					transition={{
						y: { duration: 0.6, ease: easeOut },
					}}
					style={{ bottom: 24, willChange: "transform" }}
				>
					<div className="pointer-events-auto relative w-full max-w-[560px]">
						<PersonalGraphSummaryPanel
							explorer={explorer}
							node={isInspectorOpen ? displayedNode : null}
							onSelectNode={handleSelectRelatedNode}
							onWorkWindowChange={handleTwgWorkWindowChange}
							workWindow={twgWorkWindow}
						/>
						<PersonalGraphSearch
							assistantMessage={isTwgMode ? lastAssistantMessage : null}
							chatError={isTwgMode ? twgChat.error : null}
							chatStatus={isTwgMode ? twgChat.status : "idle"}
							collapseFlyoutKey={flyoutCollapseKey}
							flyoutActions={flyoutActions}
							isFlyoutDisabled={isResetFlyoutCollapsing}
							mode={isTwgMode ? "twg" : "vault"}
							onAskChat={isTwgMode ? handleAskChat : undefined}
							onSelectSlug={(slug) => {
								const node = explorer?.nodes.find((candidate) => candidate.slug === slug);
								if (node) {
									setSelectedNodeId(node.id);
									setIsInspectorOpen(true);
								}
							}}
						/>
					</div>
				</motion.section>

				<PersonalGraphInspector
					explorer={explorer}
					isExpanding={isExpandingDisplayedNode}
					node={isInspectorOpen ? displayedNode : null}
					onClose={handleCloseInspector}
					onSelectNode={handleSelectRelatedNode}
				/>
				{chatExplorer ? (
					<div className="pointer-events-auto absolute left-4 top-6 z-40 lg:left-8">
						<Button
							aria-label="Clear chat filter"
							className="rounded-full border-border bg-bg-neutral-subtle text-text shadow-none hover:bg-bg-neutral-subtle-hovered"
							onClick={handleClearChatFilter}
							size="default"
							variant="outline"
						>
							Clear filter
						</Button>
					</div>
				) : null}

				<section className="sr-only" aria-label="Personal Graph text fallback">
					<h2>Nodes</h2>
					<ul aria-label="Personal Graph nodes">
						{accessibleGraph.nodes.map((node) => (
							<li key={node.id}>
								{node.title} ({node.kind}) - {node.degree} connections
							</li>
						))}
					</ul>
					<h2>Edges</h2>
					<ul aria-label="Personal Graph edges">
						{accessibleGraph.edges.map((edge) => {
							const source = accessibleGraph.nodesById.get(edge.source)?.title ?? edge.source;
							const target = accessibleGraph.nodesById.get(edge.target)?.title ?? edge.target;
							return (
								<li key={edge.id}>
									{source} to {target} ({edge.kind})
								</li>
							);
						})}
					</ul>
				</section>
			</PersonalGraphLiquidGlassStageProvider>
		</main>
	);
}

export const Surface = {
	Root: PersonalGraphSurface,
} as const;
