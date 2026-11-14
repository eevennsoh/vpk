const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

const DIR = __dirname;

function readProjectFile(relativePath) {
	return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const COMPONENT_SOURCE = fs.readFileSync(path.join(DIR, "components", "twg-agent-card.tsx"), "utf8");
const DATA_SOURCE = fs.readFileSync(path.join(DIR, "data", "demo.ts"), "utf8");
const PAGE_SOURCE = fs.readFileSync(path.join(DIR, "page.tsx"), "utf8");
const INDEX_SOURCE = fs.readFileSync(path.join(DIR, "index.ts"), "utf8");
const KNOWLEDGE_SOURCE = readProjectFile("components/ui-custom/knowledge.tsx");
const TWG_APPSTACK_SOURCE = readProjectFile("components/ui-custom/twg-appstack.tsx");
const AGENT_CARD_INDEX_SOURCE = readProjectFile("components/blocks/agent-card/index.ts");
const TAILWIND_THEME_SOURCE = readProjectFile("app/tailwind-theme.css");
const COMPONENTS_SOURCE = readProjectFile("app/data/component-manifest.ts");
const COMPONENT_MANIFEST_SOURCE = readProjectFile("app/data/component-manifest.ts");
const BLOCK_DETAILS_SOURCE = readDetailCategorySource("blocks");
const REGISTRY_SOURCE = readWebsiteRegistrySource();
const DEMO_SOURCE = readProjectFile("components/website/demos/blocks/twg-agent-card-demo.tsx");
const PREVIEW_SOURCE = readProjectFile("app/preview/blocks/twg-agent-card/page.tsx");

test("TWG Agent Card exposes the public component and type API", () => {
	assert.match(INDEX_SOURCE, /export \{ TWGAgentCard \} from "\.\/components\/twg-agent-card";/u);
	assert.match(INDEX_SOURCE, /TWGAgentCardProps/u);
	assert.match(INDEX_SOURCE, /TWGAgentSuggestion/u);
	assert.match(COMPONENT_SOURCE, /export interface TWGAgentCardProps/u);
	assert.match(COMPONENT_SOURCE, /export interface TWGAgentSuggestion/u);
	assert.match(COMPONENT_SOURCE, /avatarSrc: string;/u);
});

test("TWG Agent Card reuses shared VPK and TWG primitives", () => {
	assert.match(COMPONENT_SOURCE, /import \{ AgentCardShell \} from "@\/components\/blocks\/agent-card";/u);
	assert.match(COMPONENT_SOURCE, /import \{ Avatar, AvatarFallback, AvatarImage \} from "@\/components\/ui\/avatar";/u);
	assert.match(COMPONENT_SOURCE, /import \{ TWGAppstack, type TwgToolSource \} from "@\/components\/ui-custom\/twg-appstack";/u);
	assert.match(COMPONENT_SOURCE, /import \{ TWGLoader \} from "@\/components\/ui-custom\/twg-loader";/u);
	assert.match(COMPONENT_SOURCE, /import PatternTile, \{ type PatternStrokeOptions \} from "@\/components\/website\/demos\/visual\/pattern-tile";/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /TwgToolBannerBackground/u);
	assert.match(AGENT_CARD_INDEX_SOURCE, /export \{ AgentCardShell \} from "\.\/components\/agent-card-parts";/u);
	assert.match(AGENT_CARD_INDEX_SOURCE, /AgentCardShellProps/u);
});

test("TWG Agent Card uses VPK primitive sizing instead of custom primitive overrides", () => {
	assert.doesNotMatch(COMPONENT_SOURCE, /from "next\/image"/u);
	assert.match(COMPONENT_SOURCE, /const DEFAULT_USER_AVATAR_SRC = "\/avatar-user\/venn\/venn\.png";/u);
	assert.match(COMPONENT_SOURCE, /<p aria-hidden="true" style=\{\{ font: token\("font\.heading\.large"\) \}\}>👋<\/p>[\s\S]*<p>[\s\S]*<span>G&apos;day<\/span>[\s\S]*<Avatar aria-hidden size="xs">/u);
	assert.match(COMPONENT_SOURCE, /const DEFAULT_HEADLINE = "based on what we know from Teamwork Graph, these are the agents we suggest for you\.";/u);
	assert.match(COMPONENT_SOURCE, /<div className="grid w-full gap-1 text-text" style=\{\{ font: token\("font\.body"\) \}\}>/u);
	assert.match(COMPONENT_SOURCE, /style=\{\{ font: token\("font\.body"\) \}\}/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /complete your life/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /onboarding experience/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /understand your tools, projects, and team context/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /\[text-wrap:balance\]/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /text-\[20px\]/u);
	assert.match(COMPONENT_SOURCE, /<AvatarImage alt="" src=\{userAvatarSrc\} \/>/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /size-7|height=\{28\}|width=\{28\}/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /className="size-14 rounded-2xl/u);
	assert.match(COMPONENT_SOURCE, /className="bg-surface"[\s\S]*hasBorder[\s\S]*label="Teamwork Graph"[\s\S]*size="large"[\s\S]*variant="transparent"[\s\S]*<TWGLoader label="Teamwork Graph" size="small" \/>/u);
	assert.match(COMPONENT_SOURCE, /<TWGLoader label="Teamwork Graph" size="small" \/>/u);
	assert.match(COMPONENT_SOURCE, /<h3 className="truncate text-text-subtle" style=\{\{ font: token\("font\.heading\.xxsmall"\) \}\}>[\s\S]*Powered by Teamwork Graph[\s\S]*<\/h3>/u);
	assert.match(COMPONENT_SOURCE, /<TWGAppstack[\s\S]*className="mt-1 justify-start"/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /import \{ TeamworkGraphMark \}/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /<TeamworkGraphMark className=/u);
});

test("TWG Agent Card app stack uses product logos only", () => {
	assert.match(DATA_SOURCE, /id: "jira-product-discovery", label: "Jira Product Discovery", provider: "jira-product-discovery"/u);
	assert.doesNotMatch(DATA_SOURCE, /id: "twg", label: "Teamwork Graph", provider: "twg"/u);
	assert.doesNotMatch(TWG_APPSTACK_SOURCE, /import \{ TWGLoader \} from "@\/components\/ui-custom\/twg-loader";/u);
});

test("Teamwork Graph mark is shared with Knowledge", () => {
	const markSource = readProjectFile("components/ui-custom/teamwork-graph-mark.tsx");

	assert.match(markSource, /export function TeamworkGraphMark/u);
	assert.match(markSource, /ROVO_COLOR_SWATCHES/u);
	assert.match(KNOWLEDGE_SOURCE, /import \{ TeamworkGraphMark \} from "@\/components\/ui-custom\/teamwork-graph-mark";/u);
	assert.match(KNOWLEDGE_SOURCE, /<TeamworkGraphMark \/>/u);
	assert.doesNotMatch(KNOWLEDGE_SOURCE, /function TeamworkGraphIcon/u);
});

test("TWG Agent Card keeps the grid-aligned card footprint and simplified background contract", () => {
	assert.match(COMPONENT_SOURCE, /h-\[553px\] w-\[368px\] max-w-\[368px\]/u);
	assert.match(COMPONENT_SOURCE, /rounded-\[24px\]/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /<TWGAgentCardGridStrip \/>/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /data-slot="twg-agent-card-grid-strip"/u);
	assert.match(COMPONENT_SOURCE, /<TWGAppstack[\s\S]*animated=\{false\}/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /fadeDirection="vertical"/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /\/gestural-line\/eyelash-3\.svg/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /bg-orange-300/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /absolute right-\d+ top-\d+ size-[\d.]+ rounded-full/u);
	assert.match(COMPONENT_SOURCE, /suggestedAgents\.length/u);
	assert.match(COMPONENT_SOURCE, /visibleSuggestions = suggestedAgents\.slice\(0, 3\)/u);
});

test("TWG Agent Card removes the top grid strip while keeping the header spacing", () => {
	assert.doesNotMatch(COMPONENT_SOURCE, /function TWGAgentCardGridStrip/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /className="relative z-10 h-6 shrink-0 overflow-hidden border-b border-border bg-surface"/u);
	assert.match(COMPONENT_SOURCE, /const GRID_SCALE = 16;/u);
	assert.match(COMPONENT_SOURCE, /patternType="grid"[\s\S]*scale=\{GRID_SCALE\}[\s\S]*stroke=\{GRID_STRIP_STROKE\}[\s\S]*fill="tile"[\s\S]*opacity=\{1\}[\s\S]*position="top-left"/u);
	assert.match(COMPONENT_SOURCE, /className="relative z-10 flex shrink-0 items-center gap-3 px-4 pt-4"/u);
});

test("TWG Agent Card matches the expanded stats and recommendation layout", () => {
	assert.match(COMPONENT_SOURCE, /function TWGAgentCardStats/u);
	assert.match(COMPONENT_SOURCE, /data-slot="twg-agent-card-stats"/u);
	assert.match(COMPONENT_SOURCE, /className="relative z-10 isolate h-\[208px\] shrink-0 overflow-hidden bg-surface p-4"/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /border-t border-dashed border-border/u);
	assert.match(COMPONENT_SOURCE, /className="pointer-events-none absolute inset-0 overflow-hidden"/u);
	assert.match(COMPONENT_SOURCE, /className="h-\[calc\(100%\+16px\)\] w-\[calc\(100%\+16px\)\] -translate-x-\[0\.5px\] -translate-y-\[0\.5px\]"/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /right-\[15px\] bottom-\[15px\]/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /className="pointer-events-none absolute inset-4 text-border"/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /className="pointer-events-none absolute inset-4 overflow-hidden text-border"/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /className="pointer-events-none absolute inset-0 text-border"/u);
	assert.match(COMPONENT_SOURCE, /data-slot="twg-agent-card-stats"[\s\S]*<PatternTile[\s\S]*patternType="grid"[\s\S]*front=\{token\("color\.border"\)\}[\s\S]*scale=\{GRID_SCALE\}[\s\S]*stroke=\{GRID_STRIP_STROKE\}[\s\S]*fill="tile"[\s\S]*opacity=\{1\}[\s\S]*position="top-left"/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /front="currentColor"/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-px bg-border"/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /className="pointer-events-none absolute inset-y-4 right-4 z-20 w-px bg-border"/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /className="pointer-events-none absolute inset-x-4 bottom-4 z-20 h-px bg-border"/u);
	assert.match(COMPONENT_SOURCE, /className="relative z-10 grid h-full grid-cols-\[minmax\(0,1fr\)_minmax\(0,1fr\)\] gap-4"/u);
	assert.equal((COMPONENT_SOURCE.match(/data-slot="twg-agent-card-stat-tile"/gu) ?? []).length, 3);
	assert.equal((COMPONENT_SOURCE.match(/className="pointer-events-none absolute inset-px bg-surface"/gu) ?? []).length, 3);
	assert.equal((COMPONENT_SOURCE.match(/relative flex flex-col justify-center px-3 py-2/gu) ?? []).length, 2);
	assert.match(COMPONENT_SOURCE, /relative flex min-w-0 flex-col justify-end px-3 pt-2 pb-4/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /m-px flex/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /border border-transparent bg-surface bg-clip-padding/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /rounded-lg border border-border bg-surface/u);
	assert.match(COMPONENT_SOURCE, /className="relative flex min-w-0 flex-col justify-end px-3 pt-2 pb-4"/u);
	assert.match(COMPONENT_SOURCE, /className="grid min-w-0 grid-rows-2 gap-4"/u);
	assert.equal((COMPONENT_SOURCE.match(/className="relative flex flex-col justify-center px-3 py-2"/gu) ?? []).length, 2);
	assert.doesNotMatch(COMPONENT_SOURCE, /Your dream team/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /className="text-xs font-semibold leading-4 text-text-subtlest"/u);
	assert.match(TAILWIND_THEME_SOURCE, /--font-mono: "Atlassian Mono"/u);
	assert.match(COMPONENT_SOURCE, /className="relative z-10 font-mono text-\[148px\]\/\[0\.7\] font-thin tabular-nums text-text"[\s\S]*\{suggestedAgentCount\}[\s\S]*className="relative z-10 mt-4 text-text-subtlest" style=\{\{ font: token\("font\.body\.small"\) \}\}>suggested agents/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /mx-7 mt-7 h-px shrink-0 border-t border-dashed border-border/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /border-l border-border pl-4/u);
	assert.match(COMPONENT_SOURCE, /className="relative z-10 font-mono text-\[28px\]\/\[1\] font-semibold tabular-nums text-text">6<\/p>/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /6hrs/u);
	assert.match(COMPONENT_SOURCE, /className="relative z-10 font-mono text-\[28px\]\/\[1\] font-semibold tabular-nums text-text">\{connectedSourceCount\}/u);
	assert.match(COMPONENT_SOURCE, /className="relative z-10 mt-1 text-text-subtlest" style=\{\{ font: token\("font\.body\.small"\) \}\}>hours saved per week/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /time saved per week/u);
	assert.match(COMPONENT_SOURCE, /className="relative z-10 mt-1 text-text-subtlest" style=\{\{ font: token\("font\.body\.small"\) \}\}>connected apps/u);
	assert.match(COMPONENT_SOURCE, /<TWGAgentCardStats connectedSourceCount=\{sources\.length\} suggestedAgentCount=\{suggestedAgents\.length\} \/>/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /of some other data/u);
	assert.match(COMPONENT_SOURCE, /data-slot="twg-agent-card-suggestions"/u);
	assert.match(COMPONENT_SOURCE, /className="relative z-10 shrink-0 px-4 pt-4 pb-4"/u);
	assert.match(COMPONENT_SOURCE, /className="relative z-10 flex min-h-0 flex-1 flex-col gap-3\.5 px-4 pt-4 pb-4"/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /px-7/u);
	assert.match(COMPONENT_SOURCE, /className="flex min-w-0 items-center gap-2\.5"/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /className="flex min-w-0 items-start gap-2\.5"/u);
	assert.match(COMPONENT_SOURCE, /<Avatar aria-hidden shape="hexagon" size="sm">[\s\S]*<AvatarImage alt="" src=\{suggestion\.avatarSrc\} \/>/u);
	assert.match(COMPONENT_SOURCE, /className="grid min-w-0 gap-0"/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /className="grid min-w-0 gap-0\.5"/u);
	assert.match(COMPONENT_SOURCE, /className="truncate text-text" style=\{\{ font: token\("font\.heading\.xxsmall"\) \}\}/u);
	assert.match(COMPONENT_SOURCE, /className="truncate text-text-subtlest" style=\{\{ font: token\("font\.body\.small"\) \}\}/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /line-clamp-2 text-text-subtlest/u);
	assert.doesNotMatch(COMPONENT_SOURCE, /text-\[15px\]/u);
});

test("TWG Agent Card default data includes Teamwork Graph sources and three suggestions", () => {
	assert.match(DATA_SOURCE, /DEFAULT_TWG_AGENT_CARD_SOURCES/u);
	assert.match(DATA_SOURCE, /id: "jira-product-discovery", label: "Jira Product Discovery", provider: "jira-product-discovery"/u);
	assert.match(DATA_SOURCE, /id: "jira", label: "Jira", provider: "jira"/u);
	assert.match(DATA_SOURCE, /id: "google-drive", label: "Google Drive", provider: "google-drive"/u);
	assert.match(DATA_SOURCE, /DEFAULT_TWG_AGENT_CARD_SUGGESTIONS/u);
	assert.match(DATA_SOURCE, /description: "Handles reminders, forms, and renewals\."/u);
	assert.match(DATA_SOURCE, /description: "Drafts timely follow-ups\."/u);
	assert.match(DATA_SOURCE, /description: "Finds distraction patterns\."/u);
	assert.match(DATA_SOURCE, /avatarSrc: "\/avatar-agent-new\/yellow\/ops-agent\.svg"/u);
	assert.match(DATA_SOURCE, /avatarSrc: "\/avatar-agent-new\/lime\/auto-dev\.svg"/u);
	assert.match(DATA_SOURCE, /avatarSrc: "\/avatar-agent-new\/purple\/product-requirements\.svg"/u);
	assert.equal((DATA_SOURCE.match(/avatarSrc: "\/avatar-agent-new\/(?:yellow|lime|purple)\//gu) ?? []).length, 3);
	assert.equal((DATA_SOURCE.match(/avatarSrc: "\/avatar-agent-new\/blue\//gu) ?? []).length, 0);
	assert.equal((DATA_SOURCE.match(/name: "/gu) ?? []).length, 3);
});

test("TWG Agent Card catalog wiring is present", () => {
	assert.match(COMPONENTS_SOURCE, /blockComponent\("twg-agent-card", "TWG Agent Card"\)/u);
	assert.match(COMPONENT_MANIFEST_SOURCE, /blockComponent\("twg-agent-card", "TWG Agent Card"\)/u);
	assert.match(BLOCK_DETAILS_SOURCE, /"twg-agent-card": \{/u);
	assert.match(BLOCK_DETAILS_SOURCE, /import \{ TWGAgentCard \} from "@\/components\/blocks\/twg-agent-card";/u);
	assert.match(BLOCK_DETAILS_SOURCE, /"twg-agent-card": \{[\s\S]*demoLayout: \{ previewHeight: "default" \}/u);
	assert.match(BLOCK_DETAILS_SOURCE, /avatarSrc: "\/avatar-agent-new\/yellow\/ops-agent\.svg"/u);
	assert.match(REGISTRY_SOURCE, /"twg-agent-card": dynamic\(\(\) => import\("\.\/demos\/blocks\/twg-agent-card-demo"\)/u);
	assert.match(DEMO_SOURCE, /import \{ TWGAgentCard \} from "@\/components\/blocks\/twg-agent-card";/u);
	assert.match(DEMO_SOURCE, /className="flex w-full justify-center p-6"/u);
	assert.match(PREVIEW_SOURCE, /import TWGAgentCardPage from "@\/components\/blocks\/twg-agent-card\/page";/u);
	assert.match(PREVIEW_SOURCE, /title: getPreviewPageTitle\("twg-agent-card", "blocks"\),/u);
	assert.match(PAGE_SOURCE, /<TWGAgentCard onSelect=\{\(\) => \{\}\} \/>/u);
});

test("TWG Agent Card avoids raw ADS CSS variable utilities", () => {
	for (const source of [COMPONENT_SOURCE, PAGE_SOURCE]) {
		assert.doesNotMatch(source, /(?:bg|text)-\[var\(--ds-/u);
	}
});
