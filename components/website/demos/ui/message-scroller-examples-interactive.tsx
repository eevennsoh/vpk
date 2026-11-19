"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { MessageScrollerItem } from "@/components/ui/message-scroller";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { motionDuration, motionEase } from "@/lib/motion";
import { ExampleFrame, ExampleMessageContent, ExampleRows, type ExampleMessage } from "@/components/website/demos/ui/message-scroller-examples-shared";
import { MotionMessageScrollerItem } from "@/components/website/demos/ui/message-scroller-examples-motion";

const firstExchange: ExampleMessage[] = [
	{ id: "first-user", role: "user", text: "How can we keep context visible in a long conversation?", anchor: true },
	{ id: "first-reply", role: "assistant", text: "Keep a small part of the preceding reply visible above the new turn. That gives the reader a useful reminder of where they were." },
];

function RolePicker({ role, onChange }: Readonly<{ role: "user" | "assistant"; onChange: (role: "user" | "assistant") => void }>) {
	return (
		<ToggleGroup aria-label="Anchor role" value={[role]} onValueChange={(values) => {
			if (values[0] === "user" || values[0] === "assistant") onChange(values[0]);
		}} variant="outline">
			<ToggleGroupItem value="user">User</ToggleGroupItem>
			<ToggleGroupItem value="assistant">Assistant</ToggleGroupItem>
		</ToggleGroup>
	);
}

export function MessageScrollerExampleAnchoring() {
	const [role, setRole] = useState<"user" | "assistant">("user");
	const [messages, setMessages] = useState<ExampleMessage[]>([]);
	function send() {
		const turn = messages.length / 2 + 1;
		setMessages((current) => [...current,
			{ id: `user-${turn}`, role: "user", text: `Question ${turn}: where should this turn start?`, anchor: role === "user" },
			{ id: `assistant-${turn}`, role: "assistant", text: "The selected row becomes the anchor. Try changing the role and sending another turn to compare.", anchor: role === "assistant" },
		]);
	}
	return (
		<ExampleFrame title="Anchoring Turns" description="Choose which role settles near the top edge." autoScroll controls={<><RolePicker role={role} onChange={setRole} /><Button onClick={send}>Send Message</Button></>}>
			{messages.length ? <ExampleRows messages={messages} /> : <MessageScrollerItem><p className="text-sm text-text-subtle">Send the first message to see the selected role anchor.</p></MessageScrollerItem>}
		</ExampleFrame>
	);
}

export function MessageScrollerExampleGroupChat() {
	const [joined, setJoined] = useState(false);
	const messages: ExampleMessage[] = [
		{ id: "group-user", role: "user", name: "You", text: "Mary, can you check the latest results?" },
		{ id: "group-mary", role: "assistant", name: "Mary (Agent)", text: "The measurements agree. Let's ask Rocky to review the remaining detail." },
		...(joined ? [
			{ id: "rocky-joined", role: "marker" as const, text: "Rocky joined the chat", anchor: true },
			{ id: "rocky-reply", role: "assistant" as const, name: "Rocky", text: "I can review the remaining measurements." },
		] : []),
	];
	return (
		<ExampleFrame title="Group Chat" description="A join marker can anchor a new turn." autoScroll controls={<Button onClick={() => setJoined((current) => !current)}>{joined ? "Reset group" : "Add Rocky"}</Button>}>
			<ExampleRows messages={messages} />
		</ExampleFrame>
	);
}

export function MessageScrollerExampleContext() {
	const [peek, setPeek] = useState(64);
	const [messages, setMessages] = useState(firstExchange);
	function send() {
		const turn = messages.length / 2 + 1;
		setMessages((current) => [...current,
			{ id: `context-user-${turn}`, role: "user", text: `Show me the next step in turn ${turn}.`, anchor: true },
			{ id: `context-reply-${turn}`, role: "assistant", text: "The previous reply remains in view above this turn. Adjust the slider to change how much context stays visible." },
		]);
	}
	return (
		<ExampleFrame title="Keeping Context Visible" description="Adjust how much of the preceding message remains visible." autoScroll scrollPreviousItemPeek={peek} controls={<><span className="shrink-0 text-sm tabular-nums">{peek}px</span><Slider aria-label="Previous message peek" min={0} max={160} step={8} value={peek} onValueChange={(value) => setPeek(Array.isArray(value) ? value[0] : value)} /><Button onClick={send}>Send</Button></>}>
			<ExampleRows messages={messages} />
		</ExampleFrame>
	);
}

const streamChunks = [
	"Here's a launch summary. ",
	"The first release is ready for a small group of customers. We will start with a limited audience and check that onboarding works before making it available to everyone.\n\n",
	"We will watch activation, errors, and feedback throughout the rollout. The dashboard will show each step, and the team will compare the results with the previous experience.\n\n",
	"Support has the handoff notes, and the team will review the results before expanding access. Each reported issue will have an owner and a clear path for escalation.\n\n",
	"If the signal stays healthy, the next group can join after the initial review. ",
	"The team will compare the new experience with the existing flow and look for unexpected changes in completion rates. ",
	"We have a clear owner for each follow-up and a shared dashboard that shows the rollout's progress. ",
	"Scroll up while this response grows to see how the scroller preserves your place. ",
	"Use the arrow to return to the latest response and resume following. ",
	"If feedback points to a problem, we can pause the rollout while the team investigates. ",
	"The support handoff includes the known limitations and the best way to reach the team. ",
	"The rollout owner will share the next update after the review.",
];

export function MessageScrollerExampleStreaming() {
	const [messages, setMessages] = useState<ExampleMessage[]>([]);
	const [step, setStep] = useState<number | null>(null);
	useEffect(() => {
		if (step === null) return;
		if (step >= streamChunks.length) return;
		const timer = window.setTimeout(() => {
			setMessages((current) => current.map((message) => message.id === "stream-reply" ? { ...message, text: message.text + streamChunks[step] } : message));
			setStep(step + 1 === streamChunks.length ? null : step + 1);
		}, 500);
		return () => window.clearTimeout(timer);
	}, [step]);
	function start() {
		setMessages([
			{ id: "stream-user", role: "user", text: "Summarize the launch plan.", anchor: true },
			{ id: "stream-reply", role: "assistant", text: "" },
		]);
		setStep(0);
	}
	return (
		<ExampleFrame title="Streaming Messages" description="Follow the live edge, or scroll away to keep your place." autoScroll busy={step !== null} controls={<Button onClick={step === null ? start : () => setStep(null)}>{step === null ? "Send" : "Stop"}</Button>}>
			{messages.length ? <ExampleRows messages={messages} /> : <MessageScrollerItem><p className="text-sm text-text-subtle">Press Send to stream a scripted launch summary.</p></MessageScrollerItem>}
		</ExampleFrame>
	);
}

const entrances = [
	{ value: "fade", label: "Fade", initial: { opacity: 0 }, animate: { opacity: 1 } },
	{ value: "slide-up", label: "Slide Up", initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } },
	{ value: "slide-side", label: "Slide Side", initial: { opacity: 0, x: 18 }, animate: { opacity: 1, x: 0 } },
	{ value: "pop", label: "Pop", initial: { opacity: 0, scale: 0.94, y: 6, originX: 1, originY: 1 }, animate: { opacity: 1, scale: 1, y: 0 } },
	{ value: "spring-bounce", label: "Spring Bounce", initial: { opacity: 0, y: 12, scale: 0.96 }, animate: { opacity: 1, y: 0, scale: 1 } },
	{ value: "blur-fade", label: "Blur Fade", initial: { opacity: 0, filter: "blur(4px)", y: 6 }, animate: { opacity: 1, filter: "blur(0px)", y: 0 } },
	{ value: "scale-fade", label: "Scale Fade", initial: { opacity: 0, scale: 0.98 }, animate: { opacity: 1, scale: 1 } },
] as const;

type Entrance = (typeof entrances)[number]["value"];
type AnimatedMessage = ExampleMessage & { entrance?: Entrance };

export function MessageScrollerExampleAnimation() {
	const [animation, setAnimation] = useState<Entrance>("fade");
	const [messages, setMessages] = useState<AnimatedMessage[]>([]);
	const reducedMotion = useReducedMotion();
	function send() {
		const turn = messages.length / 2 + 1;
		setMessages((current) => [...current,
			{ id: `animated-user-${turn}`, role: "user", text: `Send message ${turn}`, anchor: true, entrance: animation },
			{ id: `animated-reply-${turn}`, role: "assistant", text: "The new user message enters while the scroller keeps the turn in view." },
		]);
	}
	return (
		<ExampleFrame title="Animation" description="Choose an entrance for new user messages." autoScroll controls={<>
			<Select value={animation} items={entrances} onValueChange={(value) => { const selected = entrances.find((entry) => entry.value === value); if (selected) setAnimation(selected.value); }}>
				<SelectTrigger aria-label="Animation preset"><SelectValue /></SelectTrigger>
				<SelectContent side="top" align="start" alignItemWithTrigger={false}><SelectGroup>{entrances.map((entry) => <SelectItem key={entry.value} value={entry.value}>{entry.label}</SelectItem>)}</SelectGroup></SelectContent>
			</Select>
			<Button onClick={send}>Send Message</Button>
		</>}>
			{messages.length ? messages.map((message) => {
				const preset = entrances.find((entry) => entry.value === message.entrance);
				if (!preset) return <MessageScrollerItem key={message.id} messageId={message.id}><ExampleMessageContent message={message} /></MessageScrollerItem>;
				const transition = preset.value === "pop"
					? { type: "spring" as const, stiffness: 500, damping: 34, mass: 0.7 }
					: preset.value === "spring-bounce"
						? { type: "spring" as const, stiffness: 520, damping: 30, mass: 0.7 }
						: { duration: preset.value === "fade" ? motionDuration.medium : motionDuration.slow, ease: motionEase.out };
				return (
					<MotionMessageScrollerItem key={message.id} messageId={message.id} scrollAnchor={message.anchor} initial={reducedMotion ? false : preset.initial} animate={preset.animate} transition={transition}>
						<ExampleMessageContent message={message} />
					</MotionMessageScrollerItem>
				);
			}) : <MessageScrollerItem><p className="text-sm text-text-subtle">Send a message to see its entrance.</p></MessageScrollerItem>}
		</ExampleFrame>
	);
}
