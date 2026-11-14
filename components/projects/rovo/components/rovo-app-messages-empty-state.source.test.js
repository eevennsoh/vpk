const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));
const { readRovoAppShellSource } = require("../../../../scripts/lib/rovo-app-shell-sources.js");

const MESSAGES_SOURCE = fs.readFileSync(path.join(__dirname, "rovo-app-messages.tsx"), "utf8");
const CORE_MESSAGES_SOURCE = fs.readFileSync(path.join(process.cwd(), "components/projects/rovo-core/components/rovo-app-messages.tsx"), "utf8");
const EMPTY_STATE_SOURCE = fs.readFileSync(path.join(process.cwd(), "components/projects/rovo-core/components/rovo-app-empty-state.tsx"), "utf8");
const EMPTY_STATE_CONFIG_SOURCE = fs.readFileSync(path.join(process.cwd(), "components/projects/rovo-core/components/rovo-app-empty-state-config.ts"), "utf8");
const SCROLL_SYNC_SOURCE = fs.readFileSync(path.join(process.cwd(), "components/projects/rovo-core/components/rovo-app-scroll-sync.tsx"), "utf8");
const SHELL_SOURCE = readRovoAppShellSource("rovo");

test("Rovo app empty state switches greeting and illustrations for Max mode", () => {
	assert.match(MESSAGES_SOURCE, /emptyStateConfig=\{ROVO_APP_DEFAULT_EMPTY_STATE\}/u);
	assert.match(MESSAGES_SOURCE, /unavailableProductName="Rovo"/u);
	assert.match(CORE_MESSAGES_SOURCE, /isMaxMode\?: boolean;/u);
	assert.match(CORE_MESSAGES_SOURCE, /emptyStateConfig = ROVO_APP_DEFAULT_EMPTY_STATE/u);
	assert.match(EMPTY_STATE_SOURCE, /const emptyState = isMaxMode \? emptyStateConfig\.max : emptyStateConfig\.default;/u);
	assert.match(EMPTY_STATE_CONFIG_SOURCE, /heading: "How can I help\?"/u);
	assert.match(EMPTY_STATE_CONFIG_SOURCE, /heading: "Let's plan your next move"/u);
	assert.match(EMPTY_STATE_CONFIG_SOURCE, /default: \{[\s\S]*illustrationClassName: "h-\[67px\] w-\[74px\]"/u);
	assert.match(EMPTY_STATE_CONFIG_SOURCE, /lightIllustrationSrc: "\/illustration-ai\/chat\/light\.svg"/u);
	assert.match(EMPTY_STATE_CONFIG_SOURCE, /darkIllustrationSrc: "\/illustration-ai\/chat\/dark\.svg"/u);
	assert.doesNotMatch(EMPTY_STATE_CONFIG_SOURCE, /rovoIllustrationId: "ai"/u);
	assert.doesNotMatch(EMPTY_STATE_SOURCE, /<ControlledRovoIllustration/u);
	assert.match(EMPTY_STATE_CONFIG_SOURCE, /max: \{[\s\S]*illustrationClassName: "h-\[67px\] w-\[74px\]"/u);
	assert.match(EMPTY_STATE_CONFIG_SOURCE, /lightIllustrationSrc: "\/illustration-ai\/max\/light\.gif"/u);
	assert.match(EMPTY_STATE_CONFIG_SOURCE, /darkIllustrationSrc: "\/illustration-ai\/max\/dark\.gif"/u);
	assert.ok(EMPTY_STATE_SOURCE.includes("[[data-color-mode=dark]_&]:hidden"));
	assert.ok(EMPTY_STATE_SOURCE.includes("[[data-color-mode=dark]_&]:block"));
	assert.match(EMPTY_STATE_SOURCE, /<AnimatePresence mode="wait">/u);
	assert.match(EMPTY_STATE_SOURCE, /key=\{emptyState\.id\}/u);
	assert.match(EMPTY_STATE_SOURCE, /visualDuration: 0\.14/u);
	assert.match(EMPTY_STATE_SOURCE, /staggerChildren: 0\.04/u);
	assert.match(EMPTY_STATE_SOURCE, /transform: "translateY\(6px\)"/u);
	assert.match(EMPTY_STATE_SOURCE, /transform: "translateY\(-6px\)"/u);
	assert.doesNotMatch(EMPTY_STATE_SOURCE, /scale\(0\.98\)/u);
	assert.match(SHELL_SOURCE, /isMaxMode=\{chat\.isPlanMode\}/u);
});

const emptyStateMocks = {
	"motion/react": `
		export function AnimatePresence({ children }) { return children; }
		export const useReducedMotion = () => true;
		export const motion = {
			div: ({ animate, children, exit, initial, variants, ...props }) => <div {...props}>{children}</div>,
		};
	`,
	"@/components/ui-custom/agent-avatar-visual": "export const AgentAvatarVisual = () => null;",
	"@/components/projects/sidebar-chat/components/agent-result-card": `
		export const AgentResultCard = () => null;
		export const isGeneratedAgentResult = () => false;
	`,
	"@/components/projects/studio/components/studio-automation-artifact-list-widget":
		"export const StudioAutomationArtifactListWidget = () => null;",
	"@/components/projects/rovo-core/components/rovo-app-messages": `
		import { RovoAppConversationEmptyState } from "@/components/projects/rovo-core/components/rovo-app-empty-state";
		export { ROVO_APP_DEFAULT_EMPTY_STATE } from "@/components/projects/rovo-core/components/rovo-app-empty-state-config";
		export function RovoAppMessages({ emptyStateConfig, headingAs = "h2", isMaxMode = false, selectedAgent = null }) {
			return <RovoAppConversationEmptyState customAgent={selectedAgent}
				emptyStateConfig={emptyStateConfig} hideCustomAgentStarters={true}
				headingAs={headingAs} isMaxMode={isMaxMode} onSelectSuggestion={async () => {}} />;
		}
	`,
};

const emptyStateSource = `
	import { RovoAppMessages as RovoMessages } from "@/components/projects/rovo/components/rovo-app-messages";
	import { RovoAppMessages as StudioMessages } from "@/components/projects/studio/components/rovo-app-messages";
	export default function EmptyState({ surface, ...props }) {
		return surface === "studio" ? <StudioMessages {...props} /> : <RovoMessages {...props} />;
	}
`;

for (const scenario of [
	{ surface: "studio", heading: "Move work forward with agents" },
	{ surface: "studio", isMaxMode: true, heading: "Let's plan your next move" },
	{ surface: "rovo", heading: "How can I help?" },
	{ surface: "rovo", isMaxMode: true, heading: "Let's plan your next move" },
	{ surface: "studio", selectedAgent: { id: "custom-agent", name: "Project guide", starters: [] }, heading: "Project guide" },
]) {
	test(`${scenario.surface} empty state exposes one page heading: ${scenario.heading}`, async () => {
		const { heading, ...props } = scenario;
		const view = await renderComponent({ source: emptyStateSource, mocks: emptyStateMocks, props: { ...props, headingAs: "h1" } });

		assert.equal(view.getByRole("heading", { name: heading }).tagName, "H1");
		assert.equal(view.container.querySelectorAll("h1").length, 1);
	});
}

const projectHeadingMocks = {
	...emptyStateMocks,
	"@/app/rovo/rovo-queue-provider": "export const RovoAppQueueBoundary = ({ children }) => children;",
	"@/app/studio/rovo-queue-provider": "export const RovoAppQueueBoundary = ({ children }) => children;",
	"@/components/projects/rovo/components/rovo-app-shell": `
		import { RovoAppMessages } from "@/components/projects/rovo/components/rovo-app-messages";
		export const RovoAppShell = (props) => <RovoAppMessages {...props} />;
	`,
	"@/components/projects/studio/components/rovo-app-shell": `
		import { RovoAppMessages } from "@/components/projects/studio/components/rovo-app-messages";
		export const RovoAppShell = (props) => <RovoAppMessages {...props} />;
	`,
};

const projectHeadingSource = `
	import RovoPage from "@/components/projects/rovo/page";
	import StudioPage from "@/components/projects/studio/page";
	import RovoDemo from "@/components/website/demos/projects/rovo-demo";
	import StudioDemo from "@/components/website/demos/projects/studio-demo";
	import { DocHero } from "@/components/website/component-doc/components/doc-hero";
	export default function ProjectHeading({ surface, host }) {
		const Page = surface === "studio" ? StudioPage : RovoPage;
		const Demo = surface === "studio" ? StudioDemo : RovoDemo;
		return <>
			{host === "docs" ? <DocHero category="projects" importReferences={[]} name={surface + " documentation"} /> : null}
			{host === "standalone" ? <Page /> : <Demo />}
		</>;
	}
`;

for (const surface of ["studio", "rovo"]) {
	for (const host of ["standalone", "preview", "docs"]) {
		test(`${surface} ${host} keeps the page title separate from the demo introduction`, async () => {
			const pathname = host === "docs" ? `/components/projects/${surface}` : host === "preview" ? `/preview/projects/${surface}` : `/${surface}`;
			const view = await renderComponent({
				source: projectHeadingSource,
				props: { surface, host },
				mocks: { ...projectHeadingMocks, "next/navigation": `export const usePathname = () => ${JSON.stringify(pathname)};` },
			});
			const heading = surface === "studio" ? "Move work forward with agents" : "How can I help?";

			assert.equal(view.getByRole("heading", { name: heading }).tagName, host === "docs" ? "H2" : "H1");
			assert.equal(view.container.querySelectorAll("h1").length, 1);
			if (host === "docs") {
				assert.equal(view.getByRole("heading", { name: `${surface} documentation` }).tagName, "H1");
			}
		});
	}
}

for (const props of [{ isMaxMode: true }, { selectedAgent: { id: "custom-agent", name: "Project guide", starters: [] } }]) {
	test(`shared intro defaults to a secondary heading for ${props.isMaxMode ? "Max" : "custom agents"}`, async () => {
		const view = await renderComponent({ source: emptyStateSource, mocks: emptyStateMocks, props: { surface: "studio", ...props } });
		assert.equal(view.container.querySelectorAll("h1").length, 0);
		assert.equal(view.getByRole("heading").tagName, "H2");
	});
}

test("chat history empty title follows its section heading without changing the generic default", async () => {
	const view = await renderComponent({
		source: `
			import { ControlledChatHistoryPanel } from "@/components/projects/sidebar-chat/components/chat-history-drawer";
			import { EmptyTitle } from "@/components/ui/empty";
			import { token } from "@/lib/tokens";
			export default function HistoryHeading() {
				return <>
					<h2>Chat history</h2>
					<ControlledChatHistoryPanel activeThreadId={null} cancelThreadRun={async () => {}}
						deleteThread={async () => {}} onNewChat={() => {}} selectThread={async () => {}}
						showNavigation={false} threads={[]} threadsLoaded={true} />
					<EmptyTitle style={{ font: token("font.heading.small") }}>Generic empty title</EmptyTitle>
				</>;
			}
		`,
		mocks: { "@/app/contexts": "export const useRovoChat = () => ({});" },
	});

	assert.equal(view.getByRole("heading", { name: "No recent chats yet" }).tagName, "H3");
	assert.equal(view.getByRole("heading", { name: "Generic empty title" }).tagName, "H4");
	assert.equal(view.getByRole("heading", { name: "No recent chats yet" }).style.font,
		view.getByRole("heading", { name: "Generic empty title" }).style.font);
	assert.equal(view.getByRole("heading", { name: "No recent chats yet" }).className,
		view.getByRole("heading", { name: "Generic empty title" }).className);
});

test("Rovo app empty state renders selected custom agent profile and starters", () => {
	assert.match(CORE_MESSAGES_SOURCE, /selectedAgent\?: RovoAgentProfile \| null;/u);
	assert.match(EMPTY_STATE_SOURCE, /function RovoAppCustomAgentEmptyState/u);
	assert.match(EMPTY_STATE_SOURCE, /itemVariants: RovoAppEmptyStateItemVariants;/u);
	assert.match(EMPTY_STATE_SOURCE, /agent\.description/u);
	assert.match(EMPTY_STATE_SOURCE, /agent\.starters\.map/u);
	assert.match(EMPTY_STATE_SOURCE, /<motion\.div key=\{starter\.id\} variants=\{itemVariants\}>/u);
	assert.match(EMPTY_STATE_SOURCE, /onSelectSuggestion\(starterPrompt\)/u);
	assert.match(CORE_MESSAGES_SOURCE, /selectedAgent = null/u);
	assert.match(CORE_MESSAGES_SOURCE, /const customAgent = selectedAgent !== null && !isRovoAgentProfile\(selectedAgent\) \? selectedAgent : null;/u);
	assert.match(CORE_MESSAGES_SOURCE, /shouldShowEmptyConversationState \? \([\s\S]*<RovoAppConversationEmptyState/u);
	assert.match(EMPTY_STATE_SOURCE, /itemVariants=\{emptyStateItemVariants\}/u);
	assert.match(SHELL_SOURCE, /const \{ selectedAgent \} = useRovoSelectedAgent\(\);/u);
	assert.match(SHELL_SOURCE, /selectedAgent=\{selectedAgent\}/u);
	assert.match(SHELL_SOURCE, /showHomeState && !isCustomAgentSelected \? \(/u);
});

test("Rovo app empty state keeps directory autocomplete rows below the composer", () => {
	assert.doesNotMatch(CORE_MESSAGES_SOURCE, /function RovoAppDirectoryAutocompleteRows/u);
	assert.doesNotMatch(CORE_MESSAGES_SOURCE, /directoryAutocompleteState\?: DirectoryAutocompleteState \| null;/u);
	assert.doesNotMatch(CORE_MESSAGES_SOURCE, /onDirectoryAutocompleteActiveChange\?: \(index: number\) => void;/u);
	assert.match(CORE_MESSAGES_SOURCE, /hideCustomAgentStarters\?: boolean;/u);
	assert.match(CORE_MESSAGES_SOURCE, /hideCustomAgentStarters = false/u);
	assert.match(EMPTY_STATE_SOURCE, /hideStarters=\{hideCustomAgentStarters\}/u);
	assert.match(SHELL_SOURCE, /import \{ Kbd \} from "@\/components\/ui\/kbd";/u);
	assert.doesNotMatch(SHELL_SOURCE, /import \{ ReturnIcon \} from "@\/components\/ui\/vpk-icons";/u);
	assert.match(SHELL_SOURCE, /import \{ RichTextMentionVisualMark, type ComposerDirectoryAutocompleteController \} from "@\/components\/ui-custom\/rich-text-editor";/u);
	assert.match(SHELL_SOURCE, /function RovoAppDirectoryAutocompleteRows/u);
	assert.match(SHELL_SOURCE, /useWideLayout \? "grid-cols-2 gap-x-6" : "grid-cols-1"/u);
	assert.match(SHELL_SOURCE, /state\.matches\.map/u);
	assert.doesNotMatch(SHELL_SOURCE, /const active = state\.activeIndex === index;/u);
	assert.doesNotMatch(SHELL_SOURCE, /active=\{active\}/u);
	assert.match(SHELL_SOURCE, /shortcut=\{<RovoAppDirectoryAutocompleteShortcut index=\{index\} \/>\}/u);
	assert.match(SHELL_SOURCE, /onClick=\{\(\) => onSelect\?\.\(index\)\}/u);
	assert.doesNotMatch(SHELL_SOURCE, /onMouseEnter=\{\(\) => onActiveChange\?\.\(index\)\}/u);
	assert.doesNotMatch(SHELL_SOURCE, /onFocus=\{\(\) => onActiveChange\?\.\(index\)\}/u);
	assert.match(SHELL_SOURCE, /<RichTextMentionVisualMark/u);
	assert.doesNotMatch(SHELL_SOURCE, /<ReturnIcon className="size-3\.5 text-icon-subtlest" \/>/u);
	assert.match(SHELL_SOURCE, /⌘\{index \+ 1\}/u);
	assert.match(SHELL_SOURCE, /<motion\.div[\s\S]*className="relative overflow-visible"[\s\S]*<RovoAppComposer[\s\S]*\/>[\s\S]*<RovoAppDirectoryAutocompleteRows/u);
	assert.match(SHELL_SOURCE, /className="absolute inset-x-0 top-full z-20 mt-6"/u);
	assert.match(SHELL_SOURCE, /state=\{directoryAutocompleteState\}/u);
});

test("Rovo app shell wires directory autocomplete to composer, messages, and home gallery", () => {
	assert.match(SHELL_SOURCE, /useState<DirectoryAutocompleteState \| null>\(null\)/u);
	assert.match(SHELL_SOURCE, /useState<ComposerDirectoryAutocompleteController \| null>\(null\)/u);
	assert.match(SHELL_SOURCE, /const shouldShowDirectoryAutocompleteList =[\s\S]*showHomeState[\s\S]*directoryAutocompleteState !== null[\s\S]*directoryAutocompleteState\.matches\.length > 0;/u);
	assert.match(SHELL_SOURCE, /const shouldHideHomePromptGallery =[\s\S]*showHomeState[\s\S]*directoryAutocompleteState !== null;/u);
	assert.match(SHELL_SOURCE, /const directoryAutocompleteLayoutWidth = shellSize\.width \|\| viewportWidthPx \|\| 0;/u);
	assert.match(SHELL_SOURCE, /const shouldUseWideDirectoryAutocompleteLayout = directoryAutocompleteLayoutWidth >= 760;/u);
	assert.match(SHELL_SOURCE, /directoryAutocompleteController\?\.acceptIndex\(index\)/u);
	assert.doesNotMatch(SHELL_SOURCE, /directoryAutocompleteController\?\.setActiveIndex\(index\)/u);
	assert.match(SHELL_SOURCE, /hideCustomAgentStarters=\{showHomeState && directoryAutocompleteState !== null\}/u);
	assert.match(SHELL_SOURCE, /<RovoAppDirectoryAutocompleteRows[\s\S]*onSelect=\{handleDirectoryAutocompleteSelect\}/u);
	assert.doesNotMatch(SHELL_SOURCE, /onActiveChange=\{handleDirectoryAutocompleteActiveChange\}/u);
	assert.match(SHELL_SOURCE, /directoryAutocompleteListVisible=\{shouldShowDirectoryAutocompleteList\}/u);
	assert.match(SHELL_SOURCE, /onDirectoryAutocompleteChange=\{setDirectoryAutocompleteState\}/u);
	assert.match(SHELL_SOURCE, /onDirectoryAutocompleteControllerChange=\{setDirectoryAutocompleteController\}/u);
	assert.match(SHELL_SOURCE, /useWideLayout=\{shouldUseWideDirectoryAutocompleteLayout\}/u);
	assert.doesNotMatch(SHELL_SOURCE, /useWideLayout=\{!isArtifactOpen\}/u);
	assert.match(SHELL_SOURCE, /showHomeState && !isCustomAgentSelected/u);
});

test("Rovo app selected custom agent context is merged into fullscreen submissions", () => {
	assert.match(SHELL_SOURCE, /const selectedAgentContextDescription = getRovoAgentPromptContext\(selectedAgent\);/u);
	assert.match(SHELL_SOURCE, /const resolvedContextDescription = mergeRovoContextDescriptions\(\s*contextDescription,\s*selectedAgentContextDescription,\s*\);/u);
	assert.match(SHELL_SOURCE, /contextDescription: resolvedContextDescription/u);
	assert.match(SHELL_SOURCE, /export function mergeRovoContextDescriptions/u);
	assert.match(SHELL_SOURCE, /const handleRovoAppSuggestionSelect = useCallback/u);
	assert.match(SHELL_SOURCE, /try \{[\s\S]*await chat\.submitPrompt\(\{[\s\S]*buildPromptOptions\(contextDescription\)[\s\S]*files: \[\],[\s\S]*text: prompt/u);
	assert.match(SHELL_SOURCE, /catch \{[\s\S]*submitPrompt already sets a user-visible error state\./u);
	assert.match(SHELL_SOURCE, /onSelectSuggestion=\{handleRovoAppSuggestionSelect\}/u);
});

test("Rovo app streaming anchor follows the real bottom", () => {
	assert.match(SCROLL_SYNC_SOURCE, /target\?: RovoAppScrollAnchorTarget;/u);
	assert.match(
		CORE_MESSAGES_SOURCE,
		/target=\{isStreaming && scrollAnchorMessageId === latestVisibleUserMessageId \? "bottom" : "follow"\}/u,
	);
	assert.match(
		CORE_MESSAGES_SOURCE,
		/resizeTarget=\{isStreaming && scrollAnchorMessageId === latestVisibleUserMessageId \? "bottom" : "follow"\}/u,
	);
	assert.match(
		CORE_MESSAGES_SOURCE,
		/resize=\{isStreaming && scrollAnchorMessageId === latestVisibleUserMessageId \? "instant" : "smooth"\}/u,
	);
	assert.match(
		SCROLL_SYNC_SOURCE,
		/scrollToBottom\(\{\s+animation: target === "bottom" \|\| shouldReduceMotion \? "instant" : "smooth",\s+ignoreEscapes: true,\s+target,\s+\}\)/u,
	);
});
