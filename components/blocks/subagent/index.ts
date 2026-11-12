export { default } from "./page";
export { SubagentNavigator } from "./subagent-navigator";
export { ManageSubagentsDialog } from "./components/manage-subagents-dialog";
export {
	cloneConfig,
	cloneBaseAgent,
	cloneSubagentPrompt,
	createDraftSubagentPrompt,
	getBaseConfigWithSubagents,
	getDerivedSubagentNames,
	getListItems,
	normalizeBaseAgent,
	normalizeSubagentPrompts,
	updateConfigListItem,
} from "./lib/subagent-prompts";

export type { SubagentPrompt, SubagentBaseAgent } from "./data/demo-agents";
