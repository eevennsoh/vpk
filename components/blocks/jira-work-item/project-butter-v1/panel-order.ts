export type ProjectButterPanelId = "details" | "development" | "automation" | "apps";
export const PROJECT_BUTTER_PANEL_ORDER: ProjectButterPanelId[] = ["details", "development", "automation", "apps"];

export function reorderProjectButterPanels(order: ProjectButterPanelId[], activeId: string | number, overId: string | number | null): ProjectButterPanelId[] {
	const from = order.findIndex((id) => id === activeId);
	const to = order.findIndex((id) => id === overId);
	if (from < 0 || to < 0 || from === to) return order;
	const next = [...order];
	const [panel] = next.splice(from, 1);
	next.splice(to, 0, panel);
	return next;
}
