"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { activityScrollport } from "@/components/blocks/jira-work-item/project-butter-v1/use-activity-navigation";

export function useCommentBarVisibility(active: boolean, empty: boolean, sidePanel: boolean) {
	const barRef = useRef<HTMLDivElement>(null);
	const [inActivity, setInActivity] = useState(false);
	const [elevated, setElevated] = useState(false);
	useEffect(() => {
		const bar = barRef.current;
		const activity = bar?.parentElement?.querySelector<HTMLElement>("[data-project-butter-activity]");
		const scrollport = activityScrollport(bar);
		if (!active || !bar || !activity || !scrollport) return;
		let frame = 0;
		function update() {
			frame = 0;
			if (!bar || !activity || !scrollport) return;
			const bounds = activity.getBoundingClientRect();
			const viewport = scrollport.getBoundingClientRect();
			setInActivity(activity.dataset.collapsed !== "true" && bounds.bottom > viewport.top && bounds.top < viewport.bottom);
			setElevated(!empty && (bar.parentElement?.getBoundingClientRect().bottom ?? 0) > bar.getBoundingClientRect().bottom + 4);
		}
		function schedule() { if (!frame) frame = requestAnimationFrame(update); }
		const intersection = new IntersectionObserver(schedule, { root: scrollport });
		intersection.observe(activity);
		const resize = new ResizeObserver(schedule);
		resize.observe(scrollport);
		resize.observe(activity);
		const mutation = new MutationObserver(schedule);
		mutation.observe(activity, { attributes: true, attributeFilter: ["data-collapsed"] });
		scrollport.addEventListener("scroll", schedule, { passive: true });
		update();
		return () => { intersection.disconnect(); resize.disconnect(); mutation.disconnect(); scrollport.removeEventListener("scroll", schedule); if (frame) cancelAnimationFrame(frame); };
	}, [active, empty, sidePanel]);
	const revealActivity = useCallback(() => {
		const activity = barRef.current?.parentElement?.querySelector<HTMLElement>("[data-project-butter-activity]");
		const scrollport = activityScrollport(barRef.current);
		if (activity && scrollport) scrollport.scrollTo({ top: scrollport.scrollTop + activity.getBoundingClientRect().top - scrollport.getBoundingClientRect().top, behavior: "auto" });
	}, []);
	return { barRef, elevated, inActivity, revealActivity };
}
