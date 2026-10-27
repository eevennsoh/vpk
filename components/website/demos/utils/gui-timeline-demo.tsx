"use client";

import { useEffect, useEffectEvent, useId } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GUI, useGUITimeline, type GUITimelineConfig } from "@/components/utils/gui";
import { useMediaQuery } from "@/hooks/use-media-query";
import { motionDuration, motionEase } from "@/lib/motion";

const entranceEase: [...typeof motionEase.inOut] = [...motionEase.inOut];
const contentEase: [...typeof motionEase.outPractical] = [...motionEase.outPractical];

const CARD_ENTRANCE_CONFIG = {
	duration: 1.2,
	Card: {
		at: 0,
		duration: motionDuration.slowest,
		from: { opacity: 0, y: 32 },
		to: { opacity: 1, y: 0 },
		transition: { type: "easing", duration: motionDuration.slowest, ease: entranceEase },
	},
	Title: {
		at: motionDuration.normal,
		duration: motionDuration.slower,
		from: { opacity: 0, y: 12 },
		to: { opacity: 1, y: 0 },
		transition: { type: "easing", duration: motionDuration.slower, ease: contentEase },
	},
	Details: {
		at: motionDuration.normal * 2,
		duration: motionDuration.slower,
		from: { opacity: 0, y: 8 },
		to: { opacity: 1, y: 0 },
		transition: { type: "easing", duration: motionDuration.slower, ease: contentEase },
	},
} satisfies GUITimelineConfig;

export default function GUITimelineDemo() {
	const id = useId();
	const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
	const timeline = useGUITimeline("Card entrance", CARD_ENTRANCE_CONFIG);
	const timelineId = timeline?.id;
	const initializePreview = useEffectEvent(() => {
		if (timeline) {
			timeline.pause();
			timeline.seek(timeline.duration);
		}
	});
	useEffect(() => {
		if (timelineId) initializePreview();
	}, [timelineId]);
	const card = reducedMotion
		? timeline?.Card.to ?? CARD_ENTRANCE_CONFIG.Card.to
		: timeline?.Card.current ?? CARD_ENTRANCE_CONFIG.Card.from;
	const title = reducedMotion
		? timeline?.Title.to ?? CARD_ENTRANCE_CONFIG.Title.to
		: timeline?.Title.current ?? CARD_ENTRANCE_CONFIG.Title.from;
	const details = reducedMotion
		? timeline?.Details.to ?? CARD_ENTRANCE_CONFIG.Details.to
		: timeline?.Details.current ?? CARD_ENTRANCE_CONFIG.Details.from;
	const duration = timeline?.duration ?? CARD_ENTRANCE_CONFIG.duration;
	const titleStart = timeline?.Title.at ?? CARD_ENTRANCE_CONFIG.Title.at;
	const maxTitleStart = Math.max(0, duration - (timeline?.Title.duration ?? CARD_ENTRANCE_CONFIG.Title.duration));

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-4" data-gui-timeline-demo>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="space-y-1">
					<h3 className="text-sm font-semibold text-text">Card entrance</h3>
					<p className="max-w-lg text-sm text-text-subtle">Tune three staggered tracks, then scrub to inspect any frame.</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button
						variant="outline"
						disabled={!timeline || Boolean(reducedMotion)}
						onClick={() => timeline?.playing ? timeline.pause() : timeline?.play()}
					>
						{timeline?.playing ? "Pause preview" : "Play preview"}
					</Button>
					<Button variant="outline" disabled={!timeline || Boolean(reducedMotion)} onClick={() => timeline?.replay()}>Replay preview</Button>
					<Button variant="outline" disabled={!timeline} onClick={() => timeline?.reset()}>Reset timeline</Button>
				</div>
			</div>
			<div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
				<div className="flex min-h-80 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface p-8" role="group" aria-label="Card entrance preview">
					<Card
						className="w-80 max-w-full"
						data-timeline-preview="card"
						style={{ opacity: card.opacity, transform: `translateY(${card.y}px)`, willChange: timeline?.playing ? "transform, opacity" : undefined }}
					>
						<CardHeader style={{ opacity: title.opacity, transform: `translateY(${title.y}px)`, willChange: timeline?.playing ? "transform, opacity" : undefined }} data-timeline-preview="title">
							<CardDescription>Venn Prototype Kit</CardDescription>
							<CardTitle>Make the next move</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4" style={{ opacity: details.opacity, transform: `translateY(${details.y}px)`, willChange: timeline?.playing ? "transform, opacity" : undefined }} data-timeline-preview="details">
							<p className="text-sm text-text-subtle">Bring your team&apos;s ideas into focus, one detail at a time.</p>
							<div className="flex items-center justify-between border-t border-border pt-4 text-xs text-text-subtle"><span>Card · Title · Details</span><span>Ready to explore</span></div>
						</CardContent>
					</Card>
				</div>
				<GUI.Panel title="Timeline controls" values={{ playhead: timeline?.time ?? 0, titleStart }}>
					<GUI.Control
						id={`${id}-playhead`}
						label="Playhead"
						value={timeline?.time ?? 0}
						min={0}
						max={duration}
						step={0.01}
						unit="s"
						disabled={!timeline}
						valueKeys="playhead"
						onChange={(time) => {
							timeline?.pause();
							timeline?.seek(time);
						}}
					/>
					<GUI.Control
						id={`${id}-title-start`}
						label="Title start"
						value={titleStart}
						defaultValue={CARD_ENTRANCE_CONFIG.Title.at}
						min={0}
						max={maxTitleStart}
						step={0.01}
						unit="s"
						disabled={!timeline}
						valueKeys="titleStart"
						onChange={(at) => timeline?.setValue("Title.at", Math.min(maxTitleStart, Math.max(0, at)))}
					/>
				</GUI.Panel>
			</div>
			<GUI.Timeline id={`${id}-editor`} label="Card entrance timeline" defaultOpen />
			<p className="text-xs leading-5 text-text-subtle">Drag clips to change their start time and drag their edges to change duration. Select a clip to edit its values and curve. Use the version menu to save a variation, or Copy parameters to export your settings.</p>
			{reducedMotion ? <p className="text-xs text-text-subtle" role="status">Reduced motion is enabled. The preview shows its completed state; timing controls remain available.</p> : null}
		</div>
	);
}
