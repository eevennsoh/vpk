const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

function readProjectFile(relativePath) {
	return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const responsiveControlTextPattern = new RegExp(
	[
		"text-base",
		"[^\\n]*",
		"md:text-sm",
		"|",
		"md:text-sm",
		"[^\\n]*",
		"text-base",
	].join(""),
	"u",
);

test("text input primitives keep a fixed font size across viewport widths", () => {
	const inputSource = readProjectFile("components/ui/input.tsx");
	const textareaSource = readProjectFile("components/ui/textarea.tsx");

	assert.match(inputSource, /px-2\.5 py-1 text-sm transition-colors/u);
	assert.match(textareaSource, /px-2\.5 py-2 text-sm transition-colors/u);
	assert.doesNotMatch(inputSource, responsiveControlTextPattern);
	assert.doesNotMatch(textareaSource, responsiveControlTextPattern);
});

test("prompt input placeholder mirrors fixed input text sizing", () => {
	const promptInputSource = readProjectFile("components/ui-custom/prompt-input.tsx");

	assert.match(promptInputSource, /px-2\.5 text-sm text-text-subtlest/u);
	assert.doesNotMatch(promptInputSource, responsiveControlTextPattern);
});

// `data-[variant=*]:border-*` and the unscoped `focus-visible:` /
// `aria-invalid:` border utilities have identical CSS specificity, and Tailwind
// emits data-attribute variants last — so the resting border silently wins and
// focused/invalid controls keep their neutral border. Each variant-scoped
// resting border therefore needs variant-scoped state borders beside it.
// `none` is exempt: `border-0` leaves no border to colour.
const VARIANT_SCOPED_BORDER_PRIMITIVES = [
	{
		path: "components/ui/input.tsx",
		states: ["focus-visible:border-ring", "aria-invalid:border-destructive", "user-invalid:border-destructive"],
	},
	{
		path: "components/ui/textarea.tsx",
		states: ["focus-visible:border-ring", "aria-invalid:border-destructive"],
	},
	{
		path: "components/ui/select.tsx",
		states: ["focus-visible:border-ring", "aria-invalid:border-destructive"],
	},
];

for (const { path: sourcePath, states } of VARIANT_SCOPED_BORDER_PRIMITIVES) {
	for (const variant of ["default", "subtle"]) {
		test(`${sourcePath} scopes focus and invalid borders to the ${variant} variant`, () => {
			const source = readProjectFile(sourcePath);

			assert.ok(
				source.includes(`data-[variant=${variant}]:border-`),
				"expected a variant-scoped resting border; if this moved, the state overrides below may no longer be needed",
			);

			for (const state of states) {
				const scoped = `data-[variant=${variant}]:${state}`;
				assert.ok(source.includes(scoped), `${sourcePath} is missing ${scoped}`);
			}
		});
	}
}

test("read-only inputs keep their own resting border while focused", () => {
	// Without these, the variant-scoped focus borders outrank
	// `read-only:focus-visible:border-transparent` and a read-only input picks up
	// the focus ring even though it cannot be edited. Each variant pins the
	// border it already shows at rest: neutral for default, none for subtle.
	const inputSource = readProjectFile("components/ui/input.tsx");

	assert.ok(inputSource.includes("data-[variant=default]:read-only:focus-visible:border-input"));
	assert.ok(inputSource.includes("data-[variant=subtle]:read-only:focus-visible:border-transparent"));
});
