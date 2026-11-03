// Loaded directly by node:test suites: keep value imports relative (`./x.ts`); `@/` is fine for types only.
import type { ProjectButterAttachment, ProjectButterAttachmentObjectType } from "@/components/blocks/jira-work-item/project-butter/attachment-data";
import { deriveDisplayName, parseWeblink, type AttachmentStamp } from "./attachment-model.ts";

/*
 * Inline attachment add for Project Butter: create, search or paste (reference useInlineAttachmentAdd).
 * Deliberately NOT built, matching the reference Butter path: the GA Add-attachment popup (Upload files /
 * Add link / Create new tabs), SimilarAttachmentSuggestions, the smart-link hover card, the "Create product
 * requirements" cross-flow and real server upload. The all-empty "Add attachment" button opens this composer,
 * and uploads are local File objects with object-URL previews dropped onto the left column.
 */

interface CatalogItem {
	label: string;
	type: ProjectButterAttachmentObjectType | "video";
	provider?: "loom";
}

export const ATTACHMENT_RECENT_ITEMS: readonly CatalogItem[] = [
	{ label: "Q1 Marketing Strategy & Goals", type: "page" },
	{ label: "Brand Campaign Brief 2026", type: "livedoc" },
	{ label: "Product Launch Checklist", type: "page" },
	{ label: "Design System Overview", type: "whiteboard" },
	{ label: "Feature Walkthrough - New UI", type: "video", provider: "loom" },
];

export const ATTACHMENT_SEARCH_ITEMS: readonly CatalogItem[] = [
	{ label: "Engineering Roadmap 2026", type: "page" },
	{ label: "UX Research Findings", type: "livedoc" },
	{ label: "Competitor Analysis", type: "database" },
	{ label: "Team Retrospective Notes", type: "page" },
];

const CATALOG = [...ATTACHMENT_RECENT_ITEMS, ...ATTACHMENT_SEARCH_ITEMS];
const MAX_MATCHES = 6;

export type AttachmentComposerChoice =
	| { id: string; kind: "existing"; label: string; item: CatalogItem }
	| { id: string; kind: "link"; label: string; url: string }
	| { id: string; kind: "create"; label: string };

/** "Create \"Brand\"", "Add link \"Launch plan\"", or the catalog title. */
export function attachmentChoiceText(choice: AttachmentComposerChoice): string {
	return choice.kind === "create" ? `Create "${choice.label}"` : choice.kind === "link" ? `Add link "${choice.label}"` : choice.label;
}

/**
 * Choices for the composer query. Names already attached never match, and an attached name or
 * exact match suppresses Create. A URL offers one link choice unless its derived name is attached.
 */
export function attachmentComposerChoices(query: string, attachedNames: readonly string[]): AttachmentComposerChoice[] {
	const trimmed = query.trim();
	if (!trimmed) return [];
	const taken = new Set(attachedNames.map((name) => name.toLowerCase()));
	const url = parseWeblink(trimmed);
	if (url) {
		const label = deriveDisplayName(url);
		return taken.has(label.toLowerCase()) ? [] : [{ id: `link-${url.href}`, kind: "link", label, url: url.href }];
	}
	const q = trimmed.toLowerCase();
	const matches = CATALOG.filter((item) => !taken.has(item.label.toLowerCase()) && item.label.toLowerCase().includes(q)).slice(0, MAX_MATCHES);
	const choices: AttachmentComposerChoice[] = matches.map((item) => ({ id: `catalog-${item.label}`, kind: "existing", label: item.label, item }));
	if (!matches.some((item) => item.label.toLowerCase() === q) && !taken.has(q)) choices.push({ id: "create", kind: "create", label: trimmed });
	return choices;
}

/**
 * Enter with no choice: ignore empty or attached text; a URL becomes a link; text creates a page.
 * Returns undefined when nothing should be added.
 */
export function attachmentFallbackChoice(query: string, attachedNames: readonly string[]): AttachmentComposerChoice | undefined {
	const trimmed = query.trim();
	if (!trimmed || attachedNames.some((name) => name.toLowerCase() === trimmed.toLowerCase())) return undefined;
	const url = parseWeblink(trimmed);
	if (url) {
		const label = deriveDisplayName(url);
		return attachedNames.some((name) => name.toLowerCase() === label.toLowerCase()) ? undefined : { id: `link-${url.href}`, kind: "link", label, url: url.href };
	}
	return { id: "create", kind: "create", label: trimmed };
}

function contentHref(item: CatalogItem): string {
	return item.provider === "loom" ? "https://www.loom.com/" : `https://atlassian.net/wiki/search?text=${encodeURIComponent(item.label)}`;
}

/** Catalog Loom items land in Videos; live docs, whiteboards and databases are Confluence documents; Create makes a page. */
export function attachmentFromChoice(choice: AttachmentComposerChoice, { id, now, addedBy = "Annie Cook" }: AttachmentStamp): ProjectButterAttachment {
	const base = { id, addedBy, dateAdded: now, updatedAt: now };
	if (choice.kind === "link") return { ...base, kind: "link", name: choice.label, url: choice.url };
	if (choice.kind === "create") return { ...base, kind: "confluence", objectType: "page", name: choice.label, url: contentHref({ label: choice.label, type: "page" }) };
	const { item } = choice;
	return item.provider === "loom" || item.type === "video"
		? { ...base, kind: "loom", name: item.label, url: contentHref(item) }
		: { ...base, kind: "confluence", objectType: item.type, name: item.label, url: contentHref(item) };
}
