"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const BOARD_CARD_STATES = [
	{ value: "default", label: "Idle" },
	{ value: "single-agent-working", label: "1 agent (Owner)" },
	{ value: "multiple-agents-working", label: "1-n agents (Owner)" },
	{ value: "multiple-agents-working-viewer", label: "1-n agent (Viewer)" },
	{ value: "mixed-agents-working", label: "1-n agents (Owner + Viewer)" },
	{ value: "ready-for-review", label: "Ready for review" },
	{ value: "finished", label: "Finished" },
] as const;

export type ButterBoardCardState = (typeof BOARD_CARD_STATES)[number]["value"];

export function ButterBoardCardControls({ value, onChange }: Readonly<{ value: ButterBoardCardState; onChange: (value: ButterBoardCardState) => void }>) {
	return (
		<ToggleGroup aria-label="Board card state" className="max-w-full overflow-x-auto" onValueChange={(values) => {
			const next = BOARD_CARD_STATES.find((state) => state.value === values[0]);
			if (next) onChange(next.value);
		}} onKeyDown={(event) => {
			if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
			const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
			const index = buttons.indexOf(event.target as HTMLButtonElement);
			if (index < 0) return;
			event.preventDefault();
			const nextIndex = (index + (event.key === "ArrowRight" ? 1 : -1) + BOARD_CARD_STATES.length) % BOARD_CARD_STATES.length;
			onChange(BOARD_CARD_STATES[nextIndex].value);
			buttons[nextIndex]?.focus();
		}} size="sm" value={[value]} variant="outline">
			{BOARD_CARD_STATES.map((state) => <ToggleGroupItem key={state.value} value={state.value}>{state.label}</ToggleGroupItem>)}
		</ToggleGroup>
	);
}
