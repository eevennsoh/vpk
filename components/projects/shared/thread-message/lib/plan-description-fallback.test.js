const test = require("node:test");
const assert = require("node:assert/strict");

const {
	buildPlanDescriptionFallback,
} = require("./plan-description-fallback.ts");

function createPlanPayload(tasks) {
	return {
		title: "Sprint board plan",
		description: undefined,
		tasks,
		agents: [],
	};
}

test("buildPlanDescriptionFallback keeps narrative first and reuses existing mermaid", () => {
	const messageText = `# Plan

Implement the sprint board update in four phases.

\`\`\`mermaid
graph TD
  task_1["Plan"]
  task_2["Build"]
  task_1 --> task_2
\`\`\``;

	const description = buildPlanDescriptionFallback({
		messageText,
		planPayload: createPlanPayload([
			{ id: "task-1", label: "Plan", blockedBy: [] },
			{ id: "task-2", label: "Build", blockedBy: [] },
		]),
	});

	assert.match(
		description,
		/^Implement the sprint board update in four phases\./
	);
	assert.match(description, /### Task dependency graph/);
	assert.equal((description.match(/```mermaid/g) || []).length, 1);
	assert.ok(!description.includes("Inferred order"));
});

// 215d5801b stopped deriving a dependency graph from plan tasks: the graph section only
// reuses mermaid the plan message already contains.
test("buildPlanDescriptionFallback adds no task graph when the message has no mermaid", () => {
	const description = buildPlanDescriptionFallback({
		messageText: "# Plan\n\nShip work by dependency order.",
		planPayload: createPlanPayload([
			{ id: "task-1", label: "Design", blockedBy: [] },
			{ id: "task-2", label: "Build", blockedBy: ["task-1"] },
		]),
	});

	assert.equal(description, "Ship work by dependency order.");
});
