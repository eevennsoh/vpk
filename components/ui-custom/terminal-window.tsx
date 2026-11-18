"use client";

import { useEffect, useRef, type ComponentProps } from "react";
import Ansi from "ansi-to-react";

import { cn } from "@/lib/utils";

export type TerminalWindowProps = ComponentProps<"div"> & {
	output: string;
	isStreaming?: boolean;
	autoScroll?: boolean;
};

/**
 * A full-height scrolling terminal pane with ANSI colors, for IDE and TUI
 * mockups where the output is the surface itself. For a command the agent ran
 * inside its reply, use Terminal from components/ui/terminal.
 */
export function TerminalWindow({
	output,
	isStreaming = false,
	autoScroll = true,
	className,
	...props
}: Readonly<TerminalWindowProps>) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (autoScroll && ref.current) {
			ref.current.scrollTop = ref.current.scrollHeight;
		}
	}, [output, autoScroll]);

	return (
		<div
			data-slot="terminal-window"
			ref={ref}
			className={cn(
				"overflow-auto rounded-lg border bg-zinc-950 p-4 font-mono text-sm leading-relaxed text-zinc-100",
				className,
			)}
			{...props}
		>
			<pre className="wrap-break-word whitespace-pre-wrap">
				<Ansi>{output}</Ansi>
				{isStreaming ? <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-zinc-100" /> : null}
			</pre>
		</div>
	);
}
