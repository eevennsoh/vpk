// Behavioral contract for UIGeneration, rendered for real in happy-dom: what a
// keyboard user can reach while the UI is still being "generated", and that a
// build never leaves the real UI hidden once it is cancelled or skipped.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const SOURCE = `
import { UIGeneration } from "@/components/visual/ui-generation";

export default function Harness({ onComplete, playKey }) {
	return (
		<UIGeneration playKey={playKey} onComplete={onComplete}>
			<div>
				<p>Nova</p>
				<button type="button">Follow</button>
			</div>
		</UIGeneration>
	);
}
`;

function motionMock(reduce) {
	return { "motion/react": `export const useReducedMotion = () => ${reduce};` };
}

async function renderHarness({ reduce }) {
	const completions = [];
	const props = { onComplete: () => completions.push("done"), playKey: 0 };
	const view = await renderComponent({ source: SOURCE, mocks: motionMock(reduce), props });
	return { completions, props, view };
}

test("the UI being generated is hidden and unreachable by Tab until its reveal", async () => {
	const { completions, view } = await renderHarness({ reduce: false });
	const content = view.getByText("Nova").parentElement.parentElement;

	assert.equal(content.style.opacity, "0");
	assert.deepEqual(view.tabOrder(), []);
	assert.deepEqual(completions, []);
	// The drawing is decoration only: assistive tech reads the real UI.
	assert.equal(content.nextElementSibling.getAttribute("aria-hidden"), "true");
});

test("cancelling a build mid-flight restores the real UI as it was", async () => {
	const { props, view } = await renderHarness({ reduce: false });
	const content = view.getByText("Nova").parentElement.parentElement;

	// A new playKey cancels the running build before starting the next one.
	await view.rerender({ ...props, playKey: 1 });
	assert.equal(content.style.opacity, "0", "the replay hides the UI again");
	await view.unmount();
	assert.equal(content.style.opacity, "");
	assert.equal(content.inert, false);
});

test("reduced motion skips the drawing: the UI is reachable at once and completion fires", async () => {
	const { completions, view } = await renderHarness({ reduce: true });

	assert.deepEqual(view.tabOrder(), ["Follow"]);
	assert.equal(view.getByText("Nova").parentElement.parentElement.style.opacity, "");
	assert.deepEqual(completions, ["done"]);
});
