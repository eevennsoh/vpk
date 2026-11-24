const assert = require("node:assert/strict");
const { test } = require("node:test");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

test("a session's Rovo logo reaches the chat header", async () => {
	const view = await renderComponent({
		source: `import React from "react";
			import { RovoAppBrand } from "@/components/projects/rovo-core/components/rovo-app-brand";
			export default function Probe() { return <RovoAppBrand enableAgentSelector={false} />; }`,
		mocks: {
			"@/app/contexts": `import { agentSessionDemoProfiles } from "@/components/projects/shared/lib/agent-session-demo-chat";
				export function useRovoSelectedAgent() {
					const [selectedAgent] = agentSessionDemoProfiles([], [{ agent: { id: "rovo", name: "Rovo", vpkLogo: "rovo" } }]);
					return { selectedAgent, selectedAgentId: selectedAgent.id, selectableAgents: [], isCustomAgentSelected: true, selectAgent() {}, resetAgentToRovo() {} };
				}`,
		},
	});
	assert.equal(view.container.textContent.includes("Rovo"), true);
	assert.equal(Boolean(view.container.querySelector('[data-slot="avatar"] svg')), true);
	await view.unmount();
});
