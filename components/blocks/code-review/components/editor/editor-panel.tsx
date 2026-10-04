"use client";

import SidebarCollapseIcon from "@atlaskit/icon/core/sidebar-collapse";
import SidebarExpandIcon from "@atlaskit/icon/core/sidebar-expand";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import type { ChangedFile, CodeReviewCommit, DiffLayout } from "@/components/blocks/code-review/data/types";
import type {
	InlineCommentAnchor,
	InlineCommentDraft,
	InlineReviewComment,
} from "@/components/blocks/code-review/lib/inline-comments";
import {
	filterChangedFilesByScope,
	type ChangesScope,
} from "@/components/blocks/code-review/lib/filter-changed-files-by-scope";
import { DiffFileView } from "../diff-file-view";
import { EditorChangesPicker } from "./editor-changes-picker";
import { EditorDiffLayoutControls } from "./editor-diff-layout-controls";
import { EditorExplorer } from "./editor-explorer";

const FILE_TREE_ID = "code-review-file-tree";
const EMPTY_ITEMS = [] as const;
const EMPTY_COMMITS = [] as const satisfies readonly CodeReviewCommit[];
const NOOP = () => {};
/**
 * Sticky directly under the PR sticky shell. The measured header height excludes
 * content spacing so rows cannot disappear inside a blank zone above the toolbar.
 *
 * `rounded-t-[inherit]` matches the embedded shell’s `rounded-md` — that shell
 * cannot use overflow-hidden or sticky would be trapped.
 */
const EXPAND_STICKY_TOOLBAR_CLASS =
	"sticky z-[9] top-[var(--pull-request-detail-header-height,0px)] rounded-t-[inherit] [container-type:scroll-state]";
/**
 * Sticky under toolbar (h-9 / space-900); scrolls internally when taller than the
 * scrollport. `rounded-bl-[inherit]` covers the card’s bottom-left when the tree
 * reaches the shell edge (shell skips overflow-hidden for sticky).
 */
const EXPAND_STICKY_TREE_CLASS =
	"sticky z-[8] self-start top-[calc(var(--pull-request-detail-header-height,0px)+(--spacing(9)))] max-h-[calc(var(--pull-request-detail-scrollport-height,100dvh)-var(--pull-request-detail-header-height,0px)-(--spacing(9)))] overflow-y-auto rounded-bl-[inherit]";
/** Keep file anchors clear of the sticky PR header + toolbar. */
const EXPAND_FILE_SCROLL_MARGIN_CLASS =
	"scroll-mt-[calc(var(--pull-request-detail-header-height,0px)+(--spacing(9)))]";

interface EditorPanelProps {
	className?: string;
	commits?: readonly CodeReviewCommit[];
	defaultSelectedFileId?: string;
	/** Grow with content for parent scrollports; omit for canvas-sized panels. */
	expandContent?: boolean;
	explorerRootLabel?: string;
	files: readonly ChangedFile[];
	layout: DiffLayout;
	readOnly?: boolean;
	showSearch?: boolean;
	drafts?: readonly InlineCommentDraft[];
	comments?: readonly InlineReviewComment[];
	onAddDraft?: (anchor: InlineCommentAnchor) => void;
	onCancelDraft?: (draftId: string) => void;
	onCommitDraft?: (draftId: string) => void;
	onDeleteComment?: (commentId: string) => void;
	onUpdateComment?: (commentId: string, body: string) => void;
	onLayoutChange: (layout: DiffLayout) => void;
	onUpdateDraft?: (draftId: string, body: string) => void;
}

export function EditorPanel({
	className,
	commits = EMPTY_COMMITS,
	defaultSelectedFileId,
	expandContent = false,
	explorerRootLabel,
	files,
	layout,
	readOnly = false,
	showSearch = true,
	drafts = EMPTY_ITEMS,
	comments = EMPTY_ITEMS,
	onAddDraft = NOOP,
	onCancelDraft = NOOP,
	onCommitDraft = NOOP,
	onDeleteComment = NOOP,
	onUpdateComment = NOOP,
	onLayoutChange,
	onUpdateDraft = NOOP,
}: Readonly<EditorPanelProps>) {
	const [isExplorerVisible, setIsExplorerVisible] = useState(false);
	const [changesScope, setChangesScope] = useState<ChangesScope>("all-changes");
	const visibleFiles = filterChangedFilesByScope(files, commits, changesScope);
	const [selectedFileId, setSelectedFileId] = useState(
		() => visibleFiles.find((file) => file.id === defaultSelectedFileId)?.id ?? visibleFiles[0]?.id ?? "",
	);
	const fileElements = useRef(new Map<string, HTMLElement>());
	const effectiveSelectedFileId = visibleFiles.some((file) => file.id === selectedFileId)
		? selectedFileId
		: visibleFiles[0]?.id ?? "";
	const handleFileSelect = (fileId: string) => {
		setSelectedFileId(fileId);
		fileElements.current.get(fileId)?.scrollIntoView({ block: "start" });
	};
	const DiffListContainer = expandContent ? "div" : ScrollArea;

	return (
		<section
			className={cn(
				"flex min-w-0 flex-col bg-surface",
				expandContent ? "rounded-[inherit]" : "size-full min-h-0",
				className,
			)}
			data-code-review-editor-panel
		>
			<div
				className={cn(
					"relative isolate flex h-9 shrink-0 items-center border-b border-border px-1.5",
					expandContent ? EXPAND_STICKY_TOOLBAR_CLASS : "bg-surface-sunken",
				)}
			>
				{expandContent ? (
					<div
						aria-hidden
						className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-surface-sunken"
						data-code-review-sticky-toolbar-surface
					/>
				) : null}
				{/* gap-1 (space-050); picker wrapped — Menu.Root is a fragment */}
				<div
					className="flex items-center gap-1"
					data-code-review-editor-toolbar-start
				>
					<Button
						aria-controls={FILE_TREE_ID}
						aria-expanded={isExplorerVisible}
						aria-label={isExplorerVisible ? "Hide file tree" : "Show file tree"}
						className="shrink-0 aria-expanded:border-transparent aria-expanded:bg-transparent aria-expanded:text-text-subtle aria-expanded:hover:bg-bg-neutral-subtle-hovered aria-expanded:active:bg-bg-neutral-subtle-pressed"
						onClick={() => setIsExplorerVisible((visible) => !visible)}
						size="icon-compact"
						variant="ghost"
					>
						<Icon
							aria-hidden
							render={isExplorerVisible
								? <SidebarCollapseIcon label="" size="small" />
								: <SidebarExpandIcon label="" size="small" />}
						/>
					</Button>
					<div className="min-w-0 shrink-0">
						<EditorChangesPicker
							commits={commits}
							files={files}
							onScopeChange={setChangesScope}
							scope={changesScope}
						/>
					</div>
				</div>
				<EditorDiffLayoutControls
					className="ml-auto"
					layout={layout}
					onLayoutChange={onLayoutChange}
				/>
			</div>
			<div
				className={cn(
					"grid min-w-0",
					expandContent ? "items-start" : "min-h-0 flex-1",
					isExplorerVisible
						? "grid-cols-[240px_minmax(0,1fr)]"
						: "grid-cols-[minmax(0,1fr)]",
				)}
			>
				{isExplorerVisible ? (
					<EditorExplorer
						className={expandContent ? EXPAND_STICKY_TREE_CLASS : undefined}
						expandContent={expandContent}
						explorerRootLabel={explorerRootLabel}
						files={visibleFiles}
						id={FILE_TREE_ID}
						includeDemoTree={false}
						onFileSelect={handleFileSelect}
						selectedFileId={effectiveSelectedFileId}
						showSearch={showSearch}
					/>
				) : null}
				<DiffListContainer
					className={cn(
						"min-w-0",
						expandContent
							? undefined
							: "min-h-0 [&_[data-slot=scroll-area-scrollbar]]:opacity-0 [&_[data-slot=scroll-area-scrollbar]]:transition-opacity hover:[&_[data-slot=scroll-area-scrollbar]]:opacity-100 focus-within:[&_[data-slot=scroll-area-scrollbar]]:opacity-100",
					)}
				>
					<div
						className={cn(
							"min-w-0 divide-y divide-border",
							/*
							 * Embedded shell drops overflow-hidden for sticky; round the
							 * non-sticky file list so bottom corners don’t square-bleed.
							 */
							expandContent
								? isExplorerVisible
									? "overflow-hidden rounded-br-[inherit]"
									: "overflow-hidden rounded-b-[inherit]"
								: undefined,
						)}
					>
						{visibleFiles.map((file) => (
							<section
								key={file.id}
								aria-label={`${file.path} changes`}
								className={cn(
									"min-w-0 overflow-hidden bg-surface",
									expandContent
										? EXPAND_FILE_SCROLL_MARGIN_CLASS
										: "scroll-mt-4",
								)}
								data-code-review-file-id={file.id}
								ref={(element) => {
									if (element) {
										fileElements.current.set(file.id, element);
									} else {
										fileElements.current.delete(file.id);
									}
								}}
							>
								<DiffFileView
									comments={comments}
									drafts={drafts}
									file={file}
									layout={layout}
									onAddDraft={onAddDraft}
									onCancelDraft={onCancelDraft}
									onCommitDraft={onCommitDraft}
									onDeleteComment={onDeleteComment}
									onUpdateComment={onUpdateComment}
									onUpdateDraft={onUpdateDraft}
									readOnly={readOnly}
									showFileHeader
								/>
							</section>
						))}
						{visibleFiles.length === 0 ? (
							<div className="grid min-h-48 place-items-center text-sm text-text-subtle">
								No changed files.
							</div>
						) : null}
					</div>
				</DiffListContainer>
			</div>
		</section>
	);
}
