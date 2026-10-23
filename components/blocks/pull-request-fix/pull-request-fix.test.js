const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

const DIR = __dirname;
const COMPONENT_SOURCE = fs.readFileSync(
	path.join(DIR, "components", "pull-request-fix.tsx"),
	"utf8",
);
const AGENT_PICKER_SOURCE = fs.readFileSync(
	path.join(DIR, "components", "pull-request-fix-agent-picker.tsx"),
	"utf8",
);
const AGENT_DATA_SOURCE = fs.readFileSync(
	path.join(DIR, "data", "pull-request-fix-agents.ts"),
	"utf8",
);
const TYPES_SOURCE = fs.readFileSync(
	path.join(DIR, "components", "pull-request-fix-types.ts"),
	"utf8",
);
const DATA_SOURCE = fs.readFileSync(
	path.join(DIR, "data", "demo-pull-request-fix.ts"),
	"utf8",
);
const PAGE_SOURCE = fs.readFileSync(path.join(DIR, "page.tsx"), "utf8");
const INDEX_SOURCE = fs.readFileSync(path.join(DIR, "index.ts"), "utf8");
const DEMO_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components", "website", "demos", "blocks", "pull-request-fix-demo.tsx"),
	"utf8",
);
const FLOATING_COMPOSER_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components", "projects", "shared", "components", "floating-composer.tsx"),
	"utf8",
);
const CONTEXT_TITLE_ACTIONS_SOURCE = fs.readFileSync(
	path.join(
		process.cwd(),
		"components",
		"blocks",
		"jira-work-item",
		"experimental-v2",
		"components",
		"context-title-actions.tsx",
	),
	"utf8",
);
const COMPONENTS_SOURCE = fs.readFileSync(path.join(process.cwd(), "app", "data", "components.ts"), "utf8");
const COMPONENT_MANIFEST_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "app", "data", "component-manifest.ts"),
	"utf8",
);
const NAV_ADS_SOURCE = fs.readFileSync(path.join(process.cwd(), "app", "data", "nav-ads.ts"), "utf8");
const BLOCK_DETAILS_SOURCE = readDetailCategorySource("blocks");
const REGISTRY_SOURCE = readWebsiteRegistrySource();

test("PullRequestFix exposes the fix composer props contract", () => {
	assert.match(
		TYPES_SOURCE,
		/export type PullRequestFixAgentId =\s*\|\s*"claude-code"\s*\|\s*"codex"/u,
	);
	assert.doesNotMatch(TYPES_SOURCE, /"claude-cli"/u);
	assert.doesNotMatch(TYPES_SOURCE, /"vs-code"/u);
	assert.match(
		TYPES_SOURCE,
		/export type PullRequestFixVariant = "compact" \| "expanded"/u,
	);
	assert.match(TYPES_SOURCE, /variant\?: PullRequestFixVariant/u);
	assert.match(TYPES_SOURCE, /defaultVariant\?: PullRequestFixVariant/u);
	assert.match(TYPES_SOURCE, /autoFocus\?: boolean/u);
	assert.match(TYPES_SOURCE, /expandOnFocus\?: boolean/u);
	assert.match(TYPES_SOURCE, /checkName\?: string/u);
	assert.match(TYPES_SOURCE, /defaultValue\?: string/u);
	assert.match(TYPES_SOURCE, /value\?: string/u);
	assert.doesNotMatch(TYPES_SOURCE, /reviewedCount/u);
	assert.doesNotMatch(TYPES_SOURCE, /reviewedTotal/u);
	assert.match(TYPES_SOURCE, /commentCount\?: number/u);
	assert.match(TYPES_SOURCE, /submitDisabled\?: boolean/u);
	assert.match(TYPES_SOURCE, /agentId\?: PullRequestFixAgentId/u);
	assert.match(TYPES_SOURCE, /defaultAgentId\?: PullRequestFixAgentId/u);
	assert.match(TYPES_SOURCE, /onAgentChange\?: \(agentId: PullRequestFixAgentId\) => void/u);
	assert.match(
		TYPES_SOURCE,
		/onSubmit\?: \(submission: PullRequestFixSubmission\) => boolean \| void/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/if \(!onSubmit\) return;[\s\S]*const accepted = onSubmit\(\{ body: value\.trim\(\), agentId \}\);[\s\S]*if \(accepted === false\) return;[\s\S]*updateValue\(""\)/u,
	);
	assert.match(
		TYPES_SOURCE,
		/export interface PullRequestFixSubmission \{[\s\S]*body: string;[\s\S]*agentId: PullRequestFixAgentId;/u,
	);
	assert.doesNotMatch(TYPES_SOURCE, /PullRequestFixVerdict/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /verdict/u);
});

test("the fix editor can take focus when a host opens the expanded surface", () => {
	assert.match(COMPONENT_SOURCE, /autoFocus = false/u);
	assert.match(
		COMPONENT_SOURCE,
		/<PromptInputTextarea[\s\S]*autoFocus=\{autoFocus\}/u,
	);
});

test("compact and expanded render one composer subtree so the draft survives the transform", () => {
	// A second <PromptInputTextarea> would mean a second editor instance, and
	// expanding on focus would drop the caret and any open mention menu.
	assert.equal(
		(COMPONENT_SOURCE.match(/<PromptInputTextarea/gu) ?? []).length,
		1,
		"expected exactly one PromptInputTextarea across both presentations",
	);
	assert.equal(
		(COMPONENT_SOURCE.match(/<FloatingComposer/gu) ?? []).length,
		1,
		"expected exactly one FloatingComposer across both presentations",
	);
	// Early-returning a separate expanded tree is the regression this guards.
	assert.doesNotMatch(COMPONENT_SOURCE, /if \(isExpanded\) \{\s*return/u);
});

test("expanded pins the stacked FloatingComposer layout", () => {
	assert.match(
		COMPONENT_SOURCE,
		/layout=\{isExpanded \? "stacked" : "auto"\}/u,
		"expanded must reserve a full-width editor row instead of waiting for the draft to wrap",
	);
	assert.match(FLOATING_COMPOSER_SOURCE, /layout\?: "auto" \| "stacked"/u);
	assert.match(
		FLOATING_COMPOSER_SOURCE,
		/const isExpanded = layout === "stacked" \|\| isMeasuredExpanded/u,
	);
	// The probe cannot change a caller-pinned layout, so it must not run.
	assert.match(
		FLOATING_COMPOSER_SOURCE,
		/if \(layout === "stacked"\) \{\s*return \(\) => undefined;\s*\}/u,
	);
	assert.match(FLOATING_COMPOSER_SOURCE, /\}, \[layout\]\);/u);
	assert.match(FLOATING_COMPOSER_SOURCE, /data-slot="floating-composer-row"/u);
});

test("submit requires a handler and non-empty editor content", () => {
	// Host `submitDisabled` is only a hard block — chapter progress must not
	// keep Send off while the reviewer types. Without a handler, Send must stay
	// disabled so the optional callback cannot silently discard the draft.
	assert.match(
		COMPONENT_SOURCE,
		/function canSubmitFix\(body: string\): boolean \{\s*return body\.trim\(\)\.length > 0;\s*\}/u,
	);
	assert.match(COMPONENT_SOURCE, /submitDisabled = false/u);
	assert.match(
		COMPONENT_SOURCE,
		/const canSubmit = Boolean\(onSubmit\) && !submitDisabled && canSubmitFix\(value\);/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/<PromptInputSubmit[\s\S]*className="hover:opacity-90 active:opacity-80"[\s\S]*disabled=\{!canSubmit\}/u,
	);
});

test("the agent picker is a simple Select dropdown labeled with the agent name", () => {
	// Not the work-item split control ("Open in Claude" + chevron segment).
	assert.doesNotMatch(
		AGENT_PICKER_SOURCE,
		/from "@\/components\/ui\/button-group"/u,
	);
	assert.doesNotMatch(AGENT_PICKER_SOURCE, /Open in /u);
	assert.match(AGENT_PICKER_SOURCE, /from "@\/components\/ui\/select"/u);
	assert.match(AGENT_PICKER_SOURCE, /<SelectTrigger[\s\S]*aria-label="Coding agent"/u);
	assert.match(AGENT_PICKER_SOURCE, /<SelectValue>\{selectedAgent\.label\}<\/SelectValue>/u);
	assert.match(AGENT_PICKER_SOURCE, /LogoThirdParty/u);
	assert.match(AGENT_PICKER_SOURCE, /RovoColorIcon/u);
	// size-6 logo slot (DropdownMenu elemBefore) with natural small logos in
	// both trigger and menu — no undersized shrink overrides.
	assert.match(AGENT_PICKER_SOURCE, /function AgentLogoSlot/u);
	assert.match(AGENT_PICKER_SOURCE, /size-6/u);
	assert.doesNotMatch(AGENT_PICKER_SOURCE, /xxsmall/u);
	assert.doesNotMatch(AGENT_PICKER_SOURCE, /data-agent-logo/u);
	assert.doesNotMatch(AGENT_PICKER_SOURCE, /size-3!/u);
	assert.doesNotMatch(AGENT_PICKER_SOURCE, /size-4!/u);
	assert.match(CONTEXT_TITLE_ACTIONS_SOURCE, /"claude-code"/u);
	assert.match(AGENT_DATA_SOURCE, /id: "claude-code"/u);
	assert.match(AGENT_DATA_SOURCE, /id: "rovo-cli"/u);
	assert.match(
		AGENT_DATA_SOURCE,
		/DEFAULT_PULL_REQUEST_FIX_AGENT_ID: PullRequestFixAgentId =\s*"codex"/u,
	);
	for (const label of ["Claude", "Codex", "Cursor", "Gemini", "GitHub Copilot", "Rovo"]) {
		assert.ok(
			AGENT_DATA_SOURCE.includes(`label: "${label}"`),
			`missing agent "${label}"`,
		);
	}
	assert.doesNotMatch(AGENT_DATA_SOURCE, /Claude CLI/u);
	assert.doesNotMatch(AGENT_DATA_SOURCE, /VS Code/u);
	assert.doesNotMatch(AGENT_DATA_SOURCE, /label: "Rovo CLI"/u);
	assert.doesNotMatch(AGENT_PICKER_SOURCE, /"claude-cli"/u);
	assert.doesNotMatch(AGENT_PICKER_SOURCE, /"vs-code"/u);
	// Verdict radiogroup must not return.
	assert.doesNotMatch(AGENT_PICKER_SOURCE, /role="radiogroup"/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /"Approve"|"Request changes"|Fix verdict/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /PullRequestFixVerdictControl/u);
	assert.equal(
		fs.existsSync(path.join(DIR, "components", "pull-request-fix-verdict.tsx")),
		false,
		"verdict control file should be removed",
	);
	assert.equal(
		fs.existsSync(path.join(DIR, "data", "pull-request-fix-verdicts.ts")),
		false,
		"verdict data file should be removed",
	);
});

test("the agent picker file exports a component and nothing else", () => {
	// Mixing a component and a constant in one module defeats Fast Refresh state
	// preservation (react-doctor/only-export-components), so the option list
	// lives in data/.
	assert.doesNotMatch(
		AGENT_PICKER_SOURCE,
		/export const PULL_REQUEST_FIX_AGENTS/u,
		"move the agent option list to data/, do not re-colocate it",
	);
	assert.equal(
		(AGENT_PICKER_SOURCE.match(/^export /gmu) ?? []).length,
		1,
		"the agent picker module must have exactly one export (the component)",
	);
	assert.match(AGENT_PICKER_SOURCE, /^export function PullRequestFixAgentPicker/mu);
	assert.match(AGENT_DATA_SOURCE, /export const PULL_REQUEST_FIX_AGENTS/u);
	assert.match(
		INDEX_SOURCE,
		/export \{\s*DEFAULT_PULL_REQUEST_FIX_AGENT_ID,\s*PULL_REQUEST_FIX_AGENTS,\s*\} from "@\/components\/blocks\/pull-request-fix\/data\/pull-request-fix-agents"/u,
	);
	assert.match(
		INDEX_SOURCE,
		/export \{ PullRequestFixAgentPicker \} from "@\/components\/blocks\/pull-request-fix\/components\/pull-request-fix-agent-picker"/u,
	);
});

test("the agent picker uses token classes and no raw ADS custom properties", () => {
	assert.doesNotMatch(AGENT_PICKER_SOURCE, /\[var\(--ds-/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /\[var\(--ds-/u);
});

test("the expanded card entrance is reduced-motion safe", () => {
	assert.match(
		COMPONENT_SOURCE,
		/animate-in fade-in-0 duration-medium ease-out motion-reduce:animate-none/u,
	);
});

test("the expanded Fix heading uses the 16px ADS small heading token", () => {
	assert.match(
		COMPONENT_SOURCE,
		/<h2 className="text-text" style=\{\{ font: token\("font\.heading\.small"\) \}\}>/u,
	);
	assert.doesNotMatch(
		COMPONENT_SOURCE,
		/font\.heading\.medium/u,
		"Fix title must stay at heading.small (16px), not heading.medium (20px)",
	);
});

test("the check-name badge only renders when a non-empty check name is supplied", () => {
	assert.match(
		COMPONENT_SOURCE,
		/const trimmedCheckName = checkName\?\.trim\(\) \?\? "";/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/const hasCheckName = trimmedCheckName\.length > 0;/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/hasCheckName \? \(\s*<Badge variant="neutral">\{trimmedCheckName\}<\/Badge>\s*\) : null/u,
	);
	// Ternary, never `&&` — an empty string must not leak into the row.
	assert.doesNotMatch(COMPONENT_SOURCE, /hasCheckName &&/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /Reviewed/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /reviewedCount|reviewedTotal/u);
});

test("the comment badge pluralizes and hides at zero", () => {
	assert.match(
		COMPONENT_SOURCE,
		/const hasCommentCount = commentCount !== undefined && commentCount > 0;/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/`\$\{commentCount\} \$\{commentCount === 1 \? "Comment" : "Comments"\}`/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/hasCommentCount \? \(\s*<Badge variant="neutral">\{commentBadgeLabel\}<\/Badge>\s*\) : null/u,
	);
	assert.doesNotMatch(COMPONENT_SOURCE, /hasCommentCount &&/u);
});

test("focus expansion yields to a controlled variant", () => {
	assert.match(
		COMPONENT_SOURCE,
		/expandOnFocus && controlledVariant === undefined/u,
		"a host owning `variant` must not have it overwritten by composer focus",
	);
	assert.match(COMPONENT_SOURCE, /const variant = controlledVariant \?\? uncontrolledVariant;/u);
	assert.match(COMPONENT_SOURCE, /const value = controlledValue \?\? uncontrolledValue;/u);
	assert.match(COMPONENT_SOURCE, /const agentId = controlledAgentId \?\? uncontrolledAgentId;/u);
});

test("the dismiss control collapses the card and notifies the host", () => {
	assert.match(COMPONENT_SOURCE, /function close\(event: MouseEvent<HTMLButtonElement>\) \{[\s\S]*updateVariant\("compact"\);\s*onClose\?\.\(\);/u);
	assert.match(COMPONENT_SOURCE, /aria-label="Close fix"/u);
	assert.match(COMPONENT_SOURCE, /const editorRef = useRef<HTMLTextAreaElement>\(null\);/u);
	assert.match(
		COMPONENT_SOURCE,
		/function handleEditorFocus\(\) \{[\s\S]*skipNextFocusExpansionRef\.current = false;[\s\S]*return;[\s\S]*updateVariant\("expanded"\);/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/if \(event\.detail !== 0\) return;[\s\S]*window\.requestAnimationFrame\(\(\) => \{[\s\S]*document\.activeElement === document\.body && editorRef\.current[\s\S]*skipNextFocusExpansionRef\.current = true;[\s\S]*editorRef\.current\.focus\(\);/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/<PromptInputTextarea[\s\S]*ref=\{editorRef\}/u,
	);
	assert.match(COMPONENT_SOURCE, /onFocus=\{[\s\S]*\? handleEditorFocus[\s\S]*: undefined/u);
});

test("the agent picker renders only while expanded beside Send", () => {
	assert.match(
		COMPONENT_SOURCE,
		/isExpanded \? \(\s*<PullRequestFixAgentPicker[\s\S]*onValueChange=\{updateAgentId\}[\s\S]*value=\{agentId\}[\s\S]*\/>\s*\) : null/u,
	);
	assert.match(
		COMPONENT_SOURCE,
		/<PromptInputSubmit[\s\S]*disabled=\{!canSubmit\}/u,
	);
	assert.doesNotMatch(COMPONENT_SOURCE, /useEffect/u);
});

test("demo data seeds the failing check name and instruction placeholder", () => {
	assert.match(DATA_SOURCE, /checkName: "Lint and typecheck"/u);
	assert.match(DATA_SOURCE, /placeholder: "write your instruction\.\.\."/u);
	assert.match(
		COMPONENT_SOURCE,
		/placeholder = "write your instruction\.\.\."/u,
	);
	assert.doesNotMatch(DATA_SOURCE, /reviewedCount|reviewedTotal/u);
	assert.doesNotMatch(DATA_SOURCE, /Leave a comment/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /Leave a comment/u);
});

test("the block is registered across every discovery surface", () => {
	assert.match(INDEX_SOURCE, /export \{ PullRequestFix \}/u);
	assert.match(INDEX_SOURCE, /export \{ DEMO_PULL_REQUEST_FIX \}/u);
	assert.match(PAGE_SOURCE, /export default function PullRequestFixPage/u);
	assert.match(DEMO_SOURCE, /import Page from "@\/components\/blocks\/pull-request-fix\/page"/u);
	assert.match(
		COMPONENTS_SOURCE,
		/blockComponent\("pull-request-fix", "Pull Request Fix"\)/u,
	);
	assert.match(
		COMPONENT_MANIFEST_SOURCE,
		/blockComponent\("pull-request-fix", "Pull Request Fix"\)/u,
	);
	assert.match(NAV_ADS_SOURCE, /"pull-request-fix"/u);
	assert.match(BLOCK_DETAILS_SOURCE, /"pull-request-fix": PULL_REQUEST_FIX_DETAIL/u);
	assert.match(REGISTRY_SOURCE, /"pull-request-fix": dynamic\(/u);
});
