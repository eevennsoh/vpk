"use client";

import type { ReactElement } from "react";
import type { Editor } from "@tiptap/core";
import type { StarterKitOptions } from "@tiptap/starter-kit";

import type { AtlassianLogoName } from "@/components/ui/logo";
import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";

/**
 * "@" mention surface: people, teams, and subagents. Each opens a nested list
 * and is inserted as a mention token.
 */
export type RichTextMentionTarget = "human" | "team" | "subagent";

/**
 * Reference categories used by the "Add content" toolbar menu. Still includes
 * "subagent" so it can be inserted from the toolbar, even though the "@" surface
 * (not "/") owns the subagent mention picker. `app` is the umbrella over
 * tools + knowledge; `tool`/`knowledge` remain so legacy tokens still resolve.
 */
export type RichTextReferenceCategory = "subagent" | "skill" | "tool" | "knowledge" | "app";

/**
 * "/" command categories. Each opens a nested list of reference items and is
 * inserted as a mention token. Subagents live on the "@" mention surface, so the
 * "/" surface only carries skills and apps (tools + knowledge are unified under
 * the `app` umbrella; the legacy `tool`/`knowledge` values stay for resolution).
 */
export type RichTextCommandCategory = "skill" | "tool" | "knowledge" | "app";

/**
 * "/" parent categories. Format is a command-only category whose children run
 * editor formatting commands instead of inserting mention/reference tokens.
 */
export type RichTextSlashCategory = RichTextCommandCategory | "format";

/**
 * Every inserted mention/reference token belongs to one of these categories,
 * spanning both the "@" mention surface and the "/" command surface.
 */
export type RichTextMentionCategory = RichTextMentionTarget | RichTextCommandCategory;

export interface RichTextMentionItem {
	category: RichTextMentionCategory;
	id: string;
	label: string;
	description?: string;
	visual?: RichTextMentionVisual;
}

export type RichTextMentionVisual =
	| {
			kind: "avatar" | "image";
			shape?: "circle" | "square" | "hexagon";
			src: string;
		}
	| {
			kind: "logo";
			logoName: AtlassianLogoName;
		}
	| {
			kind: "third-party";
			name: ThirdPartyLogoName;
		}
	| {
			kind: "icon";
			icon: ReactElement;
			iconColor?: string;
			iconKey?: string;
	};

export interface RichTextMentionRemovalRequest {
	category: RichTextReferenceCategory;
	id?: string;
	key: string;
	label?: string;
}

export type RichTextMentionSources = Partial<
	Record<RichTextMentionCategory, readonly RichTextMentionItem[]>
>;

/** Optional copy overrides for the two sections on the "@" mention surface. */
export type RichTextMentionSectionLabels = Partial<
	Record<"people-team" | "subagent", string>
>;

/**
 * Layout for the live "@" / "/" suggestion menus.
 *
 * - `"nested"` (default): a bare trigger lists parent categories. Once the
 *   user types a top-level query, the menu searches every section in that
 *   trigger's set at once and shows the merged flat results. After drilling
 *   into a category, typing stays scoped to that category.
 * - `"flat"`: every section is merged into one scrollable list,
 *   separated by non-interactive section headings (mirroring
 *   `DropdownMenuLabel`). On the empty query each section is capped at five
 *   items with a "Browse all" / "View more" footer; once the user starts
 *   typing, the menu filters across every section at once and shows all matches.
 */
export type RichTextSuggestionVariant = "nested" | "flat";

/** Row presentation independent of the menu's nested or flat layout. */
export type RichTextSuggestionRowVariant = "compact" | "with-byline";

/**
 * Suggestion layout, set either uniformly or per trigger.
 *
 * - A bare {@link RichTextSuggestionVariant} applies to both the "@" mention and
 *   "/" command menus (the common case).
 * - An object form picks a variant per trigger, e.g. `{ mention: "flat",
 *   command: "flat" }` for a surface that always expands slash results inline
 *   while keeping mentions nested. Either key defaults to `"nested"` when
 *   omitted.
 */
export type RichTextSuggestionVariantConfig =
	| RichTextSuggestionVariant
	| {
			mention?: RichTextSuggestionVariant;
			command?: RichTextSuggestionVariant;
		};

/** Resolve the "@" mention menu variant from a (possibly per-trigger) config. */
export function resolveMentionVariant(
	config: RichTextSuggestionVariantConfig | undefined,
): RichTextSuggestionVariant {
	if (typeof config === "string") {
		return config;
	}
	return config?.mention ?? "nested";
}

/** Resolve the "/" command menu variant from a (possibly per-trigger) config. */
export function resolveCommandVariant(
	config: RichTextSuggestionVariantConfig | undefined,
): RichTextSuggestionVariant {
	if (typeof config === "string") {
		return config;
	}
	return config?.command ?? "nested";
}

export interface RichTextEditorExtensionOptions {
	trailingNode?: StarterKitOptions["trailingNode"];
	getMentionSources?: () => RichTextMentionSources | undefined;
	/** Overrides section copy without changing the stored mention categories. */
	mentionSectionLabels?: RichTextMentionSectionLabels;
	onAskRovo?: (editor: Editor) => void;
	/**
	 * Whether the "/" command menu shows the sticky Ask Rovo prompt. Defaults to
	 * `true` for editor surfaces; chat composers turn it off because the user is
	 * already inside a Rovo composer.
	 */
	showAskRovoPrompt?: boolean;
	/**
	 * Layout for the live "@" / "/" suggestion menus. Accepts a single variant
	 * (applied to both triggers) or a per-trigger object. Defaults to `"nested"`.
	 */
	suggestionVariant?: RichTextSuggestionVariantConfig;
	suggestionRowVariant?: RichTextSuggestionRowVariant;
	/**
	 * Whether the "/" command menu includes the "Format" parent category (and its
	 * block/mark formatting commands). Defaults to `true` for the full document
	 * editor; the mentions-only chat composer passes `false` so the slash menu
	 * surfaces references only.
	 */
	includeFormat?: boolean;
	/**
	 * When `true`, the `@`/`/` palette anchors to the prompt-input root instead
	 * of the caret: it spans the box's full width, sits 8px away, and prefers
	 * above-input placement with a viewport fallback. The chat composer sets this;
	 * the document editor leaves it `false` (caret-anchored).
	 */
	anchorToInput?: boolean;
	/**
	 * Launches the directory for a nested "/" category when the user clicks
	 * "Browse all" in that category's empty state (e.g. drilling into Skills and
	 * typing a non-matching query). Only directory-backed categories (everything
	 * but "format") invoke it. Omit it to keep the plain empty title with no
	 * button — surfaces without a host directory (the showcase, the chat
	 * composer) leave it unset.
	 */
	onOpenDirectory?: (category: RichTextSlashCategory) => void;
	/**
	 * When `{ enabled: true }`, registers the block-level `frontmatter` node so a
	 * leading SKILL.md `---` YAML block renders as the editable frontmatter card
	 * (and round-trips as a fence in the markdown view). Off by default — only the
	 * skill detail editor opts in; every other consumer is unaffected.
	 */
	frontmatter?: { enabled?: boolean };
}
