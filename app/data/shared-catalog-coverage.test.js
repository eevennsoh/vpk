const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

const ROOT = path.join(__dirname, "..", "..");

function readProjectFile(...segments) {
	return readFileSync(path.join(ROOT, ...segments), "utf8");
}

test("retired shared surfaces have explicit visible catalog demos", () => {
	const manifestSource = readProjectFile("app/data/component-manifest.ts");
	const componentSource = readProjectFile("app/data/components.ts");
	const uiDetailsSource = readDetailCategorySource("ui");
	const utilityDetailsSource = readProjectFile("app/data/details/utility.ts");
	const blockDetailsSource = readDetailCategorySource("blocks");
	const registrySource = readWebsiteRegistrySource();

	assert.match(manifestSource, /uiComponent\("heading", "Heading"\)/u);
	assert.match(componentSource, /uiComponent\("heading", "Heading"\)/u);
	assert.match(uiDetailsSource, /heading: \{/u);
	assert.match(registrySource, /heading: dynamic\(\(\) => import\("\.\/demos\/ui\/heading-demo"\)/u);
	assert.match(registrySource, /"heading-demo-scale": dynamic\(/u);
	assert.match(registrySource, /"heading-demo-semantics": dynamic\(/u);
	assert.doesNotMatch(manifestSource, /customComponent\("heading"/u);
	assert.doesNotMatch(componentSource, /customComponent\("heading"/u);

	// radio is folded into radio-group; it must NOT exist as a standalone UI catalog page.
	assert.doesNotMatch(manifestSource, /uiComponent\("radio"\)/u);
	assert.doesNotMatch(componentSource, /uiComponent\("radio"\)/u);
	assert.doesNotMatch(registrySource, /\bradio: dynamic\(/u);
	assert.match(manifestSource, /uiComponent\("radio-group", "Radio Group"\)/u);
	assert.match(componentSource, /uiComponent\("radio-group", "Radio Group"\)/u);
	assert.match(registrySource, /"radio-group": dynamic\(\(\) => import\("\.\/demos\/ui\/radio-group-demo"\)/u);
	assert.equal(existsSync(path.join(ROOT, "components/ui/radio.tsx")), false);
	assert.equal(existsSync(path.join(ROOT, "components/ui/radio-group.tsx")), true);

	// elapsed-time was folded into the progress block docs (agent-progress + task-progress);
	// it must NOT exist as a standalone utility catalog page anymore.
	assert.doesNotMatch(manifestSource, /utilityComponent\("elapsed-time", "Elapsed Time"\)/u);
	assert.doesNotMatch(componentSource, /utilityComponent\("elapsed-time", "Elapsed Time"\)/u);
	assert.doesNotMatch(utilityDetailsSource, /"elapsed-time": \{/u);
	assert.doesNotMatch(registrySource, /demos\/utils\/elapsed-time-demo/u);
	assert.equal(existsSync(path.join(ROOT, "components/website/demos/utils/elapsed-time-demo.tsx")), false);

	// The elapsed-time behavior is now documented as an example inside both progress blocks,
	// rendered through the real component and the shared @/lib/elapsed-time helpers.
	for (const block of ["agent-progress", "task-progress"]) {
		assert.match(blockDetailsSource, new RegExp(`demoSlug: "${block}-demo-elapsed-time"`, "u"));
		assert.match(registrySource, new RegExp(`"${block}-demo-elapsed-time": dynamic\\(`, "u"));
		assert.equal(existsSync(path.join(ROOT, "components/website/demos/blocks", `${block}-demo.tsx`)), true);
	}
	assert.equal(existsSync(path.join(ROOT, "lib/elapsed-time.ts")), true);

	// chat-configuration was re-categorized from utility into blocks; its catalog demo now lives under demos/blocks.
	assert.match(componentSource, /slug: "chat-configuration",[\s\S]*?category: "blocks"/u);
	assert.match(manifestSource, /slug: "chat-configuration",[\s\S]*?category: "blocks"/u);
	assert.match(blockDetailsSource, /"chat-configuration": \{/u);
	assert.match(registrySource, /"chat-configuration": dynamic\(\s*\(\) => import\("\.\/demos\/blocks\/chat-configuration-demo"\)/u);
	assert.equal(existsSync(path.join(ROOT, "components/website/demos/blocks/chat-configuration-demo.tsx")), true);
	assert.doesNotMatch(componentSource, /utilityComponent\("chat-configuration"/u);
	assert.doesNotMatch(manifestSource, /utilityComponent\("chat-configuration"/u);
	assert.doesNotMatch(utilityDetailsSource, /"chat-configuration": \{/u);
	assert.doesNotMatch(registrySource, /demos\/utils\/chat-configuration-demo/u);

	assert.equal(existsSync(path.join(ROOT, "components/website/demos/ui/heading-demo.tsx")), true);
	assert.equal(existsSync(path.join(ROOT, "components/ui/heading.tsx")), true);
	assert.equal(existsSync(path.join(ROOT, "components/ui-custom/heading.tsx")), false);

	// chat-configuration documents the shared CustomizeMenu surface; it must not gain a fake blocks source dir/path.
	assert.doesNotMatch(manifestSource, /importPath: "@\/components\/blocks\/chat-configuration"/u);
	assert.doesNotMatch(registrySource, /demos\/blocks\/shared-ui-demo/u);

	assert.equal(existsSync(path.join(ROOT, "components/blocks/shared")), false);
	assert.equal(existsSync(path.join(ROOT, "components/blocks/chat-configuration")), false);
	assert.equal(existsSync(path.join(ROOT, "components/blocks/shared-ui")), false);
});
