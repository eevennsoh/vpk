"use client";

import {
	Agent,
	AgentConfigFields,
	AgentContent,
} from "@/components/blocks/skill-config";
import {
	SkillProfileCover,
	SkillProfileMeta,
	useSkillMdDraft,
} from "@/components/blocks/skill-directory/components/skill-md-editor";
import { DEFAULT_SKILLS, type SkillDirectorySkill } from "@/app/data/directory/skills";
import { cn } from "@/lib/utils";

const SURFACE_CLASSNAME = "min-h-[760px] w-full";

const SAMPLE_SKILL: SkillDirectorySkill =
	DEFAULT_SKILLS.find((skill) => skill.id === "design-landing-page") ?? DEFAULT_SKILLS[0];

const EMPTY_SKILL: SkillDirectorySkill = {
	id: "untitled-skill",
	name: "Untitled skill",
	description: "Describe when this skill should be used and what it does.",
	icon: "page",
	source: "custom",
	collectionId: "custom",
	companyId: "you",
	publisherName: "Venn",
	createdBy: "Venn",
	addedBy: "You",
	verified: false,
};

/**
 * Skill-config showcase: the same SKILL.md-standard editing experience as the
 * skill-directory detail view — a globe cover, an editable name + human
 * description, the in-editor frontmatter card, and a markdown body. No bottom
 * apps panel (apps are referenced via the editor's `/` command). State is the
 * shared {@link useSkillMdDraft} hook; the detail view adds the Save/Cancel layer.
 */
function SkillConfigDemoScreen({ skill, idPrefix }: Readonly<{ skill: SkillDirectorySkill; idPrefix: string }>) {
	const { config, handleTextChange } = useSkillMdDraft(skill);

	return (
		<Agent className={cn(SURFACE_CLASSNAME, "flex flex-col")}>
			<AgentContent className="flex min-h-0 flex-1 flex-col">
				<AgentConfigFields
					config={config}
					idPrefix={idPrefix}
					showConfigToolbar={false}
					frontmatter={{ enabled: true }}
					onTextChange={handleTextChange}
					profileCover={<SkillProfileCover skill={skill} />}
					profileMetaSlot={<SkillProfileMeta skill={skill} />}
				/>
			</AgentContent>
		</Agent>
	);
}

export function SkillConfigDemoFull() {
	return <SkillConfigDemoScreen skill={SAMPLE_SKILL} idPrefix="skill-config-demo-full" />;
}

export function SkillConfigDemoEmpty() {
	return <SkillConfigDemoScreen skill={EMPTY_SKILL} idPrefix="skill-config-demo-empty" />;
}

export default function SkillConfigDemo() {
	return <SkillConfigDemoFull />;
}
