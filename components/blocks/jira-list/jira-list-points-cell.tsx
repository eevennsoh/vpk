"use client";

import { useRef, useState, type FocusEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import DataNumberIcon from "@atlaskit/icon/core/data-number";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import ChevronUpIcon from "@atlaskit/icon/core/chevron-up";
import { Button } from "@/components/ui/button";
import { motionDuration, motionEase } from "@/lib/motion";
import { cn } from "@/lib/utils";

function PointsStepperButton({ direction, disabled, issueKey, onBlur, onClick }: Readonly<{
	direction: "up" | "down";
	disabled?: boolean;
	issueKey: string;
	onBlur?: (event: FocusEvent<HTMLElement>) => void;
	onClick: () => void;
}>) {
	const isUp = direction === "up";
	return (
		<Button
			aria-label={`${isUp ? "Increase" : "Decrease"} story points for ${issueKey}`}
			className="h-4 w-6 p-0 hover:bg-transparent active:bg-transparent focus-visible:border-transparent focus-visible:ring-0"
			disabled={disabled}
			onBlur={onBlur}
			onClick={onClick}
			onMouseDown={(event) => event.preventDefault()}
			size="icon-compact"
			variant="ghost"
		>
			<span
				className={cn(
					"pointer-events-none flex h-4 w-6 shrink-0 items-center justify-center rounded-md border border-transparent transition-colors duration-fast ease-out-practical group-hover/button:bg-bg-neutral-subtle-hovered group-active/button:bg-bg-neutral-subtle-pressed group-focus-visible/button:border-ring group-focus-visible/button:ring-3 group-focus-visible/button:ring-ring/50 motion-reduce:transition-none",
					isUp ? "translate-y-0.5" : "-translate-y-0.5",
				)}
				data-slot="jira-list-points-stepper-visual"
			>
				{isUp ? <ChevronUpIcon label="" size="small" /> : <ChevronDownIcon label="" size="small" />}
			</span>
		</Button>
	);
}

export function JiraListPointsCell({ issueKey, onChange, points }: Readonly<{
	issueKey: string;
	onChange: (points: number | undefined) => void;
	points?: number;
}>) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState("");
	const [direction, setDirection] = useState(1);
	const cellRef = useRef<HTMLDivElement>(null);
	const reduceMotion = useReducedMotion();
	const commit = () => {
		const value = draft.trim();
		if (value === "") onChange(undefined);
		else if (/^\d+$/u.test(value) && Number.isSafeInteger(Number(value))) onChange(Number(value));
		setEditing(false);
	};
	const step = (delta: number) => {
		setDirection(delta);
		if (editing) setDraft(String(Math.max(0, (Number(draft) || 0) + delta)));
		else onChange(Math.max(0, (points ?? 0) + delta));
	};
	const commitOnBlur = (event: FocusEvent<HTMLElement>) => {
		if (editing && !cellRef.current?.contains(event.relatedTarget)) commit();
	};

	return (
		<div ref={cellRef} className="group/points absolute inset-0 flex min-w-0 items-center">
			{editing ? (
				<input
					aria-label={`Story points for ${issueKey}`}
					autoFocus
					className="absolute inset-x-3 top-1/2 h-8 -translate-y-1/2 border-0 bg-transparent ps-3 pe-10 text-sm text-text outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
					min="0"
					onBlur={commitOnBlur}
					onChange={(event) => setDraft(event.currentTarget.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") { event.preventDefault(); commit(); }
						if (event.key === "Escape") { event.preventDefault(); setEditing(false); }
					}}
					step="1"
					type="number"
					value={draft}
				/>
			) : (
				<button
					aria-label={`Edit story points for ${issueKey}${points === undefined ? ", no estimate" : `, ${points}`}`}
					className="absolute inset-0 flex min-w-0 items-center px-3 text-sm text-text before:pointer-events-none before:absolute before:inset-x-3 before:inset-y-1 before:rounded-sm hover:before:bg-bg-neutral-subtle-hovered focus-visible:outline-2 focus-visible:outline-border-focused"
					onClick={() => { setDraft(points === undefined ? "" : String(points)); setEditing(true); }}
					type="button"
				>
					<span className="relative h-8 w-8 shrink-0 overflow-hidden">
						<AnimatePresence initial={false} mode="popLayout" custom={direction}>
							<motion.span
								key={points ?? "empty"}
								className={points === undefined ? "absolute inset-0 flex items-center justify-center text-icon-subtlest" : "absolute inset-0 flex items-center justify-center"}
								initial={reduceMotion ? false : { opacity: 0, transform: `translateY(${direction * 8}px)` }}
								animate={{ opacity: 1, transform: "translateY(0px)" }}
								exit={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: `translateY(${-direction * 8}px)` }}
								transition={{ duration: reduceMotion ? 0 : motionDuration.normal, ease: motionEase.outPractical }}
							>{points ?? <DataNumberIcon label="" size="small" />}</motion.span>
						</AnimatePresence>
					</span>
					{points === undefined ? <span className="relative whitespace-nowrap text-sm text-text-subtlest [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/row:opacity-100 [@media(hover:hover)]:group-focus-within/row:opacity-100">Add</span> : null}
				</button>
			)}
			{points !== undefined || editing ? (
				<div className={cn("relative z-10 ms-auto me-4 flex flex-col", !editing && "opacity-0 group-hover/points:opacity-100 group-focus-within/points:opacity-100")}>
					<PointsStepperButton direction="up" issueKey={issueKey} onBlur={commitOnBlur} onClick={() => step(1)} />
					<PointsStepperButton direction="down" disabled={editing ? !draft || Number(draft) <= 0 : points === 0} issueKey={issueKey} onBlur={commitOnBlur} onClick={() => step(-1)} />
				</div>
			) : null}
		</div>
	);
}
