"use client";

import { type ReactNode, type RefCallback } from "react";
import ArrowDownIcon from "@atlaskit/icon/core/arrow-down";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import ChevronUpIcon from "@atlaskit/icon/core/chevron-up";

import type { AgentListItem } from "@/components/blocks/agent-list";
import { PulseProseText } from "@/components/blocks/jira-kanban/experimental/pulse/components/pulse-prose-text";
import { PulseSourcesAppstack } from "@/components/blocks/jira-kanban/experimental/pulse/components/pulse-sources-appstack";
import { PULSE_SOURCES } from "@/components/blocks/jira-kanban/experimental/pulse/data/pulse-sources-preview";
import {
	PulseAttention,
	PulseNextActions,
	PulseSectionLabel,
} from "@/components/blocks/jira-kanban/experimental/pulse/components/pulse-signals";
import {
	HEADLINE_STYLE,
	PULSE_EYEBROW,
	PULSE_ITEM_BODY,
	PULSE_ROW_META,
} from "@/components/blocks/jira-kanban/experimental/pulse/components/pulse-type";
import {
	isPulseSectionDimmed,
	toPulseInsightEyebrow,
	toPulseInsightHeadline,
} from "@/components/blocks/jira-kanban/experimental/pulse/lib/pulse-marks";
import {
	toAdjacentInsightIndex,
	toPulseAnchorId,
	toPulseSections,
	toPulseSectionStats,
	toSectionHeading,
	type PulseScrollOptions,
	type PulseSectionStat,
} from "@/components/blocks/jira-kanban/experimental/pulse/lib/pulse-outline";
import type {
	PulseAction,
	PulseContribution,
	PulseMember,
	PulseStoryProps,
} from "@/components/blocks/jira-kanban/experimental/pulse/types";
import { ArtifactList, type ArtifactListItem } from "@/components/ui-custom/artifact-list";
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/**
 * Pulse story — the body of one insight inside the continuous article.
 *
 * One eyebrow names the outcome and when it was last updated, then a display
 * headline, the faces that produced it, a jump list of the subsections below,
 * the narrative, the artifacts it produced, then the signals and the actions
 * that follow from it. Nothing here swaps: every insight is mounted at once
 * and the reader scrolls. The header chevrons jump to the previous or next
 * insight via the ruler's own scroll — they do not unmount or step a carousel.
 * What it also owns is anchors: the insight head and each non-empty section
 * carry the id the outline generated for them, so every mark on the ruler is a
 * real place in the document.
 *
 * While a member filter is on, the display headline stays an insight — the
 * filtered member's authored title, or the team's if they have none. The
 * team's headline drops to a subdued line underneath. The eyebrow stays the
 * chapter and last-updated stamp; the roster already names who is selected. A
 * member who was quiet still gets a page — what the window was, and two ways
 * out — instead of one grey sentence and eight hundred pixels of white.
 */

/**
 * 576px — the prose measure. Held in `rem`, not `px`, so it tracks the root
 * type size: at the 16px body below it that is ~74 characters a line, inside
 * the range a reader can return-sweep without losing the line. It is not set
 * in `em` because the same class also caps the 43px display headline, where
 * `em` would resolve against the headline's own size and blow the column open.
 *
 * Exported because the stream rules one insight off from the next, and that
 * hairline has to stop where the reading column stops.
 */
export const MEASURE = "max-w-[36rem]";

const SECTION_FOCUS_TRANSITION = "min-w-0 transition-opacity duration-normal ease-out-practical motion-reduce:transition-none";
const SECTION_FOCUSED = "opacity-100";
const SECTION_DIMMED = "opacity-(--opacity-disabled)";

/** One window the filtered member was active in, offered as a way out. */
export interface PulseStoryJump {
	index: number;
	label: string;
}

/**
 * The frozen `PulseStoryProps` describes the data for one snapshot. The
 * continuous article drops its `onNext`/`onPrevious` stepper half — there is
 * nothing to unmount any more — and needs a little more than the rest: where
 * this insight sits in the article, where else the member was active, what
 * the unscoped window holds, and the anchor registrar the ruler scrolls
 * against. That extra is declared here rather than in `types.ts`, which is a
 * read-only contract.
 */
export interface PulseStoryViewProps
	extends Omit<PulseStoryProps, "index" | "onNext" | "onPrevious" | "total"> {
	/** Position in the article, for the header's previous/next jump. */
	insightIndex: number;
	insightCount: number;
	/** Why a window came up empty, e.g. "The window ran … and closed overnight." */
	quietNote?: string;
	nextActive?: PulseStoryJump | null;
	previousActive?: PulseStoryJump | null;
	/** Jump the article to another insight, optionally at a gesture-specific line. */
	onGoToIndex: (index: number, options?: PulseScrollOptions) => void;
	/** Everyone — human and agent — whose work is in this window. */
	contributors: readonly PulseMember[];
	/** Clears the header roster filter. Attribution faces do not drive this. */
	onSelectMember: (memberId: string | null) => void;
	/** Jump the article to a section the outline already marked. */
	onGoToEntry: (id: string) => void;
	/**
	 * Requested actions, owned above the article. A request is a commitment the
	 * reader made; owning it here meant toggling Pulse off and back on recreated
	 * the set empty and silently un-requested everything.
	 */
	requestedActionIds: ReadonlySet<string>;
	onRequestAction: (action: PulseAction) => void;
	/** Opens the work item a Needs input row is waiting on. */
	onViewAttention: (item: AgentListItem) => void;
	/** What the window holds before scoping, so an emptied section can say so. */
	unscopedCounts: {
		artifacts: number;
		attention: number;
		nextActions: number;
	};
	/**
	 * From `usePulseReading`. Anchor ids come from `toPulseAnchorId(snapshot.id)`
	 * and `toPulseAnchorId(snapshot.id, section)`, so the article and the ruler
	 * are addressing the same elements by construction.
	 */
	anchorRef: (id: string) => RefCallback<HTMLElement>;
	/** Outline entry currently previewed from ruler hover or focus. */
	previewEntryId: string | null;
}

/**
 * A part of the article the ruler can jump to.
 *
 * Anchored parts are the ones `toPulseSections` lists, which is exactly the set
 * the outline made marks for — an unanchored part renders identically, it just
 * has no mark pointing at it, so the ruler can never offer a jump that lands
 * nowhere.
 *
 * The story column owns the gap between blocks (`gap-8`), so this wrapper
 * starts on the section heading. A start-aligned scrub then parks that heading
 * on the scroller top — the same line a chevron uses for the insight eyebrow.
 * A top margin inside the wrapper would park the spacer instead.
 */
function PulseStoryAnchor({
	anchorRef,
	anchored,
	children,
	id,
	isDimmed,
}: Readonly<{
	anchorRef: (id: string) => RefCallback<HTMLElement>;
	anchored: boolean;
	children: ReactNode;
	id: string;
	isDimmed: boolean;
}>) {
	if (!anchored) {
		return children;
	}
	return (
		<div
			className={cn(
				SECTION_FOCUS_TRANSITION,
				isDimmed ? SECTION_DIMMED : SECTION_FOCUSED,
			)}
			id={id}
			ref={anchorRef(id)}
		>
			{children}
		</div>
	);
}

/**
 * Who produced this window, as faces, directly under the headline.
 *
 * Attribution, not a filter. The header facepile is the roster control;
 * these faces name who worked in the window.
 */
function PulseStoryContributors({
	contributors,
}: Readonly<{
	contributors: readonly PulseMember[];
}>) {
	return (
		<div className="flex min-w-0 items-center gap-1">
			{contributors.length === 0 ? null : (
				<>
					{/* Visible "By" is decorative; the group name already says who these faces are. */}
					<span aria-hidden className={cn("shrink-0", PULSE_ROW_META)}>By</span>
					<AvatarGroup
						label="By contributors in this window"
						size="xs"
						className="-mx-0.5 min-w-0 items-center px-0.5"
					>
						{contributors.map((member) => (
							<span
								className="flex size-4 shrink-0 items-center justify-center"
								key={member.id}
							>
								<Avatar
									className={member.kind === "human" ? "ring-2 ring-surface" : undefined}
									label={member.name}
									shape={member.kind === "agent" ? "hexagon" : "circle"}
									size="xs"
								>
									<AvatarImage alt="" src={member.avatarSrc} />
									<AvatarFallback>{getMemberInitials(member.name)}</AvatarFallback>
								</Avatar>
							</span>
						))}
					</AvatarGroup>
					<span aria-hidden className={cn("shrink-0", PULSE_ROW_META)}>·</span>
				</>
			)}
			<span className={cn("shrink-0", PULSE_ROW_META)}>
				{`${PULSE_SOURCES.length} ${PULSE_SOURCES.length === 1 ? "Source" : "Sources"}`}
				<span className="sr-only"> from Jira, Confluence, GitHub, Slack, and 10 more</span>
			</span>
			<PulseSourcesAppstack />
		</div>
	);
}

/**
 * The window's subsection TOC, as a ruled label/value list under the faces.
 *
 * Each row is the same heading the article paints further down, counted from
 * what this page actually holds, and jumps to that section's outline anchor.
 * The down arrow is the affordance, not a second control: it stays in layout
 * and fades in on hover or keyboard focus so Tab can reach the jump without a
 * pointer. The label also lifts to default text on that same hover or focus.
 */
function PulseStoryStats({
	label,
	links,
	onGoToEntry,
}: Readonly<{
	label: string;
	links: readonly PulseSectionStat[];
	onGoToEntry: (id: string) => void;
}>) {
	if (links.length === 0) {
		return null;
	}
	return (
		<nav aria-label={`${label} sections`} className={cn("mt-6 min-w-0", MEASURE)}>
			<ul>
				{links.map((link) => (
					<li className="border-b border-border last:border-b-0" key={link.id}>
						<a
							className="group/stat-link flex min-w-0 items-baseline justify-between gap-6 rounded-xs py-2.5 text-text-subtle no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
							href={`#${link.id}`}
							onClick={(event) => {
								event.preventDefault();
								onGoToEntry(link.id);
							}}
						>
							<span className="flex min-w-0 items-center gap-1">
								<span
									className={cn(
										"min-w-0 truncate transition-colors duration-xxshort ease-out-practical group-hover/stat-link:text-text group-focus-visible/stat-link:text-text motion-reduce:transition-none",
										PULSE_ITEM_BODY,
									)}
								>
									{link.label}
								</span>
								<Icon
									aria-hidden
									className="shrink-0 text-icon-subtle opacity-0 transition-opacity duration-xxshort ease-out-practical group-hover/stat-link:opacity-100 group-focus-visible/stat-link:opacity-100 motion-reduce:transition-none"
									render={<ArrowDownIcon label="" size="small" />}
								/>
							</span>
							<span className="shrink-0 text-[18px] leading-6 font-medium tracking-[-0.01em] text-text tabular-nums">
								{link.value}
							</span>
						</a>
					</li>
				))}
			</ul>
		</nav>
	);
}

function getMemberInitials(name: string) {
	return name
		.split(" ")
		.map((part) => part.charAt(0))
		.join("")
		.slice(0, 2)
		.toUpperCase();
}

function getFirstName(name: string) {
	return name.split(" ")[0] ?? name;
}

function toEmptyNote(firstName: string, count: number, noun: string, plural: string) {
	if (count === 0) {
		return `Nothing here for ${firstName}, and nothing for the team either.`;
	}
	return `Nothing for ${firstName} here — ${count} ${count === 1 ? noun : plural} across the team.`;
}

function openArtifact(item: ArtifactListItem) {
	if (!item.href) return;
	window.open(item.href, "_blank", "noopener,noreferrer");
}

function PulseStoryProse({ paragraphs }: Readonly<{ paragraphs: readonly string[] }>) {
	return (
		<div className={cn("mt-7 flex flex-col gap-6", MEASURE)}>
			{paragraphs.map((paragraph) => (
				<p className="text-base/6 tracking-[-0.011em] text-pretty text-text" key={paragraph}>
					<PulseProseText text={paragraph} />
				</p>
			))}
		</div>
	);
}

/** The scoped body: what they did, and the way back to the team. */
function PulseStoryMemberBody({
	contribution,
	member,
	nextActive,
	onGoToIndex,
	onSelectMember,
	previousActive,
	quietNote,
	teamHeadline,
}: Readonly<{
	contribution: PulseContribution | null;
	member: PulseMember;
	nextActive?: PulseStoryJump | null;
	onGoToIndex: (index: number, options?: PulseScrollOptions) => void;
	onSelectMember: (memberId: string | null) => void;
	previousActive?: PulseStoryJump | null;
	quietNote?: string;
	teamHeadline: string;
}>) {
	const firstName = getFirstName(member.name);

	return (
		<div className={cn("mt-7", MEASURE)}>
			{contribution === null ? (
				<div>
					<p className="text-base/6 tracking-[-0.011em] text-pretty text-text">
						{`No activity from ${firstName} in this window.`}
					</p>
					{quietNote === undefined ? null : (
						<p className={cn("mt-1", PULSE_ITEM_BODY)}>{quietNote}</p>
					)}
					<div className="mt-5 flex flex-wrap items-center gap-2">
						{previousActive === null || previousActive === undefined ? null : (
							<Button onClick={() => onGoToIndex(previousActive.index)} size="compact" type="button" variant="outline">
								{`Last active ${previousActive.label}`}
							</Button>
						)}
						{nextActive === null || nextActive === undefined ? null : (
							<Button onClick={() => onGoToIndex(nextActive.index)} size="compact" type="button" variant="outline">
								{`Next active ${nextActive.label}`}
							</Button>
						)}
					</div>
					<Button className="mt-2 px-0" onClick={() => onSelectMember(null)} size="compact" type="button" variant="link">
						See what the team did in this window
					</Button>
				</div>
			) : (
				<p className="text-base/6 tracking-[-0.011em] text-pretty text-text">
					<PulseProseText text={contribution.summary} />
				</p>
			)}

			<p className={cn("mt-7 border-t border-border pt-4", PULSE_ITEM_BODY)}>
				<span className="text-text-subtlest">Team in this window · </span>
				{teamHeadline}
			</p>
		</div>
	);
}

function PulseStoryInsightNav({
	insightCount,
	insightIndex,
	label,
	onGoToIndex,
}: Readonly<{
	insightCount: number;
	insightIndex: number;
	label: string;
	onGoToIndex: (index: number, options?: PulseScrollOptions) => void;
}>) {
	const previousIndex = toAdjacentInsightIndex(insightIndex, insightCount, "previous");
	const nextIndex = toAdjacentInsightIndex(insightIndex, insightCount, "next");
	const isFirst = previousIndex === null;
	const isLast = nextIndex === null;

	return (
		<nav aria-label={`${label} insight navigation`} className="ml-auto flex shrink-0 items-center">
			<Button
				aria-disabled={isFirst}
				aria-label="Previous insight"
				className={cn(isFirst ? "pointer-events-none opacity-(--opacity-disabled)" : null)}
				onClick={() => {
					if (previousIndex === null) return;
					onGoToIndex(previousIndex, { align: "start" });
				}}
				size="icon-compact"
				type="button"
				variant="ghost"
			>
				<Icon aria-hidden render={<ChevronUpIcon label="" size="small" />} />
			</Button>
			<Button
				aria-disabled={isLast}
				aria-label="Next insight"
				className={cn(isLast ? "pointer-events-none opacity-(--opacity-disabled)" : null)}
				onClick={() => {
					if (nextIndex === null) return;
					onGoToIndex(nextIndex, { align: "start" });
				}}
				size="icon-compact"
				type="button"
				variant="ghost"
			>
				<Icon aria-hidden render={<ChevronDownIcon label="" size="small" />} />
			</Button>
		</nav>
	);
}

function PulseStoryArtifacts({
	artifacts,
	emptyNote,
}: Readonly<{ artifacts: readonly ArtifactListItem[]; emptyNote?: string }>) {
	if (artifacts.length === 0 && emptyNote === undefined) return null;

	return (
		<section className={cn("min-w-0", MEASURE)}>
			<PulseSectionLabel>{toSectionHeading("artifacts")}</PulseSectionLabel>
			{artifacts.length === 0 ? (
				<p className={cn("mt-3", PULSE_ITEM_BODY)}>{emptyNote}</p>
			) : (
				<ArtifactList className="mt-3" items={artifacts} onOpen={openArtifact} variant="compact" />
			)}
		</section>
	);
}

export function PulseStory({
	snapshot,
	member,
	contribution,
	artifacts,
	attention,
	nextActions,
	quietNote,
	nextActive,
	previousActive,
	insightCount,
	insightIndex,
	onGoToIndex,
	onGoToEntry,
	contributors,
	onSelectMember,
	onRequestAction,
	onViewAttention,
	requestedActionIds,
	unscopedCounts,
	anchorRef,
	previewEntryId,
}: Readonly<PulseStoryViewProps>) {
	// The outline decides which parts earn a mark; the article reads the same
	// helper so the two can never disagree about what exists.
	const anchoredSections = new Set(toPulseSections(snapshot));
	const firstName = member === null ? "" : getFirstName(member.name);
	const insightId = toPulseAnchorId(snapshot.id);
	const artifactsId = toPulseAnchorId(snapshot.id, "artifacts");
	const attentionId = toPulseAnchorId(snapshot.id, "attention");
	const actionsId = toPulseAnchorId(snapshot.id, "actions");
	const sectionStats = toPulseSectionStats(snapshot, {
		artifacts: artifacts.length,
		attention: attention.length,
		nextActions: nextActions.length,
	});
	const eyebrow = toPulseInsightEyebrow(snapshot);
	const headline = toPulseInsightHeadline(snapshot, contribution);

	return (
		<section className="flex min-w-0 flex-col gap-8">
			{/* The insight intro — head plus prose — is one ruler block. A jump
			    lands on its naming line while preview keeps the whole intro together. */}
			<div
				className={cn(
					SECTION_FOCUS_TRANSITION,
					isPulseSectionDimmed(previewEntryId, insightId) ? SECTION_DIMMED : SECTION_FOCUSED,
				)}
				id={insightId}
				ref={anchorRef(insightId)}
			>
				<div className={cn("flex min-h-6 min-w-0 items-center", MEASURE)}>
					<p className={cn("min-w-0 truncate", PULSE_EYEBROW)}>{eyebrow}</p>
					<PulseStoryInsightNav
						insightCount={insightCount}
						insightIndex={insightIndex}
						label={snapshot.chapterLabel}
						onGoToIndex={onGoToIndex}
					/>
				</div>

				<h2 className={cn("mt-6 text-pretty text-text", MEASURE)} style={HEADLINE_STYLE}>
					{headline}
				</h2>

				<div className="mt-4 min-w-0">
					<PulseStoryContributors
						contributors={contributors}
					/>
				</div>

				<PulseStoryStats
					label={snapshot.chapterLabel}
					links={sectionStats}
					onGoToEntry={onGoToEntry}
				/>

				{member === null ? (
					<PulseStoryProse paragraphs={snapshot.paragraphs} />
				) : (
					<PulseStoryMemberBody
						contribution={contribution}
						member={member}
						nextActive={nextActive}
						onGoToIndex={onGoToIndex}
						onSelectMember={onSelectMember}
						previousActive={previousActive}
						quietNote={quietNote}
						teamHeadline={snapshot.title}
					/>
				)}
			</div>

			<PulseStoryAnchor
				anchorRef={anchorRef}
				anchored={anchoredSections.has("artifacts")}
				id={artifactsId}
				isDimmed={isPulseSectionDimmed(previewEntryId, artifactsId)}
			>
				<PulseStoryArtifacts
					artifacts={artifacts}
					emptyNote={member === null
						? undefined
						: toEmptyNote(firstName, unscopedCounts.artifacts, "artifact", "artifacts")}
				/>
			</PulseStoryAnchor>

			<PulseStoryAnchor
				anchorRef={anchorRef}
				anchored={anchoredSections.has("attention")}
				id={attentionId}
				isDimmed={isPulseSectionDimmed(previewEntryId, attentionId)}
			>
				<PulseAttention
					className={MEASURE}
					emptyNote={member === null
						? undefined
						: toEmptyNote(firstName, unscopedCounts.attention, "item needs input", "items need input")}
					members={contributors}
					onView={onViewAttention}
					signals={attention}
				/>
			</PulseStoryAnchor>

			<PulseStoryAnchor
				anchorRef={anchorRef}
				anchored={anchoredSections.has("actions")}
				id={actionsId}
				isDimmed={isPulseSectionDimmed(previewEntryId, actionsId)}
			>
				<PulseNextActions
					actions={nextActions}
					className={MEASURE}
					emptyNote={member === null
						? undefined
						: toEmptyNote(firstName, unscopedCounts.nextActions, "action", "actions")}
					onRequestAction={onRequestAction}
					requestedActionIds={requestedActionIds}
				/>
			</PulseStoryAnchor>
		</section>
	);
}
