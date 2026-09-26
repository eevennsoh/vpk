import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";

const COMPACT_CHIN_AGENT_BRANDS = new Set<ThirdPartyLogoName>([
	"claude",
	"cursor",
	"openai-codex",
	"github-copilot",
]);

/** Coding agents share Claude's original compact footprint inside the stable 24px chin slot. */
export function getJiraIssueAgentAvatarSize(brandName: ThirdPartyLogoName | undefined): 20 | 24 {
	return brandName !== undefined && COMPACT_CHIN_AGENT_BRANDS.has(brandName) ? 20 : 24;
}
