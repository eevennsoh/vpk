import { useMemo, useState } from "react";
import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";
import type { JiraListIssueType, JiraListPerson, JiraListPriority, JiraListRowData } from "./jira-list-types";

export type JiraListGroupVisual =
	| { kind: "assignee"; person: JiraListPerson | null }
	| { kind: "label"; hasValue: boolean }
	| { kind: "epic"; key: string | null; name: string }
	| { kind: "work-type"; issueType: JiraListIssueType }
	| { kind: "subtask" }
	| { kind: "status" }
	| { kind: "priority"; priority: JiraListPriority }
	| { kind: "agent"; avatarSrc?: string; brandName?: ThirdPartyLogoName; vpkLogo?: "rovo"; unassigned?: boolean };

export interface JiraWorkItemGroup {
	id: string;
	label: string;
	visual?: JiraListGroupVisual;
	issueKeys: readonly string[];
	keepChildrenWithParent?: boolean;
}

type GroupableWorkItem = Pick<JiraListRowData, "issueKey" | "parentIssueKey">;

export function groupJiraWorkItems<T extends GroupableWorkItem>(items: readonly T[], groups: readonly JiraWorkItemGroup[]) {
	const groupByIssueKey = new Map(groups.flatMap((group) => group.issueKeys.map((key) => [key, group] as const)));
	const itemsByGroup = new Map<string, T[]>();
	const ungrouped: T[] = [];
	for (const item of items) {
		const parentGroup = item.parentIssueKey ? groupByIssueKey.get(item.parentIssueKey) : undefined;
		const id = (parentGroup?.keepChildrenWithParent ? parentGroup : groupByIssueKey.get(item.issueKey))?.id;
		if (id === undefined) {
			ungrouped.push(item);
			continue;
		}
		const groupItems = itemsByGroup.get(id) ?? [];
		groupItems.push(item);
		itemsByGroup.set(id, groupItems);
	}
	const result = groups.flatMap(({ id, label, visual }) => {
		const groupItems = itemsByGroup.get(id);
		return groupItems ? [{ id, label, visual, items: groupItems }] : [];
	});
	if (ungrouped.length > 0) result.push({ id: "ungrouped", label: "Ungrouped", visual: groups[0]?.visual?.kind === "agent" ? { kind: "agent", unassigned: true } : undefined, items: ungrouped });
	return result;
}

export interface JiraListGroupHeading {
	id: string;
	label: string;
	issueKeys: readonly string[];
	visual?: JiraListGroupVisual;
	count: number;
	collapsed: boolean;
	onToggle: () => void;
}

export function useGroupedJiraRows<T extends GroupableWorkItem>(items: readonly T[], groups?: readonly JiraWorkItemGroup[]) {
	const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
	return useMemo(() => {
		if (!groups) return undefined;
		const visible: T[] = [];
		const before = new Map<string, JiraListGroupHeading[]>();
		let headings: JiraListGroupHeading[] = [];
		for (const group of groupJiraWorkItems(items, groups)) {
			const isCollapsed = collapsed.has(group.id);
			headings.push({
				id: group.id, label: group.label, issueKeys: group.items.map((item) => item.issueKey), visual: group.visual, count: group.items.length, collapsed: isCollapsed,
				onToggle: () => setCollapsed((current) => {
					const next = new Set(current);
					if (!next.delete(group.id)) next.add(group.id);
					return next;
				}),
			});
			if (isCollapsed) continue;
			before.set(group.items[0].issueKey, headings);
			headings = [];
			visible.push(...group.items);
		}
		return { items: visible, before, tail: headings };
	}, [collapsed, groups, items]);
}

export function arrangeListHierarchy<T extends Pick<JiraListRowData, "issueKey" | "parentIssueKey">>(rows: readonly T[], expandedKeys: ReadonlySet<string>) {
	const keys = new Set(rows.map((row) => row.issueKey));
	const children = new Map<string, T[]>();
	for (const row of rows) {
		if (row.parentIssueKey && keys.has(row.parentIssueKey)) {
			const siblings = children.get(row.parentIssueKey) ?? [];
			siblings.push(row);
			children.set(row.parentIssueKey, siblings);
		}
	}
	const result: (T & { indentLevel: number; hasChildren: boolean; isExpanded: boolean })[] = [];
	const visited = new Set<string>();
	const visit = (row: T, depth: number) => {
		if (visited.has(row.issueKey)) return;
		visited.add(row.issueKey);
		const descendants = children.get(row.issueKey) ?? [];
		const expanded = expandedKeys.has(row.issueKey);
		result.push({ ...row, indentLevel: depth, hasChildren: descendants.length > 0, isExpanded: expanded });
		if (expanded) descendants.forEach((child) => visit(child, depth + 1));
	};
	rows.filter((row) => !row.parentIssueKey || !keys.has(row.parentIssueKey)).forEach((row) => visit(row, 0));
	return result;
}

