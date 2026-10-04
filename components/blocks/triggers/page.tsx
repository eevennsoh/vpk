"use client";

// oxlint-disable react-doctor/no-chain-state-updates -- Related state fields are updated together to preserve atomic UI transitions and avoid partial interaction states.
// oxlint-disable react-doctor/no-derived-state -- These components maintain local derived display state for controlled animations, measurements, or draft editing that cannot be represented as render-only values without changing UX.

// oxlint-disable react-doctor/no-event-handler -- Effects in this file bridge external systems, animation/media state, timers, or parent-controlled state rather than user event handlers.

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- These components intentionally use slot/render-node props for icons, triggers, and adornments.

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import { motion, type Variants } from "motion/react";
import Image from "next/image";
import { useLatestRef } from "@/lib/use-latest-ref";
import AddIcon from "@atlaskit/icon/core/add";
import ArrowLeftIcon from "@atlaskit/icon/core/arrow-left";
import AutomationIcon from "@atlaskit/icon/core/automation";
import BranchIcon from "@atlaskit/icon/core/branch";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import ClockIcon from "@atlaskit/icon/core/clock";
import CrossIcon from "@atlaskit/icon/core/cross";
import DeleteIcon from "@atlaskit/icon/core/delete";
import IncidentIcon from "@atlaskit/icon/core/incident";
import GenerativeIndicatorIcon from "@atlaskit/icon-lab/core/generative-indicator";
import WebhookIcon from "@atlaskit/icon-lab/core/webhook";
import { SearchIcon } from "@/components/ui/vpk-icons";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogTitle,
} from "@/components/ui/dialog";
import { IconTile } from "@/components/ui/icon-tile";
import { Switch } from "@/components/ui/switch";
import { Tile } from "@/components/ui/tile";
import { RichTextCommandMenuSearchField, RichTextEditor } from "@/components/ui-custom/rich-text-editor";
import { RichTextMentionVisualMark } from "@/components/ui-custom/rich-text-editor/mention-visual";
import type { RichTextMentionVisual } from "@/components/ui-custom/rich-text-editor/types";
import "@/components/ui-custom/rich-text-editor/rich-text-editor.css";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AtlassianLogo } from "@/components/ui/logo";
import { BrandLogoMark } from "@/components/ui/logo-mark";
import {
	createAgentTriggerValue,
	createAgentAutomationRule,
	DEFAULT_CONFIGURED_AUTOMATION_RULES,
	getAgentAutomationRuleLabel,
	getAgentTriggerParamLabel,
	getAgentTriggerReadableLabel,
	getTriggerEvent,
	getTriggerProvider,
	TRIGGER_PROVIDERS,
	type AgentTriggerConnectionState,
	type AgentAutomationRule,
	type AgentTriggerEventDefinition,
	type AgentTriggerParamDefinition,
	type AgentTriggerProviderDefinition,
	type AgentTriggerProviderIcon,
	type AgentTriggerProviderId,
	type AgentTriggerValue,
} from "@/components/blocks/triggers/data/trigger-catalog";
import { getTriggerByline } from "@/app/data/directory/trigger-bylines";
import { cn } from "@/lib/utils";
// The new trigger-config surface lives in `trigger-config.tsx`, which already
// imports values from THIS module. Importing `AgentConfigFields` eagerly would
// form a runtime import cycle, so it is loaded lazily (the type import below is
// erased at build time and is cycle-safe).
import type { AgentConfigFormValue } from "@/components/blocks/trigger-config/components/trigger-config";
import { motionEase } from "@/lib/motion";
const AgentConfigFields = lazy(() =>
	import("@/components/blocks/trigger-config/components/trigger-config").then((module) => ({
		default: module.AgentConfigFields,
	})),
);

export type {
	AgentTriggerConnectionState,
	AgentAutomationRule,
	AgentTriggerEventDefinition,
	AgentTriggerParamDefinition,
	AgentTriggerProviderDefinition,
	AgentTriggerProviderId,
	AgentTriggerValue,
};
function renderTriggerProviderIcon(
	icon: AgentTriggerProviderIcon,
	label: string,
): ReactElement {
	if (icon.kind === "third-party") {
		return <BrandLogoMark frame="chip" label={label} name={icon.name} />;
	}

	if (icon.kind === "image") {
		return (
			<Image
				src={icon.src}
				alt=""
				width={16}
				height={16}
				className="size-4 shrink-0"
			/>
		);
	}

	if (icon.kind === "atlassian-logo") {
		return <AtlassianLogo name={icon.name} size="xxsmall" label={label} themeAware />;
	}

	switch (icon.name) {
		case "branch":
			return <BranchIcon label="" size="small" />;
		case "clock":
			return <ClockIcon label="" size="small" />;
		case "incident":
			return <IncidentIcon label="" size="small" />;
		case "webhook":
			return <WebhookIcon label="" size="small" />;
		case "automation":
		default:
			return <AutomationIcon label="" size="small" />;
	}
}

/**
 * Tile-filled provider icon for a configured trigger value, using the EXACT
 * editor-palette treatment (the 24px `.rich-text-command-menu-avatar` tile that
 * the logo fills). Use where a trigger row should mirror the
 * picker / editor-palette logo, e.g. the collapsed agent-config Triggers
 * dropdown rows. Returns `null` for an unknown provider id.
 */
export function AgentTriggerProviderTileIcon({
	fallback = null,
	trigger,
}: Readonly<{ fallback?: ReactNode; trigger: AgentTriggerValue }>): ReactNode {
	const provider = getTriggerProvider(trigger.providerId);
	if (!provider) {
		return fallback;
	}
	return <TriggerProviderTileIcon icon={provider.icon} label={provider.label} />;
}

/**
 * Compact 16px provider visual for dense flow covers. Keeps the shared logo
 * rules from `RichTextMentionVisualMark size="pill"` for product/brand logos,
 * but frames stroked trigger glyphs in the bordered `Tile` treatment so the
 * compact flow cover remains a smaller version of the full tile flow.
 */
export function AgentTriggerProviderCompactTileIcon({
	fallback = null,
	trigger,
}: Readonly<{ fallback?: ReactNode; trigger: AgentTriggerValue }>): ReactNode {
	const provider = getTriggerProvider(trigger.providerId);
	if (!provider) {
		return fallback;
	}
	const visual = getTriggerProviderVisual(provider.icon);

	if (visual.kind === "icon") {
		return (
			<Tile aria-hidden={true} className="bg-surface" hasBorder label={provider.label} size="xxsmall" variant="transparent">
				{renderTriggerProviderIcon(provider.icon, "")}
			</Tile>
		);
	}

	return <RichTextMentionVisualMark label={provider.label} size="pill" visual={visual} />;
}

/**
 * Maps a trigger provider icon to the editor palette's `RichTextMentionVisual`
 * so picker rows get the EXACT same logo treatment as editor-palette menu rows:
 * 1p product logos render bare (they ship their own fill), 2p/3p brand images
 * are border-resolved via `resolveBrandLogoPresentation`, and stroked glyph
 * icons sit in a bordered tile.
 */
function getTriggerProviderVisual(icon: AgentTriggerProviderIcon): RichTextMentionVisual {
	if (icon.kind === "atlassian-logo") {
		return { kind: "logo", logoName: icon.name };
	}
	if (icon.kind === "third-party") {
		return { kind: "third-party", name: icon.name };
	}
	if (icon.kind === "image") {
		return { kind: "image", src: icon.src };
	}
	return { kind: "icon", icon: renderTriggerProviderIcon(icon, "") };
}

/**
 * Picker-row front slot, identical to the editor palette's
 * `RichTextSuggestionMenuItemVisual`: a 24px box (`.rich-text-command-menu-avatar`)
 * wrapping the shared `RichTextMentionVisualMark` at `size="menu-compact"`, which
 * draws a native 24px `small` mark to fill the slot. Reuses the palette's
 * logo/image/icon rules verbatim.
 */
function TriggerProviderTileIcon({
	icon,
	label,
}: Readonly<{ icon: AgentTriggerProviderIcon; label: string }>): ReactElement {
	return (
		<span className="rich-text-command-menu-avatar inline-flex shrink-0 items-center justify-center">
			<RichTextMentionVisualMark
				label={label}
				size="menu-compact"
				visual={getTriggerProviderVisual(icon)}
			/>
		</span>
	);
}

function getInitialAutomationRules({
	defaultAutomationRules,
	defaultTriggers,
	hasTrigger,
}: Readonly<{
	defaultAutomationRules?: readonly AgentAutomationRule[];
	defaultTriggers?: readonly AgentTriggerValue[];
	hasTrigger?: boolean;
}>): AgentAutomationRule[] {
	if (defaultAutomationRules) {
		return [...defaultAutomationRules];
	}

	if (defaultTriggers) {
		return [
			createAgentAutomationRule({
				id: "automation-1",
				name: "Automation",
				triggers: defaultTriggers,
			}),
		];
	}

	return hasTrigger === true ? [...DEFAULT_CONFIGURED_AUTOMATION_RULES] : [];
}

function getConnectionLabel(state: AgentTriggerConnectionState | undefined): string | null {
	switch (state) {
		case "needs-connection":
			return "Requires connection";
		case "connecting":
			return "Connecting";
		case "connection-error":
			return "Connection failed";
		case "connected":
		default:
			return null;
	}
}

function getConnectButtonLabel(state: AgentTriggerConnectionState | undefined): string {
	return state === "connection-error" ? "Retry" : "Connect";
}

function getGroupedEvents(events: readonly AgentTriggerEventDefinition[]) {
	const groups: Array<{
		groupLabel?: string;
		events: AgentTriggerEventDefinition[];
	}> = [];

	for (const event of events) {
		const previousGroup = groups[groups.length - 1];
		if (!previousGroup || previousGroup.groupLabel !== event.groupLabel) {
			groups.push({ groupLabel: event.groupLabel, events: [event] });
			continue;
		}

		previousGroup.events.push(event);
	}

	return groups;
}

interface TriggerAddRowProps extends ComponentProps<"button"> {
	label: string;
}

function TriggerAddRow({
	className,
	label,
	...props
}: Readonly<TriggerAddRowProps>): ReactElement {
	return (
		<button
			type="button"
			className={cn(
				"flex h-8 w-full shrink-0 cursor-pointer items-center gap-3 rounded-lg px-1.5 text-sm text-text-subtle outline-none select-none transition-colors duration-normal hover:bg-bg-neutral-subtle-hovered active:bg-bg-neutral-subtle-pressed focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
				className,
			)}
			{...props}
		>
			<span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center">
				<AddIcon label="" size="small" />
			</span>
			{label}
		</button>
	);
}

/**
 * The editor-palette "search" variant provider list: a sticky search input over
 * the filtered provider→event submenus. Shared by the root `TriggerPicker` and
 * the agent compact nav's "Add trigger ›" flyout so both render an identical
 * searchable provider list.
 */
export function TriggerProviderSearchList({
	autoFocus,
	onSelectEvent,
	searchId,
}: Readonly<{
	autoFocus?: boolean;
	onSelectEvent: (providerId: AgentTriggerProviderId, eventId: string) => void;
	searchId?: string;
}>): ReactElement {
	const [query, setQuery] = useState("");
	const normalizedQuery = query.trim().toLowerCase();
	const filteredProviders = useMemo(
		() =>
			TRIGGER_PROVIDERS.map((provider) => {
				const providerMatches =
					normalizedQuery.length === 0 ||
					provider.label.toLowerCase().includes(normalizedQuery) ||
					provider.description.toLowerCase().includes(normalizedQuery);
				const matchingEvents = provider.events.filter((event) =>
					normalizedQuery.length === 0 ||
					event.label.toLowerCase().includes(normalizedQuery) ||
					event.description.toLowerCase().includes(normalizedQuery),
				);

				return providerMatches
					? { ...provider, events: matchingEvents.length > 0 ? matchingEvents : provider.events }
					: { ...provider, events: matchingEvents };
			}).filter((provider) => provider.events.length > 0),
		[normalizedQuery],
	);

	// Drive the list's top fade-mask exactly like the live suggestion menu: track
	// whether the scrollable list is scrolled away from the top (toggling
	// `data-list-scrolled`), and snap back to the top whenever the query changes
	// so a fresh result set always starts unscrolled.
	const listRef = useRef<HTMLDivElement | null>(null);
	const [hasScrolledList, setHasScrolledList] = useState(false);
	const updateListScrollState = useCallback(() => {
		const listElement = listRef.current;
		setHasScrolledList(Boolean(listElement && listElement.scrollTop > 0));
	}, []);

	useEffect(() => {
		const listElement = listRef.current;
		if (listElement) {
			listElement.scrollTop = 0;
		}
		updateListScrollState();
	}, [normalizedQuery, updateListScrollState]);

	return (
		<div
			className="rich-text-command-menu rich-text-command-menu-embedded"
			data-has-header="true"
			data-list-scrolled={hasScrolledList ? "true" : undefined}
			role="presentation"
		>
			<RichTextCommandMenuSearchField
				autoFocus={autoFocus}
				id={searchId}
				icon={<SearchIcon className="size-4 text-icon-subtle" />}
				label="Search triggers"
				onClear={() => setQuery("")}
				onKeyDown={(event) => event.stopPropagation()}
				onValueChange={setQuery}
				placeholder="Search triggers"
				value={query}
			/>
			<div
				className="rich-text-command-menu-list"
				ref={listRef}
				onScroll={updateListScrollState}
			>
				{filteredProviders.length > 0 ? (
					<DropdownMenuGroup className="p-0">
						{filteredProviders.map((provider) => (
							<TriggerProviderSubmenu
								key={provider.id}
								onSelectEvent={onSelectEvent}
								provider={provider}
							/>
						))}
					</DropdownMenuGroup>
				) : (
					<div className="rich-text-command-menu-empty">
						No triggers found
					</div>
				)}
			</div>
		</div>
	);
}

export function TriggerPicker({
	defaultOpen,
	label,
	onSelectEvent,
	trigger,
}: Readonly<{
	defaultOpen?: boolean;
	label: string;
	onSelectEvent: (providerId: AgentTriggerProviderId, eventId: string) => void;
	/**
	 * Custom element rendered as the dropdown trigger. Defaults to the standard
	 * `TriggerAddRow`. Lets callers anchor the provider/event picker to their own
	 * affordance (e.g. an agent config summary row) while reusing the menu.
	 */
	trigger?: ReactElement;
}>): ReactElement {
	const [open, setOpen] = useState(defaultOpen ?? false);

	const handleSelectEvent = useCallback(
		(providerId: AgentTriggerProviderId, eventId: string) => {
			setOpen(false);
			onSelectEvent(providerId, eventId);
		},
		[onSelectEvent],
	);

	const handleOpenChange = useCallback(
		(nextOpen: boolean, eventDetails: { reason?: string }) => {
			// Hovering a provider submenu trigger opens that submenu, which Base UI
			// reports against the controlled root as a `sibling-open` close —
			// collapsing the whole picker before the user can reach a submenu item.
			// Blurring the in-menu search input similarly reports `focus-out`.
			// Ignore both so the picker stays open during normal pointer
			// interaction; all explicit closes (item press, escape, outside press,
			// trigger press) still pass through.
			if (
				!nextOpen &&
				(eventDetails.reason === "sibling-open" ||
					eventDetails.reason === "focus-out")
			) {
				return;
			}
			setOpen(nextOpen);
		},
		[],
	);

	return (
		<DropdownMenu open={open} onOpenChange={handleOpenChange}>
			<DropdownMenuTrigger render={trigger ?? <TriggerAddRow label={label} />} />
			<DropdownMenuContent
				align="start"
				className="w-[min(24rem,calc(100vw-2rem))] p-0"
				sideOffset={6}
			>
				<TriggerProviderSearchList
					autoFocus
					onSelectEvent={handleSelectEvent}
					searchId="trigger-picker-search"
				/>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// Byline reveal motion. Mirrors `nestedCommandLabelVariants` /
// `nestedCommandDescriptionVariants` in the editor palette suggestion menu (and
// `greetingLabelVariants` / `greetingDescriptionVariants` in the chat greeting
// rows) so the provider-row byline reveal matches every other command-menu
// surface exactly: the label lifts up and the byline fades + slides in on
// hover/highlight without changing the row height.
const triggerProviderLabelVariants: Variants = {
	idle: {
		transform: "translateY(8px)",
		transition: { type: "spring", bounce: 0, visualDuration: 0.18 },
	},
	active: {
		transform: "translateY(0px)",
		transition: { type: "spring", bounce: 0.12, visualDuration: 0.24 },
	},
};

const triggerProviderBylineVariants: Variants = {
	idle: {
		opacity: 0,
		transform: "translateY(4px)",
		transition: { duration: 0.1, ease: [0.4, 0, 1, 1] },
	},
	active: {
		opacity: 1,
		transform: "translateY(0px)",
		transition: { delay: 0.02, duration: 0.16, ease: motionEase.out },
	},
};

export function TriggerProviderSubmenu({
	onSelectEvent,
	provider,
}: Readonly<{
	onSelectEvent: (providerId: AgentTriggerProviderId, eventId: string) => void;
	provider: AgentTriggerProviderDefinition;
}>): ReactElement {
	const groups = getGroupedEvents(provider.events);
	const byline = getTriggerByline(provider.id);
	// Reveal the byline whenever the row is hovered/focused/keyboard-highlighted,
	// and keep it revealed while the events submenu is open (the pointer leaves
	// the trigger to enter the submenu, which would otherwise collapse it).
	const [isInteractionActive, setIsInteractionActive] = useState(false);
	const [isSubmenuOpen, setIsSubmenuOpen] = useState(false);
	const isActive = isInteractionActive || isSubmenuOpen;

	return (
		<DropdownMenuSub onOpenChange={setIsSubmenuOpen}>
			<DropdownMenuSubTrigger
				className="h-11"
				onMouseEnter={() => setIsInteractionActive(true)}
				onMouseLeave={() => setIsInteractionActive(false)}
				onFocus={() => setIsInteractionActive(true)}
				onBlur={() => setIsInteractionActive(false)}
			>
				<span className="flex min-w-0 flex-1 items-center gap-3">
					<TriggerProviderTileIcon icon={provider.icon} label={provider.label} />
					{byline ? (
						<span className="rich-text-command-menu-copy rich-text-command-menu-nested-copy rich-text-command-menu-nested-copy-revealable flex-1">
							<motion.span
								animate={isActive ? "active" : "idle"}
								className="menu-row-title"
								initial={false}
								style={{ willChange: "transform" }}
								variants={triggerProviderLabelVariants}
							>
								{provider.label}
							</motion.span>
							<motion.span
								animate={isActive ? "active" : "idle"}
								className="menu-row-byline"
								initial={false}
								style={{ willChange: "transform, opacity" }}
								variants={triggerProviderBylineVariants}
							>
								{byline}
							</motion.span>
						</span>
					) : (
						<span className="min-w-0 truncate">{provider.label}</span>
					)}
				</span>
			</DropdownMenuSubTrigger>
			<DropdownMenuSubContent className="min-w-64 overflow-hidden p-0">
				<div className="rich-text-command-menu rich-text-command-menu-borderless">
					<div className="rich-text-command-menu-list">
						{groups.map((group, groupIndex) => (
							<DropdownMenuGroup
								className="p-0"
								key={`${provider.id}-${group.groupLabel ?? "default"}-${groupIndex}`}
							>
								{group.groupLabel ? (
									<DropdownMenuLabel>{group.groupLabel}</DropdownMenuLabel>
								) : null}
								{group.events.map((event) => (
									<DropdownMenuItem
										key={event.id}
										description={event.description}
										onSelect={() => onSelectEvent(provider.id, event.id)}
									>
										{event.label}
									</DropdownMenuItem>
								))}
								{groupIndex < groups.length - 1 ? (
									<DropdownMenuSeparator />
								) : null}
							</DropdownMenuGroup>
						))}
					</div>
				</div>
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);
}

function TriggerParamMenu({
	disabled,
	onValueChange,
	param,
	value,
}: Readonly<{
	disabled?: boolean;
	onValueChange: (value: string) => void;
	param: AgentTriggerParamDefinition;
	value: string | undefined;
}>): ReactElement {
	const label = getAgentTriggerParamLabel(param, value);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={(
					<Button
						type="button"
						variant="outline"
						size="compact"
						disabled={disabled}
						aria-label={`${param.label}: ${label}`}
						className="max-w-52"
					/>
				)}
			>
				<span className="min-w-0 truncate">{label}</span>
				<ChevronDownIcon label="" size="small" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="min-w-56">
				{/* The repo list scrolls within a bounded area so the Add/Refresh
				    actions below stay pinned as a sticky footer. */}
				<div className={param.id === "repository" ? "max-h-60 overflow-y-auto" : undefined}>
					<DropdownMenuGroup>
						<DropdownMenuLabel>{param.label}</DropdownMenuLabel>
						{param.options.map((option) => (
							<DropdownMenuItem
								key={option.value}
								description={option.description}
								onSelect={() => onValueChange(option.value)}
							>
								{option.label}
							</DropdownMenuItem>
						))}
					</DropdownMenuGroup>
				</div>
				{param.id === "repository" ? (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem
								elemBefore={<AddIcon label="" size="small" />}
								onSelect={() => undefined}
							>
								Add repositories
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={() => undefined}>
								Refresh repositories
							</DropdownMenuItem>
						</DropdownMenuGroup>
					</>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function TriggerSentence({
	disabled,
	event,
	onParamChange,
	trigger,
}: Readonly<{
	disabled?: boolean;
	event: AgentTriggerEventDefinition;
	onParamChange: (paramId: string, value: string) => void;
	trigger: AgentTriggerValue;
}>): ReactElement {
	if (!event.params || event.params.length === 0) {
		return <span className="font-medium text-text">{event.label}</span>;
	}

	return (
		<span className="flex min-w-0 flex-wrap items-center gap-1.5 text-text">
			<span className="font-medium">{event.label}</span>
			{event.params.map((param) => (
				<span className="inline-flex min-w-0 items-center gap-1.5" key={param.id}>
					<span>{param.connector}</span>
					<TriggerParamMenu
						disabled={disabled}
						onValueChange={(value) => onParamChange(param.id, value)}
						param={param}
						value={trigger.params?.[param.id]}
					/>
				</span>
			))}
		</span>
	);
}

function TriggerRowDeleteButton({ onRemove }: Readonly<{ onRemove: () => void }>): ReactElement {
	return (
		<Button
			aria-label="Delete trigger"
			className="self-start opacity-0 transition-opacity duration-normal group-hover/trigger-row:opacity-100 group-has-[:focus-visible]/trigger-row:opacity-100 focus-visible:opacity-100 hover:bg-bg-danger-hovered hover:text-text-danger active:bg-bg-danger-pressed [&:hover_svg]:text-icon-danger"
			onClick={onRemove}
			size="icon-compact"
			type="button"
			variant="ghost"
		>
			<DeleteIcon label="" size="small" />
		</Button>
	);
}

/**
 * One trigger condition row inside the automation modal. The prompt is shared
 * by the automation, so this row only owns the event sentence, params, state,
 * and delete affordance.
 */
function TriggerRow({
	onConnect,
	onParamChange,
	onRemove,
	trigger,
}: Readonly<{
	onConnect?: (trigger: AgentTriggerValue) => void;
	onParamChange: (paramId: string, value: string) => void;
	onRemove: () => void;
	trigger: AgentTriggerValue;
}>): ReactElement {
	const provider = getTriggerProvider(trigger.providerId);
	const event = provider ? getTriggerEvent(provider.id, trigger.eventId) : undefined;
	const connectionLabel = getConnectionLabel(trigger.connectionState);
	const needsConnection = Boolean(connectionLabel);
	const paramsDisabled = trigger.connectionState !== undefined && trigger.connectionState !== "connected";

	if (!provider || !event) {
		return (
			<div className="group/trigger-row grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-x-3">
				<IconTile
					aria-hidden={true}
					icon={<AutomationIcon label="" size="small" />}
					label="Automation"
					size="medium"
					variant="blue"
				/>
				<div className="flex min-h-8 min-w-0 items-start gap-2">
					<div className="min-w-0 flex-1 self-center text-sm text-text">
						{trigger.label ?? "Unknown trigger"}
					</div>
					<TriggerRowDeleteButton onRemove={onRemove} />
				</div>
			</div>
		);
	}

	return (
		<div className="group/trigger-row grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3 rounded-lg p-1.5 transition-colors duration-normal hover:bg-bg-neutral-subtle-hovered">
			<div className="flex size-6 items-center justify-center" aria-hidden={true}>
				<TriggerProviderTileIcon icon={provider.icon} label={provider.label} />
			</div>
			<div className="grid min-w-0 gap-1.5">
				<div className="flex items-center gap-2">
					<div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-text">
						<TriggerSentence
							disabled={paramsDisabled}
							event={event}
							onParamChange={onParamChange}
							trigger={trigger}
						/>
					</div>
					<TriggerRowDeleteButton onRemove={onRemove} />
				</div>
				{connectionLabel ? (
					<div className="flex min-w-0 flex-wrap items-center gap-2 text-sm leading-5">
						<span
							className={cn(
								"font-medium",
								trigger.connectionState === "connection-error"
									? "text-text-danger"
									: "text-text-warning",
							)}
						>
							{connectionLabel}
						</span>
						{needsConnection ? (
							<Button
								type="button"
								variant="outline"
								size="compact"
								isLoading={trigger.connectionState === "connecting"}
								onClick={() => onConnect?.(trigger)}
							>
								{getConnectButtonLabel(trigger.connectionState)}
							</Button>
						) : null}
					</div>
				) : null}
			</div>
		</div>
	);
}

function getAutomationPrompt(rule: AgentAutomationRule): string {
	return rule.prompt ?? "";
}

function getAutomationName(rule: AgentAutomationRule): string {
	return rule.name ?? "";
}

function getAutomationDescription(rule: AgentAutomationRule): string {
	return rule.description ?? "";
}

function isAutomationRuleEnabled(rule: AgentAutomationRule): boolean {
	return rule.enabled !== false;
}

function createEmptyAutomationRule(index: number): AgentAutomationRule {
	return createAgentAutomationRule({
		id: `automation-${index}`,
		name: "",
		prompt: "",
		triggers: [],
	});
}

export function TriggerConditionsPanel({
	defaultPickerOpen,
	onAddTrigger,
	onConnectTrigger,
	onParamChange,
	onRemoveTrigger,
	triggers,
}: Readonly<{
	defaultPickerOpen?: boolean;
	onAddTrigger: (providerId: AgentTriggerProviderId, eventId: string) => void;
	onConnectTrigger?: (trigger: AgentTriggerValue) => void;
	onParamChange: (triggerId: string, paramId: string, value: string) => void;
	onRemoveTrigger: (triggerId: string) => void;
	triggers: readonly AgentTriggerValue[];
}>): ReactElement {
	return (
		<div className="overflow-hidden rounded-xl border border-border bg-bg-input">
			<div className="grid p-1.5">
				{triggers.length > 0 ? (
					triggers.map((trigger) => (
						<TriggerRow
							key={trigger.id}
							onConnect={onConnectTrigger}
							onParamChange={(paramId, value) => onParamChange(trigger.id, paramId, value)}
							onRemove={() => onRemoveTrigger(trigger.id)}
							trigger={trigger}
						/>
					))
				) : (
					<div className="px-3 py-6 text-center text-sm text-text-subtle">
						No triggers configured.
					</div>
				)}
			</div>
			<div className="border-t border-border bg-surface p-1.5">
				<TriggerPicker
					defaultOpen={defaultPickerOpen}
					label="Add trigger"
					onSelectEvent={onAddTrigger}
				/>
			</div>
		</div>
	);
}

function TriggerAutomationFlowPreview({
	automationName,
	prompt,
	triggers,
}: Readonly<{
	automationName: string;
	prompt: string;
	triggers: readonly AgentTriggerValue[];
}>): ReactElement {
	const visibleTriggers = triggers.slice(0, 5);
	const overflowCount = Math.max(0, triggers.length - visibleTriggers.length);
	const title = automationName.trim() || "Untitled automation";
	const description = prompt.trim() || "Automation description";

	return (
		<div>
			<div className="mb-3 flex items-center gap-2" aria-hidden={true}>
				<div className="flex min-w-0 items-center gap-1">
					{visibleTriggers.length > 0 ? (
						visibleTriggers.map((trigger) => {
							const provider = getTriggerProvider(trigger.providerId);
							return (
								<IconTile
									className="border border-border bg-bg-input text-icon-subtle"
									icon={provider ? renderTriggerProviderIcon(provider.icon, provider.label) : (
										<AutomationIcon label="" size="small" />
									)}
									key={trigger.id}
									label={provider?.label ?? "Trigger"}
									size="small"
									variant="transparent"
								/>
							);
						})
					) : (
						<IconTile
							className="border border-border bg-bg-input text-icon-subtle"
							icon={<AutomationIcon label="" size="small" />}
							label="Trigger"
							size="small"
							variant="transparent"
						/>
					)}
					{overflowCount > 0 ? (
						<span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-border bg-bg-input px-1.5 text-xs font-medium leading-4 text-text-subtle">
							+{overflowCount}
						</span>
					) : null}
				</div>
				<div className="h-px w-8 shrink-0 bg-border" />
				<IconTile
					className="bg-bg-neutral text-icon-subtle"
					icon={<GenerativeIndicatorIcon label="" size="small" />}
					label="Agent instructions"
					size="small"
					variant="transparent"
				/>
			</div>
			<div className="grid gap-1">
				<div className="text-base font-semibold leading-6 text-text">
					{title}
				</div>
				<div className="text-sm leading-5 text-text-subtle">
					{description}
				</div>
			</div>
		</div>
	);
}

export interface TriggerAutomationDialogProps {
	showBack?: boolean;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	automationRule: AgentAutomationRule;
	onSave: (automationRule: AgentAutomationRule) => void;
	defaultPickerOpen?: boolean;
	onConnectTrigger?: (trigger: AgentTriggerValue) => void;
	title?: string;
	saveLabel?: string;
}

export function TriggerAutomationDialog({
	automationRule,
	defaultPickerOpen,
	onConnectTrigger,
	onOpenChange,
	onSave,
	open,
	saveLabel = "Save",
	title = "New Automation",
}: Readonly<TriggerAutomationDialogProps>): ReactElement {
	const seedRef = useLatestRef<AgentAutomationRule>(automationRule);
	const wasOpen = useRef(open);
	const connectTimerRef = useRef<number | null>(null);
	const [draftTriggers, setDraftTriggers] = useState<readonly AgentTriggerValue[]>(automationRule.triggers);
	const [automationName, setAutomationName] = useState(() => getAutomationName(automationRule));
	const [sharedPrompt, setSharedPrompt] = useState(() => getAutomationPrompt(automationRule));
	const [active, setActive] = useState(() => isAutomationRuleEnabled(automationRule));

	useEffect(() => {
		if (open && !wasOpen.current) {
			const nextSeed = seedRef.current;
			setDraftTriggers(nextSeed.triggers);
			setAutomationName(getAutomationName(nextSeed));
			setSharedPrompt(getAutomationPrompt(nextSeed));
			setActive(isAutomationRuleEnabled(nextSeed));
		}
		wasOpen.current = open;
	}, [open, seedRef]);

	// oxlint-disable-next-line react-doctor/exhaustive-deps -- Unmount-only cleanup for the fake provider connection timer.
	useEffect(() => {
		return () => {
			if (connectTimerRef.current !== null) {
				window.clearTimeout(connectTimerRef.current);
			}
		};
	}, []);

	const handleAddTrigger = useCallback(
		(providerId: AgentTriggerProviderId, eventId: string) => {
			setDraftTriggers((current) => {
				const nextTrigger = createAgentTriggerValue(providerId, eventId, current.length + 1);
				return nextTrigger ? [...current, nextTrigger] : current;
			});
		},
		[],
	);

	const handleParamChange = useCallback((triggerId: string, paramId: string, value: string) => {
		setDraftTriggers((current) =>
			current.map((trigger) => {
				if (trigger.id !== triggerId) {
					return trigger;
				}

				const nextTrigger = {
					...trigger,
					params: {
						...(trigger.params ?? {}),
						[paramId]: value,
					},
				};

				return {
					...nextTrigger,
					label: getAgentTriggerReadableLabel(nextTrigger),
				};
			}),
		);
	}, []);

	const handleConnect = useCallback(
		(trigger: AgentTriggerValue) => {
			onConnectTrigger?.(trigger);
			const { providerId } = trigger;
			// Fake connection: mark every trigger sharing this provider as connecting,
			// then flip them to connected after a short "Connecting…" spin. The dialog
			// owns the visible draft state, so the transition must happen here.
			setDraftTriggers((current) =>
				current.map((draftTrigger) =>
					draftTrigger.providerId === providerId
						? { ...draftTrigger, connectionState: "connecting" as const }
						: draftTrigger,
				),
			);

			if (connectTimerRef.current !== null) {
				window.clearTimeout(connectTimerRef.current);
			}
			connectTimerRef.current = window.setTimeout(() => {
				setDraftTriggers((current) =>
					current.map((draftTrigger) =>
						draftTrigger.providerId === providerId
							? { ...draftTrigger, connectionState: "connected" as const }
							: draftTrigger,
					),
				);
				connectTimerRef.current = null;
			}, 1200);
		},
		[onConnectTrigger],
	);

	const handleRemoveTrigger = useCallback((triggerId: string) => {
		setDraftTriggers((current) => current.filter((trigger) => trigger.id !== triggerId));
	}, []);

	const handleSave = useCallback(() => {
		onSave(createAgentAutomationRule({
			...automationRule,
			name: automationName.trim(),
			enabled: active,
			prompt: sharedPrompt,
			triggers: draftTriggers,
		}));
		onOpenChange(false);
	}, [active, automationName, automationRule, draftTriggers, onOpenChange, onSave, sharedPrompt]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[min(760px,calc(100vh-2rem))] flex-col gap-0 overflow-hidden p-0" showCloseButton={false} size="lg">
				<div className="flex shrink-0 items-center justify-between px-6 py-6">
					<div className="flex min-w-0 items-center gap-2">
						<Button
							aria-label="Back"
							className="-ml-2 text-icon-subtle"
							onClick={() => onOpenChange(false)}
							size="icon"
							type="button"
							variant="ghost"
						>
							<ArrowLeftIcon label="" />
						</Button>
						<DialogTitle className="truncate text-xl font-semibold leading-6 text-text">{title}</DialogTitle>
					</div>
					<div className="flex items-center gap-3">
						<label className="flex items-center gap-2 text-sm font-medium text-text">
							<span>{active ? "Active" : "Inactive"}</span>
							<Switch checked={active} label={active ? "Active" : "Inactive"} onCheckedChange={setActive} />
						</label>
						<DialogClose render={<Button aria-label="Close" size="icon" variant="ghost" />}>
							<CrossIcon label="" />
						</DialogClose>
					</div>
				</div>
				<div className="grid min-h-0 flex-1 gap-5 overflow-y-auto px-6 py-5">
					<TriggerAutomationFlowPreview
						automationName={automationName}
						prompt={sharedPrompt}
						triggers={draftTriggers}
					/>
					<TriggerConditionsPanel
						defaultPickerOpen={defaultPickerOpen}
						onAddTrigger={handleAddTrigger}
						onConnectTrigger={handleConnect}
						onParamChange={handleParamChange}
						onRemoveTrigger={handleRemoveTrigger}
						triggers={draftTriggers}
					/>
					<div className="grid gap-2">
						<RichTextEditor
							aria-label="Agent Instructions"
							className="space-y-2"
							contentClassName="pt-2"
							editorClassName="agent-instructions-tiptap-editor text-text"
							onMarkdownChange={setSharedPrompt}
							placeholder="Tell the agent what to do when any trigger starts this automation..."
							suggestionVariant="nested"
							value={sharedPrompt}
						/>
					</div>
				</div>
				<div className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-surface-overlay px-6 py-4">
					<Button onClick={() => onOpenChange(false)} type="button" variant="ghost">
						Cancel
					</Button>
					<Button disabled={draftTriggers.length === 0} onClick={handleSave} type="button">
						{saveLabel}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

// Automation modal variant that hosts the new trigger-config surface
// (`AgentConfigFields`) in its body instead of the inline flow-preview +
// conditions panel + tiptap. Same header/footer chrome and the same rule-based
// `onSave` contract as `TriggerAutomationDialog`, so it is a drop-in for the
// `Triggers` component without changing the shared dialog used elsewhere.
//
// Bridge: the dialog owns a draft `AgentConfigFormValue` whose
// `automationRules`/`instructions` mirror the editing rule. `AgentConfigFields`
// reads triggers via `getAgentAutomationRules` (which prefers
// `config.automationRules`) and emits edits through `onAutomationRulesChange`
// (triggers) and `onTextChange("instructions", …)` (shared prompt).
export function TriggerConfigAutomationDialog({
	automationRule,
	onConnectTrigger,
	onOpenChange,
	onSave,
	open,
	saveLabel = "Save",
	showBack = false,
	title = "Edit automation",
}: Readonly<TriggerAutomationDialogProps>): ReactElement {
	const seedRef = useLatestRef<AgentAutomationRule>(automationRule);
	const wasOpen = useRef(open);
	const connectTimerRef = useRef<number | null>(null);
	const [draftRule, setDraftRule] = useState<AgentAutomationRule>(automationRule);
	const [active, setActive] = useState(() => isAutomationRuleEnabled(automationRule));

	useEffect(() => {
		if (open && !wasOpen.current) {
			const nextSeed = seedRef.current;
			setDraftRule(nextSeed);
			setActive(isAutomationRuleEnabled(nextSeed));
		}
		wasOpen.current = open;
	}, [open, seedRef]);

	// oxlint-disable-next-line react-doctor/exhaustive-deps -- Unmount-only cleanup for the fake provider connection timer.
	useEffect(() => {
		return () => {
			if (connectTimerRef.current !== null) {
				window.clearTimeout(connectTimerRef.current);
			}
		};
	}, []);

	// The shared profile header reads `config.name`/`config.description`, so mirror
	// the editing rule's name + description onto the throwaway config. Without this
	// the header always falls back to the "Untitled automation" / "Add a
	// description" placeholders even when generation produced real values.
	const config = useMemo<AgentConfigFormValue>(
		() => ({
			automationRules: [draftRule],
			instructions: getAutomationPrompt(draftRule),
			name: getAutomationName(draftRule),
			description: getAutomationDescription(draftRule),
		}),
		[draftRule],
	);

	const handleAutomationRulesChange = useCallback(
		(nextRules: readonly AgentAutomationRule[]) => {
			const nextRule = nextRules[0];
			if (nextRule) {
				setDraftRule(nextRule);
			}
		},
		[],
	);

	const handleConfigTextChange = useCallback(
		(field: string, value: string) => {
			if (field === "instructions") {
				setDraftRule((current) => ({ ...current, prompt: value }));
			} else if (field === "name") {
				setDraftRule((current) => ({ ...current, name: value }));
			} else if (field === "description") {
				setDraftRule((current) => ({ ...current, description: value }));
			}
		},
		[],
	);

	// Fake provider connection: flip every trigger sharing the provider to
	// "connecting", then "connected" after a short spin. Mirrors the transition
	// `TriggerAutomationDialog` owned, but on the draft rule's triggers.
	const handleConnect = useCallback(
		(trigger: AgentTriggerValue) => {
			onConnectTrigger?.(trigger);
			const { providerId } = trigger;
			const markProviderTriggers = (state: "connecting" | "connected") => {
				setDraftRule((current) => ({
					...current,
					triggers: current.triggers.map((draftTrigger) =>
						draftTrigger.providerId === providerId
							? { ...draftTrigger, connectionState: state }
							: draftTrigger,
					),
				}));
			};

			markProviderTriggers("connecting");
			if (connectTimerRef.current !== null) {
				window.clearTimeout(connectTimerRef.current);
			}
			connectTimerRef.current = window.setTimeout(() => {
				markProviderTriggers("connected");
				connectTimerRef.current = null;
			}, 1200);
		},
		[onConnectTrigger],
	);

	const handleSave = useCallback(() => {
		onSave(createAgentAutomationRule({
			...draftRule,
			name: getAutomationName(draftRule).trim(),
			description: getAutomationDescription(draftRule).trim() || undefined,
			enabled: active,
		}));
		onOpenChange(false);
	}, [active, draftRule, onOpenChange, onSave]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[min(760px,calc(100vh-2rem))] flex-col gap-0 overflow-hidden p-0" showCloseButton={false} size="lg">
				<div className="flex shrink-0 items-center justify-between px-6 py-6">
					<div className="flex min-w-0 items-center gap-2">
					{showBack ? (
						<Button
							aria-label="Back"
							className="-ml-2 text-icon-subtle"
							onClick={() => onOpenChange(false)}
							size="icon"
							type="button"
							variant="ghost"
						>
							<ArrowLeftIcon label="" />
						</Button>
					) : null}
						<DialogTitle className="truncate text-xl font-semibold leading-6 text-text">{title}</DialogTitle>
					</div>
					<div className="flex items-center gap-3">
						<label className="flex items-center gap-2 text-sm font-medium text-text-subtle">
							<span>{active ? "Active" : "Inactive"}</span>
							<Switch checked={active} label={active ? "Active" : "Inactive"} onCheckedChange={setActive} />
						</label>
						<DialogClose render={<Button aria-label="Close" size="icon" variant="ghost" />}>
							<CrossIcon label="" />
						</DialogClose>
					</div>
				</div>
				<div className="flex min-h-0 flex-1 flex-col px-6 pb-5">
					<Suspense fallback={null}>
						<AgentConfigFields
							compactScrollAreaClassName="overflow-y-hidden"
							compactInstructionsContentClassName="min-h-[120px] max-h-[320px] overflow-y-auto"
							config={config}
							idPrefix="trigger-config-automation"
							onAutomationRulesChange={handleAutomationRulesChange}
							onConnectTrigger={handleConnect}
							onTextChange={handleConfigTextChange}
						/>
					</Suspense>
				</div>
				<div className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-surface-overlay px-6 py-4">
					<Button onClick={() => onOpenChange(false)} type="button" variant="ghost">
						Cancel
					</Button>
					<Button disabled={draftRule.triggers.length === 0} onClick={handleSave} type="button">
						{saveLabel}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export interface TriggersProps {
	/** Controlled automation rules. */
	automationRules?: readonly AgentAutomationRule[];
	/** Initial automation rules for uncontrolled usage. */
	defaultAutomationRules?: readonly AgentAutomationRule[];
	/** Invoked whenever automation rules change. */
	onAutomationRulesChange?: (automationRules: readonly AgentAutomationRule[]) => void;
	/** Controlled trigger definitions. */
	triggers?: readonly AgentTriggerValue[];
	/** Initial trigger definitions for uncontrolled usage. */
	defaultTriggers?: readonly AgentTriggerValue[];
	/** Opens the picker on first render for demos and visual state coverage. */
	defaultPickerOpen?: boolean;
	/** Label for the add-trigger affordance. */
	addTriggerLabel?: string;
	/** Invoked whenever trigger definitions change. */
	onTriggersChange?: (triggers: readonly AgentTriggerValue[]) => void;
	/** Invoked when a connection CTA is pressed. */
	onConnectTrigger?: (trigger: AgentTriggerValue) => void;
	/** Legacy compatibility: explicit true seeds configured demo triggers. */
	hasTrigger?: boolean;
	/** @deprecated Use typed trigger params instead. */
	statusLabel?: string;
	/** @deprecated Use typed trigger params instead. */
	boardLabel?: string;
	/** @deprecated Use provider icons instead. */
	boardAvatarSrc?: string;
	/** @deprecated Trigger prompts are handled by agent instructions. */
	prompt?: string;
	/** @deprecated Use onTriggersChange. */
	onClearTrigger?: () => void;
	className?: string;
}

/**
 * Triggers — an agent automation trigger editor. The block renders a compact
 * summary surface; creation and editing happen in the automation modal so one
 * shared instruction prompt can apply to multiple trigger conditions.
 */
export default function Triggers({
	addTriggerLabel = "Add trigger",
	automationRules,
	className,
	defaultAutomationRules,
	defaultPickerOpen,
	defaultTriggers,
	hasTrigger,
	onClearTrigger,
	onAutomationRulesChange,
	onConnectTrigger,
	onTriggersChange,
	triggers,
}: Readonly<TriggersProps>): ReactElement {
	const derivedAutomationRules = automationRules
		?? (triggers
			? [
					createAgentAutomationRule({
						id: "automation-1",
						name: "Automation",
						triggers,
					}),
				]
			: undefined);
	const isControlled = typeof derivedAutomationRules !== "undefined";
	const [uncontrolledAutomationRules, setUncontrolledAutomationRules] = useState<AgentAutomationRule[]>(() =>
		getInitialAutomationRules({ defaultAutomationRules, defaultTriggers, hasTrigger }),
	);
	const currentAutomationRules = derivedAutomationRules ?? uncontrolledAutomationRules;
	const [automationDialogOpen, setAutomationDialogOpen] = useState(Boolean(defaultPickerOpen));
	const [draftAutomationRule, setDraftAutomationRule] = useState<AgentAutomationRule>(() =>
		currentAutomationRules[0] ?? createEmptyAutomationRule(1),
	);

	const commitAutomationRules = useCallback(
		(nextAutomationRules: readonly AgentAutomationRule[]) => {
			if (!isControlled) {
				setUncontrolledAutomationRules([...nextAutomationRules]);
			}
			onAutomationRulesChange?.(nextAutomationRules);
			onTriggersChange?.(nextAutomationRules.flatMap((rule) => rule.triggers));
		},
		[isControlled, onAutomationRulesChange, onTriggersChange],
	);

	const handleSave = useCallback(
		(nextRule: AgentAutomationRule) => {
			const existingIndex = currentAutomationRules.findIndex((rule) => rule.id === nextRule.id);
			const nextAutomationRules = existingIndex >= 0
				? currentAutomationRules.map((rule, index) => (index === existingIndex ? nextRule : rule))
				: [...currentAutomationRules, nextRule];
			if (nextAutomationRules.length < currentAutomationRules.length) {
				onClearTrigger?.();
			}
			commitAutomationRules(nextAutomationRules);
		},
		[commitAutomationRules, currentAutomationRules, onClearTrigger],
	);
	const openAutomationRule = useCallback((rule: AgentAutomationRule) => {
		setDraftAutomationRule(rule);
		setAutomationDialogOpen(true);
	}, []);
	const openNewAutomationRuleFromEvent = useCallback((providerId: AgentTriggerProviderId, eventId: string) => {
		const nextTrigger = createAgentTriggerValue(providerId, eventId, 1);
		if (!nextTrigger) {
			return;
		}
		setDraftAutomationRule(createAgentAutomationRule({
			id: `automation-${currentAutomationRules.length + 1}`,
			name: "",
			prompt: "",
			triggers: [nextTrigger],
		}));
		setAutomationDialogOpen(true);
	}, [currentAutomationRules.length]);
	const addAutomationPicker = (
		<TriggerPicker
			label={addTriggerLabel}
			onSelectEvent={openNewAutomationRuleFromEvent}
		/>
	);

	const cardChildren: ReactNode =
		currentAutomationRules.length > 0 ? (
			<div className="grid gap-2">
				{currentAutomationRules.map((rule, index) => (
					<div className="overflow-hidden rounded-xl border border-border bg-bg-input" key={rule.id}>
						<button
							className="grid w-full gap-3 p-4 text-left transition-colors duration-normal hover:bg-bg-input-hovered focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-selected"
							onClick={() => openAutomationRule(rule)}
							type="button"
						>
							<div className="flex items-center justify-between gap-3">
								<div className="min-w-0">
									<div className="truncate text-sm font-semibold leading-5 text-text">
										{getAgentAutomationRuleLabel(rule, index)}
									</div>
									<div className="text-sm leading-5 text-text-subtle">
										{rule.triggers.length} event trigger{rule.triggers.length === 1 ? "" : "s"}
									</div>
								</div>
								<span className="text-sm font-medium text-link">Edit</span>
							</div>
							<div className="grid gap-2">
								{rule.triggers.map((trigger) => {
									return (
										<div className="flex min-w-0 items-center gap-2 text-sm text-text" key={trigger.id}>
											<AgentTriggerProviderTileIcon
												fallback={<IconTile
													aria-hidden={true}
													icon={<AutomationIcon label="" size="small" />}
													label="Trigger"
													size="medium"
													variant="blue"
												/>}
												trigger={trigger}
											/>
											<span className="truncate">{getAgentTriggerReadableLabel(trigger)}</span>
										</div>
									);
								})}
							</div>
						</button>
					</div>
				))}
				<div className="rounded-xl border border-border bg-bg-input p-2">
					{addAutomationPicker}
				</div>
			</div>
		) : (
			<div className="rounded-xl border border-border bg-bg-input p-2">
				{addAutomationPicker}
			</div>
		);

	return (
		<div className={cn("grid gap-5", className)}>
			<section className="grid gap-3">{cardChildren}</section>
			<TriggerConfigAutomationDialog
				automationRule={draftAutomationRule}
				onConnectTrigger={onConnectTrigger}
				onOpenChange={setAutomationDialogOpen}
				onSave={handleSave}
				open={automationDialogOpen}
			/>
		</div>
	);
}
