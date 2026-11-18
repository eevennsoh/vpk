"use client";

import type { ReactNode } from "react";
import { HeaderLanyards as SharedHeaderLanyards } from "@/components/projects/shared/components/eu26-header-lanyards";

export function HeaderLanyards({ children }: Readonly<{ children: ReactNode }>) {
	return <SharedHeaderLanyards positionerClassName="z-[600]" menuPositionerClassName="z-[700]">{children}</SharedHeaderLanyards>;
}
