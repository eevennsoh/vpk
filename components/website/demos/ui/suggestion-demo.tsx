"use client";

import { useRef, useState, type FormEvent } from "react";

import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupTextarea,
} from "@/components/ui/input-group";
import { Message, MessageContent } from "@/components/ui/message";
import { Suggestion, Suggestions } from "@/components/ui/suggestion";
import { ArrowUpIcon, PlusIcon } from "@/components/ui/vpk-icons";

const SUGGESTIONS = [
	"Add a dark mode toggle",
	"Fix the failing build",
	"Write tests for the form",
	"Upgrade to Next.js 16",
	"Add a loading state",
	"Find unused dependencies",
];

const REPLIES: Record<string, string> = {
	"Add a dark mode toggle":
		"Added a ModeToggle to the site header. It calls setTheme from next-themes.",
	"Fix the failing build":
		"The build failed on a missing import in app/page.tsx. I added it and the build passes.",
	"Write tests for the form":
		"Added four tests in signup-form.test.tsx. They cover the empty, invalid and valid states.",
	"Upgrade to Next.js 16":
		"Ran the codemod and bumped next to 16. Two routes needed async params, so I updated them.",
	"Add a loading state":
		"Added a loading.tsx to the dashboard route. It shows skeletons while the data loads.",
	"Find unused dependencies":
		"Three packages are not imported anywhere: lodash, moment and classnames. Should I remove them?",
};

const FOLLOW_UPS = [
	"Turn these ideas into a prioritized experiment shortlist",
	"Draft a rollout plan for the top idea",
];

type Turn = { prompt: string; reply: string };

export default function SuggestionDemo() {
	const [text, setText] = useState("");
	const [turn, setTurn] = useState<Turn | null>(null);
	const formRef = useRef<HTMLFormElement>(null);
	const canSend = text.trim().length > 0;

	const send = (prompt: string) => {
		setTurn({
			prompt,
			reply: REPLIES[prompt] ?? "This demo only knows the suggestions. Pick one.",
		});
		setText("");
	};

	const onSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (canSend) {
			send(text.trim());
		}
	};

	return (
		<div className="mx-auto flex w-full max-w-lg flex-col gap-6 py-6 text-sm">
			{turn ? (
				<div className="flex flex-col gap-4">
					<Message align="end">
						<MessageContent>
							<Bubble align="end">
								<BubbleContent>{turn.prompt}</BubbleContent>
							</Bubble>
						</MessageContent>
					</Message>
					<Message>
						<MessageContent>
							<p>{turn.reply}</p>
						</MessageContent>
					</Message>
				</div>
			) : null}
			<div className="flex flex-col gap-2">
				<Suggestions>
					{SUGGESTIONS.map((suggestion) => (
						<Suggestion key={suggestion} suggestion={suggestion} onClick={send} />
					))}
				</Suggestions>
				<form ref={formRef} onSubmit={onSubmit}>
					<InputGroup>
						<InputGroupTextarea
							value={text}
							onChange={(event) => setText(event.target.value)}
							placeholder="Ask the agent to change your code..."
							onKeyDown={(event) => {
								if (event.key === "Enter" && !event.shiftKey) {
									event.preventDefault();
									formRef.current?.requestSubmit();
								}
							}}
							className="p-3"
						/>
						<InputGroupAddon align="block-end">
							<InputGroupButton
								size="icon-sm"
								variant="outline"
								shape="circle"
								aria-label="Attach files"
							>
								<PlusIcon label="" />
							</InputGroupButton>
							<InputGroupButton
								type="submit"
								size="icon-sm"
								variant="default"
								shape="circle"
								className="ml-auto"
								disabled={!canSend}
								aria-label="Send"
							>
								<ArrowUpIcon label="" />
							</InputGroupButton>
						</InputGroupAddon>
					</InputGroup>
				</form>
			</div>
		</div>
	);
}

export function SuggestionDemoFollowUp() {
	const [sent, setSent] = useState<string | null>(null);

	return (
		<div className="flex w-full max-w-lg flex-col gap-3 text-sm">
			<p>If you want, I can:</p>
			<Suggestions orientation="vertical">
				{FOLLOW_UPS.map((suggestion) => (
					<Suggestion key={suggestion} suggestion={suggestion} onClick={setSent} />
				))}
			</Suggestions>
			<p aria-live="polite" className="text-xs text-text-subtlest">
				{sent ? `Sent: ${sent}` : null}
			</p>
		</div>
	);
}
