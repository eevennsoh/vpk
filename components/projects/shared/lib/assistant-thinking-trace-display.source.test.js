const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

// Display/source-contract checks split from assistant-thinking-trace-state.source.test.js
// so the parent file stays inside the default file-size budget.

test("assistant thinking trace suppresses auto-open for question-card tool states", () => {
	const source = fs.readFileSync(
		path.join(__dirname, "../components/assistant-thinking-trace.tsx"),
		"utf8",
	);

	assert.match(
		source,
		/allowAutoOpen: !data\.hasAwaitingInputToolCalls && !data\.hasAnsweredQuestionToolCalls/u,
	);
});

test("assistant thinking trace adds top spacing when it follows preceding message content", () => {
	const source = fs.readFileSync(
		path.join(__dirname, "../components/assistant-thinking-trace.tsx"),
		"utf8",
	);

	assert.match(
		source,
		/className=\{cn\("mb-0 \[:not\(:first-child\)\]:mt-2", className\)\}/u,
	);
});

test("assistant thinking trace uses a rainbow spinner + shimmer + dots for response generation", () => {
	const source = fs.readFileSync(
		path.join(__dirname, "../components/assistant-thinking-trace.tsx"),
		"utf8",
	);

	assert.match(source, /import \{ Spinner \} from "@\/components\/ui\/spinner";/u);
	assert.match(source, /import \{ AnimatedDot \} from "@\/components\/ui-custom\/animated-dot";/u);
	// The trailing step renders a rainbow spinner icon (no wash), shimmering
	// "Generating a response" text, and animated dots.
	assert.match(source, /iconRender=\{<Spinner variant="rainbow"/u);
	assert.match(source, /iconShimmer=\{false\}/u);
	assert.match(source, /<Shimmer[\s\S]*Generating a response[\s\S]*<\/Shimmer>\s*<AnimatedDot \/>/u);
	// The old pencil icon is gone.
	assert.equal(/StepPencilIcon/u.test(source), false);
});

