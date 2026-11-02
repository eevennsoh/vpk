"use client";

import { useId, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DetailsFieldRow } from "@/components/blocks/jira-work-item/project-butter/details-field-row";
import { clearProjectButterDetailField, isProjectButterDetailFieldFilled, ProjectButterDetailFieldValue } from "@/components/blocks/jira-work-item/project-butter/details-field-values";
import { PROJECT_BUTTER_REQUIRED_DETAIL_FIELDS, reorderProjectButterDetailFields } from "@/components/blocks/jira-work-item/project-butter/details-model";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";

export function ProjectButterDetailsFields({ content, empty, expanded }: Readonly<{ content: ProjectButterContent; empty: boolean; expanded: boolean }>) {
	const id = useId();
	const [dragging, setDragging] = useState(false);
	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, scrollBehavior: "auto" }));
	const fields = content.detailFields;
	const order = fields.order.filter((field) => !fields.hidden.includes(field));
	const visible = expanded ? order : order.slice(0, empty ? 3 : 4);
	return (
		<div data-project-butter-detail-fields data-project-butter-field-dragging={dragging ? "true" : undefined}>
			<DndContext collisionDetection={closestCenter} id={id} onDragCancel={() => setDragging(false)} onDragStart={() => setDragging(true)} onDragEnd={({ active, over }) => {
				setDragging(false);
				content.setDetailFields((current) => ({ ...current, order: reorderProjectButterDetailFields(current.order, active.id, over?.id ?? null) }));
			}} sensors={sensors}>
				<SortableContext items={visible} strategy={verticalListSortingStrategy}>
					<div className="flex min-w-0 flex-col gap-4 [&>[data-field-filled=false]+[data-field-filled=true]]:mt-1 [&>*+[data-field-filled=false]]:-mt-1">
						{visible.map((field, index) => {
							const filled = isProjectButterDetailFieldFilled(field, content);
							const required = PROJECT_BUTTER_REQUIRED_DETAIL_FIELDS.includes(field);
							return <DetailsFieldRow filled={filled} first={index === 0} id={field} key={field} last={index === visible.length - 1} onClear={filled && !required && field !== "costPerReach" ? () => clearProjectButterDetailField(field, content) : undefined} onHide={required ? undefined : () => content.setDetailFields((current) => ({ ...current, hidden: [...current.hidden, field] }))} onMove={(direction) => {
								const target = visible[index + direction];
								if (target) content.setDetailFields((current) => ({ ...current, order: reorderProjectButterDetailFields(current.order, field, target) }));
							}}><ProjectButterDetailFieldValue content={content} id={field} /></DetailsFieldRow>;
						})}
					</div>
				</SortableContext>
			</DndContext>
		</div>
	);
}
