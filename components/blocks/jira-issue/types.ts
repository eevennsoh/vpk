import type { TagColor } from "@/components/ui/tag";
import type { TwgToolSource } from "@/components/ui-custom/twg-appstack";
import type { PullRequestAuthor } from "@/components/blocks/pull-request/components/pull-request-types";
import type { PullRequestCheck } from "@/components/blocks/pull-request/components/pull-request-checks-list";
import type { AvatarProps, AvatarUnassignedKind } from "@/components/ui/avatar";

/** Raised elevation is the default card chrome. Stroke is a 1px border with no shadow. */
export type JiraIssueChrome = "raised" | "stroke";
/** Compact keeps 12px glyphs and 16px avatars. Comfortable uses 16px glyphs and 24px avatars. */
export type JiraIssueIconScale = "compact" | "comfortable";
export type JiraIssuePriority = "major" | "medium" | "minor" | "critical" | "trivial";
export type JiraIssueAppearance = "default" | "project-butter";

export interface JiraIssueSubtask {
	priority?: JiraIssuePriority;
	summary: string;
	issueKey: string;
	status?: string;
	issueTypeLabel?: string;
	assigneeAvatarSrc?: string;
	assigneeAvatarLabel?: string;
	assigneeUnassignedKind?: AvatarUnassignedKind;
}

export interface JiraIssueParticipant {
	id: string;
	name: string;
	avatarSrc: string;
	avatarShape?: NonNullable<AvatarProps["shape"]>;
}

export interface JiraIssueCardMetadata {
	issueType?: "task" | "story" | "epic" | "bug" | "subtask";
	dueDate?: string;
	dueDateWarning?: boolean;
	storyPoints?: number;
	flagged?: boolean;
}
export type JiraIssuePullRequestStatus = "open" | "draft" | "failed" | "merged";
export type JiraIssueVariant = "default" | "uncaptured-work";

/** Optional image, decorative solid color, or typographic cover with a host-owned height cap. */
export type JiraIssueCoverImage = {
	height?: number;
	/** Image padding adds canvas space outside this artwork height cap. */
	maxHeight?: number;
	backgroundPattern?: "grid";
} & (
	| { src: string; alt: string; fit?: "contain" | "cover"; objectPosition?: string; zoom?: number; padding?: Readonly<{ blockStart: number; blockEnd: number; backgroundColor: string }>; mask?: Readonly<{ src: string; backgroundColor: string }>; layers?: readonly string[]; foreground?: Readonly<{ src: string; width: number; height: number; canvasWidth: number }>; appSources?: readonly TwgToolSource[]; backgroundClassName?: never; heading?: never; subheading?: never }
	| { backgroundClassName: string; src?: never; alt?: never; fit?: never; mask?: never; layers?: never; foreground?: never; heading?: never; subheading?: never; appSources?: never }
	| { heading: string; subheading?: string; appSources?: readonly TwgToolSource[]; src?: never; alt?: never; fit?: never; mask?: never; layers?: never; foreground?: never; backgroundClassName?: never }
);

/** Dummy or live overlay fields for the Pull Request hover flyout. */
export interface JiraIssuePullRequestPreview {
	title: string;
	href?: string;
	author?: PullRequestAuthor;
	repository?: string;
	checks?: readonly PullRequestCheck[];
	branch?: string;
	targetBranch?: string;
	additions: number;
	deletions: number;
	filesChanged?: number;
	/** Static relative label shown on the flyout as `Name · relativeTime`. */
	relativeTime?: string;
}

export interface JiraIssuePullRequestItem {
	number: number;
	status: JiraIssuePullRequestStatus;
	preview: JiraIssuePullRequestPreview;
}

export interface JiraIssueTag {
	text: string;
	color: TagColor;
}
