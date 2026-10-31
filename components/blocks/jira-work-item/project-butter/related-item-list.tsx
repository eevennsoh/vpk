"use client";

import { useState } from "react";
import AddIcon from "@atlaskit/icon/core/add";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectButterRelatedItemRow } from "@/components/blocks/jira-work-item/project-butter/related-item-row";
import { ProjectButterExpandControl } from "@/components/blocks/jira-work-item/project-butter/project-butter-expand-control";
import type { ProjectButterRelatedItem } from "@/components/blocks/jira-work-item/project-butter/related-model";

export function ProjectButterRelatedItemList({ items, label, onAdd, onChange }: Readonly<{ items: readonly ProjectButterRelatedItem[]; label: string; onAdd: (summary: string) => void; onChange: (items: readonly ProjectButterRelatedItem[]) => void }>) {
	const [expanded, setExpanded] = useState(false);
	const [adding, setAdding] = useState(false);
	const [summary, setSummary] = useState("");
	const shown = expanded ? items : items.slice(0, 5);
	const remaining = items.length - shown.length;
	const done = items.filter((item) => item.status === "Done").length;
	function createItem() { if (!summary.trim()) return; onAdd(summary.trim()); setSummary(""); setAdding(false); setExpanded(true); }
	return (
		<section aria-label={label} className="space-y-3">
			<div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-medium text-text">{label}{label === "Child work items" && items.length > 0 ? <span className="text-xs text-text-subtle"><span aria-hidden>{done}/{items.length}</span><span className="sr-only">{done} of {items.length} done</span></span> : null}</h3><Button aria-label={`Add ${label === "Linked work" ? "linked work" : "child work item"}`} onClick={() => setAdding((value) => !value)} size="icon" type="button" variant="ghost"><AddIcon label="" size="small" /></Button></div>
			{adding ? <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); createItem(); }}><Input aria-label={`New ${label.toLowerCase()} summary`} autoFocus onChange={(event) => setSummary(event.currentTarget.value)} placeholder="Enter a work item summary" value={summary} /><Button disabled={!summary.trim()} type="submit">Add</Button><Button onClick={() => setAdding(false)} type="button" variant="ghost">Cancel</Button></form> : null}
			<div className="relative rounded-lg border border-border"><ul aria-label={label}>{shown.map((item, index) => <ProjectButterRelatedItemRow faded={remaining > 0 && index === shown.length - 1} item={item} key={item.key} onChange={(patch) => onChange(items.map((candidate) => candidate.key === item.key ? { ...candidate, ...patch } : candidate))} onRemove={() => onChange(items.filter((candidate) => candidate.key !== item.key))} />)}</ul>{items.length === 0 ? <p className="p-4 text-sm text-text-subtle">No {label.toLowerCase()}.</p> : null}{items.length > 5 ? <ProjectButterExpandControl expanded={expanded} label={remaining ? `Show ${remaining} more` : "Show less"} onClick={() => setExpanded((value) => !value)} /> : null}</div>
		</section>
	);
}
