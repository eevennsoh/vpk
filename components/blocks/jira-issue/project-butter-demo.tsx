"use client";

import { useState, type ReactNode } from "react";
import { JiraEpic } from "@/components/blocks/jira-epic";
import { JIRA_EPIC_DEMO_EPICS } from "@/components/blocks/jira-epic/data/demo-epics";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { JiraIssueDefaultProps, JiraIssueMoreAction, JiraIssueParticipant } from "./index";
import { ProjectButterAssignee } from "./project-butter-assignee";

export type ProjectButterDemoIssueProps = Pick<
	JiraIssueDefaultProps,
	| "appearance"
	| "metadata"
	| "assigneeControl"
	| "parentEpicControl"
	| "onSubtaskOpen"
	| "onMoreActionSelect"
	| "availableMoreActions"
	| "moreMenuActions"
	| "onSelectionToggle"
	| "selected"
	| "onClick"
	| "tags"
	| "subtasks"
>;

type DemoDialog =
	| { kind: "work-item"; issueKey: string; summary: string; status?: string }
	| { kind: "labels" };

export function ProjectButterPlayground({
	children,
	participants,
}: Readonly<{
	children: (issueProps: ProjectButterDemoIssueProps) => ReactNode;
	participants: readonly JiraIssueParticipant[];
}>) {
	const [assignee, setAssignee] = useState<JiraIssueParticipant | undefined>(participants[0]);
	const [parentId, setParentId] = useState<string | null>(JIRA_EPIC_DEMO_EPICS[0]?.id ?? null);
	const [parentOpen, setParentOpen] = useState(false);
	const [selected, setSelected] = useState(false);
	const [flagged, setFlagged] = useState(false);
	const [labels, setLabels] = useState("FE Development, date-range, accessibility");
	const [labelDraft, setLabelDraft] = useState("");
	const [notice, setNotice] = useState("");
	const [dialog, setDialog] = useState<DemoDialog | null>(null);

	async function handleAction(action: JiraIssueMoreAction) {
		switch (action) {
			case "copy-key":
			case "copy-link":
				try {
					await navigator.clipboard.writeText(
						action === "copy-key"
							? "PD-40"
							: `${window.location.origin}/components/blocks/jira-issue#project-butter`,
					);
					setNotice(action === "copy-key" ? "Copied PD-40" : "Copied work item link");
				} catch {
					setNotice("Clipboard unavailable. Work item: PD-40.");
				}
				break;
			case "add-flag":
				setFlagged((current) => !current);
				break;
			case "change-parent":
				setParentOpen(true);
				break;
			case "edit-labels":
				setLabelDraft(labels);
				setDialog({ kind: "labels" });
				break;
			default:
				break;
		}
	}

	return (
		<section className="w-full" aria-label="Project butter playground" data-project-butter-demo="">
			<div className="flex flex-wrap justify-center gap-2 pt-4">
				<Button
					size="compact"
					variant="outline"
					aria-pressed={!assignee}
					onClick={() => setAssignee((current) => (current ? undefined : participants[0]))}
				>
					Unassigned
				</Button>
				<Button
					size="compact"
					variant="outline"
					aria-pressed={flagged}
					onClick={() => setFlagged((current) => !current)}
				>
					Flagged
				</Button>
			</div>
			{notice ? (
				<p role="status" className="pt-2 text-center text-xs text-text-subtle">
					{notice}
				</p>
			) : null}
			{children({
				appearance: "project-butter",
				metadata: {
					issueType: "story",
					dueDate: "2026-04-11",
					dueDateWarning: true,
					storyPoints: 3,
					flagged,
				},
				assigneeControl: (
					<ProjectButterAssignee
						issueKey="PD-40"
						assignee={assignee}
						options={participants}
						onAssign={setAssignee}
					/>
				),
				parentEpicControl: (
					<JiraEpic
						appearance="swatch"
						epics={JIRA_EPIC_DEMO_EPICS}
						open={parentOpen}
						onOpenChange={setParentOpen}
						selectedEpicId={parentId}
						onEpicSelect={setParentId}
						onRemoveParent={() => setParentId(null)}
						onViewParent={() => {
							const parent = JIRA_EPIC_DEMO_EPICS.find((epic) => epic.id === parentId);
							if (parent) setDialog({ kind: "work-item", issueKey: parent.issueKey, summary: parent.name });
						}}
						showLabel={false}
						triggerLabel="Select parent epic"
						contentClassName="w-[220px]"
					/>
				),
				onSubtaskOpen: (subtask) => setDialog({ kind: "work-item", ...subtask }),
				onMoreActionSelect: (action) => {
					void handleAction(action);
				},
				availableMoreActions: ["copy-key", "copy-link", "change-parent", "edit-labels", "add-flag"],
				moreMenuActions: { onSelect: () => setSelected(true) },
				onSelectionToggle: selected ? () => setSelected(false) : undefined,
				selected,
				onClick: (event) => {
					if (selected || event.shiftKey || event.metaKey) setSelected((current) => !current);
				},
				tags: labels
					.split(",")
					.map((text) => text.trim())
					.filter(Boolean)
					.map((text) => ({ text, color: "purple" })),
			})}
			<Dialog
				open={dialog !== null}
				onOpenChange={(open) => {
					if (!open) setDialog(null);
				}}
			>
				<DialogContent size="md">
					<DialogHeader>
						<DialogTitle>{dialog?.kind === "labels" ? "Edit labels" : dialog?.issueKey}</DialogTitle>
						<DialogDescription>
							{dialog?.kind === "work-item" ? dialog.summary : "Update the labels shown on PD-40."}
						</DialogDescription>
					</DialogHeader>
					{dialog?.kind === "labels" ? (
						<form
							className="flex flex-col gap-4"
							onSubmit={(event) => {
								event.preventDefault();
								setLabels(labelDraft);
								setDialog(null);
							}}
						>
							<label className="flex flex-col gap-2 text-sm">
								Labels
								<Input value={labelDraft} onChange={(event) => setLabelDraft(event.target.value)} />
							</label>
							<Button type="submit">Save labels</Button>
						</form>
					) : (
						<p className="text-sm text-text-subtle">{dialog?.status ?? "To Do"}</p>
					)}
				</DialogContent>
			</Dialog>
		</section>
	);
}
