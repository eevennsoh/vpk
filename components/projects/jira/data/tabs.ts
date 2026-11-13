import AttachmentIcon from "@atlaskit/icon/core/attachment";
import BoardIcon from "@atlaskit/icon/core/board";
import CalendarIcon from "@atlaskit/icon/core/calendar";
import FormIcon from "@atlaskit/icon/core/form";
import GlobeIcon from "@atlaskit/icon/core/globe";
import PageIcon from "@atlaskit/icon/core/page";
import TableIcon from "@atlaskit/icon/core/table";
import WorkItemIcon from "@atlaskit/icon/core/work-item";

import { getDefaultDesignVariants } from "@/components/utils/design-variants";

import type { JiraTabSelection, JiraWorkItemView } from "../lib/jira-tab-model";
import { getJiraWorkItemsTabLabel } from "../lib/jira-tab-model";

export type { JiraWorkItemView } from "../lib/jira-tab-model";

export interface TabDefinition extends JiraTabSelection {
	icon: typeof GlobeIcon;
	placeholder?: string;
}

const SUMMARY_TAB: TabDefinition = { label: "Summary", icon: GlobeIcon, hasContent: false };

/** Everything after the work items destination is identical in both catalogs. */
const SUPPORTING_TABS: readonly TabDefinition[] = [
	{ label: "Forms", icon: FormIcon, hasContent: false },
	{ label: "Pages", icon: PageIcon, hasContent: false },
	{ label: "Attachments", icon: AttachmentIcon, hasContent: false },
	{ label: "Calendar", icon: CalendarIcon, hasContent: false },
];

/**
 * Team EU keeps Board and List as sibling destinations, so the tab bar itself
 * is the view switcher. Simple views folds them into one Work items tab and
 * hands the switch to the board header.
 */
const TEAM_EU_TABS: readonly TabDefinition[] = [
	SUMMARY_TAB,
	{ label: "Board", icon: BoardIcon, hasContent: true, view: "board" },
	{ label: "List", icon: TableIcon, hasContent: true, view: "list" },
	...SUPPORTING_TABS,
];

const SIMPLE_VIEWS_TABS: readonly TabDefinition[] = [
	SUMMARY_TAB,
	{ label: "Work items", icon: WorkItemIcon, hasContent: true },
	...SUPPORTING_TABS,
];

export function getJiraTabs(simpleViews = false): readonly TabDefinition[] {
	return simpleViews ? SIMPLE_VIEWS_TABS : TEAM_EU_TABS;
}

/** Baseline tab set, for callers that do not read the design stores. */
export const JIRA_TABS: readonly TabDefinition[] = getJiraTabs(
	getDefaultDesignVariants()["simple-views"],
);

/**
 * Hydration-stable starting label for routes that open on work items. Both
 * server and first client render use the default variant map, matching
 * `useDesignVariants` server snapshots; stored preferences are adopted after
 * mount and `resolveJiraTab` carries the selection over.
 */
export const DEFAULT_JIRA_WORK_ITEMS_TAB_LABEL: string = getJiraWorkItemsTabLabel(JIRA_TABS);

export const DEFAULT_JIRA_WORK_ITEM_VIEW: JiraWorkItemView = "board";
