"use client";

import SkillIcon from "@atlaskit/icon-lab/core/skill";
import CheckCircleIcon from "@atlaskit/icon/core/check-circle";

import {
	DEFAULT_SKILLS,
	getSkillById,
	getSkillCollectionId,
	getSkillIcon,
} from "@/app/data/directory/skills";
import { SkillTag } from "@/components/ui-custom/skill-tag";
import type { SkillInvocationPayload } from "../lib/skill-intercept";

/**
 * Inline "Skill invoked" card rendered above the assistant reply (positioned via
 * `getWidgetPosition` → "before-content"). The scripted payload carries only the
 * `skillId` plus the trigger/input/output strings; the skill's display name,
 * glyph, and collection colour are resolved from the shared catalog
 * (`DEFAULT_SKILLS`) so the card always matches the real skill identity.
 */
function MetaRow({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
	return (
		<>
			<dt className="text-text-subtlest">{label}</dt>
			<dd className="min-w-0 text-text-subtle">{children}</dd>
		</>
	);
}

export function SkillInvocationCard({
	skillId,
	triggerLabel,
	inputSummary,
	outputSummary,
}: Readonly<SkillInvocationPayload>) {
	const skill = getSkillById(DEFAULT_SKILLS, skillId);
	const skillName = skill?.name ?? skillId;
	const skillGlyph = getSkillIcon(skill?.icon ?? "page");
	const tagColor = skill ? getSkillCollectionId(skill) : "default";

	return (
		<div
			className="rounded-md border border-border bg-surface-raised p-3"
			data-testid="skill-invocation-card"
		>
			<div className="flex items-center gap-1.5 text-icon-subtle">
				<SkillIcon label="" size="small" color="currentColor" />
				<span className="text-xs font-semibold text-text-subtlest">
					Skill invoked
				</span>
			</div>
			<div className="mt-2 flex items-center">
				<SkillTag color={tagColor} icon={skillGlyph}>
					{skillName}
				</SkillTag>
			</div>
			<dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs leading-4">
				<MetaRow label="Trigger">{triggerLabel}</MetaRow>
				<MetaRow label="Input">{inputSummary}</MetaRow>
				<MetaRow label="Output">
					<span className="flex min-w-0 items-center gap-1 text-text">
						<span className="shrink-0 text-icon-success">
							<CheckCircleIcon label="" size="small" color="currentColor" />
						</span>
						<span className="min-w-0 truncate">{outputSummary}</span>
					</span>
				</MetaRow>
			</dl>
		</div>
	);
}
