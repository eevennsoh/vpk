export const PROJECT_BUTTER_PRESENTATIONS = [
	{ value: "full-screen", label: "Full screen" },
	{ value: "modal", label: "Modal" },
	{ value: "side-panel", label: "Side panel" },
] as const;

export type ProjectButterPresentation = typeof PROJECT_BUTTER_PRESENTATIONS[number]["value"];

export type ProjectButterShellContext = "standalone" | "project" | "gallery";

export const PROJECT_BUTTER_CONTENT_WIDTH = "w-[calc(100vw-4rem)] max-w-[1280px]";
export const PROJECT_BUTTER_MODAL_SIZE = `h-[calc(100dvh-4rem)] max-h-[960px] ${PROJECT_BUTTER_CONTENT_WIDTH}`;
