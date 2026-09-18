import {
	createSessionChipDropKeyframes,
	// @ts-expect-error Node's strip-types runner requires the explicit .ts extension.
} from "./jira-dropzone-motion.ts";
import type { ViewportPoint } from "./jira-dropzone-types";

/** Retarget the existing flight clock as layout/scroll moves its destination. */
export function animateSessionChipDrop(
	element: HTMLElement,
	input: Readonly<{
		delayMs?: number;
		durationMs: number;
		from: ViewportPoint;
		onLanded: () => void;
		resolveLandingPoint: () => ViewportPoint | null;
	}>,
): () => void {
	let animation: Animation | null = null;
	let frame = 0;
	let active = true;
	let landing: ViewportPoint | null = null;
	const finish = () => {
		if (!active) return;
		active = false;
		cancelAnimationFrame(frame);
		element.style.willChange = "";
		input.onLanded();
	};
	const track = () => {
		if (!active || !animation) return;
		// Read target geometry before writing the flight's effect. Updating
		// keyframes preserves currentTime, duration and the original cursor.
		const next = input.resolveLandingPoint();
		if (!next) {
			animation.cancel();
			finish();
			return;
		}
		if (next.x !== landing?.x || next.y !== landing?.y) {
			landing = next;
			(animation.effect as KeyframeEffect).setKeyframes(createSessionChipDropKeyframes(input.from, next, "landing"));
		}
		frame = requestAnimationFrame(track);
	};
	const launch = (retry: boolean) => {
		landing = input.resolveLandingPoint();
		if (!landing) {
			if (retry) frame = requestAnimationFrame(() => launch(false));
			else finish();
			return;
		}
		if (input.durationMs === 0) {
			finish();
			return;
		}
		element.style.willChange = "transform, opacity";
		animation = element.animate(createSessionChipDropKeyframes(input.from, landing, "landing"), {
			delay: input.delayMs ?? 0,
			duration: input.durationMs,
			easing: "linear",
			fill: "both",
		});
		animation.addEventListener("finish", finish, { once: true });
		animation.addEventListener("cancel", finish, { once: true });
		frame = requestAnimationFrame(track);
	};
	launch(true);
	return () => {
		active = false;
		cancelAnimationFrame(frame);
		animation?.removeEventListener("finish", finish);
		animation?.removeEventListener("cancel", finish);
		animation?.cancel();
		element.style.willChange = "";
	};
}
