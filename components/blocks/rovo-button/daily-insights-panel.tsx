"use client";

import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, Ref } from "react";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import CrossIcon from "@atlaskit/icon/core/cross";
import { motion, type Variants } from "motion/react";
import { RovoColorIcon } from "@/components/ui/logo";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { DAILY_INSIGHTS_ROW_CLASSES } from "./daily-insights-row-classes";
import { FLOATING_ROVO_BUTTON_CONTENT_EXIT } from "./motion";
import type { FloatingRovoButtonInsightRow, FloatingRovoButtonInsightsConfig } from "./types";
import { motionEase } from "@/lib/motion";

/**
 * The one piece of visible copy both the pill and the card share.
 *
 * It lives here rather than being imported from a feature so that
 * `components/projects/shared/**` keeps owning its own presentation — the count
 * is generic ("how many unread things"), so the wording is too.
 */
function formatFloatingRovoButtonInsightCount(count: number): string {
	return count === 1 ? "1 new insight" : `${count} new insights`;
}

/**
 * The primary action absorbs the overflow count, so the card needs no second
 * control for "there are more than these three". The header already says how
 * many there are while showing three, so the overflow is already communicated.
 */
function formatFloatingRovoButtonInsightPrimaryAction(count: number, overflowCount: number): string {
	if (overflowCount <= 0) {
		return "Open insights";
	}

	return count === 1 ? "Open insight" : `Open all ${count} insights`;
}

// Rows are full-bleed, so they cannot use the outward `ring-3` treatment the
// inset header and footer controls use: the morphing surface is
// `overflow-hidden`, so an outward ring on an edge-to-edge child is clipped on
// both sides. An inset outline keeps the whole ring visible without shrinking it.
const DAILY_INSIGHTS_ROW_FOCUS_CLASSES =
	"outline-2 -outline-offset-2 outline-transparent focus-visible:outline-ring";

function FloatingRovoButtonDailyInsightsRowBody({ row }: Readonly<{ row: FloatingRovoButtonInsightRow }>) {
	return (
		<span className={DAILY_INSIGHTS_ROW_CLASSES.body}>
			<span className={DAILY_INSIGHTS_ROW_CLASSES.textColumn}>
				{/* A tracked uppercase eyebrow, echoing Pulse's own `PROJECT_LABEL`
				    (components/blocks/jira-kanban/experimental/pulse/experimental-pulse.tsx:79)
				    — this card summarises Pulse, so the meta line adopts the voice of
				    the article the reader is about to open. Deliberate echo, not a
				    one-off. The separation from the header subtitle is categorical
				    rather than dimensional: both are 12px, but one is a tracked label
				    and the other is sentence-case chrome prose. */}
				<span className={DAILY_INSIGHTS_ROW_CLASSES.metaLine}>
					<span className={DAILY_INSIGHTS_ROW_CLASSES.chapterLabel}>{row.chapterLabel}</span>
					<span aria-hidden="true" className={DAILY_INSIGHTS_ROW_CLASSES.metaSeparator}>
						·
					</span>
					<span className={DAILY_INSIGHTS_ROW_CLASSES.timeLabel}>{row.timeLabel}</span>
				</span>
				{/* 16px against the 12px meta line: the headlines own the content
				    layer, and the wider glyphs push more of each sentence onto the
				    second line so the right edge reads less ragged at the 295px
				    measure. */}
				<span className={DAILY_INSIGHTS_ROW_CLASSES.title}>{row.title}</span>
			</span>
			{/* Persistent rather than hover-revealed: a cue that only appears on hover
			    still leaves the row looking inert at rest, which is the thing it is
			    here to fix. Omitted entirely when the row does not navigate. */}
			{row.onSelect ? (
				<span aria-hidden="true" className={DAILY_INSIGHTS_ROW_CLASSES.chevron}>
					<ChevronRightIcon color="currentColor" label="" size="small" />
				</span>
			) : null}
		</span>
	);
}

function FloatingRovoButtonDailyInsightsRow({
	row,
	isFirst,
	variants,
}: Readonly<{
	row: FloatingRovoButtonInsightRow;
	isFirst: boolean;
	variants: Variants;
}>) {
	return (
		<motion.div
			className={cn("flex min-w-0 flex-col", isFirst ? null : "border-t border-border")}
			variants={variants}
			style={{ willChange: "transform, opacity, filter" }}
		>
			{row.onSelect ? (
				<button
					className={cn(
						"group flex w-full min-w-0 flex-col bg-surface-raised transition-colors duration-normal ease-out hover:bg-surface-raised-hovered active:bg-surface-raised-pressed motion-reduce:transition-none",
						DAILY_INSIGHTS_ROW_FOCUS_CLASSES,
					)}
					onClick={row.onSelect}
					type="button"
				>
					<FloatingRovoButtonDailyInsightsRowBody row={row} />
				</button>
			) : (
				<div className="flex w-full min-w-0 flex-col bg-surface-raised">
					<FloatingRovoButtonDailyInsightsRowBody row={row} />
				</div>
			)}
		</motion.div>
	);
}

export function FloatingRovoButtonDailyInsightsPanelInner({
	insights,
	onDismiss,
	onPrimaryAction,
	onSecondaryAction,
	shouldReduceMotion,
}: Readonly<{
	insights: FloatingRovoButtonInsightsConfig;
	/** Collapses the card. Marks nothing read, so it never runs the primary action. */
	onDismiss: () => void;
	onPrimaryAction: () => void;
	onSecondaryAction: () => void;
	shouldReduceMotion: boolean;
}>) {
	const titleId = `${insights.id}-title`;
	const descriptionId = `${insights.id}-description`;
	const closeLabel = insights.closeLabel ?? "Dismiss insights";
	const overflowCount = insights.overflowCount ?? 0;
	const primaryActionLabel = insights.primaryActionLabel
		?? formatFloatingRovoButtonInsightPrimaryAction(insights.count, overflowCount);
	const secondaryActionLabel = insights.secondaryActionLabel ?? "Ask Rovo";
	const countLabel = formatFloatingRovoButtonInsightCount(insights.count);
	const rows = insights.rows.slice(0, 3);
	// Same content timing as the sibling onboarding panel (ease-out, the bold
	// entrance curve): the surface spring is already most of the way open by the
	// time the body starts, so the body only has to catch up.
	const phaseChild = shouldReduceMotion
		? { duration: 0 }
		: { duration: 0.22, ease: motionEase.out };
	const phaseHeaderTransition = shouldReduceMotion
		? { duration: 0 }
		: { duration: 0.22, delay: 0.24, ease: motionEase.out };
	const phaseVariants: Variants = shouldReduceMotion
		? {
			hidden: { opacity: 1, y: 0, filter: "blur(0px)" },
			visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: phaseChild },
		}
		: {
			hidden: { opacity: 0, y: 14, filter: "blur(6px)" },
			visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: phaseChild },
		};
	const rowsContainer = shouldReduceMotion
		? { duration: 0 }
		: { delayChildren: 0.36, staggerChildren: 0.05 };
	const footerContainer = shouldReduceMotion
		? { duration: 0 }
		: { delayChildren: 0.46, staggerChildren: 0.05 };

	return (
		<motion.section
			key="floating-rovo-button-insights-panel"
			aria-describedby={insights.spaceName ? descriptionId : undefined}
			aria-labelledby={titleId}
			className="flex w-full flex-col text-text-inverse"
			data-testid="floating-rovo-button-daily-insights"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0, transition: { duration: 0 } }}
			transition={shouldReduceMotion
				? { duration: 0 }
				: { duration: 0.14, delay: 0.18, ease: motionEase.out }}
			onKeyDown={(event) => {
				if (event.key === "Escape") {
					event.stopPropagation();
					onDismiss();
				}
			}}
			role="dialog"
			tabIndex={-1}
		>
			<motion.header
				className="flex shrink-0 items-start justify-between gap-3 py-3 pr-2 pl-4"
				variants={phaseVariants}
				initial="hidden"
				animate="visible"
				transition={phaseHeaderTransition}
				style={{ willChange: "transform, opacity, filter" }}
			>
				<div className="flex min-w-0 flex-col gap-0.5">
					{/* 20 / 16 / 12 size ramp across title, row headline, and the two 12px
					    lines. The subtitle and the row meta share a size on purpose: they
					    are told apart by kind, not by scale — sentence-case chrome prose
					    here, a tracked uppercase label there. */}
					<h2 id={titleId} className="min-w-0 truncate text-text-inverse" style={{ font: token("font.heading.medium") }}>
						{countLabel}
					</h2>
					{insights.spaceName ? (
						<p id={descriptionId} className="min-w-0 truncate text-xs leading-4 text-text-inverse opacity-60">
							{`Since your last visit to ${insights.spaceName}`}
						</p>
					) : null}
				</div>
				<button
					aria-label={closeLabel}
					autoFocus
					className="-mt-1 flex size-8 shrink-0 items-center justify-center rounded-md text-icon-inverse transition-colors duration-normal ease-out hover:bg-white/10 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none active:bg-white/15 motion-reduce:transition-none"
					onClick={onDismiss}
					type="button"
				>
					<CrossIcon color={token("color.icon.inverse")} label="" size="small" />
				</button>
			</motion.header>
			{rows.length > 0 ? (
				<motion.div
					// Do NOT add bottom padding here, however unfinished row 3 looks.
					//
					// The three rows are already symmetric: every row ends with the same
					// 12px of white below its text, then a boundary. Rows 1 and 2 meet a
					// 1px divider; row 3 meets the colour change to the dark band. Same
					// distance, different boundary *type*. Reading that as a spacing
					// difference is what produced an 8px overshoot here once already,
					// which made the last row measurably taller than its peers.
					//
					// The composition's breathing room lives in the footer's `pt-4`
					// instead, where it cannot touch a row.
					className="flex flex-col bg-surface-raised"
					initial="hidden"
					animate="visible"
					variants={{
						hidden: {},
						visible: { transition: rowsContainer },
					}}
				>
					{rows.map((row, index) => (
						<FloatingRovoButtonDailyInsightsRow
							key={row.id}
							row={row}
							isFirst={index === 0}
							variants={phaseVariants}
						/>
					))}
				</motion.div>
			) : null}
			<motion.footer
				// Both actions grouped right, matching the onboarding card. Onboarding
				// uses `justify-between` only because its left slot holds an aria-live
				// status line; with no status line, splitting the pair to opposite
				// edges reads as two unrelated controls.
				className="flex items-center justify-end gap-2 px-4 pt-4 pb-3"
				initial="hidden"
				animate="visible"
				variants={{
					hidden: {},
					visible: { transition: footerContainer },
				}}
			>
				<motion.button
					className="flex h-8 items-center justify-center rounded-md px-3 text-sm leading-5 font-medium text-text-inverse transition-colors duration-normal ease-out hover:bg-white/10 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none active:bg-white/15 motion-reduce:transition-none"
					onClick={onSecondaryAction}
					type="button"
					variants={phaseVariants}
					style={{ willChange: "transform, opacity, filter" }}
				>
					{secondaryActionLabel}
				</motion.button>
				<motion.button
					// Filled brand, not outlined: the old outline was
					// `bg-bg-neutral-bold` on a `bg-bg-neutral-bold` band, so it had
					// almost nothing to sit against and never declared itself primary.
					// The label absorbs the overflow count, which is why there is no
					// separate "+N more" control.
					className="flex h-8 items-center justify-center rounded-md bg-primary px-3 text-sm leading-5 font-medium text-primary-foreground transition-colors duration-normal ease-out hover:bg-primary-hovered focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none active:bg-primary-pressed motion-reduce:transition-none"
					onClick={onPrimaryAction}
					type="button"
					variants={phaseVariants}
					style={{ willChange: "transform, opacity, filter" }}
				>
					{primaryActionLabel}
				</motion.button>
			</motion.footer>
		</motion.section>
	);
}

/**
 * The middle geometry of the morph.
 *
 * This renders *inside* the morphing surface rather than beside it (the way the
 * proactive-suggestion nudge does), so the 48px button, this pill, and the card
 * are one object that changes shape instead of three that cross-fade in place.
 * The Rovo logo keeps its 48px slot on the trailing edge — the surface is pinned
 * by `right`, so the pill unfurls leftward out of exactly where the button was.
 */
export function FloatingRovoButtonDailyInsightsPill({
	insights,
	onClick,
	onDragMouseDown,
	onDragPointerDown,
	shouldReduceMotion,
	ref,
}: Readonly<{
	insights: FloatingRovoButtonInsightsConfig;
	onClick: () => void;
	onDragMouseDown: (event: ReactMouseEvent<HTMLButtonElement>) => void;
	onDragPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
	shouldReduceMotion: boolean;
	/** Lets the surface hand focus back here when the card collapses. */
	ref?: Ref<HTMLButtonElement>;
}>) {
	const countLabel = formatFloatingRovoButtonInsightCount(insights.count);

	return (
		<motion.button
			key="floating-rovo-button-insights-pill"
			ref={ref}
			aria-label={`Open ${countLabel}`}
			className="flex h-full w-full items-center justify-end bg-bg-neutral-bold pl-4 text-text-inverse"
			onClick={onClick}
			onMouseDownCapture={onDragMouseDown}
			onPointerDownCapture={onDragPointerDown}
			type="button"
			initial={shouldReduceMotion
				? { opacity: 0 }
				: { opacity: 0, filter: "blur(6px)" }}
			animate={shouldReduceMotion
				? { opacity: 1 }
				: { opacity: 1, filter: "blur(0px)" }}
			exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transition: FLOATING_ROVO_BUTTON_CONTENT_EXIT }}
			transition={shouldReduceMotion
				? { duration: 0 }
				: { duration: 0.2, delay: 0.24, ease: motionEase.out }}
			style={{ borderRadius: "inherit", willChange: "opacity, filter" }}
		>
			<span className="min-w-0 truncate text-sm leading-5 font-medium">{countLabel}</span>
			<span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center">
				<RovoColorIcon size="small" />
			</span>
		</motion.button>
	);
}
