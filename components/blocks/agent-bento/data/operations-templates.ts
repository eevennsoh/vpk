// Minimal "Start with these agent templates" prompt-starter set, sourced from the
// centralized agent-template catalog (`app/data/directory/agent-templates.json`)
// so the bento, the agent-template directory, and agent-directory stay in sync.
import { getAgentTemplateConfigById } from "@/app/data/directory/agent-templates";

export interface AgentBentoOperationsTemplate {
	description: string;
	iconSrc: string;
	title: string;
}

// The five "Operations" starter tiles, by template id (mirrors the review tab).
const OPERATIONS_TEMPLATE_IDS: readonly string[] = [
	"service-triage",
	"service-request-helper",
	"rovo-ops",
	"rovo-expert",
	"user-manual-writer",
];

export const AGENT_BENTO_OPERATIONS_TEMPLATES: ReadonlyArray<AgentBentoOperationsTemplate> =
	OPERATIONS_TEMPLATE_IDS.map((id) => {
		const config = getAgentTemplateConfigById(id);
		if (!config) {
			throw new Error(`Agent bento operations template missing catalog entry: ${id}`);
		}
		return {
			description: config.description,
			iconSrc: config.avatarSrc,
			title: config.name,
		};
	});
