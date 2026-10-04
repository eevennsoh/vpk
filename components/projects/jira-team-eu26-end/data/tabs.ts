import {
	getJiraTabs,
	type TabDefinition,
} from "@/components/projects/jira/data/tabs";

const REMOVED_TAB_LABELS = new Set(["Attachments", "Calendar"]);

export function getJiraTeamEu26EndTabs(): readonly TabDefinition[] {
	return getJiraTabs(false)
		.filter((tab) => !REMOVED_TAB_LABELS.has(tab.label))
		.map((tab) => tab.label === "Pages" ? { ...tab, label: "Docs" } : tab);
}
