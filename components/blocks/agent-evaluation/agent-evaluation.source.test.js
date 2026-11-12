const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

const SOURCE = readFileSync(join(__dirname, "components", "agent-evaluation.tsx"), "utf8");
const INDEX_SOURCE = readFileSync(join(__dirname, "index.ts"), "utf8");
const DEMO_SOURCE = readFileSync(
	join(__dirname, "..", "..", "website", "demos", "blocks", "agent-evaluation-demo.tsx"),
	"utf8",
);
const REGISTRY_SOURCE = readWebsiteRegistrySource();
const DETAILS_SOURCE = readDetailCategorySource("blocks");
const COMPONENTS_SOURCE = readFileSync(
	join(__dirname, "..", "..", "..", "app", "data", "components.ts"),
	"utf8",
);
const MANIFEST_SOURCE = readFileSync(
	join(__dirname, "..", "..", "..", "app", "data", "component-manifest.ts"),
	"utf8",
);
const LEGACY_COMPATIBILITY_MODULE = join(__dirname, "..", "..", "ui-custom", "agent-evaluation.tsx");

test("AgentEvaluation screen exposes Datasets and Evaluations tabs", () => {
	assert.match(SOURCE, /export function AgentEvaluation\(/u);
	assert.match(SOURCE, /<TabsTrigger value="datasets">Datasets<\/TabsTrigger>/u);
	assert.match(SOURCE, /<TabsTrigger value="evaluations">Evaluations<\/TabsTrigger>/u);
});

test("AgentEvaluation header matches the production copy", () => {
	assert.match(SOURCE, />Evaluation<\/h1>/u);
	assert.match(
		SOURCE,
		/Create datasets to simulate agent responses and evaluate performance\./u,
	);
	assert.match(SOURCE, /Share feedback/u);
});

test("Datasets tab renders the create action and empty state", () => {
	assert.match(SOURCE, /Create dataset/u);
	assert.match(SOURCE, /Ready to test your agent\?/u);
	assert.match(SOURCE, /CreateDatasetDialog/u);
	assert.match(SOURCE, /Upload prompts as a CSV file/u);
});

test("Evaluations tab renders the next-evaluation config and results table", () => {
	assert.match(SOURCE, /Next evaluation:/u);
	assert.match(SOURCE, /Select agent to evaluate/u);
	assert.match(SOURCE, /Select dataset to use/u);
	assert.match(SOURCE, /Select evaluation type/u);
	assert.match(SOURCE, /Run evaluation/u);
	assert.match(SOURCE, /Completed evaluations/u);
	assert.match(SOURCE, /Run your first evaluation to see results here\./u);
});

test("Run evaluation stays disabled until agent, dataset, and type are chosen", () => {
	assert.match(
		SOURCE,
		/const canRunEvaluation = Boolean\(agentValue && datasetValue && typeValue\);/u,
	);
	assert.match(SOURCE, /disabled=\{!canRunEvaluation\}/u);
});

test("Default evaluation types mirror the production options", () => {
	assert.match(SOURCE, /Response Accuracy/u);
	assert.match(SOURCE, /Resolution Rate/u);
	assert.match(SOURCE, /Manual Testing/u);
});

test("Screen is built from existing design-system primitives", () => {
	assert.match(SOURCE, /from "@\/components\/ui\/tabs"/u);
	assert.match(SOURCE, /from "@\/components\/ui\/select"/u);
	assert.match(SOURCE, /from "@\/components\/ui\/table"/u);
	assert.match(SOURCE, /from "@\/components\/ui\/dialog"/u);
	assert.match(SOURCE, /from "@\/components\/ui\/card"/u);
	assert.match(SOURCE, /from "@\/components\/ui\/button"/u);
});

test("AgentEvaluation demo is exported and registered", () => {
	assert.match(DEMO_SOURCE, /export default function AgentEvaluationDemo/u);
	assert.match(DEMO_SOURCE, /export function AgentEvaluationDemoFilled/u);
	assert.match(
		REGISTRY_SOURCE,
		/"agent-evaluation": dynamic\(\s*\(\) => import\("\.\/demos\/blocks\/agent-evaluation-demo"\)/u,
	);
	assert.match(REGISTRY_SOURCE, /"agent-evaluation-demo-filled": dynamic\(/u);
});

test("AgentEvaluation is catalogued as a block component", () => {
	assert.match(DETAILS_SOURCE, /"agent-evaluation": \{/u);
	assert.match(DETAILS_SOURCE, /import \{ AgentEvaluation \} from "@\/components\/blocks\/agent-evaluation";/u);
	assert.match(COMPONENTS_SOURCE, /blockComponent\("agent-evaluation", "Agent Evaluation"\)/u);
	assert.match(MANIFEST_SOURCE, /blockComponent\("agent-evaluation", "Agent Evaluation"\)/u);
});

test("AgentEvaluation index re-exports the public API", () => {
	assert.match(INDEX_SOURCE, /export \{ AgentEvaluation \}/u);
	assert.match(INDEX_SOURCE, /AgentEvaluationProps/u);
	assert.match(INDEX_SOURCE, /AgentEvaluationAgentOption/u);
	assert.match(INDEX_SOURCE, /AgentEvaluationDatasetOption/u);
	assert.match(INDEX_SOURCE, /AgentEvaluationTypeOption/u);
	assert.match(INDEX_SOURCE, /AgentEvaluationCompletedRow/u);
});

test("AgentEvaluation has no retired ui-custom compatibility entry point", () => {
	assert.equal(existsSync(LEGACY_COMPATIBILITY_MODULE), false);
});
