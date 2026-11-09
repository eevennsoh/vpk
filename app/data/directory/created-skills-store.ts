"use client";

/**
 * Runtime "created-skills" registry.
 *
 * The static catalog ({@link DEFAULT_SKILLS}, backed by `skills.json`) is read by
 * three paths that assume a fixed set of skills: the `/` editor menu, the
 * skill-tag color/icon lookup (`getSkillMentionTagProps` in the rich-text editor's
 * mention node-view), and the skills directory dialog. When the `create-skill`
 * demo flow generates a brand-new skill at runtime, it must resolve in all three.
 *
 * This is a small module-level store so that:
 * - Non-React code (the Tiptap mention node-view's tag lookup) can read it
 *   synchronously via {@link getCreatedSkills}.
 * - React surfaces can subscribe reactively via {@link useCreatedSkills}.
 *
 * It lives alongside the catalog (rather than under a project folder) because the
 * shared mention node-view consumes it. The store is session-scoped and in-memory
 * (demo only) and starts empty, so no surface changes behavior until a skill is
 * created.
 */

import { useSyncExternalStore } from "react";
import type { SkillDirectorySkill } from "./skills";

let createdSkills: readonly SkillDirectorySkill[] = [];
const listeners = new Set<() => void>();

function emit(): void {
	for (const listener of listeners) {
		listener();
	}
}

/** Current runtime-created skills (newest last). Safe to call outside React. */
export function getCreatedSkills(): readonly SkillDirectorySkill[] {
	return createdSkills;
}

/**
 * Adds (or replaces, by id) a runtime-created skill and notifies subscribers.
 * Replacing by id keeps re-runs of the demo idempotent.
 */
export function addCreatedSkill(skill: SkillDirectorySkill): void {
	createdSkills = [...createdSkills.filter((entry) => entry.id !== skill.id), skill];
	emit();
}

/** Clears all runtime-created skills (used to reset the demo). */
export function resetCreatedSkills(): void {
	if (createdSkills.length === 0) {
		return;
	}
	createdSkills = [];
	emit();
}

/** Subscribe to store changes. Returns an unsubscribe fn. */
export function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/** Reactive accessor for React surfaces. */
export function useCreatedSkills(): readonly SkillDirectorySkill[] {
	return useSyncExternalStore(subscribe, getCreatedSkills, getCreatedSkills);
}
