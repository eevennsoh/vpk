"use client";

import { useMemo, useState, type ReactElement } from "react";
import FilterIcon from "@atlaskit/icon/core/filter";

import type { AgentSessionItem } from "@/components/blocks/agent-session";
import { Button } from "@/components/ui/button";
import { dropdownStyles } from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import {
	EMPTY_AGENT_SESSION_COLUMN_FILTER,
	agentSessionFilterToggleTriState,
	collectAgentSessionFilterOwners,
	countAgentSessionColumnFilterSelections,
	shouldKeepAgentSessionFilterMenuOpen,
	toggleFilterId,
	type AgentSessionColumnFilterState,
	type AgentSessionFilterAgentId,
} from "./agent-session-column-filter";
import {
	AgentFilterRow,
	DaysFilterSection,
	FilterSection,
	FilterToggleRow,
	SessionOwnerFilterRow,
} from "./agent-session-column-filter-sections";

function didFilterFocusOutStayInside(event: Event): boolean {
	const relatedTarget = "relatedTarget" in event ? event.relatedTarget : null;
	if (!(relatedTarget instanceof Node)) {
		return true;
	}
	const origin = event.target instanceof Element ? event.target : null;
	return origin?.closest("[data-slot='popover-content']")?.contains(relatedTarget) ?? false;
}

export interface AgentSessionColumnFilterMenuProps {
	filter: AgentSessionColumnFilterState;
	items: readonly AgentSessionItem[];
	onFilterChange: (filter: AgentSessionColumnFilterState) => void;
	size: "icon" | "icon-compact";
}

export function AgentSessionColumnFilterMenu({
	filter,
	items,
	onFilterChange,
	size,
}: Readonly<AgentSessionColumnFilterMenuProps>): ReactElement {
	const [open, setOpen] = useState(false);
	const [customCalendarOpen, setCustomCalendarOpen] = useState(false);
	const owners = useMemo(() => collectAgentSessionFilterOwners(items), [items]);
	const selectedCount = countAgentSessionColumnFilterSelections(filter);
	const hasSelection = selectedCount > 0;
	const selectedOwnerIds = useMemo(() => new Set(filter.ownerIds), [filter.ownerIds]);
	const selectedAgentIds = useMemo(() => new Set(filter.agentIds), [filter.agentIds]);
	const filterLabel = hasSelection
		? `Filter sessions, ${selectedCount} selected`
		: "Filter sessions";

	return (
		<Popover
			onOpenChange={(nextOpen, eventDetails) => {
				if (
					shouldKeepAgentSessionFilterMenuOpen({
						customCalendarOpen,
						focusOutStayedInside: didFilterFocusOutStayInside(eventDetails.event),
						nextOpen,
						reason: eventDetails.reason,
					})
				) {
					eventDetails.cancel();
					return;
				}
				setOpen(nextOpen);
				if (!nextOpen) {
					setCustomCalendarOpen(false);
				}
			}}
			open={open}
		>
			<PopoverTrigger
				render={
					<Button
						aria-expanded={open}
						aria-label={filterLabel}
						aria-pressed={hasSelection || open}
						data-agent-session-column-filter=""
						size={size}
						type="button"
						variant="ghost"
					/>
				}
			>
				<Icon className="text-icon-subtle" render={<FilterIcon label="" />} />
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className={cn("w-max min-w-[min(20rem,calc(100vw-32px))] max-w-[calc(100vw-32px)] gap-0", dropdownStyles.surface, dropdownStyles.padding)}
			>
				<PopoverTitle className="sr-only">Filter sessions</PopoverTitle>
				<div className="flex flex-col">
					<FilterSection title="Session owner">
						<SessionOwnerFilterRow
							onToggle={(ownerId) => {
								onFilterChange({
									...filter,
									ownerIds: toggleFilterId(filter.ownerIds, ownerId),
								});
							}}
							owners={owners}
							selectedOwnerIds={selectedOwnerIds}
						/>
					</FilterSection>
					<FilterSection title="Agents">
						<AgentFilterRow
							onToggle={(agentId: AgentSessionFilterAgentId) => {
								onFilterChange({
									...filter,
									agentIds: toggleFilterId(filter.agentIds, agentId),
								});
							}}
							selectedAgentIds={selectedAgentIds}
						/>
					</FilterSection>
					<DaysFilterSection
						days={filter.days}
						onCalendarOpenChange={setCustomCalendarOpen}
						onChange={(days) => {
							onFilterChange({ ...filter, days });
						}}
					/>
					<div className="flex flex-col">
						<div aria-hidden="true" className={dropdownStyles.separator} />
						<FilterToggleRow
							checked={filter.containsArtifacts === "yes"}
							label="Contains artifacts"
							onToggle={() => {
								onFilterChange({
									...filter,
									containsArtifacts: agentSessionFilterToggleTriState(
										filter.containsArtifacts !== "yes",
									),
								});
							}}
						/>
						<FilterToggleRow
							checked={filter.hasLinkSuggestion === "yes"}
							label="Link suggestions"
							onToggle={() => {
								onFilterChange({
									...filter,
									hasLinkSuggestion: agentSessionFilterToggleTriState(
										filter.hasLinkSuggestion !== "yes",
									),
								});
							}}
						/>
						{hasSelection ? (
							<>
								<div aria-hidden="true" className={dropdownStyles.separator} />
								<button
									className="relative flex h-8 w-full cursor-pointer items-center rounded-lg px-2 text-sm leading-5 text-text outline-none select-none hover:bg-bg-neutral-subtle-hovered active:bg-bg-neutral-subtle-pressed focus-visible:ring-3 focus-visible:ring-ring/50"
								onClick={() => {
									setCustomCalendarOpen(false);
									onFilterChange(EMPTY_AGENT_SESSION_COLUMN_FILTER);
								}}
									type="button"
								>
									Clear selection
								</button>
							</>
						) : null}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
