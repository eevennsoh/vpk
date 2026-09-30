"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ProgressRovo } from "@/components/ui-custom/progress-rovo";
import { ProgressCircle } from "@/components/ui-custom/progress-circle";
import { VisualIdentityTile } from "@/components/projects/shared/components/visual-identity-tile";
import { resolvePlanVisualIdentity } from "@/components/projects/shared/lib/plan-identity";
import type { VisualIdentity } from "@/components/projects/shared/lib/visual-identity";
import { shouldShowIndeterminateTaskProgressBar } from "@/components/blocks/task-progress/lib/progress-bar-state";
import VideoStopOverlayIcon from "@atlaskit/icon/core/video-stop-overlay";
import DeleteIcon from "@atlaskit/icon/core/delete";
import SuccessIcon from "@atlaskit/icon/core/success";
import { MOCK_TASKS, flattenStatusGroups, type ProgressStatusGroups, type FlatTask } from "./data/mock-tasks";
import { formatElapsedTime, getElapsedSeconds, resolveInitialNowMs } from "@/lib/elapsed-time";
import { motionEase } from "@/lib/motion";

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

type RunStatus = "running" | "completed" | "failed";
type IconStatus = "done" | "in-progress" | "failed" | "todo";

function TaskStatusIcon({
	status,
	animated = true,
}: Readonly<{
	status: IconStatus;
	animated?: boolean;
}>) {
	const [filling, setFilling] = useState(false);
	const [prevStatus, setPrevStatus] = useState(status);

	if (status !== prevStatus) {
		setPrevStatus(status);
		if (status === "done" && animated) {
			setFilling(true);
		} else {
			setFilling(false);
		}
	}

	useEffect(() => {
		if (!filling) return;
		const timerId = setTimeout(() => setFilling(false), 500);
		return () => clearTimeout(timerId);
	}, [filling]);

	// Group in-progress and filling under the same key so the ProgressCircle
	// instance stays mounted — this lets motion.circle animate the dashoffset
	// fill from 25% to 100% when transitioning from spinner to full ring.
	const isProgress = status === "in-progress" || (status === "done" && filling);

	return (
		<AnimatePresence mode="wait" initial={false}>
			{isProgress ? (
				<motion.span
					key="progress"
					exit={{ opacity: 0, scale: 0.5 }}
					transition={{ duration: 0.15, ease: "easeOut" }}
					className="flex items-center justify-center"
				>
					<ProgressCircle
						value={status === "done" ? 100 : null}
						showCompleteIcon={false}
						size="sm"
						variant="outline"
						label={status === "done" ? "Completing" : "In progress"}
					/>
				</motion.span>
			) : status === "done" ? (
				<motion.span
					key="done"
					initial={animated ? { opacity: 0, scale: 0.5 } : false}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
					className="flex items-center justify-center"
				>
					<ProgressCircle value={100} size="sm" variant="outline" label="Complete" animated={animated} />
				</motion.span>
			) : status === "failed" ? (
				<motion.span
					key="failed"
					initial={{ opacity: 0, scale: 0.5 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ type: "spring", duration: 0.3, bounce: 0.2 }}
					className="flex items-center justify-center"
				>
					<ProgressCircle status="error" size="sm" label="Failed" />
				</motion.span>
			) : (
				<motion.span
					key="todo"
					className="flex items-center justify-center"
				>
					<ProgressCircle value={0} size="sm" variant="outline" label="Not started" />
				</motion.span>
			)}
		</AnimatePresence>
	);
}

const TimelineTaskItem = memo(function TimelineTaskItem({
	task,
	isLast,
	animated = true,
}: Readonly<{
	task: FlatTask;
	isLast: boolean;
	animated?: boolean;
}>) {
	const isDone = task.status === "done";
	return (
		<div className="flex gap-3">
			{/* icon column + connector line */}
			<div className="flex w-5 shrink-0 flex-col items-center">
				<div className="flex h-5 shrink-0 items-center justify-center">
					<TaskStatusIcon status={task.status} animated={animated} />
				</div>
				{!isLast ? (
					<div className="min-h-2 w-px flex-1 bg-border" />
				) : null}
			</div>

			{/* text */}
			<div className="flex min-w-0 flex-1 flex-col pb-2">
				<span
					className={cn(
						"text-sm leading-5",
						isDone ? "text-text-subtlest" : "text-text",
						task.status === "in-progress" ? "font-medium" : "font-normal",
					)}
				>
					{task.label}
				</span>
				{task.description.trim().length > 0 ? (
					<span className="text-xs leading-4 text-text-subtlest">
						{task.description}
					</span>
				) : null}
			</div>
		</div>
	);
});

interface TaskProgressProps {
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
	showRunningStopButton?: boolean;
	className?: string;
}

export default function TaskProgress({
	planTitle = "Untitled task run",
	planVisualIdentity,
	taskStatusGroups = MOCK_TASKS,
	runStatus = "running",
	runCreatedAt = new Date(Date.now() - 651_000).toISOString(),
	runCompletedAt = null,
	initialNowMs,
	showSummaryRainbow = false,
	defaultCollapsed = false,
	isCollapsible = true,
	onCardClick,
	onDelete,
	showRunningStopButton = true,
	className,
}: Readonly<TaskProgressProps>) {
	const [collapsed, setCollapsed] = useState(defaultCollapsed);
	const [dismissed, setDismissed] = useState(false);
	const [nowMs, setNowMs] = useState(() =>
		resolveInitialNowMs({
			initialNowMs,
			runCreatedAt: runCreatedAt ?? null,
			runCompletedAt: runCompletedAt ?? null,
		})
	);
	const isInteractive = isCollapsible || typeof onCardClick === "function";

	useEffect(() => {
		if (runStatus !== "running" || !runCreatedAt) return;
		const intervalId = setInterval(() => setNowMs(Date.now()), 1000);
		return () => clearInterval(intervalId);
	}, [runCreatedAt, runStatus]);

	const elapsedSeconds = useMemo(
		() => getElapsedSeconds(runCreatedAt ?? null, runCompletedAt ?? null, nowMs),
		[nowMs, runCompletedAt, runCreatedAt]
	);

	const flatTasks = useMemo(() => flattenStatusGroups(taskStatusGroups), [taskStatusGroups]);
	const resolvedPlanVisualIdentity = useMemo(
		() => planVisualIdentity ?? resolvePlanVisualIdentity(planTitle),
		[planTitle, planVisualIdentity]
	);

	// Track which task IDs have already rendered as "done" so we only animate the
	// check icon on the first transition — not on expand/collapse remounts.
	const seenDoneIdsRef = useRef<Set<string> | null>(null);
	if (seenDoneIdsRef.current === null) {
		seenDoneIdsRef.current = new Set();
	}
	const seenDoneIds = seenDoneIdsRef.current;

	useEffect(() => {
		for (const task of flatTasks) {
			if (task.status === "done") {
				seenDoneIds.add(task.id);
			}
		}
	}, [flatTasks, seenDoneIds]);

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
	const showIndeterminateProgressBar = useMemo(
		() =>
			shouldShowIndeterminateTaskProgressBar({
				runStatus,
				taskStatusGroups,
			}),
		[runStatus, taskStatusGroups],
	);

	const handleCardActivate = () => {
		if (isCollapsible) {
			setCollapsed((prev) => !prev);
		}
		onCardClick?.();
	};
	const cardAriaLabel = `${planTitle} task progress`;

	return (
		<AnimatePresence
			onExitComplete={() => {
				onDelete?.();
			}}
		>
			{!dismissed ? (
				<motion.div
					className="w-full max-w-[800px]"
					initial={false}
					exit={{ opacity: 0, y: 40 }}
					transition={{ duration: 0.3, ease: motionEase.inOut }}
					style={{ willChange: "transform, opacity" }}
				>
					<div
						className={cn(
							"group/card w-full overflow-hidden rounded-xl bg-surface-raised shadow-xl transition-shadow duration-200 hover:shadow-2xl",
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
						aria-expanded={isCollapsible ? !collapsed : undefined}
						aria-label={isInteractive ? cardAriaLabel : undefined}
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
										<AnimatePresence initial={false}>
											{runStatus !== "completed" ? (
												<motion.div
													key="progress-bar"
													initial={{ opacity: 1, scaleY: 1 }}
													exit={{ opacity: 0, scaleY: 0 }}
													transition={{ duration: 0.3, ease: "easeInOut" }}
													className="origin-top overflow-hidden"
												>
													<ProgressRovo
														aria-label="Run progress"
														isIndeterminate={showIndeterminateProgressBar}
														value={progressValue}
														className="w-full"
													/>
												</motion.div>
											) : null}
										</AnimatePresence>
									</div>
								</div>
								{runStatus === "running" && showRunningStopButton ? (
									<Button aria-label="Stop execution" size="icon" variant="outline" className="rounded-full text-icon-danger" onClick={(e) => e.stopPropagation()}>
										<VideoStopOverlayIcon label="" size="small" />
									</Button>
								) : onDelete ? (
									<span className={runStatus === "completed" ? "block" : "hidden group-hover/card:block"}>
										{runStatus === "completed" ? (
											<Button
												variant="ghost"
												size="default"
												className="[&_svg]:!text-icon-success"
												onClick={(e) => {
													e.stopPropagation();
													setDismissed(true);
												}}
											>
												<SuccessIcon label="" size="small" />
												Done
											</Button>
										) : (
											<Button
												aria-label="Delete run"
												variant="ghost"
												size="icon"
												className="rounded-full text-icon-subtle hover:text-icon"
												onClick={(e) => {
													e.stopPropagation();
													onDelete();
												}}
											>
												<DeleteIcon size="small" label="" />
											</Button>
										)}
									</span>
								) : null}
							</div>
						</div>

						{!collapsed ? (
							<div className="mx-1 mb-1 max-h-[200px] overflow-y-auto rounded-b-xl rounded-t-md bg-surface-sunken px-4 pt-3">
								<div className="flex flex-col">
									{flatTasks.map((task, index) => (
										<TimelineTaskItem
											key={task.id}
											task={task}
											isLast={index === flatTasks.length - 1}
											animated={task.status === "done" && !seenDoneIds.has(task.id)}
										/>
									))}
								</div>
							</div>
						) : null}
					</div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
