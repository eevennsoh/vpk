// Inline mention chips render 1P logos through the shared AtlassianLogoMark chip frame
// (80568dd12): backgroundless marks (the Atlassian master logo and the Rovo family) inset to a
// centered 12px glyph, while solid product logos fill the 16px box bare. The `menu` size keeps
// its own tile treatment and is not covered here.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const INSET_CLAMP_CLASS = "[&_span]:size-3!";
const THEME_MOCK = `export function useTheme() { return { colorMode: "light", theme: "light", isDark: false }; }`;

async function renderInlineLogo(logoName, size = "tag") {
	const view = await renderComponent({
		entry: "components/ui-custom/rich-text-editor/mention-visual.tsx",
		exportName: "RichTextMentionVisualMark",
		mocks: { "@/components/utils/theme-wrapper": THEME_MOCK },
		props: { label: logoName, size, visual: { kind: "logo", logoName } },
	});
	const chip = view.container.firstElementChild;
	return {
		className: chip?.getAttribute("class") ?? "",
		hasGlyph: Boolean(chip?.querySelector("svg")),
		html: view.container.innerHTML,
	};
}

test("inline logo chips inset backgroundless marks to the 12px glyph", async () => {
	for (const logoName of ["atlassian", "rovo", "rovo-dev", "rovo-dev-agent"]) {
		const chip = await renderInlineLogo(logoName);
		assert.equal(chip.className.includes("size-4"), true, `${logoName} renders in the 16px chip box`);
		assert.equal(chip.className.includes(INSET_CLAMP_CLASS), true, `${logoName} is inset to 12px`);
		assert.equal(chip.hasGlyph, true, `${logoName} renders its glyph`);
	}
});

test("inline logo chips render solid-background product logos bare so they fill the slot", async () => {
	for (const size of ["tag", "pill"]) {
		for (const logoName of ["jira", "confluence"]) {
			const chip = await renderInlineLogo(logoName, size);
			assert.equal(chip.className.includes("size-4"), true, `${logoName} ${size} renders in the 16px chip box`);
			assert.equal(chip.className.includes(INSET_CLAMP_CLASS), false, `${logoName} ${size} is not inset`);
			assert.equal(chip.hasGlyph, true, `${logoName} ${size} renders its glyph`);
		}
	}
});

test("inline logo chips no longer render a bordered/rounded bare-span container", async () => {
	for (const logoName of ["atlassian", "jira"]) {
		const chip = await renderInlineLogo(logoName);
		assert.equal(chip.html.includes("overflow-hidden rounded-xs"), false, `${logoName} has no legacy bordered span`);
	}
});
