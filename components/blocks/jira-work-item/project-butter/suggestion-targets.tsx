"use client";

import { createContext, use, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion } from "motion/react";
import type { SuggestionFieldId, WorkItemSuggestion } from "@/components/blocks/jira-suggestion/data/suggestions";
import { JIRA_DROPZONE_ANTS_STROKE_CLASS } from "@/components/blocks/jira-dropzone/lib/jira-dropzone-ants";
import { getShimmerWaveEndTime } from "@/components/ui-custom/lib/shimmer-wave-timing";
import { motionDuration, motionEase } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { SUGGESTION_REVEAL_DURATION, SUGGESTION_REVEAL_SPREAD } from "./details-rail";
import type { DetailSuggestionReveal } from "@/components/blocks/jira-work-item/project-butter/use-suggestion-fill";
import { SuggestionValueReveal } from "./suggestion-rainbow-text";
import { releasedPreviewPadding } from "./suggestion-preview-room";

type Preview = Pick<WorkItemSuggestion, "id" | "valueText">;
const TargetState = createContext<Preview | null>(null);
export const SuggestionLabelReveal = createContext<DetailSuggestionReveal | undefined>(undefined);
export const CriteriaReveal = createContext<readonly string[] | null>(null);
const TargetActions = createContext<{
	open: (panelId: string) => void;
	reveal: (element: HTMLElement, reduced: boolean) => void;
	preview: (card: Preview | null) => void;
	clear: (id?: SuggestionFieldId) => void;
	revealCriteria: (items: readonly string[] | null) => void;
} | null>(null);

export function ProjectButterSuggestionTargets({ children }: Readonly<{ children: ReactNode }>) {
	const [preview, setPreview] = useState<Preview | null>(null);
	const [criteria, setCriteria] = useState<readonly string[] | null>(null);
	const reviewId = useRef("");
	const padding = useRef<{ port: HTMLElement; original: string; minimum: number; release?: () => void } | null>(null);
	const actions = useMemo(() => {
		const restorePadding = () => {
			if (padding.current) {
				padding.current.release?.();
				padding.current.port.style.paddingBottom = padding.current.original;
			}
			padding.current = null;
		};
		/**
		 * Ends a preview without moving the view: dropping the room all at once would shrink the scrollport under the
		 * reader and snap it back. Only the room below the viewport goes now; the rest goes as they scroll back up.
		 */
		const releasePadding = () => {
			const held = padding.current;
			if (!held || held.release) return;
			const trim = () => {
				const { port, minimum } = held;
				const next = releasedPreviewPadding({ padding: parseFloat(port.style.paddingBottom), minimum, scrollHeight: port.scrollHeight, scrollTop: port.scrollTop, clientHeight: port.clientHeight });
				if (next === null) restorePadding();
				else port.style.paddingBottom = `${next}px`;
			};
			held.port.addEventListener("scroll", trim, { passive: true });
			held.release = () => held.port.removeEventListener("scroll", trim);
			trim();
		};
		return {
			open(id: string) { reviewId.current = id; },
			restorePadding,
			releasePadding,
			reveal(element: HTMLElement, reduced: boolean) {
				const review = document.getElementById(reviewId.current)?.getBoundingClientRect();
				const field = element.getBoundingClientRect();
				const behavior = reduced ? "instant" : "smooth";
				if (review && field.right > review.left && field.left < review.right && field.bottom > review.top) {
					for (let port = element.parentElement; port; port = port.parentElement) {
						if (!["auto", "scroll"].includes(getComputedStyle(port).overflowY)) continue;
						const bounds = port.getBoundingClientRect();
						if (bounds.top >= review.top || bounds.bottom <= review.top) break;
						if (padding.current?.port !== port) {
							restorePadding();
							padding.current = { port, original: port.style.paddingBottom, minimum: parseFloat(getComputedStyle(port).paddingBottom) };
						} else if (padding.current.release) {
							padding.current.release();
							padding.current.release = undefined;
						}
						const clearance = review.top - 12;
						port.style.paddingBottom = `${Math.max(padding.current.minimum, bounds.bottom - clearance)}px`;
						port.scrollBy({ top: field.bottom - clearance, behavior });
						return;
					}
				}
				element.scrollIntoView({ block: "nearest", inline: "nearest", behavior });
			},
			preview: setPreview,
			revealCriteria: setCriteria,
			clear(id?: SuggestionFieldId) {
				setPreview((current) => id && current?.id !== id ? current : null);
			},
		};
	}, []);
	useEffect(() => {
		if (!preview) actions.releasePadding();
	}, [actions, preview]);
	useEffect(() => actions.restorePadding, [actions]);
	useEffect(() => {
		if (!criteria?.length) return;
		const duration = Math.max(...criteria.map((item) => getShimmerWaveEndTime(item, SUGGESTION_REVEAL_DURATION, SUGGESTION_REVEAL_SPREAD)));
		const timer = window.setTimeout(() => setCriteria(null), (duration + motionDuration.xxshort) * 1000);
		return () => window.clearTimeout(timer);
	}, [criteria]);
	return (
		<TargetActions value={actions}>
			<TargetState value={preview}>
				<CriteriaReveal value={criteria}>{children}</CriteriaReveal>
			</TargetState>
		</TargetActions>
	);
}

export function useSuggestionTargetActions() {
	return use(TargetActions);
}

export function useIsSuggestionTarget(field: string) {
	return use(TargetState)?.id === field;
}

/** The field a suggestion is being previewed in, if any. */
export function useSuggestionTargetField(): SuggestionFieldId | null {
	return use(TargetState)?.id ?? null;
}

/** The suggested value previewed in this field right now, or null when nothing previews here. */
export function useSuggestionPreviewText(field: string): string | null {
	const preview = use(TargetState);
	return preview?.id === field ? preview.valueText : null;
}

/** The preview's corner radius, which the shared dropzone stroke (drawn for a radius-lg well) takes inline. */
const PREVIEW_STROKE_SHAPE = {
	rx: "calc(var(--radius-md) - 0.5px)",
	ry: "calc(var(--radius-md) - 0.5px)",
	// There is no dashed CSS border underneath to fall back on, so reduced motion keeps these dashes, still.
	visibility: "visible",
} as const;

/** The board's create dropzone outline: its 1px 3-on-3-off dashes in the border colour, marching the same way. */
function PreviewStroke() {
	return (
		<svg aria-hidden className="pointer-events-none absolute inset-0 size-full overflow-visible" data-suggestion-preview-outline>
			<rect className={cn(JIRA_DROPZONE_ANTS_STROKE_CLASS, "stroke-border")} style={PREVIEW_STROKE_SHAPE} />
		</svg>
	);
}

export function DetailsSuggestionHighlight({ rootRef }: Readonly<{ rootRef: RefObject<HTMLDivElement | null> }>) {
	const field = use(TargetState)?.id;
	const reduced = useReducedMotion();
	const transform = useMotionValue("translate(0px, 0px)");
	const width = useMotionValue(0);
	const height = useMotionValue(0);
	const opacity = useMotionValue(0);

	useLayoutEffect(() => {
		const root = rootRef.current;
		const row = field ? root?.querySelector<HTMLElement>(`[data-field-id="${field}"] [data-project-butter-detail-value-row]`) : null;
		const visibility = { duration: reduced ? 0 : motionDuration.fast, ease: motionEase.outPractical };
		if (!root || !row) {
			const exit = animate(opacity, 0, visibility);
			return () => exit.stop();
		}

		let destination: { transform: string; width: number; height: number } | undefined;
		let movements: ReturnType<typeof animate>[] = [];
		const move = () => {
			const origin = root.getBoundingClientRect();
			const bounds = row.getBoundingClientRect();
			const next = { transform: `translate(${bounds.left - origin.left}px, ${bounds.top - origin.top}px)`, width: bounds.width, height: bounds.height };
			if (destination?.transform === next.transform && destination.width === next.width && destination.height === next.height) return;
			destination = next;
			for (const movement of movements) movement.stop();
			if (reduced || opacity.get() === 0) {
				transform.jump(next.transform);
				width.jump(next.width);
				height.jump(next.height);
			} else {
				const travel = { duration: motionDuration.medium, ease: motionEase.outPractical };
				movements = [animate(transform, next.transform, travel), animate(width, next.width, travel), animate(height, next.height, travel)];
			}
		};
		move();
		const enter = animate(opacity, 1, visibility);
		const observer = new ResizeObserver(move);
		observer.observe(row);
		observer.observe(root);
		return () => {
			observer.disconnect();
			enter.stop();
			for (const movement of movements) movement.stop();
		};
	}, [field, height, opacity, reduced, rootRef, transform, width]);

	return (
		<motion.span
			aria-hidden
			className="pointer-events-none absolute top-0 left-0 -z-10 rounded-md bg-surface-sunken"
			data-suggestion-preview-highlight
			data-suggestion-preview-field={field}
			style={{ transform, width, height, opacity }}
		>
			<PreviewStroke />
		</motion.span>
	);
}

export function SuggestionPreviewLabel({ field, children }: Readonly<{ field: string; children: ReactNode }>) {
	const reveal = use(SuggestionLabelReveal);
	return (
		<span className="relative min-w-0 flex-1 has-[[data-suggestion-preview]]:[&>span:first-child]:opacity-0 group-focus-within/butter-field:[&>span:first-child]:opacity-100!">
			<span className={field === "reporter" ? "block truncate" : undefined}>
				<span className={cn("inline-block max-w-full group-focus-within/butter-field:opacity-100!", reveal && "opacity-0")} data-project-butter-field-control>{children}</span>
			</span>
			<SuggestionFieldFeedback enabled={!reveal} field={field} inline />
			{reveal ? <SuggestionValueReveal key={reveal.key} reveal={reveal} truncate /> : null}
		</span>
	);
}

export function SuggestionFieldFeedback({ field, inline = false, enabled = true }: Readonly<{ field: string; inline?: boolean; enabled?: boolean }>) {
	const preview = use(TargetState);
	const actions = use(TargetActions);
	const reduced = useReducedMotion();
	const ref = useRef<HTMLSpanElement>(null);
	const target = enabled && preview?.id === field ? preview : null;
	const active = Boolean(target);
	useEffect(() => {
		if (active && ref.current) {
			const destination = (inline ? ref.current.closest<HTMLElement>("[data-project-butter-detail-value-row]") : null) ?? ref.current;
			actions?.reveal(destination, Boolean(reduced));
		}
	}, [actions, active, inline, reduced]);
	if (field === "description") {
		return (
			<AnimatePresence initial={false}>
				{target ? (
					<motion.span
						aria-hidden
						className="pointer-events-none z-20 col-start-1 row-start-1 min-w-0 self-start overflow-hidden"
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ duration: reduced ? 0 : motionDuration.medium, ease: motionEase.inOut }}
					>
						<span className="relative block rounded-md bg-surface-sunken px-2 py-1 text-sm text-text" data-suggestion-preview={field} ref={ref}>
							<PreviewStroke />
							<span className="line-clamp-3 wrap-anywhere">{target.valueText}</span>
						</span>
					</motion.span>
				) : null}
			</AnimatePresence>
		);
	}
	if (!target) return null;
	if (inline) {
		return (
			<span aria-hidden className="pointer-events-none absolute inset-0 z-20 flex items-center text-sm text-text group-focus-within/butter-field:opacity-0" data-suggestion-preview={field} ref={ref}>
				<span className="truncate">{target.valueText}</span>
			</span>
		);
	}
	return (
		<span aria-hidden className="pointer-events-none absolute inset-0 z-20" ref={ref}>
			<span className="absolute inset-x-0 bottom-0 flex min-h-8 items-center rounded-md bg-surface-sunken px-2 py-1 text-sm text-text" data-suggestion-preview={field}>
				<PreviewStroke />
				<span className="min-w-0 truncate">{target.valueText}</span>
			</span>
		</span>
	);
}
