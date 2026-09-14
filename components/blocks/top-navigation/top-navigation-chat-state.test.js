const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const TOP_NAVIGATION_SOURCE = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
const USE_TOP_NAVIGATION_SOURCE = fs.readFileSync(path.join(__dirname, "hooks", "use-top-navigation.ts"), "utf8");
const RIGHT_NAVIGATION_SOURCE = fs.readFileSync(path.join(__dirname, "components", "right-navigation.tsx"), "utf8");
const RIGHT_NAVIGATION_ACTIONS_SOURCE = fs.readFileSync(
	path.join(__dirname, "components", "right-navigation-actions.tsx"),
	"utf8",
);
const PROJECT_LAYOUT_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "..", "projects", "page.tsx"),
	"utf8",
);
const LAYOUT_CONSTANTS_SOURCE = fs.readFileSync(path.join(__dirname, "layout-constants.ts"), "utf8");
const CREATE_BUTTON_SOURCE = fs.readFileSync(path.join(__dirname, "components", "create-button.tsx"), "utf8");
const TOP_NAVIGATION_DEMO_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "..", "website", "demos", "blocks", "top-navigation-demo.tsx"),
	"utf8",
);
const STUDIO_ROVO_APP_SHELL_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "..", "projects", "studio", "components", "rovo-app-shell.tsx"),
	"utf8",
);
const ROVO_APP_SHELL_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "..", "projects", "rovo", "components", "rovo-app-shell.tsx"),
	"utf8",
);

test("Ask Rovo button exposes sidebar chat open state as pressed state", () => {
	assert.match(RIGHT_NAVIGATION_SOURCE, /isChatOpen = false/);

	// Ask Rovo is a single full-text button rendered once (inline or inside the
	// overflow popover, never both), so exactly one aria-pressed binding exists.
	const pressedStateMatches = RIGHT_NAVIGATION_ACTIONS_SOURCE.match(/aria-pressed=\{isChatOpen\}/g) ?? [];
	assert.equal(pressedStateMatches.length, 1);

	// The old narrow-width standalone Ask Rovo icon button is gone.
	assert.doesNotMatch(RIGHT_NAVIGATION_ACTIONS_SOURCE, /aria-label="Ask Rovo"/);
	assert.match(RIGHT_NAVIGATION_ACTIONS_SOURCE, /Ask Rovo/);
});

test("top navigation derives Ask Rovo pressed state from the sidebar chat surface", () => {
	assert.match(USE_TOP_NAVIGATION_SOURCE, /toggleChat,.*chatSurface.*\} = useRovoChatControls\(\);/);
	assert.match(USE_TOP_NAVIGATION_SOURCE, /const isSidebarChatOpen = chatSurface === "sidebar";/);
	assert.match(USE_TOP_NAVIGATION_SOURCE, /isSidebarChatOpen,/);
	assert.match(TOP_NAVIGATION_SOURCE, /isChatOpen=\{nav\.isSidebarChatOpen\}/);
});

test("top navigation caps search globally and centers it only when the persistent sidebar is collapsed", () => {
	// The search lives in a middle zone that grows but caps at a max / floors at a
	// min width, centering at wide widths (Figma) and left-aligning below the
	// center breakpoint.
	assert.match(
		LAYOUT_CONSTANTS_SOURCE,
		/export const TOP_NAV_SEARCH_MAX_WIDTH_PX = 780;/,
	);
	assert.match(
		LAYOUT_CONSTANTS_SOURCE,
		/export const TOP_NAV_SEARCH_MIN_WIDTH_PX = 180;/,
	);
	assert.match(
		LAYOUT_CONSTANTS_SOURCE,
		/export const TOP_NAV_SEARCH_CENTER_BREAKPOINT_PX = 1200;/,
	);
	assert.match(
		LAYOUT_CONSTANTS_SOURCE,
		/export const TOP_NAV_SEARCH_ICON_BREAKPOINT_PX = 360;/,
	);
	assert.match(
		LAYOUT_CONSTANTS_SOURCE,
		/export const TOP_NAV_HEADER_HEIGHT_PX = 56;/,
	);
	// Page wires the center/left alignment and the capped search width. The search
	// grows to the cap but uses its min as a flex-basis (not a hard floor) so it
	// shrinks under pressure instead of clipping the right cluster.
	assert.match(TOP_NAVIGATION_SOURCE, /const isPersistentSidebarVisible = variant === "header" \? nav\.isVisible : sidebarOpen;/);
	assert.match(TOP_NAVIGATION_SOURCE, /const centerSearch = !isPersistentSidebarVisible/);

	for (const source of [TOP_NAVIGATION_SOURCE, STUDIO_ROVO_APP_SHELL_SOURCE, ROVO_APP_SHELL_SOURCE]) {
		assert.match(source, /maxWidth: `\$\{TOP_NAV_SEARCH_MAX_WIDTH_PX\}px`/);
		assert.match(source, /flexBasis: `\$\{TOP_NAV_SEARCH_MIN_WIDTH_PX\}px`/);
		assert.match(source, /TOP_NAV_SEARCH_CENTER_BREAKPOINT_PX/);
	}

	for (const source of [STUDIO_ROVO_APP_SHELL_SOURCE, ROVO_APP_SHELL_SOURCE]) {
		assert.match(source, /!chat\.sidebarOpen/);
		assert.match(source, /onToggleSidebar=\{\(\) => chat\.setSidebarOpen\(!chat\.sidebarOpen\)\}/u);
		assert.match(source, /\? "pointer-events-none absolute inset-x-0 justify-center px-3 \[&>\*\]:pointer-events-auto"/u);
		assert.match(source, /&& "justify-end"/u);
	}
});

test("the centered search overlay reserves the right cluster it would otherwise overlap", () => {
	// Regression: the centered middle zone is an overlay spanning the whole bar,
	// so `px-3` alone let a 780px search run over the Ask Rovo pill. The bar
	// measures the cluster and pads both sides by the reserve instead.
	assert.match(TOP_NAVIGATION_SOURCE, /const \[setRightClusterNode, rightClusterWidth\] = useMeasuredWidth\(\);/u);
	assert.match(TOP_NAVIGATION_SOURCE, /ref=\{setRightClusterNode\}/u);
	assert.match(
		TOP_NAVIGATION_SOURCE,
		/const centeredZoneInsetPx = getCenteredSearchInsetPx\(product, rightClusterWidth\);/u,
	);
	assert.match(
		TOP_NAVIGATION_SOURCE,
		/style=\{centerSearch \? \{ paddingInline: `\$\{centeredZoneInsetPx\}px` \} : undefined\}/u,
	);
	// The overlay must not re-introduce its own flat padding alongside the reserve.
	assert.doesNotMatch(
		TOP_NAVIGATION_SOURCE,
		/"pointer-events-none absolute inset-x-0 justify-center px-3/u,
	);
	assert.match(RIGHT_NAVIGATION_SOURCE, /ref\?: Ref<HTMLDivElement>;/u);
	assert.match(LAYOUT_CONSTANTS_SOURCE, /export function getCenteredSearchInsetPx\(/u);
});

test("top navigation keeps the legacy sidebar inset without overriding collapsed centering", () => {
	assert.match(TOP_NAVIGATION_SOURCE, /searchAlignment\?: "responsive" \| "sidebar";/);
	assert.match(TOP_NAVIGATION_SOURCE, /searchAlignment = "responsive"/);
	assert.match(TOP_NAVIGATION_SOURCE, /const centerSearch = !isPersistentSidebarVisible/);
	assert.match(TOP_NAVIGATION_SOURCE, /searchAlignment === "sidebar" \? "ps-2" : undefined/);
});

test("top navigation can fill a height-constrained parent", () => {
	assert.match(TOP_NAVIGATION_SOURCE, /shellHeight\?: "viewport" \| "parent";/);
	assert.match(TOP_NAVIGATION_SOURCE, /shellHeight = "viewport"/);
	assert.match(
		TOP_NAVIGATION_SOURCE,
		/shellHeight === "parent" \? "h-full! min-h-0!" : "h-svh"/,
	);
});

test("top navigation lets an owning shell start with its sidebar collapsed", () => {
	assert.match(TOP_NAVIGATION_SOURCE, /defaultSidebarOpen\?: boolean;/u);
	assert.match(TOP_NAVIGATION_SOURCE, /defaultSidebarOpen = true/u);
	assert.match(TOP_NAVIGATION_SOURCE, /useState\(defaultSidebarOpen\)/u);
	assert.match(TOP_NAVIGATION_SOURCE, /defaultOpen=\{defaultSidebarOpen\}/u);
});

test("top navigation collapses the search to an icon button on very narrow viewports", () => {
	assert.match(TOP_NAVIGATION_SOURCE, /TOP_NAV_SEARCH_ICON_BREAKPOINT_PX/);
	assert.match(TOP_NAVIGATION_SOURCE, /isSearchCollapsible/);
	assert.match(TOP_NAVIGATION_SOURCE, /handleExpandSearchIcon/);
	assert.match(
		TOP_NAVIGATION_SOURCE,
		/<Button[\s\S]*aria-label="Search"[\s\S]*size="icon"[\s\S]*variant="outline"/u,
	);
});

test("top navigation sizes responsive search chrome from its rendered container", () => {
	assert.match(TOP_NAVIGATION_SOURCE, /new ResizeObserver/);
	assert.match(TOP_NAVIGATION_SOURCE, /const responsiveWidth = containerWidth \|\| nav\.windowWidth;/u);
	assert.match(TOP_NAVIGATION_SOURCE, /responsiveWidth < TOP_NAV_SEARCH_ICON_BREAKPOINT_PX/u);
	assert.match(TOP_NAVIGATION_SOURCE, /windowWidth=\{responsiveWidth\}/u);
	assert.match(TOP_NAVIGATION_SOURCE, /ref=\{setNavigationContainer\}/u);
});

test("standalone top navigation releases its pinned shell sidebar in small containers", () => {
	assert.match(
		TOP_NAVIGATION_SOURCE,
		/const shellWidth = nav\.windowWidth \|\| responsiveWidth;/u,
	);
	assert.match(TOP_NAVIGATION_SOURCE, /shellWidth < TOP_NAV_SIDEBAR_PIN_RELEASE_BREAKPOINT_PX/u);
	assert.match(TOP_NAVIGATION_SOURCE, /didAutoReleaseShellSidebarRef/u);
	assert.match(TOP_NAVIGATION_SOURCE, /isSmallContainer && sidebarOpen/u);
	assert.match(TOP_NAVIGATION_SOURCE, /didAutoReleaseShellSidebarRef\.current = true;\s+setSidebarOpen\(false\)/u);
	assert.match(
		TOP_NAVIGATION_SOURCE,
		/else if \(!isSmallContainer && didAutoReleaseShellSidebarRef\.current\)/u,
	);
	assert.match(TOP_NAVIGATION_SOURCE, /\[nav\.windowWidth, responsiveWidth, sidebarOpen\]/u);
	assert.doesNotMatch(TOP_NAVIGATION_SOURCE, /setSidebarOpen\(\(current\) =>/u);
});

test("top navigation renders the shared theme toggle after settings", () => {
	assert.match(
		RIGHT_NAVIGATION_ACTIONS_SOURCE,
		/import \{ ThemeToggle \} from "@\/components\/utils\/theme-wrapper";/u,
	);
	assert.match(
		RIGHT_NAVIGATION_ACTIONS_SOURCE,
		/aria-label="Settings"[\s\S]*<ThemeToggle \/>[\s\S]*\{\/\* Profile \*\/\}/u,
	);
	assert.doesNotMatch(RIGHT_NAVIGATION_ACTIONS_SOURCE, /aria-label="Toggle theme"/u);
});

test("right navigation settings button can render optional dropdown actions", () => {
	assert.match(RIGHT_NAVIGATION_ACTIONS_SOURCE, /interface RightNavigationSettingsMenuItem/);
	assert.match(RIGHT_NAVIGATION_ACTIONS_SOURCE, /settingsMenuItems\?: ReadonlyArray<RightNavigationSettingsMenuItem>/);
	assert.match(RIGHT_NAVIGATION_ACTIONS_SOURCE, /const hasSettingsMenu = Boolean\(settingsMenuItems && settingsMenuItems\.length > 0\);/);
	// The settings dropdown itself is now unconditional — it owns the
	// design-variant toggles. What stays gated on hasSettingsMenu is the
	// caller-supplied block, so an empty settingsMenuItems cannot leave a
	// dangling separator and empty group hanging off the bottom of the menu.
	assert.doesNotMatch(RIGHT_NAVIGATION_ACTIONS_SOURCE, /Design variation/);
	assert.doesNotMatch(RIGHT_NAVIGATION_ACTIONS_SOURCE, /useDesignVariation|design-variation/);
	assert.match(
		RIGHT_NAVIGATION_ACTIONS_SOURCE,
		/hasSettingsMenu \? \([\s\S]*<DropdownMenuSeparator \/>[\s\S]*<DropdownMenuGroup>[\s\S]*onSelect=\{item\.onSelect\}/u,
	);
	assert.match(RIGHT_NAVIGATION_ACTIONS_SOURCE, /aria-label="Settings"[\s\S]*<DropdownMenuContent align="end" className="w-64">/u);
	assert.match(RIGHT_NAVIGATION_ACTIONS_SOURCE, /onSelect=\{item\.onSelect\}/);
	assert.match(RIGHT_NAVIGATION_SOURCE, /settingsMenuItems\?: ReadonlyArray<RightNavigationSettingsMenuItem>/);
	assert.match(RIGHT_NAVIGATION_SOURCE, /settingsMenuItems=\{settingsMenuItems\}/);
});

test("routes can limit Settings properties to supported design variants", () => {
	assert.match(
		RIGHT_NAVIGATION_ACTIONS_SOURCE,
		/settingsDesignVariantIds\?: readonly DesignVariantId\[\];/u,
	);
	assert.match(
		RIGHT_NAVIGATION_ACTIONS_SOURCE,
		/const settingsDesignVariants = settingsDesignVariantIds === undefined\s*\? DESIGN_VARIANTS\s*: DESIGN_VARIANTS\.filter\(\(variant\) => settingsDesignVariantIds\.includes\(variant\.id\)\);/u,
	);
	assert.match(RIGHT_NAVIGATION_ACTIONS_SOURCE, /\{settingsDesignVariants\.map\(\(variant\) => \(/u);
	assert.match(RIGHT_NAVIGATION_SOURCE, /settingsDesignVariantIds\?: readonly DesignVariantId\[\];/u);
	assert.match(RIGHT_NAVIGATION_SOURCE, /settingsDesignVariantIds=\{settingsDesignVariantIds\}/u);
	assert.match(TOP_NAVIGATION_SOURCE, /settingsDesignVariantIds\?: readonly DesignVariantId\[\];/u);
	assert.match(TOP_NAVIGATION_SOURCE, /settingsDesignVariantIds=\{settingsDesignVariantIds\}/u);
	assert.match(PROJECT_LAYOUT_SOURCE, /settingsDesignVariantIds\?: readonly DesignVariantId\[\];/u);
	assert.match(PROJECT_LAYOUT_SOURCE, /settingsDesignVariantIds=\{settingsDesignVariantIds\}/u);
});

test("Settings properties put their checkmark in the trailing slot", () => {
	assert.match(
		RIGHT_NAVIGATION_ACTIONS_SOURCE,
		/<DropdownMenuCheckboxItem[\s\S]*?indicatorPlacement="end"[\s\S]*?checked=\{designVariants\[variant\.id\]\}/u,
	);
});

test("top navigation can retain a static settings icon for fixed-presentation routes", () => {
	assert.match(TOP_NAVIGATION_SOURCE, /settingsIconOnly\?: boolean;/u);
	assert.match(TOP_NAVIGATION_SOURCE, /settingsIconOnly=\{settingsIconOnly\}/u);
	assert.match(RIGHT_NAVIGATION_SOURCE, /settingsIconOnly\?: boolean;/u);
	assert.match(RIGHT_NAVIGATION_SOURCE, /settingsIconOnly=\{settingsIconOnly\}/u);
	assert.match(
		RIGHT_NAVIGATION_ACTIONS_SOURCE,
		/settingsIconOnly \? \([\s\S]*aria-hidden="true"[\s\S]*data-static-settings-icon=""[\s\S]*<SettingsIcon label="" color="currentColor" \/>[\s\S]*\) : \(\s*<DropdownMenu>/u,
	);
});

test("top navigation auto-releases the pinned sidebar at small viewports", () => {
	// A dedicated, well-named breakpoint drives the release (reusing the overflow
	// breakpoint value so the sidebar un-pins exactly when the right cluster
	// overflows and the sidebar becomes a mobile overlay).
	assert.match(
		LAYOUT_CONSTANTS_SOURCE,
		/export const TOP_NAV_SIDEBAR_PIN_RELEASE_BREAKPOINT_PX = TOP_NAV_OVERFLOW_BREAKPOINT_PX;/,
	);

	// The hook releases the pin below the breakpoint and remembers it did so.
	assert.match(USE_TOP_NAVIGATION_SOURCE, /setSidebarVisible/);
	assert.match(USE_TOP_NAVIGATION_SOURCE, /windowWidth < TOP_NAV_SIDEBAR_PIN_RELEASE_BREAKPOINT_PX/);
	assert.match(USE_TOP_NAVIGATION_SOURCE, /didAutoReleaseSidebarRef/);
	assert.match(USE_TOP_NAVIGATION_SOURCE, /setSidebarVisible\(false\)/);
	// And restores the prior pinned state when the viewport grows back.
	assert.match(USE_TOP_NAVIGATION_SOURCE, /setSidebarVisible\(true\)/);
	// Guard against acting on the SSR/first-paint measurement.
	assert.match(USE_TOP_NAVIGATION_SOURCE, /if \(windowWidth === 0\)/);
});

test("right navigation collapses into an overflow popover at narrow widths", () => {
	assert.match(LAYOUT_CONSTANTS_SOURCE, /export const TOP_NAV_OVERFLOW_BREAKPOINT_PX = 768;/);
	assert.match(RIGHT_NAVIGATION_SOURCE, /TOP_NAV_OVERFLOW_BREAKPOINT_PX/);
	assert.match(RIGHT_NAVIGATION_SOURCE, /windowWidth < TOP_NAV_OVERFLOW_BREAKPOINT_PX/);
	assert.match(RIGHT_NAVIGATION_SOURCE, /<Popover /);
	assert.match(RIGHT_NAVIGATION_SOURCE, /ShowMoreHorizontalIcon/);
	assert.match(RIGHT_NAVIGATION_SOURCE, /aria-label="More"/);

	// The collapse is gated on mount so the SSR/first-paint width of 0 does not
	// briefly render the overflow popover before the real width arrives.
	assert.match(RIGHT_NAVIGATION_SOURCE, /useIsMounted/);
	assert.match(RIGHT_NAVIGATION_SOURCE, /isMounted && windowWidth < TOP_NAV_OVERFLOW_BREAKPOINT_PX/);
});

test("Create button keeps its full label at every breakpoint (Figma 1768 → 320)", () => {
	// Figma shows the labelled "+ Create" pill at every frame down to 320, so the
	// button must never collapse to an icon-only state (no `max-md` hide/shrink).
	assert.match(CREATE_BUTTON_SOURCE, /<span>Create<\/span>/);
	assert.doesNotMatch(CREATE_BUTTON_SOURCE, /max-md:hidden/);
	assert.doesNotMatch(CREATE_BUTTON_SOURCE, /max-md:size-8/);
});

test("block demo forces the Ask Rovo pill so the right cluster matches Figma", () => {
	// The Figma global top navigation always renders Ask Rovo in the right
	// cluster. Studio normally suppresses it, so the standalone block demo opts in
	// via forceShowRovoAction, which the page threads through to RightNavigation.
	assert.match(TOP_NAVIGATION_DEMO_SOURCE, /forceShowRovoAction/);
	assert.match(TOP_NAVIGATION_SOURCE, /forceShowRovoAction = false/);
	assert.match(TOP_NAVIGATION_SOURCE, /forceShowRovoAction=\{forceShowRovoAction\}/);
});
