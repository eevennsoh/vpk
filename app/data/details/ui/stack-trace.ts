import type { ComponentDetail } from "@/app/data/component-detail-types";

export const STACK_TRACE_DETAIL: ComponentDetail = {
	description:
		"A line for a tool call that failed. Stack Trace is a collapsible Trace: the error is the title, like “Failed: TypeError”, and opening it shows the stack frames, with the node_modules frames dimmed so your own frames stand out.",
	usage: `import {
  StackTrace,
  StackTraceActions,
  StackTraceContent,
  StackTraceCopyButton,
  StackTraceError,
  StackTraceErrorMessage,
  StackTraceErrorType,
  StackTraceFrames,
  StackTraceHeader,
} from "@/components/ui/stack-trace";

<StackTrace trace={part.errorText} onFilePathClick={(path, line) => openInEditor(path, line)}>
  <StackTraceHeader>
    <StackTraceError>
      <StackTraceErrorType />
      <StackTraceErrorMessage />
    </StackTraceError>
    <StackTraceActions>
      <StackTraceCopyButton />
    </StackTraceActions>
  </StackTraceHeader>
  <StackTraceContent>
    <StackTraceFrames />
  </StackTraceContent>
</StackTrace>`,
	props: [
		{
			name: "trace",
			type: "string",
			required: true,
			description: "StackTrace only. The raw stack, parsed into the error type, message and frames.",
		},
		{
			name: "open / defaultOpen / onOpenChange",
			type: "boolean / boolean / (open: boolean) => void",
			default: "defaultOpen: false",
			description: "StackTrace only. Whether the frames are shown.",
		},
		{
			name: "onFilePathClick",
			type: "(path: string, line?: number, column?: number) => void",
			description: "StackTrace only. Turns each frame's file path into a button, for example to open it in an editor.",
		},
		{
			name: "showInternalFrames",
			type: "boolean",
			default: "true",
			description: "StackTraceFrames only. Set false to hide node_modules and Node.js internal frames.",
		},
		{
			name: "maxHeight",
			type: "number",
			default: "400",
			description: "StackTraceContent only. Height in pixels after which the frames scroll.",
		},
		{
			name: "icon",
			type: "ReactNode",
			description: "StackTraceHeader only. Replaces the error icon, for example with the failed tool's icon.",
		},
		{
			name: "getHref",
			type: "(frame: StackFrame) => string",
			default: "`#${file}:${line}`",
			description: "StackTraceFrameLinks only. Where each of your own frames links.",
		},
	],
	subComponents: [
		{ name: "StackTrace", description: "Trace with a TraceCollapsible. Parses the trace for the parts below." },
		{
			name: "StackTraceHeader",
			description:
				"TraceCollapsibleTrigger with an error TraceLine. Actions and the copy button render next to the trigger, since buttons cannot sit inside it.",
		},
		{ name: "StackTraceError", description: "TraceTitle, like “Failed: TypeError: …”." },
		{ name: "StackTraceErrorType", description: "The parsed error type, inside StackTraceError." },
		{ name: "StackTraceErrorMessage", description: "The parsed error message, inside StackTraceError." },
		{ name: "StackTraceActions", description: "Row of actions next to the trigger." },
		{ name: "StackTraceCopyButton", description: "Copies the raw stack." },
		{ name: "StackTraceExpandButton", description: "Renders nothing; the whole line opens the frames. Kept for compatibility." },
		{ name: "StackTraceContent", description: "TraceCollapsibleContent that scrolls past maxHeight." },
		{
			name: "StackTraceFrames",
			description: "The full error and the frames in a muted, monospace block. node_modules frames stay dimmed.",
		},
		{
			name: "StackTraceFrameLinks",
			description:
				"The full error, your own frames as links to the file and line, and the framework frames folded into a collapsible line.",
		},
	],
	examples: [{ title: "Frame Links", demoSlug: "stack-trace-demo-frame-links" }],
};
