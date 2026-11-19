// ShimmerWave renders its `as` element directly. Parity check: the element, its classes and its
// text stay the same, and a re-render keeps the same element instead of remounting it.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const renderWave = (props) => renderComponent({
	entry: "components/ui-custom/shimmer-wave.tsx",
	exportName: "ShimmerWave",
	props,
});

test("ShimmerWave with a non-default `as` renders that element and keeps it across re-renders", async () => {
	const view = await renderWave({ as: "span", children: "Arranging", className: "text-sm" });
	const element = view.container.firstElementChild;
	assert.equal(element.tagName, "SPAN");
	assert.equal(element.classList.contains("text-sm"), true);
	assert.equal(element.classList.contains("[perspective:500px]"), true);
	assert.equal(element.style.getPropertyValue("--base-color"), "var(--color-muted-foreground)");
	assert.equal(element.querySelectorAll("[aria-hidden=\"true\"]").length, "Arranging".length);

	await view.rerender({ as: "span", children: "Arranged", className: "text-xs" });
	assert.equal(view.container.firstElementChild === element, true, "the element is not remounted");
	assert.equal(element.classList.contains("text-xs"), true);
	assert.equal(element.querySelectorAll("[aria-hidden=\"true\"]").length, "Arranged".length);
});

test("ShimmerWave with empty text renders the plain `as` element", async () => {
	const view = await renderWave({ as: "h2", children: "" });
	const element = view.container.firstElementChild;
	assert.equal(element.tagName, "H2");
	assert.equal(element.className, "relative inline-block [color:var(--color-muted-foreground)]");
	assert.equal(element.textContent, "");
});
