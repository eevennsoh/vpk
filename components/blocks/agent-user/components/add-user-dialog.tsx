"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { RoleSelect } from "./role-select";
import { DEFAULT_AGENT_ROLE, type AgentUserRole } from "@/app/data/directory/people";

export interface AddUserPayload {
	name: string;
	role: AgentUserRole;
}

export interface AddUserDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onAdd?: (payload: AddUserPayload) => void;
	defaultRole?: AgentUserRole;
	title?: string;
	addLabel?: string;
}

/**
 * Modal for granting a person access to the agent and choosing the role that
 * determines their permissions. Drafts are local so closing discards and Add
 * commits the entered name + role.
 */
export function AddUserDialog({
	open,
	onOpenChange,
	onAdd,
	defaultRole = DEFAULT_AGENT_ROLE,
	title = "Add user",
	addLabel = "Add",
}: Readonly<AddUserDialogProps>) {
	const [draft, setDraft] = useState(() => ({
		defaultRole,
		name: "",
		open,
		role: defaultRole,
	}));
	if (open && (!draft.open || draft.defaultRole !== defaultRole)) {
		setDraft({
			defaultRole,
			name: "",
			open,
			role: defaultRole,
		});
	} else if (draft.open !== open || draft.defaultRole !== defaultRole) {
		setDraft({
			...draft,
			defaultRole,
			open,
		});
	}
	const name = draft.open === open && draft.defaultRole === defaultRole ? draft.name : "";
	const role = draft.open === open && draft.defaultRole === defaultRole ? draft.role : defaultRole;

	const canAdd = name.trim().length > 0;

	function handleAdd(): void {
		if (!canAdd) {
			return;
		}
		onAdd?.({ name: name.trim(), role });
		onOpenChange(false);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent size="md" className="gap-6">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>
						Add a user and choose their role to determine their permissions. We&apos;ll
						override the role for any people you&apos;ve added before.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-2">
					<Label htmlFor="add-user-name" className="font-semibold text-text">
						Name
					</Label>
					<Input
						id="add-user-name"
						placeholder="Add people"
						value={name}
						onChange={(event) => {
							const nextName = event.target.value;
							setDraft((current) => ({ ...current, name: nextName }));
						}}
						autoComplete="off"
					/>
				</div>

				<div className="flex flex-col gap-2">
					<Label htmlFor="add-user-role" className="font-semibold text-text">
						Role
					</Label>
					<RoleSelect
						id="add-user-role"
						value={role}
						onValueChange={(nextRole) => {
							setDraft((current) => ({ ...current, role: nextRole }));
						}}
					/>
				</div>

				<DialogFooter className="items-center">
					<DialogClose render={<Button variant="ghost" />}>Close</DialogClose>
					<Button onClick={handleAdd} disabled={!canAdd}>
						{addLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
