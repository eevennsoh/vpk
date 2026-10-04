const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("planExecutionActive is declared before both post-tool and strict tool-first routing branches", () => {
	const routingPath = path.join(
		__dirname,
		"chat",
		"rovo-post-stream-routing-orchestrator.js",
	);
	const source = fs.readFileSync(routingPath, "utf8");
	const declaration = "const planExecutionActive = isPlanExecutionPhase(threadId);";
	const declarationIndex = source.indexOf(declaration);
	const strictToolFirstBranchIndex = source.indexOf("isStrictToolFirstTurn &&");
	const postToolBranchIndex = source.lastIndexOf(
		"if (!isStrictToolFirstTurn) {",
		strictToolFirstBranchIndex,
	);

	assert.notEqual(declarationIndex, -1, "Expected planExecutionActive declaration in post-stream routing orchestrator");
	assert.notEqual(postToolBranchIndex, -1, "Expected post-tool routing branch in post-stream routing orchestrator");
	assert.notEqual(strictToolFirstBranchIndex, -1, "Expected strict tool-first branch in post-stream routing orchestrator");
	assert.ok(
		declarationIndex < postToolBranchIndex,
		"planExecutionActive must be declared before post-tool routing uses it",
	);
	assert.ok(
		declarationIndex < strictToolFirstBranchIndex,
		"planExecutionActive must be declared before strict tool-first routing uses it",
	);
});

