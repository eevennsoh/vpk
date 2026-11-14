"use strict";

// Rule tables for scripts/verify-lazy-load-boundaries.js: which files are route entries, what
// counts as heavy, which modules load only lazily, which stylesheets have one owner, and the
// runtimes tracked on reach. The verifier owns the checks; this file owns the data.

const DEFAULT_ROUTE_SHELL_FILES = [
	"app/page.tsx",
	"app/components/layout.tsx",
	"app/components/[category]/[slug]/page.tsx",
	"app/visual/[slug]/page.tsx",
	"app/rovo/[[...id]]/page.tsx",
	"app/studio/[[...id]]/page.tsx",
];

const DEFAULT_DEFERRED_MODULE_RULES = [
	{
		entryFile: "components/projects/studio/components/rovo-app-shell.tsx",
		reason: "the Studio Ask Rovo chat panel must stay out of the initial project bundle",
		targetFile: "components/projects/sidebar-chat/page.tsx",
	},
	{
		entryFile: "components/projects/jira-golden-journey-v2/page.tsx",
		reason: "the Jira pull request review subtree must stay out of the initial project bundle",
		targetFile: "components/blocks/jira-work-item/experimental-v2/components/pull-request-detail/pull-request-detail-view.tsx",
	},
	{
		entryFile: "components/projects/jira-golden-journey-v2/page.tsx",
		reason: "the contextual pull request rail must stay out of the initial project bundle",
		targetFile: "components/blocks/jira-work-item/experimental-v2/components/pull-request-detail/pull-request-context-rail.tsx",
	},
	{
		entryFile: "components/projects/jira-golden-journey-v3/page.tsx",
		reason: "the Jira pull request review subtree must stay out of the initial project bundle",
		targetFile: "components/blocks/jira-work-item/experimental-v3/components/pull-request-detail/pull-request-detail-view.tsx",
	},
	{
		entryFile: "components/projects/jira-golden-journey-v3/page.tsx",
		reason: "the contextual pull request rail must stay out of the initial project bundle",
		targetFile: "components/blocks/jira-work-item/experimental-v3/components/pull-request-detail/pull-request-context-rail.tsx",
	},
{
		entryFile: "components/projects/jira-golden-journey-v4/page.tsx",
		reason: "the Jira pull request review subtree must stay out of the initial project bundle",
		targetFile: "components/blocks/jira-work-item/experimental-v3/components/pull-request-detail/pull-request-detail-view.tsx",
	},
{
		entryFile: "components/projects/jira-golden-journey-v4/page.tsx",
		reason: "the contextual pull request rail must stay out of the initial project bundle",
		targetFile: "components/blocks/jira-work-item/experimental-v3/components/pull-request-detail/pull-request-context-rail.tsx",
	},
];

// Modules that load only through a dynamic import (C-8a). No route entry (the shells above,
// every App Router page and every project's entry page) may reach them statically.
const DEFAULT_LAZY_ONLY_MODULES = [
	{
		reason: "the Excalidraw runtime and its stylesheet load when a scene first renders",
		targetFile: "components/projects/shared/components/excalidraw-runtime.ts",
	},
	{
		reason: "Leaflet and its stylesheet load with the map widget",
		targetFile: "lib/json-render/map-widget-canvas.tsx",
	},
];

// Imports with one owner (C-8a): a third-party stylesheet travels with the module that renders
// it, so it reaches only the routes that can render it. Applies to TS/JS imports and CSS @import.
// `match: "stylesheet"` covers every .css file the package ships (any path under the package
// name), so another stylesheet path such as katex/dist/katex.css cannot slip past.
// `match: "module"` names a repository file instead: every static specifier that resolves to it
// counts (dynamic import() stays allowed, as for every rule here), and `ownerFiles` lists the
// files allowed to import it (C-11). A missing target or owner fails the guard.
const DEFAULT_SINGLE_OWNER_IMPORTS = [
	{
		match: "stylesheet",
		ownerFile: "components/ui-custom/streamdown-math.ts",
		reason: "KaTeX CSS loads with the Streamdown math plugin",
		source: "katex",
	},
	{
		match: "exact",
		ownerFile: "components/ui-custom/streamdown-math.ts",
		reason: "importing the math plugin from components/ui-custom/streamdown-math brings KaTeX CSS with it",
		source: "@streamdown/math",
	},
	{
		match: "stylesheet",
		ownerFile: "lib/json-render/map-widget-canvas.tsx",
		reason: "Leaflet CSS loads with the map widget",
		source: "leaflet",
	},
	{
		match: "stylesheet",
		ownerFile: "components/projects/shared/components/excalidraw-runtime.css",
		reason: "Excalidraw CSS loads with the Excalidraw runtime",
		source: "@excalidraw/excalidraw",
	},
	{
		match: "module",
		ownerFiles: [
			"app/data/details/visual.ts",
			"components/website/demos/visual/shader-lab-effect-demo.source.test.js",
			"components/website/demos/visual/shader-lab/definitions.test.ts",
			"components/website/demos/visual/shader-lab/equality.test.ts",
		],
		reason: "the all-layers Shader Lab map is for the server-only details page; a demo imports its own shader-lab/layers module",
		source: "components/website/demos/visual/shader-lab/index.ts",
	},
];

// Files that must not statically import a module family (C-8d).
// Shared logo wrappers (and their stylesheets) that logo-wrappers.ts keeps with the page.
const LOGO_THIRD_PARTY_WRAPPERS = ["@atlassian/logo-third-party/dist/esm/wrapper"];
const LOGO_PRODUCT_WRAPPERS = ["@atlaskit/logo/dist/esm/utils/icon-wrapper", "@atlaskit/logo/dist/esm/utils/logo-wrapper", "@atlaskit/logo/dist/esm/wrapper"];

const DEFAULT_FILE_IMPORT_RULES = [
	{
		// C-8g: the Streamdown runtime (plugins, KaTeX, mermaid) loads with the first message.
		filePath: "components/ui-custom/message-markdown.tsx",
		rules: [
			{ match: "exact", reason: "the markdown runtime loads with the first message, through preloadMessageMarkdown()", source: "./message-markdown-runtime" },
			{ match: "package", reason: "the markdown runtime loads with the first message", source: "streamdown" },
			{ match: "prefix", reason: "the markdown runtime loads with the first message", source: "@streamdown/" },
		],
	},
	{
		filePath: "components/projects/shared/components/icon-registry.tsx",
		rules: [
			{ match: "prefix", reason: "registry icons load on first render through createLazyIcon", source: "@atlaskit/icon/" },
			{ match: "prefix", reason: "registry icons load on first render through createLazyIcon", source: "@atlaskit/icon-lab/" },
		],
	},
	{
		filePath: "components/ui/data/logo-data.ts",
		rules: [
			{ allow: LOGO_PRODUCT_WRAPPERS, match: "package", reason: "product logos load their entrypoint on first render through createLazyGlyph", source: "@atlaskit/logo" },
		],
	},
	{
		filePath: "components/ui/data/logo-third-party-icons.ts",
		rules: [
			{ allow: LOGO_THIRD_PARTY_WRAPPERS, match: "package", reason: "brand logos load their entrypoint on first render through createLazyGlyph", source: "@atlassian/logo-third-party" },
		],
	},
];

const SOURCE_ROOTS = ["app", "components", "hooks", "lib"];

const DEFAULT_HEAVY_IMPORT_RULES = [
	{
		match: "exact",
		source: "@basementstudio/shader-lab",
		reason: "shader demo runtime",
	},
	{
		match: "exact",
		source: "@excalidraw/excalidraw",
		reason: "canvas editor runtime",
	},
	{
		match: "exact",
		source: "@paper-design/shaders-react",
		reason: "shader demo runtime",
	},
	{
		match: "exact",
		source: "@react-three/drei",
		reason: "WebGL helper runtime",
	},
	{
		match: "exact",
		source: "@react-three/fiber",
		reason: "WebGL runtime",
	},
	{
		match: "exact",
		source: "@remotion/player",
		reason: "Remotion runtime",
	},
	{
		match: "exact",
		source: "@rive-app/react-webgl2",
		reason: "WebGL animation runtime",
	},
	{
		match: "exact",
		source: "@web-kits/audio",
		reason: "audio visualization runtime",
	},
	{
		match: "exact",
		source: "@xyflow/react",
		reason: "graph editor runtime",
	},
	{
		match: "exact",
		source: "leaflet",
		reason: "map runtime",
	},
	{
		match: "exact",
		source: "p5",
		reason: "creative-coding runtime",
	},
	{
		match: "exact",
		source: "react-leaflet",
		reason: "map runtime",
	},
	{
		match: "exact",
		source: "remotion",
		reason: "Remotion runtime",
	},
	{
		match: "exact",
		source: "shiki",
		reason: "syntax-highlighting runtime",
	},
	{
		match: "exact",
		source: "three",
		reason: "WebGL runtime",
	},
	{
		match: "prefix",
		source: "@tiptap/",
		reason: "rich-text editor runtime",
	},
	{
		match: "prefix",
		source: "d3-",
		reason: "data-visualization runtime",
	},
];

// Pages that render a catalog demo through loadDemoComponent("slug", "category") load that demo's
// module right after hydration, so the demo module is part of the route's first load.
// The files that hold each category's `slug: dynamic(() => import(...))` entries. ui and
// ui-custom keep their primary tables in a subfolder.
const DEMO_REGISTRY_FILES = {
	arts: ["components/website/registry/arts.ts"],
	blocks: ["components/website/registry/blocks.ts"],
	projects: ["components/website/registry/projects.ts"],
	ui: ["components/website/registry/ui.ts", "components/website/registry/ui/primary.ts"],
	"ui-charts": ["components/website/registry/ui-charts.ts"],
	"ui-custom": ["components/website/registry/ui-custom.ts", "components/website/registry/ui-custom/primary.ts"],
	utility: ["components/website/registry/utility.ts"],
	visual: ["components/website/registry/visual.ts"],
};

// Runtimes tracked on reach only (C-8f): they are not banned from a route shell's own imports
// (Rovo's shell renders markdown on purpose), but the set of route entries that reach each one
// is baselined, so they cannot spread to an entry that does not reach them today.
const DEFAULT_REACH_TRACKED_RULES = [
	{ match: "package", reason: "markdown streaming runtime", source: "streamdown" },
	{ match: "prefix", reason: "Streamdown plugin", source: "@streamdown/" },
	{ match: "package", reason: "math typesetting runtime", source: "katex" },
	{ match: "package", reason: "diagram runtime", source: "mermaid" },
	{ match: "package", reason: "charting runtime", source: "recharts" },
	// The logo packages (C-8g) except the wrappers every logo renders through, which stay with the
	// page on purpose (components/ui/data/logo-wrappers.ts).
	{ allow: LOGO_THIRD_PARTY_WRAPPERS, match: "package", reason: "third-party brand logo map", source: "@atlassian/logo-third-party" },
	{ allow: LOGO_PRODUCT_WRAPPERS, match: "package", reason: "Atlassian product logo map", source: "@atlaskit/logo" },
	// The directory catalogs (C-8g item 3): the four large JSON files, about 360 KB together.
	// Imported only by their loaders in app/data/directory (and one golden-journey fixture).
	...["agent-templates", "knowledge", "skills", "tools"].flatMap((name) => [
		{ match: "exact", reason: "directory catalog data", source: `./${name}.json` },
		{ match: "exact", reason: "directory catalog data", source: `@/app/data/directory/${name}.json` },
	]),
];

const DEFAULT_HEAVY_REACH_BASELINE_PATH = "scripts/lazy-load-heavy-baseline.json";
const DEFAULT_MAX_REACHABLE_MODULES = 6000;

module.exports = {
	DEFAULT_DEFERRED_MODULE_RULES,
	DEFAULT_FILE_IMPORT_RULES,
	DEFAULT_HEAVY_IMPORT_RULES,
	DEFAULT_HEAVY_REACH_BASELINE_PATH,
	DEFAULT_LAZY_ONLY_MODULES,
	DEFAULT_MAX_REACHABLE_MODULES,
	DEFAULT_REACH_TRACKED_RULES,
	DEFAULT_ROUTE_SHELL_FILES,
	DEFAULT_SINGLE_OWNER_IMPORTS,
	DEMO_REGISTRY_FILES,
	SOURCE_ROOTS,
};
