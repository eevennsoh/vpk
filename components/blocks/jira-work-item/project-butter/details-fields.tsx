"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { animate, AnimatePresence, useReducedMotion } from "motion/react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DetailsFieldRow } from "@/components/blocks/jira-work-item/project-butter/details-field-row";
import { ProjectButterDetailFieldValue } from "@/components/blocks/jira-work-item/project-butter/details-field-values";
import { ProjectButterSuggestionCursor } from "@/components/blocks/jira-work-item/project-butter/suggestion-cursor";
import { PROJECT_BUTTER_REQUIRED_DETAIL_FIELDS, projectButterCostPerReach, reorderProjectButterDetailFields, type ProjectButterDetailFieldId } from "@/components/blocks/jira-work-item/project-butter/details-model";
import { PROJECT_BUTTER_UNASSIGNED } from "@/components/blocks/jira-work-item/project-butter/people";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import { motionDuration, motionEase } from "@/lib/motion";

function isProjectButterDetailFieldFilled(id: ProjectButterDetailFieldId, content: ProjectButterContent): boolean {
	if (id === "status" || id === "assignee" || id === "priority") return true;
	if (id === "dueDate") return Boolean(content.dueDate);
	if (id === "reporter") return Boolean(content.reporter);
	if (id === "costPerReach") return Boolean(projectButterCostPerReach(content.detailFields));
	const value = content.detailFields[id];
	return typeof value === "string" ? Boolean(value) : Array.isArray(value) ? value.length > 0 : Boolean(value.region || value.market);
}

function clearProjectButterDetailField(id: ProjectButterDetailFieldId, content: ProjectButterContent): void {
	if (id === "dueDate") content.setDueDate(undefined);
	else if (id === "reporter") content.setReporter(null);
	else if (id === "assignee") content.setAssignee(PROJECT_BUTTER_UNASSIGNED);
	else if (id !== "status" && id !== "priority" && id !== "costPerReach") {
		content.setDetailFields((fields) => ({ ...fields, [id]: id === "campaignRegion" ? { region: "", market: "" } : Array.isArray(fields[id]) ? [] : "" }));
	}
}

export function ProjectButterDetailsFields({ agentField, agentFieldHasSessions = false, content, expanded, fillingBarAfter = null, fillingFinishing = false, onRevealInteract, reflow = false, shimmerText }: Readonly<{ agentField?: ReactNode; agentFieldHasSessions?: boolean; content: ProjectButterContent; empty: boolean; expanded: boolean; fillingBarAfter?: ProjectButterDetailFieldId | "top" | null; fillingFinishing?: boolean; onRevealInteract?: (field: ProjectButterDetailFieldId) => void; reflow?: boolean; shimmerText?: Readonly<Partial<Record<ProjectButterDetailFieldId, string>>> }>) {
	const id = useId();
	const rootRef = useRef<HTMLDivElement>(null);
	const heightRef = useRef<number | null>(null);
	const dropRef = useRef<{ id: string | number; top: number } | null>(null);
	const dropAnimationRef = useRef<Animation | null>(null);
	const previousExpandedRef = useRef(expanded);
	const animatingRef = useRef(false);
	const reduced = useReducedMotion();
	const [dragging, setDragging] = useState(false);
	useEffect(() => {
		const root = rootRef.current;
		if (!root || typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(() => {
			if (!animatingRef.current) heightRef.current = root.getBoundingClientRect().height;
		});
		observer.observe(root);
		return () => observer.disconnect();
	}, []);
	useLayoutEffect(() => {
		const root = rootRef.current;
		if (!root) return;
		const from = heightRef.current;
		const to = root.getBoundingClientRect().height;
		const expansionChanged = previousExpandedRef.current !== expanded;
		previousExpandedRef.current = expanded;
		heightRef.current = to;
		if (!expansionChanged || reduced || from === null || Math.abs(from - to) < 1) return;
		let active = true;
		animatingRef.current = true;
		root.style.height = `${from}px`;
		root.style.overflow = "hidden";
		const animation = animate(root, { height: [from, to] }, { duration: motionDuration.slow, ease: motionEase.outPractical });
		const finish = () => {
			if (!active) return;
			active = false;
			root.style.height = "";
			root.style.overflow = "";
			animatingRef.current = false;
			heightRef.current = root.getBoundingClientRect().height;
		};
		void animation.finished.then(finish, finish);
		return () => {
			if (!active) return;
			heightRef.current = root.getBoundingClientRect().height;
			active = false;
			animation.stop();
			root.style.height = "";
			root.style.overflow = "";
			animatingRef.current = false;
		};
	}, [expanded, reduced]);
	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
	const fields = content.detailFields;
	const order = fields.order.filter((field) => field !== "status" && (field === "agents" ? Boolean(agentField) : !fields.hidden.includes(field)));
	const collapsed = new Set(order.filter((field) => field !== "agents").slice(0, 2));
	const visible = expanded ? order : order.filter((field) => field === "agents" || collapsed.has(field));
	useLayoutEffect(() => {
		const drop = dropRef.current;
		const root = rootRef.current;
		if (dragging || !drop || !root) return;
		dropRef.current = null;
		if (reduced) return;
		const row = Array.from(root.querySelectorAll<HTMLElement>("[data-field-id]"))
			.find((candidate) => candidate.dataset.fieldId === String(drop.id));
		if (!row) return;
		const style = getComputedStyle(row);
		const transform = new DOMMatrixReadOnly(style.transform);
		const targetTop = row.getBoundingClientRect().top - root.getBoundingClientRect().top - transform.m42;
		const offset = drop.top - targetTop;
		if (Math.abs(offset) < 1) return;
		const animation = row.animate(
			[{ transform: `translateY(${offset}px)` }, { transform: "translateY(0)" }],
			{ duration: motionDuration.normal * 1000, easing: style.getPropertyValue("--ease-out-practical").trim() },
		);
		dropAnimationRef.current = animation;
		return () => { animation.cancel(); };
	}, [dragging, fields.order, reduced]);
	return (
		<div className="relative" data-project-butter-detail-fields data-project-butter-field-dragging={dragging ? "true" : undefined} ref={rootRef}>
			<div className="pointer-events-none absolute -inset-x-2 top-0 -bottom-4 z-20 overflow-clip" data-project-butter-suggestion-clip>
				<AnimatePresence initial={false}>
					{fillingBarAfter ? <ProjectButterSuggestionCursor after={fillingBarAfter} finishing={fillingFinishing} key="filling-cursor" rootRef={rootRef} /> : null}
				</AnimatePresence>
			</div>
			<DndContext collisionDetection={closestCenter} id={id} modifiers={[restrictToVerticalAxis]} onDragCancel={() => setDragging(false)} onDragStart={() => { dropAnimationRef.current?.cancel(); setDragging(true); }} onDragEnd={({ active, over }) => {
				const root = rootRef.current;
				const row = root && Array.from(root.querySelectorAll<HTMLElement>("[data-field-id]")).find((candidate) => candidate.dataset.fieldId === String(active.id));
				if (root && row) dropRef.current = { id: active.id, top: row.getBoundingClientRect().top - root.getBoundingClientRect().top };
				setDragging(false);
				content.setDetailFields((current) => ({ ...current, order: reorderProjectButterDetailFields(current.order, active.id, over?.id ?? null) }));
			}} sensors={sensors}>
				<SortableContext items={visible} strategy={verticalListSortingStrategy}>
					<div className="flex min-w-0 flex-col gap-4 [&>[data-field-filled=false]+[data-field-filled=true]]:mt-1 [&>*+[data-field-filled=false]]:-mt-1">
						{visible.map((field, index) => {
							const filled = field === "agents" ? agentFieldHasSessions : isProjectButterDetailFieldFilled(field, content);
							const required = field === "agents" || PROJECT_BUTTER_REQUIRED_DETAIL_FIELDS.includes(field);
							return <DetailsFieldRow filled={filled} first={index === 0} id={field} key={field} last={index === visible.length - 1} onClear={field !== "agents" && filled && !required && field !== "costPerReach" ? () => clearProjectButterDetailField(field, content) : undefined} onHide={field === "agents" || required ? undefined : () => content.setDetailFields((current) => ({ ...current, hidden: [...current.hidden, field] }))} onRevealInteract={onRevealInteract} reflow={reflow && !dragging} shimmerText={field === "agents" ? undefined : shimmerText?.[field]} onMove={(direction) => {
								const target = visible[index + direction];
								if (target) content.setDetailFields((current) => ({ ...current, order: reorderProjectButterDetailFields(current.order, field, target) }));
							}}>{field === "agents" ? agentField : <ProjectButterDetailFieldValue content={content} id={field} />}</DetailsFieldRow>;
						})}
					</div>
				</SortableContext>
			</DndContext>
		</div>
	);
}
