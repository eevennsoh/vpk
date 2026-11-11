"use client";

import ArrowRightIcon from "@atlaskit/icon/core/arrow-right";
import BranchIcon from "@atlaskit/icon/core/branch";
import FileIcon from "@atlaskit/icon/core/file";
import MergeFailureIcon from "@atlaskit/icon/core/merge-failure";
import MergeSuccessIcon from "@atlaskit/icon/core/merge-success";
import PullRequestIcon from "@atlaskit/icon/core/pull-request";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AgentListAttributionAvatarGroup } from "@/components/blocks/agent-list/agent-list-identity";
import {
	PullRequestFlyoutChecks,
	PullRequestChecksSummary,
	PullRequestFlyoutMetaRow,
} from "@/components/blocks/pull-request/components/pull-request-flyout-parts";
import { Button, buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { AtlassianLogoMark, BrandLogoMark } from "@/components/ui/logo-mark";
import { Lozenge, type LozengeProps } from "@/components/ui/lozenge";
import { pullRequestReviewersLabel } from "@/components/blocks/pull-request/lib/pull-request-reviewers-label";
import { toCompactRelativeTimeLabel } from "@/lib/elapsed-time";
import { cn } from "@/lib/utils";

import type {
	PullRequestAuthor,
	PullRequestProps,
	PullRequestProvider,
	PullRequestStatus,
} from "@/components/blocks/pull-request/components/pull-request-types";

export type {
	PullRequestAuthor,
	PullRequestProps,
	PullRequestReviewers,
	PullRequestStatus,
	PullRequestVariant,
} from "@/components/blocks/pull-request/components/pull-request-types";

function getInitials(name: string): string {
	return name
		.split(/\s+/u)
		.map((part) => part[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
}

function statusLozengeVariant(
	status: PullRequestStatus,
): NonNullable<LozengeProps["variant"]> {
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

/** First path segment stays subtle (`rovo/…`); the remainder uses body text. */
function BranchName({ name }: Readonly<{ name: string }>) {
	const slashIndex = name.indexOf("/");
	if (slashIndex === -1) {
		return <span className="min-w-0 truncate text-text">{name}</span>;
	}

	return (
		<span className="min-w-0 truncate">
			<span className="text-text-subtlest">{name.slice(0, slashIndex + 1)}</span>
			<span className="text-text">{name.slice(slashIndex + 1)}</span>
		</span>
	);
}

function PullRequestAuthorAvatar({
	author,
	size = "sm",
}: Readonly<{ author: PullRequestAuthor; size?: "xs" | "sm" }>) {
	if (author.assistedBy) {
		return <AgentListAttributionAvatarGroup agent={author.assistedBy} appearance="coding" attributedBy={{ name: author.name, avatarSrc: author.avatarUrl }} sizePx={size === "xs" ? 16 : 24} />;
	}
	return (
		<Avatar label={author.name} size={size} shape="circle">
			{author.avatarUrl ? (
				<AvatarImage alt={author.name} src={author.avatarUrl} />
			) : null}
			<AvatarFallback>{getInitials(author.name)}</AvatarFallback>
		</Avatar>
	);
}

function PullRequestDiffStats({
	additions,
	deletions,
	className,
}: Readonly<{ additions: number; deletions: number; className?: string }>) {
	return (
		<span
			aria-label={`${additions} additions, ${deletions} deletions`}
			className={cn(
				"inline-flex shrink-0 items-center text-xs font-medium tabular-nums leading-4",
				className,
			)}
			role="group"
		>
			<span className="text-text-success">+{additions}</span>
			<span className="text-text-danger">-{deletions}</span>
		</span>
	);
}

/** Status lozenge. The spacious card trails the title with it, so it also carries a glyph. */
export function PullRequestStatusLozenge({
	status,
	withIcon = false,
}: Readonly<{ status: PullRequestStatus; withIcon?: boolean }>) {
	const StatusIcon = status === "Merged" ? MergeSuccessIcon : status === "Failed" ? MergeFailureIcon : PullRequestIcon;
	return (
		<Lozenge
			elemBefore={
				withIcon ? (
					<Icon aria-hidden render={<StatusIcon label="" size="small" />} />
				) : undefined
			}
			size="compact"
			variant={statusLozengeVariant(status)}
		>
			{status}
		</Lozenge>
	);
}

function PullRequestGitHubMark() {
	return <BrandLogoMark frame="chip" label="GitHub" name="github" />;
}

function PullRequestProviderMark({ provider }: Readonly<{ provider: PullRequestProvider }>) {
	return provider === "bitbucket" ? (
		<AtlassianLogoMark frame="chip" label="Bitbucket" name="bitbucket" />
	) : (
		<PullRequestGitHubMark />
	);
}

/** `#N` + title as one wrapping text run so line 2 starts under the number. */
export function PullRequestInlineTitle({
	number,
	title,
	href,
	className,
}: Readonly<{ number: number; title: string; href?: string; className?: string }>) {
	return (
		<span className={cn("min-w-0 whitespace-normal text-sm leading-5 font-normal", className)}>
			<span className="text-text-subtlest">#{number} </span>
			{href ? <a className="rounded-sm text-text outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring" href={href} rel="noopener noreferrer" target="_blank">{title}</a> : <span className="text-text hover:underline">{title}</span>}
		</span>
	);
}

function PullRequestBranchPath({
	branch,
	targetBranch,
}: Readonly<{ branch?: string; targetBranch?: string }>) {
	if (!branch && !targetBranch) return null;

	return (
		<span
			aria-label={
				branch && targetBranch
					? `${branch} into ${targetBranch}`
					: (branch ?? targetBranch)
			}
			className="inline-flex min-w-0 shrink items-center gap-1 overflow-hidden text-xs leading-5"
			role="group"
		>
			{/* Source truncates; target/base stays full (`main`, not `m…`). */}
			{branch ? <BranchName name={branch} /> : null}
			{branch && targetBranch ? (
				<span className="inline-flex size-3 shrink-0 items-center justify-center text-icon-subtle">
					<Icon aria-hidden render={<ArrowRightIcon label="" size="small" />} />
				</span>
			) : null}
			{targetBranch ? (
				<span className="shrink-0 text-text">{targetBranch}</span>
			) : null}
		</span>
	);
}

/**
 * Compact body (Figma 3173:2734): leading author avatar, then two rows — `#N` +
 * title with the status lozenge trailing, and a GitHub mark + `source → target`
 * path followed by the files / diff metrics.
 *
 * The lozenge and the diff metrics swapped rows on purpose. Status is the fact
 * a scanner wants next to the title, and it is a fixed-width chip, so it holds
 * the trailing slot without shifting as titles change length; the metrics are
 * three variable-width runs that belong with the rest of the metadata.
 */
function PullRequestDropdownBody({
	number,
	title,
	status,
	author,
	branch,
	targetBranch,
	additions,
	deletions,
	filesChanged,
}: Readonly<
	Pick<
		PullRequestProps,
		| "number"
		| "title"
		| "status"
		| "author"
		| "branch"
		| "targetBranch"
		| "additions"
		| "deletions"
		| "filesChanged"
	>
>) {
	const hasBranchPath = Boolean(branch || targetBranch);

	return (
		<>
			{author ? <PullRequestAuthorAvatar author={author} /> : null}
			<div className="flex min-w-0 flex-1 flex-col">
				<div className="flex min-w-0 items-center gap-2">
					<span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-sm font-medium leading-5">
						<span className="shrink-0 text-text-subtlest">#{number}</span>
						<span className="min-w-0 truncate text-text">{title}</span>
					</span>
					<PullRequestStatusLozenge status={status} />
				</div>
				<div className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden">
					<PullRequestGitHubMark />
					<PullRequestBranchPath branch={branch} targetBranch={targetBranch} />
					{/* The dot only earns its place between two groups. */}
					{hasBranchPath ? (
						<span aria-hidden="true" className="shrink-0 text-sm leading-4 text-text-subtlest">
							·
						</span>
					) : null}
					<span className="flex shrink-0 items-center gap-1">
						{filesChanged != null ? (
							<span className="text-xs leading-4 text-text-subtle tabular-nums">
								{filesChanged} {filesChanged === 1 ? "file" : "files"}
							</span>
						) : null}
						<PullRequestDiffStats
							additions={additions}
							deletions={deletions}
							className="font-normal"
						/>
					</span>
				</div>
			</div>
		</>
	);
}

/**
 * Spacious body (Figma 3173:2888): `#N` + title with the status lozenge
 * trailing on row one, GitHub mark + branch path on row two, and an author /
 * changed-files / diff footer on row three.
 */
function PullRequestSpaciousBody({
	number,
	title,
	status,
	author,
	branch,
	targetBranch,
	additions,
	deletions,
	filesChanged,
}: Readonly<
	Pick<
		PullRequestProps,
		| "number"
		| "title"
		| "status"
		| "author"
		| "branch"
		| "targetBranch"
		| "additions"
		| "deletions"
		| "filesChanged"
	>
>) {
	return (
		<>
			<div className="flex min-w-0 flex-col gap-0">
				{/* The title takes the row and the lozenge trails, right-aligned, the
				    same anchoring the flyout card uses. `flex-1` on the title is what
				    pushes the lozenge out; `Lozenge` is already `shrink-0`, so a long
				    title wraps under itself rather than squeezing the status. */}
				<div className="flex min-w-0 items-start gap-2">
					<PullRequestInlineTitle
						className="flex-1 font-medium"
						number={number}
						title={title}
					/>
					<PullRequestStatusLozenge status={status} withIcon />
				</div>
				<div className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden">
					<PullRequestGitHubMark />
					<PullRequestBranchPath branch={branch} targetBranch={targetBranch} />
				</div>
			</div>
			<div className="flex min-w-0 items-center gap-2">
				{author ? (
					<div className="flex min-w-0 items-center gap-1.5 text-xs leading-4 text-text-subtle">
						<PullRequestAuthorAvatar author={author} size="xs" />
						<span className="min-w-0 truncate">{author.name}</span>
					</div>
				) : null}
				{/* `ms-auto` keeps the metrics trailing-aligned even without an author. */}
				<span className="ms-auto flex shrink-0 items-center gap-1.5">
					{filesChanged != null ? (
						<span className="text-xs leading-4 text-text-subtle tabular-nums">
							{filesChanged} {filesChanged === 1 ? "file" : "files"}
						</span>
					) : null}
					<PullRequestDiffStats
						additions={additions}
						deletions={deletions}
						className="font-normal"
					/>
				</span>
			</div>
		</>
	);
}

/**
 * Flyout body: `#N` + title with the status lozenge trailing, author · time,
 * then a divided section — repository, `source → target` branch path, files /
 * diff and CI checks, followed by Review and failed-check actions.
 */
function PullRequestFlyoutBody({
	number,
	title,
	status,
	showDetails,
	author,
	branch,
	targetBranch,
	additions,
	deletions,
	filesChanged,
	relativeTime,
	provider = "github",
	repository,
	reviewers,
	checks,
	checksExpandable,
	reviewHref,
	showReview,
	showFix,
	href,
	onFix,
}: Readonly<
	Pick<
		PullRequestProps,
		| "number"
		| "title"
		| "status"
		| "showDetails"
		| "author"
		| "branch"
		| "targetBranch"
		| "additions"
		| "deletions"
		| "filesChanged"
		| "relativeTime"
		| "provider"
		| "repository"
		| "reviewers"
		| "checks"
		| "checksExpandable"
		| "reviewHref"
		| "showReview"
		| "showFix"
		| "href"
		| "onFix"
	>
>) {
	const reviewersLabel = reviewers ? pullRequestReviewersLabel(reviewers) : null;
	const authorMeta = author ? (
		<div className="flex min-w-0 items-center gap-1 overflow-hidden text-xs leading-4 text-text-subtlest">
			<div className="flex min-w-0 items-center gap-1.5">
				<PullRequestAuthorAvatar author={author} size="xs" />
				<span className="min-w-0 truncate">{author.name}</span>
			</div>
			{relativeTime ? (
				<>
					<span className="shrink-0">·</span>
					<span className="shrink-0">{toCompactRelativeTimeLabel(relativeTime)}</span>
				</>
			) : null}
			{reviewersLabel ? (
				<>
					<span className="shrink-0">·</span>
					<span className="shrink-0">{reviewersLabel}</span>
				</>
			) : null}
		</div>
	) : relativeTime ? (
		<span className="text-xs leading-4 text-text-subtlest">
			{toCompactRelativeTimeLabel(relativeTime)}
			{reviewersLabel ? ` · ${reviewersLabel}` : null}
		</span>
	) : reviewersLabel ? (
		<span className="text-xs leading-4 text-text-subtlest">{reviewersLabel}</span>
	) : null;
	const hasBranchPath = Boolean(branch || targetBranch);
	const failedChecks = checks?.filter((check) => check.status === "failed") ?? [];
	const showFixAction = showFix && status !== "Merged" && failedChecks.length > 0;
	const hasActions = Boolean(reviewHref || showReview || showFixAction);

	return (
		<>
			<div className="flex w-full min-w-0 items-start gap-3 px-3">
				<div className="flex min-w-0 flex-1 flex-col gap-1">
					<PullRequestInlineTitle href={href} number={number} title={title} />
					{authorMeta}
				</div>
				<PullRequestStatusLozenge status={status} />
			</div>
			{showDetails ? <div className="flex w-full min-w-0 flex-col gap-2 border-t border-border-disabled p-3">
				{repository ? (
					<PullRequestFlyoutMetaRow leading={<PullRequestProviderMark provider={provider} />}>
						<span className="min-w-0 truncate text-xs leading-4 text-text">{repository}</span>
					</PullRequestFlyoutMetaRow>
				) : null}
				{hasBranchPath ? (
					<div className="flex min-w-0 items-center gap-1 text-xs leading-5">
						{/* With a repository row the provider mark leads that row instead. */}
						{repository ? (
							<span aria-hidden="true" className="grid size-4 shrink-0 place-items-center text-icon-subtlest">
								<Icon aria-hidden render={<BranchIcon label="" size="small" />} />
							</span>
						) : (
							<PullRequestProviderMark provider={provider} />
						)}
						<PullRequestBranchPath branch={branch} targetBranch={targetBranch} />
					</div>
				) : null}
				<PullRequestFlyoutMetaRow leading={<Icon aria-hidden render={<FileIcon label="" size="small" />} />}>
					{filesChanged != null ? (
						<span className="text-xs leading-4 text-text-subtle tabular-nums">
							{filesChanged} {filesChanged === 1 ? "file" : "files"}
						</span>
					) : null}
					<PullRequestDiffStats
						additions={additions}
						deletions={deletions}
						className="font-normal"
					/>
				</PullRequestFlyoutMetaRow>
				{checks ? checksExpandable ? <PullRequestFlyoutChecks checks={checks} /> : <PullRequestChecksSummary checks={checks} /> : null}
				{hasActions ? (
					<div className="flex min-w-0 gap-2 pt-1">
						{reviewHref ? (
							<a className={cn(buttonVariants({ variant: "outline" }), "min-w-0 flex-1")} href={reviewHref}>
								Review
							</a>
						) : showReview ? <Button className="min-w-0 flex-1" type="button" variant="outline">Review</Button> : null}
						{showFixAction ? (
							<Button className="min-w-0 flex-1" disabled={!onFix} onClick={onFix ? () => onFix(failedChecks) : undefined} type="button" variant="outline">
								Fix PR
							</Button>
						) : null}
					</div>
				) : null}
			</div> : null}
		</>
	);
}

/**
 * Pull-request summary card in three layouts.
 *
 * - `dropdown`: compact two-row card — author avatar, then `#N` + title with a
 *   trailing status lozenge, then GitHub mark + `source → target` path and the
 *   files / diff metrics.
 * - `spacious`: three rows — wrapping `#N` + title with a trailing status
 *   lozenge (with glyph), then GitHub mark + `source → target` path, then an
 *   author / changed-files / diff footer. Selectable dropdown-style chrome.
 * - `flyout`: overlay card — wrapping `#N` + title with a trailing status
 *   lozenge, author · time, then a divided repository, `source → target`
 *   path, files / diff, and an expandable CI checks section, plus Review and Fix PR actions.
 */
export function PullRequest({
	variant = "dropdown",
	showDetails = true,
	number,
	title,
	status,
	author,
	branch,
	targetBranch,
	additions,
	deletions,
	filesChanged,
	relativeTime,
	provider,
	repository,
	reviewers,
	checks,
	checksExpandable = true,
	reviewHref,
	showReview,
	showFix = true,
	href,
	onFix,
	selected = false,
	onActivate,
	className,
}: Readonly<PullRequestProps>) {
	// Apply selected chrome whenever `selected` is set (e.g. interactive list
	// cards with onActivate). Dropdown options should omit `selected` and keep
	// an idle surface — SelectItem owns activation; the trigger shows state.
	const activeSelected = selected;
	const isFlyout = variant === "flyout";
	const isSpacious = variant === "spacious";
	const body = isFlyout ? (
		<PullRequestFlyoutBody
			additions={additions}
			author={author}
			branch={branch}
			checks={checks}
			checksExpandable={checksExpandable}
			deletions={deletions}
			filesChanged={filesChanged}
			href={href}
			onFix={onFix}
			number={number}
			provider={provider}
			relativeTime={relativeTime}
			repository={repository}
			reviewHref={reviewHref}
			showReview={showReview}
			showFix={showFix}
			showDetails={showDetails}
			reviewers={reviewers}
			status={status}
			targetBranch={targetBranch}
			title={title}
		/>
	) : isSpacious ? (
		<PullRequestSpaciousBody
			additions={additions}
			author={author}
			branch={branch}
			deletions={deletions}
			filesChanged={filesChanged}
			number={number}
			status={status}
			targetBranch={targetBranch}
			title={title}
		/>
	) : (
		<PullRequestDropdownBody
			additions={additions}
			author={author}
			branch={branch}
			deletions={deletions}
			filesChanged={filesChanged}
			number={number}
			status={status}
			targetBranch={targetBranch}
			title={title}
		/>
	);

	const surfaceClassName = cn(
		"flex w-full min-w-0 text-text",
		isFlyout && !showDetails ? "pb-3" : null,
		isFlyout
			? "flex-col items-stretch gap-3 rounded-lg bg-surface-raised pt-3 shadow-2xl"
			: isSpacious
				? "flex-col items-stretch gap-2 rounded-xl border border-border p-3"
				// The trailing inset is halved so the status lozenge sits the same
				// 7px from the border on its top and right edges. `px-3` would
				// hold it 13px off the right while the row padding holds it 7px
				// off the top, and that corner reads as a drift. The leading
				// inset stays 12px — the avatar needs the breathing room.
				: "items-center gap-2 rounded-lg border border-border py-1.5 ps-3 pe-1.5",
		onActivate
			? "cursor-pointer text-left outline-none transition-[background-color,border-color] duration-normal ease-out-practical hover:bg-surface-hovered focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
			: null,
		activeSelected && !isFlyout
			? "border-border-selected bg-bg-selected text-text-selected"
			: null,
		onActivate && activeSelected && !isFlyout
			? "hover:bg-bg-selected-hovered"
			: null,
		className,
	);

	if (onActivate && !isFlyout) {
		return (
			<button
				aria-label={`Pull request #${number}: ${title}`}
				aria-pressed={selected}
				className={surfaceClassName}
				data-pull-request={number}
				data-selected={selected ? "true" : undefined}
				data-variant={variant}
				onClick={onActivate}
				type="button"
			>
				{body}
			</button>
		);
	}

	return (
		<div
			aria-current={selected ? "true" : undefined}
			aria-label={`Pull request #${number}: ${title}`}
			className={surfaceClassName}
			data-pull-request={number}
			data-selected={selected ? "true" : undefined}
			data-variant={variant}
			role="group"
		>
			{body}
		</div>
	);
}
