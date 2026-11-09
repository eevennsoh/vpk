import type { ComponentDetail } from "@/app/data/component-detail-types";

export const JIRA_LOCAL_AGENT_DETAIL: ComponentDetail = {
	description: "A compact code button for local software agents, recent selection, workspace configuration, and copying a work item prompt.",
	importStatement: 'import { JiraLocalAgent } from "@/components/blocks/jira-local-agent";',
	usage: `<JiraLocalAgent workItem={{
  code: "PAY-999",
  summary: "Improve merchant onboarding for Payments SDK v2",
  description: "",
}} />`,
	props: [{ name: "presentation", type: '"submenu" | "inline"', default: '"submenu"', description: "Choose whether Rovo CLI options open beside the menu or expand within it." }],
};
