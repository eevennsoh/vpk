"use client";

import { useId, useState } from "react";
import FilterIcon from "@atlaskit/icon/core/filter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	BasicPanel,
	AdvancedPanel,
} from "@/components/blocks/jira-filter/editor-panels";
import {
	jiraFiltersEqual,
	parseJiraFilter,
	serializeJiraFilter,
	type JiraFilterCondition,
	type JiraFilterField,
	type JiraSavedFilter,
} from "@/components/blocks/jira-filter/model";
import { SavedPanel } from "@/components/blocks/jira-filter/saved-panel";

type Directory = "all" | "team" | "personal" | "pinned";
type Mode = "saved" | "basic" | "advanced" | "jql";

export type JiraFilterProps = {
	fields: readonly JiraFilterField[];
	value: readonly JiraFilterCondition[];
	onChange: (value: JiraFilterCondition[]) => void;
	initialSavedFilters?: readonly JiraSavedFilter[];
	initialRecentFilterIds?: readonly string[];
	onSavedFiltersChange?: (filters: readonly JiraSavedFilter[]) => void;
};

export function JiraFilter({
	fields,
	value,
	onChange,
	initialSavedFilters = [],
	initialRecentFilterIds = [],
	onSavedFiltersChange,
}: Readonly<JiraFilterProps>) {
	const [open, setOpen] = useState(false);
	const [mode, setMode] = useState<Mode>("saved");
	const [filters, setFilters] =
		useState<readonly JiraSavedFilter[]>(initialSavedFilters);
	const [pinned, setPinned] = useState<readonly string[]>([]);
	const [recent, setRecent] = useState<readonly string[]>(
		initialRecentFilterIds,
	);
	const [directory, setDirectory] = useState<Directory>("all");
	const [search, setSearch] = useState("");
	const [activeField, setActiveField] = useState(fields[0]?.id ?? "");
	const [draft, setDraft] = useState<JiraFilterCondition[]>([]);
	const [jql, setJql] = useState("");
	const [error, setError] = useState<string | null>(null);
	const errorId = useId();
	const updateFilters = (next: readonly JiraSavedFilter[]) => {
		setFilters(next);
		onSavedFiltersChange?.(next);
	};
	const clear = () => {
		onChange([]);
		setDraft([]);
		setJql("");
		setError(null);
	};
	const changeMode = (next: Mode) => {
		setMode(next);
		setSearch("");
		if (next === "advanced") setDraft([...value]);
		if (next === "jql") {
			setJql(serializeJiraFilter(value));
			setError(null);
		}
	};
	const applyJql = () => {
		const result = parseJiraFilter(jql, fields);
		setError(result.error);
		if (!result.error) onChange(result.conditions);
	};
	const save = () => {
		if (!value.length) return;
		if (!filters.some((filter) => jiraFiltersEqual(filter.conditions, value))) {
			let number = filters.length + 1;
			while (filters.some((filter) => filter.id === `saved-${number}`))
				number++;
			updateFilters([
				...filters,
				{
					id: `saved-${number}`,
					name: `Saved filter ${number}`,
					group: "personal",
					conditions: value.map((item) => ({
						...item,
						values: [...item.values],
					})),
				},
			]);
		}
		setDirectory("all");
		changeMode("saved");
	};
	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (next) {
					setMode("saved");
					setDirectory(pinned.length ? "pinned" : "all");
					setSearch("");
					setDraft([...value]);
					setJql(serializeJiraFilter(value));
					setError(null);
				}
			}}
		>
			<PopoverTrigger render={<Button variant="secondary" />}>
				<FilterIcon label="" />
				Filter{value.length ? ` (${value.length})` : ""}
			</PopoverTrigger>
			<PopoverContent
				align="start"
				aria-label="Jira filter"
				className="w-[min(640px,calc(100vw-2rem))] gap-0 p-0"
			>
				<Tabs
					value={mode}
					onValueChange={(next) => {
						if (
							next === "saved" ||
							next === "basic" ||
							next === "advanced" ||
							next === "jql"
						)
							changeMode(next);
					}}
				>
					<div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 max-sm:px-1">
						<TabsList aria-label="Filter mode">
							<TabsTrigger value="saved">Saved</TabsTrigger>
							<TabsTrigger value="basic">Basic</TabsTrigger>
							<TabsTrigger value="advanced">Advanced</TabsTrigger>
							<TabsTrigger value="jql">JQL</TabsTrigger>
						</TabsList>
						<div className="flex shrink-0 gap-1">
							{mode === "saved" && value.length ? (
								<Button variant="ghost" size="compact" onClick={clear}>
									Clear
								</Button>
							) : null}
							{mode === "basic" ? (
								<Button
									variant="secondary"
									size="compact"
									disabled={!value.length}
									onClick={save}
								>
									Save
								</Button>
							) : null}
						</div>
					</div>
					<TabsContent value="saved" keepMounted={false}>
						<SavedPanel
							onDismiss={() => setOpen(false)}
							filters={filters}
							value={value}
							pinned={pinned}
							recent={recent}
							directory={directory}
							search={search}
							onDirectoryChange={(next) => {
								setDirectory(next);
								setSearch("");
							}}
							onSearchChange={setSearch}
							onClear={clear}
							onSelect={(filter) => {
								if (jiraFiltersEqual(value, filter.conditions)) clear();
								else {
									onChange(
										filter.conditions.map((item) => ({
											...item,
											values: [...item.values],
										})),
									);
									setRecent(
										[
											filter.id,
											...recent.filter((id) => id !== filter.id),
										].slice(0, 5),
									);
								}
							}}
							onPin={(id) => {
								const next = pinned.includes(id)
									? pinned.filter((item) => item !== id)
									: [...pinned, id];
								setPinned(next);
								if (!next.length && directory === "pinned") setDirectory("all");
							}}
							onDelete={(id) => {
								updateFilters(filters.filter((item) => item.id !== id));
								setPinned(pinned.filter((item) => item !== id));
								setRecent(recent.filter((item) => item !== id));
								if (
									directory === "pinned" &&
									pinned.length === 1 &&
									pinned[0] === id
								)
									setDirectory("all");
							}}
						/>
					</TabsContent>
					<TabsContent value="basic" keepMounted={false}>
						<BasicPanel
							onDismiss={() => setOpen(false)}
							fields={fields}
							value={value}
							activeField={activeField}
							search={search}
							onFieldChange={setActiveField}
							onSearchChange={setSearch}
							onChange={onChange}
						/>
					</TabsContent>
					<TabsContent value="advanced" keepMounted={false}>
						<AdvancedPanel
							fields={fields}
							conditions={draft}
							onClear={clear}
							onChange={(next) => {
								setDraft(next);
								onChange(
									next.filter((item) => item.field && item.values.length),
								);
							}}
						/>
					</TabsContent>
					<TabsContent value="jql" keepMounted={false}>
						<div className="flex min-h-80 flex-col gap-3 p-4">
							<label htmlFor={`${errorId}-query`} className="font-medium">
								JQL query
							</label>
							<Textarea
								isMonospaced
								id={`${errorId}-query`}
								value={jql}
								onChange={(event) => {
									setJql(event.target.value);
									setError(null);
								}}
								onKeyDown={(event) => {
									if (event.key === "Enter" && !event.shiftKey) {
										event.preventDefault();
										applyJql();
									}
								}}
								aria-invalid={Boolean(error)}
								aria-describedby={error ? errorId : undefined}
								spellCheck={false}
								className="min-h-40 resize-y"
							/>
							{error ? (
								<p id={errorId} role="alert" className="text-text-danger">
									{error}
								</p>
							) : null}
							<div className="flex items-center justify-between">
								<Button
									variant="ghost"
									onClick={clear}
									disabled={!value.length && !jql}
								>
									Clear
								</Button>
								<div className="flex items-center gap-3">
									<span className="text-xs text-text-subtlest">
										Enter to apply
									</span>
									<Button onClick={applyJql}>Apply</Button>
								</div>
							</div>
						</div>
					</TabsContent>
				</Tabs>
			</PopoverContent>
		</Popover>
	);
}
