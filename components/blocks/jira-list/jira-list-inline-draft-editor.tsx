import CrossIcon from "@atlaskit/icon/core/cross";
import { motion, useIsPresent, usePresenceData, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

import { IssueTypeGlyph } from "@/components/blocks/jira-list/jira-list-cells";
import type { JiraListIssueType } from "@/components/blocks/jira-list/jira-list-types";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { ReturnIcon } from "@/components/ui/vpk-icons";
import { JiraListTableCell } from "@/components/blocks/jira-list/jira-list-table";
import { motionDuration, motionEase } from "@/lib/motion";

export function JiraListInlineDraftRow({ firstCellClassName, editorCellClassName, colSpan, children, animateEntry = true }: Readonly<{
	firstCellClassName: string;
	editorCellClassName: string;
	colSpan: number;
	children: ReactNode;
	animateEntry?: boolean;
}>) {
	const isPresent = useIsPresent();
	const draftStillOpen = Boolean(usePresenceData());
	const reduceMotion = useReducedMotion();
	return (
		<tr aria-hidden={!isPresent || undefined} className="group/row border-0 hover:bg-transparent focus-within:bg-transparent" data-state="draft" inert={!isPresent}>
			<JiraListTableCell className={firstCellClassName} />
			<JiraListTableCell className={editorCellClassName} colSpan={colSpan}>
				<motion.div
					animate={{ height: "auto", opacity: 1 }}
					className="overflow-hidden"
					exit={{ height: 0, opacity: 0, transition: { duration: reduceMotion || draftStillOpen ? motionDuration.instant : motionDuration.fast, ease: motionEase.in } }}
					initial={reduceMotion || !animateEntry ? false : { height: 0, opacity: 0 }}
					transition={{ duration: motionDuration.normal, ease: motionEase.outPractical }}
				>
					<div className="flex h-10 items-center [&>*]:min-w-0 [&>*]:flex-1">{children}</div>
				</motion.div>
			</JiraListTableCell>
		</tr>
	);
}

export function JiraListInlineDraftEditor({
	summary, issueType, parentIssueKey, canIndent, onChange, onKeyDown, onSubmit, onCancel,
}: Readonly<{
	summary: string;
	issueType: JiraListIssueType;
	parentIssueKey?: string;
	canIndent: boolean;
	onChange: (value: string) => void;
	onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
	onSubmit: () => void;
	onCancel: () => void;
}>) {
	const editorRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const isPresent = useIsPresent();
	useLayoutEffect(() => {
		inputRef.current?.focus({ preventScroll: true });
	}, []);
	useEffect(() => {
		if (!isPresent || summary.trim()) return;
		function dismissEmpty(event: PointerEvent) {
			if (event.target instanceof Node && editorRef.current?.closest("tr")?.contains(event.target)) return;
			onCancel();
		}
		document.addEventListener("pointerdown", dismissEmpty, true);
		return () => document.removeEventListener("pointerdown", dismissEmpty, true);
	}, [isPresent, onCancel, summary]);
	return (
		<div ref={editorRef} className="flex min-w-0 items-center gap-2">
			<div className="min-w-0 flex-1 pe-6">
				<motion.div
					animate={{ x: parentIssueKey ? 24 : 0 }}
					className="flex min-w-0 items-center gap-2"
					initial={false}
					transition={{ duration: motionDuration.normal, ease: motionEase.inOut }}
				>
					<IssueTypeGlyph issueType={parentIssueKey ? "subtask" : issueType} large />
					<Input
						aria-label="New work item summary"
						ref={inputRef}
						className="min-w-0 flex-1 px-0 focus-visible:ring-0"
						onChange={(event) => onChange(event.target.value)}
						onKeyDown={onKeyDown}
						placeholder="What needs to be done?"
						value={summary}
						variant="none"
					/>
				</motion.div>
			</div>
			{canIndent ? <span className="hidden shrink-0 items-center gap-1 text-xs text-text-subtle md:inline-flex">
				<KbdGroup>
					<Kbd className="bg-surface-raised">Cmd</Kbd>
					<Kbd className="bg-surface-raised">{parentIssueKey ? "[" : "]"}</Kbd>
				</KbdGroup>
				{parentIssueKey ? "Move out" : "Sub-task"}
			</span> : null}
			<div className="flex shrink-0 items-center gap-1">
				<Button disabled={!summary.trim()} onClick={onSubmit} size="compact">Create <ReturnIcon aria-hidden size="small" /></Button>
				<Button aria-label="Cancel creation" onClick={onCancel} size="icon-compact" variant="ghost">
					<Icon render={<CrossIcon label="" size="small" />} />
				</Button>
			</div>
		</div>
	);
}
