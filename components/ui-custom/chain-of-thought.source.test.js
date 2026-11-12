const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

const ROOT = join(__dirname, "..", "..");

function readProjectFile(...segments) {
	return readFileSync(join(ROOT, ...segments), "utf8");
}

const COMPONENT_SOURCE = readProjectFile("components/ui-custom/chain-of-thought.tsx");
const DEMO_SOURCE = readProjectFile("components/website/demos/ui-custom/chain-of-thought-demo.tsx");
const DETAILS_SOURCE = readDetailCategorySource("ui-custom");
const REGISTRY_SOURCE = readWebsiteRegistrySource();

test("CyclingByline accepts an explicit content key for composed cycling labels", () => {
	assert.match(COMPONENT_SOURCE, /contentKey\?: string;/u);
	assert.match(COMPONENT_SOURCE, /const textKey = contentKey \?\? \(typeof children === "string" \? children : "byline"\);/u);
});

test("ChainOfThoughtScenario composes the primitive chain-of-thought parts", () => {
	assert.match(COMPONENT_SOURCE, /export interface ChainOfThoughtScenarioStep/u);
	assert.match(COMPONENT_SOURCE, /export interface ChainOfThoughtScenarioProps/u);
	assert.match(COMPONENT_SOURCE, /export const ChainOfThoughtScenario = memo/u);
	assert.match(COMPONENT_SOURCE, /defaultOpen,\s*animateStepEntrance = false,\s*duration,/u);
	assert.match(COMPONENT_SOURCE, /<ChainOfThought[\s\S]*defaultOpen=\{defaultOpen \?\? state === "thinking"\}/u);
	assert.match(COMPONENT_SOURCE, /<ChainOfThoughtHeader[\s\S]*showChevron=\{state !== "preload" && steps\.length > 0\}[\s\S]*state=\{state\}/u);
	assert.match(COMPONENT_SOURCE, /<ChainOfThoughtContent[\s\S]*className=\{contentClassName\}/u);
	assert.match(COMPONENT_SOURCE, /<ChainOfThoughtStep[\s\S]*status=\{step\.status\}/u);
	assert.match(COMPONENT_SOURCE, /ChainOfThoughtScenario\.displayName = "ChainOfThoughtScenario"/u);
});

test("ChainOfThoughtScenario supports opt-in transform-only step entrance motion", () => {
	assert.match(COMPONENT_SOURCE, /animateStepEntrance\?: boolean;/u);
	assert.match(COMPONENT_SOURCE, /animateOnMount\?: boolean;/u);
	assert.match(COMPONENT_SOURCE, /initial=\{shouldAnimateEntrance \? \{ opacity: 0, y: -6 \} : false\}/u);
	assert.match(COMPONENT_SOURCE, /willChange: "opacity, transform"/u);
	assert.match(COMPONENT_SOURCE, /entranceDelay=\{animateStepEntrance \? Math\.min\(index \* 0\.045, 0\.18\) : 0\}/u);
});

test("ChainOfThoughtStep keeps its connector column stretched across tall tool rows", () => {
	assert.match(COMPONENT_SOURCE, /"flex items-stretch gap-2 text-sm"/u);
	assert.match(COMPONENT_SOURCE, /className=\{cn\("relative mt-0\.5 self-stretch", iconContainerClassName\)\}/u);
	assert.match(COMPONENT_SOURCE, /iconContainerStyle\?: CSSProperties;/u);
	assert.match(COMPONENT_SOURCE, /style=\{iconContainerStyle\}/u);
	assert.match(COMPONENT_SOURCE, /"inline-flex size-4 shrink-0 items-center justify-center"/u);
	assert.match(
		COMPONENT_SOURCE,
		/"absolute top-5 left-1\/2 -mx-px w-px bg-border"[\s\S]*"-bottom-3"/u,
	);
});

test("TWG tool steps keep rail top override without shrinking sibling gaps", () => {
	const THINKING_TRACE_SOURCE = readProjectFile("components/projects/shared/components/assistant-thinking-trace.tsx");
	const PRESENTATION_SOURCE = readProjectFile("components/projects/shared/lib/assistant-thinking-trace-presentation.tsx");
	assert.match(PRESENTATION_SOURCE, /export function isTwgToolCall\(toolName: string\)/u);
	// Tailwind v4 `space-y-*` uses margin-bottom; `mb-1` on the previous step
	// overrides the 12px rhythm down to 4px and must not be used for TWG handoffs.
	assert.doesNotMatch(THINKING_TRACE_SOURCE, /isTwgToolCall\(nextToolCall\.toolName\) \? "mb-1"/u);
	assert.doesNotMatch(THINKING_TRACE_SOURCE, /marginBottom:\s*[46]/u);
	assert.doesNotMatch(DEMO_SOURCE, /className="mb-1"[\s\S]*label="Reading the current work item"/u);
	assert.match(THINKING_TRACE_SOURCE, /iconContainerStyle=\{tracePresentation\?\.iconContainerStyle\}/u);
	assert.match(DEMO_SOURCE, /iconContainerStyle=\{\{\s*marginTop:\s*6\s*\}\}/u);
	assert.match(PRESENTATION_SOURCE, /TWG_TOOL_ICON_CONTAINER_STYLE = \{ marginTop: 6 \}/u);
	assert.match(
		PRESENTATION_SOURCE,
		/entry\.header\?\.type === "twg-tool" \? TWG_TOOL_ICON_CONTAINER_STYLE : undefined/u,
	);
	assert.doesNotMatch(COMPONENT_SOURCE, /relative mt-1\.5 self-stretch/u);
	// Collapsed expandable panels must not leave parent `space-y-2` residue.
	assert.match(
		COMPONENT_SOURCE,
		/hasExpandableContent\s*\?\s*isOpen && "space-y-2"\s*:\s*children != null && "space-y-2"/u,
	);
	assert.doesNotMatch(
		COMPONENT_SOURCE,
		/overflow-hidden has-\[:focus-visible\]:overflow-visible pt-2 h-\(--collapsible-panel-height\)/u,
	);
});

test("Chain of Thought docs include Studio-quality AI usage recipes", () => {
	for (const demoSlug of [
		"chain-of-thought-demo-studio-agent-generation-flow",
		"chain-of-thought-demo-automation-trigger-flow",
		"chain-of-thought-demo-research-retrieval-flow",
		"chain-of-thought-demo-twg-tool-call",
		"chain-of-thought-demo-tool-call-details-flow",
		"chain-of-thought-demo-normal-tool-calling-replay",
		"chain-of-thought-demo-awaiting-user-response-replay",
	]) {
		assert.match(DETAILS_SOURCE, new RegExp(demoSlug, "u"));
		assert.match(REGISTRY_SOURCE, new RegExp(`"${demoSlug}"`, "u"));
	}

	assert.match(DETAILS_SOURCE, /ChainOfThoughtScenario/u);
	assert.match(DETAILS_SOURCE, /AI usage guidance:/u);
	assert.match(DETAILS_SOURCE, /Never use placeholder labels/u);
	assert.match(DEMO_SOURCE, /export function ChainOfThoughtDemoStudioAgentGenerationFlow/u);
	assert.match(DEMO_SOURCE, /export function ChainOfThoughtDemoAutomationTriggerFlow/u);
	assert.match(DEMO_SOURCE, /export function ChainOfThoughtDemoResearchRetrievalFlow/u);
	assert.match(DEMO_SOURCE, /export function ChainOfThoughtDemoTwgToolCall/u);
	assert.match(DEMO_SOURCE, /export function ChainOfThoughtDemoToolCallDetailsFlow/u);
	assert.match(DEMO_SOURCE, /export function ChainOfThoughtDemoNormalToolCallingReplay/u);
	assert.match(DEMO_SOURCE, /export function ChainOfThoughtDemoAwaitingUserResponseReplay/u);
	assert.match(DEMO_SOURCE, /data-chain-of-thought-replay-demo="true"/u);
	assert.match(DEMO_SOURCE, /ask_user_questions/u);
	assert.match(DEMO_SOURCE, /Reset normal tool calling animation/u);
	assert.match(DEMO_SOURCE, /Reset awaiting user response animation/u);
	assert.match(DEMO_SOURCE, /Build a Rovo agent named OKR Generator/u);
	assert.match(DEMO_SOURCE, /STUDIO_REPLAY_TOOL_CALL_DELAY_MS = 2300/u);
	assert.match(DEMO_SOURCE, /STUDIO_REPLAY_NARRATION_ROW_DELAY_MS = 550/u);
	assert.match(DEMO_SOURCE, /Math\.round\(remainingRunMs \* 0\.7\)/u);
	assert.match(DEMO_SOURCE, /buildThinkingNarrationMap/u);
	assert.match(DEMO_SOURCE, /getThinkingToolCallSummaries/u);
	assert.match(DEMO_SOURCE, /phase === "completed" \|\| phase === "awaiting" \|\| hasAwaitingInput/u);
	assert.match(DEMO_SOURCE, /setIsOpen\(false\)/u);
	assert.match(DEMO_SOURCE, /twg\.lookup_work_item_delivery_context/u);
	assert.match(DEMO_SOURCE, /Connecting work through Teamwork Graph/u);
	assert.match(DEMO_SOURCE, /Found 4 relevant delivery signals across Jira, Confluence, and Figma\./u);
	assert.match(DEMO_SOURCE, /showLoader=\{false\}/u);
	assert.match(DEMO_SOURCE, /<TwgTool/u);

	for (const studioLabel of [
		"Reading agent brief",
		"Preparing clarification questions",
		"Reviewing agent details",
		"Selecting agent tools",
		"Drafting agent instructions",
		"Naming agent profile",
		"Saving agent profile",
	]) {
		assert.match(DEMO_SOURCE, new RegExp(studioLabel, "u"));
	}

	for (const studioToolName of [
		"studio.read_brief",
		"ask_user_questions",
		"studio.review_answers",
		"studio.select_tools",
		"studio.draft_instructions",
		"studio.name_agent",
		"studio.save_profile",
	]) {
		assert.match(DEMO_SOURCE, new RegExp(studioToolName.replace(".", "\\."), "u"));
	}

	const replayToolCallIds = DEMO_SOURCE.match(/toolCallId: "studio-agent-replay-turn-[12]-[^"]+"/gu) ?? [];
	assert.equal(replayToolCallIds.length, 8);
});

test("Chain of Thought docs demos center their preview content", () => {
	assert.match(DEMO_SOURCE, /function ChainOfThoughtDemoFrame/u);
	assert.match(DEMO_SOURCE, /data-chain-of-thought-demo-frame="true"/u);
	assert.match(DEMO_SOURCE, /className="flex min-h-\[400px\] w-full items-center justify-center/u);

	const frameUsageCount = DEMO_SOURCE.match(/<ChainOfThoughtDemoFrame>/gu)?.length ?? 0;
	assert.equal(frameUsageCount, 13);
});

test("Chain of Thought tool icon table does not add a second outer preview border", () => {
	assert.match(DEMO_SOURCE, /<div className="w-full max-w-4xl overflow-hidden rounded-md bg-background">/u);
	assert.doesNotMatch(DEMO_SOURCE, /<div className="w-full max-w-4xl rounded-xl border border-border bg-background">/u);
});

test("Chain of Thought does not clip descendant focus rings", () => {
	// globals.css gives every button `outline: 2px solid` at `outline-offset: 2px`,
	// so a focus ring sits 4px outside the button box. The step body wraps a
	// full-width header button, so clipping there shears the ring on every side.
	assert.match(
		COMPONENT_SOURCE,
		/hasExpandableContent\s*\?\s*isOpen && "space-y-2"\s*:\s*children != null && "space-y-2"/u,
	);
	assert.doesNotMatch(COMPONENT_SOURCE, /className="min-w-0 flex-1 space-y-2"/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /className="flex-1 space-y-2 overflow-hidden"/u);

	// Collapsible panels must keep `overflow-hidden` for the height transition,
	// but release it while a descendant holds focus so the ring stays whole.
	const clippedPanels =
		COMPONENT_SOURCE.match(/overflow-hidden h-\(--collapsible-panel-height\)/gu) ?? [];
	const unclippedPanels =
		COMPONENT_SOURCE.match(
			/overflow-hidden has-\[:focus-visible\]:overflow-visible h-\(--collapsible-panel-height\)/gu,
		) ?? [];
	assert.equal(clippedPanels.length, 0);
	assert.equal(unclippedPanels.length, 2);
});
