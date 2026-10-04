"use client";

import { useState } from "react";
import { CheckIcon, XIcon, TrashIcon, CalendarIcon, ShieldAlertIcon } from "@/components/ui/vpk-icons";
import {
	Confirmation,
	ConfirmationTitle,
	ConfirmationRequest,
	ConfirmationAccepted,
	ConfirmationRejected,
	ConfirmationActions,
	ConfirmationAction,
} from "@/components/ui-custom/confirmation";

export default function ConfirmationDemo() {
	return <ConfirmationDemoRequest />;
}

export function ConfirmationDemoRequest() {
	return (
		<Confirmation
			approval={{ id: "1" }}
			state="approval-requested"
			className="w-full max-w-md"
		>
			<ConfirmationTitle>Allow file access?</ConfirmationTitle>
			<ConfirmationRequest>
				<p className="text-sm text-text-subtle">
					The assistant wants to read files from your workspace.
				</p>
				<ConfirmationActions>
					<ConfirmationAction variant="outline">Deny</ConfirmationAction>
					<ConfirmationAction>Allow</ConfirmationAction>
				</ConfirmationActions>
			</ConfirmationRequest>
		</Confirmation>
	);
}

export function ConfirmationDemoAccepted() {
	return (
		<Confirmation
			approval={{ id: "2", approved: true }}
			state="output-available"
			className="w-full max-w-md"
		>
			<ConfirmationTitle>File access</ConfirmationTitle>
			<ConfirmationAccepted>
				<div className="flex items-center gap-2 text-sm text-text-success">
					<CheckIcon className="size-4 shrink-0" />
					<span>You approved file access</span>
				</div>
			</ConfirmationAccepted>
		</Confirmation>
	);
}

export function ConfirmationDemoRejected() {
	return (
		<Confirmation
			approval={{ id: "3", approved: false }}
			state="output-denied"
			className="w-full max-w-md"
		>
			<ConfirmationTitle>File access</ConfirmationTitle>
			<ConfirmationRejected>
				<div className="flex items-center gap-2 text-sm text-text-danger">
					<XIcon className="size-4 shrink-0" />
					<span>You denied file access</span>
				</div>
			</ConfirmationRejected>
		</Confirmation>
	);
}

export function ConfirmationDemoInteractive() {
	const [state, setState] = useState<"approval-requested" | "approval-responded" | "output-available" | "output-denied">("approval-requested");
	const [approved, setApproved] = useState<boolean | undefined>(undefined);

	const approval = approved === undefined
		? { id: "4" }
		: { id: "4", approved };

	const reset = () => {
		setState("approval-requested");
		setApproved(undefined);
	};

	return (
		<div className="flex w-full max-w-md flex-col gap-3">
			<Confirmation
				approval={approval as { id: string }}
				state={state}
				className="w-full"
			>
				<ConfirmationTitle>
					<div className="flex items-center gap-2">
						<TrashIcon className="size-4 shrink-0" />
						Delete <code className="rounded bg-bg-neutral px-1.5 py-0.5 text-xs">/tmp/example.txt</code>?
					</div>
				</ConfirmationTitle>
				<ConfirmationRequest>
					<p className="text-sm text-text-subtle">
						This action will permanently remove the file. It cannot be undone.
					</p>
					<ConfirmationActions>
						<ConfirmationAction
							variant="outline"
							onClick={() => {
								setApproved(false);
								setState("output-denied");
							}}
						>
							Deny
						</ConfirmationAction>
						<ConfirmationAction
							variant="destructive"
							onClick={() => {
								setApproved(true);
								setState("output-available");
							}}
						>
							Delete
						</ConfirmationAction>
					</ConfirmationActions>
				</ConfirmationRequest>
				<ConfirmationAccepted>
					<div className="flex items-center gap-2 text-sm text-text-success">
						<CheckIcon className="size-4 shrink-0" />
						<span>File deleted successfully</span>
					</div>
				</ConfirmationAccepted>
				<ConfirmationRejected>
					<div className="flex items-center gap-2 text-sm text-text-danger">
						<XIcon className="size-4 shrink-0" />
						<span>Deletion was denied</span>
					</div>
				</ConfirmationRejected>
			</Confirmation>
			{state !== "approval-requested" ? <button
					type="button"
					onClick={reset}
					className="self-start text-xs text-link underline-offset-2 hover:underline"
				>
					Reset demo
				</button> : null}
		</div>
	);
}

export function ConfirmationDemoVariants() {
	return (
		<div className="flex w-full max-w-md flex-col gap-4">
			<Confirmation
				approval={{ id: "5" }}
				state="approval-requested"
				variant="warning"
				className="w-full"
			>
				<ShieldAlertIcon className="size-4" />
				<ConfirmationTitle>Elevated permissions required</ConfirmationTitle>
				<ConfirmationRequest>
					<p className="text-sm text-text-subtle">
						This tool needs admin access to modify system settings.
					</p>
					<ConfirmationActions>
						<ConfirmationAction variant="outline">Deny</ConfirmationAction>
						<ConfirmationAction>Grant access</ConfirmationAction>
					</ConfirmationActions>
				</ConfirmationRequest>
			</Confirmation>

			<Confirmation
				approval={{ id: "6" }}
				state="approval-requested"
				variant="danger"
				className="w-full"
			>
				<TrashIcon className="size-4" />
				<ConfirmationTitle>Destructive action</ConfirmationTitle>
				<ConfirmationRequest>
					<p className="text-sm text-text-subtle">
						This will permanently delete the database table and all its records.
					</p>
					<ConfirmationActions>
						<ConfirmationAction variant="outline">Cancel</ConfirmationAction>
						<ConfirmationAction variant="destructive">Delete table</ConfirmationAction>
					</ConfirmationActions>
				</ConfirmationRequest>
			</Confirmation>

			<Confirmation
				approval={{ id: "7" }}
				state="approval-requested"
				variant="discovery"
				className="w-full"
			>
				<CalendarIcon className="size-4" />
				<ConfirmationTitle>Schedule a meeting</ConfirmationTitle>
				<ConfirmationRequest>
					<p className="text-sm text-text-subtle">
						The assistant wants to create a calendar event for tomorrow at 2pm.
					</p>
					<ConfirmationActions>
						<ConfirmationAction variant="outline">Decline</ConfirmationAction>
						<ConfirmationAction>Schedule</ConfirmationAction>
					</ConfirmationActions>
				</ConfirmationRequest>
			</Confirmation>
		</div>
	);
}
