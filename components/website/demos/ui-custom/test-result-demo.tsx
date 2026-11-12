import {
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

export default function TestResultDemo() {
	return (
		<TestResult summary={{ passed: 2, failed: 1, skipped: 0, total: 3 }} className="w-full">
			<TestResultHeader>
				<TestResultSummary />
			</TestResultHeader>
			<TestResultContent>
				<TestSuite name="utils.test.ts" status="failed" defaultOpen>
					<TestSuiteName />
					<TestSuiteContent>
						<Test name="adds numbers" status="passed">
							<TestStatus />
							<TestName />
						</Test>
						<Test name="handles nulls" status="failed">
							<TestStatus />
							<TestName />
						</Test>
					</TestSuiteContent>
				</TestSuite>
			</TestResultContent>
		</TestResult>
	);
}

export function TestResultDemoWithProgress() {
	return (
		<TestResult
			summary={{ passed: 18, failed: 2, skipped: 1, total: 21, duration: 4230 }}
			className="w-full"
		>
			<TestResultHeader>
				<TestResultSummary />
				<TestResultDuration />
			</TestResultHeader>
			<TestResultProgress />
			<TestResultContent>
				<TestSuite name="auth.test.ts" status="passed">
					<TestSuiteName>
						auth.test.ts
						<TestSuiteStats passed={8} />
					</TestSuiteName>
					<TestSuiteContent>
						<Test name="login with valid credentials" status="passed" duration={120}>
							<TestStatus />
							<TestName />
							<TestDuration />
						</Test>
						<Test name="rejects invalid password" status="passed" duration={45}>
							<TestStatus />
							<TestName />
							<TestDuration />
						</Test>
					</TestSuiteContent>
				</TestSuite>
				<TestSuite name="api.test.ts" status="failed" defaultOpen>
					<TestSuiteName>
						api.test.ts
						<TestSuiteStats passed={10} failed={2} skipped={1} />
					</TestSuiteName>
					<TestSuiteContent>
						<Test name="fetches user profile" status="passed" duration={230}>
							<TestStatus />
							<TestName />
							<TestDuration />
						</Test>
						<Test name="handles timeout" status="failed" duration={5001}>
							<TestStatus />
							<TestName />
							<TestDuration />
						</Test>
						<Test name="retries on 503" status="skipped">
							<TestStatus />
							<TestName />
						</Test>
					</TestSuiteContent>
				</TestSuite>
			</TestResultContent>
		</TestResult>
	);
}

export function TestResultDemoWithErrors() {
	return (
		<TestResult
			summary={{ passed: 5, failed: 2, skipped: 0, total: 7, duration: 1840 }}
			className="w-full"
		>
			<TestResultHeader>
				<TestResultSummary />
				<TestResultDuration />
			</TestResultHeader>
			<TestResultContent>
				<TestSuite name="validation.test.ts" status="failed" defaultOpen>
					<TestSuiteName>
						validation.test.ts
						<TestSuiteStats passed={3} failed={2} />
					</TestSuiteName>
					<TestSuiteContent>
						<Test name="validates email format" status="passed" duration={12}>
							<TestStatus />
							<TestName />
							<TestDuration />
						</Test>
						<Test name="rejects empty input" status="failed" duration={8}>
							<TestStatus />
							<TestName />
							<TestDuration />
						</Test>
						<TestError>
							<TestErrorMessage>
								AssertionError: expected validate(&quot;&quot;) to throw, but it returned undefined
							</TestErrorMessage>
							<TestErrorStack>{`  at Object.<anonymous> (src/validation.test.ts:24:5)
  at processTicksAndRejections (node:internal/process/task_queues:95:5)`}</TestErrorStack>
						</TestError>
						<Test name="handles unicode characters" status="failed" duration={15}>
							<TestStatus />
							<TestName />
							<TestDuration />
						</Test>
						<TestError>
							<TestErrorMessage>
								TypeError: Cannot read properties of undefined (reading &apos;normalize&apos;)
							</TestErrorMessage>
							<TestErrorStack>{`  at normalizeInput (src/validation.ts:18:12)
  at validate (src/validation.ts:42:15)
  at Object.<anonymous> (src/validation.test.ts:31:5)`}</TestErrorStack>
						</TestError>
					</TestSuiteContent>
				</TestSuite>
				<TestSuite name="utils.test.ts" status="passed">
					<TestSuiteName>
						utils.test.ts
						<TestSuiteStats passed={2} />
					</TestSuiteName>
					<TestSuiteContent>
						<Test name="formats currency" status="passed" duration={3}>
							<TestStatus />
							<TestName />
							<TestDuration />
						</Test>
						<Test name="parses date string" status="passed" duration={5}>
							<TestStatus />
							<TestName />
							<TestDuration />
						</Test>
					</TestSuiteContent>
				</TestSuite>
			</TestResultContent>
		</TestResult>
	);
}

export function TestResultDemoRunning() {
	return (
		<TestResult
			summary={{ passed: 3, failed: 0, skipped: 0, total: 6, duration: 890 }}
			className="w-full"
		>
			<TestResultHeader>
				<TestResultSummary />
				<TestResultDuration />
			</TestResultHeader>
			<TestResultProgress />
			<TestResultContent>
				<TestSuite name="database.test.ts" status="running" defaultOpen>
					<TestSuiteName>
						database.test.ts
						<TestSuiteStats passed={3} />
					</TestSuiteName>
					<TestSuiteContent>
						<Test name="connects to database" status="passed" duration={340}>
							<TestStatus />
							<TestName />
							<TestDuration />
						</Test>
						<Test name="inserts records" status="passed" duration={210}>
							<TestStatus />
							<TestName />
							<TestDuration />
						</Test>
						<Test name="queries with filters" status="passed" duration={340}>
							<TestStatus />
							<TestName />
							<TestDuration />
						</Test>
						<Test name="handles transactions" status="running">
							<TestStatus />
							<TestName />
						</Test>
						<Test name="concurrent writes" status="skipped">
							<TestStatus />
							<TestName />
						</Test>
						<Test name="cleanup on disconnect" status="skipped">
							<TestStatus />
							<TestName />
						</Test>
					</TestSuiteContent>
				</TestSuite>
			</TestResultContent>
		</TestResult>
	);
}
