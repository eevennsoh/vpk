"use client";

import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	SonnerToast,
	Toaster,
	type SonnerToastProps,
} from "@/components/ui/sonner";

type DemoToastProps = Omit<SonnerToastProps, "onDismiss">;
type DemoToastOptions = Parameters<typeof toast.custom>[1];

function showDemoToast(
	toastProps: DemoToastProps,
	toasterId: string,
	options?: DemoToastOptions
) {
	return toast.custom(
		(id) => (
			<SonnerToast
				{...toastProps}
				onDismiss={() => toast.dismiss(id)}
			/>
		),
		{
			...options,
			toasterId,
		}
	);
}

export default function SonnerDemo() {
	const toasterId = "sonner-demo-preview";

	return (
		<div>
			<Toaster id={toasterId} />
			<Button
				variant="outline"
				size="default"
				onClick={() =>
					showDemoToast({
						title: "Event has been created",
					}, toasterId)
				}
			>
				Show toast
			</Button>
		</div>
	);
}

export function SonnerDemoDefault() {
	const toasterId = "sonner-demo-default";

	return (
		<div>
			<Toaster id={toasterId} />
			<Button
				variant="outline"
				onClick={() =>
					showDemoToast({
						title: "Event has been created",
					}, toasterId)
				}
			>
				Show toast
			</Button>
		</div>
	);
}

export function SonnerDemoVariants() {
	const toasterId = "sonner-demo-variants";

	return (
		<div>
			<Toaster id={toasterId} />
			<div className="flex flex-wrap gap-2">
				<Button
					variant="outline"
					onClick={() =>
						showDemoToast({
							appearance: "success",
							title: "Your changes have been saved successfully.",
						}, toasterId)
					}
				>
					Success
				</Button>
				<Button
					variant="outline"
					onClick={() =>
						showDemoToast({
							appearance: "error",
							title: "Something went wrong. Please try again.",
						}, toasterId)
					}
				>
					Error
				</Button>
				<Button
					variant="outline"
					onClick={() =>
						showDemoToast({
							appearance: "warning",
							title: "This action cannot be undone.",
						}, toasterId)
					}
				>
					Warning
				</Button>
				<Button
					variant="outline"
					onClick={() =>
						showDemoToast({
							appearance: "info",
							title: "A new version is available.",
						}, toasterId)
					}
				>
					Info
				</Button>
			</div>
		</div>
	);
}

export function SonnerDemoWithDescription() {
	const toasterId = "sonner-demo-with-description";

	return (
		<div>
			<Toaster id={toasterId} />
			<Button
				onClick={() =>
					showDemoToast({
						title: "Event has been created",
						description: "Monday, January 3rd at 6:00pm",
					}, toasterId)
				}
				variant="outline"
			>
				With description
			</Button>
		</div>
	);
}

export function SonnerDemoWithAction() {
	const toasterId = "sonner-demo-with-action";

	return (
		<div>
			<Toaster id={toasterId} />
			<div className="flex flex-wrap gap-2">
				<Button
					variant="outline"
					onClick={() =>
						showDemoToast({
							dismissible: true,
							title: "Event has been created",
							description: "Monday, January 3rd at 6:00pm",
							action: {
								label: "Undo",
								onClick: () => {
									console.log("Undo");
								},
							},
							secondaryAction: {
								label: "View event",
								onClick: () => {
									console.log("View event");
								},
							},
						}, toasterId)
					}
				>
					With action
				</Button>
				<Button
					variant="outline"
					onClick={() =>
						showDemoToast({
							appearance: "error",
							title: "Failed to save changes",
							dismissible: true,
							action: {
								label: "Retry",
								onClick: () => {
									console.log("Retry");
								},
							},
						}, toasterId)
					}
				>
					Error with retry
				</Button>
			</div>
		</div>
	);
}

export function SonnerDemoAutoDismiss() {
	const toasterId = "sonner-demo-auto-dismiss";

	return (
		<div>
			<Toaster id={toasterId} />
			<div className="flex flex-wrap gap-2">
				<Button
					variant="outline"
					onClick={() =>
						showDemoToast(
							{
								appearance: "success",
								title: "Saved!",
							},
							toasterId,
							{ duration: 2000 }
						)
					}
				>
					2s auto-dismiss
				</Button>
				<Button
					variant="outline"
					onClick={() =>
						showDemoToast(
							{
								appearance: "info",
								title: "This will stay longer",
							},
							toasterId,
							{ duration: 10000 }
						)
					}
				>
					10s auto-dismiss
				</Button>
				<Button
					variant="outline"
					onClick={() =>
						showDemoToast(
							{
								title: "Persistent notification",
								dismissible: true,
							},
							toasterId,
							{ duration: Infinity }
						)
					}
				>
					No auto-dismiss
				</Button>
			</div>
		</div>
	);
}

export function SonnerDemoPromise() {
	const toasterId = "sonner-demo-promise";

	return (
		<div>
			<Toaster id={toasterId} />
			<Button
				variant="outline"
				onClick={async () => {
					const loadingToastId = showDemoToast(
						{
							appearance: "info",
							title: "Deploying...",
							icon: <Spinner className="text-icon-information" />,
							iconLabel: "Loading",
						},
						toasterId,
						{ duration: Infinity }
					);

					try {
						const data = await new Promise<{ name: string }>((resolve) =>
							setTimeout(() => resolve({ name: "Deployment" }), 2000)
						);
						toast.dismiss(loadingToastId);
						showDemoToast({
							appearance: "success",
							title: `${data.name} completed successfully`,
						}, toasterId);
					} catch {
						toast.dismiss(loadingToastId);
						showDemoToast({
							appearance: "error",
							title: "Deployment failed",
							dismissible: true,
						}, toasterId);
					}
				}}
			>
				Promise toast
			</Button>
		</div>
	);
}

export function SonnerDemoCloseButton() {
	const toasterId = "sonner-demo-close-button";

	return (
		<div>
			<Toaster id={toasterId} />
			<Button
				variant="outline"
				onClick={() =>
					showDemoToast({
						dismissible: true,
						title: "Notification with close button",
						description: "Click the X to dismiss manually.",
					}, toasterId)
				}
			>
				With close button
			</Button>
		</div>
	);
}

export function SonnerDemoLongTitle() {
	const toasterId = "sonner-demo-long-title";

	return (
		<div>
			<Toaster id={toasterId} />
			<Button
				variant="outline"
				onClick={() =>
					showDemoToast(
						{
							appearance: "success",
							dismissible: true,
							title: "Your deployment to production-us-east-1 has been completed and all services are now running",
							description: "3 services updated across 2 regions.",
							action: {
								label: "Undo",
								onClick: () => {
									console.log("Undo");
								},
							},
						},
						toasterId,
						{ duration: Infinity }
					)
				}
			>
				Long title with close button
			</Button>
		</div>
	);
}
