const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const SOURCE = readFileSync(join(__dirname, "index.tsx"), "utf8");
const PAGE_SOURCE = readFileSync(join(__dirname, "page.tsx"), "utf8");
const JIRA_ISSUE_SOURCE = readFileSync(
	join(__dirname, "../jira-issue/agent-activity.tsx"),
	"utf8",
);
/**
 * Value imports only. A type-only specifier erases at build time and cannot
 * mount a flyout, so pinning it would make this guard about import spelling
 * rather than about which surface owns Agent State.
 */
const JIRA_ISSUE_VALUE_IMPORTS = JIRA_ISSUE_SOURCE.replace(/^import type [\s\S]*?;$/gmu, "");
const AGENT_LIST_SOURCE = readFileSync(
	join(__dirname, "../agent-list/agent-list-card.tsx"),
	"utf8",
);
const AGENT_PROFILE_SOURCE = readFileSync(
	join(__dirname, "../../ui-custom/entity-card/agent-profile.tsx"),
	"utf8",
);

test("Agent State owns the shared Jira agent flyout surface", () => {
	assert.match(SOURCE, /export type AgentStateState = "working" \| "awaiting-input" \| "completed";/u);
	assert.match(SOURCE, /export interface AgentStateProps/u);
	assert.match(SOURCE, /data-slot="agent-state"/u);
	assert.match(SOURCE, /w-\[400px\][\s\S]*bg-surface-overlay[\s\S]*shadow-2xl/u);
	assert.match(SOURCE, /<AgentCardHeader/u);
	assert.match(SOURCE, /<ElapsedTime/u);
	assert.match(SOURCE, /composer\?: "visible" \| "hidden";/u);
	assert.match(SOURCE, /<AgentStateComposer onSubmit=\{onSubmit\} \/>/u);
	assert.match(SOURCE, /state === "awaiting-input" && question/u);
	assert.doesNotMatch(JIRA_ISSUE_SOURCE, /<AgentState/u);
});

test("Agent State composer keeps the agent mention directory enabled", () => {
	assert.match(
		SOURCE,
		/<PromptInputTextarea[\s\S]*?enableDirectoryAutocomplete\s*[\r\n]+\s*onChange=/u,
	);
	assert.doesNotMatch(SOURCE, /enableDirectoryAutocomplete=\{false\}/u);
});

test("Agent State composer cannot silently clear a prompt without a destination", () => {
	assert.match(SOURCE, /const canSubmit = Boolean\(onSubmit && reply\.trim\(\)\);/u);
	assert.match(SOURCE, /if \(!prompt \|\| !onSubmit\) return;\s*onSubmit\(prompt\);\s*setReply\(""\);/u);
	assert.match(SOURCE, /submitDisabled=\{onSubmit === undefined\}/u);
});

test("completed Agent State cards show a fixed update time instead of a live runtime", () => {
	assert.match(SOURCE, /import \{ ElapsedTime, RelativeTime \} from "@\/components\/ui\/elapsed-time";/u);
	assert.match(
		SOURCE,
		/state === "completed" \? \([\s\S]*<RelativeTime[\s\S]*secondsAgo=\{completedSecondsAgo\}[\s\S]*timestampMs=\{completedAtMs\}[\s\S]*\) : \([\s\S]*<ElapsedTime/u,
	);
});

test("Agent State demo exposes distinct content for each state", () => {
	assert.match(
		PAGE_SOURCE,
		/import \{ QUESTION_CARD_SINGLE_SELECT_DEMO \} from "@\/components\/blocks\/question-card\/data\/questions";/u,
	);
	assert.match(PAGE_SOURCE, /question=\{QUESTION_CARD_SINGLE_SELECT_DEMO\[0\]\}/u);
	assert.doesNotMatch(PAGE_SOURCE, /\bmessage=/u);
});

test("Agent State composer opts into 24px prompt-input action hits", () => {
	assert.match(
		SOURCE,
		/<PromptInputButton aria-label="Add" size="icon-xs" variant="ghost">/u,
	);
	assert.match(SOURCE, /<AddIcon label="" size="small" \/>/u);
	assert.match(
		SOURCE,
		/<RovoComposerActionButton[\s\S]*showSubmitWhenEmpty[\s\S]*size="icon-xs"/u,
	);
	assert.doesNotMatch(SOURCE, /size="icon-sm"/u);
});

test("24px prompt-input icon buttons keep the medium corner radius", () => {
	const inputGroupSource = readFileSync(
		join(__dirname, "../../ui/input-group.tsx"),
		"utf8",
	);
	assert.match(
		inputGroupSource,
		/"icon-xs": "size-6 rounded-md p-0 has-\[>svg\]:p-0"/u,
	);
	assert.match(
		inputGroupSource,
		/size=\{size === "icon-xs" \? "icon-compact" : undefined\}/u,
	);
	assert.doesNotMatch(
		inputGroupSource,
		/"icon-xs": "size-6 rounded-\[calc\(var\(--radius\)-5px\)\]/u,
	);
});

test("compact catalog prompt input keeps the default 32/36 action hits", () => {
	const promptInputDemoSource = readFileSync(
		join(__dirname, "../../website/demos/ui-custom/prompt-input-demo.tsx"),
		"utf8",
	);
	const sendControlsSource = readFileSync(
		join(
			__dirname,
			"../../projects/shared/components/rovo-composer-send-controls.tsx",
		),
		"utf8",
	);
	const compactTextSendStart = promptInputDemoSource.indexOf(
		"export function PromptInputDemoFloatingBarTextSend()",
	);
	const iconXsTextSendStart = promptInputDemoSource.indexOf(
		"export function PromptInputDemoFloatingBarTextSendIconXs()",
	);
	assert.notEqual(compactTextSendStart, -1);
	assert.notEqual(iconXsTextSendStart, -1);
	assert.ok(iconXsTextSendStart > compactTextSendStart);
	const compactTextSendExport = promptInputDemoSource.slice(
		compactTextSendStart,
		iconXsTextSendStart,
	);
	const iconXsTextSendExport = promptInputDemoSource.slice(iconXsTextSendStart);
	assert.match(compactTextSendExport, /<FloatingBarTextSendDemo size="icon-sm" \/>/u);
	assert.doesNotMatch(compactTextSendExport, /size="icon-xs"/u);
	assert.match(iconXsTextSendExport, /<FloatingBarTextSendDemo size="icon-xs" \/>/u);
	assert.match(
		promptInputDemoSource,
		/<PromptInputButton aria-label="Add" size=\{size\} variant="ghost">/u,
	);
	assert.match(
		promptInputDemoSource,
		/<AddIcon label="" size=\{size === "icon-xs" \? "small" : undefined\} \/>/u,
	);
	assert.match(
		AGENT_PROFILE_SOURCE,
		/<PromptInputButton aria-label="Add" size="icon-sm" variant="ghost">/u,
	);
	assert.doesNotMatch(AGENT_PROFILE_SOURCE, /size="icon-xs"/u);
	assert.match(sendControlsSource, /size = "icon-sm"/u);
	assert.match(
		sendControlsSource,
		/"icon-sm": ACTION_FRAME_CLASS_NAME,[\s\S]*"icon-xs": "flex h-6 shrink-0 items-center justify-center"/u,
	);
	assert.match(
		sendControlsSource,
		/"icon-sm": "flex h-9 items-center gap-1",[\s\S]*"icon-xs": "flex h-6 items-center gap-1"/u,
	);
	assert.match(
		sendControlsSource,
		/"icon-sm": "size-8 hover:opacity-90 active:opacity-80",[\s\S]*"icon-xs": "size-6 hover:opacity-90 active:opacity-80"/u,
	);
});

test("compact agent surfaces use their intended elevation treatment", () => {
	assert.match(SOURCE, /className=\{className\}/u);
	assert.doesNotMatch(SOURCE, /\bborder-0\b/u);
	assert.doesNotMatch(SOURCE, /\bshadow-md\b/u);
	assert.match(
		SOURCE,
		/<RovoComposerActionButton[\s\S]*onStartDictation=\{startPreviewDictation\}[\s\S]*showSubmitWhenEmpty/u,
	);
	assert.doesNotMatch(SOURCE, /liveVoiceEnabled/u);
	assert.doesNotMatch(SOURCE, /onToggleRealtimeVoice/u);
	assert.match(
		AGENT_PROFILE_SOURCE,
		/surface === "overlay" \? "shadow-2xl" : "shadow-sm"/u,
	);
	for (const source of [SOURCE, AGENT_PROFILE_SOURCE]) {
		assert.doesNotMatch(
			source,
			/shadow-\[0px_-2px_25px_rgba\(30,31,33,0\.08\)\]/u,
		);
	}
});

test("Jira Issue agent rows do not open Agent State; Agent List still owns that flyout", () => {
	assert.doesNotMatch(JIRA_ISSUE_VALUE_IMPORTS, /from "@\/components\/blocks\/agent-list"/u);
	assert.doesNotMatch(JIRA_ISSUE_SOURCE, /<AgentList/u);
	assert.doesNotMatch(JIRA_ISSUE_SOURCE, /<AgentState/u);
	assert.doesNotMatch(JIRA_ISSUE_SOURCE, /<HoverCard/u);
	assert.match(
		AGENT_LIST_SOURCE,
		/import \{[\s\S]*AgentState,[\s\S]*\} from "@\/components\/blocks\/agent-state";/u,
	);
	assert.match(AGENT_LIST_SOURCE, /<AgentState/u);
	assert.doesNotMatch(AGENT_LIST_SOURCE, /AgentProfileCard/u);
});
