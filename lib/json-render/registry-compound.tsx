"use client";

// Compound summary components (Figma design context, work summary) for the json-render registry.
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { BundledLanguage } from "shiki";
import { Lozenge, type LozengeProps } from "@/components/ui/lozenge";
import { Tag as TagPrimitive } from "@/components/ui/tag";
import { CodeBlock as CustomCodeBlock } from "@/components/ui-custom/code-block";
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { toSafeOptionalText } from "./registry-values";
import type { Components } from "@json-render/react";
import type { catalog } from "./catalog";


export const compoundComponents = {
	// ── Compound ──────────────────────────────────
	FigmaDesignContext: ({ props }) => {
		const figmaUrl = toSafeOptionalText(props.figmaUrl);
		const code = toSafeOptionalText(props.code);
		const codeLanguage = toSafeOptionalText(props.codeLanguage) || "tsx";
		const links = Array.isArray(props.links) ? props.links : [];

		if (!figmaUrl && !code && links.length === 0) {
			return null;
		}

		return (
			<div className="flex flex-col gap-4">
				{figmaUrl ? (
					<a
						href={figmaUrl}
						className="inline-flex items-center gap-1.5 text-sm font-medium text-link hover:underline"
						target="_blank"
						rel="noopener noreferrer"
					>
						Open in Figma ↗
					</a>
				) : null}
				{code ? (
					<CustomCodeBlock
						code={code}
						language={codeLanguage as BundledLanguage}
					/>
				) : null}
				{links.length > 0 ? (
					<div className="flex flex-wrap gap-2">
						{links.map((link, i) => (
							<a
								key={`${link.href}-${i}`}
								href={link.href}
								className="text-sm text-link hover:underline"
								target="_blank"
								rel="noopener noreferrer"
							>
								{link.text}
							</a>
						))}
					</div>
				) : null}
			</div>
		);
	},

	WorkSummary: ({ props }) => {
		const { jiraItems, confluencePages } = props;
		const workItemsCount = jiraItems.length;
		const pagesCount = confluencePages.length;
		const totalCount = workItemsCount + pagesCount;

		const STATUS_CATEGORY_VARIANT: Record<string, LozengeProps["variant"]> = {
			done: "success",
			inprogress: "information",
			todo: "neutral",
			blocked: "danger",
		};

		const [activeTab, setActiveTab] = useState("work-items");

		return (
			<div className="flex flex-col gap-4">
				{/* Metrics row */}
				<div className="@container/grid">
					<div className="grid grid-cols-1 gap-3 @[480px]/grid:grid-cols-3">
						<Card>
							<CardContent className="flex flex-col items-center gap-1 text-center">
								<p className="text-xs text-text-subtlest">Work Items</p>
								<p className="text-2xl font-semibold text-text">{workItemsCount}</p>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="flex flex-col items-center gap-1 text-center">
								<p className="text-xs text-text-subtlest">Pages</p>
								<p className="text-2xl font-semibold text-text">{pagesCount}</p>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="flex flex-col items-center gap-1 text-center">
								<p className="text-xs text-text-subtlest">Total Activity</p>
								<p className="text-2xl font-semibold text-text">{totalCount}</p>
							</CardContent>
						</Card>
					</div>
				</div>

				{/* Bar chart */}
				{workItemsCount > 0 && pagesCount > 0 ? (
					<ChartContainer
						config={{
							count: { label: "Count", color: "var(--color-chart-1)" },
						}}
						className="min-h-[200px] w-full"
						style={{ height: 220 }}
					>
						<RechartsBarChart
							data={[
								{ source: "Work Items", count: workItemsCount },
								{ source: "Pages", count: pagesCount },
							]}
						>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="source" tick={{ fontSize: 12 }} />
							<YAxis tick={{ fontSize: 12 }} />
							<ChartTooltip content={<ChartTooltipContent />} />
							<Bar dataKey="count" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
						</RechartsBarChart>
					</ChartContainer>
				) : null}

				{/* Tabbed detail lists */}
				<Tabs value={activeTab} onValueChange={setActiveTab}>
					<TabsList className="w-full overflow-x-auto">
						<TabsTrigger value="work-items">Work Items</TabsTrigger>
						<TabsTrigger value="pages">Pages</TabsTrigger>
					</TabsList>
					<TabsContent value="work-items">
						{jiraItems.length === 0 ? (
							<div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-text-subtle">
								No work items in this period.
							</div>
						) : (
							<div className="flex flex-col gap-2">
								{jiraItems.map((item, i) => {
									const lozengeVariant = item.statusCategory
										? STATUS_CATEGORY_VARIANT[item.statusCategory] ?? "neutral"
										: "neutral";
									return (
										<Card key={item.key ? `${item.key}-${i}` : i} className={item.url ? "no-underline transition-colors hover:bg-surface-hovered" : undefined}>
											<CardContent className="flex flex-col gap-1.5">
												<div className="flex items-start justify-between gap-2">
													<div className="flex-1">
														{item.url ? (
															<a href={item.url} className="text-sm font-medium text-link hover:underline" target="_blank" rel="noopener noreferrer">
																{item.key} — {item.summary}
															</a>
														) : (
															<p className="text-sm font-medium text-text">
																{item.key} — {item.summary}
															</p>
														)}
													</div>
													<Lozenge variant={lozengeVariant} isBold>
														{item.status}
													</Lozenge>
												</div>
												<div className="flex flex-wrap items-center gap-2">
													{item.priority ? <Badge variant="neutral">{item.priority}</Badge> : null}
													{item.type ? (
														<TagPrimitive color="blue">{item.type}</TagPrimitive>
													) : null}
													{item.updated ? (
														<span className="text-xs text-text-subtlest">Updated {item.updated}</span>
													) : null}
												</div>
											</CardContent>
										</Card>
									);
								})}
							</div>
						)}
					</TabsContent>
					<TabsContent value="pages">
						{confluencePages.length === 0 ? (
							<div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-text-subtle">
								No pages in this period.
							</div>
						) : (
							<div className="flex flex-col gap-2">
								{confluencePages.map((page, i) => (
									<Card key={page.title ? `${page.title}-${i}` : i} className={page.url ? "no-underline transition-colors hover:bg-surface-hovered" : undefined}>
										<CardContent className="flex flex-col gap-1.5">
											{page.url ? (
												<a href={page.url} className="text-sm font-medium text-link hover:underline" target="_blank" rel="noopener noreferrer">
													{page.title}
												</a>
											) : (
												<p className="text-sm font-medium text-text">{page.title}</p>
											)}
											<div className="flex flex-wrap items-center gap-2">
												{page.space ? (
													<TagPrimitive color="teal">{page.space}</TagPrimitive>
												) : null}
												{page.lastModified ? (
													<span className="text-xs text-text-subtlest">Modified {page.lastModified}</span>
												) : null}
											</div>
										</CardContent>
									</Card>
								))}
							</div>
						)}
					</TabsContent>
				</Tabs>
			</div>
		);
	},
} satisfies Partial<Components<typeof catalog>>;
