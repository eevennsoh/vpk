// The Agent Directory dialog as a user meets it on its docs pages and as a host wires it: it opens
// only from a trigger, its one Close control sits in the header beside the title, picking an agent
// closes it, and the New agent action reaches the host.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { accessibleName, renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const PAGE_PROBE = `
import { ThemeWrapper } from "@/components/utils/theme-wrapper";
import { AgentsDirectoryExperimentalPage, AgentsDirectoryStandardV1Page } from "@/components/blocks/agent-directory/page";

export default function Probe({ page }) {
	return <ThemeWrapper>{page === "experimental" ? <AgentsDirectoryExperimentalPage /> : <AgentsDirectoryStandardV1Page />}</ThemeWrapper>;
}
`;

const DIALOG_PROBE = `
import { useState } from "react";
import { ThemeWrapper } from "@/components/utils/theme-wrapper";
import { AgentsDirectoryDialog } from "@/components/blocks/agent-directory";
import { DEMO_AGENT_BROWSER_AGENTS } from "@/app/data/directory/agents";

export default function Probe({ title, variant }) {
	const [open, setOpen] = useState(true);
	const record = (entry) => { (globalThis.__directoryCalls ??= []).push(entry); };
	return (
		<ThemeWrapper>
			<AgentsDirectoryDialog
				agents={DEMO_AGENT_BROWSER_AGENTS}
				onCreateAgent={() => record("create")}
				onOpenChange={(next) => { record("open:" + next); setOpen(next); }}
				onSelectAgent={(agent) => record("select:" + agent.id)}
				open={open}
				title={title}
				variant={variant}
			/>
		</ThemeWrapper>
	);
}
`;

function calls() {
	return globalThis.__directoryCalls ?? [];
}

test.beforeEach(() => {
	globalThis.__directoryCalls = [];
});

function assertHeaderClose(view, title) {
	const dialog = view.getByRole("dialog");
	assert.equal(accessibleName(dialog), title);
	const closeButtons = view.getAllByRole("button", { name: "Close" });
	assert.equal(closeButtons.length, 1, "one Close control, no extra corner close");
	const heading = view.getByRole("heading", { name: title });
	assert.equal(heading.parentElement.contains(closeButtons[0]), true, "Close sits in the title's header row");
	return closeButtons[0];
}

for (const [page, trigger] of [["v1", "Open standard directory v1"], ["experimental", "Open experimental directory"]]) {
	test(`the ${page} docs page opens the directory only from its trigger, and Close dismisses it`, async () => {
		const view = await renderComponent({ props: { page }, source: PAGE_PROBE });
		assert.equal(view.queryByRole("dialog") === null, true, "the directory starts closed");

		await view.click(view.getByRole("button", { name: trigger }));
		const close = assertHeaderClose(view, "Browse agents");

		await view.click(close);
		assert.equal(view.queryByRole("dialog") === null, true);
		await view.unmount();
	});
}

test("picking an agent on the docs page closes the directory", async () => {
	const view = await renderComponent({ props: { page: "v1" }, source: PAGE_PROBE });
	await view.click(view.getByRole("button", { name: "Open standard directory v1" }));
	await view.click(view.getByRole("button", { name: "Select Feedback Analyzer" }));
	assert.equal(view.queryByRole("dialog") === null, true);
	await view.unmount();
});

test("the directory header offers New agent and hands it to the host", async () => {
	const view = await renderComponent({ props: {}, source: DIALOG_PROBE });
	assertHeaderClose(view, "Browse agents");
	await view.click(view.getByRole("button", { name: "New agent" }));
	assert.deepEqual(calls(), ["create"]);

	await view.click(view.getByRole("button", { name: "Select Feedback Analyzer" }));
	assert.deepEqual(calls(), ["create", "select:feedback-analyzer"]);
	await view.unmount();
});

test("a host title replaces the default directory title", async () => {
	const view = await renderComponent({ props: { title: "Pick a teammate" }, source: DIALOG_PROBE });
	assertHeaderClose(view, "Pick a teammate");
	await view.unmount();
});

test("the standard v2 directory keeps its own header Close and reports the close to the host", async () => {
	const view = await renderComponent({ props: { variant: "standard-v2" }, source: DIALOG_PROBE });
	const close = assertHeaderClose(view, "Agents");
	await view.click(close);
	assert.deepEqual(calls(), ["open:false"]);
	assert.equal(view.queryByRole("dialog") === null, true);
	await view.unmount();
});
