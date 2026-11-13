const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const SOURCE = readFileSync(join(__dirname, "code-block.tsx"), "utf8");
const DEMO_SOURCE = readFileSync(
	join(__dirname, "..", "website", "demos", "ui-custom", "code-block-demo.tsx"),
	"utf8",
);

test("CodeBlock exposes an explicit 12px size option", () => {
	assert.match(SOURCE, /export type CodeBlockSize = "default" \| "sm"/);
	assert.match(
		SOURCE,
		/CODE_BLOCK_TEXT_SIZE_CLASSES[\s\S]*default: "text-sm"[\s\S]*sm: "text-xs"/,
	);
	assert.match(SOURCE, /size\?: CodeBlockSize/);
	assert.match(SOURCE, /<CodeBlockBody[\s\S]*size=\{size\}[\s\S]*tokenized=\{tokenized\}/);
	assert.doesNotMatch(SOURCE, /"block px-4"/);
	assert.match(SOURCE, /group-data-\[size=sm\]:py-1/);
	assert.equal((SOURCE.match(/size=\{codeBlockSize === "sm" \? "icon-compact" : "icon"\}/g) ?? []).length, 2);
});

test("CodeBlock demos use the size prop for compact code text", () => {
	assert.match(
		DEMO_SOURCE,
		/export default function CodeBlockDemo\(\)[\s\S]*<CodeBlockDemoAdsBasic \/>[\s\S]*<CodeBlockDemoAdsSmall \/>/,
	);
	assert.match(DEMO_SOURCE, /export function CodeBlockDemoAdsSmall/);
	assert.match(DEMO_SOURCE, /<CodeBlock code=\{adsBasicCode\} language="typescript" size="sm" className="w-full">/);
	assert.doesNotMatch(DEMO_SOURCE, /<CodeBlock[^>]*className="[^"]*\btext-xs\b[^"]*"/);
});

test("CodeBlock keeps scrollable code keyboard accessible", () => {
	assert.match(
		SOURCE,
		/data-slot="code-block-scroll-area"[\s\S]*tabIndex=\{0\}[\s\S]*title=\{`\$\{language\} code example`\}/,
	);
});
