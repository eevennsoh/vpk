const test = require("node:test");
const assert = require("node:assert/strict");

const {
	buildGenerativeWidgetSubmitPrompt,
	formatGenerativeWidgetCardDescription,
} = require("./generative-widget.ts");

const DEFAULT_DESCRIPTION = "Generated from your request";

test("formatGenerativeWidgetCardDescription falls back to the default for empty or leaked text", () => {
	assert.equal(formatGenerativeWidgetCardDescription(""), DEFAULT_DESCRIPTION);
	assert.equal(formatGenerativeWidgetCardDescription("   "), DEFAULT_DESCRIPTION);
	assert.equal(
		formatGenerativeWidgetCardDescription("[System Instructions]a[End System Instructions]"),
		DEFAULT_DESCRIPTION
	);
	assert.equal(formatGenerativeWidgetCardDescription("You are a helpful assistant."), DEFAULT_DESCRIPTION);
});

test("formatGenerativeWidgetCardDescription strips assistant process leads", () => {
	assert.equal(
		formatGenerativeWidgetCardDescription("Let me fetch the latest Jira issues and summarize them."),
		"Latest Jira issues"
	);
	assert.equal(
		formatGenerativeWidgetCardDescription("I'll summarise the sprint report to show progress"),
		"Sprint report"
	);
	assert.equal(
		formatGenerativeWidgetCardDescription("I will now go fetch the calendar events so I can review the week"),
		"Calendar events"
	);
	assert.equal(
		formatGenerativeWidgetCardDescription("I am going to build a dashboard and then display it"),
		"Dashboard"
	);
});

test("formatGenerativeWidgetCardDescription keeps text when the lead leaves nothing behind", () => {
	assert.equal(formatGenerativeWidgetCardDescription("Let me"), "Let me");
});

test("formatGenerativeWidgetCardDescription prefers a first sentence of 24 to 96 characters", () => {
	assert.equal(
		formatGenerativeWidgetCardDescription("This sentence is long enough to count. And a second sentence follows here."),
		"This sentence is long enough to count."
	);
	assert.equal(
		formatGenerativeWidgetCardDescription("Short one. Then a much longer second sentence that keeps going."),
		"Short one. Then a much longer second sentence that keeps going."
	);
});

test("formatGenerativeWidgetCardDescription collapses whitespace and clips to 96 characters", () => {
	assert.equal(formatGenerativeWidgetCardDescription("Line one\n\n  line   two."), "Line one line two.");
	const clipped = formatGenerativeWidgetCardDescription("x".repeat(120));
	assert.equal(clipped, `${"x".repeat(95)}…`);
	assert.equal(clipped.length, 96);
});

test("buildGenerativeWidgetSubmitPrompt serialises the form state in a fenced JSON block", () => {
	assert.equal(
		buildGenerativeWidgetSubmitPrompt({
			widgetType: "genui-preview",
			actionLabel: "Submit",
			title: "Leave request",
			description: "Request time off",
			formState: { days: 2, reason: "Trip" },
		}),
		[
			"Please execute \"Submit\" for \"Leave request\".",
			"Context: Request time off",
			"Use these form values:",
			"```json",
			"{",
			"  \"days\": 2,",
			"  \"reason\": \"Trip\"",
			"}",
			"```",
		].join("\n")
	);
});

test("buildGenerativeWidgetSubmitPrompt writes an empty object when form state is missing", () => {
	assert.equal(
		buildGenerativeWidgetSubmitPrompt({ actionLabel: "Go", title: "T", description: "D" }),
		"Please execute \"Go\" for \"T\".\nContext: D\nUse these form values:\n```json\n{}\n```"
	);
});
