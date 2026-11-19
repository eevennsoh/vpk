// BrandLogoMark looks a third-party mark up in the static icon table, by `name` or by a `/3p/`
// asset path. Parity check: it renders the upstream package mark (not the local asset), and a
// re-render keeps the same mark element instead of remounting it.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

async function renderMark(props) {
	const view = await renderComponent({ entry: "components/ui/logo-mark.tsx", exportName: "BrandLogoMark", props });
	// The package mark downloads on first render; let the lazy glyph resolve.
	for (let attempt = 0; attempt < 10 && view.container.querySelector("svg") === null; attempt += 1) {
		await view.rerender(props);
	}
	return view;
}

for (const [description, props] of [
	["by name", { label: "Slack", name: "slack", size: "small" }],
	["by /3p/ asset path", { label: "Slack", size: "small", src: "/3p/slack/24.svg" }],
]) {
	test(`BrandLogoMark renders the Slack package mark ${description} and keeps it across re-renders`, async () => {
		const view = await renderMark(props);
		const mark = view.getByRole("img", { name: "Slack" });
		const svg = mark.querySelector("svg");
		assert.equal(svg !== null, true, "the package mark's svg rendered");
		assert.equal(view.container.querySelector("img") === null, true, "no local asset image");
		const pathCount = svg.querySelectorAll("path").length;

		await view.rerender({ ...props, label: "Slack workspace" });
		assert.equal(view.container.querySelector("[role=\"img\"]") === mark, true, "the mark is not remounted");
		assert.equal(mark.getAttribute("aria-label"), "Slack workspace");
		assert.equal(mark.querySelector("svg") === svg, true, "the glyph is not remounted");
		assert.equal(svg.querySelectorAll("path").length, pathCount);
	});
}

test("BrandLogoMark chip frame renders the package glyph for a third-party name", async () => {
	const view = await renderMark({ frame: "chip", label: "GitHub", name: "github" });
	const chip = view.container.firstElementChild;
	assert.equal(chip.getAttribute("aria-hidden"), "true");
	assert.equal(chip.classList.contains("dark:[&_svg]:invert"), true);
	assert.equal(chip.querySelector("svg") !== null, true);
});
