"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import PromptGallery from "@/components/blocks/prompt-gallery/page";
import CustomizeMenu from "@/components/projects/shared/components/chat-configuration/customize-menu";
import {
	PromptInput,
	PromptInputActionMenu,
	PromptInputActionMenuContent,
	PromptInputActionMenuItem,
	PromptInputActionMenuTrigger,
	PromptInputBody,
	PromptInputFooter,
	PromptInputPreferencesButton,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputTools,
} from "@/components/ui-custom/prompt-input";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { composerUpwardShadow, composerPromptInputClassName, composerTextareaClassName, textareaCSS } from "@/components/projects/shared/components/rovo-composer-styles";
import { SpeechInput } from "@/components/ui-custom/speech-input";
import { Footer } from "@/components/ui-custom/footer";
import Heading from "@/components/ui/heading";
import Image from "next/image";
import { token } from "@/lib/tokens";
import AddIcon from "@atlaskit/icon/core/add";
import ArrowUpIcon from "@atlaskit/icon/core/arrow-up";
import LinkIcon from "@atlaskit/icon/core/link";
import MentionIcon from "@atlaskit/icon/core/mention";
import PageIcon from "@atlaskit/icon/core/page";
import UploadIcon from "@atlaskit/icon/core/upload";

const DEFAULT_PLACEHOLDER = "Ask, @mention, or / for skills";

export default function PromptGalleryDemo() {
	const [prompt, setPrompt] = useState("");
	const [previewPrompt, setPreviewPrompt] = useState<string | null>(null);
	const [galleryExpanded, setGalleryExpanded] = useState(false);
	const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
	const [isCustomizeMenuOpen, setIsCustomizeMenuOpen] = useState(false);
	const [selectedReasoning, setSelectedReasoning] = useState("deep-research");
	const [webResultsEnabled, setWebResultsEnabled] = useState(false);
	const [companyKnowledgeEnabled, setCompanyKnowledgeEnabled] = useState(true);

	const customHeight = galleryExpanded || previewPrompt ? "130px" : "106px";

	const handleSpeechTranscription = (text: string) => {
		const trimmedTranscription = text.trim();
		if (!trimmedTranscription) return;
		const trimmedPrompt = prompt.trimEnd();
		setPrompt(trimmedPrompt ? `${trimmedPrompt} ${trimmedTranscription}` : trimmedTranscription);
	};

	return (
		<div className="flex h-full w-full flex-col items-center">
			<div className="flex-1 shrink min-h-[40px]" />
			<div className="flex w-full max-w-[800px] flex-col items-center shrink-0 px-4" style={{ gap: token("space.100") }}>
				<div>
					<Image src="/illustration-ai/chat/light.svg" alt="Rovo Chat" width={74} height={67} priority />
				</div>

				<div style={{ marginBottom: token("space.400") }}>
					<Heading size="xlarge">How can I help?</Heading>
				</div>

				<div className="w-full px-1">
					<div
						className="flex flex-col rounded-xl border border-border bg-surface px-4 pb-3 pt-4"
						style={{
							boxShadow: composerUpwardShadow,
							height: customHeight,
							transition: "height var(--duration-normal) var(--ease-out)",
						}}
					>
						<PromptInput
							allowOverflow
							onSubmit={() => {
								setPrompt("");
							}}
							className={cn(composerPromptInputClassName, "relative z-10 flex h-full flex-col [&>[data-slot=input-group]]:h-full")}
						>
							<PromptInputBody className="flex-1">
								<PromptInputTextarea
									value={prompt}
									onChange={(event) => setPrompt(event.currentTarget.value)}
									placeholder={previewPrompt ?? DEFAULT_PLACEHOLDER}
									aria-label="Prompt input"
									rows={1}
									className={cn(composerTextareaClassName, "h-full max-h-none min-h-0")}
								/>
							</PromptInputBody>
							<PromptInputFooter className="justify-between px-0 pb-0">
								<PromptInputTools>
									<PromptInputActionMenu open={isAddMenuOpen} onOpenChange={setIsAddMenuOpen}>
										<PromptInputActionMenuTrigger aria-label="Add" size="icon-sm" variant="ghost">
											<AddIcon label="" />
										</PromptInputActionMenuTrigger>
										<PromptInputActionMenuContent>
											<PromptInputActionMenuItem onSelect={() => setIsAddMenuOpen(false)} elemBefore={<UploadIcon label="" />}>
												Upload file
											</PromptInputActionMenuItem>
											<PromptInputActionMenuItem onSelect={() => setIsAddMenuOpen(false)} elemBefore={<LinkIcon label="" />}>
												Add a link
											</PromptInputActionMenuItem>
											<PromptInputActionMenuItem onSelect={() => setIsAddMenuOpen(false)} elemBefore={<MentionIcon label="" />}>
												Mention someone
											</PromptInputActionMenuItem>
											<PromptInputActionMenuItem onSelect={() => setIsAddMenuOpen(false)} elemBefore={<AddIcon label="" />}>
												More formatting
											</PromptInputActionMenuItem>
											<PromptInputActionMenuItem onSelect={() => setIsAddMenuOpen(false)} elemBefore={<PageIcon label="" />}>
												Add current page as context
											</PromptInputActionMenuItem>
										</PromptInputActionMenuContent>
									</PromptInputActionMenu>

									<Popover open={isCustomizeMenuOpen} onOpenChange={setIsCustomizeMenuOpen}>
										<PopoverTrigger render={<PromptInputPreferencesButton aria-label="Customize" />} />
										<PopoverContent side="top" align="start" sideOffset={8} className="w-auto p-1">
											<PopoverTitle className="sr-only">Customize sources</PopoverTitle>
											<CustomizeMenu
												selectedReasoning={selectedReasoning}
												onReasoningChange={setSelectedReasoning}
												showReasoning={false}
												webResultsEnabled={webResultsEnabled}
												onWebResultsChange={setWebResultsEnabled}
												companyKnowledgeEnabled={companyKnowledgeEnabled}
												onCompanyKnowledgeChange={setCompanyKnowledgeEnabled}
												onClose={() => setIsCustomizeMenuOpen(false)}
											/>
										</PopoverContent>
									</Popover>
								</PromptInputTools>

								<div className="flex items-center gap-1">
									<SpeechInput aria-label="Voice" onTranscriptionChange={handleSpeechTranscription} size="icon" />
									<PromptInputSubmit aria-label="Submit" disabled={!prompt.trim()} size="icon-sm">
										<ArrowUpIcon label="" />
									</PromptInputSubmit>
								</div>
							</PromptInputFooter>
						</PromptInput>
						<style>{textareaCSS}</style>
					</div>
				</div>

				<div className="w-full" style={{ marginTop: token("space.300") }}>
					<PromptGallery onSelect={(selectedPrompt) => setPrompt(selectedPrompt)} onPreviewStart={setPreviewPrompt} onPreviewEnd={() => setPreviewPrompt(null)} onExpandChange={setGalleryExpanded} />
				</div>
			</div>
			<div className="flex-1 shrink" />

			<div className="shrink-0 flex w-full justify-center">
				<Footer />
			</div>
		</div>
	);
}
