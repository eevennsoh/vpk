import type { ComponentDetail } from "@/app/data/component-detail-types";

export const SANDBOX_DETAIL: ComponentDetail = {
	description:
		"A collapsible container for displaying AI-generated code alongside execution output, with status indicators and tabbed navigation between code and output views. Integrates with the AI SDK's ToolUIPart state to show code execution progress.",
	usage: `import {
  Sandbox,
  SandboxHeader,
  SandboxContent,
  SandboxTabs,
  SandboxTabsBar,
  SandboxTabsList,
  SandboxTabsTrigger,
  SandboxTabContent,
} from "@/components/ui-custom/sandbox";
import { CodeBlock } from "@/components/ui/code-block";
import { HighlightedCodeContent } from "@/components/ui-custom/highlighted-code-content";

<Sandbox>
  <SandboxHeader state={toolPart.state} title="code.tsx" />
  <SandboxContent>
    <SandboxTabs defaultValue="code">
      <SandboxTabsBar>
        <SandboxTabsList>
          <SandboxTabsTrigger value="code">Code</SandboxTabsTrigger>
          <SandboxTabsTrigger value="output">Output</SandboxTabsTrigger>
        </SandboxTabsList>
      </SandboxTabsBar>
      <SandboxTabContent value="code">
        <CodeBlock>
          <HighlightedCodeContent code={code} language="tsx" />
        </CodeBlock>
      </SandboxTabContent>
      <SandboxTabContent value="output">
        <CodeBlock>
          <HighlightedCodeContent code={output} language="log" />
        </CodeBlock>
      </SandboxTabContent>
    </SandboxTabs>
  </SandboxContent>
</Sandbox>`,
	demoLayout: {
		previewContentWidth: "full",
		examplesContentWidth: "full",
	},
	props: [
		{
			name: "state",
			type: 'ToolUIPart["state"]',
			required: true,
			description: "Execution state from the AI SDK ToolUIPart, rendered as a status lozenge in the header.",
		},
		{
			name: "title",
			type: "string",
			description: "Filename or label displayed in the header next to the code icon.",
		},
		{
			name: "defaultOpen",
			type: "boolean",
			default: "true",
			description: "Initial expanded state of the collapsible container.",
		},
		{
			name: "className",
			type: "string",
			description: "Additional classes applied to the root Collapsible container.",
		},
	],
	subComponents: [
		{ name: "Sandbox", description: "Root Collapsible container with border and rounded corners. Defaults to open." },
		{ name: "SandboxHeader", description: "Collapsible trigger row with code icon, title, status lozenge, and chevron." },
		{ name: "SandboxContent", description: "Animated collapsible content area with slide/fade transitions." },
		{ name: "SandboxTabs", description: "Tabs wrapper for code/output views." },
		{ name: "SandboxTabsBar", description: "Container for the tab list with top and bottom borders." },
		{ name: "SandboxTabsList", description: "Tab list with transparent background and no rounding." },
		{ name: "SandboxTabsTrigger", description: "Individual tab button with active underline indicator." },
		{ name: "SandboxTabContent", description: "Tab content panel with no top margin." },
	],
	examples: [
		{ title: "Running", description: "Sandbox in running state with animated status lozenge.", demoSlug: "sandbox-demo-running" },
		{ title: "Error", description: "Error state with output tab showing stack trace.", demoSlug: "sandbox-demo-error" },
		{ title: "Collapsed", description: "Sandbox starting in collapsed state.", demoSlug: "sandbox-demo-collapsed" },
	],
};
