import type { CSSProperties } from "react";
import type { Transition } from "motion/react";

import type { JiraIssueChrome, JiraIssueIconScale } from "@/components/blocks/jira-issue/types";
import type { AvatarUnassignedKind } from "@/components/ui/avatar";
import { motionEase } from "../../../lib/motion.ts";

export const JIRA_ISSUE_COMPACT_ISSUE_KEY_CLASS = "text-xs font-normal leading-4 text-text-subtlest";
/** Matches the compact Subtasks row label: medium weight + subtle color. */
export const JIRA_ISSUE_COMFORTABLE_ISSUE_KEY_CLASS = "text-xs font-medium leading-4 text-text-subtle";
/** Overrides `icon-compact` 12px glyphs so comfortable cards keep 16px icons. */
export const JIRA_ISSUE_COMFORTABLE_COMPACT_ICON_CLASS =
	"[&_[data-slot=icon]:not([class*='size-'])]:size-4! [&_[data-slot=icon]:not([class*='size-'])>span]:size-4! [&_svg:not([class*='size-'])]:size-4!";

export interface JiraIssueIconMetrics {
	readonly assigneeSize: "xs" | "sm";
	readonly compactIconClassName: typeof JIRA_ISSUE_COMFORTABLE_COMPACT_ICON_CLASS | undefined;
	readonly iconTileIconSize: "small" | "medium";
	readonly iconTileSize: "xxsmall";
	readonly issueKeyClassName: typeof JIRA_ISSUE_COMPACT_ISSUE_KEY_CLASS | typeof JIRA_ISSUE_COMFORTABLE_ISSUE_KEY_CLASS;
}

export function resolveJiraIssueIconMetrics(
	iconScale: JiraIssueIconScale = "compact",
): JiraIssueIconMetrics {
	if (iconScale === "comfortable") {
		return {
			assigneeSize: "sm",
			compactIconClassName: JIRA_ISSUE_COMFORTABLE_COMPACT_ICON_CLASS,
			iconTileIconSize: "medium",
			iconTileSize: "xxsmall",
			issueKeyClassName: JIRA_ISSUE_COMFORTABLE_ISSUE_KEY_CLASS,
		};
	}

	return {
		assigneeSize: "xs",
		compactIconClassName: undefined,
		iconTileIconSize: "small",
		iconTileSize: "xxsmall",
		issueKeyClassName: JIRA_ISSUE_COMPACT_ISSUE_KEY_CLASS,
	};
}

export function resolveJiraIssueSubtaskChrome(
	chrome: JiraIssueChrome,
	subtaskChrome?: JiraIssueChrome,
	compact = false,
): JiraIssueChrome {
	return subtaskChrome ?? (compact ? "stroke" : chrome);
}

/**
 * Pure helpers and motion tokens shared by the Jira issue card and the subtask
 * list it renders. They live here rather than in `index.tsx` so `subtasks.tsx`
 * can use them without importing back into the card and forming a cycle.
 *
 * Motion values are the resolved VPK duration/easing tokens: Motion for React
 * cannot read `var()`, so each array is annotated with the token it mirrors.
 */
export const JIRA_ISSUE_MOTION_ENTER: Transition = { duration: 0.15, ease: motionEase.outPractical }; // duration-normal + ease-out-practical
export const JIRA_ISSUE_MOTION_EXIT: Transition = { duration: 0.1, ease: motionEase.in }; // duration-fast + ease-in
export const JIRA_ISSUE_MOTION_LAYOUT: Transition = { duration: 0.2, ease: motionEase.inOut }; // duration-medium + ease-in-out
export const JIRA_ISSUE_MOTION_REDUCED: Transition = { duration: 0 };
export const JIRA_ISSUE_MOTION_STYLE: CSSProperties = { willChange: "transform, opacity" };

export function getIssueInitial(issueKey: string): string {
	return issueKey[0]?.toUpperCase() ?? "U";
}

export function resolveIssueAssigneeUnassignedKind(
	assigneeAvatarSrc: string | undefined,
	assigneeUnassignedKind?: AvatarUnassignedKind,
): AvatarUnassignedKind | undefined {
	if (assigneeUnassignedKind) {
		return assigneeUnassignedKind;
	}

	return assigneeAvatarSrc ? undefined : "person";
}

export function uncapturedWorkLinkLabel(suggestedWorkItemKey?: string): string {
	return suggestedWorkItemKey === undefined ? "Link work item" : `Link to ${suggestedWorkItemKey}`;
}

export function uncapturedWorkLinkActionLabel(summary: string, suggestedWorkItemKey?: string): string {
	return suggestedWorkItemKey === undefined
		? `Link ${summary} to a work item`
		: `Link ${summary} to ${suggestedWorkItemKey}`;
}

/**
 * The keys an uncaptured-work chin offers to link against, normalized to one
 * list so the no-suggestion, one-suggestion, and many-suggestion chins are the
 * same shape.
 *
 * An empty list still yields one row — the generic "Link work item" control —
 * so the caller never has to special-case "no suggestion" downstream.
 */
export function uncapturedWorkSuggestionKeys(
	suggestedWorkItemKey?: string,
	suggestedWorkItemKeys?: readonly string[],
): readonly (string | undefined)[] {
	const keys = suggestedWorkItemKeys
		?? (suggestedWorkItemKey === undefined ? [] : [suggestedWorkItemKey]);

	return keys.length === 0 ? [undefined] : keys;
}

export function getCompletedCount(completedCount: number | undefined, totalCount: number): number {
	return Math.min(Math.max(completedCount ?? 0, 0), totalCount);
}

export function getJiraIssueLayoutTransition(shouldReduceMotion: boolean | null): Transition {
	return shouldReduceMotion ? JIRA_ISSUE_MOTION_REDUCED : JIRA_ISSUE_MOTION_LAYOUT;
}

// Absolute offsets for the white card surface inside the agent shell, measured
// from the card's padding box — which is why a resting card sits at -1 and covers
// its own 1px border.
//
// Every edge the grey well shows through is inset by the same amount, so the well
// is always *carved out of the card*, never appended to it: the shell's layout box
// is byte-identical at rest and while a hovered agent session highlights the card,
// and the cards below it never move. (The bottom band used to be a 4px spacer row
// under the card, which grew the shell by 4px on hover.)
//
// The bottom edge is the one exception: a docked chin row already paints that band
// below the card, so the surface stays flush against it instead of opening a second
// gap.
export function getJiraIssueAgentSurfaceOffsets(
	surfacePosition: number,
	insetsSurfaceBottom: boolean,
): Readonly<{ bottom: number; left: number; right: number; top: number }> {
	return {
		bottom: insetsSurfaceBottom ? surfacePosition : -1,
		left: surfacePosition,
		right: surfacePosition,
		top: surfacePosition,
	};
}

export function getJiraIssuePresenceMotion(shouldReduceMotion: boolean | null) {
	if (shouldReduceMotion) {
		return {
			animate: undefined,
			exit: undefined,
			initial: false,
		} as const;
	}

	return {
		animate: { opacity: 1, y: 0, transition: JIRA_ISSUE_MOTION_ENTER },
		exit: { opacity: 0, y: -4, transition: JIRA_ISSUE_MOTION_EXIT },
		initial: { opacity: 0, y: -4 },
	} as const;
}
