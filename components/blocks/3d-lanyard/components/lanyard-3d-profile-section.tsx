"use client";

import { useId, useRef } from "react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Lanyard3DProfile } from "../data";

interface Lanyard3DProfileSectionProps {
	readonly profiles: readonly Lanyard3DProfile[];
	readonly profile: Lanyard3DProfile;
	readonly onSelect: (id: string) => void;
	readonly onChange: (patch: Partial<Omit<Lanyard3DProfile, "id">>) => void;
}

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export function profileInitials(name: string) {
	return name.trim().split(/\s+/).filter(Boolean).map((word) => word[0]).slice(0, 2).join("").toUpperCase();
}

function ProfileAvatar({ profile, size }: Readonly<{ profile: Lanyard3DProfile; size: number }>) {
	return profile.photo ? (
		<Image alt="" className="rounded-full object-cover" height={size} src={profile.photo} unoptimized width={size} />
	) : (
		<span aria-hidden className="flex items-center justify-center rounded-full bg-bg-neutral text-xs font-medium text-text-subtle" style={{ width: size, height: size }}>
			{profileInitials(profile.name) || "?"}
		</span>
	);
}

export function Lanyard3DProfileSection({ profiles, profile, onSelect, onChange }: Readonly<Lanyard3DProfileSectionProps>) {
	const id = useId();
	const fileRef = useRef<HTMLInputElement>(null);

	function readPhoto(file: File | undefined) {
		if (!file || !file.type.startsWith("image/") || file.size > MAX_PHOTO_BYTES) return;
		const reader = new FileReader();
		reader.onload = () => { if (typeof reader.result === "string") onChange({ photo: reader.result }); };
		reader.readAsDataURL(file);
	}

	return (
		<section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3" data-slot="lanyard-3d-profile-section">
			<h3 className="text-sm font-semibold text-text" id={`${id}-heading`}>Person</h3>
			<ToggleGroup
				aria-label="Choose a person"
				className="w-full"
				onValueChange={(next) => { if (next[0]) onSelect(next[0]); }}
				spacing={2}
				value={[profile.id]}
				variant="outline"
			>
				{profiles.map((item) => (
					<ToggleGroupItem aria-label={item.name.replace(/\n/g, " ")} className="h-auto flex-1 flex-col gap-1 px-1 py-2" key={item.id} value={item.id}>
						<ProfileAvatar profile={item} size={36} />
						<span className="max-w-full truncate text-xs">{item.name.split("\n")[0] || "Unnamed"}</span>
					</ToggleGroupItem>
				))}
			</ToggleGroup>
			<div className="flex items-center gap-3">
				<ProfileAvatar profile={profile} size={48} />
				<div className="flex flex-wrap gap-2">
					<Button onClick={() => fileRef.current?.click()} size="compact" variant="outline">Change photo</Button>
					<Button disabled={profile.photo === null} onClick={() => onChange({ photo: null })} size="compact" variant="ghost">Use initials</Button>
				</div>
				<input
					accept="image/png,image/jpeg,image/webp"
					aria-label="Upload a portrait"
					className="sr-only"
					onChange={(event) => { readPhoto(event.target.files?.[0]); event.target.value = ""; }}
					ref={fileRef}
					tabIndex={-1}
					type="file"
				/>
			</div>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={`${id}-name`}>Name <span className="font-normal text-text-subtle">Supports line breaks</span></Label>
				<Textarea id={`${id}-name`} maxLength={100} onChange={(event) => onChange({ name: event.target.value })} rows={2} spellCheck={false} value={profile.name} />
			</div>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={`${id}-role`}>Role</Label>
				<Textarea id={`${id}-role`} maxLength={140} onChange={(event) => onChange({ role: event.target.value })} rows={2} spellCheck={false} value={profile.role} />
			</div>
		</section>
	);
}
