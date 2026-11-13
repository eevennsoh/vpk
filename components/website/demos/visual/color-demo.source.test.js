const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "../../../..");
const DEMO_SOURCE = fs.readFileSync(path.join(__dirname, "color-demo.tsx"), "utf8");
const THEME_SOURCE = fs.readFileSync(path.join(ROOT, "app/shadcn-theme.css"), "utf8");

const SEMANTIC_STATUSES = [
	"danger",
	"warning",
	"success",
	"discovery",
	"information",
];
const ACCENT_COLORS = [
	"red",
	"orange",
	"yellow",
	"lime",
	"green",
	"teal",
	"blue",
	"purple",
	"magenta",
	"gray",
];

test("Color demo exposes ADS semantic subtle background tokens", () => {
	for (const status of SEMANTIC_STATUSES) {
		assert.ok(
			THEME_SOURCE.includes(`--color-bg-${status}-subtle: var(--ds-background-${status}-subtle);`),
			`missing CSS alias for color.background.${status}.subtle`,
		);
		assert.ok(
			DEMO_SOURCE.includes(`label="bg-${status}-subtle" className="bg-bg-${status}-subtle"`),
			`missing color demo swatch for color.background.${status}.subtle`,
		);
	}
});

test("Color demo exposes ADS subtle semantic border tokens", () => {
	for (const status of SEMANTIC_STATUSES) {
		assert.ok(
			THEME_SOURCE.includes(`--color-border-${status}-subtle: var(--ds-border-${status}-subtle);`),
			`missing CSS alias for color.border.${status}.subtle`,
		);
		assert.ok(
			DEMO_SOURCE.includes(`label="border-${status}-subtle" className="border-border-${status}-subtle"`),
			`missing color demo swatch for color.border.${status}.subtle`,
		);
	}
});

test("Color demo exposes ADS accent subtle border tokens used by label components", () => {
	for (const color of ACCENT_COLORS) {
		assert.ok(
			THEME_SOURCE.includes(`--color-border-accent-${color}-subtle: var(--ds-border-accent-${color}-subtle);`),
			`missing CSS alias for color.border.accent.${color}.subtle`,
		);
		assert.ok(
			DEMO_SOURCE.includes(`label="border-accent-${color}-subtle" className="border-border-accent-${color}-subtle"`),
			`missing color demo swatch for color.border.accent.${color}.subtle`,
		);
	}
});

test("Color demo exposes ADS accent subtle backgrounds used by swatches and metrics", () => {
	for (const color of ACCENT_COLORS) {
		assert.ok(
			THEME_SOURCE.includes(`--color-bg-accent-${color}-subtle: var(--ds-background-accent-${color}-subtle);`),
			`missing CSS alias for color.background.accent.${color}.subtle`,
		);
		assert.ok(
			DEMO_SOURCE.includes(`label="bg-accent-${color}-subtle" className="bg-bg-accent-${color}-subtle"`),
			`missing color demo swatch for color.background.accent.${color}.subtle`,
		);
		assert.ok(
			THEME_SOURCE.includes(`--color-bg-accent-${color}-subtler: var(--ds-background-accent-${color}-subtler);`),
			`missing CSS alias for color.background.accent.${color}.subtler`,
		);
		assert.ok(
			DEMO_SOURCE.includes(`label="bg-accent-${color}-subtler" className="bg-bg-accent-${color}-subtler"`),
			`missing color demo swatch for color.background.accent.${color}.subtler`,
		);
	}
});
