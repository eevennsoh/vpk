"use client";

import type { ComponentType, CSSProperties, ReactElement, ReactNode } from "react";

import type { NewCoreIconProps } from "@atlaskit/icon/base-new";
import AddIcon from "@atlaskit/icon/core/add";
import ArchiveBoxIcon from "@atlaskit/icon/core/archive-box";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CrossIcon from "@atlaskit/icon/core/cross";
import GrowHorizontalIcon from "@atlaskit/icon/core/grow-horizontal";
import PinIcon from "@atlaskit/icon/core/pin";
import PinFilledIcon from "@atlaskit/icon/core/pin-filled";
import ShrinkHorizontalIcon from "@atlaskit/icon/core/shrink-horizontal";
import StatusSuccessIcon from "@atlaskit/icon/core/status-success";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
	PanelAction,
	PanelActionGroup,
	PanelHeader,
	PanelTitle,
} from "@/components/ui/panel";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import {
	DEFAULT_AGENT_SESSION_COLUMN_FRAME,
	type AgentSessionColumnFrame,
} from "./agent-session-column-frame";
import { AgentSessionColumnCountMorph } from "./agent-session-column-count-swap";
import {
	SELECT_ALL_ACTION_COPY,
	type HeaderActionId,
	type SelectionActionId,
	type SelectionActionModel,
	type UntrackedHeaderModel,
} from "./untracked-selection";

const AGENT_SESSION_COLUMN_HEADER_STYLE: Record<AgentSessionColumnFrame, CSSProperties> = {
	caption: { paddingBottom: token("space.100") },
	enclosed: {
		paddingTop: token("space.100"),
		paddingInline: token("space.150"),
		paddingBottom: token("space.050"),
	},
};

const HEADER_ACTIONS_VISIBLE = "flex shrink-0 items-center";

const HEADER_ACTIONS_REVEAL = cn(
	HEADER_ACTIONS_VISIBLE,
	"opacity-0 transition-opacity duration-normal ease-out-practical",
	"group-hover/session-column:opacity-100 group-has-[:focus-visible]/session-column:opacity-100",
	"motion-reduce:transition-none",
	"has-[[data-popup-open]]:opacity-100",
	"group-has-[[data-popup-open]]/header-actions:opacity-100",
);

/** Keep the default collapsed button's visual 24px wide while its real target reaches the host gutter. */
export function AgentSessionColumnCollapsedExpandControl({
	canReposition,
	className,
	isRepositioning,
	leadingHitSlopPx,
	onExpand,
	title,
}: Readonly<{
	canReposition: boolean;
	className: string;
	isRepositioning: boolean;
	leadingHitSlopPx: number;
	onExpand: () => void;
	title: string;
}>): ReactElement {
	return (
		<TooltipProvider>
			<Tooltip animate={!isRepositioning} disabled={isRepositioning}>
				<TooltipTrigger
					render={
						<Button
							aria-label={`Expand ${title} column`}
							aria-description={canReposition ? "Drag horizontally to move the column, or use Alt with the arrow keys." : undefined}
							className={cn(
								className,
								isRepositioning
									? null
									: "bg-transparent hover:bg-transparent active:bg-transparent aria-pressed:bg-transparent aria-expanded:bg-transparent focus-visible:border-transparent focus-visible:ring-0",
							)}
							data-agent-session-column-expand-control=""
							onClick={onExpand}
							size="icon-compact"
							style={!isRepositioning && leadingHitSlopPx > 0
								? {
									marginInlineStart: -leadingHitSlopPx,
									paddingInlineStart: leadingHitSlopPx,
									width: `calc(100% + ${leadingHitSlopPx}px)`,
								}
								: { width: "100%" }}
							type="button"
							variant={isRepositioning ? "outline" : "ghost"}
						/>
					}
				>
					{isRepositioning ? (
						<Icon className="text-icon-subtle" render={<GrowHorizontalIcon label="" />} />
					) : (
						<span
							className="pointer-events-none flex size-6 shrink-0 items-center justify-center rounded-md border border-transparent transition-colors duration-normal ease-out-practical group-hover/button:bg-bg-neutral-subtle-hovered group-active/button:bg-bg-neutral-subtle-pressed group-focus-visible/button:border-ring group-focus-visible/button:ring-3 group-focus-visible/button:ring-ring/50 motion-reduce:transition-none"
							data-agent-session-column-expand-visual=""
						>
							<Icon className="text-icon-subtle" render={<GrowHorizontalIcon label="" />} />
						</span>
					)}
				</TooltipTrigger>
				<TooltipContent alignOffset={leadingHitSlopPx / 2}>Expand</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

const HEADER_ACTION_ICON: Record<SelectionActionId, ComponentType<NewCoreIconProps>> = {
	approve: CheckMarkIcon,
	archive: ArchiveBoxIcon,
	clear: CrossIcon,
	create: AddIcon,
};

interface HeaderActionAffordance {
	readonly disabled: boolean;
	readonly onActivate: (() => void) | undefined;
	readonly text: string;
}

function toHeaderActionAffordance(
	action: SelectionActionModel,
	onAction: (id: HeaderActionId) => void,
): HeaderActionAffordance {
	switch (action.hint.kind) {
		case "unavailable":
			return {
				disabled: true,
				onActivate: undefined,
				text: action.hint.text,
			};
		case "available":
			return {
				disabled: false,
				onActivate: () => {
					onAction(action.id);
				},
				text: action.hint.text,
			};
		default: {
			const exhaustive: never = action.hint;
			return exhaustive;
		}
	}
}

function HeaderIconButton({
	action,
	onAction,
}: Readonly<{
	action: SelectionActionModel;
	onAction: (id: HeaderActionId) => void;
}>): ReactElement {
	const IconComponent = HEADER_ACTION_ICON[action.id];
	const affordance = toHeaderActionAffordance(action, onAction);

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger render={<span className="inline-flex" />}>
					<Button
						aria-label={affordance.text}
						disabled={affordance.disabled}
						onClick={affordance.onActivate}
						size="icon-compact"
						type="button"
						variant="ghost"
					>
						<Icon className="text-icon-subtle" render={<IconComponent label="" />} />
					</Button>
				</TooltipTrigger>
				<TooltipContent>{affordance.text}</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

function SelectAllButton({
	allSelected,
	onAction,
}: Readonly<{
	allSelected: boolean;
	onAction: (id: HeaderActionId) => void;
}>): ReactElement {
	const label = allSelected ? SELECT_ALL_ACTION_COPY.deselect : SELECT_ALL_ACTION_COPY.select;

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger render={<span className="inline-flex" />}>
					<Button
						aria-label={label}
						onClick={() => {
							onAction("select-all");
						}}
						size="icon-compact"
						type="button"
						variant="ghost"
					>
						<Icon
							className="text-icon-selected"
							render={<StatusSuccessIcon label="" />}
						/>
					</Button>
				</TooltipTrigger>
				<TooltipContent>{label}</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

/**
 * Select-all is `icon-compact` (`size-6`, 24px). Card identity / select-mark
 * is `size-8` (32px) after list `p-1` (4px) + card `p-3` (12px), then `mr-3`
 * (12px) before the title. Align button center to that 32px box, and the
 * Selected label to the title — not equal left padding.
 *
 * Enclosed header already has `paddingInline: space.150` (12px), so the slot
 * adds `ms-2` (8px): 4px list inset plus 4px to center 24px in 32px. `me-4`
 * (16px) is the remaining 4px of that box plus the row's `mr-3`.
 * Caption sits outside the well, so it also absorbs the 1px stroke + 16px
 * card origin (`ms-5` ≈ 20px; the leftover 1px is the well border).
 */
function selectAllSlotExpandedClass(frame: AgentSessionColumnFrame): string {
	switch (frame) {
		case "enclosed":
			return "ms-2 me-4 w-6 has-[:focus-visible]:overflow-visible";
		case "caption":
			return "ms-5 me-4 w-6 has-[:focus-visible]:overflow-visible";
		default: {
			const exhaustive: never = frame;
			return exhaustive;
		}
	}
}

function SelectAllSlot({
	allSelected,
	expanded,
	frame,
	onAction,
}: Readonly<{
	allSelected: boolean;
	expanded: boolean;
	frame: AgentSessionColumnFrame;
	onAction: (id: HeaderActionId) => void;
}>): ReactElement {
	return (
		<div
			aria-hidden={expanded ? undefined : true}
			className={cn(
				"flex shrink-0 items-center overflow-hidden",
				"transition-[width,margin] duration-normal ease-in-out motion-reduce:transition-none",
				expanded
					? selectAllSlotExpandedClass(frame)
					: "pointer-events-none ms-0 me-0 w-0",
			)}
			inert={!expanded}
		>
			<SelectAllButton allSelected={allSelected} onAction={onAction} />
		</div>
	);
}

function PinButton({
	label,
	onPinToggle,
	pinned,
}: Readonly<{
	label: string;
	onPinToggle: () => void;
	pinned: boolean;
}>): ReactElement {
	const PinGlyph = pinned ? PinFilledIcon : PinIcon;

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger
					render={
						<Button
							aria-label={label}
							data-agent-session-column-pin=""
							onClick={onPinToggle}
							size="icon-compact"
							type="button"
							variant="ghost"
						/>
					}
				>
					<Icon
						className="text-icon-subtle [&_svg]:size-3"
						render={<PinGlyph label="" size="small" />}
					/>
				</TooltipTrigger>
				<TooltipContent>{pinned ? "Unpin" : "Pin"}</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

function CollapseButton({
	label,
	onCollapse,
}: Readonly<{
	label: string;
	onCollapse: () => void;
}>): ReactElement {
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger
					render={
						<Button
							aria-label={label}
							onClick={onCollapse}
							size="icon-compact"
							type="button"
							variant="ghost"
						/>
					}
				>
					<Icon className="text-icon-subtle" render={<ShrinkHorizontalIcon label="" />} />
				</TooltipTrigger>
				<TooltipContent>Collapse</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

export function AgentSessionColumnHeader({
	collapseLabel,
	dragHandle,
	filter,
	frame = DEFAULT_AGENT_SESSION_COLUMN_FRAME,
	hasActiveFilters = false,
	model,
	onAction,
	onCollapse,
	onPinToggle,
	overflow,
	pinLabel,
	pinned = false,
	surface,
}: Readonly<{
	collapseLabel: string;
	dragHandle?: ReactNode;
	filter?: ReactElement;
	frame?: AgentSessionColumnFrame;
	hasActiveFilters?: boolean;
	model: UntrackedHeaderModel;
	onAction: (id: HeaderActionId) => void;
	onCollapse: () => void;
	onPinToggle?: () => void;
	overflow?: ReactElement;
	pinLabel?: string;
	pinned?: boolean;
	surface: "column" | "panel";
}>): ReactElement {
	switch (surface) {
		case "column":
			return (
				<div
					data-agent-session-column-header=""
					data-session-column-move-surface={dragHandle === undefined ? undefined : ""}
					className={cn(
						"flex min-w-0 flex-nowrap items-center",
						dragHandle === undefined ? null : "cursor-grab touch-none active:cursor-grabbing",
					)}
					style={AGENT_SESSION_COLUMN_HEADER_STYLE[frame]}
				>
					{dragHandle}
					{renderColumnChrome({
						collapseLabel,
						filter,
						frame,
						hasActiveFilters,
						model,
						onAction,
						onCollapse,
						onPinToggle,
						overflow,
						pinLabel,
						pinned,
					})}
				</div>
			);
		case "panel":
			return renderPanelChrome({
				collapseLabel,
				filter,
				model,
				onAction,
				onCollapse,
				overflow,
			});
		default: {
			const exhaustive: never = surface;
			return exhaustive;
		}
	}
}

function renderColumnChrome({
	collapseLabel,
	filter,
	frame,
	hasActiveFilters,
	model,
	onAction,
	onCollapse,
	onPinToggle,
	overflow,
	pinLabel,
	pinned,
}: Readonly<{
	collapseLabel: string;
	filter?: ReactElement;
	frame: AgentSessionColumnFrame;
	hasActiveFilters: boolean;
	model: UntrackedHeaderModel;
	onAction: (id: HeaderActionId) => void;
	onCollapse: () => void;
	onPinToggle?: () => void;
	overflow?: ReactElement;
	pinLabel?: string;
	pinned: boolean;
}>): ReactElement {
	const isSelecting = model.kind === "selecting";
	const revealHeaderActions = (hasActiveFilters || pinned) && !isSelecting;
	const headerActionsClass = revealHeaderActions
		? HEADER_ACTIONS_VISIBLE
		: HEADER_ACTIONS_REVEAL;
	const pinControl = onPinToggle === undefined || pinLabel === undefined
		? null
		: (
			<PinButton
				label={pinLabel}
				onPinToggle={onPinToggle}
				pinned={pinned}
			/>
		);

	return (
		<>
			<SelectAllSlot
				allSelected={isSelecting ? model.allSelected : false}
				expanded={isSelecting}
				frame={frame}
				onAction={onAction}
			/>
			<span className="min-w-0 truncate text-xs font-medium leading-4 text-text-subtle">
				{model.kind === "selecting"
					? "Selected"
					: model.title === "Unlink sessions" ? "Unlinked agent sessions" : model.title}
			</span>
			<span
				aria-live={isSelecting ? "polite" : undefined}
				className="ms-1.5 shrink-0 text-xs font-normal text-text-subtlest"
			>
				{isSelecting ? model.count : (
					<>
						<span aria-hidden="true">
							<AgentSessionColumnCountMorph count={model.count} />
						</span>
						<span className="sr-only">{model.count}</span>
					</>
				)}
			</span>
			{isSelecting ? (
				<div className="ms-auto flex shrink-0 items-center">
					{model.actions.map((action: SelectionActionModel) => (
						<HeaderIconButton
							action={action}
							key={action.id}
							onAction={onAction}
						/>
					))}
				</div>
			) : (
				<div className="group/header-actions ms-auto flex shrink-0 items-center">
					{filter === undefined ? null : (
						<div className={headerActionsClass}>
							{filter}
						</div>
					)}
					<div
						className={headerActionsClass}
						data-session-header-reveal=""
					>
						{overflow === undefined ? null : overflow}
						{pinControl}
						<CollapseButton label={collapseLabel} onCollapse={onCollapse} />
					</div>
				</div>
			)}
		</>
	);
}

function renderPanelChrome({
	collapseLabel,
	filter,
	model,
	onAction,
	onCollapse,
	overflow,
}: Readonly<{
	collapseLabel: string;
	filter?: ReactElement;
	model: UntrackedHeaderModel;
	onAction: (id: HeaderActionId) => void;
	onCollapse: () => void;
	overflow?: ReactElement;
}>): ReactElement {
	switch (model.kind) {
		case "browsing":
			return (
				<PanelHeader>
					<PanelTitle>
						{model.title}
						{" "}
						<span className="ms-1.5 shrink-0 font-normal text-text-subtlest">
							{model.count}
						</span>
					</PanelTitle>
					<PanelActionGroup>
						{filter === undefined ? null : filter}
						{overflow === undefined ? null : overflow}
						<PanelAction
							icon={ShrinkHorizontalIcon}
							label={collapseLabel}
							onClick={onCollapse}
						/>
					</PanelActionGroup>
				</PanelHeader>
			);
		case "selecting":
			return (
				<PanelHeader>
					<PanelTitle
						className="[&>span:last-child]:pl-4"
						icon={<SelectAllButton allSelected={model.allSelected} onAction={onAction} />}
					>
						Selected
						{" "}
						<span className="ms-1.5 shrink-0 font-normal text-text-subtlest">
							{model.count}
						</span>
					</PanelTitle>
					<PanelActionGroup>
						{model.actions.map((action: SelectionActionModel) => {
							const IconComponent = HEADER_ACTION_ICON[action.id];
							const affordance = toHeaderActionAffordance(action, onAction);
							return (
								<PanelAction
									disabled={affordance.disabled}
									icon={IconComponent}
									key={action.id}
									label={affordance.text}
									onClick={affordance.onActivate}
									tooltip={affordance.text}
								/>
							);
						})}
					</PanelActionGroup>
				</PanelHeader>
			);
		default: {
			const exhaustive: never = model;
			return exhaustive;
		}
	}
}
