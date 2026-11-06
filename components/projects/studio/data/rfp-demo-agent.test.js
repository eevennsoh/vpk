const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");

const { loadCjsModuleFromText } = require(
	path.join(process.cwd(), "scripts", "lib", "esbuild-cjs-loader.js"),
);

let modulePromise;
function loadModule() {
	modulePromise ??= esbuild
		.build({
			entryPoints: [
				path.join(process.cwd(), "components/projects/studio/data/rfp-demo-agent.ts"),
			],
			bundle: true,
			format: "cjs",
			platform: "node",
			tsconfig: path.join(process.cwd(), "tsconfig.json"),
			loader: { ".css": "empty", ".json": "json" },
			write: false,
		})
		.then((result) => loadCjsModuleFromText(result.outputFiles[0].text));
	return modulePromise;
}

test("Studio RFP demo agent matches the /jira RFP story and starts with the Jira drafting trigger", async () => {
	const {
		STUDIO_RFP_DEMO_AGENT_PROFILE_ID,
		STUDIO_RFP_DEMO_AGENT_RESULT,
		STUDIO_RFP_DEMO_AGENT_SOURCE_KEY,
	} = await loadModule();

	assert.equal(STUDIO_RFP_DEMO_AGENT_PROFILE_ID, "rfp-drafting-agent");
	assert.equal(STUDIO_RFP_DEMO_AGENT_SOURCE_KEY, "studio-rfp-demo-agent:v2");
	assert.equal(STUDIO_RFP_DEMO_AGENT_RESULT.agentId, "rfp-drafting-agent");
	assert.equal(STUDIO_RFP_DEMO_AGENT_RESULT.name, "RFP Drafter");
	assert.equal(STUDIO_RFP_DEMO_AGENT_RESULT.avatarSrc, "/avatar-agent-new/lime/feature-flag.svg");
	assert.match(STUDIO_RFP_DEMO_AGENT_RESULT.summary, /first-pass RFP response packages/u);
	assert.match(STUDIO_RFP_DEMO_AGENT_RESULT.instructions, /## Role/u);
	assert.match(STUDIO_RFP_DEMO_AGENT_RESULT.instructions, /## Mission/u);
	assert.match(STUDIO_RFP_DEMO_AGENT_RESULT.instructions, /## Inputs To Review/u);
	assert.match(STUDIO_RFP_DEMO_AGENT_RESULT.instructions, /## Workflow/u);
	assert.match(STUDIO_RFP_DEMO_AGENT_RESULT.instructions, /## Analysis Checklist/u);
	assert.match(STUDIO_RFP_DEMO_AGENT_RESULT.instructions, /## Response Package Requirements/u);
	assert.match(STUDIO_RFP_DEMO_AGENT_RESULT.instructions, /## Leadership Summary Behavior/u);
	assert.match(STUDIO_RFP_DEMO_AGENT_RESULT.instructions, /Enterprise RFP Response @\[app:jira\] project/u);
	assert.match(STUDIO_RFP_DEMO_AGENT_RESULT.instructions, /- Primary workspace: the Enterprise RFP Response @\[app:jira\] project\./u);
	assert.match(STUDIO_RFP_DEMO_AGENT_RESULT.instructions, /1\. Inspect the @\[app:jira\] work item/u);
	assert.match(STUDIO_RFP_DEMO_AGENT_RESULT.instructions, /Only send the Friday leadership Slack summary when a scheduled Slack trigger exists\./u);
	assert.doesNotMatch(STUDIO_RFP_DEMO_AGENT_RESULT.instructions, /Code Reviewer/u);

	// Apps, skills, and knowledge are referenced inline as `@[category:id]` mention
	// tokens so the instruction body renders the same visual lozenges as the config
	// rows below it, instead of the capabilities only living in a separate section.
	assert.match(STUDIO_RFP_DEMO_AGENT_RESULT.instructions, /@\[app:confluence\]/u);
	assert.match(STUDIO_RFP_DEMO_AGENT_RESULT.instructions, /@\[knowledge:sharepoint:proposal-library\]/u);
	assert.match(STUDIO_RFP_DEMO_AGENT_RESULT.instructions, /@\[skill:build-report\]/u);
	assert.match(STUDIO_RFP_DEMO_AGENT_RESULT.instructions, /@\[skill:audit-trail-reporter\]/u);

	assert.deepEqual(STUDIO_RFP_DEMO_AGENT_RESULT.apps, ["Jira", "Confluence"]);
	assert.deepEqual(STUDIO_RFP_DEMO_AGENT_RESULT.skills, ["Build report", "Audit trail report"]);
	assert.ok(STUDIO_RFP_DEMO_AGENT_RESULT.knowledge.includes("Proposal library"));
	assert.deepEqual(STUDIO_RFP_DEMO_AGENT_RESULT.subagents, []);
	assert.deepEqual(STUDIO_RFP_DEMO_AGENT_RESULT.subagentPrompts, []);
	assert.equal(STUDIO_RFP_DEMO_AGENT_RESULT.conversationStarters.length, 3);

	assert.equal(STUDIO_RFP_DEMO_AGENT_RESULT.automationRules.length, 1);
	const [rule] = STUDIO_RFP_DEMO_AGENT_RESULT.automationRules;
	assert.equal(rule.name, "Draft RFP response package");
	assert.equal(rule.triggers.length, 1);
	assert.equal(rule.triggers[0].providerId, "jira");
	assert.equal(rule.triggers[0].eventId, "status-changed");
	assert.equal(rule.triggers[0].params.project, "enterprise-rfp-response");
	assert.equal(rule.triggers[0].connectionState, "connected");
	assert.equal(STUDIO_RFP_DEMO_AGENT_RESULT.triggers.length, 1);
});
