"use client";

import { useState } from "react";

import SmartLinkPage from "@/components/blocks/smart-link/page";
import {
	SmartLink,
	type SmartLinkItem,
	type SmartLinkSize,
} from "@/components/blocks/smart-link/components/smart-link";
import {
	SMART_LINK_DEMO_ITEMS,
	SMART_LINK_STATUS_EXAMPLES,
	SMART_LINK_VARIANT_EXAMPLES,
} from "@/components/blocks/smart-link/data/demo-smart-links";

function SmartLinkExampleSet({
	items,
	showStatus = false,
	appearance = "inline",
}: Readonly<{
	items: readonly SmartLinkItem[];
	showStatus?: boolean;
	appearance?: "inline" | "card";
}>) {
	if (appearance === "card") {
		return (
			<div className="min-h-[260px] w-full bg-surface px-6 py-12 text-text">
				<div className="mx-auto flex max-w-3xl flex-col gap-5">
					{items.map((item) => (
						<SmartLink appearance="card" item={item} key={item.id} />
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-[260px] w-full bg-surface px-6 py-12 text-text">
			<div className="mx-auto flex max-w-3xl flex-col gap-5 text-xl leading-9">
				{items.map((item) => (
					<p key={item.id}>
						<SmartLink item={item} showStatus={showStatus} />
					</p>
				))}
			</div>
		</div>
	);
}

export default function SmartLinkDemo() {
	return <SmartLinkPage />;
}

export function SmartLinkDemoRich() {
	return <SmartLinkExampleSet items={SMART_LINK_VARIANT_EXAMPLES.rich} />;
}

export function SmartLinkDemoArticle() {
	return <SmartLinkExampleSet items={SMART_LINK_VARIANT_EXAMPLES.article} />;
}

export function SmartLinkDemoTeam() {
	return <SmartLinkExampleSet items={SMART_LINK_VARIANT_EXAMPLES.team} />;
}

export function SmartLinkDemoGoal() {
	return <SmartLinkExampleSet items={SMART_LINK_VARIANT_EXAMPLES.goal} showStatus />;
}

export function SmartLinkDemoProject() {
	return <SmartLinkExampleSet items={SMART_LINK_VARIANT_EXAMPLES.project} showStatus />;
}

export function SmartLinkDemoLoom() {
	return <SmartLinkExampleSet items={SMART_LINK_VARIANT_EXAMPLES.loom} />;
}

export function SmartLinkDemoGeneric() {
	return <SmartLinkExampleSet items={SMART_LINK_VARIANT_EXAMPLES.generic} />;
}

export function SmartLinkDemoPullRequest() {
	return <SmartLinkExampleSet items={SMART_LINK_VARIANT_EXAMPLES.pullRequest} showStatus />;
}

export function SmartLinkDemoCard() {
	return <SmartLinkExampleSet appearance="card" items={SMART_LINK_DEMO_ITEMS} />;
}

export function SmartLinkDemoRemovableOverlay() {
	const [items, setItems] = useState<SmartLinkItem[]>(() => [
		...SMART_LINK_VARIANT_EXAMPLES.rich,
		SMART_LINK_STATUS_EXAMPLES[0],
	]);

	return (
		<div className="flex min-h-[220px] w-full flex-col items-start gap-4 bg-surface px-6 py-12 text-text">
			{items.length > 0 ? (
				items.map((item) => (
					<SmartLink
						item={item}
						key={item.id}
						onRemove={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))}
						removeVariant="overlay"
						showStatus={item.id === SMART_LINK_STATUS_EXAMPLES[0].id}
					/>
				))
			) : (
				<p className="text-sm text-text-subtle">All smart links removed</p>
			)}
		</div>
	);
}

function SmartLinkStatusSet({
	items,
	size,
}: Readonly<{ items: typeof SMART_LINK_STATUS_EXAMPLES; size?: SmartLinkSize }>) {
	return (
		<div className="flex min-h-[220px] w-full flex-col items-start gap-4 bg-surface px-6 py-12 text-text">
			{items.map((item) => (
				<SmartLink item={item} key={item.id} showStatus size={size} />
			))}
		</div>
	);
}

export function SmartLinkDemoStatus() {
	return <SmartLinkStatusSet items={SMART_LINK_STATUS_EXAMPLES} size="large" />;
}

export function SmartLinkDemoSizes() {
	const [item] = SMART_LINK_STATUS_EXAMPLES;

	return (
		<div className="flex min-h-[220px] w-full flex-col items-start gap-8 bg-surface px-6 py-12 text-text">
			<div className="flex flex-col items-start gap-2">
				<span className="text-xs font-medium leading-4 text-text-subtlest">Small · 12px</span>
				<SmartLink item={item} showStatus size="small" />
			</div>
			<div className="flex flex-col items-start gap-2">
				<span className="text-xs font-medium leading-4 text-text-subtlest">Medium · 14px</span>
				<SmartLink item={item} showStatus size="medium" />
			</div>
			<div className="flex flex-col items-start gap-2">
				<span className="text-xs font-medium leading-4 text-text-subtlest">Large · 16px</span>
				<SmartLink item={item} showStatus size="large" />
			</div>
		</div>
	);
}

export function SmartLinkDemoWrapping() {
	const item = {
		...SMART_LINK_DEMO_ITEMS[0],
		title: "Cards have inertia when dragging them around in Bento · Design Spells",
	};

	return (
		<div className="flex min-h-[220px] w-full flex-col items-start gap-8 bg-surface px-6 py-12 text-text">
			<div className="w-full max-w-xs space-y-2">
				<span className="text-xs font-medium leading-4 text-text-subtlest">Small · 12px</span>
				<p className="text-xs leading-[1.4]"><SmartLink item={item} size="small" wrap /></p>
			</div>
			<div className="w-full max-w-xs space-y-2">
				<span className="text-xs font-medium leading-4 text-text-subtlest">Medium · 14px</span>
				<p className="text-sm leading-[1.4]"><SmartLink item={item} size="medium" wrap /></p>
			</div>
			<div className="w-full max-w-xs space-y-2">
				<span className="text-xs font-medium leading-4 text-text-subtlest">Large · 16px</span>
				<p className="text-base leading-[1.4]"><SmartLink item={item} size="large" wrap /></p>
			</div>
		</div>
	);
}
