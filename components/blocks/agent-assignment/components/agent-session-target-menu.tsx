"use client";

import { useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";

import AddIcon from "@atlaskit/icon/core/add";
import AiChatIcon from "@atlaskit/icon/core/ai-chat";

import {
	RichTextSuggestionMenu,
	type RichTextSuggestionMenuItem,
} from "@/components/ui-custom/rich-text-editor/menus";

const SESSION_TARGET_MENU_ITEMS = [
	{
		id: "continue",
		label: "Continue in existing session",
		icon: <AiChatIcon label="" size="small" />,
	},
	{
		id: "new",
		label: "Start a new session",
		icon: <AddIcon label="" size="small" />,
	},
] satisfies readonly RichTextSuggestionMenuItem[];

export type AgentSessionTargetChoice = "continue" | "new";

interface AgentSessionTargetMenuProps {
	onBack: () => void;
	onChoose: (choice: AgentSessionTargetChoice) => void;
}

export function AgentSessionTargetMenu({
	onBack,
	onChoose,
}: Readonly<AgentSessionTargetMenuProps>) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [selectedIndex, setSelectedIndex] = useState(0);

	const focusOptionAt = (index: number) => {
		containerRef.current
			?.querySelectorAll<HTMLButtonElement>("[data-suggestion-option]")
			.item(index)
			?.focus();
	};

	useLayoutEffect(() => {
		containerRef.current?.focus();
	}, []);

	const moveSelection = (step: number) => {
		const nextIndex = (selectedIndex + step + SESSION_TARGET_MENU_ITEMS.length)
			% SESSION_TARGET_MENU_ITEMS.length;
		setSelectedIndex(nextIndex);
		focusOptionAt(nextIndex);
	};

	const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
		const options = containerRef.current?.querySelectorAll<HTMLButtonElement>("[data-suggestion-option]");
		if (!options || !(event.target instanceof HTMLButtonElement)) {
			return;
		}
		const index = [...options].indexOf(event.target);
		if (index !== -1) {
			setSelectedIndex(index);
		}
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		switch (event.key) {
			case "ArrowDown":
			case "ArrowUp":
				event.preventDefault();
				moveSelection(event.key === "ArrowDown" ? 1 : -1);
				break;
			case "Enter":
				event.preventDefault();
				onChoose(SESSION_TARGET_MENU_ITEMS[selectedIndex].id === "new" ? "new" : "continue");
				break;
			case "Escape":
				event.preventDefault();
				onBack();
				break;
			default:
				break;
		}
	};

	return (
		<div
			className="w-full outline-none"
			onFocus={handleFocus}
			onKeyDown={handleKeyDown}
			ref={containerRef}
			tabIndex={-1}
		>
			<RichTextSuggestionMenu
				className="rich-text-command-menu-embedded w-full!"
				emptyLabel=""
				items={SESSION_TARGET_MENU_ITEMS}
				onBack={onBack}
				onHover={setSelectedIndex}
				onSelect={(item) => onChoose(item.id === "new" ? "new" : "continue")}
				selectedIndex={selectedIndex}
				showReturnShortcut={false}
				title="Choose agent session"
			/>
		</div>
	);
}
