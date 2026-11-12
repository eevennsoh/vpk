const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const QUESTION_CARD_FILE = path.join(__dirname, "question-card.tsx");
const QUESTION_CARD_SOURCE = fs.readFileSync(QUESTION_CARD_FILE, "utf8");
const QUESTION_CARD_HOOK_FILE = path.join(__dirname, "..", "hooks", "use-question-card.ts");
const QUESTION_CARD_HOOK_SOURCE = fs.readFileSync(QUESTION_CARD_HOOK_FILE, "utf8");
const { getQuestionSignature } = require("../lib/question-helpers.ts");

function extractSlice(startMarker, endMarker) {
	const startIndex = QUESTION_CARD_SOURCE.indexOf(startMarker);
	assert.notEqual(startIndex, -1, `Expected to find start marker: ${startMarker}`);

	const endIndex = QUESTION_CARD_SOURCE.indexOf(endMarker, startIndex);
	assert.notEqual(endIndex, -1, `Expected to find end marker: ${endMarker}`);

	return QUESTION_CARD_SOURCE.slice(startIndex, endIndex);
}

function extractHookSlice(startMarker, endMarker) {
	const startIndex = QUESTION_CARD_HOOK_SOURCE.indexOf(startMarker);
	assert.notEqual(startIndex, -1, `Expected to find hook start marker: ${startMarker}`);

	const endIndex = QUESTION_CARD_HOOK_SOURCE.indexOf(endMarker, startIndex);
	assert.notEqual(endIndex, -1, `Expected to find hook end marker: ${endMarker}`);

	return QUESTION_CARD_HOOK_SOURCE.slice(startIndex, endIndex);
}

test("QuestionCard persistence distinguishes question IDs containing delimiters", () => {
	const embeddedDelimiterSignature = getQuestionSignature([{ id: "question|detail" }]);
	const multipleQuestionSignature = getQuestionSignature([{ id: "question" }, { id: "detail" }]);

	assert.notEqual(embeddedDelimiterSignature, multipleQuestionSignature);
});

test("QuestionCard renders navigation controls above the question heading", () => {
	const header = extractSlice(
		"<header data-slot=\"question-card-header\"",
		"</header>",
	);
	const previousButtonIndex = header.indexOf("aria-label=\"Previous question\"");
	const headingIndex = header.indexOf("<h5");

	assert.notEqual(previousButtonIndex, -1, "Expected previous question control in header");
	assert.notEqual(headingIndex, -1, "Expected question heading in header");
	assert.ok(previousButtonIndex < headingIndex, "Expected question navigation to render before the heading");
	assert.doesNotMatch(header, /\btruncate\b/u);
});

test("QuestionCard single-question header keeps the title and dismiss button on one centered row", () => {
	const header = extractSlice(
		"<header data-slot=\"question-card-header\"",
		"</header>",
	);

	// The single-question branch uses a one-row layout distinct from the
	// multi-question nav row (which carries `mb-3 flex h-8 ...`).
	const singleRowIndex = header.indexOf("<div className=\"flex items-center justify-between gap-2\">");
	assert.notEqual(singleRowIndex, -1, "Expected a single-row header layout for single-question cards");

	const singleRow = header.slice(singleRowIndex);
	assert.match(singleRow, /<h5/u, "Expected the title to live in the single-question row");
	assert.match(singleRow, /aria-label="Dismiss questions"/u, "Expected the dismiss button in the single-question row");
	assert.doesNotMatch(singleRow, /mb-3/u, "Single-question title and dismiss must share one row, not stack");
});

test("QuestionCard option text wraps instead of truncating", () => {
	const optionContent = extractSlice(
		"data-slot=\"question-card-option-content\"",
		"{description ?",
	);

	assert.match(optionContent, /whitespace-normal break-words/u);
	assert.doesNotMatch(optionContent, /\btruncate\b/u);
});

test("QuestionCard caps card height and scrolls overflowing question content internally", () => {
	const root = extractSlice(
		"data-slot=\"question-card\"",
		"<header data-slot=\"question-card-header\"",
	);
	const body = extractSlice(
		"data-slot=\"question-card-body\"",
		"<QuestionInput",
	);

	assert.match(root, /\bflex\b/u);
	assert.match(root, /\bflex-col\b/u);
	assert.match(root, /\bmax-h-\[min\(70vh,32rem\)\]/u);
	assert.match(root, /\boverflow-hidden\b/u);

	assert.match(body, /\bmin-h-0\b/u);
	assert.match(body, /\bflex-1\b/u);
	assert.match(body, /\boverflow-y-auto\b/u);
	assert.match(body, /\boverscroll-contain\b/u);
});

test("QuestionCard footer sits on the option-list rhythm without a top border", () => {
	const footer = extractSlice(
		"data-slot=\"question-card-footer\"",
		"</footer>",
	);
	const body = extractSlice(
		"data-slot=\"question-card-body\"",
		"<QuestionInput",
	);

	assert.match(footer, /\bpy-3\b/u, "Custom input footers use the extra vertical padding from the Submit row");
	assert.doesNotMatch(footer, /\bpt-1\b/u);
	assert.doesNotMatch(footer, /\bborder-t\b/u);
	assert.doesNotMatch(body, /\bpb-4\b/u, "Body bottom padding must not add extra space above the footer");
});

test("QuestionCard never renders a Skip footer button and drops header bottom padding when there are no options", () => {
	const header = extractSlice(
		"<header data-slot=\"question-card-header\"",
		"</header>",
	);

	assert.match(QUESTION_CARD_SOURCE, /shouldShowQuestionCardFooter\(showCustomInput, primaryAction\)/u);
	assert.match(QUESTION_CARD_SOURCE, /case "skip":/u);
	assert.doesNotMatch(QUESTION_CARD_SOURCE, />Skip</u);
	assert.match(header, /visibleOptionCount > 0 \? "pb-4" : "pb-0"/u);
});

test("QuestionCard keyboard shortcuts toggle multi-select options without submitting", () => {
	const keyboardSelect = extractHookSlice(
		"const handleKeyboardOptionSelect = useCallback(",
		"const handleCustomInputFocus = useCallback(",
	);
	const enterKeyHandler = extractHookSlice(
		"case \"Enter\":",
		"case \"ArrowLeft\":",
	);

	assert.match(keyboardSelect, /currentQuestion\.kind === "multi-select"/u);
	assert.match(keyboardSelect, /const selectedValues = getSelectedValues\(answers\[currentQuestion\.id\]\)/u);
	assert.match(keyboardSelect, /\[currentQuestion\.id\]: nextValues/u);
	assert.match(keyboardSelect, /setAnswers\(nextAnswers\)/u);
	assert.match(keyboardSelect, /persistQuestionCardState\(nextAnswers, safeQuestionIndex\)/u);
	assert.match(keyboardSelect, /handleSelectOption\(optionId\)/u);
	assert.doesNotMatch(keyboardSelect, /onSubmit\(nextAnswers\)/u);
	assert.doesNotMatch(keyboardSelect, /goToNextQuestion\(\)/u);

	assert.match(enterKeyHandler, /handleKeyboardOptionSelect\(option\.id\)/u);
	assert.match(enterKeyHandler, /isOptionButtonFocused \|\| document\.activeElement === footerButtonRef\.current/u);
	assert.match(QUESTION_CARD_HOOK_SOURCE, /hasFooterButton/u);
	assert.match(
		QUESTION_CARD_HOOK_SOURCE,
		/default: \{[\s\S]*const digit = Number\(event\.key\)[\s\S]*handleKeyboardOptionSelect\(option\.id\)/u,
	);
});

test("QuestionCard persists in-progress keyed answers across remounts", () => {
	assert.match(QUESTION_CARD_SOURCE, /toolCallId,/u);
	assert.match(QUESTION_CARD_SOURCE, /toolCallId,\s*onSubmit,/u);
	assert.match(QUESTION_CARD_SOURCE, /onClick=\{\(\) => goToNextQuestion\(\)\}/u);
	assert.match(QUESTION_CARD_SOURCE, /onClick=\{handleDismiss\}/u);

	assert.match(QUESTION_CARD_HOOK_SOURCE, /QUESTION_CARD_STORAGE_PREFIX = "vpk:question-card:"/u);
	assert.match(QUESTION_CARD_HOOK_SOURCE, /function readPersistedQuestionCardState/u);
	assert.match(QUESTION_CARD_HOOK_SOURCE, /window\.sessionStorage\.getItem\(storageKey\)/u);
	assert.match(QUESTION_CARD_HOOK_SOURCE, /function writePersistedQuestionCardState/u);
	assert.match(QUESTION_CARD_HOOK_SOURCE, /window\.sessionStorage\.setItem\(storageKey, JSON\.stringify\(state\)\)/u);
	assert.match(QUESTION_CARD_HOOK_SOURCE, /function clearPersistedQuestionCardState/u);
	assert.match(QUESTION_CARD_HOOK_SOURCE, /window\.sessionStorage\.removeItem\(storageKey\)/u);
	assert.match(QUESTION_CARD_HOOK_SOURCE, /questionSignature/u);
	assert.match(QUESTION_CARD_HOOK_SOURCE, /currentQuestionIndex/u);
	assert.match(QUESTION_CARD_HOOK_SOURCE, /persistQuestionCardState\(nextAnswers, nextIndex\)/u);
	// Submit clears persisted state via submitAnswers; the footer Submit path stamps any
	// unanswered (incl. paged-past) questions as skipped before submitting.
	assert.match(QUESTION_CARD_HOOK_SOURCE, /submitAnswers\(nextAnswers\)/u);
	assert.match(QUESTION_CARD_HOOK_SOURCE, /onSubmit: submitWithImplicitSkips/u);
});
