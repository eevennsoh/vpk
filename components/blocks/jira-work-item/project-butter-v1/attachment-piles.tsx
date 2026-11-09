"use client";

import { useEffect, useEffectEvent, useId, useRef, useState, type KeyboardEvent } from "react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { AttachmentArrival } from "@/components/blocks/jira-work-item/project-butter-v1/attachment-arrival";
import { ProjectButterAttachmentCard } from "@/components/blocks/jira-work-item/project-butter-v1/attachment-card";
import { ProjectButterAttachmentStack } from "@/components/blocks/jira-work-item/project-butter-v1/attachment-stack";
import type { AttachmentGroupType, ProjectButterAttachment } from "@/components/blocks/jira-work-item/project-butter-v1/attachment-data";
import { attachmentDisplayName, groupProjectButterAttachments } from "@/components/blocks/jira-work-item/project-butter-v1/attachment-model";
import { motionDuration, motionEase } from "@/lib/motion";

const FORM_MS = motionDuration.slow * 1000;

/**
 * Project Butter grid (reference AttachmentPiles). Several piles can be open; a pile that drops below two
 * items closes and its last card becomes a single. Escape closes the pile holding focus, else the most
 * recently opened one, and returns focus to its toggle. Cards that appear after the first render play the
 * arrival sequence (skipped under reduced motion) and are announced.
 */
export function ProjectButterAttachmentPiles({ items, onRemove }: Readonly<{ items: readonly ProjectButterAttachment[]; onRemove: (item: ProjectButterAttachment) => void }>) {
	const id = useId();
	const reducedMotion = useReducedMotion();
	const gridRef = useRef<HTMLDivElement>(null);
	const { piles, singles } = groupProjectButterAttachments(items);
	const [openOrder, setOpenOrder] = useState<readonly AttachmentGroupType[]>([]);
	const openTypes = openOrder.filter((type) => piles.some((pile) => pile.type === type));
	const [arrivals, setArrivals] = useState<ReadonlySet<string>>(() => new Set());
	const [notice, setNotice] = useState("");
	const [forming, setForming] = useState<AttachmentGroupType | null>(null);
	const seen = useRef<Set<string> | null>(null);
	const counts = useRef<ReadonlyMap<AttachmentGroupType, number> | null>(null);
	const itemIds = items.map((item) => item.id).join("\u0000");
	const pileShape = piles.map((pile) => `${pile.type}:${pile.items.length}`).join(",") + `|${singles.length}`;
	const noteArrivals = useEffectEvent(() => {
		const known = seen.current;
		if (!known) {
			seen.current = new Set(items.map((item) => item.id));
			return;
		}
		const fresh = items.filter((item) => !known.has(item.id));
		for (const item of fresh) known.add(item.id);
		if (fresh.length === 0) return;
		setNotice(fresh.length === 1 ? `${fresh[0] ? attachmentDisplayName(fresh[0]) : "Attachment"} added` : `${fresh.length} attachments added`);
		if (!reducedMotion) setArrivals((current) => new Set([...current, ...fresh.map((item) => item.id)]));
	});
	// Keyed by the id list: `items` identity changes every render.
	useEffect(() => noteArrivals(), [itemIds]);
	const notePileShape = useEffectEvent(() => {
		const next = new Map<AttachmentGroupType, number>(groupProjectButterAttachments(items).piles.map((pile) => [pile.type, pile.items.length]));
		const previous = counts.current;
		counts.current = next;
		if (!previous || reducedMotion) return undefined;
		const formed = [...next.keys()].find((type) => !previous.has(type));
		if (!formed) return undefined;
		setForming(formed);
		const timer = window.setTimeout(() => setForming(null), FORM_MS);
		return () => window.clearTimeout(timer);
	});
	useEffect(() => notePileShape(), [pileShape]);
	function finishArrival(itemId: string) {
		setArrivals((current) => {
			if (!current.has(itemId)) return current;
			const next = new Set(current);
			next.delete(itemId);
			return next;
		});
	}
	const arriving = (item: ProjectButterAttachment) => arrivals.has(item.id) ? <AttachmentArrival item={item} onDone={() => finishArrival(item.id)} /> : null;
	function toggle(type: AttachmentGroupType) {
		setOpenOrder((current) => current.includes(type) ? current.filter((candidate) => candidate !== type) : [...current.filter((candidate) => openTypes.includes(candidate)), type]);
	}
	function escape(event: KeyboardEvent<HTMLDivElement>) {
		if (event.key !== "Escape" || openTypes.length === 0 || !(event.target instanceof Element) || event.target.closest('[role="menu"]')) return;
		const focusedPile = event.target.closest("[data-attachment-pile]")?.getAttribute("data-attachment-pile") as AttachmentGroupType | null;
		const type = focusedPile && openTypes.includes(focusedPile) ? focusedPile : openTypes.at(-1);
		if (!type) return;
		event.preventDefault();
		event.stopPropagation();
		setOpenOrder((current) => current.filter((candidate) => candidate !== type));
		gridRef.current?.querySelector<HTMLButtonElement>(`[data-pile-toggle="${type}"]`)?.focus();
	}
	const onlyOpen = openTypes.length === 1 ? piles.find((pile) => pile.type === openTypes[0]) : undefined;
	const layout = { layout: { duration: motionDuration.slow, ease: motionEase.outPractical } };
	return (
		<LayoutGroup id={id}>
			<span className="sr-only" role="status">{notice}</span>
			<div className="@container/attachments" onKeyDownCapture={escape}>
				<motion.div aria-label={onlyOpen ? `${onlyOpen.label}, ${onlyOpen.items.length} attachments` : "Attachments"} className="grid grid-cols-2 items-start gap-6 pt-3 @[432px]/attachments:grid-cols-3 @[584px]/attachments:grid-cols-4 @[736px]/attachments:grid-cols-5 @[888px]/attachments:grid-cols-6 @[1040px]/attachments:grid-cols-7" data-attachment-piles layout ref={gridRef} role="group" transition={layout}>
					{piles.map((pile) => <ProjectButterAttachmentStack arriving={arriving} forming={forming === pile.type} key={pile.type} onRemove={onRemove} onToggle={() => toggle(pile.type)} open={openTypes.includes(pile.type)} pile={pile} />)}
					{singles.map((item) => {
						const overlay = arriving(item);
						return (
							<motion.div className="relative min-w-0" data-attachment-card={item.id} key={item.id} layout layoutId={item.id} transition={layout}>
								<div aria-hidden={overlay ? true : undefined} className={overlay ? "opacity-0" : undefined} inert={Boolean(overlay) || undefined}><ProjectButterAttachmentCard item={item} onRemove={overlay ? undefined : onRemove} /></div>
								{overlay}
							</motion.div>
						);
					})}
				</motion.div>
			</div>
		</LayoutGroup>
	);
}
