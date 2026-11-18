"use client";

import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { use, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ToolsIcon from "@atlaskit/icon/core/tools";

import type { FrontmatterEntries, FrontmatterValue } from "@/app/data/directory/skill-frontmatter";
import { getDirectoryMentionItem } from "@/components/blocks/editor-palette/data/mention-sources";
import { Icon } from "@/components/ui/icon";
import { IconTile } from "@/components/ui/icon-tile";
import { Input } from "@/components/ui/input";
import { Tag, TagGroup } from "@/components/ui/tag";
import { Textarea } from "@/components/ui/textarea";

import { RichTextMentionVisualMark } from "./mention-visual";
import type { RichTextMentionVisual, RichTextReferenceCategory } from "./types";
import { FrontmatterPortalContext } from "./frontmatter-portal";

const READONLY_KEYS = new Set(["name"]);

// `allowed-tools` labels are mirrored from body app/tool/knowledge mentions (see
// `ALLOWED_TOOL_MENTION_CATEGORIES` in frontmatter-node.ts). The card only keeps
// the bare label, so we re-resolve it against the same directory mention catalog
// the editor palette draws from — probing those categories in order and using
// the first that carries a visual — so a card chip and its `@`/`/` body token
// render the identical logo + accent.
const ALLOWED_TOOL_CATEGORIES = ["app", "tool", "knowledge"] as const satisfies readonly RichTextReferenceCategory[];

function resolveAllowedToolMention(
	label: string,
): { category: RichTextReferenceCategory; visual: RichTextMentionVisual } | undefined {
	for (const category of ALLOWED_TOOL_CATEGORIES) {
		const visual = getDirectoryMentionItem(category, label)?.visual;
		if (visual) {
			return { category, visual };
		}
	}
	return undefined;
}

function asEntries(value: unknown): FrontmatterEntries {
	return Array.isArray(value) ? (value as FrontmatterEntries) : [];
}

/** Stop ProseMirror from hijacking pointer/key events meant for the card's inputs. */
function stopEditorCapture(event: { stopPropagation: () => void }) {
	event.stopPropagation();
}

function FrontmatterScalarRow({
	entryKey,
	value,
	editable,
	onCommit,
}: Readonly<{
	entryKey: string;
	value: string;
	editable: boolean;
	onCommit: (next: string) => void;
}>) {
	const isDescription = entryKey === "description";
	const readOnly = !editable || READONLY_KEYS.has(entryKey);
	const [draft, setDraft] = useState(value);
	const focusedRef = useRef(false);

	// Keep the field in sync with external edits (e.g. the markdown view) while the
	// user isn't actively editing it.
	useEffect(() => {
		if (!focusedRef.current) {
			setDraft(value);
		}
	}, [value]);

	if (readOnly) {
		return <dd className="min-w-0 break-words text-text">{value}</dd>;
	}

	const sharedProps = {
		value: draft,
		// The `subtle` field variant gives the inline-edit affordance its ADS
		// interaction states (transparent at rest, `bg-bg-input-hovered` on hover,
		// `bg-bg-input` + focus ring on focus). Negative margin lets that padded
		// hit area bleed into the grid gutter while the text stays aligned to the
		// value column; `text-xs leading-4` matches the card's type scale.
		variant: "subtle",
		onMouseDown: stopEditorCapture,
		onKeyDown: stopEditorCapture,
		onFocus: () => {
			focusedRef.current = true;
		},
		onBlur: () => {
			focusedRef.current = false;
			if (draft !== value) {
				onCommit(draft);
			}
		},
		className: "-mx-1.5 h-auto px-1.5 py-0.5 text-xs leading-4 text-text",
	} as const;

	return (
		<dd className="min-w-0">
			{isDescription ? (
				<Textarea
					{...sharedProps}
					rows={1}
					// Behaves like a single-line field that only wraps when it runs out of
					// horizontal space: `field-sizing-content` grows the height to fit the
					// wrapped content, `min-h-[1lh]` starts it at one line (no forced
					// minimum), and `resize-none` drops the manual drag grabber so every
					// line stays the same `leading-4` height with uniform spacing.
					className={`${sharedProps.className} min-h-[1lh] resize-none`}
					onChange={(event) => setDraft(event.target.value)}
					aria-label="Edit description"
				/>
			) : (
				<Input
					{...sharedProps}
					type="text"
					onChange={(event) => setDraft(event.target.value)}
					aria-label={`Edit ${entryKey}`}
				/>
			)}
		</dd>
	);
}

/**
 * Editable SKILL.md frontmatter card. Renders the parsed `---` block as dynamic
 * key/value rows: `name` is read-only (the derived slug), `description` and other
 * scalars are inline-editable, and list values (`allowed-tools`) render as
 * removable tags. Edits write back through `updateAttributes({ entries })`, which
 * flows out via the editor's markdown round-trip.
 */
export function FrontmatterNodeView({ node, updateAttributes, editor }: ReactNodeViewProps) {
	const entries = asEntries(node.attrs.entries);
	const editable = editor.isEditable;
	const portalEl = use(FrontmatterPortalContext);

	function setEntryValue(key: string, value: FrontmatterValue) {
		updateAttributes({
			entries: entries.map((entry) => (entry.key === key ? { key, value } : entry)),
		});
	}

	function removeListItem(key: string, index: number) {
		const entry = entries.find((candidate) => candidate.key === key);
		if (!entry || !Array.isArray(entry.value)) {
			return;
		}
		setEntryValue(
			key,
			entry.value.filter((_, itemIndex) => itemIndex !== index),
		);
	}

	const card = (
		<div
			data-frontmatter-card=""
			className="mb-6 overflow-hidden rounded-2xl border border-border"
		>
			<dl className="grid grid-cols-[max-content_minmax(0,1fr)] items-start gap-x-6 gap-y-2 p-4 text-xs leading-4">
				{entries.map((entry) => (
					<div key={entry.key} className="contents">
						<dt className="pt-0.5 font-semibold text-text-subtlest">{entry.key}</dt>
						{Array.isArray(entry.value) ? (
							<dd className="min-w-0">
								<TagGroup className="flex flex-wrap gap-1" onMouseDown={stopEditorCapture}>
									{entry.value.length === 0 ? (
										<span className="text-text-subtlest">None</span>
									) : (
										entry.value.map((item, index) => {
											// Match the editor palette token's logo/icon and accent while
											// retaining the compact non-pill Tag shape.
											// `removeVariant="overlay"` mirrors the
											// agent config panel reference chips so the remove control
											// floats over the colored chip instead of widening it.
											const mention = resolveAllowedToolMention(item);
											const visual = mention?.visual;
											return (
												<Tag
													key={`${entry.key}-${item}-${index}`}
													// Neutral gray frame to match the agent config-panel
													// reference chips; the leading logo/icon keeps its
													// collection color via `RichTextMentionVisualMark`.
													color="gray"
													elemBefore={
														visual ? (
															<RichTextMentionVisualMark
																category={mention.category}
																label={item}
																visual={visual}
															/>
														) : (
															// No directory visual resolved (e.g. a 3P tool
															// like Splunk). Mirror the agent config panel
															// reference chips (`AgentReferenceChip`): wrap the
															// bare fallback icon in the `IconTile`
															// xxsmall/transparent treatment so the glyph is
															// normalized to the chip's 16px leading slot and
															// centered. Rendering the raw `@atlaskit/icon`
															// instead left-aligns a 12px glyph, which reads as
															// a misaligned icon with an oversized gap.
															// `text-inherit` lets it pick up the Tag color from
															// the leading-slot wrapper.
															<IconTile
																aria-hidden
																className="text-inherit"
																icon={<Icon aria-hidden render={<ToolsIcon label="" size="small" />} />}
																label=""
																size="xxsmall"
																variant="transparent"
															/>
														)
													}
													type="default"
													onRemove={editable ? () => removeListItem(entry.key, index) : undefined}
													removeButtonLabel="Remove"
													removeVariant="overlay"
												>
													{item}
												</Tag>
											);
										})
									)}
								</TagGroup>
							</dd>
						) : (
							<FrontmatterScalarRow
								entryKey={entry.key}
								value={String(entry.value)}
								editable={editable}
								onCommit={(next) => setEntryValue(entry.key, next)}
							/>
						)}
					</div>
				))}
			</dl>
		</div>
	);

	// With a portal target (skill config renders one below the toolbar), render
	// the card there and keep the node in the document via a hidden placeholder,
	// so selection and the markdown round-trip are unaffected. Otherwise render
	// the card inline as the editor's first node.
	return (
		<NodeViewWrapper
			as="div"
			contentEditable={false}
			className={portalEl ? "hidden" : undefined}
			aria-hidden={portalEl ? true : undefined}
		>
			{portalEl ? createPortal(card, portalEl) : card}
		</NodeViewWrapper>
	);
}
