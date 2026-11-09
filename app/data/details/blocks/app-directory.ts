import type { ComponentDetail } from "@/app/data/component-detail-types";

export const APP_DIRECTORY_DETAIL: ComponentDetail = {
		apiName: "AppDirectoryDialog",
		description: "Duplicate of the tools directory for browsing app categories, inspecting an app, and adding or removing it from an agent.",
		importStatement: `import { AppDirectoryDialog } from "@/components/blocks/app-directory";`,
		usage: `import { AppDirectoryDialog } from "@/components/blocks/app-directory";
import type { AppDirectoryTool } from "@/components/blocks/app-directory";

const tools: AppDirectoryTool[] = [
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

<AppDirectoryDialog
  open={open}
  onOpenChange={setOpen}
  tools={tools}
  defaultAddedToolIds={["atlassian"]}
  onSelectTool={(tool) => console.log(tool.id)}
/>`,
		demoLayout: { previewHeight: "fixed" },
		examples: [
			{
				title: "Standard",
				description: "Default sidebar directory with category navigation and company groups.",
				demoSlug: "app-directory-demo-standard",
			},
			{
				title: "Experimental",
				description: "Dense browse layout with full-width search and searchable multi-select filter dropdowns.",
				demoSlug: "app-directory-demo-experimental",
			},
		],
		props: [
			{
				name: "tools",
				type: "readonly AppDirectoryTool[]",
				required: true,
				description: "Base catalog apps shown in the directory.",
			},
			{
				name: "sessionTools",
				type: "readonly AppDirectoryTool[]",
				description: "Runtime-created apps appended to the catalog.",
			},
			{
				name: "addedToolIds",
				type: "readonly string[]",
				description: "Controlled list of app IDs already added to the current agent.",
			},
			{
				name: "defaultAddedToolIds",
				type: "readonly string[]",
				description: "Initial uncontrolled list of app IDs already added to the current agent.",
			},
			{
				name: "onAddedToolIdsChange",
				type: "(toolIds: readonly string[]) => void",
				description: "Called after the card switch, Add to agent, or Remove changes an app's added state.",
			},
			{
				name: "onCreateTool",
				type: "() => void",
				description: "Optional handler for the New app action in the modal header.",
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
				type: "(tool: AppDirectoryTool) => void",
				description: "Called when an app card or sidebar app is selected.",
			},
			{
				name: "sidebarGroups",
				type: "readonly AppDirectorySidebarGroup[]",
				description: "Optional legacy sidebar groups rendered below the category list.",
			},
			{
				name: "title",
				type: "string",
				description: "Optional dialog title. Defaults to the apps directory title.",
			},
			{
				name: "variant",
				type: "\"default\" | \"experimental\"",
				default: "\"default\"",
				description: "Opt-in layout variation. The default sidebar directory remains unchanged.",
			},
		],
	};
