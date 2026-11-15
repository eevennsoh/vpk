"use client";

import { useId } from "react";
import { AdvancedPanel } from "@/components/blocks/jira-filter/editor-panels";
import {
	parseJiraFilter,
	type JiraFilterCondition,
	type JiraFilterField,
} from "@/components/blocks/jira-filter/model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function ButterAdvancedPanel({
	fields,
	draft,
	onChange,
}: Readonly<{
	fields: readonly JiraFilterField[];
	draft: readonly JiraFilterCondition[];
	onChange: (next: JiraFilterCondition[]) => void;
}>) {
	return (
		<div className="max-h-60 overflow-y-auto">
			<AdvancedPanel
				compact
				fields={fields}
				conditions={draft}
				onChange={onChange}
				onClear={() => onChange([])}
			/>
		</div>
	);
}

export function ButterJqlPanel({
	fields,
	value,
	jql,
	error,
	onDraftChange,
	onApply,
	onError,
}: Readonly<{
	fields: readonly JiraFilterField[];
	value: readonly JiraFilterCondition[];
	jql: string;
	error: string | null;
	onDraftChange: (next: string) => void;
	onApply: (next: JiraFilterCondition[]) => void;
	onError: (error: string | null) => void;
}>) {
	const errorId = useId();
	const apply = () => {
		const result = parseJiraFilter(jql, fields);
		onError(result.error);
		if (!result.error) onApply(result.conditions);
	};
	return (
		<div className="space-y-2 p-1" role="none">
			<label htmlFor={`${errorId}-query`} className="text-sm font-medium">
				JQL query
			</label>
			<Textarea
				id={`${errorId}-query`}
				isMonospaced
				value={jql}
				onChange={(event) => onDraftChange(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter" && event.shiftKey) {
						event.preventDefault();
						apply();
					}
				}}
				aria-invalid={Boolean(error)}
				aria-describedby={error ? errorId : undefined}
				className="min-h-24"
			/>
			{error ? (
				<p id={errorId} role="alert" className="text-text-danger">
					{error}
				</p>
			) : null}
			<div className="flex items-center justify-between gap-2">
				<Button
					variant="ghost"
					size="compact"
					onClick={() => {
						onDraftChange("");
						onApply([]);
					}}
					disabled={!value.length && !jql}
				>
					Clear
				</Button>
				<span className="text-xs text-text-subtlest">Shift+Enter to apply</span>
				<Button variant="secondary" size="compact" onClick={apply}>
					Apply
				</Button>
			</div>
		</div>
	);
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
