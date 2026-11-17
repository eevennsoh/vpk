"use client";

import type { ComponentProps } from "react";
import CopyIcon from "@atlaskit/icon/core/copy";
import { CopyFeedbackIcon } from "@/components/ui-custom/copy-feedback-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COPY_LABELS = { idle: "Copy prompt", copied: "Prompt copied", error: "Could not copy prompt" } as const;

export function CopyPromptButton({ className, feedback, presentation = "default", ...props }: Readonly<Omit<ComponentProps<typeof Button>, "children"> & {
	feedback: keyof typeof COPY_LABELS;
	presentation?: "default" | "menu";
}>) {
	const label = COPY_LABELS[feedback];
	const menu = presentation === "menu";
	return <Button {...props} aria-label={label} className={cn(className, menu ? "h-8 min-h-8 w-full justify-start gap-3 rounded-md border-0 pl-2 pr-3 py-0 text-left text-sm font-normal text-text-subtle data-[highlighted]:text-text-subtle" : "h-8 w-full justify-start gap-2 border-0 px-2 font-normal")} type="button" variant="ghost">
		<CopyFeedbackIcon className={menu ? "size-6 [&_svg]:size-4!" : undefined} copied={feedback === "copied"} idleIcon={<CopyIcon label="" size={menu ? "medium" : "small"} />} />
		<span aria-hidden className={cn("grid text-left", menu && "text-text-subtle")}>
			<span className={cn("col-start-1 row-start-1 transition-opacity duration-normal ease-out-practical", feedback === "idle" ? "opacity-100" : "opacity-0")}>Copy prompt</span>
			<span className={cn("col-start-1 row-start-1 transition-opacity duration-normal ease-out-practical", feedback !== "idle" ? "opacity-100" : "opacity-0")}>{label}</span>
		</span>
		<span className="sr-only" role="status">{feedback === "idle" ? "" : label}</span>
	</Button>;
}
