import type { ComponentDetail } from "@/app/data/component-detail-types";

export const FILE_EXPLORER_DETAIL: ComponentDetail = {
	description:
		"A path-first file explorer inspired by Trees. It includes optional flattened folder chains, the complete colored file-type icon set, hover-revealed indentation guides, keyboard navigation, search, Git status, and row annotations.",
	usage: `import { FileExplorer } from "@/components/ui-custom/file-explorer";

<FileExplorer
  items={[
    { path: "src/components/Button.tsx", status: "modified" },
    { path: "src/index.ts" },
    { path: "package.json" },
  ]}
  defaultExpandedPaths={["src"]}
  dragAndDrop
  flattenEmptyDirectories
  onMove={handleMove}
  selectedPath={selectedPath}
  onSelectedPathChange={setSelectedPath}
  searchable
/>`,
	props: [
		{
			name: "dragAndDrop",
			type: "boolean",
			default: "false",
			description: "Enables moving files and folders onto directories or the tree root. Dragging is disabled while search is active.",
		},
		{
			name: "canDrag",
			type: "(path: string, item: FileExplorerItem) => boolean",
			description: "Optionally prevents specific paths from being dragged.",
		},
		{
			name: "onMove",
			type: "(event: FileExplorerMoveEvent) => void",
			description: "Called with the source, destination folder, and next canonical path after a valid drop. Update items from this callback to persist the move.",
		},
		{
			name: "openOnDropDelay",
			type: "number",
			default: "600",
			description: "Delay in milliseconds before a collapsed folder opens while it is a valid drop target.",
		},
		{
			name: "flattenEmptyDirectories",
			type: "boolean",
			default: "false",
			description: "Collapses each single-child folder chain into one row while preserving the terminal folder's canonical path for expansion and selection.",
		},
		{
			name: "icons",
			type: '"minimal" | "standard" | "complete" | FileTreeIconConfig',
			default: '"complete"',
			description: "Trees-compatible icon configuration. The complete colored file-type set is enabled by default, with file-name and extension remapping support.",
		},
		{
			name: "items",
			type: "readonly FileExplorerItem[]",
			required: true,
			description: "Canonical path items. Missing ancestor folders are created automatically.",
		},
		{
			name: "expandedPaths",
			type: "ReadonlySet<string>",
			description: "Controlled set of expanded folder paths. Flattened rows use the terminal folder path.",
		},
		{
			name: "defaultExpandedPaths",
			type: "Iterable<string>",
			default: "[]",
			description: "Initially expanded folder paths for uncontrolled usage. Flattened rows use the terminal folder path.",
		},
		{
			name: "selectedPath",
			type: "string",
			description: "Controlled selected path. Focus remains independent for keyboard navigation.",
		},
		{
			name: "defaultSelectedPath",
			type: "string",
			description: "Initially selected path for uncontrolled usage.",
		},
		{
			name: "onSelectedPathChange",
			type: "(path: string, item: FileExplorerItem) => void",
			description: "Called when a selectable row is activated.",
		},
		{
			name: "onExpandedPathsChange",
			type: "(paths: ReadonlySet<string>) => void",
			description: "Called when a folder is expanded or collapsed.",
		},
		{
			name: "searchable",
			type: "boolean",
			default: "false",
			description: "Shows a search input and filters paths using the configured search mode.",
		},
		{
			name: "searchMode",
			type: '"hide-non-matches" | "collapse-non-matches" | "expand-matches"',
			default: '"hide-non-matches"',
			description: "Controls how non-matching paths behave while searching. By default, only matches and their ancestors remain visible.",
		},
	],
	subComponents: [
		{
			name: "FileExplorerItem",
			description: "Path-first item data with optional type, icon, Git status, annotation, and disabled state. Status supports added, deleted, ignored, modified, renamed, and untracked files; changed ancestors receive a dot automatically.",
		},
	],
	examples: [
		{
			title: "Drag and drop",
			description: "Moves files and folder subtrees onto directories or the root, with a configurable path lock and reset control.",
			demoSlug: "file-explorer-demo-drag-and-drop",
		},
		{
			title: "Flatten empty directories",
			description: "Compares the expanded hierarchy with compact single-row folder chains.",
			demoSlug: "file-explorer-demo-flatten-empty-directories",
		},
		{
			title: "Path-first input",
			description: "Creates the folder hierarchy directly from canonical file paths.",
			demoSlug: "file-explorer-demo-path-first",
		},
		{
			title: "Icon rules",
			description: "Uses the complete built-in set and the documented file-name and extension resolution rules.",
			demoSlug: "file-explorer-demo-icon-rules",
		},
		{
			title: "Git status",
			description: "Shows M/A/D/R/U indicators, muted ignored items, semantic file colors, and automatic change dots on ancestor folders.",
			demoSlug: "file-explorer-demo-git-status",
		},
	],
	adsLinks: [
		{ label: "Trees item actions", url: "https://trees.software/docs#rename-drag-and-trigger-item-actions" },
		{ label: "Trees tree-shape options", url: "https://trees.software/docs#shared-concepts-tree-shape-options" },
		{ label: "Trees styling and theming", url: "https://trees.software/docs#styling-and-theming" },
		{ label: "Trees icons", url: "https://trees.software/docs#icons" },
	],
};
