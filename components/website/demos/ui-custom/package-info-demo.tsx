import {
	PackageInfo,
	PackageInfoChangeType,
	PackageInfoContent,
	PackageInfoDependencies,
	PackageInfoDependency,
	PackageInfoDescription,
	PackageInfoHeader,
	PackageInfoName,
	PackageInfoVersion,
} from "@/components/ui-custom/package-info";

export default function PackageInfoDemo() {
	return <PackageInfoDemoFull />;
}

export function PackageInfoDemoFull() {
	return (
		<PackageInfo
			name="react"
			currentVersion="18.2.0"
			newVersion="19.0.0"
			changeType="major"
			className="w-full max-w-sm"
		>
			<PackageInfoHeader>
				<PackageInfoName />
				<PackageInfoChangeType />
			</PackageInfoHeader>
			<PackageInfoVersion />
			<PackageInfoDescription>
				A JavaScript library for building user interfaces.
			</PackageInfoDescription>
			<PackageInfoContent>
				<PackageInfoDependencies>
					<PackageInfoDependency name="react-dom" version="19.0.0" />
					<PackageInfoDependency name="scheduler" version="0.25.0" />
				</PackageInfoDependencies>
			</PackageInfoContent>
		</PackageInfo>
	);
}

export function PackageInfoDemoChangeTypes() {
	const packages = [
		{ name: "next", currentVersion: "15.1.0", newVersion: "16.0.0", changeType: "major" as const },
		{ name: "typescript", currentVersion: "5.6.0", newVersion: "5.7.0", changeType: "minor" as const },
		{ name: "eslint", currentVersion: "9.0.0", newVersion: "9.0.1", changeType: "patch" as const },
		{ name: "@ai-sdk/react", changeType: "added" as const, newVersion: "1.2.0" },
		{ name: "framer-motion", currentVersion: "11.0.0", changeType: "removed" as const },
	];

	return (
		<div className="flex w-full max-w-sm flex-col gap-3">
			{packages.map((pkg) => (
				<PackageInfo key={pkg.name} {...pkg} className="w-full">
					<PackageInfoHeader>
						<PackageInfoName />
						<PackageInfoChangeType />
					</PackageInfoHeader>
					{(pkg.currentVersion || pkg.newVersion) ? <PackageInfoVersion /> : null}
				</PackageInfo>
			))}
		</div>
	);
}

export function PackageInfoDemoWithDependencies() {
	return (
		<PackageInfo
			name="@ai-sdk/react"
			newVersion="1.2.0"
			changeType="added"
			className="w-full max-w-sm"
		>
			<PackageInfoHeader>
				<PackageInfoName />
				<PackageInfoChangeType />
			</PackageInfoHeader>
			<PackageInfoVersion />
			<PackageInfoContent>
				<PackageInfoDependencies>
					<PackageInfoDependency name="ai" version="^4.0.0" />
					<PackageInfoDependency name="swr" version="^2.2.0" />
					<PackageInfoDependency name="throttleit" version="^2.1.0" />
				</PackageInfoDependencies>
			</PackageInfoContent>
		</PackageInfo>
	);
}

export function PackageInfoDemoMinimal() {
	return (
		<PackageInfo
			name="tailwindcss"
			currentVersion="3.4.0"
			newVersion="4.0.0"
			className="w-full max-w-sm"
		>
			<PackageInfoHeader>
				<PackageInfoName />
				<PackageInfoVersion />
			</PackageInfoHeader>
		</PackageInfo>
	);
}
