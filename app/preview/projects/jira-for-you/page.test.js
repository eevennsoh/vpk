const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const SOURCE = readFileSync(path.join(__dirname, "page.tsx"), "utf8");

test("Jira For You preview route defaults to the Project Butter variant", () => {
	assert.match(SOURCE, /import \{ JiraForYouProjectButter \} from "@\/components\/projects\/jira-for-you";/u);
	assert.match(SOURCE, /<JiraForYouProjectButter \/>/u);
});
