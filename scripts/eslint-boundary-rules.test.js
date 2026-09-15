const assert = require("node:assert/strict");
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");
const { ESLint } = require("eslint");

const eslint = new ESLint();
const PILOT_FILE = "components/projects/jira-team-eu26/lint-contract-fixture.tsx";

async function designSystemFindings(source, filePath = PILOT_FILE, linter = eslint) {
	const [result] = await linter.lintText(source, { filePath });
	assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
	return result.messages.filter((message) => message.ruleId?.startsWith("shadcn/"));
}

const ESLINT_CONFIG_SOURCE = readFileSync(
	path.join(process.cwd(), "eslint.config.mjs"),
	"utf8",
);

test("Rovo and Studio route internals cannot import each other", () => {
	assert.match(
		ESLINT_CONFIG_SOURCE,
		/files: \["components\/projects\/rovo\/\*\*\/\*\.\{js,jsx,ts,tsx\}"\][\s\S]*group: \["@\/components\/projects\/studio\/\*\*"\][\s\S]*Rovo project code must not import Studio internals/u,
	);
	assert.match(
		ESLINT_CONFIG_SOURCE,
		/files: \["components\/projects\/studio\/\*\*\/\*\.\{js,jsx,ts,tsx\}"\][\s\S]*group: \["@\/components\/projects\/rovo\/\*\*"\][\s\S]*Studio project code must not import Rovo route internals/u,
	);
});

test("shared app contexts and shared project code depend on rovo-core instead of route internals", () => {
	assert.match(
		ESLINT_CONFIG_SOURCE,
		/"app\/contexts\/\*\*\/\*\.\{js,jsx,ts,tsx\}",[\s\S]*"components\/projects\/shared\/\*\*\/\*\.\{js,jsx,ts,tsx\}",[\s\S]*"components\/projects\/sidebar-chat\/\*\*\/\*\.\{js,jsx,ts,tsx\}",/u,
	);
	assert.match(
		ESLINT_CONFIG_SOURCE,
		/group: \["@\/components\/projects\/rovo\/\*\*", "@\/components\/projects\/studio\/\*\*"\][\s\S]*Shared app context and shared project code must not depend on route internals/u,
	);
});

test("shared UI primitives cannot import app routes or project surfaces", () => {
	assert.match(
		ESLINT_CONFIG_SOURCE,
		/files: \["components\/ui\/\*\*\/\*\.\{js,jsx,ts,tsx\}"\][\s\S]*group: \["@\/app\/\*\*", "@\/components\/projects\/\*\*"\][\s\S]*Shared UI primitives must stay generic/u,
	);
});

test("Button padding violations explain the real sizes and shared owner", async () => {
	const findings = await designSystemFindings(`
import { Button } from "@/components/ui/button";
export const Fixture = () => <Button className="px-2">Save</Button>;
`);
	assert.equal(findings.length, 1);
	assert.equal(findings[0].ruleId, "shadcn/no-restyle");
	assert.equal(findings[0].severity, 1);
	assert.match(findings[0].message, /compact/u);
	assert.match(findings[0].message, /components\/ui\/button\.tsx/u);
	assert.match(findings[0].message, /DESIGN\.md/u);
});

test("Button owns appearance and height even through variants and aliases", async () => {
	const findings = await designSystemFindings(`
import { Button as SaveButton } from "@/components/ui/button";
export const Fixture = () => <SaveButton className="hover:rounded-full md:h-12 bg-bg-danger" />;
`);
	assert.equal(findings.length, 3);
	assert.ok(findings.every((finding) => finding.ruleId === "shadcn/no-restyle"));
});

test("the normal column consumers receive the same Button contract", async () => {
	const findings = await designSystemFindings(`
import { Button } from "@/components/ui/button";
export const Fixture = () => <Button className="px-2 h-12" />;
`, "components/blocks/agent-session-column/agent-session-column-header.tsx");
	assert.equal(findings.length, 2);
});

test("forwarding wrappers preserve Button ownership and accept received className", async () => {
	// Wrapper resolution needs a real file. Use the actual pilot config with
	// disposable source under output/, without writing into component owners.
	mkdirSync("output", { recursive: true });
	const directory = mkdtempSync(path.join(process.cwd(), "output/lint-contract-"));
	try {
		const filePath = path.join(directory, "wrapper.tsx");
		const source = `
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
function SaveButton({ className }: { className?: string }) {
	return <Button className={cn("w-full", className)} />;
}
export const Fixture = () => <SaveButton className="px-2" />;
`;
		writeFileSync(filePath, source);
		const { languageOptions, plugins, rules, settings, linterOptions } = await eslint.calculateConfigForFile(PILOT_FILE);
		const linter = new ESLint({
			overrideConfigFile: true,
			overrideConfig: [{ files: ["**/*.tsx"], languageOptions, plugins, rules, settings, linterOptions }],
		});
		const findings = await designSystemFindings(source, filePath, linter);
		assert.equal(findings.length, 1);
		assert.match(findings[0].message, /Button/u);
		assert.match(findings[0].message, /SaveButton/u);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("Button variants, shape and supported conditional layout remain valid", async () => {
	assert.deepEqual(await designSystemFindings(`
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
export const Fixture = ({ wide }: { wide: boolean }) => (
	<Button size="compact" shape="circle" variant="ghost" className={cn("mt-2 shrink-0", wide ? "w-full" : "w-auto")} />
);
`), []);
});

test("Badge appearance violations suggest its real variants", async () => {
	const findings = await designSystemFindings(`
import { Badge } from "@/components/ui/badge";
export const Fixture = () => <Badge className="bg-bg-danger">3</Badge>;
`);
	assert.equal(findings.length, 1);
	assert.match(findings[0].message, /informationBold/u);
	assert.match(findings[0].message, /components\/ui\/badge\.tsx/u);
});

test("Badge owns padding and height while its variants and layout pass", async () => {
	assert.equal((await designSystemFindings(`
import { Badge } from "@/components/ui/badge";
export const Fixture = () => <Badge className="px-2 h-8" />;
`)).length, 2);
	assert.deepEqual(await designSystemFindings(`
import { Badge } from "@/components/ui/badge";
export const Fixture = () => <Badge variant="informationBold" className="ml-2 shrink-0" max={99}>3</Badge>;
`), []);
});

test("pilot leaves container composition and plain elements flexible", async () => {
	assert.deepEqual(await designSystemFindings(`
import { CardContent } from "@/components/ui/card";
export const Fixture = () => <CardContent className="p-6 text-sm"><div className="bg-blue-400" /></CardContent>;
`), []);
});

test("primitive implementations and consumers outside the pilot are not restricted", async () => {
	const source = `
import { Button } from "@/components/ui/button";
export const Fixture = () => <Button className="px-2 bg-bg-danger" />;
`;
	assert.deepEqual(await designSystemFindings(source, "components/ui/lint-contract-fixture.tsx"), []);
	assert.deepEqual(await designSystemFindings(source, "components/projects/jira/lint-contract-fixture.tsx"), []);
});

test("column lifecycle exceptions preserve reveal and drag chips without allowing restyling elsewhere", async () => {
	const source = `
import { Button } from "@/components/ui/button";
export const Fixture = () => <Button className="opacity-0 hover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100 transition-opacity duration-normal ease-out-practical motion-reduce:transition-none border border-border bg-surface-overlay! text-icon-subtle" />;
`;
	assert.deepEqual(await designSystemFindings(source, "components/blocks/agent-session-column/index.tsx"), []);
	assert.ok((await designSystemFindings(source)).length > 0);
	assert.equal((await designSystemFindings(`
import { Button } from "@/components/ui/button";
export const Fixture = () => <Button className="px-2 bg-bg-danger h-12" />;
`, "components/blocks/agent-session-column/index.tsx")).length, 3);
});

test("collapsed Expand keeps the gutter hit area transparent with focus paint on its visual child", async () => {
	const headerFile = "components/blocks/agent-session-column/agent-session-column-header.tsx";
	const source = `
import { Button } from "@/components/ui/button";
export const Fixture = () => <Button size="icon-compact" className="bg-transparent hover:bg-transparent active:bg-transparent aria-pressed:bg-transparent aria-expanded:bg-transparent focus-visible:border-transparent focus-visible:ring-0" />;
`;
	assert.deepEqual(await designSystemFindings(source, headerFile), []);
	assert.equal((await designSystemFindings(source)).length, 7);
	assert.equal((await designSystemFindings(`
import { Button } from "@/components/ui/button";
export const Fixture = () => <Button className="px-2 bg-bg-danger h-12" />;
`, headerFile)).length, 3);
});

test("the CI pilot command rejects warnings and accepts valid component usage", () => {
	const lintCommand = require("../package.json").scripts["lint:design-system"];
	assert.ok(lintCommand, "the design-system CI command must exist");
	const [command, ...args] = lintCommand.split(/\s+/u);
	assert.equal(command, "eslint");
	assert.ok(args.includes("components/projects/jira-team-eu26"));
	assert.ok(args.includes("components/blocks/agent-session-column"));
	const eslintBin = path.join(path.dirname(require.resolve("eslint/package.json")), "bin/eslint.js");
	const run = (classes) => spawnSync(process.execPath, [
		eslintBin, ...args, "--stdin", "--stdin-filename", PILOT_FILE,
	], {
		input: `import { Button } from "@/components/ui/button";
export const Fixture = () => <Button size="compact" className="${classes}" />;`,
		encoding: "utf8",
	});
	const invalid = run("px-2");
	assert.equal(invalid.status, 1, invalid.stderr);
	assert.match(invalid.stdout, /shadcn\/no-restyle/u);
	const valid = run("w-full");
	assert.equal(valid.status, 0, valid.stderr);
});

test("the aligned class merger preserves semantic tokens and conditional class precedence", async () => {
	const { cn } = await import("cn");
	assert.equal(cn("h-8 px-3 bg-primary", "h-6 px-2 bg-bg-selected"), "h-6 px-2 bg-bg-selected");
	assert.equal(cn("text-sm text-text-subtle", "text-text-danger"), "text-sm text-text-danger");
	assert.equal(cn("duration-normal ease-out-practical", false, { "motion-reduce:transition-none": true }), "duration-normal ease-out-practical motion-reduce:transition-none");
});
