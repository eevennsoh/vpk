"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import SearchIcon from "@atlaskit/icon/core/search";

import { useHasVerticalOverflow } from "@/components/hooks/use-has-vertical-overflow";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSearchField,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildScrollMaskStyle } from "@/components/visual/scroll-mask/lib";

const ACTIONS = [
	"Add attachment", "Add comment", "Add label", "Add reminder", "Archive",
	"Assign", "Change owner", "Copy link", "Create subtask", "Duplicate", "Edit",
	"Export", "Follow", "Move", "Pin", "Print", "Remove label", "Share",
	"Subscribe", "View activity",
];

export function DropdownMenuDemoSearch() {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState("Choose an action");
	const contentRef = useRef<HTMLDivElement>(null);
	const { ref: listRef, showTopScrollMask } = useHasVerticalOverflow<HTMLDivElement>();
	const scrollMaskStyle = {
		...buildScrollMaskStyle({ fadeTop: showTopScrollMask, fadeBottom: false, fadeSize: "3rem" }),
		"--scroll-mask-top-fade-size": "3rem",
	};
	const matchingActions = ACTIONS.filter((action) =>
		action.toLowerCase().includes(query.toLowerCase().trim()),
	);

	function selectAction(action: string) {
		setSelected(action);
		setOpen(false);
		setQuery("");
	}

	function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
		const items = contentRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
		const item = event.key === "ArrowDown" ? items?.[0] : items?.[items.length - 1];
		if (item) {
			event.preventDefault();
			item.focus();
		}
	}

	return (
		<DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
			<DropdownMenuTrigger render={<Button variant="outline" />}>
				{selected}
			</DropdownMenuTrigger>
			<DropdownMenuContent ref={contentRef} className="flex w-64 flex-col overflow-hidden">
				<div className="-mx-(--menu-inset) -mt-(--menu-inset) shrink-0">
					<DropdownMenuSearchField
						autoFocus
						icon={<SearchIcon label="" />}
						label="Search actions"
						value={query}
						onValueChange={setQuery}
						onClear={() => setQuery("")}
						onEscape={() => setOpen(false)}
						onKeyDown={handleSearchKeyDown}
						onSubmit={() => {
							if (matchingActions[0]) selectAction(matchingActions[0]);
						}}
					/>
				</div>
				<div
					ref={listRef}
					className="-mb-(--menu-inset) min-h-0 overflow-y-auto overscroll-contain pb-(--menu-inset)"
					style={scrollMaskStyle}
				>
					<DropdownMenuGroup>
						{matchingActions.length ? matchingActions.map((action) => (
							<DropdownMenuItem key={action} onSelect={() => selectAction(action)}>
								{action}
							</DropdownMenuItem>
						)) : <div className="px-2 py-1.5 text-sm text-text-subtle">No actions found.</div>}
					</DropdownMenuGroup>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
