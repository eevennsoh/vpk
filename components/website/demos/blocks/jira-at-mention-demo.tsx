"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { DEFAULT_MENTION_FLIGHT_OPTIONS, useSessionMentionFlight, type MentionFlightOptions, type MentionFlightRequest, type MentionFlightSettlement } from "@/components/blocks/jira-at-mention";
import { AgentAvatarVisual } from "@/components/ui-custom/agent-avatar-visual";
import { RovoGeneration } from "@/components/ui-custom/rovo-generation";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { GUI } from "@/components/utils/gui";
import { motionDuration } from "@/lib/motion";
import "@/components/ui-custom/rich-text-editor/rich-text-editor.css";

const TRACE_COLOR = "#d97757";
const TRACE_DURATION = motionDuration.slowest * 2;

function MentionChip() {
	return <Tag className="rich-text-mention-chip text-[length:inherit]" color="gray" variant="editor" type="agent" elemBefore={<AgentAvatarVisual avatarClassName="after:border-0" brandName="claude" fallbackText="Claude" sizePx={16} />}>Claude</Tag>;
}

export default function JiraAtMentionDemo() {
	const id = useId();
	const bodyRef = useRef<HTMLDivElement>(null);
	const sourceRef = useRef<HTMLSpanElement>(null);
	const replyRef = useRef<HTMLDivElement>(null);
	const focusOriginRef = useRef<Element | null>(null);
	const [options, setOptions] = useState<MentionFlightOptions>(DEFAULT_MENTION_FLIGHT_OPTIONS);
	const [traceDuration, setTraceDuration] = useState(TRACE_DURATION);
	const [traceColor, setTraceColor] = useState(TRACE_COLOR);
	const [traceEnabled, setTraceEnabled] = useState(true);
	const [request, setRequest] = useState<MentionFlightRequest | null>(null);
	const [settled, setSettled] = useState<{ id: number; reason?: MentionFlightSettlement } | null>(null);
	const [traceId, setTraceId] = useState<number | null>(null);
	const flight = useSessionMentionFlight(bodyRef, request, true, (requestId) => setTraceId(requestId), (requestId, reason) => setSettled({ id: requestId, reason }));
	const landed = request !== null && settled?.id === request.id;
	const started = request !== null;
	useLayoutEffect(() => {
		const reply = replyRef.current;
		if (!reply || settled?.id !== request?.id || settled?.reason !== "landed" || document.activeElement !== focusOriginRef.current) return;
		reply.focus({ preventScroll: true });
		const selection = reply.ownerDocument.getSelection();
		const range = reply.ownerDocument.createRange();
		const last = reply.lastChild;
		if (last?.nodeType === Node.TEXT_NODE) range.setStart(last, last.textContent?.length ?? 0);
		else { range.selectNodeContents(reply); range.collapse(false); }
		range.collapse(true);
		selection?.removeAllRanges();
		selection?.addRange(range);
	}, [request, settled]);
	function replay() {
		const chip = sourceRef.current?.querySelector<HTMLElement>(".rich-text-mention-chip");
		if (!chip) return;
		const clone = chip.cloneNode(true);
		if (!(clone instanceof HTMLElement)) return;
		const appearance = getComputedStyle(chip);
		Object.assign(clone.style, { fontFamily: appearance.fontFamily, fontSize: appearance.fontSize });
		focusOriginRef.current = document.activeElement;
		setTraceId(null);
		setRequest((previous) => ({ id: (previous?.id ?? 0) + 1, entryId: "reply", source: { chip: clone, rect: chip.getBoundingClientRect() }, options }));
	}
	function updateOption<K extends keyof MentionFlightOptions>(key: K, value: MentionFlightOptions[K]) {
		setOptions((current) => ({ ...current, [key]: value }));
	}
	return (
		<div className="mx-auto grid w-full max-w-5xl gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_20rem]" data-jira-at-mention-demo>
			<div className="flex min-h-96 flex-col justify-between gap-8 rounded-lg bg-surface p-6" ref={bodyRef}>
				{flight}
				<div data-jira-activity-entry-id="reply">
					<p className="mb-2 text-sm font-medium text-text-subtle">Inline reply</p>
					<RovoGeneration.Highlight active={traceEnabled && traceId === request?.id} className="block w-full" color={traceColor} delay={0} duration={traceDuration} origin="left-center" onHighlightComplete={() => setTraceId(null)}>
						<div className="min-h-24 rounded-lg border border-border bg-surface p-3 has-[:focus-visible]:border-ring has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50" data-project-butter-comment-editor>
							<div aria-label="Inline reply" className="rich-text-mention-caret min-h-12 outline-none" contentEditable ref={replyRef} suppressContentEditableWarning role="textbox">
								<span aria-hidden={!landed} contentEditable={false} data-mention-caret-anchor style={{ opacity: landed ? 1 : 0 }}><MentionChip /></span>{"\u00a0"}
							</div>
						</div>
					</RovoGeneration.Highlight>
				</div>
				<div data-project-butter-comment-bar>
					<p className="mb-2 text-sm font-medium text-text-subtle">Comment</p>
					<div className="flex min-h-12 items-center rounded-lg border border-border bg-surface px-3">
						<span aria-hidden={started} ref={sourceRef} style={{ opacity: started ? 0 : 1 }}><MentionChip /></span>
					</div>
					<Button className="mt-4" onClick={replay} type="button">Replay animation</Button>
				</div>
			</div>
			<GUI.Panel title="Animation and effect" values={{ ...options, traceEnabled, traceDuration, traceColor }} onPlay={replay}>
				<GUI.Section title="Mention flight" borderTop={false}>
					<GUI.Control id={`${id}-duration`} label="Duration" value={options.durationMs} defaultValue={DEFAULT_MENTION_FLIGHT_OPTIONS.durationMs} min={100} max={2000} step={10} unit="ms" onChange={(value) => updateOption("durationMs", value)} valueKeys="durationMs" />
					<GUI.Control id={`${id}-arc`} label="Arc" value={options.arc} defaultValue={DEFAULT_MENTION_FLIGHT_OPTIONS.arc} min={0} max={0.5} step={0.01} onChange={(value) => updateOption("arc", value)} valueKeys="arc" />
					<GUI.Control id={`${id}-lift`} label="Lift scale" value={options.lift} defaultValue={DEFAULT_MENTION_FLIGHT_OPTIONS.lift} min={0} max={0.5} step={0.01} onChange={(value) => updateOption("lift", value)} valueKeys="lift" />
					<GUI.Control id={`${id}-overshoot`} label="Overshoot" value={options.overshoot} defaultValue={DEFAULT_MENTION_FLIGHT_OPTIONS.overshoot} min={0} max={0.3} step={0.01} onChange={(value) => updateOption("overshoot", value)} valueKeys="overshoot" />
					<GUI.Toggle id={`${id}-shadow`} label="Flight shadow" checked={options.shadow} onChange={(value) => updateOption("shadow", value)} valueKeys="shadow" />
				</GUI.Section>
				<GUI.Section title="Reply highlight">
					<GUI.Toggle id={`${id}-trace`} label="Highlight" checked={traceEnabled} onChange={setTraceEnabled} valueKeys="traceEnabled" />
					{traceEnabled ? <>
						<GUI.Control id={`${id}-trace-start`} label="Start during flight" value={options.traceOffset} defaultValue={DEFAULT_MENTION_FLIGHT_OPTIONS.traceOffset} min={0} max={0.95} step={0.01} onChange={(value) => updateOption("traceOffset", value)} valueKeys="traceOffset" />
						<GUI.Control id={`${id}-trace-duration`} label="Duration" value={traceDuration} defaultValue={TRACE_DURATION} min={0.1} max={3} step={0.1} unit="s" onChange={setTraceDuration} valueKeys="traceDuration" />
						<GUI.ColorInput id={`${id}-trace-color`} label="Color" value={traceColor} defaultValue={TRACE_COLOR} onChange={setTraceColor} valueKeys="traceColor" />
					</> : null}
				</GUI.Section>
			</GUI.Panel>
		</div>
	);
}
