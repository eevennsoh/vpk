/**
 * Hands an issue move's board commit to the frame after the one that asked
 * for it.
 *
 * A move remounts every card it moves (tens of milliseconds for a cohort).
 * Committed in the event that requested it, it holds that frame, frozen, for
 * all of it. Committed once the next frame has been presented, the request's
 * own feedback (a released traveller settling, a menu leaving) is already on
 * screen. Work that arrives meanwhile queues behind it in order, so the owner
 * sees the same updates, one frame late.
 */
export interface IssueDropHandoff {
	/** Run `task` once the next frame has been presented. */
	readonly defer: (task: () => void) => void;
	/** Run `task` now, or behind a deferred task that is still waiting. */
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
 * rAF pauses in hidden tabs and throttles in occluded windows. The normal path
 * runs within ~2 frames even at 60 Hz; past this bound it runs without waiting
 * for the frame to be presented.
 */
const HANDOFF_BACKSTOP_MS = 100;

/**
 * After the frame that is about to render has been presented: a task queued
 * from its animation frame callback runs once that frame has painted.
 */
export const afterNextPresentedFrame: AfterNextFrame = (run) => {
	let done = false;
	let task: ReturnType<typeof setTimeout> | undefined;
	const finish = () => {
		if (done) return;
		done = true;
		cancelAnimationFrame(frame);
		clearTimeout(task);
		clearTimeout(backstop);
		run();
	};
	const backstop = setTimeout(finish, HANDOFF_BACKSTOP_MS);
	const frame = requestAnimationFrame(() => {
		task = setTimeout(finish, 0);
	});
	return () => {
		done = true;
		cancelAnimationFrame(frame);
		clearTimeout(task);
		clearTimeout(backstop);
	};
};
