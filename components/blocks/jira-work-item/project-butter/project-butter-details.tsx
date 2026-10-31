"use client";

import { useId, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import BranchIcon from "@atlaskit/icon/core/branch";
import CustomizeIcon from "@atlaskit/icon/core/customize";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import WarningIcon from "@atlaskit/icon/core/warning";
import { DateRowField, PersonRowField, PriorityRowField } from "@/components/blocks/jira-work-item/team-eu26/components/detail-field-editors";
import { DetailFieldRow } from "@/components/blocks/jira-work-item/team-eu26/components/detail-field-row";
import { SetToRecurRow } from "@/components/blocks/jira-work-item/team-eu26/components/set-to-recur-popover";
import { TEAM_EU26_PEOPLE } from "@/components/blocks/jira-work-item/team-eu26/data/team-eu26-vita-one";
import { TEAM_EU_REFERENCE_AUTOMATION_RULES } from "@/components/blocks/jira-work-item/team-eu26/data/team-eu-automation-rules";
import { ProjectButterSortablePanel } from "@/components/blocks/jira-work-item/project-butter/project-butter-sortable-panel";
import { ProjectButterExpandControl } from "@/components/blocks/jira-work-item/project-butter/project-butter-expand-control";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { reorderProjectButterPanels, type ProjectButterPanelId } from "@/components/blocks/jira-work-item/project-butter/panel-order";
import { projectButterPersonAvatar } from "@/components/blocks/jira-work-item/project-butter/people";

const TITLES: Record<ProjectButterPanelId, string> = { details: "Details", development: "Development", automation: "Automation", apps: "Apps" };
const APPS = ["My Reminders", "Tempo", "PagerDuty", "Sentry", "Checklist", "Invision for Jira", "Trello Assistant"];

export function ProjectButterDetails({ content, empty, onPanelOrderChange, onStartCoding, panelOrder, sidePanel }: Readonly<{
	content: ProjectButterContent;
	empty: boolean;
	onPanelOrderChange: (order: ProjectButterPanelId[]) => void;
	onStartCoding: () => void;
	panelOrder: ProjectButterPanelId[];
	sidePanel: boolean;
}>) {
	const id = useId();
	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
	const [moreFields, setMoreFields] = useState(false);
	const [developmentFields, setDevelopmentFields] = useState<string[]>([]);
	const [recentRuns, setRecentRuns] = useState(false);
	const people = Object.values(TEAM_EU26_PEOPLE).map((person) => ({ ...person, avatarUrl: person.name === "Automatic" ? undefined : projectButterPersonAvatar(person.name) }));
	const order = panelOrder.filter((panel) => panel !== "apps" || !empty || sidePanel);
	function panelActions(panel: ProjectButterPanelId) {
		if (panel === "apps") return null;
		const Icon = panel === "development" ? CustomizeIcon : ShowMoreHorizontalIcon;
		return <DropdownMenu><DropdownMenuTrigger render={<Button aria-label={panel === "development" ? "Development settings" : `More ${panel} actions`} size="icon-compact" type="button" variant="ghost" />}><Icon label="" size="small" /></DropdownMenuTrigger><DropdownMenuContent align="end" positionerClassName="z-[650]">
			{panel === "details" ? <DropdownMenuCheckboxItem checked={moreFields} onCheckedChange={setMoreFields}>Show more fields</DropdownMenuCheckboxItem> : panel === "development" ? ["Branches", "Commits", "Pull requests"].map((field) => <DropdownMenuCheckboxItem checked={developmentFields.includes(field)} key={field} onCheckedChange={(checked) => setDevelopmentFields((fields) => checked ? [...fields, field] : fields.filter((item) => item !== field))}>Show {field.toLowerCase()}</DropdownMenuCheckboxItem>) : panel === "automation" ? <DropdownMenuItem onSelect={() => setRecentRuns(true)}>Recent run rules</DropdownMenuItem> : null}
		</DropdownMenuContent></DropdownMenu>;
	}
	return (
		<aside aria-label="Work item details" className="min-w-0">
			<DndContext collisionDetection={closestCenter} id={id} onDragEnd={({ active, over }) => onPanelOrderChange(reorderProjectButterPanels(panelOrder, active.id, over?.id ?? null))} sensors={sensors}>
				<SortableContext items={order} strategy={verticalListSortingStrategy}>
					<div className={cn("flex min-w-0 flex-col", sidePanel ? "gap-6" : "gap-4")}>
						{order.map((panel) => <ProjectButterSortablePanel actions={panelActions(panel)} defaultOpen={panel === "details" || panel === "development"} footer={panel === "details" ? <ProjectButterExpandControl chevron expanded={moreFields} label={moreFields ? "Show less details" : "Show more details"} onClick={() => setMoreFields((value) => !value)} /> : null} id={panel} key={panel} sidePanel={sidePanel} title={TITLES[panel]}>
							{panel === "details" ? <div className="space-y-3">
								<DetailFieldRow label="Assignee" value={<PersonRowField ariaLabel="Change assignee" onChange={content.setAssignee} people={people} placeholder="Automatic" value={content.assignee.name === "Automatic" ? null : content.assignee} />} />
								<DetailFieldRow label="Priority" value={<PriorityRowField onChange={content.setPriority} value={content.priority} />} />
								{!empty || content.dueDate ? <DetailFieldRow label="Due Date" value={<span className="flex items-center gap-1"><DateRowField ariaLabel="Change due date" placeholder="Add due date" CalendarComponent={Calendar} onChange={content.setDueDate} value={content.dueDate} />{content.dueDate && content.dueDate.getTime() < Date.UTC(2026, 9, 28) ? <span className="text-icon-danger"><WarningIcon label="Overdue" size="small" /></span> : null}</span>} /> : null}
								{moreFields ? <><DetailFieldRow label="Reporter" value={<PersonRowField ariaLabel="Change reporter" onChange={content.setReporter} people={people} placeholder="Unassigned" value={content.reporter} />} />{empty ? <DetailFieldRow label="Due Date" value={<DateRowField ariaLabel="Change due date" placeholder="Add due date" CalendarComponent={Calendar} onChange={content.setDueDate} value={content.dueDate} />} /> : null}</> : null}
							</div> : panel === "development" ? <div className="space-y-3"><Button onClick={onStartCoding} type="button" variant="ghost"><BranchIcon label="" size="small" />Start coding</Button>{developmentFields.map((field) => <p className="text-sm text-text-subtle" key={field}>No {field.toLowerCase()} linked</p>)}</div> : panel === "automation" ? <div className="space-y-3"><ul className="space-y-3 text-sm text-text">{TEAM_EU_REFERENCE_AUTOMATION_RULES.map((rule) => <li key={rule.id}>{rule.title}</li>)}</ul><Button onClick={() => setRecentRuns(true)} type="button" variant="ghost">Recent run rules</Button><SetToRecurRow /></div> : <div className="space-y-2">{APPS.map((app) => <details key={app}><summary className="cursor-pointer rounded-sm py-2 text-sm text-text focus-visible:ring-2 focus-visible:ring-ring">{app}</summary><p className="pb-3 text-sm text-text-subtle">Work item information from {app} appears here.</p></details>)}</div>}
						</ProjectButterSortablePanel>)}
					</div>
				</SortableContext>
			</DndContext>
			<Dialog onOpenChange={setRecentRuns} open={recentRuns}><DialogContent className="z-[701]" overlayProps={{ forceRender: true, className: "z-[700]" }} size="md"><DialogTitle>Recent run rules</DialogTitle><DialogDescription>Recent automation activity for this work item.</DialogDescription><ul className="space-y-3 text-sm">{TEAM_EU_REFERENCE_AUTOMATION_RULES.filter((rule) => rule.lastRunAt).map((rule) => <li key={rule.id}>{rule.title}<span className="ml-2 text-text-subtlest">{rule.lastRunAt}</span></li>)}</ul></DialogContent></Dialog>
		</aside>
	);
}
