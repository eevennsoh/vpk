const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const SOURCE = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
const TRACE_CARD_SOURCE = fs.readFileSync(
	path.join(__dirname, "components", "skill-creation-trace-card.tsx"),
	"utf8",
);
const RESULT_CARD_SOURCE = fs.readFileSync(
	path.join(__dirname, "components", "skill-creation-result-card.tsx"),
	"utf8",
);

test("Skills project add menu opens the experimental skills directory", () => {
	const addMenuIndex = SOURCE.indexOf("const addMenuItemsBefore = (");
	const dialogIndex = SOURCE.indexOf("<SkillDirectoryDialog");
	const createSpaceIndex = SOURCE.indexOf("Create space", addMenuIndex);
	const viewAllSkillsIndex = SOURCE.indexOf("View all skills", addMenuIndex);

	assert.match(SOURCE, /import \{ DEFAULT_SKILLS \} from "@\/app\/data\/directory\/skills";/u);
	assert.match(SOURCE, /import \{ mapSkillToMentionItem \} from "@\/components\/blocks\/editor-palette\/data\/mention-sources";/u);
	assert.match(SOURCE, /import \{ SkillDirectoryDialog, type SkillDirectorySkill \} from "@\/components\/blocks\/skill-directory";/u);
	assert.match(SOURCE, /import type \{ RichTextMentionItem, RichTextMentionSources \} from "@\/components\/ui-custom\/rich-text-editor";/u);
	assert.match(SOURCE, /import \{ PromptInputActionMenuItem \} from "@\/components\/ui-custom\/prompt-input";/u);
	assert.match(SOURCE, /import FolderAddIcon from "@atlaskit\/icon-lab\/core\/folder-add";/u);
	assert.match(SOURCE, /import SkillIcon from "@atlaskit\/icon-lab\/core\/skill";/u);
	assert.match(SOURCE, /const \[isSkillDirectoryOpen, setIsSkillDirectoryOpen\] = useState\(false\);/u);
	assert.match(SOURCE, /const \[prefillRequest, setPrefillRequest\] = useState<\{ mention\?: RichTextMentionItem; text\?: string; requestKey: number \}>/u);
	assert.match(SOURCE, /const STATIC_SKILL_IDS = DEFAULT_SKILLS\.map\(\(skill\) => skill\.id\);/u);
	assert.match(SOURCE, /const handleViewAllSkills = useCallback\(\(\) => \{[\s\S]*setIsSkillDirectoryOpen\(true\);[\s\S]*\}, \[\]\);/u);
	assert.match(SOURCE, /const handleAddDirectorySkills = useCallback\([\s\S]*skills: readonly SkillDirectorySkill\[\][\s\S]*setPrefillRequest\(\{ mention: mapSkillToMentionItem\(skill\), requestKey: prefillCounterRef\.current \}\);[\s\S]*setConfigSkillId\(null\);[\s\S]*setIsSkillDirectoryOpen\(false\);/u);
	assert.doesNotMatch(SOURCE, /buildSkillMentionText/u);

	assert.ok(addMenuIndex > -1);
	assert.ok(createSpaceIndex > addMenuIndex);
	assert.ok(viewAllSkillsIndex > createSpaceIndex);
	assert.match(SOURCE.slice(addMenuIndex, dialogIndex), /elemBefore=\{<FolderAddIcon label="" \/>\}[\s\S]*Create space/u);
	assert.match(SOURCE.slice(addMenuIndex, dialogIndex), /elemBefore=\{<SkillIcon label="" \/>\}[\s\S]*View all skills/u);
	assert.match(SOURCE, /<ChatPanel[\s\S]*addMenuItemsBefore=\{addMenuItemsBefore\}[\s\S]*autoFocusComposer/u);
	assert.match(SOURCE, /const SKILLS_GREETING: ChatPanelGreetingProps = \{[\s\S]*suggestions: SKILL_GREETING_SUGGESTIONS/u);
	assert.doesNotMatch(SOURCE, /stabilizeHeroOnMount/u);
	assert.doesNotMatch(SOURCE, /What skill should I run/u);
	// The directory dialog is shared with the create-skill config view, so its
	// `open` is the combined `isDialogOpen` (which includes isSkillDirectoryOpen)
	// and it uses the runtime `dialogSkills` list. Still the experimental variant.
	assert.match(SOURCE, /const isDialogOpen = [\s\S]*isSkillDirectoryOpen/u);
	assert.match(SOURCE.slice(dialogIndex), /open=\{isDialogOpen\}[\s\S]*skills=\{dialogSkills\}[\s\S]*variant="experimental"[\s\S]*onAddSkills=\{handleAddDirectorySkills\}[\s\S]*selectionExperience="chat-single-add"/u);
});

test("Create-skill flow reserves static skill ids for runtime-generated skills", () => {
	const interceptSource = SOURCE.slice(
		SOURCE.indexOf("const onInterceptSubmit = useCallback"),
		SOURCE.indexOf("const resolveComposerPlaceholder = useCallback"),
	);

	assert.match(interceptSource, /deriveSkillFromPrompt\(pendingCreatePromptRef\.current \|\| text, text, \{\s*reservedSkillIds: \[\.\.\.STATIC_SKILL_IDS, \.\.\.createdSkills\.map\(\(entry\) => entry\.id\)\],\s*\}\)/u);
});

test("Create-skill question traces collapse while awaiting user response", () => {
	assert.match(TRACE_CARD_SOURCE, /const isAwaiting = payload\.awaiting === true;/u);
	assert.match(TRACE_CARD_SOURCE, /const ACTIVE_BYLINE_CYCLE_MS = 1200;/u);
	assert.match(TRACE_CARD_SOURCE, /step\.status === "active"[\s\S]*activeStepBylines\[activeBylineIndex/u);
	assert.match(TRACE_CARD_SOURCE, /const traceLifecycleKey = isAwaiting[\s\S]*answered \? "answered" : "awaiting"[\s\S]*state === "completed" \? "completed" : "active"/u);
	assert.match(TRACE_CARD_SOURCE, /const shouldAutoOpen = state === "thinking" && !isAwaiting;/u);
	assert.match(TRACE_CARD_SOURCE, /const \[isTraceOpen, setTraceOpen\] = useState\(shouldAutoOpen\);/u);
	assert.match(TRACE_CARD_SOURCE, /setTraceOpen\(shouldAutoOpen\);[\s\S]*\[shouldAutoOpen, traceLifecycleKey\]/u);
	assert.match(TRACE_CARD_SOURCE, /const hasByline = byline != null && byline\.trim\(\)\.length > 0;/u);
	assert.match(TRACE_CARD_SOURCE, /description: step\.status === "complete" \? null : byline/u);
	assert.match(TRACE_CARD_SOURCE, /collapsible: hasByline/u);
	assert.match(TRACE_CARD_SOURCE, /defaultOpen: step\.status === "active"/u);
	assert.match(TRACE_CARD_SOURCE, /children: hasByline \? \(/u);
	assert.match(TRACE_CARD_SOURCE, /key=\{traceLifecycleKey\}/u);
	assert.match(TRACE_CARD_SOURCE, /open=\{isTraceOpen\}/u);
	assert.match(TRACE_CARD_SOURCE, /onOpenChange=\{setTraceOpen\}/u);
	assert.match(TRACE_CARD_SOURCE, /Awaiting user response/u);
});

test("Generated skill result card renders with the tag-styled success summary", () => {
	const positionSource = SOURCE.slice(
		SOURCE.indexOf("const getWidgetPosition = useCallback"),
		SOURCE.indexOf("const onInterceptSubmit = useCallback"),
	);

	assert.match(positionSource, /if \(widgetType === SKILL_CREATION_RESULT_WIDGET_TYPE\) \{[\s\S]*return "after-content";[\s\S]*\}/u);
	assert.match(positionSource, /if \(widgetType === SKILL_CREATION_TRACE_WIDGET_TYPE\) \{[\s\S]*return "before-content";[\s\S]*\}/u);
	assert.match(RESULT_CARD_SOURCE, /import \{ SkillTag \} from "@\/components\/ui-custom\/skill-tag";/u);
	assert.match(RESULT_CARD_SOURCE, /payload\.showSuccessSummary \? \(/u);
	assert.match(RESULT_CARD_SOURCE, /<SkillTag[\s\S]*color=\{skillTagColor\}[\s\S]*icon=\{getSkillIcon\(payload\.iconKey as SkillIconKey\)\}[\s\S]*\{payload\.name\}[\s\S]*<\/SkillTag>/u);
	assert.doesNotMatch(RESULT_CARD_SOURCE, /showToggle=\{false\}/u);
});

test("Hard-coded skill starters fall through to normal Rovo chat", () => {
	const interceptSource = SOURCE.slice(
		SOURCE.indexOf("const onInterceptSubmit = useCallback"),
		SOURCE.indexOf("const resolveComposerPlaceholder = useCallback"),
	);
	const createSkillIndex = interceptSource.indexOf("if (hasCreateSkillMention(text))");
	const normalChatFallbackIndex = interceptSource.indexOf("return { handled: false };");

	assert.ok(createSkillIndex > -1);
	assert.ok(normalChatFallbackIndex > createSkillIndex);
	assert.doesNotMatch(SOURCE, /buildSkillInterceptOutcome/u);
	assert.doesNotMatch(SOURCE, /SKILL_INVOCATION_WIDGET_TYPE/u);
});
