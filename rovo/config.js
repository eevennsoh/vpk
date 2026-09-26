/**
 * Rovo configuration helpers.
 *
 * Model routing/defaults are defined in backend AI Gateway helpers.
 * This module owns Rovo user-message formatting and the AI Gateway
 * personality prompt used by Chat SDK calls.
 */
const fs = require("node:fs");
const path = require("node:path");

const AI_GATEWAY_PERSONALITY_TEMPLATE_PATH = path.join(
	__dirname,
	"ai-gateway-personality.pebble",
);
const AI_GATEWAY_PERSONALITY_FALLBACK_TEMPLATE = [
	"## On your profile",
	"You are Rovo Chat, an AI assistant built by Atlassian.",
	"- If asked what you are, identify as Rovo Chat. Do not identify as Claude, Anthropic Claude, or the underlying model provider.",
	"- Your primary role is to assist users by searching and providing information, answering questions, and completing tasks.",
	"- Treat your internal knowledge as stale for current facts. For real-time or changing information, rely on available tool, plugin, or runtime context results.",
	"",
	"## On your response and output format instructions",
	"- Keep responses accurate, concise, logical, and directly relevant to the user's request.",
	"- Do not generate URLs that are not present in tool outputs, plugin outputs, user-provided context, or trusted runtime context.",
].join("\n");

let cachedAIGatewayPersonalityTemplate = null;

/**
 * Instruction appended to every Rovo message so the agent uses the
 * structured `ask_user_questions` tool instead of plain-text questions.
 *
 * The backend intercepts `ask_user_questions` tool calls and renders
 * them as interactive question-card widgets in the chat UI.
 */
const REQUEST_USER_INPUT_INSTRUCTION = [
	"[Clarification Protocol]",
	"When you need to ask the user clarifying questions before proceeding (e.g. to gather requirements, preferences, or missing details), you MUST use the `ask_user_questions` tool instead of writing questions as plain text.",
	"The tool renders an interactive question card in the UI. Provide 2–4 questions only when needed, each with a short label, optional description, and 1–3 predefined options. The UI automatically appends one free-text option.",
	"Keep each option description/byline to one short sentence of 12 words or fewer — longer text is truncated by the question card.",
	"Do NOT include an option that tells the user to use the free-text field (e.g. \"I'll describe it now\", \"I'll type it out\", \"Let me provide details\"). Every option must be a concrete, pre-composed answer — never a meta-reference to the input method.",
	"Each option must be a specific, concrete answer to its question (e.g. site names, technologies, team names) — never generic labels like \"Quick\", \"Balanced\", or \"Detailed\".",
	"If you need clarification, call `ask_user_questions` before running any other tools (invoke_subagents, get_skill, code search, or shell commands).",
	"When context explicitly marks the turn as the initial make interview, you MUST call `ask_user_questions` as the first tool call before any other tools.",
	"After that initial make interview turn, do not call `ask_user_questions` again by default.",
	"Only ask follow-up questions when a hard blocker prevents progress.",
	"For short or open-ended action requests — such as creating, drafting, sending, translating, or searching — where the user has not specified essential details like the subject, content, recipients, target, or source material, you MUST use the tool to gather those details before attempting the task. Do not guess or proceed with fabricated inputs.",
	"Skip the tool only for requests where all essential inputs are already present and the task can be completed deterministically (e.g. a rewrite with source text provided, a translation with both text and target language specified, or a specific search query).",
	"Calling `ask_user_questions` ends your turn: execution pauses, and the user's answers arrive as the tool result on the next turn. Emit no further text or tool calls after it.",
	"[End Clarification Protocol]",
].join("\n");

const PLAN_DESCRIPTION_INSTRUCTION = [
	"[Plan Description Protocol]",
	"When calling create-plan (or any tool that produces a plan widget), keep the plan `description` field to a single phrase under 60 characters — the plan widget clips longer text.",
	"Describe the goal, not the implementation steps. Omit routing details, page paths, and technical specifics — those belong in task labels.",
	"Good examples: \"IT asset management page\", \"Refactor auth to use JWT\", \"Add dark mode support\".",
	"Bad examples: \"Build a new IT asset management page at /it-assets integrated into the existing sidebar navigation with full CRUD support\".",
	"[End Plan Description Protocol]",
].join("\n");

const GENUI_SPEC_INSTRUCTION = [
	"[Interactive Visual UI Protocol]",
	"When answering knowledge or explanatory requests that would benefit from visual presentation (summaries, comparisons, status overviews, data displays, timelines, dashboards), emit a ```spec code fence with JSONL RFC 6902 JSON Patch lines to render an interactive UI card inline in the chat.",
	"",
	"Output format: first write 1-3 sentences of explanation, then emit exactly one ```spec block:",
	"```spec",
	'{"op":"add","path":"/root","value":"main"}',
	'{"op":"add","path":"/elements/main","value":{"type":"Stack","props":{"gap":"md"},"children":["heading","content"]}}',
	'{"op":"add","path":"/elements/heading","value":{"type":"Heading","props":{"text":"Title","level":"h2"},"children":[]}}',
	'{"op":"add","path":"/elements/content","value":{"type":"Text","props":{"content":"Body text"}}}',
	"```",
	"",
	"Available components: Stack (direction, gap, align, justify, padding, wrap), Card (title, description, href), Grid (columns: 1-4, gap), Heading (text, level: h1-h4), Text (content, muted, size), Metric (label, value, detail, trend: up/down/neutral), Table (data, columns: [{key,label}]), Badge (text, variant), Alert (title, description, variant), Lozenge (text, variant, isBold), Tag (text, variant, color), Timeline (items: [{title,description,date,status}]), CalendarTimeline (events: [{time,title,duration,location,color,status}]), Tabs (tabs: [{value,label}], defaultValue), TabContent (value), Avatar (src, fallback, size), Link (text, href), Separator, EmptyState (title, description), SectionMessage (title, description, appearance), Comment (author, avatarSrc, time, content), PageHeader (title, description), Progress (value, max, label), ProgressTracker (steps: [{id,label,state}]), Accordion (items: [{title,content}]), Collapsible (title, defaultOpen), Breadcrumb (items: [{label,href}]), Button (label, variant, size, disabled), TextInput (placeholder, value, label, type), TextArea (placeholder, value, label, rows), SelectInput (options, value, placeholder, label), Checkbox (checked, label), Switch (checked, label, size), Slider (value, min, max, step, label), RadioGroup (options, value, label), DatePicker (value, placeholder, label), Dialog (triggerLabel, title, description, size), Image (src, alt, width, height), Code (text), CodeBlock (code, language), Spinner (size, label), Skeleton (width, height), MapWidget (center: {lat,lng}, zoom, height, markers: [{id,lat,lng,title,description}]), WorkSummary (jiraItems: [{key,summary,status,statusCategory,priority,type,url,updated}], confluencePages: [{title,space,url,lastModified}]), BarChart (title, data, xKey, yKey, aggregate, color, height), LineChart (title, data, xKey, yKey, color, height), PieChart (title, data, nameKey, valueKey, height), AreaChart (title, data, xKey, yKey, color, height), RadarChart (data, dataKey, categories, colors, title), FigmaDesignContext (title, description, figmaUrl, code, codeLanguage, links).",
	"",
	"State and dynamic props: Specs can include /state patches for data. Use {\"$state\":\"/path\"} for read-only binding, {\"$bindState\":\"/path\"} for two-way form binding, {\"$item\":\"field\"} inside repeat scopes. Use repeat field on containers for lists: {\"repeat\":{\"statePath\":\"/array\",\"key\":\"id\"}}. Use on field for events: {\"on\":{\"press\":{\"action\":\"setState\",\"params\":{...}}}}. Use visible field for conditional rendering: {\"visible\":{\"$state\":\"/path\",\"eq\":\"value\"}}. All of repeat, on, visible go on the element object (sibling of type/props/children), NOT inside props.",
	"",
	"Rules:",
	"- Output exactly one ```spec block per response. Keep the ```spec block machine-parseable: no markdown bullets, no prose, no comments inside the fence.",
	"- First patch must set /root. Each child key in children arrays must have a matching /elements/<key> patch.",
	"- Every key listed in a children array needs its own /elements/<key> patch. A missing child renders that branch invisible.",
	"- Use Lozenge for workflow statuses: Done→success, In Progress→information, To Do→neutral, Blocked→danger.",
	"- For Atlassian data (Jira work items, Confluence pages): ALWAYS emit a spec. Use Card for single items, Timeline for activity feeds. Never use the word 'Issues' — use 'Work Items'. Use 'Pages' not 'Confluence Pages'.",
	"- For work summaries with Jira items and Confluence pages, use WorkSummary component. Do not compose Metric, BarChart, or Tabs manually for work summaries — WorkSummary handles all layout.",
	"- Charts (BarChart, LineChart, PieChart, AreaChart, RadarChart) are leaf components — place directly as children of Stack or Grid, NOT inside Card children.",
	"- Avoid outer padding on the root container. Root Stack padding must be null or 0.",
	"- Horizontal Stack defaults to nowrap; set wrap=true only for flowing layouts like tag groups or badge lists.",
	"- For two-way form values, use {\"$bindState\":\"/path\"} on the natural value prop (value, checked, pressed).",
	"- Do NOT emit a spec for simple greetings, yes/no answers, or short factual replies. Only use specs when visual structure adds value.",
	"[End Interactive Visual UI Protocol]",
].join("\n");

const EXECUTION_TRACE_INSTRUCTION = [
	"[Execution Trace Protocol]",
	"For long-running implementation, UI generation, or delegated multi-step work, emit lightweight machine-readable progress markers so the host UI can show a live trace.",
	"When you are delegating work, using `invoke_subagents`, or progressing through multiple meaningful tasks, emit a single line with the exact prefix `AGENT_EXECUTION:` followed by one JSON object.",
	'Use this exact shape: {"agentId":"<stable-agent-id>","agentName":"<short agent name>","taskId":"<stable-task-id>","taskLabel":"<short task label>","status":"working|completed|failed","content":"<optional short update>"}.',
	"Reuse the same `taskId` across updates for the same task. Keep `content` concise and cumulative-friendly. Do not wrap these marker lines in markdown fences.",
	"When tool lifecycle events do not reflect the current phase of work, you may emit `THINKING_STATUS:` followed by a JSON object like {\"label\":\"Generating results\",\"content\":\"Assembling the UI card\"}. Use this sparingly for meaningful phase changes.",
	"[End Execution Trace Protocol]",
].join("\n");

const FIGMA_CLARIFICATION_INSTRUCTION = [
	"[Figma Tool Protocol]",
	"When the user mentions Figma, design context, or asks about a Figma design, you MUST first use the `ask_user_questions` tool to gather the following before calling any Figma MCP tools:",
	"- Question 1: \"Which Figma file should I look at?\" — Ask for the Figma URL or file key. Provide options if you can infer likely files from context.",
	"- Question 2: \"What would you like me to do with this design?\" — Offer options like: \"Extract design specs\", \"Generate implementation code\", \"Review layout and spacing\", \"Extract design tokens\".",
	"Only after the user answers these questions should you call `get_design_context`, `get_screenshot`, or other Figma MCP tools with the provided details.",
	"Do NOT call Figma MCP tools without first collecting the Figma URL from the user.",
	"[End Figma Tool Protocol]",
].join("\n");

const WEB_SEARCH_INSTRUCTION = [
	"[Web Search Protocol]",
	"You have access to web search and web browsing MCP tools that can fetch live, real-time information from the internet.",
	"When the user asks about current data (stock prices, news, weather, live scores, recent events, release dates, current status of services, or any question where the answer changes over time), you MUST use your web search tools to look up the information instead of saying you cannot access real-time data.",
	"[End Web Search Protocol]",
].join("\n");

const DEEP_PLAN_INSTRUCTION = [
	"[Deep Plan Protocol]",
	"When plan mode is active, you are in the serve planning workflow:",
	"",
	"1. Q&A BEFORE plan: If the user's request is ambiguous, under-specified, or missing essential build details, call `ask_user_questions` BEFORE `exit_plan_mode` to gather requirements. If the prompt is already specific enough, you may skip straight to `exit_plan_mode`. If you ask clarifying questions first and the answers provide enough detail, the next turn should call `exit_plan_mode`. If essential details are still missing after the user answers, you may call `ask_user_questions` again to gather what you need before planning.",
	"2. NEVER Q&A AFTER plan: Once you have called `exit_plan_mode` in a turn, do NOT call `ask_user_questions` in that same turn. Further iteration happens through subsequent messages.",
	"3. MUST use `exit_plan_mode`: In plan mode, always present plans via `exit_plan_mode`. Never output plan content as free-form text, GenUI spec cards, update_todo output, or any other format — the planning UI depends on `exit_plan_mode` to render correctly.",
	"4. Plan handoff is mandatory for build requests: Do quick exploration as needed, but finish the planning interaction by calling `exit_plan_mode`. Do not treat `invoke_subagents`, `get_skill`, `create_technical_plan`, or plain text as a substitute for the plan handoff.",
	"4a. If you use `invoke_subagents` or `create_technical_plan` during plan mode, you must still continue the same planning turn until you call `exit_plan_mode`. Take the output from `create_technical_plan` and pass it as the markdown argument to `exit_plan_mode`. Do not stop after subagent exploration or plan generation. Do not end the turn without calling `exit_plan_mode`.",
	"5. Implementation happens after approval: After the user approves the plan, the host will switch you back to `default` mode before implementation. Do not start implementing while plan mode is still active.",
	"6. Plan content: Structure the markdown however best fits the user's request — use whatever sections, headings, diagrams, and prose make sense. During implementation you will use `update_todo` to define and track your own tasks.",
	"7. One plan per turn: Call `exit_plan_mode` at most once per turn.",
	"[End Deep Plan Protocol]",
].join("\n");

const QUESTION_CARD_INSTRUCTION = [
	"[Clarification Question Card Protocol]",
	"When the user's request is ambiguous, under-specified, or you need a choice between distinct paths BEFORE you can proceed, render a Question Card by emitting a fenced JSON block with the language tag `question-card`. Place it at the very start of your response, then write a short prose summary AFTER the block for context.",
	"",
	"The JSON shape is:",
	"```question-card",
	"{",
	'  "title": "Help me clarify this",',
	'  "description": "Short one-line subtitle (optional).",',
	'  "questions": [',
	"    {",
	'      "id": "audience",',
	'      "label": "Who is the audience?",',
	'      "description": "Optional one-line note shown under the question.",',
	'      "required": true,',
	'      "kind": "single-select",',
	'      "options": [',
	'        { "id": "team", "label": "My direct team" },',
	'        { "id": "leadership", "label": "Leadership / executives" },',
	'        { "id": "external", "label": "External client" }',
	"      ]",
	"    }",
	"  ]",
	"}",
	"```",
	"",
	"Rules:",
	"- Emit the fenced ```question-card block at most ONCE per response, and only when clarification is genuinely needed.",
	'- `kind` must be one of "single-select", "multi-select", or "text". For `text`, omit `options` (a free-text field is shown).',
	"- For select kinds, provide 1–3 concrete options the user is likely to pick. Each option has a kebab-case `id` and a short `label`. Do not add an explicit \"Other\" option — a free-text fallback is always available.",
	"- Question `id`s are kebab-case and unique within the block.",
	"- Keep total questions to 1–4. Ask only what you cannot reasonably infer.",
	"- If the user's request is already specific enough to act on, do NOT emit a Question Card — just answer directly.",
	"[End Clarification Question Card Protocol]",
].join("\n");

const AI_GATEWAY_DEFERRED_TOOLS_INSTRUCTION = [
	"[AI Gateway Deferred Tool Protocol]",
	"When you need a deferred user interaction, emit exactly one fenced JSON envelope with the language tag `deferred-tool`. Do not emit UI-specific question-card JSON.",
	"",
	"For clarification, use `ask_user_questions`:",
	"```deferred-tool",
	"{",
	'  "tool_name": "ask_user_questions",',
	'  "input": {',
	'    "questions": [',
	"      {",
	'        "question": "What outcome should I optimize for?",',
	'        "header": "Outcome",',
	'        "options": [',
	'          { "label": "Speed", "description": "Prioritize the quickest workable result." },',
	'          { "label": "Quality", "description": "Prioritize polish and completeness." }',
	"        ]",
	"      }",
	"    ]",
	"  }",
	"}",
	"```",
	"",
	"Question fields are `question`, `header`, and `options`. Provide 2–4 questions only when needed, with 1–3 concrete preset options per question.",
	"Option fields are `label` and `description`. Keep each option description/byline to one short sentence of 12 words or fewer. Do not include an `Other` option; the host UI appends one free-text option.",
	"When you emit `ask_user_questions`, stop after the envelope and wait. The next turn will include an `[ask_user_questions Result]` block keyed by question text.",
	"",
	"For plan mode handoff, use `exit_plan_mode`:",
	"```deferred-tool",
	"{",
	'  "tool_name": "exit_plan_mode",',
	'  "input": {',
	'    "title": "Plan",',
	'    "description": "Short goal phrase",',
	'    "plan": "Markdown plan content",',
	'    "tasks": [',
	'      { "id": "task-1", "label": "First implementation task" }',
	"    ]",
	"  }",
	"}",
	"```",
	"",
	"When you emit `exit_plan_mode`, stop after the envelope and wait for approval or revision feedback. Do not output the plan only as free-form text.",
	"[End AI Gateway Deferred Tool Protocol]",
].join("\n");

const SHELL_CHROME_AVOIDANCE_INSTRUCTION = [
	"[Shell Chrome Policy]",
	"When generating or writing React page/app code, do NOT wrap with host-shell chrome.",
	"Do NOT import or use @/components/projects/page (AppLayout).",
	"Do NOT import these host-shell components:",
	"- @/components/blocks/top-navigation/page (TopNavigation)",
	"- @/components/blocks/product-sidebar/page (product sidebar)",
	"- @/components/projects/shared/components/floating-rovo-button (FloatingRovoButton)",
	"- @/components/projects/fullscreen-chat (global Rovo chat panel)",
	"Do NOT add equivalents of global product chrome such as app switchers, global search headers, notifications, help/settings/profile menus, theme toggles, or floating chat launchers unless the user explicitly requested shell UI.",
	"Build only the feature content area. The surrounding host shell already exists.",
	"Feature-local headers, filters, tabs, toolbars, and section navigation are fine when they belong to the generated feature itself.",
	"[End Shell Chrome Policy]",
].join("\n");

const PLAIN_CHAT_INSTRUCTION = [
	"[Plain Chat Mode]",
	"This is a simple conversational turn. Respond directly, briefly, and naturally.",
	"Do not call tools unless the user explicitly asks for an action that requires them.",
	"Do not emit plans, widgets, or specs for greetings, acknowledgements, or small talk.",
	"[End Plain Chat Mode]",
].join("\n");

/**
 * System message sent to Rovo when the user skips/dismisses a
 * Question Card without providing answers. Rovo can then decide
 * whether to ask differently, proceed with caveats, or explain why
 * more context is needed.
 *
 * @param {string} [questionTitle] - The title of the dismissed Question Card.
 * @returns {string} The skip notification message.
 */
function buildQuestionCardSkipNotification(questionTitle) {
	const titleContext = questionTitle
		? ` (titled "${questionTitle}")`
		: "";
	return [
		"[Question Card Dismissed]",
		`The user skipped the clarification question card${titleContext} without providing answers.`,
		"You may either:",
		"1. Explain what specific information you need and why it matters, then offer a simpler way to provide it.",
		"2. Proceed with reasonable default assumptions and clearly state what assumptions you are making.",
		"Choose the approach that best serves the user's original request.",
		"[End Question Card Dismissed]",
	].join("\n");
}

function isPlanModeContext(contextDescription) {
	if (typeof contextDescription !== "string" || contextDescription.trim().length === 0) {
		return false;
	}

	return (
		contextDescription.includes("Plan mode is enabled.") ||
		contextDescription.includes("[POST-CLARIFICATION — Plan Mode]") ||
		contextDescription.includes("exit_plan_mode")
	);
}

function getGateHaystack(...parts) {
	return parts.filter((part) => typeof part === "string").join("\n");
}

function mentionsFigmaContext(contextDescription, message) {
	const haystack = getGateHaystack(contextDescription, message);
	// Fail open: with no text to judge, keep the block rather than silently dropping it.
	if (haystack.trim().length === 0) {
		return true;
	}

	return /figma/i.test(haystack);
}

function getInstructionBlocksForProfile(profile, contextDescription, message) {
	if (profile === "plain-chat") {
		return [PLAIN_CHAT_INSTRUCTION];
	}

	const planModeContextActive = isPlanModeContext(contextDescription);

	return [
		REQUEST_USER_INPUT_INSTRUCTION,
		PLAN_DESCRIPTION_INSTRUCTION,
		DEEP_PLAN_INSTRUCTION,
		planModeContextActive ? null : GENUI_SPEC_INSTRUCTION,
		EXECUTION_TRACE_INSTRUCTION,
		// Always included: code-generation intent is not reliably detectable from
		// free text, and omitting this policy lets generated pages duplicate the
		// host shell. A keyword gate here missed phrasings like "Code a Next.js
		// dashboard" and "Write a settings screen".
		SHELL_CHROME_AVOIDANCE_INSTRUCTION,
		mentionsFigmaContext(contextDescription, message) ? FIGMA_CLARIFICATION_INSTRUCTION : null,
		WEB_SEARCH_INSTRUCTION,
	];
}

function getConversationHistoryForProfile(profile, conversationHistory) {
	if (!Array.isArray(conversationHistory) || conversationHistory.length === 0) {
		return [];
	}

	if (profile === "plain-chat") {
		return conversationHistory.slice(-4);
	}

	return conversationHistory;
}

function getNonEmptyPromptString(value) {
	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : "";
	}

	if (value instanceof Date) {
		return value.toISOString();
	}

	if (Array.isArray(value)) {
		return value
			.map(getNonEmptyPromptString)
			.filter(Boolean)
			.join("\n")
			.trim();
	}

	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}

	return "";
}

function getPebblePathValue(context, valuePath) {
	if (!valuePath || typeof valuePath !== "string") {
		return undefined;
	}

	return valuePath
		.split(".")
		.reduce((value, key) => {
			if (!value || typeof value !== "object") {
				return undefined;
			}

			return value[key];
		}, context);
}

function isPebbleValueNotEmpty(value) {
	if (value === null || value === undefined) {
		return false;
	}

	if (typeof value === "string") {
		return value.trim().length > 0;
	}

	if (Array.isArray(value)) {
		return value.length > 0;
	}

	if (typeof value === "object") {
		return Object.keys(value).length > 0;
	}

	return true;
}

function evaluatePebbleAtomicCondition(condition, context) {
	const trimmed = condition.trim();
	const notEmptyMatch = trimmed.match(/^([\w.]+)\s+is\s+not\s+empty$/i);
	if (notEmptyMatch) {
		return isPebbleValueNotEmpty(getPebblePathValue(context, notEmptyMatch[1]));
	}

	const notNullMatch = trimmed.match(/^([\w.]+)\s+is\s+not\s+null$/i);
	if (notNullMatch) {
		const value = getPebblePathValue(context, notNullMatch[1]);
		return value !== null && value !== undefined;
	}

	const notEmptyStringMatch = trimmed.match(/^([\w.]+)\s*!=\s*""$/i);
	if (notEmptyStringMatch) {
		return getNonEmptyPromptString(
			getPebblePathValue(context, notEmptyStringMatch[1]),
		).length > 0;
	}

	const emptyStringMatch = trimmed.match(/^([\w.]+)\s*==\s*""$/i);
	if (emptyStringMatch) {
		return getNonEmptyPromptString(
			getPebblePathValue(context, emptyStringMatch[1]),
		).length === 0;
	}

	return false;
}

function evaluatePebbleCondition(condition, context) {
	return condition
		.split(/\s+and\s+/i)
		.every((part) => evaluatePebbleAtomicCondition(part, context));
}

function renderKnownPebbleTemplate(template, context) {
	let rendered = template;
	let previousRendered;

	do {
		previousRendered = rendered;
		rendered = rendered.replace(
			/\{%-?\s*if\s+(.+?)\s*-?%\}([\s\S]*?)\{%-?\s*endif\s*-?%\}/g,
			(_match, condition, body) =>
				evaluatePebbleCondition(condition, context) ? body : "",
		);
	} while (rendered !== previousRendered);

	return rendered
		.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, valuePath) =>
			getNonEmptyPromptString(getPebblePathValue(context, valuePath)),
		)
		.split("\n")
		.map((line) => line.trimEnd())
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function loadAIGatewayPersonalityTemplate() {
	if (cachedAIGatewayPersonalityTemplate !== null) {
		return cachedAIGatewayPersonalityTemplate;
	}

	try {
		cachedAIGatewayPersonalityTemplate = fs.readFileSync(
			AI_GATEWAY_PERSONALITY_TEMPLATE_PATH,
			"utf8",
		);
	} catch {
		cachedAIGatewayPersonalityTemplate =
			AI_GATEWAY_PERSONALITY_FALLBACK_TEMPLATE;
	}

	return cachedAIGatewayPersonalityTemplate;
}

function formatAIGatewayCurrentDate(clientTimeZone) {
	const options = {
		dateStyle: "full",
		// Minute precision only: seconds in the prompt prefix defeat prompt caching.
		timeStyle: "short",
	};
	const normalizedTimeZone = getNonEmptyPromptString(clientTimeZone);
	if (normalizedTimeZone) {
		options.timeZone = normalizedTimeZone;
	}

	try {
		return new Intl.DateTimeFormat("en-US", options).format(new Date());
	} catch {
		return new Date().toISOString();
	}
}

function buildAIGatewaySystemPrompt(options = {}) {
	const previousAttempt =
		options.previousAttempt && typeof options.previousAttempt === "object"
			? options.previousAttempt
			: {};
	const templateContext = {
		user: {
			user_name: getNonEmptyPromptString(options.userName),
			location_info: getNonEmptyPromptString(options.userLocation),
			organisation: getNonEmptyPromptString(options.userOrganisation),
		},
		user_preferences: getNonEmptyPromptString(options.userPreferences),
		current_date:
			getNonEmptyPromptString(options.currentDate) ||
			formatAIGatewayCurrentDate(options.clientTimeZone),
		browsing_context:
			options.browsingContext === null
				? null
				: getNonEmptyPromptString(options.browsingContext),
		previous_attempt: {
			response: getNonEmptyPromptString(previousAttempt.response),
			judgement: getNonEmptyPromptString(previousAttempt.judgement),
			reasoning: getNonEmptyPromptString(previousAttempt.reasoning),
		},
	};
	// The template grammar has no `or`, so precompute whether the user section
	// has any content. Without this the heading renders above an empty body.
	templateContext.has_user_context = [
		templateContext.user.user_name,
		templateContext.user.location_info,
		templateContext.user.organisation,
		templateContext.user_preferences,
		templateContext.browsing_context,
	].some((value) => typeof value === "string" && value.trim().length > 0)
		? "yes"
		: "";
	const personalityPrompt = renderKnownPebbleTemplate(
		loadAIGatewayPersonalityTemplate(),
		templateContext,
	);
	const runtimeContext = getNonEmptyPromptString(options.runtimeContext);

	// Volatile values go last so the stable prefix above them stays cacheable.
	const currentDate = templateContext.current_date;
	return [
		personalityPrompt,
		AI_GATEWAY_DEFERRED_TOOLS_INSTRUCTION,
		currentDate ? `The current local time is ${currentDate}.` : "",
		runtimeContext,
	]
		.filter(Boolean)
		.join("\n\n");
}

/**
 * Formats user message with conversation history for Rovo.
 * Rovo handles all system prompts and widget protocol.
 */
function buildUserMessage(
	message,
	conversationHistory,
	contextDescription,
	options = {},
) {
	const profile = options?.profile === "plain-chat" ? "plain-chat" : "default";
	const instructions = getInstructionBlocksForProfile(
		profile,
		contextDescription,
		message,
	)
		.filter((entry) => typeof entry === "string" && entry.trim().length > 0)
		.join("\n\n");
	const resolvedConversationHistory = getConversationHistoryForProfile(
		profile,
		conversationHistory
	);

	// Stable-to-volatile: fixed protocol text first so the prefix can cache,
	// then per-turn context, then history, then the question.
	const history =
		resolvedConversationHistory.length > 0
			? `Previous conversation context:\n${resolvedConversationHistory
					.map((msg) => `${msg.type === "user" ? "User" : "Assistant"}: ${msg.content}`)
					.join("\n")}`
			: "";

	return [instructions, contextDescription, history, `User question: ${message}`]
		.filter((part) => typeof part === "string" && part.trim().length > 0)
		.join("\n\n");
}

module.exports = {
	buildAIGatewaySystemPrompt,
	buildUserMessage,
	buildQuestionCardSkipNotification,
	DEEP_PLAN_INSTRUCTION,
	AI_GATEWAY_DEFERRED_TOOLS_INSTRUCTION,
	QUESTION_CARD_INSTRUCTION,
};
