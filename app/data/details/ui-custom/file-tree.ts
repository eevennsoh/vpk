import type { ComponentDetail } from "@/app/data/component-detail-types";

export const FILE_TREE_DETAIL: ComponentDetail = {
	description:
		"The files the agent changed, as a folder tree. Each folder is a Collapsible whose trigger is a ghost Button, and each file is a ghost Button that selects its path. Rows are tree items with arrow-key navigation, and expand/select state can be controlled or uncontrolled.",
	usage: `import {
  FileTree,
  FileTreeFolder,
  FileTreeFile,
  FileTreeIcon,
  FileTreeName,
  FileTreeActions,
} from "@/components/ui-custom/file-tree";

<FileTree
  defaultExpanded={new Set(["src"])}
  selectedPath={selectedPath}
  onSelect={setSelectedPath}
>
  <FileTreeFolder path="src" name="src">
    <FileTreeFile path="src/index.ts" name="index.ts" />
    <FileTreeFile path="src/utils.ts" name="utils.ts" />
  </FileTreeFolder>
  <FileTreeFile path="package.json" name="package.json" />
</FileTree>`,
	props: [
		{
			name: "expanded",
			type: "Set<string>",
			description: "Controlled expanded folder paths.",
		},
		{
			name: "defaultExpanded",
			type: "Set<string>",
			default: "new Set()",
			description: "Default expanded folder paths for uncontrolled usage.",
		},
		{
			name: "selectedPath",
			type: "string",
			description: "Currently selected file or folder path.",
		},
		{
			name: "onSelect",
			type: "(path: string) => void",
			description: "Callback when a file or folder is selected.",
		},
		{
			name: "onExpandedChange",
			type: "(expanded: Set<string>) => void",
			description: "Callback when expanded folder paths change.",
		},
		{
			name: "className",
			type: "string",
			description: "Additional classes applied to the root container.",
		},
	],
	subComponents: [
		{ name: "FileTree", description: "Root container with the tree role, expand/select state, and arrow-key navigation (Up/Down/Home/End move, Right opens or enters a folder, Left closes it or returns to the parent)." },
		{ name: "FileTreeFolder", description: "A Collapsible whose CollapsibleTrigger renders a ghost Button with chevron, folder icon, and name; clicking toggles and selects the folder. Children render in CollapsibleContent." },
		{ name: "FileTreeFile", description: "A ghost Button that calls onSelect with its path, with an optional custom icon or custom row content. FileTreeActions in its children render next to the Button, not inside it." },
		{ name: "FileTreeIcon", description: "Inline icon wrapper for custom file or folder icons." },
		{ name: "FileTreeName", description: "Truncated text display for file or folder names." },
		{ name: "FileTreeActions", description: "Right-aligned action button container with click propagation isolation, rendered beside the file's row Button." },
	],
	examples: [
		{ title: "Custom icons", description: "File-type-specific icons for code, image, JSON, and text files.", demoSlug: "file-tree-demo-custom-icons" },
		{ title: "With actions", description: "File rows with inline copy, download, and delete action buttons.", demoSlug: "file-tree-demo-with-actions" },
	],
};
