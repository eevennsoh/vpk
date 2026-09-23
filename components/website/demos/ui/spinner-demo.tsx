"use client";

import { useState } from "react";

import { ArrowRightIcon } from "@/components/ui/vpk-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";

export default function SpinnerDemo() {
	return <Spinner size="xl" />;
}

export function SpinnerDemoBasic() {
	return (
		<div className="flex items-center gap-6">
			<Spinner />
			<Spinner size="xl" />
		</div>
	);
}

export function SpinnerDemoDefault() {
	return <Spinner />;
}

export function SpinnerDemoInBadges() {
	return (
		<div className="flex flex-wrap items-center justify-center gap-4">
			<Badge>
				<Spinner data-icon="inline-start" variant="inherit" />
				Badge
			</Badge>
			<Badge variant="neutral">
				<Spinner data-icon="inline-start" variant="inherit" />
				Badge
			</Badge>
			<Badge variant="danger">
				<Spinner data-icon="inline-start" variant="inherit" />
				Badge
			</Badge>
			<Badge variant="neutral">
				<Spinner data-icon="inline-start" variant="inherit" />
				Badge
			</Badge>
		</div>
	);
}

export function SpinnerDemoInButtons() {
	return (
		<div className="flex flex-wrap items-center gap-4">
			<Button>
				<Spinner data-icon="inline-start" variant="inherit" /> Submit
			</Button>
			<Button disabled>
				<Spinner data-icon="inline-start" variant="inherit" /> Disabled
			</Button>
			<Button variant="outline" disabled>
				<Spinner data-icon="inline-start" variant="inherit" /> Outline
			</Button>
			<Button variant="outline" size="icon" disabled>
				<Spinner data-icon="inline-start" variant="inherit" />
				<span className="sr-only">Loading...</span>
			</Button>
		</div>
	);
}

export function SpinnerDemoInEmptyState() {
	return (
		<Empty className="min-h-[300px]">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<Spinner />
				</EmptyMedia>
				<EmptyTitle>No projects yet</EmptyTitle>
				<EmptyDescription>
					You haven&apos;t created any projects yet. Get started by creating
					your first project.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<div className="flex gap-2">
					<Button render={<a aria-label="Spinner link" href="#" />} nativeButton={false}>
						Create project
					</Button>
					<Button variant="outline">Import project</Button>
				</div>
				<Button
					variant="link"
					render={<a aria-label="Spinner link" href="#" />}
					nativeButton={false}
					className="text-muted-foreground"
				>
					Learn more{" "}
					<ArrowRightIcon
					/>
				</Button>
			</EmptyContent>
		</Empty>
	);
}

export function SpinnerDemoInInputGroup() {
	return (
		<Field>
			<FieldLabel htmlFor="input-group-spinner">Input Group</FieldLabel>
			<InputGroup>
				<InputGroupInput id="input-group-spinner" />
				<InputGroupAddon>
					<Spinner />
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}

export function SpinnerDemoSizes() {
	return (
		<div className="flex items-center gap-4">
			<Spinner size="xs" />
			<Spinner size="sm" />
			<Spinner />
			<Spinner size="lg" />
			<Spinner size="xl" />
		</div>
	);
}

export function SpinnerDemoRainbow() {
	return (
		<div className="flex items-center gap-4">
			<Spinner variant="rainbow" size="sm" />
			<Spinner variant="rainbow" />
			<Spinner variant="rainbow" size="lg" />
			<Spinner variant="rainbow" size="xl" />
		</div>
	);
}

export function SpinnerDemoExperimental() {
	const [pulse, setPulse] = useState(false);
	const [avatar, setAvatar] = useState(false);
	const variant = avatar ? "experimental-avatar" : "experimental";

	return (
		<div className="flex flex-col items-center gap-4">
			<Field orientation="horizontal">
				<Switch
					checked={avatar}
					id="spinner-experimental-avatar"
					onCheckedChange={(checked) => {
						setAvatar(checked);
						if (checked) setPulse(true);
					}}
				/>
				<FieldLabel htmlFor="spinner-experimental-avatar">Avatar spinner</FieldLabel>
			</Field>
			<Field orientation="horizontal">
				<Switch
					checked={pulse}
					id="spinner-experimental-pulse"
					onCheckedChange={setPulse}
				/>
				<FieldLabel htmlFor="spinner-experimental-pulse">Grow in/out</FieldLabel>
			</Field>
			<div className="flex items-center gap-4">
				<Spinner pulse={pulse} size="sm" variant={variant} />
				<Spinner pulse={pulse} variant={variant} />
				<Spinner pulse={pulse} size="lg" variant={variant} />
				<Spinner pulse={pulse} size="xl" variant={variant} />
			</div>
		</div>
	);
}
