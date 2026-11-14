const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

function readProjectFile(relativePath) {
	return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("Agent Template is exposed as a website block", () => {
	assert.match(
		readProjectFile("app/data/component-manifest.ts"),
		/blockComponent\("agent-template", "Agent Template"\)/u,
	);
	assert.match(
		readProjectFile("app/data/component-manifest.ts"),
		/blockComponent\("agent-template", "Agent Template"\)/u,
	);
	assert.match(
		readDetailCategorySource("blocks"),
		/import \{ AgentTemplateDialog \} from "@\/components\/blocks\/agent-template";/u,
	);
	assert.match(
		readWebsiteRegistrySource(),
		/"agent-template": dynamic\(\s*\(\) => import\("\.\/demos\/blocks\/agent-template-demo"\)/u,
	);
});

test("Agent Template docs demo starts closed until the trigger is clicked", () => {
	assert.match(
		readProjectFile("components/blocks/agent-template/page.tsx"),
		/const \[open, setOpen\] = useState\(false\);/u,
	);
});

test("Agent Template renders the strategy dialog layout with entity-card cards", () => {
	const source = readProjectFile("components/blocks/agent-template/components/agent-template.tsx");
	const pageSource = readProjectFile("components/blocks/agent-template/page.tsx");
	const demoAgentsSource = readProjectFile("components/blocks/agent-template/data/demo-template-agents.ts");
	const defaultSidebarGroupsSource = readProjectFile("components/blocks/agent-template/data/sidebar-groups.ts");
	const studioShellSource = readProjectFile("components/projects/studio/components/rovo-app-shell.tsx");
	const studioHomeStarterBentoSource = readProjectFile("components/projects/studio/components/rovo-app-home-starter-bento.tsx");
	const studioTemplatePromptsSource = readProjectFile("components/projects/studio/lib/studio-template-prompts.ts");
	const expandedCardSource = readProjectFile("components/ui-custom/entity-card/agent-expanded.tsx");

	assert.doesNotMatch(source, /AgentBrowserDialog/u);
	assert.match(source, /AGENT_TEMPLATE_CATEGORIES/u);
	assert.match(source, /label: "Planning"/u);
	assert.match(source, /label: "Insights"/u);
	assert.match(source, /label: "Operations"/u);
	assert.match(source, /label: "Writing"/u);
	assert.match(source, /label: "Work management"/u);
	assert.match(source, /Turn rough ideas into plans,/u);
	assert.match(source, /and choose the next step\./u);
	assert.match(source, /Pull signal from context,/u);
	assert.match(source, /and turn scattered data into decisions\./u);
	assert.match(source, /Keep routines moving,/u);
	assert.match(source, /and make follow-through easier to trust\./u);
	assert.match(source, /Draft, refine, and adapt writing,/u);
	assert.match(source, /without losing the point\./u);
	assert.match(source, /Track the work that matters,/u);
	assert.match(source, /and keep momentum visible\./u);
	assert.match(source, /activeCategoryOption\.titleLines\[0\]/u);
	assert.match(source, /activeCategoryOption\.titleLines\[1\]/u);
	assert.match(source, /className="mt-6 text-text"/u);
	assert.match(source, /\/illustration\/rich-icon/u);
	assert.match(source, /\/lightbulb\/standard\.svg/u);
	assert.match(source, /\/marketing\/standard\.svg/u);
	assert.match(source, /\/product-management\/standard\.svg/u);
	assert.match(source, /\/illustrations\/standard\.svg/u);
	assert.match(source, /flex flex-wrap justify-start gap-2/u);
	assert.match(source, /relative isolate inline-flex h-8 shrink-0 items-center/u);
	assert.match(source, /aria-pressed=\{active\}/u);
	// Carousel cards now render via the entity-card expanded agent card.
	assert.match(source, /AgentTemplateCard/u);
	assert.match(source, /EntityCardAgentExpandedCard/u);
	assert.match(source, /className="h-\[400px\] w-90 shrink-0 \[will-change:transform,opacity\]"/u);
	assert.match(source, /className="h-full w-full"/u);
	assert.match(source, /NOOP_TEMPLATE_MORE_ACTIONS/u);
	assert.match(source, /onMoreActions=\{NOOP_TEMPLATE_MORE_ACTIONS\}/u);
	assert.match(source, /deriveAgentPublisher/u);
	assert.match(source, /AGENT_TEMPLATE_MAX_VISIBLE_AGENTS = 8/u);
	assert.match(source, /agent\.categoryId === activeCategory/u);
	assert.match(source, /visibleAgents\.slice\(0, AGENT_TEMPLATE_MAX_VISIBLE_AGENTS\)/u);
	assert.match(source, /templatePrompt\?: string/u);
	assert.match(source, /AnimatePresence initial=\{false\}/u);
	assert.match(source, /AGENT_TEMPLATE_TAB_COPY_VARIANTS/u);
	assert.match(source, /AGENT_TEMPLATE_TAB_CARDS_VARIANTS/u);
	assert.match(source, /AGENT_TEMPLATE_TAB_CARDS_SWAP_OFFSET = 24/u);
	assert.match(source, /max-h-\[min\(744px,calc\(100svh-1rem\)\)\]/u);
	assert.match(source, /grid-rows-\[auto_minmax\(0,auto\)\]/u);
	assert.match(source, /<div className="relative min-h-0 overflow-hidden">/u);
	// Sequenced swap (mode="wait"): quick exit, then a gradual staggered enter —
	// each card fades + slides in, offset by AGENT_TEMPLATE_TAB_CARD_STAGGER.
	assert.match(source, /className="h-full overflow-x-auto overflow-y-hidden \[scrollbar-width:none\]/u);
	assert.match(source, /className="flex h-full w-max gap-4 px-6 pt-2 pb-6"/u);
	assert.match(source, /<AnimatePresence custom=\{tabMotionCustom\} initial=\{false\} mode="wait">/u);
	assert.match(source, /AGENT_TEMPLATE_TAB_CARD_STAGGER = 0\.05/u);
	assert.match(source, /templateAgents\.map\(\(agent, index\)/u);
	assert.match(source, /delay: shouldReduceMotion \? 0 : index \* AGENT_TEMPLATE_TAB_CARD_STAGGER/u);
	assert.match(source, /const \[tabMotionDirection, setTabMotionDirection\]/u);
	assert.match(source, /getAgentTemplateCategoryIndex\(categoryId\) > getAgentTemplateCategoryIndex\(activeCategory\) \? 1 : -1/u);
	assert.match(source, /custom=\{tabMotionCustom\}/u);
	assert.match(source, /initial="enter"/u);
	assert.match(source, /animate="center"/u);
	assert.match(source, /variants=\{AGENT_TEMPLATE_TAB_COPY_VARIANTS\}/u);
	assert.match(source, /variants=\{AGENT_TEMPLATE_TAB_CARDS_VARIANTS\}/u);
	assert.match(source, /AgentTemplateCarouselControl/u);
	assert.match(expandedCardSource, /ENTITY_CARD_SCROLL_MASK_IMAGE/u);
	assert.match(expandedCardSource, /maskRepeat: "no-repeat, no-repeat"/u);
	assert.match(expandedCardSource, /bodyScrolled \? ENTITY_CARD_SCROLL_MASK_STYLE : undefined/u);
	assert.match(expandedCardSource, /\[scrollbar-gutter:stable\]/u);
	assert.match(source, /setCarouselRef/u);
	assert.match(source, /canScrollLeft/u);
	assert.match(source, /canScrollRight/u);
	assert.match(source, /Show previous agent templates/u);
	assert.match(source, /Show next agent templates/u);
	assert.match(source, /bg-surface-overlay text-icon-subtle opacity-100 hover:bg-surface-overlay-hovered active:bg-surface-overlay-pressed/u);
	assert.match(source, /token\("elevation\.shadow\.overlay"\)/u);
	assert.match(source, /scrollBy\(\{/u);
	assert.doesNotMatch(source, /size-12/u);
	assert.doesNotMatch(source, /border border-border bg-surface-raised/u);
	// The page wires the carousel to the block-local rich demo dataset.
	assert.match(pageSource, /DEMO_AGENT_TEMPLATES/u);
	assert.match(pageSource, /DEMO_AGENT_TEMPLATES_SESSION/u);
	assert.match(studioShellSource, /agents=\{DEMO_AGENT_TEMPLATES\}/u);
	assert.match(studioShellSource, /initialCategoryId=\{agentTemplateInitialCategory\}/u);
	assert.match(studioShellSource, /onSelectAgent=\{handleTemplateAgentSelect\}/u);
	assert.match(studioShellSource, /from "@\/components\/projects\/studio\/lib\/studio-template-prompts";/u);
	assert.match(studioShellSource, /agent\.templatePrompt \?\? buildFallbackTemplatePrompt\(agent\)/u);
	assert.match(studioShellSource, /sessionAgents=\{DEMO_AGENT_TEMPLATES_SESSION\}/u);
	assert.match(studioHomeStarterBentoSource, /function HomeStarterHeroTile[\s\S]*<TWGAppstack[\s\S]*animated=\{false\}/u);
	assert.match(studioHomeStarterBentoSource, /className=\{cn\(BENTO_CAROUSEL_CONTAINER_CLASS, ROVO_APP_STUDIO_CONTENT_MAX_WIDTH_CLASS\)\}/u);
	assert.match(source, /initialCategoryId\?: AgentTemplateCategoryId/u);
	assert.match(source, /const \[activeCategoryState, setActiveCategoryState\] = useState\(\(\) => \(\{/u);
	assert.match(source, /activeCategory: initialCategoryId,/u);
	assert.match(source, /open && activeCategoryState\.initialCategoryId !== initialCategoryId/u);
	assert.match(source, /setActiveCategoryState\(\(currentState\) => \(\{ \.\.\.currentState, activeCategory: categoryId \}\)\);/u);
	// Demo agents carry the expanded-card detail the cards render.
	assert.match(demoAgentsSource, /capabilities:/u);
	assert.match(demoAgentsSource, /const SOURCE_SEQUENCE/u);
	assert.match(demoAgentsSource, /const SKILL_LABELS/u);
	assert.match(demoAgentsSource, /const CATEGORY_CAPABILITY_ICONS/u);
	assert.match(demoAgentsSource, /function defaultSources/u);
	assert.match(demoAgentsSource, /const sourceCount = 2 \+ \(seed % 7\)/u);
	assert.match(demoAgentsSource, /function defaultSkills/u);
	assert.match(demoAgentsSource, /const skillCount = 3 \+ \(seed % 8\)/u);
	assert.match(demoAgentsSource, /function defaultCapabilities/u);
	assert.match(demoAgentsSource, /templatePrompt:/u);
	assert.match(demoAgentsSource, /Use the \$\{name\} template to create a Rovo agent/u);
	assert.match(studioTemplatePromptsSource, /Use the \$\{agent\.name\} template to create a Rovo agent/u);
	assert.match(demoAgentsSource, /ready for me to review before sending/u);
	assert.match(demoAgentsSource, /const MAX_VISIBLE_TEMPLATE_COLLABORATORS = 4/u);
	assert.match(demoAgentsSource, /function pickCollaborators\(offset: number, count: number\)/u);
	assert.match(demoAgentsSource, /const collaboratorMode = collaboratorSeed % 3/u);
	assert.match(demoAgentsSource, /const visibleCollaboratorCount = collaboratorMode === 0 \? 3 : MAX_VISIBLE_TEMPLATE_COLLABORATORS/u);
	assert.match(demoAgentsSource, /collaboratorMode === 2 \? 1 \+ \(collaboratorSeed % 8\) : undefined/u);
	assert.match(demoAgentsSource, /collaborators: pickCollaborators\(peopleOffset, visibleCollaboratorCount\)/u);
	assert.match(demoAgentsSource, /sources:/u);
	assert.match(demoAgentsSource, /skills:/u);
	// The template data is sourced from the centralized directory catalog; the demo
	// module derives sources/skills/capabilities from these authored configs.
	assert.match(demoAgentsSource, /AGENT_TEMPLATE_CONFIGS/u);
	const templates = JSON.parse(readProjectFile("app/data/directory/agent-templates.json"));
	const templateByName = new Map(templates.map((template) => [template.name, template]));
	const attributionKinds = new Set(templates.map((template) => template.attributionKind ?? "team"));
	assert.ok(attributionKinds.has("team"), "templates include a team attribution (default)");
	assert.ok(attributionKinds.has("person"), "templates include a person attribution");
	assert.ok(attributionKinds.has("company"), "templates include a company attribution");
	assert.equal(templateByName.get("Funnel Analyzer")?.publisherBrandName, "amplitude");
	for (const name of [
		"Decision Director",
		"Customer Insights",
		"Service Triage",
		"Product Requirements Guide",
		"Work Item Planner",
	]) {
		assert.ok(templateByName.has(name), `template catalog must include ${name}`);
	}
	const nameToAvatar = [
		["OKR Generator", "/avatar-agent-new/purple/research-scout.svg"],
		["Jira Theme Analyzer", "/avatar-agent-new/lime/auto-review.svg"],
		["Transcript Insights Reporter", "/avatar-agent-new/orange/default.svg"],
		["Service Request Helper", "/avatar-agent-new/orange/research-scout.svg"],
		["Product Requirements Guide", "/avatar-agent-new/purple/default.svg"],
		["Release Notes Drafter", "/avatar-agent-new/lime/release-notes.svg"],
		["Brand Voice Crafter", "/avatar-agent-new/orange/pitch-perfector.svg"],
		["Social Media Writer", "/avatar-agent-new/yellow/culture.svg"],
		["Work Item Planner", "/avatar-agent-new/yellow/research-scout.svg"],
		["Bug Report Assistant", "/avatar-agent-new/lime/auto-review.svg"],
		["Blocker Checker", "/avatar-agent-new/orange/culture.svg"],
		["Readiness Checker", "/avatar-agent-new/purple/customer-insight.svg"],
	];
	for (const [name, avatarSrc] of nameToAvatar) {
		assert.equal(templateByName.get(name)?.avatarSrc, avatarSrc, `${name} avatar`);
	}
	for (const categoryId of ["brainstorm", "analyze", "review", "summarize", "create"]) {
		assert.equal(
			templates.filter((template) => template.categoryId === categoryId).length,
			8,
			`${categoryId} should have 8 templates`,
		);
	}
	// Templates are robust: every one carries non-empty setup instructions.
	for (const template of templates) {
		assert.equal(typeof template.instructions, "string", `${template.id} instructions must be a string`);
		assert.ok(template.instructions.length > 0, `${template.id} instructions must be non-empty`);
	}
	assert.match(defaultSidebarGroupsSource, /title: "By teams"/u);
	assert.match(defaultSidebarGroupsSource, /title: "By companies"/u);
});
