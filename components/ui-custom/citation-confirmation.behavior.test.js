// Inline Citation and Confirmation as consumers render them after the shadcn AI Elements
// migration: the citation trigger is a real, focusable button and its source link opens in a new
// tab; Confirmation is an Item whose parts show or hide from the tool approval state.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const CITATION_PROBE = `
import {
	InlineCitationCard,
	InlineCitationCardTrigger,
	InlineCitationSource,
} from "@/components/ui-custom/inline-citation";

export default function Probe() {
	return (
		<div>
			<InlineCitationCard>
				<InlineCitationCardTrigger sources={["https://www.nextjs.org/docs", "https://react.dev"]} />
			</InlineCitationCard>
			<InlineCitationSource title="Suspense" url="https://react.dev/reference/react/Suspense" description="Fallbacks." />
		</div>
	);
}
`;

const CONFIRMATION_PROBE = `
import {
	Confirmation,
	ConfirmationAccepted,
	ConfirmationAction,
	ConfirmationActions,
	ConfirmationRejected,
	ConfirmationRequest,
	ConfirmationTitle,
} from "@/components/ui-custom/confirmation";

export default function Probe({ approval, state }) {
	return (
		<Confirmation approval={approval} state={state}>
			<ConfirmationTitle>
				<ConfirmationRequest>Run rm -rf dist?</ConfirmationRequest>
				<ConfirmationAccepted>Approved</ConfirmationAccepted>
				<ConfirmationRejected>Denied</ConfirmationRejected>
			</ConfirmationTitle>
			<ConfirmationActions>
				<ConfirmationAction variant="outline">Deny</ConfirmationAction>
				<ConfirmationAction>Approve</ConfirmationAction>
			</ConfirmationActions>
		</Confirmation>
	);
}
`;

test("InlineCitationCardTrigger renders a focusable button labelled by hostname and source count", async () => {
	const view = await renderComponent({ source: CITATION_PROBE });
	const trigger = view.getByRole("button", { name: "nextjs.org +1" });
	assert.equal(trigger.tagName, "BUTTON");
	assert.equal(trigger.getAttribute("data-variant"), "secondary");
	await view.unmount();
});

test("InlineCitationSource links to the URL in a new tab and says so to screen readers", async () => {
	const view = await renderComponent({ source: CITATION_PROBE });
	const link = view.getByRole("link", { name: "react.dev (opens in a new tab)" });
	assert.equal(link.getAttribute("href"), "https://react.dev/reference/react/Suspense");
	assert.equal(link.getAttribute("target"), "_blank");
	assert.equal(link.getAttribute("rel"), "noreferrer");
	await view.unmount();
});

test("Confirmation renders an outline sm Item with title and actions while approval is requested", async () => {
	const view = await renderComponent({
		source: CONFIRMATION_PROBE,
		props: { approval: { id: "1" }, state: "approval-requested" },
	});
	const item = view.container.querySelector("[data-slot=item]");
	assert.equal(item?.getAttribute("data-variant"), "outline");
	assert.equal(item?.getAttribute("data-size"), "sm");
	assert.equal(view.container.querySelector("[data-slot=item-title]")?.textContent, "Run rm -rf dist?");
	assert.equal(view.getAllByRole("button").map((button) => button.textContent).join(","), "Deny,Approve");
	await view.unmount();
});

test("Confirmation shows only the matching outcome, without actions, after a response", async () => {
	const accepted = await renderComponent({
		source: CONFIRMATION_PROBE,
		props: { approval: { id: "2", approved: true }, state: "output-available" },
	});
	assert.equal(accepted.container.querySelector("[data-slot=item-title]")?.textContent, "Approved");
	assert.equal(accepted.container.querySelectorAll("button").length, 0);
	await accepted.unmount();

	const rejected = await renderComponent({
		source: CONFIRMATION_PROBE,
		props: { approval: { id: "3", approved: false }, state: "output-denied" },
	});
	assert.equal(rejected.container.querySelector("[data-slot=item-title]")?.textContent, "Denied");
	await rejected.unmount();
});

test("Confirmation renders nothing before the tool input is complete", async () => {
	const view = await renderComponent({
		source: CONFIRMATION_PROBE,
		props: { approval: { id: "4" }, state: "input-available" },
	});
	assert.equal(view.container.querySelector("[data-slot=item]") === null, true);
	await view.unmount();
});
