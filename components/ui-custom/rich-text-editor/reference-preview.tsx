"use client";

import type { ReactNode } from "react";

import {
	DEFAULT_KNOWLEDGE_APPS,
	DEFAULT_SKILLS,
	DEMO_SESSION_TOOLS,
	DEMO_TOOLS,
	DIRECTORY_APPS,
	getDirectoryIcon,
	getSkillIcon,
	getSkillIconTileVariant,
	getSkillPublisherName,
	type DirectoryApp,
	type DirectoryVisual,
	type KnowledgeDirectoryApp,
	type KnowledgeDirectoryContent,
	type SkillDirectorySkill,
	type ToolDirectoryTool,
} from "@/app/data/directory";
import { resolveCatalogIds } from "@/app/data/directory/resolve-ids";
import { SmartLinkCard, type SmartLinkItem, type SmartLinkVariant, type SmartLinkVisual } from "@/components/blocks/smart-link";
import { HoverCardContent } from "@/components/ui/hover-card";
import { AtlassianLogoMark, BrandLogoMark } from "@/components/ui/logo-mark";
import { EntityCard } from "@/components/ui-custom/entity-card";

import type { RichTextReferenceCategory } from "./types";

export type RichTextReferencePreview =
	| { kind: "skill"; skill: SkillDirectorySkill }
	| { kind: "tool"; tool: ToolDirectoryTool | DirectoryApp }
	| { kind: "knowledge"; item: SmartLinkItem };

const REFERENCE_PREVIEW_TOOLS = [...DEMO_TOOLS, ...DEMO_SESSION_TOOLS] as readonly ToolDirectoryTool[];

const smartLinkVariantByKnowledgeAppId: Readonly<Record<string, SmartLinkVariant>> = {
	confluence: "confluence",
	jira: "jira",
	loom: "loom",
};

const smartLinkToneByIconColor: Readonly<Record<string, "information" | "discovery" | "magenta" | "warning">> = {
	"text-icon-information": "information",
	"text-icon-brand": "information",
	"text-icon-discovery": "discovery",
	"text-icon-warning": "warning",
	"text-icon-accent-magenta": "magenta",
};

function resolveReferenceCatalogId(
	category: Extract<RichTextReferenceCategory, "app" | "knowledge" | "skill" | "tool">,
	label: string,
): string | undefined {
	return resolveCatalogIds([label], category)[0];
}

function normalizeReferenceLabel(value: string): string {
	return value.trim().toLowerCase();
}

function findReferenceSkill(label: string): SkillDirectorySkill | undefined {
	const skillId = resolveReferenceCatalogId("skill", label);
	return skillId ? DEFAULT_SKILLS.find((skill) => skill.id === skillId) : undefined;
}

function findReferenceTool(label: string): ToolDirectoryTool | undefined {
	const toolId = resolveReferenceCatalogId("tool", label);
	return toolId ? REFERENCE_PREVIEW_TOOLS.find((tool) => tool.id === toolId) : undefined;
}

function findReferenceApp(label: string): DirectoryApp | undefined {
	const normalizedLabel = normalizeReferenceLabel(label);
	const exactMatch = DIRECTORY_APPS.find(
		(app) => normalizeReferenceLabel(app.name) === normalizedLabel || normalizeReferenceLabel(app.id) === normalizedLabel,
	);
	if (exactMatch) {
		return exactMatch;
	}

	const appId = resolveReferenceCatalogId("app", label);
	return appId ? DIRECTORY_APPS.find((app) => app.id === appId) : undefined;
}

function findReferenceKnowledge(
	label: string,
): { app: KnowledgeDirectoryApp; content?: KnowledgeDirectoryContent; id: string } | undefined {
	const knowledgeId = resolveReferenceCatalogId("knowledge", label);
	if (!knowledgeId) {
		return undefined;
	}

	const [appId, contentId = "all"] = knowledgeId.split(":");
	const app = DEFAULT_KNOWLEDGE_APPS.find((candidate) => candidate.id === appId);
	if (!app) {
		return undefined;
	}

	return {
		app,
		content: contentId === "all" ? undefined : app.contents.find((content) => content.id === contentId),
		id: knowledgeId,
	};
}

function directoryVisualToSmartLinkVisual(visual: DirectoryVisual, label: string): SmartLinkVisual {
	switch (visual.kind) {
		case "logo":
			return { kind: "atlassian", name: visual.logoName };
		case "icon":
			return {
				kind: "icon-tile",
				icon: getDirectoryIcon(visual.iconKey),
				tone: visual.iconColor ? smartLinkToneByIconColor[visual.iconColor] : undefined,
			};
		case "third-party":
			return { kind: "third-party", name: visual.name };
		default:
			return { kind: "image", src: visual.src, alt: label };
	}
}

function getSmartLinkVariantForKnowledgeApp(app: KnowledgeDirectoryApp): SmartLinkVariant {
	return smartLinkVariantByKnowledgeAppId[app.id] ?? "generic";
}

function getKnowledgeSmartLink(label: string): SmartLinkItem | undefined {
	const resolved = findReferenceKnowledge(label);
	if (!resolved) {
		return undefined;
	}

	const { app, content, id } = resolved;
	const title = content?.name ?? `${app.name} - all content`;
	const visual = content?.visual ?? app.visual;

	return {
		id: `reference-knowledge-${id.replace(/[^a-z0-9-]+/giu, "-")}`,
		href: `#knowledge-${id}`,
		title,
		variant: getSmartLinkVariantForKnowledgeApp(app),
		provider: {
			name: app.providerName,
			logo: directoryVisualToSmartLinkVisual(app.visual, app.name),
		},
		icon: directoryVisualToSmartLinkVisual(visual, title),
		description: content?.description ?? app.description,
		metadata: [
			{ label: content ? content.type : "All content" },
			{ label: `${app.teammateCount} teammates` },
		],
	};
}

function getKnowledgeAppSmartLink(app: KnowledgeDirectoryApp, id: string): SmartLinkItem {
	const title = `${app.name} - all content`;

	return {
		id: `reference-app-${id.replace(/[^a-z0-9-]+/giu, "-")}`,
		href: `#app-${id}`,
		title,
		variant: getSmartLinkVariantForKnowledgeApp(app),
		provider: {
			name: app.providerName,
			logo: directoryVisualToSmartLinkVisual(app.visual, app.name),
		},
		icon: directoryVisualToSmartLinkVisual(app.visual, title),
		description: app.description,
		metadata: [
			{ label: "All content" },
			{ label: `${app.teammateCount} teammates` },
		],
	};
}

// react-doctor-disable-next-line react-doctor/only-export-components -- This component module intentionally exports colocated non-component API used by consumers.
export function getRichTextReferencePreview(
	category: RichTextReferenceCategory | undefined,
	label: string,
): RichTextReferencePreview | undefined {
	switch (category) {
		case "app": {
			const app = findReferenceApp(label);
			if (!app) {
				return undefined;
			}
			return app.hasToolFacet
				? { kind: "tool", tool: app }
				: app.knowledgeApp
					? { kind: "knowledge", item: getKnowledgeAppSmartLink(app.knowledgeApp, app.id) }
					: undefined;
		}
		case "skill": {
			const skill = findReferenceSkill(label);
			return skill ? { kind: "skill", skill } : undefined;
		}
		case "tool": {
			const tool = findReferenceTool(label);
			return tool ? { kind: "tool", tool } : undefined;
		}
		case "knowledge": {
			const item = getKnowledgeSmartLink(label);
			return item ? { kind: "knowledge", item } : undefined;
		}
		default:
			return undefined;
	}
}

function getReferenceToolLogo(tool: ToolDirectoryTool): ReactNode {
	if (tool.logoName || tool.id === "atlassian") {
		return <AtlassianLogoMark label={tool.name} name={tool.logoName ?? "atlassian"} size="medium" />;
	}

	const src = tool.logoSrc ?? tool.avatarSrc;
	return src ? <BrandLogoMark frame="tile" label={tool.name} size="medium" src={src} /> : null;
}

export function RichTextReferencePreviewContent({ preview }: Readonly<{ preview: RichTextReferencePreview }>) {
	if (preview.kind === "knowledge") {
		return (
			<HoverCardContent
				align="center"
				className="w-80 border-0 bg-transparent p-0 text-text shadow-none"
				side="top"
				sideOffset={8}
			>
				<SmartLinkCard className="w-full" item={preview.item} />
			</HoverCardContent>
		);
	}

	return (
		<HoverCardContent
			align="center"
			// Render the canonical EntityCardShell so the preview is visually
			// identical to a directory card (bg-surface, border, gap, elevation).
			// The popover content itself is a transparent, unstyled wrapper at a
			// fixed directory-card width (w-80) since a floating preview has no
			// grid cell to fill.
			className="w-80 border-0 bg-transparent p-0 text-text shadow-none"
			side="top"
			sideOffset={8}
		>
			{preview.kind === "skill" ? (
				<EntityCard.Shell active className="gap-4">
					<EntityCard.Skill
						description={preview.skill.description}
						icon={getSkillIcon(preview.skill.icon)}
						iconVariant={getSkillIconTileVariant(preview.skill)}
						name={preview.skill.name}
						publisher={getSkillPublisherName(preview.skill)}
						starCount={preview.skill.starCount}
						teammateCount={preview.skill.teammateCount}
						verified={preview.skill.verified}
					/>
				</EntityCard.Shell>
			) : (
				<EntityCard.Shell active className="min-h-[102px] gap-4">
					<EntityCard.Tool
						appLogo={getReferenceToolLogo(preview.tool)}
						description={preview.tool.description}
						name={preview.tool.name}
						teammateCount={preview.tool.teammateCount}
						toolCount={preview.tool.toolCount}
					/>
				</EntityCard.Shell>
			)}
		</HoverCardContent>
	);
}
