"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import CopyIcon from "@atlaskit/icon/core/copy";
import MergeFailureIcon from "@atlaskit/icon/core/merge-failure";
import MergeSuccessIcon from "@atlaskit/icon/core/merge-success";
import PullRequestIcon from "@atlaskit/icon/core/pull-request";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import StatusErrorIcon from "@atlaskit/icon/core/status-error";
import StatusInformationIcon from "@atlaskit/icon/core/status-information";
import StatusSuccessIcon from "@atlaskit/icon/core/status-success";
import UndoIcon from "@atlaskit/icon/core/undo";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AtlassianLogoMark, BrandLogoMark } from "@/components/ui/logo-mark";
import { Lozenge, type LozengeProps } from "@/components/ui/lozenge";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/utils";

import type {
	PullRequestHeaderMergeMethod,
	PullRequestHeaderMergeState,
	PullRequestHeaderProps,
	PullRequestHeaderStatus,
} from "@/components/blocks/pull-request-header/components/pull-request-header-types";
import {
	DEFAULT_COLLAPSE_OFFSET,
	resolveVariant,
} from "@/components/blocks/pull-request-header/components/pull-request-header-variant";
import { motionEase } from "@/lib/motion";

const DEFAULT_MERGE_STATE: PullRequestHeaderMergeState = "ready";
const DEFAULT_MERGE_METHOD: PullRequestHeaderMergeMethod = "squash";
const DEFAULT_AUTO_MERGE = true;
const MERGE_METHOD_VALUES = [
	"squash",
	"merge",
	"rebase",
] as const satisfies ReadonlyArray<PullRequestHeaderMergeMethod>;
const META_ENTER_TRANSITION = {
	duration: 0.2,
	ease: motionEase.out,
} as const; // duration-medium + ease-out
const META_EXIT_TRANSITION = {
	duration: 0.1,
	ease: motionEase.in,
} as const; // duration-fast + ease-in
const LAYOUT_TRANSITION = {
	duration: 0.2,
	ease: motionEase.inOut,
} as const; // duration-medium + ease-in-out
const INSTANT_TRANSITION = { duration: 0 } as const;
const TITLE_SIZE_TRANSITION =
	"transition-[font-size] duration-medium ease-in-out motion-reduce:transition-none";

function statusLozengeVariant(
	status: PullRequestHeaderStatus,
): NonNullable<LozengeProps["variant"]> {
	switch (status) {
		case "Open":
			return "success";
		case "Merged":
			return "discovery";
		default: {
			const _exhaustive: never = status;
			return _exhaustive;
		}
	}
}

function mergeMethodLabel(method: PullRequestHeaderMergeMethod): string {
	switch (method) {
		case "squash":
			return "Squash and merge";
		case "merge":
			return "Create a merge commit";
		case "rebase":
			return "Rebase and merge";
		default: {
			const _exhaustive: never = method;
			return _exhaustive;
		}
	}
}

function mergeStateLabel(mergeState: PullRequestHeaderMergeState): string {
	switch (mergeState) {
		case "checks-failed":
			return "Checks failed";
		case "checks-running":
			return "Checks running";
		case "merge-conflicts":
			return "Merge conflicts";
		case "review-required":
			return "Require approval";
		case "ready":
			// Primary stays a short "Merge"; the chevron menu still picks the method.
			return "Merge";
		default: {
			const _exhaustive: never = mergeState;
			return _exhaustive;
		}
	}
}

/** Leading status icon for the merge primary — matches PR rail CI check icons. */
function mergeStateLeadingIcon(mergeState: PullRequestHeaderMergeState) {
	switch (mergeState) {
		case "checks-failed":
			return (
				<span
					className="grid size-4 shrink-0 place-items-center text-icon-danger"
					data-icon="inline-start"
				>
					<StatusErrorIcon color="currentColor" label="" size="small" />
				</span>
			);
		case "checks-running":
			return (
				<span
					className="grid size-4 shrink-0 place-items-center"
					data-icon="inline-start"
				>
					<Spinner size="xs" />
				</span>
			);
		case "merge-conflicts":
			return (
				<span
					className="grid size-4 shrink-0 place-items-center text-icon-danger"
					data-icon="inline-start"
				>
					<MergeFailureIcon color="currentColor" label="" size="small" />
				</span>
			);
		case "review-required":
			return (
				<span
					className="grid size-4 shrink-0 place-items-center text-icon-information"
					data-icon="inline-start"
				>
					<StatusInformationIcon color="currentColor" label="" size="small" />
				</span>
			);
		case "ready":
			return (
				<span
					className="grid size-4 shrink-0 place-items-center text-icon-success"
					data-icon="inline-start"
				>
					<StatusSuccessIcon color="currentColor" label="" size="small" />
				</span>
			);
		default: {
			const _exhaustive: never = mergeState;
			return _exhaustive;
		}
	}
}

function isMergePrimaryEnabled({
	mergeState,
	onChecksFailedClick,
	onChecksRunningClick,
	onMergeConflictsClick,
	onMergeClick,
	onReviewRequiredClick,
}: Readonly<{
	mergeState: PullRequestHeaderMergeState;
	onChecksFailedClick?: () => void;
	onChecksRunningClick?: () => void;
	onMergeConflictsClick?: () => void;
	onMergeClick?: () => void;
	onReviewRequiredClick?: () => void;
}>): boolean {
	switch (mergeState) {
		case "ready":
			return Boolean(onMergeClick);
		case "checks-failed":
			return Boolean(onChecksFailedClick);
		case "checks-running":
			return Boolean(onChecksRunningClick);
		case "review-required":
			return Boolean(onReviewRequiredClick);
		case "merge-conflicts":
			return Boolean(onMergeConflictsClick);
		default: {
			const _exhaustive: never = mergeState;
			return _exhaustive;
		}
	}
}

/** Maps a PR URL hostname onto an SCM product label for “Open in …”. */
function resolveScmProviderName(url: string | undefined): string {
	if (!url) {
		return "source control";
	}

	try {
		const host = new URL(url).hostname.toLowerCase();
		if (host.includes("bitbucket.")) {
			return "Bitbucket";
		}
		if (host.includes("gitlab.")) {
			return "GitLab";
		}
		if (host.includes("github.")) {
			return "GitHub";
		}
	} catch {
		// Fall through for non-URL strings.
	}

	return "source control";
}

function copyPullRequestUrl(url: string) {
	void navigator.clipboard.writeText(url);
}

function openPullRequestUrl(url: string) {
	window.open(url, "_blank", "noopener,noreferrer");
}

function ScmProviderMark({ name }: Readonly<{ name: string }>) {
	const normalizedName = name.toLowerCase();
	if (normalizedName.includes("bitbucket")) {
		return <AtlassianLogoMark frame="chip" label={name} name="bitbucket" />;
	}
	if (normalizedName.includes("gitlab")) {
		return <BrandLogoMark frame="chip" label={name} name="gitlab" />;
	}
	if (normalizedName.includes("github")) {
		return (
			<BrandLogoMark frame="chip" label={name} name="github" />
		);
	}

	return (
		<span className="text-icon-subtle">
			<PullRequestIcon color="currentColor" label="" size="small" />
		</span>
	);
}

function CompactPullRequestStatusIcon({
	status,
}: Readonly<{ status: PullRequestHeaderStatus }>) {
	switch (status) {
		case "Open":
			return (
				<span
					className="grid size-4 shrink-0 place-items-center text-icon-success"
					title="Pull request open"
				>
					<PullRequestIcon
						color="currentColor"
						label="Pull request open"
						size="small"
					/>
				</span>
			);
		case "Merged":
			return (
				<span
					className="grid size-4 shrink-0 place-items-center text-icon-accent-purple"
					title="Pull request merged"
				>
					<MergeSuccessIcon
						color="currentColor"
						label="Pull request merged"
						size="small"
					/>
				</span>
			);
		default: {
			const _exhaustive: never = status;
			return _exhaustive;
		}
	}
}

/** Renders `folder/leaf` with parent path segments in subtlest text. */
function BranchName({ name }: Readonly<{ name: string }>) {
	const separatorIndex = name.lastIndexOf("/");
	if (separatorIndex === -1) {
		return <span className="text-text">{name}</span>;
	}

	const parentPath = name.slice(0, separatorIndex + 1);
	const leaf = name.slice(separatorIndex + 1);

	return (
		<span className="text-text">
			<span className="text-text-subtlest">{parentPath}</span>
			{leaf}
		</span>
	);
}

/**
 * Full-width pull-request detail header: `#N` + title with a Merge split
 * button (primary label + Auto merge menu) and More actions menu, plus a
 * collapsible meta row for status, repository, and branch direction.
 */
export function PullRequestHeader({
	variant,
	scrollContainerRef,
	collapseOffset = DEFAULT_COLLAPSE_OFFSET,
	tabNavigation,
	number,
	title,
	status,
	baseBranch,
	headBranch,
	repository,
	url,
	scmProviderName,
	mergeState = DEFAULT_MERGE_STATE,
	mergeMethod,
	defaultMergeMethod = DEFAULT_MERGE_METHOD,
	onMergeMethodChange,
	autoMerge,
	defaultAutoMerge = DEFAULT_AUTO_MERGE,
	onAutoMergeChange,
	onMergeClick,
	onChecksFailedClick,
	onChecksRunningClick,
	onMergeConflictsClick,
	onReviewRequiredClick,
	submitReviewAction,
	onConvertToDraftClick,
	onClosePullRequestClick,
	className,
	style,
	...props
}: Readonly<PullRequestHeaderProps>) {
	const shouldReduceMotion = useReducedMotion() ?? false;
	const [uncontrolledMergeMethod, setUncontrolledMergeMethod] =
		useState(defaultMergeMethod);
	const [uncontrolledAutoMerge, setUncontrolledAutoMerge] =
		useState(defaultAutoMerge);
	const selectedMergeMethod = mergeMethod ?? uncontrolledMergeMethod;
	const autoMergeEnabled = autoMerge ?? uncontrolledAutoMerge;
	const subscribeToScroll = useCallback(
		(onStoreChange: () => void) => {
			const scrollContainer = scrollContainerRef?.current;
			if (variant || !scrollContainer) {
				return () => undefined;
			}

			scrollContainer.addEventListener("scroll", onStoreChange, {
				passive: true,
			});
			return () =>
				scrollContainer.removeEventListener("scroll", onStoreChange);
		},
		[scrollContainerRef, variant],
	);
	const getResolvedVariant = useCallback(
		() => resolveVariant({
			variant,
			scrollContainerRef,
			collapseOffset,
		}),
		[collapseOffset, scrollContainerRef, variant],
	);
	const resolvedVariant = useSyncExternalStore(
		subscribeToScroll,
		getResolvedVariant,
		() => variant ?? "expanded",
	);
	const enterTransition = shouldReduceMotion
		? INSTANT_TRANSITION
		: META_ENTER_TRANSITION;
	const exitTransition = shouldReduceMotion
		? INSTANT_TRANSITION
		: META_EXIT_TRANSITION;
	const branchPair =
		baseBranch && headBranch
			? { baseBranch, headBranch }
			: null;
	const titleSizeClass =
		resolvedVariant === "compact" ? "text-sm" : "text-base";

	const handleMergeMethodChange = (method: PullRequestHeaderMergeMethod) => {
		if (mergeMethod === undefined) {
			setUncontrolledMergeMethod(method);
		}
		onMergeMethodChange?.(method);
	};

	const handleAutoMergeChange = (enabled: boolean) => {
		if (autoMerge === undefined) {
			setUncontrolledAutoMerge(enabled);
		}
		onAutoMergeChange?.(enabled);
	};

	const primaryEnabled = isMergePrimaryEnabled({
		mergeState,
		onChecksFailedClick,
		onChecksRunningClick,
		onMergeConflictsClick,
		onMergeClick,
		onReviewRequiredClick,
	});
	const resolvedScmProviderName =
		scmProviderName ?? resolveScmProviderName(url);
	const openInScmLabel = `Open in ${resolvedScmProviderName}`;
	const hasPullRequestUrl = Boolean(url);
	const canMutatePullRequest = status === "Open";
	const handlePrimaryClick = () => {
		switch (mergeState) {
			case "ready":
				onMergeClick?.();
				return;
			case "checks-failed":
				onChecksFailedClick?.();
				return;
			case "checks-running":
				onChecksRunningClick?.();
				return;
			case "review-required":
				onReviewRequiredClick?.();
				return;
			case "merge-conflicts":
				onMergeConflictsClick?.();
				return;
			default: {
				const _exhaustive: never = mergeState;
				return _exhaustive;
			}
		}
	};

	return (
		<motion.header
			className={cn(
				"border-border",
				tabNavigation
					? "pt-4"
					: "border-b pb-4",
				className,
			)}
			layout={shouldReduceMotion ? false : true}
			transition={
				shouldReduceMotion
					? { layout: INSTANT_TRANSITION }
					: { layout: LAYOUT_TRANSITION }
			}
			style={style}
			{...props}
		>
			<motion.div
				className={tabNavigation ? "px-4" : undefined}
				layout={shouldReduceMotion ? false : "position"}
				transition={{ layout: LAYOUT_TRANSITION }}
			>
				<motion.div
					className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
					layout={shouldReduceMotion ? false : "position"}
					transition={{ layout: LAYOUT_TRANSITION }}
				>
					<div className="flex min-w-0 flex-nowrap items-center gap-x-2 gap-y-1 sm:flex-1">
						<span className="inline-flex shrink-0 items-center gap-1">
							{resolvedVariant === "compact" ? (
								<CompactPullRequestStatusIcon status={status} />
							) : null}
							<span
								className={cn(
									"shrink-0 font-normal text-text-subtlest",
									TITLE_SIZE_TRANSITION,
									titleSizeClass,
								)}
							>
								#{number}
							</span>
						</span>
						<h1
							className={cn(
								"min-w-0 flex-1 truncate font-medium text-text",
								TITLE_SIZE_TRANSITION,
								titleSizeClass,
							)}
						>
							{title}
						</h1>
					</div>
					<ButtonGroup
						aria-label="Pull request actions"
						className="w-full flex-wrap gap-2 sm:w-auto sm:shrink-0"
						variant="separated"
					>
						{canMutatePullRequest ? (
							<ButtonGroup variant="split">
								<Button
									disabled={!primaryEnabled}
									onClick={handlePrimaryClick}
									variant="outline"
								>
									{mergeStateLeadingIcon(mergeState)}
									{mergeStateLabel(mergeState)}
								</Button>
								<DropdownMenu>
									<DropdownMenuTrigger
										render={
											<Button
												aria-label="Merge options"
												size="icon"
												variant="outline"
											/>
										}
									>
										<ChevronDownIcon label="" size="small" />
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										{MERGE_METHOD_VALUES.map((value) => (
											<DropdownMenuItem
												key={value}
												onSelect={() => {
													handleMergeMethodChange(value);
												}}
												selected={value === selectedMergeMethod}
											>
												{mergeMethodLabel(value)}
											</DropdownMenuItem>
										))}
										<DropdownMenuSeparator />
										<DropdownMenuItem
											closeOnClick={false}
											disabled={!onAutoMergeChange}
											elemAfter={
												<Switch
													checked={autoMergeEnabled}
													disabled={!onAutoMergeChange}
													label="Auto merge"
													// Keep the Switch out of the menu's tabbable set.
													// Otherwise FloatingFocusManager's initialFocus lands on
													// it (menuitems are tabIndex -1 until highlighted), which
													// falsely highlights Auto merge on pointer open.
													tabIndex={-1}
													onCheckedChange={handleAutoMergeChange}
													onClick={(event) => {
														// Avoid double-toggle: Switch already flipped via
														// onCheckedChange; don't also run item onSelect.
														event.stopPropagation();
													}}
													onPointerDown={(event) => {
														// Keep the menu open while toggling; Base UI treats a
														// prevented press that starts inside the popup as
														// intentional and suppresses the follow-up dismiss.
														event.preventDefault();
													}}
													size="sm"
												/>
											}
											onSelect={(event) => {
												event.preventDefault();
												if (!onAutoMergeChange) {
													return;
												}
												handleAutoMergeChange(!autoMergeEnabled);
											}}
										>
											Auto merge
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</ButtonGroup>
						) : (
							<Button aria-label="Revert pull request" variant="outline">
								<UndoIcon label="" size="small" />
								Revert PR
							</Button>
						)}
						{canMutatePullRequest && submitReviewAction ? (
							<Button
								aria-label={submitReviewAction.ariaLabel}
								disabled={submitReviewAction.disabled}
								onClick={submitReviewAction.onClick}
								variant="outline"
							>
								{submitReviewAction.label}
								{submitReviewAction.badge ? (
									<Badge
										aria-hidden
										className="tabular-nums"
										max={false}
										variant="neutral"
									>
										{submitReviewAction.badge}
									</Badge>
								) : null}
							</Button>
						) : null}
						<ButtonGroup>
							<DropdownMenu>
								<DropdownMenuTrigger
									render={
										<Button
											aria-label="More actions"
											size="icon"
											variant="outline"
										/>
									}
								>
									<ShowMoreHorizontalIcon label="" size="small" />
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem
										disabled={!hasPullRequestUrl}
										elemBefore={<CopyIcon label="" size="small" />}
										onSelect={() => {
											if (!url) {
												return;
											}
											copyPullRequestUrl(url);
										}}
									>
										Copy link
									</DropdownMenuItem>
									<DropdownMenuItem
										disabled={!hasPullRequestUrl}
										elemBefore={<ScmProviderMark name={resolvedScmProviderName} />}
										onSelect={() => {
											if (!url) {
												return;
											}
											openPullRequestUrl(url);
										}}
									>
										{openInScmLabel}
									</DropdownMenuItem>
									{canMutatePullRequest ? (
										<>
											<DropdownMenuSeparator />
											<DropdownMenuItem
												disabled={!onConvertToDraftClick}
												elemBefore={
													<span className="text-icon-subtle">
														<PullRequestIcon
															color="currentColor"
															label=""
															size="small"
														/>
													</span>
												}
												onSelect={() => {
													onConvertToDraftClick?.();
												}}
											>
												Convert to draft
											</DropdownMenuItem>
											<DropdownMenuItem
												disabled={!onClosePullRequestClick}
												elemBefore={
													<span className="text-icon-danger">
														<MergeFailureIcon
															color="currentColor"
															label=""
															size="small"
														/>
													</span>
												}
												onSelect={() => {
													onClosePullRequestClick?.();
												}}
												variant="destructive"
											>
												Close pull request
											</DropdownMenuItem>
										</>
									) : null}
								</DropdownMenuContent>
							</DropdownMenu>
						</ButtonGroup>
					</ButtonGroup>
				</motion.div>
				<AnimatePresence initial={false} mode="popLayout">
					{resolvedVariant === "expanded" ? (
						<motion.div
							animate={{ opacity: 1, transform: "translateY(0px)" }}
							className="overflow-hidden"
								exit={{
									opacity: 0,
									transform: "translateY(-4px)",
									transition: exitTransition,
								}}
								initial={{ opacity: 0, transform: "translateY(-4px)" }}
								key="pull-request-header-meta"
								transition={enterTransition}
							>
								<motion.div
									className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs text-text-subtle"
									layout={shouldReduceMotion ? false : "position"}
									transition={{ layout: LAYOUT_TRANSITION }}
								>
									<Lozenge variant={statusLozengeVariant(status)}>
										{status}
									</Lozenge>
									<Tag
										color="gray"
										elemBefore={
											<BrandLogoMark frame="chip" label="GitHub" name="github" />
										}
										maxWidth="14rem"
									>
										{repository}
									</Tag>
									{branchPair ? (
										<span className="inline-flex min-w-0 items-center overflow-hidden">
											{/* Head truncates; base stays full (`main`, not `m…`). */}
											<span className="min-w-0 truncate">
												<BranchName name={branchPair.headBranch} />
											</span>
											<span aria-hidden className="shrink-0 px-1 text-text-subtle">
												→
											</span>
											<span className="shrink-0">
												<BranchName name={branchPair.baseBranch} />
											</span>
										</span>
									) : null}
								</motion.div>
							</motion.div>
						) : null}
					</AnimatePresence>
				</motion.div>
			{tabNavigation ? (
				<motion.div
					className={cn(
						// Pull the strip 1px over the header's bottom border so the
						// shared line-tab indicator (`after:h-0.5` / 2px) sits on that
						// grey rule. Keep the after fully inside this box (`after:bottom-0`)
						// — `overflow-x-auto` would otherwise clip a negative bottom offset.
						"relative z-10 -mb-px mt-4 shrink-0 overflow-x-auto overscroll-x-contain transition-[padding-left,padding-right] duration-medium ease-in-out motion-reduce:transition-none [&_[data-slot=tabs-list]]:border-b-0 [&_[data-slot=tabs-trigger]]:after:bottom-0",
						resolvedVariant === "compact"
							? "px-[clamp(1rem,calc(30%-4rem),16rem)]"
							: "px-[clamp(1rem,calc(20%-4rem),11rem)]",
					)}
					layout={shouldReduceMotion ? false : "position"}
					transition={{ layout: LAYOUT_TRANSITION }}
				>
					{tabNavigation}
				</motion.div>
			) : null}
		</motion.header>
	);
}
