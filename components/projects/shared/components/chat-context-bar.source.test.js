const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

const SOURCE_FILE = path.join(__dirname, "chat-context-bar.tsx");
const CHAT_CONTEXT_BAR_SOURCE = fs.readFileSync(SOURCE_FILE, "utf8");

async function loadChatContextBarHarness() {
	const mockModules = new Map([
		[
			"@/components/ui/tag",
			`
				import React from "react";

				export function Tag(props) {
					return React.createElement(
						"span",
						{
							"data-slot": "tag",
							"data-color": props.color,
							"data-max-width": props.maxWidth,
							"data-class": props.className,
							"data-title": props.title,
						},
						props.elemBefore,
						React.createElement("span", { "data-tag-text": true }, props.children),
					);
				}
			`,
		],
		[
			"@/lib/tokens",
			`
				export function token(name) {
					return name;
				}
			`,
		],
		[
			"@atlaskit/icon/core/board",
			`
				import React from "react";
				export default function BoardIcon() {
					return React.createElement("svg", { "data-icon": "board" });
				}
			`,
		],
		[
			"@atlaskit/icon/core/branch",
			`
				import React from "react";
				export default function BranchIcon(props) {
					return React.createElement("svg", {
						"data-color": props.color,
						"data-icon": "branch",
					});
				}
			`,
		],
		[
			"@atlaskit/icon/core/cross",
			`
				import React from "react";
				export default function CrossIcon(props) {
					return React.createElement("svg", { "data-icon": "cross", "data-size": props.size });
				}
			`,
		],
		[
			"@atlaskit/icon/core/edit",
			`
				import React from "react";
				export default function EditIcon() {
					return React.createElement("svg", { "data-icon": "edit" });
				}
			`,
		],
		[
			"@atlaskit/icon/core/location",
			`
				import React from "react";
				export default function LocationIcon() {
					return React.createElement("svg", { "data-icon": "location" });
				}
			`,
		],
		[
			"@atlaskit/icon/core/page",
			`
				import React from "react";
				export default function PageIcon() {
					return React.createElement("svg", { "data-icon": "page" });
				}
			`,
		],
		[
			"@atlaskit/icon/core/work-item",
			`
				import React from "react";
				export default function WorkItemIcon() {
					return React.createElement("svg", { "data-icon": "work-item" });
				}
			`,
		],
		[
			"@atlaskit/icon/core/person",
			`
				import React from "react";
				export default function PersonIcon() {
					return React.createElement("svg", { "data-icon": "person" });
				}
			`,
		],
		[
			"next/image",
			`
				import React from "react";
				export default function Image(props) {
					return React.createElement("img", {
						"data-image": true,
						src: props.src,
						alt: props.alt,
						"data-class": props.className,
					});
				}
			`,
		],
	]);

	const result = await esbuild.build({
		stdin: {
			contents: `
				import React from "react";
				import { renderToStaticMarkup } from "react-dom/server";
				import ChatContextBar from "./components/projects/shared/components/chat-context-bar.tsx";

				export function renderContextBar(context, dismissible = false) {
					return renderToStaticMarkup(React.createElement(ChatContextBar, {
						context,
						onDismiss: dismissible ? () => {} : undefined,
					}));
				}
			`,
			loader: "tsx",
			resolveDir: process.cwd(),
			sourcefile: "chat-context-bar-harness.tsx",
		},
		bundle: true,
		format: "cjs",
		loader: { ".css": "empty" },
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
		plugins: [
			{
				name: "chat-context-bar-test-mocks",
				setup(build) {
					build.onResolve({ filter: /.*/ }, (args) => {
						if (!mockModules.has(args.path)) {
							return undefined;
						}

						return {
							path: args.path,
							namespace: "chat-context-bar-test-mock",
						};
					});

					build.onLoad(
						{ filter: /.*/, namespace: "chat-context-bar-test-mock" },
						(args) => ({
							contents: mockModules.get(args.path),
							loader: "tsx",
							resolveDir: process.cwd(),
						}),
					);
				},
			},
		],
	});

	return loadCjsModuleFromText(result.outputFiles[0].text);
}

test("ChatContextBar renders a non-dismissible truncated context chip", async () => {
	const harness = await loadChatContextBarHarness();
	const markup = harness.renderContextBar({
		label: "RFP-101: Prepare for bid recommendation for ESM RFP",
		iconName: "work-item",
		signature: "agents-work-item:RFP-101",
	});

	assert.match(markup, /data-chat-context-bar="true"/);
	assert.match(markup, /Context:/);
	assert.match(markup, /RFP-101: Prepare for bid recommendation for ESM RFP/);
	assert.match(markup, /data-icon="location"/);
	assert.match(markup, /data-icon="work-item"/);
	assert.match(CHAT_CONTEXT_BAR_SOURCE, /<Icon[\s\S]*render=\{[\s\S]*<ContextIcon[\s\S]*\/?>/u);
	assert.match(markup, /data-color="standard"/);
	assert.match(markup, /data-max-width="100%"/);
	assert.match(markup, /data-class="[^"]*min-w-0[^"]*"/);
	assert.match(markup, /data-class="[^"]*max-w-full[^"]*"/);
	assert.match(markup, /data-class="[^"]*shrink[^"]*"/);
	assert.match(markup, /data-class="[^"]*overflow-hidden[^"]*"/);
	assert.match(markup, /data-title="RFP-101: Prepare for bid recommendation for ESM RFP"/);
	assert.doesNotMatch(markup, /data-class="[^"]*flex-1[^"]*"/);
	assert.doesNotMatch(markup, /max-w-\[12rem\]/);
	assert.match(markup, /data-icon="cross"/);
	assert.match(markup, /data-icon="cross" data-size="small"/);
	assert.doesNotMatch(markup, /aria-label="Remove context"/);
	assert.doesNotMatch(markup, /<button/);
});

test("ChatContextBar renders artifact edit context with an active dismiss affordance", async () => {
	const harness = await loadChatContextBarHarness();
	const markup = harness.renderContextBar({
		label: "Acmecorp RFP qualification DACI",
		iconName: "artifact",
		signature: "rovo-artifact:Acmecorp RFP qualification DACI",
		variant: "edit",
	}, true);

	assert.match(markup, /data-chat-context-bar="true"/);
	assert.match(markup, /Edit:/);
	assert.match(markup, /Acmecorp RFP qualification DACI/);
	assert.match(markup, /data-icon="edit"/);
	assert.match(markup, /data-icon="page"/);
	assert.match(markup, /aria-label="Close edit context"/);
	assert.match(markup, /<button/);
	assert.doesNotMatch(markup, /Context:/);
	assert.doesNotMatch(markup, /data-icon="location"/);
});

test("ChatContextBar renders a branch edit context", async () => {
	const harness = await loadChatContextBarHarness();
	const markup = harness.renderContextBar({
		label: "carl/jgp-247-assignee-focus-mode",
		iconName: "branch",
		signature: "code-review-branch:carl/jgp-247-assignee-focus-mode",
		variant: "edit",
	});

	assert.match(markup, /Edit:/);
	assert.match(markup, /carl\/jgp-247-assignee-focus-mode/);
	assert.match(markup, /data-color="color\.icon\.subtle" data-icon="branch"/);
	assert.doesNotMatch(markup, /data-icon="page"/);
});

test("ChatContextBar can omit the non-interactive dismiss placeholder", async () => {
	const harness = await loadChatContextBarHarness();
	const markup = harness.renderContextBar({
		label: "PD-40: Implement advanced date-range filter",
		iconName: "work-item",
		showDismissPlaceholder: false,
		signature: "asx-work-item:PD-40",
	});

	assert.doesNotMatch(markup, /data-icon="cross"/);
	assert.doesNotMatch(markup, /<button/);
});

test("ChatContextBar stays presentational and delegates dismissal to props", async () => {
	// The adapter maps a descriptor onto the harvested ui-custom context-bar
	// primitive. It must remain stateless: the non-collapsible path renders a
	// purely presentational bar whose dismiss affordance is driven by props.
	assert.doesNotMatch(CHAT_CONTEXT_BAR_SOURCE, /removedSignature/);
	assert.doesNotMatch(CHAT_CONTEXT_BAR_SOURCE, /setRemovedSignature/);
	assert.doesNotMatch(CHAT_CONTEXT_BAR_SOURCE, /useEffect/);
	assert.doesNotMatch(CHAT_CONTEXT_BAR_SOURCE, /useState/);
	assert.doesNotMatch(CHAT_CONTEXT_BAR_SOURCE, /onRemove=/);

	const harness = await loadChatContextBarHarness();
	const markup = harness.renderContextBar({
		label: "Acmecorp RFP qualification DACI",
		iconName: "work-item",
		signature: "agents-work-item:RFP-101",
	});

	// Content wrapper + truncating chip classes now come from the primitive but
	// must still appear in the rendered output, and a non-dismissible bar must
	// not render an interactive control.
	assert.match(
		markup,
		/class="flex min-w-0 flex-1 items-center gap-1\.5 overflow-hidden has-\[:focus-visible\]:overflow-visible"/,
	);
	assert.match(markup, /data-class="min-w-0 max-w-full shrink overflow-hidden"/);
	assert.match(markup, /data-icon="cross" data-size="small"/);
	assert.doesNotMatch(markup, /<button/);
});

test("ChatContextBar renders a collapsible agent edit bar with avatar", async () => {
	const harness = await loadChatContextBarHarness();
	const markup = harness.renderContextBar({
		label: "Research assistant",
		iconName: "agent",
		signature: "studio-edit-agent:research-assistant",
		variant: "edit",
		avatarSrc: "/avatar-agent-new/yellow/ops-agent.svg",
		collapsible: true,
		collapsedLabel: "Edit agent",
	});

	// Defaults to the expanded "Edit:" state with the agent avatar (not an icon)
	// and a collapse affordance the user can dismiss.
	assert.match(CHAT_CONTEXT_BAR_SOURCE, /<Avatar size="xs" shape="hexagon">[\s\S]*<AvatarImage src=\{context\.avatarSrc\} alt="" \/>/u);
	assert.match(markup, /Edit:/);
	assert.match(markup, /Research assistant/);
	assert.match(markup, /data-slot="avatar"/);
	assert.match(markup, /data-shape="hexagon"/);
	assert.match(markup, /data-slot="avatar-fallback"[\s\S]*Re/);
	assert.match(markup, /<button/);
	assert.doesNotMatch(markup, /data-icon="person"/);
});
