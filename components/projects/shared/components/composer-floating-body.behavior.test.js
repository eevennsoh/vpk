// The Studio composer's "Browse templates or start from scratch" reveal unmounts when the
// prompt loses focus, so pressing either link must not blur the prompt first: each link
// cancels its own mousedown. Both stay ordinary buttons that Enter activates.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

// The composer chrome around the reveal is not what this test is about.
const MOCKS = {
	"@/components/projects/shared/components/floating-composer": `
export function FloatingComposer({ children }) { return <form>{children}</form>; }
`,
	"@/components/projects/shared/components/rovo-composer-send-controls": `
export function RovoComposerActionButton() { return null; }
`,
	"@/components/ui-custom/prompt-input": `
export function PromptInputButton() { return null; }
export function PromptInputTextarea() { return <textarea aria-label="Prompt" />; }
export function usePromptInputController() { return { textInput: { setInput() {} } }; }
`,
	"@/components/visual/svg-tracing": "export default function SvgTracing() { return null; }",
};

async function renderComposer() {
	const calls = [];
	const view = await renderComponent({
		entry: "components/projects/shared/components/composer-floating-body.tsx",
		exportName: "ComposerFloatingBody",
		mocks: MOCKS,
		props: {
			canSubmit: true,
			fillWidth: false,
			onBrowseTemplates: () => calls.push("templates"),
			onPromptSubmit: () => {},
			onStartFromScratch: () => calls.push("scratch"),
			placeholder: "Ask",
			textValue: "A draft keeps the reveal open",
		},
	});
	return { calls, view };
}

for (const [name, action] of [["Browse templates", "templates"], ["start from scratch", "scratch"]]) {
	test(`a mousedown on "${name}" is cancelled so the prompt keeps focus`, async () => {
		const { view } = await renderComposer();
		const link = view.getByRole("button", { name });
		const mousedown = new MouseEvent("mousedown", { bubbles: true, cancelable: true });

		link.dispatchEvent(mousedown);

		assert.equal(mousedown.defaultPrevented, true);
	});

	test(`Enter on "${name}" runs it`, async () => {
		const { calls, view } = await renderComposer();
		const link = view.getByRole("button", { name });

		await view.focus(link);
		await view.press(link, "Enter");

		assert.deepEqual(calls, [action]);
	});
}
