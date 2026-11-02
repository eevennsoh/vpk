const { readFileSync } = require("node:fs");
const path = require("node:path");

const REGISTRY_SOURCE_FILES = [
	"components/website/registry.ts",
	"components/website/registry/index.ts",
	"components/website/registry/ui.ts",
	"components/website/registry/ui/primary.ts",
	"components/website/registry/ui/variants-actions.ts",
	"components/website/registry/ui/variants-atlassian.ts",
	"components/website/registry/ui/variants-forms.ts",
	"components/website/registry/ui/variants-foundation.ts",
	"components/website/registry/ui/variants-menus.ts",
	"components/website/registry/ui/variants-navigation.ts",
	"components/website/registry/ui/variants-overlays.ts",
	"components/website/registry/ui/variants-progress.ts",
	"components/website/registry/ui-charts.ts",
	"components/website/registry/ui-custom.ts",
	"components/website/registry/ui-custom/primary.ts",
	"components/website/registry/ui-custom/variants-agent.ts",
	"components/website/registry/ui-custom/variants-code.ts",
	"components/website/registry/ui-custom/variants-foundation.ts",
	"components/website/registry/ui-custom/variants-media.ts",
	"components/website/registry/ui-custom/variants-runtime.ts",
	"components/website/registry/blocks.ts",
	"components/website/registry/blocks-variants.ts",
	"components/website/registry/blocks-variants-catalog.ts",
	"components/website/registry/projects.ts",
	"components/website/registry/arts.ts",
	"components/website/registry/charts.ts",
	"components/website/registry/utility.ts",
	"components/website/registry/visual.ts",
];

function readWebsiteRegistrySource(root = process.cwd()) {
	return REGISTRY_SOURCE_FILES
		.map((filePath) => readFileSync(path.join(root, filePath), "utf8"))
		.join("\n")
		.replaceAll("../../demos/", "./demos/")
		.replaceAll("../demos/", "./demos/");
}

module.exports = {
	readWebsiteRegistrySource,
};
