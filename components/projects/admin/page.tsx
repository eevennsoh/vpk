"use client";

import { useEffect } from "react";
import AppLayout from "@/components/projects/page";
import { AdminProvider, useAdmin } from "@/components/blocks/product-sidebar/variants/admin-context";
import { AdminView } from "./components/admin-view";

interface AdminProjectPageProps {
	embedded?: boolean;
}

export default function AdminProjectPage({
	embedded = false,
}: Readonly<AdminProjectPageProps>) {
	return (
		<AdminProvider>
			<AdminProjectSurface embedded={embedded} />
		</AdminProvider>
	);
}

function AdminProjectSurface({ embedded }: Readonly<{ embedded: boolean }>) {
	const {
		selectedItem,
		setSelectedItem,
		rovoChatEnabled,
	} = useAdmin();

	useEffect(() => {
		setSelectedItem("Overview");
	}, [setSelectedItem]);

	return (
		<AppLayout product="admin" embedded={embedded} hideRovoAction={!rovoChatEnabled}>
			<main data-testid="admin-project-surface" className="min-h-full bg-bg-neutral-subtle">
				<AdminView selectedItem={selectedItem} />
			</main>
		</AppLayout>
	);
}
