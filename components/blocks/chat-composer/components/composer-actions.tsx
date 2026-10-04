"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import AddMenu from "./add-menu";
import CustomizeMenu, { type CustomizeMenuProps } from "@/components/projects/shared/components/chat-configuration/customize-menu";
import { composerStyles } from "../data/styles";
import AddIcon from "@atlaskit/icon/core/add";
import ArrowUpIcon from "@atlaskit/icon/core/arrow-up";
import CrossIcon from "@atlaskit/icon/core/cross";
import CustomizeIcon from "@atlaskit/icon/core/customize";
import MicrophoneIcon from "@atlaskit/icon/core/microphone";

interface ComposerActionsProps {
	showAddMenu: boolean;
	showCustomizeMenu: boolean;
	showMicrophone: boolean;
	isListening: boolean;
	onToggleDictation?: () => void;
	customizeMenuProps?: Omit<CustomizeMenuProps, "onClose">;
	canSubmit: boolean;
	onSubmit: () => void;
}

export default function ComposerActions({
	showAddMenu,
	showCustomizeMenu,
	showMicrophone,
	isListening,
	onToggleDictation,
	customizeMenuProps,
	canSubmit,
	onSubmit,
}: Readonly<ComposerActionsProps>): React.ReactElement {
	const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
	const [isCustomizeMenuOpen, setIsCustomizeMenuOpen] = useState(false);

	return (
		<div style={composerStyles.actionsRow}>
			<div style={composerStyles.buttonGroup}>
				{showAddMenu ? <Popover open={isAddMenuOpen} onOpenChange={setIsAddMenuOpen}>
						<PopoverTrigger
							render={
								<Button
									aria-label="Add"
									size="icon"
									variant="ghost"
								/>
							}
						>
							<AddIcon label="" />
						</PopoverTrigger>
						<PopoverContent side="top" align="start" sideOffset={8} className="w-auto min-w-[200px] p-1">
							<AddMenu onClose={() => setIsAddMenuOpen(false)} />
						</PopoverContent>
					</Popover> : null}

				{showCustomizeMenu ? <Popover open={isCustomizeMenuOpen} onOpenChange={setIsCustomizeMenuOpen}>
						<PopoverTrigger
							render={
								<Button
									aria-label="Customize"
									size="icon"
									variant="ghost"
								/>
							}
						>
							<CustomizeIcon label="" />
						</PopoverTrigger>
						{customizeMenuProps ? <PopoverContent side="top" align="start" sideOffset={8} className="w-auto p-2">
								<PopoverTitle className="sr-only">Customize response</PopoverTitle>
								<CustomizeMenu {...customizeMenuProps} onClose={() => setIsCustomizeMenuOpen(false)} />
							</PopoverContent> : null}
					</Popover> : null}
			</div>

			<div style={composerStyles.buttonGroup}>
				{showMicrophone && onToggleDictation ? <Button
						aria-label={isListening ? "Stop listening" : "Voice"}
						size="icon"
						variant="ghost"
						onClick={onToggleDictation}
					>
						{isListening ? <CrossIcon label="" /> : <MicrophoneIcon label="" />}
					</Button> : null}

				<Button
					aria-label="Submit"
					size="icon"
					variant="default"
					disabled={!canSubmit}
					onClick={onSubmit}
				>
					<ArrowUpIcon label="" />
				</Button>
			</div>
		</div>
	);
}
