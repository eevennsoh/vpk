// Context as a consumer renders it: an outline trigger button showing the percent used, and a hover
// card whose header reports used / max tokens with a labelled progress bar, plus the AI SDK v7
// usage rows (reasoning and cache read from their token-detail fields) and the tokenlens cost footer.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { accessibleName, renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const PROBE = `
import {
	Context,
	ContextCacheUsage,
	ContextContent,
	ContextContentBody,
	ContextContentFooter,
	ContextContentHeader,
	ContextInputUsage,
	ContextOutputUsage,
	ContextReasoningUsage,
	ContextTrigger,
} from "@/components/ui-custom/context";

const USAGE = {
	inputTokens: 12_450,
	outputTokens: 3_280,
	totalTokens: 21_490,
	inputTokenDetails: { noCacheTokens: 8_250, cacheReadTokens: 4_200, cacheWriteTokens: undefined },
	outputTokenDetails: { textTokens: 1_720, reasoningTokens: 1_560 },
};

export default function Probe({ open = false, usage = USAGE }) {
	return (
		<Context maxTokens={128_000} modelId="openai:gpt-4o" open={open} usage={usage} usedTokens={21_490}>
			<ContextTrigger />
			<ContextContent>
				<ContextContentHeader />
				<ContextContentBody>
					<ContextInputUsage />
					<ContextOutputUsage />
					<ContextReasoningUsage />
					<ContextCacheUsage />
				</ContextContentBody>
				<ContextContentFooter />
			</ContextContent>
		</Context>
	);
}
`;

function cardText() {
	return document.querySelector("[data-slot=hover-card-content]")?.textContent ?? "";
}

function rowLabels() {
	const rows = document.querySelectorAll("[data-slot=hover-card-content] .justify-between > span:first-child");
	return [...rows].map((node) => node.textContent);
}

test("the trigger is an outline button showing the percent of the window used", async () => {
	const view = await renderComponent({ source: PROBE });
	const trigger = view.getByRole("button");
	assert.equal(accessibleName(trigger), "16.8% context");
	assert.equal(trigger.getAttribute("data-variant"), "outline");
	await view.unmount();
});

test("the card header shows used / max tokens and a progress bar labelled Context used", async () => {
	const view = await renderComponent({ props: { open: true }, source: PROBE });
	assert.match(cardText(), /Context21K \/ 128K/u);
	const progress = view.getByRole("progressbar");
	assert.equal(accessibleName(progress), "Context used");
	assert.equal(Number(progress.getAttribute("aria-valuenow")).toFixed(2), ((21_490 / 128_000) * 100).toFixed(2));
	await view.unmount();
});

test("usage rows read AI SDK v7 reasoning and cache token details, and the footer prices the run", async () => {
	const view = await renderComponent({ props: { open: true }, source: PROBE });
	assert.deepEqual(rowLabels(), ["Context", "Input", "Output", "Reasoning", "Cache", "Total cost"]);
	assert.match(cardText(), /Reasoning1\.6K/u);
	assert.match(cardText(), /Cache4\.2K/u);
	assert.match(cardText(), /Total cost\$\d+\.\d{2}/u);
	await view.unmount();
});

test("usage rows with no tokens are hidden", async () => {
	const usage = {
		inputTokens: 900,
		outputTokens: 100,
		totalTokens: 1_000,
		inputTokenDetails: { noCacheTokens: 900, cacheReadTokens: undefined, cacheWriteTokens: undefined },
		outputTokenDetails: { textTokens: 100, reasoningTokens: undefined },
	};
	const view = await renderComponent({ props: { open: true, usage }, source: PROBE });
	assert.deepEqual(rowLabels(), ["Context", "Input", "Output", "Total cost"]);
	await view.unmount();
});
