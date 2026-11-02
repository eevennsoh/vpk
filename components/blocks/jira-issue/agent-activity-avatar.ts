import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";
import { JIRA_CODING_AGENT_GLYPH } from "../../../lib/agent-avatar-visuals.ts";
import type { JiraIssueIconScale } from "./types";

const COMPACT_CHIN_AGENT_BRANDS = new Set<ThirdPartyLogoName>([
	"claude",
	"cursor",
	"openai-codex",
	"github-copilot",
]);

/** Coding agents share Claude's original compact footprint inside the stable 24px chin slot. */
export function getJiraIssueAgentAvatarSize(brandName: ThirdPartyLogoName | undefined, avatarSrc?: string): 20 | 24 {
	return avatarSrc === JIRA_CODING_AGENT_GLYPH || (brandName !== undefined && COMPACT_CHIN_AGENT_BRANDS.has(brandName)) ? 20 : 24;
}

export function getJiraIssueAgentRowInset(iconScale: JiraIssueIconScale): string {
	return iconScale === "comfortable" ? "pr-2 pl-1" : "px-2";
}
