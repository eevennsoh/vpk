const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");

const { loadCjsModuleFromText } = require(
	path.join(process.cwd(), "scripts", "lib", "esbuild-cjs-loader.js"),
);

// demo-agent-builder is a pure TS module (no React/DOM); bundle it to CJS so the
// classifier + builders can be exercised under `node --test`.
let modulePromise;
function loadModule() {
	modulePromise ??= esbuild
		.build({
			entryPoints: [
				path.join(process.cwd(), "components/projects/studio/lib/demo-agent-builder.ts"),
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

const CANONICAL =
	"add a trigger to send a slack message about the summary of the OKR every Friday 9am";

test("canonical example → scheduled trigger (NOT slack) with fake instruction + name", async () => {
	const { classifyAgentBuildIntent, buildAgentUpdatePatch } = await loadModule();

	const intent = classifyAgentBuildIntent(CANONICAL);
	assert.ok(intent.isBuildIntent, "should be a build intent");
	assert.ok(intent.kinds.includes("trigger"), "should detect a trigger");
	assert.equal(intent.appNames.length, 0, "slack is the trigger destination, not an app");

	const patch = buildAgentUpdatePatch(CANONICAL, {});
	assert.ok(Array.isArray(patch.automationRules) && patch.automationRules.length === 1);
	const rule = patch.automationRules[0];
	assert.equal(rule.triggers.length, 1, "one nested event trigger");
	const def = rule.triggers[0];
	assert.equal(def.providerId, "scheduled", "cadence must win over the slack destination");
	assert.ok(rule.prompt && rule.prompt.length > 0, "fake instruction present");
	assert.ok(rule.name && rule.name.length > 0, "fake automation name present");
	// Legacy label invariant: triggers/trigger derived + index-aligned with rules.
	assert.equal(patch.triggers.length, patch.automationRules.length);
	assert.equal(patch.trigger, patch.triggers[0]);
});

test("RFP leadership Slack summary prompt adds a scheduled trigger to the open agent", async () => {
	const {
		buildDeterministicTriggerThinkingParts,
		classifyAgentBuildIntent,
		buildAgentUpdatePatch,
		planDeterministicAgentBuild,
	} = await loadModule();
	const prompt = "add a trigger to send weekly RFPs summary to a Slack channel to the leadership team";

	const intent = classifyAgentBuildIntent(prompt);
	assert.ok(intent.isBuildIntent, "should be a build intent");
	assert.deepEqual(intent.kinds, ["trigger"]);
	assert.equal(intent.appNames.length, 0, "Slack is the delivery destination, not a tool/app add");

	const patch = buildAgentUpdatePatch(prompt, {
		automationRules: [
			{
				id: "automation-1",
				name: "Draft RFP response package",
				prompt: "Draft RFPs when Jira tickets enter Drafting.",
				triggers: [
					{ id: "jira-status-changed-1", providerId: "jira", eventId: "status-changed" },
				],
			},
		],
		triggers: ["Draft RFP response package"],
	});
	assert.equal(patch.automationRules.length, 2);
	const addedRule = patch.automationRules[1];
	assert.equal(addedRule.name, "Send Weekly RFPs Summary");
	assert.match(addedRule.prompt, /Slack channel/u);
	assert.equal(addedRule.triggers[0].providerId, "scheduled");
	assert.equal(patch.triggers.length, 2);
	assert.equal(patch.trigger, patch.triggers[0]);

	const outcome = planDeterministicAgentBuild(prompt, {
		automationRules: [],
		triggers: [],
	});
	assert.deepEqual(outcome.triggerAutomationNames, ["Send Weekly RFPs Summary"]);
	const thinkingParts = buildDeterministicTriggerThinkingParts({
		prompt,
		state: "thinking",
		triggerAutomationNames: outcome.triggerAutomationNames,
	});
	assert.ok(thinkingParts.some((part) => part.type === "data-thinking-status" && part.data.label === "Thinking"));
	assert.equal(thinkingParts.some((part) => part.type === "data-thinking-event"), false);
	assert.equal(thinkingParts.some((part) => part.type === "text"), false);
	const pendingParts = buildDeterministicTriggerThinkingParts({
		prompt,
		state: "review",
		triggerAutomationNames: outcome.triggerAutomationNames,
	});
	assert.ok(pendingParts.some((part) => part.type === "data-thinking-status"));
	assert.ok(pendingParts.some((part) => part.type === "data-thinking-event"));
	assert.equal(pendingParts.some((part) => part.type === "text"), false);
	assert.ok(pendingParts.some((part) => part.type === "data-thinking-status" && part.data.label === "Reviewing existing automations"));
	assert.equal(pendingParts.some((part) => part.type === "data-thinking-status" && part.data.label === "Configuring Friday schedule"), false);
	assert.ok(pendingParts.some((part) => part.type === "data-thinking-event" && part.data.toolName === "agent.define_trigger"));
	const saveParts = buildDeterministicTriggerThinkingParts({
		prompt,
		state: "save",
		triggerAutomationNames: outcome.triggerAutomationNames,
	});
	assert.ok(saveParts.some((part) => part.type === "data-thinking-status" && part.data.label === "Configuring Friday schedule"));
	assert.ok(saveParts.some((part) => part.type === "data-thinking-status" && part.data.label === "Setting Slack delivery"));
	assert.ok(saveParts.some((part) => part.type === "data-thinking-status" && part.data.label === "Saving automation trigger"));
	assert.ok(saveParts.some((part) => part.type === "data-thinking-event" && part.data.toolName === "agent.configure_tools"));
	assert.ok(saveParts.some((part) => part.type === "data-thinking-event" && part.data.toolName === "studio.save_profile"));
	const completeParts = buildDeterministicTriggerThinkingParts({
		assistantReply: outcome.assistantReply,
		now: new Date("2026-06-12T00:00:04.200Z"),
		prompt,
		startedAt: new Date("2026-06-12T00:00:00.000Z"),
		state: "complete",
		triggerAutomationNames: outcome.triggerAutomationNames,
	});
	assert.ok(completeParts.some((part) => part.type === "data-turn-complete"));
	assert.ok(completeParts.some((part) => part.type === "text"));
	assert.ok(completeParts.some((part) => part.type === "data-thinking-status" && part.data.output));
	assert.ok(completeParts.some((part) => part.type === "data-thinking-event" && part.data.phase === "result"));
	assert.equal(completeParts[0].data.timestamp, "2026-06-12T00:00:00.000Z");
	const turnCompletePart = completeParts.find((part) => part.type === "data-turn-complete");
	assert.equal(turnCompletePart.data.timestamp, "2026-06-12T00:00:04.200Z");

	const directSchedulePrompt = "Send me a /Slack message every Friday 9am on all RFPs outcome";
	const directScheduleOutcome = planDeterministicAgentBuild(directSchedulePrompt, {
		automationRules: [],
		triggers: [],
	});
	assert.equal(directScheduleOutcome.handled, true);
	// A Friday-9am RFP/Slack request maps to the curated weekly-summary flow
	// (nicer title + "Every Friday, 9am" schedule) instead of the terse generic
	// derivation ("Send Slack Message Friday").
	assert.deepEqual(directScheduleOutcome.triggerAutomationNames, ["Weekly RFP loss review for sales leadership"]);
});

test("tool mention resolves to an APP and populates both facets", async () => {
	const { buildAgentUpdatePatch } = await loadModule();
	const patch = buildAgentUpdatePatch("give it Jira tools", {});
	assert.deepEqual(patch.apps, ["Jira"]);
	assert.ok(patch.tools.includes("Jira"), "tool facet populated from app");
	assert.ok(
		patch.knowledge.some((entry) => /jira/i.test(entry)),
		"knowledge facet populated from app",
	);
});

test("knowledge mention also resolves to an APP", async () => {
	const { classifyAgentBuildIntent, buildAgentUpdatePatch } = await loadModule();
	const intent = classifyAgentBuildIntent("connect Confluence as a knowledge source");
	assert.ok(intent.appNames.includes("Confluence"));
	const patch = buildAgentUpdatePatch("connect Confluence as a knowledge source", {});
	assert.ok(patch.apps.includes("Confluence"));
});

test("skill mention adds a skill", async () => {
	const { buildAgentUpdatePatch } = await loadModule();
	const patch = buildAgentUpdatePatch("add the review pull request skill", {});
	assert.ok(Array.isArray(patch.skills) && patch.skills.length >= 1);
	assert.ok(patch.skills.some((s) => /pull request/i.test(s)));
});

test("subagent mention adds a subagent", async () => {
	const { classifyAgentBuildIntent } = await loadModule();
	const intent = classifyAgentBuildIntent("add a research subagent to help");
	assert.ok(intent.kinds.includes("subagent"));
	assert.ok(intent.subagentNames.length >= 1);
});

test("conversation starter request is detected with a count", async () => {
	const { buildAgentUpdatePatch } = await loadModule();
	const patch = buildAgentUpdatePatch("add 2 conversation starters", {});
	assert.ok(Array.isArray(patch.conversationStarters) && patch.conversationStarters.length >= 2);
});

test("multi-digit starter count clamps to the pool max (#10)", async () => {
	const { classifyAgentBuildIntent, buildAgentUpdatePatch } = await loadModule();
	// "12" must parse as twelve (not fall back to 3) and clamp to the max of 6.
	assert.equal(classifyAgentBuildIntent("add 12 conversation starters").starterCount, 6);
	const patch = buildAgentUpdatePatch("add 12 conversation starters", {});
	assert.ok(Array.isArray(patch.conversationStarters));
	assert.ok(patch.conversationStarters.length <= 6, "clamped to the pool size");
	assert.ok(patch.conversationStarters.length >= 3, "more than the single-digit fallback");
});

test("instruction directive is captured", async () => {
	const { buildAgentUpdatePatch } = await loadModule();
	const patch = buildAgentUpdatePatch("always respond in a concise, friendly tone", {});
	assert.ok(typeof patch.instructions === "string" && patch.instructions.length > 0);
});

test("rename sets the name", async () => {
	const { classifyAgentBuildIntent } = await loadModule();
	const intent = classifyAgentBuildIntent("rename it to OKR Reporter");
	assert.equal(intent.nameHint, "OKR Reporter");
});

test("multi-intent clause → trigger + app", async () => {
	const { classifyAgentBuildIntent } = await loadModule();
	const intent = classifyAgentBuildIntent("add a Jira trigger and connect Confluence");
	assert.ok(intent.kinds.includes("trigger"));
	assert.ok(intent.appNames.includes("Confluence"));
	assert.equal(intent.triggerSpecs[0].providerId, "jira");
});

test("update unions with existing draft — no clobber, no dupes", async () => {
	const { buildAgentUpdatePatch } = await loadModule();
	const current = {
		apps: ["Slack"],
		automationRules: [
			{
				id: "automation-1",
				name: "Hourly digest",
				prompt: "Summarize updates every hour.",
				triggers: [
					{ id: "scheduled-every-hour-1", providerId: "scheduled", eventId: "every-hour" },
				],
			},
		],
		triggers: ["Hourly digest"],
	};
	const patch = buildAgentUpdatePatch("give it Jira tools and add a trigger every weekday morning", current);
	assert.ok(patch.apps.includes("Slack") && patch.apps.includes("Jira"), "existing + new apps");
	assert.ok(patch.automationRules.length === 2, "existing + new automation rule");
	// No duplicate app even if requested again.
	const again = buildAgentUpdatePatch("give it Slack tools", { apps: ["Slack"] });
	assert.deepEqual(again.apps, ["Slack"]);
});

test("trigger ids stay unique after a middle trigger was removed (#4)", async () => {
	const { buildAgentUpdatePatch } = await loadModule();
	// Simulate a draft where the surviving trigger keeps the `-2` suffix (its
	// predecessor `-1` was removed). The naive `length + index + 1` would compute
	// index 2 here and collide; the max-suffix derivation must skip past it.
	const current = {
		automationRules: [
			{
				id: "automation-1",
				name: "Existing schedule",
				prompt: "Existing instructions.",
				triggers: [
					{
						id: "scheduled-custom-schedule-2",
						providerId: "scheduled",
						eventId: "custom-schedule",
						params: {},
					},
				],
			},
		],
	};
	const patch = buildAgentUpdatePatch(
		"add a trigger to summarize updates every Friday 9am",
		current,
	);
	assert.equal(patch.automationRules.length, 2, "existing + new automation rule");
	const ids = patch.automationRules.flatMap((rule) => rule.triggers.map((def) => def.id));
	assert.equal(new Set(ids).size, ids.length, "no duplicate trigger ids");
	assert.ok(ids.includes("scheduled-custom-schedule-2"), "surviving id preserved");
});

test("create returns a believable fresh agent", async () => {
	const { buildAgentCreateResult } = await loadModule();
	const result = buildAgentCreateResult(CANONICAL);
	assert.equal(result.action, "create");
	assert.ok(result.name && result.name.length > 0);
	assert.ok(result.summary && result.summary.length > 0);
	assert.ok(Array.isArray(result.conversationStarters) && result.conversationStarters.length >= 3);
	// The named trigger flows into the create too.
	assert.ok(Array.isArray(result.automationRules) && result.automationRules.length === 1);
	assert.equal(result.automationRules[0].triggers[0].providerId, "scheduled");
});

test("chit-chat is NOT a build intent", async () => {
	const { classifyAgentBuildIntent } = await loadModule();
	assert.equal(classifyAgentBuildIntent("hello there, how are you?").isBuildIntent, false);
	assert.equal(classifyAgentBuildIntent("what can you do?").isBuildIntent, false);
});

test("planDeterministicAgentBuild → update when an agent is open", async () => {
	const { planDeterministicAgentBuild } = await loadModule();
	const outcome = planDeterministicAgentBuild("give it Jira tools", { apps: [] });
	assert.equal(outcome.handled, true);
	assert.equal(outcome.mode, "update");
	assert.ok(outcome.patch && outcome.patch.apps.includes("Jira"));
	assert.ok(outcome.assistantReply && /added/i.test(outcome.assistantReply));
});

test("planDeterministicAgentBuild → falls through when no agent is open", async () => {
	const { planDeterministicAgentBuild } = await loadModule();
	const outcome = planDeterministicAgentBuild(CANONICAL, null);
	assert.equal(outcome.handled, false);
	assert.equal(outcome.mode, "none");
	assert.equal(outcome.patch, undefined);
	assert.equal(outcome.assistantReply, undefined);
});

test("planDeterministicAgentBuild → not handled for chit-chat", async () => {
	const { planDeterministicAgentBuild } = await loadModule();
	const outcome = planDeterministicAgentBuild("thanks, that's great", { apps: [] });
	assert.equal(outcome.handled, false);
	assert.equal(outcome.mode, "none");
});

test("generated scheduled automation carries a description and app-chip tokens", async () => {
	const { buildAgentUpdatePatch } = await loadModule();

	const prompt =
		"every day at 7am give me a readout referencing my /gmail /jira /google calendar";
	const patch = buildAgentUpdatePatch(prompt, {});
	assert.ok(Array.isArray(patch.automationRules) && patch.automationRules.length === 1);
	const rule = patch.automationRules[0];

	// Name + description are both populated (no empty placeholders).
	assert.ok(typeof rule.name === "string" && rule.name.length > 0, "name populated");
	assert.ok(typeof rule.description === "string" && rule.description.length > 0, "description populated");

	// Slash app references in the prompt become @[app:id] chips.
	assert.match(rule.prompt, /@\[app:gmail\]/u);
	assert.match(rule.prompt, /@\[app:jira\]/u);
	assert.match(rule.prompt, /@\[app:google-calendar\]/u);
	assert.doesNotMatch(rule.prompt, /\/gmail|\/jira|\/google calendar/u);

	// The short description stays plain text (no token markup leaking in).
	assert.doesNotMatch(rule.description, /@\[app:/u);
});

test("avatar by option name → sets avatarSrc and the avatar kind", async () => {
	const { classifyAgentBuildIntent, buildAgentUpdatePatch } = await loadModule();
	const intent = classifyAgentBuildIntent("use the auto review avatar");
	assert.ok(intent.isBuildIntent);
	assert.ok(intent.kinds.includes("avatar"));
	assert.ok(intent.avatarSrc && intent.avatarSrc.endsWith("auto-review.svg"), intent.avatarSrc ?? "null");

	const patch = buildAgentUpdatePatch("use the auto review avatar", {});
	assert.equal(patch.avatarSrc, intent.avatarSrc);
});

test("avatar by color family → picks that group's avatar", async () => {
	const { classifyAgentBuildIntent } = await loadModule();
	const intent = classifyAgentBuildIntent("make the avatar blue");
	assert.ok(intent.kinds.includes("avatar"));
	// Blue options come from the blue group.
	assert.ok(
		intent.avatarSrc && intent.avatarSrc.startsWith("/avatar-agent-new/blue/"),
		intent.avatarSrc ?? "null",
	);
});

test("memory on/off phrasing → memoryMode + mode kind", async () => {
	const { classifyAgentBuildIntent, buildAgentUpdatePatch } = await loadModule();

	const on = classifyAgentBuildIntent("turn on memory for this agent");
	assert.ok(on.kinds.includes("mode"));
	assert.equal(on.modeChanges.memoryMode, "on");
	assert.equal(buildAgentUpdatePatch("turn on memory for this agent", {}).memoryMode, "on");

	const off = classifyAgentBuildIntent("disable memory");
	assert.equal(off.modeChanges.memoryMode, "off");
});

test("reasoning model phrasing → reasoningMode", async () => {
	const { classifyAgentBuildIntent } = await loadModule();
	assert.equal(classifyAgentBuildIntent("switch it to use opus").modeChanges.reasoningMode, "opus-4.6");
	assert.equal(classifyAgentBuildIntent("use deep reasoning").modeChanges.reasoningMode, "deep-auto");
	assert.equal(classifyAgentBuildIntent("run it on gemini").modeChanges.reasoningMode, "gemini-flash-3");
});

test("explicit knowledge mode phrasing → knowledgeMode", async () => {
	const { classifyAgentBuildIntent } = await loadModule();
	const intent = classifyAgentBuildIntent("set knowledge mode to none");
	assert.ok(intent.kinds.includes("mode"));
	assert.equal(intent.modeChanges.knowledgeMode, "none");
});

test("plain conversation is still not an avatar/mode build intent", async () => {
	const { classifyAgentBuildIntent } = await loadModule();
	const intent = classifyAgentBuildIntent("hello there, how are you today?");
	assert.equal(intent.isBuildIntent, false);
	assert.equal(intent.avatarSrc, null);
	assert.equal(intent.modeChanges.memoryMode, undefined);
});

test("avatar resolution is scoped to the avatar clause (no cross-clause hijack)", async () => {
	const { classifyAgentBuildIntent } = await loadModule();
	const intent = classifyAgentBuildIntent("add a code reviewer skill and set the avatar to blue");
	assert.ok(intent.kinds.includes("avatar"));
	// "code reviewer" lives in the skill clause; the avatar clause asks for blue.
	assert.ok(
		intent.avatarSrc && intent.avatarSrc.startsWith("/avatar-agent-new/blue/"),
		intent.avatarSrc ?? "null",
	);
	// And the skill is still captured from its own clause.
	assert.ok(intent.kinds.includes("skill"));
});

test("buildAgentEditSummaryPayload summarizes avatar + mode changes as rows", async () => {
	const { classifyAgentBuildIntent, buildAgentEditSummaryPayload } = await loadModule();
	const intent = classifyAgentBuildIntent("make the avatar blue and turn on memory");
	const payload = buildAgentEditSummaryPayload(intent, "RFP Drafter");
	assert.equal(payload.headline, "Updated RFP Drafter");
	assert.equal(payload.agentName, "RFP Drafter");
	const labels = payload.changes.map((c) => c.label);
	assert.ok(labels.includes("Avatar"), labels.join(","));
	assert.ok(labels.includes("Memory"), labels.join(","));
	assert.equal(payload.changes.find((c) => c.label === "Memory").value, "On");
	assert.match(payload.changes.find((c) => c.label === "Avatar").value, /^Blue · /);
});

test("buildAgentEditSummaryWidgetPart emits a collapsed-card widget part, null when empty", async () => {
	const { classifyAgentBuildIntent, buildAgentEditSummaryWidgetPart } = await loadModule();
	const part = buildAgentEditSummaryWidgetPart(classifyAgentBuildIntent("add the Jira skill"), "RFP Drafter");
	assert.equal(part.type, "data-widget-data");
	assert.equal(part.data.type, "agent-edit-summary");
	assert.ok(part.data.payload.changes.length >= 1);
	assert.equal(buildAgentEditSummaryWidgetPart(classifyAgentBuildIntent("hello there"), "RFP Drafter"), null);
});

test("mergeTriggerPhrasesIntoDraft appends to existing automations without clobbering", async () => {
	const { mergeTriggerPhrasesIntoDraft } = await loadModule();
	const existing = {
		automationRules: [
			{
				id: "automation-1",
				name: "Existing rule",
				prompt: "keep me",
				triggers: [{ id: "jira-status-changed-1", providerId: "jira", eventId: "status-changed" }],
			},
		],
	};
	const merged = mergeTriggerPhrasesIntoDraft(existing, ["When a Jira work item is created"]);
	assert.ok(merged, "should merge a resolvable phrase");
	assert.ok(
		merged.automationRules.some((r) => r.name === "Existing rule" && r.prompt === "keep me"),
		"existing custom rule preserved",
	);
	assert.ok(merged.automationRules.length >= 2, "a new rule was appended");
	const ids = merged.automationRules.map((r) => r.id);
	assert.equal(new Set(ids).size, ids.length, "automation rule ids stay unique");
	const triggerIds = merged.automationRules.flatMap((r) => r.triggers.map((t) => t.id));
	assert.equal(new Set(triggerIds).size, triggerIds.length, "trigger ids stay unique");
	// The existing rule keeps its original id; appended rules get fresh ids.
	assert.equal(merged.automationRules[0].id, "automation-1");
	assert.equal(mergeTriggerPhrasesIntoDraft({}, []), null, "no phrases → null");
});
