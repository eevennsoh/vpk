import type { TagColor } from "@/components/ui/tag";
import type { TwgToolSource } from "@/components/ui-custom/twg-appstack";

/** Raised elevation is the default card chrome. Stroke is a 1px border with no shadow. */
export type JiraIssueChrome = "raised" | "stroke";
/** Compact keeps 12px glyphs and 16px avatars. Comfortable uses 16px glyphs and 24px avatars. */
export type JiraIssueIconScale = "compact" | "comfortable";
export type JiraIssuePriority = "major" | "medium" | "minor";
export type JiraIssuePullRequestStatus = "open" | "failed" | "merged";
export type JiraIssueVariant = "default" | "uncaptured-work";

/** Optional image, decorative solid color, or typographic cover with a host-owned height cap. */
export type JiraIssueCoverImage = {
	maxHeight?: number;
	backgroundPattern?: "grid";
} & (
	| { src: string; alt: string; fit?: "contain" | "cover"; zoom?: number; mask?: Readonly<{ src: string; backgroundColor: string }>; appSources?: readonly TwgToolSource[]; backgroundClassName?: never; heading?: never; subheading?: never }
	| { backgroundClassName: string; src?: never; alt?: never; fit?: never; mask?: never; heading?: never; subheading?: never; appSources?: never }
	| { heading: string; subheading?: string; appSources?: readonly TwgToolSource[]; src?: never; alt?: never; fit?: never; mask?: never; backgroundClassName?: never }
);

/** Dummy or live overlay fields for the Pull Request hover flyout. */
export interface JiraIssuePullRequestPreview {
	title: string;
	author?: {
		name: string;
		avatarUrl?: string;
	};
	repository?: string;
	branch?: string;
	targetBranch?: string;
	additions: number;
	deletions: number;
	filesChanged?: number;
	/** Static relative label shown on the flyout as `Name · relativeTime`. */
	relativeTime?: string;
}

export interface JiraIssueTag {
	text: string;
	color: TagColor;
}
