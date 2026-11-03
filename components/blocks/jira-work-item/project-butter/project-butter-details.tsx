"use client";

import { useId, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import CustomizeIcon from "@atlaskit/icon/core/customize";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import { SetToRecurRow } from "@/components/blocks/jira-work-item/team-eu26/components/set-to-recur-popover";
import { TEAM_EU_REFERENCE_AUTOMATION_RULES } from "@/components/blocks/jira-work-item/team-eu26/data/team-eu-automation-rules";
import { ProjectButterDetailsFields } from "@/components/blocks/jira-work-item/project-butter/details-fields";
import { ProjectButterDevelopmentActions } from "@/components/blocks/jira-work-item/project-butter/project-butter-development-actions";
import { PROJECT_BUTTER_DETAIL_FIELDS, PROJECT_BUTTER_REQUIRED_DETAIL_FIELDS } from "@/components/blocks/jira-work-item/project-butter/details-model";
import { ProjectButterSuggestionPanel } from "@/components/blocks/jira-work-item/project-butter/suggestion-panel";
import { useProjectButterSuggestionFill } from "@/components/blocks/jira-work-item/project-butter/use-suggestion-fill";
import { ProjectButterSortablePanel } from "@/components/blocks/jira-work-item/project-butter/project-butter-sortable-panel";
import { ProjectButterExpandControl } from "@/components/blocks/jira-work-item/project-butter/project-butter-expand-control";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { reorderProjectButterPanels, type ProjectButterPanelId } from "@/components/blocks/jira-work-item/project-butter/panel-order";

const TITLES: Record<ProjectButterPanelId, string> = { details: "Details", development: "Development", automation: "Automation", apps: "Apps" };
const APPS = ["My Reminders", "Tempo", "PagerDuty", "Sentry", "Checklist", "Invision for Jira", "Trello Assistant"];

export function ProjectButterDetails({ code = "VITA-1", content, empty, onDescriptionSuggested, onPanelOrderChange, onStartCoding, panelOrder, sidePanel, suggestion = false, suggestionProfile = "default" }: Readonly<{
	code?: string;
	content: ProjectButterContent;
	empty: boolean;
	onDescriptionSuggested?: (text: string) => void;
	onPanelOrderChange: (order: ProjectButterPanelId[]) => void;
	onStartCoding: () => void;
	panelOrder: ProjectButterPanelId[];
	sidePanel: boolean;
	suggestion?: boolean;
	suggestionProfile?: "default" | "payments";
}>) {
	const id = useId();
	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
	const [moreFields, setMoreFields] = useState(false);
	const [developmentFields, setDevelopmentFields] = useState<string[]>([]);
	const [recentRuns, setRecentRuns] = useState(false);
	const fill = useProjectButterSuggestionFill(content, suggestion, () => setMoreFields(true), suggestionProfile, onDescriptionSuggested);
	const order = panelOrder.filter((panel) => panel !== "apps" || !empty || sidePanel);
	function panelActions(panel: ProjectButterPanelId) {
		if (panel === "apps") return null;
		const Icon = panel === "development" ? CustomizeIcon : ShowMoreHorizontalIcon;
		return <DropdownMenu><DropdownMenuTrigger render={<Button aria-label={panel === "development" ? "Development settings" : `More ${panel} actions`} size="icon-compact" type="button" variant="ghost" />}><Icon label="" size="small" /></DropdownMenuTrigger><DropdownMenuContent align="end" positionerClassName="z-[650]">
			{panel === "details" ? <><DropdownMenuCheckboxItem checked={moreFields} onCheckedChange={setMoreFields}>Show more fields</DropdownMenuCheckboxItem><DropdownMenuSeparator /><DropdownMenuGroup><DropdownMenuLabel>Visible fields</DropdownMenuLabel>{content.detailFields.order.filter((field) => !PROJECT_BUTTER_REQUIRED_DETAIL_FIELDS.includes(field)).map((field) => <DropdownMenuCheckboxItem checked={!content.detailFields.hidden.includes(field)} key={field} onCheckedChange={(checked) => { content.setDetailFields((current) => ({ ...current, hidden: checked ? current.hidden.filter((hidden) => hidden !== field) : [...current.hidden, field] })); if (checked) setMoreFields(true); }}>{PROJECT_BUTTER_DETAIL_FIELDS[field]}</DropdownMenuCheckboxItem>)}</DropdownMenuGroup></> : panel === "development" ? ["Branches", "Commits", "Pull requests"].map((field) => <DropdownMenuCheckboxItem checked={developmentFields.includes(field)} key={field} onCheckedChange={(checked) => setDevelopmentFields((fields) => checked ? [...fields, field] : fields.filter((item) => item !== field))}>Show {field.toLowerCase()}</DropdownMenuCheckboxItem>) : panel === "automation" ? <DropdownMenuItem onSelect={() => setRecentRuns(true)}>Recent run rules</DropdownMenuItem> : null}
		</DropdownMenuContent></DropdownMenu>;
	}
	return (
		<aside aria-label="Work item details" className="min-w-0">
			{suggestion ? <ProjectButterSuggestionPanel fill={fill} showIntroLoading={suggestionProfile === "payments"} /> : null}
			<div className={cn("relative", suggestion && "[&_[data-field-id]]:scroll-mt-20")} data-project-butter-suggestion-fields={fill.columnId}>
			<DndContext collisionDetection={closestCenter} id={id} onDragEnd={({ active, over }) => onPanelOrderChange(reorderProjectButterPanels(panelOrder, active.id, over?.id ?? null))} sensors={sensors}>
				<SortableContext items={order} strategy={verticalListSortingStrategy}>
					<div className={cn("flex min-w-0 flex-col", sidePanel ? "gap-6" : "gap-4")}>
						{order.map((panel) => <ProjectButterSortablePanel actions={panelActions(panel)} defaultOpen={panel === "details" || panel === "development"} footer={panel === "details" ? <ProjectButterExpandControl chevron expanded={moreFields} label={moreFields ? "Show less details" : "Show more details"} onClick={() => setMoreFields((value) => !value)} /> : null} id={panel} key={panel} sidePanel={sidePanel} title={TITLES[panel]}>
							{panel === "details" ? <ProjectButterDetailsFields content={content} empty={empty} expanded={moreFields} fillingBarAfter={fill.running ? fill.barAfter : null} reflow={fill.running} shimmerText={fill.shimmerText} /> : panel === "development" ? <div className="-mb-2 space-y-3"><ProjectButterDevelopmentActions code={code} description={content.description} key={code} onStartCoding={onStartCoding} summary={content.summary} />{developmentFields.map((field) => <p className="text-sm text-text-subtle" key={field}>No {field.toLowerCase()} linked</p>)}</div> : panel === "automation" ? <div className="space-y-3"><ul className="space-y-3 text-sm text-text">{TEAM_EU_REFERENCE_AUTOMATION_RULES.map((rule) => <li key={rule.id}>{rule.title}</li>)}</ul><Button onClick={() => setRecentRuns(true)} type="button" variant="ghost">Recent run rules</Button><SetToRecurRow /></div> : <div className="space-y-2">{APPS.map((app) => <details key={app}><summary className="cursor-pointer rounded-sm py-2 text-sm text-text focus-visible:ring-2 focus-visible:ring-ring">{app}</summary><p className="pb-3 text-sm text-text-subtle">Work item information from {app} appears here.</p></details>)}</div>}
						</ProjectButterSortablePanel>)}
					</div>
				</SortableContext>
			</DndContext>
			</div>
			<Dialog onOpenChange={setRecentRuns} open={recentRuns}><DialogContent className="z-[701]" overlayProps={{ forceRender: true, className: "z-[700]" }} size="md"><DialogTitle>Recent run rules</DialogTitle><DialogDescription>Recent automation activity for this work item.</DialogDescription><ul className="space-y-3 text-sm">{TEAM_EU_REFERENCE_AUTOMATION_RULES.filter((rule) => rule.lastRunAt).map((rule) => <li key={rule.id}>{rule.title}<span className="ml-2 text-text-subtlest">{rule.lastRunAt}</span></li>)}</ul></DialogContent></Dialog>
		</aside>
	);
}
