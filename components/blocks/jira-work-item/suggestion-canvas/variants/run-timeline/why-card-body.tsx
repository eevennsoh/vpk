"use client";

import { useEffect, useRef, useState } from "react";
import ThumbsDownIcon from "@atlaskit/icon/core/thumbs-down";
import ThumbsUpIcon from "@atlaskit/icon/core/thumbs-up";

import type { WorkItemSuggestion } from "@/components/blocks/jira-suggestion/data/suggestions";
import { Button } from "@/components/ui/button";
import { PopoverDescription, PopoverTitle } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { EvidenceCard } from "../ledger-popover/evidence";
import { ConfidenceMeter } from "../ledger-popover/why-card";

type Feedback = "up" | "down" | null;

/** What the title calls the suggestion: its value when that is short, otherwise the field's own name. */
function subjectOf(suggestion: WorkItemSuggestion): string {
	const { label, value } = suggestion;
	const field = label.toLowerCase();
	switch (value.kind) {
		case "person":
			return value.person.name;
		case "date":
			return value.display;
		case "issue":
			return value.issue.key;
		case "labels":
			return value.labels.length === 1 ? value.labels[0] ?? `this ${field}` : `these ${field}`;
		case "checklist":
			return `these ${field}`;
		case "paragraph":
			return `this ${field}`;
		default: {
			const unreachable: never = value;
			return unreachable;
		}
	}
}

/** Fades show only where there is more to read, so a cut-off source reads as "scroll", never as the end. */
function useScrollEdges() {
	const ref = useRef<HTMLDivElement>(null);
	const [edges, setEdges] = useState({ above: false, below: false });
	useEffect(() => {
		const scroller = ref.current;
		if (!scroller) return undefined;
		const measure = () => {
			const above = scroller.scrollTop > 1;
			const below = scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 1;
			setEdges((current) => (current.above === above && current.below === below ? current : { above, below }));
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(scroller);
		scroller.addEventListener("scroll", measure, { passive: true });
		return () => {
			observer.disconnect();
			scroller.removeEventListener("scroll", measure);
		};
	}, []);
	return { ref, ...edges };
}

const EDGE = "pointer-events-none sticky z-10 block h-6 shrink-0 from-popover transition-opacity duration-fast ease-out-practical";

function FeedbackRow({ subject }: Readonly<{ subject: string }>) {
	const [feedback, setFeedback] = useState<Feedback>(null);
	const toggle = (next: Exclude<Feedback, null>) => setFeedback((current) => (current === next ? null : next));
	return (
		<div className="flex items-center justify-between gap-3 border-t border-border pt-2.5">
			<p aria-live="polite" className="text-xs text-text-subtlest">
				{feedback == null ? "Was this reasoning helpful?" : "Thanks. The agent learns from this."}
			</p>
			<div className="-mr-1.5 flex items-center gap-0.5">
				<Button aria-label={`Helpful reasoning for ${subject}`} aria-pressed={feedback === "up"} className="aria-pressed:text-icon-success aria-pressed:[&_svg]:text-icon-success" onClick={() => toggle("up")} selectedAppearance="icon-only" size="icon-compact" type="button" variant="ghost">
					<ThumbsUpIcon color="currentColor" label="" size="small" />
				</Button>
				<Button aria-label={`Unhelpful reasoning for ${subject}`} aria-pressed={feedback === "down"} className="aria-pressed:text-icon-danger aria-pressed:[&_svg]:text-icon-danger" onClick={() => toggle("down")} selectedAppearance="icon-only" size="icon-compact" type="button" variant="ghost">
					<ThumbsDownIcon color="currentColor" label="" size="small" />
				</Button>
			</div>
		</div>
	);
}

/**
 * The why card's content: reasoning, confidence, every source and feedback in one scroll, so the card can be capped
 * at the panel's height and the most persuasive evidence (often the last source) is one scroll away, with a fade saying so.
 */
export function WhyCardBody({ suggestion }: Readonly<{ suggestion: WorkItemSuggestion }>) {
	const subject = subjectOf(suggestion);
	const { reason } = suggestion;
	const { ref, above, below } = useScrollEdges();
	return (
		<div className="flex min-h-0 flex-col overflow-y-auto overscroll-contain" data-why-scroll="" ref={ref}>
			<span aria-hidden="true" className={cn(EDGE, "top-0 -mb-6 bg-linear-to-b", above ? "opacity-100" : "opacity-0")} />
			<div className="flex flex-col gap-3 px-4 pt-3.5 pb-3">
				<div className="flex flex-col gap-1">
					<div className="flex items-center justify-between gap-3">
						<span className="text-xs text-text-subtlest">{suggestion.label}</span>
						<ConfidenceMeter confidence={suggestion.confidence} />
					</div>
					<PopoverTitle className="text-sm leading-5 font-semibold text-pretty text-text">Why we suggested {subject}</PopoverTitle>
				</div>
				<PopoverDescription className="flex flex-col gap-1.5 text-sm leading-5 text-pretty">
					<span className="text-text">{reason.headline}</span>
					<span className="text-text-subtle">{reason.detail}</span>
				</PopoverDescription>
				<section aria-label="Sources" className="flex flex-col gap-2">
					<h3 className="flex items-center gap-1.5 text-xs font-medium text-text-subtle">
						Sources
						<span className="text-text-subtlest tabular-nums">{reason.evidence.length}</span>
					</h3>
					<ul className="flex flex-col">
						{reason.evidence.map((evidence) => (
							<li className="border-t border-border py-3 first:border-t-0 first:pt-1" key={evidence.id}><EvidenceCard evidence={evidence} /></li>
						))}
					</ul>
				</section>
				<FeedbackRow subject={subject} />
			</div>
			<span aria-hidden="true" className={cn(EDGE, "bottom-0 -mt-6 bg-linear-to-t", below ? "opacity-100" : "opacity-0")} />
		</div>
	);
}
