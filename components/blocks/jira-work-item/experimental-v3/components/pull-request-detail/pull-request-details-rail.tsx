"use client";

import { useEffect, useState, type KeyboardEvent, type MouseEvent } from "react";

import CalendarIcon from "@atlaskit/icon/core/calendar";
import CopyIcon from "@atlaskit/icon/core/copy";
import PeopleGroupIcon from "@atlaskit/icon/core/people-group";
import TagIcon from "@atlaskit/icon/core/tag";

import { ArtifactPane, ArtifactPanePropertyRow } from "@/components/blocks/artifact-pane";
import { useMetadataRail } from "@/components/blocks/jira-work-item/experimental-v3/context-metadata-rail";
import {
	type PullRequestCheck,
	type PullRequestCommit,
	type PullRequestDetailData,
	type PullRequestPerson,
	type PullRequestReviewer,
} from "@/components/blocks/jira-work-item/experimental-v3/lib/pull-request-detail-data";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
	AvatarStatusIndicator,
	type AvatarStatus,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Tag, TagGroup } from "@/components/ui/tag";
import { cn } from "@/lib/utils";

import { ChecksSectionTitle, PullRequestChecksList } from "@/components/blocks/pull-request/components/pull-request-checks-list";

function copyCommitSha(event: MouseEvent<HTMLButtonElement>, sha: string) {
	event.preventDefault();
	event.stopPropagation();
	void navigator.clipboard.writeText(sha);
}

function openScmUrl(url: string) {
	window.open(url, "_blank", "noopener,noreferrer");
}

function handleScmLinkKeyDown(event: KeyboardEvent<HTMLElement>, url: string) {
	// Keys from a button inside the row (Copy commit, Fix) belong to that button.
	if (event.target !== event.currentTarget) return;
	if (event.key === "Enter" || event.key === " ") {
		event.preventDefault();
		openScmUrl(url);
	}
}

/** ArtifactPane section id for the CI checks disclosure. */
export const PULL_REQUEST_CHECKS_SECTION_ID = "pull-request-checks";

const REVIEWER_STATUS = {
	approved: { label: "Approved", tone: "success" },
	"changes-requested": { label: "Changes requested", tone: "danger" },
	commented: { label: "Commented", tone: "information" },
	pending: { label: "Pending", tone: "neutral" },
} as const;

function reviewerAvatarStatus(status: PullRequestReviewer["status"]): AvatarStatus | null {
	switch (status) {
		case "approved":
			return "approved";
		case "changes-requested":
			return "declined";
		case "commented":
		case "pending":
			return null;
		default: {
			const _exhaustive: never = status;
			return _exhaustive;
		}
	}
}

function PersonAvatar({ person, size = "sm" }: Readonly<{ person: PullRequestPerson; size?: "xs" | "sm" }>) {
	const isAgent = person.kind === "agent";
	return (
		<Avatar label={person.name} shape={isAgent ? "hexagon" : "circle"} size={size}>
			{person.avatarSrc ? <AvatarImage alt="" src={person.avatarSrc} /> : null}
			<AvatarFallback>{person.name.slice(0, 1).toUpperCase()}</AvatarFallback>
		</Avatar>
	);
}

function ApproversValue({ reviewers }: Readonly<{ reviewers: readonly PullRequestReviewer[] }>) {
	if (reviewers.length === 0) {
		return <span className="text-text-subtle">No approvers requested</span>;
	}

	return (
		<div
			aria-label={`Approvers: ${reviewers
				.map((reviewer) => `${reviewer.name} (${REVIEWER_STATUS[reviewer.status].label})`)
				.join(", ")}`}
			className="flex items-center gap-1"
			data-jira-work-item-pull-request-reviewers
			role="group"
		>
			{reviewers.map((reviewer) => {
				const status = REVIEWER_STATUS[reviewer.status];
				const avatarStatus = reviewerAvatarStatus(reviewer.status);
				const isAgent = reviewer.kind === "agent";
				return (
					<Avatar
						key={reviewer.id}
						label={`${reviewer.name}, ${status.label}`}
						shape={isAgent ? "hexagon" : "circle"}
						size="default"
						title={`${reviewer.name}: ${status.label}`}
					>
						{reviewer.avatarSrc ? <AvatarImage alt="" src={reviewer.avatarSrc} /> : null}
						<AvatarFallback>{reviewer.name.slice(0, 1).toUpperCase()}</AvatarFallback>
						{avatarStatus ? <AvatarStatusIndicator status={avatarStatus} /> : null}
					</Avatar>
				);
			})}
		</div>
	);
}

function CommitsValue({ commits }: Readonly<{ commits: readonly PullRequestCommit[] }>) {
	if (commits.length === 0) {
		return <p className="text-xs text-text-subtle">No commits available</p>;
	}

	return (
		<ul className="flex flex-col" data-jira-work-item-pull-request-commits>
			{commits.map((commit) => {
				const commitUrl = commit.url;
				return (
					<li className="min-w-0" key={commit.id}>
						<div
							className={cn(
								"group -mx-2 flex w-[calc(100%+1rem)] min-w-0 flex-col rounded-md px-2 py-2 transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered motion-reduce:transition-none",
								commitUrl ? "cursor-pointer" : null,
							)}
							role={commitUrl ? "link" : undefined}
							tabIndex={commitUrl ? 0 : undefined}
							onClick={
								commitUrl
									? () => {
											openScmUrl(commitUrl);
										}
									: undefined
							}
							onKeyDown={
								commitUrl
									? (event) => {
											handleScmLinkKeyDown(event, commitUrl);
										}
									: undefined
							}
						>
							<div className="flex min-w-0 items-center gap-2">
								<span className="min-w-0 flex-1 text-sm text-text">{commit.title}</span>
								<span className="inline-flex shrink-0 items-center gap-1 text-xs tabular-nums">
									<span className="text-text-success">+{commit.additions}</span>
									<span className="text-text-danger">-{commit.deletions}</span>
								</span>
							</div>
							<div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-text-subtlest">
								<span className="flex min-w-0 items-center gap-1.5">
									<PersonAvatar person={commit.author} size="xs" />
									<span className="min-w-0 truncate">{commit.author.name}</span>
								</span>
								<span aria-hidden>·</span>
								<span className="shrink-0">{commit.timestamp}</span>
								<span aria-hidden>·</span>
								<span className="inline-flex shrink-0 items-center gap-1.5">
									<code className="cursor-pointer font-mono text-text-subtlest hover:underline">
										{commit.shortSha}
									</code>
									<Button
										aria-label={`Copy commit ${commit.shortSha}`}
										className={cn(
											"size-3! min-h-0 min-w-0 p-0 text-icon-subtle hover:bg-transparent hover:text-icon",
											"pointer-events-none opacity-0 transition-opacity duration-normal ease-out-practical",
											"group-hover:pointer-events-auto group-hover:opacity-100",
											"group-has-[:focus-visible]:pointer-events-auto group-has-[:focus-visible]:opacity-100",
											"focus-visible:pointer-events-auto focus-visible:opacity-100",
											"motion-reduce:transition-none",
										)}
										size="icon-compact"
										type="button"
										variant="ghost"
										onClick={(event) => {
											copyCommitSha(event, commit.shortSha);
										}}
									>
										<Icon aria-hidden className="size-3" render={<CopyIcon label="" size="small" />} />
									</Button>
								</span>
							</div>
						</div>
					</li>
				);
			})}
		</ul>
	);
}

/** Provider-neutral pull-request metadata rendered in the shared artifact rail. */
export function PullRequestDetailsRail({
	data,
	onFixCheck,
}: Readonly<{
	data: PullRequestDetailData;
	onFixCheck?: (checks: readonly PullRequestCheck[]) => void;
}>) {
	const {
		consumePullRequestSectionExpandRequest,
		pullRequestSectionExpandRequest,
	} = useMetadataRail();
	// Review lands on PR Details with CI checks open — the chapter's primary
	// beat — instead of a collapsed count summary that needs a header click.
	const [openSectionIds, setOpenSectionIds] = useState<ReadonlySet<string>>(
		() => new Set([PULL_REQUEST_CHECKS_SECTION_ID]),
	);
	const passedChecks = data.checks.filter((check) => check.status === "passed").length;
	const failedCheckItems = data.checks.filter((check) => check.status === "failed");
	const failedChecks = failedCheckItems.length;
	const author: PullRequestPerson = {
		id: "pull-request-author",
		name: data.authorName,
		avatarSrc: data.authorAvatarSrc,
		kind: data.authorKind,
	};

	useEffect(() => {
		if (
			!pullRequestSectionExpandRequest ||
			pullRequestSectionExpandRequest.pullRequestIdentity !== data.identity
		) {
			return;
		}
		const { nonce, sectionId } = pullRequestSectionExpandRequest;
		setOpenSectionIds((current) => {
			if (current.has(sectionId)) {
				return current;
			}
			const next = new Set(current);
			next.add(sectionId);
			return next;
		});
		consumePullRequestSectionExpandRequest(nonce);
	}, [consumePullRequestSectionExpandRequest, data.identity, pullRequestSectionExpandRequest]);

	return (
		<ArtifactPane
			aria-label={`Pull request #${data.number} details`}
			borderless
			className="[&>div:first-child]:pt-0"
			onOpenSectionIdsChange={setOpenSectionIds}
			openSectionIds={openSectionIds}
			showSeparators={false}
			sections={[
				{
					collapsible: false,
					defaultOpen: true,
					id: "pull-request-details",
					title: "Details",
					content: (
						<div className="flex flex-col gap-2" data-jira-work-item-pull-request-details>
							<ArtifactPanePropertyRow editable={false} icon={<PeopleGroupIcon label="" size="small" />} label="Approvers">
								<ApproversValue reviewers={data.reviewers} />
							</ArtifactPanePropertyRow>
							<ArtifactPanePropertyRow editable={false} icon={<CalendarIcon label="" size="small" />} label="Created">
								<span className="flex min-w-0 items-center gap-2">
									<PersonAvatar person={author} size="xs" />
									<span>{data.createdTime}</span>
								</span>
							</ArtifactPanePropertyRow>
							<ArtifactPanePropertyRow editable={false} icon={<CalendarIcon label="" size="small" />} label="Updated">
								<span>{data.updatedTime}</span>
							</ArtifactPanePropertyRow>
							<ArtifactPanePropertyRow editable={false} icon={<TagIcon label="" size="small" />} label="Labels">
								{data.labels.length > 0 ? (
									<TagGroup className="gap-1">
										{data.labels.map((label) => <Tag color={label.color} key={label.id}>{label.name}</Tag>)}
									</TagGroup>
								) : <span className="text-text-subtle">No labels</span>}
							</ArtifactPanePropertyRow>
						</div>
					),
				},
				{
					id: PULL_REQUEST_CHECKS_SECTION_ID,
					defaultOpen: true,
					title: (
						<ChecksSectionTitle
							passed={passedChecks}
							total={data.checks.length}
						/>
					),
					// Match per-row Fix visibility: show whenever any check failed.
					// Do not gate on onFixCheck — the host may omit the story callback
					// outside the Fix chapter while failed rows still render Fix.
					// Staging / story advance stay optional via onFixCheck?.
					...(failedChecks > 0
						? {
							headerAction: {
								appearance: "label" as const,
								label: "Fix all",
								onClick: () => onFixCheck?.(failedCheckItems),
								// Always visible when failures exist — not hover-reveal.
								// Far-right + chevron slide live in ArtifactPane.
								reveal: "open" as const,
							},
						}
						: {}),
					content: <PullRequestChecksList checks={data.checks} onFixCheck={onFixCheck} />,
				},
				{
					id: "pull-request-commits",
					title: "Commits",
					count: data.commits.length,
					content: <CommitsValue commits={data.commits} />,
				},
			]}
		/>
	);
}
