"use client";

import { useState } from "react";

import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

import {
	PERIODS,
	PROFILE_STATS,
	candlesFor,
	periodChange,
	periodLabel,
	type Candle,
	type Period,
} from "./ui-generation-data";

const NUMBER_FORMAT = new Intl.NumberFormat("en-US");
const CHART_HEIGHT = 136;

function CandleBar({ candle }: Readonly<{ candle: Candle }>) {
	const rising = candle.close >= candle.open;
	const top = 1 - Math.max(candle.open, candle.close);
	const body = Math.max(0.02, Math.abs(candle.close - candle.open));
	return (
		<div className="relative h-full w-1.5">
			<div
				className={cn("absolute left-1/2 w-px -translate-x-1/2", rising ? "bg-chart-success" : "bg-chart-danger")}
				style={{ top: `${(1 - candle.high) * 100}%`, height: `${(candle.high - candle.low) * 100}%` }}
			/>
			<div
				className={cn("absolute inset-x-0", rising ? "bg-chart-success" : "bg-chart-danger")}
				style={{ top: `${top * 100}%`, height: `${body * 100}%` }}
			/>
		</div>
	);
}

/** The reference's crypto price card: a candle chart with period tabs. */
export function PriceCard() {
	const [period, setPeriod] = useState<Period>("1D");
	const change = periodChange(period);
	const candles = candlesFor(period);

	return (
		<div
			className="flex w-[300px] flex-col gap-4 rounded-2xl border border-border bg-surface-raised p-5 text-text"
			style={{ boxShadow: token("elevation.shadow.raised") }}
		>
			<div className="flex items-start justify-between">
				<div>
					<p className="text-sm font-semibold">Nova</p>
					<p className="text-xs text-text-subtle">NVA / USD</p>
				</div>
				<span
					className={cn(
						"rounded-full px-2 py-0.5 text-xs font-semibold",
						change >= 0 ? "bg-bg-success text-text-success" : "bg-bg-danger text-text-danger",
					)}
				>
					{change >= 0 ? "+" : ""}
					{change.toFixed(2)}%
				</span>
			</div>
			<div>
				<p style={{ font: token("font.heading.large") }}>$4,812.40</p>
				<p className="text-xs text-text-subtle">{periodLabel(period)}</p>
			</div>
			<div className="flex items-stretch justify-between" style={{ height: CHART_HEIGHT }}>
				{candles.map((candle, index) => (
					<CandleBar key={index} candle={candle} />
				))}
			</div>
			<div role="group" aria-label="Chart period" className="flex gap-1 rounded-full bg-bg-neutral p-1">
				{PERIODS.map((item) => (
					<button
						key={item}
						type="button"
						aria-pressed={item === period}
						onClick={() => setPeriod(item)}
						className={cn(
							"h-7 flex-1 rounded-full text-xs font-medium transition-colors duration-fast ease-out-practical focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focused",
							item === period ? "bg-surface text-text" : "text-text-subtle hover:bg-bg-neutral-hovered hover:text-text",
						)}
					>
						{item}
					</button>
				))}
			</div>
		</div>
	);
}

/** The reference's profile card: avatar, name, stats and a follow toggle. */
export function ProfileCard() {
	const [following, setFollowing] = useState(false);

	return (
		<div
			className="flex w-[240px] flex-col gap-4 rounded-2xl border border-border bg-surface-raised p-4 text-text"
			style={{ boxShadow: token("elevation.shadow.raised") }}
		>
			<Avatar size="lg" animate={false}>
				<AvatarImage src="/avatar-human/olivia-yang.png" alt="" />
			</Avatar>
			<div>
				<p className="text-base font-semibold">Olivia Yang</p>
				<p className="text-xs text-text-subtle">Product designer at Northwind</p>
			</div>
			<dl className="grid grid-cols-3 gap-2">
				{PROFILE_STATS.map((stat) => (
					<div key={stat.label} className="flex flex-col-reverse">
						<dt className="text-xs text-text-subtlest">{stat.label}</dt>
						<dd className="text-sm font-semibold">
							{NUMBER_FORMAT.format(stat.value + (stat.label === "Followers" && following ? 1 : 0))}
						</dd>
					</div>
				))}
			</dl>
			<Button
				variant={following ? "outline" : "default"}
				aria-pressed={following}
				onClick={() => setFollowing((prev) => !prev)}
				className="w-full"
			>
				{following ? "Following" : "Follow"}
			</Button>
		</div>
	);
}
