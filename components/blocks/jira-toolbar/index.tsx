"use client";

import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import CrossIcon from "@atlaskit/icon/core/cross";
import DeleteIcon from "@atlaskit/icon/core/delete";
import EditBulkIcon from "@atlaskit/icon/core/edit-bulk";
import EyeOpenIcon from "@atlaskit/icon/core/eye-open";
import ProjectStatusIcon from "@atlaskit/icon/core/project-status";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import MergeQueueIcon from "@atlaskit/icon-lab/core/merge-queue";
import PresenterModeIcon from "@atlaskit/icon/core/presenter-mode";
import RovoIcon from "@atlaskit/icon-lab/core/rovo";
import { useRouter } from "next/navigation";
import { useOptionalRovoChatControls } from "@/app/contexts/context-rovo-chat-controls";

import {
	AgentSelector,
	type AgentSelectorAgent,
} from "@/components/blocks/agent-selector";
import { statusVariant } from "@/components/blocks/jira-work-item/team-eu26/components/detail-field-editor-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { Lozenge } from "@/components/ui/lozenge";
import { computeContextBarOverflow } from "@/components/ui-custom/context-bar/overflow";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

const TOOLBAR_ENTER: Transition = {
	duration: 0.25,
	ease: [0, 0.4, 0, 1],
}; // duration-slow + ease-out
const TOOLBAR_EXIT: Transition = {
	duration: 0.2,
	ease: [0.6, 0, 0.8, 0.6],
}; // duration-medium + ease-in
const TOOLBAR_REDUCED: Transition = { duration: 0 };

const ACTION_BUTTON_CLASS = "h-8 gap-1.5 px-2";
// Flex gap between the middle-action items, and the reserved width of the "⋯"
// overflow trigger. Fed into `computeContextBarOverflow` so the fitting math
// matches the rendered layout (see the measure row below).
const ACTION_GAP = 0;
const OVERFLOW_TRIGGER_WIDTH = 32;
// The toolbar row carries its own horizontal padding (px-2 → 16px total) inside
// the positioner. Subtract it from the available middle width so a full row is
// never computed as fitting when it would actually clip the toolbar's edge.
const TOOLBAR_HORIZONTAL_PADDING = 16;
// Flyout gap from the trigger. The toolbar is dark and the menus are light, so
// they get extra separation (vs. the default 8px) to avoid the two high-contrast
// surfaces reading as a single merged block when nearly touching.
const FLYOUT_SIDE_OFFSET = 16;

export interface JiraToolbarProps {
	/** Consumer-owned primary action, kept visible beside the selection count. */
	primaryAction?: ReactNode;
	/** Show only the consumer-owned primary action during a focused gesture. */
	primaryActionOnly?: boolean;
	/** Disable when the owning board handles scoped keyboard dismissal. */
	dismissOnEscape?: boolean;
	agents: readonly AgentSelectorAgent[];
	className?: string;
	defaultPinnedAgentIds?: readonly string[];
	onAskRovo?: () => void;
	onSelectAll?: () => void;
	onAgentAssignmentChange: (agentId: string, assigned: boolean) => void;
	onBrowseAgents?: () => void;
	onClearSelection: () => void;
	onCreateAgent?: () => void;
	onDelete?: () => void;
	onEditFields?: () => void;
	onMerge?: () => void;
	onStatusChange: (status: string) => void;
	onWatchOptions?: () => void;
	pinnedItemsLabel?: string;
	selectedAgentIds?: readonly string[];
	selectedCount: number;
	selectedStatus?: string | null;
	statusOptions: readonly string[];
}

interface JiraToolbarActionProps {
	children: ReactNode;
	icon: ReactNode;
	disabled?: boolean;
	onClick?: () => void;
}

function JiraToolbarAction({
	children,
	icon,
	disabled,
	onClick,
}: Readonly<JiraToolbarActionProps>) {
	return (
		<Button
			disabled={disabled}
			className={ACTION_BUTTON_CLASS}
			onClick={onClick}
			type="button"
			variant="ghost"
		>
			{icon}
			{children}
		</Button>
	);
}

function ToolbarSeparator() {
	return <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-border-bold opacity-50" />;
}

// A middle action is described once and rendered in three forms: a hidden
// measurement node (to size the overflow math), an inline toolbar node, and an
// overflow-menu row. Keeping one descriptor per action is the single source of
// truth so the inline row and the "⋯" menu never drift.
interface ToolbarAction {
	id: string;
	label: string;
	/** Icon or logo element, wrapped in `<Icon>` for measurement. */
	icon: ReactElement;
	/** Inline toolbar node (button or dropdown). */
	renderInline: () => ReactNode;
	/** Overflow-menu node (menu item or submenu). */
	renderMenu: () => ReactNode;
	/**
	 * When true, the action always lives in the "⋯" overflow menu and never
	 * renders inline — it does not participate in width-fitting. Used to keep the
	 * top-level toolbar focused on the primary actions (e.g. Edit fields, Merge,
	 * and Watch options are secondary and stay tucked away by default).
	 */
	alwaysOverflow?: boolean;
}

export function JiraToolbar({
	primaryAction,
	primaryActionOnly = false,
	dismissOnEscape = true,
	agents,
	className,
	defaultPinnedAgentIds,
	onAskRovo,
	onSelectAll,
	onAgentAssignmentChange,
	onBrowseAgents,
	onClearSelection,
	onCreateAgent,
	onDelete,
	onEditFields,
	onMerge,
	onStatusChange,
	onWatchOptions,
	pinnedItemsLabel,
	selectedAgentIds = [],
	selectedCount,
	selectedStatus,
	statusOptions,
}: Readonly<JiraToolbarProps>) {
	const shouldReduceMotion = useReducedMotion();
	const router = useRouter();
	const rovoChat = useOptionalRovoChatControls();
	const [agentSelectorOpen, setAgentSelectorOpen] = useState(false);
	const [agentQuery, setAgentQuery] = useState("");
	const selectedAgentIdSet = useMemo(
		() => new Set(selectedAgentIds),
		[selectedAgentIds],
	);
	const transition = shouldReduceMotion ? TOOLBAR_REDUCED : TOOLBAR_ENTER;

	const handleAgentSelectorOpenChange = (open: boolean) => {
		setAgentSelectorOpen(open);
		if (!open) {
			setAgentQuery("");
		}
	};

	const handleAskRovo = onAskRovo ?? (() => {
		if (rovoChat) rovoChat.openChat("sidebar");
		else router.push("/rovo");
	});

	useEffect(() => {
		if (selectedCount === 0 || !dismissOnEscape) {
			return;
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && !event.defaultPrevented) {
				onClearSelection();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [dismissOnEscape, onClearSelection, selectedCount]);

	// Status submenu is reused verbatim inside the standalone dropdown and the
	// overflow menu so the option list stays identical in both places.
	const statusItems = statusOptions.map((status) => (
		<DropdownMenuItem
			key={status}
			onSelect={() => onStatusChange(status)}
			selected={selectedStatus === status}
		>
			<Lozenge variant={statusVariant(status, statusOptions)}>{status}</Lozenge>
		</DropdownMenuItem>
	));
	const agentPicker = (
		<AgentSelector
			agents={agents}
			defaultPinnedAgentIds={defaultPinnedAgentIds}
			onAgentToggle={(agentId) => {
				onAgentAssignmentChange(agentId, !selectedAgentIdSet.has(agentId));
			}}
			onBrowseAgents={() => onBrowseAgents?.()}
			onCreateAgent={() => onCreateAgent?.()}
			onQueryChange={setAgentQuery}
			pinnedItemsLabel={pinnedItemsLabel}
			query={agentQuery}
			selectedAgentIds={selectedAgentIds}
			selectionMode="single"
		/>
	);

	// Middle actions, in priority order (left = highest priority, collapses last).
	// Merge only exists for multi-selection, so it drops out of the list entirely
	// when a single item is selected.
	const actions: ToolbarAction[] = [
		{
			id: "assign",
			label: "Add agent",
			icon: <AiAgentIcon label="" size="small" />,
			renderInline: () => (
				<DropdownMenu open={agentSelectorOpen} onOpenChange={handleAgentSelectorOpenChange}>
					<DropdownMenuTrigger
						render={<Button className={ACTION_BUTTON_CLASS} type="button" variant="ghost" />}
					>
						<Icon render={<AiAgentIcon label="" size="small" />} />
						Add agent
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="start"
						// Bottom-anchored: this popover flips upward, so keep the height
						// bounded by the space above the trigger (--available-height) and
						// let the AgentSelector's own list scroll. Using `max-h-none` +
						// `overflow-hidden` here (as the top-anchored demo does) would let
						// the selector's fixed 26rem height overflow and detach on flip.
						className="w-[360px] max-h-[min(26rem,var(--available-height,26rem))] overflow-hidden p-0"
						positionerClassName="z-[501]"
						side="top"
						sideOffset={FLYOUT_SIDE_OFFSET}
					>
						{agentPicker}
					</DropdownMenuContent>
				</DropdownMenu>
			),
			// Overflow owns a real submenu; the inline dropdown is absent here.
			renderMenu: () => (
				<DropdownMenuSub onOpenChange={(open) => { if (!open) setAgentQuery(""); }}>
					<DropdownMenuSubTrigger
						aria-label="Add agent"
						elemBefore={<Icon render={<AiAgentIcon label="" size="small" />} />}
					>
						Add agent
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent className="w-[360px] max-w-[calc(100vw-2rem)] max-h-[min(26rem,var(--available-height,26rem))] overflow-hidden p-0" positionerClassName="z-[502]">
						{agentPicker}
					</DropdownMenuSubContent>
				</DropdownMenuSub>
			),
		},
		{
			id: "ask-rovo",
			label: "Ask Rovo",
			icon: <RovoIcon label="" size="small" />,
			renderInline: () => (
				<JiraToolbarAction icon={<Icon render={<RovoIcon label="" size="small" />} />} onClick={handleAskRovo}>
					Ask Rovo
				</JiraToolbarAction>
			),
			renderMenu: () => (
				<DropdownMenuItem elemBefore={<Icon render={<RovoIcon label="" size="small" />} />} onSelect={handleAskRovo}>
					Ask Rovo
				</DropdownMenuItem>
			),
		},
		{
			id: "edit-fields",
			label: "Edit fields",
			icon: <EditBulkIcon label="" size="small" />,
			alwaysOverflow: true,
			renderInline: () => (
				<JiraToolbarAction
					icon={<Icon render={<EditBulkIcon label="" size="small" />} />}
					onClick={onEditFields}
				>
					Edit fields
				</JiraToolbarAction>
			),
			renderMenu: () => (
				<DropdownMenuItem
					elemBefore={<Icon render={<EditBulkIcon label="" size="small" />} />}
					onSelect={() => onEditFields?.()}
				>
					Edit fields
				</DropdownMenuItem>
			),
		},
		{
			id: "change-status",
			alwaysOverflow: true,
			label: "Change status",
			icon: <ProjectStatusIcon label="" size="small" />,
			renderInline: () => (
				<DropdownMenu>
					<DropdownMenuTrigger
						render={<Button className={ACTION_BUTTON_CLASS} type="button" variant="ghost" />}
					>
						<Icon render={<ProjectStatusIcon label="" size="small" />} />
						Change status
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="start"
						positionerClassName="z-[501]"
						side="top"
						sideOffset={FLYOUT_SIDE_OFFSET}
					>
						<DropdownMenuGroup>{statusItems}</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			),
			renderMenu: () => (
				<DropdownMenuSub>
					<DropdownMenuSubTrigger
						aria-label="Change status"
						elemBefore={<Icon render={<ProjectStatusIcon label="" size="small" />} />}
					>
						Change status
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent positionerClassName="z-[501]">
						{statusItems}
					</DropdownMenuSubContent>
				</DropdownMenuSub>
			),
		},
		...(selectedCount > 1
			? [
					{
						id: "merge",
						label: "Merge",
						icon: <MergeQueueIcon label="" size="small" />,
						alwaysOverflow: true,
						renderInline: () => (
							<JiraToolbarAction
								icon={<Icon render={<MergeQueueIcon label="" size="small" />} />}
								onClick={onMerge}
							>
								Merge
							</JiraToolbarAction>
						),
						renderMenu: () => (
							<DropdownMenuItem
								elemBefore={<Icon render={<MergeQueueIcon label="" size="small" />} />}
								onSelect={() => onMerge?.()}
							>
								Merge
							</DropdownMenuItem>
						),
					} satisfies ToolbarAction,
				]
			: []),
		{
			id: "watch",
			label: "Watch options",
			icon: <EyeOpenIcon label="" size="small" />,
			alwaysOverflow: true,
			renderInline: () => (
				<JiraToolbarAction
					icon={<Icon render={<EyeOpenIcon label="" size="small" />} />}
					onClick={onWatchOptions}
				>
					Watch options
				</JiraToolbarAction>
			),
			renderMenu: () => (
				<DropdownMenuItem
					elemBefore={<Icon render={<EyeOpenIcon label="" size="small" />} />}
					onSelect={() => onWatchOptions?.()}
				>
					Watch options
				</DropdownMenuItem>
			),
		},
		{
			id: "delete",
			alwaysOverflow: true,
			label: "Delete",
			icon: <DeleteIcon label="" size="small" />,
			renderInline: () => (
				<JiraToolbarAction
					disabled={!onDelete}
					icon={<Icon render={<DeleteIcon label="" size="small" />} />}
					onClick={onDelete}
				>
					Delete
				</JiraToolbarAction>
			),
			renderMenu: () => (
				<DropdownMenuItem
					disabled={!onDelete}
					elemBefore={<Icon render={<DeleteIcon label="" size="small" />} />}
					onSelect={() => onDelete?.()}
				>
					Delete
				</DropdownMenuItem>
			),
		},
	];

	// Width-fitting overflow: measure each action's intrinsic width in a hidden
	// row, then fit as many leading actions as the available width allows. The
	// rest fold into the "⋯" menu (matches the shared context-bar pattern).
	//
	// The toolbar itself is shrink-to-fit and centered, so its own width can't
	// serve as the "available space" (it would collapse to whatever is currently
	// rendered — a feedback loop). Instead we watch the full-width positioner and
	// subtract the always-on leading/trailing clusters to derive how much room
	// the middle actions actually have.
	// Split the descriptors: `alwaysOverflow` actions are pinned into the "⋯" menu
	// and never render inline, so only the inline-eligible actions participate in
	// width-fitting and measurement. The two lists keep their relative source
	// order so the overflow menu still reads top-to-bottom in a natural order.
	const inlineEligibleActions = actions.filter((action) => !action.alwaysOverflow);
	const pinnedOverflowActions = actions.filter((action) => action.alwaysOverflow);

	const positionerRef = useRef<HTMLDivElement>(null);
	const measureRef = useRef<HTMLDivElement>(null);
	const leadingRef = useRef<HTMLDivElement>(null);
	const trailingRef = useRef<HTMLDivElement>(null);
	const [visibleCount, setVisibleCount] = useState<number>(
		inlineEligibleActions.length,
	);
	const inlineActionCount = inlineEligibleActions.length;
	const hasSelection = selectedCount > 0;

	useLayoutEffect(() => {
		if (!hasSelection || primaryActionOnly) return;
		const positioner = positionerRef.current;
		const measure = measureRef.current;
		const leading = leadingRef.current;
		const trailing = trailingRef.current;
		if (!positioner || !measure || !leading || !trailing) {
			return;
		}

		function recompute(): void {
			const widths = Array.from(measure!.children).map(
				(node) => (node as HTMLElement).offsetWidth,
			);
			// Available width for middle actions = the space the toolbar may occupy
			// (positioner content box, i.e. viewport minus its horizontal padding)
			// minus the fixed leading (badge + separator) and trailing
			// (separator + close) clusters.
			const available =
				positioner!.clientWidth
				- leading!.offsetWidth
				- trailing!.offsetWidth
				- TOOLBAR_HORIZONTAL_PADDING;
			// Pinned overflow actions keep the "⋯" trigger permanently in the
			// trailing cluster, so its width is already subtracted above. When it is
			// always present, reserve 0 extra width here to avoid double-counting it;
			// otherwise reserve the trigger width for the case where it only appears
			// once middle actions collapse.
			const reservedTriggerWidth =
				pinnedOverflowActions.length > 0 ? 0 : OVERFLOW_TRIGGER_WIDTH;
			setVisibleCount(
				computeContextBarOverflow(
					widths,
					available,
					reservedTriggerWidth,
					ACTION_GAP,
				),
			);
		}

		recompute();
		const observer = new ResizeObserver(recompute);
		observer.observe(positioner);
		observer.observe(leading);
		observer.observe(trailing);
		return () => observer.disconnect();
	}, [hasSelection, inlineActionCount, pinnedOverflowActions.length, primaryActionOnly]);

	// Inline-eligible actions that fit render inline; the rest collapse into the
	// "⋯" menu. Pinned overflow actions are always appended to the hidden set so
	// they only ever appear inside the "⋯" menu.
	const visibleActions = inlineEligibleActions.slice(0, visibleCount);
	const hiddenActions = [
		...inlineEligibleActions.slice(visibleCount),
		...pinnedOverflowActions,
	];

	return (
		<AnimatePresence initial={false}>
			{selectedCount > 0 ? (
				<div
					aria-label={primaryActionOnly ? "Move card. Auto arrange available." : `${selectedCount} card${selectedCount === 1 ? "" : "s"} selected. Bulk actions available.`}
					className={cn(
						"pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4",
						className,
					)}
					data-slot="jira-toolbar-positioner"
					ref={positionerRef}
					role="region"
				>
					<motion.div
						animate={{ opacity: 1, y: 0 }}
						className="pointer-events-auto max-w-full rounded-lg"
						exit={{
							opacity: shouldReduceMotion ? 1 : 0,
							y: shouldReduceMotion ? 0 : 16,
							transition: shouldReduceMotion ? TOOLBAR_REDUCED : TOOLBAR_EXIT,
						}}
						initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
						// Resolve the overlay shadow here, outside the dark subtree below, so
						// it matches the floating Rovo button's light-mode overlay shadow
						// (elevation.shadow.overlay) rather than the darker dark-mode variant.
						style={{ boxShadow: token("elevation.shadow.overlay"), willChange: "transform, opacity" }}
						transition={transition}
					>
						<div
							className="flex h-12 min-w-0 max-w-[calc(100vw-2rem)] items-center rounded-lg bg-surface px-2"
							data-color-mode="dark"
							data-slot="jira-toolbar"
							data-subtree-theme=""
							data-theme="dark:dark spacing:spacing typography:typography shape:shape"
						>
							{primaryActionOnly ? primaryAction : (
								<>
									{/* Hidden measurement row: intrinsic width of every inline-eligible
									    middle action, used only to compute how many fit. Pinned
									    overflow actions are excluded so the widths array aligns with
									    the fitting math. Never visible. */}
									<div aria-hidden className="pointer-events-none absolute h-0 w-0 overflow-clip">
										<div className="invisible flex items-center" ref={measureRef}>
											{inlineEligibleActions.map((action) => (
												<JiraToolbarAction icon={<Icon render={action.icon} />} key={`measure-${action.id}`}>
													{action.label}
												</JiraToolbarAction>
											))}
										</div>
									</div>

									{/* Always-visible leading cluster. */}
									<div className="flex shrink-0 items-center" ref={leadingRef}>
										<div aria-live="polite" className="flex h-8 items-center gap-2 px-2 text-sm font-medium text-text">
											<Badge max={false}>{selectedCount}</Badge>
											<span>selected</span>
										</div>
										{primaryAction}
										<JiraToolbarAction disabled={!onSelectAll} icon={<Icon render={<PresenterModeIcon label="" size="small" />} />} onClick={onSelectAll}>
											Select all
										</JiraToolbarAction>
										<ToolbarSeparator />
									</div>

									{/* Middle actions: those that fit render inline; the rest collapse
									    into the "⋯" menu. */}
									<div className="flex min-w-0 items-center">
										{visibleActions.map((action) => (
											<span className="flex items-center" key={action.id}>
												{action.renderInline()}
											</span>
										))}
									</div>

									{/* Always-visible trailing cluster (overflow menu + separator + close).
									    Its width is subtracted from the available space so the fitting
									    math accounts for the "⋯" button and close affordance. */}
									<div className="flex shrink-0 items-center" ref={trailingRef}>
										{hiddenActions.length > 0 ? (
											<DropdownMenu>
												<DropdownMenuTrigger
													aria-label="More actions"
													render={
														<Button
															className="size-8"
															shape="circle"
															size="icon"
															type="button"
															variant="ghost"
														/>
													}
												>
													<Icon render={<ShowMoreHorizontalIcon label="" size="small" />} />
												</DropdownMenuTrigger>
												<DropdownMenuContent
													align="end"
													positionerClassName="z-[501]"
													side="top"
													sideOffset={FLYOUT_SIDE_OFFSET}
												>
													<DropdownMenuGroup>
														{hiddenActions.map((action) => (
															<span key={action.id}>{action.renderMenu()}</span>
														))}
													</DropdownMenuGroup>
												</DropdownMenuContent>
											</DropdownMenu>
										) : null}
										<ToolbarSeparator />
										<Button
											aria-label="Clear selection"
											className="size-8"
											onClick={onClearSelection}
											shape="circle"
											size="icon"
											type="button"
											variant="ghost"
										>
											<Icon render={<CrossIcon label="" size="small" />} />
										</Button>
									</div>
								</>
							)}
						</div>
					</motion.div>
				</div>
			) : null}
		</AnimatePresence>
	);
}

export type { AgentSelectorAgent as JiraToolbarAgent };
