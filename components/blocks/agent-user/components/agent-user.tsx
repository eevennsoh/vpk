"use client";

import { type ReactNode, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Lozenge } from "@/components/ui/lozenge";
import { Switch } from "@/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { AddUserDialog, type AddUserPayload } from "./add-user-dialog";
import {
	SAMPLE_AGENT_OWNER,
	SAMPLE_AGENT_PEOPLE,
	getRoleOption,
	type AgentPerson,
} from "@/app/data/directory/people";

function getInitials(name: string): string {
	return name
		.split(/\s+/u)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");
}

function PersonAvatar({
	name,
	avatarSrc,
	size = "sm",
}: Readonly<{ name: string; avatarSrc?: string; size?: "xs" | "sm" | "default" }>) {
	return (
		<Avatar size={size} label={name}>
			{avatarSrc ? <AvatarImage src={avatarSrc} alt="" /> : null}
			<AvatarFallback>{getInitials(name)}</AvatarFallback>
		</Avatar>
	);
}

function PersonInline({ person }: Readonly<{ person: AgentPerson }>) {
	return (
		<span className="flex items-center gap-2">
			<PersonAvatar name={person.name} avatarSrc={person.avatarSrc} />
			<span className="text-sm text-text">{person.name}</span>
		</span>
	);
}

/** A single labelled setting row inside the access card. */
function SettingRow({
	title,
	description,
	control,
}: Readonly<{ title: string; description: string; control: ReactNode }>) {
	return (
		<div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
			<div className="flex max-w-2xl flex-col gap-1">
				<span className="text-sm font-semibold text-text">{title}</span>
				<span className="text-sm text-text-subtle">{description}</span>
			</div>
			<div className="shrink-0">{control}</div>
		</div>
	);
}

export interface AgentUserProps {
	owner?: AgentPerson;
	authorDisplay?: AgentPerson;
	people?: readonly AgentPerson[];
	defaultOpenToAll?: boolean;
	learnMoreHref?: string;
	className?: string;
}

/**
 * Users screen for a Rovo agent — manage who has access and the role that
 * determines their permissions. Composed entirely from design-system primitives
 * (Avatar, Switch, Lozenge, Table, Checkbox, Button, Dialog).
 */
export function AgentUser({
	owner = SAMPLE_AGENT_OWNER,
	authorDisplay = SAMPLE_AGENT_OWNER,
	people: initialPeople = SAMPLE_AGENT_PEOPLE,
	defaultOpenToAll = true,
	learnMoreHref = "#",
	className,
}: Readonly<AgentUserProps>) {
	const [openToAll, setOpenToAll] = useState(defaultOpenToAll);
	const [people, setPeople] = useState<readonly AgentPerson[]>(initialPeople);
	const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
	const [addOpen, setAddOpen] = useState(false);

	function toggleSelected(id: string, checked: boolean): void {
		setSelected((prev) => {
			const next = new Set(prev);
			if (checked) {
				next.add(id);
			} else {
				next.delete(id);
			}
			return next;
		});
	}

	const allSelected = people.length > 0 && people.every((person) => selected.has(person.id));
	const someSelected = people.some((person) => selected.has(person.id));

	function toggleAll(checked: boolean): void {
		setSelected(checked ? new Set(people.map((person) => person.id)) : new Set());
	}

	function handleAdd(payload: AddUserPayload): void {
		setPeople((prev) => [
			...prev,
			{
				id: `u-${Date.now()}`,
				name: payload.name,
				role: payload.role,
			},
		]);
	}

	return (
		<div className={cn("flex w-full max-w-4xl flex-col gap-6", className)}>
			<header className="flex flex-col gap-1">
				<h1 className="text-xl font-semibold text-text">Users</h1>
				<p className="text-sm text-text-subtle">
					Manage who has access to your agent.{" "}
					<a
						href={learnMoreHref}
						className="text-link underline-offset-2 hover:underline"
					>
						More about Rovo agent users and permissions.
					</a>
				</p>
			</header>

			<section className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
				<SettingRow
					title="Owner"
					description="The person who can edit, delete, and manage the agent."
					control={<PersonInline person={owner} />}
				/>
				<SettingRow
					title="Author display name"
					description={'The person or team you want to show as the author for people browsing (for example "By IT Team").'}
					control={<PersonInline person={authorDisplay} />}
				/>
				<SettingRow
					title="User access"
					description="Allow anyone in this site to use this agent. You can turn this off to limit access to specific users."
					control={
						<label className="flex items-center gap-2">
							<Switch
								checked={openToAll}
								onCheckedChange={setOpenToAll}
								label="User access"
							/>
							<span className="text-sm text-text">
								{openToAll ? "Open to all users" : "Limited access"}
							</span>
						</label>
					}
				/>
			</section>

			<section className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<h2 className="text-base font-semibold text-text">People</h2>
						<Lozenge>{String(people.length)}</Lozenge>
					</div>
					<Button variant="outline" onClick={() => setAddOpen(true)}>
						Add people
					</Button>
				</div>

				<div className="overflow-hidden rounded-lg border border-border bg-surface">
					<Table>
						<TableHeader>
							<TableRow className="hover:bg-transparent">
								<TableHead className="w-12 pl-4">
									<Checkbox
										aria-label="Select all people"
										checked={allSelected}
										isIndeterminate={someSelected && !allSelected}
										onCheckedChange={(checked) => toggleAll(checked === true)}
									/>
								</TableHead>
								<TableHead>Name</TableHead>
								<TableHead>Role</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{people.map((person) => (
								<TableRow
									key={person.id}
									data-state={selected.has(person.id) ? "selected" : undefined}
								>
									<TableCell className="pl-4">
										<Checkbox
											aria-label={`Select ${person.name}`}
											checked={selected.has(person.id)}
											disabled={person.isOwner}
											onCheckedChange={(checked) =>
												toggleSelected(person.id, checked === true)
											}
										/>
									</TableCell>
									<TableCell>
										<span className="flex items-center gap-2">
											<PersonAvatar name={person.name} avatarSrc={person.avatarSrc} />
											<span className="text-sm text-text">{person.name}</span>
											{person.isOwner ? <Lozenge>Owner</Lozenge> : null}
										</span>
									</TableCell>
									<TableCell>
										<Lozenge>{getRoleOption(person.role).label}</Lozenge>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			</section>

			<AddUserDialog open={addOpen} onOpenChange={setAddOpen} onAdd={handleAdd} />
		</div>
	);
}
