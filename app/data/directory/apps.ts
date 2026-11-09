import type { AtlassianLogoName } from "@/components/ui/logo";
import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";

import { DEFAULT_KNOWLEDGE_APPS, type KnowledgeDirectoryApp } from "./knowledge";
import { DEMO_SESSION_TOOLS, DEMO_TOOLS, type ToolDirectoryTool } from "./tools";
import type { DirectoryVisual } from "./types";
import { avatarVisualFromSrc } from "./visual";

/**
 * The "apps" umbrella unifies the two underlying directory verticals — tools
 * (connected actions, with read-only / write-delete permissions) and knowledge
 * (content sources, with all/custom content) — into a single catalog. An app can
 * carry a tool facet, a knowledge facet, or both:
 *
 * - Tools that also have a knowledge entry (e.g. Jira, Confluence) → both facets.
 * - Tools without a knowledge entry (e.g. Slack, Gmail) → tool facet only.
 * - Knowledge-only sources (e.g. Projects, Goals) → knowledge facet only; these
 *   are synthesized into the tool-shaped record so the existing app-directory UI
 *   (keyed on {@link ToolDirectoryTool}) renders them without special casing.
 *
 * The record is a superset of {@link ToolDirectoryTool} so the merged
 * app-directory block consumes it directly; the extra `hasToolFacet` /
 * `hasKnowledgeFacet` / `knowledgeApp` fields drive facet-aware rendering and the
 * `@[app:id]` mention/catalog layer.
 */
export interface DirectoryApp extends ToolDirectoryTool {
	hasToolFacet: boolean;
	hasKnowledgeFacet: boolean;
	knowledgeApp?: KnowledgeDirectoryApp;
}

/**
 * Some apps live in both catalogs under different ids. SharePoint is the only
 * real mismatch today: the tool is `microsoft-sharepoint`, the knowledge app is
 * `sharepoint`. Alias the knowledge id onto the tool id so the two collapse into
 * one app record instead of splitting.
 */
const KNOWLEDGE_ID_ALIASES: Readonly<Record<string, string>> = {
	sharepoint: "microsoft-sharepoint",
};

/**
 * Category assignment for knowledge-only apps so they appear under a sensible
 * directory category rather than only under "All". Tool apps already carry a
 * `categoryId`; knowledge apps do not.
 */
const KNOWLEDGE_ONLY_CATEGORY: Readonly<Record<string, string>> = {
	projects: "project-management",
	goals: "project-management",
	"jira-align": "project-management",
	analytics: "data-and-analytics",
	dx: "data-and-analytics",
	assets: "it-support-and-service",
	"customer-service-management": "it-support-and-service",
	"atlassian-teams": "hr-and-team-building",
	talent: "hr-and-team-building",
};

function canonicalAppId(id: string): string {
	return KNOWLEDGE_ID_ALIASES[id] ?? id;
}

/** Maps a knowledge app's serialized visual onto tool-shaped brand fields. */
function brandFieldsFromVisual(visual: DirectoryVisual): {
	logoName?: AtlassianLogoName;
	avatarSrc?: string;
	brandName?: ThirdPartyLogoName;
} {
	if (visual.kind === "logo") {
		return { logoName: visual.logoName };
	}

	if (visual.kind === "third-party") {
		return { brandName: visual.name };
	}

	if (visual.kind === "image" || visual.kind === "avatar") {
		return { avatarSrc: visual.src };
	}

	// `icon` kind has no brand mark the tool-shaped UI can render; leave it blank.
	return {};
}

function synthesizeKnowledgeOnlyApp(app: KnowledgeDirectoryApp): DirectoryApp {
	return {
		id: app.id,
		name: app.name,
		byline: `Knowledge by ${app.providerName}`,
		attributionKind: "company",
		description: app.description,
		categoryId: KNOWLEDGE_ONLY_CATEGORY[app.id],
		publisherName: app.providerName,
		teammateCount: app.teammateCount,
		toolCount: 0,
		verified: app.verified,
		promptSuggestion: app.promptSuggestion,
		...brandFieldsFromVisual(app.visual),
		hasToolFacet: false,
		hasKnowledgeFacet: true,
		knowledgeApp: app,
	};
}

function buildDirectoryApps(): readonly DirectoryApp[] {
	const tools = [...DEMO_TOOLS, ...DEMO_SESSION_TOOLS];
	const knowledgeByCanonicalId = new Map<string, KnowledgeDirectoryApp>();
	for (const app of DEFAULT_KNOWLEDGE_APPS) {
		knowledgeByCanonicalId.set(canonicalAppId(app.id), app);
	}

	const toolApps: DirectoryApp[] = tools.map((tool) => {
		const knowledgeApp = knowledgeByCanonicalId.get(tool.id);
		return {
			...tool,
			hasToolFacet: true,
			hasKnowledgeFacet: Boolean(knowledgeApp),
			knowledgeApp,
		};
	});

	const toolIds = new Set(tools.map((tool) => tool.id));
	const knowledgeOnlyApps: DirectoryApp[] = DEFAULT_KNOWLEDGE_APPS.filter(
		(app) => !toolIds.has(canonicalAppId(app.id)),
	).map(synthesizeKnowledgeOnlyApp);

	return [...toolApps, ...knowledgeOnlyApps];
}

/** The unified apps catalog (tools ∪ knowledge-only), the source of truth for the Apps directory and `@[app:id]` mentions. */
export const DIRECTORY_APPS: readonly DirectoryApp[] = buildDirectoryApps();

/** Convenience lookup across the unified apps catalog. */
export function getAppById(id: string): DirectoryApp | undefined {
	const canonicalId = canonicalAppId(id);
	return DIRECTORY_APPS.find((app) => app.id === canonicalId);
}

/**
 * Derives the JSON-serializable mention visual for an app: a tool facet's brand
 * mark (logo/avatar) takes precedence; otherwise the knowledge facet's visual.
 */
export function getAppDirectoryVisual(app: DirectoryApp): DirectoryVisual | undefined {
	if (app.logoName || app.avatarSrc || app.brandName) {
		return avatarVisualFromSrc(app.logoName, app.avatarSrc, app.brandName);
	}

	return app.knowledgeApp?.visual;
}
