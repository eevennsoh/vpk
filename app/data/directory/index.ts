/**
 * Barrel for the directory data layer — the single source of truth for every
 * directory vertical (skills, tools, knowledge, people, teams, agents) plus the
 * shared visual contract.
 *
 * Re-exports are explicit (not `export *`) to avoid collisions between verticals
 * that share helper names. In particular several verticals expose a
 * `getXById`-style lookup and category union; those are re-exported under their
 * already-distinct vertical-specific names. Where two verticals would otherwise
 * collide on an identical name, import from the specific loader instead of this
 * barrel.
 */

// --- Shared contract ---
export type {
	DirectoryVisual,
	DirectoryCategory,
	DirectoryIconKey,
	SkillIconKey,
} from "./types";
export { getDirectoryIcon, getSkillIcon, resolveDirectoryVisual } from "./visual";

// --- Skills ---
export {
	DEFAULT_SKILLS,
	getSkillById,
	getSkillCategoryId,
	getSkillCollection,
	getSkillCollectionMetadata,
	getSkillCollectionId,
	getSkillDirectoryVisual,
	getSkillIconColor,
	getSkillIconTileVariant,
	getSkillPublisherAvatarSrc,
	getSkillPublisherLogoName,
	getSkillPublisherName,
	isSkillPublisherPerson,
	slugifySkillName,
	ATLASSIAN_SKILL_COLLECTION_IDS,
	SKILL_COLLECTIONS,
	SKILL_SOURCE_ICON_COLOR,
} from "./skills";
export type {
	SkillCollectionId,
	SkillCollectionMetadata,
	SkillCategory,
	SkillSource,
	SkillDirectoryFileTreeItem,
	SkillDirectorySkill,
	SkillDirectoryToolTag,
} from "./skills";

// --- Tools ---
export {
	DEMO_SESSION_TOOLS,
	DEMO_TOOLS,
	getToolById,
	getToolDirectoryVisual,
} from "./tools";
export type {
	ToolCategory,
	ToolDirectoryPermission,
	ToolDirectoryTool,
} from "./tools";

// --- Knowledge ---
export {
	DEFAULT_KNOWLEDGE_APPS,
	getKnowledgeAppById,
	getKnowledgeAppIcon,
} from "./knowledge";
export type {
	KnowledgeDirectoryApp,
	KnowledgeDirectoryContent,
	KnowledgeDirectoryMode,
} from "./knowledge";

// --- Apps (tools ∪ knowledge umbrella) ---
export { DIRECTORY_APPS, getAppById, getAppDirectoryVisual } from "./apps";
export type { DirectoryApp } from "./apps";

// --- People ---
export {
	AGENT_ROLE_OPTIONS,
	DEFAULT_AGENT_ROLE,
	getPersonDirectoryVisual,
	getRoleOption,
	SAMPLE_AGENT_OWNER,
	SAMPLE_AGENT_PEOPLE,
} from "./people";
export type { AgentPerson, AgentRoleOption, AgentUserRole } from "./people";

// --- Teams ---
export {
	DEMO_TEAMS,
	getTeamById,
	getTeamDirectoryVisual,
} from "./teams";
export type { DirectoryTeam } from "./teams";

// --- Agents ---
export {
	AI_INSIGHTS_AGENT_ID,
	DEMO_AGENT_BROWSER_AGENTS,
	DEMO_AGENT_BROWSER_SIDEBAR_GROUPS,
	DIRECTORY_SUBAGENTS,
	getAgentDirectoryVisual,
	getRovoAgentProfile,
	getRovoAgentPromptContext,
	isRovoAgentProfile,
	ROVO_AGENT_ID,
	ROVO_AGENT_PROFILE_BY_ID,
	ROVO_AGENT_PROFILES,
	ROVO_AGENT_SELECTOR_AGENTS,
	ROVO_CUSTOM_AGENT_SELECTOR_AGENTS,
	ROVO_DIRECTORY_AGENT_PROFILES,
} from "./agents";
export type { RovoAgentProfile } from "./agents";

// --- Agent templates ---
export {
	AGENT_TEMPLATE_CATEGORY_IDS,
	AGENT_TEMPLATE_CONFIGS,
	getAgentTemplateConfigById,
	getAgentTemplateConfigsByCategory,
} from "./agent-templates";
export type { AgentTemplateCategoryId, AgentTemplateConfig } from "./agent-templates";

// --- Trigger bylines ---
export { TRIGGER_BYLINES, getTriggerByline } from "./trigger-bylines";
export type { TriggerBylineMap } from "./trigger-bylines";
