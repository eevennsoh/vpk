"use client";

// oxlint-disable react-doctor/no-event-handler -- Effects in this file bridge external systems, animation/media state, timers, or parent-controlled state rather than user event handlers.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { VisualIdentityTile } from "@/components/projects/shared/components/visual-identity-tile";
import { resolvePlanVisualIdentity } from "@/components/projects/shared/lib/plan-identity";
import type { VisualIdentity } from "@/components/projects/shared/lib/visual-identity";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import CrossCircleIcon from "@atlaskit/icon/core/cross-circle";
import { ProgressCircle } from "@/components/ui-custom/progress-circle";
import RetryIcon from "@atlaskit/icon/core/retry";
import VideoStopOverlayIcon from "@atlaskit/icon/core/video-stop-overlay";
import DeleteIcon from "@atlaskit/icon/core/delete";
import { MOCK_TASKS, type ProgressStatusGroups, type ProgressTask } from "./data/mock-tasks";
import { AnimatedDot } from "@/components/ui-custom/animated-dot";
import { formatElapsedTime, getElapsedSeconds, resolveInitialNowMs } from "@/lib/elapsed-time";

const SUMMARY_RING_SEGMENTED_GRADIENT =
	"conic-gradient(from 220deg, transparent 0deg 252deg, #8d63ff 252deg 266deg, #7fbb44 266deg 280deg, #3b66e0 280deg 294deg, #e5a126 294deg 308deg, transparent 308deg 360deg)";
const SUMMARY_RING_STROKE_PX = 3;
const SUMMARY_RING_DURATION = "calc(var(--duration-slower) * 3)";
const SUMMARY_RING_EASING = "var(--ease-in-out)";
const SUMMARY_RING_MASK =
	`radial-gradient(farthest-side, transparent calc(100% - ${SUMMARY_RING_STROKE_PX}px), #000 calc(100% - ${SUMMARY_RING_STROKE_PX}px))`;
const CARD_ANIMATION_STYLES = `
@keyframes rainbow-ring-spin {
	to { transform: rotate(360deg); }
}
`;

const CARD_ANIMATION_INNER_HTML = { __html: CARD_ANIMATION_STYLES };
const CELEBRATORY_EMOJIS = ["🎉", "🥳", "🎊", "🪅", "🥂", "🎈", "🏆", "✨", "💪", "🙌"] as const;
const EMOJI_ENTER_TRANSITION = { duration: 0.25, ease: [0.175, 0.885, 0.32, 1.275] as const };
const ICON_TRANSITION = { duration: 0.2, ease: "easeOut" as const };
const CELEBRATION_HOLD_MS = 1200;
const GONG_VOLUME = 0.3;

type RunStatus = "running" | "completed" | "failed";
type IconStatus = "done" | "in-progress" | "failed" | "todo";
type StatusGroupKey = "done" | "inReview" | "inProgress" | "failed" | "todo";

export type RetryableStatusGroupKey = "failed" | "todo";

interface StatusGroup {
	key: StatusGroupKey;
	label: string;
	tasks: ProgressTask[];
	iconStatus: IconStatus;
	defaultExpanded: boolean;
}

function getRunStatusLabel(status: RunStatus): string {
	if (status === "completed") return "Completed";
	if (status === "failed") return "Failed";
	return "Running";
}

function getRunStatusToneClass(status: RunStatus): string {
	if (status === "completed") return "text-text";
	if (status === "failed") return "text-text-danger";
	return "text-text-subtle";
}

function TaskStatusIcon({
	status,
	celebratingEmoji,
	shouldReduceMotion = false,
}: Readonly<{
	status: IconStatus;
	celebratingEmoji?: string | null;
	shouldReduceMotion?: boolean;
}>) {
	if (status === "done") {
		return (
			<AnimatePresence mode="wait" initial={false}>
				{celebratingEmoji ? (
					<motion.span
						key={`emoji-${celebratingEmoji}`}
						initial={shouldReduceMotion ? false : { scale: 0.3, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						exit={shouldReduceMotion ? undefined : { scale: 0.3, opacity: 0, transition: ICON_TRANSITION }}
						transition={shouldReduceMotion ? undefined : EMOJI_ENTER_TRANSITION}
						className="flex items-center justify-center text-sm leading-none"
						aria-hidden="true"
					>
						{celebratingEmoji}
					</motion.span>
				) : (
					<motion.span
						key="check-icon"
						initial={shouldReduceMotion ? false : { scale: 0.3, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						exit={shouldReduceMotion ? undefined : { scale: 0.3, opacity: 0, transition: ICON_TRANSITION }}
						transition={shouldReduceMotion ? undefined : ICON_TRANSITION}
						className="flex items-center justify-center"
					>
						<ProgressCircle value={100} size="sm" variant="filled" label="Complete" />
					</motion.span>
				)}
			</AnimatePresence>
		);
	}

	if (status === "in-progress") {
		return <ProgressCircle value={null} size="sm" variant="filled" label="In progress" />;
	}

	if (status === "failed") {
		return <CrossCircleIcon label="" color={token("color.icon.danger")} />;
	}

	return <ProgressCircle value={0} size="sm" variant="filled" label="Not started" />;
}

function TaskItem({ task }: Readonly<{ task: ProgressTask }>) {
	return (
		<div className="flex flex-col px-1">
			<span className="whitespace-normal break-words text-xs leading-4 text-text">
				{task.label}
			</span>
			{task.description.trim().length > 0 ? (
				<span className="text-xs leading-4 text-text-subtlest">{task.description}</span>
			) : null}
		</div>
	);
}

interface TaskGroupRowProps {
	label: string;
	count: number;
	tasks: ProgressTask[];
	defaultExpanded?: boolean;
	onRetry?: () => Promise<void> | void;
	retryLabel?: string;
	isRetrying?: boolean;
}

function TaskGroupRow({
	label,
	count,
	tasks,
	defaultExpanded = false,
	onRetry,
	retryLabel = "Retry failed tasks",
	isRetrying = false,
}: Readonly<TaskGroupRowProps>) {
	const [expanded, setExpanded] = useState(defaultExpanded);

	return (
		<div className="flex flex-1 flex-col">
			<div className="flex h-8 items-center justify-between rounded-md px-1 py-1 hover:bg-bg-neutral-subtle-hovered">
				<div className="flex min-w-0 items-center gap-1">
					<span className="text-sm font-medium leading-5 text-text-subtle">{label}</span>
					{onRetry ? (
						<Button
							variant="ghost"
							size="icon-compact"
							className="size-6 rounded-sm text-icon-subtle hover:text-icon"
							disabled={isRetrying}
							aria-label={retryLabel}
							onClick={(e) => {
								e.stopPropagation();
								void onRetry();
							}}
						>
							<RetryIcon label="" />
						</Button>
					) : null}
				</div>
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						setExpanded((prev) => !prev);
					}}
					className="inline-flex items-center gap-1 rounded-sm px-1"
				>
					<span className="inline-flex h-4 min-w-6 items-center justify-center rounded-[2px] bg-bg-neutral px-1 text-xs text-text">{count}</span>
					{expanded ? <ChevronDownIcon label="" size="small" /> : <ChevronRightIcon label="" size="small" />}
				</button>
			</div>
			{expanded ? (
				<div className="flex flex-col gap-1">
					{tasks.map((task) => (
						<TaskItem key={task.id} task={task} />
					))}
				</div>
			) : null}
		</div>
	);
}

function buildStatusGroups(groups: ProgressStatusGroups): StatusGroup[] {
	return [
		{
			key: "done",
			label: "Done",
			tasks: groups.done,
			iconStatus: groups.done.length > 0 ? "done" : "todo",
			defaultExpanded: false,
		},
		{
			key: "inReview",
			label: "In Review",
			tasks: groups.inReview,
			iconStatus: groups.inReview.length > 0 ? "in-progress" : "todo",
			defaultExpanded: true,
		},
		{
			key: "inProgress",
			label: "In Progress",
			tasks: groups.inProgress,
			iconStatus: groups.inProgress.length > 0 ? "in-progress" : "todo",
			defaultExpanded: groups.inProgress.length > 0,
		},
		{
			key: "failed",
			label: "Failed",
			tasks: groups.failed,
			iconStatus: groups.failed.length > 0 ? "failed" : "todo",
			defaultExpanded: groups.failed.length > 0,
		},
		{
			key: "todo",
			label: "Pending",
			tasks: groups.todo,
			iconStatus: "todo",
			defaultExpanded: false,
		},
	];
}

function isRetryableStatusGroupKey(
	groupKey: StatusGroupKey
): groupKey is RetryableStatusGroupKey {
	return groupKey === "failed" || groupKey === "todo";
}

interface AgentsProgressProps {
	planTitle?: string;
	planVisualIdentity?: VisualIdentity;
	taskStatusGroups?: ProgressStatusGroups;
	runStatus?: RunStatus;
	runCreatedAt?: string | null;
	runCompletedAt?: string | null;
	initialNowMs?: number;
	showSummaryRainbow?: boolean;
	runCount?: number;
	agentCount?: number;
	defaultCollapsed?: boolean;
	isCollapsible?: boolean;
	onCardClick?: () => void;
	onDelete?: () => void;
	onRetryGroup?: (
		groupKey: RetryableStatusGroupKey,
		taskIds: string[]
	) => Promise<void> | void;
	className?: string;
}

export default function AgentsProgress({
	planTitle = "Untitled task run",
	planVisualIdentity,
	taskStatusGroups = MOCK_TASKS,
	runStatus = "running",
	runCreatedAt = new Date(Date.now() - 651_000).toISOString(),
	runCompletedAt = null,
	initialNowMs,
	showSummaryRainbow = false,
	runCount = 1,
	agentCount = 10,
	defaultCollapsed = false,
	isCollapsible = true,
	onCardClick,
	onDelete,
	onRetryGroup,
	className,
}: Readonly<AgentsProgressProps>) {
	const [collapsed, setCollapsed] = useState(defaultCollapsed);
	const [nowMs, setNowMs] = useState(() =>
		resolveInitialNowMs({
			initialNowMs,
			runCreatedAt: runCreatedAt ?? null,
			runCompletedAt: runCompletedAt ?? null,
		})
	);
	const [retryingGroupKey, setRetryingGroupKey] =
		useState<RetryableStatusGroupKey | null>(null);
	const isInteractive = isCollapsible || typeof onCardClick === "function";
	const resolvedPlanVisualIdentity = useMemo(
		() => planVisualIdentity ?? resolvePlanVisualIdentity(planTitle),
		[planTitle, planVisualIdentity]
	);

	const shouldReduceMotion = useReducedMotion();
	const prevDoneCountRef = useRef(taskStatusGroups.done.length);
	const [celebratingEmoji, setCelebratingEmoji] = useState<string | null>(null);

	// oxlint-disable react-doctor/no-adjust-state-on-prop-change -- this detects a completed-task transition and plays optional feedback.
	useEffect(() => {
		const currentCount = taskStatusGroups.done.length;
		const prevCount = prevDoneCountRef.current;
		prevDoneCountRef.current = currentCount;

		if (currentCount > prevCount && currentCount > 0) {
			const emoji = CELEBRATORY_EMOJIS[Math.floor(Math.random() * CELEBRATORY_EMOJIS.length)];
			setCelebratingEmoji(emoji);

			if (!shouldReduceMotion) {
				const sound = new Audio("/sound/gong.mp3");
				sound.volume = GONG_VOLUME;
				sound.play().catch(() => {});
			}
		}
	}, [taskStatusGroups.done.length, shouldReduceMotion]);
	// oxlint-enable react-doctor/no-adjust-state-on-prop-change

	useEffect(() => {
		if (!celebratingEmoji) return;
		const timerId = setTimeout(() => setCelebratingEmoji(null), CELEBRATION_HOLD_MS);
		return () => clearTimeout(timerId);
	}, [celebratingEmoji]);

	useEffect(() => {
		if (runStatus !== "running" || !runCreatedAt) return;
		const intervalId = setInterval(() => setNowMs(Date.now()), 1000);
		return () => clearInterval(intervalId);
	}, [runCreatedAt, runStatus]);

	const elapsedSeconds = useMemo(
		() => getElapsedSeconds(runCreatedAt ?? null, runCompletedAt ?? null, nowMs),
		[nowMs, runCompletedAt, runCreatedAt]
	);

	const statusGroups = useMemo(() => buildStatusGroups(taskStatusGroups), [taskStatusGroups]);
	const runStatusLabel = getRunStatusLabel(runStatus);
	const runStatusToneClass = getRunStatusToneClass(runStatus);
	const statusText = runStatus === "running" ? `${agentCount} ${agentCount === 1 ? "agent" : "agents"} cooking` : runStatusLabel;
	const progressValue = useMemo(() => {
		const totalTaskCount =
			taskStatusGroups.done.length +
			taskStatusGroups.inReview.length +
			taskStatusGroups.inProgress.length +
			taskStatusGroups.failed.length +
			taskStatusGroups.todo.length;
		if (totalTaskCount === 0) {
			return runStatus === "completed" ? 100 : 0;
		}

		const weightedProgress =
			taskStatusGroups.done.length * 1.0 +
			taskStatusGroups.inReview.length * 0.75 +
			taskStatusGroups.inProgress.length * 0.5;

		return Math.round((weightedProgress / totalTaskCount) * 100);
	}, [runStatus, taskStatusGroups]);
	const handleCardActivate = () => {
		if (isCollapsible) {
			setCollapsed((prev) => !prev);
		}
		onCardClick?.();
	};

	const handleRetryGroup = useCallback(
		async (group: StatusGroup) => {
			if (!onRetryGroup || !isRetryableStatusGroupKey(group.key)) {
				return;
			}
			if (retryingGroupKey) {
				return;
			}

			setRetryingGroupKey(group.key);
			try {
				await onRetryGroup(
					group.key,
					group.tasks.map((task) => task.id)
				);
			} finally {
				setRetryingGroupKey(null);
			}
		},
		[onRetryGroup, retryingGroupKey]
	);

	return (
		<div
			className={cn(
				"group/card w-full max-w-sm overflow-hidden rounded-2xl bg-surface-raised shadow-sm transition-shadow duration-medium hover:shadow-xl",
				!isInteractive && "cursor-default",
				className
			)}
			onClick={isInteractive ? handleCardActivate : undefined}
			onKeyDown={isInteractive ? (e: React.KeyboardEvent) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					handleCardActivate();
				}
			} : undefined}
			role={isInteractive ? "button" : undefined}
			tabIndex={isInteractive ? 0 : undefined}
		>
			<style dangerouslySetInnerHTML={CARD_ANIMATION_INNER_HTML} />
			<div className="flex flex-col gap-3 px-4 py-3">
				<div className="flex items-center justify-between gap-3">
					<div className="flex min-w-0 flex-1 items-center gap-3">
						<div className="relative shrink-0">
							{showSummaryRainbow ? (
								<span
									aria-hidden="true"
									className="pointer-events-none absolute inset-0 rounded-tile motion-reduce:hidden"
									style={{
										background: SUMMARY_RING_SEGMENTED_GRADIENT,
										mask: SUMMARY_RING_MASK,
										WebkitMask: SUMMARY_RING_MASK,
										animation: `rainbow-ring-spin ${SUMMARY_RING_DURATION} ${SUMMARY_RING_EASING} infinite`,
										willChange: "transform",
									}}
								/>
							) : null}
							<VisualIdentityTile
								decorative
								className="relative z-10"
								label={planTitle}
								size="medium"
								visualIdentity={resolvedPlanVisualIdentity}
							/>
						</div>
						<div className="flex min-w-0 flex-1 flex-col gap-1">
							<div className="flex min-w-0 items-center gap-1">
								<span style={{ font: token("font.heading.xsmall") }} className="truncate text-text">
									{planTitle}
								</span>
								<span className="shrink-0 text-xs leading-4 text-text-subtlest">•</span>
								<span className="shrink-0 text-xs leading-4 text-text-subtlest">{formatElapsedTime(elapsedSeconds)}</span>
							</div>
							<Progress
								aria-label="Run progress"
								value={progressValue}
								variant="inverse"
								className="w-full"
							/>
						</div>
					</div>
					{runStatus === "running" ? (
						<Button aria-label="Stop execution" size="icon" variant="outline" className="rounded-full text-icon-danger" onClick={(e) => e.stopPropagation()}>
							<VideoStopOverlayIcon label="" />
						</Button>
					) : onDelete ? (
						<span className="hidden group-hover/card:block" onClick={(e) => e.stopPropagation()} role="presentation">
							<Button
								aria-label="Delete run"
								variant="ghost"
								size="icon"
								className="rounded-full text-icon-subtle hover:text-icon"
								onClick={onDelete}
							>
								<DeleteIcon label="" />
							</Button>
						</span>
					) : null}
				</div>

					{!collapsed ? (
						<div className="flex items-center gap-1">
							<span className="text-xs leading-4 text-text-subtlest">
								{runCount} {runCount === 1 ? "task" : "tasks"}
							</span>
							<span className="text-xs leading-4 text-text-subtlest">•</span>
							{runStatus === "running" ? (
								<>
									<span className="inline-flex items-baseline text-xs leading-4 text-text-subtlest">
										{statusText}
										<AnimatedDot className="[&>span]:text-xs" />
									</span>
								</>
							) : (
								<span className={cn("text-xs leading-4", runStatusToneClass)}>{runStatusLabel}</span>
							)}
						</div>
					) : null}
			</div>

			{!collapsed ? (
				<div className="mx-1 mb-1 rounded-b-xl rounded-t-md bg-surface-sunken p-2">
					<div className="flex flex-col">
						{statusGroups
							.filter((group) => group.tasks.length > 0)
							.map((group, index, visible) => {
								const isLast = index === visible.length - 1;
								const canRetry = Boolean(
									onRetryGroup &&
									isRetryableStatusGroupKey(group.key) &&
									group.key === "failed"
								);
								return (
									<div key={group.key} className="flex gap-1">
										<div className="flex w-5 shrink-0 flex-col items-center">
											<div className="flex h-8 shrink-0 items-center justify-center">
												<TaskStatusIcon
													status={group.iconStatus}
													celebratingEmoji={group.key === "done" ? celebratingEmoji : undefined}
													shouldReduceMotion={shouldReduceMotion ?? false}
												/>
											</div>
											{!isLast ? <div className="min-h-2 w-px flex-1 bg-border" /> : null}
										</div>
										<TaskGroupRow
											label={group.label}
											count={group.tasks.length}
											tasks={group.tasks}
											defaultExpanded={group.defaultExpanded}
											onRetry={canRetry ? () => handleRetryGroup(group) : undefined}
											retryLabel={
												group.key === "failed" ? "Retry failed tasks" : "Retry tasks"
											}
											isRetrying={
												group.key === retryingGroupKey
											}
										/>
									</div>
								);
							})}
					</div>
				</div>
			) : null}
		</div>
	);
}
