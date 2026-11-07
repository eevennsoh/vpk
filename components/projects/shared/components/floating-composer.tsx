"use client";

// oxlint-disable react-doctor/no-initialize-state -- These components intentionally seed local interactive state from props once before user edits take ownership.

import type { ComponentProps, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
	PromptInput,
	PromptInputBody,
	PromptInputButton,
	PromptInputHeader,
} from "@/components/ui-custom/prompt-input";
import { composerPromptInputClassName } from "@/components/projects/shared/components/rovo-composer-styles";
import { cn } from "@/lib/utils";
import AddIcon from "@atlaskit/icon/core/add";

export type FloatingComposerProps = Omit<
	ComponentProps<typeof PromptInput>,
	"variant" | "children"
> & {
	// The text field — render a <PromptInputTextarea> with your own ref/value/handlers.
	children: ReactNode;
	// Trailing action cluster (e.g. <RovoComposerActionButton />). Sits at the far right.
	actions: ReactNode;
	// Full override for the leading "+" control. Defaults to a ghost Add icon button.
	addButton?: ReactNode;
	// Props forwarded to the default "+" button (ignored when `addButton` is provided).
	addButtonProps?: ComponentProps<typeof PromptInputButton>;
	/**
	 * One-turn composer context (e.g. Activity / Code Review comment pills).
	 * Renders above the editor row via PromptInputHeader, matching ChatComposer.
	 */
	inputContext?: ReactNode;
	/**
	 * `auto` (default) measures the draft and only stacks once the text would wrap
	 * at compact-row width. `stacked` pins the editor to its own row regardless of
	 * content — for surfaces whose expanded state always reserves a full-width
	 * editor above the control row (e.g. the Pull Request Review card). `compact`
	 * pins the opposite: the editor cell stays inside the single
	 * `[ + ] [ cell ] [ actions ]` row and is never promoted. Use it when the cell
	 * holds something other than a text field — the `auto` probe hunts for a
	 * `textarea` or `[contenteditable]` inside it and polls every 50ms until one
	 * appears, so a non-text cell would leave a 20Hz timer running for the life of
	 * the composer.
	 */
	layout?: "auto" | "stacked" | "compact";
};

function observeResizeTargets(observer: ResizeObserver, ...targets: Element[]): void {
	for (const target of targets) {
		observer.observe(target);
	}
}

function observeMutations(observer: MutationObserver, target: Node): void {
	observer.observe(target, {
		characterData: true,
		childList: true,
		subtree: true,
	});
}

/**
 * Shared floating prompt composer shell.
 *
 * This is the single source of truth for the floating composer layout: the Studio composer and
 * the Prompt Input demo both render it, so any layout change here propagates to both surfaces.
 *
 * Compact mode keeps `[ + ] [ editor ] [ actions ]` in one row. Once the text would wrap at
 * compact-row width, the editor takes the top row and controls sit together on a bottom row.
 * Measurement is always based on compact geometry, even while expanded, so the layout cannot
 * oscillate when expanding gives the editor more width.
 */
export function FloatingComposer({
	actions,
	addButton,
	addButtonProps,
	children,
	className,
	inputContext,
	layout = "auto",
	// The input group's edges sit flush with the leading "+" and trailing actions,
	// so clipping it would cut their outward focus rings. The shell clips nothing else.
	allowOverflow = true,
	...props
}: Readonly<FloatingComposerProps>) {
	const containerRef = useRef<HTMLDivElement>(null);
	const addButtonRef = useRef<HTMLDivElement>(null);
	const textFieldRef = useRef<HTMLDivElement>(null);
	const actionsRef = useRef<HTMLDivElement>(null);
	const [isMeasuredExpanded, setIsMeasuredExpanded] = useState(false);
	// Only `auto` consults the measurement, so a stale `true` left over from a
	// previous draft cannot leak into a caller-pinned layout.
	const isExpanded = layout === "stacked" || (layout === "auto" && isMeasuredExpanded);
	const hasInputContext = inputContext != null;

	useEffect(() => {
		// Both pinned layouts skip the probe: it would only burn frames measuring a
		// decision that cannot change the rendered rows, and under `compact` the
		// cell may hold no text field at all, which would leave the 50ms bind poll
		// below running forever.
		if (layout !== "auto") {
			return () => undefined;
		}

		const container = containerRef.current;
		const addButtonContainer = addButtonRef.current;
		const textFieldContainer = textFieldRef.current;
		const actionsContainer = actionsRef.current;
		if (!container || !addButtonContainer || !textFieldContainer || !actionsContainer) {
			return () => undefined;
		}

		const findField = () =>
			textFieldContainer.querySelector<HTMLElement>(
				"textarea, [contenteditable='true']",
			);

		const getComposerPlainText = (field: HTMLElement): string => {
			const form = field.closest("form");
			const hiddenValue = form
				?.querySelector<HTMLInputElement>('[data-slot="prompt-input-message"]')
				?.value;
			if (typeof hiddenValue === "string" && hiddenValue.length > 0) {
				return hiddenValue;
			}

			const clone = field.cloneNode(true) as HTMLElement;
			for (const element of clone.querySelectorAll<HTMLElement>(
				".prompt-input-directory-autocomplete-ghost, [aria-hidden='true']",
			)) {
				element.remove();
			}
			return clone.textContent ?? "";
		};

		let frameId: number | null = null;

		const getDistinctLineCount = (element: HTMLElement): number => {
			const range = document.createRange();
			range.selectNodeContents(element);
			const lineTops: number[] = [];
			for (const rect of Array.from(range.getClientRects())) {
				if (rect.width <= 0 || rect.height <= 0) {
					continue;
				}
				if (!lineTops.some((top) => Math.abs(top - rect.top) < 2)) {
					lineTops.push(rect.top);
				}
			}
			range.detach();
			return lineTops.length;
		};

		const measure = () => {
			frameId = null;
			const field = findField();
			if (!field) {
				return;
			}

			const fieldText = getComposerPlainText(field);
			if (fieldText.trim().length === 0) {
				setIsMeasuredExpanded(false);
				return;
			}

			const containerStyles = window.getComputedStyle(container);
			const gap = parseFloat(containerStyles.columnGap || containerStyles.gap) || 0;
			const compactFieldWidth = Math.max(
				0,
				container.getBoundingClientRect().width -
					addButtonContainer.getBoundingClientRect().width -
					actionsContainer.getBoundingClientRect().width -
					gap * 2,
			);
			if (compactFieldWidth <= 0) {
				setIsMeasuredExpanded(true);
				return;
			}

			const probe = document.createElement("div");
			probe.removeAttribute("id");
			probe.removeAttribute("contenteditable");
			probe.removeAttribute("tabindex");
			probe.setAttribute("aria-hidden", "true");
			probe.textContent = fieldText;
			probe.className = field.className;
			Object.assign(probe.style, {
				position: "absolute",
				left: "-10000px",
				top: "0",
				width: `${compactFieldWidth}px`,
				maxWidth: `${compactFieldWidth}px`,
				minWidth: "0",
				height: "auto",
				maxHeight: "none",
				whiteSpace: "pre-wrap",
				wordBreak: "break-word",
				overflow: "visible",
				pointerEvents: "none",
				visibility: "hidden",
			});

			document.body.appendChild(probe);
			const lineCount = getDistinctLineCount(probe);
			document.body.removeChild(probe);
			setIsMeasuredExpanded(lineCount > 1);
		};

		const scheduleMeasure = () => {
			if (frameId !== null) {
				return;
			}
			frameId = window.requestAnimationFrame(measure);
		};

		const resizeObserver = new ResizeObserver(scheduleMeasure);
		observeResizeTargets(resizeObserver, container, addButtonContainer, actionsContainer);

		const mutationObserver = new MutationObserver(scheduleMeasure);
		let boundField: HTMLElement | null = null;
		const bindField = () => {
			const field = findField();
			if (!field || field === boundField) {
				return Boolean(boundField);
			}
			if (boundField) {
				resizeObserver.unobserve(boundField);
			}
			boundField = field;
			observeResizeTargets(resizeObserver, field);
			observeMutations(mutationObserver, field);
			scheduleMeasure();
			return true;
		};

		let pollId: ReturnType<typeof setInterval> | null = null;
		if (!bindField()) {
			pollId = setInterval(() => {
				if (bindField() && pollId) {
					clearInterval(pollId);
					pollId = null;
				}
			}, 50);
		}
		scheduleMeasure();

		return () => {
			if (frameId !== null) {
				window.cancelAnimationFrame(frameId);
			}
			if (pollId) {
				clearInterval(pollId);
			}
			resizeObserver.disconnect();
			mutationObserver.disconnect();
		};
	}, [layout]);

	const addButtonNode = addButton === undefined ? (
		<PromptInputButton
			size="icon-sm"
			variant="ghost"
			aria-label="Add"
			{...addButtonProps}
		>
			<AddIcon label="" />
		</PromptInputButton>
	) : addButton;

	return (
		<PromptInput
			variant="floating"
			allowOverflow={allowOverflow}
			className={cn(
				composerPromptInputClassName,
				"p-2",
				// Compact floating chrome uses space.100 (8px) so demo, Studio, and
				// work-item composers share the same inset as the activity comment bar.
				// The shell already owns the horizontal gutter, so drop the editor's
				// own `px-2.5` from both the control container and the placeholder
				// overlay. Without this the text sits ~10px inboard of the leading
				// "+" button, and empty/typed states start at different offsets.
				"[&_[data-slot=input-group-control-container]]:px-0 [&_[data-slot=prompt-input-placeholder]]:px-0",
				className,
			)}
			{...props}
		>
			{hasInputContext ? (
				<PromptInputHeader className="px-0 pb-2 pt-0">
					{inputContext}
				</PromptInputHeader>
			) : null}
			<PromptInputBody>
				<div
					ref={containerRef}
					className="flex w-full flex-wrap items-center gap-2"
					data-slot="floating-composer-row"
				>
					<div
						ref={addButtonRef}
						className={cn(
							"flex shrink-0 items-center gap-1",
							isExpanded ? "order-2" : "order-1",
						)}
					>
						{addButtonNode}
					</div>
					<div
						ref={textFieldRef}
						className={cn(
							"flex min-w-0",
							isExpanded ? "order-1 basis-full" : "order-2 flex-1",
						)}
					>
						{children}
					</div>
					<div
						ref={actionsRef}
						className="order-3 ml-auto flex shrink-0 items-center gap-1"
					>
						{actions}
					</div>
				</div>
			</PromptInputBody>
		</PromptInput>
	);
}
