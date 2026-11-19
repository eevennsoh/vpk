"use client";

import { CheckIcon } from "@/components/ui/vpk-icons";

import {
	MicSelector,
	MicSelectorContent,
	MicSelectorEmpty,
	MicSelectorInput,
	MicSelectorItem,
	MicSelectorLabel,
	MicSelectorList,
	MicSelectorTrigger,
	MicSelectorValue,
} from "@/components/ui-custom/mic-selector";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function MicSelectorDemo() {
	return (
		<MicSelector>
			<MicSelectorTrigger className="w-[280px]">
				<MicSelectorValue />
			</MicSelectorTrigger>
			<MicSelectorContent>
				<MicSelectorInput />
				<MicSelectorList>
					{(devices) =>
						devices.length > 0 ? (
							devices.map((device) => (
								<MicSelectorItem
									key={device.deviceId}
									value={device.deviceId}
								>
									<MicSelectorLabel device={device} />
								</MicSelectorItem>
							))
						) : (
							<MicSelectorEmpty />
						)
					}
				</MicSelectorList>
			</MicSelectorContent>
		</MicSelector>
	);
}

export function MicSelectorDemoControlled() {
	const [deviceId, setDeviceId] = useState<string | undefined>(undefined);

	return (
		<div className="flex flex-col gap-3">
			<MicSelector value={deviceId} onValueChange={setDeviceId}>
				<MicSelectorTrigger className="w-[280px]">
					<MicSelectorValue />
				</MicSelectorTrigger>
				<MicSelectorContent>
					<MicSelectorInput />
					<MicSelectorList>
						{(devices) =>
							devices.length > 0 ? (
								devices.map((device) => (
									<MicSelectorItem
										key={device.deviceId}
										value={device.deviceId}
									>
										<MicSelectorLabel device={device} />
									</MicSelectorItem>
								))
							) : (
								<MicSelectorEmpty />
							)
						}
					</MicSelectorList>
				</MicSelectorContent>
			</MicSelector>
			<p className="text-xs text-text-subtle">
				Selected: {deviceId ?? "none"}
			</p>
		</div>
	);
}

export function MicSelectorDemoWithCheckmark() {
	const [deviceId, setDeviceId] = useState<string | undefined>(undefined);

	return (
		<MicSelector value={deviceId} onValueChange={setDeviceId}>
			<MicSelectorTrigger className="w-[320px]">
				<MicSelectorValue />
			</MicSelectorTrigger>
			<MicSelectorContent>
				<MicSelectorInput />
				<MicSelectorList>
					{(devices) =>
						devices.length > 0 ? (
							devices.map((device) => (
								<MicSelectorItem
									key={device.deviceId}
									value={device.deviceId}
								>
									<MicSelectorLabel className="flex-1" device={device} />
									<CheckIcon
										className={cn(
											"shrink-0 text-icon-subtle",
											deviceId === device.deviceId
												? "opacity-100"
												: "opacity-0",
										)}
										label=""
										size="small"
									/>
								</MicSelectorItem>
							))
						) : (
							<MicSelectorEmpty />
						)
					}
				</MicSelectorList>
			</MicSelectorContent>
		</MicSelector>
	);
}

export function MicSelectorDemoCompact() {
	return (
		<MicSelector>
			<MicSelectorTrigger className="w-[200px]" size="default">
				<MicSelectorValue />
			</MicSelectorTrigger>
			<MicSelectorContent>
				<MicSelectorList>
					{(devices) =>
						devices.length > 0 ? (
							devices.map((device) => (
								<MicSelectorItem
									key={device.deviceId}
									value={device.deviceId}
								>
									<MicSelectorLabel device={device} />
								</MicSelectorItem>
							))
						) : (
							<MicSelectorEmpty />
						)
					}
				</MicSelectorList>
			</MicSelectorContent>
		</MicSelector>
	);
}
