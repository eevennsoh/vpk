"use client";

import { useMemo, type ReactNode } from "react";

import { AgentSession } from "@/components/blocks/agent-session";
import { JiraIssue, type JiraIssueParticipant } from "@/components/blocks/jira-issue";
import { PulseResizeHandle } from "@/components/blocks/jira-kanban/experimental/pulse/components/pulse-resize-handle";
import { PulseSectionLabel } from "@/components/blocks/jira-kanban/experimental/pulse/components/pulse-signals";
import { usePulseWorkRailResize } from "@/components/blocks/jira-kanban/experimental/pulse/hooks/use-pulse-work-rail-resize";
import {
	GITHUB_BRANCH_SMART_LINK_ICON,
	GITHUB_COMMIT_SMART_LINK_ICON,
	toPullRequestSmartLink,
	type SmartLinkItem,
	type SmartLinkVisual,
} from "@/components/blocks/smart-link";

import { PULSE_SPACE_REPOSITORY } from "../data/pulse-timeline";
import { suggestPulseLooseWorkItemKey } from "../lib/pulse-loose-work-suggestion";
import { toPulseSessionHandlers, toPulseSessionItems } from "../lib/pulse-sessions";
import { resolvePulseWorkItemFace } from "../lib/pulse-work-item-face";
import {
	isPulseGithubLooseWork,
	pulseLooseWorkSource,
	type PulseGithubLooseWork,
	type PulseLooseWork,
	type PulseMember,
	type PulseWorkItem,
} from "../types";

const PULSE_GITHUB_SOURCE_VISUAL: SmartLinkVisual = { kind: "third-party", name: "github" };

/**
 * Pulse work columns — what the team captured in Jira, and what it did not.
 *
 * Everything hangs off one left edge and one right edge: rows pad inward rather
 * than outward, so the section headings and the card borders sit on the same
 * two x positions. The roster and the window's numbers used to live here too;
 * they moved to the board header's facepile and under the headline they
 * describe, which is why this file now only draws work.
 */


function PulseRailEmpty({ children }: Readonly<{ children: ReactNode }>) {
	return <p className="py-1 text-xs text-text-subtlest">{children}</p>;
}

function toUncapturedParticipants(
	item: PulseLooseWork,
	memberLookup: ReadonlyMap<string, PulseMember>,
): JiraIssueParticipant[] {
	return item.memberIds
		.map((id) => memberLookup.get(id))
		.filter((member): member is PulseMember => member !== undefined)
		.map((member) => ({
			id: member.id,
			name: member.name,
			avatarShape: member.kind === "agent" ? "hexagon" : "circle",
			avatarSrc: member.avatarSrc,
		}));
}

function createPulseLooseWorkSmartLink(
	item: PulseGithubLooseWork,
	participants: readonly JiraIssueParticipant[],
): SmartLinkItem {
	const source = pulseLooseWorkSource(item.kind);
	const avatars = participants.map((participant) => ({
		name: participant.name,
		src: participant.avatarSrc,
	}));

	switch (item.kind) {
		case "pull-request": {
			const { pullRequest } = item;
			return {
				...toPullRequestSmartLink({
					id: `pulse-source-${item.id}`,
					number: pullRequest.number,
					title: item.title,
					status: pullRequest.status,
					files: pullRequest.files,
					additions: pullRequest.additions,
					deletions: pullRequest.deletions,
					repository: PULSE_SPACE_REPOSITORY,
					branch: pullRequest.branch,
					targetBranch: "main",
					description: item.detail,
				}),
				title: item.sourceTitle,
				avatars,
			};
		}
		case "branch":
			return {
				id: `pulse-source-${item.id}`,
				href: `https://github.com/${PULSE_SPACE_REPOSITORY}/tree/${item.sourceTitle}`,
				title: item.sourceTitle,
				variant: "generic",
				provider: { name: source, logo: PULSE_GITHUB_SOURCE_VISUAL },
				icon: GITHUB_BRANCH_SMART_LINK_ICON,
				description: item.detail,
				avatars,
			};
		case "commit":
			return {
				id: `pulse-source-${item.id}`,
				href: `https://github.com/${PULSE_SPACE_REPOSITORY}/commit/${item.sourceTitle}`,
				title: item.sourceTitle,
				variant: "generic",
				provider: { name: source, logo: PULSE_GITHUB_SOURCE_VISUAL },
				icon: GITHUB_COMMIT_SMART_LINK_ICON,
				description: item.detail,
				avatars,
			};
		default: {
			const _exhaustive: never = item;
			return _exhaustive;
		}
	}
}

function PulseWorkItemList({
	isWorkItemInteractive,
	members,
	onWorkItemClick,
	selectedMember,
	workItems,
}: Readonly<{
	isWorkItemInteractive?: (workItem: PulseWorkItem) => boolean;
	members: readonly PulseMember[];
	onWorkItemClick?: (workItem: PulseWorkItem) => void;
	selectedMember: PulseMember | null;
	workItems: readonly PulseWorkItem[];
}>) {
	const memberLookup = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
	if (workItems.length === 0) return <PulseRailEmpty>No work items moved in this window.</PulseRailEmpty>;

	// The rail's cards are a read-out, not a board: nothing here opens, moves or
	// toggles, so they stay out of the tab order and advertise no drag.
	return (
		<ul className="flex flex-col gap-2">
			{workItems.map((workItem) => {
				const face = resolvePulseWorkItemFace(workItem, memberLookup, selectedMember);
				const isInteractive = onWorkItemClick !== undefined
					&& (isWorkItemInteractive?.(workItem) ?? true);
				return (
					<li data-work-item-key={workItem.key} key={workItem.key}>
						<JiraIssue appearance="default"
							assigneeAvatarLabel={face.name}
							assigneeAvatarShape={face.kind === "agent" ? "hexagon" : "circle"}
							assigneeAvatarSrc={face.avatarSrc}
							chrome="stroke"
							disabled={!isInteractive}
							draggable={false}
							issueKey={workItem.key}
							onClick={isInteractive ? () => onWorkItemClick(workItem) : undefined}
							priority={workItem.priority}
							showMoreAction={false}
							summary={workItem.summary}
							tabIndex={isInteractive ? undefined : -1}
							tags={workItem.tags}
						/>
					</li>
				);
			})}
		</ul>
	);
}

/**
 * The work rail.
 *
 * The roster and the window's numbers used to live here too. They moved — the
 * roster to the board header's facepile and the faces above the story, the
 * numbers under the headline they describe — leaving this rail to do one job:
 * what the team captured in Jira, and what it did not, as two tracks of one
 * grid. The parent is the only scroller; the tracks themselves do not scroll.
 */

/** Column shell: one heading, one stack, one left edge. */
function PulseWorkColumn({
	children,
	label,
}: Readonly<{ children: ReactNode; label: string }>) {
	return (
		<section aria-label={label} className="flex min-w-0 flex-col gap-3">
			<PulseSectionLabel>{label}</PulseSectionLabel>
			{children}
		</section>
	);
}

function PulseWorkItemsColumn({
	isWorkItemInteractive,
	members,
	onWorkItemClick,
	selectedMember,
	workItems,
}: Readonly<{
	isWorkItemInteractive?: (workItem: PulseWorkItem) => boolean;
	members: readonly PulseMember[];
	onWorkItemClick?: (workItem: PulseWorkItem) => void;
	selectedMember: PulseMember | null;
	workItems: readonly PulseWorkItem[];
}>) {
	return (
		<PulseWorkColumn label="Work items">
			<PulseWorkItemList
				isWorkItemInteractive={isWorkItemInteractive}
				members={members}
				onWorkItemClick={onWorkItemClick}
				selectedMember={selectedMember}
				workItems={workItems}
			/>
		</PulseWorkColumn>
	);
}

function PulseUncapturedColumn({
	capturedIds,
	isLooseWorkResumable,
	looseWork,
	members,
	onCapture,
	onResumeLooseWork,
	workItems,
}: Readonly<{
	/**
	 * Captured rows, owned above this column. A capture is a commitment the
	 * reader made; keeping it in the row meant scrolling to another insight
	 * unmounted the keyed row and silently un-captured it on the way back.
	 */
	capturedIds: ReadonlySet<string>;
	isLooseWorkResumable?: (item: PulseLooseWork) => boolean;
	looseWork: readonly PulseLooseWork[];
	members: readonly PulseMember[];
	onCapture: (item: PulseLooseWork) => void;
	onResumeLooseWork?: (item: PulseLooseWork) => void;
	workItems: readonly PulseWorkItem[];
}>) {
	const memberLookup = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
	const githubWork = looseWork.filter(isPulseGithubLooseWork);
	const sessionItems = toPulseSessionItems(
		looseWork,
		members,
		workItems,
	);
	const sessionHandlers = useMemo(
		() => toPulseSessionHandlers({
			isLooseWorkResumable,
			looseWork,
			onCapture,
			onResume: onResumeLooseWork,
		}),
		[isLooseWorkResumable, looseWork, onCapture, onResumeLooseWork],
	);

	if (githubWork.length === 0 && sessionItems.length === 0) {
		return (
			<PulseWorkColumn label="Uncaptured work">
				<PulseRailEmpty>Everything in this window is captured.</PulseRailEmpty>
			</PulseWorkColumn>
		);
	}

	return (
		<PulseWorkColumn label="Uncaptured work">
			{githubWork.length > 0 ? (
				<ul className="flex flex-col gap-2">
					{githubWork.map((item) => {
						const participants = toUncapturedParticipants(item, memberLookup);
						return (
							<li key={item.id}>
								<JiraIssue
									captured={capturedIds.has(item.id)}
									data-loose-work-id={item.id}
									onCreateWorkItem={() => onCapture(item)}
									onLinkWorkItem={() => onCapture(item)}
									participants={participants}
									sourceLink={createPulseLooseWorkSmartLink(item, participants)}
									suggestedWorkItemKey={suggestPulseLooseWorkItemKey(item, workItems)}
									summary={item.title}
									variant="uncaptured-work"
								/>
							</li>
						);
					})}
				</ul>
			) : null}
			{sessionItems.length > 0 ? (
				<AgentSession
					capturedItemIds={capturedIds}
					className="w-full min-w-0"
					items={sessionItems}
					{...sessionHandlers}
				/>
			) : null}
		</PulseWorkColumn>
	);
}

/**
 * One right-rail parent: two tracks, one scrollbar, one resize handle.
 *
 * Desktop defaults to 320 / 8 / 300 — the 8px gutter matches experimental
 * kanban columns (`gap-2` / `space.100`). From `lg` the rail is resizable
 * against the article; below `lg` the tracks stack with the shell's own
 * `flex-col gap-10` and the handle unmounts from layout via `contents`.
 * `-m-1 p-1` is the scrollport's focus-ring gutter. `lg:box-content` keeps
 * `--pulse-work-rail-width` as the track measure so padding sits outside the
 * tracks. The handle sits as a sibling of the overflow grid so `overflow-y:
 * auto` cannot clip its hit area in the article gutter.
 */
export function PulseWorkRail({
	capturedIds,
	chat,
	isLooseWorkResumable,
	isWorkItemInteractive,
	looseWork,
	members,
	onCapture,
	onResumeLooseWork,
	onWorkItemClick,
	selectedMember = null,
	workItems,
}: Readonly<{
	capturedIds: ReadonlySet<string>;
	/** When set, replaces both card tracks — same swap as the work-item side panel. */
	chat?: ReactNode;
	isLooseWorkResumable?: (item: PulseLooseWork) => boolean;
	isWorkItemInteractive?: (workItem: PulseWorkItem) => boolean;
	looseWork: readonly PulseLooseWork[];
	members: readonly PulseMember[];
	onCapture: (item: PulseLooseWork) => void;
	onResumeLooseWork?: (item: PulseLooseWork) => void;
	onWorkItemClick?: (workItem: PulseWorkItem) => void;
	/** Filtered Insights persona — cards wear this face instead of the Jira assignee. */
	selectedMember?: PulseMember | null;
	workItems: readonly PulseWorkItem[];
}>) {
	const { railRef, railResize, style } = usePulseWorkRailResize();

	return (
		<div
			className="group/pulse-work-rail relative min-w-0 lg:box-content lg:h-full lg:min-h-0 lg:w-[var(--pulse-work-rail-width)] lg:shrink-0"
			data-pulse-work-rail=""
			ref={railRef}
			style={style}
		>
			<div className="hidden lg:contents">
				<PulseResizeHandle
					ariaLabel="Resize insights and work items"
					className="top-0! left-[-1.25rem]! after:w-10 group-hover/pulse-work-rail:[&>div]:opacity-100"
					resize={railResize}
					side="left"
					testId="jira-pulse-insights-resize-handle"
				/>
			</div>
			{chat === undefined ? (
				<div className="-m-1 grid min-w-0 grid-cols-1 gap-10 p-1 lg:box-content lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-2 lg:overflow-y-auto lg:overscroll-y-contain">
					<PulseWorkItemsColumn
						isWorkItemInteractive={isWorkItemInteractive}
						members={members}
						onWorkItemClick={onWorkItemClick}
						selectedMember={selectedMember}
						workItems={workItems}
					/>
					<PulseUncapturedColumn
						capturedIds={capturedIds}
						isLooseWorkResumable={isLooseWorkResumable}
						looseWork={looseWork}
						members={members}
						onCapture={onCapture}
						onResumeLooseWork={onResumeLooseWork}
						workItems={workItems}
					/>
				</div>
			) : (
				<div
					className="relative min-h-[24rem] min-w-0 overflow-visible lg:h-full lg:min-h-0"
					data-pulse-embedded-chat=""
				>
					{chat}
				</div>
			)}
		</div>
	);
}
