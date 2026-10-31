export const PROJECT_BUTTER_PRESENTATIONS = [
	{ value: "full-screen", label: "Full screen" },
	{ value: "modal", label: "Modal" },
	{ value: "side-panel", label: "Side panel" },
] as const;

export type ProjectButterPresentation = typeof PROJECT_BUTTER_PRESENTATIONS[number]["value"];
