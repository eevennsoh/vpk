"use client";

import CalendarIcon from "@atlaskit/icon/core/calendar";
import WarningIcon from "@atlaskit/icon/core/warning";
import DataFormulaIcon from "@atlaskit/icon-lab/core/data-formula";
import { DateRowField, PersonRowField, PriorityRowField } from "@/components/blocks/jira-work-item/team-eu26/components/detail-field-editors";
import { TEAM_EU26_PEOPLE } from "@/components/blocks/jira-work-item/team-eu26/data/team-eu26-vita-one";
import { DetailsOptionField } from "@/components/blocks/jira-work-item/project-butter/details-option-field";
import { PROJECT_BUTTER_CAMPAIGN_MARKETS, PROJECT_BUTTER_DETAIL_FIELDS, PROJECT_BUTTER_DETAIL_OPTIONS, projectButterCostPerReach, type ProjectButterDetailFieldId, type ProjectButterDetailFields } from "@/components/blocks/jira-work-item/project-butter/details-model";
import { ProjectButterStatus } from "@/components/blocks/jira-work-item/project-butter/project-butter-status";
import { projectButterPersonAvatar } from "@/components/blocks/jira-work-item/project-butter/people";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import { Calendar } from "@/components/ui/calendar";
import { InlineEdit } from "@/components/ui/inline-edit";

const PEOPLE = Object.values(TEAM_EU26_PEOPLE).map((person) => ({ ...person, avatarUrl: person.name === "Automatic" ? undefined : projectButterPersonAvatar(person.name) }));

export function ProjectButterDetailFieldValue({ content, id }: Readonly<{ content: ProjectButterContent; id: ProjectButterDetailFieldId }>) {
	const fields = content.detailFields;
	function setField<K extends keyof ProjectButterDetailFields>(key: K, value: ProjectButterDetailFields[K]) {
		content.setDetailFields((current) => ({ ...current, [key]: value }));
	}
	if (id === "status") return <ProjectButterStatus appearance="field" content={content} />;
	if (id === "assignee") return <PersonRowField ariaLabel="Change assignee" onChange={content.setAssignee} people={PEOPLE} placeholder="Automatic" value={content.assignee.name === "Automatic" ? null : content.assignee} />;
	if (id === "priority") return <PriorityRowField onChange={content.setPriority} value={content.priority} />;
	if (id === "dueDate") return <span className="flex min-w-0 items-center gap-1"><DateRowField ariaLabel="Change due date" CalendarComponent={Calendar} dateValueMode="utc-date" leadingVisual={<CalendarIcon label="" size="small" />} onChange={content.setDueDate} placeholder="Add due date" value={content.dueDate} />{content.dueDate && content.dueDate.getTime() < Date.UTC(2026, 9, 28) ? <span className="shrink-0 text-icon-danger"><WarningIcon label="Overdue" size="small" /></span> : null}</span>;
	if (id === "reporter") return <PersonRowField ariaLabel="Change reporter" onChange={content.setReporter} people={PEOPLE} placeholder="Add reporter" value={content.reporter} />;
	if (id === "costPerReach") return <span className="flex min-h-8 items-center gap-2 text-sm text-text-subtle"><DataFormulaIcon label="" size="small" /><span>{projectButterCostPerReach(fields) || "Calculated from budget and reach"}</span></span>;
	if (id === "campaignRegion") return <div className="flex min-w-0 gap-2"><DetailsOptionField label="region" onChange={([region]) => setField("campaignRegion", { region, market: "" })} options={Object.keys(PROJECT_BUTTER_CAMPAIGN_MARKETS)} values={fields.campaignRegion.region ? [fields.campaignRegion.region] : []} />{fields.campaignRegion.region ? <DetailsOptionField label="market" onChange={([market]) => setField("campaignRegion", { ...fields.campaignRegion, market })} options={PROJECT_BUTTER_CAMPAIGN_MARKETS[fields.campaignRegion.region] ?? []} values={fields.campaignRegion.market ? [fields.campaignRegion.market] : []} /> : null}</div>;
	if (id === "parent" || id === "fixVersion" || id === "costCenter" || id === "assetObject") return <DetailsOptionField label={PROJECT_BUTTER_DETAIL_FIELDS[id]} onChange={([value]) => setField(id, value)} options={PROJECT_BUTTER_DETAIL_OPTIONS[id]} tagAppearance={id === "parent" ? "parent" : id === "assetObject" ? "asset" : "plain"} values={fields[id] ? [fields[id]] : []} />;
	if (id === "labels" || id === "components" || id === "targetPlatforms") return <DetailsOptionField label={PROJECT_BUTTER_DETAIL_FIELDS[id]} multiple onChange={(values) => setField(id, values)} options={PROJECT_BUTTER_DETAIL_OPTIONS[id]} tagAppearance={id === "labels" ? "labels" : "plain"} values={fields[id]} />;
	return <InlineEdit cancelButtonLabel={`Cancel ${PROJECT_BUTTER_DETAIL_FIELDS[id].toLowerCase()} changes`} confirmButtonLabel={`Save ${PROJECT_BUTTER_DETAIL_FIELDS[id].toLowerCase()}`} editButtonLabel={`Change ${PROJECT_BUTTER_DETAIL_FIELDS[id].toLowerCase()}`} inputProps={{ "aria-label": PROJECT_BUTTER_DETAIL_FIELDS[id], isCompact: true }} multiline={id === "acceptanceCriteria"} onConfirm={(value) => setField(id, value.trim())} placeholder={`Add ${PROJECT_BUTTER_DETAIL_FIELDS[id].toLowerCase()}`} readViewClassName="min-h-8 h-auto px-0 py-1 hover:bg-transparent" textareaProps={{ "aria-label": PROJECT_BUTTER_DETAIL_FIELDS[id] }} value={fields[id]} />;
}
