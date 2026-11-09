import type { ComponentDetail } from "@/app/data/component-detail-types";

export const SKILL_SELECTOR_DETAIL: ComponentDetail = {
	description: "Searchable, directory-backed skill selector with the same interaction and visual design as Agent Selector.",
	importStatement: `import { SkillSelector } from "@/components/blocks/skill-selector";`,
	usage: `import { SkillSelector } from "@/components/blocks/skill-selector";

<SkillSelector
  selectionMode="single"
  onSkillToggle={(skillId) => console.log(skillId)}
  onBrowseSkills={() => console.log("browse skills")}
  onCreateSkill={() => console.log("create skill")}
/>`,
	demoLayout: { previewHeight: "fixed", examplesContentWidth: "full" },
	examples: [
		{
			title: "Standalone picker",
			description: "The selector prefilled from the Skill Directory catalog.",
			demoSlug: "skill-selector-demo-standalone",
		},
	],
	props: [
		{
			name: "skills",
			type: "readonly SkillDirectorySkill[]",
			description: "Skills to render. Defaults to the complete Skill Directory catalog.",
		},
		{
			name: "pinnedSkillIds",
			type: "readonly string[]",
			description: "Controlled pinned skill ids. Pinned skills move into a separate Pinned section.",
		},
		{
			name: "onPinnedSkillIdsChange",
			type: "(skillIds: readonly string[]) => void",
			description: "Called when a skill is pinned or unpinned.",
		},
		{
			name: "selectedSkillIds",
			type: "readonly string[]",
			description: "Selected skill ids. Selected skills remain pinned before unselected skills.",
		},
		{
			name: "onSkillToggle",
			type: "(skillId: string) => void",
			description: "Called when a skill row is selected.",
		},
		{
			name: "onBrowseSkills",
			type: "() => void",
			description: "Shows and handles the Browse skills footer action.",
		},
		{
			name: "onCreateSkill",
			type: "() => void",
			description: "Shows and handles the Create skill footer action.",
		},
		{
			name: "selectionMode",
			type: '"multiple" | "single"',
			default: '"multiple"',
			description: "Controls whether selected rows use multi-select checkbox semantics.",
		},
	],
};
