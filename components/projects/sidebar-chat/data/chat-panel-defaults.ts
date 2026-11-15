import type { ChatPanelAgentVersionOption } from "../lib/chat-panel-types";

export const DEFAULT_AGENT_VERSION_OPTIONS: readonly ChatPanelAgentVersionOption[] = [
	{ id: "draft", label: "Draft", variant: "neutral" },
	{ id: "version-2", label: "V2", variant: "success", sectionBreakBefore: true, isCurrent: true },
	{ id: "version-1", label: "V1", variant: "success" },
];
