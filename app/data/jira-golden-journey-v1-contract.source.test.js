const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

function readProjectFile(relativePath) {
	return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("Jira Golden Journey v1 resolves one public slug across catalogs, detail metadata, and its demo route", () => {
	const components = readProjectFile("app/data/component-manifest.ts");
	const manifest = readProjectFile("app/data/component-manifest.ts");
	const details = readProjectFile("app/data/details/projects.ts");
	const route = readProjectFile("app/jira-golden-journey-v1/page.tsx");
	const demos = readProjectFile("components/website/registry/projects.ts");
	const demo = readProjectFile("components/website/demos/projects/jira-golden-journey-v1-demo.tsx");

	for (const source of [components, manifest]) {
		assert.match(
			source,
			/projectComponent\("jira-golden-journey-v1", "Jira Golden Journey v1"\)/u,
		);
		assert.doesNotMatch(source, /projectComponent\("jira-golden-paths"/u);
	}

	assert.match(details, /"jira-golden-journey-v1": \{[\s\S]*import JiraGoldenJourneyV1Page from "@\/components\/projects\/jira-golden-journey-v1"/u);
	assert.match(route, /loadDemoComponent\("jira-golden-journey-v1", "projects"\)/u);
	assert.match(
		demos,
		/"jira-golden-journey-v1": dynamic\([\s\S]*jira-golden-journey-v1-demo/u,
	);
	assert.match(
		demo,
		/import JiraGoldenJourneyV1Page from "@\/components\/projects\/jira-golden-journey-v1\/page"/u,
	);
});
