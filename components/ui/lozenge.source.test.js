const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const LOZENGE_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components", "ui", "lozenge.tsx"),
	"utf8",
);
const LOZENGE_DEMO_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components", "website", "demos", "ui", "lozenge-demo.tsx"),
	"utf8",
);

test("Lozenge visual uplift uses subtle decorative border tokens", () => {
	assert.match(LOZENGE_SOURCE, /success: "border-border-success-subtle bg-bg-success-subtler/u);
	assert.match(LOZENGE_SOURCE, /danger: "border-border-danger-subtle bg-bg-danger-subtler/u);
	assert.match(LOZENGE_SOURCE, /information: "border-border-information-subtle bg-bg-information-subtler/u);
	assert.match(LOZENGE_SOURCE, /"accent-blue":\s*"border-border-accent-blue-subtle bg-bg-accent-blue-subtler/u);
	assert.match(LOZENGE_SOURCE, /"accent-gray":\s*"border-border bg-bg-accent-gray-subtlest/u);
	assert.doesNotMatch(LOZENGE_SOURCE, /border-border-success bg-bg-success-subtler/u);
	assert.doesNotMatch(LOZENGE_SOURCE, /border-border-accent-blue bg-bg-accent-blue-subtler/u);
});

test("Lozenge trailing metrics render via Badge bold semantic mapping", () => {
	assert.match(LOZENGE_SOURCE, /import \{ Badge, type BadgeProps \} from "@\/components\/ui\/badge"/u);
	assert.match(LOZENGE_SOURCE, /success: "successBold"/u);
	assert.match(LOZENGE_SOURCE, /danger: "dangerBold"/u);
	assert.match(LOZENGE_SOURCE, /information: "informationBold"/u);
	assert.match(LOZENGE_SOURCE, /discovery: "discoveryBold"/u);
	assert.match(LOZENGE_SOURCE, /warning: "warningBold"/u);
	assert.match(LOZENGE_SOURCE, /trailingMetric\?: string \| number/u);
	assert.match(LOZENGE_SOURCE, /const resolvedMetric = metric \?\? trailingMetric/u);
	assert.match(LOZENGE_SOURCE, /size === "compact" \? "gap-1" : "gap-1\.5"/u);
	assert.match(LOZENGE_SOURCE, /resolvedMetric != null && \(resolvedSize === "compact" \? "pr-px" : "pr-1"\)/u);
	assert.match(LOZENGE_SOURCE, /<Badge[\s\S]*variant=\{lozengeMetricBadgeVariants\[variant\]\}/u);
	assert.match(LOZENGE_SOURCE, /<Badge[\s\S]*variant=\{lozengeMetricBadgeVariants\[variant\]\}[\s\S]*max=\{false\}[\s\S]*\{metric\}/u);
	assert.doesNotMatch(LOZENGE_DEMO_SOURCE, /import \{ Badge \} from "@\/components\/ui\/badge"/u);
	assert.match(LOZENGE_DEMO_SOURCE, /<Lozenge variant="danger"[\s\S]*trailingMetric="0\.3"/u);
});
