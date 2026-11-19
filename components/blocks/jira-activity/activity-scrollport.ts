export function activityScrollport(feed: HTMLElement | null): HTMLElement | null {
	let parent = feed?.parentElement ?? null;
	while (parent && !/(auto|scroll)/u.test(getComputedStyle(parent).overflowY)) parent = parent.parentElement;
	return parent;
}
