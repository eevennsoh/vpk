const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

const ROOT = join(__dirname, "..", "..");
const SOURCE = readFileSync(join(__dirname, "breadcrumb.tsx"), "utf8");
const DEMO_SOURCE = readFileSync(
	join(ROOT, "components", "website", "demos", "ui", "breadcrumb-demo.tsx"),
	"utf8",
);
const REGISTRY_SOURCE = readWebsiteRegistrySource();
const DETAILS_SOURCE = readDetailCategorySource("ui");

test("Breadcrumb exposes ADS medium and small sizes through root context", () => {
	assert.match(SOURCE, /type BreadcrumbSize = "medium" \| "small"/);
	assert.match(SOURCE, /interface BreadcrumbProps extends React\.ComponentProps<"nav"> \{\s*size\?: BreadcrumbSize\s*\}/);
	assert.match(SOURCE, /const BreadcrumbSizeContext = React\.createContext<BreadcrumbSize>\("medium"\)/);
	assert.match(SOURCE, /function Breadcrumb\(\{\s*className,\s*size = "medium",/);
	assert.match(SOURCE, /<BreadcrumbSizeContext value=\{size\}>/);
	assert.match(SOURCE, /data-size=\{size\}/);
});

test("Breadcrumb size classes cover text, controls, slots, separators, and ellipsis", () => {
	for (const section of ["list", "control", "label", "slot", "separator", "ellipsis"]) {
		const pattern = new RegExp(`${section}: \\{\\s*medium:[\\s\\S]*?small:`);

		assert.match(SOURCE, pattern, `${section} should define medium and small classes`);
	}

	assert.match(SOURCE, /medium: "text-sm leading-5"/);
	assert.match(SOURCE, /small: "text-xs leading-4"/);
	assert.match(SOURCE, /label: \{\s*medium: "gap-1",\s*small: "gap-1"/);
});

test("Breadcrumb docs register a size example", () => {
	assert.match(DEMO_SOURCE, /export function BreadcrumbDemoSizes\(\)/);
	assert.match(DEMO_SOURCE, /<Breadcrumb size="small">/);
	assert.match(REGISTRY_SOURCE, /"breadcrumb-demo-sizes"/);
	assert.match(DETAILS_SOURCE, /demoSlug: "breadcrumb-demo-sizes"/);
});

test("Breadcrumb dropdown trigger uses the compact icon button size", () => {
	assert.match(DEMO_SOURCE, /<Button size="icon-compact" variant="ghost" \/>/);
	assert.doesNotMatch(DEMO_SOURCE, /<Button size="icon" variant="ghost" \/>/);
});

test("Breadcrumb ellipsis uses a 24px transparent tile with a 12px icon", () => {
	assert.match(SOURCE, /import \{ IconTile \} from "@\/components\/ui\/icon-tile"/);
	assert.match(SOURCE, /ellipsis: \{\s*medium: "size-6",\s*small: "size-6"/);
	assert.match(SOURCE, /<IconTile[\s\S]*as="span"[\s\S]*className="text-icon-subtlest"[\s\S]*iconSize="small"[\s\S]*size="small"[\s\S]*variant="transparent"/);
	assert.match(SOURCE, /<ShowMoreHorizontalIcon label="" size="small" \/>/);
});
