import type { ReactNode } from "react";

import PersonIcon from "@atlaskit/icon/core/person";
import TeamsIcon from "@atlaskit/icon/core/teams";
import PeopleGroupIcon from "@atlaskit/icon/core/people-group";
import TextIcon from "@atlaskit/icon/core/text";

import { RovoColorIcon } from "@/components/ui/logo";
import { EDITOR_PALETTE_MENTION_SOURCES } from "@/components/blocks/editor-palette/data/mention-sources";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";

import {
	RICH_TEXT_REFERENCE_CATEGORY_OPTIONS,
	getRichTextReferenceCategoryIcon,
	getRichTextReferenceCategoryLabel,
	isRichTextReferenceCategory,
} from "./reference-categories";
import { SLASH_COMMANDS } from "./suggestion-menu-slash-commands";
import type {
	RichTextMentionMenuCategory,
	RichTextMentionParentCategory,
	RichTextSuggestionMenuItem,
} from "./suggestion-menu-types";
import type {
	RichTextCommandCategory,
	RichTextMentionCategory,
	RichTextMentionItem,
	RichTextMentionSectionLabels,
	RichTextMentionSources,
	RichTextMentionVisual,
	RichTextSlashCategory,
} from "./types";

const PEOPLE_AVATAR_SRCS = [
	"/avatar-user/andrea-wilson/color/asow-service-yellow.png",
	"/avatar-user/andrew-park/color/asow-dev-lime.png",
	"/avatar-user/annie-clare/color/asow-strategy-orange.png",
	"/avatar-user/aoife-burke/color/asow-service-yellow.png",
	"/avatar-user/bradley-phillips/color/asow-product-purple.png",
	"/avatar-user/brian-lin/color/asow-teamwork-blue.png",
	"/avatar-user/christine-sanchez/color/asow-strategy-orange.png",
	"/avatar-user/david-hsieh/color/asow-service-yellow.png",
	"/avatar-user/florence-garcia/color/asow-strategy-orange.png",
	"/avatar-user/maia-ma/color/asow-service-yellow.png",
	"/avatar-user/nova/color/asow-dev-lime.png",
	"/avatar-user/olivia-yang/color/asow-service-yellow.png",
] as const;

const TEAM_AVATAR_SRCS = [
	"/avatar-project/apple.svg",
	"/avatar-project/bank.svg",
	"/avatar-project/battery.svg",
	"/avatar-project/boat.svg",
	"/avatar-project/book.svg",
	"/avatar-project/canvas.svg",
	"/avatar-project/cat.svg",
	"/avatar-project/celebration.svg",
	"/avatar-project/cloud.svg",
	"/avatar-project/code.svg",
	"/avatar-project/compass.svg",
	"/avatar-project/connie-blog.svg",
	"/avatar-project/gears.svg",
	"/avatar-project/government.svg",
	"/avatar-project/graduation.svg",
	"/avatar-project/graph.svg",
	"/avatar-project/group.svg",
	"/avatar-project/hr-badge.svg",
	"/avatar-project/id.svg",
	"/avatar-project/it.svg",
	"/avatar-project/launch-ship.svg",
	"/avatar-project/life-ring.svg",
	"/avatar-project/light-bulb.svg",
	"/avatar-project/lightning.svg",
	"/avatar-project/loom-record.svg",
	"/avatar-project/loom-video.svg",
	"/avatar-project/magnifying-glass.svg",
	"/avatar-project/mail.svg",
	"/avatar-project/map.svg",
	"/avatar-project/megaphone.svg",
	"/avatar-project/palm-tree.svg",
	"/avatar-project/paper-airplane.svg",
	"/avatar-project/pencil.svg",
	"/avatar-project/phone.svg",
	"/avatar-project/pin.svg",
	"/avatar-project/plant.svg",
	"/avatar-project/rocket.svg",
	"/avatar-project/science.svg",
	"/avatar-project/service-bell.svg",
	"/avatar-project/shield.svg",
	"/avatar-project/shopping-cart.svg",
	"/avatar-project/star.svg",
	"/avatar-project/stopwatch.svg",
	"/avatar-project/store-bag.svg",
	"/avatar-project/storefront.svg",
	"/avatar-project/sun.svg",
	"/avatar-project/support-wrench.svg",
	"/avatar-project/tracking.svg",
	"/avatar-project/unicorn.svg",
	"/avatar-project/video.svg",
] as const;

const AGENT_AVATAR_SRCS = [
	"/avatar-agent-new/blue/backlog-buddy.svg",
	"/avatar-agent-new/blue/team-connection.svg",
	"/avatar-agent-new/blue/marketing-message-maestro.svg",
	"/avatar-agent-new/blue/auto-fix.svg",
	"/avatar-agent-new/blue/customer-insight.svg",
	"/avatar-agent-new/blue/decision-director.svg",
	"/avatar-agent-new/blue/product-requirements.svg",
	"/avatar-agent-new/blue/comms-drafter.svg",
	"/avatar-agent-new/lime/auto-review.svg",
	"/avatar-agent-new/lime/comms-drafter.svg",
	"/avatar-agent-new/lime/auto-dev.svg",
	"/avatar-agent-new/lime/auto-review.svg",
	"/avatar-agent-new/purple/customer-insight.svg",
	"/avatar-agent-new/yellow/ops-agent.svg",
	"/avatar-agent-new/yellow/ops-agent.svg",
	"/avatar-agent-new/yellow/ops-agent.svg",
	"/avatar-agent-new/orange/research-scout.svg",
	"/avatar-agent-new/orange/research-scout.svg",
] as const;

const DEFAULT_MENTION_PARENT_LABELS: Record<RichTextMentionParentCategory, string> = {
	"people-team": "People and team",
	subagent: "Subagents",
};

export function getMentionParentLabels(
	overrides?: RichTextMentionSectionLabels,
): Record<RichTextMentionParentCategory, string> {
	return { ...DEFAULT_MENTION_PARENT_LABELS, ...overrides };
}

/** "@" mention surface: people/teams and subagents, each opening a nested list. */
const MENTION_TARGET_ORDER: readonly RichTextMentionParentCategory[] = [
	"people-team",
	"subagent",
];

/**
 * "/" command surface: reference categories other than subagent (which lives on
 * the "@" surface), each opening a nested item list. Derived from the shared
 * `RICH_TEXT_REFERENCE_CATEGORY_OPTIONS` so the toolbar's "Add content" menu and
 * the slash menu stay in sync, minus subagent.
 */
const COMMAND_CATEGORY_ORDER: readonly RichTextCommandCategory[] = RICH_TEXT_REFERENCE_CATEGORY_OPTIONS
	.map((option) => option.category)
	.filter((category) => category !== "subagent") as readonly RichTextCommandCategory[];

const SLASH_CATEGORY_ORDER: readonly RichTextSlashCategory[] = [
	...COMMAND_CATEGORY_ORDER,
	"format",
];

/**
 * The slash category order, optionally without the "format" parent. The
 * mentions-only chat composer passes `includeFormat: false` so its "/" menu
 * surfaces references only; the document editor keeps the default.
 */
export function getSlashCategoryOrder(
	includeFormat: boolean,
): readonly RichTextSlashCategory[] {
	return includeFormat
		? SLASH_CATEGORY_ORDER
		: COMMAND_CATEGORY_ORDER;
}
export const ASK_ROVO_SLASH_ITEM: RichTextSuggestionMenuItem = {
	description: "Ask Rovo to help with the current editor context.",
	icon: <RovoColorIcon size="xxsmall" />,
	id: "ask-rovo",
	label: "Ask Rovo",
};

/**
 * Static fallback mention catalog. Sourced from the single unified
 * `EDITOR_PALETTE_MENTION_SOURCES` (built from the `@/app/data/directory`
 * loaders) so the live editor's `@` and `/` surfaces draw from the same catalog
 * as the composer palette instead of a divergent hardcoded set. Consumer-passed
 * `getMentionSources` still take precedence via `getMergedMentionSources`.
 */
const STATIC_MENTION_ITEMS: RichTextMentionSources = EDITOR_PALETTE_MENTION_SOURCES;

function getCategoryIcon(category: RichTextMentionCategory): ReactNode {
	if (isRichTextReferenceCategory(category)) {
		return getRichTextReferenceCategoryIcon(category);
	}

	switch (category) {
		case "human":
			return <PersonIcon label="" size="small" />;
		case "team":
			return <TeamsIcon label="" size="small" />;
	}
}

function getSlashCategoryIcon(category: RichTextSlashCategory): ReactNode {
	return category === "format"
		? <TextIcon label="" size="small" />
		: getCategoryIcon(category);
}

export function getSlashCategoryLabel(category: RichTextSlashCategory): string {
	return category === "format" ? "Format" : getRichTextReferenceCategoryLabel(category);
}

export function isSlashCategoryId(id: string): id is RichTextSlashCategory {
	return (SLASH_CATEGORY_ORDER as readonly string[]).includes(id);
}

function getMergedMentionSources(
	sources: RichTextMentionSources | undefined,
): RichTextMentionSources {
	const mergeCategoryItems = (category: RichTextMentionCategory): readonly RichTextMentionItem[] => {
		const merged = [...(sources?.[category] ?? []), ...(STATIC_MENTION_ITEMS[category] ?? [])];
		const seen = new Set<string>();

		return merged.filter((item) => {
			const key = `${item.category}:${item.id}:${item.label.trim().toLowerCase()}`;
			if (seen.has(key)) {
				return false;
			}
			seen.add(key);
			return true;
		});
	};

	return {
		...STATIC_MENTION_ITEMS,
		...sources,
		// Subagents are nested agents owned by the current agent — never sourced from
		// the global parent-agent palette. Use ONLY the per-editor sources so the
		// `@subagent` list is empty/0 until the agent has its own subagents.
		subagent: [...(sources?.subagent ?? [])],
		human: mergeCategoryItems("human"),
		team: mergeCategoryItems("team"),
		skill: mergeCategoryItems("skill"),
		tool: mergeCategoryItems("tool"),
		knowledge: mergeCategoryItems("knowledge"),
		app: mergeCategoryItems("app"),
	};
}

export function getCategoryItems(
	sources: RichTextMentionSources | undefined,
	category: RichTextMentionMenuCategory,
): readonly RichTextMentionItem[] {
	if (category === "people-team") {
		return [
			...getCategoryItems(sources, "human"),
			...getCategoryItems(sources, "team"),
		];
	}

	return getMergedMentionSources(sources)[category] ?? [];
}

/** Lowercase, dotted handle from a display name (e.g. "Andrea Wilson" -> "andrea.wilson"). */
function getMentionHandle(name: string): string {
	return (
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, ".")
			.replace(/^\.+|\.+$/g, "") || "user"
	);
}

/** Stable, pseudo-random member count (10-200) derived from the team id. */
function getStableMemberCount(seed: string): number {
	let hash = 0;

	for (let index = 0; index < seed.length; index += 1) {
		hash = ((hash * 31) + seed.charCodeAt(index)) >>> 0;
	}

	return 10 + (hash % 191);
}

function getMentionChildDescription(item: RichTextMentionItem): string {
	if (item.description) {
		return item.description;
	}

	switch (item.category) {
		case "subagent":
			return `Delegate context or follow-up work to ${item.label}.`;
		case "human":
			return `@${getMentionHandle(item.label)}`;
		case "team":
			return `${getStableMemberCount(item.id)} members`;
		case "skill":
			return `Run the ${item.label} skill.`;
		case "tool":
			return `Use ${item.label} for this task.`;
		case "knowledge":
			return `Reference ${item.label} as knowledge context.`;
		case "app":
			return `Connect ${item.label} (tools and knowledge) to this agent.`;
		default: {
			// Exhaustiveness guard: a new RichTextMentionCategory must add a case above.
			const exhaustiveCategory: never = item.category;
			return exhaustiveCategory;
		}
	}
}

function getStableAssetIndex(seed: string, assetCount: number): number {
	let hash = 0;

	for (let index = 0; index < seed.length; index += 1) {
		hash = ((hash * 31) + seed.charCodeAt(index)) >>> 0;
	}

	return hash % assetCount;
}

function getMentionChildVisual(
	item: RichTextMentionItem,
): RichTextMentionVisual | undefined {
	if (item.visual) {
		return item.visual;
	}

	if (item.category === "human") {
		const nameSlug = item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
		const matchedByName = PEOPLE_AVATAR_SRCS.find((src) =>
			src.includes(`/avatar-user/${nameSlug}/`),
		);

		return {
			kind: "avatar",
			shape: "circle",
			src:
				matchedByName ??
				PEOPLE_AVATAR_SRCS[
					getStableAssetIndex(`${item.category}:${item.id}`, PEOPLE_AVATAR_SRCS.length)
				],
		};
	}

	if (item.category === "team") {
		return {
			kind: "avatar",
			shape: "square",
			src: TEAM_AVATAR_SRCS[
				getStableAssetIndex(`${item.category}:${item.id}`, TEAM_AVATAR_SRCS.length)
			],
		};
	}

	if (item.category === "subagent") {
		return {
			kind: "avatar",
			shape: "hexagon",
			src: AGENT_AVATAR_SRCS[
				getStableAssetIndex(`${item.category}:${item.id}`, AGENT_AVATAR_SRCS.length)
			],
		};
	}

	return undefined;
}

function buildCategoryMenuItems(
	order: readonly RichTextMentionParentCategory[],
	sources: RichTextMentionSources | undefined,
	labels: Record<RichTextMentionParentCategory, string>,
): readonly RichTextSuggestionMenuItem[] {
	return order.map((category) => ({
		description: `${getCategoryItems(sources, category).length} available`,
		persistentDescription: true,
		icon: category === "people-team"
			? <PeopleGroupIcon label="" size="small" />
			: getCategoryIcon(category),
		id: category,
		label: labels[category],
	}));
}

/** Parent entries for the "@" mention surface: people/teams and subagents. */
export function getMentionTargetItems(
	sources?: RichTextMentionSources,
	labelOverrides?: RichTextMentionSectionLabels,
): readonly RichTextSuggestionMenuItem[] {
	return buildCategoryMenuItems(MENTION_TARGET_ORDER, sources, getMentionParentLabels(labelOverrides));
}

/** Parent entries for the "/" command surface: skills, tools, knowledge. */
export function getSlashCommandCategoryItems(
	sources?: RichTextMentionSources,
	includeFormat = true,
): readonly RichTextSuggestionMenuItem[] {
	return getSlashCategoryOrder(includeFormat).map((category) => ({
		description: category === "format"
			? `${SLASH_COMMANDS.length} options`
			: `${getCategoryItems(sources, category).length} available`,
		persistentDescription: true,
		icon: getSlashCategoryIcon(category),
		id: category,
		label: getSlashCategoryLabel(category),
	}));
}

/** Nested reference items for a single category (e.g. the Skills submenu). */
export function getMentionChildItems(
	sources: RichTextMentionSources | undefined,
	category: RichTextMentionMenuCategory,
): readonly RichTextSuggestionMenuItem[] {
	return getCategoryItems(sources, category).map((item) => {
		const visual = getMentionChildVisual(item);

		return {
			description: getMentionChildDescription(item),
			icon: getCategoryIcon(item.category),
			id: item.id,
			label: item.label,
			leadingVisual: item.category === "subagent" && visual?.kind === "third-party" ? (
				<AgentAvatarVisual
					brandName={visual.name}
					fallbackText={item.label.slice(0, 2).toUpperCase()}
					sizePx={24}
				/>
			) : undefined,
			visual,
		};
	});
}
