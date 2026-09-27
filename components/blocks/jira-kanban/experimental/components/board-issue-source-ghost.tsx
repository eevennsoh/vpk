import { useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { token } from "@/lib/tokens";
import { resolveJiraIssueSelectionBackdrop, type JiraIssueSelectionBackdrop } from "@/components/blocks/jira-issue/selection-backdrop";

const SOURCE_GHOST_FULL_CLIP = `inset(0px round ${token("radius.large")})`;
// The default column adds 4px padding and a 1px border to the 8px inset.
// Joined edges split that 13px gutter; outer edges subtract the existing gap.
const SOURCE_GHOST_JOINED_INSET = `calc((${token("space.100")} + ${token("space.050")} + ${token("border.width")}) / 2)`;
const SOURCE_GHOST_UNJOINED_INSET = `calc(${token("space.100")} + ${token("space.050")} + ${token("border.width")} - var(--board-card-gap))`;

/** The content remains in flow while only its paint gives way to the source well. */
export function BoardIssueSourceGhost({ children, dragging, selectionBackdrop }: Readonly<{
	children: ReactNode;
	dragging: boolean;
	selectionBackdrop?: JiraIssueSelectionBackdrop;
}>) {
	const enabled = selectionBackdrop !== undefined;
	const { joinsBefore, joinsAfter } = resolveJiraIssueSelectionBackdrop(selectionBackdrop);
	const sourceClip = `inset(${joinsBefore ? SOURCE_GHOST_JOINED_INSET : SOURCE_GHOST_UNJOINED_INSET} ${token("space.100")} ${joinsAfter ? SOURCE_GHOST_JOINED_INSET : SOURCE_GHOST_UNJOINED_INSET} ${token("space.100")} round ${token("radius.large")})`;
	const contentRef = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		if (!enabled || !dragging || !contentRef.current) return;
		// Inert on a native drag source (or its ancestors) aborts Chromium's
		// drag. Its child UI can be inert while the real source stays mounted.
		const source = contentRef.current.querySelector<HTMLElement>('[draggable="true"]');
		const targets = [...(source ?? contentRef.current).children].filter((node): node is HTMLElement => node instanceof HTMLElement);
		const previous = targets.map((node) => node.inert);
		const focused = contentRef.current.ownerDocument.activeElement;
		const restoreFocus = focused instanceof HTMLElement && targets.some((node) => node.contains(focused)) ? focused : null;
		const focusVisible = restoreFocus?.matches(":focus-visible") ?? false;
		let applied = false;
		// Let Chromium capture the drag before disabling the child controls.
		const frame = requestAnimationFrame(() => {
			targets.forEach((node) => { node.inert = true; });
			applied = true;
		});
		return () => {
			cancelAnimationFrame(frame);
			if (applied) targets.forEach((node, index) => { node.inert = previous[index]; });
			if (applied && restoreFocus) queueMicrotask(() => {
				if (restoreFocus.isConnected && restoreFocus.ownerDocument.activeElement === restoreFocus.ownerDocument.body && !restoreFocus.closest('[inert], [aria-hidden="true"]')) {
					restoreFocus.focus({ preventScroll: true, focusVisible });
				}
			});
		};
	}, [dragging, enabled]);
	return enabled ? (
		<div className="relative w-full min-w-0" data-issue-source-ghost-frame="">
			<div
				ref={contentRef}
				aria-hidden={dragging || undefined}
				data-issue-source-ghost-content=""
				className={cn("transition-opacity duration-normal ease-out-practical motion-reduce:transition-none", dragging ? "opacity-0" : "opacity-100")}
			>
				{children}
			</div>
			<div
				aria-hidden="true"
				data-issue-source-ghost-placeholder=""
				style={{ clipPath: dragging ? sourceClip : SOURCE_GHOST_FULL_CLIP }}
				className={cn(
					"pointer-events-none absolute inset-0 bg-bg-neutral motion-reduce:transition-none",
					dragging
						? "opacity-100 transition-[clip-path] duration-medium ease-out-practical"
						: "opacity-0 transition-[clip-path,opacity] duration-fast ease-in",
				)}
			/>
		</div>
	) : children;
}
