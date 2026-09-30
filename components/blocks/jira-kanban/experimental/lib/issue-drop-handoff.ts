import { motionDuration } from "@/lib/motion";

/**
 * Hands a native issue drop's board commit to the frame after the release.
 *
 * The commit remounts every moved card (tens of milliseconds for a cohort).
 * Run inside the `drop` event, it holds the release frame, frozen, for all of
 * it. Run one presented frame later, the traveller is already settling on the
 * compositor (see `settleIssueCohortPreview`) and keeps moving through the
 * commit. Drag callbacks that arrive meanwhile (the source's `dragend`) queue
 * behind it in order, so the owner sees the same updates, one frame late.
 */
export interface IssueDropHandoff {
	/** Run `task` once the next frame has been presented (the drop's commit). */
	readonly defer: (task: () => void) => void;
	/** Run `task` now, or behind a deferred drop that is still waiting. */
	readonly then: (task: () => void) => void;
	/** Run everything still queued, now (unmount). */
	readonly flush: () => void;
}

/** Schedules `run` for after the next presented frame; returns a cancel. */
export type AfterNextFrame = (run: () => void) => () => void;

export function createIssueDropHandoff(afterNextFrame: AfterNextFrame): IssueDropHandoff {
	let queue: (() => void)[] | null = null;
	let cancel: (() => void) | null = null;
	const flush = () => {
		cancel?.();
		cancel = null;
		const tasks = queue ?? [];
		queue = null;
		for (const task of tasks) task();
	};
	return {
		defer(task) {
			if (queue) {
				queue.push(task);
				return;
			}
			queue = [task];
			cancel = afterNextFrame(flush);
		},
		then(task) {
			if (queue) queue.push(task);
			else task();
		},
		flush,
	};
}

/**
 * The released traveller settles where it was let go, while the handed-off
 * commit lands its cards: an exit, so a practical fade with a slight shrink
 * (`duration-normal`, `ease-in`). Opacity and transform run on the
 * compositor, so it keeps moving while the commit holds the main thread. The
 * node leaves the page once it has faded; reduced motion removes it at once.
 */
export function settleIssueCohortPreview(node: HTMLElement, reducedMotion: boolean): void {
	if (reducedMotion) {
		node.remove();
		return;
	}
	let settled = false;
	const leave = () => {
		if (settled) return;
		settled = true;
		window.clearTimeout(backstop);
		node.remove();
	};
	// Where the pointer left it (the traveller follows it by transform).
	const at = node.style.transform ? `${node.style.transform} ` : "";
	node.style.transition = "opacity var(--duration-normal) var(--ease-in), transform var(--duration-normal) var(--ease-in)";
	node.style.opacity = "0";
	node.style.transform = `${at}scale(0.96)`;
	node.addEventListener("transitionend", leave, { once: true });
	const backstop = window.setTimeout(leave, motionDuration.normal * 1000 + 50);
}

/** Frame backstop: a stalled or hidden page must still commit the drop. */
const HANDOFF_BACKSTOP_MS = 100;

/**
 * After the frame that is about to render has been presented: a task queued
 * from its animation frame callback runs once that frame has painted.
 */
export const afterNextPresentedFrame: AfterNextFrame = (run) => {
	let done = false;
	let task = 0;
	const finish = () => {
		if (done) return;
		done = true;
		window.cancelAnimationFrame(frame);
		window.clearTimeout(task);
		window.clearTimeout(backstop);
		run();
	};
	const frame = window.requestAnimationFrame(() => {
		task = window.setTimeout(finish, 0);
	});
	const backstop = window.setTimeout(finish, HANDOFF_BACKSTOP_MS);
	return () => {
		done = true;
		window.cancelAnimationFrame(frame);
		window.clearTimeout(task);
		window.clearTimeout(backstop);
	};
};
