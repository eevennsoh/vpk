// Behavioral contract for the inline agent selector's pending recommendation: the recommended slot holds a
// "Recommending agent" placeholder (and keeps the agent out of the other sections) until the recommendation lands.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const source = (pending, extra = "") => `import React from "react";
	import { ThemeWrapper } from "@/components/utils/theme-wrapper";
	import { InlineAgentSelector } from "@/components/blocks/agent-selector";
	const AGENTS = [
		{ id: "claude-code", name: "Claude", byline: "Anthropic" },
		{ id: "cursor", name: "Cursor", byline: "Anysphere" },
	];
	export default function Test() {
		return <ThemeWrapper><InlineAgentSelector agents={AGENTS} softwareAgentIds={["claude-code", "cursor"]} getActions={() => []} recommendedAgentId="claude-code" recommendationPending={${pending}} ${extra} /></ThemeWrapper>;
	}`;

test("a pending recommendation holds its slot with Recommending agent instead of listing the agent", async () => {
	const view = await renderComponent({ source: source(true) });
	assert.equal(view.queryByText("Recommending agent") !== null, true, "the slot says the recommendation is being worked out");
	assert.equal(document.body.textContent.includes("(Recommended)"), false, "no agent is called recommended yet");
	assert.equal(document.querySelector('button[data-agent-id="claude-code"]') === null, true, "the pending agent does not appear in another section");
	await view.unmount();
});

test("a settled recommendation shows the agent in its slot", async () => {
	const view = await renderComponent({ source: source(false) });
	assert.equal(view.queryByText("Recommending agent") === null, true);
	assert.equal(document.querySelector("button[data-agent-id]")?.dataset.agentId, "claude-code", "the recommended agent leads the list");
	assert.equal(document.body.textContent.includes("(Recommended)"), true);
	await view.unmount();
});

test("a pending recommendation that is the last used agent keeps that agent's row, marked Last used", async () => {
	const view = await renderComponent({ source: source(true, 'recentAgentId="claude-code"') });
	assert.equal(document.querySelector("button[data-agent-id]")?.dataset.agentId, "claude-code", "the last used agent leads the list");
	assert.equal(document.body.textContent.includes("(Last used)"), true);
	assert.equal(view.queryByText("Recommending agent") !== null, true, "the recommendation is still being worked out beneath it");
	assert.equal(document.querySelectorAll('button[data-agent-id="claude-code"]').length, 1, "the agent is listed once");
	await view.unmount();
});
