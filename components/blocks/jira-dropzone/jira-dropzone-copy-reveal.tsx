"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { JIRA_DROPZONE_WELL_ENTER, JIRA_DROPZONE_WELL_ENTER_REDUCED, JIRA_DROPZONE_WELL_EXIT } from "./lib/jira-dropzone-motion";

/** The create-well copy reveal, shared with board transition captions. */
export function JiraDropzoneCopyReveal({
	ariaHidden = false,
	alignment = "center",
	children,
	contentKey,
	dataPrefix = "jira-dropzone",
	mode = "fade",
	resting,
	revealed,
}: Readonly<{
	ariaHidden?: boolean;
	alignment?: "start" | "center";
	children: ReactNode;
	contentKey?: string;
	dataPrefix?: string;
	mode?: "fade" | "cycle";
	resting: ReactNode;
	revealed: boolean;
}>) {
	const shouldReduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
	const transition = shouldReduceMotion ? JIRA_DROPZONE_WELL_ENTER_REDUCED : JIRA_DROPZONE_WELL_ENTER;
	if (mode === "cycle") {
		return <span className="relative block h-5 w-full overflow-hidden" {...{ [`data-${dataPrefix}-copy-motion`]: revealed ? "label" : "add" }}>
			<AnimatePresence initial={false} mode="sync">
				<CycleLayer
					alignment={alignment}
					ariaHidden={ariaHidden}
					dataPrefix={dataPrefix}
					key={revealed ? `label:${contentKey ?? ""}` : "resting"}
					layer={revealed ? "label" : "add"}
					reducedMotion={shouldReduceMotion}
				>{revealed ? children : resting}</CycleLayer>
			</AnimatePresence>
		</span>;
	}
	return (
		<span className="relative grid h-5 w-full place-items-center">
			<span aria-hidden={ariaHidden || undefined} className="col-start-1 row-start-1 grid w-full place-items-center" {...{ [`data-${dataPrefix}-copy-motion`]: revealed ? "label" : "add" }}>
				<motion.span
					animate={{ opacity: revealed ? 0 : 1 }}
					aria-hidden={revealed || undefined}
					className={cn("col-start-1 row-start-1 inline-flex items-center justify-center", alignment === "start" ? "justify-self-start" : null)}
					initial={false}
					transition={transition}
					{...{ [`data-${dataPrefix}-copy-layer`]: "add" }}
				>{resting}</motion.span>
				<motion.span
					animate={{ opacity: revealed ? 1 : 0 }}
					aria-hidden={!revealed || undefined}
					className={cn("col-start-1 row-start-1 inline-flex w-full items-center", alignment === "start" ? "justify-start" : "justify-center")}
					initial={false}
					transition={transition}
					{...{ [`data-${dataPrefix}-copy-layer`]: "label" }}
				>{children}</motion.span>
			</span>
		</span>
	);
}

function CycleLayer({ alignment, ariaHidden, children, dataPrefix, layer, reducedMotion }: Readonly<{
	alignment: "start" | "center";
	ariaHidden: boolean;
	children: ReactNode;
	dataPrefix: string;
	layer: "add" | "label";
	reducedMotion: boolean;
}>) {
	const present = useIsPresent();
	return <motion.span
		animate={{ opacity: 1, y: 0 }}
		aria-hidden={ariaHidden || !present || undefined}
		className={cn("absolute inset-0 inline-flex items-center will-change-transform motion-reduce:transform-none!", alignment === "center" ? "justify-center" : "justify-start")}
		exit={{ opacity: 0, y: reducedMotion ? 0 : "-100%", transition: reducedMotion ? JIRA_DROPZONE_WELL_ENTER_REDUCED : JIRA_DROPZONE_WELL_EXIT }}
		initial={{ opacity: 0, y: reducedMotion ? 0 : "100%" }}
		transition={reducedMotion ? JIRA_DROPZONE_WELL_ENTER_REDUCED : JIRA_DROPZONE_WELL_ENTER}
		{...{ [`data-${dataPrefix}-copy-layer`]: layer }}
	>{children}</motion.span>;
}
