"use client";

import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";

import type { JiraActivityFilter, JiraActivitySortOrder } from "./jira-activity-types";

// The sort control reads as newest/oldest to the user; the underlying order is
// still ascending (oldest first) / descending (newest first).
// Trigger keeps a short "Show …" form; menu items drop "Show"/"first"/"only".
const SORT_TRIGGER_LABELS: Record<JiraActivitySortOrder, string> = {
	ascending: "Show oldest",
	descending: "Show latest",
};

const SORT_MENU_LABELS: Record<JiraActivitySortOrder, string> = {
	ascending: "Oldest",
	descending: "Latest",
};

/** Standard work-item Activity filters. */
const JIRA_ACTIVITY_FILTER_VALUES = [
	"agents-only",
	"needs-input",
	"comments-only",
] as const satisfies readonly Exclude<JiraActivityFilter, "all">[];

/** Insight-aware work-item filters used only by consumers that supply insight rows. */
const JIRA_ACTIVITY_INSIGHTS_FILTER_VALUES = [
	...JIRA_ACTIVITY_FILTER_VALUES,
	"insights-only",
] as const satisfies readonly Exclude<JiraActivityFilter, "all">[];

/** SCM PR Activity filters — Comments only (All via Latest/Oldest selection). */
const PULL_REQUEST_ACTIVITY_FILTER_VALUES = [
	"comments-only",
] as const satisfies readonly Exclude<JiraActivityFilter, "all">[];

const FILTER_TRIGGER_LABELS: Record<Exclude<JiraActivityFilter, "all">, string> = {
	"agents-only": "Show agents",
	"needs-input": "Show needs input",
	"comments-only": "Show comments",
	"history-only": "Show history",
	"insights-only": "Show insights",
};

const FILTER_MENU_LABELS: Record<Exclude<JiraActivityFilter, "all">, string> = {
	"agents-only": "Agents",
	"needs-input": "Needs input",
	"comments-only": "Comments",
	"history-only": "History",
	"insights-only": "Insights",
};

export type JiraActivityViewFilterMode = "jira" | "jira-insights" | "pull-request" | "sort-only";

function filterValuesForMode(
	mode: JiraActivityViewFilterMode,
): readonly Exclude<JiraActivityFilter, "all">[] {
	switch (mode) {
		case "jira":
			return JIRA_ACTIVITY_FILTER_VALUES;
		case "jira-insights":
			return JIRA_ACTIVITY_INSIGHTS_FILTER_VALUES;
		case "pull-request":
			return PULL_REQUEST_ACTIVITY_FILTER_VALUES;
		case "sort-only":
			return [];
		default: {
			const _exhaustive: never = mode;
			return _exhaustive;
		}
	}
}

function isListedActivityFilter(
	value: string,
	listed: readonly Exclude<JiraActivityFilter, "all">[],
): value is Exclude<JiraActivityFilter, "all"> {
	return (listed as readonly string[]).includes(value);
}

const ACTIVITY_SORT_TRIGGER_REVEAL_CLASS =
	"pointer-events-none opacity-0 transition-opacity duration-normal ease-out group-hover/activity:pointer-events-auto group-hover/activity:opacity-100 group-has-[:focus-visible]/activity:pointer-events-auto group-has-[:focus-visible]/activity:opacity-100 aria-expanded:pointer-events-auto aria-expanded:opacity-100 motion-reduce:transition-none";

const TEXT_LINK_TRIGGER_CLASS =
	`h-auto gap-1 border-0 bg-transparent px-0 text-xs font-normal text-text-subtlest [&_svg]:text-icon-subtlest hover:bg-transparent hover:text-text-subtlest hover:underline focus-visible:ring-0 aria-expanded:bg-transparent aria-expanded:text-text-subtlest aria-expanded:underline ${ACTIVITY_SORT_TRIGGER_REVEAL_CLASS}`;

/**
 * Inset ghost chevron for panel segments. `my-1 me-1` keeps the 4px shell
 * inset on top/right/bottom of a size-6 control in the h-8 segment; start
 * margin is omitted so the segment's `gap-1.5` alone is the 6px label→icon gap.
 *
 * No `aria-pressed` on the chevron — the segment shell owns selected chrome.
 * Menu-open uses Button's default `aria-expanded` selected border/fill.
 */
// Ring killed — segment shell recolors its existing border on chevron focus.
const CHEVRON_TRIGGER_CLASS =
	"my-1 me-1 shrink-0 border-transparent shadow-none focus-visible:border-transparent focus-visible:ring-0! focus-visible:ring-offset-0!";

function stopTriggerPropagation(event: { stopPropagation(): void }): void {
	event.stopPropagation();
}

/**
 * Dropdown that chooses timeline order or an activity filter.
 * Extracted so rail consumers can relocate it beside a Details/Activity toggle.
 *
 * Prefer `filterMode`:
 * - `jira` — Latest / Oldest + Agents / Needs input / Comments
 * - `jira-insights` — Jira filters + Insights for consumers that supply insight rows
 * - `pull-request` — Latest / Oldest + Comments (SCM Activity)
 * - `sort-only` — Latest / Oldest only
 *
 * `showAgentsOption={false}` remains as a legacy alias for `sort-only`.
 *
 * `trigger="label"` is the text-link chrome used in headers; `trigger="chevron"`
 * is the inset ghost icon control for segmented toggle groups (label click
 * selects the panel; chevron opens this menu and shows selected chrome via
 * `aria-expanded` while open).
 */
export function JiraActivityViewControl({
	sortOrder,
	onSortOrderChange,
	filter,
	onFilterChange,
	menuAlign = "start",
	showAgentsOption = true,
	filterMode: controlledFilterMode,
	trigger = "label",
	onOpenChange,
}: Readonly<{
	sortOrder: JiraActivitySortOrder;
	onSortOrderChange: (next: JiraActivitySortOrder) => void;
	filter: JiraActivityFilter;
	onFilterChange: (next: JiraActivityFilter) => void;
	/** Menu alignment relative to the trigger. Prefer `end` when the control sits on the far right. */
	menuAlign?: "start" | "end";
	/**
	 * @deprecated Prefer `filterMode`. When `filterMode` is omitted, `false`
	 * maps to `sort-only` and `true` maps to `jira`.
	 */
	showAgentsOption?: boolean;
	/**
	 * Which filter items appear under Latest/Oldest.
	 * Pull-request Activity uses `pull-request` (Comments only).
	 */
	filterMode?: JiraActivityViewFilterMode;
	/** `label` = text-link trigger; `chevron` = inset ghost icon in a panel segment. */
	trigger?: "label" | "chevron";
	/**
	 * @deprecated Segment shell owns selected chrome; chevron selected look is
	 * `aria-expanded` while the sort menu is open. Accepted and ignored.
	 */
	pressed?: boolean;
	onOpenChange?: (open: boolean) => void;
}>) {
	const filterMode = controlledFilterMode
		?? (showAgentsOption ? "jira" : "sort-only");
	const listedFilters = filterValuesForMode(filterMode);
	const filtersEnabled = listedFilters.length > 0;
	const filterActive =
		filtersEnabled && filter !== "all" && isListedActivityFilter(filter, listedFilters);
	const activeLabel = filterActive
		? FILTER_TRIGGER_LABELS[filter]
		: SORT_TRIGGER_LABELS[sortOrder];
	const isChevron = trigger === "chevron";
	const chevronLabel = filtersEnabled
		? `Sort and filter activities (${activeLabel})`
		: `Sort pull request activity (${activeLabel})`;
	const triggerButton = isChevron ? (
		<Button
			aria-label={chevronLabel}
			className={CHEVRON_TRIGGER_CLASS}
			data-jira-work-item-metadata-rail-sort-trigger="activity"
			size="icon-compact"
			type="button"
			variant="ghost"
			onClick={stopTriggerPropagation}
			onPointerDown={stopTriggerPropagation}
		/>
	) : (
		<Button
			className={TEXT_LINK_TRIGGER_CLASS}
			size="compact"
			type="button"
			variant="ghost"
		/>
	);

	return (
		<DropdownMenu onOpenChange={onOpenChange}>
			<DropdownMenuTrigger render={triggerButton}>
				{isChevron ? null : activeLabel}
				<Icon aria-hidden render={<ChevronDownIcon label="" />} />
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align={menuAlign}
				className="w-auto min-w-0"
				positionerClassName="z-[502]"
			>
				<DropdownMenuRadioGroup
					onValueChange={(value) => {
						if (filtersEnabled && isListedActivityFilter(value, listedFilters)) {
							onFilterChange(value);
							return;
						}
						if (filtersEnabled) {
							onFilterChange("all");
						}
						onSortOrderChange(value as JiraActivitySortOrder);
					}}
					value={filterActive ? filter : sortOrder}
				>
					<DropdownMenuRadioItem value="descending">
						{SORT_MENU_LABELS.descending}
					</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="ascending">
						{SORT_MENU_LABELS.ascending}
					</DropdownMenuRadioItem>
					{filtersEnabled
						? listedFilters.map((value) => (
							<DropdownMenuRadioItem key={value} value={value}>
								{FILTER_MENU_LABELS[value]}
							</DropdownMenuRadioItem>
						))
						: null}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/**
 * Feed header with an activity count and a text-link sort control.
 */
export function JiraActivityHeader({
	count,
	sortOrder,
	onSortOrderChange,
	filter,
	onFilterChange,
	showCount = true,
}: Readonly<{
	count: number;
	sortOrder: JiraActivitySortOrder;
	onSortOrderChange: (next: JiraActivitySortOrder) => void;
	filter: JiraActivityFilter;
	onFilterChange: (next: JiraActivityFilter) => void;
	/** When false, only the view/sort control is rendered (rail relocates the count). */
	showCount?: boolean;
}>) {
	return (
		<div className="flex w-full min-w-0 items-center justify-between gap-2">
			{showCount ? (
				<span className="min-w-0 truncate text-xs font-semibold text-text-subtlest">
					{count} {count === 1 ? "Activity" : "Activities"}
				</span>
			) : null}
			<JiraActivityViewControl
				filter={filter}
				menuAlign="end"
				onFilterChange={onFilterChange}
				onSortOrderChange={onSortOrderChange}
				sortOrder={sortOrder}
			/>
		</div>
	);
}
