const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

function readProjectFile(relativePath) {
	return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("Skill Directory is exposed as a website block", () => {
	assert.match(
		readProjectFile("app/data/components.ts"),
		/blockComponent\("skill-directory", "Skill Directory"\)/u,
	);
	assert.match(
		readProjectFile("app/data/component-manifest.ts"),
		/blockComponent\("skill-directory", "Skill Directory"\)/u,
	);
	assert.match(
		readDetailCategorySource("blocks"),
		/import \{ SkillDirectoryDialog \} from "@\/components\/blocks\/skill-directory";/u,
	);
	assert.match(
		readWebsiteRegistrySource(),
		/"skill-directory": dynamic\(\s*\(\) => import\("\.\/demos\/blocks\/skill-directory-demo"\)/u,
	);
});

test("Skill Directory docs demo starts closed until the trigger is clicked", () => {
	assert.match(
		readProjectFile("components/blocks/skill-directory/page.tsx"),
		/const \[open, setOpen\] = useState\(false\);/u,
	);
});

test("Skill Directory owns a skill-specific modal instead of wrapping AgentBrowserDialog", () => {
	const source = readProjectFile("components/blocks/skill-directory/components/skill-directory.tsx");

	assert.doesNotMatch(source, /AgentBrowserDialog/u);
	assert.match(source, /<DialogContent/u);
	assert.match(source, /sm:max-w-\[1200px\]/u);
	assert.match(source, /md:grid-cols-\[280px_minmax\(0,1fr\)\]/u);
	assert.match(source, /title = "Browse all"/u);
});

test("Skill Directory uses the Agent Directory dialog header style", () => {
	const source = readProjectFile("components/blocks/skill-directory/components/skill-directory.tsx");

	assert.match(
		source,
		/<div className="flex items-center justify-between px-6 pt-6 pb-4">[\s\S]*<DialogTitle className="text-base font-medium leading-5 text-text">[\s\S]*\{title\}[\s\S]*<\/DialogTitle>[\s\S]*<div className="flex items-center gap-2">[\s\S]*\{onCreateSkill \? \([\s\S]*<Button onClick=\{onCreateSkill\} type="button">[\s\S]*New skill[\s\S]*<\/Button>[\s\S]*\) : null\}[\s\S]*<DialogClose render=\{<Button variant="ghost" size="icon" \/>\}>[\s\S]*<CrossIcon label="" \/>[\s\S]*<span className="sr-only">Close<\/span>[\s\S]*<\/DialogClose>/u,
	);
});

test("Skill Directory exposes canonical skill props and legacy agent compatibility", () => {
	const source = readProjectFile("components/blocks/skill-directory/components/skill-directory.tsx");
	const indexSource = readProjectFile("components/blocks/skill-directory/index.ts");

	assert.match(source, /export interface SkillDirectoryDialogProps/u);
	assert.match(source, /skills\?: readonly SkillDirectorySkill\[\]/u);
	assert.match(source, /sessionSkills\?: readonly SkillDirectorySkill\[\]/u);
	assert.match(source, /selectedSkillIds\?: readonly string\[\]/u);
	assert.match(source, /defaultSelectedSkillIds\?: readonly string\[\]/u);
	assert.match(source, /onSelectedSkillIdsChange\?: \(skillIds: readonly string\[\]\) => void/u);
	assert.match(source, /onAddSkills\?: \(skillIds: readonly string\[\], skills: readonly SkillDirectorySkill\[\]\) => void/u);
	assert.match(source, /export type SkillDirectorySelectionExperience = "checkbox-actions" \| "studio-bulk-add" \| "chat-single-add";/u);
	assert.match(source, /selectionExperience\?: SkillDirectorySelectionExperience;/u);
	assert.match(source, /agents\?: readonly SkillDirectoryAgent\[\]/u);
	assert.match(source, /sessionAgents\?: readonly SkillDirectoryAgent\[\]/u);
	assert.match(source, /normalizeAgentSkill/u);
	assert.match(indexSource, /SkillDirectoryAgent/u);
	assert.match(indexSource, /SkillDirectorySelectionExperience/u);
});

test("Skill Directory sidebar does not include Collections as a default taxonomy", () => {
	const source = readProjectFile("components/blocks/skill-directory/components/skill-directory-sidebar.tsx");
	const sidebarGroupsSource = readProjectFile("components/blocks/skill-directory/data/sidebar-groups.ts");

	assert.match(source, /const MAX_VISIBLE_TAXONOMY_ITEMS = 5;/u);
	assert.match(source, /function isTaxonomySidebarGroup/u);
	assert.match(source, /const \[showAllTaxonomyItems, setShowAllTaxonomyItems\] = useState\(false\);/u);
	assert.match(source, /showAllTaxonomyItems\s+\?\s+taxonomyItems\s+:\s+taxonomyItems\.slice\(0, MAX_VISIBLE_TAXONOMY_ITEMS\);/u);
	assert.match(source, /const hasHiddenTaxonomyItems = !showAllTaxonomyItems && taxonomyItems\.length > MAX_VISIBLE_TAXONOMY_ITEMS;/u);
	assert.doesNotMatch(source, /<div className="h-4 w-64 shrink-0" \/>/u);
	assert.doesNotMatch(source, /<div className="h-3 w-64 shrink-0" \/>/u);
	assert.match(source, /<ul className="flex w-64 flex-col">[\s\S]*visibleTaxonomyItems\.map/u);
	assert.match(source, /leading=\{<TaxonomyLeading item=\{item\} \/>\}/u);
	assert.doesNotMatch(source, /getSkillCollectionMetadata/u);
	assert.doesNotMatch(source, /collection\.iconClassName/u);
	assert.match(source, /label="Show all"/u);
	assert.match(source, /onClick=\{\(\) => setShowAllTaxonomyItems\(true\)\}/u);
	assert.match(source, /import \{ AtlassianLogo \} from "@\/components\/ui\/logo";/u);
	assert.match(source, /item\.logoName \? \([\s\S]*<AtlassianLogo name=\{item\.logoName\} size="small" themeAware label=\{item\.label\} \/>/u);
	assert.match(source, /<SupportIcon label=\{label\} size="small" color="currentColor" \/>/u);
	assert.doesNotMatch(source, /leading=\{<TileLeading>\{getCategoryNavIcon/u);
	assert.doesNotMatch(sidebarGroupsSource, /title: "Collections"/u);
	assert.doesNotMatch(sidebarGroupsSource, /kind: "collection"/u);
	assert.doesNotMatch(sidebarGroupsSource, /SkillDirectoryCollectionItem/u);
	assert.match(sidebarGroupsSource, /title: "By companies"/u);
	assert.doesNotMatch(sidebarGroupsSource, /Project management/u);
});

test("Skill Directory uses contextual cards, immediate Studio switches, and legacy selected footer", () => {
	const source = readProjectFile("components/blocks/skill-directory/components/skill-directory.tsx");
	const skillSource = readProjectFile("components/ui-custom/entity-card/skill.tsx");
	const partsSource = readProjectFile("components/ui-custom/entity-card/parts.tsx");
	const variantsSource = readProjectFile("components/ui-custom/entity-card/variants.tsx");
	const skillsJson = JSON.parse(readProjectFile("app/data/directory/skills.json"));
	const createSkill = skillsJson.find((skill) => skill.id === "create-skill");

	assert.match(source, /EntityCardSkillCard/u);
	assert.match(source, /<SkillDirectoryHeader[\s\S]*onCreateSkill=\{createSkillHandler\}/u);
	assert.match(source, /Showing \{filteredSkills\.length\.toLocaleString\("en-US"\)\} results/u);
	assert.match(source, /const \[moreMenuOpen, setMoreMenuOpen\] = useState\(false\);/u);
	assert.match(source, /active=\{!moreActionsDisabled && moreMenuOpen\}/u);
	assert.match(source, /<SkillMoreMenu[\s\S]*onOpenChange=\{setMoreMenuOpen\}[\s\S]*open=\{moreMenuOpen\}/u);
	assert.match(source, /const \[favoriteOverrides, setFavoriteOverrides\] = useState<Record<string, boolean>>\(\{\}\);/u);
	assert.match(source, /skill\.id in favoriteOverrides \? \{ \.\.\.skill, favorite: favoriteOverrides\[skill\.id\] \} : skill/u);
	assert.match(source, /function handleToggleFavoriteSkill\(skill: SkillDirectorySkill\): void \{[\s\S]*\[skill\.id\]: !skill\.favorite/u);
	assert.match(source, /onToggleFavorite=\{onToggleFavorite\}/u);
	assert.match(source, /aria-pressed=\{open \|\| undefined\}/u);
	assert.match(source, /className="min-h-\[112px\] gap-4"/u);
	assert.match(source, /description=\{skill\.description\}/u);
	assert.match(source, /icon=\{getSkillIcon\(skill\.icon\)\}/u);
	assert.match(source, /iconVariant=\{getSkillIconTileVariant\(skill\)\}/u);
	assert.match(source, /source=\{getSkillCardSource\(skill\)\}/u);
	assert.match(source, /starCount=\{skill\.starCount\}/u);
	assert.match(source, /teammateCount=\{skill\.teammateCount\}/u);
	assert.match(variantsSource, /export interface EntityCardSkillCardProps extends EntityCardSkillProps \{[\s\S]*active\?: boolean;[\s\S]*cardActionLabel\?: string;[\s\S]*moreAction\?: ReactNode;/u);
	assert.match(variantsSource, /const shellSelectLabel = cardActionLabel \?\? getDefaultShellSelectLabel\(\{ onAddedChange, onSelect, addActionLabel, selectLabel \}\);/u);
	assert.match(variantsSource, /onSelectedChange,/u);
	assert.match(variantsSource, /const checkboxSelectable = selectable \?\? selected !== undefined;/u);
	assert.match(variantsSource, /onSelectedChange=\{onSelectedChange \?\? onSelect\}/u);
	assert.match(source, /selectionExperience === "chat-single-add"[\s\S]*onAddSkills\?\.\(\[skill\.id\], \[skill\]\);[\s\S]*handleOpenChange\(false\);/u);
	assert.doesNotMatch(source, /selectionExperience === "chat-single-add"[\s\S]*commitSelectedIds\(\[skill\.id\]\);/u);
	assert.match(source, /const handleCardSelect =[\s\S]*selectionExperience === "studio-bulk-add"[\s\S]*\? \(\) => onToggleAddedSkill\(skill, !effectiveAdded\)[\s\S]*: cardSelectable \? \(\) => onSelectSkill\(skill\) : undefined;/u);
	assert.match(source, /function handleToggleAddedSkill\(skill: SkillDirectorySkill, checked: boolean\): void \{[\s\S]*checked[\s\S]*onAddSkills\?\.\(\[skill\.id\], \[skill\]\);[\s\S]*onRemoveSkills\?\.\(\[skill\.id\], \[skill\]\);[\s\S]*notifySkillSelected\(skill\);/u);
	assert.doesNotMatch(source, /const selectedAsAdded = selectionExperience === "studio-bulk-add";/u);
	assert.match(source, /const checkboxSelectable = true;/u);
	assert.match(source, /const cardSelectable = selectionExperience !== "checkbox-actions";/u);
	assert.doesNotMatch(source, /const skillsToAdd = selectedSkills\.filter\(\(skill\) => !addedIdSet\.has\(skill\.id\)\);/u);
	assert.doesNotMatch(source, /const skillsToRemove = selectedSkills\.filter\(\(skill\) => addedIdSet\.has\(skill\.id\)\);/u);
	assert.match(source, /const selectedFooterCount = resolvedSelectedIds\.length;/u);
	assert.match(source, /const showSelectedSkillsFooter = selectedFooterCount > 0;/u);
	assert.match(source, /showSelectedSkillsFooter \? \([\s\S]*<SelectedSkillsFooter[\s\S]*count=\{selectedFooterCount\}[\s\S]*onCancelSelection=\{\(\) => commitSelectedIds\(\[\]\)\}/u);
	assert.doesNotMatch(source, /const showCancelButton = selectionExperience === "studio-bulk-add";/u);
	assert.doesNotMatch(source, /const addButtonLabel = selectionExperience === "studio-bulk-add" \? "Save" : "Add skills";/u);
	assert.match(source, /onSelect=\{handleCardSelect\}/u);
	assert.match(source, /onToggleAdded=\{showAddedSwitch \? \(checked\) => onToggleAddedSkill\(skill, checked\) : undefined\}/u);
	assert.match(source, /onAddedChange=\{onToggleAdded\}/u);
	assert.match(source, /cardActionLabel=\{onToggleAdded \? `\$\{added \? "Remove" : "Add"\} \$\{skill\.name\}` : undefined\}/u);
	assert.match(
		source,
		/onSelectedChange=\{\(checked\) => \{[\s\S]*if \(nextSelected\) \{[\s\S]*setMoreMenuOpen\(false\);[\s\S]*onToggleSelected\(checked\);/u,
	);
	assert.match(source, /selectable=\{checkboxSelectable\}/u);
	assert.match(source, /const effectiveAdded = addedIds\.has\(skill\.id\);/u);
	assert.match(source, /added=\{effectiveAdded\}/u);
	assert.match(source, /hoverAdded=\{false\}/u);
	assert.doesNotMatch(source, /const showHoverAdded = hoverAdded && !moreMenuOpen;/u);
	assert.match(source, /hoverAdded=\{hoverAdded\}/u);
	assert.doesNotMatch(source, /hover:after:border-border/u);
	assert.doesNotMatch(source, /selected=\{selectedAsAdded \? false : selected\}/u);
	assert.doesNotMatch(source, /const effectiveAdded = selectedAsAdded[\s\S]*\? addedIds\.has\(skill\.id\) !== selected[\s\S]*: addedIds\.has\(skill\.id\);/u);
	assert.match(source, /const selected = selectedIds\.has\(skill\.id\);[\s\S]*selected=\{selected\}/u);
	assert.doesNotMatch(source, /const handleToggleSelected = \(checked\?: boolean\) =>/u);
	assert.match(source, /onToggleSelected=\{\(checked\) => onToggleSelectedSkill\(skill, checked\)\}/u);
	assert.match(variantsSource, /<EntityCardShell[\s\S]*active=\{active\}[\s\S]*selected=\{selected\}/u);
	assert.match(partsSource, /function EntityCardSelectableLeading/u);
	assert.match(partsSource, /onCheckedChange=\{\(checked\) => onSelectedChange\?\.\(Boolean\(checked\)\)\}/u);
	assert.match(partsSource, /"opacity-0 transition-opacity duration-fast ease-out after:inset-0 focus-visible:pointer-events-auto focus-visible:opacity-100"/u);
	assert.match(partsSource, /trailingStatus\?: ReactNode/u);
	assert.match(partsSource, /onAddedChange\?: \(checked: boolean\) => void/u);
	assert.match(partsSource, /export function EntityCardAddedSwitch/u);
	assert.match(partsSource, /"transition-opacity duration-fast ease-out motion-reduce:transition-none after:inset-0"/u);
	assert.match(partsSource, /action[\s\S]*\? added \? "w-16" : "w-6 group-hover\/card:w-16 group-has-\[:focus-visible\]\/card:w-16 group-data-\[active=true\]\/card:w-16"[\s\S]*: added \? "w-8" : "w-0 group-hover\/card:w-8 group-has-\[:focus-visible\]\/card:w-8"/u);
	assert.match(skillSource, /trailingStatus\?: ReactNode/u);
	assert.match(skillSource, /onAddedChange\?: \(checked: boolean\) => void/u);
	assert.doesNotMatch(source, /rounded-xs bg-bg-neutral text-icon-subtle transition-opacity/u);
	assert.doesNotMatch(source, /absolute top-1\/2 left-1\/2 -translate-x-1\/2 -translate-y-1\/2 opacity-0 transition-opacity/u);
	assert.match(partsSource, /selected \? "opacity-0" : "opacity-100 group-hover\/card:opacity-0 group-has-\[:focus-visible\]\/card:opacity-0"/u);
	assert.match(partsSource, /focus-visible:pointer-events-auto focus-visible:opacity-100/u);
	assert.match(partsSource, /pointer-events-none group-hover\/card:pointer-events-auto group-hover\/card:opacity-100/u);
	assert.match(source, /selected=\{selected\}/u);
	assert.doesNotMatch(source, /selected && "border-border-selected hover:border-border-selected"/u);
	assert.doesNotMatch(source, /"min-h-\[112px\] gap-4 hover:border-transparent"/u);
	assert.match(source, /function SkillMoreMenu/u);
	assert.doesNotMatch(source, /function SkillAddedSwitch/u);
	assert.doesNotMatch(source, /trailingStatus=\{[\s\S]*<SkillAddedSwitch/u);
	assert.match(partsSource, /<Switch[\s\S]*aria-label=\{`\$\{added \? "Remove" : "Add"\} \$\{title\}`\}[\s\S]*checked=\{added\}[\s\S]*className=\{cn\([\s\S]*added[\s\S]*\? "pointer-events-auto opacity-100"[\s\S]*: "pointer-events-none opacity-0 group-hover\/card:pointer-events-auto group-hover\/card:opacity-100[\s\S]*group-has-\[:focus-visible\]\/card:pointer-events-auto group-has-\[:focus-visible\]\/card:opacity-100[\s\S]*onCheckedChange=\{onAddedChange\}[\s\S]*size="sm"/u);
	assert.match(source, /added=\{added\}/u);
	assert.match(source, /const moreActionsDisabled = selected;/u);
	assert.match(source, /const nextSelected = checked \?\? !selected;[\s\S]*if \(nextSelected\) \{[\s\S]*setMoreMenuOpen\(false\);/u);
	assert.match(source, /active=\{!moreActionsDisabled && moreMenuOpen\}/u);
	assert.match(source, /moreActionsDisabled \? null : \([\s\S]*<SkillMoreMenu/u);
	assert.match(source, /event\.stopPropagation\(\);\s+onLearnMore\(\);/u);
	assert.match(source, /Learn more/u);
	assert.match(
		source,
		/function SkillMoreMenu[\s\S]*event\.stopPropagation\(\);\s+onDownloadSkills\(\);[\s\S]*Download[\s\S]*event\.stopPropagation\(\);\s+onCreateShareLink\(\);[\s\S]*Share/u,
	);
	assert.doesNotMatch(source, /StarStarredIcon/u);
	assert.match(source, /\{favorite \? "Unfavourite" : "Favourite"\}/u);
	assert.match(source, /function SelectedSkillsFooter/u);
	assert.match(source, /<DialogFooter[\s\S]*aria-label="Selected skills actions"[\s\S]*role="toolbar"/u);
	assert.doesNotMatch(source, /const showUtilityActions = selectionExperience !== "studio-bulk-add";/u);
	assert.match(source, /import StarUnstarredIcon from "@atlaskit\/icon\/core\/star-unstarred";/u);
	assert.match(source, /<Badge>\{count\}<\/Badge>[\s\S]*<Button onClick=\{onCancelSelection\} size="default" type="button" variant="ghost">[\s\S]*Cancel[\s\S]*<Button onClick=\{onFavoriteSkills\} size="default" type="button" variant="ghost">[\s\S]*Favorite[\s\S]*<Button onClick=\{onDownloadSkills\} size="default" type="button" variant="ghost">[\s\S]*Download[\s\S]*<Button onClick=\{onCreateShareLink\} size="default" type="button" variant="ghost">\s*<LinkIcon label="" \/>\s*Create link to share\s*<\/Button>/u);
	assert.match(source, /<Button onClick=\{onFavoriteSkills\} size="default" type="button" variant="ghost">\s*<StarUnstarredIcon label="" \/>\s*Favorite\s*<\/Button>/u);
	assert.match(source, /const showAddButton = selectionExperience === "checkbox-actions";/u);
	assert.doesNotMatch(source, /showCancelButton \? \(/u);
	assert.match(source, /const countLabel = "selected";/u);
	assert.match(source, /<span className="shrink-0 text-sm font-medium leading-5 text-text">\{countLabel\}<\/span>/u);
	assert.doesNotMatch(source, /Apply changes/u);
	assert.doesNotMatch(source, /function SelectedSkillsToolbar/u);
	assert.doesNotMatch(source, /pointer-events-none absolute inset-x-0 bottom-6/u);
	assert.doesNotMatch(source, /style=\{\{ boxShadow: token\("elevation\.shadow\.overlay"\) \}\}/u);
	assert.doesNotMatch(source, /function SkillPublisherAvatar/u);
	assert.match(source, /function getSkillCardSource/u);
	assert.match(source, /getSkillPublisherLogoName\(skill\)/u);
	assert.equal(createSkill?.publisherName, "Atlassian");
	assert.equal(createSkill?.companyId, "atlassian");
	assert.equal(createSkill?.publisherAvatarSrc, undefined);
	// Attribution marks are uniform, borderless 16x16 logos through the canonical EntityCard source row.
	assert.match(skillSource, /import \{ AtlassianLogo, CustomLogo, type AtlassianLogoName \} from "@\/components\/ui\/logo";/u);
	assert.match(skillSource, /import \{ LogoThirdParty \} from "@\/components\/ui\/logo-third-party";/u);
	assert.doesNotMatch(skillSource, /@\/components\/ui\/logo-mark/u);
	assert.match(skillSource, /<AtlassianLogo label="" name=\{source\.logoName\} size="xxsmall" themeAware \/>/u);
	assert.match(skillSource, /<LogoThirdParty borderless label="" name=\{source\.brandName\} size="xxsmall" \/>/u);
	assert.match(skillSource, /<CustomLogo borderless label="" size="xxsmall" src=\{source\.avatarSrc\} \/>/u);
	assert.doesNotMatch(source, /size="xsmall" themeAware label=\{getSkillPublisherName/u);
	// Only human avatars are rounded; company logos use the shared transparent logo mark.
	assert.match(source, /if \(isSkillPublisherPerson\(skill\)\) \{/u);
	assert.match(source, /type: "custom"[\s\S]*avatarSrc/u);
	assert.match(source, /type: "app"[\s\S]*brandName: skill\.publisherBrandName,[\s\S]*logoName/u);
	assert.match(source, /Add skills/u);
	assert.match(source, /Create link to share/u);
	assert.match(source, /Favorite/u);
	assert.match(source, /Download/u);
	assert.match(source, /Download[\s\S]*Add skills/u);
	assert.doesNotMatch(source, /aria-label="Clear selected skills"/u);
});

test("Skill Directory renders the skill detail view with the config screen and FileTree sidebar", () => {
	const source = readProjectFile("components/blocks/skill-directory/components/skill-directory.tsx");
	const sidebarSource = readProjectFile("components/blocks/skill-directory/components/skill-directory-sidebar.tsx");

	assert.match(source, /function SkillDetailHeader/u);
	assert.match(source, /className="flex items-center justify-between border-b border-border px-6 py-6"/u);
	assert.match(source, /<ButtonGroup aria-label="Open skill" variant="split">/u);
	assert.match(source, /<Button onClick=\{onOpenSkill\} variant="outline">[\s\S]*Open/u);
	// The "more actions" menu is the leftmost button of the right-hand CTA group (after Back, before Open).
	assert.match(source, /onClick=\{onBack\}[\s\S]*aria-label="More skill actions"[\s\S]*<ButtonGroup aria-label="Open skill" variant="split"/u);
	assert.match(source, /aria-label="More open actions"[\s\S]*Open in new tab[\s\S]*Copy link/u);
	// The detail header mirrors the agent config feature: an enable/disable Switch,
	// while chat swaps the added-state Remove action for a primary Try in chat CTA.
	assert.match(source, /aria-label=\{`\$\{enabled \? "Disable" : "Enable"\} \$\{title\}`\}/u);
	assert.match(source, /<Switch[\s\S]*checked=\{enabled\}[\s\S]*onCheckedChange=\{onToggleEnabled\}/u);
	// Remove and the fallback add CTA are gated on committed added state + surface.
	assert.match(source, /onClick=\{onRemove\} type="button" variant="destructive"[\s\S]*Remove/u);
	assert.match(source, /addLabel=\{selectionExperience === "chat-single-add" \? "Try in chat" : "Add to agent"\}/u);
	assert.match(source, /showTryInChatAction=\{selectionExperience === "chat-single-add"\}/u);
	assert.match(source, /added && !showTryInChatAction \? \(/u);
	assert.match(source, /<Button onClick=\{onAdd\} type="button">[\s\S]*\{addLabel\}/u);
	// Disable is gated on `added` (only skills on the agent), and the disable
	// state is controlled/persisted via the agent config — not local-cosmetic.
	assert.match(source, /added \? \(\s*<label/u);
	assert.match(source, /added && !showTryInChatAction \? \(\s*<Button onClick=\{onRemove\}/u);
	assert.match(source, /onToggleSkillEnabled\?: \(skill: SkillDirectorySkill, enabled: boolean\) => void/u);
	assert.match(source, /const controlledDisabled = typeof disabledSkillIds !== "undefined"/u);
	assert.match(source, /onToggleSkillEnabled\(skill, enabled\)/u);
	// Disabling parks the editor column inert + muted (mirrors the apps detail path).
	assert.match(source, /inert=\{disabled \|\| undefined\}/u);
	assert.match(source, /function SkillDetailView/u);
	// The detail view hosts the SKILL.md editor (frontmatter card enabled, no apps
	// panel) seeded from the skill's full SKILL.md, committed via Save/Cancel.
	assert.match(source, /<SkillDetailConfig key=\{skill\.id\} disabled=\{disabled\} skill=\{skill\} onExit=\{onExit\} \/>/u);
	assert.match(source, /function SkillDetailConfig/u);
	assert.match(source, /<AgentConfigFields/u);
	assert.match(source, /frontmatter=\{\{ enabled: true \}\}/u);
	assert.match(source, /showConfigToolbar=\{false\}/u);
	// Globe cover + Created/Added/Last-update meta row via the shared slot components,
	// and a Save/Cancel footer that only appears after the skill draft changes.
	assert.match(source, /profileCover=\{<SkillProfileCover skill=\{skill\} \/>\}/u);
	assert.match(source, /profileMetaSlot=\{<SkillProfileMeta skill=\{skill\} \/>\}/u);
	assert.match(source, /compactScrollAreaClassName="-mr-6 pr-6 pt-6 \[&_\[data-agent-field=instructions\]_\.rich-text-editor-content\]:pb-8"/u);
	assert.match(source, /instructionsToolbarClassName="-top-4"/u);
	assert.match(source, /useSkillMdDraft\(skill, initialDraft\)/u);
	assert.match(source, /function handleSave\(\)/u);
	assert.match(source, /function handleCancel\(\)/u);
	assert.match(source, /saveSkillDraft\(skill\.id, current\)/u);
	assert.match(
		source,
		/dirty \? \([\s\S]*className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-6 py-6"[\s\S]*Cancel[\s\S]*Save[\s\S]*\) : null/u,
	);
	// The editor is seeded with the full SKILL.md (frontmatter + body).
	assert.match(source, /getSkillMarkdown\(skill\)/u);
	// The shared cover + meta row + draft hook live in skill-md-editor.
	const editorSource = readProjectFile("components/blocks/skill-directory/components/skill-md-editor.tsx");
	assert.match(editorSource, /export function useSkillMdDraft/u);
	assert.match(editorSource, /export function SkillProfileCover/u);
	assert.match(editorSource, /getSkillCreatedBy\(skill\)/u);
	assert.match(editorSource, /getSkillLastUpdatedLabel\(skill\)/u);
	// The read-only summary/tools column was replaced by the config screen.
	assert.doesNotMatch(source, /function SkillDetailSummary/u);
	assert.doesNotMatch(source, /function SkillToolsSection/u);
	// The file-tree sidebar uses the shared FileTree compound from ui-custom.
	assert.match(source, /import \{ FileTree, FileTreeFile, FileTreeFolder \} from "@\/components\/ui-custom\/file-tree";/u);
	assert.match(source, /function SkillFileTreeSidebar/u);
	assert.match(source, /function buildSkillFileTree/u);
	assert.match(source, /<FileTree\b/u);
	assert.match(source, /<FileTreeFolder key=\{node\.id\} name=\{node\.label\} path=\{node\.id\}>/u);
	assert.match(source, /<FileTreeFile key=\{node\.id\} name=\{node\.label\} path=\{node\.id\} \/>/u);
	assert.match(source, /SKILL\.md/u);
	assert.match(source, /LICENSE\.txt/u);
	assert.match(source, /references/u);
	assert.match(source, /scripts/u);
	// The left category sidebar (browse view) keeps its own top scroll mask.
	assert.match(sidebarSource, /import \{ useHasVerticalOverflow \} from "@\/components\/hooks\/use-has-vertical-overflow";/u);
	assert.match(sidebarSource, /const sidebarOverflow = useHasVerticalOverflow<HTMLElement>\(\);/u);
	assert.match(sidebarSource, /aria-label="Skill categories"[\s\S]*sidebarOverflow\.showTopScrollMask && "scroll-mask-top overscroll-contain"[\s\S]*ref=\{sidebarOverflow\.ref\}/u);
});

test("Skill Directory demo and docs use skill-specific examples", () => {
	const source = readProjectFile("components/blocks/skill-directory/components/skill-directory.tsx");
	const pageSource = readProjectFile("components/blocks/skill-directory/page.tsx");
	const detailsSource = readDetailCategorySource("blocks");
	// Skill data is now the single-source-of-truth JSON catalog; the loader + icon
	// resolver own the typing/helpers and the Atlaskit icon imports.
	const skillsJson = JSON.parse(readProjectFile("app/data/directory/skills.json"));
	const skillsLoaderSource = readProjectFile("app/data/directory/skills.ts");
	const skillCollectionsSource = readProjectFile("app/data/directory/skill-collections.ts");
	const visualSource = readProjectFile("app/data/directory/visual.tsx");
	const sidebarGroupsSource = readProjectFile("components/blocks/skill-directory/data/sidebar-groups.ts");

	const skillIds = new Set(skillsJson.map((skill) => skill.id));

	assert.doesNotMatch(pageSource, /defaultSelectedSkillIds=/u);
	assert.match(pageSource, /type SkillDirectorySelectionExperience/u);
	assert.match(pageSource, /const \[selectionExperience, setSelectionExperience\] = useState<SkillDirectorySelectionExperience>\("studio-bulk-add"\);/u);
	assert.match(pageSource, /className="flex h-full min-h-screen items-center justify-center gap-3 p-4"/u);
	assert.match(pageSource, /className="flex h-full min-h-screen items-center justify-center p-4"/u);
	assert.match(pageSource, /Open Chat directory/u);
	assert.match(pageSource, /Open Studio directory/u);
	assert.match(pageSource, /onClick=\{\(\) => openDirectory\("chat-single-add"\)\}/u);
	assert.match(pageSource, /onClick=\{\(\) => openDirectory\("studio-bulk-add"\)\}/u);
	assert.match(pageSource, /selectionExperience=\{selectionExperience\}/u);
	assert.match(pageSource, /variant="experimental"/u);
	assert.match(pageSource, /if \(selectionExperience === "chat-single-add"\) \{\s*return;\s*\}/u);
	assert.match(pageSource, /addedSkillIds=\{selectionExperience === "chat-single-add" \? \[\] : addedSkillIds\}/u);
	assert.match(pageSource, /function handleRemoveSkills\(skillIds: readonly string\[\]\) \{[\s\S]*const removedIds = new Set\(skillIds\);[\s\S]*setAddedSkillIds\(\(current\) => current\.filter\(\(id\) => !removedIds\.has\(id\)\)\);/u);
	assert.match(pageSource, /onRemoveSkills=\{handleRemoveSkills\}/u);
	assert.doesNotMatch(detailsSource, /defaultSelectedSkillIds=\{\[/u);
	assert.match(detailsSource, /selectionExperience="studio-bulk-add"/u);
	assert.match(detailsSource, /title: "Chat"[\s\S]*Single-select experience like \/skills/u);
	assert.match(detailsSource, /title: "Studio"[\s\S]*card switch immediately adds or removes/u);
	assert.match(pageSource, /const DEMO_ADDED_USER_SKILL_IDS: readonly string\[\] = \[[\s\S]*"create-brand-identity"[\s\S]*"design-landing-page"[\s\S]*"develop-mobile-app-interface"/u);
	assert.match(pageSource, /const DEMO_ADDED_CATALOG_SKILL_IDS: readonly string\[\] = \[[\s\S]*"access-review"[\s\S]*"analyze-root-cause"[\s\S]*"build-report"[\s\S]*"review-pull-request"/u);
	assert.match(pageSource, /const \[addedSkillIds, setAddedSkillIds\] = useState<readonly string\[\]>\(DEMO_ADDED_SKILL_IDS\);/u);
	assert.match(pageSource, /addedSkillIds=\{selectionExperience === "chat-single-add" \? \[\] : addedSkillIds\}/u);
	assert.match(pageSource, /setAddedSkillIds\(\(current\) => \[\.\.\.new Set\(\[\.\.\.current, \.\.\.skillIds\]\)\]\);/u);
	assert.ok(skillIds.has("design-landing-page"));
	assert.ok(skillIds.has("develop-mobile-app-interface"));
	assert.ok(skillIds.has("create-brand-identity"));
	assert.ok(
		skillsJson.some((skill) => skill.id === "design-landing-page" && skill.publisherName === "Venn"),
		"custom skills should display Venn as the publisher",
	);
	assert.ok(
		skillsJson.every((skill) => skill.publisherName !== "you"),
		"skills catalog should not author lowercase you as a publisher",
	);
	assert.doesNotMatch(detailsSource, /publisherName: "you"/u);
	assert.match(detailsSource, /publisherName: "Venn"/u);
	// The icon resolver owns the closed icon set + its Atlaskit imports.
	assert.match(visualSource, /import DeviceMobileIcon from "@atlaskit\/icon\/core\/device-mobile";/u);
	assert.ok(
		skillsJson.some((skill) => skill.icon === "device-mobile"),
		"at least one skill should use the device-mobile icon",
	);
	// Decorative icon colors are semantic/accent tokens, never raw -500 hues.
	for (const skill of skillsJson) {
		if (skill.iconColor) {
			assert.doesNotMatch(skill.iconColor, /text-(blue|purple|teal|orange|indigo|green)-500/u);
		}
	}
	// Skill provenance (`source`) remains valid, while collectionId owns the
	// browse taxonomy and collection-colored tag/card styling.
	const VALID_SOURCES = new Set([
		"2p", "3p", "default", "custom", "platform",
		"teamwork", "software", "strategy", "service", "product",
	]);
	const VALID_COLLECTIONS = new Set([
		"teamwork", "software", "strategy", "service", "product",
		"platform", "marketplace", "custom", "default",
	]);
	const sources = new Set();
	const collections = new Set();
	for (const skill of skillsJson) {
		if (skill.source !== undefined) {
			assert.ok(VALID_SOURCES.has(skill.source), `invalid skill source: ${skill.source}`);
			sources.add(skill.source);
		}
		assert.ok(VALID_COLLECTIONS.has(skill.collectionId), `invalid skill collection: ${skill.collectionId}`);
		assert.equal(typeof skill.collectionDescription, "string");
		assert.ok(Array.isArray(skill.collectionProducts));
		assert.equal(typeof skill.collectionDocsUrl, "string");
		assert.equal(typeof skill.teammateCount, "number");
		assert.equal(typeof skill.verified, "boolean");
		collections.add(skill.collectionId);
	}
	for (const family of ["teamwork", "software", "strategy", "service", "product", "3p"]) {
		assert.ok(sources.has(family), `a skill should have source "${family}"`);
	}
	for (const collection of ["teamwork", "software", "strategy", "service", "product"]) {
		assert.ok(collections.has(collection), `a skill should have collection "${collection}"`);
	}
	// The loader maps each source to shared collection metadata consumed by both
	// the directory card and the composer tag.
	assert.match(skillsLoaderSource, /SKILL_SOURCE_ICON_COLOR/u);
	assert.match(skillsLoaderSource, /SKILL_COLLECTIONS/u);
	assert.match(skillsLoaderSource, /function getSkillCollectionId/u);
	assert.match(skillsLoaderSource, /function getSkillCollection/u);
	assert.match(skillsLoaderSource, /function getSkillIconColor/u);
	assert.match(skillsLoaderSource, /function getSkillIconTileVariant/u);
	assert.match(skillsLoaderSource, /const PERSONAL_SKILL_PUBLISHERS = new Set\(\["you", "by you"\]\);/u);
	assert.match(skillsLoaderSource, /PERSONAL_SKILL_PUBLISHERS\.has\(publisher\.trim\(\)\.toLowerCase\(\)\) \? "Venn" : publisher/u);
	assert.match(source, /const publisher = \(skill\.publisherName \?\? skill\.publisher \?\? ""\)\.trim\(\)\.toLowerCase\(\);/u);
	for (const accent of [
		"text-icon-accent-blue",
		"text-icon-accent-green",
		"text-icon-accent-orange",
		"text-icon-accent-yellow",
		"text-icon-accent-purple",
		"text-icon-accent-gray",
	]) {
		assert.ok(skillCollectionsSource.includes(accent), `collection metadata should map a family to ${accent}`);
	}
	assert.match(skillsLoaderSource, /function getSkillPublisherLogoName/u);
	assert.match(sidebarGroupsSource, /logoName: "atlassian"/u);
	assert.match(detailsSource, /onAddSkills/u);
	assert.match(detailsSource, /onCreateSkill/u);
	// The loader interface still carries the publisher/category/company fields.
	assert.match(skillsLoaderSource, /publisherName/u);
	assert.match(skillsLoaderSource, /publisherAvatarSrc/u);
	assert.match(skillsLoaderSource, /categoryId/u);
	assert.match(skillsLoaderSource, /companyId/u);
	assert.match(sidebarGroupsSource, /label: "All skills"/u);
	assert.match(sidebarGroupsSource, /label: "Favourite skills"/u);
	assert.match(sidebarGroupsSource, /label: "Your skills"/u);
	assert.doesNotMatch(sidebarGroupsSource, /title: "Collections"/u);
	// Category ids are still exercised by the data.
	const categoryIds = new Set(skillsJson.map((skill) => skill.categoryId ?? skill.category));
	assert.ok(categoryIds.has("content-and-communication"));
	assert.ok(categoryIds.has("data-and-analytics"));
});

test("Skill Directory exposes an opt-in experimental variation", () => {
	const source = readProjectFile("components/blocks/skill-directory/components/skill-directory.tsx");
	const indexSource = readProjectFile("components/blocks/skill-directory/index.ts");
	const blocksSource = readDetailCategorySource("blocks");
	const registrySource = readWebsiteRegistrySource();
	const demoSource = readProjectFile("components/website/demos/blocks/skill-directory-demo.tsx");
	const pageSource = readProjectFile("components/blocks/skill-directory/page.tsx");

	// The component opts in via a variant prop and branches the list view; the
	// default sidebar layout stays the fallback.
	assert.match(source, /export type SkillDirectoryVariant = "default" \| "experimental";/u);
	assert.match(source, /variant\?: SkillDirectoryVariant;/u);
	assert.match(source, /variant = "default",/u);
	assert.match(source, /variant === "experimental" \? \([\s\S]*<ExperimentalSkillDirectoryView/u);

	assert.match(indexSource, /SkillDirectoryVariant,/u);

	assert.match(blocksSource, /demoSlug: "skill-directory-demo-standard"/u);
	assert.match(blocksSource, /demoSlug: "skill-directory-demo-experimental"/u);
	assert.match(blocksSource, /name: "variant",[\s\S]*Opt-in layout variation/u);

	assert.match(registrySource, /"skill-directory-demo-standard": dynamic\([\s\S]*mod\.SkillDirectoryDemoStandard/u);
	assert.match(registrySource, /"skill-directory-demo-experimental": dynamic\([\s\S]*mod\.SkillDirectoryDemoExperimental/u);
	assert.match(demoSource, /export function SkillDirectoryDemoStandard/u);
	assert.match(demoSource, /export function SkillDirectoryDemoExperimental/u);

	assert.match(pageSource, /export function SkillDirectoryExperimentalPage/u);
	assert.match(pageSource, /variant="experimental"/u);
	assert.match(pageSource, /Open standard directory/u);
	assert.match(pageSource, /Open experimental directory/u);
});

test("Skill Directory experimental variation has searchable multi-select filters", () => {
	const source = readProjectFile("components/blocks/skill-directory/components/skill-directory.tsx");
	const sharedSource = readProjectFile("components/blocks/directory-shared/experimental-directory-view.tsx");

	assert.match(source, /function ExperimentalSkillDirectoryView\(/u);
	assert.match(source, /<ExperimentalDirectoryView/u);
	assert.match(source, /<ExperimentalDirectorySection/u);
	assert.match(sharedSource, /export function FacetFilterDropdown/u);
	assert.match(sharedSource, /import \{ Popover, PopoverContent, PopoverTrigger \} from "@\/components\/ui\/popover";/u);

	// Pinned search + filter header above a separate scroll region (only results scroll).
	assert.match(sharedSource, /"flex shrink-0 flex-col gap-4 px-6 pt-1 pb-2"/u);
	assert.match(sharedSource, /"flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pt-2"/u);
	assert.match(source, /contentClassName="pb-8"/u);
	assert.doesNotMatch(source, /contentClassName=\{hasSelection \? "pb-28" : "pb-8"\}/u);

	// Filter controls: Your skills + Favourites toggles and Companies dropdown.
	// Added skills is omitted in chat-single-add mode because Chat adds to the prompt,
	// not the agent config.
	// Collections/Categories are internal taxonomy and not exposed in the experimental UI.
	assert.match(source, /label: "Filter by your skills"[\s\S]*selectionExperience === "chat-single-add"[\s\S]*label: "Added skills"[\s\S]*label: "Favourites"/u);
	assert.match(source, /activeLabel: "Filter by companies"[\s\S]*label: "Companies"/u);
	assert.doesNotMatch(source, /activeLabel: "Filter by collections"/u);
	assert.doesNotMatch(source, /label: "Collections"/u);
	assert.doesNotMatch(source, /label="Categories"/u);

	// Single active facet at a time is shared with app-directory.
	assert.match(sharedSource, /const activeFacet = facets\.find\(facetIsActive\)\?\.id \?\? null;/u);
	assert.match(sharedSource, /const showFacet = \(facet: ExperimentalDirectoryFacet<TOption>\) => activeFacet === null \|\| activeFacet === facet\.id;/u);
	assert.match(source, /id: "yourSkills"/u);
	assert.match(source, /id: "addedSkills"/u);
	assert.match(source, /id: "companies"/u);
	assert.doesNotMatch(source, /id: "collections"/u);

	// Searchable multi-select with a selected-count badge.
	assert.match(sharedSource, /placeholder="Search options"/u);
	assert.match(sharedSource, /<Checkbox\s+checked=\{selectedValues\.includes\(option\.id\)\}/u);
	assert.match(sharedSource, /\{selectedCount > 0 \? <Badge>\{selectedCount\}<\/Badge> : null\}/u);

	// Filter-aware empty state + a result count, reusing the shared experimental section grid
	// at a 3-column layout (the default view stays 2-column).
	assert.match(source, /function getExperimentalSkillsEmptyState\(/u);
	assert.match(source, /title: "No skills added yet"/u);
	assert.match(source, /title: "No favourite skills yet"/u);
	assert.match(sharedSource, /Showing \{resultCount\.toLocaleString\("en-US"\)\} \{resultLabel\}/u);
	assert.match(sharedSource, /<ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">/u);
	// Results are alphabetised so the grey-heavy catalog order doesn't front-load a
	// block of grey tiles — the first rows stay multi-coloured by collection.
	assert.match(source, /\.sort\(\(a, b\) => a\.name\.localeCompare\(b\.name, "en"\)\)/u);

	// Results split into "My skills" / "Other skills" micro sections (agent-directory parity).
	assert.match(source, /heading="My skills"/u);
	assert.match(source, /heading="Other skills"/u);
	assert.match(source, /const mySkills = useMemo\(\(\) => filteredSkills\.filter\(isYourSkill\)/u);
	assert.match(sharedSource, /<h2 className="px-1\.5 text-xs font-semibold leading-4 text-text-subtlest">/u);

	// Popover keeps the end gap inside the scroll list, not on the parent.
	assert.match(sharedSource, /className="w-72 gap-2 p-2 pb-0"/u);
	assert.match(sharedSource, /<ul className="flex flex-col gap-px pb-2">/u);

	// Company options derive from non-self publishers.
	assert.match(source, /function getSkillCompanyOptions\(/u);
	assert.match(source, /if \(!id \|\| id === "you" \|\| byId\.has\(id\)\) continue;/u);
	assert.match(source, /logoName: id === "atlassian" \? "atlassian" : getSkillPublisherLogoName\(skill\),/u);
	assert.match(source, /brandName: skill\.publisherBrandName,/u);
	assert.match(source, /avatarSrc: id === "atlassian" \? undefined : getSkillPublisherAvatarSrc\(skill\),/u);
	assert.match(source, /if \(option\.brandName\) \{[\s\S]*<BrandLogoMark name=\{option\.brandName\} size="small" transparent label=\{option\.label\} \/>/u);
});
