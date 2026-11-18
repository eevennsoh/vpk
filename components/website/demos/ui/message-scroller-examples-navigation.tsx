"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useMessageScroller, useMessageScrollerScrollable, useMessageScrollerVisibility } from "@/components/ui/message-scroller";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ExampleFrame, ExampleRows, savedMessages } from "@/components/website/demos/ui/message-scroller-examples-shared";

type OpeningPosition = "start" | "end" | "last-anchor";

export function MessageScrollerExampleOpeningPosition() {
	const [position, setPosition] = useState<OpeningPosition>("last-anchor");
	return (
		<ExampleFrame title="Opening Position" description="Choose where a saved transcript opens." defaultScrollPosition={position} controls={<ToggleGroup aria-label="Opening position" variant="outline" value={[position]} onValueChange={(values) => {
			if (values[0] === "start" || values[0] === "end" || values[0] === "last-anchor") setPosition(values[0]);
		}}><ToggleGroupItem value="start">Start</ToggleGroupItem><ToggleGroupItem value="end">End</ToggleGroupItem><ToggleGroupItem value="last-anchor">Last anchor</ToggleGroupItem></ToggleGroup>}>
			<ExampleRows messages={savedMessages} />
		</ExampleFrame>
	);
}

export function MessageScrollerExampleHistory() {
	const [showHistory, setShowHistory] = useState(false);
	const messages = savedMessages.map((message) => message.role === "assistant" ? {
		...message,
		text: `${message.text}\n\nWe will keep tracking the queue, review the next batch, and share a clear update with everyone involved.`,
	} : message);
	return (
		<ExampleFrame title="Load History" description="Prepend earlier messages without losing your place." controls={<Button onClick={() => setShowHistory((current) => !current)}>{showHistory ? "Reset history" : "Load History"}</Button>}>
			<ExampleRows messages={showHistory ? messages : messages.slice(4)} />
		</ExampleFrame>
	);
}

function CommandControls() {
	const { scrollToEnd, scrollToMessage, scrollToStart } = useMessageScroller();
	return (
		<>
			<Button variant="outline" onClick={() => scrollToStart({ behavior: "smooth" })}>Start</Button>
			<Button variant="outline" onClick={() => scrollToMessage("prompt-2", { behavior: "smooth" })}>Jump to message 2</Button>
			<Button variant="outline" onClick={() => scrollToEnd({ behavior: "smooth" })}>End</Button>
		</>
	);
}

export function MessageScrollerExampleCommands() {
	return (
		<ExampleFrame title="Commands" description="Drive the transcript with scroller commands." defaultScrollPosition="start" controls={<CommandControls />}>
			<ExampleRows messages={savedMessages} />
		</ExampleFrame>
	);
}

function OutlineControls() {
	const { currentAnchorId, visibleMessageIds } = useMessageScrollerVisibility();
	const { scrollToMessage } = useMessageScroller();
	const turns = savedMessages.filter((message) => message.anchor);
	return (
		<div className="flex min-w-0 flex-wrap items-center gap-2">
			{turns.map((message, index) => (
				<Button key={message.id} variant="outline" size="compact" aria-pressed={currentAnchorId === message.id} onClick={() => scrollToMessage(message.id, { behavior: "smooth" })}>Turn {index + 1}</Button>
			))}
			<span className="text-xs text-text-subtle">{visibleMessageIds.length} visible</span>
		</div>
	);
}

export function MessageScrollerExampleOutline() {
	return (
		<ExampleFrame title="Transcript Outline" description="Track and jump between anchored turns." defaultScrollPosition="start" controls={<OutlineControls />}>
			<ExampleRows messages={savedMessages} />
		</ExampleFrame>
	);
}

function ScrollStatus() {
	const { start, end } = useMessageScrollerScrollable();
	const label = start && end ? "More messages above and below" : start ? "At the latest message" : end ? "At the first message" : "All messages fit in the viewport";
	return <p aria-live="polite" className="text-sm text-text-subtle">{label}</p>;
}

export function MessageScrollerExampleStatus() {
	return (
		<ExampleFrame title="Scroll Status" description="See which directions the transcript can scroll." defaultScrollPosition="start" controls={<ScrollStatus />}>
			<ExampleRows messages={savedMessages} />
		</ExampleFrame>
	);
}
