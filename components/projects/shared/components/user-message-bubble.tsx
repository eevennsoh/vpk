import {
	Message as UiMessage,
	MessageActions,
	MessageContent,
	MessageCopyAction,
	MessageEditAction,
	MessageResponse,
} from "@/components/ui-custom/message";
import {
	Attachment,
	AttachmentPreview,
	Attachments,
} from "@/components/ui-custom/attachments";
import { AnswerCard } from "@/components/blocks/answer-card/components/answer-card";
import { Button } from "@/components/ui/button";
import { InlineEdit } from "@/components/ui/inline-edit";
import { SkillTag } from "@/components/ui-custom/skill-tag";
import { getSkillTagCatalogProps } from "@/components/ui-custom/skill-tag-catalog";
import type { RovoMessageMetadata } from "@/lib/rovo-ui-messages";
import type { FileUIPart } from "ai";
import DeleteIcon from "@atlaskit/icon/core/delete";

interface UserMessageBubbleProps {
	attachments?: ReadonlyArray<FileUIPart>;
	messageText: string;
	metadata?: RovoMessageMetadata;
	isEditing?: boolean;
	onDelete?: () => void;
	onEdit?: (nextText: string) => Promise<void> | void;
	onStartEdit?: () => void;
	onCancelEdit?: () => void;
	showPromptActions?: boolean;
}

const SKILL_INVOCATION_LABELS = new Map([
	["/Improve description", "Improve description"],
]);

function getSkillInvocationLabel(messageText: string): string | undefined {
	return SKILL_INVOCATION_LABELS.get(messageText.trim());
}

function getClarificationSummaryRows(
	metadata: RovoMessageMetadata | undefined
): Array<{ question: string; answer: string; status?: "skipped" }> {
	if (!metadata || metadata.source !== "clarification-submit") {
		return [];
	}

	if (!Array.isArray(metadata.clarificationSummary)) {
		return [];
	}

	return metadata.clarificationSummary.filter((summaryRow) => {
		return (
			typeof summaryRow?.question === "string" &&
			summaryRow.question.trim().length > 0 &&
			typeof summaryRow?.answer === "string" &&
			summaryRow.answer.trim().length > 0
		);
	});
}

export function UserMessageBubble({
	attachments = [],
	messageText,
	metadata,
	isEditing = false,
	onDelete,
	onEdit,
	onStartEdit,
	onCancelEdit,
	showPromptActions = false,
}: Readonly<UserMessageBubbleProps>): React.ReactElement {
	const isDismissed = metadata?.clarificationStatus === "dismissed";
	const clarificationSummaryRows = isDismissed ? [] : getClarificationSummaryRows(metadata);
	const showClarificationSummary = isDismissed || clarificationSummaryRows.length > 0;
	const canShowPromptActions = showPromptActions && messageText.trim().length > 0;
	const canEditPrompt = canShowPromptActions && !showClarificationSummary && Boolean(onEdit && onStartEdit);
	const skillInvocation = metadata?.skillInvocation;
	const skillInvocationLabel = skillInvocation?.label ?? getSkillInvocationLabel(messageText);
	const skillTagProps = skillInvocationLabel ? getSkillTagCatalogProps(skillInvocationLabel) : null;

	return (
		<div className="group/user-msg relative w-full">
			{onDelete ? (
				<span className="absolute -left-8 top-1/2 hidden -translate-y-1/2 group-hover/user-msg:block">
					<Button
						aria-label="Delete message"
						variant="ghost"
						size="icon"
						className="rounded-full text-icon-subtle [&_svg]:size-3"
						onClick={onDelete}
					>
						<DeleteIcon size="small" label="" />
					</Button>
				</span>
			) : null}
			<UiMessage
				from="user"
				className={isEditing ? "w-full max-w-full" : undefined}
				fitContent={!isEditing}
				contain={!showClarificationSummary}
			>
				{attachments.length > 0 ? (
					<Attachments className="justify-end" variant="grid">
						{attachments.map((attachment) => (
							<Attachment
								key={`${attachment.url}-${attachment.filename ?? "attachment"}`}
								data={{
									...attachment,
									id: `${attachment.url}-${attachment.filename ?? "attachment"}`,
								}}
							>
								<AttachmentPreview />
							</Attachment>
						))}
					</Attachments>
				) : null}
				{isEditing && onEdit ? (
					<InlineEdit
						value={messageText}
						multiline
						startWithEditViewOpen
						keepEditViewOpenOnBlur
						onConfirm={(nextValue) => void onEdit(nextValue)}
						onCancel={() => onCancelEdit?.()}
					/>
				) : showClarificationSummary ? (
					<>
						<AnswerCard
							label={isDismissed ? "Questions dismissed" : undefined}
							rows={clarificationSummaryRows}
						/>
						{canShowPromptActions && !isDismissed ? (
							<MessageActions reveal="hover" className="justify-end text-text-subtle">
								<MessageCopyAction text={messageText} />
							</MessageActions>
						) : null}
					</>
				) : (
					<>
						<MessageContent>
							{skillInvocationLabel && skillTagProps ? (
								<p className="font-medium leading-5">
									{skillInvocation ? <>Use{" "}</> : null}
									<SkillTag
										color={skillTagProps.color}
										icon={skillTagProps.icon}
									>
										{skillInvocationLabel}
									</SkillTag>
									{skillInvocation?.instruction ? <>{" "}{skillInvocation.instruction}</> : null}
								</p>
							) : (
								<MessageResponse plain className="font-medium text-inherit [&>*+*]:mt-3">
									{messageText}
								</MessageResponse>
							)}
						</MessageContent>
						{canShowPromptActions ? (
							<MessageActions reveal="hover" className="justify-end text-text-subtle">
								<MessageCopyAction text={messageText} />
								{canEditPrompt ? <MessageEditAction onClick={onStartEdit} /> : null}
							</MessageActions>
						) : null}
					</>
				)}
			</UiMessage>
		</div>
	);
}
