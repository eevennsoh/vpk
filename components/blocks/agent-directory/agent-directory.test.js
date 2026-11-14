const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

function readProjectFile(relativePath) {
	return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("Agent Directory exposes an opt-in experimental variation", () => {
	const source = readProjectFile("components/blocks/agent-browser/components/agent-browser.tsx");
	const agentsDirectorySource = readProjectFile("components/blocks/agent-directory/components/agent-directory.tsx");
	const indexSource = readProjectFile("components/blocks/agent-directory/index.ts");
	const detailsSource = readDetailCategorySource("blocks");
	const registrySource = readWebsiteRegistrySource();
	const demoSource = readProjectFile("components/website/demos/blocks/agent-directory-demo.tsx");
	const pageSource = readProjectFile("components/blocks/agent-directory/page.tsx");

	assert.match(source, /export type AgentBrowserVariant = "default" \| "experimental";/u);
	assert.match(source, /variant\?: AgentBrowserVariant;/u);
	assert.match(source, /variant = "default"[\s\S]*<AgentBrowser \{\.\.\.browserProps\} variant=\{variant\} \/>/u);
	assert.match(source, /props\.variant === "experimental"[\s\S]*<ExperimentalAgentBrowser \{\.\.\.props\} \/>/u);
	assert.match(agentsDirectorySource, /variant\?: AgentsDirectoryVariant;/u);
	assert.match(agentsDirectorySource, /variant = "default"/u);
	assert.match(agentsDirectorySource, /variant === "experimental"[\s\S]*\? \{ \.\.\.sessionAgent, favorite: true \}[\s\S]*: sessionAgent/u);
	assert.match(agentsDirectorySource, /mergeDirectoryAgents\(\{ agents, sessionAgents, variant \}\)/u);
	assert.match(indexSource, /AgentsDirectoryVariant/u);
	assert.match(detailsSource, /title: "Experimental"[\s\S]*demoSlug: "agent-directory-demo-experimental"/u);
	assert.match(registrySource, /"agent-directory-demo-standard": dynamic[\s\S]*default: mod\.AgentsDirectoryDemoStandard/u);
	assert.match(registrySource, /"agent-directory-demo-experimental": dynamic[\s\S]*default: mod\.AgentsDirectoryDemoExperimental/u);
	assert.match(demoSource, /export function AgentsDirectoryDemoStandard/u);
	assert.match(demoSource, /export function AgentsDirectoryDemoExperimental/u);
	assert.match(pageSource, /export function AgentsDirectoryExperimentalPage/u);
	assert.match(pageSource, /variant="experimental"/u);
});

test("Agent Directory experimental variation has searchable multi-select filters and sections", () => {
	const source = readProjectFile("components/blocks/agent-browser/components/agent-browser.tsx");

	assert.match(source, /function ExperimentalAgentBrowser/u);
	assert.match(source, /function ExperimentalFilterDropdown/u);
	assert.match(source, /function ExperimentalAgentSection/u);
	assert.match(source, /<section aria-label=\{heading\} className="flex flex-col gap-2">/u);
	assert.match(source, /<h2 className="px-1\.5 text-xs font-semibold leading-4 text-text-subtlest">/u);
	assert.doesNotMatch(source, /<h2 style=\{\{ font: token\("font\.heading\.large"\) \}\} className="text-text">/u);
	// Pinned search + filter controls above a separate scroll region (only results
	// scroll; the top fade mask sits below the filter bar).
	assert.match(source, /"flex shrink-0 items-center gap-3 px-6 pt-1 pb-4"/u);
	assert.match(source, /"flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pt-2"/u);
	assert.match(source, /aria-pressed=\{selectedMyAgents\.length > 0 \? true : undefined\}[\s\S]*?Filter by my agents/u);
	assert.match(source, /Filter by teams/u);
	assert.match(source, /Filter by companies/u);
	assert.match(source, /Filter by categories/u);
	assert.match(source, /const teamOptions = useMemo\(\(\) => getAttributionOptions\(agents, "team"\), \[agents\]\);/u);
	assert.match(source, /const companyOptions = useMemo\(\(\) => getAttributionOptions\(agents, "company"\), \[agents\]\);/u);
	assert.match(source, /function ExperimentalFilterOptionAvatar/u);
	assert.match(source, /<ExperimentalFilterOptionAvatar option=\{option\} \/>/u);
	assert.match(source, /function ExperimentalAgentBrowser\(\{[\s\S]*initialTemplateCategory = null,[\s\S]*\}: Readonly<AgentBrowserProps>\)/u);
	assert.match(source, /const \[templateModeActive, setTemplateModeActive\] = useState\(Boolean\(initialTemplateCategory\)\);/u);
	assert.match(source, /const \[activeTemplateCategory, setActiveTemplateCategory\] = useState<AgentTemplateCategoryId \| null>\(initialTemplateCategory\);/u);
	// Mode switching now lives in an outline ToggleGroup next to the search input.
	assert.match(source, /import \{ ToggleGroup, ToggleGroupItem \} from "@\/components\/ui\/toggle-group";/u);
	assert.match(source, /<ToggleGroup[\s\S]*onValueChange=\{handleToggleMode\}[\s\S]*value=\{\[templateModeActive \? "templates" : "agents"\]\}[\s\S]*variant="outline"[\s\S]*<ToggleGroupItem value="agents">Agents<\/ToggleGroupItem>[\s\S]*<ToggleGroupItem value="templates">Templates<\/ToggleGroupItem>/u);
	assert.match(source, /function handleToggleMode\(groupValue: readonly string\[\]\)[\s\S]*handleEnterTemplateMode\(\)[\s\S]*resetFilters\(\)/u);
	assert.match(source, /placeholder="Search options"/u);
	assert.match(source, /<InputGroup className="pl-\[7px\]">[\s\S]*?<InputGroupAddon className="w-4 p-0">[\s\S]*?className="px-2"[\s\S]*?placeholder="Search options"/u);
	assert.match(source, /<Checkbox[\s\S]*checked=\{selectedValues\.includes\(option\.id\)\}/u);
	assert.match(source, /selectedCount > 0 \? <Badge>\{selectedCount\}<\/Badge> : null/u);
	assert.match(source, />\s*Reset\s*<\/Button>/u);
	assert.match(source, /Showing \{resultCount\.toLocaleString\("en-US"\)\} results/u);
	assert.match(source, /<div className="flex flex-col gap-6">[\s\S]*<ExperimentalAgentSection heading="My agents"/u);
	assert.match(source, /heading="My agents"/u);
	assert.match(source, /heading="By teams"/u);
	assert.match(source, /heading="By companies"/u);
	assert.match(source, /Agent templates/u);
	assert.match(source, /templateModeActive && activeTemplateCategoryOption \? \([\s\S]*<ExperimentalTemplateMode/u);
	assert.match(source, /function handleEnterTemplateMode\(\)[\s\S]*setTemplateModeActive\(true\);/u);
	assert.match(source, /function handleSelectTemplateCategory\(categoryId: AgentTemplateCategoryId\)/u);
});

test("Agent Directory includes Agent Template as a sidebar mode", () => {
	const source = readProjectFile("components/blocks/agent-browser/components/agent-browser.tsx");
	const agentsDirectorySource = readProjectFile("components/blocks/agent-directory/components/agent-directory.tsx");
	const agentTemplateSource = readProjectFile("components/blocks/agent-template/components/agent-template.tsx");
	const studioShellSource = readProjectFile("components/projects/studio/components/rovo-app-shell.tsx");

	assert.match(agentTemplateSource, /export const AGENT_TEMPLATE_CATEGORIES/u);
	assert.match(source, /AGENT_TEMPLATE_CATEGORIES/u);
	assert.match(source, /type AgentTemplateCategory/u);
	assert.match(source, /templateCategories\?: readonly AgentTemplateCategory\[\];/u);
	assert.match(source, /templateAgents\?: readonly AgentTemplateAgent\[\];/u);
	assert.match(source, /onSelectTemplateAgent\?: \(agent: AgentTemplateAgent\) => void;/u);
	assert.match(source, /<SidebarTemplateGroup[\s\S]*categories=\{templateCategories\}[\s\S]*onSelectCategory=\{onSelectTemplateCategory\}/u);
	assert.match(source, /Agent templates/u);
	assert.match(source, /<SidebarNavItem[\s\S]*isSelected=\{activeCategory === category\.id\}[\s\S]*label=\{category\.label\}[\s\S]*leading=\{<SidebarTemplateIcon category=\{category\} \/>\}/u);
	assert.match(source, /function SidebarTemplateIcon\(\{ category \}: Readonly<\{ category: AgentTemplateCategory \}>\)/u);
	assert.match(source, /src=\{category\.iconSrc\}/u);
	assert.match(source, /className=\{cn\("size-6 object-contain", category\.iconClassName\)\}/u);
	assert.match(source, /activeTemplateCategoryOption \? \(/u);
	assert.match(source, /activeTemplateCategoryOption \? \([\s\S]*<AnimatePresence custom=\{templateMotionCustom\} initial=\{false\} mode="wait">[\s\S]*<motion\.div[\s\S]*key=\{`template-title-\$\{activeTemplateCategoryOption\.id\}`\}[\s\S]*variants=\{STANDARD_AGENT_BROWSER_TEMPLATE_TITLE_VARIANTS\}[\s\S]*<TemplateCategoryTitle category=\{activeTemplateCategoryOption\} \/>/u);
	assert.match(source, /:\s*\([\s\S]*<Button variant="outline">[\s\S]*Sort by popularity/u);
	assert.doesNotMatch(source, /key="sort-button"[\s\S]*variants=\{AGENT_BROWSER_TEMPLATE_TITLE_VARIANTS\}/u);
	assert.match(source, /category\.titleLines\[0\]/u);
	assert.match(source, /category\.titleLines\[1\]/u);
	assert.match(source, /No templates match/u);
	assert.match(source, /activeTemplateCategoryOption \? \([\s\S]*<AnimatePresence custom=\{templateMotionCustom\} initial=\{false\} mode="wait">[\s\S]*<motion\.section[\s\S]*aria-label="Agent templates"[\s\S]*key=\{`templates-\$\{activeTemplateCategoryOption\.id\}`\}[\s\S]*variants=\{STANDARD_AGENT_BROWSER_TEMPLATE_GRID_VARIANTS\}[\s\S]*<AgentTemplateSection[\s\S]*onSelectAgent=\{onSelectTemplateAgent\}/u);
	assert.match(source, /EntityCardAgentExpandedCard/u);
	assert.match(source, /function ExperimentalTemplateMode/u);
	assert.match(source, /<div className="mt-2 flex flex-col gap-2">/u);
	assert.match(source, /aria-label="Template categories"/u);
	assert.match(source, /role="group"/u);
	assert.match(source, /function ExperimentalTemplateCategoryButton/u);
	assert.match(source, /function ExperimentalTemplateCarouselControl/u);
	assert.match(source, /data-agent-templates-carousel/u);
	assert.match(source, /scrollElement\.scrollBy\(\{/u);
	assert.match(source, /className="relative -mx-6 overflow-x-clip overflow-y-visible"/u);
	assert.match(source, /className="overflow-x-auto overflow-y-visible \[scrollbar-width:none\] \[&::-webkit-scrollbar\]:hidden"/u);
	// Locked-height dialog hugs the template card's natural content: the carousel track
	// and cards stay at content height (items-start, no h-full stretch) so the card is
	// never padded into dead space; the dialog lock makes the Agents grid match by
	// scrolling inside the same box.
	assert.match(source, /className="flex w-max items-start gap-4 px-6 pt-2 pb-6"/u);
	assert.match(source, /className="w-90 shrink-0 \[will-change:transform,opacity\]"/u);
	assert.doesNotMatch(source, /className="flex h-full w-max items-stretch gap-4 px-6 pt-2 pb-6"/u);
	assert.doesNotMatch(source, /className="h-full min-h-0 w-90 shrink-0 \[will-change:transform,opacity\]"/u);
	assert.match(source, /const \[activeSetupAgentIds, setActiveSetupAgentIds\] = useState<ReadonlySet<string>>\(\(\) => new Set\(\)\);/u);
	assert.match(source, /function handleOpenSetupAgent\(agentId: string\) \{[\s\S]*const nextAgentIds = new Set\(currentAgentIds\);[\s\S]*nextAgentIds\.add\(agentId\);[\s\S]*return nextAgentIds;/u);
	assert.match(source, /function handleCancelSetupAgent\(agentId: string\) \{[\s\S]*const nextAgentIds = new Set\(currentAgentIds\);[\s\S]*nextAgentIds\.delete\(agentId\);[\s\S]*return nextAgentIds;/u);
	assert.match(source, /activeSetupAgentIds\.has\(agent\.id\) \? \([\s\S]*<TemplateBuildFlow[\s\S]*agent=\{agent\}[\s\S]*onCancel=\{\(\) => handleCancelSetupAgent\(agent\.id\)\}[\s\S]*onBuildAgent=\{onBuildAgent\}[\s\S]*onOpenBuiltAgent=\{handleOpenBuiltAgent\}/u);
	assert.match(source, /<ExperimentalTemplateCard[\s\S]*agent=\{agent\}[\s\S]*onSelectAgent=\{\(\) => handleOpenSetupAgent\(agent\.id\)\}/u);
	assert.doesNotMatch(source, /activeSetupAgentId\b/u);
	assert.doesNotMatch(source, /setActiveSetupAgentId\b/u);
	assert.match(source, /<ExperimentalDirectoryCard[\s\S]*className="w-full"[\s\S]*variant="expanded"/u);
	assert.match(source, /className="h-\[400px\] \[will-change:transform,opacity\]"/u);
	assert.match(source, /<ul className="grid grid-cols-1 gap-3 md:grid-cols-2">/u);
	assert.match(source, /AGENT_BROWSER_TEMPLATE_MAX_VISIBLE_AGENTS = 8/u);
	assert.match(source, /AGENT_BROWSER_TEMPLATE_CARD_STAGGER = 0\.05/u);
	assert.match(source, /translateX/u);
	assert.match(source, /const AGENT_BROWSER_TEMPLATE_GRID_VARIANTS = \{[\s\S]*enter: \(\{ direction, shouldReduceMotion \}: AgentBrowserTemplateMotionCustom\) => \(\{[\s\S]*translateX\(\$\{AGENT_BROWSER_TEMPLATE_DECK_SWAP_OFFSET \* direction\}px\)[\s\S]*center: \{[\s\S]*translateX\(0px\)/u);
	assert.match(source, /const STANDARD_AGENT_BROWSER_TEMPLATE_TITLE_VARIANTS = \{[\s\S]*translateY\(\$\{AGENT_BROWSER_TEMPLATE_TITLE_SWAP_OFFSET \* direction\}px\)[\s\S]*center: \{[\s\S]*translateY\(0px\)/u);
	assert.match(source, /const STANDARD_AGENT_BROWSER_TEMPLATE_GRID_VARIANTS = \{[\s\S]*translateY\(\$\{AGENT_BROWSER_TEMPLATE_DECK_SWAP_OFFSET \* direction\}px\)[\s\S]*center: \{[\s\S]*translateY\(0px\)/u);
	assert.match(source, /translateX\(\$\{motionCustom\.direction \* AGENT_BROWSER_TEMPLATE_CARD_ENTER_OFFSET\}px\)/u);
	assert.match(source, /const handleSelectCategory = \(category: string\) => \{[\s\S]*setActiveTemplateCategory\(null\);[\s\S]*setActiveCategory\(category\);[\s\S]*\};/u);
	assert.match(agentsDirectorySource, /DEMO_AGENT_TEMPLATES/u);
	assert.match(agentsDirectorySource, /DEMO_AGENT_TEMPLATES_SESSION/u);
	assert.match(agentsDirectorySource, /templateAgents = DEMO_AGENT_TEMPLATES/u);
	assert.match(agentsDirectorySource, /sessionTemplateAgents = DEMO_AGENT_TEMPLATES_SESSION/u);
	assert.match(agentsDirectorySource, /onSelectTemplateAgent=\{onSelectTemplateAgent\}/u);
	assert.match(studioShellSource, /onSelectTemplateAgent=\{handleTemplateAgentSelect\}/u);
});

test("Agent Directory experimental templates use the setup flow before opening config", () => {
	const source = readProjectFile("components/blocks/agent-browser/components/agent-browser.tsx");
	const agentsDirectorySource = readProjectFile("components/blocks/agent-directory/components/agent-directory.tsx");
	const greetingPromptRowSource = readProjectFile("components/projects/shared/components/greeting-prompt-row.tsx");
	const indexSource = readProjectFile("components/blocks/agent-directory/index.ts");
	const studioShellSource = readProjectFile("components/projects/studio/components/rovo-app-shell.tsx");
	const tailwindThemeSource = readProjectFile("app/tailwind-theme.css");

	assert.match(source, /import \{ TemplateBuildFlow \} from "@\/components\/blocks\/agent-browser\/components\/template-build-flow";/u);
	assert.match(source, /import \{ AnimatePresence, cubicBezier, motion, useReducedMotion \} from "motion\/react";/u);
	assert.doesNotMatch(source, /import \{ GreetingPromptRow \} from "@\/components\/projects\/shared\/components\/greeting-prompt-row";/u);
	assert.doesNotMatch(source, /import \{ ProgressTracker, type ProgressTrackerStep \} from "@\/components\/ui\/progress-tracker";/u);
	assert.doesNotMatch(source, /import \{ getAppById, type DirectoryApp \} from "@\/app\/data\/directory\/apps";/u);
	assert.doesNotMatch(source, /import \{ AtlassianLogoMark, BrandLogoMark \} from "@\/components\/ui\/logo-mark";/u);
	assert.doesNotMatch(source, /import \{ IconTile \} from "@\/components\/ui\/icon-tile";/u);
	assert.doesNotMatch(source, /import \{ TwgToolSourceIcon \} from "@\/components\/ui-custom\/twg-tool";/u);
	assert.doesNotMatch(source, /import StatusSuccessIcon from "@atlaskit\/icon\/core\/status-success";/u);
	assert.match(source, /export interface AgentBrowserTemplateBuildOptions/u);
	assert.match(source, /export interface AgentBrowserTemplateBuildResult \{[\s\S]*profileId: string;[\s\S]*onCancel\?: \(\) => void;/u);
	assert.match(source, /onBuildTemplateAgent\?: \([\s\S]*agent: AgentTemplateAgent,[\s\S]*options: AgentBrowserTemplateBuildOptions[\s\S]*\) => AgentBrowserTemplateBuildResult \| null;/u);
	assert.match(source, /onOpenBuiltTemplateAgentConfig\?: \(profileId: string\) => void;/u);
	assert.doesNotMatch(source, /function ExperimentalTemplateSetupCard/u);
	assert.match(source, /activeSetupAgentIds\.has\(agent\.id\) \? \([\s\S]*<TemplateBuildFlow[\s\S]*agent=\{agent\}[\s\S]*onCancel=\{\(\) => handleCancelSetupAgent\(agent\.id\)\}[\s\S]*onBuildAgent=\{onBuildAgent\}[\s\S]*onOpenBuiltAgent=\{handleOpenBuiltAgent\}/u);

	// Per-step bylines were removed so build-progress rows stay uniform height and
	// the checkmark icons are evenly spaced in every phase.
	assert.match(greetingPromptRowSource, /selected\?: boolean;/u);
	assert.match(greetingPromptRowSource, /selected = false,/u);
	assert.match(greetingPromptRowSource, /grid h-11 w-full grid-cols-\[32px_minmax\(0,1fr\)_auto\] items-center gap-3 rounded-xl pl-1\.5 pr-3\.5 text-left transition-colors/u);
	assert.match(greetingPromptRowSource, /selected[\s\S]*\? "bg-bg-selected hover:bg-bg-selected-hovered active:bg-bg-selected-pressed"[\s\S]*: "hover:bg-bg-neutral-subtle-hovered"/u);
	assert.match(greetingPromptRowSource, /aria-pressed=\{selected \|\| undefined\}/u);
	assert.doesNotMatch(source, /<MotionConfig/u);
	assert.match(tailwindThemeSource, /@utility template-build-progress-spinner/u);
	assert.match(tailwindThemeSource, /@keyframes template-build-progress-spinner-rotate/u);
	assert.match(tailwindThemeSource, /@keyframes template-build-progress-spinner-dash/u);
	assert.match(tailwindThemeSource, /template-build-progress-spinner-rotate 1s linear infinite/u);
	assert.match(tailwindThemeSource, /template-build-progress-spinner-dash 1s ease-out infinite/u);
	assert.match(source, /if \(onOpenBuiltAgentConfig\) \{[\s\S]*onOpenBuiltAgentConfig\(profileId\);[\s\S]*return;[\s\S]*onSelectAgent\?\.\(agent\);/u);
	assert.match(source, /<AgentTemplateSection[\s\S]*onSelectAgent=\{onSelectTemplateAgent\}/u);
	assert.match(agentsDirectorySource, /onBuildTemplateAgent\?: \([\s\S]*agent: AgentsDirectoryTemplateAgent,[\s\S]*options: AgentsDirectoryTemplateBuildOptions/u);
	assert.match(agentsDirectorySource, /onOpenBuiltTemplateAgentConfig\?: \(profileId: string\) => void;/u);
	assert.match(agentsDirectorySource, /onBuildTemplateAgent=\{onBuildTemplateAgent\}/u);
	assert.match(agentsDirectorySource, /onOpenBuiltTemplateAgentConfig=\{onOpenBuiltTemplateAgentConfig\}/u);
	assert.match(indexSource, /AgentsDirectoryTemplateBuildOptions/u);
	assert.match(indexSource, /AgentsDirectoryTemplateBuildResult/u);
	assert.match(studioShellSource, /onBuildTemplateAgent=\{handleBuildTemplateAgent\}/u);
	assert.match(studioShellSource, /onOpenBuiltTemplateAgentConfig=\{handleOpenBuiltTemplateAgentConfig\}/u);
});

test("Agent Directory sidebar nav uses the shared SidebarNavItem primitive", () => {
	const source = readProjectFile("components/blocks/agent-browser/components/agent-browser.tsx");
	const sidebarNavItemSource = readProjectFile("components/ui-custom/sidebar-nav-item.tsx");

	assert.match(
		source,
		/import \{ SidebarNavItem \} from "@\/components\/ui-custom\/sidebar-nav-item";/u,
	);
	assert.match(source, /import AlignTextLeftIcon from "@atlaskit\/icon\/core\/align-text-left";/u);
	assert.match(source, /import \{ Avatar, AvatarImage \} from "@\/components\/ui\/avatar";/u);
	assert.match(source, /import \{ AtlassianLogo, type AtlassianLogoName \} from "@\/components\/ui\/logo";/u);
	assert.match(source, /import \{ Tile \} from "@\/components\/ui\/tile";/u);
	assert.match(
		source,
		/<SidebarNavItem label=\{label\} isSelected=\{active\} onClick=\{onClick\} \/>/u,
	);
	assert.match(source, /<SidebarNavItem[\s\S]*label=\{item\.label\}[\s\S]*leading=\{<SidebarItemAvatar item=\{item\} \/>\}[\s\S]*onClick=\{agent \? \(\) => onSelectAgent\?\.\(agent\) : undefined\}/u);
	assert.match(source, /function SidebarItemAvatar\(\{ item \}: Readonly<\{ item: AgentBrowserSidebarItem \}>\)/u);
	// Atlassian's transparent brand mark gets a bordered Tile container so company
	// sidebar rows read consistently with the 3p logos (which carry their own tile).
	assert.match(source, /if \(item\.logoName\)[\s\S]*<Tile label=\{item\.label\} variant="transparent" size="small" hasBorder className="shrink-0">[\s\S]*<AtlassianLogo name=\{item\.logoName\} label=\{item\.label\} size="xsmall" themeAware \/>[\s\S]*<\/Tile>/u);
	assert.match(source, /if \(item\.avatarSrc\?\.startsWith\("\/avatar-project\/"\)\)/u);
	assert.match(source, /if \(option\.avatarSrc\?\.startsWith\("\/avatar-project\/"\)\)[\s\S]*<Tile aria-hidden label="" variant="transparent" size="small" isSnug className="shrink-0">[\s\S]*<Image alt="" aria-hidden className="rounded-md border border-border object-cover" height=\{20\} src=\{option\.avatarSrc\} width=\{20\} \/>[\s\S]*<\/Tile>/u);
	assert.match(source, /<Tile aria-hidden label="" variant="transparent" size="small" isSnug className="shrink-0">[\s\S]*<Image alt="" aria-hidden className="rounded-md border border-border object-cover" height=\{20\} src=\{item\.avatarSrc\} width=\{20\} \/>[\s\S]*<\/Tile>/u);
	assert.match(source, /<Avatar size="sm" shape="square" className="shrink-0 after:border-0">/u);
	assert.match(source, /export interface AgentBrowserSidebarItem/u);
	assert.match(source, /items\?: readonly AgentBrowserSidebarItem\[\];/u);
	assert.match(source, /showAll\?: boolean;/u);
	assert.match(source, /function getSidebarGroupItems/u);
	assert.match(source, /showAll=\{group\.showAll\}/u);
	assert.match(source, /label="Show all"[\s\S]*leading=\{<AlignTextLeftIcon label="" size="small" \/>\}[\s\S]*leadingSize="medium"/u);
	assert.doesNotMatch(source, /className="flex w-full items-center gap-2 rounded-xs px-3 py-1\.5/u);
	assert.doesNotMatch(source, /aria-current=\{active \? "page" : undefined\}/u);
	assert.match(
		sidebarNavItemSource,
		/data-slot="sidebar-nav-item-content" className="min-w-0 flex-1 pl-0\.5"/u,
	);
});

test("Agent Directory uses independent column scrolling without extra content padding", () => {
	const source = readProjectFile("components/blocks/agent-browser/components/agent-browser.tsx");

	assert.match(source, /"grid max-h-\[calc\(100svh-2rem\)\] grid-rows-\[auto_minmax\(0,1fr\)\] gap-0 overflow-hidden p-0 sm:max-w-\[1200px\]"/u);
	assert.match(source, /isExperimental[\s\S]*\? "h-\[min\(727px,calc\(100svh-2rem\)\)\]"[\s\S]*: "h-\[min\(800px,calc\(100svh-2rem\)\)\]"/u);
	assert.doesNotMatch(source, /\? "h-auto"/u);
	assert.doesNotMatch(source, /h-\[min\(765px,calc\(100svh-2rem\)\)\]/u);
	assert.doesNotMatch(source, /h-\[min\(920px,calc\(100svh-2rem\)\)\] sm:max-w-\[1440px\]/u);
	assert.doesNotMatch(source, /max-h-\[85vh\]/u);
	assert.doesNotMatch(source, /className="grid max-h-\[800px\] grid-rows-\[auto_minmax\(0,1fr\)\] gap-0 p-0 sm:max-w-\[1200px\]"/u);
	assert.match(source, /<div className="min-h-0 overflow-hidden">/u);
	assert.match(source, /<div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-\[280px_minmax\(0,1fr\)\]">/u);
	assert.match(source, /import \{ useHasVerticalOverflow \} from "@\/components\/hooks\/use-has-vertical-overflow";/u);
	assert.match(source, /const contentOverflow = useHasVerticalOverflow<HTMLDivElement>\(\);/u);
	assert.match(source, /ref=\{contentOverflow\.ref\}/u);
	assert.match(source, /"flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto px-6 pt-1 pb-8 md:pl-4"/u);
	assert.match(source, /contentOverflow\.showTopScrollMask && "scroll-mask-top overscroll-contain"/u);
	assert.match(source, /const sidebarOverflow = useHasVerticalOverflow<HTMLElement>\(\);/u);
	assert.match(source, /"hidden min-h-0 w-\[280px\] shrink-0 flex-col gap-4 overflow-y-auto pl-6 md:flex"/u);
	assert.match(source, /aria-label="Agent categories"[\s\S]*sidebarOverflow\.showTopScrollMask && "scroll-mask-top overscroll-contain"[\s\S]*ref=\{sidebarOverflow\.ref\}/u);
	assert.match(readProjectFile("components/hooks/use-has-vertical-overflow.ts"), /scrollHeight - element\.clientHeight > 1/u);
	assert.match(readProjectFile("components/hooks/use-has-vertical-overflow.ts"), /scrollTop > 1/u);
	assert.match(readProjectFile("components/hooks/use-has-vertical-overflow.ts"), /showTopScrollMask: hasVerticalOverflow && hasScrolledFromTop/u);
	assert.match(readProjectFile("app/tailwind-theme.css"), /@utility scroll-mask-top/u);
	assert.doesNotMatch(source, /overflow-y-auto px-6 pt-6 pb-6/u);
	assert.doesNotMatch(source, /overflow-y-auto pl-6 pt-6/u);
	assert.match(source, /<ul className="flex w-64 flex-col">/u);
	assert.doesNotMatch(source, /<ul className="[^"]*gap-0\.5/u);
	assert.match(source, /<div className="flex w-64 flex-col gap-1\.5">/u);
	assert.match(source, /import \{ token \} from "@\/lib\/tokens";/u);
	assert.match(
		source,
		/<p style=\{\{ font: token\("font\.heading\.xxsmall"\) \}\} className="px-1\.5 text-text-subtlest">/u,
	);
	assert.match(source, /<Button variant="outline">\s*Sort by popularity/u);
	assert.doesNotMatch(source, /<Button variant="outline" size=/u);
	assert.doesNotMatch(source, /<Button variant="outline"[^>]*className=/u);
	assert.doesNotMatch(source, /<SidebarNavItem[^>]+className=/u);
	assert.doesNotMatch(source, /Agent categories" className="[^"]*\bpr-\d/u);
	assert.doesNotMatch(source, /<p className="px-3 text-xs font-semibold uppercase leading-4 tracking-wide text-text-subtlest">/u);
	assert.doesNotMatch(source, /text-xs font-semibold uppercase leading-4 tracking-wide text-text-subtlest/u);
	assert.doesNotMatch(source, /<div className="min-h-0 overflow-y-auto px-6 pb-6">/u);
	assert.doesNotMatch(source, /<div className="min-h-0 min-w-0 flex-1 overflow-y-auto pb-6 pr-1">/u);
	assert.doesNotMatch(source, /<div className="flex min-w-0 flex-col gap-5 pr-5">/u);
	assert.doesNotMatch(source, /overflow-y-auto pb-6 pr-1/u);
	assert.doesNotMatch(source, /sticky top-0/u);
});

test("Agent Directory uses one unsegmented results grid and updated sidebar labels", () => {
	const source = readProjectFile("components/blocks/agent-browser/components/agent-browser.tsx");
	const defaultSidebarGroupsSource = readProjectFile("components/blocks/agent-directory/data/sidebar-groups.ts");
	// The agent-browser sidebar groups + directory catalog now live in the unified
	// agents data layer (DEMO_AGENT_BROWSER_SIDEBAR_GROUPS salvaged verbatim there).
	const agentsLoaderSource = readProjectFile("app/data/directory/agents.ts");
	const agentsDirectorySource = readProjectFile("components/blocks/agent-directory/components/agent-directory.tsx");
	const agentsJson = JSON.parse(readProjectFile("app/data/directory/agents.json"));
	const pageSource = readProjectFile("components/blocks/agent-directory/page.tsx");

	assert.match(source, /<AgentSection agents=\{filtered\} key=\{`agents-\$\{activeCategory\}`\} onSelectAgent=\{onSelectAgent\} \/>/u);
	assert.match(source, /favorite\?: boolean;/u);
	assert.match(source, /label: "Favourite agents"/u);
	assert.match(source, /if \(activeCategory === "favorite-agents" && !agent\.favorite\) return false;/u);
	assert.match(agentsDirectorySource, /function mergeDirectoryAgents/u);
	assert.match(agentsDirectorySource, /const existingAgent = byId\.get\(sessionAgent\.id\);/u);
	assert.match(agentsDirectorySource, /rating: normalizedSessionAgent\.rating \?\? existingAgent\?\.rating/u);
	assert.match(source, /<section aria-label="Agents">/u);
	assert.doesNotMatch(source, /recommendedCount/u);
	assert.doesNotMatch(source, /DEFAULT_RECOMMENDED_COUNT/u);
	assert.doesNotMatch(source, /const recommended = filtered\.slice/u);
	assert.doesNotMatch(source, /const rest = filtered\.slice/u);
	assert.doesNotMatch(source, /title="Recommended"/u);
	assert.doesNotMatch(source, /title="All agents"/u);
	assert.doesNotMatch(source, />\s*\{title\}\s*<\/h2>/u);

	for (const groupsSource of [defaultSidebarGroupsSource, agentsLoaderSource]) {
		assert.doesNotMatch(groupsSource, /title: "Favourites"/u);
		assert.match(groupsSource, /title: "By teams"/u);
		assert.match(groupsSource, /title: "By teams",\n\t\tshowAll: true/u);
		assert.match(groupsSource, /label: "Product Experience"/u);
		assert.match(groupsSource, /avatarSrc: "\/avatar-project\/compass\.svg"/u);
		assert.match(groupsSource, /label: "Platform Engineering"/u);
		assert.match(groupsSource, /avatarSrc: "\/avatar-project\/code\.svg"/u);
		assert.match(groupsSource, /label: "Customer Success"/u);
		assert.match(groupsSource, /avatarSrc: "\/avatar-project\/service-bell\.svg"/u);
		assert.match(groupsSource, /label: "Revenue Operations"/u);
		assert.match(groupsSource, /avatarSrc: "\/avatar-project\/graph\.svg"/u);
		assert.match(groupsSource, /title: "By companies"/u);
		assert.match(groupsSource, /title: "By companies",\n\t\tshowAll: true/u);
		assert.doesNotMatch(groupsSource, /By my teams/u);
		assert.doesNotMatch(groupsSource, /By partners/u);
	}

	assert.match(source, /attributionKind\?: "company" \| "team" \| "person";/u);
	assert.match(source, /rating\?: number;/u);
	assert.match(source, /feedbackCount\?: number;/u);
	assert.match(source, /chatCount\?: number;/u);
	assert.match(source, /verified\?: boolean;/u);
	assert.doesNotMatch(source, /function isVerified/u);
	// The unified catalog carries every attribution kind (company/team/person).
	for (const kind of ["company", "team", "person"]) {
		assert.ok(
			agentsJson.some((agent) => agent.attributionKind === kind),
			`unified catalog should have a ${kind}-attributed agent`,
		);
	}
	for (const agent of agentsJson) {
		assert.equal(typeof agent.rating, "number", `agent ${agent.id} should have rating`);
		assert.equal(typeof agent.feedbackCount, "number", `agent ${agent.id} should have feedbackCount`);
		assert.equal(typeof agent.chatCount, "number", `agent ${agent.id} should have chatCount`);
		assert.equal(typeof agent.verified, "boolean", `agent ${agent.id} should have verified`);
	}
	const rfpDrafter = agentsJson.find((agent) => agent.id === "rfp-drafting-agent");
	assert.ok(rfpDrafter, "RFP Drafter should exist in the unified catalog");
	assert.deepEqual(
		{
			name: rfpDrafter.name,
			byline: rfpDrafter.byline,
			avatarSrc: rfpDrafter.avatarSrc,
			description: rfpDrafter.description,
			attributionKind: rfpDrafter.attributionKind,
			favorite: rfpDrafter.favorite,
			rating: rfpDrafter.rating,
			feedbackCount: rfpDrafter.feedbackCount,
			chatCount: rfpDrafter.chatCount,
			verified: rfpDrafter.verified,
		},
		{
			name: "RFP Drafter",
			byline: "Custom agent by Maya Chen",
			avatarSrc: "/avatar-agent-new/lime/feature-flag.svg",
			description: "Drafts first-pass RFP response packages for Enterprise RFP Response",
			attributionKind: "person",
			favorite: true,
			rating: 4.1,
			feedbackCount: 1370,
			chatCount: 8364,
			verified: false,
		},
	);
	assert.match(pageSource, /attributionKind: "team"/u);
	assert.match(pageSource, /attributionKind: "person"/u);
	assert.match(pageSource, /by Revenue Operations/u);
	assert.match(pageSource, /by Alex Kim/u);
	// The directory demo page's session agents use descriptive bylines, not generic labels.
	assert.doesNotMatch(pageSource, /Custom agent/u);
});

test("Agent Directory cards render the shared EntityCardAgentCard with overlay elevation", () => {
	const source = readProjectFile("components/blocks/agent-browser/components/agent-browser.tsx");
	const entityAgentSource = readProjectFile("components/ui-custom/entity-card/agent.tsx");

	// Cards are delegated to the shared ui-custom component — no inlined shell duplication.
	assert.match(source, /EntityCardAgentCard,[\s\S]*EntityCardAgentExpandedCard,[\s\S]*from "@\/components\/ui-custom\/entity-card";/u);
	assert.match(source, /function AgentCard\(\{ agent, onSelectAgent, publisher \}: Readonly<AgentCardProps>\)/u);
	assert.match(source, /const \[moreMenuOpen, setMoreMenuOpen\] = useState\(false\);/u);
	assert.match(source, /<EntityCardAgentCard[\s\S]*active=\{moreMenuOpen\}[\s\S]*avatarSrc=\{getDirectoryCardAvatarSrc\(agent\)\}[\s\S]*insetLogo=\{isBorderlessHexagonAgent\(agent\)\}/u);
	assert.match(source, /chatCount=\{agent\.chatCount\}/u);
	assert.match(source, /feedbackCount=\{agent\.feedbackCount\}/u);
	assert.match(source, /rating=\{agent\.rating\}/u);
	assert.match(source, /verified=\{agent\.verified\}/u);
	assert.doesNotMatch(source, /syntheticRating/u);
	assert.doesNotMatch(source, /syntheticChats/u);
	assert.doesNotMatch(source, /syntheticFeedback/u);
	assert.match(source, /className="hover:border-transparent"/u);
	assert.match(source, /onSelect=\{selectAgent\}/u);
	assert.match(source, /<DirectoryCardMoreMenu[\s\S]*onOpenChange=\{setMoreMenuOpen\}[\s\S]*open=\{moreMenuOpen\}/u);
	assert.match(source, /aria-pressed=\{open \|\| undefined\}/u);
	assert.match(entityAgentSource, /logoName\?: AtlassianLogoName;/u);
	assert.match(entityAgentSource, /size=\{logoName === "atlassian" \? "xsmall" : "medium"\}/u);
	assert.doesNotMatch(source, /AgentDirectoryCard/u);
	assert.doesNotMatch(source, /AGENT_CARD_OVERLAY_SHADOW/u);
	assert.match(source, /import \{ AnimatePresence, cubicBezier, motion, useReducedMotion \} from "motion\/react";/u);

	// Self-contained third-party marks render in a borderless hexagon, inset to 16x16.
	assert.match(source, /const BORDERLESS_HEXAGON_AGENT_IDS: ReadonlySet<string> = new Set\(\["google-drive", "slack", "notion"\]\);/u);
	assert.match(source, /function isBorderlessHexagonAgent\(agent: AgentBrowserAgent\): boolean/u);
	assert.match(source, /return BORDERLESS_HEXAGON_AGENT_IDS\.has\(agent\.id\);/u);
	// Borderless agents swap to their purpose-built 16px tile on the card.
	assert.match(source, /function getDirectoryCardAvatarSrc\(agent: AgentBrowserAgent\): string \| undefined/u);
	assert.match(source, /return `\/3p\/\$\{agent\.id\}\/16-borderless\.svg`;/u);

	// The hover/elevation/keyboard contract now lives in the shared shell + agent wrapper.
	const shell = readProjectFile("components/ui-custom/entity-card/card.tsx");
	const interaction = readProjectFile("components/ui-custom/entity-card/use-card-interaction.ts");
	const agentWrapper = readProjectFile("components/ui-custom/entity-card/variants.tsx");
	const entityAgent = readProjectFile("components/ui-custom/entity-card/agent.tsx");

	assert.match(interaction, /token\("elevation\.shadow\.overlay"\)/u);
	assert.match(interaction, /boxShadow: OVERLAY_SHADOW/u);
	assert.doesNotMatch(interaction, /scale: 1\.006/u);
	assert.match(interaction, /type: "spring",[\s\S]*bounce: 0\.16,[\s\S]*visualDuration: 0\.22/u);
	assert.match(shell, /group\/card relative flex h-full w-full flex-col gap-3 rounded-md bg-surface-overlay p-4/u);
	assert.match(shell, /after:pointer-events-none after:absolute after:inset-0 after:z-20 after:rounded-md after:border after:transition-colors/u);
	assert.match(shell, /after:border-border hover:after:border-transparent has-\[\[data-slot=card-directory-select\]:focus-visible\]:after:border-transparent/u);
	// Focus styling keys off the overlay select button's focus-visible (#709): the shared
	// shell no longer makes the whole card a role="button", so nested controls stay valid.
	assert.match(shell, /has-\[\[data-slot=card-directory-select\]:focus-visible\]:ring-3 has-\[\[data-slot=card-directory-select\]:focus-visible\]:ring-ring\/50/u);
	assert.match(shell, /willChange: "transform"/u);
	assert.doesNotMatch(shell, /role="button"/u);
	assert.match(shell, /data-slot="card-directory-select"[\s\S]*type="button"/u);
	assert.match(shell, /whileTap: interactive \? tapAnimation : undefined/u);

	assert.match(agentWrapper, /<EntityCardShell active=\{active\} className=\{cn\("gap-4", className\)\}/u);
	assert.match(agentWrapper, /action=\{moreAction\}/u);
	assert.match(agentWrapper, /onMoreActions=\{onMoreActions\}/u);
	assert.match(agentWrapper, /<EntityCardAgent\b/u);
	assert.match(entityAgent, /shape="hexagon"/u);
	assert.match(entityAgent, /<EntityCardMoreButton active=\{active\}/u);
	assert.match(entityAgent, /<div className="flex flex-col gap-2">[\s\S]*<EntityCardHeader[\s\S]*<EntityCardDescription>/u);
	assert.match(entityAgent, /<EntityCardByline/u);
	assert.match(entityAgent, /StarUnstarredIcon/u);
	assert.match(entityAgent, /AiChatIcon/u);

	assert.doesNotMatch(shell, /hover:-translate-y/u);
	assert.doesNotMatch(shell, /hover:shadow-2xl/u);
});

test("Agent Directory experimental cards use the latest blocks/agent-card variants", () => {
	const source = readProjectFile("components/blocks/agent-browser/components/agent-browser.tsx");
	const card = readProjectFile("components/blocks/agent-card/components/agent-card.tsx");
	const cardParts = readProjectFile("components/blocks/agent-card/components/agent-card-parts.tsx");

	// The experimental browser renders the standalone agent-card block (aliased to
	// avoid clashing with the local default-card wrapper).
	assert.match(source, /import \{ AgentCard as ExperimentalDirectoryCard \} from "@\/components\/blocks\/agent-card";/u);

	// Built (normal) agents -> experimental-profile, with the more-menu kept.
	assert.match(source, /function ExperimentalProfileCard/u);
	assert.match(source, /<ExperimentalProfileCard agent=\{agent\} onSelectAgent=\{onSelectAgent\} \/>/u);
	assert.match(source, /variant="experimental-profile"/u);
	assert.match(source, /avatarSrc=\{getDirectoryCardAvatarSrc\(agent\)\}/u);
	assert.match(source, /insetLogo=\{isBorderlessHexagonAgent\(agent\)\}/u);
	assert.match(source, /logoName=\{agent\.logoName\}/u);
	assert.match(source, /moreAction=\{[\s\S]*<DirectoryCardMoreMenu[\s\S]*label=\{`More actions for \$\{agent\.name\}`\}[\s\S]*open=\{moreMenuOpen\}/u);
	assert.match(source, /active=\{moreMenuOpen\}/u);

	// Templates -> expanded, mapped 1:1 from the template agent shape.
	assert.match(source, /<ExperimentalDirectoryCard[\s\S]*variant="expanded"/u);
	assert.match(source, /capabilities=\{agent\.capabilities \?\? EMPTY_TEMPLATE_CAPABILITIES\}/u);

	// The card exposes the moreAction slot + active passthrough, and the cover
	// illustration clears on hover only when there is a more action to reveal.
	assert.match(card, /moreAction\?: ReactNode;/u);
	assert.match(card, /insetLogo\?: boolean;/u);
	assert.match(card, /logoName\?: AtlassianLogoName;/u);
	assert.match(card, /const EXPERIMENTAL_VERIFIED_ICON_CLASS_NAME = "text-white";/u);
	assert.match(card, /const displayStats = stats\.filter\(\(stat\) => !isRemixStat\(stat\)\);/u);
	assert.match(card, /function isLastUpdateStat\(stat: \{ label: string \}\): boolean/u);
	assert.match(card, /<ClockIcon label="" size="small" spacing="none" color="currentColor" \/>/u);
	assert.match(card, /formatAgentCardStatText\(stat\)/u);
	assert.match(card, /className="pointer-events-auto relative z-10 flex min-h-0 flex-auto flex-col gap-3 overflow-y-auto px-4 pt-4 pb-4 text-text \[scrollbar-gutter:stable\]"/u);
	assert.match(card, /const hasMoreAction = Boolean\(moreAction\) \|\| Boolean\(onMoreActions\);/u);
	assert.match(card, /hasMoreAction[\s\S]*group-hover\/card:opacity-0/u);
	assert.match(card, /\{moreAction \?\? \(onMoreActions \?/u);
	assert.match(cardParts, /className="absolute inset-0 z-0 cursor-pointer rounded-md outline-none"/u);
	assert.match(cardParts, /data-slot="agent-card-select"/u);
});

test("Agent Card expanded template uses the shared template detail body without a footer CTA", () => {
	const card = readProjectFile("components/blocks/agent-card/components/agent-card.tsx");
	const cardParts = readProjectFile("components/blocks/agent-card/components/agent-card-parts.tsx");
	const demo = readProjectFile("components/website/demos/blocks/agent-card-demo.tsx");
	const page = readProjectFile("components/blocks/agent-card/page.tsx");
	const details = readDetailCategorySource("blocks");
	const theme = readProjectFile("app/tailwind-theme.css");

	assert.match(card, /const expandedStats = stats\.slice\(0, 2\);/u);
	assert.match(card, /const showExpandedInlineStats = expandedStats\.length > 0 \|\| showRating \|\| showChats;/u);
	assert.match(cardParts, /hoverShadow\?: "default" \| "none";/u);
	assert.match(cardParts, /const hoverAnimation = hoverShadow === "default" \? \(\{ boxShadow: OVERLAY_SHADOW \} as const\) : undefined;/u);
	assert.match(card, /const EXPANDED_TICKET_TOP_MASK_IMAGE = \[/u);
	assert.match(card, /radial-gradient\(circle 8px at 0 100%, transparent 0 7\.5px, black 8px\)/u);
	assert.match(card, /const EXPANDED_TICKET_BOTTOM_MASK_IMAGE = \[/u);
	assert.match(card, /radial-gradient\(circle 8px at 0 0, transparent 0 7\.5px, black 8px\)/u);
	assert.match(card, /maskComposite: "intersect"/u);
	assert.match(card, /WebkitMaskComposite: "source-in"/u);
	assert.match(card, /maskImage: EXPANDED_TICKET_TOP_MASK_IMAGE/u);
	assert.match(card, /maskImage: EXPANDED_TICKET_BOTTOM_MASK_IMAGE/u);
	assert.match(card, /const EXPANDED_TICKET_SHADOW_MASK_IMAGE = \[/u);
	assert.match(card, /radial-gradient\(circle 8px at 0 var\(--agent-card-ticket-seam-y, 0px\), transparent 0 7\.5px, black 8px\)/u);
	assert.match(theme, /@utility agent-card-ticket-shadow \{[\s\S]*drop-shadow\(0 8px 12px rgb\(30 31 33 \/ 0\.15\)\);/u);
	assert.match(theme, /@utility agent-card-ticket-seam \{[\s\S]*&::before,[\s\S]*&::after[\s\S]*width: 8px;[\s\S]*height: 16px;[\s\S]*background: transparent;[\s\S]*border: 1px solid var\(--color-border\);[\s\S]*left: 0;[\s\S]*border-left: 0;[\s\S]*border-radius: 0 9999px 9999px 0;[\s\S]*right: 0;[\s\S]*border-right: 0;[\s\S]*border-radius: 9999px 0 0 9999px;/u);
	assert.doesNotMatch(theme, /agent-card-ticket-seam[\s\S]*background: var\(--color-surface\);/u);
	assert.doesNotMatch(theme, /agent-card-ticket-seam[\s\S]*filter: drop-shadow\(0 8px 12px rgb\(30 31 33 \/ 0\.15\)\);/u);
	assert.match(card, /const EXPANDED_TICKET_ELEVATION_CLASS_NAME = "agent-card-ticket-shadow";/u);
	assert.match(card, /const EXPANDED_TICKET_WRAPPER_CLASS_NAME = "relative flex min-h-0 flex-auto flex-col rounded-2xl";/u);
	assert.match(card, /const EXPANDED_TICKET_SHADOW_CLASS_NAME = cn\(/u);
	assert.match(card, /group-hover\/card:opacity-100 group-focus-within\/card:opacity-100/u);
	assert.match(card, /const EXPANDED_TICKET_SHADOW_STYLE = \{/u);
	assert.match(card, /maskImage: EXPANDED_TICKET_SHADOW_MASK_IMAGE/u);
	assert.match(card, /WebkitMaskImage: EXPANDED_TICKET_SHADOW_MASK_IMAGE/u);
	assert.match(card, /const EXPANDED_TICKET_TEAR_LINE_STYLE = \{/u);
	assert.match(card, /repeating-linear-gradient\(to right, black 0 6px, transparent 6px 16px\)/u);
	assert.match(card, /function AgentCardTicketSeam\(\)/u);
	assert.match(card, /data-slot="agent-card-ticket-seam"/u);
	assert.match(card, /style=\{\{ zIndex: 30 \}\}/u);
	assert.match(card, /className="agent-card-ticket-seam pointer-events-none relative h-0"/u);
	assert.match(card, /right-2 left-2 h-px bg-border[\s\S]*data-slot="agent-card-ticket-tear-line"[\s\S]*style=\{EXPANDED_TICKET_TEAR_LINE_STYLE\}/u);
	assert.doesNotMatch(card, /agent-card-ticket-cutout-left/u);
	assert.doesNotMatch(card, /agent-card-ticket-cutout-right/u);
	assert.match(card, /const ticketRef = useRef<HTMLDivElement \| null>\(null\);/u);
	assert.match(card, /const ticketHeaderRef = useRef<HTMLDivElement \| null>\(null\);/u);
	assert.match(card, /ticket\.style\.setProperty\("--agent-card-ticket-seam-y"/u);
	assert.match(card, /new ResizeObserver\(updateSeamOffset\)/u);
	assert.match(card, /<AgentCardTicketSeam \/>[\s\S]*data-slot="agent-card-scroll"/u);
	assert.match(card, /"gap-0 overflow-visible rounded-2xl bg-transparent p-0 after:rounded-2xl after:border-0 \[&_\[data-slot=agent-card-select\]\]:rounded-2xl"/u);
	assert.match(card, /hoverShadow="none"/u);
	assert.match(card, /data-slot="agent-card-ticket"/u);
	assert.match(card, /data-slot="agent-card-ticket" ref=\{ticketRef\}/u);
	assert.match(card, /className=\{cn\(EXPANDED_TICKET_SHADOW_CLASS_NAME, active && "opacity-100"\)\}[\s\S]*data-slot="agent-card-ticket-shadow"[\s\S]*data-slot="agent-card-ticket-shadow-shape"[\s\S]*style=\{EXPANDED_TICKET_SHADOW_STYLE\}/u);
	assert.match(card, /className="relative z-10 shrink-0" ref=\{ticketHeaderRef\}/u);
	assert.doesNotMatch(card, /EXPANDED_TICKET_PIECE_CLASS_NAME/u);
	assert.doesNotMatch(card, /EXPANDED_TICKET_SURFACE_CLASS_NAME/u);
	assert.match(card, /\[&_\[data-slot=agent-card-banner\]>div:first-child\]:mb-\[-1px\]/u);
	assert.match(card, /\[&_\[data-slot=agent-card-banner\]>div:first-child\]:h-\[49px\]/u);
	assert.match(card, /"relative z-10 overflow-hidden rounded-t-2xl border-x border-t border-border bg-surface [^"]*"[\s\S]*data-slot="agent-card-sticky-header"[\s\S]*style=\{EXPANDED_TICKET_TOP_STYLE\}/u);
	assert.match(card, /data-slot="agent-card-scroll"[\s\S]*style=\{EXPANDED_TICKET_BOTTOM_STYLE\}/u);
	assert.doesNotMatch(card, /EXPANDED_TICKET_SHAPE_CLASS_NAME/u);
	assert.doesNotMatch(card, /active && "border-transparent"/u);
	assert.match(card, /<AgentCardFooter className="mt-4">/u);
	assert.match(
		card,
		/if \(variant === "template"\)[\s\S]*<AgentCardSection label="Trusted by teammates">[\s\S]*<AvatarGroup className="items-center" label="Collaborators">[\s\S]*<Avatar key=\{person\.src\} size="sm">[\s\S]*<AvatarGroupCount>\+\{hiddenCollaboratorCount\}<\/AvatarGroupCount>[\s\S]*<AgentCardSection label="Works with">/u,
	);
	assert.match(
		card,
		/data-slot="agent-card-scroll"[\s\S]*style=\{EXPANDED_TICKET_BOTTOM_STYLE\}[\s\S]*<AgentCardSection label="Works with">/u,
	);
	assert.match(card, /<TWGAppstack animated=\{false\} className="justify-start" iconSize="small" maxVisible=\{7\} sources=\{sources\} \/>/u);
	assert.match(card, /<AgentCardSection label="Works with">/u);
	assert.match(card, /<AgentCardSection label="Skills">/u);
	assert.match(card, /<div className="py-1\.5">[\s\S]*<Separator \/>/u);
	assert.match(card, /<AgentCardCapabilities[\s\S]*items=\{capabilities\}[\s\S]*label=\{capabilitiesLabel\}[\s\S]*listClassName="gap-2"/u);
	assert.doesNotMatch(card, /const expandedDetailStyle/u);
	assert.doesNotMatch(card, /expandedScrollStyle/u);
	assert.doesNotMatch(card, /pointer-events-none absolute inset-0 flex items-center px-4 py-2 opacity-0/u);
	assert.match(demo, /collaborators=\{COLLABORATORS\}[\s\S]*variant="template"/u);
	assert.match(page, /collaborators=\{COLLABORATORS\}[\s\S]*variant="template"/u);
	assert.match(demo, /className="w-full max-w-\[376px\]"/u);
	assert.match(page, /className="w-full max-w-\[376px\]"/u);
	assert.match(details, /"agent-card": \{[\s\S]*demoLayout: \{ previewHeight: "fit" \}/u);
	assert.doesNotMatch(details, /stats \/ collaborators footer/u);
	assert.doesNotMatch(details, /hover "Use template" action/u);
});
