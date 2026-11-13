const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const LOGO_MARK_SOURCE = fs.readFileSync(path.join(__dirname, "logo-mark.tsx"), "utf8");
const LOGO_DEMO_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components", "website", "demos", "ui", "logo-demo.tsx"),
	"utf8",
);

test("Atlassian company logo uses the shared bordered Tile treatment", () => {
	assert.match(LOGO_MARK_SOURCE, /export function AtlassianLogoMark/u);
	assert.match(LOGO_MARK_SOURCE, /export function AtlassianLogoGlyph/u);
	assert.match(LOGO_MARK_SOURCE, /className=\{cn\([\s\S]*\[&>span\]:!size-full \[&_svg\]:!size-full/u);
	assert.match(LOGO_MARK_SOURCE, /<AtlassianLogo label="" name=\{name\} size=\{size\} themeAware \/>/u);
	assert.match(LOGO_MARK_SOURCE, /const hasBorder = resolveAtlassianLogoBorder\(name\);/u);
	assert.match(LOGO_MARK_SOURCE, /<Tile[\s\S]*hasBorder[\s\S]*size=\{size\}[\s\S]*variant="transparent"[\s\S]*<AtlassianLogo label="" name=\{name\} size=\{size\} themeAware \/>/u);
	assert.match(LOGO_MARK_SOURCE, /const logo = \(\s*<AtlassianLogo[\s\S]*name=\{name\}[\s\S]*size=\{size\}[\s\S]*themeAware[\s\S]*\/>\s*\);/u);
	assert.match(LOGO_MARK_SOURCE, /return className \? <span className=\{cn\("inline-flex", className\)\}>\{logo\}<\/span> : logo;/u);
	assert.match(LOGO_DEMO_SOURCE, /import \{ AtlassianLogoMark, BrandLogoMark \} from "@\/components\/ui\/logo-mark";/u);
	assert.match(LOGO_DEMO_SOURCE, /<AtlassianLogoMark[\s\S]*label=\{`Atlassian \$\{size\}`\}[\s\S]*name="atlassian"[\s\S]*size=\{size\}[\s\S]*\/>/u);
	assert.match(LOGO_DEMO_SOURCE, /Atlassian company/u);
});

test("logo tile demos include the 16px Tile size", () => {
	assert.match(LOGO_DEMO_SOURCE, /LOGO_TILE_SIZES/u);
	assert.doesNotMatch(LOGO_DEMO_SOURCE, /const BRAND_TILE_SIZES/u);
});

test("logo sizes demo adds the Atlassian company logo at every size", () => {
	const sizesDemoMatch = LOGO_DEMO_SOURCE.match(/export function LogoDemoSizes\(\) \{[\s\S]*?\n\}/u);

	assert.ok(sizesDemoMatch, "LogoDemoSizes should exist");
	assert.match(sizesDemoMatch[0], /LOGO_TILE_SIZES\.map\(\(size\) =>/u);
	assert.match(sizesDemoMatch[0], /<JiraIcon label="Jira" size=\{size\} \/>/u);
	assert.match(sizesDemoMatch[0], /<AtlassianLogo name="jira" label="Jira" variant="lockup" size=\{size\} \/>/u);
	assert.match(sizesDemoMatch[0], /<AtlassianLogo name="atlassian" label="Atlassian" size=\{size\} \/>/u);
});

test("GitHub package glyphs invert inside the shared chip owner in dark mode", () => {
	assert.match(LOGO_MARK_SOURCE, /const packageGlyphContrastClassName = name === "github" \? "dark:\[&_svg\]:invert" : undefined;/u);
	assert.match(
		LOGO_MARK_SOURCE,
		/"\[&>span\]:bg-transparent! \[&>span\]:border-0!",\s*packageGlyphContrastClassName,\s*className,/u,
	);
});
