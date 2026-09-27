import type { FC } from "react";
import {
	AiGenerativeText,
	AiGenerativeTextSummary,
	AiSearch,
	AngleBrackets,
	MagicWand,
	RovoChat,
	type RovoIconProps,
} from "./animated-icon-art";
import { AiSparkle } from "./animated-icon-ai-sparkle";

export const ANIMATED_ICONS = {
	"ai-generative-text": AiGenerativeText,
	"ai-generative-text-summary": AiGenerativeTextSummary,
	"ai-search": AiSearch,
	"ai-sparkle": AiSparkle,
	"angle-brackets": AngleBrackets,
	"magic-wand": MagicWand,
	"rovo-chat": RovoChat,
} satisfies Record<string, FC<RovoIconProps>>;

export type AnimatedIconName = keyof typeof ANIMATED_ICONS;

export const animatedIconNames = Object.keys(ANIMATED_ICONS) as AnimatedIconName[];
