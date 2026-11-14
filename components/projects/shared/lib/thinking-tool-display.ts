import {
	isRequestUserInputToolName,
	type ThinkingToolCallSummary,
} from "@/lib/rovo-ui-messages";
import {
	getQuestionsAnsweredLabel,
} from "@/components/ui-custom/lib/reasoning-labels";
import { getToolDisplayInfo } from "@/components/projects/shared/lib/tool-icon-resolver";

const TOOL_ACTION_LABELS = new Map<string, string>([
	["ask-user-questions", "Asking questions"],
	["create-technical-plan", "Planning work"],
	["exit-plan-mode", "Finishing plan"],
	["update-todo", "Updating steps"],
	["invoke-subagents", "Coordinating agents"],
	["get-skill", "Applying skills"],
	["open-files", "Reading files"],
	["expand-code-chunks", "Reading code"],
	["grep", "Searching code"],
	["expand-folder", "Reading folder"],
	["create-file", "Creating file"],
	["copy-to-clipboard", "Copying result"],
	["move-file", "Moving file"],
	["find-and-replace-code", "Editing code"],
	["delete-file", "Deleting file"],
	["bash", "Running command"],
	["powershell", "Running command"],
	["parallel", "Running tools"],
	["jira-read", "Reading work item"],
	["jira-scan-attachments", "Scanning attachments"],
	["jira-scan", "Scanning attachments"],
	["jira-inspect-board-column", "Inspecting workflow"],
	["teamwork-graph-search", "Searching Teamwork Graph"],
	["teamwork-graph-link-knowledge", "Linking Teamwork Graph knowledge"],
	["rfp-map", "Mapping requirements"],
	["rfp-map-requirements", "Mapping requirements"],
	["rfp-check", "Checking open work"],
	["rfp-check-unfinished-work", "Checking open work"],
	["rfp-apply", "Applying your answers"],
	["rfp-apply-qualification-answers", "Applying your answers"],
	["rfp-build", "Building bid recommendation"],
	["rfp-build-bid-recommendation", "Building bid recommendation"],
	["rfp-flag", "Flagging review gates"],
	["rfp-flag-reviews", "Flagging review gates"],
	["agent-skill", "Loading skill"],
	["agent-skill-load", "Loading skill"],
	["agent-define", "Defining agent"],
	["agent-define-trigger", "Defining agent trigger"],
	["agent-configure", "Configuring agent tools"],
	["agent-configure-tools", "Configuring agent tools"],
	["agent-write", "Writing agent instructions"],
	["agent-write-instructions", "Writing agent instructions"],
	["agent-define-rerun-policy", "Setting rerun policy"],
	["agent-persist", "Creating agent"],
	["agent-persist-definition", "Creating agent"],
	["vpk-html-distill", "Distilling report fields"],
	["vpk-html-distill-fields", "Distilling report fields"],
	["vpk-html-render", "Rendering HTML report"],
	["vpk-html-render-template", "Rendering HTML report"],
	["vpk-html-validate", "Validating artifact"],
	["vpk-html-validate-artifact", "Validating artifact"],
	["generate-pdf-distill", "Distilling report fields"],
	["generate-pdf-distill-fields", "Distilling report fields"],
	["generate-pdf-render", "Rendering PDF report"],
	["generate-pdf-render-document", "Rendering PDF report"],
	["generate-pdf-validate", "Validating artifact"],
	["generate-pdf-validate-artifact", "Validating artifact"],
	["system-tool-call", "Running tool"],
	["system-encrypt", "Running tool"],
]);

function getNonEmptyString(value: unknown): string | null {
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeToolActionKey(value: string): string {
	return value.trim().toLowerCase().replace(/[._:\/\s]+/g, "-").replace(/-+/g, "-");
}

function formatToolDisplayName(value: string): string {
	return value.replace(/[._:-]+/g, " ").replace(/\s+/g, " ").trim();
}

function toToolText(value: string): string {
	const text = formatToolDisplayName(value).toLowerCase();
	return text ? text[0]!.toUpperCase() + text.slice(1) : "Tool";
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function getInputRecords(input: unknown): Record<string, unknown>[] {
	const root = asRecord(input);
	if (!root) {
		return [];
	}

	const records = [root];
	for (const key of ["arguments", "args", "input", "params", "parameters"]) {
		const nested = asRecord(root[key]);
		if (nested && !records.includes(nested)) {
			records.push(nested);
		}
	}
	return records;
}

function getInputString(input: unknown, keys: readonly string[]): string | null {
	for (const record of getInputRecords(input)) {
		for (const key of keys) {
			const value = getNonEmptyString(record[key]);
			if (value) {
				return value;
			}
		}
	}
	return null;
}

function clipToolDetail(value: string): string {
	const text = value.replace(/\s+/g, " ").trim();
	return text.length > 140 ? `${text.slice(0, 137).trimEnd()}...` : text;
}

function getDisplaySkillName(skillName: string): string {
	return normalizeToolActionKey(skillName) === "vpk-html" ? "generate-pdf" : skillName;
}

function isSkillLoadTool(displayName: string): boolean {
	const normalizedDisplayName = displayName.toLowerCase();
	return normalizedDisplayName === "get skill" || normalizedDisplayName.includes("skill");
}

function addToolActionKeyCandidate(candidates: Set<string>, value: string | null | undefined) {
	const rawValue = value?.trim();
	if (!rawValue) {
		return;
	}

	const normalized = normalizeToolActionKey(rawValue);
	if (!normalized) {
		return;
	}

	candidates.add(normalized);

	const parts = normalized.split("-").filter(Boolean);
	if (parts.length >= 2) {
		candidates.add(parts.slice(0, 2).join("-"));
	}
}

function getLabelFallbackSource(label: string | undefined): string | null {
	const nonEmptyLabel = getNonEmptyString(label);
	if (!nonEmptyLabel) {
		return null;
	}

	const usingMatch = /^using\s+(.+)$/iu.exec(nonEmptyLabel);
	return usingMatch ? usingMatch[1]!.trim() : null;
}

function getToolActionKeyCandidates(
	toolCall: ThinkingToolCallSummary,
	displayInfo: ReturnType<typeof getToolDisplayInfo>,
): string[] {
	const candidates = new Set<string>();

	addToolActionKeyCandidate(candidates, displayInfo.displayName);
	addToolActionKeyCandidate(candidates, toolCall.toolName);
	addToolActionKeyCandidate(candidates, getLabelFallbackSource(toolCall.label));

	return [...candidates];
}

function findToolActionLabel(candidates: readonly string[]): string | null {
	for (const candidate of candidates) {
		const label = TOOL_ACTION_LABELS.get(candidate);
		if (label) {
			return label;
		}
	}

	return null;
}

function hasToolActionKey(candidates: readonly string[], ...keys: string[]): boolean {
	return keys.some((key) => candidates.includes(key));
}

function hasToolActionNamespace(candidates: readonly string[], namespace: string): boolean {
	return candidates.some((candidate) => candidate === namespace || candidate.startsWith(`${namespace}-`));
}

function isPersistedFallbackLabel(label: string | undefined): boolean {
	return getLabelFallbackSource(label) !== null;
}

export function getThinkingToolDisplayName(toolCall: ThinkingToolCallSummary): string {
	const displayInfo = getToolDisplayInfo(toolCall.toolName, toolCall.input, toolCall.mcpServer);
	const displayName = getNonEmptyString(displayInfo.displayName) ?? toolCall.toolName;

	return formatToolDisplayName(displayName);
}

function getJiraReadWorkItemLabel(toolCall: ThinkingToolCallSummary): string {
	const workItemKey = getInputString(toolCall.input, ["key", "issueKey", "issue_key", "workItemKey", "work_item_key"]);
	return workItemKey ? `Reading ${clipToolDetail(workItemKey)}` : "Reading work item";
}

export function getToolActionLabel(toolCall: ThinkingToolCallSummary): string {
	const displayInfo = getToolDisplayInfo(toolCall.toolName, toolCall.input, toolCall.mcpServer);
	const displayName = getThinkingToolDisplayName(toolCall);
	const normalizedDisplayName = displayName.toLowerCase();
	const actionKeyCandidates = getToolActionKeyCandidates(toolCall, displayInfo);
	const server = displayInfo.server;
	const skillName = getInputString(toolCall.input, ["skill", "skillName", "skill_name", "name"]);

	if (toolCall.state === "completed" && isRequestUserInputToolName(toolCall.toolName)) {
		return getQuestionsAnsweredLabel();
	}
	if (toolCall.state === "awaiting-input") {
		return "Needs input";
	}
	if (toolCall.state === "approval-requested") {
		return "Awaiting approval";
	}
	if (toolCall.state === "error") {
		return "Could not complete step";
	}
	if (hasToolActionKey(actionKeyCandidates, "jira-read", "jira-read-work-item")) {
		return getJiraReadWorkItemLabel(toolCall);
	}
	if (skillName && isSkillLoadTool(displayName)) {
		return `Using ${clipToolDetail(getDisplaySkillName(skillName))} skill`;
	}

	const explicitActionLabel = findToolActionLabel(actionKeyCandidates);
	if (explicitActionLabel) {
		return explicitActionLabel;
	}
	if (server === "forge-knowledge") {
		return "Searching Forge knowledge";
	}
	if (server === "remote-bitbucket-search") {
		return "Searching Bitbucket";
	}
	if (server === "ads-mcp") {
		return "Checking ADS";
	}
	if (server === "chrome-devtools") {
		return "Inspecting browser";
	}
	if (
		server === "web-search" ||
		hasToolActionKey(actionKeyCandidates, "web-search", "search-web") ||
		normalizedDisplayName.includes("search")
	) {
		return "Searching the web";
	}
	if (normalizedDisplayName === "rg" || normalizedDisplayName.includes("grep")) {
		return "Searching code";
	}
	if (normalizedDisplayName === "get skill" || normalizedDisplayName.includes("skill")) {
		return "Applying skills";
	}
	if (normalizedDisplayName === "bash" || normalizedDisplayName === "powershell" || normalizedDisplayName.includes("terminal")) {
		return "Running command";
	}
	if (normalizedDisplayName.includes("todo")) {
		return "Updating steps";
	}
	if (normalizedDisplayName.includes("agent")) {
		return "Coordinating agents";
	}
	if (hasToolActionNamespace(actionKeyCandidates, "jira")) {
		return "Checking Jira";
	}
	if (hasToolActionNamespace(actionKeyCandidates, "rfp")) {
		return "Checking RFP";
	}
	if (hasToolActionNamespace(actionKeyCandidates, "system")) {
		return "Running tool";
	}
	if (normalizedDisplayName.includes("file") || normalizedDisplayName.includes("folder") || normalizedDisplayName.includes("grep")) {
		return normalizedDisplayName.includes("create") || normalizedDisplayName.includes("replace") || normalizedDisplayName.includes("delete") || normalizedDisplayName.includes("move")
			? "Editing files"
			: "Reading files";
	}
	if (normalizedDisplayName.startsWith("create") || normalizedDisplayName.startsWith("generate")) {
		return toToolText(displayName);
	}
	if (normalizedDisplayName.startsWith("update")) {
		return toToolText(displayName);
	}
	if (normalizedDisplayName.startsWith("run")) {
		return toToolText(displayName);
	}
	return "Running tool";
}

export function getThinkingToolTitle(toolCall: ThinkingToolCallSummary): string {
	const skillName = getInputString(toolCall.input, ["skill", "skillName", "skill_name", "name"]);
	if (skillName && isSkillLoadTool(getThinkingToolDisplayName(toolCall))) {
		return getToolActionLabel(toolCall);
	}

	const label = getNonEmptyString(toolCall.label);
	if (label && !isPersistedFallbackLabel(label)) {
		return label;
	}

	return getToolActionLabel(toolCall);
}

export function getToolInputDetail(toolCall: ThinkingToolCallSummary): string | null {
	const displayInfo = getToolDisplayInfo(toolCall.toolName, toolCall.input, toolCall.mcpServer);
	const displayName = getThinkingToolDisplayName(toolCall);
	const normalizedDisplayName = displayName.toLowerCase();
	const searchQuery = getInputString(toolCall.input, ["query", "q", "search", "searchQuery", "search_query", "terms", "text"]);
	if (
		searchQuery &&
		(
			displayInfo.server === "web-search" ||
			normalizedDisplayName === "rg" ||
			normalizedDisplayName.includes("grep") ||
			normalizedDisplayName.includes("search")
		)
	) {
		return `Searching ${clipToolDetail(searchQuery)}`;
	}

	const skillName = getInputString(toolCall.input, ["skill", "skillName", "skill_name", "name"]);
	const skillReason = getInputString(toolCall.input, ["reason", "purpose", "description"]);
	if (skillName && isSkillLoadTool(displayName)) {
		const displaySkillName = getDisplaySkillName(skillName);
		return skillReason
			? `Using ${clipToolDetail(displaySkillName)} to ${clipToolDetail(skillReason)}`
			: `Using ${clipToolDetail(displaySkillName)}`;
	}

	const command = getInputString(toolCall.input, ["command", "cmd", "script"]);
	if (command) {
		return `Running ${clipToolDetail(command)}`;
	}

	const path = getInputString(toolCall.input, ["path", "file", "filename", "filepath", "directory", "cwd"]);
	if (path) {
		return `Inspecting ${clipToolDetail(path)}`;
	}

	const url = getInputString(toolCall.input, ["url", "href", "link"]);
	if (url) {
		return `Opening ${clipToolDetail(url)}`;
	}

	const prompt = getInputString(toolCall.input, ["prompt", "message", "question", "instructions"]);
	if (prompt) {
		return clipToolDetail(prompt);
	}

	return null;
}

export function getThinkingToolByline(
	toolCall: ThinkingToolCallSummary,
	narration?: readonly string[],
): string {
	const latestNarration = (() => {
		if (!narration) {
			return null;
		}
		for (let index = narration.length - 1; index >= 0; index -= 1) {
			const text = getNonEmptyString(narration[index]);
			if (text) {
				return text;
			}
		}
		return null;
	})();
	if (latestNarration) {
		return clipToolDetail(latestNarration);
	}

	const inputDetail = getToolInputDetail(toolCall);
	if (inputDetail) {
		return inputDetail;
	}
	if (toolCall.state === "completed") {
		return "Complete";
	}
	if (toolCall.state === "error") {
		return toolCall.errorText ?? "Tool returned an error";
	}
	if (toolCall.state === "awaiting-input") {
		return "Waiting for your response";
	}
	if (toolCall.state === "approval-requested") {
		return "Review this step before it runs";
	}
	return "Working on this step";
}
