"use client";

import { useId, useState, type ReactNode } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import { SetToRecurRow } from "@/components/blocks/jira-work-item/team-eu26/components/set-to-recur-popover";
import { TeamEuAppsList } from "@/components/blocks/jira-work-item/team-eu26/components/team-eu-apps-panel";
import { AutomationRuleList, TeamEuRecentAutomationRuns } from "@/components/blocks/jira-work-item/team-eu26/components/team-eu-automation-panel";
import { TEAM_EU_REFERENCE_AUTOMATION_RULES } from "@/components/blocks/jira-work-item/team-eu26/data/team-eu-automation-rules";
import { ProjectButterDetailsFields } from "@/components/blocks/jira-work-item/project-butter/details-fields";
import { DevelopmentPanel } from "@/components/blocks/development-panel/development-panel";
import { ProjectButterDevelopmentJourney, type ProjectButterDevelopmentJourneyProps } from "@/components/blocks/jira-work-item/project-butter/project-butter-development-journey";
import { PROJECT_BUTTER_DETAIL_FIELDS, PROJECT_BUTTER_REQUIRED_DETAIL_FIELDS, type ProjectButterDetailFieldId } from "@/components/blocks/jira-work-item/project-butter/details-model";
import { ProjectButterSuggestionPanel } from "@/components/blocks/jira-work-item/project-butter/suggestion-panel";
import { useSuggestionTargetField } from "@/components/blocks/jira-work-item/project-butter/suggestion-targets";
import type { ProjectButterSuggestionProfile } from "@/components/blocks/jira-work-item/project-butter/suggestion-model";
import { useProjectButterSuggestionFill } from "@/components/blocks/jira-work-item/project-butter/use-suggestion-fill";
import { ProjectButterSortablePanel } from "@/components/blocks/jira-work-item/project-butter/project-butter-sortable-panel";
import { ProjectButterExpandControl } from "@/components/blocks/jira-work-item/project-butter/project-butter-expand-control";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { reorderProjectButterPanels, type ProjectButterPanelId } from "@/components/blocks/jira-work-item/project-butter/panel-order";

const TITLES: Record<ProjectButterPanelId, string> = { details: "Details", development: "Development", automation: "Automation", apps: "Apps" };

export function ProjectButterDetails({ agentField, agentFieldHasSessions = false, code = "VITA-1", content, developmentJourney, empty, onDescriptionSuggested, onPanelOrderChange, panelOrder, renderSuggestions, sidePanel, suggestion = false, suggestionProfile = "default" }: Readonly<{
	agentField?: ReactNode;
	agentFieldHasSessions?: boolean;
	code?: string;
	content: ProjectButterContent;
	developmentJourney?: ProjectButterDevelopmentJourneyProps;
	empty: boolean;
	onDescriptionSuggested?: (text: string) => void;
	onPanelOrderChange: (order: ProjectButterPanelId[]) => void;
	panelOrder: ProjectButterPanelId[];
	renderSuggestions?: React.ComponentProps<typeof ProjectButterSuggestionPanel>["renderSuggestions"];
	sidePanel: boolean;
	suggestion?: boolean;
	suggestionProfile?: ProjectButterSuggestionProfile;
}>) {
	const id = useId();
	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
	const [detailsOpen, setDetailsOpen] = useState(true);
	const [moreFields, setMoreFields] = useState(false);
	const [recentRuns, setRecentRuns] = useState(false);
	const [automationOpen, setAutomationOpen] = useState(false);
	const expandDetails = () => {
		setDetailsOpen(true);
		setMoreFields(true);
		return !detailsOpen || !moreFields;
	};
	// A suggestion previewed in a field the collapsed panel hides (past its first two) opens the panel, so the preview
	// and anything anchored to it, such as the Inline toolbar, have a field on screen to sit in.
	const previewField = useSuggestionTargetField();
	const shownCollapsed = content.detailFields.order.filter((field) => field !== "status" && field !== "agents" && !content.detailFields.hidden.includes(field)).slice(0, 2);
	const previewHidden = previewField !== null && (content.detailFields.order as readonly string[]).includes(previewField) && !(shownCollapsed as readonly string[]).includes(previewField);
	if (previewHidden && (!detailsOpen || !moreFields)) expandDetails();
	const fill = useProjectButterSuggestionFill(content, suggestion, expandDetails, suggestionProfile, onDescriptionSuggested, !renderSuggestions);
	const order = panelOrder.filter((panel) => panel !== "apps" || !empty || sidePanel);
	function panelActions(panel: ProjectButterPanelId) {
		if (panel === "apps" || panel === "development") return null;
		return <DropdownMenu><DropdownMenuTrigger render={<Button aria-label={`More ${panel} actions`} className="[&_svg]:text-icon-subtle aria-expanded:[&_svg]:text-icon-subtle" size="icon-compact" type="button" variant="ghost" />}><ShowMoreHorizontalIcon label="" size="small" /></DropdownMenuTrigger><DropdownMenuContent align="end" positionerClassName="z-[650]">
			{panel === "details" ? <><DropdownMenuCheckboxItem checked={moreFields} onCheckedChange={setMoreFields}>Show more fields</DropdownMenuCheckboxItem><DropdownMenuSeparator /><DropdownMenuGroup><DropdownMenuLabel>Visible fields</DropdownMenuLabel>{content.detailFields.order.filter((field): field is ProjectButterDetailFieldId => field !== "agents" && !PROJECT_BUTTER_REQUIRED_DETAIL_FIELDS.includes(field)).map((field) => <DropdownMenuCheckboxItem checked={!content.detailFields.hidden.includes(field)} key={field} onCheckedChange={(checked) => { content.setDetailFields((current) => ({ ...current, hidden: checked ? current.hidden.filter((hidden) => hidden !== field) : [...current.hidden, field] })); if (checked) setMoreFields(true); }}>{PROJECT_BUTTER_DETAIL_FIELDS[field]}</DropdownMenuCheckboxItem>)}</DropdownMenuGroup></> : panel === "automation" ? <DropdownMenuItem onSelect={() => { setAutomationOpen(true); setRecentRuns(true); }}>Recent run rules</DropdownMenuItem> : null}
		</DropdownMenuContent></DropdownMenu>;
	}
	return (
		<aside aria-label="Work item details" className="min-w-0">
			{suggestion ? <ProjectButterSuggestionPanel fill={fill} onOpenReview={expandDetails} profile={suggestionProfile} renderSuggestions={renderSuggestions} showIntroLoading={suggestionProfile === "payments"} /> : null}
			<div className={cn("relative", suggestion && !renderSuggestions && "[&_[data-field-id]]:scroll-mt-20")} data-project-butter-suggestion-fields={fill.columnId}>
			<DndContext collisionDetection={closestCenter} id={id} onDragEnd={({ active, over }) => onPanelOrderChange(reorderProjectButterPanels(panelOrder, active.id, over?.id ?? null))} sensors={sensors}>
				<SortableContext items={order} strategy={verticalListSortingStrategy}>
					<div className={cn("flex min-w-0 flex-col", sidePanel ? "gap-6" : "gap-4")}>
						{order.map((panel) => <ProjectButterSortablePanel actions={panelActions(panel)} contentClassName={!sidePanel && (panel === "automation" || panel === "apps") ? "pb-2" : undefined} defaultOpen={panel === "details" || panel === "development"} footer={panel === "details" ? <ProjectButterExpandControl ariaLabel={moreFields ? "Show less details" : "Show more details"} expanded={moreFields} label={moreFields ? "Show less" : "Show more"} onClick={() => setMoreFields((value) => !value)} /> : null} id={panel} key={panel} onOpenChange={panel === "details" ? setDetailsOpen : panel === "automation" ? setAutomationOpen : undefined} open={panel === "details" ? detailsOpen : panel === "automation" ? automationOpen : undefined} renderPanel={panel === "development" ? (dragHandle) => developmentJourney ? <ProjectButterDevelopmentJourney {...developmentJourney} headerExtra={dragHandle} surface={sidePanel ? "inline" : "card"} workItem={{ code, summary: content.summary, description: content.description }} /> : <DevelopmentPanel headerExtra={dragHandle} surface={sidePanel ? "inline" : "card"} workItem={{ code, summary: content.summary, description: content.description }} /> : undefined} sidePanel={sidePanel} title={TITLES[panel]}>
							{panel === "details" ? <ProjectButterDetailsFields agentField={agentField} agentFieldHasSessions={agentFieldHasSessions} animateExpansion={!previewHidden} content={content} empty={empty} expanded={moreFields} cursor={fill.cursor} fieldReveals={fill.fieldReveals} reflow={fill.running} /> : panel === "automation" ? <><div aria-hidden={recentRuns || undefined} className={recentRuns ? "hidden" : undefined} inert={recentRuns ? true : undefined}><AutomationRuleList rules={TEAM_EU_REFERENCE_AUTOMATION_RULES} /><button className="-mx-2 flex h-8 w-[calc(100%+1rem)] items-center justify-between rounded-md px-2 text-left text-sm text-text hover:bg-bg-neutral-subtle-hovered focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={() => setRecentRuns(true)} type="button"><span>Recent run rules</span><ChevronRightIcon label="" size="small" /></button><SetToRecurRow compact /></div>{recentRuns ? <div className="-mx-2"><TeamEuRecentAutomationRuns backLabel="Back to automation" onBack={() => setRecentRuns(false)} rules={TEAM_EU_REFERENCE_AUTOMATION_RULES} /></div> : null}</> : panel === "apps" ? <TeamEuAppsList className="-mx-2 px-0 pb-0" renderBody={(app) => `Work item information from ${app} appears here.`} /> : null}
						</ProjectButterSortablePanel>)}
					</div>
				</SortableContext>
			</DndContext>
			</div>
		</aside>
	);
}
