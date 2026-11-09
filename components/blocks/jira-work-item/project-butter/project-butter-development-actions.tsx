"use client";

import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import BranchIcon from "@atlaskit/icon/core/branch";
import CopyIcon from "@atlaskit/icon/core/copy";
import { CopyFeedbackIcon } from "@/components/ui-custom/copy-feedback-icon";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { cn } from "@/lib/utils";

export function ProjectButterDevelopmentActions({ code, description, openIn, presentation = "default", renderStartCoding, showStartCoding = true, summary }: Readonly<{
	code: string;
	description: string;
	openIn?: ReactNode;
	presentation?: "default" | "menu";
	renderStartCoding?: (trigger: ReactElement) => ReactNode;
	showStartCoding?: boolean;
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
	const row = "h-8 w-full justify-start gap-2 border-0 px-2 font-normal";
	const startCoding = <Button className={row} type="button" variant="ghost"><IconTile aria-hidden as="span" className="text-icon-subtle" icon={<BranchIcon label="" size="small" />} label="" size="xxsmall" variant="transparent" />Configure repository</Button>;
	return <div className="-mx-2 flex flex-col">
		{showStartCoding ? renderStartCoding ? renderStartCoding(startCoding) : startCoding : null}
		{openIn}
		<Button aria-label={label} className={presentation === "menu" ? "h-8 min-h-8 w-full justify-start gap-3 pl-2 pr-3 py-0 text-left text-sm font-normal" : row} onClick={() => { void copyPrompt(); }} type="button" variant="ghost">
			<CopyFeedbackIcon className={presentation === "menu" ? "size-6" : undefined} copied={feedback === "copied"} idleIcon={<CopyIcon label="" size={presentation === "menu" ? "medium" : "small"} />} />
			<span aria-hidden className={cn("grid text-left", presentation === "menu" && "text-text-subtle")}>
				<span className={cn("col-start-1 row-start-1 transition-opacity duration-normal ease-out-practical", feedback === "idle" ? "opacity-100" : "opacity-0")}>Copy prompt</span>
				<span className={cn("col-start-1 row-start-1 transition-opacity duration-normal ease-out-practical", feedback !== "idle" ? "opacity-100" : "opacity-0")}>{label}</span>
			</span>
		</Button>
		<span className="sr-only" role="status">{feedback === "idle" ? "" : label}</span>
	</div>;
}
