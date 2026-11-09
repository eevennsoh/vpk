"use client";

import {
	EnvironmentVariable,
	EnvironmentVariableHeader,
	EnvironmentVariableTitle,
	EnvironmentVariableToggle,
	EnvironmentVariableContent,
	EnvironmentVariableItem,
	EnvironmentVariableName,
	EnvironmentVariableValue,
	EnvironmentVariableCopyButton,
	EnvironmentVariableRequired,
	EnvironmentVariableGroup,
} from "@/components/ui-custom/environment-variable";

export default function EnvironmentVariableDemo() {
	return (
		<EnvironmentVariable className="w-full max-w-lg">
			<EnvironmentVariableHeader>
				<EnvironmentVariableTitle />
				<EnvironmentVariableToggle />
			</EnvironmentVariableHeader>
			<EnvironmentVariableContent>
				<EnvironmentVariableItem name="OPENAI_API_KEY" value="sk-proj-abc123def456">
					<EnvironmentVariableGroup>
						<EnvironmentVariableName />
						<EnvironmentVariableRequired />
					</EnvironmentVariableGroup>
					<EnvironmentVariableGroup>
						<EnvironmentVariableValue />
						<EnvironmentVariableCopyButton />
					</EnvironmentVariableGroup>
				</EnvironmentVariableItem>
				<EnvironmentVariableItem name="DATABASE_URL" value="postgresql://user:pass@localhost:5432/db">
					<EnvironmentVariableGroup>
						<EnvironmentVariableName />
						<EnvironmentVariableRequired />
					</EnvironmentVariableGroup>
					<EnvironmentVariableGroup>
						<EnvironmentVariableValue />
						<EnvironmentVariableCopyButton />
					</EnvironmentVariableGroup>
				</EnvironmentVariableItem>
				<EnvironmentVariableItem name="NODE_ENV" value="production">
					<EnvironmentVariableGroup>
						<EnvironmentVariableName />
					</EnvironmentVariableGroup>
					<EnvironmentVariableGroup>
						<EnvironmentVariableValue />
						<EnvironmentVariableCopyButton />
					</EnvironmentVariableGroup>
				</EnvironmentVariableItem>
			</EnvironmentVariableContent>
		</EnvironmentVariable>
	);
}

export function EnvironmentVariableDemoWithCopy() {
	return (
		<EnvironmentVariable className="w-full max-w-lg">
			<EnvironmentVariableHeader>
				<EnvironmentVariableTitle />
				<EnvironmentVariableToggle />
			</EnvironmentVariableHeader>
			<EnvironmentVariableContent>
				<EnvironmentVariableItem name="API_KEY" value="sk-123abc">
					<EnvironmentVariableName />
					<EnvironmentVariableGroup>
						<EnvironmentVariableValue />
						<EnvironmentVariableCopyButton copyFormat="value" />
					</EnvironmentVariableGroup>
				</EnvironmentVariableItem>
				<EnvironmentVariableItem name="SECRET_TOKEN" value="tok_live_9x8y7z">
					<EnvironmentVariableName />
					<EnvironmentVariableGroup>
						<EnvironmentVariableValue />
						<EnvironmentVariableCopyButton copyFormat="export" />
					</EnvironmentVariableGroup>
				</EnvironmentVariableItem>
			</EnvironmentVariableContent>
		</EnvironmentVariable>
	);
}

export function EnvironmentVariableDemoWithRequired() {
	return (
		<EnvironmentVariable className="w-full max-w-lg">
			<EnvironmentVariableHeader>
				<EnvironmentVariableTitle />
				<EnvironmentVariableToggle />
			</EnvironmentVariableHeader>
			<EnvironmentVariableContent>
				<EnvironmentVariableItem name="OPENAI_API_KEY" value="sk-proj-abc123">
					<EnvironmentVariableGroup>
						<EnvironmentVariableName />
						<EnvironmentVariableRequired />
					</EnvironmentVariableGroup>
					<EnvironmentVariableValue />
				</EnvironmentVariableItem>
				<EnvironmentVariableItem name="ANTHROPIC_API_KEY" value="sk-ant-xyz789">
					<EnvironmentVariableGroup>
						<EnvironmentVariableName />
						<EnvironmentVariableRequired />
					</EnvironmentVariableGroup>
					<EnvironmentVariableValue />
				</EnvironmentVariableItem>
				<EnvironmentVariableItem name="DEBUG" value="false">
					<EnvironmentVariableName />
					<EnvironmentVariableValue />
				</EnvironmentVariableItem>
			</EnvironmentVariableContent>
		</EnvironmentVariable>
	);
}

export function EnvironmentVariableDemoMinimal() {
	return (
		<EnvironmentVariable className="w-full max-w-lg">
			<EnvironmentVariableHeader>
				<EnvironmentVariableTitle />
				<EnvironmentVariableToggle />
			</EnvironmentVariableHeader>
			<EnvironmentVariableContent>
				<EnvironmentVariableItem name="API_KEY" value="sk-123abc" />
				<EnvironmentVariableItem name="NODE_ENV" value="production" />
			</EnvironmentVariableContent>
		</EnvironmentVariable>
	);
}

export function EnvironmentVariableDemoRevealed() {
	return (
		<EnvironmentVariable className="w-full max-w-lg" defaultShowValues>
			<EnvironmentVariableHeader>
				<EnvironmentVariableTitle>API Configuration</EnvironmentVariableTitle>
				<EnvironmentVariableToggle />
			</EnvironmentVariableHeader>
			<EnvironmentVariableContent>
				<EnvironmentVariableItem name="BASE_URL" value="https://api.example.com">
					<EnvironmentVariableGroup>
						<EnvironmentVariableName />
					</EnvironmentVariableGroup>
					<EnvironmentVariableGroup>
						<EnvironmentVariableValue />
						<EnvironmentVariableCopyButton />
					</EnvironmentVariableGroup>
				</EnvironmentVariableItem>
				<EnvironmentVariableItem name="API_VERSION" value="v2">
					<EnvironmentVariableGroup>
						<EnvironmentVariableName />
					</EnvironmentVariableGroup>
					<EnvironmentVariableGroup>
						<EnvironmentVariableValue />
						<EnvironmentVariableCopyButton />
					</EnvironmentVariableGroup>
				</EnvironmentVariableItem>
				<EnvironmentVariableItem name="TIMEOUT_MS" value="5000">
					<EnvironmentVariableGroup>
						<EnvironmentVariableName />
					</EnvironmentVariableGroup>
					<EnvironmentVariableGroup>
						<EnvironmentVariableValue />
						<EnvironmentVariableCopyButton />
					</EnvironmentVariableGroup>
				</EnvironmentVariableItem>
			</EnvironmentVariableContent>
		</EnvironmentVariable>
	);
}
