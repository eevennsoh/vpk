"use client";

import { useState } from "react";
import { JiraInlineCreate, type JiraInlineCreateDraft } from "@/components/blocks/jira-inline-create";
import { JIRA_INLINE_CREATE_DEMO_COLUMNS } from "./data/demo";
import { Button } from "@/components/ui/button";

export default function JiraInlineCreatePage() {
	const [open, setOpen] = useState(true);
	const [saved, setSaved] = useState<JiraInlineCreateDraft | null>(null);
	return (
		<div className="mx-auto flex w-full max-w-sm flex-col gap-4 p-4">
			{open ? <JiraInlineCreate
				columns={JIRA_INLINE_CREATE_DEMO_COLUMNS}
				issueKey="PAY-1000"
				onCancel={() => setOpen(false)}
				onSave={(draft) => { setSaved(draft); setOpen(false); }}
			/> : <Button onClick={() => { setSaved(null); setOpen(true); }} type="button" variant="outline">Create work item</Button>}
			{saved ? <p className="text-sm text-text-subtle" role="status">Created PAY-1000: {saved.summary}</p> : null}
		</div>
	);
}
