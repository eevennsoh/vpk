"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import { IssueTypeGlyph } from "@/components/blocks/jira-list/jira-list-cells";
import { ProjectButterIssueKey } from "@/components/blocks/jira-issue/project-butter-summary";
import type { JiraListIssueType } from "@/components/blocks/jira-list/jira-list-types";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import type { JiraInlineCreateDraft, JiraInlineCreateProps } from "./types";
import { JiraInlineCreateFields } from "./components/jira-inline-create-fields";

export type { JiraInlineCreateDraft, JiraInlineCreateProps } from "./types";

const ISSUE_TYPES: readonly JiraListIssueType[] = ["story", "epic", "bug", "task"];

export function JiraInlineCreate({ assignees, columns, issueKey, onCancel, onSave, ref }: Readonly<JiraInlineCreateProps>) {
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const [summary, setSummary] = useState("");
	const [issueType, setIssueType] = useState<JiraListIssueType>("task");
	const [previewType, setPreviewType] = useState<JiraListIssueType>();
	const [metadata, setMetadata] = useState<Omit<JiraInlineCreateDraft, "summary" | "issueType">>({});

	useLayoutEffect(() => { inputRef.current?.focus({ preventScroll: true }); }, []);
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || event.defaultPrevented) return;
			event.preventDefault();
			onCancel();
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [onCancel]);

	return (
		<form
			ref={ref}
			aria-label={`Create work item in ${issueKey}`}
			data-jira-inline-create=""
			className="group/jira-issue flex min-w-0 flex-col gap-2 rounded-lg bg-surface-raised p-3 shadow-sm"
			onSubmit={(event) => {
				event.preventDefault();
				if (summary.trim()) onSave({ ...metadata, issueType, summary: summary.trim() });
			}}
		>
			<DropdownMenu modal={false} onOpenChange={(open) => { if (!open) setPreviewType(undefined); }}>
				<DropdownMenuTrigger render={<button aria-label={`Work item type: ${issueType}`} className="flex min-h-6 w-fit min-w-0 items-center rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" type="button" />}>
					<ProjectButterIssueKey issueKey={issueKey} issueType={previewType ?? issueType} />
					<Icon className="ml-1 text-icon-subtle" render={<ChevronDownIcon label="" size="small" />} />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start">
					{ISSUE_TYPES.map((type) => <DropdownMenuItem key={type} elemBefore={<IssueTypeGlyph issueType={type} />} onMouseEnter={() => setPreviewType(type)} onFocus={() => setPreviewType(type)} onSelect={() => setIssueType(type)} selected={type === issueType}>{type.charAt(0).toUpperCase() + type.slice(1)}</DropdownMenuItem>)}
				</DropdownMenuContent>
			</DropdownMenu>
			<textarea ref={inputRef} aria-label="Work item summary" className="min-h-5 w-full min-w-0 resize-none rounded-sm bg-transparent text-sm text-text outline-none placeholder:text-text-disabled focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [field-sizing:content]" onChange={(event) => setSummary(event.target.value)} onKeyDown={(event) => {
				if (event.key !== "Enter" || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
				event.preventDefault();
				event.currentTarget.form?.requestSubmit();
			}} placeholder={`Describe your ${issueType}`} rows={1} value={summary} />
			<JiraInlineCreateFields assignees={assignees} columns={columns} value={metadata} onChange={(patch) => setMetadata((current) => ({ ...current, ...patch }))} saveAction={<Button aria-label="Save work item" disabled={!summary.trim()} size="icon-compact" type="submit" variant="secondary"><Icon render={<CheckMarkIcon label="" size="small" />} /></Button>} />
		</form>
	);
}
