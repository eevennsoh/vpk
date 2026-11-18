"use client";

import { useChat } from "@ai-sdk/react";
import type { UIDataTypes, UIMessage } from "ai";

import { createChat, getMessageText } from "@/lib/ai";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Message, MessageContent } from "@/components/ui/message";
import {
	Test,
	TestResult,
	TestResultContent,
	TestResultHeader,
	TestResultSummary,
	TestSuite,
	TestSuiteContent,
	TestSuiteName,
} from "@/components/ui/test-results";
import { Trace } from "@/components/ui/trace";

type TestCase = {
	name: string;
	status: "passed" | "failed" | "skipped";
	error?: string;
};

type Suite = { name: string; tests: TestCase[] };

type ChatMessage = UIMessage<
	unknown,
	UIDataTypes,
	{
		runTests: {
			input: { command: string };
			output: { suites: Suite[] };
		};
	}
>;

type ToolPart = Extract<ChatMessage["parts"][number], { type: "tool-runTests" }>;

const chat = createChat<ChatMessage>()
	.user("Run the checkout tests.")
	.assistant(({ writer }) => {
		writer
			.tool("runTests", { input: { command: "pnpm test checkout" } })
			.sleep(1500)
			.output({
				suites: [
					{
						name: "cart.test.ts",
						tests: [
							{ name: "adds an item", status: "passed" },
							{ name: "removes an item", status: "passed" },
							{ name: "applies a discount code", status: "passed" },
						],
					},
					{
						name: "payment.test.ts",
						tests: [
							{ name: "charges the saved card", status: "passed" },
							{
								name: "retries a declined card",
								status: "failed",
								error: `Expected 2 charge attempts, received 1

  at Object.<anonymous> (src/payment.test.ts:58:22)`,
							},
						],
					},
				],
			});
		writer.text(
			"One test failed. The payment client does not retry a declined card, so the second charge attempt never happens.",
		);
	});

const transcript = chat.get();
const [question] = chat.get(1);
const transport = chat.transport({ delayMs: 20 });

function countTests(tests: TestCase[]) {
	const failed = tests.filter((test) => test.status === "failed").length;
	const skipped = tests.filter((test) => test.status === "skipped").length;

	return { total: tests.length, passed: tests.length - failed - skipped, failed, skipped };
}

function formatCounts({ total, failed, skipped }: ReturnType<typeof countTests>) {
	return [`${total} tests`, failed > 0 ? `${failed} failed` : null, skipped > 0 ? `${skipped} skipped` : null]
		.filter(Boolean)
		.join(", ");
}

function TestRun({
	suites,
	defaultOpen,
	openFailures,
	className,
}: Readonly<{ suites: Suite[]; defaultOpen: boolean; openFailures?: boolean; className?: string }>) {
	return (
		<TestResult
			summary={countTests(suites.flatMap((suite) => suite.tests))}
			defaultOpen={defaultOpen}
			className={className}
		>
			<TestResultHeader>
				<TestResultSummary />
			</TestResultHeader>
			<TestResultContent>
				{suites.map((suite) => {
					const counts = countTests(suite.tests);

					return (
						<TestSuite key={suite.name} name={suite.name} status={counts.failed > 0 ? "failed" : "passed"}>
							<TestSuiteName>
								{suite.name}, {formatCounts(counts)}
							</TestSuiteName>
							<TestSuiteContent>
								{suite.tests.map((test) => (
									<Test
										key={test.name}
										name={test.name}
										status={test.status}
										error={test.error}
										defaultOpen={openFailures}
									/>
								))}
							</TestSuiteContent>
						</TestSuite>
					);
				})}
			</TestResultContent>
		</TestResult>
	);
}

function TestResultsRow({ part, streaming }: Readonly<{ part: ToolPart; streaming: boolean }>) {
	const command = part.input?.command;

	if (part.state !== "output-available") {
		const running = streaming && part.state !== "output-error";

		return (
			<TestResult>
				<TestResultHeader status={running ? "running" : "error"}>
					<TestResultSummary>
						{running ? "Running" : "Failed to run"} {command}
					</TestResultSummary>
				</TestResultHeader>
			</TestResult>
		);
	}

	const { suites } = part.output;
	const failed = countTests(suites.flatMap((suite) => suite.tests)).failed > 0;

	return <TestRun suites={suites} defaultOpen={failed} openFailures />;
}

export default function TestResultsDemo() {
	const { messages, sendMessage, setMessages, status } = useChat({
		messages: transcript,
		transport,
	});
	const busy = status === "submitted" || status === "streaming";

	return (
		<div className="flex min-h-72 w-full max-w-sm flex-col gap-4 py-6 text-sm">
			{messages.map((message) => {
				if (message.role === "user") {
					return (
						<Message key={message.id} align="end">
							<MessageContent>
								<Bubble align="end" variant="muted">
									<BubbleContent>{getMessageText(message)}</BubbleContent>
								</Bubble>
							</MessageContent>
						</Message>
					);
				}

				const streaming = busy && message === messages.at(-1);
				const tools = message.parts.filter((part) => part.type === "tool-runTests");
				const text = getMessageText(message);

				return (
					<Message key={message.id}>
						<MessageContent className="gap-4">
							{tools.length > 0 ? (
								<Trace>
									{tools.map((part) => (
										<TestResultsRow key={part.toolCallId} part={part} streaming={streaming} />
									))}
								</Trace>
							) : null}
							{text ? <p>{text}</p> : null}
						</MessageContent>
					</Message>
				);
			})}
			{busy ? null : (
				<Button
					variant="outline"
					className="mt-auto self-start"
					onClick={() => {
						setMessages([]);
						void sendMessage(question);
					}}
				>
					Replay
				</Button>
			)}
		</div>
	);
}

const SUITES: Suite[] = [
	{
		name: "auth.test.ts",
		tests: [
			{ name: "logs in with valid credentials", status: "passed" },
			{ name: "rejects an invalid password", status: "passed" },
			{ name: "refreshes an expired token", status: "passed" },
		],
	},
	{
		name: "user-api.test.ts",
		tests: [
			{ name: "creates a user", status: "passed" },
			{
				name: "updates a user profile",
				status: "failed",
				error: `Expected status 200, received 500

  at Object.<anonymous> (src/user-api.test.ts:45:12)`,
			},
			{ name: "deletes a user", status: "skipped" },
		],
	},
	{
		name: "db.test.ts",
		tests: [
			{ name: "connects to the database", status: "passed" },
			{
				name: "times out a slow query",
				status: "failed",
				error: `Exceeded timeout of 5000 ms for a test.

  at Object.<anonymous> (src/db.test.ts:22:3)`,
			},
		],
	},
];

export function TestResultsSuites() {
	return <TestRun suites={SUITES} defaultOpen className="max-w-sm" />;
}
