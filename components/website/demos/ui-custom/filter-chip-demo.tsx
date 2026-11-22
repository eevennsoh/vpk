"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FilterChip, type FilterChipCondition, type FilterChipField } from "@/components/ui-custom/filter-chip";

const fields: readonly FilterChipField[] = [
	{ id: "agentStatus", label: "Agent status", options: [
		{ value: "needsInput", label: "Needs input" },
		{ value: "working", label: "Working" },
		{ value: "finished", label: "Finished" },
	] },
	{ id: "priority", label: "Priority", options: [
		{ value: "high", label: "High" },
		{ value: "medium", label: "Medium" },
		{ value: "low", label: "Low" },
	] },
];
const initial: FilterChipCondition = { field: "agentStatus", operator: "is", values: ["needsInput"] };

export default function FilterChipDemo() {
	const [condition, setCondition] = useState<FilterChipCondition | null>(initial);
	const field = fields.find((item) => item.id === condition?.field);
	return condition && field ? (
		<FilterChip condition={condition} field={field} fields={fields} onChange={setCondition} onRemove={() => setCondition(null)} />
	) : (
		<Button variant="outline" size="compact" onClick={() => setCondition(initial)}>Restore filter</Button>
	);
}
