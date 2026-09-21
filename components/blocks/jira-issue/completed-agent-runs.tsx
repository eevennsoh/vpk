"use client";

import { useState } from "react";

import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import StatusErrorIcon from "@atlaskit/icon/core/status-error";
import StatusSuccessIcon from "@atlaskit/icon/core/status-success";

import {
	AgentList,
	type AgentListItem,
	toAgentSessionFlyoutItem,
} from "@/components/blocks/agent-list";
import type { JiraIssueAgentActivityIndicatorRenderer } from "@/components/blocks/jira-issue/agent-activity";
import type { JiraIssueAgentActivityLayout } from "@/components/blocks/jira-issue/agent-activity-model";
import {
	createJiraSessionFlyoutHandle,
	JiraSessionFlyoutSurface,
	JiraSessionFlyoutTrigger,
} from "@/components/blocks/product-sidebar/variants/jira-session-flyout";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import type { ArtifactListItem } from "@/components/ui-custom/artifact-list";
import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { IconTile } from "@/components/ui/icon-tile";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

export type JiraIssueCompletedAgentRunState = "done" | "failed" | "review";

export interface JiraIssueCompletedAgentRun {
	id: string;
	summary: string;
	description?: string;
	agentName: string;
	agentAvatarSrc?: string;
	agentBrandName?: ThirdPartyLogoName;
	invokedBy?: AgentListItem["invokedBy"];
	issueKey: string;
	issueSummary: string;
	/** Legacy preformatted fallback when no completion timestamp is available. */
	relativeTime?: string;
	completedAtMs?: number;
	/** Demo-friendly age that continues advancing after mount. */
	completedSecondsAgo?: number;
	elapsedSeconds?: number;
	pullRequestNumber?: number;
	outputs?: readonly ArtifactListItem[];
	actionLabel?: "Open" | "View";
	state: JiraIssueCompletedAgentRunState;
}

function toCompletedAgentListItem(run: JiraIssueCompletedAgentRun): AgentListItem {
	return {
		agent: {
			avatarSrc: run.agentAvatarSrc,
			brandName: run.agentBrandName,
			id: run.id,
			name: run.agentName,
		},
		completedAtMs: run.completedAtMs,
		completedSecondsAgo: run.completedSecondsAgo,
		elapsedSeconds: run.elapsedSeconds,
		id: run.id,
		...(run.invokedBy ? { invokedBy: run.invokedBy } : {}),
		state: "complete",
		sessionDetails: {
			branch: `rovo/${run.issueKey.toLowerCase()}-completed-run`,
			checks: { failed: run.state === "failed" ? 1 : 0, passed: 12 },
			commit: "8c2f4e1",
			host: "cloud",
			issueKey: run.issueKey,
			issueSummary: run.issueSummary,
			pullRequestNumber: run.pullRequestNumber,
			repository: "payments-platform/payments",
		},
		title: run.summary,
	};
}

function getCompletedRunInitial(name: string): string {
	return name.trim()[0]?.toUpperCase() ?? "A";
}

/**
 * One finished run as its own chin row, mirroring the split working rows: the
 * run's own agent avatar, its summary, and a per-run outcome icon. Hovering a
 * row opens that run's detail card instead of the shared aggregate list.
 *
 * A host renderer owns the finished glyph when one is supplied, so a design
 * variation can say "success" in its own vocabulary. Without a renderer the
 * row falls back to the filled success status. Failed always stays the
 * block's filled error status.
 */
function JiraIssueCompletedRunRow({
	label,
	onView,
	renderAgentActivityIndicator,
	run,
	showFlyout = true,
}: Readonly<{
	/** Overrides the run summary, e.g. a single merged chin that just says Finished. */
	label?: string;
	onView?: (run: JiraIssueCompletedAgentRun) => void;
	renderAgentActivityIndicator?: JiraIssueAgentActivityIndicatorRenderer;
	run: JiraIssueCompletedAgentRun;
	showFlyout?: boolean;
}>) {
	const [flyoutHandle] = useState(createJiraSessionFlyoutHandle);
	const hasFailed = run.state === "failed";
	const outcomeLabel = hasFailed ? "failed" : "finished";
	const displayText = label ?? run.summary;
	const session = toAgentSessionFlyoutItem(toCompletedAgentListItem(run));
	const trigger = (
		<button
			aria-label={label ? `${run.agentName} ${label}` : `${run.agentName} ${outcomeLabel}: ${run.summary}`}
			className="flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1 text-left outline-none transition-colors duration-fast ease-out hover:bg-bg-neutral-subtle-hovered active:bg-bg-neutral-subtle-pressed focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
			data-slot="jira-issue-agent-row"
			onClick={showFlyout ? undefined : () => onView?.(run)}
			type="button"
		>
			<span className="flex min-w-0 flex-1 items-center gap-2">
				<AgentAvatarVisual
					avatarClassName="shrink-0"
					avatarSrc={run.agentAvatarSrc}
					brandName={run.agentBrandName}
					fallbackText={getCompletedRunInitial(run.agentName)}
					label={run.agentName}
					sizePx={24}
				/>
				<span className="block min-w-0 flex-1 truncate text-sm leading-5 text-text">
					{displayText}
				</span>
			</span>
			<span
				className={cn(
					"grid size-6 shrink-0 place-items-center",
					hasFailed ? "text-icon-danger" : "text-icon-subtle",
				)}
				aria-hidden="true"
			>
				{hasFailed ? (
					<StatusErrorIcon color="currentColor" label="" size="small" />
				) : renderAgentActivityIndicator ? (
					renderAgentActivityIndicator("finished")
				) : (
					<StatusSuccessIcon color={token("color.icon.success")} label="" size="small" />
				)}
			</span>
		</button>
	);

	if (!showFlyout) {
		return trigger;
	}

	return (
		<>
			<JiraSessionFlyoutTrigger
				closeDelay={80}
				delay={120}
				handle={flyoutHandle}
				onClick={() => onView?.(run)}
				render={trigger}
				session={{ ...session, status: run.state === "failed" ? "stopped" : session.status }}
			/>
			<JiraSessionFlyoutSurface handle={flyoutHandle} />
		</>
	);
}

export function JiraIssueAgentDone({
	layout = "merged",
	...props
}: Readonly<{
	layout?: JiraIssueAgentActivityLayout;
	onOpenChange?: (open: boolean) => void;
	onReview?: (run: JiraIssueCompletedAgentRun) => void;
	onSubmit?: (run: JiraIssueCompletedAgentRun, prompt: string) => void;
	onView?: (run: JiraIssueCompletedAgentRun) => void;
	renderAgentActivityIndicator?: JiraIssueAgentActivityIndicatorRenderer;
	runs: readonly JiraIssueCompletedAgentRun[];
	usesStrokeChrome: boolean;
}>) {
	if (layout === "split") {
		return (
			<section aria-label="Agent review" className="flex w-full min-w-0 flex-col overflow-hidden px-1 py-1">
				{props.runs.map((run) => (
					<JiraIssueCompletedRunRow
						key={run.id}
						onView={props.onView}
						renderAgentActivityIndicator={props.renderAgentActivityIndicator}
						run={run}
					/>
				))}
			</section>
		);
	}

	if (props.runs.length === 1) {
		const run = props.runs[0];
		if (!run) {
			return null;
		}
		return (
			<section aria-label="Agent review" className="flex w-full min-w-0 flex-col overflow-hidden px-1 py-1">
				<JiraIssueCompletedRunRow
					label={run.state === "failed" ? "Failed" : "Finished"}
					onView={props.onView}
					renderAgentActivityIndicator={props.renderAgentActivityIndicator}
					run={run}
					showFlyout={false}
				/>
			</section>
		);
	}

	return (
		<JiraIssueAgentDoneMerged
			onOpenChange={props.onOpenChange}
			onView={props.onView}
			renderAgentActivityIndicator={props.renderAgentActivityIndicator}
			runs={props.runs}
			usesStrokeChrome={props.usesStrokeChrome}
		/>
	);
}

/** Compact / original experimental only. Comfortable (v2) never mounts this. */
function JiraIssueAgentDoneMerged({
	onOpenChange,
	onView,
	renderAgentActivityIndicator,
	runs,
	usesStrokeChrome,
}: Readonly<{
	onOpenChange?: (open: boolean) => void;
	onView?: (run: JiraIssueCompletedAgentRun) => void;
	/**
	 * Host-owned finished glyph for the aggregate "Finished" chin. It paints
	 * in the trailing status slot, same as working/awaiting-input. Without it
	 * the slot stays empty; a failed aggregate still uses the trailing error
	 * so success never paints over a failure.
	 */
	renderAgentActivityIndicator?: JiraIssueAgentActivityIndicatorRenderer;
	runs: readonly JiraIssueCompletedAgentRun[];
	usesStrokeChrome: boolean;
}>) {
	const [aggregateOpen, setAggregateOpen] = useState(false);
	const finishedLabel = "Finished";
	const hasFailedRun = runs.some((run) => run.state === "failed");
	const finishedIndicator = !hasFailedRun && renderAgentActivityIndicator
		? renderAgentActivityIndicator("finished")
		: null;
	const completedItems = runs.map(toCompletedAgentListItem);

	function handleAggregateOpenChange(open: boolean) {
		setAggregateOpen(open);
		onOpenChange?.(open);
	}

	function findRun(item: AgentListItem): JiraIssueCompletedAgentRun | undefined {
		return runs.find((run) => run.id === item.id);
	}

	function handleCompletedRunView(item: AgentListItem) {
		const run = findRun(item);
		if (!run) {
			return;
		}
		handleAggregateOpenChange(false);
		onView?.(run);
	}

	return (
		<section aria-label="Agent review" className="flex w-full min-w-0 flex-col overflow-hidden px-1 py-1">
			<HoverCard open={aggregateOpen} onOpenChange={handleAggregateOpenChange}>
				<HoverCardTrigger
					closeDelay={80}
					delay={120}
					render={(
						<button
							aria-expanded={aggregateOpen}
							aria-label={hasFailedRun ? `${finishedLabel}, includes errors` : finishedLabel}
							className="flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-b-[6px] rounded-t-sm px-2 py-1 text-left outline-none transition-colors duration-fast ease-out hover:bg-bg-neutral-subtle-hovered active:bg-bg-neutral-subtle-pressed focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
							data-slot="jira-issue-agent-row"
							type="button"
						>
							<span className="flex min-w-0 flex-1 items-center gap-2">
								{usesStrokeChrome ? (
									<IconTile
									aria-hidden
									as="span"
									className="text-icon-subtle"
									icon={<AiAgentIcon label="" size="small" />}
									iconSize="medium"
									label=""
									size="small"
									variant="transparent"
								/>
							) : (
								<span className="grid size-6 shrink-0 place-items-center text-text-subtlest" aria-hidden="true">
									<AiAgentIcon label="" />
								</span>
							)}
							<span className="truncate text-sm leading-5 text-text">
									{finishedLabel}
								</span>
							</span>
							{hasFailedRun ? (
								<span
								className="grid size-6 shrink-0 place-items-center text-icon-danger"
									aria-hidden="true"
								>
									<StatusErrorIcon color="currentColor" label="" size="small" />
								</span>
							) : finishedIndicator ? (
								<span
								className="grid size-6 shrink-0 place-items-center text-icon-subtle"
									aria-hidden="true"
								>
									{finishedIndicator}
								</span>
							) : null}
						</button>
					)}
				/>
				<HoverCardContent
					align="start"
					alignOffset={0}
					className="w-[320px] max-w-[calc(100vw-48px)] bg-transparent p-0 shadow-none data-ending-style:transition-none"
					positionerClassName="z-[575] after:pointer-events-auto after:absolute after:-inset-2 after:-z-10 after:content-['']"
					side="right"
					sideOffset={8}
				>
					<AgentList
						className="w-full border-0 bg-surface-overlay shadow-2xl"
					flyout="session"
					items={completedItems}
					onView={handleCompletedRunView}
						variant="compact"
					/>
				</HoverCardContent>
			</HoverCard>
		</section>
	);
}
