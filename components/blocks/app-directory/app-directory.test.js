const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

function readProjectFile(relativePath) {
	return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("App Directory is exposed as a website block", () => {
	assert.match(
		readProjectFile("app/data/components.ts"),
		/blockComponent\("app-directory", "App Directory"\)/u,
	);
	assert.match(
		readProjectFile("app/data/component-manifest.ts"),
		/blockComponent\("app-directory", "App Directory"\)/u,
	);
	assert.match(
		readDetailCategorySource("blocks"),
		/import \{ AppDirectoryDialog \} from "@\/components\/blocks\/app-directory";/u,
	);
	assert.match(
		readWebsiteRegistrySource(),
		/"app-directory": dynamic\(\s*\(\) => import\("\.\/demos\/blocks\/app-directory-demo"\)/u,
	);
});

test("App Directory docs demo starts closed until the trigger is clicked", () => {
	assert.match(
		readProjectFile("components/blocks/app-directory/page.tsx"),
		/const \[open, setOpen\] = useState\(false\);/u,
	);
});

test("App Directory detail header uses 24px vertical padding", () => {
	const source = readProjectFile("components/blocks/app-directory/components/app-directory.tsx");

	assert.match(source, /function AppDirectoryHeader[\s\S]*className="flex items-center justify-between px-6 py-6"/u);
});

test("App Directory card menu can toggle favourites", () => {
	const source = readProjectFile("components/blocks/app-directory/components/app-directory.tsx");

	assert.match(source, /const \[favoriteOverrides, setFavoriteOverrides\] = useState<Record<string, boolean>>\(\{\}\);/u);
	assert.match(source, /tool\.id in favoriteOverrides \? \{ \.\.\.tool, favorite: favoriteOverrides\[tool\.id\] \} : tool/u);
	assert.match(source, /function handleToggleFavoriteTool\(tool: AppDirectoryTool\): void \{[\s\S]*\[tool\.id\]: !tool\.favorite/u);
	assert.match(source, /<AppCard[\s\S]*onSelectTool=\{onSelectTool\}[\s\S]*onToggleFavoriteTool=\{onToggleFavoriteTool\}[\s\S]*tool=\{tool\}/u);
	assert.match(source, /favorite=\{Boolean\(tool\.favorite\)\}/u);
	assert.match(source, /elemBefore=\{favorite \? <StarStarredIcon label="" \/> : <StarUnstarredIcon label="" \/>\}/u);
	assert.match(source, /\{favorite \? "Unfavourite" : "Favourite"\}/u);
});

test("App Directory owns the Figma modal instead of wrapping AgentBrowserDialog", () => {
	const source = readProjectFile("components/blocks/app-directory/components/app-directory.tsx");
	const variantsSource = readProjectFile("components/ui-custom/entity-card/variants.tsx");
	const entityCardAppSource = readProjectFile("components/ui-custom/entity-card/app.tsx");
	const entityCardPartsSource = readProjectFile("components/ui-custom/entity-card/parts.tsx");

	assert.doesNotMatch(source, /AgentBrowserDialog/u);
	assert.match(source, /className="grid h-\[min\(768px,calc\(100svh-2rem\)\)\][\s\S]*sm:!max-w-\[1200px\]"/u);
	assert.match(source, /New app/u);
	assert.match(source, /onBack=\{selectedTool \? \(\) => setSelectedToolId\(null\) : undefined\}/u);
	assert.match(source, /onAddTool=\{selectedTool && !addedIds\.has\(selectedTool\.id\) \? \(\) => handleAddTool\(selectedTool\) : undefined\}/u);
	assert.match(source, /onRemoveTool=\{selectedTool && addedIds\.has\(selectedTool\.id\) \? \(\) => handleRemoveTool\(selectedTool\) : undefined\}/u);
	assert.match(source, /aria-label="Back to apps"[\s\S]*size="icon"[\s\S]*<ArrowLeftIcon label="" color="currentColor" \/>/u);
	assert.doesNotMatch(source, />\s*Back\s*</u);
	assert.match(source, /Search for an app by name, or describe it/u);
	assert.match(source, /Sort by latest/u);
	assert.match(source, /Showing \{filteredTools\.length\.toLocaleString\("en-US"\)\} results/u);
	assert.match(source, /const \[favoriteOverrides, setFavoriteOverrides\] = useState<Record<string, boolean>>\(\{\}\);/u);
	assert.match(source, /tool\.id in favoriteOverrides \? \{ \.\.\.tool, favorite: favoriteOverrides\[tool\.id\] \} : tool/u);
	assert.match(source, /function handleToggleFavoriteTool\(tool: AppDirectoryTool\): void \{[\s\S]*\[tool\.id\]: !tool\.favorite/u);
	assert.match(source, /<AppCard[\s\S]*added=\{addedIds\.has\(tool\.id\)\}[\s\S]*onSelectTool=\{onSelectTool\}[\s\S]*onToggleAddedTool=\{onToggleAddedTool\}[\s\S]*onToggleFavoriteTool=\{onToggleFavoriteTool\}[\s\S]*tool=\{tool\}/u);
	assert.match(source, /function handleToggleAddedTool\(tool: AppDirectoryTool, checked: boolean\): void \{[\s\S]*checked[\s\S]*handleAddTool\(tool\);[\s\S]*handleRemoveTool\(tool\);/u);
	assert.match(source, /const \[moreMenuOpen, setMoreMenuOpen\] = useState\(false\);/u);
	assert.match(source, /import \{ EntityCardAppCard \} from "@\/components\/ui-custom\/entity-card";/u);
	assert.match(source, /const knowledgeApp = getKnowledgeAppForTool\(tool\);/u);
	assert.match(source, /<EntityCardAppCard[\s\S]*active=\{moreMenuOpen\}[\s\S]*moreAction=\{[\s\S]*<DirectoryCardMoreMenu[\s\S]*onOpenChange=\{setMoreMenuOpen\}[\s\S]*open=\{moreMenuOpen\}/u);
	assert.match(source, /const toggleAdded = \(checked: boolean\) => onToggleAddedTool\(tool, checked\);/u);
	assert.match(source, /onAddedChange=\{toggleAdded\}/u);
	assert.match(source, /favorite=\{Boolean\(tool\.favorite\)\}/u);
	assert.match(source, /elemBefore=\{favorite \? <StarStarredIcon label="" \/> : <StarUnstarredIcon label="" \/>\}/u);
	assert.match(source, /\{favorite \? "Unfavourite" : "Favourite"\}/u);
	assert.match(source, /knowledgeCount=\{knowledgeApp\?\.contents\.length\}/u);
	assert.doesNotMatch(source, /<EntityCardToolCard/u);
	assert.match(source, /aria-pressed=\{open \|\| undefined\}/u);
	assert.match(source, /className="min-h-\[102px\] hover:border-transparent"/u);
	assert.match(source, /import \{ AtlassianLogo, CustomLogo \} from "@\/components\/ui\/logo";/u);
	assert.match(source, /import \{ AtlassianLogoGlyph, AtlassianLogoMark, BrandLogoMark \} from "@\/components\/ui\/logo-mark";/u);
	assert.match(source, /<AtlassianLogoMark label=\{tool\.name\} name=\{tool\.logoName \?\? "atlassian"\} size="medium" \/>/u);
	assert.match(source, /const logoName = tool\.logoName \?\? "atlassian";[\s\S]*if \(logoName === "atlassian"\) \{[\s\S]*return <AtlassianLogoGlyph className="!size-12" name=\{logoName\} size="xlarge" \/>;/u);
	assert.match(source, /tool\.logoName \|\| tool\.id === "atlassian"/u);
	assert.match(source, /const src = tool\.logoSrc \?\? tool\.avatarSrc;/u);
	assert.match(source, /<BrandLogoMark frame="tile" label=\{tool\.name\} size="medium" src=\{src\} \/>/u);
	assert.match(source, /<LogoThirdParty label=\{tool\.name\} name=\{tool\.brandName\} size="xlarge" \/>/u);
	assert.match(source, /<CustomLogo label=\{tool\.name\} size="xlarge" src=\{src\} \/>/u);
	assert.match(source, /<AtlassianLogoMark label=\{item\.label\} name=\{item\.logoName\} size="small" \/>/u);
	assert.match(source, /<BrandLogoMark frame="tile" label=\{item\.label\} size="small" src=\{item\.avatarSrc\} \/>/u);
	assert.doesNotMatch(source, /withUsageBorder/u);
	assert.match(source, /import \{ useHasVerticalOverflow \} from "@\/components\/hooks\/use-has-vertical-overflow";/u);
	assert.match(source, /const contentOverflow = useHasVerticalOverflow<HTMLDivElement>\(\);/u);
	assert.match(source, /ref=\{contentOverflow\.ref\}/u);
	assert.match(source, /"flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto px-6 pt-1 pb-8 md:pl-4"/u);
	assert.match(source, /"flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto px-6 pb-6 md:pl-4"/u);
	assert.match(source, /contentOverflow\.showTopScrollMask && "scroll-mask-top overscroll-contain"/u);
	assert.match(source, /const sidebarOverflow = useHasVerticalOverflow<HTMLElement>\(\);/u);
	assert.match(source, /aria-label="Tool categories"[\s\S]*sidebarOverflow\.showTopScrollMask && "scroll-mask-top overscroll-contain"[\s\S]*ref=\{sidebarOverflow\.ref\}/u);
	assert.match(source, /className="hidden min-h-0 w-\[280px\] shrink-0 overflow-y-auto pl-6 md:block"/u);
	assert.match(variantsSource, /onSelect=\{handleSelect \? \(\) => handleSelect\(\) : undefined\}/u);
	assert.match(variantsSource, /return onSelect \|\| !onAddedChange \? selectLabel : addActionLabel;/u);
	assert.match(variantsSource, /selectLabel=\{shellSelectLabel\}/u);
	assert.match(variantsSource, /<EntityCardApp/u);
	assert.match(variantsSource, /onAddedChange=\{onAddedChange\}/u);
	assert.match(variantsSource, /action=\{moreAction\}/u);
	assert.match(variantsSource, /onMoreActions=\{onMoreActions\}/u);
	assert.match(entityCardPartsSource, /export function EntityCardAddedSwitch/u);
	assert.match(entityCardPartsSource, /<Switch[\s\S]*aria-label=\{`\$\{added \? "Remove" : "Add"\} \$\{title\}`\}[\s\S]*checked=\{added\}[\s\S]*onCheckedChange=\{onAddedChange\}/u);
	assert.match(entityCardAppSource, /<EntityCardMoreButton active=\{active\}/u);
	assert.match(entityCardAppSource, /onAddedChange=\{onAddedChange\}/u);
	// The app card composes a header + description inside a tight gap-2 column. The
	// header/description/footer are hoisted into locals so the hover prompt-swap
	// branch can reuse them, so assert the pieces are present rather than a single
	// inline ordering.
	assert.match(entityCardAppSource, /<div className="flex flex-col gap-2">/u);
	assert.match(entityCardAppSource, /<EntityCardHeader/u);
	assert.match(entityCardAppSource, /<EntityCardDescription>/u);
	assert.match(readProjectFile("components/hooks/use-has-vertical-overflow.ts"), /scrollTop > 1/u);
	assert.match(readProjectFile("components/hooks/use-has-vertical-overflow.ts"), /showTopScrollMask: hasVerticalOverflow && hasScrolledFromTop/u);
	assert.match(readProjectFile("app/tailwind-theme.css"), /@utility scroll-mask-top/u);
	assert.doesNotMatch(source, /overflow-y-auto px-6 pt-6 pb-6/u);
	assert.doesNotMatch(source, /overflow-y-auto pl-6 pt-6/u);
});

test("App Directory keeps compatible types while adding tool detail fields", () => {
	// The tool type is now owned by the data layer (single type identity) and
	// re-exported from the component module for existing callers.
	const loaderSource = readProjectFile("app/data/directory/tools.ts");
	const componentSource = readProjectFile("components/blocks/app-directory/components/app-directory.tsx");

	assert.match(loaderSource, /export interface ToolDirectoryTool/u);
	// The loader interface mirrors AgentBrowserAgent's identity fields...
	for (const field of ["id", "name", "byline", "attributionKind", "avatarSrc", "logoName", "description"]) {
		assert.match(loaderSource, new RegExp(`\\b${field}\\??:`, "u"));
	}
		// ...plus the optional tool-specific detail fields.
		for (const field of [
			"categoryId",
			"lastUpdatedLabel",
			"publisherName",
			"verified",
		"favorite",
		"readOnlyTools",
		"writeDeleteTools",
		]) {
			assert.match(loaderSource, new RegExp(`${field}\\?`, "u"));
		}
		// Card stats are required catalog data, not component-level fallbacks.
		for (const field of ["toolCount", "teammateCount"]) {
			assert.match(loaderSource, new RegExp(`${field}: number`, "u"));
		}
	// The component re-exports the loader's tool/permission types and keeps the
	// sidebar-group alias to AgentBrowserSidebarGroup.
	assert.match(componentSource, /export type \{ ToolDirectoryPermission as AppDirectoryPermission \} from "@\/app\/data\/directory\/tools";/u);
	assert.match(componentSource, /export type \{ DirectoryApp as AppDirectoryTool \} from "@\/app\/data\/directory\/apps";/u);
	assert.match(componentSource, /export type AppDirectorySidebarGroup = AgentBrowserSidebarGroup;/u);
});

test("App Directory supports controlled and uncontrolled added tool state", () => {
	const source = readProjectFile("components/blocks/app-directory/components/app-directory.tsx");

	assert.match(source, /addedToolIds\?: readonly string\[\];/u);
	assert.match(source, /defaultAddedToolIds\?: readonly string\[\];/u);
	assert.match(source, /onAddedToolIdsChange\?: \(toolIds: readonly string\[\]\) => void;/u);
	assert.match(source, /const controlledAddedIds = typeof addedToolIds !== "undefined";/u);
	assert.match(source, /onAddedToolIdsChange\?\.\(\[\.\.\.nextAddedIds\]\);/u);
	assert.match(source, /onToggleAddedTool: \(tool: AppDirectoryTool, checked: boolean\) => void;/u);
	assert.match(source, /onToggleAddedTool=\{handleToggleAddedTool\}/u);
	assert.match(source, /Add to agent/u);
	assert.match(source, /Remove/u);
	assert.match(source, /\{onRemoveTool \? \([\s\S]*<Button variant="destructive" onClick=\{onRemoveTool\} type="button">[\s\S]*<DeleteIcon label="" size="small" \/>[\s\S]*Remove[\s\S]*\) : onAddTool \? \([\s\S]*<Button onClick=\{onAddTool\} type="button">[\s\S]*Add to agent[\s\S]*\) : \([\s\S]*New app/u);
	assert.match(source, /<ToolDetailView[\s\S]*added=\{addedIds\.has\(selectedTool\.id\)\}[\s\S]*onCheckGroup=\{\(permissions\) => checkPermissionGroup\(selectedTool, permissions\)\}[\s\S]*onPermissionChange=\{\(permissionId, checked\) => setPermission\(selectedTool, permissionId, checked\)\}[\s\S]*permissionSelections=\{permissionSelections\[selectedTool\.id\] \?\? \{\}\}[\s\S]*tool=\{selectedTool\}[\s\S]*\/>/u);
	assert.doesNotMatch(source, /<ToolDetailView[\s\S]*onAddTool=\{\(\) => handleAddTool\(selectedTool\)\}/u);
	assert.doesNotMatch(source, /<ToolDetailView[\s\S]*onRemoveTool=\{\(\) => handleRemoveTool\(selectedTool\)\}/u);
	assert.doesNotMatch(source, /\{added \? null : \(/u);
	assert.match(source, /tool\.brandName[\s\S]*<LogoThirdParty label=\{tool\.name\} name=\{tool\.brandName\} size="xlarge" \/>/u);
	assert.match(source, /const ThirdPartyIcon = getThirdPartyLogoIconFromSrc\(item\.avatarSrc\);[\s\S]*<ThirdPartyIcon label=\{item\.label\} size="small" \/>/u);
	assert.match(source, /<BrandLogoMark frame="tile" label=\{tool\.name\} size="medium" src=\{src\} \/>/u);
	assert.match(source, /<CustomLogo label=\{tool\.name\} size="xlarge" src=\{src\} \/>/u);
	assert.doesNotMatch(source, /size="sm"/u);
	assert.doesNotMatch(source, /className="h-px bg-border"/u);
});

test("App Directory app cards surface a per-app prompt suggestion on hover", () => {
	const source = readProjectFile("components/blocks/app-directory/components/app-directory.tsx");
	const loaderSource = readProjectFile("app/data/directory/tools.ts");
	const knowledgeLoaderSource = readProjectFile("app/data/directory/knowledge.ts");
	const appsSource = readProjectFile("app/data/directory/apps.ts");
	const toolsData = JSON.parse(readProjectFile("app/data/directory/tools.json"));
	const knowledgeData = JSON.parse(readProjectFile("app/data/directory/knowledge.json"));
	const allTools = [...toolsData.tools, ...toolsData.sessionTools];

	// The data layer carries the optional onboarding prompt on both verticals...
	assert.match(loaderSource, /promptSuggestion\?: string/u);
	assert.match(knowledgeLoaderSource, /promptSuggestion\?: string/u);
	// ...and knowledge-only apps thread it onto the unified record.
	assert.match(appsSource, /promptSuggestion: app\.promptSuggestion/u);
	// The card consumer wires the prompt + the lowercase-id mention handle.
	assert.match(source, /promptSuggestion=\{tool\.promptSuggestion\}/u);
	assert.match(source, /mentionHandle=\{tool\.id\}/u);

	// Every catalog app ships a non-empty prompt suggestion (onboarding coverage).
	for (const tool of allTools) {
		assert.equal(typeof tool.promptSuggestion, "string", `tool ${tool.id} should have a promptSuggestion`);
		assert.ok(tool.promptSuggestion.trim().length > 0, `tool ${tool.id} promptSuggestion should be non-empty`);
	}

	// Knowledge-only apps (no matching tool id) must also carry a prompt suggestion.
	const KNOWLEDGE_ALIASES = { sharepoint: "microsoft-sharepoint" };
	const toolIds = new Set(allTools.map((tool) => tool.id));
	for (const app of knowledgeData) {
		const canonicalId = KNOWLEDGE_ALIASES[app.id] ?? app.id;
		if (toolIds.has(canonicalId)) continue; // dual-facet apps inherit the tool's prompt
		assert.equal(typeof app.promptSuggestion, "string", `knowledge-only app ${app.id} should have a promptSuggestion`);
		assert.ok(app.promptSuggestion.trim().length > 0, `knowledge-only app ${app.id} promptSuggestion should be non-empty`);
	}
});

test("App Directory category data follows the requested category content", () => {
	const source = readProjectFile("components/blocks/app-directory/data/categories.ts");

	for (const label of [
		"Project management",
		"Administrative tools",
		"Content and communication",
		"Data and analytics",
		"Software development",
		"IT support and service",
		"Design and diagramming",
		"Security and compliance",
		"HR and team building",
		"Sales and customer relations",
	]) {
		assert.match(source, new RegExp(label, "u"));
	}
	assert.match(source, /Streamline, manage, and track project phases\./u);
	assert.match(source, /Apps for CRM, lead tracking, and customer engagement\./u);
});

test("App Directory docs demo includes added and non-added detail states", () => {
	const source = readProjectFile("components/blocks/app-directory/page.tsx");
	const componentSource = readProjectFile("components/blocks/app-directory/components/app-directory.tsx");
	// Tool data is now the single-source-of-truth JSON catalog (two groups).
	const toolsData = JSON.parse(readProjectFile("app/data/directory/tools.json"));
	const allTools = [...toolsData.tools, ...toolsData.sessionTools];
	const sidebarGroupsSource = readProjectFile("components/blocks/app-directory/data/sidebar-groups.ts");

	assert.match(source, /import \{ DIRECTORY_APPS \} from "@\/app\/data\/directory\/apps";/u);
	assert.match(source, /const DEMO_PERSONAL_APPS: readonly AppDirectoryTool\[\] = \[/u);
	assert.match(source, /const DEMO_ADDED_PERSONAL_APP_IDS: readonly string\[\] = \[[\s\S]*"focus-flow"[\s\S]*"standup-buddy"[\s\S]*"quick-capture"/u);
	assert.match(source, /const DEMO_ADDED_CATALOG_APP_IDS: readonly string\[\] = \[[\s\S]*"atlassian"[\s\S]*"google-drive"[\s\S]*"jira"[\s\S]*"slack"/u);
	assert.match(source, /defaultAddedToolIds=\{DEMO_ADDED_APP_IDS\}/u);
	assert.ok(allTools.some((tool) => tool.logoName === "atlassian"), "a tool should use the Atlassian brand logo");
	assert.equal(
		allTools.find((tool) => tool.id === "outlook")?.brandName,
		"microsoft-outlook",
		"Outlook should use the upstream package mark via brandName",
	);
	assert.ok(allTools.some((tool) => tool.favorite === true), "a tool should be marked favourite");
	for (const categoryId of ["project-management", "software-development", "security-and-compliance"]) {
		assert.ok(
			allTools.some((tool) => tool.categoryId === categoryId),
			`a tool should be in the ${categoryId} category`,
		);
	}
	assert.match(componentSource, /label: "Favourite apps"/u);
	assert.match(componentSource, /if \(activeCategory === "favorite-tools" && !tool\.favorite\) return false;/u);
	assert.match(componentSource, /aria-label="Knowledge"/u);
	assert.match(componentSource, /<KnowledgeContentModeSelector mode=\{mode\} onSelectMode=\{onSelectMode\} \/>/u);
	assert.match(componentSource, /const badgeLabel = mode === "all"[\s\S]*\? "All"[\s\S]*: mode === "none"[\s\S]*\? "None"[\s\S]*: selectedContentCount;/u);
	assert.match(componentSource, /<Badge max=\{false\}>\{badgeLabel\}<\/Badge>/u);
	assert.match(componentSource, /import \{ ToggleGroup, ToggleGroupItem \} from "@\/components\/ui\/toggle-group";/u);
	assert.match(componentSource, /<ToggleGroup[\s\S]*aria-label="Knowledge content mode"[\s\S]*value=\{\[mode\]\}[\s\S]*variant="outline"/u);
	assert.match(componentSource, /All content/u);
	assert.match(componentSource, /aria-label="Custom content"[\s\S]*value="custom"[\s\S]*Select content/u);
	assert.doesNotMatch(componentSource, /mode === "custom" \? "Select content" : "Custom content"/u);
	assert.match(componentSource, /aria-label="No knowledge"[\s\S]*value="none"[\s\S]*None/u);
	assert.match(componentSource, /if \(nextMode === "none"\) \{[\s\S]*nextContentIds = \[\];[\s\S]*selectedContentIds: nextContentIds/u);
	assert.match(componentSource, /Search for content by name, or describe it/u);
	assert.match(componentSource, /<SelectedKnowledgeContentList/u);
	assert.match(componentSource, /aria-label=\{`Remove \$\{content\.name\}`\}[\s\S]*className="hover:bg-bg-danger hover:text-text-danger hover:\[&_svg\]:text-icon-danger active:bg-bg-danger-pressed active:\[&_svg\]:text-icon-danger focus-visible:border-border-danger"[\s\S]*size="icon"[\s\S]*<DeleteIcon label="" color="currentColor" \/>/u);
	assert.doesNotMatch(componentSource, /<DeleteIcon label="" size="small" color="currentColor" \/>/u);
	assert.match(componentSource, /resolveDirectoryVisual\(content\.visual\)/u);
	assert.match(componentSource, /teammateCount=\{tool\.teammateCount\}/u);
	assert.match(componentSource, /toolCount=\{tool\.toolCount\}/u);
	assert.match(componentSource, /<p className="flex items-center gap-1">[\s\S]*<span>By<\/span>[\s\S]*<span className="truncate text-link">\{publisher\}<\/span>[\s\S]*StatusVerifiedIcon label="Verified"/u);
	assert.doesNotMatch(componentSource, /<h2 className="text-2xl font-semibold leading-7 text-text">\{tool\.name\}<\/h2>\s*\{verified \?/u);
	assert.match(componentSource, /\{tool\.teammateCount\.toLocaleString\("en-US"\)\} teammates/u);
	assert.doesNotMatch(componentSource, /Used by \{tool\.teammateCount/u);
	assert.doesNotMatch(componentSource, /teammateCount=\{tool\.teammateCount \?\? 258\}/u);
	assert.doesNotMatch(componentSource, /toolCount=\{tool\.toolCount \?\? 36\}/u);
	assert.match(componentSource, /const MAX_VISIBLE_CATEGORY_ITEMS = 5;/u);
	assert.match(componentSource, /const \[showAllCategories, setShowAllCategories\] = useState\(false\);/u);
	assert.match(componentSource, /APP_DIRECTORY_CATEGORIES\.slice\(0, MAX_VISIBLE_CATEGORY_ITEMS\)/u);
	assert.match(componentSource, /label="Show all"[\s\S]*onClick=\{\(\) => setShowAllCategories\(true\)\}/u);
	assert.match(componentSource, /sidebarGroups = DEFAULT_APP_DIRECTORY_SIDEBAR_GROUPS/u);
	assert.match(sidebarGroupsSource, /title: "By companies"/u);
	assert.doesNotMatch(sidebarGroupsSource, /title: "By teams"/u);
	assert.doesNotMatch(sidebarGroupsSource, /title: "Favourites"/u);
	for (const tool of allTools) {
		assert.equal(typeof tool.teammateCount, "number", `tool ${tool.id} should have teammateCount`);
		assert.equal(typeof tool.toolCount, "number", `tool ${tool.id} should have toolCount`);
		assert.equal(typeof tool.publisherName, "string", `tool ${tool.id} should have publisherName`);
		assert.equal(typeof tool.verified, "boolean", `tool ${tool.id} should have verified`);
	}
});

test("App Directory exposes an opt-in experimental variation", () => {
	const source = readProjectFile("components/blocks/app-directory/components/app-directory.tsx");
	const indexSource = readProjectFile("components/blocks/app-directory/index.ts");
	const blocksSource = readDetailCategorySource("blocks");
	const registrySource = readWebsiteRegistrySource();
	const demoSource = readProjectFile("components/website/demos/blocks/app-directory-demo.tsx");
	const pageSource = readProjectFile("components/blocks/app-directory/page.tsx");

	// The component opts in via a variant prop and branches the list view; the
	// default sidebar layout stays the fallback.
	assert.match(source, /export type AppDirectoryVariant = "default" \| "experimental";/u);
	assert.match(source, /variant\?: AppDirectoryVariant;/u);
	assert.match(source, /variant = "default",/u);
	assert.match(source, /variant === "experimental" \? \([\s\S]*<ExperimentalAppDirectoryView/u);

	// The variant type is part of the block's public API.
	assert.match(indexSource, /AppDirectoryVariant,/u);

	// Docs expose both variants as examples plus a documented prop.
	assert.match(blocksSource, /demoSlug: "app-directory-demo-standard"/u);
	assert.match(blocksSource, /demoSlug: "app-directory-demo-experimental"/u);
	assert.match(blocksSource, /name: "variant",[\s\S]*Opt-in layout variation/u);

	// Both demos are registered and exported.
	assert.match(registrySource, /"app-directory-demo-standard": dynamic\([\s\S]*mod\.AppDirectoryDemoStandard/u);
	assert.match(registrySource, /"app-directory-demo-experimental": dynamic\([\s\S]*mod\.AppDirectoryDemoExperimental/u);
	assert.match(demoSource, /export function AppDirectoryDemoStandard/u);
	assert.match(demoSource, /export function AppDirectoryDemoExperimental/u);

	// The docs page offers both entry points and a dedicated experimental page.
	assert.match(pageSource, /export function AppDirectoryExperimentalPage/u);
	assert.match(pageSource, /variant="experimental"/u);
	assert.match(pageSource, /className="flex h-full min-h-screen items-center justify-center gap-3 p-4"/u);
	assert.match(pageSource, /className="flex h-full min-h-screen items-center justify-center p-4"/u);
	assert.match(pageSource, /Open standard directory/u);
	assert.match(pageSource, /Open experimental directory/u);
});

test("App Directory experimental variation has searchable multi-select filters", () => {
	const source = readProjectFile("components/blocks/app-directory/components/app-directory.tsx");
	const sharedSource = readProjectFile("components/blocks/directory-shared/experimental-directory-view.tsx");

	// The experimental view delegates repeated search/filter/section chrome to the shared directory shell.
	assert.match(source, /function ExperimentalAppDirectoryView\(/u);
	assert.match(source, /<ExperimentalDirectoryView/u);
	assert.match(source, /<ExperimentalDirectorySection/u);
	assert.match(sharedSource, /export function FacetFilterDropdown/u);

	// Required popover/checkbox primitives are owned by the shared dropdown.
	assert.match(sharedSource, /import \{ Checkbox \} from "@\/components\/ui\/checkbox";/u);
	assert.match(sharedSource, /import \{ Popover, PopoverContent, PopoverTrigger \} from "@\/components\/ui\/popover";/u);

	// No sidebar: a pinned search + filter header above a separate scroll region, so
	// the controls stay reachable and only the results scroll (mask sits below them).
	assert.match(sharedSource, /"flex shrink-0 flex-col gap-4 px-6 pt-1 pb-2"/u);
	assert.match(sharedSource, /"flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pt-2"/u);
	assert.match(source, /contentClassName="pb-8"/u);

	// Filter controls are additive: Your apps remains first, then Added apps before Favourites.
	assert.match(source, /label: "Filter by your apps"[\s\S]*label: "Added apps"[\s\S]*label: "Favourites"/u);
	assert.match(source, /activeLabel: "Filter by categories"[\s\S]*label: "Categories"/u);
	assert.match(source, /activeLabel: "Filter by companies"[\s\S]*label: "Companies"/u);

	// The dropdown is a searchable multi-select with a selected-count badge.
	assert.match(sharedSource, /placeholder="Search options"/u);
	assert.match(sharedSource, /<Checkbox\s+checked=\{selectedValues\.includes\(option\.id\)\}/u);
	assert.match(sharedSource, /\{selectedCount > 0 \? <Badge>\{selectedCount\}<\/Badge> : null\}/u);

	// Reset clears filters, a result count is shown, and results stay a flat 2-col grid.
	assert.match(source, /onResetFilters=\{resetFilters\}/u);
	assert.match(sharedSource, /Showing \{resultCount\.toLocaleString\("en-US"\)\} \{resultLabel\}/u);
	assert.match(sharedSource, /<ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">/u);

	// Company options derive from company-attributed publishers.
	assert.match(source, /function getCompanyOptions\(/u);
	assert.match(source, /if \(tool\.attributionKind !== "company"\) continue;/u);

	// Results split into "My apps" / "Other apps" micro sections (agent-directory parity).
	assert.doesNotMatch(source, /function ExperimentalAppsSection\(/u);
	assert.match(sharedSource, /<h2 className="px-1\.5 text-xs font-semibold leading-4 text-text-subtlest">/u);
	assert.match(source, /heading="My apps"/u);
	assert.match(source, /heading="Other apps"/u);
	assert.match(source, /const myApps = useMemo\(\(\) => filteredTools\.filter\(isYourApp\)/u);
});

test("App Directory experimental filters show one active facet at a time", () => {
	const source = readProjectFile("components/blocks/app-directory/components/app-directory.tsx");
	const sharedSource = readProjectFile("components/blocks/directory-shared/experimental-directory-view.tsx");

	// Mirrors the experimental agent directory: engaging one filter hides the rest.
	assert.match(sharedSource, /const activeFacet = facets\.find\(facetIsActive\)\?\.id \?\? null;/u);
	assert.match(sharedSource, /const showFacet = \(facet: ExperimentalDirectoryFacet<TOption>\) => activeFacet === null \|\| activeFacet === facet\.id;/u);
	assert.match(source, /id: "yourApps"/u);
	assert.match(source, /id: "addedApps"/u);
	assert.match(source, /id: "favourites"/u);
	assert.match(source, /id: "categories"/u);
	assert.match(source, /id: "companies"/u);
});

test("App Directory experimental view has a filter-aware empty state", () => {
	const source = readProjectFile("components/blocks/app-directory/components/app-directory.tsx");
	const sharedSource = readProjectFile("components/blocks/directory-shared/experimental-directory-view.tsx");

	assert.match(source, /function getExperimentalEmptyState\(/u);
	assert.match(source, /title: "No apps added yet"/u);
	assert.match(source, /title: "No favourite apps yet"/u);
	assert.match(source, /title: "No apps match your filters"/u);
	assert.match(sharedSource, /\{emptyState\.title\}/u);
	assert.match(sharedSource, /\{emptyState\.description\}/u);
});

test("Experimental filter dropdown keeps an end gap inside the scroll list, not the popover", () => {
	const sharedSource = readProjectFile("components/blocks/directory-shared/experimental-directory-view.tsx");
	const agentBrowserSource = readProjectFile("components/blocks/agent-browser/components/agent-browser.tsx");

	// Parent popover drops its bottom padding; the option list owns the end gap so it
	// scrolls with the results. Applied to the shared directory dropdown and agent browser's local shape.
	for (const dropdownSource of [sharedSource, agentBrowserSource]) {
		assert.match(dropdownSource, /className="w-72 gap-2 p-2 pb-0"/u);
		assert.match(dropdownSource, /<ul className="flex flex-col gap-px pb-2">/u);
	}
});
