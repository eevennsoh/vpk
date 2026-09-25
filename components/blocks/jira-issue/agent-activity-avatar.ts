import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";

/** The filled Claude canvas needs a compact footprint inside the stable 24px chin slot. */
export function getJiraIssueAgentAvatarSize(brandName: ThirdPartyLogoName | undefined): 20 | 24 {
	return brandName === "claude" ? 20 : 24;
}
