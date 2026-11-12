import type { ComponentDetail } from "@/app/data/component-detail-types";

export const SKILL_DIRECTORY_DETAIL: ComponentDetail = {
		apiName: "SkillDirectoryDialog",
		description: "Skill-specific directory modal with Chat single-add and Studio immediate add/remove experiences plus a learn-more detail view for each skill.",
		importStatement: `import { SkillDirectoryDialog } from "@/components/blocks/skill-directory";`,
		usage: `import { SkillDirectoryDialog } from "@/components/blocks/skill-directory";
import type { SkillDirectorySkill } from "@/components/blocks/skill-directory";

const skills: SkillDirectorySkill[] = [
  {
    id: "design-landing-page",
    name: "Design landing page",
    description: "Create high-converting, visually distinctive landing pages.",
    icon: "paint-palette",
    collectionId: "custom",
    collectionDescription: "User-authored skills tailored to local workflows.",
    collectionProducts: ["Custom"],
    collectionDocsUrl: "https://www.atlassian.com/software/rovo",
    publisherName: "Venn",
    publisherAvatarSrc: "/avatar-human/maia-ma.png",
    categoryId: "content-and-communication",
    companyId: "you",
    starCount: 38,
    teammateCount: 6273,
    verified: false,
    tools: [{ id: "tool-1", name: "Tool1", icon: "page" }],
    instructions: "# Design landing page\\n\\nCreate a distinctive landing page.",
  },
];

<SkillDirectoryDialog
  open={open}
  onOpenChange={setOpen}
  skills={skills}
  selectionExperience="studio-bulk-add"
  onAddSkills={(skillIds) => console.log("add", skillIds)}
  onRemoveSkills={(skillIds) => console.log("remove", skillIds)}
  onCreateSkill={() => console.log("new skill")}
/>`,
		demoLayout: { previewHeight: "fixed" },
		examples: [
			{
				title: "Chat",
				description: "Single-select experience like /skills: clicking a card immediately adds that skill to the prompt composer.",
				demoSlug: "skill-directory-demo-standard",
			},
			{
				title: "Studio",
				description: "Studio experience: each card switch immediately adds or removes that skill from an agent.",
				demoSlug: "skill-directory-demo-experimental",
			},
		],
		props: [
			{
				name: "skills",
				type: "readonly SkillDirectorySkill[]",
				description: "Skill catalog rendered in the grid. Defaults to the bundled demo skills.",
			},
			{
				name: "variant",
				type: "\"default\" | \"experimental\"",
				default: "\"default\"",
				description: "Opt-in layout variation. The default sidebar directory remains unchanged.",
			},
			{
				name: "selectionExperience",
				type: "\"checkbox-actions\" | \"studio-bulk-add\" | \"chat-single-add\"",
				default: "\"checkbox-actions\"",
				description: "Controls card-click behavior: legacy checkbox actions, Studio immediate add/remove, or Chat single-add.",
			},
			{
				name: "sessionSkills",
				type: "readonly SkillDirectorySkill[]",
				description: "Runtime-created skills appended after the catalog.",
			},
			{
				name: "selectedSkillIds",
				type: "readonly string[]",
				description: "Controlled multi-select state for selected skill cards.",
			},
			{
				name: "defaultSelectedSkillIds",
				type: "readonly string[]",
				description: "Initial uncontrolled selected skill ids.",
			},
			{
				name: "open",
				type: "boolean",
				required: true,
				description: "Controlled dialog open state.",
			},
			{
				name: "onOpenChange",
				type: "(open: boolean) => void",
				required: true,
				description: "Called when the dialog requests an open-state change.",
			},
			{
				name: "onSelectSkill",
				type: "(skill: SkillDirectorySkill) => void",
				description: "Called when a skill card toggles selection.",
			},
			{
				name: "onSelectedSkillIdsChange",
				type: "(skillIds: readonly string[]) => void",
				description: "Called whenever the selected skill ids change.",
			},
			{
				name: "onAddSkills",
				type: "(skillIds: readonly string[], skills: readonly SkillDirectorySkill[]) => void",
				description: "Called by the selected-skills toolbar Add skills action.",
			},
			{
				name: "onCreateShareLink",
				type: "(skillIds: readonly string[], skills: readonly SkillDirectorySkill[]) => void",
				description: "Called by the selected-skills toolbar share action.",
			},
			{
				name: "onFavoriteSkills",
				type: "(skillIds: readonly string[], skills: readonly SkillDirectorySkill[]) => void",
				description: "Called by the selected-skills toolbar favorite action.",
			},
			{
				name: "onDownloadSkills",
				type: "(skillIds: readonly string[], skills: readonly SkillDirectorySkill[]) => void",
				description: "Called by the selected-skills toolbar download action.",
			},
			{
				name: "onOpenSkill",
				type: "(skill: SkillDirectorySkill) => void",
				description: "Called by the skill info page Open button group.",
			},
			{
				name: "onCreateSkill",
				type: "() => void",
				description: "Called by the New skill button.",
			},
			{
				name: "primaryItems",
				type: "readonly SkillDirectoryPrimaryItem[]",
				description: "Sectionless nav rows above the category group (All skills, Favourite skills, Your skills).",
			},
			{
				name: "sidebarGroups",
				type: "readonly SkillDirectorySidebarGroup[]",
				description: "Optional left-nav grouping override. Defaults to Category and By companies groups.",
			},
			{
				name: "title",
				type: "string",
				description: "Optional dialog title. Defaults to “Browse all”.",
			},
			{
				name: "agents / sessionAgents / onSelectAgent",
				type: "compatibility aliases",
				description: "Legacy Agent Directory-style props are still accepted and normalized into skill records.",
			},
		],
	};
