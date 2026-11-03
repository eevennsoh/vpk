"use client";

import { useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState, type ClipboardEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useReducedMotion } from "motion/react";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

/** Anything the composer lists must have a stable id (used for option ids and aria-activedescendant). */
export interface RelatedComposerChoice {
	id: string;
}

/** Why the composer asked to close: Escape on an empty input, or a pointerdown outside it. */
export type RelatedComposerDismissReason = "escape" | "outside";

/** Pointer targets that never dismiss the composer: its listbox, nested menus, and add triggers. */
const OUTSIDE_IGNORE = "[data-related-composer-listbox], [role=listbox], [role=option], [role=menu], [data-related-add]";

export interface RelatedComposerProps<C extends RelatedComposerChoice> {
	/** Accessible name of the form and the combobox input. */
	label: string;
	placeholder?: string;
	/** Accessible name of the floating listbox, e.g. "Matching work items". */
	listboxLabel: string;
	query: string;
	onQueryChange: (query: string) => void;
	/** Choices for the current query, already filtered and ordered. The first is highlighted on change. */
	choices: readonly C[];
	renderChoice: (choice: C, active: boolean) => ReactNode;
	/** Enter or an option click. Receives the highlighted choice, falling back to the first; undefined when none. */
	onCommit: (choice: C | undefined) => void;
	/** Escape on an empty input or a pointerdown outside the row (Escape with text clears it instead). */
	onDismiss: (reason: RelatedComposerDismissReason) => void;
	/** Paste interception: return the replacement query to take over the paste, or undefined to paste normally. */
	onPasteText?: (text: string) => string | undefined;
	/** Polite live-region text, e.g. "3 matching work items". Rendered only while the query is non-empty. */
	liveMessage?: string;
	/** Controls before the input (relationship picker, status marker). */
	leading?: ReactNode;
	/** aria-hidden decoration after the input. */
	trailing?: ReactNode;
	/** Bumped by each add request; a change refocuses the input and scrolls the row into view. */
	createSignal: number;
	/** Another row is being edited: the composer is inert and dimmed. */
	dimmed?: boolean;
}

/**
 * Inline combobox row used by every related list (child, linked and attachments).
 * Renders an `<li>`, so place it inside the list card `<ul>`. Matches render in a row-width
 * listbox portalled to the body; React portal events still count as inside the work item dialog.
 */
export function RelatedComposer<C extends RelatedComposerChoice>({ choices, createSignal, dimmed = false, label, leading, listboxLabel, liveMessage, onCommit, onDismiss, onPasteText, onQueryChange, placeholder = "Create new, search or paste existing", query, renderChoice, trailing }: Readonly<RelatedComposerProps<C>>) {
	const listboxId = useId();
	const rowRef = useRef<HTMLLIElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const reducedMotion = useReducedMotion();
	const [highlight, setHighlight] = useState({ query, count: choices.length, index: 0 });
	const activeIndex = highlight.query === query && highlight.count === choices.length ? Math.min(highlight.index, choices.length - 1) : 0;
	const active = choices[activeIndex];
	const expanded = !dimmed && choices.length > 0;
	const dismissOutside = useEffectEvent((event: PointerEvent) => {
		const target = event.target;
		const row = rowRef.current;
		if (!(target instanceof Element) || !row || row.contains(target) || target.closest(OUTSIDE_IGNORE)) return;
		const dialog = target.closest('[role="dialog"]');
		if (dialog && dialog !== row.closest('[role="dialog"]')) return;
		onDismiss("outside");
	});
	useEffect(() => {
		document.addEventListener("pointerdown", dismissOutside);
		return () => document.removeEventListener("pointerdown", dismissOutside);
	}, []);
	const focusRequest = useEffectEvent(() => {
		inputRef.current?.focus();
		rowRef.current?.scrollIntoView?.({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
	});
	useEffect(() => {
		focusRequest();
	}, [createSignal]);
	function paste(event: ClipboardEvent<HTMLInputElement>) {
		const replacement = onPasteText?.(event.clipboardData.getData("text"));
		if (replacement === undefined) return;
		event.preventDefault();
		onQueryChange(replacement);
	}
	return (
		<li className={cn("relative", dimmed && "pointer-events-none")} data-related-composer inert={dimmed || undefined} ref={rowRef}>
			<form aria-label={label} className={cn("flex h-10 min-w-0 items-center gap-1.5 px-4 hover:bg-bg-neutral-subtle-hovered has-[input:focus]:bg-transparent", dimmed && "opacity-(--opacity-disabled)")} onSubmit={(event) => { event.preventDefault(); onCommit(active ?? choices[0]); }}>
				{leading}
				<input
					aria-activedescendant={expanded && active ? `${listboxId}-${active.id}` : undefined}
					aria-autocomplete="list"
					aria-controls={expanded ? listboxId : undefined}
					aria-expanded={expanded}
					aria-label={label}
					autoFocus
					className="ml-1 h-6 min-w-0 flex-1 rounded-sm bg-transparent text-sm text-text outline-none placeholder:text-text-disabled focus-visible:ring-2 focus-visible:ring-ring"
					onChange={(event) => onQueryChange(event.currentTarget.value)}
					onKeyDown={(event) => {
						if (event.key === "Escape") {
							event.preventDefault();
							event.stopPropagation();
							if (query) onQueryChange("");
							else onDismiss("escape");
						}
						if ((event.key === "ArrowDown" || event.key === "ArrowUp") && choices.length) {
							event.preventDefault();
							setHighlight({ query, count: choices.length, index: (activeIndex + (event.key === "ArrowDown" ? 1 : -1) + choices.length) % choices.length });
						}
					}}
					onPaste={paste}
					placeholder={placeholder}
					ref={inputRef}
					role="combobox"
					value={query}
				/>
				{trailing ? <span aria-hidden className="flex shrink-0 items-center gap-3 text-icon-subtle">{trailing}</span> : null}
			</form>
			<span aria-live="polite" className="sr-only">{query.trim() ? liveMessage ?? "" : ""}</span>
			{expanded ? (
				<RelatedComposerListbox anchor={rowRef} count={choices.length}>
					<div aria-label={listboxLabel} id={listboxId} role="listbox">
						{choices.map((choice, index) => (
							<button
								aria-selected={index === activeIndex}
								className={cn("flex h-10 w-full min-w-0 items-center gap-1.5 px-3 text-left text-sm text-text outline-none", index === activeIndex ? "bg-bg-neutral-subtle-hovered" : "hover:bg-bg-neutral-subtle-hovered")}
								id={`${listboxId}-${choice.id}`}
								key={choice.id}
								onClick={() => onCommit(choice)}
								onMouseDown={(event) => event.preventDefault()}
								onPointerMove={() => setHighlight({ query, count: choices.length, index })}
								role="option"
								tabIndex={-1}
								type="button"
							>
								{renderChoice(choice, index === activeIndex)}
							</button>
						))}
					</div>
				</RelatedComposerListbox>
			) : null}
		</li>
	);
}

/** Fixed, row-width surface under the anchor row. Follows resize and any scroll container (capture phase). */
function RelatedComposerListbox({ anchor, children, count }: Readonly<{ anchor: RefObject<HTMLLIElement | null>; children: ReactNode; count: number }>) {
	const surfaceRef = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const row = anchor.current;
		const surface = surfaceRef.current;
		if (!row || !surface) return undefined;
		let frame = 0;
		const place = () => {
			const rect = row.getBoundingClientRect();
			surface.style.top = `${rect.bottom}px`;
			surface.style.left = `${rect.left}px`;
			surface.style.width = `${rect.width}px`;
			// A transformed ancestor would offset `position: fixed`; correct by the measured drift.
			const placed = surface.getBoundingClientRect();
			const dx = placed.left - rect.left;
			const dy = placed.top - rect.bottom;
			if (dx || dy) {
				surface.style.left = `${rect.left - dx}px`;
				surface.style.top = `${rect.bottom - dy}px`;
			}
		};
		const schedule = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(place);
		};
		place();
		window.addEventListener("resize", schedule);
		window.addEventListener("scroll", schedule, true);
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener("resize", schedule);
			window.removeEventListener("scroll", schedule, true);
		};
	}, [anchor, count]);
	return createPortal(
		<div className="fixed z-[650] max-h-60 overflow-auto rounded-lg bg-surface-overlay py-1" data-related-composer-listbox ref={surfaceRef} style={{ boxShadow: token("elevation.shadow.overlay") }}>
			{children}
		</div>,
		document.body,
	);
}
