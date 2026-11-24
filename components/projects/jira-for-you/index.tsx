"use client";

import { useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";

import { cn } from "@/lib/utils";

export { JiraForYouProjectButter } from "./jira-for-you-project-butter";

import { JIRA_FOR_YOU_SECTIONS, JIRA_FOR_YOU_TABS } from "./data";
import { JiraForYouHeader } from "./jira-for-you-header";
import { JiraForYouSectionGroup } from "./jira-for-you-section";
import type {
	JiraForYouItem,
	JiraForYouSection,
	JiraForYouTab,
} from "./jira-for-you-types";

export interface JiraForYouProps {
	className?: string;
	forcedVisibleViewItemId?: string;
	onItemClick?: (item: JiraForYouItem, event: ReactMouseEvent<HTMLButtonElement>) => void;
	onItemButtonRef?: (item: JiraForYouItem, node: HTMLButtonElement | null) => void;
	onView?: (item: JiraForYouItem, event: ReactMouseEvent<HTMLButtonElement>) => void;
	onViewButtonRef?: (item: JiraForYouItem, node: HTMLButtonElement | null) => void;
	selectedItemId?: string;
	sections?: readonly JiraForYouSection[];
	tabs?: readonly JiraForYouTab[];
}

function filterSections(
	sections: readonly JiraForYouSection[],
	activeTabId: string,
	query: string,
): readonly JiraForYouSection[] {
	const normalizedQuery = query.trim().toLowerCase();
	const matchesTab = (item: JiraForYouItem) =>
		activeTabId === "all" || (item.tabs?.includes(activeTabId) ?? false);
	const matchesQuery = (item: JiraForYouItem) =>
		!normalizedQuery || item.title.toLowerCase().includes(normalizedQuery);

	return sections
		.map((section) => ({
			...section,
			items: section.items.filter(
				(item) => matchesTab(item) && matchesQuery(item),
			),
		}))
		.filter((section) => section.items.length > 0);
}

export function JiraForYou({
	className,
	forcedVisibleViewItemId,
	onItemClick,
	onItemButtonRef,
	onView,
	onViewButtonRef,
	selectedItemId,
	sections = JIRA_FOR_YOU_SECTIONS,
	tabs = JIRA_FOR_YOU_TABS,
}: Readonly<JiraForYouProps>) {
	const [activeTabId, setActiveTabId] = useState(tabs[0]?.id ?? "");
	const [query, setQuery] = useState("");
	const visibleSections = useMemo(
		() => filterSections(sections, activeTabId, query),
		[sections, activeTabId, query],
	);

	return (
		<div className={cn("flex w-full flex-col gap-6", className)}>
			<JiraForYouHeader
				activeTabId={activeTabId}
				onQueryChange={setQuery}
				onTabChange={setActiveTabId}
				query={query}
				tabs={tabs}
			/>
			{visibleSections.length > 0 ? (
				<div className="flex flex-col gap-3">
					{visibleSections.map((section) => (
						<JiraForYouSectionGroup
							forcedVisibleViewItemId={forcedVisibleViewItemId}
							key={section.id}
							onItemButtonRef={onViewButtonRef}
							onItemClick={onItemClick}
							onRowButtonRef={onItemButtonRef}
							onView={onView}
							selectedItemId={selectedItemId}
							section={section}
						/>
					))}
				</div>
			) : (
				<p className="py-8 text-center text-sm text-text-subtlest">
					{query.trim()
						? `No work items match “${query}”.`
						: "No work items in this view."}
				</p>
			)}
		</div>
	);
}

export type {
	JiraForYouAgent,
	JiraForYouIssueType,
	JiraForYouItem,
	JiraForYouSection,
	JiraForYouStatus,
	JiraForYouTab,
} from "./jira-for-you-types";
export type {
	JiraForYouWorkspaceAgentSession,
	JiraForYouWorkspaceData,
	JiraForYouWorkspaceItemData,
	JiraForYouWorkspaceOutput,
} from "./jira-for-you-workspace-types";
export {
	JiraForYouWorkspace,
	type JiraForYouWorkspaceProps,
} from "./jira-for-you-workspace";
