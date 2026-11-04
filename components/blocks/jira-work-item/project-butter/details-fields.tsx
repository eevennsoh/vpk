"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
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

export function ProjectButterDetailsFields({ content, expanded, fillingBarAfter = null, reflow = false, shimmerText }: Readonly<{ content: ProjectButterContent; empty: boolean; expanded: boolean; fillingBarAfter?: ProjectButterDetailFieldId | "top" | null; reflow?: boolean; shimmerText?: Readonly<Partial<Record<ProjectButterDetailFieldId, string>>> }>) {
	const id = useId();
	const rootRef = useRef<HTMLDivElement>(null);
	const heightRef = useRef<number | null>(null);
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
		const to = root.scrollHeight;
		heightRef.current = to;
		if (reduced || from === null || Math.abs(from - to) < 1) return;
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
	const order = fields.order.filter((field) => !fields.hidden.includes(field));
	const visible = expanded ? order : order.slice(0, 4);
	return (
		<div data-project-butter-detail-fields data-project-butter-field-dragging={dragging ? "true" : undefined} ref={rootRef}>
			<DndContext collisionDetection={closestCenter} id={id} modifiers={[restrictToVerticalAxis]} onDragCancel={() => setDragging(false)} onDragStart={() => setDragging(true)} onDragEnd={({ active, over }) => {
				setDragging(false);
				content.setDetailFields((current) => ({ ...current, order: reorderProjectButterDetailFields(current.order, active.id, over?.id ?? null) }));
			}} sensors={sensors}>
				<SortableContext items={visible} strategy={verticalListSortingStrategy}>
					<div className="flex min-w-0 flex-col gap-4 [&>[data-field-filled=false]+[data-field-filled=true]]:mt-1 [&>*+[data-field-filled=false]]:-mt-1">
						{visible.flatMap((field, index) => {
							const filled = isProjectButterDetailFieldFilled(field, content);
							const required = PROJECT_BUTTER_REQUIRED_DETAIL_FIELDS.includes(field);
							const row = <DetailsFieldRow filled={filled} first={index === 0} id={field} key={field} last={index === visible.length - 1} onClear={filled && !required && field !== "costPerReach" ? () => clearProjectButterDetailField(field, content) : undefined} onHide={required ? undefined : () => content.setDetailFields((current) => ({ ...current, hidden: [...current.hidden, field] }))} reflow={reflow && !dragging} shimmerText={shimmerText?.[field]} onMove={(direction) => {
								const target = visible[index + direction];
								if (target) content.setDetailFields((current) => ({ ...current, order: reorderProjectButterDetailFields(current.order, field, target) }));
							}}><ProjectButterDetailFieldValue content={content} id={field} /></DetailsFieldRow>;
							if (index === 0 && fillingBarAfter === "top") return [<ProjectButterSuggestionCursor key="filling-bar" />, row];
							return field === fillingBarAfter ? [row, <ProjectButterSuggestionCursor key="filling-bar" />] : [row];
						})}
					</div>
				</SortableContext>
			</DndContext>
		</div>
	);
}
