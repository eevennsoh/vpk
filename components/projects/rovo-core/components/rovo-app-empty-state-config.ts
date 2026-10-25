export type RovoAppEmptyStateHeadingAs = "h1" | "h2";

export type RovoAppPlainEmptyState = {
	heading: string;
	id: string;
};

export type RovoAppImageIllustrationEmptyState = RovoAppPlainEmptyState & {
	alt: string;
	darkIllustrationSrc: string;
	height: number;
	illustrationClassName: string;
	lightIllustrationSrc: string;
	width: number;
};

export type RovoAppEmptyState = RovoAppPlainEmptyState | RovoAppImageIllustrationEmptyState;

export type RovoAppEmptyStateConfig = {
	default: RovoAppEmptyState;
	max: RovoAppEmptyState;
};

export const ROVO_APP_DEFAULT_EMPTY_STATE = {
	default: {
		alt: "Chat",
		darkIllustrationSrc: "/illustration-ai/chat/dark.svg",
		heading: "How can I help?",
		height: 67,
		id: "default",
		illustrationClassName: "h-[67px] w-[74px]",
		lightIllustrationSrc: "/illustration-ai/chat/light.svg",
		width: 74,
	},
	max: {
		alt: "Max",
		darkIllustrationSrc: "/illustration-ai/max/dark.gif",
		heading: "Let's plan your next move",
		height: 67,
		id: "max",
		illustrationClassName: "h-[67px] w-[74px]",
		lightIllustrationSrc: "/illustration-ai/max/light.gif",
		width: 74,
	},
} as const satisfies RovoAppEmptyStateConfig;
