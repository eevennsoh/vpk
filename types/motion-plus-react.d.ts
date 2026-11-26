declare module "motion-plus/react" {
import type { MotionValue } from "motion/react";
import type { ComponentType, ReactNode } from "react";

export interface TickerProps {
	items: ReactNode[];
	offset?: MotionValue<number>;
	axis?: "x" | "y";
	velocity?: number;
	gap?: number;
	align?: "start" | "center" | "end" | "stretch";
	itemSize?: "auto" | number;
	loop?: boolean;
	fade?: number | `${number}%`;
	as?: "div";
	className?: string;
	children?: ReactNode;
	drag?: "y";
	_dragY?: MotionValue<number>;
	onDragEnd?: () => void;
	onPointerDown?: () => void;
}

export const Ticker: ComponentType<TickerProps>;
export function useTicker(): {
	containerLength: number;
	gap: number;
	inset: number;
	itemPositions: { start: number; end: number }[];
	isMeasured: boolean;
	offset: MotionValue<number>;
	renderedOffset: MotionValue<number>;
	totalItemLength: number;
};
export function useTickerItem(): {
	cloneIndex: number | undefined;
	end: number;
	projection: MotionValue<number>;
	start: number;
};
export const ScrambleText: ComponentType<{
	active?: boolean;
	chars?: string;
	children: string;
	className?: string;
	delay?: number | ((index: number, total: number) => number);
	duration?: number;
	interval?: number;
}>;
}
