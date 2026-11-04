"use client";

import { Fragment, useState } from "react";

import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";

const FIELD_VALUES = {
	"Issue key": "SHIL-25",
	"Issue summary": "dev-panel-pull-request-data-integration",
	"Issue short summary": "dev-panel-pull-request-data",
	"Issue type": "story",
	"Project key": "SHIL",
} as const;

type BranchField = keyof typeof FIELD_VALUES;
const FIELDS: readonly BranchField[] = ["Issue key", "Issue summary", "Issue short summary", "Issue type", "Project key"];

export function BranchNameSettings() {
	const [format, setFormat] = useState<{ nextId: number; fields: { id: number; field: BranchField }[] }>({
		nextId: 2,
		fields: [{ id: 0, field: "Issue key" }, { id: 1, field: "Issue summary" }],
	});
	const branchName = format.fields.map(({ field }) => FIELD_VALUES[field]).join("-");

	return (
		<div className="flex flex-col gap-3 text-sm text-text">
			<h3 className="font-semibold">Update branch name format</h3>
			<div aria-label="Branch name format" className="flex max-h-24 flex-wrap items-center gap-1 overflow-y-auto rounded-sm border border-border px-2 py-2" role="group">
				{format.fields.map(({ id, field }, index) => (
					<Fragment key={id}>
						{index > 0 ? <span aria-hidden>–</span> : null}
						<Tag color="blue" onRemove={() => setFormat((current) => ({ ...current, fields: current.fields.filter((item) => item.id !== id) }))}>{field}</Tag>
					</Fragment>
				))}
			</div>
			<p className="text-text-subtle">Select fields to add</p>
			<div className="flex flex-wrap gap-1">
				{FIELDS.map((field) => <Button key={field} onClick={() => setFormat((current) => ({ nextId: current.nextId + 1, fields: [...current.fields, { id: current.nextId, field }] }))} size="compact" type="button" variant="outline">{field}</Button>)}
			</div>
			<div className="border-t border-border pt-3">
				<p className="mb-2 font-medium">Preview</p>
				<code className="block break-all rounded-sm border border-border p-2 text-xs">git checkout -b {branchName}</code>
			</div>
			<div className="flex justify-end gap-2"><Button size="compact" type="button" variant="ghost">Cancel</Button><Button size="compact" type="button">Save</Button></div>
		</div>
	);
}
