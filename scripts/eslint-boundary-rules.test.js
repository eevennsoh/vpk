const assert = require("node:assert/strict");
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
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

async function ruleFindings(source, filePath, ruleIds) {
	const [result] = await eslint.lintText(source, { filePath });
	assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
	return result.messages
		.filter((message) => ruleIds.includes(message.ruleId))
		.map((message) => ({ line: message.line, message: message.message, ruleId: message.ruleId, severity: message.severity }));
}

const importFindings = (source, filePath) => ruleFindings(source, filePath, ["no-restricted-imports"]);
const syntaxFindings = (source, filePath = "components/projects/demo/lint-contract-fixture.tsx") =>
	ruleFindings(source, filePath, ["no-restricted-syntax"]);

test("Rovo and Studio route internals cannot import each other", async () => {
	const [rovo] = await importFindings(
		'import { X } from "@/components/projects/studio/x";\nexport const value = X;\n',
		"components/projects/rovo/lint-contract-fixture.tsx",
	);
	assert.match(rovo.message, /Rovo project code must not import Studio internals/u);
	const [studio] = await importFindings(
		'import { X } from "@/components/projects/rovo/x";\nexport const value = X;\n',
		"components/projects/studio/lint-contract-fixture.tsx",
	);
	assert.match(studio.message, /Studio project code must not import Rovo route internals/u);
});

test("shared app contexts and shared project code depend on rovo-core instead of route internals", async () => {
	for (const filePath of [
		"app/contexts/lint-contract-fixture.tsx",
		"components/projects/shared/lint-contract-fixture.tsx",
		"components/projects/sidebar-chat/lint-contract-fixture.tsx",
	]) {
		const findings = await importFindings(
			'import { A } from "@/components/projects/rovo/a";\nimport { B } from "@/components/projects/studio/b";\nimport { C } from "@/components/projects/rovo-core/c";\nexport const all = [A, B, C];\n',
			filePath,
		);
		assert.deepEqual(findings.map(({ line }) => line), [1, 2], filePath);
		assert.match(findings[0].message, /Shared app context and shared project code must not depend on route internals/u);
	}
});

test("shared UI primitives cannot import app routes or project surfaces", async () => {
	const findings = await importFindings(
		'import { A } from "@/app/contexts/a";\nimport { B } from "@/components/projects/jira/b";\nexport const all = [A, B];\n',
		"components/ui/lint-contract-fixture.tsx",
	);
	assert.equal(findings.length, 2);
	assert.match(findings[0].message, /Shared UI primitives must stay generic/u);
});

test("layers import downward: ui-custom < blocks < projects, with shared layers allowed", async () => {
	const blockFindings = await importFindings(
		[
			'import { A } from "@/components/projects/jira/a";',
			'import { B } from "@/components/projects/shared/b";',
			'import { C } from "@/components/projects/rovo-core/c";',
			'import { D } from "@/components/blocks/jira-work-item/experimental-v3/d";',
			"export const all = [A, B, C, D];",
		].join("\n"),
		"components/blocks/jira-kanban/lint-contract-fixture.tsx",
	);
	assert.deepEqual(blockFindings.map(({ line }) => line), [1, 4]);
	assert.match(blockFindings[0].message, /Blocks sit below projects/u);
	assert.match(blockFindings[1].message, /project-owned snapshots/u);

	const variantOwnerFindings = await importFindings(
		'import { D } from "@/components/blocks/jira-work-item/experimental-v3/d";\nexport const value = D;\n',
		"components/blocks/jira-work-item/experimental-v4/lint-contract-fixture.tsx",
	);
	assert.deepEqual(variantOwnerFindings, []);

	const [uiCustom] = await importFindings(
		'import { A } from "@/components/blocks/agent/a";\nexport const value = A;\n',
		"components/ui-custom/lint-contract-fixture.tsx",
	);
	assert.match(uiCustom.message, /ui-custom sits below blocks and projects/u);
});

test("deep relative imports need the @/ alias outside node:test suites", async () => {
	const source = 'import { A } from "../../lib/a";\nimport { B } from "../b";\nexport const all = [A, B];\n';
	const [finding, ...rest] = await importFindings(source, "components/blocks/demo/lint-contract-fixture.tsx");
	assert.equal(rest.length, 0);
	assert.match(finding.message, /Use the @\/ alias/u);
	assert.deepEqual(await importFindings(source, "components/blocks/demo/lint-contract-fixture.test.ts"), []);
});

test("React 19 APIs replace forwardRef and Context.Provider without flagging library providers", async () => {
	const findings = await syntaxFindings(`
import { createContext, forwardRef } from "react";
import { Tooltip } from "@base-ui/react/tooltip";
const ThemeContext = createContext("light");
export const Input = forwardRef<HTMLInputElement>(function Input(props, ref) { return <input ref={ref} {...props} />; });
export const Theme = () => <ThemeContext.Provider value="dark"><Tooltip.Provider><span /></Tooltip.Provider></ThemeContext.Provider>;
export const Modern = () => <ThemeContext value="dark"><span /></ThemeContext>;
`);
	assert.deepEqual(findings.map(({ line }) => line), [2, 6]);
	assert.match(findings[0].message, /forwardRef/u);
	assert.match(findings[1].message, /<Context value=/u);
});

test("rendered children use a ternary, while boolean props keep `&&`", async () => {
	const findings = await syntaxFindings(`
export const Count = ({ count }: { count: number }) => <div>{count && <span>{count}</span>}</div>;
export const InFragment = ({ ok }: { ok: boolean }) => <>{ok && <span />}</>;
export const Safe = ({ count }: { count: number }) => <div>{count > 0 ? <span>{count}</span> : null}</div>;
export const Props = ({ a, b }: { a: boolean; b: boolean }) => <div aria-selected={a && b} data-active={a && !b} />;
`);
	// Rewriting prop values to `a ? b : null` would drop attributes that render "false".
	assert.deepEqual(findings.map(({ line }) => line), [2, 3]);
	assert.ok(findings.every(({ message }) => /ternary/u.test(message)));
});

test("motion comes from tokens: no inline curves, cubic-bezier strings, or numeric durations", async () => {
	const findings = await syntaxFindings(`
import { motionDuration, motionEase, motionRecipe } from "@/lib/motion";
export const inline = { duration: 0.15, ease: [0.4, 1, 0.6, 1] };
const SOFT_EASE = [0.2, 0, 0, 1];
export const style = { transition: "left 150ms cubic-bezier(0.4, 0, 0, 1)", curve: SOFT_EASE };
export const className = "transition-opacity duration-200";
export const tokens = { duration: motionDuration.normal, ease: motionEase.outPractical, exit: motionRecipe.popup.exit };
export const tokenClasses = "transition-opacity duration-normal ease-out-practical motion-reduce:duration-0";
`);
	assert.deepEqual(findings.map(({ line }) => line), [3, 4, 5, 6]);
	assert.match(findings[0].message, /@\/lib\/motion/u);
	assert.match(findings[2].message, /cubic-bezier/u);
	assert.match(findings[3].message, /duration token utility/u);
});

test("date formatting names a locale so SSR and hydration agree", async () => {
	const findings = await syntaxFindings(`
export const risky = new Intl.DateTimeFormat().format(0) + new Date(0).toLocaleDateString();
export const safe = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(0) + new Date(0).toLocaleDateString("en-US");
`);
	assert.equal(findings.length, 2);
	assert.ok(findings.every(({ line, message }) => line === 2 && /explicit locale/u.test(message)));
});

test("controls need a real capability and toasters need an id", async () => {
	const findings = await syntaxFindings(`
import { Toaster } from "@/components/ui/sonner";
declare function save(): void;
export const Controls = () => (
	<>
		<button onClick={() => {}}>No-op</button>
		<button onClick={() => save()}>Save</button>
		<button disabled>Unavailable</button>
		<Toaster />
		<Toaster id="demo" />
	</>
);
`);
	assert.deepEqual(findings.map(({ line }) => line), [6, 9]);
	assert.match(findings[0].message, /no-op handler/u);
	assert.match(findings[1].message, /unique id/u);
});

test("app/api routes parse JSON through readJsonBody", async () => {
	const findings = await ruleFindings(
		"export async function POST(request: Request) {\n\tconst body = await request.json();\n\treturn Response.json(body);\n}\n",
		"app/api/lint-contract-fixture/route.ts",
		["no-restricted-syntax"],
	);
	assert.equal(findings.length, 1);
	assert.match(findings[0].message, /readJsonBody\(\)/u);
});

test("overlay surfaces reject an added outer border or ring but allow removals and child separators", async () => {
	const findings = await ruleFindings(`
import { HoverCardContent } from "@/components/ui/hover-card";
import { PopoverContent } from "@/components/ui/popover";
export const Overlays = () => (
	<>
		<PopoverContent className="w-80 border border-border" />
		<HoverCardContent className="ring-1 ring-border" />
		<HoverCardContent className="border-0 p-0 [&_[data-slot=surface]]:border-0" />
		<PopoverContent className="w-80"><div className="border-b border-border" /></PopoverContent>
	</>
);
`, "components/blocks/demo/lint-contract-fixture.tsx", ["shadcn/no-restyle"]);
	assert.deepEqual([...new Set(findings.map(({ line }) => line))], [6, 7]);
	assert.ok(findings.every(({ severity }) => severity === 2), "repo-wide overlay contract is an error");
	assert.match(findings[0].message, /overlay elevation/u);
});

test("clickable UI is focusable and keyboard-operable, and hidden UI is unreachable", async () => {
	const findings = await ruleFindings(`
declare function open(): void;
export const Controls = () => (
	<>
		<div onClick={() => open()}>Open</div>
		<button type="button" aria-hidden="true">Hidden but focusable</button>
		<button type="button" onClick={() => open()}>Open</button>
		<div role="button" tabIndex={0} onClick={() => open()} onKeyDown={() => open()}>Open</div>
		<span aria-hidden="true">decorative</span>
	</>
);
`, "components/blocks/demo/lint-contract-fixture.tsx", [
		"jsx-a11y/click-events-have-key-events",
		"jsx-a11y/no-aria-hidden-on-focusable",
		"jsx-a11y/no-static-element-interactions",
	]);
	assert.deepEqual(findings.map(({ line, ruleId }) => [line, ruleId]).sort(), [
		[5, "jsx-a11y/click-events-have-key-events"],
		[5, "jsx-a11y/no-static-element-interactions"],
		[6, "jsx-a11y/no-aria-hidden-on-focusable"],
	]);
	assert.ok(findings.every(({ severity }) => severity === 2));
});

test("component tests prove behavior instead of adding source-text regex assertions", async () => {
	const findings = await ruleFindings(`
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const PAGE_SOURCE = readFileSync("components/blocks/demo/page.tsx", "utf8");
assert.match(PAGE_SOURCE, /onSave=\\{handleSave\\}/u);
assert.doesNotMatch(readFileSync("components/blocks/demo/page.tsx", "utf8"), /forwardRef/u);
async function behavior(view) {
	assert.match(view.tabOrder().join(","), /Save/u);
	assert.equal(view.isFocused(view.getByRole("button", { name: "Save" })), true);
}
module.exports = { behavior };
`, "components/blocks/demo/lint-contract-fixture.test.js", ["no-restricted-syntax"]);
	assert.deepEqual(findings.map(({ line }) => line), [5, 6]);
	assert.match(findings[0].message, /renderComponent\(\)/u);
});

test("browser specs resolve the app origin instead of hardcoding a port or host", async () => {
	const findings = await ruleFindings(`
import { appUrl } from "../helpers/origin";
const LEGACY = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const OTHER = \`https://26b9.localhost/jira-team-eu26\`;
export const target = appUrl("/jira-team-eu26");
export const all = [LEGACY, OTHER];
`, "tests/projects/lint-contract-fixture.spec.ts", ["no-restricted-syntax"]);
	assert.deepEqual(findings.map(({ line }) => line), [3, 4]);
	assert.match(findings[0].message, /tests\/helpers\/origin\.ts/u);
});

test("React compiler rules and the underscore convention are errors", async () => {
	const findings = await ruleFindings(`
import { useRef } from "react";
export function Latest({ value, _legacy }: { value: number; _legacy?: string }) {
	const latest = useRef(value);
	latest.current = value;
	const unused = 1;
	return <span>{value}</span>;
}
`, "components/projects/demo/lint-contract-fixture.tsx", ["react-hooks/refs", "@typescript-eslint/no-unused-vars"]);
	assert.deepEqual(findings.map(({ line, ruleId, severity }) => [line, ruleId, severity]), [
		[5, "react-hooks/refs", 2],
		[6, "@typescript-eslint/no-unused-vars", 2],
	]);
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

test("the copied Team EU26 End project retains the Button contract", async () => {
	const invalid = `import { Button } from "@/components/ui/button";
export const Fixture = () => <Button className="px-2 h-12" />;`;
	const valid = `import { Button } from "@/components/ui/button";
export const Fixture = () => <Button size="compact" className="w-full" />;`;
	const filePath = "components/projects/jira-team-eu26-end/lint-contract-fixture.tsx";
	assert.equal((await designSystemFindings(invalid, filePath)).length, 2);
	assert.deepEqual(await designSystemFindings(valid, filePath), []);
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
	assert.ok(args.includes("components/projects/jira-team-eu26-end"));
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
