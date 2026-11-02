"use client";

import { MotionConfig } from "motion/react";
import { ThemeWrapper } from "@/components/utils/theme-wrapper";
import { UserInvalidSync } from "@/components/utils/user-invalid-sync";
import { SidebarProvider } from "@/app/contexts/context-sidebar";
import { configurePlatformFeatureFlags } from "@/lib/platform-feature-flags";

configurePlatformFeatureFlags();

export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<MotionConfig reducedMotion="user">
			<ThemeWrapper>
				<SidebarProvider>
					<UserInvalidSync />
					{children}
				</SidebarProvider>
			</ThemeWrapper>
		</MotionConfig>
	);
}
