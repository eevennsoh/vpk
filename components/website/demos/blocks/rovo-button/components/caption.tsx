import type {
	FloatingRovoButtonPlacement,
	FloatingRovoButtonPositioning,
} from "@/components/blocks/rovo-button";
import { cn } from "@/lib/utils";

/**
 * Decorative label stacked above a showcase button. Hidden from assistive tech —
 * every button already carries its own `ariaLabel`.
 */
export default function RovoButtonDemoCaption({
	detail,
	liftPx = 60,
	placement,
	positioning,
	title,
}: Readonly<{
	detail: string;
	liftPx?: number;
	placement: FloatingRovoButtonPlacement;
	positioning: FloatingRovoButtonPositioning;
	title: string;
}>) {
	return (
		<div
			aria-hidden="true"
			className={cn(
				"pointer-events-none z-[500] flex w-28 flex-col items-end gap-0.5 text-right",
				positioning === "container" ? "absolute" : "fixed",
			)}
			style={{
				right: placement.right,
				bottom: `calc(${placement.bottom ?? "32px"} + ${liftPx}px)`,
			}}
		>
			<span className="rounded bg-surface-raised px-2 py-0.5 text-xs leading-4 font-semibold text-text">
				{title}
			</span>
			<span className="max-w-full rounded bg-surface-raised px-2 py-0.5 text-[11px] leading-4 text-text-subtle">
				{detail}
			</span>
		</div>
	);
}
