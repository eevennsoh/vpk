const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const SOURCE = readFileSync(path.join(__dirname, "page.tsx"), "utf8");

test("Jira For You preview route imports the Project Butter variant without the workspace barrel", () => {
	assert.match(SOURCE, /import \{ JiraForYouProjectButter \} from "@\/components\/projects\/jira-for-you\/jira-for-you-project-butter";/u);
	assert.match(SOURCE, /<JiraForYouProjectButter \/>/u);
});
