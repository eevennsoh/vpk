import type { ComponentDetail } from "@/app/data/component-detail-types";

export const FILTER_CHIP_DETAIL: ComponentDetail = {
	description: "An editable, removable filter condition with field, operator, and value menus.",
	usage: `import { FilterChip } from "@/components/ui-custom/filter-chip"

<FilterChip
  condition={condition}
  field={field}
  fields={availableFields}
  onChange={setCondition}
  onRemove={() => setCondition(null)}
/>`,
	props: [
		{ name: "condition", type: "FilterChipCondition", required: true, description: "The selected field, operator, and values." },
		{ name: "field", type: "FilterChipField", required: true, description: "The current field and its available values." },
		{ name: "fields", type: "readonly FilterChipField[]", required: true, description: "Fields available when changing the condition." },
		{ name: "onChange", type: "(condition: FilterChipCondition) => void", required: true, description: "Updates the condition after an edit." },
		{ name: "onRemove", type: "() => void", required: true, description: "Removes the condition." },
		{ name: "renderFieldIcon", type: "(field: FilterChipField) => ReactNode", description: "Optional leading icon for each field in the field picker." },
	],
};
