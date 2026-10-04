import type { ReactElement } from "react";

import type { AtlassianLogoName } from "@/components/ui/logo";
import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";
import type { LozengeProps } from "@/components/ui/lozenge";
import type { HoverCardContent } from "@/components/ui/hover-card";

export type SmartLinkVariant =
	| "confluence"
	| "jira"
	| "team"
	| "goal"
	| "project"
	| "loom"
	| "article"
	| "file"
	| "generic"
	| "pull-request";

/**
 * Presentation mode for SmartLink:
 * - `inline` — compact chip with hover flyout (default)
 * - `card` — bordered block card that every item can expand into
 */
export type SmartLinkAppearance = "inline" | "card";

/** Inline chip size: "small" renders a 12px label, "large" a 16px label. */
export type SmartLinkSize = "small" | "large";

export type SmartLinkTone = "neutral" | "information" | "discovery" | "magenta" | "warning";

export type SmartLinkVisual =
	| { kind: "atlassian"; name: AtlassianLogoName }
	| { kind: "third-party"; name: ThirdPartyLogoName }
	| { kind: "image"; src: string; alt: string }
	| { kind: "avatar"; src: string; alt: string }
	| { kind: "icon"; icon: ReactElement }
	| { kind: "icon-tile"; icon: ReactElement; tone?: SmartLinkTone }
	| { kind: "text"; label: string; tone?: SmartLinkTone };

export interface SmartLinkProvider {
	name: string;
	logo?: SmartLinkVisual;
}

export interface SmartLinkMetadata {
	label: string;
	tone?: SmartLinkTone;
	icon?: ReactElement;
	/** When set, renders as a trailing-metric lozenge (leading icon + metric badge). */
	metric?: string | number;
	metricVariant?: LozengeProps["variant"];
}

/** Source branch merging into its target (e.g. `feature/checkout` → `main`). */
export interface SmartLinkBranchPath {
	branch?: string;
	targetBranch?: string;
}

export interface SmartLinkAvatar {
	name: string;
	src?: string;
}

export interface SmartLinkPreviewImage {
	kind: "image" | "brand-panel";
	src?: string;
	alt?: string;
	title?: string;
	tone?: SmartLinkTone;
}

export interface SmartLinkAction {
	id: string;
	label: string;
	icon: ReactElement;
	onSelect?: (item: SmartLinkItem, action: SmartLinkAction) => void;
}

export type SmartLinkPriority = "highest" | "high" | "medium" | "low" | "lowest";

export interface SmartLinkItem {
	id: string;
	href: string;
	title: string;
	variant: SmartLinkVariant;
	provider: SmartLinkProvider;
	icon: SmartLinkVisual;
	description?: string;
	metadata?: ReadonlyArray<SmartLinkMetadata>;
	avatars?: ReadonlyArray<SmartLinkAvatar>;
	avatarOverflow?: number;
	previewImage?: SmartLinkPreviewImage;
	assignee?: SmartLinkAvatar;
	author?: SmartLinkAvatar;
	date?: string;
	priority?: SmartLinkPriority;
	status?: {
		label: string;
		variant?: LozengeProps["variant"];
		/** Render a trailing metric badge inside the status lozenge (e.g. a goal score). */
		metric?: string | number;
		/** Render the status as an interactive lozenge dropdown (Jira-style). */
		options?: ReadonlyArray<{ label: string; variant?: LozengeProps["variant"] }>;
	};
	dueDate?: string;
	/** Diff stats rendered in their own row beneath the description (N files / +additions / -deletions). */
	codeStats?: {
		files?: number;
		additions: number;
		deletions: number;
	};
	/** Rendered in the metadata row as `source → target` (pull requests). */
	branchPath?: SmartLinkBranchPath;
	actions?: ReadonlyArray<SmartLinkAction>;
}

export interface SmartLinkProps {
	item: SmartLinkItem;
	/**
	 * How the smart link is presented. `inline` is the chip + hover flyout;
	 * `card` renders the bordered block card for the same item data.
	 */
	appearance?: SmartLinkAppearance;
	side?: React.ComponentProps<typeof HoverCardContent>["side"];
	align?: React.ComponentProps<typeof HoverCardContent>["align"];
	alignOffset?: React.ComponentProps<typeof HoverCardContent>["alignOffset"];
	positionerClassName?: React.ComponentProps<typeof HoverCardContent>["positionerClassName"];
	/** Inline chip size: "small" (12px label, default) or "large" (16px label). */
	size?: SmartLinkSize;
	/** When true, render the item's status as a lozenge at the end of the inline chip. */
	showStatus?: boolean;
	openDelay?: number;
	closeDelay?: number;
	onOpenChange?: (open: boolean) => void;
	/**
	 * When provided, render a selectable control instead of a navigational link:
	 * the inline trigger becomes a pressed button, and the card title becomes a
	 * pressed button (card appearance).
	 */
	onActivate?: (item: SmartLinkItem) => void;
	/** Whether the selectable smart link is currently selected. */
	selected?: boolean;
	onActionSelect?: (action: SmartLinkAction, item: SmartLinkItem) => void;
	onRemove?: () => void;
	removeVariant?: "overlay";
	removeButtonLabel?: string;
	className?: string;
	contentClassName?: string;
}

export interface SmartLinkStatusChoice {
	readonly label: string;
	readonly variant: NonNullable<LozengeProps["variant"]>;
}

/** A status picked from the card's dropdown, keyed to the item it was picked for. */
export interface SmartLinkStatusSelection {
	readonly choice: SmartLinkStatusChoice | null;
	readonly select: (choice: SmartLinkStatusChoice) => void;
}

export interface SmartLinkCardProps {
	item: SmartLinkItem;
	/**
	 * Owner of the picked status when the card can unmount while its parent stays
	 * (the hover flyout closes). Omit it and the card keeps its own selection.
	 */
	statusSelection?: SmartLinkStatusSelection;
	onActionSelect?: (action: SmartLinkAction, item: SmartLinkItem) => void;
	/**
	 * When provided, render the card title as a selectable pressed button
	 * instead of an external link.
	 */
	onActivate?: (item: SmartLinkItem) => void;
	/** Whether the selectable card is currently selected. */
	selected?: boolean;
	/**
	 * `block` — bordered embedded card (default).
	 * `flyout` — elevated hover preview with the same content layout.
	 */
	appearance?: "block" | "flyout";
	className?: string;
}
