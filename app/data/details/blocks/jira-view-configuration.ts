import type { ComponentDetail } from "@/app/data/component-detail-types";

export const JIRA_VIEW_CONFIGURATION_DETAIL: ComponentDetail = {
	description: "A Jira board view settings panel for timing, column width, scrolling, and visible fields. The host owns the settings and decides where to place or persist the panel.",
	importStatement: `import { JiraViewConfiguration, DEFAULT_JIRA_VIEW_CONFIGURATION } from "@/components/blocks/jira-view-configuration";`,
	usage: `<JiraViewConfiguration value={settings} onChange={setSettings} onClose={closePanel} />`,
	demoLayout: { previewHeight: "fixed", previewContentWidth: "full" },
	props: [
		{ name: "value", type: "JiraViewConfigurationValue", required: true, description: "Current board view settings, controlled by the host." },
		{ name: "onChange", type: "(value: JiraViewConfigurationValue) => void", required: true, description: "Receives the complete settings after an edit." },
		{ name: "onClose", type: "() => void", required: true, description: "Called when the close action or Escape is used." },
		{ name: "className", type: "string", description: "Optional layout classes for the panel container." },
	],
};
