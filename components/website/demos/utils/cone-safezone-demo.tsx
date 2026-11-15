"use client";

import { useId, useState } from "react";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ConeSafezone, ConeSafezoneContent, ConeSafezoneTrigger } from "@/components/utils/cone-safezone";
import { JiraSessionFlyoutCard } from "@/components/blocks/product-sidebar/variants/jira-session-flyout-card";
import { SMART_LINK_VARIANT_EXAMPLES } from "@/components/blocks/smart-link/data/demo-smart-links";

function PreviewDetails() {
	const [reviewed, setReviewed] = useState(false);
	return (
		<div className="flex flex-col gap-3">
			<h3 className="text-sm font-semibold">Release notes</h3>
			<p className="text-sm text-text-subtle">Move diagonally into this card. The pointer corridor follows its resolved position.</p>
			<Button onClick={() => setReviewed(!reviewed)} variant="outline">{reviewed ? "Undo review" : "Mark reviewed"}</Button>
			<p className="text-xs text-text-subtle" role="status">{reviewed ? "Review complete" : "Ready for review"}</p>
		</div>
	);
}

export default function ConeSafezoneDemo() {
	const [debug, setDebug] = useState(true);
	const switchId = useId();
	const titleId = useId();
	return (
		<div className="min-h-[440px] w-full bg-surface p-6 text-text">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div className="flex flex-col gap-1">
					<p className="text-sm font-medium">Session → Smart Link → back again</p>
					<p className="max-w-lg text-sm text-text-subtle">Hover the session, then its pull request. Move diagonally between the cards, or pause briefly along the way.</p>
				</div>
				<div className="flex items-center gap-2">
					<Switch id={switchId} checked={debug} onCheckedChange={setDebug} />
					<Label htmlFor={switchId}>Show safety cone</Label>
				</div>
			</div>
			<div className="flex py-10">
				<ConeSafezone debug={debug} openDelay={120} closeDelay={80}>
					<ConeSafezoneTrigger render={<Button variant="outline" />}>Hover session</ConeSafezoneTrigger>
					<ConeSafezoneContent side="bottom" align="start" alignOffset={0} sideOffset={12} className="w-80 bg-surface-overlay p-0 shadow-2xl">
						<JiraSessionFlyoutCard
							title="Retry policy review is ready"
							titleId={titleId}
							meta={<p className="text-xs text-text-subtle">Cursor · 1h ago</p>}
							artifacts={SMART_LINK_VARIANT_EXAMPLES.pullRequest.slice(0, 1)}
						/>
					</ConeSafezoneContent>
				</ConeSafezone>
			</div>
		</div>
	);
}

export function ConeSafezoneDemoPlacement() {
	const [rtl, setRtl] = useState(false);
	const directionId = useId();
	return (
		<DirectionProvider direction={rtl ? "rtl" : "ltr"}>
		<div className="flex min-h-80 w-full flex-wrap items-center justify-center gap-3 bg-surface p-6 text-text" dir={rtl ? "rtl" : "ltr"}>
			<div className="flex w-full items-center justify-center gap-2">
				<Switch id={directionId} checked={rtl} onCheckedChange={setRtl} />
				<Label htmlFor={directionId}>Right-to-left</Label>
			</div>
			{(["top", "right", "bottom", "left", "inline-start", "inline-end"] as const).map((side) => (
				<ConeSafezone key={side} defaultOpen={side === "left"} debug openDelay={120} closeDelay={80}>
					<ConeSafezoneTrigger render={<Button variant="outline" />}>{side[0].toUpperCase() + side.slice(1)}</ConeSafezoneTrigger>
					<ConeSafezoneContent side={side} sideOffset={16} className="w-64 max-w-[calc(100vw-32px)] p-4">
						<PreviewDetails />
					</ConeSafezoneContent>
				</ConeSafezone>
			))}
		</div>
		</DirectionProvider>
	);
}

export function ConeSafezoneDemoControlled() {
	const [open, setOpen] = useState(true);
	return (
		<div className="flex min-h-80 w-full flex-col items-start gap-4 bg-surface p-6 text-text">
			<div className="flex items-center gap-3">
				<Button onClick={() => setOpen(!open)} variant="outline">Toggle preview</Button>
				<p className="text-sm text-text-subtle" role="status">{open ? "Preview open" : "Preview closed"}</p>
			</div>
			<ConeSafezone open={open} onOpenChange={setOpen} graceMs={500} debug>
				<ConeSafezoneTrigger render={<Button variant="link" />}>Hover or focus for details</ConeSafezoneTrigger>
				<ConeSafezoneContent side="right" align="start" className="flex w-64 max-w-[calc(100vw-32px)] flex-col gap-3 p-4">
					<h3 className="text-sm font-semibold">A little more time</h3>
					<p className="text-sm text-text-subtle">This example allows a 500 ms pause inside the safety cone. Escape and moving away still dismiss the preview.</p>
					<Button onClick={() => setOpen(false)} variant="outline">Close preview</Button>
				</ConeSafezoneContent>
			</ConeSafezone>
		</div>
	);
}
