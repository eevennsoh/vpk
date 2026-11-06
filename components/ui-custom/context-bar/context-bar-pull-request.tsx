"use client";

import type { ComponentProps, ReactNode } from "react";
import PullRequestIcon from "@atlaskit/icon/core/pull-request";

import {
	PullRequest,
	type PullRequestAuthor,
	type PullRequestStatus,
} from "@/components/blocks/pull-request";
import { ContextBar } from "@/components/ui-custom/context-bar/context-bar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Icon } from "@/components/ui/icon";
import { Lozenge, type LozengeProps } from "@/components/ui/lozenge";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import { ContextBarPullRequestAutomation } from "./context-bar-pull-request-ci";
import {
	contextBarPullRequestCiPresentation,
	contextBarPullRequestMergePresentation,
	type ContextBarPullRequestCi,
	type ContextBarPullRequestMergeState,
} from "./context-bar-pull-request-ci-model";

export type ContextBarPullRequestStatus = PullRequestStatus;
export type {
	ContextBarPullRequestCi,
	ContextBarPullRequestCiCheck,
	ContextBarPullRequestCiStatus,
	ContextBarPullRequestMergeState,
} from "./context-bar-pull-request-ci-model";

export interface ContextBarPullRequestProps extends Omit<ComponentProps<"div">, "children"> {
	number: number;
	href: string;
	title: string;
	status: PullRequestStatus;
	branch: string;
	additions: number;
	deletions: number;
	repository?: string;
	targetBranch?: string;
	author?: PullRequestAuthor;
	filesChanged?: number;
	/** Status lozenge. Defaults to on, or to CI-running when `ci` is set. */
	showStatusLozenge?: boolean;
	/** Optional repo label between the number and the branch. */
	showRepository?: boolean;
	/** Override the status-derived number color. */
	numberClassName?: string;
	/** CI checks menu: status, check rows, auto-fix / auto-merge. */
	ci?: ContextBarPullRequestCi;
	mergeState?: ContextBarPullRequestMergeState;
	approvalsCurrent?: number;
	approvalsRequired?: number;
	/** Extra trailing chrome after the CI menu, before dismiss. */
	actions?: ReactNode;
	onDismiss?: () => void;
	dismissLabel?: string;
}

function statusLozengeVariant(status: PullRequestStatus): NonNullable<LozengeProps["variant"]> {
	switch (status) {
		case "Open":
			return "success";
		case "Merged":
			return "discovery";
		case "Draft":
			return "neutral";
		case "Failed":
			return "danger";
		default: {
			const _exhaustive: never = status;
			return _exhaustive;
		}
	}
}

function defaultNumberClassName(status: PullRequestStatus): string {
	switch (status) {
		case "Open":
			return "text-text-success";
		case "Merged":
			return "font-medium text-text-discovery";
		case "Draft":
			return "text-text-subtle";
		case "Failed":
			return "text-text-danger";
		default: {
			const _exhaustive: never = status;
			return _exhaustive;
		}
	}
}

function BranchLabel({ name }: Readonly<{ name: string }>) {
	const slashIndex = name.indexOf("/");
	if (slashIndex === -1) {
		return name;
	}

	return (
		<>
			<span className="text-text-subtle">{name.slice(0, slashIndex + 1)}</span>
			<span className="text-text">{name.slice(slashIndex + 1)}</span>
		</>
	);
}

function PullRequestNumberLink({
	additions,
	author,
	branch,
	className,
	deletions,
	filesChanged,
	href,
	number,
	status,
	targetBranch,
	title,
}: Readonly<{
	additions: number;
	author?: PullRequestAuthor;
	branch: string;
	className: string;
	deletions: number;
	filesChanged?: number;
	href: string;
	number: number;
	status: PullRequestStatus;
	targetBranch?: string;
	title: string;
}>) {
	return (
		<HoverCard closeDelay={80} openDelay={120}>
			<HoverCardTrigger
				render={(
					<a
						className={cn(
							"shrink-0 text-sm no-underline decoration-current outline-none hover:underline focus-visible:underline focus-visible:ring-3 focus-visible:ring-ring/50",
							className,
						)}
						data-pr-number-link
						href={href}
					/>
				)}
			>
				#{number}
			</HoverCardTrigger>
			<HoverCardContent
				align="start"
				className="w-auto overflow-hidden rounded-xl border-0 bg-surface-overlay p-0 text-text shadow-none"
				positionerClassName="z-[600]"
				side="top"
				sideOffset={8}
				style={{ boxShadow: token("elevation.shadow.overlay") }}
			>
				<PullRequest
					additions={additions}
					author={author}
					branch={branch}
					className="border-0 bg-transparent shadow-none"
					deletions={deletions}
					filesChanged={filesChanged}
					number={number}
					status={status}
					targetBranch={targetBranch}
					title={title}
					variant="flyout"
				/>
			</HoverCardContent>
		</HoverCard>
	);
}

/**
 * Composer-facing pull-request variation of `ContextBar`: status + hoverable
 * `#N` (flyout PR card) + branch + diff stats + optional CI menu,
 * with the shared dismiss affordance.
 */
export function ContextBarPullRequest({
	actions,
	additions,
	approvalsCurrent,
	approvalsRequired,
	author,
	branch,
	ci,
	className,
	deletions,
	dismissLabel = "Dismiss pull request context",
	filesChanged,
	href,
	mergeState,
	number,
	numberClassName,
	onDismiss,
	repository,
	showRepository,
	showStatusLozenge,
	status,
	targetBranch,
	title,
	...props
}: Readonly<ContextBarPullRequestProps>): React.ReactElement {
	const compact = ci?.status === "running";
	const resolvedShowStatusLozenge = showStatusLozenge ?? (ci === undefined ? true : compact);
	const resolvedShowRepository = showRepository ?? (ci !== undefined && !compact);
	const resolvedNumberClassName = numberClassName ?? defaultNumberClassName(status);
	const ciPresentation = ci === undefined ? null : contextBarPullRequestCiPresentation(ci.status);
	const mergePresentation = mergeState === undefined
		? null
		: contextBarPullRequestMergePresentation(mergeState);
	const approvalLabel = approvalsCurrent === undefined || approvalsRequired === undefined
		? null
		: `${approvalsCurrent} of ${approvalsRequired} approvals`;
	const regionLabel = [
		`Pull request #${number}`,
		status,
		ciPresentation?.label,
		approvalLabel,
		mergePresentation?.label,
	].filter((part): part is string => part != null).join(". ");

	return (
		<ContextBar
			aria-label={regionLabel}
			className={cn(
				"mb-2 w-full max-w-[calc(100vw-7rem)] gap-2 overflow-hidden px-2.5 py-0 sm:max-w-full",
				className,
			)}
			data-approvals-current={approvalsCurrent}
			data-approvals-required={approvalsRequired}
			data-auto-fix-enabled={ci?.autoFixEnabled}
			data-auto-merge-enabled={ci?.autoMergeEnabled}
			data-ci-status={ci?.status}
			data-merge-state={mergeState}
			data-pr-context-bar
			data-pr-number={String(number)}
			dismissLabel={dismissLabel}
			onDismiss={onDismiss}
			role="region"
			{...props}
		>
			{resolvedShowStatusLozenge ? (
				<Lozenge
					className="[&_[data-slot=lozenge-leading-icon]]:size-3 [&_[data-slot=lozenge-leading-icon]_svg]:size-3"
					elemBefore={(
						<Icon
							aria-hidden
							render={<PullRequestIcon color="currentColor" label="" size="small" />}
						/>
					)}
					variant={statusLozengeVariant(status)}
				>
					{status}
				</Lozenge>
			) : (
				<span aria-hidden className="flex shrink-0 items-center gap-1 text-icon-subtle">
					<PullRequestIcon color="currentColor" label="" size="small" />
				</span>
			)}
			<PullRequestNumberLink
				additions={additions}
				author={author}
				branch={branch}
				className={resolvedNumberClassName}
				deletions={deletions}
				filesChanged={filesChanged}
				href={href}
				number={number}
				status={status}
				targetBranch={targetBranch}
				title={title}
			/>
			{resolvedShowRepository && repository ? (
				<span className="hidden max-w-36 shrink-0 truncate text-sm text-text-subtle sm:inline" title={repository}>
					{repository}
				</span>
			) : null}
			<span className="min-w-0 flex-1 truncate text-sm text-text-subtle" title={branch}>
				{resolvedShowStatusLozenge ? <BranchLabel name={branch} /> : branch}
			</span>
			<span className="hidden shrink-0 items-center gap-1 rounded-lg bg-surface px-2 py-1 font-mono text-xs sm:inline-flex">
				<span className="sr-only">{additions} additions and {deletions} deletions</span>
				<span aria-hidden className="text-text-success">+{additions}</span>
				<span aria-hidden className="text-text-danger">−{deletions}</span>
			</span>
			{ci === undefined ? null : (
				<ContextBarPullRequestAutomation
					approvalsCurrent={approvalsCurrent}
					approvalsRequired={approvalsRequired}
					ci={ci}
					compact={compact}
					mergeState={mergeState}
				/>
			)}
			{actions}
		</ContextBar>
	);
}
