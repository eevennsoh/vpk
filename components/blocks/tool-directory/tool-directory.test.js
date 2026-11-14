const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

function readProjectFile(relativePath) {
	return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("Tool Directory is exposed as a website block", () => {
	assert.match(
		readProjectFile("app/data/component-manifest.ts"),
		/blockComponent\("tool-directory", "Tool Directory"\)/u,
	);
	assert.match(
		readProjectFile("app/data/component-manifest.ts"),
		/blockComponent\("tool-directory", "Tool Directory"\)/u,
	);
	assert.match(
		readDetailCategorySource("blocks"),
		/import \{ ToolDirectoryDialog \} from "@\/components\/blocks\/tool-directory";/u,
	);
	assert.match(
		readWebsiteRegistrySource(),
		/"tool-directory": dynamic\(\s*\(\) => import\("\.\/demos\/blocks\/tool-directory-demo"\)/u,
	);
});

test("Tool Directory docs demo starts closed until the trigger is clicked", () => {
	const pageSource = readProjectFile("components/blocks/tool-directory/page.tsx");

	assert.match(pageSource, /const \[open, setOpen\] = useState\(false\);/u);
	assert.match(pageSource, /className="flex h-full min-h-screen items-center justify-center p-4"/u);
});

test("Tool Directory detail header uses 24px vertical padding", () => {
	const source = readProjectFile("components/blocks/tool-directory/components/tool-directory.tsx");

	assert.match(source, /function ToolDirectoryHeader[\s\S]*className="flex items-center justify-between px-6 py-6"/u);
});

test("Tool Directory owns the Figma modal instead of wrapping AgentBrowserDialog", () => {
	const source = readProjectFile("components/blocks/tool-directory/components/tool-directory.tsx");
	const variantsSource = readProjectFile("components/ui-custom/entity-card/variants.tsx");
	const entityCardToolSource = readProjectFile("components/ui-custom/entity-card/tool.tsx");

	assert.doesNotMatch(source, /AgentBrowserDialog/u);
	assert.match(source, /className="grid h-\[min\(768px,calc\(100svh-2rem\)\)\][\s\S]*sm:!max-w-\[1200px\]"/u);
	assert.match(source, /New tool/u);
	assert.match(source, /onBack=\{selectedTool \? \(\) => setSelectedToolId\(null\) : undefined\}/u);
	assert.match(source, /aria-label="Back to tools"[\s\S]*size="icon"[\s\S]*<ArrowLeftIcon label="" color="currentColor" \/>/u);
	assert.doesNotMatch(source, />\s*Back\s*</u);
	assert.match(source, /Search for a tool by name, or describe it/u);
	assert.match(source, /Sort by latest/u);
	assert.match(source, /Showing \{filteredTools\.length\.toLocaleString\("en-US"\)\} results/u);
	assert.match(source, /<ToolCard onSelectTool=\{onSelectTool\} tool=\{tool\} \/>/u);
	assert.match(source, /const \[moreMenuOpen, setMoreMenuOpen\] = useState\(false\);/u);
	assert.match(source, /<EntityCardToolCard[\s\S]*active=\{moreMenuOpen\}[\s\S]*moreAction=\{[\s\S]*<DirectoryCardMoreMenu[\s\S]*onOpenChange=\{setMoreMenuOpen\}[\s\S]*open=\{moreMenuOpen\}/u);
	assert.match(source, /aria-pressed=\{open \|\| undefined\}/u);
	assert.match(source, /className="min-h-\[102px\] hover:border-transparent"/u);
	assert.match(source, /import \{ AtlassianLogo, CustomLogo \} from "@\/components\/ui\/logo";/u);
	assert.match(source, /import \{ AtlassianLogoGlyph, AtlassianLogoMark, BrandLogoMark \} from "@\/components\/ui\/logo-mark";/u);
	assert.match(source, /<AtlassianLogoMark label=\{tool\.name\} name=\{tool\.logoName \?\? "atlassian"\} size="medium" \/>/u);
	assert.match(source, /const logoName = tool\.logoName \?\? "atlassian";[\s\S]*if \(logoName === "atlassian"\) \{[\s\S]*return <AtlassianLogoGlyph className="!size-12" name=\{logoName\} size="xlarge" \/>;/u);
	assert.match(source, /tool\.logoName \|\| tool\.id === "atlassian"/u);
	assert.match(source, /const src = tool\.logoSrc \?\? tool\.avatarSrc;/u);
	assert.match(source, /<BrandLogoMark frame="tile" label=\{tool\.name\} size="medium" src=\{src\} \/>/u);
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
	assert.match(variantsSource, /<EntityCardShell active=\{active\} className=\{cn\("gap-4", className\)\}/u);
	assert.match(variantsSource, /<EntityCardTool/u);
	assert.match(variantsSource, /action=\{moreAction\}/u);
	assert.match(variantsSource, /onMoreActions=\{onMoreActions\}/u);
	assert.match(entityCardToolSource, /<EntityCardMoreButton active=\{active\}/u);
	assert.match(entityCardToolSource, /<div className="flex flex-col gap-2">[\s\S]*<EntityCardHeader[\s\S]*<EntityCardDescription>/u);
	assert.match(readProjectFile("components/hooks/use-has-vertical-overflow.ts"), /scrollTop > 1/u);
	assert.match(readProjectFile("components/hooks/use-has-vertical-overflow.ts"), /showTopScrollMask: hasVerticalOverflow && hasScrolledFromTop/u);
	assert.match(readProjectFile("app/tailwind-theme.css"), /@utility scroll-mask-top/u);
	assert.doesNotMatch(source, /overflow-y-auto px-6 pt-6 pb-6/u);
	assert.doesNotMatch(source, /overflow-y-auto pl-6 pt-6/u);
});

test("Tool Directory keeps compatible types while adding tool detail fields", () => {
	// The tool type is now owned by the data layer (single type identity) and
	// re-exported from the component module for existing callers.
	const loaderSource = readProjectFile("app/data/directory/tools.ts");
	const componentSource = readProjectFile("components/blocks/tool-directory/components/tool-directory.tsx");

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
	assert.match(
		componentSource,
		/export type \{ ToolDirectoryPermission, ToolDirectoryTool \} from "@\/app\/data\/directory\/tools";/u,
	);
	assert.match(componentSource, /export type ToolDirectorySidebarGroup = AgentBrowserSidebarGroup;/u);
});

test("Tool Directory supports controlled and uncontrolled added tool state", () => {
	const source = readProjectFile("components/blocks/tool-directory/components/tool-directory.tsx");

	assert.match(source, /addedToolIds\?: readonly string\[\];/u);
	assert.match(source, /defaultAddedToolIds\?: readonly string\[\];/u);
	assert.match(source, /onAddedToolIdsChange\?: \(toolIds: readonly string\[\]\) => void;/u);
	assert.match(source, /const controlledAddedIds = typeof addedToolIds !== "undefined";/u);
	assert.match(source, /onAddedToolIdsChange\?\.\(\[\.\.\.nextAddedIds\]\);/u);
	assert.match(source, /Add to agent/u);
	assert.match(source, /Remove/u);
	assert.match(source, /<Button variant="destructive" onClick=\{onRemoveTool\} type="button">[\s\S]*<DeleteIcon label="" size="small" \/>[\s\S]*Remove/u);
	assert.match(source, /const presentation = resolveBrandLogoPresentation\(src\);[\s\S]*presentation\.hasBorder && src\.startsWith\("\/3p\/"\)[\s\S]*<Image[\s\S]*src=\{presentation\.src\}/u);
	assert.doesNotMatch(source, /size="sm"/u);
	assert.doesNotMatch(source, /className="h-px bg-border"/u);
});

test("Tool Directory category data follows the requested category content", () => {
	const source = readProjectFile("components/blocks/tool-directory/data/categories.ts");

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

test("Tool Directory docs demo includes added and non-added detail states", () => {
	const source = readProjectFile("components/blocks/tool-directory/page.tsx");
	const componentSource = readProjectFile("components/blocks/tool-directory/components/tool-directory.tsx");
	// Tool data is now the single-source-of-truth JSON catalog (two groups).
	const toolsData = JSON.parse(readProjectFile("app/data/directory/tools.json"));
	const allTools = [...toolsData.tools, ...toolsData.sessionTools];
	const sidebarGroupsSource = readProjectFile("components/blocks/tool-directory/data/sidebar-groups.ts");

	assert.match(source, /import \{ DEMO_SESSION_TOOLS, DEMO_TOOLS \} from "@\/app\/data\/directory\/tools";/u);
	assert.match(source, /defaultAddedToolIds=\{\["atlassian"\]\}/u);
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
	assert.match(componentSource, /label: "Favourite tools"/u);
	assert.match(componentSource, /if \(activeCategory === "favorite-tools" && !tool\.favorite\) return false;/u);
	assert.match(componentSource, /teammateCount=\{tool\.teammateCount\}/u);
	assert.match(componentSource, /toolCount=\{tool\.toolCount\}/u);
	assert.match(componentSource, /<p className="flex items-center gap-1">[\s\S]*<span>By<\/span>[\s\S]*<span className="truncate text-link">\{publisher\}<\/span>[\s\S]*StatusVerifiedIcon label="Verified"/u);
	assert.doesNotMatch(componentSource, /<div className="flex items-center gap-2">[\s\S]*<h2 className="text-2xl font-semibold leading-7 text-text">\{tool\.name\}<\/h2>[\s\S]*StatusVerifiedIcon label="Verified"/u);
	assert.match(componentSource, /\{tool\.teammateCount\.toLocaleString\("en-US"\)\} teammates/u);
	assert.doesNotMatch(componentSource, /Used by \{tool\.teammateCount/u);
	assert.doesNotMatch(componentSource, /teammateCount=\{tool\.teammateCount \?\? 258\}/u);
	assert.doesNotMatch(componentSource, /toolCount=\{tool\.toolCount \?\? 36\}/u);
	assert.match(componentSource, /const MAX_VISIBLE_CATEGORY_ITEMS = 5;/u);
	assert.match(componentSource, /const \[showAllCategories, setShowAllCategories\] = useState\(false\);/u);
	assert.match(componentSource, /TOOL_DIRECTORY_CATEGORIES\.slice\(0, MAX_VISIBLE_CATEGORY_ITEMS\)/u);
	assert.match(componentSource, /label="Show all"[\s\S]*onClick=\{\(\) => setShowAllCategories\(true\)\}/u);
	assert.match(componentSource, /sidebarGroups = DEFAULT_TOOL_DIRECTORY_SIDEBAR_GROUPS/u);
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
