"use client";

import AiSparkleIcon from "@atlaskit/icon/core/ai-sparkle";
import ArrowDownIcon from "@atlaskit/icon/core/arrow-down";
import ArrowUpIcon from "@atlaskit/icon/core/arrow-up";
import ChartTrendUpIcon from "@atlaskit/icon/core/chart-trend-up";
import CheckCircleIcon from "@atlaskit/icon/core/check-circle";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import FeedbackIcon from "@atlaskit/icon/core/feedback";
import PeopleGroupIcon from "@atlaskit/icon/core/people-group";
import TargetIcon from "@atlaskit/icon/core/target";
import WarningIcon from "@atlaskit/icon/core/warning";
import { useState, type ComponentProps, type ReactElement, type ReactNode } from "react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Line,
	LineChart,
	XAxis,
	YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "@/components/ui/chart";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";

const INSIGHTS_RANGES = ["Last 7 days", "Last 31 days", "Last 90 days"] as const;

const AGENT_INSIGHT_TREND_DATA = [
	{ day: "Sep 1", conversations: 46, users: 18, successRate: 71 },
	{ day: "Sep 5", conversations: 64, users: 24, successRate: 75 },
	{ day: "Sep 9", conversations: 58, users: 22, successRate: 74 },
	{ day: "Sep 13", conversations: 81, users: 31, successRate: 78 },
	{ day: "Sep 17", conversations: 96, users: 36, successRate: 82 },
	{ day: "Sep 21", conversations: 104, users: 41, successRate: 84 },
	{ day: "Sep 25", conversations: 118, users: 46, successRate: 86 },
	{ day: "Sep 30", conversations: 132, users: 52, successRate: 88 },
];

const AGENT_INSIGHT_OUTCOME_DATA = [
	{ day: "Mon", answered: 78, escalated: 13, abandoned: 5 },
	{ day: "Tue", answered: 86, escalated: 15, abandoned: 6 },
	{ day: "Wed", answered: 92, escalated: 18, abandoned: 7 },
	{ day: "Thu", answered: 98, escalated: 14, abandoned: 5 },
	{ day: "Fri", answered: 106, escalated: 21, abandoned: 8 },
	{ day: "Sat", answered: 51, escalated: 8, abandoned: 3 },
	{ day: "Sun", answered: 48, escalated: 6, abandoned: 2 },
];

const AGENT_INSIGHT_TOPIC_DATA = [
	{ topic: "Access requests", value: 214, rate: "92% resolved" },
	{ topic: "Billing questions", value: 168, rate: "71% resolved" },
	{ topic: "Workflow setup", value: 143, rate: "84% resolved" },
	{ topic: "Bug triage", value: 126, rate: "79% resolved" },
	{ topic: "Policy lookup", value: 94, rate: "89% resolved" },
];

const AGENT_INSIGHT_FEEDBACK_DATA = [
	{ label: "Helpful", value: 72, color: "var(--color-chart-2)" },
	{ label: "Neutral", value: 18, color: "var(--color-chart-7)" },
	{ label: "Needs work", value: 10, color: "var(--color-chart-4)" },
];

const AGENT_INSIGHT_TREND_CONFIG = {
	conversations: { label: "Conversations", color: "var(--color-chart-1)" },
	users: { label: "Active users", color: "var(--color-chart-2)" },
	successRate: { label: "Success rate", color: "var(--color-chart-5)" },
} satisfies ChartConfig;

const AGENT_INSIGHT_OUTCOME_CONFIG = {
	answered: { label: "Answered", color: "var(--color-chart-2)" },
	escalated: { label: "Escalated", color: "var(--color-chart-4)" },
	abandoned: { label: "Abandoned", color: "var(--color-chart-6)" },
} satisfies ChartConfig;

const AGENT_INSIGHT_TOPIC_CONFIG = {
	value: { label: "Conversations", color: "var(--color-chart-1)" },
} satisfies ChartConfig;

const AGENT_INSIGHT_FEEDBACK_CONFIG = {
	value: { label: "Share", color: "var(--color-chart-2)" },
} satisfies ChartConfig;

const AGENT_INSIGHT_CARD_CLASS = "rounded-lg border border-border bg-surface p-4 shadow-xs";
const AGENT_INSIGHT_CHART_MARGIN = { top: 8, right: 16, left: 0, bottom: 0 };

interface AgentInsightMetric {
	change: string;
	changeTone: "good" | "warning";
	description: string;
	icon: ReactElement;
	label: string;
	value: string;
}

const AGENT_INSIGHT_METRICS: readonly AgentInsightMetric[] = [
	{
		change: "+18%",
		changeTone: "good",
		description: "vs previous 31 days",
		icon: <ChartTrendUpIcon label="" size="small" color="currentColor" />,
		label: "Total conversations",
		value: "2,846",
	},
	{
		change: "+11%",
		changeTone: "good",
		description: "people returned this period",
		icon: <PeopleGroupIcon label="" size="small" color="currentColor" />,
		label: "Active users",
		value: "418",
	},
	{
		change: "+6 pts",
		changeTone: "good",
		description: "answered without handoff",
		icon: <CheckCircleIcon label="" size="small" color="currentColor" />,
		label: "Successful answer rate",
		value: "84%",
	},
	{
		change: "-3 pts",
		changeTone: "warning",
		description: "billing drives most escalations",
		icon: <WarningIcon label="" size="small" color="currentColor" />,
		label: "Escalation rate",
		value: "14%",
	},
	{
		change: "+0.4",
		changeTone: "good",
		description: "average user feedback",
		icon: <FeedbackIcon label="" size="small" color="currentColor" />,
		label: "Feedback score",
		value: "4.3/5",
	},
];

const AGENT_INSIGHT_HIGHLIGHTS = [
	"Conversations increased 18% after the agent was added to the service project.",
	"Billing questions account for 42% of negative feedback and 31% of handoffs.",
	"Users are most successful when the agent can cite policy pages and recent tickets.",
];

const AGENT_INSIGHT_RECOMMENDATIONS = [
	{
		title: "Improve billing answers",
		description: "Add the billing FAQ and recent refund policy pages to knowledge so the agent can cite the right source.",
		meta: "High impact",
		variant: "warning" as const,
	},
	{
		title: "Reduce after-hours handoffs",
		description: "Create a fallback path for access requests after 4pm, when escalations are 22% higher.",
		meta: "Operational",
		variant: "information" as const,
	},
	{
		title: "Expand workflow setup examples",
		description: "Add three conversation starters for common setup tasks to improve first-turn success.",
		meta: "Quick win",
		variant: "success" as const,
	},
];

function AgentInsightSectionHeader({
	description,
	title,
	action,
}: Readonly<{
	action?: ReactNode;
	description?: string;
	title: string;
}>) {
	return (
		<div className="flex min-w-0 items-start justify-between gap-3">
			<div className="min-w-0">
				<h3 className="text-text" style={{ font: token("font.heading.small") }}>
					{title}
				</h3>
				{description ? (
					<p className="mt-1 text-sm leading-5 text-text-subtle">{description}</p>
				) : null}
			</div>
			{action ? <div className="shrink-0">{action}</div> : null}
		</div>
	);
}

function AgentInsightMetricCard({ metric }: Readonly<{ metric: AgentInsightMetric }>) {
	return (
		<section className={cn(AGENT_INSIGHT_CARD_CLASS, "min-w-0")}>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="text-xs font-semibold leading-4 text-text-subtlest">{metric.label}</p>
					<p className="mt-2 text-2xl font-semibold leading-7 text-text">{metric.value}</p>
				</div>
				<span
					className={cn(
						"flex size-8 shrink-0 items-center justify-center rounded-md",
						metric.changeTone === "good"
							? "bg-bg-success-subtler text-icon-success"
							: "bg-bg-warning-subtler text-icon-warning"
					)}
				>
					<Icon render={metric.icon} aria-hidden />
				</span>
			</div>
			<div className="mt-3 flex min-w-0 items-center gap-2">
				<Badge variant={metric.changeTone === "good" ? "success" : "warning"}>
					{metric.change}
				</Badge>
				<span className="truncate text-xs leading-4 text-text-subtlest">{metric.description}</span>
			</div>
		</section>
	);
}

function AgentInsightPeriodDropdown() {
	const [selectedRange, setSelectedRange] = useState<(typeof INSIGHTS_RANGES)[number]>("Last 31 days");

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={<Button type="button" size="default" variant="outline" className="gap-1.5" />}
			>
				Conversation date: {selectedRange}
				<ChevronDownIcon label="" size="small" spacing="none" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{INSIGHTS_RANGES.map((range) => (
					<DropdownMenuItem key={range} onSelect={() => setSelectedRange(range)}>
						{range}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function AgentInsightTrendChart() {
	return (
		<ChartContainer config={AGENT_INSIGHT_TREND_CONFIG} className="mt-4 h-[260px] w-full min-h-[260px]">
			<AreaChart accessibilityLayer data={AGENT_INSIGHT_TREND_DATA} margin={AGENT_INSIGHT_CHART_MARGIN}>
				<CartesianGrid vertical={false} strokeDasharray="4 2" />
				<XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
				<YAxis tickLine={false} axisLine={false} width={36} />
				<ChartTooltip content={<ChartTooltipContent indicator="line" />} />
				<Area
					dataKey="conversations"
					type="monotone"
					fill="var(--color-conversations)"
					fillOpacity={0.16}
					stroke="var(--color-conversations)"
					strokeWidth={2}
				/>
				<Line
					dataKey="users"
					type="monotone"
					stroke="var(--color-users)"
					strokeWidth={2}
					dot={false}
				/>
			</AreaChart>
		</ChartContainer>
	);
}

function AgentInsightSuccessChart() {
	return (
		<ChartContainer config={AGENT_INSIGHT_TREND_CONFIG} className="mt-4 h-[180px] w-full min-h-[180px]">
			<LineChart accessibilityLayer data={AGENT_INSIGHT_TREND_DATA} margin={AGENT_INSIGHT_CHART_MARGIN}>
				<CartesianGrid vertical={false} strokeDasharray="4 2" />
				<XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
				<YAxis domain={[60, 95]} tickLine={false} axisLine={false} width={32} />
				<ChartTooltip content={<ChartTooltipContent indicator="line" />} />
				<Line
					dataKey="successRate"
					type="monotone"
					stroke="var(--color-successRate)"
					strokeWidth={2}
					dot={{ r: 3, fill: "var(--color-successRate)" }}
				/>
			</LineChart>
		</ChartContainer>
	);
}

function AgentInsightOutcomeChart() {
	return (
		<ChartContainer config={AGENT_INSIGHT_OUTCOME_CONFIG} className="mt-4 h-[220px] w-full min-h-[220px]">
			<BarChart accessibilityLayer data={AGENT_INSIGHT_OUTCOME_DATA} margin={AGENT_INSIGHT_CHART_MARGIN}>
				<CartesianGrid vertical={false} strokeDasharray="4 2" />
				<XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
				<YAxis tickLine={false} axisLine={false} width={32} />
				<ChartTooltip content={<ChartTooltipContent />} />
				<Bar dataKey="answered" stackId="outcomes" fill="var(--color-answered)" radius={[0, 0, 2, 2]} />
				<Bar dataKey="escalated" stackId="outcomes" fill="var(--color-escalated)" />
				<Bar dataKey="abandoned" stackId="outcomes" fill="var(--color-abandoned)" radius={[2, 2, 0, 0]} />
			</BarChart>
		</ChartContainer>
	);
}

function AgentInsightTopicChart() {
	return (
		<ChartContainer config={AGENT_INSIGHT_TOPIC_CONFIG} className="mt-4 h-[230px] w-full min-h-[230px]">
			<BarChart
				accessibilityLayer
				data={AGENT_INSIGHT_TOPIC_DATA}
				layout="vertical"
				margin={{ top: 8, right: 24, left: 8, bottom: 0 }}
			>
				<CartesianGrid horizontal={false} strokeDasharray="4 2" />
				<XAxis type="number" tickLine={false} axisLine={false} hide />
				<YAxis
					dataKey="topic"
					type="category"
					tickLine={false}
					axisLine={false}
					width={110}
					tickMargin={8}
				/>
				<ChartTooltip
					content={(
						<ChartTooltipContent
							hideLabel
							formatter={(value, name, item) => (
								<span className="flex min-w-32 items-center justify-between gap-3">
									<span>{item.payload.topic}</span>
									<span className="font-medium text-text">{value}</span>
								</span>
							)}
						/>
					)}
				/>
				<Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} />
			</BarChart>
		</ChartContainer>
	);
}

function AgentInsightFeedbackChart() {
	return (
		<ChartContainer config={AGENT_INSIGHT_FEEDBACK_CONFIG} className="mt-4 h-16 w-full min-h-16">
			<BarChart
				accessibilityLayer
				data={[AGENT_INSIGHT_FEEDBACK_DATA.reduce((acc, item) => ({ ...acc, [item.label]: item.value }), {})]}
				layout="vertical"
				margin={{ top: 8, right: 0, left: 0, bottom: 8 }}
			>
				<XAxis type="number" hide domain={[0, 100]} />
				<YAxis type="category" hide />
				{AGENT_INSIGHT_FEEDBACK_DATA.map((item, index) => (
					<Bar
						dataKey={item.label}
						fill={item.color}
						key={item.label}
						radius={index === 0 ? [4, 0, 0, 4] : index === AGENT_INSIGHT_FEEDBACK_DATA.length - 1 ? [0, 4, 4, 0] : 0}
						stackId="feedback"
					>
						<Cell fill={item.color} />
					</Bar>
				))}
			</BarChart>
		</ChartContainer>
	);
}

export type AgentInsightProps = ComponentProps<"div">;

export function AgentInsight({ className, ...props }: Readonly<AgentInsightProps>) {
	return (
		<div className={cn("h-full overflow-y-auto bg-surface-sunken", className)} {...props}>
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-5">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<Badge variant="information">Insights available from September 2025</Badge>
							<Badge variant="success">Sample data</Badge>
						</div>
						<h2 className="mt-3 text-text" style={{ font: token("font.heading.large") }}>
							Review your agent&apos;s performance and gather insights.
						</h2>
						<p className="mt-2 max-w-3xl text-sm leading-6 text-text-subtle">
							Understand adoption, answer quality, failure patterns, and the next improvements that would make this agent more useful.
						</p>
					</div>
					<div className="flex shrink-0 flex-wrap items-center gap-2">
						<AgentInsightPeriodDropdown />
						<Button type="button" size="default" variant="ghost">
							Export
						</Button>
					</div>
				</div>

				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
					{AGENT_INSIGHT_METRICS.map((metric) => (
						<AgentInsightMetricCard key={metric.label} metric={metric} />
					))}
				</div>

				<section className={cn(AGENT_INSIGHT_CARD_CLASS, "grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,0.8fr)]")}>
					<div className="min-w-0">
						<AgentInsightSectionHeader
							title="Adoption trend"
							description="Conversation volume and returning users over the selected period."
						/>
						<AgentInsightTrendChart />
					</div>
					<div className="min-w-0 p-2">
						<div className="flex items-start gap-3">
							<span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-bg-information-subtler text-icon-information">
								<AiSparkleIcon label="" size="small" color="currentColor" />
							</span>
							<div className="min-w-0">
								<h3 className="text-text" style={{ font: token("font.heading.xsmall") }}>
									Key insights
								</h3>
								<ul className="mt-3 space-y-3">
									{AGENT_INSIGHT_HIGHLIGHTS.map((highlight) => (
										<li className="flex gap-2 text-sm leading-5 text-text-subtle" key={highlight}>
											<span className="mt-2 size-1.5 shrink-0 rounded-full bg-border-selected" />
											<span>{highlight}</span>
										</li>
									))}
								</ul>
							</div>
						</div>
					</div>
				</section>

				<div className="grid gap-4 lg:grid-cols-2">
					<section className={AGENT_INSIGHT_CARD_CLASS}>
						<AgentInsightSectionHeader
							title="Answer quality"
							description="Successful answers are improving, but quality dips on billing and setup questions."
							action={<Badge variant="success">84% success</Badge>}
						/>
						<AgentInsightSuccessChart />
					</section>
					<section className={AGENT_INSIGHT_CARD_CLASS}>
						<AgentInsightSectionHeader
							title="Conversation outcomes"
							description="Track answered, escalated, and abandoned conversations by day."
							action={<Badge variant="warning">14% escalated</Badge>}
						/>
						<AgentInsightOutcomeChart />
					</section>
				</div>

				<div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
					<section className={AGENT_INSIGHT_CARD_CLASS}>
						<AgentInsightSectionHeader
							title="Top topics"
							description="The intents and workflows users ask this agent to handle most often."
						/>
						<AgentInsightTopicChart />
						<div className="mt-4 grid gap-2 sm:grid-cols-2">
							{AGENT_INSIGHT_TOPIC_DATA.slice(0, 4).map((topic) => (
								<div className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-bg-neutral px-3 py-2" key={topic.topic}>
									<span className="truncate text-sm font-medium text-text">{topic.topic}</span>
									<span className="shrink-0 text-xs text-text-subtlest">{topic.rate}</span>
								</div>
							))}
						</div>
					</section>

					<section className={AGENT_INSIGHT_CARD_CLASS}>
						<AgentInsightSectionHeader
							title="Feedback mix"
							description="User feedback sentiment from rated conversations."
						/>
						<AgentInsightFeedbackChart />
						<div className="mt-4 space-y-3">
							{AGENT_INSIGHT_FEEDBACK_DATA.map((item) => (
								<div className="flex items-center justify-between gap-3" key={item.label}>
									<div className="flex min-w-0 items-center gap-2">
										<span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
										<span className="truncate text-sm text-text-subtle">{item.label}</span>
									</div>
									<span className="text-sm font-medium text-text">{item.value}%</span>
								</div>
							))}
						</div>
						<div className="mt-5 rounded-md bg-bg-neutral p-3">
							<p className="text-xs font-semibold uppercase leading-4 text-text-subtlest">Failure pattern</p>
							<p className="mt-1 text-sm leading-5 text-text-subtle">
								Negative feedback is concentrated in conversations where the agent lacks a source citation.
							</p>
						</div>
					</section>
				</div>

				<section className={AGENT_INSIGHT_CARD_CLASS}>
					<AgentInsightSectionHeader
						title="Recommended improvements"
						description="Actions that should improve adoption, answer quality, or escalation rate."
					/>
					<div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
						{AGENT_INSIGHT_RECOMMENDATIONS.map((recommendation) => (
							<div className="flex min-w-0 flex-col gap-3 rounded-md bg-bg-neutral p-3" key={recommendation.title}>
								<div className="flex items-start justify-between gap-3">
									<div className="flex min-w-0 flex-1 items-start gap-2">
										<span
											className={cn(
												"flex size-7 shrink-0 items-center justify-center rounded-md",
												recommendation.variant === "success"
													? "bg-bg-success-subtler text-icon-success"
													: recommendation.variant === "warning"
														? "bg-bg-warning-subtler text-icon-warning"
														: "bg-bg-information-subtler text-icon-information"
											)}
										>
											{recommendation.variant === "warning" ? (
												<ArrowDownIcon label="" size="small" color="currentColor" />
											) : (
												<ArrowUpIcon label="" size="small" color="currentColor" />
											)}
										</span>
										<h3 className="text-sm font-semibold leading-5 text-text">{recommendation.title}</h3>
									</div>
									<Badge variant={recommendation.variant}>{recommendation.meta}</Badge>
								</div>
								<p className="text-sm leading-5 text-text-subtle">{recommendation.description}</p>
							</div>
						))}
					</div>
				</section>

				<section className="grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-[auto_1fr_auto] md:items-center">
					<span className="flex size-9 items-center justify-center rounded-md bg-bg-discovery-subtler text-icon-discovery">
						<TargetIcon label="" size="small" color="currentColor" />
					</span>
					<div className="min-w-0">
						<h3 className="text-sm font-semibold leading-5 text-text">Next review focus</h3>
						<p className="mt-1 text-sm leading-5 text-text-subtle">
							Review 27 billing conversations with low feedback before publishing the next version of this agent.
						</p>
					</div>
					<Button type="button" size="default" variant="outline">
						Review conversations
					</Button>
				</section>
			</div>
		</div>
	);
}
