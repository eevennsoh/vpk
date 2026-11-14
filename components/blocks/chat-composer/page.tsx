"use client";

import { useState } from "react";
import AddMenu from "./components/add-menu";
import CustomizeMenu, { type CustomizeMenuProps } from "@/components/projects/shared/components/chat-configuration/customize-menu";
import { Footer } from "@/components/ui-custom/footer";
import { dropdownStyles } from "@/components/ui/dropdown-menu";
import {
	PromptInput,
	PromptInputActionMenu,
	PromptInputActionMenuContent,
	PromptInputActionMenuTrigger,
	PromptInputBody,
	PromptInputButton,
	PromptInputFooter,
	PromptInputPreferencesButton,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputTools,
} from "@/components/ui-custom/prompt-input";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { token } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { composerStyles, textareaCSS } from "./data/styles";
import AddIcon from "@atlaskit/icon/core/add";
import ArrowUpIcon from "@atlaskit/icon/core/arrow-up";
import CrossIcon from "@atlaskit/icon/core/cross";
import MicrophoneIcon from "@atlaskit/icon/core/microphone";

/** Configuration for which features to display in the composer */
export interface ComposerFeatures {
	/** Show the Add (+) menu button */
	addMenu?: boolean;
	/** Show the Customize (sliders) menu button */
	customizeMenu?: boolean;
	/** Show the microphone button */
	microphone?: boolean;
	/** Show the disclaimer footer */
	disclaimer?: boolean;
}

const DEFAULT_FEATURES: ComposerFeatures = {
	addMenu: true,
	customizeMenu: true,
	microphone: true,
	disclaimer: true,
};

export interface ChatComposerProps {
	/** Current prompt text */
	prompt: string;
	/** Callback when prompt changes */
	onPromptChange: (prompt: string) => void;
	/** Callback when form is submitted */
	onSubmit: () => void;
	/** Placeholder text for the textarea */
	placeholder?: string;
	/** Feature toggles for the composer UI */
	features?: ComposerFeatures;
	/** Custom height for the textarea container */
	customHeight?: string;
	/** Whether voice dictation is active */
	isListening?: boolean;
	/** Interim (not yet finalized) speech-to-text */
	interimText?: string;
	/** Callback to toggle voice dictation */
	onToggleDictation?: () => void;
	/** Props for the customize menu (required if features.customizeMenu is true) */
	customizeMenuProps?: Omit<CustomizeMenuProps, "onClose">;
}

export default function ChatComposer({
	prompt,
	onPromptChange,
	onSubmit,
	placeholder = "Ask, @mention, or / for skills",
	features: featuresProp,
	customHeight,
	isListening = false,
	interimText = "",
	onToggleDictation,
	customizeMenuProps,
}: Readonly<ChatComposerProps>): React.ReactElement {
	const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
	const [isCustomizeMenuOpen, setIsCustomizeMenuOpen] = useState(false);
	const features = { ...DEFAULT_FEATURES, ...featuresProp };

	const handleSubmit = () => {
		if (!prompt.trim()) return;
		onSubmit();
	};

	const handlePromptChange = (nextValue: string) => {
		// If listening, only allow changes that reduce length (deletions).
		if (!isListening || nextValue.length < prompt.length) {
			onPromptChange(nextValue);
		}
	};

	const displayValue = prompt + interimText;

	const containerStyle = {
		...composerStyles.container,
		...(customHeight ? { display: "flex", flexDirection: "column" as const, height: customHeight } : {}),
	};

	const promptInputClassName = cn(
		"chat-composer-form w-full [&>[data-slot=input-group]]:h-auto [&>[data-slot=input-group]]:border-0 [&>[data-slot=input-group]]:bg-transparent [&>[data-slot=input-group]]:shadow-none [&>[data-slot=input-group]]:ring-0",
		customHeight ? "h-full [&>[data-slot=input-group]]:h-full [&>[data-slot=input-group]]:flex-1" : null
	);

	return (
		<div style={composerStyles.wrapper}>
			<div style={containerStyle}>
				<PromptInput
					onSubmit={() => {
						handleSubmit();
					}}
					className={promptInputClassName}
				>
					<PromptInputBody>
						<div
							style={{
								position: "relative",
								width: "100%",
								display: "flex",
								alignItems: "center",
								...(customHeight ? { flex: 1 } : {}),
							}}
						>
							<PromptInputTextarea
								value={displayValue}
								onChange={(event) => handlePromptChange(event.currentTarget.value)}
								placeholder={isListening ? "Listening..." : placeholder}
								aria-label="Chat message input"
								rows={1}
								className={cn(
									"chat-composer-textarea h-6 min-h-6 max-h-[120px] px-0 py-0 font-normal leading-6 shadow-none outline-none ring-0",
									customHeight ? "h-full min-h-full max-h-none" : null
								)}
							/>
							{interimText ? <InterimTextOverlay prompt={prompt} interimText={interimText} /> : null}
						</div>
					</PromptInputBody>

					<PromptInputFooter className="mt-3 justify-between px-0 pb-0">
						<PromptInputTools>
							{features.addMenu ? (
								<PromptInputActionMenu open={isAddMenuOpen} onOpenChange={setIsAddMenuOpen}>
									<PromptInputActionMenuTrigger aria-label="Add" size="icon-sm" variant="ghost">
										<AddIcon label="" />
									</PromptInputActionMenuTrigger>
									<PromptInputActionMenuContent className="w-auto min-w-[200px]">
										<AddMenu onClose={() => setIsAddMenuOpen(false)} />
									</PromptInputActionMenuContent>
								</PromptInputActionMenu>
							) : null}

							{features.customizeMenu ? (
								<Popover open={isCustomizeMenuOpen} onOpenChange={setIsCustomizeMenuOpen}>
									<PopoverTrigger
										render={<PromptInputPreferencesButton aria-label="Customize" />}
									/>
									{customizeMenuProps ? (
										<PopoverContent side="top" align="start" sideOffset={8} className={cn(dropdownStyles.surface, dropdownStyles.padding, "w-auto")}>
											<PopoverTitle className="sr-only">
												{customizeMenuProps.showReasoning === true ? "Customize response" : "Customize sources"}
											</PopoverTitle>
											<CustomizeMenu
												{...customizeMenuProps}
												showReasoning={customizeMenuProps.showReasoning ?? false}
												onClose={() => setIsCustomizeMenuOpen(false)}
											/>
										</PopoverContent>
									) : null}
								</Popover>
							) : null}
						</PromptInputTools>

						<div className="flex items-center gap-0.5">
							{features.microphone && onToggleDictation ? (
								<PromptInputButton
									aria-label={isListening ? "Stop listening" : "Voice"}
									size="icon-sm"
									variant="ghost"
									onClick={onToggleDictation}
								>
									{isListening ? <CrossIcon label="" /> : <MicrophoneIcon label="" />}
								</PromptInputButton>
							) : null}

							<PromptInputSubmit aria-label="Submit" disabled={!prompt.trim()} size="icon-sm">
								<ArrowUpIcon label="" />
							</PromptInputSubmit>
						</div>
					</PromptInputFooter>
				</PromptInput>

				<style>{textareaCSS}</style>
			</div>

			{features.disclaimer ? <Footer /> : null}
		</div>
	);
}

interface InterimTextOverlayProps {
	prompt: string;
	interimText: string;
}

function InterimTextOverlay({ prompt, interimText }: Readonly<InterimTextOverlayProps>): React.ReactElement {
	return (
		<div
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				pointerEvents: "none",
				padding: "0",
				font: token("font.body"),
				fontFamily: "inherit",
				color: "transparent",
				whiteSpace: "pre-wrap",
				wordWrap: "break-word",
				minHeight: "24px",
				maxHeight: "120px",
				overflowY: "auto",
			}}
		>
			<span style={{ color: token("color.text") }}>{prompt}</span>
			<span
				style={{
					color: token("color.text.subtle"),
					backgroundColor: token("color.background.warning"),
					padding: "0 2px",
					borderRadius: token("radius.xsmall"),
				}}
			>
				{interimText}
			</span>
		</div>
	);
}
