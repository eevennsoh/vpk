import type { ComponentDetail } from "@/app/data/component-detail-types";

export const TOOL_DIRECTORY_DETAIL: ComponentDetail = {
		apiName: "ToolDirectoryDialog",
		description: "Figma-matched tools directory for browsing app categories, inspecting a tool, and adding or removing it from an agent.",
		importStatement: `import { ToolDirectoryDialog } from "@/components/blocks/tool-directory";`,
		usage: `import { ToolDirectoryDialog } from "@/components/blocks/tool-directory";
import type { ToolDirectoryTool } from "@/components/blocks/tool-directory";

const tools: ToolDirectoryTool[] = [
  {
    id: "atlassian",
    name: "Atlassian",
    byline: "Collaboration tools by Atlassian",
    categoryId: "project-management",
    description: "Specializes in collaboration tools designed primarily for software development and project management.",
    logoName: "atlassian",
    publisherName: "Atlassian",
    toolCount: 36,
    teammateCount: 258,
    verified: true,
  },
];

<ToolDirectoryDialog
  open={open}
  onOpenChange={setOpen}
  tools={tools}
  defaultAddedToolIds={["atlassian"]}
  onSelectTool={(tool) => console.log(tool.id)}
/>`,
		demoLayout: { previewHeight: "fixed" },
		props: [
			{
				name: "tools",
				type: "readonly ToolDirectoryTool[]",
				required: true,
				description: "Base catalog tools shown in the directory.",
			},
			{
				name: "sessionTools",
				type: "readonly ToolDirectoryTool[]",
				description: "Runtime-created tools appended to the catalog.",
			},
			{
				name: "addedToolIds",
				type: "readonly string[]",
				description: "Controlled list of tool IDs already added to the current agent.",
			},
			{
				name: "defaultAddedToolIds",
				type: "readonly string[]",
				description: "Initial uncontrolled list of tool IDs already added to the current agent.",
			},
			{
				name: "onAddedToolIdsChange",
				type: "(toolIds: readonly string[]) => void",
				description: "Called after Add to agent or Remove changes the selected tool's added state.",
			},
			{
				name: "onCreateTool",
				type: "() => void",
				description: "Optional handler for the New tool action in the modal header.",
			},
			{
				name: "open",
				type: "boolean",
				required: true,
				description: "Controlled dialog open state.",
			},
			{
				name: "onOpenChange",
				type: "(open: boolean) => void",
				required: true,
				description: "Called when the dialog requests an open-state change.",
			},
			{
				name: "onSelectTool",
				type: "(tool: ToolDirectoryTool) => void",
				description: "Called when a tool card or sidebar tool is selected.",
			},
			{
				name: "sidebarGroups",
				type: "readonly ToolDirectorySidebarGroup[]",
				description: "Optional legacy sidebar groups rendered below the category list.",
			},
			{
				name: "title",
				type: "string",
				description: "Optional dialog title. Defaults to the tools directory title.",
			},
		],
	};
