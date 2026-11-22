const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

const SOURCE_FILE = path.join(__dirname, "chat-greeting.tsx");
const CHAT_GREETING_SOURCE = fs.readFileSync(SOURCE_FILE, "utf8");

async function loadChatGreetingHarness() {
	const mockModules = new Map([
		[
			"motion/react",
			`
				import React from "react";

				export function AnimatePresence(props) {
					return React.createElement(React.Fragment, null, props.children);
				}

				function stripMotionProps(props) {
					const { animate, exit, initial, variants, whileHover, whileFocus, whileTap, ...rest } = props;
					return rest;
				}

				export const motion = {
					div: function MotionDiv(props) {
						return React.createElement("div", stripMotionProps(props), props.children);
					},
					button: function MotionButton(props) {
						return React.createElement("button", stripMotionProps(props), props.children);
					},
					span: function MotionSpan(props) {
						return React.createElement("span", stripMotionProps(props), props.children);
					},
				};

				export function useReducedMotion() {
					return false;
				}
			`,
		],
		[
			"next/image",
			`
				import React from "react";

				export default function Image(props) {
					return React.createElement("img", props);
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
			"@/components/ui/heading",
			`
				import React from "react";

				export default function Heading(props) {
					return React.createElement("h2", props, props.children);
				}
			`,
		],
		[
			"@/components/ui/icon-tile",
			`
				import React from "react";

				export function IconTile(props) {
					return React.createElement("span", props, props.icon);
				}
			`,
		],
		[
			"@/components/projects/shared/components/visual-identity-tile",
			`
				import React from "react";

				export function VisualIdentityTile(props) {
					return React.createElement("span", props,
						props.visualIdentity?.iconName === "ai-chat"
							? React.createElement("svg", { "data-testid": "ai-chat-icon" })
							: null
					);
				}
			`,
		],
		[
			"@/components/ui-custom/rovo-illustration",
			`
				import React from "react";

				export const CHAT_ENTER_DURATION = 1.1;

				export function ControlledRovoIllustration(props) {
					return React.createElement("div", {
						"data-testid": "controlled-rovo-illustration",
						"data-illus-id": props.illusId,
						"data-motion-size": String(props.motionSize),
						"data-size": String(props.size),
					});
				}
			`,
		],
		[
			"@/components/ui-custom/agent-avatar-visual",
			`
				import React from "react";

				export function AgentAvatarVisual(props) {
					return React.createElement("img", {
						alt: "",
						"data-testid": "agent-avatar-visual",
						src: props.avatarSrc ?? "",
					});
				}
			`,
		],
		[
			"@atlaskit/icon/core/ai-chat",
			`
				import React from "react";

				export default function AiChatIcon() {
					return React.createElement("svg", { "data-testid": "ai-chat-icon" });
				}
			`,
		],
		[
			"@/lib/rovo-suggestions",
			`
				export const defaultSuggestions = [];
			`,
		],
	]);

	const result = await esbuild.build({
		stdin: {
			contents: `
				import React from "react";
				import { renderToStaticMarkup } from "react-dom/server";
				import ChatGreeting from "./components/projects/sidebar-chat/components/chat-greeting.tsx";
				import { AI_INSIGHTS_AGENT_ID, getRovoAgentProfile } from "./app/data/directory/agents.ts";

				export function renderCustomLightGreeting() {
					return renderToStaticMarkup(React.createElement(ChatGreeting, {
						heading: "What should we change?",
						illustrationSrc: "/illustration-ai/write/light.svg",
						suggestions: [],
					}));
				}

				export function renderDefaultGreeting() {
					return renderToStaticMarkup(React.createElement(ChatGreeting, {
						suggestions: [],
					}));
				}

				export function renderAgentIllustrationGreeting() {
					return renderToStaticMarkup(React.createElement(ChatGreeting, {
						heading: "Improve your agent?",
						illustrationSrc: "/illustration-ai/ai/light.svg",
						illustrationDarkSrc: "/illustration-ai/ai/dark.svg",
						suggestions: [],
					}));
				}

				export function renderMaxGreeting() {
					return renderToStaticMarkup(React.createElement(ChatGreeting, {
						isMaxMode: true,
						suggestions: [],
					}));
				}

				export function renderCustomAgentGreeting(isAgentTest = false) {
					return renderToStaticMarkup(React.createElement(ChatGreeting, {
						isAgentTest,
						selectedAgent: getRovoAgentProfile(AI_INSIGHTS_AGENT_ID),
					}));
				}

				export function renderCustomAgentTestGreeting() {
					return renderToStaticMarkup(React.createElement(ChatGreeting, {
						isAgentTest: true,
						selectedAgent: getRovoAgentProfile(AI_INSIGHTS_AGENT_ID),
						showStarterGroupLabel: true,
						starterGroupLabel: "Test the following",
					}));
				}

				export function renderComposingEmptyDirectoryGreeting() {
					return renderToStaticMarkup(React.createElement(ChatGreeting, {
						heading: "Improve your agent?",
						illustrationSrc: "/illustration-ai/ai/light.svg",
						illustrationDarkSrc: "/illustration-ai/ai/dark.svg",
						isComposing: true,
						directoryAutocompleteState: {
							activeIndex: 0,
							matches: [],
							query: "missing",
							trigger: "@",
						},
						suggestions: [
							{
								id: "default-prompt",
								label: "Default prompt",
								description: "Shown when there are no matches",
								type: "skill",
							},
						],
					}));
				}
			`,
			loader: "tsx",
			resolveDir: process.cwd(),
			sourcefile: "chat-greeting-harness.tsx",
		},
		bundle: true,
		format: "cjs",
		platform: "node",
		// Some real modules pulled into the graph (e.g. app/data/directory/visual.tsx
		// → @atlaskit/icon/core/*) import compiled CSS; drop it so the bundle builds.
		loader: { ".css": "empty" },
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
		plugins: [
			{
				name: "chat-greeting-test-mocks",
				setup(build) {
					build.onResolve({ filter: /.*/ }, (args) => {
						if (!mockModules.has(args.path)) {
							return undefined;
						}

						return {
							path: args.path,
							namespace: "chat-greeting-test-mock",
						};
					});

					build.onLoad(
						{ filter: /.*/, namespace: "chat-greeting-test-mock" },
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

test("ChatGreeting derives the dark illustration from a custom light SVG", async () => {
	const harness = await loadChatGreetingHarness();
	const markup = harness.renderCustomLightGreeting();

	assert.match(markup, /src="\/illustration-ai\/write\/light\.svg"/u);
	assert.match(markup, /src="\/illustration-ai\/write\/dark\.svg"/u);
	assert.doesNotMatch(markup, /src="\/illustration-ai\/chat\/dark\.svg"/u);
});

test("ChatGreeting uses the animated controlled chat illustration for the default Rovo greeting", async () => {
	const harness = await loadChatGreetingHarness();
	const markup = harness.renderDefaultGreeting();

	assert.match(CHAT_GREETING_SOURCE, /resolvedIllustrationSrc === DEFAULT_ILLUSTRATION_SRC/u);
	assert.match(markup, /data-testid="controlled-rovo-illustration"/u);
	assert.match(markup, /data-illus-id="chat"/u);
	assert.match(markup, /data-size="72"/u);
	assert.match(markup, /data-motion-size="180"/u);
	assert.match(CHAT_GREETING_SOURCE, /motionSize=\{illusId === "chat" \? CHAT_GREETING_CONTROLLED_CHAT_MOTION_SIZE : undefined\}/u);
	// The static chat SVG must no longer render for the default greeting.
	assert.doesNotMatch(markup, /src="\/illustration-ai\/chat\/light\.svg"/u);
	assert.doesNotMatch(markup, /src="\/illustration-ai\/chat\/dark\.svg"/u);
});

test("ChatGreeting uses the Studio controlled agent illustration for the AI greeting asset", async () => {
	const harness = await loadChatGreetingHarness();
	const markup = harness.renderAgentIllustrationGreeting();

	assert.match(CHAT_GREETING_SOURCE, /import \{ ControlledRovoIllustration \} from "@\/components\/ui-custom\/rovo-illustration";/u);
	assert.match(CHAT_GREETING_SOURCE, /resolvedIllustrationSrc === AGENT_ILLUSTRATION_SRC/u);
	assert.match(markup, /data-testid="controlled-rovo-illustration"/u);
	assert.match(markup, /data-illus-id="ai"/u);
	assert.match(markup, /data-size="72"/u);
	assert.match(markup, /data-motion-size="undefined"/u);
	assert.doesNotMatch(markup, /src="\/illustration-ai\/ai\/light\.svg"/u);
});

test("ChatGreeting switches theme illustrations for local data-color-mode dark containers", () => {
	assert.match(CHAT_GREETING_SOURCE, /\[\[data-color-mode=dark\]_&\]:hidden/u);
	assert.match(CHAT_GREETING_SOURCE, /\[\[data-color-mode=dark\]_&\]:block/u);
});

test("ChatGreeting switches to Max heading and fixed illustration box", async () => {
	const harness = await loadChatGreetingHarness();
	const markup = harness.renderMaxGreeting();

	assert.match(markup, /Let&#x27;s plan your next move/u);
	assert.match(markup, /src="\/illustration-ai\/max\/light\.gif"/u);
	assert.match(markup, /src="\/illustration-ai\/max\/dark\.gif"/u);
	assert.match(markup, /width="74"/u);
	assert.match(markup, /height="67"/u);
});

test("ChatGreeting lets the illustration play before delayed heading and prompt rows", () => {
	assert.match(CHAT_GREETING_SOURCE, /import \{ AnimatePresence, motion, useReducedMotion \} from "motion\/react";/u);
	assert.match(CHAT_GREETING_SOURCE, /import \{ ControlledRovoIllustration \} from "@\/components\/ui-custom\/rovo-illustration";/u);
	assert.match(CHAT_GREETING_SOURCE, /const CHAT_GREETING_ILLUSTRATION_HEADING_STAGGER = 0\.18;/u);
	assert.match(CHAT_GREETING_SOURCE, /const CHAT_GREETING_HEADING_PROMPT_STAGGER = 0\.18;/u);
	assert.match(CHAT_GREETING_SOURCE, /const CHAT_GREETING_HEADING_CHILD_DELAY = CHAT_GREETING_ILLUSTRATION_HEADING_STAGGER;/u);
	assert.match(CHAT_GREETING_SOURCE, /const CHAT_GREETING_PROMPT_CHILD_DELAY = CHAT_GREETING_HEADING_CHILD_DELAY \+ CHAT_GREETING_HEADING_PROMPT_STAGGER;/u);
	assert.match(CHAT_GREETING_SOURCE, /const CHAT_GREETING_PROMPT_CONTAINER_VARIANTS = \{[\s\S]*delayChildren: CHAT_GREETING_PROMPT_CHILD_DELAY,[\s\S]*staggerChildren: 0\.04/u);
	assert.match(CHAT_GREETING_SOURCE, /staggerChildren: 0\.04/u);
	assert.match(CHAT_GREETING_SOURCE, /const CHAT_GREETING_MODE_TRANSITION = \{[\s\S]*type: "spring",[\s\S]*bounce: 0,[\s\S]*visualDuration: 0\.22/u);
	assert.match(CHAT_GREETING_SOURCE, /const CHAT_GREETING_CONTROLLED_ILLUSTRATION_SIZE = 72;/u);
	assert.match(CHAT_GREETING_SOURCE, /const CHAT_GREETING_CONTROLLED_CHAT_MOTION_SIZE = 180;/u);
	assert.match(CHAT_GREETING_SOURCE, /const CHAT_GREETING_STATIC_ILLUSTRATION_CLASS_NAME = "h-\[67px\] w-\[74px\]";/u);
	assert.match(CHAT_GREETING_SOURCE, /const CHAT_GREETING_ITEM_VARIANTS = \{[\s\S]*transform: "translateY\(24px\)"[\s\S]*transform: "translateY\(0px\)"[\s\S]*transition: CHAT_GREETING_MODE_TRANSITION[\s\S]*transform: "translateY\(-24px\)"/u);
	assert.match(CHAT_GREETING_SOURCE, /const CHAT_GREETING_HEADING_ITEM_VARIANTS = \{[\s\S]*transform: "translateY\(24px\)"[\s\S]*delay: CHAT_GREETING_HEADING_CHILD_DELAY[\s\S]*transform: "translateY\(-24px\)"/u);
	assert.doesNotMatch(CHAT_GREETING_SOURCE, /CHAT_GREETING_HERO_ITEM_TRANSITION/u);
	assert.doesNotMatch(CHAT_GREETING_SOURCE, /CHAT_GREETING_HERO_TRANSITION/u);
	assert.doesNotMatch(CHAT_GREETING_SOURCE, /CHAT_GREETING_HERO_ILLUSTRATION/u);
	assert.doesNotMatch(CHAT_GREETING_SOURCE, /CHAT_GREETING_HERO_HEADING/u);
	assert.doesNotMatch(CHAT_GREETING_SOURCE, /stabilizeHeroOnMount/u);
	assert.doesNotMatch(CHAT_GREETING_SOURCE, /CHAT_GREETING_HERO_CONTAINER_VARIANTS/u);
	assert.doesNotMatch(CHAT_GREETING_SOURCE, /CHAT_GREETING_REDUCED_HERO_CONTAINER_VARIANTS/u);
	assert.doesNotMatch(CHAT_GREETING_SOURCE, /activeHeroContainerVariants/u);
	assert.doesNotMatch(CHAT_GREETING_SOURCE, /key="hero"/u);
	assert.doesNotMatch(CHAT_GREETING_SOURCE, /CHAT_GREETING_CONTROLLED_ILLUSTRATION_DISPLAY_SIZE/u);
	assert.doesNotMatch(CHAT_GREETING_SOURCE, /CHAT_GREETING_CONTROLLED_ILLUSTRATION_SCALE/u);
	assert.doesNotMatch(CHAT_GREETING_SOURCE, /CHAT_GREETING_CONTROLLED_ILLUSTRATION_ZOOM/u);
	assert.doesNotMatch(CHAT_GREETING_SOURCE, /CHAT_GREETING_CONTROLLED_ILLUSTRATION_SHELL_STYLE/u);
	assert.doesNotMatch(CHAT_GREETING_SOURCE, /CHAT_GREETING_CONTROLLED_ILLUSTRATION_STAGE_STYLE/u);
	assert.doesNotMatch(CHAT_GREETING_SOURCE, /PixelSnappedSidebarIllustration/u);
	assert.doesNotMatch(CHAT_GREETING_SOURCE, /getDevicePixelSnapOffset/u);
	assert.doesNotMatch(CHAT_GREETING_SOURCE, /relative overflow-visible/u);
	assert.doesNotMatch(CHAT_GREETING_SOURCE, /absolute left-1\/2 top-1\/2/u);
	assert.doesNotMatch(CHAT_GREETING_SOURCE, /translate\(-50%, -50%\) scale/u);
	assert.doesNotMatch(CHAT_GREETING_SOURCE, /transformOrigin: "top left"/u);
	assert.match(CHAT_GREETING_SOURCE, /function SidebarControlledRovoIllustration\(\{ illusId \}: Readonly<\{ illusId: "ai" \| "chat" \}>\)/u);
	assert.match(CHAT_GREETING_SOURCE, /motionSize=\{illusId === "chat" \? CHAT_GREETING_CONTROLLED_CHAT_MOTION_SIZE : undefined\}/u);
	assert.match(CHAT_GREETING_SOURCE, /size=\{CHAT_GREETING_CONTROLLED_ILLUSTRATION_SIZE\}/u);
	assert.match(CHAT_GREETING_SOURCE, /shouldShowHero \? \(\s*<div className="flex flex-col items-center gap-2">[\s\S]*<SidebarControlledRovoIllustration illusId="chat" \/>/u);
	assert.match(CHAT_GREETING_SOURCE, /<div className=\{cn\(CHAT_GREETING_STATIC_ILLUSTRATION_CLASS_NAME, "relative"\)\}>[\s\S]*className=\{cn\(CHAT_GREETING_STATIC_ILLUSTRATION_CLASS_NAME,/u);
	assert.match(CHAT_GREETING_SOURCE, /variants=\{headingItemVariants\}>\s*<Heading size="large"/u);
	assert.match(CHAT_GREETING_SOURCE, /<motion\.div className="w-full" variants=\{activePromptContainerVariants\}>/u);
	assert.doesNotMatch(CHAT_GREETING_SOURCE, /layout=\{isComposing \? false : "position"\} variants=\{activePromptContainerVariants\}/u);
	assert.match(CHAT_GREETING_SOURCE, /greetingSuggestions\.map\(\(suggestion\) => \([\s\S]*<motion\.div key=\{suggestion\.id\} variants=\{activeItemVariants\}>/u);
});

test("ChatGreeting falls back to the default prompts when a directory query has no matches", async () => {
	const harness = await loadChatGreetingHarness();
	const markup = harness.renderComposingEmptyDirectoryGreeting();

	assert.match(CHAT_GREETING_SOURCE, /const CHAT_GREETING_INSTANT_CONTAINER_VARIANTS/u);
	assert.match(CHAT_GREETING_SOURCE, /const activeContainerVariants = isComposing \? CHAT_GREETING_INSTANT_CONTAINER_VARIANTS : CHAT_GREETING_SEQUENCE_CONTAINER_VARIANTS;/u);
	assert.match(CHAT_GREETING_SOURCE, /<motion\.div className="w-full" variants=\{activePromptContainerVariants\}>/u);
	// The hero only collapses while composing when real directory matches exist;
	// an empty-result fallback keeps the illustration + heading visible.
	assert.match(CHAT_GREETING_SOURCE, /const shouldShowHero =\s*showHero && \(!isComposing \|\| !shouldRenderDirectoryMatches\);/u);
	// An empty-result directory query must surface the default prompt list rather
	// than collapsing to just the illustration + heading.
	assert.match(CHAT_GREETING_SOURCE, /const hasEmptyDirectoryQuery =/u);
	assert.match(CHAT_GREETING_SOURCE, /\(directoryAutocompleteState === null \|\| hasEmptyDirectoryQuery\) && greetingSuggestions\.length > 0/u);
	// Both the hero (illustration + heading) AND the default prompts must show.
	assert.match(markup, /Improve your agent\?/u);
	assert.match(markup, /data-testid="controlled-rovo-illustration"/u);
	assert.match(markup, /data-illus-id="ai"/u);
	assert.match(markup, /Default prompt/u);
	// The unmatched directory query text must never leak into the rendered rows.
	assert.doesNotMatch(markup, /missing/u);
});

test("ChatGreeting prompt rows render through the shared GreetingPromptRow", () => {
	// Greeting rows now delegate to the shared row so every chat surface matches
	// the editor palette (medium-weight label + hover-revealed byline).
	assert.match(CHAT_GREETING_SOURCE, /import \{ GreetingPromptRow \} from "@\/components\/projects\/shared\/components\/greeting-prompt-row";/u);
	assert.match(CHAT_GREETING_SOURCE, /<GreetingPromptRow[\s\S]*description=\{suggestion\.description\}/u);
});

test("ChatGreeting directory prompt rows stay shortcut and click only", () => {
	assert.doesNotMatch(CHAT_GREETING_SOURCE, /onDirectoryAutocompleteActiveChange/u);
	assert.doesNotMatch(CHAT_GREETING_SOURCE, /active=\{directoryAutocompleteState\.activeIndex === index\}/u);
	assert.doesNotMatch(CHAT_GREETING_SOURCE, /onMouseEnter=\{onActive\}/u);
	assert.doesNotMatch(CHAT_GREETING_SOURCE, /onFocus=\{onActive\}/u);
	assert.match(CHAT_GREETING_SOURCE, /shortcut=\{<DirectoryAutocompleteShortcut index=\{index\} \/>\}/u);
});

test("ChatGreeting renders selected custom agent profile and three starters", async () => {
	const harness = await loadChatGreetingHarness();
	const markup = harness.renderCustomAgentGreeting();

	assert.match(CHAT_GREETING_SOURCE, /function CustomAgentGreeting/u);
	assert.match(CHAT_GREETING_SOURCE, /itemVariants: ChatGreetingItemVariants;/u);
	assert.match(CHAT_GREETING_SOURCE, /isAgentTest \? "items-start text-left" : "mx-auto max-w-\[800px\] items-center text-center"/u);
	// Default (main Rovo App chat) renders the wide 800px custom-agent greeting.
	assert.match(markup, /max-w-\[800px\]/u);
	assert.doesNotMatch(markup, /items-start text-left/u);
	assert.match(CHAT_GREETING_SOURCE, /<motion\.div key=\{suggestion\.id\} variants=\{activeItemVariants\}>/u);
	assert.match(CHAT_GREETING_SOURCE, /<AnimatePresence mode="wait">[\s\S]*customAgent \? \(/u);
	assert.match(markup, /AI Insights Agent/u);
	assert.match(markup, /Researches and summarizes latest AI trends, breakthroughs, and industry developments for weekly insights\./u);
	assert.match(markup, /What are the latest AI trends this week\?/u);
	assert.match(markup, /Summarize recent AI breakthroughs for me/u);
	assert.match(markup, /Give me AI industry insights and developments/u);
	assert.equal((markup.match(/data-testid="ai-chat-icon"/g) ?? []).length, 3);
	assert.equal((markup.match(/<button/g) ?? []).length, 3);
});

test("ChatGreeting renders the custom agent greeting full-width in Test mode", async () => {
	const harness = await loadChatGreetingHarness();
	const markup = harness.renderCustomAgentGreeting(true);

	// The Studio Test panel passes isAgentTest so the greeting fills the test panel.
	assert.match(markup, /items-start text-left/u);
	assert.match(markup, /flex max-w-full flex-col gap-1 w-full/u);
	assert.doesNotMatch(markup, /max-w-\[800px\]/u);
});

test("ChatGreeting renders the agent-test starter group as a text-only header", async () => {
	const harness = await loadChatGreetingHarness();
	const markup = harness.renderCustomAgentTestGreeting();

	assert.match(markup, /Test the following/u);
	assert.doesNotMatch(markup, /illustration-spot\/general\/chat-6/u);
	assert.doesNotMatch(CHAT_GREETING_SOURCE, /illustration-spot\/general\/chat-6/u);
});
