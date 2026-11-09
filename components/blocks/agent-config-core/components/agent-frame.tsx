"use client";

import type { Tool } from "ai";
import type { ComponentProps, ReactNode } from "react";
import { memo } from "react";

import DeleteIcon from "@atlaskit/icon/core/delete";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";

import { AgentAccess } from "@/components/blocks/agent-access";
import { AgentEvaluation } from "@/components/blocks/agent-evaluation";
import { AgentInsight } from "@/components/blocks/agent-insight";
import { AgentSurface } from "@/components/blocks/agent-surface";
import { AgentUser } from "@/components/blocks/agent-user";
import { AGENT_AVATAR_SRC } from "@/components/blocks/agent-config-core/components/agent-profile-cover";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { AtlassianLogo, isAtlassianLogoSource } from "@/components/ui/logo";
import { Lozenge } from "@/components/ui/lozenge";
import { CodeBlock } from "@/components/ui-custom/code-block";
import { cn } from "@/lib/utils";

export type AgentProps = ComponentProps<"div">;

export const Agent = memo(({ className, ...props }: Readonly<AgentProps>) => (
	<div
		className={cn("not-prose w-full overflow-hidden bg-surface text-text", className)}
		{...props}
	/>
));

export type AgentCompactSurfacesPanelProps = ComponentProps<typeof AgentSurface>;

export type AgentCompactInsightsPanelProps = ComponentProps<typeof AgentInsight>;

export function AgentCompactInsightsPanel(props: Readonly<AgentCompactInsightsPanelProps>) {
	return <AgentInsight {...props} />;
}

export function AgentCompactSurfacesPanel(props: Readonly<AgentCompactSurfacesPanelProps>) {
	return <AgentSurface {...props} />;
}

export type AgentCompactEvaluationPanelProps = ComponentProps<typeof AgentEvaluation>;

export function AgentCompactEvaluationPanel(props: Readonly<AgentCompactEvaluationPanelProps>) {
	return <AgentEvaluation {...props} />;
}

export type AgentCompactUsersPanelProps = ComponentProps<typeof AgentUser>;

export function AgentCompactUsersPanel(props: Readonly<AgentCompactUsersPanelProps>) {
	return <AgentUser {...props} />;
}

export type AgentCompactAccessPanelProps = ComponentProps<typeof AgentAccess>;

export function AgentCompactAccessPanel(props: Readonly<AgentCompactAccessPanelProps>) {
	return <AgentAccess {...props} />;
}

export type AgentHeaderProps = ComponentProps<"div"> & {
	name: string;
	avatarSrc?: string;
	model?: string;
	leadingContent?: ReactNode;
	// Floats above the right edge of the leading (nav) area without taking
	// layout space: used for transient save indicators.
	leadingOverlay?: ReactNode;
	primaryActionLabel?: string;
	publishLabel?: string;
	showActions?: boolean;
	actions?: ReactNode;
	badge?: ReactNode;
};

export type AgentMoreOptionsMenuProps = {
	deleteLabel?: string;
	triggerLabel?: string;
	onDelete?: () => void;
};

export function AgentMoreOptionsMenu({
	deleteLabel = "Delete agent",
	triggerLabel = "More options",
	onDelete,
}: Readonly<AgentMoreOptionsMenuProps>) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				aria-label={triggerLabel}
				render={(
					<Button
						type="button"
						size="icon"
						variant="outline"
					/>
				)}
			>
				<Icon render={<ShowMoreHorizontalIcon label="" color="currentColor" />} aria-hidden />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuGroup>
					<DropdownMenuItem
						variant="destructive"
						elemBefore={<Icon render={<DeleteIcon label="" size="small" />} aria-hidden />}
						onClick={onDelete}
					>
						{deleteLabel}
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export const AgentHeader = memo(
	({
		className,
		avatarSrc = AGENT_AVATAR_SRC,
		leadingContent,
		leadingOverlay,
		model,
		name,
		primaryActionLabel = "Test",
		publishLabel = "Publish",
		showActions = true,
		actions,
		badge,
		...props
	}: Readonly<AgentHeaderProps>) => (
		<div
			className={cn(
				"flex h-14 w-full items-center justify-between gap-4 border-b border-border bg-surface px-4",
				className,
			)}
			{...props}
		>
			<div className="relative flex min-w-0 flex-1 items-center">
				{leadingContent ?? (
					<div className="flex min-w-0 items-center gap-2">
						<Avatar label="Agent" shape="hexagon" size="sm">
							{isAtlassianLogoSource(avatarSrc) ? (
								<AtlassianLogo name="atlassian" label={name} size="small" />
							) : (
								<AvatarImage alt="" src={avatarSrc} />
							)}
						</Avatar>
						<span className="truncate text-sm font-semibold leading-5 text-text">{name}</span>
						{model ? (
							<Lozenge>
								{model}
							</Lozenge>
						) : null}
						{badge}
					</div>
				)}
				{leadingOverlay ? (
					<div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center justify-end">
						{leadingOverlay}
					</div>
				) : null}
			</div>
			{showActions ? (
				<div className="flex shrink-0 items-center gap-2">
					{actions ?? (
						<>
							<AgentMoreOptionsMenu />
							<Button type="button" size="default" variant="outline">
								{primaryActionLabel}
							</Button>
							<Button type="button" size="default" variant="default">
								{publishLabel}
							</Button>
						</>
					)}
				</div>
			) : null}
		</div>
	),
);

export type AgentContentProps = ComponentProps<"div">;

export const AgentContent = memo(
	({ className, ...props }: Readonly<AgentContentProps>) => (
		<div className={cn("space-y-4 p-6", className)} {...props} />
	),
);

export type AgentInstructionsProps = ComponentProps<"div"> & {
	children: string;
};

export const AgentInstructions = memo(
	({ className, children, ...props }: Readonly<AgentInstructionsProps>) => (
		<div className={cn("space-y-2", className)} {...props}>
			<span className="font-medium text-text-subtle text-sm">
				Instructions
			</span>
			<div className="rounded-md bg-surface-sunken p-3 text-text-subtle text-sm">
				<p>{children}</p>
			</div>
		</div>
	),
);

export type AgentToolsProps = ComponentProps<typeof Accordion>;

export const AgentTools = memo(({ className, ...props }: Readonly<AgentToolsProps>) => (
	<div className={cn("space-y-2", className)}>
		<span className="font-medium text-text-subtle text-sm">Tools</span>
		<Accordion className="rounded-md border border-border" {...props} />
	</div>
));

export type AgentToolProps = ComponentProps<typeof AccordionItem> & {
	tool: Tool;
};

export const AgentTool = memo(
	({ className, tool, value, ...props }: Readonly<AgentToolProps>) => {
		const schema =
			"jsonSchema" in tool && tool.jsonSchema
				? tool.jsonSchema
				: tool.inputSchema;
		const description =
			typeof tool.description === "string"
				? tool.description
				: "No description";

		return (
			<AccordionItem
				className={cn("border-b border-border last:border-b-0", className)}
				value={value}
				{...props}
			>
				<AccordionTrigger className="px-3 py-2 text-sm text-text-subtle transition-colors hover:text-text hover:no-underline">
					{description}
				</AccordionTrigger>
				<AccordionContent className="px-3 pb-3">
					<div className="rounded-md bg-surface-sunken">
						<CodeBlock code={JSON.stringify(schema, null, 2)} language="json" />
					</div>
				</AccordionContent>
			</AccordionItem>
		);
	},
);

export type AgentOutputProps = ComponentProps<"div"> & {
	schema: string;
};

export const AgentOutput = memo(
	({ className, schema, ...props }: Readonly<AgentOutputProps>) => (
		<div className={cn("space-y-2", className)} {...props}>
			<span className="font-medium text-text-subtle text-sm">
				Output Schema
			</span>
			<div className="rounded-md bg-surface-sunken">
				<CodeBlock code={schema} language="typescript" />
			</div>
		</div>
	),
);

Agent.displayName = "Agent";
AgentHeader.displayName = "AgentHeader";
AgentContent.displayName = "AgentContent";
AgentInstructions.displayName = "AgentInstructions";
AgentTools.displayName = "AgentTools";
AgentTool.displayName = "AgentTool";
AgentOutput.displayName = "AgentOutput";
