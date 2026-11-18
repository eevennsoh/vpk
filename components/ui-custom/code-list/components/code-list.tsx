"use client";

import { useId, useMemo, useState } from "react";
import type { BundledLanguage } from "shiki";

import { CodeBlock } from "@/components/ui/code-block";
import { HighlightedCodeContent } from "@/components/ui-custom/highlighted-code-content";
import { ChevronDownIcon, ChevronRightIcon, CodeIcon } from "@/components/ui/vpk-icons";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

export interface CodeListItem {
	/** Stable identity for the row (used as the React key). */
	id: string;
	/**
	 * Full file path, e.g. "src/components/UserMenu.js". The directory prefix
	 * renders subtlest; the trailing filename renders in the default text color.
	 */
	path: string;
	/** Source shown in the expandable code block. */
	code: string;
	/**
	 * Shiki language for syntax highlighting. Defaults to inferring from the
	 * file extension, falling back to plain text.
	 */
	language?: BundledLanguage;
	/** Lines added — renders "+N" in lime. Omit or `0` to hide. */
	additions?: number;
	/** Lines removed — renders "-N" in red. Omit or `0` to hide. */
	deletions?: number;
}

export interface CodeListProps extends React.ComponentProps<"div"> {
	items: readonly CodeListItem[];
	/** Verb shown in the summary header, e.g. "Edited". Defaults to "Edited". */
	summaryVerb?: string;
	/** Hide the summary/minimise header above the card. Defaults to `false`. */
	hideSummary?: boolean;
	/** Ids of rows expanded on first render. */
	defaultExpandedIds?: readonly string[];
}

// Map common file extensions to a Shiki language; unknown types fall back to
// plain text so highlighting never throws on an unbundled grammar.
const EXTENSION_LANGUAGE: Record<string, BundledLanguage> = {
	js: "javascript",
	jsx: "jsx",
	ts: "typescript",
	tsx: "tsx",
	py: "python",
	rb: "ruby",
	go: "go",
	rs: "rust",
	java: "java",
	json: "json",
	css: "css",
	scss: "scss",
	html: "html",
	md: "markdown",
	sh: "bash",
	yml: "yaml",
	yaml: "yaml",
	sql: "sql",
};

function inferLanguage(path: string): BundledLanguage {
	const extension = path.split(".").pop()?.toLowerCase() ?? "";
	return EXTENSION_LANGUAGE[extension] ?? ("text" as BundledLanguage);
}

function splitPath(path: string): { dir: string; filename: string } {
	const lastSlash = path.lastIndexOf("/");
	return lastSlash >= 0
		? { dir: path.slice(0, lastSlash + 1), filename: path.slice(lastSlash + 1) }
		: { dir: "", filename: path };
}


function DiffStat({
	additions,
	deletions,
}: Readonly<{ additions?: number; deletions?: number }>) {
	if (!additions && !deletions) {
		return null;
	}
	return (
		<span className="flex shrink-0 items-center gap-1 text-xs leading-4">
			{additions ? <span className="text-text-accent-lime">+{additions}</span> : null}
			{deletions ? <span className="text-text-accent-red">-{deletions}</span> : null}
		</span>
	);
}

function CodeListRow({
	item,
	isLast,
	defaultExpanded,
}: Readonly<{ item: CodeListItem; isLast: boolean; defaultExpanded: boolean }>) {
	const [isExpanded, setIsExpanded] = useState(defaultExpanded);
	const panelId = useId();
	const { dir, filename } = splitPath(item.path);
	const language = item.language ?? inferLanguage(item.path);

	return (
		<div className={cn("flex flex-col", !isLast && "border-b border-border")}>
			<button
				aria-controls={panelId}
				aria-expanded={isExpanded}
				className="flex min-h-8 w-full cursor-pointer items-center gap-2 px-3 py-1 text-left transition-colors duration-xxshort ease-out-practical hover:bg-surface-hovered focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none"
				onClick={() => setIsExpanded((prev) => !prev)}
				type="button"
			>
				<ChevronRightIcon
					className={cn(
						"shrink-0 text-icon-subtle transition-transform duration-fast ease-out-practical motion-reduce:transition-none",
						isExpanded && "rotate-90",
					)}
					size="small"
				/>
				<span className="min-w-0 flex-1 truncate font-mono text-xs leading-5 text-text-subtlest">
					<span>{dir}</span>
					<span className="text-text">{filename}</span>
				</span>
				<DiffStat additions={item.additions} deletions={item.deletions} />
			</button>
			{isExpanded ? (
				<div
					className="animate-in fade-in-0 slide-in-from-top-1 duration-fast motion-reduce:animate-none"
					id={panelId}
				>
					<CodeBlock className="ring-0" size="sm">
						<HighlightedCodeContent code={item.code} language={language} lineNumbers />
					</CodeBlock>
				</div>
			) : null}
		</div>
	);
}

export function CodeList({
	items,
	summaryVerb = "Edited",
	hideSummary = false,
	defaultExpandedIds,
	className,
	...props
}: Readonly<CodeListProps>) {
	const [isMinimized, setIsMinimized] = useState(false);
	const listId = useId();
	const expandedIds = useMemo(
		() => new Set(defaultExpandedIds ?? []),
		[defaultExpandedIds],
	);
	const totals = useMemo(
		() =>
			items.reduce(
				(acc, item) => ({
					additions: acc.additions + (item.additions ?? 0),
					deletions: acc.deletions + (item.deletions ?? 0),
				}),
				{ additions: 0, deletions: 0 },
			),
		[items],
	);
	const fileCount = items.length;

	return (
		<div className={cn("flex flex-col gap-1", className)} {...props}>
			{hideSummary ? null : (
				<button
					aria-controls={listId}
					aria-expanded={!isMinimized}
					className="group flex cursor-pointer items-center gap-1 self-start rounded-sm pb-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					onClick={() => setIsMinimized((prev) => !prev)}
					type="button"
				>
					<CodeIcon className="shrink-0 text-icon-subtle" size="small" />
					<span className="text-xs leading-4 text-text-subtlest group-hover:underline">
						{summaryVerb}{" "}
						<span className="text-text">
							{fileCount} {fileCount === 1 ? "file" : "files"}
						</span>
					</span>
					<DiffStat additions={totals.additions} deletions={totals.deletions} />
					<ChevronDownIcon
						className={cn(
							"shrink-0 text-icon-subtle transition-transform duration-fast ease-out-practical motion-reduce:transition-none",
							isMinimized && "-rotate-90",
						)}
						size="small"
					/>
				</button>
			)}
			{isMinimized ? null : (
				<div
					className="overflow-hidden rounded-lg bg-surface-raised"
					id={listId}
					style={{ boxShadow: token("elevation.shadow.raised") }}
				>
					{items.map((item, index) => (
						<CodeListRow
							defaultExpanded={expandedIds.has(item.id)}
							isLast={index === items.length - 1}
							item={item}
							key={item.id}
						/>
					))}
				</div>
			)}
		</div>
	);
}
