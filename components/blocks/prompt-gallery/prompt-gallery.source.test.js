const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

function readProjectFile(relativePath) {
	return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function getIconPaths(source) {
	return [...source.matchAll(/iconPath: "([^"]+)"/gu)].map((match) => match[1]);
}

const PROMPT_GALLERY_SOURCE = readProjectFile("components/blocks/prompt-gallery/page.tsx");
const PROMPT_GALLERY_DATA_SOURCE = readProjectFile("components/blocks/prompt-gallery/data/example-data.ts");
const CHAT_GALLERY_DATA_SOURCE = readProjectFile("components/blocks/chat-gallery/data/example-data.ts");
const ROVO_COMPOSER_SOURCE = readProjectFile("components/projects/shared/hooks/use-rovo-app-composer-height.ts");

test("Prompt gallery pills do not preview prompts on hover", () => {
	assert.doesNotMatch(PROMPT_GALLERY_SOURCE, /onMouseEnter=\{\(\) => handlePreviewStart\(suggestionPrompt\)\}/u);
	assert.doesNotMatch(PROMPT_GALLERY_SOURCE, /onMouseLeave=\{handlePreviewEnd\}/u);
	assert.match(PROMPT_GALLERY_SOURCE, /<span className="min-w-0 truncate">\{suggestion\.label\}<\/span>/u);
});

test("Rovo composer preview placeholder carries single-line ellipsis classes and yields to typed input", async (t) => {
	assert.match(ROVO_COMPOSER_SOURCE, /previewPromptHeight: baseTextareaHeight/u);
	t.mock.method(globalThis, "fetch", async () => new Response("[]", { headers: { "content-type": "application/json" } }));
	const placeholder = "A long prompt preview that stays on one line";
	const view = await renderComponent({
		entry: "components/projects/shared/components/rovo-app-composer.tsx", exportName: "RovoAppComposer",
		props: { placeholder, previewPrompt: placeholder, composerStatus: "ready", hideSourceAndModelControls: true, onSubmit: async () => {}, onStop: async () => {} },
	});
	const preview = view.container.querySelector('[data-slot="prompt-input-placeholder"] span');
	assert.equal(preview?.textContent, placeholder);
	assert.equal(preview?.classList.contains("whitespace-nowrap"), true);
	assert.equal(preview?.classList.contains("overflow-hidden"), true);
	assert.equal(preview?.classList.contains("text-ellipsis"), true);
	await view.fill(view.getByRole("textbox"), "My own prompt");
	assert.equal(view.container.querySelector('[data-slot="prompt-input-placeholder"]') === null, true);
});

test("Prompt gallery illustration paths resolve to public assets", () => {
	for (const source of [PROMPT_GALLERY_DATA_SOURCE, CHAT_GALLERY_DATA_SOURCE]) {
		assert.doesNotMatch(source, /\/illustration\/rich-icon\/[^"]+\/standard\.png/u);

		for (const iconPath of getIconPaths(source)) {
			assert.equal(path.isAbsolute(iconPath), true, `${iconPath} should be an absolute public path`);
			assert.equal(
				fs.existsSync(path.join(process.cwd(), "public", iconPath.slice(1))),
				true,
				`${iconPath} should exist in public/`,
			);
		}
	}
});
