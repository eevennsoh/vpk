"use client";

// oxlint-disable react-doctor/only-export-components -- This module intentionally exports colocated component API, variant contracts, context contracts, or metadata used by consumers.

// oxlint-disable react-doctor/prefer-tag-over-role -- This file uses ARIA roles for custom generated visuals or composite widgets where the suggested native tag would change semantics or behavior.

import {
	Fragment,
	useEffect,
	useLayoutEffect,
	useState,
	type FocusEvent,
} from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";

import { Button } from "@/components/ui/button";
import { DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";
import { IconTile, type IconTileVariant } from "@/components/ui/icon-tile";
import { Kbd } from "@/components/ui/kbd";
import { ReturnIcon } from "@/components/ui/vpk-icons";
import { MenuBackButton } from "@/components/ui-custom/menu-back-button";
import { motionEase } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { RichTextMentionVisualMark } from "./mention-visual";
import { useCommandMenuScrollMask } from "./command-menu-scroll-mask";
import { isOverflowFooterLabel } from "./suggestion-menu-overflow";
import type {
	RichTextSuggestionMenuItem,
	RichTextSuggestionMenuProps,
} from "./suggestion-menu-types";
import "./suggestion-menu-actions.css";
import type { RichTextSuggestionRowVariant } from "./types";

function getSuggestionMenuIconTileVariant(
	item: RichTextSuggestionMenuItem,
): IconTileVariant {
	if (item.iconTileVariant) {
		return item.iconTileVariant;
	}

	return isOverflowFooterLabel(item.label) ? "transparent" : "gray";
}

const nestedCommandLabelVariants: Variants = {
	idle: (instant: boolean) => ({
		transform: "translateY(8px)",
		transition: instant ? { duration: 0 } : { type: "spring", bounce: 0, visualDuration: 0.18 },
	}),
	active: (instant: boolean) => ({
		transform: "translateY(0px)",
		transition: instant ? { duration: 0 } : { type: "spring", bounce: 0.12, visualDuration: 0.24 },
	}),
};

const nestedCommandDescriptionVariants: Variants = {
	idle: (instant: boolean) => ({
		opacity: 0,
		transform: "translateY(4px)",
		transition: instant ? { duration: 0 } : { duration: 0.1, ease: [0.4, 0, 1, 1] },
	}),
	active: (instant: boolean) => ({
		opacity: 1,
		transform: "translateY(0px)",
		transition: instant ? { duration: 0 } : { delay: 0.02, duration: 0.16, ease: motionEase.out },
	}),
};

/**
 * Contextual empty state for a suggestion surface with no matching rows. Mirrors
 * the showcase search picker: a title, the "try another term" hint, and an
 * optional "Browse all" button that launches the surface's directory. When
 * `onBrowseAll` is omitted (a surface with no backing directory, e.g. Format),
 * the button is hidden and only the title + hint show.
 */
export function RichTextSuggestionEmptyState({
	label = "No matching items",
	onBrowseAll,
}: Readonly<{
	label?: string;
	onBrowseAll?: () => void;
}>) {
	return (
		<Empty width="narrow" className="px-6 pt-4 pb-6">
			<EmptyHeader>
				<EmptyTitle headingSize="xsmall">{label}</EmptyTitle>
				<EmptyDescription>Try a different search term.</EmptyDescription>
			</EmptyHeader>
			{onBrowseAll ? (
				<EmptyContent>
					<Button
						type="button"
						variant="outline"
						// Keep focus in the editor: a mousedown blur would tear down the
						// suggestion popup before the click handler can open the directory.
						onMouseDown={(event) => event.preventDefault()}
						onClick={onBrowseAll}
					>
						Browse all
					</Button>
				</EmptyContent>
			) : null}
		</Empty>
	);
}

export function RichTextSuggestionMenu({
	className,
	rowVariant = "compact",
	emptyLabel,
	emptyState,
	header,
	items,
	onBack,
	onHover,
	onHoverEnd,
	onSelect,
	selectedIndex,
	selectedItemIds,
	showReturnShortcut = true,
	title,
}: Readonly<RichTextSuggestionMenuProps>) {
	const {
		listProps,
		listRef,
		menuProps,
		remeasure: updateListScrollState,
	} = useCommandMenuScrollMask();
	const isNested = Boolean(onBack);
	const hasHoverActions = items.some((item) => item.hoverActions !== undefined);

	// oxlint-disable react-doctor/no-adjust-state-on-prop-change -- nested menu changes reset and remeasure the scroll container.
	useEffect(() => {
		const listElement = listRef.current;
		if (listElement) {
			listElement.scrollTop = 0;
		}
		updateListScrollState();
	}, [isNested, listRef, title, updateListScrollState]);
	// oxlint-enable react-doctor/no-adjust-state-on-prop-change

	useLayoutEffect(() => {
		const listElement = listRef.current;
		const selectedElement = listElement?.querySelector<HTMLElement>(
			hasHoverActions
				? "[data-suggestion-option][data-selected='true']"
				: "[role='option'][aria-selected='true']",
		);
		if (!listElement || !selectedElement) {
			return;
		}

		selectedElement.scrollIntoView({ block: "nearest" });
		updateListScrollState();
	}, [hasHoverActions, items, listRef, selectedIndex, title, updateListScrollState]);

	return (
		<div
			className={cn("rich-text-command-menu menu-row-spacing", className)}
			data-nested={isNested ? "true" : undefined}
			data-row-variant={rowVariant}
			data-has-header={header ? "true" : undefined}
			data-hide-return-shortcut={showReturnShortcut ? undefined : "true"}
			data-pointer-selects={onHover ? "true" : undefined}
			{...menuProps}
		>
			{onBack ? (
				<MenuBackButton
					onMouseDown={(event) => event.preventDefault()}
					onClick={onBack}
				/>
			) : null}
			{header}
			<div
				className="rich-text-command-menu-list"
				role={hasHoverActions ? "list" : "listbox"}
				aria-label={title}
				aria-multiselectable={selectedItemIds ? true : undefined}
				{...listProps}
			>
				{items.length > 0 ? (
					items.map((item, index) => {
						return (
							<Fragment key={item.id}>
								{item.separatorBefore ? (
									<DropdownMenuSeparator aria-hidden="true" />
								) : null}
								{item.headingLabel !== undefined ? (
									<div
										className="rich-text-command-menu-heading"
										role="presentation"
									>
										{item.headingLabel}
									</div>
								) : (
									<RichTextSuggestionMenuOption
										isChosen={selectedItemIds?.has(item.id)}
										isSelected={index === selectedIndex}
										item={item}
										rowVariant={rowVariant}
										listMode={hasHoverActions}
										onHover={onHover ? () => onHover(index) : undefined}
										onHoverEnd={onHoverEnd}
										onSelect={onSelect}
										showReturnShortcut={showReturnShortcut}
									/>
								)}
							</Fragment>
						);
					})
				) : (
					emptyState ?? <div className="rich-text-command-menu-empty">{emptyLabel}</div>
				)}
			</div>
		</div>
	);
}

interface RichTextSuggestionMenuOptionProps {
	rowVariant: RichTextSuggestionRowVariant;
	isChosen?: boolean;
	isSelected: boolean;
	item: RichTextSuggestionMenuItem;
	listMode?: boolean;
	onHover?: () => void;
	onHoverEnd?: () => void;
	onSelect: (item: RichTextSuggestionMenuItem) => void;
	showReturnShortcut?: boolean;
}

function isFocusLeavingElement(
	event: FocusEvent<HTMLElement>,
): boolean {
	const next = event.relatedTarget;
	return !(next instanceof Node && event.currentTarget.contains(next));
}

function RichTextSuggestionMenuOption({
	rowVariant,
	isChosen,
	isSelected,
	item,
	listMode = false,
	onHover,
	onHoverEnd,
	onSelect,
	showReturnShortcut = true,
}: Readonly<RichTextSuggestionMenuOptionProps>) {
	const [isRowPointerActive, setIsRowPointerActive] = useState(false);
	const [isRowFocusWithin, setIsRowFocusWithin] = useState(false);
	const prefersReducedMotion = useReducedMotion();
	// Descriptions and live `inlineMetadata` (tool-call narration) reveal on
	// hover/selection so the collapsed row stays compact (label only) until the
	// user lands on it. Rows that opt into `persistentDescription` (nested parent
	// rows with a count byline) instead keep their description visible at all
	// times.
	const hasDescription = rowVariant === "with-byline" && Boolean(item.description);
	const showsPersistentDescription = hasDescription && Boolean(item.persistentDescription);
	const revealedMetadata = rowVariant === "with-byline" ? item.inlineMetadata ?? (showsPersistentDescription ? undefined : item.description) : undefined;
	const canRevealMetadata = revealedMetadata !== undefined && revealedMetadata !== "";
	const hasHoverActions = item.hoverActions !== undefined;
	const hasTrailing = item.trailing != null;
	// Hover-action rows reveal from the row wrapper (pointer on the row or
	// keyboard focus on the option/CTAs). A stale `isSelected` from the last
	// hover must not keep the byline or hide the rest-state spinner.
	const isHoverActionsRevealed = hasHoverActions && (isRowPointerActive || isRowFocusWithin);
	const isBylineRevealed = hasHoverActions ? isHoverActionsRevealed : isSelected;
	const shouldPromoteByline = isBylineRevealed || isRowPointerActive || isRowFocusWithin;
	const shouldShowReturnShortcut = showReturnShortcut && !item.disabled && !hasHoverActions && (isSelected || isRowPointerActive || isRowFocusWithin);
	const shouldYieldTrailingToHoverActions = isHoverActionsRevealed;
	// A persistent trailing indicator (e.g. a status glyph) shows at rest, so the
	// copy must reserve room for it always — not only on hover/selection like the
	// return hint — so the label truncates before it instead of sliding under it.
	const hasPersistentTrailing = hasTrailing && !shouldShowReturnShortcut && !shouldYieldTrailingToHoverActions;
	const handlePointerEnter = () => {
		setIsRowPointerActive(true);
		if (!item.disabled) {
			onHover?.();
		}
	};
	const handlePointerLeave = () => {
		setIsRowPointerActive(false);
		onHoverEnd?.();
	};
	const handleFocusWithin = () => {
		setIsRowFocusWithin(true);
	};
	const handleBlurWithin = (event: FocusEvent<HTMLElement>) => {
		if (isFocusLeavingElement(event)) {
			setIsRowFocusWithin(false);
		}
	};
	const optionInteractionProps = hasHoverActions
		? {}
		: {
			onBlur: handleBlurWithin,
			onFocus: handleFocusWithin,
			onMouseEnter: handlePointerEnter,
			onMouseLeave: handlePointerLeave,
		};
	const className = cn(
		"rich-text-command-menu-item",
		isSelected && "rich-text-command-menu-item-selected",
		getSuggestionMenuItemStickyClassName(item),
	);
	const children = (
		<>
			<RichTextSuggestionMenuItemVisual item={item} />
			{canRevealMetadata ? (
				<span className="rich-text-command-menu-copy rich-text-command-menu-nested-copy rich-text-command-menu-nested-copy-revealable min-w-0">
					<motion.span
						className="menu-row-title min-w-0"
						custom={Boolean(prefersReducedMotion)}
						style={{ willChange: shouldPromoteByline ? "transform" : "auto" }}
						variants={nestedCommandLabelVariants}
					>
						{item.label}
					</motion.span>
					<motion.span
						className="menu-row-byline min-w-0"
						custom={Boolean(prefersReducedMotion)}
						style={{ willChange: shouldPromoteByline ? "transform, opacity" : "auto" }}
						variants={nestedCommandDescriptionVariants}
					>
						{revealedMetadata}
					</motion.span>
				</span>
			) : (
				<span className="rich-text-command-menu-copy min-w-0">
					<span className="menu-row-title">{item.label}</span>
					{showsPersistentDescription ? (
						<span className="menu-row-byline">
							{item.description}
						</span>
					) : null}
				</span>
			)}
			{shouldShowReturnShortcut ? (
				<span className="rich-text-command-menu-shortcut rich-text-command-menu-return-shortcut" aria-hidden="true">
					<span className="inline-flex size-4 shrink-0 items-center justify-center">
						<ReturnIcon className="size-3.5 text-icon-subtlest" />
					</span>
				</span>
			) : hasTrailing ? (
				<span
					aria-hidden={shouldYieldTrailingToHoverActions ? true : undefined}
					className={cn(
						"rich-text-command-menu-shortcut",
						shouldYieldTrailingToHoverActions ? "pointer-events-none opacity-0" : undefined,
					)}
				>
					{item.trailing}
				</span>
			) : item.shortcut ? (
				<span className="rich-text-command-menu-shortcut">
					<Kbd>{item.shortcut}</Kbd>
				</span>
			) : null}
		</>
	);

	const option = canRevealMetadata ? (
			<motion.button
				type="button"
				role={listMode ? undefined : "option"}
				aria-selected={listMode ? undefined : isChosen ?? isSelected}
				animate={isBylineRevealed ? "active" : "idle"}
				custom={Boolean(prefersReducedMotion)}
				className={className}
				data-has-actions={hasHoverActions ? "true" : undefined}
				data-selected={isChosen ?? isSelected ? "true" : undefined}
				data-suggestion-option=""
				data-has-trailing={hasPersistentTrailing ? "true" : undefined}
				disabled={item.disabled}
				initial={false}
				onMouseDown={(event) => event.preventDefault()}
				onClick={() => onSelect(item)}
				whileFocus={hasHoverActions ? undefined : "active"}
				whileHover={hasHoverActions ? undefined : "active"}
				{...optionInteractionProps}
			>
				{children}
			</motion.button>
	) : (
		<button
			type="button"
			role={listMode ? undefined : "option"}
			aria-selected={listMode ? undefined : isChosen ?? isSelected}
			className={className}
			data-has-actions={hasHoverActions ? "true" : undefined}
			data-selected={isChosen ?? isSelected ? "true" : undefined}
			data-suggestion-option=""
			data-has-trailing={hasPersistentTrailing ? "true" : undefined}
			disabled={item.disabled}
			onMouseDown={(event) => event.preventDefault()}
			onClick={() => onSelect(item)}
			{...optionInteractionProps}
		>
			{children}
		</button>
	);

	if (!item.hoverActions) {
		return option;
	}

	return (
		<div
			className="group/suggestion-option grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center rounded-lg"
			data-menu-row=""
			data-suggestion-actions=""
			onBlur={handleBlurWithin}
			onFocus={handleFocusWithin}
			onMouseEnter={handlePointerEnter}
			onMouseLeave={handlePointerLeave}
			role="listitem"
		>
			{option}
			<div
				className="pointer-events-none flex w-0 items-center gap-1 overflow-hidden opacity-0"
				data-suggestion-action-buttons=""
			>
				<Button
					onClick={(event) => {
						event.stopPropagation();
						item.hoverActions?.onPrimary();
					}}
					size="compact"
					type="button"
					variant="outline"
				>
					{item.hoverActions.primaryLabel}
				</Button>
				<Button
					aria-label={item.hoverActions.secondaryLabel}
					onClick={(event) => {
						event.stopPropagation();
						item.hoverActions?.onSecondary();
					}}
					size="icon-compact"
					type="button"
					variant="outline"
				>
					{item.hoverActions.secondaryIcon}
				</Button>
			</div>
		</div>
	);
}

function getSuggestionMenuItemStickyClassName(
	item: RichTextSuggestionMenuItem,
): string | undefined {
	return cn(
		item.isSticky && "rich-text-command-menu-item-sticky",
		item.isSticky && item.stickyPosition === "bottom" && "rich-text-command-menu-item-sticky-bottom",
	);
}

function RichTextSuggestionMenuItemVisual({
	item,
}: Readonly<{ item: RichTextSuggestionMenuItem }>) {
	// Single front-slot size everywhere: every shared menu tile is drawn natively
	// at 24px (`small`) inside the 24px front-slot box defined in CSS via
	// `.rich-text-command-menu-avatar`. Rendering natively (rather than scaling a
	// 32px mark down to 75%) keeps the glyph on ADS's `small` Tile inset (14px),
	// matching /components/ui/logo — a scaled 32px tile would freeze the `medium`
	// inset and shrink the glyph to 12px.
	const tileVariant = getSuggestionMenuIconTileVariant(item);
	const visual = item.leadingVisual ? (
		item.leadingVisual
	) : item.visual ? (
		<RichTextMentionVisualMark
			label={item.label}
			size="menu-compact"
			visual={item.visual}
		/>
	) : (
		<IconTile
			size="small"
			iconSize={tileVariant === "transparent" ? "small" : undefined}
			label={item.label}
			aria-hidden={true}
			icon={item.icon}
			variant={tileVariant}
		/>
	);

	return (
		<span className="rich-text-command-menu-avatar inline-flex shrink-0 items-center justify-center">
			{visual}
		</span>
	);
}
