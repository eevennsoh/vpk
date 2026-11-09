"use client";

import type { ComponentProps, ReactNode } from "react";
import { useMemo } from "react";

import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import DeleteIcon from "@atlaskit/icon/core/delete";
import EditIcon from "@atlaskit/icon/core/edit";
import PageIcon from "@atlaskit/icon/core/page";

import { getDirectoryMentionItemOrFallback } from "@/components/blocks/editor-palette/data/mention-sources";
import { tagColorToMenuIconClassName } from "@/components/blocks/agent-config-core/components/agent-config-visuals";
import { Badge } from "@/components/ui/badge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { IconTile } from "@/components/ui/icon-tile";
import { Switch } from "@/components/ui/switch";
import type { TagColor } from "@/components/ui/tag";
import { HoverRevealActions, HoverRevealLabel, hoverRevealRowClassName } from "@/components/ui-custom/hover-reveal-row";
import { type RichTextReferenceCategory, RichTextMentionVisualMark } from "@/components/ui-custom/rich-text-editor";
import { cn } from "@/lib/utils";

export interface AgentCompactConfigNavButtonItem {
	agentFieldName: string;
	label: string;
	count: number;
}

// Shared flat-trigger look for every item in the connected config menu bar.
// Kept subtle (no border/background) so the strip reads as one continuous
// surface rather than a row of separate buttons.
export const AGENT_COMPACT_CONFIG_NAV_TRIGGER_CLASS =
	"inline-flex h-6 shrink-0 items-center gap-1 rounded px-2 text-xs font-semibold leading-4 text-text-subtlest transition-colors outline-hidden hover:bg-bg-neutral-subtle-hovered hover:text-text aria-expanded:bg-bg-neutral-subtle-hovered aria-expanded:text-text focus-visible:ring-3 focus-visible:ring-ring/50";

export function AgentCompactConfigNavButton({
	className,
	item,
	onClick,
	screenAssistantTargetId,
	...props
}: Readonly<{
	item: AgentCompactConfigNavButtonItem;
	onClick?: () => void;
	screenAssistantTargetId?: string;
} & ComponentProps<"button">>) {
	return (
		<button
			type="button"
			data-agent-field={item.agentFieldName}
			data-screen-assistant-target={screenAssistantTargetId}
			className={cn(AGENT_COMPACT_CONFIG_NAV_TRIGGER_CLASS, className)}
			onClick={onClick}
			{...props}
		>
			{item.label}
			{item.count > 0 ? <Badge>{item.count}</Badge> : null}
		</button>
	);
}

// Memoize disabled label keys for O(1) per-row lookups. The collapsed-nav
// dropdowns receive the field's disabled labels (derived from the persisted
// config) and match by field-specific key so the state survives reorder/removal.
const trimDisabledLabel = (value: string) => value.trim();
function suppressMenuDismissal(event: { preventDefault: () => void }) {
	event.preventDefault();
}

export function useDisabledLabelSet(
	disabledItems: readonly string[] | undefined,
	normalize: (value: string) => string = trimDisabledLabel,
): ReadonlySet<string> {
	return useMemo(() => new Set((disabledItems ?? []).map(normalize)), [disabledItems, normalize]);
}

// A single automation row inside the collapsed Automations dropdown. Mirrors the
// subagent switcher (SubagentSwitcherButton) hover model: a Switch parks at the
// far right and stays visible while off, an edit button slides in on hover, and a
// disabled (off) trigger reads as muted. Unlike a DropdownMenuItem this is a plain
// row so toggling/editing never closes the menu.
export function AgentCompactTriggerRow({
	icon,
	label,
	enabled,
	onToggle,
	onEdit,
}: Readonly<{
	icon?: ReactNode;
	label: string;
	enabled: boolean;
	onToggle: (enabled: boolean) => void;
	onEdit?: () => void;
}>) {
	// The row is a Base UI Menu.Item with `closeOnClick={false}` so item activation
	// doesn't close the menu. The switch additionally calls `preventDefault()` on
	// pointerdown: Base UI's dismissal treats a prevented press that starts inside
	// the popup as intentional and suppresses the follow-up outside-click, so
	// toggling never dismisses the menu even when the re-render detaches the
	// pressed node. preventDefault is safe here because the Switch toggles via
	// `onCheckedChange`, not the native default.
	return (
		<DropdownMenuItem
			closeOnClick={false}
			className={cn(
				hoverRevealRowClassName,
				"cursor-default",
				// A disabled row reads as muted until re-enabled — keep it muted on
				// hover too (the item's `data-[highlighted]:text-text` would otherwise
				// re-darken the label).
				enabled ? undefined : "text-text-disabled data-[highlighted]:text-text-disabled",
			)}
			elemBefore={
				icon ? (
					// The icon is a self-colored collection tile, so dim it via opacity
					// when disabled — mirroring the subagent rows (`AgentCompactReferenceRow`)
					// rather than recoloring the glyph, which the tile's `!` color overrides.
					<span
						className={cn(
							"inline-flex size-6 shrink-0 items-center justify-center",
							enabled ? undefined : "opacity-(--opacity-disabled)",
						)}
					>
						{icon}
					</span>
				) : undefined
			}
		>
			<HoverRevealLabel
				reserveOnReveal={onEdit ? 2 : 1}
				// A disabled row parks its switch visibly, so keep its single-control
				// width reserved even at rest; an enabled row gets the full width.
				reserveAtRest={enabled ? 0 : 1}
			>
				{label}
			</HoverRevealLabel>
			<HoverRevealActions
				toggleParked={!enabled}
				toggle={
					<Switch
						size="sm"
						checked={enabled}
						onCheckedChange={onToggle}
						onPointerDown={suppressMenuDismissal}
						onMouseDown={suppressMenuDismissal}
						aria-label={`${enabled ? "Disable" : "Enable"} ${label}`}
					/>
				}
				action={
					onEdit ? (
						<button
							type="button"
							aria-label={`Edit ${label}`}
							className="flex size-6 items-center justify-center rounded-md text-text-subtlest transition-colors duration-normal ease-out hover:bg-bg-neutral-subtle-hovered hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-selected [&_svg]:size-4"
							onClick={onEdit}
						>
							<EditIcon label="" size="small" />
						</button>
					) : undefined
				}
			/>
		</DropdownMenuItem>
	);
}

// Resolves a configured reference row's leading "front slot" visual from its
// directory category — the same avatar/logo/icon the inline AgentReferenceChip
// shows. Rendered natively at `menu-compact` (a 24px `small` tile) to fill the
// 24px front slot, matching the trigger rows and footer icons in these
// dropdowns. Drawing natively (rather than scaling a 32px `menu` mark down to
// 75%) keeps the glyph on ADS's `small` Tile inset (14px) instead of freezing
// the `medium` inset and shrinking the glyph to 12px. Values not present in the
// directory fall back to a category-appropriate `small` icon tile, mirroring
// AgentReferenceChip's fallback. Subagents are prompt references owned by the
// parent agent, so they deliberately skip directory avatar resolution and always
// use the AI-agent tile. Glyph icons inherit the menu's subtle front-slot
// treatment; avatars/logos/images keep their color, exactly like the sibling
// Triggers rows.
function renderAgentReferenceRowVisual(
	category: RichTextReferenceCategory,
	label: string,
	tagColor?: TagColor,
): ReactNode {
	if (category === "subagent") {
		return (
			<span className="inline-flex size-6 shrink-0 items-center justify-center">
				<IconTile
					aria-hidden
					className={cn(
						"border border-border bg-surface",
						tagColor ? tagColorToMenuIconClassName[tagColor] : "text-icon-subtlest",
					)}
					icon={<AiAgentIcon label="" size="small" />}
					label=""
					size="small"
				/>
			</span>
		);
	}

	const visual = getDirectoryMentionItemOrFallback(category, label).visual;
	return (
		<span className="inline-flex size-6 shrink-0 items-center justify-center">
			{visual ? (
				<RichTextMentionVisualMark category={category} label={label} size="menu-compact" visual={visual} />
			) : (
				<IconTile
					aria-hidden
					className={cn(
						"border border-border bg-surface",
						tagColor ? tagColorToMenuIconClassName[tagColor] : "text-icon-subtlest",
					)}
					icon={<PageIcon label="" size="small" />}
					label=""
					size="small"
				/>
			)}
		</span>
	);
}

// A configured reference row (knowledge / tools / skills / subagents) inside a
// collapsed config dropdown. Mirrors AgentCompactTriggerRow's hover-reveal model:
// the label truncates clear of trailing controls that reveal on hover/focus —
// an enable/disable Switch (parked visible while off) plus a "Remove" button.
// The row's primary press keeps its normal behavior (open the directory on this
// item); both trailing controls stop propagation so they never also trigger the
// row press or dismiss the menu.
export function AgentCompactReferenceRow({
	category,
	elemBefore,
	enabled = true,
	label,
	onClick,
	onRemove,
	onToggle,
	selected,
	tagColor,
}: Readonly<{
	// Directory category for the row. When set (and no explicit `elemBefore` is
	// passed), the row resolves its leading "front slot" visual from the directory
	// so every configured item shows the same avatar/logo/icon as its inline chip.
	category?: RichTextReferenceCategory;
	elemBefore?: ReactNode;
	enabled?: boolean;
	label: string;
	onClick?: () => void;
	onRemove?: () => void;
	onToggle?: (enabled: boolean) => void;
	selected?: boolean;
	tagColor?: TagColor;
}>) {
	// See AgentCompactTriggerRow: preventDefault on the switch's pointer/mouse
	// down stops Base UI from dismissing the menu when toggling.
	// Prefer an explicit elemBefore; otherwise derive the front slot from the row's
	// directory category so skills/tools/apps/subagents each lead with their icon.
	const frontSlot = elemBefore ?? (category ? renderAgentReferenceRowVisual(category, label, tagColor) : undefined);
	const hasToggle = onToggle !== undefined;
	// Reserve trailing width for whichever controls exist: switch + remove = 2,
	// either alone = 1, neither = none.
	const reserveCount = (hasToggle ? 1 : 0) + (onRemove ? 1 : 0);
	const resolvedElemBefore = frontSlot
		? hasToggle && !enabled
			? <span className="inline-flex size-6 items-center justify-center opacity-(--opacity-disabled)">{frontSlot}</span>
			: frontSlot
		: undefined;
	return (
		<DropdownMenuItem
			closeOnClick={!hasToggle}
			className={cn(
				hoverRevealRowClassName,
				// A disabled row reads as muted until re-enabled — keep it muted on
				// hover too (the item's `data-[highlighted]:text-text` would otherwise
				// re-darken the label).
				hasToggle && !enabled ? "text-text-disabled data-[highlighted]:text-text-disabled" : undefined,
			)}
			elemBefore={resolvedElemBefore}
			onClick={onClick}
			selected={selected}
		>
			<HoverRevealLabel
				reserveOnReveal={reserveCount > 0 ? (reserveCount as 1 | 2) : undefined}
				// A disabled row parks its switch visibly, so keep one control's width
				// reserved even at rest; otherwise reveal the full label at rest.
				reserveAtRest={hasToggle && !enabled ? 1 : 0}
			>
				{label}
			</HoverRevealLabel>
			{reserveCount > 0 ? (
				<HoverRevealActions
					toggleParked={hasToggle && !enabled}
					toggle={
						hasToggle ? (
							<Switch
								size="sm"
								checked={enabled}
								onCheckedChange={onToggle}
								onPointerDown={suppressMenuDismissal}
								onMouseDown={suppressMenuDismissal}
								aria-label={`${enabled ? "Disable" : "Enable"} ${label}`}
							/>
						) : undefined
					}
					action={
						onRemove ? (
							<button
								type="button"
								aria-label={`Remove ${label}`}
								className="flex size-6 items-center justify-center rounded-md text-text-subtlest transition-colors duration-normal ease-out hover:bg-bg-neutral-subtle-hovered hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-selected [&_svg]:size-4"
								onClick={(event) => {
									// Don't let the press bubble to the row's onClick (which would
									// open the directory) or close the menu via item activation.
									event.preventDefault();
									event.stopPropagation();
									onRemove();
								}}
							>
								<DeleteIcon label="" size="small" />
							</button>
						) : undefined
					}
				/>
			) : null}
		</DropdownMenuItem>
	);
}
