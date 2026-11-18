import {
	getToolPartName,
	type RovoToolPart,
} from "@/lib/rovo-ui-messages";
import {
	Tool,
	ToolContent,
	ToolHeader,
	ToolInput,
	ToolOutput,
} from "@/components/ui/tool";
import { useState } from "react";
import { renderResolvedToolIcon, resolveToolIcon } from "@/components/projects/shared/lib/tool-icon-resolver";

type AssistantToolsSectionDefaultOpenMode = "details" | "running";

interface AssistantToolsSectionProps {
	messageId: string;
	toolParts: RovoToolPart[];
	defaultOpenMode?: AssistantToolsSectionDefaultOpenMode;
}

interface AssistantToolItemProps {
	toolPart: RovoToolPart;
	shouldDefaultOpen: boolean;
}

function hasToolDetails(toolPart: RovoToolPart): boolean {
	if (toolPart.input !== undefined) {
		const serialized =
			typeof toolPart.input === "string"
				? toolPart.input
				: JSON.stringify(toolPart.input);
		if (
			serialized &&
			serialized !== "{}" &&
			serialized !== '""' &&
			serialized !== "null"
		) {
			return true;
		}
	}

	if (toolPart.output !== undefined) {
		return true;
	}

	return Boolean(toolPart.errorText);
}

function isToolRunning(toolPart: RovoToolPart): boolean {
	return (
		toolPart.state === "approval-requested" ||
		toolPart.state === "input-streaming" ||
		toolPart.state === "input-available"
	);
}

function AssistantToolItem({
	toolPart,
	shouldDefaultOpen,
}: Readonly<AssistantToolItemProps>): React.ReactElement {
	const [isOpen, setIsOpen] = useState(shouldDefaultOpen);
	const [prevShouldDefaultOpen, setPrevShouldDefaultOpen] =
		useState(shouldDefaultOpen);

	if (prevShouldDefaultOpen !== shouldDefaultOpen) {
		setPrevShouldDefaultOpen(shouldDefaultOpen);
		if (prevShouldDefaultOpen && !shouldDefaultOpen) {
			setIsOpen(false);
		}
	}

	const resolvedIcon = resolveToolIcon({
		toolName: toolPart.type === "dynamic-tool" ? toolPart.toolName : undefined,
		title: getToolPartName(toolPart),
		input: toolPart.input,
	});

	return (
		<Tool open={isOpen} onOpenChange={setIsOpen}>
			{toolPart.type === "dynamic-tool" ? (
				<ToolHeader
					leadingIcon={renderResolvedToolIcon(resolvedIcon, { className: "size-4 text-muted-foreground" })}
					title={getToolPartName(toolPart)}
					state={toolPart.state}
					toolName={toolPart.toolName}
					type={toolPart.type}
				/>
			) : (
				<ToolHeader
					leadingIcon={renderResolvedToolIcon(resolvedIcon, { className: "size-4 text-muted-foreground" })}
					title={getToolPartName(toolPart)}
					state={toolPart.state}
					type={toolPart.type}
				/>
			)}
			<ToolContent>
				<ToolInput input={toolPart.input} />
				<ToolOutput
					errorText={toolPart.errorText}
					output={toolPart.output}
				/>
			</ToolContent>
		</Tool>
	);
}

export function AssistantToolsSection({
	messageId,
	toolParts,
	defaultOpenMode = "details",
}: Readonly<AssistantToolsSectionProps>): React.ReactElement {
	return (
		<div className="space-y-2 px-6 pt-2">
			{toolParts.map((toolPart, index) => {
				const shouldDefaultOpen =
					defaultOpenMode === "running"
						? isToolRunning(toolPart) && hasToolDetails(toolPart)
						: hasToolDetails(toolPart);

				return (
					<AssistantToolItem
						key={`${messageId}-tool-${toolPart.toolCallId}-${index}`}
						toolPart={toolPart}
						shouldDefaultOpen={shouldDefaultOpen}
					/>
				);
			})}
		</div>
	);
}
