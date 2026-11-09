"use client";

// oxlint-disable react-doctor/no-event-handler -- Effects in this file bridge external systems, animation/media state, timers, or parent-controlled state rather than user event handlers.

import type { ComponentProps, ReactNode } from "react";

import { useControllableState } from "@/hooks/use-controllable-state";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Lozenge } from "@/components/ui/lozenge";
import { token } from "@/lib/tokens";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import {
	getDefaultThinkingLabel,
	getReasoningCompletedLabel,
} from "@/components/projects/shared/lib/reasoning-labels";
import RovoIconGlyph from "@atlaskit/icon-lab/core/rovo";
import { ChevronDownIcon } from "@/components/ui/vpk-icons";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import {
	createContext,
	memo,
	useCallback,
	use,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { AnimatedDot } from "./animated-dot";
import { AnimatedRovo } from "./animated-rovo";

import { CodeBlock } from "./code-block";
import { Shimmer } from "./shimmer";
import { ShimmerWave } from "./shimmer-wave";
import { shouldAutoExpandReasoning } from "./reasoning-open-state";
import {
	shouldScheduleCompletionAutoCollapse,
	shouldScheduleTimelineAutoCollapse,
	shouldScheduleToolIdleAutoCollapse,
} from "./lib/reasoning-auto-collapse";

interface ReasoningContextValue {
	isStreaming: boolean;
	streamingWave: boolean;
	animatedDots: boolean;
	streamingWaveGradientColor?: string | readonly string[];
	streamingWaveDuration?: number;
	streamingWaveSpread?: number;
	isOpen: boolean;
	setIsOpen: (open: boolean) => void;
	duration: number | undefined;
	maxVisibleTimelineItems: number;
	setTimelineEntryCount: (count: number) => void;
}

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

export const useReasoning = () => {
	const context = use(ReasoningContext);
	if (!context) {
		throw new Error("Reasoning components must be used within Reasoning");
	}
	return context;
};

export type ReasoningProps = ComponentProps<typeof Collapsible> & {
	isStreaming?: boolean;
	streamingWave?: boolean;
	animatedDots?: boolean;
	streamingWaveGradientColor?: string | readonly string[];
	streamingWaveDuration?: number;
	streamingWaveSpread?: number;
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	duration?: number;
	autoExpandOnDetails?: boolean;
	hasDetails?: boolean;
	allowAutoCollapse?: boolean;
	autoCollapseAtCount?: number;
	collapseDelayMs?: number;
	maxVisibleTimelineItems?: number;
	toolsRunning?: boolean;
};

const AUTO_CLOSE_DELAY = 1000;
const MS_IN_S = 1000;
const DEFAULT_MAX_VISIBLE_TIMELINE_ITEMS = 5;
const TIMELINE_STATUS_LINE_REGEX =
	/^(?:used|using|invoking|completed|running|calling|tool call failed|failed|detected intent)\b/i;
const TIMELINE_TOOL_ACTION_LINE_REGEX =
	/^(used|using|invoking|completed|running|calling)\s+(.+)$/i;
const TIMELINE_TOOL_FAILURE_LINE_REGEX = /^(tool call failed|failed):\s*(.+)$/i;
const TIMELINE_INTENT_LINE_REGEX = /^(detected intent):?\s+(.+)$/i;

interface TimelineEntry {
	id: string;
	label: string;
}

interface TimelineToolLabelParts {
	prefix: string;
	toolName: string;
}

// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
export function isTimelineOnlyContent(value: string): boolean {
	return parseTimelineEntries(value).length > 0;
}

function parseTimelineEntries(value: string): TimelineEntry[] {
	const lines = value
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
	if (lines.length === 0) {
		return [];
	}

	const areAllStatusLines = lines.every((line) =>
		TIMELINE_STATUS_LINE_REGEX.test(line)
	);
	if (!areAllStatusLines) {
		return [];
	}

	return lines.map((line, index) => ({
		id: `${index}-${line.toLowerCase().replace(/\s+/g, " ")}`,
		label: line,
	}));
}

function parseTimelineToolLabel(label: string): TimelineToolLabelParts | null {
	const normalizedLabel = label.trim();
	const failureMatch = normalizedLabel.match(TIMELINE_TOOL_FAILURE_LINE_REGEX);
	if (failureMatch?.[1] && failureMatch[2]) {
		const prefix = failureMatch[1].trim();
		const toolName = failureMatch[2].trim();
		if (toolName.length === 0) {
			return null;
		}
		return { prefix, toolName };
	}

	const actionMatch = normalizedLabel.match(TIMELINE_TOOL_ACTION_LINE_REGEX);
	if (actionMatch?.[1] && actionMatch[2]) {
		const prefix = actionMatch[1].trim();
		const toolName = actionMatch[2].trim();
		if (toolName.length === 0) {
			return null;
		}
		return { prefix, toolName };
	}

	const intentMatch = normalizedLabel.match(TIMELINE_INTENT_LINE_REGEX);
	if (intentMatch?.[1] && intentMatch[2]) {
		const prefix = intentMatch[1].trim();
		const toolName = intentMatch[2].trim();
		if (toolName.length > 0) {
			return { prefix, toolName };
		}
	}

	return null;
}

function ReasoningStatusIcon({
	isCompleted = false,
}: Readonly<{ isCompleted?: boolean }>): ReactNode {
	return isCompleted ? (
		<Icon
			render={
				<RovoIconGlyph
					color={token("color.icon.subtlest")}
					label=""
					size="small"
				/>
			}
			className="size-4 shrink-0"
		/>
	) : (
		<span className="inline-flex size-5 items-center justify-center">
			<RovoIconGlyph
				color={token("color.icon")}
				label=""
				size="small"
			/>
		</span>
	);
}

export const Reasoning = memo(
	({
		className,
		isStreaming = false,
		streamingWave = false,
		animatedDots = true,
		streamingWaveGradientColor,
		streamingWaveDuration,
		streamingWaveSpread,
		open,
		defaultOpen,
		onOpenChange,
		duration: durationProp,
		autoExpandOnDetails = false,
		hasDetails = false,
		allowAutoCollapse = true,
		autoCollapseAtCount = DEFAULT_MAX_VISIBLE_TIMELINE_ITEMS,
		collapseDelayMs = AUTO_CLOSE_DELAY,
		maxVisibleTimelineItems = DEFAULT_MAX_VISIBLE_TIMELINE_ITEMS,
		toolsRunning,
		children,
		...props
	}: Readonly<ReasoningProps>) => {
		const resolvedDefaultOpen = defaultOpen ?? isStreaming;
		const isExplicitlyClosed = defaultOpen === false;

		const [isOpen, setIsOpen] = useControllableState<boolean>({
			defaultProp: resolvedDefaultOpen,
			onChange: onOpenChange,
			prop: open,
		});
		const [duration, setDuration] = useControllableState<number | undefined>({
			defaultProp: undefined,
			prop: durationProp,
		});
		const [timelineEntryCount, setTimelineEntryCount] = useState(0);

		const hasEverStreamedRef = useRef(isStreaming);
		const startTimeRef = useRef<number | null>(null);
		const hasUserClosedRef = useRef(false);
		const hasAutoCollapsedAtCountRef = useRef(false);
		const hasAutoCollapsedOnCompletionRef = useRef(false);
		const prevStreamingRef = useRef(isStreaming);
		const prevToolsRunningRef = useRef(toolsRunning ?? false);

		useEffect(() => {
			const isStartingStream = isStreaming && !prevStreamingRef.current;
			if (isStartingStream) {
				hasUserClosedRef.current = false;
				hasAutoCollapsedAtCountRef.current = false;
				hasAutoCollapsedOnCompletionRef.current = false;
			}

			if (isStreaming) {
				hasEverStreamedRef.current = true;
				if (startTimeRef.current === null) {
					startTimeRef.current = Date.now();
				}
			} else if (startTimeRef.current !== null) {
				setDuration(Math.ceil((Date.now() - startTimeRef.current) / MS_IN_S));
				startTimeRef.current = null;
			}

			prevStreamingRef.current = isStreaming;
		}, [isStreaming, setDuration]);

		useEffect(() => {
			if (
				isStreaming &&
				!isOpen &&
				!isExplicitlyClosed &&
				!hasUserClosedRef.current
			) {
				setIsOpen(true);
			}
		}, [isExplicitlyClosed, isOpen, isStreaming, setIsOpen]);

		useEffect(() => {
			if (!shouldAutoExpandReasoning({
				autoExpandOnDetails,
				hasDetails,
				isStreaming,
				isOpen,
				isExplicitlyClosed,
				hasUserClosed: hasUserClosedRef.current,
			})) {
				return;
			}

			setIsOpen(true);
		}, [
			autoExpandOnDetails,
			hasDetails,
			isExplicitlyClosed,
			isOpen,
			isStreaming,
			setIsOpen,
		]);

		useEffect(() => {
			if (
				!shouldScheduleTimelineAutoCollapse({
					allowAutoCollapse,
					isStreaming,
					isOpen,
					hasAutoCollapsedAtCount: hasAutoCollapsedAtCountRef.current,
					timelineEntryCount,
					autoCollapseAtCount,
				})
			) {
				return;
			}

			const timer = setTimeout(() => {
				setIsOpen(false);
				hasAutoCollapsedAtCountRef.current = true;
				hasUserClosedRef.current = true;
			}, collapseDelayMs);

			return () => clearTimeout(timer);
		}, [
			allowAutoCollapse,
			autoCollapseAtCount,
			collapseDelayMs,
			isOpen,
			isStreaming,
			setIsOpen,
			timelineEntryCount,
		]);

		useEffect(() => {
			if (
				!shouldScheduleCompletionAutoCollapse({
					allowAutoCollapse,
					hasEverStreamed: hasEverStreamedRef.current,
					isStreaming,
					isOpen,
					hasAutoCollapsedOnCompletion: hasAutoCollapsedOnCompletionRef.current,
				})
			) {
				return;
			}

			const timer = setTimeout(() => {
				setIsOpen(false);
				hasAutoCollapsedOnCompletionRef.current = true;
			}, collapseDelayMs);

			return () => clearTimeout(timer);
		}, [allowAutoCollapse, collapseDelayMs, isOpen, isStreaming, setIsOpen]);

		useEffect(() => {
			if (toolsRunning === undefined) {
				return;
			}

			const wasRunning = prevToolsRunningRef.current;
			prevToolsRunningRef.current = toolsRunning;

			if (toolsRunning && !wasRunning) {
				hasUserClosedRef.current = false;
				if (!isOpen) {
					setIsOpen(true);
				}
				return;
			}

			if (
				shouldScheduleToolIdleAutoCollapse({
					toolsRunning,
					prevToolsRunning: wasRunning,
					isOpen,
				})
			) {
				const timer = setTimeout(() => {
					setIsOpen(false);
					hasUserClosedRef.current = true;
				}, collapseDelayMs);

				return () => clearTimeout(timer);
			}
		}, [toolsRunning, isOpen, collapseDelayMs, setIsOpen]);

		const handleOpenChange = useCallback(
			(newOpen: boolean) => {
				if (!newOpen && isStreaming) {
					hasUserClosedRef.current = true;
				}
				setIsOpen(newOpen);
			},
			[isStreaming, setIsOpen]
		);

		const handleTimelineEntryCountChange = useCallback((count: number) => {
			setTimelineEntryCount((previous) =>
				previous === count ? previous : count
			);
		}, []);

		const contextValue = useMemo(
			() => ({
				animatedDots,
				duration,
				isOpen,
				isStreaming,
				maxVisibleTimelineItems,
				setIsOpen,
				setTimelineEntryCount: handleTimelineEntryCountChange,
				streamingWave,
				streamingWaveDuration,
				streamingWaveGradientColor,
				streamingWaveSpread,
			}),
			[
				animatedDots,
				duration,
				handleTimelineEntryCountChange,
				isOpen,
				isStreaming,
				maxVisibleTimelineItems,
				setIsOpen,
				streamingWave,
				streamingWaveDuration,
				streamingWaveGradientColor,
				streamingWaveSpread,
			]
		);

		return (
			<ReasoningContext value={contextValue}>
				<Collapsible
					className={cn("cv-auto not-prose mb-4", className)}
					onOpenChange={handleOpenChange}
					open={isOpen}
					style={{ containIntrinsicSize: "auto 600px" }}
					{...props}
				>
					{children}
				</Collapsible>
			</ReasoningContext>
		);
	}
);

const COMPLETED_STATUS_PREFIXES = ["used", "completed", "thought for"] as const;
const ROVO_COOKING_SHIMMER_PROPS = {
	duration: 1,
	spread: 1.4,
	xDistance: 0,
	yDistance: 2.4,
	zDistance: 0,
	scaleDistance: 1,
	rotateYDistance: 0,
	transition: { ease: "easeInOut", repeatDelay: 0.1 },
} as const;
const REASONING_ANIMATED_ROVO_TRANSITION = {
	type: "tween",
	duration: 2,
	ease: "linear",
} as const;

/** Strip trailing dots/ellipsis from a label since animated dots are appended separately. */
const stripTrailingDots = (label: string) => label.replace(/\.+$/, "");

const isCompletedStatusLabel = (label: ReactNode) => {
	if (typeof label !== "string") {
		return false;
	}
	const normalizedLabel = label.trim().toLowerCase();
	return COMPLETED_STATUS_PREFIXES.some((prefix) =>
		normalizedLabel === prefix || normalizedLabel.startsWith(`${prefix} `)
	);
};

function StreamingReasoningLabel({
	label,
	streaming,
	streamingWave,
	animatedDots,
	streamingWaveGradientColor,
	streamingWaveDuration,
	streamingWaveSpread,
}: Readonly<{
	label: string;
	streaming?: boolean;
	streamingWave: boolean;
	animatedDots: boolean;
	streamingWaveGradientColor?: string | readonly string[];
	streamingWaveDuration?: number;
	streamingWaveSpread?: number;
}>): ReactNode {
	const renderedLabel = animatedDots ? stripTrailingDots(label) : label;

		return (
			<>
				<AnimatedRovo.Root
				size={16}
				streaming={streaming}
				{...(streaming ? {} : { fullSpinProbability: 0.35, danceDistancePercent: 0 })}
				transition={REASONING_ANIMATED_ROVO_TRANSITION}
			/>
				<span className="flex min-w-0 items-baseline">
				{streamingWave ? (
					<ShimmerWave
						baseGradientColor={streamingWaveGradientColor}
						as="span"
						className="min-w-0 truncate"
						duration={streamingWaveDuration ?? ROVO_COOKING_SHIMMER_PROPS.duration}
						spread={streamingWaveSpread ?? ROVO_COOKING_SHIMMER_PROPS.spread}
						xDistance={ROVO_COOKING_SHIMMER_PROPS.xDistance}
						yDistance={ROVO_COOKING_SHIMMER_PROPS.yDistance}
						zDistance={ROVO_COOKING_SHIMMER_PROPS.zDistance}
						scaleDistance={ROVO_COOKING_SHIMMER_PROPS.scaleDistance}
						rotateYDistance={ROVO_COOKING_SHIMMER_PROPS.rotateYDistance}
						transition={ROVO_COOKING_SHIMMER_PROPS.transition}
					>
						{renderedLabel}
					</ShimmerWave>
				) : (
					<Shimmer
						as="span"
						className="min-w-0 truncate"
						duration={streamingWaveDuration ?? ROVO_COOKING_SHIMMER_PROPS.duration}
						spread={streamingWaveSpread ?? ROVO_COOKING_SHIMMER_PROPS.spread}
					>
						{renderedLabel}
					</Shimmer>
				)}
				{animatedDots ? <AnimatedDot /> : null}
			</span>
		</>
	);
}

export type ReasoningTriggerProps = ComponentProps<
	typeof CollapsibleTrigger
> & {
	label?: string;
	completedLabel?: (duration?: number) => ReactNode;
	streaming?: boolean;
};

const defaultReasoningCompletedLabel = (duration?: number) =>
	getReasoningCompletedLabel(duration);

export const ReasoningTrigger = memo(
	({
		className,
		children,
		label = getDefaultThinkingLabel(),
		completedLabel = defaultReasoningCompletedLabel,
		streaming,
		...props
	}: Readonly<ReasoningTriggerProps>) => {
		const {
			isStreaming,
			isOpen,
			duration,
			streamingWave,
			animatedDots,
			streamingWaveGradientColor,
			streamingWaveDuration,
			streamingWaveSpread,
		} = useReasoning();
		const isComplete = !isStreaming && duration !== undefined && duration > 0;
		const hasCompletedStatusLabel = isCompletedStatusLabel(label);
		const shouldShowCompletedState = isComplete || hasCompletedStatusLabel;
		const completedStateLabel = hasCompletedStatusLabel
			? label
			: completedLabel(duration);

		return (
			<CollapsibleTrigger
				className={cn(
					"flex w-full items-center gap-2 text-sm text-text-subtle transition-colors",
					shouldShowCompletedState
						? "hover:text-text"
						: "text-muted-foreground hover:text-foreground",
					className
				)}
				{...props}
			>
				{children ?? (
					<>
						{shouldShowCompletedState ? (
							<>
								<ReasoningStatusIcon isCompleted />
								<span className="min-w-0 truncate text-left">{completedStateLabel}</span>
							</>
						) : (
							<StreamingReasoningLabel
								label={label}
								streaming={streaming}
								streamingWave={streamingWave}
								animatedDots={animatedDots}
								streamingWaveGradientColor={streamingWaveGradientColor}
								streamingWaveDuration={streamingWaveDuration}
								streamingWaveSpread={streamingWaveSpread}
							/>
						)}
						<ChevronDownIcon
							className={cn(
								"size-4 shrink-0 text-icon-subtlest transition-transform",
								isOpen ? "rotate-180" : "rotate-0"
							)}
						/>
					</>
				)}
			</CollapsibleTrigger>
		);
	}
);

export type ReasoningContentProps = ComponentProps<
	typeof CollapsibleContent
> & {
	/**
	 * When a string is provided, ReasoningContent can auto-detect and render a timeline.
	 * For richer UIs (tools, tasks, etc.), pass React children.
	 */
	children: ReactNode;
	timelineMode?: "auto" | "always" | "never";
	maxVisibleTimelineItems?: number;
};

export type ReasoningTextProps = {
	text: string;
	timelineMode: "auto" | "always" | "never";
	maxVisibleTimelineItems: number;
};

export function ReasoningText({
	text,
	timelineMode,
	maxVisibleTimelineItems,
}: Readonly<ReasoningTextProps>): ReactNode {
	const { setTimelineEntryCount } = useReasoning();
	const shouldReduceMotion = useReducedMotion();

	const timelineEntries = useMemo(() => parseTimelineEntries(text), [text]);
	const shouldRenderTimeline =
		timelineMode === "always" ||
		(timelineMode === "auto" && timelineEntries.length > 0);
	const visibleTimelineEntries = shouldRenderTimeline
		? timelineEntries.slice(-maxVisibleTimelineItems)
		: [];

	useEffect(() => {
		setTimelineEntryCount(shouldRenderTimeline ? timelineEntries.length : 0);

		return () => {
			setTimelineEntryCount(0);
		};
	}, [setTimelineEntryCount, shouldRenderTimeline, timelineEntries.length]);

	if (shouldRenderTimeline) {
		return (
			<div className="relative pl-6">
				<div
					aria-hidden
					className="absolute bottom-0 left-2 top-0 w-px bg-border"
				/>
				<div className="space-y-1">
					<AnimatePresence initial={false}>
						{visibleTimelineEntries.map((entry) => {
							const toolLabel = parseTimelineToolLabel(entry.label);
							return (
								<motion.div
									key={entry.id}
									animate={
										shouldReduceMotion ? undefined : { opacity: 1, y: 0 }
									}
									className="m-0 text-left text-sm leading-7 text-text-subtle"
									exit={
										shouldReduceMotion ? undefined : { opacity: 0, y: 6 }
									}
									initial={
										shouldReduceMotion ? false : { opacity: 0, y: -6 }
									}
									layout={!shouldReduceMotion}
									transition={{ duration: 0.2, ease: "easeOut" }}
								>
									{toolLabel ? (
										<span className="flex min-w-0 items-center gap-2">
											<span className="truncate">{toolLabel.prefix}</span>
											<Lozenge
												className="max-w-full shrink align-middle"
												title={toolLabel.toolName}
												variant="neutral"
											>
												{toolLabel.toolName}
											</Lozenge>
										</span>
									) : (
										entry.label
									)}
								</motion.div>
							);
						})}
					</AnimatePresence>
				</div>
			</div>
		);
	}

	return <CodeBlock code={text} language="markdown" />;
}

export const ReasoningContent = memo(
	({
		className,
		children,
		timelineMode = "auto",
		maxVisibleTimelineItems,
		...props
	}: Readonly<ReasoningContentProps>) => {
		const { maxVisibleTimelineItems: contextMaxVisibleTimelineItems } =
			useReasoning();

		const textChildren = typeof children === "string" ? children : null;
		const resolvedMaxVisibleTimelineItems =
			maxVisibleTimelineItems ?? contextMaxVisibleTimelineItems;

		return (
			<CollapsibleContent
				className={cn(
					"mt-4 text-sm",
					"data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-muted-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
					className
				)}
				{...props}
			>
				{textChildren ? (
					<ReasoningText
						maxVisibleTimelineItems={resolvedMaxVisibleTimelineItems}
						text={textChildren}
						timelineMode={timelineMode}
					/>
				) : (
					<>{children}</>
				)}
			</CollapsibleContent>
		);
	}
);

export type AdsReasoningTriggerProps = ComponentProps<
	typeof CollapsibleTrigger
> & {
	label?: string;
	completedLabel?: (duration?: number) => ReactNode;
	showChevron?: boolean;
	streaming?: boolean;
};

const defaultCompletedLabel = (duration?: number) =>
	getReasoningCompletedLabel(duration);

export type ReasoningSectionProps = ComponentProps<"div"> & {
	title?: ReactNode;
};

export const ReasoningSection = memo(
	({ className, title, children, ...props }: Readonly<ReasoningSectionProps>) => (
		<div className={cn("space-y-2", className)} {...props}>
			{title ? (
				<h4 className="font-medium text-muted-foreground text-[12px]">
					{title}
				</h4>
			) : null}
			{children}
		</div>
	)
);

export const AdsReasoningTrigger = memo(
	({
		className,
		label = getDefaultThinkingLabel(),
		completedLabel = defaultCompletedLabel,
		showChevron = true,
		streaming,
		...props
	}: Readonly<AdsReasoningTriggerProps>) => {
		const {
			isStreaming,
			isOpen,
			duration,
			streamingWave,
			animatedDots,
			streamingWaveGradientColor,
			streamingWaveDuration,
			streamingWaveSpread,
		} = useReasoning();
		const isComplete = !isStreaming && duration !== undefined && duration > 0;
		const hasCompletedStatusLabel = isCompletedStatusLabel(label);
		const shouldShowCompletedState = isComplete || hasCompletedStatusLabel;
		const completedStateLabel = hasCompletedStatusLabel
			? label
			: completedLabel(duration);

		return (
			<CollapsibleTrigger
				className={cn(
					"flex w-full items-center gap-2 text-sm text-text-subtle transition-colors",
					shouldShowCompletedState
						? "hover:text-text"
						: "text-muted-foreground hover:text-foreground",
					className
				)}
				{...props}
			>
				{shouldShowCompletedState ? (
					<>
						<ReasoningStatusIcon isCompleted />
						<span className="min-w-0 truncate text-left">{completedStateLabel}</span>
					</>
				) : (
					<StreamingReasoningLabel
						label={label}
						streaming={streaming}
						streamingWave={streamingWave}
						animatedDots={animatedDots}
						streamingWaveGradientColor={streamingWaveGradientColor}
						streamingWaveDuration={streamingWaveDuration}
						streamingWaveSpread={streamingWaveSpread}
					/>
				)}
				{showChevron ? (
					<ChevronDownIcon
						className={cn(
							"size-4 shrink-0 text-icon-subtlest transition-transform",
							isOpen ? "rotate-180" : "rotate-0"
						)}
					/>
				) : null}
			</CollapsibleTrigger>
		);
	}
);

Reasoning.displayName = "Reasoning";
ReasoningTrigger.displayName = "ReasoningTrigger";
ReasoningContent.displayName = "ReasoningContent";
ReasoningSection.displayName = "ReasoningSection";
AdsReasoningTrigger.displayName = "AdsReasoningTrigger";
