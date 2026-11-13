const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

function readBlockFile(relativePath) {
	return fs.readFileSync(path.join(__dirname, relativePath), "utf8");
}

test("Jira Insight exposes a standalone block and split provider/content/scrubber API", () => {
	const indexSource = readBlockFile("index.tsx");

	assert.match(indexSource, /export function JiraInsight/u);
	assert.match(indexSource, /JiraInsightProvider/u);
	assert.match(indexSource, /JiraInsightContent/u);
	assert.match(indexSource, /JiraInsightScrubber/u);
	assert.match(indexSource, /JiraInsightTimelineRail/u);
	assert.match(indexSource, /JiraInsightEditorialPane/u);
	assert.match(indexSource, /JiraInsightCheckpoint/u);
	assert.match(indexSource, /JiraInsightSource/u);
	assert.match(indexSource, /JiraInsightSnapshot/u);
});

test("the decision timeline reuses Jira Activity and synchronizes visible checkpoints", () => {
	const contentSource = readBlockFile("components/jira-insight-content.tsx");

	assert.match(contentSource, /import \{ JiraActivity/u);
	assert.match(contentSource, /composer=\{null\}/u);
	assert.match(contentSource, /hideHeader/u);
	assert.match(contentSource, /sortOrder="descending"/u);
	assert.match(contentSource, /activeEntryId=\{activeCheckpointId/u);
	assert.match(contentSource, /renderEntry=\{/u);
	assert.match(contentSource, /new IntersectionObserver/u);
	assert.match(contentSource, /aria-labelledby=\{summaryHeadingId\}/u);
	assert.match(contentSource, /aria-labelledby=\{decisionsHeadingId\}/u);
});

test("the docked scrubber delegates selection to the horizontal decision rail", () => {
	const scrubberSource = readBlockFile("components/jira-insight-scrubber.tsx");

	assert.match(scrubberSource, /JiraInsightTimelineRail/u);
	assert.match(scrubberSource, /data-jira-insight-scrubber/u);
	assert.match(scrubberSource, /activeCheckpointId=\{activeCheckpointId\}/u);
	assert.match(scrubberSource, /checkpoints=\{checkpoints\}/u);
	assert.match(scrubberSource, /onCheckpointSelect=\{selectCheckpoint\}/u);
});

test("sources use VPK controls and semantic external links", () => {
	const sourcesSource = readBlockFile("components/jira-insight-sources.tsx");

	assert.match(sourcesSource, /import \{ Button \} from "@\/components\/ui\/button"/u);
	assert.match(sourcesSource, /source\.kind === "external-link"/u);
	assert.match(sourcesSource, /nativeButton=\{false\}/u);
	assert.match(sourcesSource, /target="_blank"/u);
	assert.match(sourcesSource, /aria-label=\{source\.label\}/u);
	assert.match(sourcesSource, /onSourceSelect\?\.\(source\)/u);
});

test("Jira Insight timestamps use one explicit timezone across SSR and the browser", () => {
	for (const relativePath of [
		"components/jira-insight-checkpoint.tsx",
		"components/jira-insight-editorial-pane.tsx",
		"components/jira-insight-timeline-rail.tsx",
	]) {
		assert.match(readBlockFile(relativePath), /timeZone: "Australia\/Sydney"/u);
	}
});

test("Jira Insight is registered as a documented block demo", () => {
	const componentsSource = fs.readFileSync(path.join(__dirname, "../../../app/data/components.ts"), "utf8");
	const manifestSource = fs.readFileSync(path.join(__dirname, "../../../app/data/component-manifest.ts"), "utf8");
	const detailsSource = fs.readFileSync(path.join(__dirname, "../../../app/data/details/blocks.ts"), "utf8");
	const registrySource = fs.readFileSync(path.join(__dirname, "../../website/registry/blocks.ts"), "utf8");
	const demoSource = fs.readFileSync(path.join(__dirname, "../../website/demos/blocks/jira-insight-demo.tsx"), "utf8");

	assert.match(componentsSource, /blockComponent\("jira-insight", "Jira Insight"\)/u);
	assert.match(manifestSource, /blockComponent\("jira-insight", "Jira Insight"\)/u);
	assert.match(detailsSource, /JIRA_INSIGHT_DETAIL/u);
	assert.match(detailsSource, /"jira-insight": JIRA_INSIGHT_DETAIL/u);
	assert.match(registrySource, /"jira-insight": dynamic\([\s\S]*jira-insight-demo/u);
	assert.match(demoSource, /JiraInsightPage/u);
});
