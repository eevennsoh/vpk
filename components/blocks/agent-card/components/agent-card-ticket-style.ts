import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

const SCROLL_MASK_IMAGE = [
	"linear-gradient(to bottom, transparent 0, black var(--scroll-mask-fade-size), black 100%)",
	"linear-gradient(black, black)",
].join(", ");

export const AGENT_CARD_SCROLL_MASK_STYLE = {
	"--scroll-mask-fade-size": "var(--ds-space-200)",
	"--scroll-mask-scrollbar-width": "10px",
	maskImage: SCROLL_MASK_IMAGE,
	WebkitMaskImage: SCROLL_MASK_IMAGE,
	maskPosition: "0 0, 100% 0",
	WebkitMaskPosition: "0 0, 100% 0",
	maskRepeat: "no-repeat, no-repeat",
	WebkitMaskRepeat: "no-repeat, no-repeat",
	maskSize: "calc(100% - var(--scroll-mask-scrollbar-width)) 100%, var(--scroll-mask-scrollbar-width) 100%",
	WebkitMaskSize: "calc(100% - var(--scroll-mask-scrollbar-width)) 100%, var(--scroll-mask-scrollbar-width) 100%",
} satisfies CSSProperties & {
	"--scroll-mask-fade-size": string;
	"--scroll-mask-scrollbar-width": string;
};

const EXPANDED_TICKET_TOP_MASK_IMAGE = [
	"radial-gradient(circle 8px at 0 100%, transparent 0 7.5px, black 8px)",
	"radial-gradient(circle 8px at 100% 100%, transparent 0 7.5px, black 8px)",
].join(", ");

const EXPANDED_TICKET_BOTTOM_MASK_IMAGE = [
	"radial-gradient(circle 8px at 0 0, transparent 0 7.5px, black 8px)",
	"radial-gradient(circle 8px at 100% 0, transparent 0 7.5px, black 8px)",
].join(", ");

const EXPANDED_TICKET_SHADOW_MASK_IMAGE = [
	"radial-gradient(circle 8px at 0 var(--agent-card-ticket-seam-y, 0px), transparent 0 7.5px, black 8px)",
	"radial-gradient(circle 8px at 100% var(--agent-card-ticket-seam-y, 0px), transparent 0 7.5px, black 8px)",
].join(", ");

export const EXPANDED_TICKET_TOP_STYLE = {
	maskComposite: "intersect",
	maskImage: EXPANDED_TICKET_TOP_MASK_IMAGE,
	maskRepeat: "no-repeat, no-repeat",
	maskSize: "100% 100%, 100% 100%",
	WebkitMaskComposite: "source-in",
	WebkitMaskImage: EXPANDED_TICKET_TOP_MASK_IMAGE,
	WebkitMaskRepeat: "no-repeat, no-repeat",
	WebkitMaskSize: "100% 100%, 100% 100%",
} satisfies CSSProperties;

export const EXPANDED_TICKET_BOTTOM_STYLE = {
	maskComposite: "intersect",
	maskImage: EXPANDED_TICKET_BOTTOM_MASK_IMAGE,
	maskRepeat: "no-repeat, no-repeat",
	maskSize: "100% 100%, 100% 100%",
	WebkitMaskComposite: "source-in",
	WebkitMaskImage: EXPANDED_TICKET_BOTTOM_MASK_IMAGE,
	WebkitMaskRepeat: "no-repeat, no-repeat",
	WebkitMaskSize: "100% 100%, 100% 100%",
} satisfies CSSProperties;

const EXPANDED_TICKET_ELEVATION_CLASS_NAME = "agent-card-ticket-shadow";

export const EXPANDED_TICKET_WRAPPER_CLASS_NAME = "relative flex min-h-0 flex-auto flex-col rounded-2xl";

export const EXPANDED_TICKET_SHADOW_CLASS_NAME = cn(
	"pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-fast ease-out group-hover/card:opacity-100 group-focus-within/card:opacity-100",
	EXPANDED_TICKET_ELEVATION_CLASS_NAME,
);

export const EXPANDED_TICKET_SHADOW_STYLE = {
	maskComposite: "intersect",
	maskImage: EXPANDED_TICKET_SHADOW_MASK_IMAGE,
	maskRepeat: "no-repeat, no-repeat",
	maskSize: "100% 100%, 100% 100%",
	WebkitMaskComposite: "source-in",
	WebkitMaskImage: EXPANDED_TICKET_SHADOW_MASK_IMAGE,
	WebkitMaskRepeat: "no-repeat, no-repeat",
	WebkitMaskSize: "100% 100%, 100% 100%",
} satisfies CSSProperties;

export const EXPANDED_TICKET_TEAR_LINE_STYLE = {
	maskImage: "repeating-linear-gradient(to right, black 0 6px, transparent 6px 16px)",
	WebkitMaskImage: "repeating-linear-gradient(to right, black 0 6px, transparent 6px 16px)",
} satisfies CSSProperties;

const STAMP_PERFORATION_INTERVAL_COUNT = 29;
const STAMP_PERFORATION_INTERVAL = `calc(100% / ${STAMP_PERFORATION_INTERVAL_COUNT})`;
const STAMP_PERFORATION_PATTERN_OFFSET = `calc(${STAMP_PERFORATION_INTERVAL} / -2)`;

export const STAMP_PERFORATION_BOTTOM_MASK_STYLE = {
	"--stamp-perforation-interval": STAMP_PERFORATION_INTERVAL,
	"--stamp-perforation-offset": STAMP_PERFORATION_PATTERN_OFFSET,
	maskImage: "radial-gradient(circle at 50% 100%, transparent 0 3px, black 3.25px)",
	WebkitMaskImage: "radial-gradient(circle at 50% 100%, transparent 0 3px, black 3.25px)",
	maskPosition: "var(--stamp-perforation-offset) 0",
	WebkitMaskPosition: "var(--stamp-perforation-offset) 0",
	maskRepeat: "repeat-x",
	WebkitMaskRepeat: "repeat-x",
	maskSize: "var(--stamp-perforation-interval) 100%",
	WebkitMaskSize: "var(--stamp-perforation-interval) 100%",
} satisfies CSSProperties & {
	"--stamp-perforation-interval": string;
	"--stamp-perforation-offset": string;
};

export const STAMP_PERFORATION_TOP_MASK_STYLE = {
	"--stamp-perforation-interval": STAMP_PERFORATION_INTERVAL,
	"--stamp-perforation-offset": STAMP_PERFORATION_PATTERN_OFFSET,
	maskImage: "radial-gradient(circle at 50% 0, transparent 0 3px, black 3.25px)",
	WebkitMaskImage: "radial-gradient(circle at 50% 0, transparent 0 3px, black 3.25px)",
	maskPosition: "var(--stamp-perforation-offset) 0",
	WebkitMaskPosition: "var(--stamp-perforation-offset) 0",
	maskRepeat: "repeat-x",
	WebkitMaskRepeat: "repeat-x",
	maskSize: "var(--stamp-perforation-interval) 100%",
	WebkitMaskSize: "var(--stamp-perforation-interval) 100%",
} satisfies CSSProperties & {
	"--stamp-perforation-interval": string;
	"--stamp-perforation-offset": string;
};
