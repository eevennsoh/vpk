// Behavioral contract for the floating review panel's header check: it gathers the list into an inert stack, the
// footer offers only Cancel while it runs, and cancelling (or finishing) unpacks the list again.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { act } = require("react");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const SOURCE = `import React from "react";
	import { RovoChatProvider } from "@/app/contexts";
	import { ThemeWrapper } from "@/components/utils/theme-wrapper";
	import { JiraFloatingSuggestions } from "@/components/blocks/jira-suggestion";
	import { useSuggestionFeed } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-feed";
	function Floating() {
		const feed = useSuggestionFeed();
		return <JiraFloatingSuggestions feed={feed} workItemKey="PAY-999" />;
	}
	export default function FloatingTest() {
		return <ThemeWrapper><RovoChatProvider><Floating /></RovoChatProvider></ThemeWrapper>;
	}`;

const wait = (ms) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));
const listShown = (view) => view.queryByRole("list", { name: "Suggestions" }) !== null;
/** The check, the reopen and the unpack run on timers that happy-dom stretches; wait for the list rather than guess. */
async function waitForList(view, timeout = 8000) {
	for (let waited = 0; waited < timeout && !listShown(view); waited += 200) await wait(200);
}

async function openPanel(view) {
	await view.click(view.getByRole("button", { name: "Review suggestions" }));
	await wait(1200);
	assert.equal(view.queryByRole("dialog", { name: /Review suggestions for PAY-999/ }) !== null, true, "the panel opens");
}

test("a header check gathers the list into an inert stack with only Cancel, and Cancel unpacks it again", async () => {
	const view = await renderComponent({ source: SOURCE });
	await openPanel(view);
	assert.equal(listShown(view), true, "the open panel lists its suggestions");
	const check = view.getByRole("button", { name: "Check for new suggestions" });

	await view.click(check);
	await wait(100);
	assert.equal(listShown(view), false, "the list folds back into a stack while the check runs");
	assert.equal(document.querySelector("[data-scrollport]").inert, true, "…and the stacked cards are inert");
	assert.equal(view.queryByRole("button", { name: "Accept all" }) === null, true, "the bulk decisions step aside");
	assert.equal(view.queryByRole("button", { name: "Discard all" }) === null, true);
	const cancel = view.getByRole("button", { name: "Cancel" });

	await view.click(cancel);
	await wait(900);
	assert.equal(listShown(view), true, "Cancel unpacks the list again");
	assert.equal(view.queryByRole("button", { name: "Cancel" }) === null, true);
	assert.equal(view.queryByRole("button", { name: "Accept all" }) !== null, true, "…with the decisions back");
	assert.equal(view.isFocused(view.getByRole("button", { name: "Check for new suggestions" })), true, "focus returns to the check action");
	const rows = () => document.querySelectorAll('[role="list"][aria-label="Suggestions"] > *').length;
	const listed = rows();
	await wait(3600);
	assert.equal(rows(), listed, "a cancelled check publishes nothing");
	await view.unmount();
});

test("a header check that finds suggestions unpacks them into the list", async () => {
	const view = await renderComponent({ source: SOURCE });
	await openPanel(view);
	const before = document.querySelectorAll('[role="list"][aria-label="Suggestions"] > *').length;
	await view.click(view.getByRole("button", { name: "Check for new suggestions" }));
	await wait(900);
	const panel = document.querySelector("[role=dialog][aria-labelledby]");
	assert.equal(panel.style.height, "108px", "once gathered, the panel folds to its header and footer while the check runs");
	await waitForList(view);
	assert.equal(listShown(view), true, "the finished check unpacks the stack");
	assert.equal(view.queryByRole("button", { name: "Cancel" }) === null, true);
	const after = document.querySelectorAll('[role="list"][aria-label="Suggestions"] > *').length;
	assert.equal(after > before, true, `the new finds join the list (${before} → ${after})`);
	await view.unmount();
});

test("a running check hides the last check's receipt and spins the check action", async () => {
	const view = await renderComponent({ source: SOURCE });
	await openPanel(view);
	// The first check brings the follow-ups; the second finds nothing and says so in the footer.
	for (let run = 0; run < 2; run += 1) {
		await view.click(view.getByRole("button", { name: "Check for new suggestions" }));
		await wait(400);
		await waitForList(view);
	}
	assert.equal(view.queryByText("No new suggestions") !== null, true, "a quiet check leaves its receipt");
	await view.click(view.getByRole("button", { name: "Check for new suggestions" }));
	await wait(100);
	assert.equal(view.queryByText("No new suggestions") === null, true, "the next check does not repeat the old receipt");
	assert.equal(document.querySelector('[aria-label="Checking for new suggestions"] svg')?.getAttribute("data-state"), "loading", "the check action spins while it runs");
	await wait(3600);
	await view.unmount();
});
