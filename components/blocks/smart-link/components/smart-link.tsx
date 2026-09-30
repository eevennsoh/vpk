"use client";

// oxlint-disable react-doctor/only-export-components -- This module intentionally exports colocated component API, variant contracts, context contracts, or metadata used by consumers.

// oxlint-disable react-doctor/prefer-tag-over-role -- This file uses ARIA roles for custom generated visuals or composite widgets where the suggested native tag would change semantics or behavior.

import { useId, useState, type ComponentProps, type ReactElement } from "react";
import AngleBracketsIcon from "@atlaskit/icon/core/angle-brackets";
import ArrowRightIcon from "@atlaskit/icon/core/arrow-right";
import CrossIcon from "@atlaskit/icon/core/cross";
import FilesIcon from "@atlaskit/icon/core/files";
import PageIcon from "@atlaskit/icon/core/page";
import PriorityHighestIcon from "@atlaskit/icon/core/priority-highest";
import PriorityHighIcon from "@atlaskit/icon/core/priority-high";
import PriorityMediumIcon from "@atlaskit/icon/core/priority-medium";
import PriorityLowIcon from "@atlaskit/icon/core/priority-low";
import PriorityMinorIcon from "@atlaskit/icon/core/priority-minor";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConeSafezone, ConeSafezoneContent, ConeSafezoneTrigger } from "@/components/utils/cone-safezone";
import { Icon } from "@/components/ui/icon";
import { IconTile } from "@/components/ui/icon-tile";
import { Lozenge, LozengeDropdownTrigger, type LozengeProps } from "@/components/ui/lozenge";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import {
	cloneIcon,
	getInitials,
	renderVisual,
	SmartLinkPreviewMedia,
	statusIconTone,
	toneClasses,
} from "@/components/blocks/smart-link/components/smart-link-visuals";

import type {
	SmartLinkAction,
	SmartLinkAvatar,
	SmartLinkBranchPath,
	SmartLinkCardProps,
	SmartLinkItem,
	SmartLinkMetadata,
	SmartLinkPriority,
	SmartLinkProps,
	SmartLinkProvider,
	SmartLinkSize,
	SmartLinkStatusChoice,
	SmartLinkStatusSelection,
	SmartLinkVisual,
} from "@/components/blocks/smart-link/components/smart-link-types";

export type {
	SmartLinkAction,
	SmartLinkAppearance,
	SmartLinkAvatar,
	SmartLinkBranchPath,
	SmartLinkCardProps,
	SmartLinkItem,
	SmartLinkMetadata,
	SmartLinkPreviewImage,
	SmartLinkPriority,
	SmartLinkProps,
	SmartLinkProvider,
	SmartLinkSize,
	SmartLinkStatusChoice,
	SmartLinkStatusSelection,
	SmartLinkTone,
	SmartLinkVariant,
	SmartLinkVisual,
} from "@/components/blocks/smart-link/components/smart-link-types";

// Inline chip geometry per size. `small` keeps the original VPK Tag metrics
// (12px label on a 20px pill); `large` scales the label to 16px on a 28px pill
// for prominent references.
const triggerSizeClasses: Record<SmartLinkSize, string> = {
	small: "h-5 gap-1 ps-px pe-[3px] text-xs leading-4",
	large: "h-7 gap-1.5 ps-1 pe-1 text-base leading-6",
};

// Icon wrapper size. App logos (AtlassianLogo/BrandLogoMark) render an
// intrinsically 16px glyph at the trigger size, so both chip sizes keep a 16px
// wrapper that hugs the glyph — a larger box leaves dead space to the right of
// the left-aligned SVG. `[&>*]:size-full` stretches the logo's container span to
// the wrapper (a no-op at 16px, but keeps other visual kinds filling the box).
const triggerVisualClasses: Record<SmartLinkSize, string> = {
	small: "size-4 [&>svg]:size-4",
	large: "size-4 [&>svg]:size-4",
};

// Status lozenge height per chip size so it fits inside the pill's inner height
// without being clipped by the chip's `overflow-hidden`.
const triggerStatusClasses: Record<SmartLinkSize, string> = {
	small: "h-4 text-[11px]",
	large: "h-5 text-xs",
};

// Right padding when a status lozenge trails the label. A bare-text chip pads the
// right more than its top/bottom gap; the lozenge already carries its own inset,
// so tighten the right padding per size until the gap beside it equals the chip's
// top/bottom gap (each value = top/bottom gap − 1px chip border).
const triggerStatusPaddingClasses: Record<SmartLinkSize, string> = {
	small: "pe-px", // 1px pad + 1px border = 2px, matching the 2px top/bottom gap
	large: "pe-[3px]", // 3px pad + 1px border = 4px, matching the 4px top/bottom gap
};

type SmartLinkTriggerBaseProps = {
	item: SmartLinkItem;
	open: boolean;
	removable?: boolean;
	size?: SmartLinkSize;
	showStatus?: boolean;
	selected?: boolean;
};

type SmartLinkAnchorTriggerProps = SmartLinkTriggerBaseProps &
	Omit<ComponentProps<"a">, "children" | "href"> & {
		onActivate?: undefined;
	};

type SmartLinkButtonTriggerProps = SmartLinkTriggerBaseProps &
	Omit<ComponentProps<"button">, "children" | "type"> & {
		onActivate: () => void;
	};

type SmartLinkTriggerProps = SmartLinkAnchorTriggerProps | SmartLinkButtonTriggerProps;

function SmartLinkTrigger({
	item,
	open,
	removable = false,
	size = "small",
	showStatus = false,
	selected = false,
	onActivate,
	className,
	...props
}: Readonly<SmartLinkTriggerProps>) {
	const status = showStatus ? item.status : undefined;
	// A goal chip's tint matches its *visible* score lozenge, so it follows
	// `status`. A pull request's glyph encodes Open/Merged on its own, so it keeps
	// its tone even when the chip hides the lozenge — the same source the block
	// card uses (`item.status`), which keeps the glyph consistent everywhere.
	const iconTone = statusIconTone(item.variant, item.variant === "goal" ? status : item.status);
	const triggerClassName = cn(
		// Extends the VPK Tag visual contract: the small size keeps the same
		// compact pill metrics (h-5, text-xs/leading-4, rounded-sm) so the
		// inline chip sits on a single text line; the large size scales the
		// label to 16px. Per-size gaps/padding live in triggerSizeClasses.
		"group/smart-link relative inline-flex min-w-0 shrink-0 items-center self-start overflow-hidden rounded-sm border border-border bg-bg-neutral-subtle py-0 align-middle font-normal text-link no-underline outline-none transition-[background-color,border-color,box-shadow] duration-fast ease-out hover:border-border-selected hover:bg-bg-neutral-subtle-hovered focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
		triggerSizeClasses[size],
		// Match the gap beside a trailing status lozenge to the chip's
		// top/bottom gap (see triggerStatusPaddingClasses).
		status ? triggerStatusPaddingClasses[size] : null,
		// Status chips hug icon + title + lozenge, then cap at the parent so a
		// long title truncates against the lozenge instead of overflowing. Without
		// a status the chip keeps the compact inline Tag cap.
		status ? "max-w-full" : "max-w-[11.25rem]",
		open && "border-border-selected",
		onActivate &&
			selected &&
			"border-border-selected bg-bg-selected text-text-selected hover:bg-bg-selected-hovered active:bg-bg-selected-pressed",
		className,
	);
	const content = (
		<>
			<span
				className={cn(
					"flex shrink-0 items-center justify-center [&>*]:size-full",
					triggerVisualClasses[size],
				)}
			>
				{renderVisual(item.icon, "trigger", iconTone)}
			</span>
			<span
				className={cn(
					"min-w-0 truncate whitespace-nowrap",
					status ? null : "grow",
					removable &&
						!status &&
						"group-hover/smart-link-remove:[mask-image:linear-gradient(to_right,#000_calc(100%-2.25rem),transparent_calc(100%-1.25rem))] group-has-[:focus-visible]/smart-link-remove:[mask-image:linear-gradient(to_right,#000_calc(100%-2.25rem),transparent_calc(100%-1.25rem))] group-hover/smart-link-remove:[-webkit-mask-image:linear-gradient(to_right,#000_calc(100%-2.25rem),transparent_calc(100%-1.25rem))] group-has-[:focus-visible]/smart-link-remove:[-webkit-mask-image:linear-gradient(to_right,#000_calc(100%-2.25rem),transparent_calc(100%-1.25rem))]",
				)}
				data-smart-link-text
			>
				{item.title}
			</span>
			{status ? (
				<Lozenge
					className={cn(
						"shrink-0",
						triggerStatusClasses[size],
						removable &&
							"group-hover/smart-link-remove:[mask-image:linear-gradient(to_right,#000_calc(100%-1.5rem),transparent_calc(100%-1rem))] group-has-[:focus-visible]/smart-link-remove:[mask-image:linear-gradient(to_right,#000_calc(100%-1.5rem),transparent_calc(100%-1rem))] group-hover/smart-link-remove:[-webkit-mask-image:linear-gradient(to_right,#000_calc(100%-1.5rem),transparent_calc(100%-1rem))] group-has-[:focus-visible]/smart-link-remove:[-webkit-mask-image:linear-gradient(to_right,#000_calc(100%-1.5rem),transparent_calc(100%-1rem))]",
					)}
					metric={status.metric}
					variant={status.variant ?? "neutral"}
				>
					{status.label}
				</Lozenge>
			) : null}
		</>
	);

	if (onActivate) {
		const { onClick, ...buttonProps } = props as ComponentProps<"button">;

		return (
			<button
				{...buttonProps}
				aria-describedby={open ? `smart-link-card-${item.id}` : undefined}
				aria-pressed={selected}
				className={triggerClassName}
				onClick={(event) => {
					onClick?.(event);
					if (!event.defaultPrevented) {
						onActivate();
					}
				}}
				type="button"
			>
				{content}
			</button>
		);
	}

	return (
		<a
			{...(props as ComponentProps<"a">)}
			aria-describedby={open ? `smart-link-card-${item.id}` : undefined}
			className={triggerClassName}
			href={item.href}
		>
			{content}
		</a>
	);
}

function SmartLinkAvatarStack({
	avatars,
	overflow,
}: Readonly<{ avatars?: ReadonlyArray<SmartLinkAvatar>; overflow?: number }>) {
	if (!avatars?.length) {
		return null;
	}

	return (
		<div className="flex items-center pl-0.5">
			{avatars.slice(0, 3).map((avatar, index) => (
				<Avatar
					key={avatar.name}
					className={cn(index > 0 && "-ml-2")}
					label={avatar.name}
					size="sm"
				>
					{avatar.src ? <AvatarImage alt={avatar.name} src={avatar.src} /> : null}
					<AvatarFallback>{getInitials(avatar.name)}</AvatarFallback>
				</Avatar>
			))}
			{overflow ? (
				<span className="-ml-1 inline-flex size-6 items-center justify-center rounded-full bg-bg-neutral text-xs leading-4 text-text">
					+{overflow}
				</span>
			) : null}
		</div>
	);
}

const priorityPresentations: Record<SmartLinkPriority, { icon: ReactElement; label: string }> = {
	highest: { icon: <PriorityHighestIcon label="" color={token("color.icon.danger")} />, label: "Highest" },
	high: { icon: <PriorityHighIcon label="" color={token("color.icon.danger")} />, label: "High" },
	medium: { icon: <PriorityMediumIcon label="" color={token("color.icon.warning")} />, label: "Medium" },
	low: { icon: <PriorityLowIcon label="" color={token("color.icon.information")} />, label: "Low" },
	lowest: { icon: <PriorityMinorIcon label="" color={token("color.icon.information")} />, label: "Minor" },
};

function SmartLinkAssigneeAvatar({ assignee }: Readonly<{ assignee: SmartLinkAvatar }>) {
	return (
		<Avatar label={assignee.name} size="sm">
			{assignee.src ? <AvatarImage alt={assignee.name} src={assignee.src} /> : null}
			<AvatarFallback>{getInitials(assignee.name)}</AvatarFallback>
		</Avatar>
	);
}

function SmartLinkPriorityIndicator({ priority }: Readonly<{ priority: SmartLinkPriority }>) {
	const presentation = priorityPresentations[priority];

	return (
		<span className="inline-flex items-center gap-1 text-sm leading-5 text-text-subtle">
			<Icon render={presentation.icon} aria-hidden />
			{presentation.label}
		</span>
	);
}

const lozengeToBadgeVariant: Partial<Record<NonNullable<LozengeProps["variant"]>, BadgeProps["variant"]>> = {
	neutral: "neutral",
	success: "success",
	danger: "danger",
	warning: "warning",
	information: "information",
	discovery: "discovery",
};

function badgeVariantForLozenge(variant: NonNullable<LozengeProps["variant"]>): BadgeProps["variant"] {
	return lozengeToBadgeVariant[variant] ?? "neutral";
}

/** Picked status for one item; a different item starts from its own status again. */
export function useSmartLinkStatusSelection(item: SmartLinkItem): SmartLinkStatusSelection {
	const [picked, setPicked] = useState<{ itemId: string; choice: SmartLinkStatusChoice } | null>(null);
	return {
		choice: picked?.itemId === item.id ? picked.choice : null,
		select: (choice) => setPicked({ itemId: item.id, choice }),
	};
}

function withPickedStatus(item: SmartLinkItem, choice: SmartLinkStatusChoice | null): SmartLinkItem {
	if (!choice || !item.status) {
		return item;
	}
	// The original metric describes the original status, so a picked status drops it.
	return { ...item, status: { ...item.status, label: choice.label, variant: choice.variant, metric: undefined } };
}

function SmartLinkStatusDropdown({
	selection,
	status,
}: Readonly<{ selection: SmartLinkStatusSelection; status: NonNullable<SmartLinkItem["status"]> }>) {
	const selected = selection.choice ?? { label: status.label, variant: status.variant ?? "neutral" };
	const options = status.options ?? [];

	if (!options.length) {
		const variant = status.variant ?? "neutral";

		return (
			<Lozenge className={cn(status.metric != null && "pr-px")} variant={variant}>
				{status.label}
				{status.metric != null ? (
					<Badge className="ml-1 min-w-0" variant={badgeVariantForLozenge(variant)}>
						{status.metric}
					</Badge>
				) : null}
			</Lozenge>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<LozengeDropdownTrigger
						aria-label={`Status: ${selected.label}`}
						maxWidth="160px"
						variant={selected.variant}
					/>
				}
			>
				{selected.label}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-44 p-0" sideOffset={6}>
				<DropdownMenuGroup className="p-0 py-2">
					{options.map((option) => (
						<DropdownMenuItem
							aria-current={option.label === selected.label ? "true" : undefined}
							className={cn(
								"rounded-none border-l-2 border-l-transparent px-0 py-2.5 pl-2.5",
								option.label === selected.label && "border-l-border-selected bg-bg-neutral",
							)}
							key={option.label}
							onSelect={() => selection.select({ label: option.label, variant: option.variant ?? "neutral" })}
						>
							<Lozenge variant={option.variant ?? "neutral"}>{option.label}</Lozenge>
						</DropdownMenuItem>
					))}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function MetadataPill({ metadata }: Readonly<{ metadata: SmartLinkMetadata }>) {
	if (metadata.metric != null) {
		// Icon-only metrics (e.g. reactions, comment counts) render as a bare
		// icon + number, not wrapped in a lozenge/badge.
		if (!metadata.label) {
			return (
				<span className="inline-flex min-h-5 items-center gap-1 text-sm leading-5 text-text-subtle">
					{metadata.icon ? <Icon render={cloneIcon(metadata.icon, "small")} aria-hidden /> : null}
					{metadata.metric}
				</span>
			);
		}

		const variant = metadata.metricVariant ?? "neutral";

		return (
			<Lozenge
				className="pr-0.5"
				elemBefore={metadata.icon ? <Icon render={cloneIcon(metadata.icon, "small")} aria-hidden /> : undefined}
				variant={variant}
			>
				{metadata.label}
				<Badge className="ml-1 min-w-0" variant="neutral">
					{metadata.metric}
				</Badge>
			</Lozenge>
		);
	}

	return (
		<span
			className={cn(
				"inline-flex min-h-5 items-center gap-1 text-sm leading-5 text-text-subtle",
				metadata.tone ? cn("rounded-md px-1.5", toneClasses[metadata.tone]) : null,
			)}
		>
			{metadata.icon ? <Icon render={cloneIcon(metadata.icon, "small")} /> : null}
			{metadata.label}
		</span>
	);
}

function codeStatsFileLabel(files: number) {
	return `${files} ${files === 1 ? "file" : "files"}`;
}

/**
 * Pull-request diff stats in their own row beneath the description: file count
 * and added/removed line counts, each behind its own glyph.
 *
 * Each group is `role="img"` so its `aria-label` survives — `aria-label` is
 * prohibited on the implicit `generic` role, and without a role assistive tech
 * drops the label and reads the bare "+86 -21" fragments instead.
 */
function SmartLinkCodeStatsRow({ item }: Readonly<{ item: SmartLinkItem }>) {
	const codeStats = item.codeStats;
	if (!codeStats) {
		return null;
	}

	const fileLabel = codeStats.files != null ? codeStatsFileLabel(codeStats.files) : null;

	return (
		<div className="flex flex-wrap items-center gap-3 px-4 pt-1 pb-2 text-sm leading-5">
			{fileLabel ? (
				<span
					aria-label={`${fileLabel} changed`}
					className="inline-flex items-center gap-1 text-text-subtle"
					role="img"
				>
					<Icon aria-hidden className="text-icon-subtle" render={<FilesIcon label="" size="small" />} />
					{fileLabel}
				</span>
			) : null}
			<span
				aria-label={`${codeStats.additions} additions, ${codeStats.deletions} deletions`}
				className="inline-flex items-center gap-1 tabular-nums"
				role="img"
			>
				<Icon aria-hidden className="text-icon-subtle" render={<AngleBracketsIcon label="" size="small" />} />
				{/* The counts read as one +/- pair, so they sit tighter than the icon gap. */}
				<span className="inline-flex items-center gap-0.5">
					<span className="text-text-success">+{codeStats.additions}</span>
					<span className="text-text-danger">-{codeStats.deletions}</span>
				</span>
			</span>
		</div>
	);
}

/** First path segment stays subtle (`feature/…`); the remainder uses body text. */
function SmartLinkBranchName({ name }: Readonly<{ name: string }>) {
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

/** `source → target`, mirroring the pull-request block's branch path. */
function SmartLinkBranchPathLabel({ branchPath }: Readonly<{ branchPath: SmartLinkBranchPath }>) {
	const { branch, targetBranch } = branchPath;
	if (!branch && !targetBranch) {
		return null;
	}

	return (
		<span
			aria-label={branch && targetBranch ? `${branch} into ${targetBranch}` : (branch ?? targetBranch)}
			className="inline-flex min-w-0 shrink items-center gap-1 overflow-hidden text-sm leading-5"
			role="img"
		>
			{/* Source truncates; target stays full (`main`, not `m…`). */}
			{branch ? <SmartLinkBranchName name={branch} /> : null}
			{branch && targetBranch ? (
				<Icon aria-hidden className="shrink-0 text-icon-subtle" render={<ArrowRightIcon label="" size="small" />} />
			) : null}
			{targetBranch ? <span className="shrink-0 text-text">{targetBranch}</span> : null}
		</span>
	);
}

function isEngagementMetric(metadata: SmartLinkMetadata) {
	return metadata.metric != null && !metadata.label;
}

function SmartLinkMetadataRow({ item }: Readonly<{ item: SmartLinkItem }>) {
	const metadataItems = item.metadata?.filter((metadata) => !isEngagementMetric(metadata));
	const hasMetadata = Boolean(metadataItems?.length);
	const hasIssueDetails = item.assignee || item.priority;
	const hasAuthorDetails = item.author || item.date;
	const branchPath = item.branchPath;
	const hasBranchPath = Boolean(branchPath?.branch || branchPath?.targetBranch);

	if (
		!item.avatars?.length &&
		!hasMetadata &&
		!hasIssueDetails &&
		!hasAuthorDetails &&
		!hasBranchPath &&
		!item.dueDate
	) {
		return null;
	}

	// Pull requests use this row as a single-line context strip — author avatar,
	// then `source → target`. The repo is not repeated here: the provider mark
	// and the PR number already say where the change lives. The author's name and
	// the `·` separators give up their space so the branch path can truncate
	// instead of wrapping.
	const isBranchContext = hasBranchPath;

	return (
		<div
			className={cn(
				"flex min-w-0 items-center gap-2 text-sm leading-5 text-text-subtle",
				isBranchContext ? "flex-nowrap overflow-hidden" : "flex-wrap",
			)}
		>
			<SmartLinkAvatarStack avatars={item.avatars} overflow={item.avatarOverflow} />
			{item.assignee ? <SmartLinkAssigneeAvatar assignee={item.assignee} /> : null}
			{item.author ? (
				<span className="inline-flex min-w-0 shrink-0 items-center gap-2">
					{/* The avatar carries `label={name}`, so hiding the text keeps the name for AT. */}
					<SmartLinkAssigneeAvatar assignee={item.author} />
					{isBranchContext ? null : <span className="truncate">Created by {item.author.name}</span>}
				</span>
			) : null}
			{item.author && item.date && !isBranchContext ? <span aria-hidden>·</span> : null}
			{item.date ? <span className="truncate">{item.date}</span> : null}
			{metadataItems?.map((metadata, index) => (
				<span className="inline-flex items-center gap-2" key={`${metadata.label}-${index}`}>
					{(index > 0 || item.avatars?.length || item.author || item.assignee || item.date) ? (
						<span aria-hidden>·</span>
					) : null}
					<MetadataPill metadata={metadata} />
				</span>
			))}
			{hasBranchPath && branchPath ? <SmartLinkBranchPathLabel branchPath={branchPath} /> : null}
			{item.priority ? <SmartLinkPriorityIndicator priority={item.priority} /> : null}
			{item.dueDate ? (
				<span className="inline-flex h-5 items-center rounded-sm border border-border-bold bg-surface px-1.5 text-xs leading-4 text-text">
					{item.dueDate}
				</span>
			) : null}
		</div>
	);
}

function SmartLinkEngagementRow({ item }: Readonly<{ item: SmartLinkItem }>) {
	const engagement = item.metadata?.filter(isEngagementMetric);
	if (!engagement?.length) {
		return null;
	}

	return (
		<div className="flex flex-wrap items-center gap-3 px-4 pt-1 pb-2">
			{engagement.map((metadata, index) => (
				<MetadataPill key={`engagement-${index}`} metadata={metadata} />
			))}
		</div>
	);
}

function SmartLinkActionRow({
	action,
	item,
	onActionSelect,
}: Readonly<{
	action: SmartLinkAction;
	item: SmartLinkItem;
	onActionSelect?: (action: SmartLinkAction, item: SmartLinkItem) => void;
}>) {
	const handleClick = () => {
		action.onSelect?.(item, action);
		onActionSelect?.(action, item);
	};

	return (
		<button
			className="flex min-h-8 w-full cursor-pointer items-center gap-3 bg-transparent px-4 py-1.5 text-left text-sm leading-5 text-text-subtle outline-none transition-colors duration-fast ease-out hover:bg-bg-neutral-subtle-hovered focus-visible:bg-bg-neutral-subtle-hovered focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50"
			onClick={handleClick}
			type="button"
		>
			<IconTile
				aria-hidden
				className="text-icon-subtle"
				icon={cloneIcon(action.icon, "small")}
				label=""
				size="small"
				variant="transparent"
			/>
			<span className="truncate">{action.label}</span>
		</button>
	);
}

const FOOTER_VISIBLE_ACTION_COUNT = 2;

function SmartLinkFooterActions({
	actions,
	item,
	onActionSelect,
}: Readonly<{
	actions: ReadonlyArray<SmartLinkAction>;
	item: SmartLinkItem;
	onActionSelect?: (action: SmartLinkAction, item: SmartLinkItem) => void;
}>) {
	const visibleActions = actions.slice(0, FOOTER_VISIBLE_ACTION_COUNT);
	const overflowActions = actions.slice(FOOTER_VISIBLE_ACTION_COUNT);

	const runAction = (action: SmartLinkAction) => {
		action.onSelect?.(item, action);
		onActionSelect?.(action, item);
	};

	return (
		<div className="flex flex-wrap items-center justify-end gap-2">
			{visibleActions.map((action) => (
				<Button
					key={action.id}
					onClick={() => runAction(action)}
					size="compact"
					type="button"
					variant="outline"
				>
					{action.label}
				</Button>
			))}
			{overflowActions.length > 0 ? (
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button aria-label="More actions" size="icon-compact" type="button" variant="outline">
								<ShowMoreHorizontalIcon label="" size="small" />
							</Button>
						}
					/>
					<DropdownMenuContent align="end" sideOffset={6}>
						<DropdownMenuGroup>
							{overflowActions.map((action) => (
								<DropdownMenuItem key={action.id} onSelect={() => runAction(action)}>
									{action.label}
								</DropdownMenuItem>
							))}
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			) : null}
		</div>
	);
}

function SmartLinkFooter({
	provider,
	actions,
	item,
	onActionSelect,
	showActionButtons,
}: Readonly<{
	provider: SmartLinkProvider;
	actions?: ReadonlyArray<SmartLinkAction>;
	item: SmartLinkItem;
	onActionSelect?: (action: SmartLinkAction, item: SmartLinkItem) => void;
	showActionButtons: boolean;
}>) {
	// Pull-request cards keep the footer as a quiet provenance strip: their actions
	// stay in the flyout rather than being repeated as a block-card button.
	const footerActions =
		showActionButtons && item.variant !== "pull-request"
			? actions?.filter((action) => action.id !== "copy-link")
			: undefined;
	const hasActions = Boolean(footerActions?.length);

	return (
		<div
			className={cn(
				"flex items-center gap-3 px-4 pt-2 pb-3 text-xs leading-4 text-text-subtlest",
				hasActions ? "justify-between" : null,
			)}
		>
			<div className="flex min-w-0 items-center gap-1">
				{provider.logo ? renderVisual(provider.logo, "footer") : null}
				<span className="truncate">{provider.name}</span>
			</div>
			{hasActions && footerActions ? (
				<SmartLinkFooterActions actions={footerActions} item={item} onActionSelect={onActionSelect} />
			) : null}
		</div>
	);
}

export function SmartLinkCard({
	item,
	onActionSelect,
	onActivate,
	selected = false,
	appearance = "block",
	className,
	statusSelection,
}: Readonly<SmartLinkCardProps>) {
	const ownStatusSelection = useSmartLinkStatusSelection(item);
	const activeStatusSelection = statusSelection ?? ownStatusSelection;
	const titleId = useId();
	const isFlyout = appearance === "flyout";
	const showFooterButtons = appearance === "block";
	const showFlyoutActions = isFlyout && Boolean(item.actions?.length);
	const titleClassName =
		"line-clamp-2 min-w-0 flex-1 text-left text-sm font-semibold leading-5 text-link no-underline outline-none hover:underline focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50";

	return (
		<div
			aria-labelledby={titleId}
			className={cn(
				"w-full max-w-[32rem] overflow-hidden rounded-lg bg-surface text-text",
				// Pull-request previews match the shared 320px Jira session flyout,
				// while embedded cards keep their wider 400px presentation. Both
				// stay fixed rather than shrink-to-fit so branch paths and stats do
				// not rewrap as hover moves down a list.
				item.variant === "pull-request"
					? isFlyout
						? "w-[320px] max-w-[calc(100vw-48px)]"
						: "w-[25rem] max-w-full"
					: null,
				isFlyout ? "bg-surface-overlay shadow-2xl" : "border border-border",
				onActivate &&
					selected &&
					"border-border-selected bg-bg-selected text-text-selected",
				className,
			)}
			id={`smart-link-card-${item.id}`}
			role="group"
		>
			{item.previewImage ? <SmartLinkPreviewMedia image={item.previewImage} /> : null}
			<div className="flex flex-col gap-2 px-4 pt-4 pb-2">
				<div className="flex min-w-0 items-center gap-2">
					<span className="inline-flex shrink-0 items-center">{renderVisual(item.icon, "card", statusIconTone(item.variant, item.status))}</span>
					{onActivate ? (
						<button
							aria-pressed={selected}
							className={titleClassName}
							id={titleId}
							onClick={() => onActivate(item)}
							type="button"
						>
							{item.title}
						</button>
					) : (
						<a className={titleClassName} href={item.href} id={titleId}>
							{item.title}
						</a>
					)}
					{item.status ? (
						<span className="shrink-0">
							<SmartLinkStatusDropdown selection={activeStatusSelection} status={item.status} />
						</span>
					) : null}
				</div>
				<SmartLinkMetadataRow item={item} />
			</div>
			{item.description ? (
				<div className="px-4 py-1">
					<p className="line-clamp-3 text-sm leading-5 text-text">{item.description}</p>
				</div>
			) : null}
			<SmartLinkCodeStatsRow item={item} />
			<SmartLinkEngagementRow item={item} />
			{showFlyoutActions ? (
				<div className="flex w-full flex-col py-1">
					{item.actions?.map((action) => (
						<SmartLinkActionRow
							action={action}
							item={item}
							key={action.id}
							onActionSelect={onActionSelect}
						/>
					))}
				</div>
			) : null}
			<SmartLinkFooter
				actions={item.actions}
				item={item}
				onActionSelect={onActionSelect}
				provider={item.provider}
				showActionButtons={showFooterButtons}
			/>
		</div>
	);
}

export function SmartLink({
	item,
	appearance = "inline",
	side = "bottom",
	align = "start",
	alignOffset,
	positionerClassName,
	size = "small",
	showStatus = false,
	openDelay = 120,
	closeDelay = 80,
	onOpenChange,
	onActivate,
	selected = false,
	onActionSelect,
	onRemove,
	removeVariant,
	removeButtonLabel,
	className,
	contentClassName,
}: Readonly<SmartLinkProps>) {
	const [open, setOpen] = useState(false);
	// Owned here because the flyout card unmounts on close; the chip shows the same pick.
	const statusSelection = useSmartLinkStatusSelection(item);
	const isRemovableOverlay = Boolean(onRemove) && removeVariant === "overlay";

	if (appearance === "card") {
		return (
			<SmartLinkCard
				appearance="block"
				className={className}
				item={item}
				onActionSelect={onActionSelect}
				onActivate={onActivate}
				selected={selected}
				statusSelection={statusSelection}
			/>
		);
	}
	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen);
		onOpenChange?.(nextOpen);
	};
	const handleActivate = () => {
		handleOpenChange(false);
		onActivate?.(item);
	};

	const hoverCard = (
		<ConeSafezone
			closeDelay={closeDelay}
			onOpenChange={handleOpenChange}
			open={open}
			openDelay={openDelay}
		>
			<ConeSafezoneTrigger
				render={
					<SmartLinkTrigger
						className={className}
						item={withPickedStatus(item, statusSelection.choice)}
						onActivate={onActivate ? handleActivate : undefined}
						open={open}
						removable={isRemovableOverlay}
						selected={selected}
						showStatus={showStatus}
						size={size}
					/>
				}
			/>
			<ConeSafezoneContent
				align={align}
				alignOffset={alignOffset}
				className="w-auto border-0 bg-transparent p-0 text-text shadow-none"
				positionerClassName={positionerClassName}
				side={side}
				sideOffset={8}
			>
				<SmartLinkCard
					appearance="flyout"
					className={contentClassName}
					item={item}
					onActionSelect={onActionSelect}
					statusSelection={statusSelection}
				/>
			</ConeSafezoneContent>
		</ConeSafezone>
	);

	if (!isRemovableOverlay) {
		return hoverCard;
	}

	return (
		<span className="group/smart-link-remove relative inline-flex min-w-0 max-w-full shrink-0 self-start">
			{hoverCard}
			<button
				aria-label={removeButtonLabel ?? `Remove ${item.title}`}
				className="pointer-events-none absolute end-0.5 top-1/2 inline-flex size-4 -translate-y-1/2 items-center justify-center rounded-xs border-0 bg-transparent text-text opacity-0 transition-[opacity,background-color] duration-fast ease-out-practical motion-reduce:transition-none hover:bg-bg-neutral-subtle-hovered active:bg-bg-neutral-subtle-pressed focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none group-hover/smart-link-remove:pointer-events-auto group-hover/smart-link-remove:opacity-100 group-has-[:focus-visible]/smart-link-remove:pointer-events-auto group-has-[:focus-visible]/smart-link-remove:opacity-100"
				data-slot="smart-link-remove-overlay-button"
				onClick={(event) => {
					event.stopPropagation();
					onRemove?.();
				}}
				type="button"
			>
				<Icon render={<CrossIcon label="" size="small" color="currentColor" />} aria-hidden />
			</button>
		</span>
	);
}

export const SMART_LINK_FALLBACK_ICON = { kind: "icon-tile", icon: <PageIcon label="" size="medium" /> } satisfies SmartLinkVisual;
