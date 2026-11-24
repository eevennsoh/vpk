"use client";

import { createContext, use, useCallback, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { RovoAgentProfile } from "@/app/data/directory/agents";
import type { SkillDirectorySkill } from "@/app/data/directory/skills";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ScriptedCreationKind = "agent" | "skill";
type ScriptedCreation = Readonly<{
	agents: readonly RovoAgentProfile[];
	skills: readonly SkillDirectorySkill[];
	open: (kind: ScriptedCreationKind) => void;
}>;

const ScriptedCreationContext = createContext<ScriptedCreation | null>(null);

export function useButterScriptedCreation() {
	return use(ScriptedCreationContext);
}

export function ButterScriptedCreationProvider({ children }: Readonly<{ children: ReactNode }>) {
	const [kind, setKind] = useState<ScriptedCreationKind | null>(null);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [agents, setAgents] = useState<readonly RovoAgentProfile[]>([]);
	const [skills, setSkills] = useState<readonly SkillDirectorySkill[]>([]);
	const [announcement, setAnnouncement] = useState("");
	const open = useCallback((next: ScriptedCreationKind) => { setName(""); setDescription(""); setKind(next); }, []);
	const value = useMemo(() => ({ agents, skills, open }), [agents, skills, open]);
	const create = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const title = name.trim();
		if (!title || !kind) return;
		const id = `demo-${kind}-${crypto.randomUUID()}`;
		if (kind === "agent") setAgents((current) => [...current, { id, name: title, byline: "Demo agent", description: description.trim(), starters: [] }]);
		else setSkills((current) => [...current, { id, name: title, description: description.trim(), source: "custom", instructions: description.trim() }]);
		setAnnouncement(`${title} created`);
		setKind(null);
	};
	return <ScriptedCreationContext value={value}>
		{children}
		<span className="sr-only" role="status">{announcement}</span>
		<Dialog open={kind !== null} onOpenChange={(openState) => { if (!openState) setKind(null); }}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create {kind === "agent" ? "agent" : "skill"}</DialogTitle>
					<DialogDescription>This demo creates a sample {kind === "agent" ? "agent" : "skill"} for this session.</DialogDescription>
				</DialogHeader>
				<form className="flex flex-col gap-4" onSubmit={create}>
					<div className="flex flex-col gap-2"><Label htmlFor="butter-demo-name">Name</Label><Input id="butter-demo-name" value={name} onChange={(event) => setName(event.target.value)} required /></div>
					<div className="flex flex-col gap-2"><Label htmlFor="butter-demo-description">Description</Label><Textarea id="butter-demo-description" value={description} onChange={(event) => setDescription(event.target.value)} /></div>
					<DialogFooter><Button type="submit">Create {kind === "agent" ? "agent" : "skill"}</Button></DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	</ScriptedCreationContext>;
}
