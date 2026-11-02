"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CrossIcon from "@atlaskit/icon/core/cross";

import type { ProjectButterSuggestionFill } from "@/components/blocks/jira-work-item/project-butter/use-suggestion-fill";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RovoGeneration } from "@/components/ui-custom/rovo-generation";
import { Tile } from "@/components/ui/tile";
import { TWGLoader } from "@/components/ui-custom/twg-loader";
import { TwgToolBannerBackground, TwgToolSourceStack, type TwgToolSource } from "@/components/ui-custom/twg-tool";
import { motionDuration, motionEase } from "@/lib/motion";

const SUGGESTION_SOURCES = [
	{ id: "twg", label: "Teamwork Graph", provider: "twg" },
	{ id: "jira", label: "Jira", provider: "jira" },
	{ id: "confluence", label: "Confluence", provider: "confluence" },
	{ id: "google-drive", label: "Google Drive", provider: "google-drive" },
] as const satisfies readonly TwgToolSource[];

const SUGGESTION_BANNER_CLASS = "relative flex h-auto w-full items-center justify-start gap-3 overflow-hidden rounded-[calc(0.25*2.5rem+0.375rem+1px)] border border-border bg-surface-sunken p-1.5 pr-2 text-left";

function TeamworkGraphLoaderTile({ active }: Readonly<{ active: boolean }>) {
	return (
		<Tile className="relative z-10 bg-surface" hasBorder label="Teamwork Graph" size="large" variant="transparent">
			<TWGLoader active={active} label="Teamwork Graph" size="small" />
		</Tile>
	);
}

function SuggestionBannerFace({ active, label, trailing }: Readonly<{ active: boolean; label: string; trailing: ReactNode }>) {
	return (
		<>
			<TwgToolBannerBackground />
			<TeamworkGraphLoaderTile active={active} />
			<span aria-live="polite" className="relative z-10 min-w-0 flex-1 truncate text-sm text-text">{label}</span>
			{trailing}
		</>
	);
}

/** Suggestions for empty Details fields, opened from a trigger above the Details panel. */
export function ProjectButterSuggestionPanel({ fill }: Readonly<{ fill: ProjectButterSuggestionFill }>) {
	const shouldReduceMotion = useReducedMotion() ?? false;
	const [open, setOpen] = useState(true);
	const [intro, setIntro] = useState(true);
	const count = fill.suggestions.length;
	const logoActive = fill.running || intro;
	const updated = fill.accepted;
	const reviewing = updated != null && !fill.running;
	if (!fill.running && count === 0 && updated == null) return null;
	const label = reviewing
		? `${updated.length} updated`
		: fill.running
			? "Filling details"
			: `${count} ${count === 1 ? "Suggestion" : "Suggestions"}`;
	const active = fill.suggestions.find((suggestion) => suggestion.field === fill.activeField);

	return (
		<Popover onOpenChange={setOpen} open={open && !reviewing}>
			<div className="sticky top-0 z-40 -mx-6 w-[calc(100%+3rem)] bg-surface px-6 pb-3">
				<RovoGeneration.Highlight active className="block w-full" onHighlightComplete={() => setIntro(false)}>
					{reviewing ? (
						<div className={SUGGESTION_BANNER_CLASS} data-suggestion-review="updated">
							<SuggestionBannerFace
								active={logoActive}
								label={label}
								trailing={(
									<div className="relative z-10 flex shrink-0 items-center gap-1">
										<Button onClick={fill.undoAccepted} size="compact" type="button" variant="outline">Undo</Button>
										<Button onClick={fill.dismissAccepted} size="compact" type="button" variant="default">Done</Button>
									</div>
								)}
							/>
						</div>
					) : (
						<PopoverTrigger
							render={
								<Button className="relative h-auto w-full justify-start gap-3 overflow-hidden rounded-[calc(0.25*2.5rem+0.375rem+1px)] border-border bg-surface-sunken p-1.5 pr-2 text-left aria-expanded:border-border aria-expanded:bg-surface-sunken aria-expanded:text-text hover:bg-surface-raised-hovered aria-expanded:hover:bg-surface-raised-hovered" type="button" variant="ghost" />
							}
						>
							<SuggestionBannerFace active={logoActive} label={label} trailing={<TwgToolSourceStack className="relative z-10 max-w-[44%] shrink-0" sources={SUGGESTION_SOURCES} />} />
						</PopoverTrigger>
					)}
				</RovoGeneration.Highlight>
			</div>
			<PopoverContent
				align="start"
				aria-busy={fill.running || undefined}
				aria-label="Field suggestions"
				className="w-(--anchor-width) max-w-none gap-0 p-3"
				data-project-butter-suggestion-panel=""
				data-suggestion-count={count}
				positionerClassName="z-[650]"
				side="left"
				sideOffset={8}
			>
				<div aria-live="polite" className="sr-only">{active ? `Filling ${active.label}` : ""}</div>
				{count > 0 ? (
					<ul aria-label="Suggested field values" className="flex max-h-52 flex-col overflow-y-auto">
						<AnimatePresence initial={false}>
							{fill.suggestions.map((suggestion) => (
								<motion.li
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									initial={shouldReduceMotion ? false : { opacity: 0 }}
									key={suggestion.field}
									transition={{ duration: motionDuration.fast, ease: motionEase.out }}
								>
									<div className="flex items-center gap-1 rounded-md py-0.5 pr-0.5 pl-1.5">
										<div className="flex min-w-0 flex-1 items-baseline gap-2">
											<span className="shrink-0 text-xs text-text-subtlest">{suggestion.label}</span>
											<span className="min-w-0 flex-1 truncate text-sm text-text">{suggestion.preview}</span>
										</div>
										<Button aria-label={`Accept ${suggestion.label} suggestion`} className="text-text [&_svg]:text-icon" disabled={fill.running} onClick={() => fill.acceptField(suggestion)} size="icon-compact" type="button" variant="ghost">
											<CheckMarkIcon label="" size="small" />
										</Button>
										<Button aria-label={`Dismiss ${suggestion.label} suggestion`} disabled={fill.running} onClick={() => fill.dismissField(suggestion.field)} size="icon-compact" type="button" variant="ghost">
											<CrossIcon label="" size="small" />
										</Button>
									</div>
								</motion.li>
							))}
						</AnimatePresence>
					</ul>
				) : null}
				<div className="mt-2 flex justify-end">
					<Button disabled={fill.running || count === 0} onClick={() => { setOpen(false); fill.acceptAll(); }} size="compact" type="button" variant="outline">
						<CheckMarkIcon label="" size="small" />
						{fill.running ? "Filling details" : "Accept all"}
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
