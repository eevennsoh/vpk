"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { TerminalWindow } from "@/components/ui-custom/terminal-window";

const LINES = [
	"\u001b[90m$\u001b[0m pnpm build",
	"",
	"> acme-chat@0.1.0 build",
	"> next build",
	"",
	"   \u001b[1m▲ Next.js 16.3.0\u001b[0m",
	"   Creating an optimized production build ...",
	" \u001b[32m✓\u001b[0m Compiled successfully in 4.2s",
	" \u001b[32m✓\u001b[0m Generating static pages (12/12)",
	"",
	"Route (app)                Size  First Load JS",
	"┌ ○ /                     1.9 kB       112 kB",
	"└ ƒ /api/chat             141 B        102 kB",
];

export default function TerminalWindowDemo() {
	const [count, setCount] = useState(0);
	const streaming = count < LINES.length;

	useEffect(() => {
		if (!streaming) {
			return;
		}
		const timeout = setTimeout(() => setCount((prev) => prev + 1), 180);
		return () => clearTimeout(timeout);
	}, [count, streaming]);

	return (
		<div className="flex w-full max-w-xl flex-col gap-3">
			<TerminalWindow
				output={LINES.slice(0, count).join("\n")}
				isStreaming={streaming}
				className="h-72"
			/>
			{streaming ? null : (
				<Button variant="outline" className="self-start" onClick={() => setCount(0)}>
					Replay
				</Button>
			)}
		</div>
	);
}
