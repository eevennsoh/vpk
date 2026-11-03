"use client";

import { useRef } from "react";
import { AnimatePresence, motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { motionDuration, motionEase } from "@/lib/motion";

import type { SuggestionFieldId, WorkItemSuggestion } from "@/components/blocks/jira-work-item/suggestion-canvas/data/suggestions";
import type { SuggestionDecision } from "@/components/blocks/jira-work-item/suggestion-canvas/use-suggestion-review";
import { GroupDivider } from "./menu-chrome";
import { Receipt, type DecideVia } from "./quiet-row";

const OPEN = { duration: motionDuration.medium, ease: motionEase.inOut };
const CLOSE = { duration: motionDuration.normal, ease: motionEase.in };

export interface ReviewedGroupProps {
	id: string;
	open: boolean;
	ids: readonly SuggestionFieldId[];
	byId: ReadonlyMap<SuggestionFieldId, WorkItemSuggestion>;
	decisionOf: (id: SuggestionFieldId) => SuggestionDecision;
	onUndo: (id: SuggestionFieldId, via: DecideVia) => void;
}

/**
 * Every decided suggestion, as one-line receipts with Undo. Collapsed by default behind the footer's progress,
 * so the menu stays minimal while nothing a reviewer decided is ever out of reach.
 */
export function ReviewedGroup({ id, open, ids, byId, decisionOf, onUndo }: Readonly<ReviewedGroupProps>) {
	const sectionRef = useRef<HTMLElement>(null);
	/** While the group grows, keep the menu scrolled to its foot so it unfolds out of the footer toggle that opened it. */
	const pinToFooter = () => {
		if (!open) return;
		const scroller = sectionRef.current?.closest<HTMLElement>("[data-why-scrollport]");
		if (scroller) scroller.scrollTop = scroller.scrollHeight;
	};
	return (
		<AnimatePresence initial={false}>
			{open ? (
				<motion.section
					animate={{ height: "auto", opacity: 1, transition: OPEN }}
					aria-label="Reviewed suggestions"
					exit={{ height: 0, opacity: 0, transition: CLOSE }}
					id={id}
					initial={{ height: 0, opacity: 0 }}
					key="reviewed"
					onUpdate={pinToFooter}
					ref={sectionRef}
					style={{ overflow: "clip", overflowClipMargin: 4 }}
				>
					<GroupDivider fresh={false} label="Reviewed" />
					<ul>
						<AnimatePresence initial={false}>
							{ids.map((rowId) => {
								const suggestion = byId.get(rowId);
								const decision = decisionOf(rowId);
								if (!suggestion || decision === "pending") return null;
								return (
									<motion.li
										animate={{ height: "auto", opacity: 1, transition: OPEN }}
										exit={{ height: 0, opacity: 0, transition: CLOSE }}
										initial={{ height: 0, opacity: 0 }}
										key={rowId}
										style={{ overflow: "clip", overflowClipMargin: 4 }}
									>
										<div className="group/reviewed flex min-h-9 items-center gap-2 rounded-lg px-2.5 py-1 transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered">
											<Receipt decision={decision} label={suggestion.label} />
											<span className="flex-1" />
											<Button
												aria-label={`Undo ${suggestion.label} ${decision === "accepted" ? "accept" : "dismiss"}`}
												className="-mr-1 px-2 text-xs font-normal text-text-subtlest group-hover/reviewed:text-text-subtle hover:text-text focus-visible:text-text"
												onClick={(event) => onUndo(rowId, event.detail === 0 ? "keyboard" : "pointer")}
												size="compact"
												type="button"
												variant="ghost"
											>
												Undo
											</Button>
										</div>
									</motion.li>
								);
							})}
						</AnimatePresence>
					</ul>
				</motion.section>
			) : null}
		</AnimatePresence>
	);
}
