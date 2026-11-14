// Bundle contract for JiraWorkItem's variant switch: the newest full fork and Team EU26 load on
// demand, so the default and older variants do not ship their trees, while keeping Next's default
// SSR. Rendering cannot see chunk boundaries. A per-route bundle check that the jira-work-item
// docs page does not include the experimental-v5 or team-eu26 modules would replace this file.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const workItemSource = fs.readFileSync(path.join(__dirname, "index.tsx"), "utf8");

test("experimental-v5 and team-eu26 are loaded with next/dynamic, not imported statically", () => {
	assert.match(workItemSource, /import dynamic from "next\/dynamic";/u);
	assert.doesNotMatch(workItemSource, /import \{ ExperimentalV5JiraWorkItem \} from/u);
	assert.doesNotMatch(workItemSource, /import \{ TeamEu26JiraWorkItem \} from/u);
	assert.match(
		workItemSource,
		/const ExperimentalV5JiraWorkItem = dynamic\(\s*\(\) => import\("@\/components\/blocks\/jira-work-item\/experimental-v5\/experimental-v5-jira-work-item"\)/u,
	);
	assert.match(
		workItemSource,
		/const TeamEu26JiraWorkItem = dynamic\(\s*\(\) => import\("@\/components\/blocks\/jira-work-item\/team-eu26\/team-eu26-jira-work-item"\)/u,
	);
});

test("the on-demand variants keep server rendering", () => {
	assert.doesNotMatch(workItemSource, /ExperimentalV5JiraWorkItem = dynamic\([\s\S]*?ssr:\s*false/u);
	assert.doesNotMatch(workItemSource, /TeamEu26JiraWorkItem = dynamic\([\s\S]*?ssr:\s*false/u);
});
