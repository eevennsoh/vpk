"use client";

import { useId, useState } from "react";
import { AdvancedFilterBuilder } from "@/components/blocks/jira-filter/advanced-filter-builder";
import { JqlEditor } from "@/components/blocks/jira-filter/jql-editor";
import {
	parseJiraFilter,
	type JiraFilterCondition,
	type JiraFilterField,
} from "@/components/blocks/jira-filter/model";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function ButterAdvancedPanel({
	fields,
	draft,
	onChange,
}: Readonly<{
	fields: readonly JiraFilterField[];
	draft: readonly JiraFilterCondition[];
	onChange: (next: JiraFilterCondition[]) => void;
}>) {
	return <AdvancedFilterBuilder fields={fields} draft={draft} onChange={onChange} />;
}

export function ButterJqlPanel({
	fields,
	value,
	jql,
	error,
	onDraftChange,
	onApply,
	onError,
	onClose,
}: Readonly<{
	fields: readonly JiraFilterField[];
	value: readonly JiraFilterCondition[];
	jql: string;
	error: string | null;
	onDraftChange: (next: string) => void;
	onApply: (next: JiraFilterCondition[]) => void;
	onError: (error: string | null) => void;
	onClose: () => void;
}>) {
	const [expanded, setExpanded] = useState(false);
	const apply = () => {
		const result = parseJiraFilter(jql, fields);
		onError(result.error);
		if (!result.error) onApply(result.conditions);
	};
	const clear = () => { onDraftChange(""); onApply([]); onError(null); };
	return <>
		<JqlEditor fields={fields} value={jql} error={error} canClear={Boolean(value.length || jql)} onValueChange={onDraftChange} onApply={apply} onClear={clear} onExpand={() => setExpanded(true)} />
		<Dialog open={expanded} onOpenChange={(next) => { setExpanded(next); if (!next) onClose(); }}><DialogContent size="lg" className="z-[750] pb-1.5" overlayProps={{ className: "z-[740]" }}><DialogTitle>JQL query</DialogTitle><JqlEditor expanded fields={fields} value={jql} error={error} canClear={Boolean(value.length || jql)} onValueChange={onDraftChange} onApply={apply} onClear={clear} /></DialogContent></Dialog>
	</>;
}

export function ButterNamePanel({
	label,
	value,
	onChange,
	onSave,
	onCancel,
}: Readonly<{
	label: string;
	value: string;
	onChange: (next: string) => void;
	onSave: () => void;
	onCancel: () => void;
}>) {
	const id = useId();
	return (
		<div className="space-y-2 p-1" role="none">
			<label htmlFor={id} className="text-sm font-medium">
				{label}
			</label>
			<Input
				id={id}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						onSave();
					}
				}}
			/>
			<div className="flex justify-end gap-1">
				<Button variant="ghost" size="compact" onClick={onCancel}>
					Cancel
				</Button>
				<Button
					variant="secondary"
					size="compact"
					disabled={!value.trim()}
					onClick={onSave}
				>
					Save
				</Button>
			</div>
		</div>
	);
}
