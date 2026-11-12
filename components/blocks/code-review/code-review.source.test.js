const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

function readProjectFile(relativePath) {
	return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("code review fixtures preserve the design contracts", () => {
	const workItem = readProjectFile("components/blocks/code-review/data/work-item.ts");
	const changedFiles = readProjectFile("components/blocks/code-review/data/changed-files.ts");
	const explorerTree = readProjectFile("components/blocks/code-review/data/explorer-tree.ts");

	assert.match(workItem, /TWC-109/u);
	assert.match(workItem, /acme-corp\/rfp-response-platform/u);
	assert.match(changedFiles, /ipc\.mp\.test\.ts/u);
	assert.match(explorerTree, /ipc\.mp\.test\.ts/u);
});

test("code review explorer-backed files stay selectable", () => {
	const explorer = readProjectFile(
		"components/blocks/code-review/components/editor/editor-explorer.tsx",
	);
	const treeData = readProjectFile(
		"components/blocks/code-review/lib/create-code-review-tree-data.ts",
	);

	assert.match(treeData, /file\.explorerPath/u);
	assert.match(treeData, /disabled: false/u);
	assert.match(explorer, /onFileSelect\(fileId\)/u);
	assert.match(explorer, /includeDemoTree = false/u);
	assert.match(explorer, /flattenEmptyDirectories/u);
	assert.match(explorer, /searchQuery=\{showSearch \? searchQuery : undefined\}/u);
	assert.match(explorer, /placeholder="Search"/u);
	assert.match(explorer, /InputGroup/u);
	assert.match(explorer, /InputGroupAddon/u);
	assert.match(explorer, /InputGroupInput/u);
	assert.match(explorer, /SearchIcon/u);
	assert.match(explorer, /className="px-2 pb-1"/u);
	assert.match(explorer, /showSearch \? "pt-3" : undefined/u);
	assert.match(explorer, /"px-1"/u);
});

test("code review editor starts directly with the file diff", () => {
	const diffView = readProjectFile(
		"components/blocks/code-review/components/diff-file-view.tsx",
	);

	assert.match(diffView, /file\.hunkHeader && !isCollapsed \? \(/u);
	assert.doesNotMatch(diffView, /\?\? "Diff"/u);
	assert.match(diffView, /\{file\.hunkHeader\}/u);
});

test("code review editor shows the selected file change counts", () => {
	const diffView = readProjectFile(
		"components/blocks/code-review/components/diff-file-view.tsx",
	);
	const diffStats = readProjectFile(
		"components/blocks/code-review/components/diff-stats.tsx",
	);

	assert.match(diffView, /import \{ DiffStats \} from "\.\/diff-stats"/u);
	assert.match(diffView, /<DiffStats additions=\{file\.additions\} deletions=\{file\.deletions\} \/>/u);
	assert.match(
		diffStats,
		/flex shrink-0 items-center gap-1 text-xs font-normal leading-4/u,
	);
	assert.match(diffStats, /text-text-danger/u);
	assert.match(diffStats, /text-text-success/u);
	assert.doesNotMatch(diffStats, /font-mono/u);
});

test("code review scrollbars reveal on interaction instead of at rest", () => {
	const editorPanel = readProjectFile(
		"components/blocks/code-review/components/editor/editor-panel.tsx",
	);
	const explorer = readProjectFile(
		"components/blocks/code-review/components/editor/editor-explorer.tsx",
	);

	for (const source of [editorPanel, explorer]) {
		assert.match(source, /\[data-slot=scroll-area-scrollbar\]\]:opacity-0/u);
		assert.match(source, /hover:\[&_\[data-slot=scroll-area-scrollbar\]\]:opacity-100/u);
		assert.match(source, /focus-within:\[&_\[data-slot=scroll-area-scrollbar\]\]:opacity-100/u);
	}
});
test("code review diff view preserves theme token contracts", () => {
	const diffView = readProjectFile(
		"components/blocks/code-review/components/diff-file-view.tsx",
	);

	assert.match(diffView, /github-light/u);
	assert.match(diffView, /github-dark/u);
});

test("code review diff restores the top inset above hunk content", () => {
	const diffView = readProjectFile(
		"components/blocks/code-review/components/diff-file-view.tsx",
	);

	assert.match(diffView, /DIFF_UNSAFE_CSS/u);
	assert.match(diffView, /--diffs-font-size: 12px/u);
	assert.match(diffView, /diffs-gap-inline/u);
	assert.match(diffView, /unsafeCSS: DIFF_UNSAFE_CSS/u);
});

test("code review uses collapsible line-info hunk separators", () => {
	const diffView = readProjectFile(
		"components/blocks/code-review/components/diff-file-view.tsx",
	);

	assert.match(diffView, /hunkSeparators: "line-info"/u);
	assert.match(diffView, /collapsedContextThreshold: 6/u);
});

test("code review extends Pierre gutter utilities and line annotations", () => {
	const diffView = readProjectFile(
		"components/blocks/code-review/components/diff-file-view.tsx",
	);
	const annotation = readProjectFile(
		"components/blocks/code-review/components/inline-comment-annotation.tsx",
	);

	assert.match(diffView, /<MultiFileDiff<InlineCommentAnnotationMetadata>/u);
	assert.match(diffView, /lineAnnotations=\{readOnly \? \[\] : lineAnnotations\}/u);
	assert.match(diffView, /enableGutterUtility: !readOnly/u);
	assert.match(diffView, /enableLineSelection: !readOnly/u);
	assert.match(diffView, /lineHoverHighlight: "both"/u);
	assert.match(diffView, /onLineSelected: readOnly \? undefined : handleLineSelected/u);
	assert.doesNotMatch(diffView, /onGutterUtilityClick/u);
	assert.doesNotMatch(diffView, /onLineNumberClick/u);
	assert.match(diffView, /renderAnnotation=\{readOnly \? undefined : \(\{ metadata \}\) => \(/u);
	assert.match(
		diffView,
		/key=\{metadata\.kind === "draft" \? metadata\.draft\.id : metadata\.comment\.id\}/u,
		"Pierre indexes annotation slots, so the rendered editor needs its own stable comment identity",
	);
	assert.match(diffView, /renderGutterUtility=\{readOnly \? undefined : \(getHoveredLine\) => \(/u);
	assert.match(annotation, /aria-label="Add inline comment"/u);
	assert.match(annotation, /event\.detail !== 0/u);
	assert.match(annotation, /onPointerDown=\{handlePointerDown\}/u);
	assert.doesNotMatch(annotation, /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/u);
	assert.match(diffView, /selectionStartedFromGutter/u);
	assert.match(diffView, /new PointerEventConstructor\("pointerdown"/u);
	assert.match(
		diffView,
		/\[data-column-number\]:has\(\[data-gutter-utility-slot\]\) \[data-line-number-content\]/u,
	);
	assert.match(
		annotation,
		/className="relative z-10 size-5 rounded-sm border-0 bg-surface-overlay p-0 text-icon-subtle shadow-2xl hover:bg-surface-overlay-hovered active:bg-surface-overlay-pressed"/u,
	);
	assert.match(
		diffView,
		/\[data-column-number\]:has\(\[data-gutter-utility-slot\]\) \[data-gutter-utility-slot\] \{\s*inset-inline: 0;\s*justify-content: center;\s*translate: 0\.5ch 0;/u,
	);
	assert.match(annotation, /event\.stopPropagation\(\)/u);
	assert.match(annotation, /event\.key === "Escape"/u);
	assert.match(annotation, /disabled=\{!canCommit\}/u);
	assert.match(annotation, /className="min-w-0 bg-surface-raised px-3 pb-3 pt-2 font-sans text-text"/u);
	assert.match(annotation, /className="mb-2 text-xs font-semibold text-text-subtlest"/u);
	assert.match(annotation, /Comment on \{lineLabel\.toLowerCase\(\)\}/u);
	assert.match(annotation, /aria-label=\{ariaLabel\}/u);
	assert.match(annotation, /<PromptInputTextarea/u);
	assert.match(annotation, /className="min-h-\[101px\] w-full rounded-xl/u);
	assert.doesNotMatch(annotation, /min-h-20/u);
	assert.match(annotation, /enableDirectoryAutocomplete=\{false\}/u);
	assert.match(annotation, /enableSuggestionMenus=\{false\}/u);
	assert.match(annotation, /placeholder=""/u);
	assert.match(annotation, /<Button[\s\S]*type="button"[\s\S]*Cancel/u);
	assert.match(annotation, /<Button disabled=\{!canCommit\} type="submit" variant="outline">[\s\S]*Comment/u);
	assert.match(annotation, /const isEditing = body !== comment\.body;/u);
	assert.match(annotation, /editorKey=\{comment\.body\}/u);
	assert.match(annotation, /key=\{editorKey\}/u);
	assert.match(annotation, /isEditing \? \([\s\S]*Cancel[\s\S]*Update[\s\S]*: \([\s\S]*Delete/u);
	assert.match(annotation, /<Button disabled=\{!canUpdate\} type="submit" variant="outline">[\s\S]*Update/u);
	assert.match(annotation, /onClick=\{\(\) => onDelete\(comment\.id\)\}[\s\S]*variant="outline"[\s\S]*Delete/u);
	assert.doesNotMatch(annotation, /size="compact"/u);
	assert.match(annotation, /aria-label=\{`Delete comment on/u);
});

test("code review owns comment state across files and diff layouts", () => {
	const source = readProjectFile(
		"components/blocks/code-review/components/code-review.tsx",
	);

	assert.match(
		source,
		/useState\(\(\) => \(\s*initialInlineComments && initialInlineComments\.length > 0\s*\? \{ drafts: EMPTY_INLINE_COMMENT_STATE\.drafts, comments: initialInlineComments \}\s*: EMPTY_INLINE_COMMENT_STATE\s*\)\)/u,
	);
	assert.match(source, /comments=\{inlineComments\.comments\}/u);
	assert.match(source, /drafts=\{inlineComments\.drafts\}/u);
	assert.match(source, /removeAllInlineComments/u);
	assert.match(source, /updateInlineComment/u);
	assert.match(source, /updateInlineCommentDraft/u);
	assert.match(source, /onInlineCommentsChange\?: \(comments: readonly InlineReviewComment\[\]\) => void/u);
	assert.match(
		source,
		/if \(next\.comments !== previous\.comments\) \{\s*onInlineCommentsChange\?\.\(next\.comments\);\s*\}/u,
	);
	assert.doesNotMatch(source, /useEffect\(\(\) => \{\s*onInlineCommentsChange/u);
});

test("code review sends committed comments as one-turn composer context", () => {
	const rail = readProjectFile(
		"components/blocks/code-review/components/code-review-canvas-right-rail.tsx",
	);
	const chip = readProjectFile(
		"components/blocks/code-review/components/inline-comments-composer-chip.tsx",
	);
	const sharedChip = readProjectFile(
		"components/ui-custom/comments-composer-chip.tsx",
	);

	assert.match(rail, /serializeInlineCommentsContext\(workItem, comments\)/u);
	assert.match(rail, /composerInputContext=\{hasInlineComments \? \{/u);
	assert.match(rail, /const INLINE_REVIEW_PROMPT = "Address these inline review comments\.";/u);
	assert.match(rail, /onSubmitStart: handleSubmitted/u);
	assert.match(rail, /onReviewSubmit\?\.\(\{ comments, prompt: INLINE_REVIEW_PROMPT \}\);/u);
	assert.match(rail, /onRemoveAllComments\(\);/u);
	assert.match(rail, /contextDescription: inlineCommentsContext \|\| undefined/u);
	assert.match(chip, /CommentsComposerChip/u);
	assert.match(chip, /subtitle: formatInlineCommentLineLabel\(comment\)/u);
	assert.match(chip, /Remove all inline comments/u);
	assert.match(chip, /testId="inline-comments-chip"/u);
	assert.match(sharedChip, /comments\.length === 1 \? "comment" : "comments"/u);
	assert.match(sharedChip, /ComposerContextChip/u);
	assert.doesNotMatch(sharedChip, /PopoverTitle|Inline review comments/u);
	assert.doesNotMatch(chip, /New|Old|side · line/u);
});

test("code review orchestrator defaults the editor to unified layout", () => {
	const source = readProjectFile(
		"components/blocks/code-review/components/code-review.tsx",
	);

	assert.match(source, /useState<DiffLayout>\("unified"\)/u);
});

test("code review renders expanded file changes with a collapsible navigation tree", () => {
	const codeReview = readProjectFile(
		"components/blocks/code-review/components/code-review.tsx",
	);
	const editorPanel = readProjectFile(
		"components/blocks/code-review/components/editor/editor-panel.tsx",
	);
	const diffView = readProjectFile(
		"components/blocks/code-review/components/diff-file-view.tsx",
	);

	assert.doesNotMatch(codeReview, /EDITOR_FILE|editorFileId|selectedEditorFile/u);
	assert.match(editorPanel, /EditorChangesPicker/u);
	assert.match(editorPanel, /files=\{files\}/u);
	assert.match(editorPanel, /useState\(false\)/u);
	assert.doesNotMatch(editorPanel, />Changes</u);
	assert.match(editorPanel, /aria-label=\{isExplorerVisible \? "Hide file tree" : "Show file tree"\}/u);
	assert.match(editorPanel, /aria-expanded=\{isExplorerVisible\}/u);
	assert.match(
		editorPanel,
		/data-code-review-editor-toolbar-start/u,
	);
	assert.match(
		editorPanel,
		/className="flex items-center gap-1"/u,
	);
	assert.match(
		editorPanel,
		/<div className="min-w-0 shrink-0">\s*<EditorChangesPicker[\s\S]*commits=\{commits\}[\s\S]*files=\{files\}[\s\S]*onScopeChange=\{setChangesScope\}[\s\S]*scope=\{changesScope\}[\s\S]*\/>\s*<\/div>/u,
	);
	assert.doesNotMatch(
		editorPanel,
		/EditorChangesPicker[^>]*className=\{?["'][^"']*m[ls]-/u,
	);
	assert.match(
		editorPanel,
		/className="shrink-0 aria-expanded:border-transparent aria-expanded:bg-transparent aria-expanded:text-text-subtle aria-expanded:hover:bg-bg-neutral-subtle-hovered aria-expanded:active:bg-bg-neutral-subtle-pressed"/u,
	);
	assert.match(
		editorPanel,
		/isExplorerVisible\s*\? <SidebarCollapseIcon label="" size="small" \/>\s*: <SidebarExpandIcon label="" size="small" \/>/u,
	);
	assert.match(editorPanel, /visibleFiles\.map\(\(file\) => \(/u);
	assert.match(editorPanel, /data-code-review-file-id=\{file\.id\}/u);
	assert.match(editorPanel, /showFileHeader/u);
	assert.match(
		editorPanel,
		/"min-w-0 divide-y divide-border"/u,
	);
	assert.doesNotMatch(
		editorPanel,
		/"min-w-0 divide-y divide-border border border-border"/u,
	);
	assert.match(
		editorPanel,
		/expandContent\s*\?\s*EXPAND_FILE_SCROLL_MARGIN_CLASS\s*:\s*"scroll-mt-4"/u,
	);
	assert.match(editorPanel, /"min-w-0 overflow-hidden bg-surface"/u);
	assert.doesNotMatch(
		editorPanel,
		/scroll-mt-4 overflow-hidden border border-border bg-surface/u,
	);
	assert.doesNotMatch(editorPanel, /<EditorDiff\s/u);
	assert.match(diffView, /renderCustomHeader=\{showFileHeader \? renderFileHeader : \(\) => null\}/u);
	assert.match(diffView, /const \[isCollapsed, setIsCollapsed\] = useState\(false\);/u);
	assert.match(diffView, /aria-label=\{isCollapsed \? `Expand \$\{file\.path\}` : `Collapse \$\{file\.path\}`\}/u);
	assert.match(
		diffView,
		/className="size-6 rounded-sm p-0 aria-expanded:border-transparent aria-expanded:bg-transparent aria-expanded:text-text-subtle aria-expanded:hover:bg-bg-neutral-subtle-hovered aria-expanded:active:bg-bg-neutral-subtle-pressed"/u,
	);
	assert.match(diffView, /aria-label=\{`Copy path \$\{file\.path\}`\}/u);
	assert.match(diffView, /navigator\.clipboard\?\.writeText\(file\.path\)\.catch/u);
	assert.match(
		diffView,
		/className=\{cn\(\s*"group\/file-header flex min-h-9 min-w-0 items-center gap-1 pl-1.5 pr-4 text-xs text-text",[\s\S]*?!isCollapsed \? "border-b border-border" : null,\s*\)\}/u,
	);
	assert.match(
		diffView,
		/<div className="flex min-w-0 flex-1 items-center gap-1">\s*<span className="min-w-0 truncate" title=\{file\.path\}>\{file\.path\}<\/span>\s*<Button\s+aria-label=\{`Copy path \$\{file\.path\}`\}/u,
	);
	assert.match(diffView, /relative inline-flex size-4 items-center justify-center/u);
	assert.match(
		diffView,
		/group-hover\/file-header:opacity-0 group-has-\[:focus-visible\]\/file-header:opacity-0/u,
	);
	assert.match(diffView, /group-hover\/file-header:opacity-100/u);
	assert.match(diffView, /group-has-\[:focus-visible\]\/file-header:opacity-100/u);
	assert.match(diffView, /collapsed: showFileHeader && isCollapsed/u);
	assert.match(diffView, /FileTree2FileIcon/u);
	assert.match(diffView, /FileTree2IconSprite/u);
	assert.match(diffView, /<FileTree2FileIcon path=\{file\.path\} \/>/u);
});

test("code review changes picker shows all-changes trigger with real totals and scope menu", () => {
	const picker = readProjectFile(
		"components/blocks/code-review/components/editor/editor-changes-picker.tsx",
	);
	const diffStats = readProjectFile(
		"components/blocks/code-review/components/diff-stats.tsx",
	);

	assert.match(picker, /"All changes"/u);
	assert.match(picker, /"Uncommitted"/u);
	assert.match(picker, /"Staged"/u);
	assert.match(picker, /"Unstaged"/u);
	assert.match(picker, /Commits/u);
	assert.match(picker, /"All commits"/u);
	assert.match(picker, /commits\?: readonly CodeReviewCommit\[\]/u);
	assert.match(picker, /commits = EMPTY_COMMITS/u);
	assert.match(picker, /commits\.map\(\(commit\) =>/u);
	assert.match(picker, /commit\.title\} · \$\{commit\.shortSha/u);
	assert.match(picker, /DropdownMenuSeparator/u);
	assert.match(picker, /\{commits\.length > 0 \? <DropdownMenuSeparator \/> : null\}/u);
	assert.match(
		picker,
		/commits\.map[\s\S]*DropdownMenuSeparator[\s\S]*selectScope\("all-commits"\)/u,
	);
	assert.match(picker, /sumChangedFileDiffStats\(files\)/u);
	assert.match(picker, /fileCountLabel/u);
	assert.match(picker, /import \{ DiffStats \} from "\.\.\/diff-stats"/u);
	assert.match(picker, /<DiffStats additions=\{additions\} deletions=\{deletions\} emphasized \/>/u);
	assert.match(
		diffStats,
		/flex shrink-0 items-center gap-1 text-xs font-normal leading-4/u,
	);
	assert.match(diffStats, /text-text-success/u);
	assert.match(diffStats, /text-text-danger/u);
	assert.doesNotMatch(diffStats, /font-mono/u);
	assert.match(picker, /ChevronDownIcon/u);
	assert.match(picker, /"text-text"/u);
	assert.doesNotMatch(
		picker,
		/aria-expanded:border-transparent|aria-pressed:border-transparent/u,
	);
	assert.match(
		picker,
		/text-icon-subtle group-aria-expanded\/button:text-icon-selected group-aria-pressed\/button:text-icon-selected/u,
	);
	assert.match(
		picker,
		/font-normal text-text-subtle group-aria-expanded\/button:text-text-selected group-aria-pressed\/button:text-text-selected/u,
	);
	assert.match(picker, /DropdownMenuSub/u);
	assert.match(picker, /data-code-review-changes-picker/u);
	assert.match(picker, /selected=\{scope === "all-changes"\}/u);
});

test("embedded CodeReview reuses the full EditorPanel surface", () => {
	const source = readProjectFile(
		"components/blocks/code-review/components/code-review.tsx",
	);
	const index = readProjectFile("components/blocks/code-review/index.ts");
	const editorPanel = readProjectFile(
		"components/blocks/code-review/components/editor/editor-panel.tsx",
	);
	const explorer = readProjectFile(
		"components/blocks/code-review/components/editor/editor-explorer.tsx",
	);
	const pullRequestFiles = readProjectFile(
		"components/blocks/jira-work-item/experimental-v2/components/pull-request-detail/pull-request-files.tsx",
	);

	assert.doesNotMatch(index, /CodeReviewFileBrowser/u);
	assert.match(source, /embedded\?: boolean/u);
	assert.match(source, /expandContent\?: boolean/u);
	assert.match(source, /commits\?: readonly CodeReviewCommit\[\]/u);
	assert.match(source, /defaultSelectedFileId\?: string/u);
	assert.match(source, /data-code-review-embedded/u);
	assert.match(source, /if \(embedded\) \{/u);
	assert.match(
		source,
		/<EditorPanel[\s\S]*comments=\{inlineComments\.comments\}[\s\S]*drafts=\{inlineComments\.drafts\}[\s\S]*expandContent=\{expandContent\}[\s\S]*onAddDraft=\{handleAddDraft\}/u,
	);
	assert.doesNotMatch(source, /\breadOnly\b|showSearch=\{false\}/u);
	assert.match(source, /No changed files\./u);
	assert.match(editorPanel, /data-code-review-editor-panel/u);
	assert.match(editorPanel, /showSearch = true/u);
	assert.match(editorPanel, /readOnly = false/u);
	assert.match(editorPanel, /<EditorChangesPicker[\s\S]*commits=\{commits\}[\s\S]*files=\{files\}[\s\S]*onScopeChange=\{setChangesScope\}[\s\S]*scope=\{changesScope\}/u);
	assert.match(explorer, /showSearch = true/u);
	assert.match(explorer, /\{showSearch \? \(/u);
	assert.match(
		pullRequestFiles,
		/<CodeReview[\s\S]*commits=\{commits\}[\s\S]*embedded[\s\S]*expandContent[\s\S]*explorerRootLabel="Guest checkout"[\s\S]*files=\{review\.files\}/u,
	);
});

test("embedded CodeReview expands EditorPanel without nested scrolling", () => {
	const source = readProjectFile(
		"components/blocks/code-review/components/code-review.tsx",
	);
	const editorPanel = readProjectFile(
		"components/blocks/code-review/components/editor/editor-panel.tsx",
	);
	const explorer = readProjectFile(
		"components/blocks/code-review/components/editor/editor-explorer.tsx",
	);
	const globalStyles = readProjectFile("app/globals.css");
	const pullRequestFiles = readProjectFile(
		"components/blocks/jira-work-item/experimental-v2/components/pull-request-detail/pull-request-files.tsx",
	);

	assert.match(source, /min-w-0 rounded-md border border-border bg-surface/u);
	assert.match(source, /expandContent \? undefined : "overflow-hidden"/u);
	assert.match(source, /expandContent=\{expandContent\}/u);
	assert.match(editorPanel, /expandContent \? "div" : ScrollArea/u);
	assert.match(editorPanel, /expandContent \? "items-start" : "min-h-0 flex-1"/u);
	assert.match(
		editorPanel,
		/expandContent \? "rounded-\[inherit\]" : "size-full min-h-0"/u,
	);
	assert.match(
		editorPanel,
		/EXPAND_STICKY_TOOLBAR_CLASS[\s\S]*sticky z-\[9\] top-\[var\(--pull-request-detail-header-height,0px\)\] rounded-t-\[inherit\] \[container-type:scroll-state\]/u,
	);
	assert.match(
		editorPanel,
		/EXPAND_STICKY_TREE_CLASS[\s\S]*sticky z-\[8\] self-start top-\[calc\(var\(--pull-request-detail-header-height,0px\)\+\(--spacing\(9\)\)\)\][\s\S]*rounded-bl-\[inherit\]/u,
	);
	assert.match(editorPanel, /className=\{expandContent \? EXPAND_STICKY_TREE_CLASS : undefined\}/u);
	assert.match(
		editorPanel,
		/expandContent \? EXPAND_STICKY_TOOLBAR_CLASS : "bg-surface-sunken"/u,
	);
	assert.match(
		editorPanel,
		/rounded-\[inherit\] bg-surface-sunken[\s\S]*data-code-review-sticky-toolbar-surface/u,
	);
	assert.match(
		globalStyles,
		/@container scroll-state\(stuck: top\)[\s\S]*\[data-code-review-sticky-toolbar-surface\][\s\S]*border-start-start-radius: 0;[\s\S]*border-start-end-radius: 0;/u,
	);
	assert.match(
		editorPanel,
		/expandContent\s*\?\s*isExplorerVisible\s*\?\s*"overflow-hidden rounded-br-\[inherit\]"\s*:\s*"overflow-hidden rounded-b-\[inherit\]"/u,
	);
	assert.match(explorer, /const ContentContainer = expandContent \? "div" : ScrollArea;/u);
	assert.doesNotMatch(pullRequestFiles, /\bh-96\b/u);
	assert.doesNotMatch(source, /min-h-\[[0-9]|h-\[[0-9]/u);
});

test("EditorPanel keeps search and inline comments enabled by default", () => {
	const editorPanel = readProjectFile(
		"components/blocks/code-review/components/editor/editor-panel.tsx",
	);
	const explorer = readProjectFile(
		"components/blocks/code-review/components/editor/editor-explorer.tsx",
	);
	const diffView = readProjectFile(
		"components/blocks/code-review/components/diff-file-view.tsx",
	);
	const source = readProjectFile(
		"components/blocks/code-review/components/code-review.tsx",
	);

	assert.match(
		readProjectFile("components/blocks/code-review/lib/create-code-review-tree-data.ts"),
		/if \(includeDemoTree\) \{[\s\S]*EXPLORER_TREE\.filter/u,
	);
	assert.match(explorer, /includeDemoTree = false/u);
	assert.match(editorPanel, /includeDemoTree=\{false\}/u);
	assert.match(editorPanel, /showSearch=\{showSearch\}/u);
	assert.match(editorPanel, /readOnly=\{readOnly\}/u);
	assert.doesNotMatch(source, /readOnly|showSearch=\{false\}/u);
	assert.match(diffView, /lineAnnotations=\{readOnly \? \[\] : lineAnnotations\}/u);
	assert.match(diffView, /enableGutterUtility: !readOnly/u);
	assert.match(diffView, /renderAnnotation=\{readOnly \? undefined/u);
	assert.match(diffView, /renderGutterUtility=\{readOnly \? undefined/u);
});

test("Code Review composes its editor into a Canvas with the shared Code Reviewer rail", () => {
	const source = readProjectFile(
		"components/blocks/code-review/components/code-review.tsx",
	);
	const header = readProjectFile(
		"components/blocks/code-review/components/code-review-canvas-header.tsx",
	);
	const rail = readProjectFile(
		"components/blocks/code-review/components/code-review-canvas-right-rail.tsx",
	);

	assert.match(source, /import \{ RovoCanvas \} from "@\/components\/blocks\/rovo-canvas\/page";/u);
	assert.match(source, /primaryActionLabel = "Create pull request"/u);
	assert.match(source, /<RovoCanvas[\s\S]*primaryActionLabel=\{primaryActionLabel\}/u);
	assert.match(source, /onPrimaryAction=\{onPrimaryAction\}/u);
	assert.match(source, /primaryActionMenu=\{showPrimaryActionMenu \? \(/u);
	assert.match(source, /title=\{`\$\{workItem\.key\}: \$\{workItem\.title\}`\}/u);
	assert.match(header, /label=\{`\$\{workItem\.key\}: \$\{workItem\.title\}`\}/u);
	assert.match(source, /id: "code"/u);
	assert.match(source, /files\.reduce\(/u);
	assert.match(
		source,
		/headerStart=\{<CodeReviewCanvasHeader additions=\{additions\} deletions=\{deletions\} workItem=\{workItem\} \/>\}/u,
	);
	assert.match(source, /rightRail=\{[\s\S]*<CodeReviewCanvasRightRail/u);
	assert.match(source, /agentProfile\?: RovoAgentProfile/u);
	assert.match(source, /agentProfile=\{agentProfile\}/u);
	assert.match(source, /hideComposerSourceAndModelControls\?: boolean/u);
	assert.match(source, /hideComposerSourceAndModelControls=\{hideComposerSourceAndModelControls\}/u);
	assert.doesNotMatch(rail, /hideAiDisclaimer/u);
	assert.match(rail, /agentProfile = CODE_REVIEWER_AGENT/u);
	assert.match(rail, /agentVariant = "custom"/u);
	assert.match(rail, /<RovoChatProvider[\s\S]*autoSelectAgentId=\{agentProfile\.id\}/u);
	assert.match(rail, /agentProfiles=\{\[agentProfile\]\}/u);
	assert.match(rail, /emptyGreetingPlacement=\{variantConfig\.emptyGreetingPlacement\}/u);
	assert.match(rail, /hideComposerSourceAndModelControls=\{hideComposerSourceAndModelControls\}/u);
	assert.match(rail, /showAgentBackButton=\{false\}/u);
	assert.match(rail, /showAgentSelector=\{false\}/u);
	assert.match(rail, /<ChatPanel[\s\S]*headerVariant="minimal"/u);
	assert.match(rail, /headerEndAction=\{variantConfig\.supportsExternalOpen \? \([\s\S]*aria-label=\{`Open \$\{agentProfile\.name\}`\}[\s\S]*LinkExternalIcon/u);
});

test("Code Review omits the dismiss placeholder for its persistent chat context", () => {
	const rail = readProjectFile(
		"components/blocks/code-review/components/code-review-canvas-right-rail.tsx",
	);

	assert.match(rail, /iconName: "branch"/u);
	assert.match(rail, /label: workItem\.localBranchName/u);
	assert.match(rail, /signature: `code-review-branch:\$\{workItem\.localBranchName\}`/u);
	assert.match(rail, /chatContextBar=\{\{[\s\S]*showDismissPlaceholder: false/u);
});

test("Code Review identifies the local device above its attached composer", () => {
	const rail = readProjectFile(
		"components/blocks/code-review/components/code-review-canvas-right-rail.tsx",
	);

	assert.match(rail, /import DevicesIcon from "@atlaskit\/icon\/core\/devices";/u);
	assert.match(rail, /import \{ IconTile \} from "@\/components\/ui\/icon-tile";/u);
	assert.match(rail, /supportsLocalSession: boolean/u);
	assert.match(rail, /composerSurfaceHeader=\{variantConfig\.supportsLocalSession \? \(/u);
	assert.match(rail, /<DevicesIcon label="" size="small" \/>/u);
	assert.match(rail, />Local · Carl’s MacBook Pro</u);
});

test("Code Review no longer owns a bespoke chat implementation", () => {
	const removedPaths = [
		"components/blocks/code-review/components/chat/chat-panel.tsx",
		"components/blocks/code-review/components/chat/chat-composer.tsx",
		"components/blocks/code-review/data/chat-script.ts",
	];

	for (const removedPath of removedPaths) {
		assert.equal(
			fs.existsSync(path.join(process.cwd(), removedPath)),
			false,
			`expected ${removedPath} to be removed`,
		);
	}
});

test("code review public barrel and demo expose the composition root", () => {
	const index = readProjectFile("components/blocks/code-review/index.ts");
	const page = readProjectFile("components/blocks/code-review/page.tsx");

	assert.match(index, /export \{ CodeReview \} from "\.\/components\/code-review";/u);
	// The standalone block page opens the review canvas by default (the launcher
	// button is only the reopen-after-close affordance).
	assert.match(page, /<CodeReview defaultOpen \/>/u);
});

test("code review editor retains interaction contracts", () => {
	const explorer = readProjectFile(
		"components/blocks/code-review/components/editor/editor-explorer.tsx",
	);
	const treeData = readProjectFile(
		"components/blocks/code-review/lib/create-code-review-tree-data.ts",
	);

	assert.match(explorer, /from "@\/components\/ui-custom\/file-tree-2";/u);
	assert.match(explorer, /<FileTree2/u);
	assert.match(treeData, /const changedFilesRootPath = `\$\{rootPath\}\/CHANGED FILES`;/u);
	assert.match(explorer, /fileIdsByPath\.get\(path\)/u);
	assert.doesNotMatch(explorer, /FileTreeFile|FileTreeFolder/u);
});

test("Code Review is registered as a website block in both catalog files", () => {
	assert.match(
		readProjectFile("app/data/component-manifest.ts"),
		/blockComponent\(\s*"code-review",\s*"Code Review"\s*\)/u,
	);
	assert.match(
		readProjectFile("app/data/components.ts"),
		/blockComponent\(\s*"code-review",\s*"Code Review"\s*\)/u,
	);
});

test("Code Review detail is imported and mapped in the blocks details barrel", () => {
	const source = readProjectFile("app/data/details/blocks.ts");

	assert.match(
		source,
		/import\s*\{\s*CODE_REVIEW_DETAIL\s*\}\s*from\s*"\.\/blocks\/code-review";/u,
	);
	assert.match(source, /"code-review"\s*:\s*CODE_REVIEW_DETAIL\s*,/u);
});

test("Code Review demo is registered as an ssr:false dynamic import", () => {
	const registry = readProjectFile("components/website/registry/blocks.ts");

	assert.match(
		registry,
		/"code-review"\s*:\s*dynamic\(\s*\(\)\s*=>\s*import\(\s*"\.\.\/demos\/blocks\/code-review-demo"\s*\)\s*,\s*\{\s*ssr\s*:\s*false\s*,?\s*\}\s*\)/u,
	);
});

test("Code Review demo launches each agent placement variant from the preview", () => {
	const demo = readProjectFile(
		"components/website/demos/blocks/code-review-demo.tsx",
	);

	assert.match(demo, /label: "3P \(Cloud\)"[\s\S]*value: "third-party-cloud"/u);
	assert.match(demo, /label: "3P \(Local\)"[\s\S]*value: "third-party-local"/u);
	assert.match(demo, /label: "Custom agents"[\s\S]*value: "custom"/u);
	assert.match(demo, /label: "Rovo"[\s\S]*value: "rovo"/u);
	assert.match(demo, /aria-label="Open code review variant"/u);
	assert.match(demo, /onClick=\{\(\) => setAgentVariant\(variant\.value\)\}/u);
	assert.match(demo, /open=\{selectedVariant !== null\}/u);
	assert.match(demo, /agentVariant=\{selectedVariant\?\.value \?\? "custom"\}/u);
	assert.doesNotMatch(demo, /defaultOpen|feedbackBanner|aria-pressed/u);
});

test("Code Review agent types explicitly control empty greeting placement", () => {
	const rail = readProjectFile(
		"components/blocks/code-review/components/code-review-canvas-right-rail.tsx",
	);
	const sidebarChat = readProjectFile(
		"components/projects/sidebar-chat/page.tsx",
	);
	const kanbanStage = readProjectFile(
		"components/projects/jira-golden-journey-v1/components/kanban-stage.tsx",
	);
	const chatGreeting = readProjectFile(
		"components/projects/sidebar-chat/components/chat-greeting.tsx",
	);

	assert.match(rail, /case "third-party-cloud":[\s\S]*emptyGreetingPlacement: "centered"/u);
	assert.match(rail, /case "third-party-local":[\s\S]*emptyGreetingPlacement: "centered"/u);
	assert.match(rail, /case "custom":[\s\S]*emptyGreetingPlacement: "near-composer"/u);
	assert.match(rail, /case "rovo":[\s\S]*emptyGreetingPlacement: "near-composer"/u);
	assert.match(rail, /case "third-party-cloud":[\s\S]*supportsExternalOpen: false,[\s\S]*supportsLocalSession: false,/u);
	assert.match(rail, /case "third-party-local":[\s\S]*supportsExternalOpen: true,[\s\S]*supportsLocalSession: true,/u);
	assert.match(rail, /case "custom":[\s\S]*supportsExternalOpen: false,[\s\S]*supportsLocalSession: false,/u);
	assert.match(rail, /case "rovo":[\s\S]*supportsExternalOpen: false,[\s\S]*supportsLocalSession: false,[\s\S]*usesDefaultRovoGreeting: true,/u);
	assert.match(rail, /greeting=\{variantConfig\.usesDefaultRovoGreeting \? undefined : \{/u);
	assert.match(chatGreeting, /heading = "How can I help\?"/u);
	assert.match(chatGreeting, /const greetingSuggestions = suggestions \?\? defaultSuggestions/u);
	assert.match(sidebarChat, /emptyGreetingPlacement = "near-composer"/u);
	assert.match(sidebarChat, /emptyGreetingPlacement === "centered" && !hasMessages/u);
	assert.match(kanbanStage, /agentVariant="third-party-local"/u);
});

test("Code Review polish contracts show list headers and label the shared explorer", () => {
	const diffView = readProjectFile(
		"components/blocks/code-review/components/diff-file-view.tsx",
	);
	const explorer = readProjectFile(
		"components/blocks/code-review/components/editor/editor-explorer.tsx",
	);

	assert.match(diffView, /renderCustomHeader=\{showFileHeader \? renderFileHeader : \(\) => null\}/u);
	assert.match(diffView, /<FileTree2FileIcon path=\{file\.path\} \/>/u);
	assert.match(diffView, /FileTree2IconSprite/u);
	assert.match(
		diffView,
		/className=\{cn\(\s*"group\/file-header flex min-h-9 min-w-0 items-center gap-1 pl-1.5 pr-4 text-xs text-text",[\s\S]*?!isCollapsed \? "border-b border-border" : null,\s*\)\}/u,
	);
	assert.match(explorer, /aria-label="Code review files"/u);
	assert.match(explorer, /hover:\[&_\[data-slot=scroll-area-scrollbar\]\]:opacity-100/u);
	assert.match(explorer, /\[&_\[data-slot=scroll-area-scrollbar\]\]:opacity-0/u);
	assert.match(
		readProjectFile("components/blocks/code-review/lib/create-code-review-tree-data.ts"),
		/"package\.json": "renamed"/u,
	);
	assert.match(
		readProjectFile("components/blocks/code-review/lib/create-code-review-tree-data.ts"),
		/"node_modules": "ignored"/u,
	);
	assert.match(explorer, /explorerRootLabel = CODE_REVIEW_ROOT_PATH/u);
	assert.match(explorer, /defaultExpandedPaths=\{defaultExpandedPaths\}/u);
	assert.match(explorer, /flattenEmptyDirectories/u);
});

test("Code Review moves its shared artefact identity into the canvas header", () => {
	const source = readProjectFile(
		"components/blocks/code-review/components/code-review.tsx",
	);
	const header = readProjectFile(
		"components/blocks/code-review/components/code-review-canvas-header.tsx",
	);
	const canvas = readProjectFile(
		"components/blocks/rovo-canvas/components/rovo-canvas.tsx",
	);

	assert.match(source, /showArtefactIdentity=\{false\}/u);
	assert.match(header, /RovoCanvasArtefactIdentity/u);
	assert.match(header, /icon=\{<TaskIcon label="" color=\{token\("color\.icon\.brand"\)\} \/>\}/u);
	assert.match(header, /variant="blue"/u);
	assert.match(
		header,
		/<GithubLogo[\s\S]*borderless[\s\S]*size="xxsmall"/u,
	);
	assert.match(
		header,
		/<span className="shrink-0 text-text">\{workItem\.branchName\}<\/span>[\s\S]*<MetadataPathValue path=\{workItem\.localBranchName\} \/>/u,
	);
	assert.doesNotMatch(header, /AngleBracketsIcon/u);
	assert.doesNotMatch(header, /variant="blueBold"/u);
	assert.doesNotMatch(header, /Lozenge/u);
	assert.doesNotMatch(header, /workItem\.environment/u);
	assert.match(canvas, /export function RovoCanvasArtefactIdentity/u);
	assert.match(canvas, /showArtefactIdentity = true/u);
	assert.match(canvas, /showArtefactIdentity \? \(/u);
	assert.match(canvas, /flex size-full min-h-0 flex-col gap-0/u);
});

test("Code Review provides a manual launch control after the canvas closes", () => {
	const source = readProjectFile(
		"components/blocks/code-review/components/code-review.tsx",
	);

	assert.match(source, /const \[internalOpen, setInternalOpen\] = useState\(defaultOpen\);/u);
	assert.match(source, /const isControlled = open !== undefined;/u);
	assert.match(source, /!isControlled && !isCanvasOpen \? \(/u);
	assert.match(source, /<Button onClick=\{\(\) => setCanvasOpen\(true\)\}>/u);
	assert.match(source, /Open code review/u);
});

test("Code Review supports a caller-owned launch trigger", () => {
	const source = readProjectFile(
		"components/blocks/code-review/components/code-review.tsx",
	);

	assert.match(source, /open\?: boolean;/u);
	assert.match(source, /onOpenChange\?: \(open: boolean\) => void;/u);
	assert.match(source, /const isCanvasOpen = open \?\? internalOpen;/u);
	assert.match(source, /onOpenChange\?\.\(nextOpen\);/u);
});

test("Code Review owns its pull-request actions; the shared canvas header does not", () => {
	const codeReview = readProjectFile(
		"components/blocks/code-review/components/code-review.tsx",
	);
	const header = readProjectFile(
		"components/blocks/rovo-canvas/components/rovo-canvas-header.tsx",
	);

	// The code-review caller supplies the PR-specific split-menu items.
	assert.match(codeReview, /primaryActionMenu=\{/u);
	assert.match(codeReview, /Create draft pull request/u);
	assert.match(codeReview, /Commit &amp; Push/u);

	// The shared header must NOT hardcode pull-request actions, so report and
	// dashboard canvases (rfp report, sidebar-chat artifacts) never advertise
	// capabilities they lack. It renders the split button only when a caller
	// supplies primaryActionMenu, and a plain button otherwise.
	assert.doesNotMatch(header, /Create draft pull request/u);
	assert.doesNotMatch(header, /Commit &amp; Push/u);
	assert.match(header, /primaryActionMenu \? \(/u);
});

test("Code Review composition no longer renders a code summary screen", () => {
	const source = readProjectFile(
		"components/blocks/code-review/components/code-review.tsx",
	);

	assert.doesNotMatch(source, /SummaryPanel/u);
	assert.doesNotMatch(source, /"summary" \| "editor"/u);
	assert.match(source, /<EditorPanel/u);
});

test("Code Review summary screen files are removed", () => {
	const removedPaths = [
		"components/blocks/code-review/components/summary/summary-panel.tsx",
		"components/blocks/code-review/components/summary/summary-rail.tsx",
		"components/blocks/code-review/components/summary/summary-toolbar.tsx",
		"components/blocks/code-review/components/summary/summary-file-accordion.tsx",
		"components/blocks/code-review/components/summary/summary-change-card.tsx",
		"components/blocks/code-review/components/diff-stat.tsx",
		"components/blocks/code-review/components/editor/editor-diff.tsx",
		"components/blocks/code-review/data/change-sets.ts",
		"components/blocks/code-review/lib/filter-files.ts",
	];

	for (const removedPath of removedPaths) {
		assert.equal(
			fs.existsSync(path.join(process.cwd(), removedPath)),
			false,
			`expected ${removedPath} to be removed`,
		);
	}
});
