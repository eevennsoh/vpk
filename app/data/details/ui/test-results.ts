import type { ComponentDetail } from "@/app/data/component-detail-types";

export const TEST_RESULTS_DETAIL: ComponentDetail = {
	description:
		"A test run by the agent. Test Results is a collapsible Trace: the summary line counts what passed and failed, and opening it shows each suite, its tests, and the error for each failure.",
	usage: `import {
  Test,
  TestError,
  TestErrorMessage,
  TestErrorStack,
  TestResult,
  TestResultContent,
  TestResultDuration,
  TestResultHeader,
  TestResultSummary,
  TestSuite,
  TestSuiteContent,
  TestSuiteName,
} from "@/components/ui/test-results";

<TestResult summary={{ passed: 1, failed: 1, skipped: 0, total: 2, duration: 840 }}>
  <TestResultHeader>
    <TestResultSummary />
    <TestResultDuration />
  </TestResultHeader>
  <TestResultContent>
    <TestSuite name="user-api.test.ts" status="failed">
      <TestSuiteName />
      <TestSuiteContent>
        <Test name="creates a user" status="passed" />
        <Test name="updates a user profile" status="failed" />
        <TestError>
          <TestErrorMessage>Expected status 200, received 500</TestErrorMessage>
          <TestErrorStack>at Object.&lt;anonymous&gt; (src/user-api.test.ts:45:12)</TestErrorStack>
        </TestError>
      </TestSuiteContent>
    </TestSuite>
  </TestResultContent>
</TestResult>`,
	props: [
		{
			name: "summary",
			type: "{ passed: number; failed: number; skipped: number; total: number; duration?: number }",
			description: "TestResult only. Counts for the summary line, like “Ran 42 tests, 2 failed”.",
		},
		{
			name: "open / defaultOpen / onOpenChange",
			type: "boolean / boolean / (open: boolean) => void",
			default: "defaultOpen: true",
			description: "TestResult only. Whether the suites are shown.",
		},
		{
			name: "name / status",
			type: 'string / "passed" | "failed" | "skipped" | "running"',
			required: true,
			description: "TestSuite and Test. A failed suite starts open; a failed test sets its line to error.",
		},
		{
			name: "duration",
			type: "number",
			description: "Test only. Milliseconds, shown after the name.",
		},
		{
			name: "error",
			type: "ReactNode",
			description: "Test only. The failure; makes the test a collapsible line that opens on a TestError.",
		},
		{
			name: "defaultOpen",
			type: "boolean",
			description: "Test only, with error. Whether the failure starts open.",
		},
		{
			name: "status",
			type: '"running" | "error" | "pending"',
			description: "TestResultHeader only. Overrides the line status (error when a test failed).",
		},
	],
	subComponents: [
		{ name: "TestResult", description: "Trace with a TraceCollapsible for the run." },
		{
			name: "TestResultHeader",
			description: "TraceCollapsibleTrigger with a TraceLine, error when a test failed; a plain line before there is a summary.",
		},
		{ name: "TestResultSummary", description: "TraceTitle with the counts, or its children." },
		{ name: "TestResultDuration", description: "Run duration as a TraceDescription." },
		{ name: "TestResultProgress", description: "Pass/fail progress bar." },
		{ name: "TestResultContent", description: "TraceCollapsibleContent with a Trace of suites." },
		{ name: "TestSuite", description: "TraceCollapsible for one file, open when it has a failure." },
		{ name: "TestSuiteName", description: "TraceCollapsibleTrigger with the suite name." },
		{ name: "TestSuiteStats", description: "Passed, failed and skipped counts for a suite." },
		{ name: "TestSuiteContent", description: "TraceCollapsibleContent with a Trace of tests." },
		{ name: "Test", description: "TraceLine for one test; collapsible when it has an error." },
		{ name: "TestStatus", description: "TraceIcon for the test status." },
		{ name: "TestName", description: "TraceTitle with the test name." },
		{ name: "TestDuration", description: "Test duration as a TraceDescription." },
		{ name: "TestError", description: "Small Code Block for a failure." },
		{ name: "TestErrorMessage", description: "The failure message." },
		{ name: "TestErrorStack", description: "The failure's stack." },
	],
	examples: [{ title: "Suites", demoSlug: "test-results-demo-suites" }],
};
