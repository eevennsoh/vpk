"use client";

import { useCallback, useState } from "react";

/** Opening intent is reapplied on reopen or a different configured skill. Browse
 * navigation remains local, so callers never need to remount the whole dialog. */
export function useSkillsDirectoryView(open: boolean, initialDetailSkillId: string | null) {
	const [view, setView] = useState({ open, requestedSkillId: initialDetailSkillId, detailSkillId: initialDetailSkillId });
	if (view.open !== open || view.requestedSkillId !== initialDetailSkillId) {
		setView({ open, requestedSkillId: initialDetailSkillId, detailSkillId: open ? initialDetailSkillId : null });
	}
	const setDetailSkillId = useCallback((detailSkillId: string | null) => {
		setView((previous) => ({ ...previous, detailSkillId }));
	}, []);
	return [view.detailSkillId, setDetailSkillId] as const;
}
