/**
 * System prompt for genui inline mode.
 *
 * Uses the auto-generated catalog prompt from `catalog.prompt({ mode: "inline" })`
 * which includes all component types, Zod-derived props, slot info, and critical
 * defaultRules (integrity check, self-check, visible/on placement, data quality).
 *
 * VPK-specific rules and companion examples are layered on top.
 *
 * Regenerate the base prompt with: pnpm run generate:prompt
 */

const generatedPrompt = require("./generated-catalog-prompt.json");
const generatedCardIconHints = [
	"angle-brackets",
	"app",
	"audio",
	"board",
	"calendar",
	"chart-bar",
	"chart-bubble",
	"chart-matrix",
	"chart-pie",
	"chart-trend",
	"comment",
	"feed",
	"file",
	"image",
	"page",
	"table",
	"text",
	"translate",
	"video",
	"work-item",
];

/**
 * VPK-specific rules appended after the catalog-generated rules.
 * These cover domain knowledge the catalog schema cannot express.
 */
const VPK_CUSTOM_RULES = [
	// Dynamic expressions
	"When using $state, $bindState, $bindItem, $item, $index, or repeat, include matching /state patches so bindings resolve.",
	'For two-way form values, use { "$bindState": "/path" } or { "$bindItem": "field" } on the natural value prop (value, checked, pressed).',

	// Calendar rendering
	"Calendar and meeting agendas should render as a single ordered timeline, not one Card per meeting.",
	"Prefer Timeline for calendar event lists; if days are grouped, render one Timeline per day section/tab and keep meeting rows inside that Timeline.",
	"Calendar timeline items should include the start time in the date field and keep location/status in description text.",

	// Layout
	"Horizontal Stack defaults to nowrap; set wrap=true only for flowing layouts like tag groups or badge lists.",
	"For kanban boards, sprint boards, and other equal-width board columns, use Grid with one Card per column instead of a horizontal Stack.",

	// Map generation
	"When the user asks for maps, locations, pins, routes, or directions, use MapWidget (backed by Leaflet/OSM, no API key). Props: center {lat,lng}, zoom, height, selectedMarkerId, markers [{id,lat,lng,title,description?}]. Do NOT invent component names like \"Map\", \"GoogleMap\", or \"MapboxMap\".",

	// Chart placement
	"Charts (BarChart, LineChart, PieChart, AreaChart, RadarChart) are leaf components — place directly as children of Stack or Grid, NOT inside Card children.",

	// Data-to-chart selection heuristics
	"When tool results or knowledge contain time-series or sequential numeric data (stock prices, metrics over days/weeks/months, historical trends), render a LineChart or AreaChart with the time dimension as xKey and the numeric measure as yKey. Include the raw data points in the chart data array.",
	"When tool results contain categorical counts or comparisons (items by status, counts by team, scores by category), use BarChart with categories as xKey.",
	"When tool results show proportional breakdowns (percentage splits, budget allocation, market share), use PieChart with nameKey for labels and valueKey for amounts.",
	"When multiple numeric dimensions exist for the same entities (team performance across speed/quality/satisfaction), use RadarChart.",
	"Prefer charts over plain Metric/Text when the data has 3+ data points that share a common dimension. A single current value (e.g. 'price is $73') still warrants a Metric, but any historical or comparative series should be charted.",

	// Outer spacing control
	"Avoid outer padding on the root container. Root Stack padding must be null or 0. Use internal Card/section spacing instead of global page padding.",

	// 3D filtering
	"Only use 3D components (Scene3D, Group3D, Box, Sphere, Cylinder, Cone, Torus, Plane, Ring, AmbientLight, PointLight, DirectionalLight, Stars, Label3D) when the user explicitly asks for 3D scenes, models, or visualizations.",

	// Atlassian context
	"When the response contains data from Atlassian products (Jira work items, Confluence pages, Trello cards, Bitbucket PRs, Loom videos), you MUST generate a visual UI spec — NEVER output plain text paragraphs. Structure rules: (a) For a single Jira work item, use a Card with the item key + summary as title, a horizontal Stack for status Lozenge + priority Badge + type Tag, and separate Text rows for assignee, dates, and description. (b) For multiple work items, use a Table with columns for Key, Summary, Status (render as text — Table cells don't support components), Priority, and Updated. (c) For activity feeds, use Timeline with each event as an item. (d) For work summaries, use Metric components for counts (work items updated, pages edited, PRs merged) in a Grid and include a BarChart comparing work items vs pages when both counts exist, then detail sections below. Always use Lozenge for workflow statuses (variant mapping: 'Done'→'success', 'In Progress'→'information', 'In Review'→'information', 'To Do'→'neutral', 'Blocked'→'danger'), Tag for labels/categories, Avatar for people, and Badge for priority levels. IMPORTANT: Never use the word 'Issues' in user-facing labels — always use 'Work Items' instead. Use 'Pages' (not 'Confluence Pages') for Confluence content labels.",

	// Output quality
	"Output exactly one ```spec block per response. Keep the ```spec block machine-parseable: no markdown bullets, no prose, no comments inside the fence.",

	// Icon hints
	`You may include an "iconHint" field in the widget payload (alongside the spec) to choose the card header icon. Valid values: ${generatedCardIconHints.join(", ")}. If omitted, the icon is inferred from content.`,
];

/**
 * Companion examples showing new components in realistic multi-component specs.
 * Each is added as a rule string containing a complete spec example.
 */
const COMPANION_EXAMPLES = [
	// Jira Single Issue Detail
	`Example — single Jira issue detail card with status, priority, type, assignee, and dates:
\`\`\`spec
{"op":"add","path":"/root","value":"main"}
{"op":"add","path":"/elements/main","value":{"type":"Stack","props":{"gap":"md"},"children":["issueCard"]}}
{"op":"add","path":"/elements/issueCard","value":{"type":"Card","props":{"title":"AIDOPS-101: Agent Logo Change"},"children":["statusRow","detailsStack"]}}
{"op":"add","path":"/elements/statusRow","value":{"type":"Stack","props":{"direction":"horizontal","gap":"sm","align":"center"},"children":["status","priority","typeTag"]}}
{"op":"add","path":"/elements/status","value":{"type":"Lozenge","props":{"text":"In Progress","variant":"information","isBold":true}}}
{"op":"add","path":"/elements/priority","value":{"type":"Badge","props":{"text":"Minor","variant":"neutral"}}}
{"op":"add","path":"/elements/typeTag","value":{"type":"Tag","props":{"text":"AI Design Support","color":"standard"}}}
{"op":"add","path":"/elements/detailsStack","value":{"type":"Stack","props":{"direction":"vertical","gap":"sm"},"children":["assigneeRow","dateRow"]}}
{"op":"add","path":"/elements/assigneeRow","value":{"type":"Stack","props":{"direction":"horizontal","gap":"sm","align":"center"},"children":["assigneeAvatar","assigneeText"]}}
{"op":"add","path":"/elements/assigneeAvatar","value":{"type":"Avatar","props":{"fallback":"You","size":"xs"}}}
{"op":"add","path":"/elements/assigneeText","value":{"type":"Text","props":{"content":"Assigned to you","muted":null}}}
{"op":"add","path":"/elements/dateRow","value":{"type":"Text","props":{"content":"Created Feb 21, 2026 · Updated Feb 22, 2026","muted":true,"size":"xs"}}}
\`\`\``,

	// Settings Page
	`Example — settings page with form controls:
\`\`\`spec
{"op":"add","path":"/root","value":"main"}
{"op":"add","path":"/state","value":{"settings":{"notifications":true,"darkMode":false,"volume":75,"language":"en"}}}
{"op":"add","path":"/elements/main","value":{"type":"Stack","props":{"gap":"lg"},"children":["alert","breadcrumb","heading","form"]}}
{"op":"add","path":"/elements/alert","value":{"type":"Alert","props":{"title":"Settings updated","description":"Your preferences have been saved.","variant":"success"}}}
{"op":"add","path":"/elements/breadcrumb","value":{"type":"Breadcrumb","props":{"items":[{"label":"Home","href":"/"},{"label":"Account"},{"label":"Settings"}]}}}
{"op":"add","path":"/elements/heading","value":{"type":"Heading","props":{"level":"h2","text":"Preferences"}}}
{"op":"add","path":"/elements/form","value":{"type":"Stack","props":{"gap":"md"},"children":["notifToggle","darkToggle","volumeSlider","langSelect","saveBtn"]}}
{"op":"add","path":"/elements/notifToggle","value":{"type":"Switch","props":{"label":"Enable notifications","checked":{"$bindState":"/settings/notifications"}}}}
{"op":"add","path":"/elements/darkToggle","value":{"type":"Checkbox","props":{"label":"Dark mode","checked":{"$bindState":"/settings/darkMode"}}}}
{"op":"add","path":"/elements/volumeSlider","value":{"type":"Slider","props":{"label":"Volume","value":{"$bindState":"/settings/volume"},"min":0,"max":100,"step":5}}}
{"op":"add","path":"/elements/langSelect","value":{"type":"SelectInput","props":{"label":"Language","value":{"$bindState":"/settings/language"},"options":[{"label":"English","value":"en"},{"label":"Spanish","value":"es"},{"label":"French","value":"fr"}]}}}
{"op":"add","path":"/elements/saveBtn","value":{"type":"Button","props":{"label":"Save Changes","variant":"default"}}}
\`\`\``,

	// Project Dashboard
	`Example — project dashboard with tabs, charts, and progress:
\`\`\`spec
{"op":"add","path":"/root","value":"main"}
{"op":"add","path":"/elements/main","value":{"type":"Stack","props":{"gap":"lg"},"children":["heading","metricsRow","tabs"]}}
{"op":"add","path":"/elements/heading","value":{"type":"PageHeader","props":{"title":"Project Dashboard","description":"Q1 2025 performance overview"}}}
{"op":"add","path":"/elements/metricsRow","value":{"type":"Grid","props":{"columns":"3","gap":"md"},"children":["m1","m2","m3"]}}
{"op":"add","path":"/elements/m1","value":{"type":"Metric","props":{"label":"Tasks Completed","value":"142","detail":"+18%","trend":"up"}}}
{"op":"add","path":"/elements/m2","value":{"type":"Metric","props":{"label":"Open Work Items","value":"23","detail":"-5%","trend":"up"}}}
{"op":"add","path":"/elements/m3","value":{"type":"Metric","props":{"label":"Sprint Velocity","value":"34 pts","detail":"+2 pts","trend":"up"}}}
{"op":"add","path":"/elements/tabs","value":{"type":"Tabs","props":{"tabs":[{"value":"traffic","label":"Traffic"},{"value":"progress","label":"Progress"}],"defaultValue":"traffic"},"children":["tabTraffic","tabProgress"]}}
{"op":"add","path":"/elements/tabTraffic","value":{"type":"TabContent","props":{"value":"traffic"},"children":["areaChart"]}}
{"op":"add","path":"/elements/areaChart","value":{"type":"AreaChart","props":{"title":"Weekly Traffic","data":[{"week":"W1","visitors":1200},{"week":"W2","visitors":1800},{"week":"W3","visitors":1500},{"week":"W4","visitors":2200}],"xKey":"week","yKey":"visitors","color":"#6366f1"}}}
{"op":"add","path":"/elements/tabProgress","value":{"type":"TabContent","props":{"value":"progress"},"children":["tracker"]}}
{"op":"add","path":"/elements/tracker","value":{"type":"ProgressTracker","props":{"steps":[{"label":"Planning","state":"done"},{"label":"Development","state":"done"},{"label":"Testing","state":"current"},{"label":"Release","state":"todo"}]}}}
\`\`\``,

	// Kanban Board
	`Example — sprint board with equal-width kanban columns:
\`\`\`spec
{"op":"add","path":"/root","value":"main"}
{"op":"add","path":"/state","value":{"tasks":{"todo":[{"id":"1","title":"Design login screen","assignee":"Alice"},{"id":"2","title":"Setup database","assignee":"Bob"}],"inProgress":[{"id":"3","title":"Implement auth flow","assignee":"Charlie"}],"review":[{"id":"4","title":"QA regression pass","assignee":"Dana"}],"done":[{"id":"5","title":"Deploy to staging","assignee":"Eve"}]}}}
{"op":"add","path":"/elements/main","value":{"type":"Stack","props":{"gap":"lg"},"children":["header","board"]}}
{"op":"add","path":"/elements/header","value":{"type":"PageHeader","props":{"title":"Sprint Board","description":"Sprint 24 · Feb 24 to Mar 9"}}}
{"op":"add","path":"/elements/board","value":{"type":"Grid","props":{"columns":"4","gap":"md"},"children":["todo-col","progress-col","review-col","done-col"]}}
{"op":"add","path":"/elements/todo-col","value":{"type":"Card","props":{"title":"To Do","description":"2 tasks"},"children":["todo-list"]}}
{"op":"add","path":"/elements/todo-list","value":{"type":"Stack","props":{"direction":"vertical","gap":"sm"},"repeat":{"statePath":"/tasks/todo","key":"id"},"children":["todo-card"]}}
{"op":"add","path":"/elements/todo-card","value":{"type":"Card","props":{"title":{"$item":"title"},"description":{"$item":"assignee"}},"children":[]}}
{"op":"add","path":"/elements/progress-col","value":{"type":"Card","props":{"title":"In Progress","description":"1 task"},"children":["progress-list"]}}
{"op":"add","path":"/elements/progress-list","value":{"type":"Stack","props":{"direction":"vertical","gap":"sm"},"repeat":{"statePath":"/tasks/inProgress","key":"id"},"children":["progress-card"]}}
{"op":"add","path":"/elements/progress-card","value":{"type":"Card","props":{"title":{"$item":"title"},"description":{"$item":"assignee"}},"children":[]}}
{"op":"add","path":"/elements/review-col","value":{"type":"Card","props":{"title":"In Review","description":"1 task"},"children":["review-list"]}}
{"op":"add","path":"/elements/review-list","value":{"type":"Stack","props":{"direction":"vertical","gap":"sm"},"repeat":{"statePath":"/tasks/review","key":"id"},"children":["review-card"]}}
{"op":"add","path":"/elements/review-card","value":{"type":"Card","props":{"title":{"$item":"title"},"description":{"$item":"assignee"}},"children":[]}}
{"op":"add","path":"/elements/done-col","value":{"type":"Card","props":{"title":"Done","description":"1 task"},"children":["done-list"]}}
{"op":"add","path":"/elements/done-list","value":{"type":"Stack","props":{"direction":"vertical","gap":"sm"},"repeat":{"statePath":"/tasks/done","key":"id"},"children":["done-card"]}}
{"op":"add","path":"/elements/done-card","value":{"type":"Card","props":{"title":{"$item":"title"},"description":{"$item":"assignee"}},"children":[]}}
\`\`\``,

	// Work Activity Summary
	`Example — 7-day work summary with metrics, work items vs pages chart, work item cards, and activity timeline:
\`\`\`spec
{"op":"add","path":"/root","value":"main"}
{"op":"add","path":"/elements/main","value":{"type":"Stack","props":{"gap":"lg"},"children":["heading","metrics","activityChart","tabs"]}}
{"op":"add","path":"/elements/heading","value":{"type":"Heading","props":{"level":"h2","text":"Work Summary — Last 7 Days"}}}
{"op":"add","path":"/elements/metrics","value":{"type":"Grid","props":{"columns":"3","gap":"md"},"children":["m1","m2","m3"]}}
{"op":"add","path":"/elements/m1","value":{"type":"Metric","props":{"label":"Work Items","value":"1","detail":"Updated","trend":"neutral"}}}
{"op":"add","path":"/elements/m2","value":{"type":"Metric","props":{"label":"Pages","value":"3","detail":"Edited","trend":"up"}}}
{"op":"add","path":"/elements/m3","value":{"type":"Metric","props":{"label":"Total Activity","value":"4","detail":"Items","trend":"up"}}}
{"op":"add","path":"/elements/activityChart","value":{"type":"BarChart","props":{"title":"Activity by Source","data":[{"source":"Work Items","count":1},{"source":"Pages","count":3}],"xKey":"source","yKey":"count","height":220}}}
{"op":"add","path":"/elements/tabs","value":{"type":"Tabs","props":{"tabs":[{"value":"work-items","label":"Work Items"},{"value":"activity","label":"Activity"}],"defaultValue":"work-items"},"children":["tabWorkItems","tabActivity"]}}
{"op":"add","path":"/elements/tabWorkItems","value":{"type":"TabContent","props":{"value":"work-items"},"children":["workItemsList"]}}
{"op":"add","path":"/elements/workItemsList","value":{"type":"Stack","props":{"direction":"vertical","gap":"md"},"children":["item1"]}}
{"op":"add","path":"/elements/item1","value":{"type":"Card","props":{"title":"PROJ-101: Fix login timeout"},"children":["item1meta"]}}
{"op":"add","path":"/elements/item1meta","value":{"type":"Stack","props":{"direction":"horizontal","gap":"sm","align":"center"},"children":["item1status","item1priority","item1date"]}}
{"op":"add","path":"/elements/item1status","value":{"type":"Lozenge","props":{"text":"Done","variant":"success","isBold":true}}}
{"op":"add","path":"/elements/item1priority","value":{"type":"Badge","props":{"text":"High","variant":"destructive"}}}
{"op":"add","path":"/elements/item1date","value":{"type":"Text","props":{"content":"Updated 2d ago","muted":true}}}
{"op":"add","path":"/elements/tabActivity","value":{"type":"TabContent","props":{"value":"activity"},"children":["activityTimeline"]}}
{"op":"add","path":"/elements/activityTimeline","value":{"type":"Timeline","props":{"items":[{"title":"Updated PROJ-101","description":"Moved to Done","date":"Feb 21"},{"title":"Edited Design Spec page","description":"Confluence · Design Space","date":"Feb 20"},{"title":"Merged PR #387","description":"Bitbucket · main branch","date":"Feb 19"}]}}}
\`\`\``,

	// Financial / time-series data
	`Example — stock price with line chart and current price metric:
\`\`\`spec
{"op":"add","path":"/root","value":"main"}
{"op":"add","path":"/elements/main","value":{"type":"Stack","props":{"gap":"md"},"children":["heading","metricsRow","priceChart","note"]}}
{"op":"add","path":"/elements/heading","value":{"type":"Heading","props":{"level":"h2","text":"Atlassian Corporation (TEAM)"}}}
{"op":"add","path":"/elements/metricsRow","value":{"type":"Grid","props":{"columns":"3","gap":"md"},"children":["mPrice","mChange","mVolume"]}}
{"op":"add","path":"/elements/mPrice","value":{"type":"Metric","props":{"label":"Share Price","value":"$217.34","detail":"Close: Mar 18","trend":"neutral"}}}
{"op":"add","path":"/elements/mChange","value":{"type":"Metric","props":{"label":"Daily Change","value":"+$3.12","detail":"+1.46%","trend":"up"}}}
{"op":"add","path":"/elements/mVolume","value":{"type":"Metric","props":{"label":"Volume","value":"1.2M","detail":"Avg 1.5M","trend":"down"}}}
{"op":"add","path":"/elements/priceChart","value":{"type":"LineChart","props":{"title":"Share Price (Last 30 Days)","data":[{"date":"Feb 17","price":205.20},{"date":"Feb 21","price":208.45},{"date":"Feb 28","price":211.80},{"date":"Mar 7","price":209.15},{"date":"Mar 14","price":214.60},{"date":"Mar 18","price":217.34}],"xKey":"date","yKey":"price","color":"#0052CC","height":280}}}
{"op":"add","path":"/elements/note","value":{"type":"Text","props":{"content":"Data from web search. Prices may be delayed.","muted":true,"size":"xs"}}}
\`\`\``,

	// Notification Feed
	`Example — notification feed with mixed message types:
\`\`\`spec
{"op":"add","path":"/root","value":"main"}
{"op":"add","path":"/elements/main","value":{"type":"Stack","props":{"gap":"md"},"children":["heading","section0","sep1","section1","sep2","inline1","empty"]}}
{"op":"add","path":"/elements/heading","value":{"type":"Heading","props":{"level":"h2","text":"Notifications"}}}
{"op":"add","path":"/elements/section0","value":{"type":"SectionMessage","props":{"title":"Deployment complete","description":"v2.4.1 deployed to production successfully.","appearance":"success"}}}
{"op":"add","path":"/elements/sep1","value":{"type":"Separator","props":{}}}
{"op":"add","path":"/elements/section1","value":{"type":"Alert","props":{"title":"Scheduled maintenance","description":"Systems will be unavailable Saturday 2am-4am UTC.","variant":"warning"}}}
{"op":"add","path":"/elements/sep2","value":{"type":"Separator","props":{}}}
{"op":"add","path":"/elements/inline1","value":{"type":"Alert","props":{"title":"PR #387 approved","description":"Ready to merge into main branch.","variant":"success"}}}
{"op":"add","path":"/elements/empty","value":{"type":"EmptyState","props":{"title":"All caught up","description":"No more notifications to show."}}}
	\`\`\``,
];

const LAYOUT_WIDTH_CLASSES = new Set(["compact", "regular", "wide"]);

function toPositiveInteger(value) {
	if (typeof value === "number" && Number.isFinite(value) && value > 0) {
		return Math.round(value);
	}

	if (typeof value === "string" && value.trim().length > 0) {
		const parsed = Number.parseFloat(value.trim());
		if (Number.isFinite(parsed) && parsed > 0) {
			return Math.round(parsed);
		}
	}

	return null;
}

function inferLayoutWidthClass({ containerWidthPx, viewportWidthPx, surface }) {
	const widthSource = containerWidthPx ?? viewportWidthPx;
	if (typeof widthSource === "number") {
		if (widthSource <= 520) {
			return "compact";
		}
		if (widthSource <= 900) {
			return "regular";
		}
		return "wide";
	}

	if (surface === "sidebar" || surface === "multiport") {
		return "compact";
	}
	if (surface === "fullscreen") {
		return "wide";
	}

	return null;
}

function normalizeLayoutContext(value) {
	if (!value || typeof value !== "object") {
		return null;
	}

	const rawSurface = typeof value.surface === "string" ? value.surface.trim().toLowerCase() : "";
	const surface = rawSurface.length > 0 ? rawSurface : null;
	const containerWidthPx = toPositiveInteger(value.containerWidthPx);
	const viewportWidthPx = toPositiveInteger(value.viewportWidthPx);
	const rawWidthClass = typeof value.widthClass === "string" ? value.widthClass.trim().toLowerCase() : "";
	const explicitWidthClass = LAYOUT_WIDTH_CLASSES.has(rawWidthClass) ? rawWidthClass : null;
	const widthClass =
		explicitWidthClass ??
		inferLayoutWidthClass({
			containerWidthPx,
			viewportWidthPx,
			surface,
		});

	if (!surface && !containerWidthPx && !viewportWidthPx && !widthClass) {
		return null;
	}

	return {
		surface,
		containerWidthPx,
		viewportWidthPx,
		widthClass,
	};
}

function getGenuiSystemPrompt(options = {}) {
	const {
		strict = false,
		webContext = "",
		layoutContext = null,
	} = options;

	// Start with the catalog-generated base prompt (includes all components,
	// Zod schemas, defaultRules, SpecStream format, and examples)
	const sections = [generatedPrompt.prompt];

	// Append VPK-specific rules
	const lastRuleNumber = (generatedPrompt.prompt.match(/^(\d+)\./gm) || []).length;
	let ruleNum = lastRuleNumber;

	sections.push("");
	sections.push("ADDITIONAL RULES:");
	for (const rule of VPK_CUSTOM_RULES) {
		ruleNum += 1;
		sections.push(`${ruleNum}. ${rule}`);
	}

	// Append companion examples
	sections.push("");
	sections.push("COMPANION EXAMPLES (use these as reference for multi-component specs):");
	for (const example of COMPANION_EXAMPLES) {
		sections.push("");
		sections.push(example);
	}

	const normalizedLayoutContext = normalizeLayoutContext(layoutContext);
	if (normalizedLayoutContext) {
		sections.push("");
		sections.push("RUNTIME LAYOUT CONTEXT:");
		if (normalizedLayoutContext.surface) {
			sections.push(`- Surface: ${normalizedLayoutContext.surface}`);
		}
		if (normalizedLayoutContext.containerWidthPx) {
			sections.push(`- Container width: ${normalizedLayoutContext.containerWidthPx}px`);
		}
		if (normalizedLayoutContext.viewportWidthPx) {
			sections.push(`- Viewport width: ${normalizedLayoutContext.viewportWidthPx}px`);
		}
		if (normalizedLayoutContext.widthClass) {
			sections.push(`- Width class: ${normalizedLayoutContext.widthClass}`);
		}
		sections.push("- Apply responsive layout decisions using this runtime context.");

		if (normalizedLayoutContext.widthClass === "compact") {
			sections.push("- Treat this as a narrow container.");
			sections.push("- For multiple charts, stack them vertically and avoid side-by-side chart rows.");
			sections.push("- For chart sections, use Stack direction \"vertical\".");
			sections.push("- For grids containing charts, use columns \"1\".");
			sections.push("- Keep chart heights compact (roughly 180-240).");
			sections.push("- Avoid outer/root container padding in compact layouts.");
		} else if (normalizedLayoutContext.widthClass === "regular") {
			sections.push("- Treat this as a medium-width container.");
			sections.push("- For chart sections, prefer vertical stacking; at most two charts in one row.");
			sections.push("- For grids containing charts, use columns \"1\" or \"2\" only.");
		} else if (normalizedLayoutContext.widthClass === "wide") {
			sections.push("- This container can support multi-column layouts when useful.");
			sections.push("- Prioritize readability: avoid more than two chart widgets per row unless explicitly requested.");
		}
	}

	// Strict output section for retries
	if (strict) {
		sections.push("");
		sections.push("STRICT OUTPUT REQUIREMENTS:");
		sections.push("- For UI-generation requests, you MUST output exactly one ```spec block with valid JSON patch lines.");
		sections.push("- Keep the ```spec block machine-parseable: no markdown bullets, no prose, no comments inside the fence.");
		sections.push("- The first patch line must set \"/root\", and that key must exist in \"/elements/<key>\".");
		sections.push("- Include at least one \"/elements/<key>\" patch so the UI can render.");
		sections.push("- If you cannot satisfy the request, output concise text and no ```spec block.");
	}

	// Web context section
	if (typeof webContext === "string" && webContext.trim().length > 0) {
		sections.push("");
		sections.push("OPTIONAL WEB CONTEXT:");
		sections.push("Use this external context when helpful. Treat it as assistive hints (it may be incomplete):");
		sections.push(webContext.trim());
	}

	return sections.join("\n");
}

/**
 * Build a system prompt for genui summary generation in plan runs.
 *
 * Uses the same catalog prompt and VPK rules as the chat mode,
 * but with summary-specific instructions layered on top.
 */
function getGenuiSummarySystemPrompt() {
	const basePrompt = getGenuiSystemPrompt({ strict: true });

	const summaryInstructions = [
		"",
		"SUMMARY MODE INSTRUCTIONS:",
		"You are generating an interactive summary dashboard for a completed multi-agent execution plan.",
		"Use the task outputs provided as source material to build a structured, interactive UI.",
		"",
		"Requirements:",
		"- Create a cohesive dashboard that summarizes the plan execution results.",
		"- Use Metric components for key statistics (tasks completed, success rate, etc.).",
		"- Include at least one chart (BarChart, PieChart, LineChart, or AreaChart) visualizing task data — e.g. status distribution (PieChart), tasks per agent (BarChart), or completion over time (LineChart).",
		"- Use Card components to organize task outcomes by agent or theme.",
		"- Use Lozenge for task statuses (done, failed, blocked).",
		"- Use Tabs to organize different views of the data (overview, details, next actions).",
		"- Include interactive elements where appropriate (collapsible sections, tabs).",
		"- Include a section for recommended next actions.",
		"- Do NOT use ProgressTracker — it is not available in the catalog.",
		"- Output exactly one ```spec block with valid JSON patch lines.",
	];

	return basePrompt + summaryInstructions.join("\n");
}

module.exports = { getGenuiSystemPrompt, getGenuiSummarySystemPrompt };
