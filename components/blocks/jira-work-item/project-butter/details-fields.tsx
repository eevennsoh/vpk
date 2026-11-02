"use client";

import { useId, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DetailsFieldRow } from "@/components/blocks/jira-work-item/project-butter/details-field-row";
import { ProjectButterDetailFieldValue } from "@/components/blocks/jira-work-item/project-butter/details-field-values";
import { PROJECT_BUTTER_REQUIRED_DETAIL_FIELDS, projectButterCostPerReach, reorderProjectButterDetailFields, type ProjectButterDetailFieldId } from "@/components/blocks/jira-work-item/project-butter/details-model";
import { TEAM_EU26_PEOPLE } from "@/components/blocks/jira-work-item/team-eu26/data/team-eu26-vita-one";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";

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
	else if (id === "assignee") content.setAssignee(TEAM_EU26_PEOPLE.automatic);
	else if (id !== "status" && id !== "priority" && id !== "costPerReach") {
		content.setDetailFields((fields) => ({ ...fields, [id]: id === "campaignRegion" ? { region: "", market: "" } : Array.isArray(fields[id]) ? [] : "" }));
	}
}

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
