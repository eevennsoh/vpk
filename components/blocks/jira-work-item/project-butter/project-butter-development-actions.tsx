"use client";

import { useEffect, useState } from "react";
import BranchIcon from "@atlaskit/icon/core/branch";
import CopyIcon from "@atlaskit/icon/core/copy";
import { CopyFeedbackIcon } from "@/components/ui-custom/copy-feedback-icon";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export function ProjectButterDevelopmentActions({ code, description, onStartCoding, summary }: Readonly<{
	code: string;
	description: string;
	onStartCoding: () => void;
	summary: string;
}>) {
	const [feedback, setFeedback] = useState<"idle" | "copied" | "error">("idle");
	useEffect(() => {
		if (feedback === "idle") return;
		const timer = window.setTimeout(() => setFeedback("idle"), 1800);
		return () => window.clearTimeout(timer);
	}, [feedback]);
	async function copyPrompt() {
		const body = [summary, description].filter((part) => part.trim()).join("\n\n");
		try {
			await navigator.clipboard.writeText(body ? `${code}: ${body}` : code);
			setFeedback("copied");
		} catch {
			setFeedback("error");
		}
	}
	const label = feedback === "copied" ? "Prompt copied" : feedback === "error" ? "Could not copy prompt" : "Copy prompt";
	const row = "h-8 w-full justify-start gap-2 px-2 font-normal";
	return <div className="-mx-2 flex flex-col">
		<Button className={row} onClick={onStartCoding} type="button" variant="ghost"><span aria-hidden className="grid size-4 shrink-0 place-items-center"><Icon className="text-icon-subtle" render={<BranchIcon label="" size="small" />} /></span>Start coding</Button>
		<Button aria-label={label} className={row} onClick={() => { void copyPrompt(); }} type="button" variant="ghost">
			<CopyFeedbackIcon copied={feedback === "copied"} idleIcon={<CopyIcon label="" size="small" />} />
			<span aria-hidden className="grid text-left">
				<span className={cn("col-start-1 row-start-1 transition-opacity duration-normal ease-out-practical", feedback === "idle" ? "opacity-100" : "opacity-0")}>Copy prompt</span>
				<span className={cn("col-start-1 row-start-1 transition-opacity duration-normal ease-out-practical", feedback !== "idle" ? "opacity-100" : "opacity-0")}>{label}</span>
			</span>
		</Button>
		<span className="sr-only" role="status">{feedback === "idle" ? "" : label}</span>
	</div>;
}
