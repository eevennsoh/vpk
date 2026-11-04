"use client";

import type { ReactNode } from "react";

import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import TaskToDoIcon from "@atlaskit/icon/core/task-to-do";

import {
	PullRequestChecksList,
	type PullRequestCheck,
} from "@/components/blocks/pull-request/components/pull-request-checks-list";
import { pullRequestChecksSummary } from "@/components/blocks/pull-request/lib/pull-request-checks-title";
import { ProgressCircle } from "@/components/ui-custom/progress-circle";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { IconTile } from "@/components/ui/icon-tile";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/** Leading glyph cell + content, shared by every row in the flyout's detail section. */
export function PullRequestFlyoutMetaRow({
	leading,
	children,
}: Readonly<{ leading: ReactNode; children: ReactNode }>) {
	return (
		<div className="flex min-w-0 items-center gap-1 text-xs leading-5">
			<span aria-hidden="true" className="grid size-4 shrink-0 place-items-center text-icon-subtlest">
				{leading}
			</span>
			{children}
		</div>
	);
}

/** Segment status each settled check state draws as a single-status ring. */
const CHECK_SEGMENT_STATUS = {
	passed: "passed",
	failed: "failed",
} as const;

const CHECK_STATUS_LABEL = {
	passed: "Passed",
	failed: "Failed",
} as const;

/**
 * Per-check glyph: a full single-status ring (lime passed, danger failed) from
 * the segmented Progress Circle, the dashed circle for a check that is yet to
 * run, and a bare spinner while it is running. Decorative — the row spells the
 * status out for assistive tech.
 */
function renderCheckStatusRing(check: PullRequestCheck) {
	if (check.status === "running") {
		return (
			<span aria-hidden="true" className="inline-flex size-4 items-center justify-center text-icon-subtle">
				<Spinner label="" size="xs" />
			</span>
		);
	}
	if (check.status === "queued") {
		return (
			<IconTile
				aria-hidden
				as="span"
				className="text-icon-disabled"
				icon={<TaskToDoIcon color="currentColor" label="" size="small" />}
				iconSize="small"
				label=""
				size="xxsmall"
				variant="transparent"
			/>
		);
	}
	return (
		<span aria-hidden="true" className="inline-flex size-4 items-center justify-center">
			<ProgressCircle
				animated={false}
				inline
				label={CHECK_STATUS_LABEL[check.status]}
				segmented
				segments={[{ status: CHECK_SEGMENT_STATUS[check.status] }]}
				size="xs"
			/>
		</span>
	);
}

/**
 * Builds row that expands inline into the full CI checks list. The collapsed
 * row is the one-line summary (`2/3 builds passed · 1 failed`); the panel is the
 * same `PullRequestChecksList` the metadata rail uses, so every row state —
 * queued, running, passed, failed with Fix — appears without leaving the card.
 */
export function PullRequestFlyoutChecks({
	checks,
	defaultOpen = false,
	onFixCheck,
}: Readonly<{
	checks: readonly PullRequestCheck[];
	/** Start expanded, for surfaces that exist to show the rows (the catalog gallery). */
	defaultOpen?: boolean;
	onFixCheck?: (checks: readonly PullRequestCheck[]) => void;
}>) {
	if (checks.length === 0) return null;

	const summary = pullRequestChecksSummary(checks);

	return (
		<Collapsible className="flex min-w-0 flex-col" data-pull-request-checks defaultOpen={defaultOpen}>
			<CollapsibleTrigger
				className={cn(
					"group/checks-trigger -mx-1 flex min-w-0 items-center gap-1 rounded-md px-1 text-left text-xs leading-5 text-text-subtle outline-none",
					"transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
				)}
			>
				<span aria-hidden="true" className="grid size-4 shrink-0 place-items-center text-icon-subtlest">
					{summary.running ? (
						<Spinner label="" size="xs" />
					) : (
						<ProgressCircle animated={false} inline label="CI checks" segmented segments={summary.segments} size="xs" />
					)}
				</span>
				<span className="min-w-0 truncate tabular-nums">{summary.label}</span>
				{/* Disclosure cue: hidden until the row is hovered or keyboard-focused, points right when
				    closed and rotates to point down when open. The trigger stays the focus target. */}
				<span
					aria-hidden="true"
					className={cn(
						"grid size-4 shrink-0 place-items-center text-icon-subtle opacity-0",
						"transition-[opacity,transform] duration-normal ease-out-practical motion-reduce:transition-none",
						"group-hover/checks-trigger:opacity-100 group-focus-visible/checks-trigger:opacity-100",
						"group-aria-expanded/checks-trigger:rotate-90",
					)}
				>
					<Icon aria-hidden render={<ChevronRightIcon label="" size="small" />} />
				</span>
			</CollapsibleTrigger>
			{/* Height animates via Base UI's measured panel height. Overflow clips at rest and
			    releases while a control inside is keyboard-focused so its ring is not cut off. */}
			<CollapsibleContent
				className={cn(
					"h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-medium ease-in-out",
					"data-starting-style:h-0 data-ending-style:h-0 data-open:has-[:focus-visible]:overflow-visible motion-reduce:transition-none",
				)}
			>
				<div className="-mx-1 pt-1">
					<PullRequestChecksList
						checks={checks}
						density="compact"
						onFixCheck={onFixCheck}
						renderStatusIcon={renderCheckStatusRing}
					/>
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}
