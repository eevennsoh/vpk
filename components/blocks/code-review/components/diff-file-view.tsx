"use client";

import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import CopyIcon from "@atlaskit/icon/core/copy";
import type { DiffLineAnnotation, SelectedLineRange } from "@pierre/diffs";
import { MultiFileDiff } from "@pierre/diffs/react";
import { useMemo, useReducer, useRef, useState, type PointerEvent } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
	FileExplorerFileIcon,
	FileExplorerIconSprite,
} from "@/components/ui-custom/file-explorer-file-icon";
import { useTheme } from "@/components/utils/theme-wrapper";
import { cn } from "@/lib/utils";

import type { ChangedFile, DiffLayout } from "../data/types";
import type {
	InlineCommentAnchor,
	InlineCommentDraft,
	InlineCommentSide,
	InlineReviewComment,
} from "../lib/inline-comments";
import {
	normalizeInlineCommentLineRange,
	resolveInlineCommentLineText,
} from "../lib/inline-comments";
import { DiffStats } from "./diff-stats";
import {
	InlineCommentAnnotation,
	InlineCommentGutterButton,
	type InlineCommentAnnotationMetadata,
} from "./inline-comment-annotation";

interface DiffFileViewProps {
	file: ChangedFile;
	layout: DiffLayout;
	className?: string;
	readOnly?: boolean;
	showFileHeader?: boolean;
	drafts: readonly InlineCommentDraft[];
	comments: readonly InlineReviewComment[];
	onAddDraft: (anchor: InlineCommentAnchor) => void;
	onCancelDraft: (draftId: string) => void;
	onCommitDraft: (draftId: string) => void;
	onDeleteComment: (commentId: string) => void;
	onUpdateComment: (commentId: string, body: string) => void;
	onUpdateDraft: (draftId: string, body: string) => void;
}

const DIFF_UNSAFE_CSS = `
:host {
	--diffs-font-size: 12px;
}

[data-diffs-header] ~ [data-diff] [data-code] {
	padding-top: var(--diffs-gap-inline, var(--diffs-gap-fallback));
}

[data-column-number]:has([data-gutter-utility-slot]) [data-line-number-content] {
	visibility: hidden;
}

[data-column-number]:has([data-gutter-utility-slot]) [data-gutter-utility-slot] {
	inset-inline: 0;
	justify-content: center;
	translate: 0.5ch 0;
	z-index: 5;
}
`;

const FILE_HEADER_ACTION_CLASS_NAME =
	"pointer-events-none opacity-0 transition-opacity duration-xxshort ease-out-practical group-hover/file-header:pointer-events-auto group-hover/file-header:opacity-100 group-has-[:focus-visible]/file-header:pointer-events-auto group-has-[:focus-visible]/file-header:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none";

export function DiffFileView({
	file,
	layout,
	className,
	readOnly = false,
	showFileHeader = false,
	drafts,
	comments,
	onAddDraft,
	onCancelDraft,
	onCommitDraft,
	onDeleteComment,
	onUpdateComment,
	onUpdateDraft,
}: Readonly<DiffFileViewProps>) {
	const { actualTheme } = useTheme();
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [selectionRevision, resetSelection] = useReducer((revision: number) => revision + 1, 0);
	const lastCommittedSelection = useRef<Readonly<{
		fileId: string;
		layout: DiffLayout;
		range: SelectedLineRange;
	}> | null>(null);
	const selectionStartedFromGutter = useRef(false);
	const lineAnnotations = useMemo<DiffLineAnnotation<InlineCommentAnnotationMetadata>[]>(
		() => [
			...drafts
				.filter((draft) => draft.fileId === file.id)
				.map((draft) => ({
					lineNumber: draft.lineNumber,
					side: draft.side,
					metadata: { kind: "draft" as const, draft },
				})),
			...comments
				.filter((comment) => comment.fileId === file.id)
				.map((comment) => ({
					lineNumber: comment.lineNumber,
					side: comment.side,
					metadata: { kind: "comment" as const, comment },
				})),
		],
		[comments, drafts, file.id],
	);
	const handleAddComment = (range: SelectedLineRange) => {
		const side = range.side ?? range.endSide;
		const isMixedSideRange = range.endSide !== undefined && range.endSide !== side;
		const normalizedRange = normalizeInlineCommentLineRange(range.start, range.end);
		if (!side || isMixedSideRange || !normalizedRange) {
			lastCommittedSelection.current = null;
			resetSelection();
			return;
		}

		onAddDraft({
			fileId: file.id,
			filePath: file.path,
			side,
			...normalizedRange,
			lineText: resolveInlineCommentLineText(
				file,
				side,
				normalizedRange.startLineNumber,
				normalizedRange.lineNumber,
			),
		});
		lastCommittedSelection.current = null;
		resetSelection();
	};
	const handleKeyboardAddComment = (side: InlineCommentSide, lineNumber: number) => {
		const committedSelection = lastCommittedSelection.current;
		const range = committedSelection?.fileId === file.id && committedSelection.layout === layout
			? committedSelection.range
			: { start: lineNumber, end: lineNumber, side };

		handleAddComment(range);
	};
	const handleLineSelected = (range: SelectedLineRange | null) => {
		const shouldAddComment = selectionStartedFromGutter.current;
		selectionStartedFromGutter.current = false;
		lastCommittedSelection.current = range
			? { fileId: file.id, layout, range }
			: null;

		if (shouldAddComment && range) {
			handleAddComment(range);
		}
	};
	const handleGutterPointerSelect = (
		event: PointerEvent<HTMLButtonElement>,
		line: Readonly<{ lineNumber: number; side: InlineCommentSide }>,
	) => {
		if (event.pointerType === "mouse" && event.button !== 0) {
			return;
		}

		// Pierre 1.2.12 makes its native gutter callback mutually exclusive with
		// a custom utility. Forward only the initial down to the assigned line
		// number so Pierre still owns move, up, selection, and cancellation.
		const slotWrapper = event.currentTarget.closest<HTMLElement>(
			'[slot="gutter-utility-slot"]',
		);
		const numberElement = slotWrapper?.assignedSlot?.parentElement?.parentElement;
		const PointerEventConstructor = numberElement?.ownerDocument.defaultView?.PointerEvent;
		if (!(numberElement instanceof HTMLElement) || !PointerEventConstructor) {
			selectionStartedFromGutter.current = false;
			handleKeyboardAddComment(line.side, line.lineNumber);
			return;
		}

		selectionStartedFromGutter.current = true;
		numberElement.dispatchEvent(new PointerEventConstructor("pointerdown", {
			bubbles: true,
			button: event.button,
			buttons: event.buttons,
			cancelable: true,
			clientX: event.clientX,
			clientY: event.clientY,
			composed: true,
			ctrlKey: event.ctrlKey,
			metaKey: event.metaKey,
			pointerId: event.pointerId,
			pointerType: event.pointerType,
			shiftKey: lastCommittedSelection.current !== null,
		}));
	};
	const handlePointerCancel = () => {
		lastCommittedSelection.current = null;
		selectionStartedFromGutter.current = false;
		resetSelection();
	};
	const handleCopyPath = () => {
		void navigator.clipboard?.writeText(file.path).catch(() => undefined);
	};
	const renderFileHeader = () => (
		<div className="relative w-full min-w-0 bg-surface-sunken">
			<FileExplorerIconSprite />
			<div
				className={cn(
					"group/file-header flex min-h-9 min-w-0 items-center gap-1 pl-1.5 pr-4 text-xs text-text",
					// Collapsed rows rely on the parent stack's divide-y; keeping
					// border-b here would stack into a double separator.
					!isCollapsed ? "border-b border-border" : null,
				)}
				data-code-review-file-header={file.id}
			>
				<Button
					aria-expanded={!isCollapsed}
					aria-label={isCollapsed ? `Expand ${file.path}` : `Collapse ${file.path}`}
					className="size-6 rounded-sm p-0 aria-expanded:border-transparent aria-expanded:bg-transparent aria-expanded:text-text-subtle aria-expanded:hover:bg-bg-neutral-subtle-hovered aria-expanded:active:bg-bg-neutral-subtle-pressed"
					onClick={() => setIsCollapsed((collapsed) => !collapsed)}
					size="icon-compact"
					variant="ghost"
				>
					<span className="relative inline-flex size-4 items-center justify-center">
						<span className="absolute inset-0 inline-flex items-center justify-center group-hover/file-header:opacity-0 group-has-[:focus-visible]/file-header:opacity-0">
							<FileExplorerFileIcon path={file.path} />
						</span>
						<span className="absolute inset-0 inline-flex items-center justify-center opacity-0 group-hover/file-header:opacity-100 group-has-[:focus-visible]/file-header:opacity-100">
							<Icon
								aria-hidden
								render={isCollapsed
									? <ChevronRightIcon label="" size="small" />
									: <ChevronDownIcon label="" size="small" />}
							/>
						</span>
					</span>
				</Button>
				<div className="flex min-w-0 flex-1 items-center gap-1">
					<span className="min-w-0 truncate" title={file.path}>{file.path}</span>
					<Button
						aria-label={`Copy path ${file.path}`}
						className={cn("shrink-0", FILE_HEADER_ACTION_CLASS_NAME)}
						onClick={handleCopyPath}
						size="icon-compact"
						title="Copy file path"
						variant="ghost"
					>
						<Icon aria-hidden render={<CopyIcon label="" size="small" />} />
					</Button>
				</div>
				<DiffStats additions={file.additions} deletions={file.deletions} />
			</div>
			{file.hunkHeader && !isCollapsed ? (
				<div className="flex min-h-7 items-center border-b border-border px-3 font-mono text-xs text-text-subtle">
					{file.hunkHeader}
				</div>
			) : null}
		</div>
	);

	return (
		<div className={cn("min-w-0", className)} onPointerCancelCapture={handlePointerCancel}>
			<MultiFileDiff<InlineCommentAnnotationMetadata>
				key={`${file.id}:${layout}:${selectionRevision}`}
				// disableFileHeader breaks light-mode rendering entirely (rows never mount);
				// a null custom header removes the built-in header without that code path.
				renderCustomHeader={showFileHeader ? renderFileHeader : () => null}
				oldFile={{
					name: file.path,
					contents: file.oldContents,
					lang: file.language,
				}}
				newFile={{
					name: file.path,
					contents: file.newContents,
					lang: file.language,
				}}
				lineAnnotations={readOnly ? [] : lineAnnotations}
				options={{
					collapsed: showFileHeader && isCollapsed,
					collapsedContextThreshold: 6,
					diffStyle: layout,
					enableGutterUtility: !readOnly,
					enableLineSelection: !readOnly,
					hunkSeparators: "line-info",
					lineHoverHighlight: "both",
					onLineSelected: readOnly ? undefined : handleLineSelected,
					theme: {
						light: "github-light",
						dark: "github-dark",
					},
					themeType: actualTheme,
					unsafeCSS: DIFF_UNSAFE_CSS,
				}}
				renderAnnotation={readOnly ? undefined : ({ metadata }) => (
					<InlineCommentAnnotation
						key={metadata.kind === "draft" ? metadata.draft.id : metadata.comment.id}
						metadata={metadata}
						onCancelDraft={onCancelDraft}
						onCommitDraft={onCommitDraft}
						onDeleteComment={onDeleteComment}
						onUpdateComment={onUpdateComment}
						onUpdateDraft={onUpdateDraft}
					/>
				)}
				renderGutterUtility={readOnly ? undefined : (getHoveredLine) => (
					<InlineCommentGutterButton
						getHoveredLine={getHoveredLine}
						onAddComment={handleKeyboardAddComment}
						onPointerSelect={handleGutterPointerSelect}
					/>
				)}
			/>
		</div>
	);
}
