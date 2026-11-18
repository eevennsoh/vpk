import type { ComponentDetail } from "@/app/data/component-detail-types";

export const TERMINAL_DETAIL: ComponentDetail = {
	description:
		"A shell command the agent runs, such as a lint, a test run or a build. Terminal is a collapsible Trace: the line shows the command, and its output streams into a Code Block underneath while it runs.",
	usage: `import {
  Terminal,
  TerminalActions,
  TerminalContent,
  TerminalCopyButton,
  TerminalHeader,
  TerminalTitle,
} from "@/components/ui/terminal";

<Terminal output={output} isStreaming={running}>
  <TerminalHeader>
    <TerminalTitle>{running ? "Running" : "Ran"} pnpm build</TerminalTitle>
    <TerminalActions>
      <TerminalCopyButton />
    </TerminalActions>
  </TerminalHeader>
  <TerminalContent />
</Terminal>`,
	props: [
		{
			name: "output",
			type: "string",
			required: true,
			description: "The command output.",
		},
		{
			name: "isStreaming",
			type: "boolean",
			default: "false",
			description: "Sets the line to running and opens it once output arrives.",
		},
		{
			name: "autoScroll",
			type: "boolean",
			default: "true",
			description: "Scrolls to the newest output as it arrives.",
		},
		{
			name: "onClear",
			type: "() => void",
			description: "Shows TerminalClearButton.",
		},
		{
			name: "defaultOpen",
			type: "boolean",
			description: "Terminal only. Starts the output open; after that the reader's click wins.",
		},
		{
			name: "status",
			type: '"running" | "error" | "pending"',
			description: "TerminalHeader only. Overrides the line status (running while streaming); use error for a non-zero exit code.",
		},
		{
			name: "icon",
			type: "ReactNode",
			description: "TerminalTitle only. Replaces the terminal icon.",
		},
	],
	subComponents: [
		{ name: "Terminal", description: "Trace with a TraceCollapsible; opens once output arrives while the command runs." },
		{
			name: "TerminalHeader",
			description:
				"TraceCollapsibleTrigger with a TraceLine, running while streaming; a plain line when there is no output. Status and actions render next to it.",
		},
		{ name: "TerminalTitle", description: "Terminal icon and TraceTitle, like “Ran pnpm build”." },
		{ name: "TerminalStatus", description: "“Running” label shown while streaming." },
		{ name: "TerminalActions", description: "Row of actions next to the trigger." },
		{ name: "TerminalCopyButton", description: "Copies the output." },
		{ name: "TerminalClearButton", description: "Calls onClear; renders nothing without it." },
		{ name: "TerminalContent", description: "TraceCollapsibleContent with a small, wrapping Code Block of the output." },
	],
	examples: [{ title: "Exit Code", demoSlug: "terminal-demo-exit-code" }],
};
