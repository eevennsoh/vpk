"use client";

import { use } from "react";
import { motion, useReducedMotion } from "motion/react";

import CalendarIcon from "@atlaskit/icon/core/calendar";
import WarningIcon from "@atlaskit/icon/core/warning";
import DataFormulaIcon from "@atlaskit/icon-lab/core/data-formula";
import { DateRowField, PersonLabelAvatar, PersonRowField, PriorityLabel, PriorityRowField } from "@/components/blocks/jira-work-item/team-eu26/components/detail-field-editors";
import type { AgentPlannerAssignee } from "@/components/blocks/jira-work-item/data/planner-state";
import { DetailsOptionField } from "@/components/blocks/jira-work-item/project-butter/details-option-field";
import { PROJECT_BUTTER_CAMPAIGN_MARKETS, PROJECT_BUTTER_DETAIL_FIELDS, PROJECT_BUTTER_DETAIL_OPTIONS, projectButterCostPerReach, type ProjectButterDetailFieldId, type ProjectButterDetailFields } from "@/components/blocks/jira-work-item/project-butter/details-model";
import { ProjectButterStatus } from "@/components/blocks/jira-work-item/project-butter/project-butter-status";
import { PROJECT_BUTTER_ASSIGNEES, PROJECT_BUTTER_PEOPLE as PEOPLE } from "@/components/blocks/jira-work-item/project-butter/assignee-people";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import { Calendar } from "@/components/ui/calendar";
import { InlineEdit } from "@/components/ui/inline-edit";
import { ArtifactLabelsField } from "@/components/blocks/artifact-pane/artifact-labels-field";
import { ArtifactParentField } from "@/components/blocks/artifact-pane/artifact-parent-field";
import { AvatarUnassigned } from "@/components/ui/avatar";
import { AVATAR_ENTER_FROM } from "@/components/ui/avatar-enter";
import { IconTile } from "@/components/ui/icon-tile";
import { cn } from "@/lib/utils";
import { DETAIL_VALUE_HANDOFF } from "./details-rail";
import { SuggestionLabelReveal, SuggestionPreviewLabel, useSuggestionPreviewText } from "./suggestion-targets";
import { projectButterPersonAvatar } from "./people";

const DETAIL_DUE_DATE_ICON = <IconTile aria-hidden as="span" className="text-icon-subtle" icon={<CalendarIcon label="" />} iconSize="medium" label="" size="small" variant="transparent" />;
const DETAIL_EMPTY_DUE_DATE_ICON = <IconTile aria-hidden as="span" className="text-icon-subtlest" icon={<CalendarIcon label="" />} iconSize="medium" label="" size="small" variant="transparent" />;
const DETAIL_UNASSIGNED_AVATAR = <AvatarUnassigned animate={false} label="" size="sm" />;

function PersonValue({ field, person }: Readonly<{ field: "assignee" | "reporter"; person: AgentPlannerAssignee }>) {
	const reveal = use(SuggestionLabelReveal);
	const reduced = useReducedMotion();
	const isAssignee = field === "assignee";
	// A suggested person previewed here shows with their own avatar, not the current value's (often the placeholder).
	const previewName = useSuggestionPreviewText(field);
	const previewPerson: AgentPlannerAssignee | null = previewName
		? PEOPLE.find((candidate) => candidate.name === previewName) ?? { name: previewName, avatarUrl: projectButterPersonAvatar(previewName) }
		: null;
	const personAvatar = <PersonLabelAvatar animate={false} person={person} size="sm" />;
	const avatar = isAssignee && !reduced ? (
		<motion.span animate={{ opacity: 1, scale: 1 }} className="inline-flex shrink-0" initial={{ ...AVATAR_ENTER_FROM, scale: 0.6 }} style={{ willChange: "transform, opacity" }} transition={DETAIL_VALUE_HANDOFF}>
			{personAvatar}
		</motion.span>
	) : personAvatar;
	return (
		<span className="flex w-full min-w-0 items-center gap-2">
			{previewPerson ? <PersonLabelAvatar animate={false} key={previewPerson.name} person={previewPerson} size="sm" /> : person.name === "Unassigned" || (isAssignee && reveal) ? DETAIL_UNASSIGNED_AVATAR : avatar}
			<SuggestionPreviewLabel field={field}>{person.name}</SuggestionPreviewLabel>
		</span>
	);
}

export function ProjectButterDetailFieldValue({ content, id }: Readonly<{ content: ProjectButterContent; id: ProjectButterDetailFieldId }>) {
	const fields = content.detailFields;
	function setField<K extends keyof ProjectButterDetailFields>(key: K, value: ProjectButterDetailFields[K]) {
		content.setDetailFields((current) => ({ ...current, [key]: value }));
	}
	if (id === "status") return <ProjectButterStatus appearance="field" content={content} />;
	if (id === "assignee") return <PersonRowField ariaLabel="Change assignee" compact onChange={content.setAssignee} people={[...PROJECT_BUTTER_ASSIGNEES, ...(content.defaultAssignee && !PEOPLE.some((person) => person.name === content.defaultAssignee?.name) ? [content.defaultAssignee] : [])]} placeholder="Unassigned" renderValue={(person) => <PersonValue field="assignee" person={person} />} value={content.assignee} />;
	if (id === "priority") return <PriorityRowField onChange={content.setPriority} renderValue={(value) => <PriorityLabel iconSize="medium" value={value} />} value={content.priority} />;
	if (id === "dueDate") {
		const overdue = Boolean(content.dueDate && content.dueDate.getTime() < Date.UTC(2026, 9, 28));
		return <DateRowField ariaLabel={overdue ? "Change due date, overdue" : "Change due date"} CalendarComponent={Calendar} dateValueMode="utc-date" leadingVisual={content.dueDate ? DETAIL_DUE_DATE_ICON : DETAIL_EMPTY_DUE_DATE_ICON} onChange={content.setDueDate} placeholder="Add due date" renderLabel={(label) => <SuggestionPreviewLabel fill={false} field="dueDate">{label}</SuggestionPreviewLabel>} trailingVisual={overdue ? <IconTile aria-hidden as="span" className="text-icon-danger" icon={<WarningIcon label="" />} iconSize="medium" label="" size="small" variant="transparent" /> : null} value={content.dueDate} />;
	}
	if (id === "reporter") return <PersonRowField ariaLabel="Change reporter" onChange={content.setReporter} people={PEOPLE} placeholder="Add reporter" renderValue={(person) => <PersonValue field="reporter" person={person} />} value={content.reporter} />;
	if (id === "costPerReach") return <span className="flex items-center gap-2 text-sm text-text-subtle"><IconTile aria-hidden as="span" className={projectButterCostPerReach(fields) ? "text-icon-subtle" : "text-icon-subtlest"} icon={<DataFormulaIcon label="" />} iconSize="medium" label="" size="small" variant="transparent" /><span className={projectButterCostPerReach(fields) ? undefined : "text-text-subtlest"}>{projectButterCostPerReach(fields) || "Calculated from budget and reach"}</span></span>;
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
	return <InlineEdit cancelButtonLabel={`Cancel ${PROJECT_BUTTER_DETAIL_FIELDS[id].toLowerCase()} changes`} confirmButtonLabel={`Save ${PROJECT_BUTTER_DETAIL_FIELDS[id].toLowerCase()}`} editButtonLabel={`Change ${PROJECT_BUTTER_DETAIL_FIELDS[id].toLowerCase()}`} inputProps={{ "aria-label": PROJECT_BUTTER_DETAIL_FIELDS[id], isCompact: true, ...(id === "storyPoints" ? { type: "number", min: 0, step: "any" } : {}) }} onConfirm={(value) => setField(id, value.trim())} placeholder={`Add ${PROJECT_BUTTER_DETAIL_FIELDS[id].toLowerCase()}`} readViewClassName={cn("h-auto border-0 px-0 hover:bg-transparent", !fields[id] && "[&>span:last-child]:text-text-subtlest")} validate={id === "storyPoints" ? (value) => value.trim() && (!Number.isFinite(Number(value)) || Number(value) < 0) ? "Enter a non-negative number" : undefined : undefined} value={fields[id]} />;
}
