"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LozengeDropdownTrigger } from "@/components/ui/lozenge";
import type { ProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
import { projectButterStatusProgress, projectButterStatusVariant } from "@/components/blocks/jira-work-item/project-butter/status-model";
import { ProgressCircle } from "@/components/ui-custom/progress-circle";
import { IconTile } from "@/components/ui/icon-tile";

export function ProjectButterStatusGlyph({ status, animated = true }: Readonly<{ status: string; animated?: boolean }>) {
	return <ProgressCircle
		animated={animated}
		animateDashes={animated}
		aria-hidden
		colorByProgress
		dashed
		deferFillAnimation={animated}
		inline
		label={status}
		size="sm"
		value={projectButterStatusProgress(status)}
		variant="filled"
	/>;
}

export function ProjectButterStatus({
	content,
	appearance = "icon",
}: Readonly<{ content: ProjectButterContent; appearance?: "icon" | "field" | "lozenge" }>) {
	const [editor, setEditor] = useState<"create" | "edit" | null>(null);
	const [menuOpen, setMenuOpen] = useState(false);
	const [name, setName] = useState("");
	const value = name.trim();
	const duplicate = content.statusOptions.some(
		(option) =>
			option.toLowerCase() === value.toLowerCase() &&
			(editor !== "edit" || option !== content.status),
	);
	function openEditor(mode: "create" | "edit") {
		setName(mode === "edit" ? content.status : "");
		setEditor(mode);
	}
	function save() {
		if (!value || duplicate) return;
		content.setStatusOptions((options) =>
			editor === "edit"
				? options.map((option) => (option === content.status ? value : option))
				: [...options, value],
		);
		content.setStatus(value);
		setEditor(null);
	}
	return (
		<>
			<DropdownMenu onOpenChange={(open, details) => { if (appearance !== "field" || (details.event?.type !== "mousedown" && details.event?.type !== "click")) setMenuOpen(open); }} open={menuOpen}>
				<DropdownMenuTrigger
					onClick={() => { if (appearance === "field") setMenuOpen((open) => !open); }}
					render={
						<LozengeDropdownTrigger
							appearance={appearance === "field" ? "text" : appearance}
							aria-label={`Change status${appearance === "field" ? " in details" : ""}, ${content.status}`}
							className={appearance === "field" ? "-mx-2 w-[calc(100%+1rem)] max-w-none justify-start bg-transparent px-2 pr-14 hover:bg-transparent active:bg-transparent data-[selected=true]:bg-transparent" : "transition-none"}
							icon={appearance === "field" ? <IconTile aria-hidden as="span" icon={<ProjectButterStatusGlyph status={content.status} />} label="" size="xxsmall" variant="transparent" /> : <ProjectButterStatusGlyph status={content.status} />}
							size="spacious"
							variant={projectButterStatusVariant(content.status)}
						/>
					}
				>
					{content.status}
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" positionerClassName="z-[650]">
					{content.statusOptions
						.filter((status) => status !== content.status)
						.map((status) => (
							<DropdownMenuItem
								elemBefore={<ProjectButterStatusGlyph animated={false} status={status} />}
								key={status}
								onSelect={() => content.setStatus(status)}
							>
								{status}
							</DropdownMenuItem>
						))}
					<DropdownMenuSeparator />
					<DropdownMenuItem onSelect={() => openEditor("create")}>Create status</DropdownMenuItem>
					<DropdownMenuItem onSelect={() => openEditor("edit")}>Edit status</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<Dialog
				onOpenChange={(open) => {
					if (!open) setEditor(null);
				}}
				open={editor !== null}
			>
				<DialogContent
					className="z-[701]"
					overlayProps={{ forceRender: true, className: "z-[700]" }}
				>
					<DialogTitle>{editor === "create" ? "Create status" : "Edit status"}</DialogTitle>
					<DialogDescription>Name the status for this work item.</DialogDescription>
					<form
						className="space-y-4"
						onSubmit={(event) => {
							event.preventDefault();
							save();
						}}
					>
						<Input
							aria-label="Status name"
							autoFocus
							onChange={(event) => setName(event.currentTarget.value)}
							value={name}
						/>
						{duplicate ? (
							<p className="text-sm text-text-danger">A status with this name already exists.</p>
						) : null}
						<div className="flex justify-end gap-2">
							<Button onClick={() => setEditor(null)} type="button" variant="ghost">
								Cancel
							</Button>
							<Button disabled={!value || duplicate} type="submit">
								{editor === "create" ? "Create and apply" : "Save status"}
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
}
