import { compareByNameNatural } from "@/lib/utils";

export type ComponentCategory =
	| "ui-audio"
	| "ui-charts"
	| "ui-custom"
	| "ui"
	| "blocks"
	| "projects"
	| "arts"
	| "utility"
	| "visual";

export interface ComponentManifestEntry {
	name: string;
	slug: string;
	importPath: string;
	category: ComponentCategory;
}

function sortEntriesByName<T extends { name: string }>(entries: readonly T[]): T[] {
	return [...entries].sort(compareByNameNatural);
}

function toTitleCase(slug: string): string {
	return slug
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

function customComponent(slug: string, name?: string): ComponentManifestEntry {
	return {
		name: name ?? toTitleCase(slug),
		slug,
		importPath: `@/components/ui-custom/${slug}`,
		category: "ui-custom",
	};
}

function audioComponent(slug: string, name?: string): ComponentManifestEntry {
	return {
		name: name ?? toTitleCase(slug),
		slug,
		importPath: `@/components/ui-audio/${slug}`,
		category: "ui-audio",
	};
}

function uiChartComponent(slug: string, name?: string, importPath?: string): ComponentManifestEntry {
	return {
		name: name ?? toTitleCase(slug),
		slug,
		importPath: importPath ?? `@/components/ui-charts/${slug}`,
		category: "ui-charts",
	};
}

function uiComponent(slug: string, name?: string): ComponentManifestEntry {
	return {
		name: name ?? toTitleCase(slug),
		slug,
		importPath: `@/components/ui/${slug}`,
		category: "ui",
	};
}

function blockComponent(slug: string, name?: string): ComponentManifestEntry {
	return {
		name: name ?? toTitleCase(slug),
		slug,
		importPath: `@/components/blocks/${slug}`,
		category: "blocks",
	};
}

function projectComponent(slug: string, name?: string): ComponentManifestEntry {
	return {
		name: name ?? toTitleCase(slug),
		slug,
		importPath: `@/components/projects/${slug}`,
		category: "projects",
	};
}

function artComponent(slug: string, name?: string): ComponentManifestEntry {
	return {
		name: name ?? toTitleCase(slug),
		slug,
		importPath: `@/components/arts/${slug}`,
		category: "arts",
	};
}

function utilityComponent(slug: string, name?: string): ComponentManifestEntry {
	return {
		name: name ?? toTitleCase(slug),
		slug,
		importPath: `@/components/website/demos/utils/${slug}-demo`,
		category: "utility",
	};
}

function visualComponent(
	slug: string,
	name: string,
	importPath: string,
): ComponentManifestEntry {
	return {
		name,
		slug,
		importPath,
		category: "visual",
	};
}

const PAPER_SHADER_DEMO_IMPORT_PATH = "@/components/website/demos/visual/shaders-paper-demo";

const PAPER_SHADER_COMPONENTS = [
	["paper-color-panels", "Color Panels"],
	["paper-dithering", "Dithering"],
	["paper-dot-grid", "Dot Grid"],
	["paper-dot-orbit", "Dot Orbit"],
	["paper-fluted-glass", "Fluted Glass"],
	["paper-gem-smoke", "Gem Smoke"],
	["paper-god-rays", "God Rays"],
	["paper-grain-gradient", "Grain Gradient"],
	["paper-halftone-cmyk", "Halftone CMYK"],
	["paper-halftone-dots", "Halftone Dots"],
	["paper-heatmap", "Heatmap"],
	["paper-image-dithering", "Image Dithering"],
	["paper-liquid-metal", "Liquid Metal"],
	["paper-mesh-gradient", "Mesh Gradient"],
	["paper-metaballs", "Metaballs"],
	["paper-neuro-noise", "Neuro Noise"],
	["paper-paper-texture", "Paper Texture"],
	["paper-perlin-noise", "Perlin Noise"],
	["paper-pulsing-border", "Pulsing Border"],
	["paper-simplex-noise", "Simplex Noise"],
	["paper-smoke-ring", "Smoke Ring"],
	["paper-spiral", "Spiral"],
	["paper-static-mesh-gradient", "Static Mesh Gradient"],
	["paper-static-radial-gradient", "Static Radial Gradient"],
	["paper-swirl", "Swirl"],
	["paper-voronoi", "Voronoi"],
	["paper-warp", "Warp"],
	["paper-water", "Water"],
	["paper-waves", "Waves"],
] as const;

export const CUSTOM_COMPONENTS: ComponentManifestEntry[] = sortEntriesByName([
	customComponent("agent-loading", "Agent Loading"),
	customComponent("animated-dots", "Animated Dots"),
	customComponent("animated-icon", "Animated Icons"),
	customComponent("animated-rovo", "Animated Rovo"),
	customComponent("artifact-list", "Artifact List"),
	customComponent("attachments"),
	customComponent("audio-player", "Audio Player"),
	customComponent("canvas"),
	customComponent("entity-card", "Entity Card"),
	customComponent("knowledge"),
	customComponent("footer", "Footer"),
	customComponent("hover-reveal-row", "Hover Reveal Row"),
	customComponent("human-agent-avatar", "Human Agent Avatar"),
	customComponent("object-tile", "Object Tile"),
	customComponent("progress-circle", "Progress Circle"),
	customComponent("progress-rovo", "Progress Rovo"),
	customComponent("sidebar-nav-item", "Sidebar Nav Item"),
	customComponent("skill-tag", "Skill Tag"),
	customComponent("chain-of-thought", "Chain of Thought"),
	customComponent("checkpoint"),
	customComponent("code-block", "Code Block"),
	customComponent("code-list", "Code List"),
	customComponent("commit"),
	customComponent("confirmation"),
	customComponent("connection"),
	customComponent("context"),
	customComponent("context-bar", "Context Bar"),
	customComponent("controls"),
	customComponent("conversation"),
	customComponent("edge"),
	customComponent("environment-variables", "Environment Variables"),
	customComponent("file-tree", "File Tree"),
	customComponent("file-tree-2", "File Tree 2"),
	customComponent("image"),
	customComponent("inline-citation", "Inline Citation"),
	customComponent("jsx-preview", "JSX Preview"),
	customComponent("list"),
	customComponent("message"),
	customComponent("mic-selector", "Mic Selector"),
	customComponent("model-selector", "Model Selector"),
	customComponent("morphing-rovo", "Morphing Rovo"),
	customComponent("node"),
	customComponent("open-in-chat", "Open in Chat"),
	customComponent("package-info", "Package Info"),
	customComponent("flow-panel", "Flow Panel"),
	customComponent("persona"),
	customComponent("pixel-loader", "Pixel Loader"),
	customComponent("plan"),
	customComponent("prompt-input", "Prompt Input"),
	customComponent("queue"),
	customComponent("reasoning"),
	customComponent("rovo-cursor", "Rovo Cursor"),
	customComponent("rovo-generation", "Rovo Generation"),
	customComponent("rovo-illustration", "Rovo Illustration"),
	customComponent("rovo-sparkle", "Rovo Sparkle"),
	customComponent("sandbox"),
	customComponent("schema-display", "Schema Display"),
	customComponent("shimmer"),
	customComponent("shimmer-wave", "Shimmer Wave"),
	customComponent("snippet"),
	customComponent("sources"),
	customComponent("speech-input", "Speech Input"),
	customComponent("stack-trace", "Stack Trace"),
	customComponent("suggestion"),
	customComponent("task"),
	customComponent("terminal"),
	customComponent("test-results", "Test Results"),
	customComponent("tool"),
	customComponent("twg-appstack", "TWG Appstack"),
	customComponent("twg-tool", "TWG Tool"),
	customComponent("twg-loader", "TWG Loader"),
	customComponent("toolbar"),
	customComponent("transcription"),
	customComponent("voice-selector", "Voice Selector"),
	customComponent("web-preview", "Web Preview"),
]);

export const AUDIO_COMPONENTS: ComponentManifestEntry[] = sortEntriesByName([
	audioComponent("audio-player", "Audio Player"),
	audioComponent("bar-visualizer", "Bar Visualizer"),
	audioComponent("conversation"),
	audioComponent("conversation-bar", "Conversation Bar"),
	audioComponent("live-waveform", "Live Waveform"),
	audioComponent("matrix"),
	audioComponent("message"),
	audioComponent("mic-selector", "Mic Selector"),
	audioComponent("orb", "Orb"),
	audioComponent("response"),
	audioComponent("scrub-bar", "Scrub Bar"),
	audioComponent("shimmering-text", "Shimmering Text"),
	audioComponent("speech-input", "Speech Input"),
	audioComponent("transcript-viewer", "Transcript Viewer"),
	audioComponent("voice-button", "Voice Button"),
	audioComponent("voice-picker", "Voice Picker"),
	audioComponent("waveform", "Waveform"),
]);

export const UI_CHART_COMPONENTS: ComponentManifestEntry[] = sortEntriesByName([
	uiChartComponent("area-chart", "Area Chart"),
	uiChartComponent("bar-chart", "Bar Chart"),
	uiChartComponent("candlestick-chart", "Candlestick Chart"),
	uiChartComponent("choropleth-chart", "Choropleth Chart", "@/components/ui-charts/choropleth"),
	uiChartComponent("composed-chart", "Composed Chart"),
	uiChartComponent("funnel-chart", "Funnel Chart"),
	uiChartComponent("gauge-chart", "Gauge Chart", "@/components/ui-charts/gauge"),
	uiChartComponent("heatmap-chart", "Heatmap Chart", "@/components/ui-charts/heatmap"),
	uiChartComponent("legend", "Legend", "@/components/ui-charts/legend"),
	uiChartComponent("line-chart", "Line Chart"),
	uiChartComponent("live-line-chart", "Live Line Chart"),
	uiChartComponent("pie-chart", "Pie Chart"),
	uiChartComponent("profit-loss-line", "Profit Loss Line", "@/components/ui-charts/profit-loss-line"),
	uiChartComponent("radar-chart", "Radar Chart"),
	uiChartComponent("ring-chart", "Ring Chart"),
	uiChartComponent("sankey-chart", "Sankey Chart", "@/components/ui-charts/sankey"),
	uiChartComponent("scatter-chart", "Scatter Chart"),
	uiChartComponent("stat-card-area-01", "Stat Card Area 01"),
	uiChartComponent("stat-card-choropleth-01", "Stat Card Choropleth 01"),
	uiChartComponent("stat-card-line-01", "Stat Card Line 01"),
]);

export const UI_COMPONENTS: ComponentManifestEntry[] = sortEntriesByName([
	uiComponent("accordion"),
	uiComponent("alert"),
	uiComponent("alert-dialog", "Alert Dialog"),
	uiComponent("aspect-ratio", "Aspect Ratio"),
	uiComponent("avatar"),
	uiComponent("attachment"),
	uiComponent("badge"),
	uiComponent("banner"),
	uiComponent("blanket"),
	uiComponent("breadcrumb"),
	uiComponent("bubble"),
	uiComponent("button"),
	uiComponent("button-group", "Button Group"),
	uiComponent("calendar"),
	uiComponent("card"),
	uiComponent("carousel"),
	uiComponent("chart"),
	uiComponent("checkbox"),
	uiComponent("collapsible"),
	uiComponent("combobox"),
	uiComponent("comment"),
	uiComponent("command"),
	uiComponent("context-menu", "Context Menu"),
	uiComponent("date-label", "Date Label"),
	uiComponent("date-picker", "Date Picker"),
	uiComponent("date-time-picker", "Date Time Picker"),
	uiComponent("dialog"),
	uiComponent("direction"),
	uiComponent("drawer"),
	uiComponent("dropdown-menu", "Dropdown Menu"),
	uiComponent("empty"),
	uiComponent("field"),
	uiComponent("heading", "Heading"),
	{
		name: "Forms",
		slug: "forms",
		importPath: "@/components/ui/form",
		category: "ui",
	},
	uiComponent("hover-card", "Hover Card"),
	uiComponent("icon"),
	uiComponent("icon-tile", "Icon Tile"),
	uiComponent("inline-edit", "Inline Edit"),
	uiComponent("input-group", "Input Group"),
	uiComponent("input-otp", "Input OTP"),
	uiComponent("item"),
	uiComponent("kbd", "Kbd"),
	uiComponent("label"),
	uiComponent("logo", "Logo"),
	uiComponent("logo-third-party", "Logo Third Party"),
	uiComponent("lozenge"),
	uiComponent("marker"),
	uiComponent("menu-group", "Menu"),
	uiComponent("menubar"),
	uiComponent("message"),
	uiComponent("message-scroller", "Message Scroller"),
	uiComponent("native-select", "Native Select"),
	uiComponent("navigation-menu", "Navigation Menu"),
	uiComponent("page-header", "Page Header"),
	uiComponent("panel"),
	uiComponent("pagination"),
	uiComponent("popover"),
	uiComponent("progress"),
	uiComponent("progress-indicator", "Progress Indicator"),
	uiComponent("progress-tracker", "Progress Tracker"),
	uiComponent("questionnaire"),
	uiComponent("radio-group", "Radio Group"),
	uiComponent("resizable"),
	uiComponent("scroll-area", "Scroll Area"),
	uiComponent("scroll-fade", "Scroll Fade"),
	uiComponent("select"),
	uiComponent("separator"),
	uiComponent("sheet"),
	uiComponent("sidebar"),
	uiComponent("skeleton"),
	uiComponent("slider"),
	uiComponent("sonner"),
	uiComponent("spinner"),
	uiComponent("switch"),
	uiComponent("tag"),
	uiComponent("table"),
	uiComponent("tabs"),
	uiComponent("time-picker", "Time Picker"),
	uiComponent("tile"),
	uiComponent("toggle"),
	uiComponent("toggle-group", "Toggle Group"),
	uiComponent("tooltip"),
]);

export const BLOCK_COMPONENTS: ComponentManifestEntry[] = sortEntriesByName([
	blockComponent("agent"),
	blockComponent("skill-config", "Skill Config"),
	blockComponent("trigger-config", "Trigger Config"),
	blockComponent("agent-bento", "Agent Bento"),
	blockComponent("agent-card", "Agent Card"),
	blockComponent("twg-agent-card", "TWG Agent Card"),
	blockComponent("agent-profile-card", "Agent Profile Card"),
	blockComponent("agent-states", "Agent States"),
	blockComponent("agent-directory", "Agent Directory"),
	blockComponent("agent-progress", "Agent Progress"),
	blockComponent("agent-assignment", "Agent Assignment"),
	blockComponent("agent-selector", "Agent Selector"),
	blockComponent("skill-selector", "Skill Selector"),
	blockComponent("jira-work-item", "Jira Work Item"),
	blockComponent("agent-session-flyout", "Agent Session Flyout"),
	blockComponent("omnibar", "Omnibar"),
	blockComponent("scrubber", "Scrubber"),
	blockComponent("agent-session", "Agent Session"),
	blockComponent("agent-session-column", "Agent Session Column"),
	blockComponent("agent-templates", "Agent Templates"),
	blockComponent("knowledge-directory", "Knowledge Directory"),
	blockComponent("conversation-starters", "Conversation Starters"),
	blockComponent("agent-users", "Agent Users"),
	blockComponent("agent-access", "Agent Access"),
	blockComponent("agent-evaluation", "Agent Evaluation"),
	blockComponent("agent-insights", "Agent Insights"),
	blockComponent("agent-test", "Agent Test"),
	blockComponent("agent-surfaces", "Agent Surfaces"),
	blockComponent("skills-directory", "Skills Directory"),
	blockComponent("smart-link", "Smart Link"),
	blockComponent("pull-request", "Pull Request"),
	blockComponent("pull-request-header", "Pull Request Header"),
	blockComponent("pull-request-review", "Pull Request Review"),
	blockComponent("pull-request-fix", "Pull Request Fix"),
	blockComponent("emoji-picker", "Emoji Picker"),
	blockComponent("task-progress", "Task Progress"),
	blockComponent("triggers", "Triggers"),
	blockComponent("answer-card", "Answer Card"),
	blockComponent("spotlight", "Spotlight"),
	blockComponent("approval-card", "Approval Card"),
	blockComponent("chat-timeline", "Chat Timeline"),
	blockComponent("subagents", "Subagents"),
	blockComponent("tool-approval", "Tool Approval"),
	{ name: "Chat Configuration", slug: "chat-configuration", importPath: "@/components/projects/shared/components/chat-configuration/customize-menu", category: "blocks" },
	blockComponent("chat-gallery", "Chat Gallery"),
	blockComponent("chatbot", "Chatbot"),
	blockComponent("chatgpt", "ChatGPT"),
	blockComponent("code-review", "Code Review"),
	blockComponent("cursor", "Cursor"),
	blockComponent("dashboard", "Dashboard"),
	blockComponent("editor-palette", "Editor Palette"),
	blockComponent("editor-toolbar", "Editor Toolbar"),
	blockComponent("data-table", "Data Table"),
	blockComponent("generative-card", "Generative Card"),
	blockComponent("generative", "Generative UI"),
	blockComponent("gallery", "Gallery"),
	blockComponent("html-selector", "HTML Selector"),
	blockComponent("jira-epic", "Jira Epic"),
	blockComponent("agent-list", "Agent List"),
	blockComponent("jira-activity", "Jira Activity"),
	blockComponent("jira-insights", "Jira Insights"),
	blockComponent("jira-issue", "Jira Issue"),
	blockComponent("jira-linking", "Jira Linking"),
	blockComponent("jira-list", "Jira List"),
	blockComponent("jira-kanban", "Jira Kanban"),
	blockComponent("jira-creating", "Jira Creating"),
	blockComponent("jira-dropzone", "Jira Dropzone"),
	blockComponent("jira-toolbar", "Jira Toolbar"),
	blockComponent("apps-directory", "Apps Directory"),
	blockComponent("artifact"),
	blockComponent("artifact-pane", "Artifact Pane"),
	blockComponent("next-best-action", "Next Best Action"),
	blockComponent("tools-directory", "Tools Directory"),
	blockComponent("mermaid-diagram", "Mermaid Diagram"),
	blockComponent("video", "Video"),
	blockComponent("memory", "Memory"),
	{
		name: "Login 01",
		slug: "login-01",
		importPath: "@/components/blocks/login/login-01",
		category: "blocks",
	},
	{
		name: "Login 02",
		slug: "login-02",
		importPath: "@/components/blocks/login/login-02",
		category: "blocks",
	},
	{
		name: "Login 03",
		slug: "login-03",
		importPath: "@/components/blocks/login/login-03",
		category: "blocks",
	},
	{
		name: "Login 04",
		slug: "login-04",
		importPath: "@/components/blocks/login/login-04",
		category: "blocks",
	},
	{
		name: "Login 05",
		slug: "login-05",
		importPath: "@/components/blocks/login/login-05",
		category: "blocks",
	},
	blockComponent("product-sidebar", "Product Sidebar"),
	blockComponent("prompt-gallery", "Prompt Gallery"),
	blockComponent("question-card", "Question Card"),
	blockComponent("rovo-canvas", "Rovo Canvas"),
	blockComponent("settings-dialog", "Settings Dialog"),
	blockComponent("visual-waveform", "Visual Waveform"),
	{
		name: "App Sidebar",
		slug: "app-sidebar",
		importPath: "@/components/blocks/sidebar/app-sidebar",
		category: "blocks",
	},
	{
		name: "Sidebar 01",
		slug: "sidebar-01",
		importPath: "@/components/blocks/sidebar/sidebar-01",
		category: "blocks",
	},
	{
		name: "Sidebar 02",
		slug: "sidebar-02",
		importPath: "@/components/blocks/sidebar/sidebar-02",
		category: "blocks",
	},
	{
		name: "Sidebar 03",
		slug: "sidebar-03",
		importPath: "@/components/blocks/sidebar/sidebar-03",
		category: "blocks",
	},
	{
		name: "Sidebar 04",
		slug: "sidebar-04",
		importPath: "@/components/blocks/sidebar/sidebar-04",
		category: "blocks",
	},
	{
		name: "Sidebar 05",
		slug: "sidebar-05",
		importPath: "@/components/blocks/sidebar/sidebar-05",
		category: "blocks",
	},
	{
		name: "Sidebar 06",
		slug: "sidebar-06",
		importPath: "@/components/blocks/sidebar/sidebar-06",
		category: "blocks",
	},
	{
		name: "Sidebar 07",
		slug: "sidebar-07",
		importPath: "@/components/blocks/sidebar/sidebar-07",
		category: "blocks",
	},
	{
		name: "Sidebar 08",
		slug: "sidebar-08",
		importPath: "@/components/blocks/sidebar/sidebar-08",
		category: "blocks",
	},
	{
		name: "Sidebar 09",
		slug: "sidebar-09",
		importPath: "@/components/blocks/sidebar/sidebar-09",
		category: "blocks",
	},
	{
		name: "Sidebar 10",
		slug: "sidebar-10",
		importPath: "@/components/blocks/sidebar/sidebar-10",
		category: "blocks",
	},
	{
		name: "Sidebar 11",
		slug: "sidebar-11",
		importPath: "@/components/blocks/sidebar/sidebar-11",
		category: "blocks",
	},
	{
		name: "Sidebar 12",
		slug: "sidebar-12",
		importPath: "@/components/blocks/sidebar/sidebar-12",
		category: "blocks",
	},
	{
		name: "Sidebar 13",
		slug: "sidebar-13",
		importPath: "@/components/blocks/sidebar/sidebar-13",
		category: "blocks",
	},
	{
		name: "Sidebar 14",
		slug: "sidebar-14",
		importPath: "@/components/blocks/sidebar/sidebar-14",
		category: "blocks",
	},
	{
		name: "Sidebar 15",
		slug: "sidebar-15",
		importPath: "@/components/blocks/sidebar/sidebar-15",
		category: "blocks",
	},
	{
		name: "Sidebar 16",
		slug: "sidebar-16",
		importPath: "@/components/blocks/sidebar/sidebar-16",
		category: "blocks",
	},
	blockComponent("sidebar-rail", "Sidebar Rail"),
	{
		name: "Signup 01",
		slug: "signup-01",
		importPath: "@/components/blocks/signup/signup-01",
		category: "blocks",
	},
	{
		name: "Signup 02",
		slug: "signup-02",
		importPath: "@/components/blocks/signup/signup-02",
		category: "blocks",
	},
	{
		name: "Signup 03",
		slug: "signup-03",
		importPath: "@/components/blocks/signup/signup-03",
		category: "blocks",
	},
	{
		name: "Signup 04",
		slug: "signup-04",
		importPath: "@/components/blocks/signup/signup-04",
		category: "blocks",
	},
	{
		name: "Signup 05",
		slug: "signup-05",
		importPath: "@/components/blocks/signup/signup-05",
		category: "blocks",
	},
	blockComponent("top-navigation", "Top Navigation"),
	blockComponent("terminal-switch", "Terminal Switch"),
	blockComponent("workflow", "Workflow"),
]);

export const PROJECT_COMPONENTS: ComponentManifestEntry[] = sortEntriesByName([
	projectComponent("admin", "Admin"),
	projectComponent("confluence", "Confluence"),
	projectComponent("html", "HTML"),
	projectComponent("jira", "Jira"),
	projectComponent("jira-for-you", "Jira For You"),
	projectComponent("jira-golden-journeys-v0", "Jira Golden Journeys v0"),
	projectComponent("jira-golden-journeys-v1", "Jira Golden Journeys v1"),
	projectComponent("jira-golden-journeys-v2", "Jira Golden Journeys v2"),
	projectComponent("jira-golden-journeys-v3", "Jira Golden Journeys v3"),
	projectComponent("jira-golden-journeys-v4", "Jira Golden Journeys v4"),
	projectComponent("jira-queue", "Jira Queue"),
	projectComponent("jira-team-eu26", "Jira Team EU26"),
	projectComponent("rovo", "Rovo"),
	projectComponent("rovo-button", "Rovo Button"),
	projectComponent("search", "Search"),
	projectComponent("sidebar-chat", "Sidebar Chat"),
	projectComponent("skills", "Skills"),
	projectComponent("studio", "Studio"),
]);

export const ART_COMPONENTS: ComponentManifestEntry[] = sortEntriesByName([
	artComponent("awake", "Awake"),
	artComponent("cursors", "Cursors"),
	artComponent("personal-graph", "Personal Graph"),
	artComponent("rovo-fable", "Rovo Fable"),
	artComponent("rovo-p5", "Rovo p5"),
]);

export const UTILITY_COMPONENTS: ComponentManifestEntry[] = sortEntriesByName([
	{
		name: "Agent Browser",
		slug: "agent-browser",
		importPath: "@/components/website/demos/utils/agent-browser",
		category: "utility",
	},
	utilityComponent("gui", "GUI"),
	{ name: "Cone safezone", slug: "cone-safezone", importPath: "@/components/utils/cone-safezone", category: "utility" },
	utilityComponent("image-generation", "Image Generation"),
	utilityComponent("multiports", "Multiports"),
	utilityComponent("sound-generation", "Sound Generation"),
	utilityComponent("streamdown", "Streamdown"),
	utilityComponent("tools-invocation", "Tools Invocation"),
	utilityComponent("ui-generation", "UI Generation"),
	utilityComponent("visual-json", "Visual JSON"),
]);

export const VISUAL_COMPONENTS: ComponentManifestEntry[] = sortEntriesByName([
	visualComponent("gooey", "Gooey", "@/components/visual/gooey"),
	visualComponent("typography", "Typography", "@/lib/tokens"),
	visualComponent("color", "Color", "@/app/tailwind-theme.css\n@/app/shadcn-theme.css"),
	visualComponent("shadow", "Shadow", "@/lib/tokens"),
	visualComponent("shadow-overlay", "Shadow Overlay", "@/components/website/demos/visual/shadow-overlay"),
	visualComponent("card-glow", "Card Glow", "@/components/website/demos/visual/card-glow-demo"),
	visualComponent("border-beam", "Border Beam", "@/components/visual/border-beam"),
	visualComponent("dropzone-effect", "Dropzone Effect", "@/components/visual/dropzone-effect"),
	visualComponent("heatmap", "Heatmap", "@/components/visual/heatmap"),
	visualComponent("scribbles", "Scribbles", "@/components/website/demos/visual/scribbles"),
	visualComponent("melt", "Melt", "@/components/website/demos/visual/melt"),
	visualComponent("squircle", "Squircle", "@/components/website/demos/visual/shaders/squircle"),
	visualComponent("svg-tracing", "SVG Tracing", "@/components/visual/svg-tracing"),
	visualComponent("visual-tracing", "Visual Tracing", "@/components/visual/visual-tracing"),
	visualComponent("thinking-orbs", "Thinking Orbs", "@/components/visual/thinking-orbs"),
	visualComponent("scroll-mask", "Scroll Mask", "@/components/visual/scroll-mask"),
	visualComponent("scrolling", "Scrolling", "@/components/visual/scrolling"),
	visualComponent("motion", "Motion", "@/components/visual/motion"),
	visualComponent("text-effects", "Text Effects", "@/components/visual/text-effects"),
	visualComponent("text-morphing", "Text Morphing", "@/components/visual/text-morphing"),
	visualComponent("text-continuity", "Text Continuity", "@/components/visual/text-continuity"),
	visualComponent("ascii", "ASCII", "@/components/website/demos/visual/shaders/ascii"),
	visualComponent("bloom", "Bloom", "@/components/website/demos/visual/shader-lab-effect-demo"),
	visualComponent("blob-tracking", "Blob Tracking", "@/components/website/demos/visual/shader-lab-effect-demo"),
	visualComponent("circuit-bent", "Circuit Bent", "@/components/website/demos/visual/shader-lab-effect-demo"),
	visualComponent("custom-shader", "Custom Shader", "@/components/website/demos/visual/shader-lab-effect-demo"),
	visualComponent("directional-blur", "Directional Blur", "@/components/website/demos/visual/shader-lab-effect-demo"),
	visualComponent("crt", "CRT", "@/components/website/demos/visual/shader-lab-effect-demo"),
	visualComponent("displacement-map", "Displacement Map", "@/components/website/demos/visual/shader-lab-effect-demo"),
	visualComponent("dithering", "Dithering", "@/components/website/demos/visual/shaders/dithering"),
	visualComponent("edge-detect", "Edge Detect", "@/components/website/demos/visual/shader-lab-effect-demo"),
	visualComponent("fluid", "Fluid", "@/components/website/demos/visual/shader-lab-effect-demo"),
	visualComponent("halftone", "Halftone", "@/components/website/demos/visual/shader-lab-effect-demo"),
	visualComponent("ink", "Ink", "@/components/website/demos/visual/shader-lab-effect-demo"),
	visualComponent("ink-wash", "Ink Wash", "@/components/visual/ink-wash"),
	visualComponent("liquid-metal", "Liquid Metal", "@/components/visual/liquid-metal"),
	visualComponent("peel", "Peel", "@/components/visual/peel"),
	visualComponent("magnify-lens", "Magnify Lens", "@/components/website/demos/visual/shader-lab-effect-demo"),
	visualComponent("mesh-gradient", "Mesh Gradient", "@/components/website/demos/visual/shader-lab-effect-demo"),
	visualComponent("particle-grid", "Particle Grid", "@/components/website/demos/visual/shader-lab-effect-demo"),
	visualComponent("pixelation", "Pixelation", "@/components/website/demos/visual/shader-lab-effect-demo"),
	visualComponent("pixel-sorting", "Pixel Sorting", "@/components/website/demos/visual/shader-lab-effect-demo"),
	visualComponent("pixel-trail", "Pixel Trail", "@/components/website/demos/visual/shader-lab-effect-demo"),
	visualComponent("plotter", "Plotter", "@/components/website/demos/visual/shader-lab-effect-demo"),
	visualComponent("posterize", "Posterize", "@/components/website/demos/visual/shader-lab-effect-demo"),
	visualComponent("scramble-text", "Scramble Text", "motion-plus/react"),
	visualComponent("slice", "Slice", "@/components/website/demos/visual/shader-lab-effect-demo"),
	visualComponent("smear", "Smear", "@/components/website/demos/visual/shader-lab-effect-demo"),
	visualComponent("threshold", "Threshold", "@/components/website/demos/visual/shader-lab-effect-demo"),
	visualComponent("voxel", "Voxel", "@/components/website/demos/visual/shader-lab-effect-demo"),
	visualComponent(
		"particles",
		"Particles",
		"@/components/website/demos/visual/shaders/particles",
	),
	visualComponent("pattern-tile", "Pattern Tile", "@/components/website/demos/visual/pattern-tile"),
	visualComponent("pattern", "Pattern", "@/components/website/demos/visual/shader-lab-effect-demo"),
	visualComponent("noise", "Noise", "@/components/website/demos/visual/shaders/noise"),
	visualComponent(
		"wave-gradient",
		"Wave Gradient",
		"@/components/website/demos/visual/shaders/wave-gradient",
	),
	visualComponent(
		"liquid-gradient",
		"Liquid Gradient",
		"@/components/visual/liquid-gradient",
	),
	visualComponent(
		"logo-gradient",
		"Logo Gradient",
		"@/components/website/demos/visual/shaders/logo-gradient",
	),
	visualComponent(
		"logo-spectrum",
		"Logo Spectrum",
		"@/components/website/demos/visual/shaders/logo-spectrum",
	),
	visualComponent(
		"logo-crystal",
		"Logo Crystal",
		"@/components/website/demos/visual/shaders/logo-crystal",
	),
	visualComponent("bands", "Bands", "@/components/website/demos/visual/shaders/bands"),
	visualComponent("rings", "Rings", "@/components/website/demos/visual/shaders/rings"),
	visualComponent("ripple", "Ripple", "@/components/website/demos/visual/shaders/ripple"),
	visualComponent(
		"blockify",
		"Blockify",
		"@/components/website/demos/visual/shaders/blockify",
	),
	visualComponent("pixels", "Pixels", "@/components/website/demos/visual/shaders/pixels"),
	visualComponent("truchet", "Truchet", "@/components/website/demos/visual/shaders/truchet"),
	visualComponent(
		"fluted-glass",
		"Fluted Glass",
		"@/components/website/demos/visual/shaders/fluted-glass",
	),
	visualComponent(
		"fluted-glass-v2",
		"Fluted Glass v2",
		"@/components/website/demos/visual/shader-lab-effect-demo",
	),
	visualComponent("liquid-glass", "Liquid Glass", "@/components/website/demos/visual/shaders/liquid-glass"),
	visualComponent("logo-glass", "Logo Glass", "@/components/website/demos/visual/shaders/logo-glass"),
	visualComponent(
		"glass-tabs",
		"Glass Tabs",
		"@/components/visual/glass-tabs",
	),
	visualComponent(
		"glass-slider",
		"Glass Slider",
		"@/components/arts/awake/glass-slider",
	),
	visualComponent("graph", "Graph", "@/components/website/demos/visual/graph"),
	visualComponent("holo", "Holo", "@/components/website/demos/visual/shaders/holo"),
	visualComponent("mesh", "Mesh", "@/components/website/demos/visual/shaders/mesh"),
	visualComponent("mesh-v2", "Mesh v2", "@/components/website/demos/visual/shaders/mesh-v2"),
	visualComponent(
		"chromatic-aberration",
		"Chromatic Aberration",
		"@/components/website/demos/visual/shaders/chromatic-aberration",
	),
	visualComponent(
		"chromatic-aberration-v2",
		"Chromatic Aberration v2",
		"@/components/website/demos/visual/shader-lab-effect-demo",
	),
	...PAPER_SHADER_COMPONENTS.map(([slug, name]) => visualComponent(slug, name, PAPER_SHADER_DEMO_IMPORT_PATH)),
	]);

const ALL_COMPONENTS = [
	...AUDIO_COMPONENTS,
	...UI_CHART_COMPONENTS,
	...CUSTOM_COMPONENTS,
	...UI_COMPONENTS,
	...BLOCK_COMPONENTS,
	...PROJECT_COMPONENTS,
	...ART_COMPONENTS,
	...UTILITY_COMPONENTS,
	...VISUAL_COMPONENTS,
];

export function findComponent(
	category: string,
	slug: string,
): ComponentManifestEntry | undefined {
	return ALL_COMPONENTS.find((component) => {
		return component.category === category && component.slug === slug;
	});
}

export function getAllComponents(): ComponentManifestEntry[] {
	return ALL_COMPONENTS;
}
