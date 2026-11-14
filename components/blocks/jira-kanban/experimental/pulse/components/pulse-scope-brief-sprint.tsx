"use client";

import { useId, type RefCallback } from "react";

import {
	PulseProgressBar,
	PulseProgressLegend,
} from "@/components/blocks/jira-kanban/experimental/pulse/components/pulse-progress-bar";
import { PulseSectionLabel } from "@/components/blocks/jira-kanban/experimental/pulse/components/pulse-signals";
import { MEASURE } from "@/components/blocks/jira-kanban/experimental/pulse/components/pulse-story";
import {
	HEADLINE_STYLE,
	PULSE_EYEBROW,
	PULSE_ITEM_BODY,
} from "@/components/blocks/jira-kanban/experimental/pulse/components/pulse-type";
import {
	buildPulseBurndownGeometry,
	toPulseBurndownVerdict,
	type PulseBurndownVerdict,
} from "@/components/blocks/jira-kanban/experimental/pulse/lib/pulse-burndown";
import { toPulseProgressModel } from "@/components/blocks/jira-kanban/experimental/pulse/lib/pulse-progress";
import type {
	PulseBurndownPoint,
	PulseScopeChangeEntry,
	PulseSprintScope,
} from "@/components/blocks/jira-kanban/experimental/pulse/types";
import { cn } from "@/lib/utils";

/**
 * Sprint scope brief — the opening of the article once it is narrowed to one
 * sprint.
 *
 * Jira answers this question with two bordered cards, a chart and a tinted
 * banner: three surfaces to carry three facts. Pulse has no card chrome to
 * spend, so the brief earns its hierarchy the way the rest of the article does
 * — one eyebrow, one display headline, one line of prose, then blocks
 * separated by air and hairlines. Everything the reference prints is here; none
 * of the boxes it prints it in are.
 *
 * Three decisions are worth naming.
 *
 * The verdict is written out. The reference draws a burndown and never says
 * whether the sprint lands, which is the only reason a lead opens a burndown.
 * The sentence above the figure states it — done, remaining, and whether the
 * line is ahead of, level with, or behind the guideline — so the figure becomes
 * evidence for a claim the reader has already been given rather than a puzzle.
 *
 * The figure is drawn, not emitted. It stretches to the reading measure with
 * `preserveAspectRatio="none"` and pins every stroke to
 * `vector-effect="non-scaling-stroke"`, so hairlines stay hairlines at any
 * column width instead of shearing into wedges. Nothing round and nothing
 * typeset lives inside the SVG: the axis labels and the today dot are HTML,
 * absolutely positioned. Vertically that is exact — the element is the same
 * number of pixels tall as the viewBox is units, so a grid line's `y` is
 * already a `top`. Horizontally the gutter is a fixed fraction of the viewBox,
 * so one percentage aligns the axis column at every width. The result is real
 * type on the type ramp and a perfectly round marker, which an SVG under
 * horizontal stretch cannot give.
 *
 * The scope-change banner loses its tint. A pale blue box exists in the
 * reference to make three signed numbers feel like a warning; here the numbers
 * carry their own direction — a signed figure, coloured only on the sign — and
 * the net is stated in a sentence above them. The rows then reuse the article's
 * ruled `<dl>` rhythm, so the sprint's arithmetic reads on the same rails as
 * every other set of numbers in the piece.
 *
 * Nothing here animates. The brief is the top of a document the reader has just
 * asked for; motion would only delay the first line.
 */

/**
 * The figure's coordinate space. `VIEW_HEIGHT` is also the element's pixel
 * height (`h-[168px]` below) — that 1:1 vertical mapping is what lets the HTML
 * axis labels and the today dot be placed from geometry units directly. Change
 * one and you must change the other.
 */
const VIEW_WIDTH = 320;
const VIEW_HEIGHT = 168;

/** Room for the y-axis column, in view units. */
const GUTTER = 30;

/** Air the last day needs so the today dot is not half a dot at the edge. */
const EDGE = 4;

const VERDICT_PHRASE: Record<PulseBurndownVerdict, string> = {
	ahead: "ahead of the guideline",
	"on-track": "level with the guideline",
	behind: "behind the guideline",
};

/**
 * Colour rides the sign, not the row. An "Added" column that added nothing is
 * not good news in green — it is nothing, and reads as `text-text-subtle` with
 * everything else that did not move.
 *
 * These are the *semantic* text tokens, not the chart accents the bands use.
 * The chart ramp is a colour key — it exists so a swatch can be matched to a
 * band — and `text-red-500` (#E2483D) is tuned for a filled mark rather than
 * for 18px type: axe measures it at 3.7:1 on the page surface, under AA. A
 * signed number is prose that happens to be a figure, so it takes the token
 * built for prose: #AE2E24 at 6.8:1 and #4C6B1F at 5.3:1.
 */
function toChangeToneClass(entry: PulseScopeChangeEntry): string {
	if (entry.points === 0) {
		return "text-text-subtle";
	}
	if (entry.tone === "added") {
		return "text-text-success";
	}
	if (entry.tone === "removed") {
		return "text-text-danger";
	}
	return "text-text-subtle";
}

/** Signed points with a real minus (U+2212), which aligns with the digits. */
function toSignedPoints(points: number): string {
	if (points === 0) {
		return "0";
	}
	return points > 0 ? `+${points}` : `−${Math.abs(points)}`;
}

function toWorkItemNote(workItems: number): string {
	if (workItems === 0) {
		return "No changes";
	}
	return `${workItems} work ${workItems === 1 ? "item" : "items"}`;
}

function toDaysClause(daysRemaining: number): string {
	if (daysRemaining <= 0) {
		return "Closed";
	}
	return `${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} left`;
}

/** How the verdict sentence ends — the same clause the eyebrow shortens. */
function toVerdictTail(daysRemaining: number): string {
	if (daysRemaining <= 0) {
		return "when it closed";
	}
	return `with ${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} left`;
}

type PulseClosedPoint = PulseBurndownPoint & { remaining: number };

function toClosedPoints(points: readonly PulseBurndownPoint[]): readonly PulseClosedPoint[] {
	return points.filter((point): point is PulseClosedPoint => point.remaining !== null);
}

/**
 * The last painted coordinate, read back off the path the geometry produced.
 *
 * The geometry exposes `todayX` but not its y, and re-deriving it from `yMax`
 * would put a second copy of the projection in a component — the one thing
 * `pulse-burndown.ts` exists to prevent. Reading the final pair out of the
 * string keeps the single source of truth intact.
 */
function toLastPathPoint(path: string): { x: number; y: number } | null {
	const numbers = path.match(/-?\d+(?:\.\d+)?/g);
	if (numbers === null || numbers.length < 2) {
		return null;
	}
	const x = Number(numbers[numbers.length - 2]);
	const y = Number(numbers[numbers.length - 1]);
	if (!Number.isFinite(x) || !Number.isFinite(y)) {
		return null;
	}
	return { x, y };
}

/**
 * The article's stat rhythm, carrying a second line. Points sit on the 18px
 * rung `PulseStoryStats` uses; the work-item count hangs under them as quiet
 * metadata rather than competing for the same baseline.
 */
function PulseSprintScopeChangeRow({ entry }: Readonly<{ entry: PulseScopeChangeEntry }>) {
	return (
		<div className="flex min-w-0 items-baseline justify-between gap-6 border-b border-border py-3 last:border-b-0">
			<dt className={cn("min-w-0 truncate", PULSE_ITEM_BODY)}>{entry.label}</dt>
			<dd className="shrink-0 text-right">
				<span className="text-[18px] leading-6 font-medium tracking-[-0.01em] tabular-nums">
					<span className={toChangeToneClass(entry)}>{toSignedPoints(entry.points)}</span>
					<span className="text-xs font-normal text-text-subtlest"> pts</span>
				</span>
				<span className="mt-0.5 block text-xs leading-4 text-text-subtlest tabular-nums">
					{toWorkItemNote(entry.workItems)}
				</span>
			</dd>
		</div>
	);
}

/** The net, in a sentence, with the figure itself carrying the emphasis. */
function PulseSprintScopeChangeLead({
	netPoints,
	totalPoints,
}: Readonly<{ netPoints: number; totalPoints: number }>) {
	const magnitude = Math.abs(netPoints);
	const noun = magnitude === 1 ? "point" : "points";

	return (
		<p className={cn("mt-3", PULSE_ITEM_BODY, MEASURE)}>
			{netPoints === 0 ? (
				<>
					{"Scope held steady at "}
					<strong className="font-medium text-text">{`${totalPoints} points`}</strong>
					{" since the sprint opened."}
				</>
			) : (
				<>
					{netPoints > 0 ? "Scope grew by " : "Scope shed "}
					<strong className="font-medium text-text">{`${magnitude} ${noun}`}</strong>
					{" after the sprint opened."}
				</>
			)}
		</p>
	);
}

export function PulseSprintBrief({
	scope,
	anchorRef,
	anchorId,
}: Readonly<{
	scope: PulseSprintScope;
	anchorRef?: RefCallback<HTMLElement>;
	anchorId: string;
}>) {
	const reactId = useId();
	const headingId = `${reactId}-pulse-sprint-brief`;
	const burndownLabelId = `${reactId}-pulse-sprint-burndown`;
	const figureTitleId = `${reactId}-pulse-sprint-figure-title`;
	const figureDescId = `${reactId}-pulse-sprint-figure-desc`;
	const scopeChangeLabelId = `${reactId}-pulse-sprint-scope-change`;

	const progress = toPulseProgressModel(scope.segments);
	const geometry = buildPulseBurndownGeometry({
		points: scope.burndown,
		totalPoints: scope.committedPoints,
		width: VIEW_WIDTH - EDGE,
		// The baseline is a 1px rule centred on `bottom`; a whole unit of inset
		// keeps its lower half inside the viewport instead of clipped away.
		height: VIEW_HEIGHT - 1,
		gutterLeft: GUTTER,
		padTop: 10,
		gridCount: 5,
	});
	const verdict = toPulseBurndownVerdict({
		points: scope.burndown,
		totalPoints: scope.committedPoints,
	});
	const closedPoints = toClosedPoints(scope.burndown);
	const firstClosed = closedPoints[0];
	const lastClosed = closedPoints[closedPoints.length - 1];
	const remainingPoints = lastClosed?.remaining ?? scope.scopePoints;
	const todayPoint = toLastPathPoint(geometry.linePath);
	// One number aligns the y-axis column and the x-axis row with the plot at
	// every width, because the gutter is a constant fraction of the viewBox.
	const gutterPercent = (geometry.plot.left / VIEW_WIDTH) * 100;

	const figureDescription = firstClosed === undefined || lastClosed === undefined
		? `No day has closed yet in ${scope.key}.`
		: `Remaining work moved from ${firstClosed.remaining} points on ${firstClosed.label} to ${lastClosed.remaining} points on ${lastClosed.label}, against a guideline falling from ${scope.committedPoints} points to zero by ${geometry.lastLabel}. The line is ${VERDICT_PHRASE[verdict]}.`;

	return (
		<section aria-labelledby={headingId} className="flex min-w-0 flex-col">
			<div id={anchorId} ref={anchorRef}>
				<div className={cn("flex min-h-6 min-w-0 items-center gap-4", MEASURE)}>
					<p className={cn("min-w-0 truncate", PULSE_EYEBROW)}>
						{`${scope.key} · ${scope.rangeLabel}`}
					</p>
					<p className={cn("ml-auto shrink-0", PULSE_EYEBROW)}>
						{toDaysClause(scope.daysRemaining)}
					</p>
				</div>

				<h2 className={cn("mt-7 text-pretty text-text", MEASURE)} id={headingId} style={HEADLINE_STYLE}>
					{scope.name}
				</h2>

				<p className={cn("mt-4 text-pretty", PULSE_ITEM_BODY, MEASURE)}>{scope.goal}</p>
			</div>

			{/* Progress lock-up: the bar, the number it resolves to, and the key. */}
			<div className={cn("mt-10 min-w-0", MEASURE)}>
				<div className="flex min-w-0 items-center gap-5">
					{/* A 10px bar centred on a 28px line box sits a hair high against
					    the digits' own optical centre; one pixel down fixes it. */}
					<PulseProgressBar className="min-w-0 flex-1 translate-y-px" segments={scope.segments} />
					<p className="shrink-0 text-[22px] leading-7 font-medium tracking-[-0.02em] text-text tabular-nums">
						{`${progress.doneCount} of ${progress.total}`}
						{/* The unit, said once and early. Everything above this line is
						    counted in work items and everything below it in story points;
						    a bare "40% done" beside a burndown reading ~30% is two true
						    numbers that look like a contradiction. */}
						<span className="text-text-subtle"> items done</span>
					</p>
				</div>
				<PulseProgressLegend className="mt-5" model={progress} />
			</div>

			<section aria-labelledby={burndownLabelId} className={cn("mt-10 min-w-0", MEASURE)}>
				<div className="flex min-w-0 items-center justify-between gap-4">
					<PulseSectionLabel id={burndownLabelId}>Burndown</PulseSectionLabel>
					{/* The key reads before the figure, not after it. Hidden from the
					    accessibility tree because the figure's own description names
					    both series in words. The swatches carry each series' own line
					    treatment — a solid rule for the remaining-work line, a dashed
					    one for the guideline — because two identical dots in different
					    greys do not tell a reader which mark on the chart is which. */}
					<ul
						aria-hidden
						className="flex shrink-0 items-center gap-4 text-[10px] leading-4 text-text-subtlest"
					>
						<li className="flex items-center gap-1.5">
							<span className="h-0.5 w-3 rounded-full bg-blue-400" />
							Remaining work
						</li>
						<li className="flex items-center gap-1.5">
							{/* A 3-on-3-off dash, matching the figure's `strokeDasharray`. */}
							<span className="h-0.5 w-3 bg-border-bold [mask-image:repeating-linear-gradient(to_right,#000_0_3px,transparent_3px_6px)]" />
							Guideline
						</li>
					</ul>
				</div>

				<p className={cn("mt-3 text-pretty", PULSE_ITEM_BODY)}>
					{`${scope.donePoints} of ${scope.scopePoints} points done, ${remainingPoints} to go — ${VERDICT_PHRASE[verdict]} ${toVerdictTail(scope.daysRemaining)}.`}
				</p>

				<div className="relative mt-6 min-w-0">
					<svg
						aria-labelledby={`${figureTitleId} ${figureDescId}`}
						className="block h-[168px] w-full"
						preserveAspectRatio="none"
						role="img"
						viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
					>
						<title id={figureTitleId}>{`${scope.key} burndown`}</title>
						<desc id={figureDescId}>{figureDescription}</desc>

						{geometry.areaPath === "" ? null : (
							<path className="fill-blue-400/12" d={geometry.areaPath} />
						)}

						{geometry.gridLines.map((line) => (
							<line
								className={line.isBaseline ? "stroke-border-bold" : "stroke-border"}
								key={line.label}
								strokeWidth={1}
								vectorEffect="non-scaling-stroke"
								x1={geometry.plot.left}
								x2={geometry.plot.right}
								y1={line.y}
								y2={line.y}
							/>
						))}

						<path
							className="stroke-border-bold"
							d={geometry.guidelinePath}
							fill="none"
							strokeDasharray="3 3"
							strokeWidth={1}
							vectorEffect="non-scaling-stroke"
						/>

						{geometry.todayX === null ? null : (
							<line
								className="stroke-border-bold"
								strokeDasharray="2 3"
								strokeWidth={1}
								vectorEffect="non-scaling-stroke"
								x1={geometry.todayX}
								x2={geometry.todayX}
								y1={geometry.plot.top}
								y2={geometry.plot.bottom}
							/>
						)}

						{geometry.linePath === "" ? null : (
							<path
								className="stroke-blue-400"
								d={geometry.linePath}
								fill="none"
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								vectorEffect="non-scaling-stroke"
							/>
						)}
					</svg>

					{/* Axis labels as HTML: the element is 168px tall and the viewBox is
					    168 units, so a grid line's `y` is already its `top`. */}
					<div
						aria-hidden
						className="pointer-events-none absolute inset-y-0 left-0 text-[10px] leading-none text-text-subtle tabular-nums"
						style={{ width: `${gutterPercent}%` }}
					>
						{geometry.gridLines.map((line) => (
							<span
								className="absolute right-1.5 -translate-y-1/2"
								key={line.label}
								style={{ top: `${line.y}px` }}
							>
								{line.label}
							</span>
						))}
					</div>

					{todayPoint === null ? null : (
						<span
							aria-hidden
							className="pointer-events-none absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400 outline-2 outline-surface"
							style={{
								left: `${(todayPoint.x / VIEW_WIDTH) * 100}%`,
								top: `${todayPoint.y}px`,
							}}
						/>
					)}
				</div>

				<div
					aria-hidden
					className="relative mt-2.5 flex items-baseline justify-between gap-4 text-[10px] leading-4 text-text-subtle tabular-nums"
					style={{ paddingLeft: `${gutterPercent}%` }}
				>
					<span>{geometry.firstLabel}</span>
					{/* The dotted rule is the single most important x on a burndown and
					    the reference leaves it unlabelled, so a reader has to count grid
					    columns to find out where "now" is. It is named here, on the axis
					    row, in the emphasis the two endpoints do not get. Suppressed when
					    it would collide with an endpoint — the first or last day closing
					    is exactly when the label is redundant anyway. */}
					{geometry.todayX === null || lastClosed === undefined || closedPoints.length === scope.burndown.length || closedPoints.length < 2 ? null : (
						<span
							className="absolute -translate-x-1/2 font-semibold text-text-subtle"
							style={{ left: `${(geometry.todayX / VIEW_WIDTH) * 100}%` }}
						>
							{lastClosed.label}
						</span>
					)}
					<span>{geometry.lastLabel}</span>
				</div>

				<table className="sr-only">
					<caption>{`${scope.key} burndown — points remaining at the close of each day`}</caption>
					<thead>
						<tr>
							<th scope="col">Day</th>
							<th scope="col">Points remaining</th>
						</tr>
					</thead>
					<tbody>
						{closedPoints.map((point) => (
							<tr key={point.label}>
								<th scope="row">{point.label}</th>
								<td>{point.remaining}</td>
							</tr>
						))}
					</tbody>
				</table>
			</section>

			<section aria-labelledby={scopeChangeLabelId} className={cn("mt-10 min-w-0", MEASURE)}>
				<PulseSectionLabel id={scopeChangeLabelId}>Scope change</PulseSectionLabel>
				<PulseSprintScopeChangeLead
					netPoints={scope.scopeChangeNetPoints}
					totalPoints={scope.committedPoints}
				/>
				<dl className="mt-5 min-w-0">
					{scope.scopeChange.map((entry) => (
						<PulseSprintScopeChangeRow entry={entry} key={entry.id} />
					))}
				</dl>
			</section>
		</section>
	);
}
