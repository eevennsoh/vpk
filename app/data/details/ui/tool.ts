import type { ComponentDetail } from "@/app/data/component-detail-types";

export const TOOL_DETAIL: ComponentDetail = {
	description:
		"A tool call the agent makes, from input to output. Tool is a collapsible Trace line that says what happened (“Running …”, “Ran …”, “Failed to run …”) and opens to the input and output in Code Blocks.",
	usage: `import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ui/tool";

<Tool>
  <ToolHeader type={part.type} state={part.state} title="git status --short" />
  <ToolContent>
    <ToolInput input={part.input} />
    <ToolOutput output={part.output} errorText={part.errorText} />
  </ToolContent>
</Tool>`,
	props: [
		{
			name: "type / state / toolName",
			type: "ToolUIPart or DynamicToolUIPart fields",
			required: true,
			description: "ToolHeader only. The state picks the verb and status: Running (shimmer), Ran, Failed to run (error), Denied, Waiting to run (pending).",
		},
		{
			name: "title",
			type: "string",
			description: "ToolHeader only. The tool's display name after the verb. Defaults to the name in type, or toolName.",
		},
		{
			name: "label",
			type: "string",
			description: "ToolHeader only. The whole line text, for callers that already phrase the action. Replaces verb and title.",
		},
		{
			name: "leadingIcon",
			type: "ReactNode",
			description: "ToolHeader only. Icon before the title. Defaults to a wrench.",
		},
		{
			name: "input",
			type: "unknown",
			required: true,
			description: "ToolInput only. Shown as JSON in a Parameters Code Block, capped for large payloads.",
		},
		{
			name: "output / errorText",
			type: "unknown / string",
			required: true,
			description: "ToolOutput only. The result in a Code Block, and the error in a destructive one.",
		},
		{
			name: "outputPreview / outputTruncated / outputBytes / suppressedRawOutput",
			type: "string / boolean / number / boolean",
			description: "ToolOutput only. A preserved preview for when the raw output was dropped, with notices for truncation and size.",
		},
		{
			name: "codeBlockSize",
			type: '"default" | "sm"',
			default: '"sm"',
			description: "ToolInput and ToolOutput. Code Block size.",
		},
	],
	subComponents: [
		{ name: "Tool", description: "Trace with a TraceCollapsible." },
		{ name: "ToolHeader", description: "TraceCollapsibleTrigger with an icon and the verb-based title." },
		{ name: "ToolContent", description: "TraceCollapsibleContent for the input and output." },
		{ name: "ToolInput", description: "Parameters Code Block." },
		{ name: "ToolOutput", description: "Result or Error Code Block." },
		{ name: "getStatusLozenge", description: "The AI Elements status badge, for callers outside Tool." },
	],
	examples: [
		{ title: "States", description: "Map each tool part state to a verb and status.", demoSlug: "tool-demo-states" },
		{ title: "Input and output", description: "A finished call opens to its parameters and result.", demoSlug: "tool-demo-input-output" },
		{ title: "Custom label", description: "Pass label when the caller already phrases the action.", demoSlug: "tool-demo-label" },
	],
};
