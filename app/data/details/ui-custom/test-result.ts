import type { ComponentDetail } from "@/app/data/component-detail-types";

export const TEST_RESULT_DETAIL: ComponentDetail = {
	description:
		"A compound component for displaying test suite results with summary statistics, progress visualization, collapsible suites, individual test status indicators with duration, and error details with stack traces. Supports passed, failed, skipped, and running states with color-coded indicators.",
	usage: `import {
  TestResult,
  TestResultHeader,
  TestResultSummary,
  TestResultDuration,
  TestResultProgress,
  TestResultContent,
  TestSuite,
  TestSuiteName,
  TestSuiteStats,
  TestSuiteContent,
  Test,
  TestStatus,
  TestName,
  TestDuration,
  TestError,
  TestErrorMessage,
  TestErrorStack,
} from "@/components/ui-custom/test-result";

<TestResult summary={{ passed: 8, failed: 1, skipped: 0, total: 9, duration: 2340 }}>
  <TestResultHeader>
    <TestResultSummary />
    <TestResultDuration />
  </TestResultHeader>
  <TestResultProgress />
  <TestResultContent>
    <TestSuite name="utils.test.ts" status="failed" defaultOpen>
      <TestSuiteName />
      <TestSuiteContent>
        <Test name="adds numbers" status="passed" duration={12}>
          <TestStatus />
          <TestName />
          <TestDuration />
        </Test>
        <Test name="handles nulls" status="failed" duration={8}>
          <TestStatus />
          <TestName />
          <TestDuration />
        </Test>
      </TestSuiteContent>
    </TestSuite>
  </TestResultContent>
</TestResult>`,
	props: [
		{
			name: "summary",
			type: "{ passed: number; failed: number; skipped: number; total: number; duration?: number }",
			description: "Overall test run summary data. Consumed by TestResultSummary, TestResultDuration, and TestResultProgress via context.",
		},
		{
			name: "name",
			type: "string",
			description: "Test suite or individual test name. Used by TestSuite, TestSuiteName, Test, and TestName.",
		},
		{
			name: "status",
			type: '"passed" | "failed" | "skipped" | "running"',
			description: "Test status for TestSuite and Test. Controls the color-coded icon indicator.",
		},
		{
			name: "duration",
			type: "number",
			description: "Execution time in milliseconds. Used by Test and displayed via TestDuration.",
		},
		{
			name: "defaultOpen",
			type: "boolean",
			default: "false",
			description: "Initial collapsed state for TestSuite. Uses Collapsible under the hood.",
		},
		{
			name: "passed",
			type: "number",
			default: "0",
			description: "Passed test count for TestSuiteStats.",
		},
		{
			name: "failed",
			type: "number",
			default: "0",
			description: "Failed test count for TestSuiteStats.",
		},
		{
			name: "skipped",
			type: "number",
			default: "0",
			description: "Skipped test count for TestSuiteStats.",
		},
		{
			name: "className",
			type: "string",
			description: "Additional CSS classes applied to any sub-component.",
		},
	],
	subComponents: [
		{ name: "TestResult", description: "Root container and context provider. Renders children or a default header with summary and duration." },
		{ name: "TestResultHeader", description: "Flex header row for summary badges and duration." },
		{ name: "TestResultSummary", description: "Badge group showing passed/failed/skipped counts from context." },
		{ name: "TestResultDuration", description: "Total run duration from context, formatted as ms or seconds." },
		{ name: "TestResultProgress", description: "Stacked progress bar showing passed (green) and failed (red) proportions." },
		{ name: "TestResultContent", description: "Padded content area for test suites." },
		{ name: "TestSuite", description: "Collapsible test suite container with name and status context." },
		{ name: "TestSuiteName", description: "Collapsible trigger with chevron icon, status icon, and suite name." },
		{ name: "TestSuiteStats", description: "Inline passed/failed/skipped counts for a suite header." },
		{ name: "TestSuiteContent", description: "Collapsible content area with divided test rows." },
		{ name: "Test", description: "Individual test row with name, status, and optional duration context." },
		{ name: "TestStatus", description: "Color-coded status icon (check, x, circle, or pulsing dot)." },
		{ name: "TestName", description: "Test name text, falls back to context value." },
		{ name: "TestDuration", description: "Test execution time in milliseconds." },
		{ name: "TestError", description: "Error detail container with red background." },
		{ name: "TestErrorMessage", description: "Error message text in red." },
		{ name: "TestErrorStack", description: "Monospace stack trace display with horizontal scroll." },
	],
	examples: [
		{ title: "With progress", description: "Full test run with summary, duration, progress bar, suite stats, and individual test durations.", demoSlug: "test-result-demo-with-progress" },
		{ title: "With errors", description: "Failed tests with inline error messages and stack traces.", demoSlug: "test-result-demo-with-errors" },
		{ title: "Running", description: "In-progress test run with running status indicator and pending tests.", demoSlug: "test-result-demo-running" },
	],
};
