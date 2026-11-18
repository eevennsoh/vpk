import type { ComponentDetail } from "@/app/data/component-detail-types";

export const TERMINAL_WINDOW_DETAIL: ComponentDetail = {
	description:
		"A full-height scrolling terminal pane with ANSI colors and a streaming cursor, for IDE and TUI mockups where the terminal is the surface. For a command the agent ran inside its reply, use Terminal.",
	usage: `import { TerminalWindow } from "@/components/ui-custom/terminal-window";

<TerminalWindow output={output} isStreaming={isStreaming} className="h-80" />`,
	props: [
		{ name: "output", type: "string", required: true, description: "Terminal output; ANSI escape codes render as colors." },
		{ name: "isStreaming", type: "boolean", default: "false", description: "Shows a blinking cursor after the output." },
		{ name: "autoScroll", type: "boolean", default: "true", description: "Scrolls to the newest output as it arrives." },
	],
};
