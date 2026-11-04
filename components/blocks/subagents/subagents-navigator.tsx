"use client";

// oxlint-disable react-doctor/prefer-module-scope-pure-function -- These helpers are intentionally local to the component/demo because they depend on the surrounding interaction contract.

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- These components intentionally use slot/render-node props for icons, triggers, and adornments.

import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import AiAgentIcon from "@atlaskit/icon/core/ai-agent";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { IconTile } from "@/components/ui/icon-tile";
import type { TagColor } from "@/components/ui/tag";
import { DeleteIcon, PlusIcon } from "@/components/ui/vpk-icons";
import { Switch } from "@/components/ui/switch";
import {
	hoverRevealRowClassName,
	HoverRevealActions,
	HoverRevealLabel,
} from "@/components/ui-custom/hover-reveal-row";
import type { SubagentPrompt, SubagentsBaseAgent } from "@/components/blocks/subagents/data/demo-agents";
import { getSubagentDisplayName } from "@/components/blocks/subagents/lib/subagent-prompts";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

interface SubagentsNavigatorProps {
	activeSubagentId: string | null;
	baseAgent: SubagentsBaseAgent;
	className?: string;
	onCreateSubagent: () => void;
	onDeleteSubagent?: (id: string) => void;
	onManageSubagents?: () => void;
	onSelectBaseAgent: () => void;
	onSelectSubagent: (id: string) => void;
	onToggleSubagent?: (id: string, enabled: boolean) => void;
	subagents: ReadonlyArray<SubagentPrompt>;
}

const BAR_HEIGHT_PX = 2;
const BAR_GAP_PX = 12;
const MINIMAP_PADDING_Y_PX = 12;
const MINIMAP_PADDING_X_PX = 4;
const MINIMAP_WIDTH_PX = 32;
const PROXIMITY_RADIUS_PX = 80;
const MINIMAP_DIM_OPACITY = 0.4;
const MINIMAP_BASE_BAR_WIDTH_PX = 26;
const MINIMAP_PROMPT_BAR_WIDTH_PX = 16;
const SWITCHER_OPEN_WIDTH_PX = 280;
const SWITCHER_PANEL_PADDING_Y_PX = 16;
const SWITCHER_BASE_ROW_HEIGHT_PX = 36;
const SWITCHER_DIVIDER_BLOCK_HEIGHT_PX = 17;
const SWITCHER_SECTION_LABEL_HEIGHT_PX = 20;
const SWITCHER_ROW_HEIGHT_PX = 36;
const SWITCHER_ROW_GAP_PX = 2;
const SWITCHER_LIST_FOOTER_GAP_PX = 8;
const SWITCHER_FOOTER_CHROME_PX = 9;
const SWITCHER_FOOTER_ACTION_HEIGHT_PX = 32;

function getBaseAgentDisplayName(baseAgent: SubagentsBaseAgent): string {
	return baseAgent.config.name?.trim() || "Untitled agent";
}

const dropdownMenuFrontSlotClassName =
	"inline-flex size-6 shrink-0 items-center justify-center text-icon-subtle group-data-[variant=destructive]/dropdown-menu-item:text-icon-danger group-data-selected/dropdown-menu-item:text-icon-selected [&_[data-slot=icon]]:text-icon-subtle group-data-[variant=destructive]/dropdown-menu-item:[&_[data-slot=icon]]:text-icon-danger group-data-selected/dropdown-menu-item:[&_[data-slot=icon]]:text-icon-selected [&_svg]:text-icon-subtle group-data-[variant=destructive]/dropdown-menu-item:[&_svg]:text-icon-danger group-data-selected/dropdown-menu-item:[&_svg]:text-icon-selected";

const subagentTagColorIconClassName: Partial<Record<TagColor, string>> = {
	blue: "text-blue-500 [&_svg]:text-blue-500!",
	blueLight: "text-blue-500 [&_svg]:text-blue-500!",
	discovery: "text-icon-discovery [&_svg]:text-icon-discovery!",
	green: "text-green-400 [&_svg]:text-green-400!",
	greenLight: "text-green-400 [&_svg]:text-green-400!",
	gray: "text-neutral-500 [&_svg]:text-neutral-500!",
	grayLight: "text-neutral-500 [&_svg]:text-neutral-500!",
	grey: "text-neutral-500 [&_svg]:text-neutral-500!",
	greyLight: "text-neutral-500 [&_svg]:text-neutral-500!",
	lime: "text-lime-400 [&_svg]:text-lime-400!",
	limeLight: "text-lime-400 [&_svg]:text-lime-400!",
	magenta: "text-pink-500 [&_svg]:text-pink-500!",
	magentaLight: "text-pink-500 [&_svg]:text-pink-500!",
	orange: "text-orange-400 [&_svg]:text-orange-400!",
	orangeLight: "text-orange-400 [&_svg]:text-orange-400!",
	purple: "text-purple-500 [&_svg]:text-purple-500!",
	purpleLight: "text-purple-500 [&_svg]:text-purple-500!",
	red: "text-red-600 [&_svg]:text-red-600!",
	redLight: "text-red-600 [&_svg]:text-red-600!",
	standard: "text-neutral-500 [&_svg]:text-neutral-500!",
	teal: "text-teal-400 [&_svg]:text-teal-400!",
	tealLight: "text-teal-400 [&_svg]:text-teal-400!",
	yellow: "text-yellow-400 [&_svg]:text-yellow-400!",
	yellowLight: "text-yellow-400 [&_svg]:text-yellow-400!",
};

const agentAvatarGroupToTagColor: Readonly<Record<string, TagColor>> = {
	"dev-agents": "lime",
	lime: "lime",
	"product-agents": "purple",
	purple: "purple",
	"service-agents": "yellow",
	yellow: "yellow",
	"strategy-agents": "orange",
	orange: "orange",
	"teamwork-agents": "blue",
	blue: "blue",
};

function getTagColorForAgentAvatar(avatarSrc: string | undefined): TagColor | undefined {
	const group = avatarSrc?.match(/\/avatar-agent(?:-new)?\/([^/]+)\//u)?.[1];
	return group ? agentAvatarGroupToTagColor[group] : undefined;
}

function renderBaseAgentSwitcherVisual(avatarSrc: string | undefined): ReactNode {
	if (!avatarSrc) {
		return null;
	}

	return (
		<span
			data-slot="subagents-switcher-avatar"
			aria-hidden="true"
			className="flex size-6 shrink-0 items-center justify-center text-icon-selected"
		>
			<Avatar shape="hexagon" size="sm" className="shrink-0 size-5">
				<AvatarImage alt="" src={avatarSrc} className="object-contain" />
			</Avatar>
		</span>
	);
}

function renderSubagentSwitcherVisual(tagColor: TagColor | undefined): ReactNode {
	return (
		<span className="inline-flex size-6 shrink-0 items-center justify-center">
			<IconTile
				aria-hidden
				className={cn(
					"border border-border bg-surface",
					tagColor ? subagentTagColorIconClassName[tagColor] : "text-icon-subtlest",
				)}
				icon={<AiAgentIcon label="" size="small" />}
				label=""
				size="small"
			/>
		</span>
	);
}

export function SubagentsNavigator({
	activeSubagentId,
	baseAgent,
	className,
	onCreateSubagent,
	onDeleteSubagent,
	onManageSubagents,
	onSelectBaseAgent,
	onSelectSubagent,
	onToggleSubagent,
	subagents,
}: Readonly<SubagentsNavigatorProps>) {
	const switcherId = useId();
	const shouldReduceMotion = useReducedMotion();
	const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const minimapOpacity = useMotionValue(MINIMAP_DIM_OPACITY);
	const subagentTagColor = getTagColorForAgentAvatar(baseAgent.avatarSrc);
	const switcherItemsCount = subagents.length + 1;
	const closedHeight =
		2 * MINIMAP_PADDING_Y_PX +
		switcherItemsCount * BAR_HEIGHT_PX +
		Math.max(0, switcherItemsCount - 1) * BAR_GAP_PX;
	const footerHeight =
		SWITCHER_FOOTER_CHROME_PX +
		(onManageSubagents ? 2 : 1) * SWITCHER_FOOTER_ACTION_HEIGHT_PX;
	const openHeight =
		SWITCHER_PANEL_PADDING_Y_PX +
		SWITCHER_BASE_ROW_HEIGHT_PX +
		SWITCHER_DIVIDER_BLOCK_HEIGHT_PX +
		SWITCHER_SECTION_LABEL_HEIGHT_PX +
		subagents.length * SWITCHER_ROW_HEIGHT_PX +
		Math.max(0, subagents.length - 1) * SWITCHER_ROW_GAP_PX +
		SWITCHER_LIST_FOOTER_GAP_PX +
		footerHeight;
	const shellTransition = shouldReduceMotion
		? undefined
		: [
			"width var(--duration-medium) var(--ease-in-out)",
			"height var(--duration-medium) var(--ease-in-out)",
			"border-radius var(--duration-medium) var(--ease-in-out)",
			"background-color var(--duration-normal) var(--ease-out)",
			"box-shadow var(--duration-medium) var(--ease-out)",
		].join(", ");

	// Proximity sensor: while the minimap is collapsed, brighten it from dim to
	// full opacity once the cursor enters PROXIMITY_RADIUS_PX. This gives the
	// full-opacity state a visible moment as the user approaches, before the
	// hover-to-expand transition swaps it for the floating selector.
	useEffect(() => {
		// When expanded, fade the minimap out so it cross-fades with the panel.
		if (isSwitcherOpen) {
			if (shouldReduceMotion) {
				minimapOpacity.set(0);
			} else {
				animate(minimapOpacity, 0, { type: "spring", bounce: 0, visualDuration: 0.22 });
			}
			return;
		}

		const trigger = triggerRef.current;
		if (!trigger) {
			return;
		}

		// Start collapsed cycles from the dim baseline; the listener below ramps
		// back up if the cursor is already within range.
		minimapOpacity.set(MINIMAP_DIM_OPACITY);
		let wasNear = false;

		function setNear(near: boolean) {
			if (near === wasNear) {
				return;
			}
			wasNear = near;
			const target = near ? 1 : MINIMAP_DIM_OPACITY;
			if (shouldReduceMotion) {
				minimapOpacity.set(target);
				return;
			}
			animate(minimapOpacity, target, {
				type: "spring",
				bounce: 0,
				visualDuration: 0.22,
			});
		}

		function handlePointerMove(event: PointerEvent) {
			const node = triggerRef.current;
			if (!node) {
				return;
			}
			const rect = node.getBoundingClientRect();
			const dx = Math.max(rect.left - event.clientX, 0, event.clientX - rect.right);
			const dy = Math.max(rect.top - event.clientY, 0, event.clientY - rect.bottom);
			setNear(dx * dx + dy * dy <= PROXIMITY_RADIUS_PX * PROXIMITY_RADIUS_PX);
		}

		window.addEventListener("pointermove", handlePointerMove, { passive: true });
		return () => {
			window.removeEventListener("pointermove", handlePointerMove);
		};
	}, [isSwitcherOpen, minimapOpacity, shouldReduceMotion]);

	function handleBlur(event: FocusEvent<HTMLDivElement>) {
		if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
			return;
		}

		setIsSwitcherOpen(false);
	}

	function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		if (event.key === "Escape") {
			event.stopPropagation();
			setIsSwitcherOpen(false);
		}
	}

	if (subagents.length === 0) {
		return null;
	}

	return (
		<div
			className={cn("group", className)}
			onBlur={handleBlur}
			onFocusCapture={() => setIsSwitcherOpen(true)}
			onKeyDown={handleKeyDown}
			onMouseEnter={() => setIsSwitcherOpen(true)}
			onMouseLeave={() => setIsSwitcherOpen(false)}
		>
			<div
				className="relative origin-top-right overflow-hidden text-left"
				id={switcherId}
				style={{
					boxSizing: "border-box",
					width: isSwitcherOpen ? SWITCHER_OPEN_WIDTH_PX : MINIMAP_WIDTH_PX,
					height: isSwitcherOpen ? openHeight : closedHeight,
					borderRadius: isSwitcherOpen ? 16 : 14,
					backgroundColor: isSwitcherOpen ? "var(--ds-surface-overlay)" : "transparent",
					boxShadow: isSwitcherOpen ? token("elevation.shadow.overlay") : "none",
					transition: shellTransition,
				}}
			>
				<motion.button
					ref={triggerRef}
					aria-controls={switcherId}
					aria-expanded={isSwitcherOpen}
					aria-label="Open subagent switcher"
					className={cn(
						"absolute inset-0 flex flex-col items-end justify-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-selected",
						isSwitcherOpen
							? "pointer-events-none"
							: "pointer-events-auto group-focus-within:!opacity-100",
					)}
					inert={isSwitcherOpen}
					onClick={() => setIsSwitcherOpen(true)}
					style={{
						opacity: minimapOpacity,
						paddingTop: MINIMAP_PADDING_Y_PX,
						paddingBottom: MINIMAP_PADDING_Y_PX,
						paddingLeft: MINIMAP_PADDING_X_PX,
						paddingRight: MINIMAP_PADDING_X_PX,
						gap: BAR_GAP_PX,
					}}
					type="button"
				>
					<div
						className={cn(
							"shrink-0 rounded-full transition-colors duration-normal",
							activeSubagentId === null ? "bg-icon" : "bg-icon-disabled",
						)}
						style={{
							width: MINIMAP_BASE_BAR_WIDTH_PX,
							height: BAR_HEIGHT_PX,
						}}
					/>
					{subagents.map((prompt) => {
						const isActive = prompt.id === activeSubagentId;
						return (
							<div
								className={cn(
									"shrink-0 rounded-full transition-colors duration-normal",
									isActive ? "bg-icon" : "bg-icon-disabled",
								)}
								key={prompt.id}
								style={{
									width: MINIMAP_PROMPT_BAR_WIDTH_PX,
									height: BAR_HEIGHT_PX,
								}}
							/>
						);
					})}
				</motion.button>

				<div
					aria-hidden={!isSwitcherOpen}
					className={cn(
						"absolute inset-0 flex flex-col p-2 text-left transition-opacity duration-normal ease-out",
						isSwitcherOpen
							? "pointer-events-auto opacity-100"
							: "pointer-events-none opacity-0",
					)}
					inert={!isSwitcherOpen}
				>
					<div className="shrink-0 pb-2">
						<SubagentsSwitcherButton
							frontSlot={renderBaseAgentSwitcherVisual(baseAgent.avatarSrc)}
							isActive={activeSubagentId === null}
							label={getBaseAgentDisplayName(baseAgent)}
							onSelect={onSelectBaseAgent}
						/>
						<div aria-hidden className="my-2 h-px bg-border" />
						<div className="px-2 pb-1 text-xs font-semibold leading-4 text-text-subtlest">
							Subagents
						</div>
						<div className="flex flex-col gap-0.5">
							{subagents.map((prompt) => {
								const isEnabled = prompt.enabled !== false;
								const label = getSubagentDisplayName(prompt);
								return (
									<SubagentsSwitcherButton
										isActive={prompt.id === activeSubagentId}
										key={prompt.id}
										label={label}
										enabled={isEnabled}
										frontSlot={renderSubagentSwitcherVisual(subagentTagColor)}
										onDelete={onDeleteSubagent ? () => onDeleteSubagent(prompt.id) : undefined}
										onSelect={() => onSelectSubagent(prompt.id)}
										onToggle={
											onToggleSubagent
												? (next) => onToggleSubagent(prompt.id, next)
												: undefined
										}
									/>
								);
							})}
						</div>
					</div>
					<div className="sticky bottom-0 z-10 shrink-0 border-t border-border bg-surface-overlay pt-2">
						<SubagentsActionButton
							icon={<PlusIcon />}
							label="Create subagent"
							onClick={onCreateSubagent}
						/>
						{onManageSubagents ? (
							<SubagentsActionButton
								icon={<AiAgentIcon label="" />}
								label="Manage subagents"
								onClick={onManageSubagents}
							/>
						) : null}
					</div>
				</div>
			</div>
		</div>
	);
}

function SubagentsActionButton({
	icon,
	label,
	onClick,
}: Readonly<{
	icon: ReactNode;
	label: string;
	onClick: () => void;
}>) {
	return (
		<button
			type="button"
			aria-label={label}
			className="group/dropdown-menu-item relative flex h-8 w-full cursor-pointer select-none items-center gap-3 rounded-lg px-2 py-0 text-left text-sm leading-5 outline-none transition-colors duration-normal hover:bg-bg-neutral-subtle-hovered active:bg-bg-neutral-subtle-pressed focus-visible:ring-2 focus-visible:ring-border-selected [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-icon-subtle"
			onClick={onClick}
		>
			<span className="inline-flex size-6 shrink-0 items-center justify-center text-icon-subtle [&_svg]:size-4">
				{icon}
			</span>
			<span className="min-w-0 flex-1 truncate">{label}</span>
		</button>
	);
}

function SubagentsSwitcherButton({
	frontSlot,
	isActive,
	label,
	enabled = true,
	onDelete,
	onSelect,
	onToggle,
}: Readonly<{
	frontSlot?: ReactNode;
	isActive: boolean;
	label: string;
	enabled?: boolean;
	onDelete?: () => void;
	onSelect: () => void;
	onToggle?: (enabled: boolean) => void;
}>) {
	const [isHighlighted, setIsHighlighted] = useState(false);

	function handleSwitchMouseDown(event: MouseEvent<HTMLElement>) {
		event.preventDefault();
	}

	const controlCount = (onToggle ? 1 : 0) + (onDelete ? 1 : 0);

	return (
		<div className={hoverRevealRowClassName}>
			<button
				type="button"
				aria-label={`Select ${label}`}
				aria-pressed={isActive}
				data-highlighted={isHighlighted || undefined}
				data-selected={isActive || undefined}
				data-slot="dropdown-menu-item"
				data-variant="default"
				className={cn(
					"group/dropdown-menu-item data-[highlighted]:bg-bg-neutral-subtle-hovered data-[highlighted]:text-text data-[variant=destructive]:text-text-danger data-[variant=destructive]:data-[highlighted]:bg-bg-danger-subtler-hovered data-disabled:pointer-events-none data-disabled:text-text-disabled relative flex min-h-8 w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm leading-5 outline-none select-none active:bg-bg-neutral-subtle-pressed data-[variant=destructive]:active:bg-bg-danger-subtler-pressed data-inset:pl-8 [&_svg]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:text-icon-subtle data-[variant=destructive]:[&_svg]:text-icon-danger",
					"data-selected:bg-bg-selected data-selected:text-text-selected data-selected:data-[highlighted]:bg-bg-selected-hovered data-selected:data-[highlighted]:text-text-selected data-selected:active:bg-bg-selected-pressed data-selected:[&_svg]:text-icon-selected",
					!enabled ? "text-text-disabled data-[highlighted]:text-text-disabled" : undefined,
				)}
				onBlur={() => setIsHighlighted(false)}
				onClick={onSelect}
				onFocus={() => setIsHighlighted(true)}
				onMouseEnter={() => setIsHighlighted(true)}
				onMouseLeave={() => setIsHighlighted(false)}
			>
				{frontSlot ? (
					<span className={cn(dropdownMenuFrontSlotClassName, !enabled && "opacity-(--opacity-disabled)")}>
						{frontSlot}
					</span>
				) : null}
				<span className="min-w-0 flex flex-1 flex-col">
					{controlCount > 0 ? (
						<HoverRevealLabel
							reserveOnReveal={controlCount === 2 ? 2 : 1}
							// An off subagent parks its switch at rest, so keep its single
							// slot reserved; an on subagent gets the full label width.
							reserveAtRest={!enabled && onToggle ? 1 : 0}
						>
							{label}
						</HoverRevealLabel>
					) : (
						<span className="block min-w-0 truncate">{label}</span>
					)}
				</span>
			</button>
			<HoverRevealActions
				toggleParked={!enabled}
				toggle={
					onToggle ? (
						<Switch
							size="sm"
							checked={enabled}
							onCheckedChange={onToggle}
							onMouseDown={handleSwitchMouseDown}
							aria-label={`${enabled ? "Disable" : "Enable"} ${label}`}
						/>
					) : undefined
				}
				action={
					onDelete ? (
						<button
							type="button"
							aria-label={`Delete ${label}`}
							className="flex size-6 items-center justify-center rounded-md text-text-subtlest transition-colors duration-normal ease-out hover:bg-bg-danger-hovered hover:text-text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-selected [&_svg]:size-4"
							onClick={onDelete}
						>
							<DeleteIcon size="small" />
						</button>
					) : undefined
				}
			/>
		</div>
	);
}
