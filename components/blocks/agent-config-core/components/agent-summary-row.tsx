"use client";

import type { ComponentProps, ReactNode } from "react";
import { Fragment } from "react";

import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import EditIcon from "@atlaskit/icon/core/edit";
import PageIcon from "@atlaskit/icon/core/page";

import { getDirectoryMentionItemOrFallback } from "@/components/blocks/editor-palette/data/mention-sources";
import { Icon } from "@/components/ui/icon";
import { IconTile } from "@/components/ui/icon-tile";
import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card";
import { Tag, type TagColor } from "@/components/ui/tag";
import {
	type RichTextReferenceCategory,
	getRichTextMentionTagType,
} from "@/components/ui-custom/rich-text-editor";
import {
	type RichTextMentionItem,
	RichTextMentionVisualMark,
} from "@/components/ui-custom/rich-text-editor/menus";
import {
	getRichTextReferencePreview,
	RichTextReferencePreviewContent,
} from "@/components/ui-custom/rich-text-editor/reference-preview";
import { cn } from "@/lib/utils";

export function AgentSectionLabel({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<div className="flex min-h-5 items-center text-xs font-semibold leading-4 text-text-subtlest">
			{children}
		</div>
	);
}

const iconColorToTagColor: Readonly<Record<string, TagColor>> = {
	"text-icon-brand": "blue",
	"text-icon-information": "blue",
	"text-icon-success": "green",
	"text-icon-discovery": "discovery",
	"text-icon-warning": "yellow",
	"text-icon-danger": "red",
	"text-icon-accent-red": "red",
	"text-icon-accent-orange": "orange",
	"text-icon-accent-yellow": "yellow",
	"text-icon-accent-lime": "lime",
	"text-icon-accent-green": "green",
	"text-icon-accent-teal": "teal",
	"text-icon-accent-blue": "blue",
	"text-icon-accent-purple": "purple",
	"text-icon-accent-magenta": "magenta",
	"text-icon-accent-gray": "gray",
	"text-yellow-400": "yellow",
};

function getTagColorForMentionVisual(visual: RichTextMentionItem["visual"]): TagColor | undefined {
	return visual?.kind === "icon" && visual.iconColor
		? iconColorToTagColor[visual.iconColor]
		: undefined;
}

export type AgentReferenceChipProps = Omit<ComponentProps<typeof Tag>, "color" | "children"> & {
	category?: RichTextReferenceCategory;
	disabled?: boolean;
	elemBefore?: ReactNode;
	label: string;
	onRemove?: () => void;
	tagColor?: TagColor;
};

export function AgentReferenceChip({
	category,
	disabled = false,
	elemBefore,
	label,
	onClick,
	onRemove,
	tagColor,
	// Extra props (and ref) are injected when this chip is used as a menu/menubar
	// `render` target. Forward behavioral props, but keep injected trigger styling
	// off the Tag so the chip does not turn into a button visually.
	...rest
}: Readonly<AgentReferenceChipProps>) {
	const item = category && category !== "subagent" ? getDirectoryMentionItemOrFallback(category, label) : undefined;
	const visual = item?.visual;
	const resolvedTagColor = tagColor ?? getTagColorForMentionVisual(visual) ?? "blue";
	const preview = getRichTextReferencePreview(category, label);
	const FallbackIcon = category === "subagent" ? AiAgentIcon : PageIcon;
	const resolvedElemBefore = elemBefore ?? (
		visual ? (
			<RichTextMentionVisualMark
				category={category}
				label={label}
				visual={visual}
			/>
		) : (
			<IconTile
				aria-hidden
				className="text-inherit"
				icon={<Icon aria-hidden render={<FallbackIcon label="" size="small" />} />}
				label=""
				size="xxsmall"
				variant="transparent"
			/>
		)
	);
	const { className: injectedClassName, style: injectedStyle, ...behaviorProps } = rest;
	void injectedClassName;
	void injectedStyle;
	const tag = (
		<Tag
			{...behaviorProps}
			aria-disabled={disabled || undefined}
			className={cn(disabled && "opacity-(--opacity-disabled)")}
			color={resolvedTagColor}
			elemBefore={resolvedElemBefore}
			onClick={disabled ? undefined : onClick}
			onRemove={onRemove}
			removeButtonLabel="Remove"
			removeVariant="overlay"
			type={elemBefore ? "default" : getRichTextMentionTagType(visual)}
			variant="editor"
		>
			{label}
		</Tag>
	);

	return preview ? (
		<HoverCard>
			<HoverCardTrigger closeDelay={80} delay={120} render={<span className="inline-flex max-w-full" />}>
				{tag}
			</HoverCardTrigger>
			<RichTextReferencePreviewContent preview={preview} />
		</HoverCard>
	) : tag;
}

export type AgentAddValueButtonProps = { icon?: "add" | "edit"; label: string } & ComponentProps<"button">;

export function AgentAddValueButton({
	className,
	icon,
	label,
	onClick,
	...props
}: Readonly<AgentAddValueButtonProps>) {
	void icon;
	return (
		<button
			type="button"
			className={cn(
				className,
				"inline-flex min-h-5 max-w-full shrink-0 items-center gap-1 rounded-xs p-0 text-left text-xs font-medium leading-4 text-text-subtlest transition-opacity hover:bg-transparent active:bg-transparent focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-transparent aria-expanded:opacity-100",
			)}
			onClick={onClick}
			{...props}
		>
			<EditIcon label="" size="small" />
			<span className="min-w-0 whitespace-normal group-hover/agent-row:underline">{label}</span>
		</button>
	);
}

export interface AgentFilledSummaryRowProps {
	label: string;
	items: readonly string[];
	referenceCategory?: RichTextReferenceCategory;
	agentFieldName?: string;
	screenAssistantTargetId?: string;
	addIcon?: "add" | "edit";
	addLabel?: string;
	hideWhenEmpty?: boolean;
	itemElemBefore?: (item: string, index: number) => ReactNode;
	isItemDisabled?: (item: string, index: number) => boolean;
	renderItem?: (opts: {
		item: string;
		index: number;
		disabled: boolean;
		onClick?: () => void;
		onRemove?: () => void;
	}) => ReactNode;
	inlinePicker?: ReactNode;
	onAdd?: () => void;
	renderAddControl?: (opts: { icon?: "add" | "edit"; label: string; className?: string }) => ReactNode;
	onItemClick?: (item: string, index: number) => void;
	onRemoveItem?: (index: number) => void;
	tagColor?: TagColor;
}

export function AgentFilledSummaryRow({
	addIcon,
	addLabel,
	agentFieldName,
	hideWhenEmpty = false,
	inlinePicker,
	itemElemBefore,
	isItemDisabled,
	items,
	label,
	onAdd,
	renderAddControl,
	onItemClick,
	onRemoveItem,
	referenceCategory,
	renderItem,
	screenAssistantTargetId,
	tagColor,
}: Readonly<AgentFilledSummaryRowProps>) {
	const isEmpty = items.length === 0;
	const renderAddButton = (className?: string): ReactNode =>
		addLabel === undefined
			? null
			: renderAddControl
				? renderAddControl({ icon: addIcon, label: addLabel, className })
				: (
					<AgentAddValueButton
						className={className}
						icon={addIcon}
						label={addLabel}
						onClick={onAdd}
					/>
				);

	if (isEmpty && (hideWhenEmpty || !addLabel)) {
		return null;
	}

	return (
		<div
			className="group/agent-row -mx-2 rounded-md px-2 py-1 transition-colors hover:bg-bg-neutral-subtle-hovered"
			data-agent-field={agentFieldName}
			data-screen-assistant-target={screenAssistantTargetId}
		>
			<div className="flex flex-col gap-y-1 sm:flex-row sm:items-center sm:gap-x-6">
				<div className="sm:w-20 sm:shrink-0">
					<AgentSectionLabel>{label}</AgentSectionLabel>
				</div>
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					<div className="flex min-h-5 min-w-0 flex-1 flex-wrap items-center gap-1.5">
						{items.map((item, index) => {
							const isLastItem = index === items.length - 1;
							const itemKey = `${label}-${item}-${index}`;
							const itemDisabled = isItemDisabled?.(item, index) ?? false;
							const handleItemClick = onItemClick ? () => onItemClick(item, index) : undefined;
							const handleItemRemove = onRemoveItem ? () => onRemoveItem(index) : undefined;
							const chip = renderItem ? (
								<Fragment key={itemKey}>
									{renderItem({
										item,
										index,
										disabled: itemDisabled,
										onClick: handleItemClick,
										onRemove: handleItemRemove,
									})}
								</Fragment>
							) : (
								<AgentReferenceChip
									category={referenceCategory}
									disabled={itemDisabled}
									elemBefore={itemElemBefore?.(item, index)}
									key={itemKey}
									label={item}
									onClick={handleItemClick}
									onRemove={handleItemRemove}
									tagColor={tagColor}
								/>
							);

							if (isLastItem && addLabel) {
								return (
									<div
										key={`${label}-add-tail`}
										className="inline-flex max-w-full items-center gap-1.5"
									>
										{chip}
										<Fragment key="row-tail-add">
											{renderAddButton(
												"shrink-0 opacity-0 transition-opacity group-hover/agent-row:opacity-100 group-has-[:focus-visible]/agent-row:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100",
											)}
										</Fragment>
									</div>
								);
							}

							return chip;
						})}
						{isEmpty && addLabel ? renderAddButton() : null}
					</div>
					{inlinePicker ? (
						<div className="w-full max-w-80">
							{inlinePicker}
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}
