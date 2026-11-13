const assert = require("node:assert/strict");
const { test } = require("node:test");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

test("component import references expose named Bitbucket and GitHub links", async () => {
	const importPath = "@/components/blocks/rovo-button";
	const view = await renderComponent({
		source: `import { DocHero } from "@/components/website/component-doc/components/doc-hero";
import { getDocImportReferences } from "@/components/website/component-doc/components/source-links.server";
export default function Harness() {
	return <DocHero name="Rovo Button" category="blocks" importReferences={getDocImportReferences("${importPath}")} />;
}`,
	});
	for (const provider of ["Bitbucket", "GitHub"]) {
		const link = view.getByRole("link", { name: `${provider} source for ${importPath}` });
		assert.equal(link.textContent, provider);
		assert.equal(link.getAttribute("target"), "_blank");
		assert.equal(link.getAttribute("rel"), "noopener noreferrer");
		assert.equal(view.tabOrder().includes(`${provider} source for ${importPath}`), true);
	}
	assert.equal(view.container.textContent.includes(importPath), true);
});
