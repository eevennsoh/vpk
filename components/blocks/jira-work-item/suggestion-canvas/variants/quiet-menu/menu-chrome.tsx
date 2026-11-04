"use client";

import { AnimatePresence, motion } from "motion/react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import CrossIcon from "@atlaskit/icon/core/cross";
import RefreshIcon from "@atlaskit/icon/core/refresh";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Shimmer } from "@/components/ui-custom/shimmer";
import { TWGLoader } from "@/components/ui-custom/twg-loader";
import { motionRecipe } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { SUGGESTION_WORK_ITEM } from "@/components/blocks/jira-suggestion/data/suggestions";

/** The one phrase used for a re-run, wherever it is shown or announced. */
export const RUNNING_COPY = "Checking for new suggestions";

const COLLAPSE = {
	animate: { height: "auto", opacity: 1, transition: motionRecipe.popup.enter },
	exit: { height: 0, opacity: 0, transition: motionRecipe.popup.exit },
	initial: { height: 0, opacity: 0 },
} as const;

/**
 * Title, attribution and a refresh that never leaves. The header stays still during a run: the trigger's mark and
 * the inline status line are the only running signals.
 */
export function MenuHeader({ titleId, running, ranAt, onRerun }: Readonly<{ titleId: string; running: boolean; ranAt: string; onRerun: () => void }>) {
	return (
		<header className="flex items-start gap-2.5 px-4 pt-3.5 pb-2">
			<span aria-hidden="true" className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
				<TWGLoader active={false} label="Teamwork Graph" size="small" />
			</span>
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<div className="flex items-center justify-between gap-2">
					<h2 className="text-sm leading-5 font-medium text-text" id={titleId}>Work item suggestions</h2>
					<Tooltip>
							<TooltipTrigger
								render={(
									<Button
										aria-label={running ? RUNNING_COPY : "Check for new suggestions"}
										className="-my-0.5 -mr-1.5 shrink-0 text-icon-subtlest transition-opacity duration-normal ease-out-practical hover:[&_svg]:text-icon disabled:opacity-40"
										disabled={running}
										focusableWhenDisabled
										onClick={onRerun}
										size="icon-compact"
										type="button"
										variant="ghost"
									/>
								)}
							>
								<RefreshIcon color="currentColor" label="" size="small" />
							</TooltipTrigger>
							<TooltipContent>{running ? `${RUNNING_COPY}…` : "Check for new suggestions"}</TooltipContent>
						</Tooltip>
				</div>
				<p className="text-xs leading-4 text-text-subtlest">
					<span className="text-text-subtle">{SUGGESTION_WORK_ITEM.agent.name}</span>
					<span aria-hidden="true" className="mx-1">·</span>
					{ranAt.replace(/ ago$/i, "").toLowerCase()}
					<span aria-hidden="true" className="mx-1">·</span>
					Teamwork Graph
				</p>
			</div>
		</header>
	);
}

export type MenuStatus = "running" | "nothing-new" | null;

/** The only in-panel run signal while suggestions are listed: a shimmer line, then a brief "nothing new" note. */
export function MenuStatusLine({ status }: Readonly<{ status: MenuStatus }>) {
	return (
		<AnimatePresence initial={false}>
			{status ? (
				<motion.div {...COLLAPSE} className="overflow-hidden" key="status">
					<div className="flex h-7 items-center gap-2 px-2.5 text-xs leading-4">
						{status === "running" ? (
							<Shimmer as="span" className="text-text-subtle">{`${RUNNING_COPY}…`}</Shimmer>
						) : (
							<span className="flex items-center gap-1.5 text-text-subtlest">
								<span className="flex size-4 items-center justify-center text-icon-subtlest"><CheckMarkIcon color="currentColor" label="" size="small" /></span>
								No new suggestions
							</span>
						)}
					</div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}

/** A thin labelled rule. "New" is tinted discovery; the earlier group sits under a neutral "Earlier". */
export function GroupDivider({ label, fresh }: Readonly<{ label: string; fresh: boolean }>) {
	return (
		<div className="flex h-7 items-center gap-2 px-2.5">
			<span className={fresh ? "text-xs leading-4 font-medium text-text-discovery" : "text-xs leading-4 text-text-subtlest"}>{label}</span>
			<span className="h-px flex-1 bg-border" />
		</div>
	);
}

/**
 * Nothing left to review. It stays mounted through a re-run and only swaps its mark and subline,
 * so asking again never collapses and regrows the menu. The tally lives in the subline alone.
 */
export function CaughtUp({ accepted, dismissed, checkedNothingNew, running, onRerun }: Readonly<{ accepted: number; dismissed: number; checkedNothingNew: boolean; running: boolean; onRerun: () => void }>) {
	const summary = [accepted > 0 ? `${accepted} added` : null, dismissed > 0 ? `${dismissed} dismissed` : null].filter(Boolean).join(" · ");
	return (
		<div className="flex flex-col items-center px-6 pt-5 pb-3 text-center">
			<p className="flex items-center gap-1.5 text-sm leading-5 font-medium text-text">
				<span aria-hidden="true" className={cn("flex size-4 items-center justify-center transition-colors duration-normal ease-out-practical", running ? "text-icon-subtlest" : "text-icon-success")}>
					<CheckMarkIcon color="currentColor" label="" size="small" />
				</span>
				All caught up
			</p>
			<p className="mt-0.5 text-xs leading-4 text-pretty">
				{running ? (
					<Shimmer as="span" className="text-text-subtle">{`${RUNNING_COPY}…`}</Shimmer>
				) : (
					<span className="text-text-subtlest">{[checkedNothingNew ? "Nothing new" : null, summary || "Every suggestion is reviewed"].filter(Boolean).join(" · ")}</span>
				)}
			</p>
			<Button className="mt-2.5 text-xs" disabled={running} focusableWhenDisabled onClick={onRerun} size="compact" type="button" variant="ghost">
				<RefreshIcon color="currentColor" label="" size="small" />
				Check again
			</Button>
		</div>
	);
}

export interface FooterUndo {
	decision: "accepted" | "dismissed";
	/** Short visible receipt, e.g. "7 added" or "1 dismissed". */
	summary: string;
	/** Full accessible name of the Undo button. */
	label: string;
	onUndo: () => void;
	onHold: (holding: boolean) => void;
}

/** The one Undo treatment everywhere: quiet text that brightens on hover or focus. */
export const UNDO_TEXT = "px-2 text-xs font-normal text-text-subtle hover:text-text focus-visible:text-text";

function UndoButton({ undo }: Readonly<{ undo: FooterUndo }>) {
	return (
		<Button
			aria-label={undo.label}
			className={UNDO_TEXT}
			onBlur={() => undo.onHold(false)}
			onClick={undo.onUndo}
			onFocus={() => undo.onHold(true)}
			onPointerEnter={() => undo.onHold(true)}
			onPointerLeave={() => undo.onHold(false)}
			size="compact"
			type="button"
			variant="ghost"
		>
			Undo
		</Button>
	);
}

/** The last action's receipt, sitting in the footer row's left slot in place of the progress text. */
function UndoSlot({ undo }: Readonly<{ undo: FooterUndo }>) {
	const accepted = undo.decision === "accepted";
	return (
		<span className="flex min-w-0 items-center gap-1 pl-2.5 text-xs leading-4">
			<span className={cn("flex size-4 shrink-0 items-center justify-center", accepted ? "text-icon-success" : "text-icon-subtlest")}>
				{accepted ? <CheckMarkIcon color="currentColor" label="" size="small" /> : <CrossIcon color="currentColor" label="" size="small" />}
			</span>
			<span className="whitespace-nowrap text-text-subtlest tabular-nums">{undo.summary}</span>
			<UndoButton undo={undo} />
		</span>
	);
}

export interface ReviewedDisclosure {
	count: number;
	total: number;
	expanded: boolean;
	controls: string;
	onToggle: () => void;
}

/** "N of M reviewed" doubles as the quiet switch for the Reviewed group, so decided suggestions are never lost. */
function ReviewedToggle({ disclosure }: Readonly<{ disclosure: ReviewedDisclosure }>) {
	const { count, total, expanded, controls, onToggle } = disclosure;
	const text = `${count} of ${total} reviewed`;
	if (count === 0) return <span className="pl-2.5 text-xs leading-4 whitespace-nowrap text-text-subtlest tabular-nums">{text}</span>;
	return (
		<Button
			aria-controls={expanded ? controls : undefined}
			aria-expanded={expanded}
			className="gap-0.5 pr-1.5 pl-2.5 text-xs font-normal whitespace-nowrap text-text-subtlest tabular-nums hover:bg-bg-neutral-subtle-hovered hover:text-text-subtle aria-expanded:border-transparent aria-expanded:bg-transparent aria-expanded:text-text-subtle aria-expanded:hover:bg-bg-neutral-subtle-hovered"
			onClick={onToggle}
			size="compact"
			type="button"
			variant="ghost"
		>
			{text}
			<span aria-hidden="true" className={cn("flex size-4 items-center justify-center transition-transform duration-normal ease-out-practical", expanded ? "rotate-180" : null)}>
				<ChevronDownIcon color="currentColor" label="" size="small" />
			</span>
		</Button>
	);
}

const SLOT = {
	animate: { opacity: 1, transition: motionRecipe.popup.enter },
	exit: { opacity: 0, transition: motionRecipe.popup.exit },
	initial: { opacity: 0 },
} as const;

/**
 * One fixed-height row that never reflows: progress (which opens the Reviewed group) on the left, actions on the
 * right. The last bulk or folded-away action crossfades into the left slot in place of the progress, so its expiry
 * can never shift Dismiss all or Accept all under the cursor.
 */
export function MenuFooter({ reviewed, undo, pending, onDismissAll, onAcceptAll, onDone }: Readonly<{ reviewed: ReviewedDisclosure; undo: FooterUndo | null; pending: number; onDismissAll: () => void; onAcceptAll: () => void; onDone: () => void }>) {
	const inline = pending === 0;
	const slotUndo = undo && !inline ? undo : null;
	return (
		<footer className="mx-2 flex h-11 shrink-0 items-center gap-1 border-t border-border">
			<div className="grid min-w-0 flex-1 items-center">
				<AnimatePresence initial={false}>
					<motion.div {...SLOT} className="col-start-1 row-start-1 flex min-w-0" key={slotUndo ? `undo-${slotUndo.summary}` : "progress"}>
						{slotUndo ? <UndoSlot undo={slotUndo} /> : <ReviewedToggle disclosure={reviewed} />}
					</motion.div>
				</AnimatePresence>
			</div>
			{inline ? (
				<>
					{undo ? <UndoButton undo={undo} /> : null}
					<Button className="text-xs" onClick={onDone} size="compact" type="button" variant="ghost">Done</Button>
				</>
			) : (
				<>
					<Button className="shrink-0 text-xs" onClick={onDismissAll} size="compact" type="button" variant="ghost">Dismiss all</Button>
					<Button className="shrink-0 text-xs text-text-brand hover:bg-bg-brand-subtlest-hovered active:bg-bg-brand-subtlest-pressed" onClick={onAcceptAll} size="compact" type="button" variant="ghost">Accept all</Button>
				</>
			)}
		</footer>
	);
}
