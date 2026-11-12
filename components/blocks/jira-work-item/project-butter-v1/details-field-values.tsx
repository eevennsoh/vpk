"use client";

import CalendarIcon from "@atlaskit/icon/core/calendar";
import WarningIcon from "@atlaskit/icon/core/warning";
import DataFormulaIcon from "@atlaskit/icon-lab/core/data-formula";
import { DateRowField, PersonLabel, PersonRowField, PriorityLabel, PriorityRowField } from "@/components/blocks/jira-work-item/team-eu26/components/detail-field-editors";
import { TEAM_EU26_PEOPLE } from "@/components/blocks/jira-work-item/team-eu26/data/team-eu26-vita-one";
import { DetailsOptionField } from "@/components/blocks/jira-work-item/project-butter-v1/details-option-field";
import { PROJECT_BUTTER_CAMPAIGN_MARKETS, PROJECT_BUTTER_DETAIL_FIELDS, PROJECT_BUTTER_DETAIL_OPTIONS, projectButterCostPerReach, type ProjectButterDetailFieldId, type ProjectButterDetailFields } from "@/components/blocks/jira-work-item/project-butter-v1/details-model";
import { ProjectButterStatus } from "@/components/blocks/jira-work-item/project-butter-v1/project-butter-status";
import { PROJECT_BUTTER_UNASSIGNED, projectButterPersonAvatar } from "@/components/blocks/jira-work-item/project-butter-v1/people";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter-v1/use-project-butter-content";
import { Calendar } from "@/components/ui/calendar";
import { InlineEdit } from "@/components/ui/inline-edit";
import { ArtifactLabelsField } from "@/components/blocks/artifact-pane/artifact-labels-field";
import { ArtifactParentField } from "@/components/blocks/artifact-pane/artifact-parent-field";
import { AvatarUnassigned } from "@/components/ui/avatar";
import { IconTile } from "@/components/ui/icon-tile";

const PEOPLE = Object.values(TEAM_EU26_PEOPLE).filter((person) => person.name !== "Automatic").map((person) => ({ ...person, avatarUrl: projectButterPersonAvatar(person.name) }));

export function ProjectButterDetailFieldValue({ content, id }: Readonly<{ content: ProjectButterContent; id: ProjectButterDetailFieldId }>) {
	const fields = content.detailFields;
	function setField<K extends keyof ProjectButterDetailFields>(key: K, value: ProjectButterDetailFields[K]) {
		content.setDetailFields((current) => ({ ...current, [key]: value }));
	}
	if (id === "status") return <ProjectButterStatus appearance="field" content={content} />;
	if (id === "assignee") return <PersonRowField ariaLabel="Change assignee" onChange={content.setAssignee} people={[PROJECT_BUTTER_UNASSIGNED, ...PEOPLE]} placeholder="Unassigned" renderValue={(person) => person.name === "Unassigned" ? <span className="flex items-center gap-2"><AvatarUnassigned label="" size="xs" /><span>Unassigned</span></span> : <PersonLabel avatarSize="xs" person={person} />} value={content.assignee} />;
	if (id === "priority") return <PriorityRowField onChange={content.setPriority} renderValue={(value) => <span className="[&_[data-slot=icon-tile]]:size-4"><PriorityLabel iconSize="small" value={value} /></span>} value={content.priority} />;
	if (id === "dueDate") {
		const overdue = Boolean(content.dueDate && content.dueDate.getTime() < Date.UTC(2026, 9, 28));
		return <DateRowField ariaLabel={overdue ? "Change due date, overdue" : "Change due date"} CalendarComponent={Calendar} dateValueMode="utc-date" leadingVisual={<IconTile aria-hidden as="span" className="text-icon-subtle" icon={<CalendarIcon label="" size="small" />} label="" size="xxsmall" variant="transparent" />} onChange={content.setDueDate} placeholder="Add due date" trailingVisual={overdue ? <IconTile aria-hidden as="span" className="text-icon-danger" icon={<WarningIcon label="" size="small" />} label="" size="xxsmall" variant="transparent" /> : null} value={content.dueDate} />;
	}
	if (id === "reporter") return <PersonRowField ariaLabel="Change reporter" onChange={content.setReporter} people={PEOPLE} placeholder="Add reporter" renderValue={(person) => <PersonLabel avatarSize="xs" person={person} />} value={content.reporter} />;
	if (id === "costPerReach") return <span className="flex min-h-8 items-center gap-2 text-sm text-text-subtle"><IconTile aria-hidden as="span" className="text-icon-subtle" icon={<DataFormulaIcon label="" size="small" />} label="" size="xxsmall" variant="transparent" /><span>{projectButterCostPerReach(fields) || "Calculated from budget and reach"}</span></span>;
	if (id === "campaignRegion") return <div className="flex min-w-0 gap-2"><DetailsOptionField label="region" onChange={([region]) => setField("campaignRegion", { region, market: "" })} options={Object.keys(PROJECT_BUTTER_CAMPAIGN_MARKETS)} values={fields.campaignRegion.region ? [fields.campaignRegion.region] : []} />{fields.campaignRegion.region ? <DetailsOptionField label="market" onChange={([market]) => setField("campaignRegion", { ...fields.campaignRegion, market })} options={PROJECT_BUTTER_CAMPAIGN_MARKETS[fields.campaignRegion.region] ?? []} values={fields.campaignRegion.market ? [fields.campaignRegion.market] : []} /> : null}</div>;
	if (id === "parent") {
		const options = [...new Set([...(fields.parent ? [fields.parent] : []), ...PROJECT_BUTTER_DETAIL_OPTIONS.parent])].map((value) => {
			const separator = value.indexOf(" ");
			return { key: value, summary: separator < 0 ? value : value.slice(separator + 1) };
		});
		return <ArtifactParentField onChange={(value) => setField("parent", value)} options={options} value={fields.parent || null} />;
	}
	if (id === "labels") return <ArtifactLabelsField hideSelected onChange={(values) => setField("labels", values)} options={PROJECT_BUTTER_DETAIL_OPTIONS.labels} value={fields.labels} />;
	if (id === "fixVersion" || id === "costCenter" || id === "assetObject") return <DetailsOptionField label={PROJECT_BUTTER_DETAIL_FIELDS[id]} onChange={([value]) => setField(id, value)} options={PROJECT_BUTTER_DETAIL_OPTIONS[id]} tagAppearance={id === "assetObject" ? "asset" : "plain"} values={fields[id] ? [fields[id]] : []} />;
	if (id === "components" || id === "targetPlatforms") return <DetailsOptionField label={PROJECT_BUTTER_DETAIL_FIELDS[id]} multiple onChange={(values) => setField(id, values)} options={PROJECT_BUTTER_DETAIL_OPTIONS[id]} values={fields[id]} />;
	return <InlineEdit cancelButtonLabel={`Cancel ${PROJECT_BUTTER_DETAIL_FIELDS[id].toLowerCase()} changes`} confirmButtonLabel={`Save ${PROJECT_BUTTER_DETAIL_FIELDS[id].toLowerCase()}`} editButtonLabel={`Change ${PROJECT_BUTTER_DETAIL_FIELDS[id].toLowerCase()}`} inputProps={{ "aria-label": PROJECT_BUTTER_DETAIL_FIELDS[id], isCompact: true, ...(id === "storyPoints" ? { type: "number", min: 0, step: "any" } : {}) }} onConfirm={(value) => setField(id, value.trim())} placeholder={`Add ${PROJECT_BUTTER_DETAIL_FIELDS[id].toLowerCase()}`} readViewClassName="min-h-8 h-auto px-0 py-1 hover:bg-transparent" validate={id === "storyPoints" ? (value) => value.trim() && (!Number.isFinite(Number(value)) || Number(value) < 0) ? "Enter a non-negative number" : undefined : undefined} value={fields[id]} />;
}
