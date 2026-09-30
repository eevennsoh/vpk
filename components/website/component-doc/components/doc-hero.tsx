import Link from "next/link";
import { token } from "@/lib/tokens";

interface DocHeroProps {
	name: string;
	description?: string;
	category: "ui-audio" | "ui-charts" | "ui-custom" | "ui" | "blocks" | "projects" | "arts" | "utility" | "visual";
	importPath: string;
	adsLinks?: Array<{ href: string; label: string }>;
	adsUrl?: string;
	adsPackage?: string;
}

export function DocHero({ name, description, category, importPath, adsLinks, adsUrl, adsPackage }: Readonly<DocHeroProps>) {
	const categoryLabel = category === "ui-audio" ? "UI — Audio" : category === "ui-charts" ? "UI — Charts" : category === "ui-custom" ? "UI — Custom" : category === "blocks" ? "Blocks" : category === "projects" ? "Projects" : category === "visual" ? "Visual" : category === "utility" ? "Utils" : category === "arts" ? "Arts" : "UI";
	const resolvedAdsLinks =
		adsLinks && adsLinks.length > 0
			? adsLinks
			: adsUrl
				? [{ href: adsUrl, label: adsPackage ?? "Atlassian Design System" }]
				: [];
	const importPaths = importPath
		.split("\n")
		.map(path => path.trim())
		.filter(Boolean);

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: token("space.200"),
				paddingBlock: token("space.400"),
				borderBottom: `1px solid ${token("color.border")}`,
			}}
		>
			{/* Breadcrumb */}
			<nav
				aria-label="Breadcrumb"
				style={{
					display: "flex",
					alignItems: "center",
					gap: token("space.075"),
					fontSize: "13px",
					color: token("color.text.subtlest"),
				}}
			>
				<Link
					href="/"
					style={{
						color: token("color.text.subtle"),
						textDecoration: "none",
					}}
				>
					Components
				</Link>
				<span>/</span>
				<span style={{ color: token("color.text.subtle") }}>{categoryLabel}</span>
				<span>/</span>
				<span style={{ color: token("color.text") }}>{name}</span>
			</nav>

			{/* Title row */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: token("space.150"),
				}}
			>
				<h1
					style={{
						fontSize: "28px",
						fontWeight: 600,
						color: token("color.text"),
						letterSpacing: "-0.02em",
						margin: 0,
					}}
				>
					{name}
				</h1>

				{/* Description */}
				{description ? <p
						style={{
							fontSize: "15px",
							color: token("color.text.subtle"),
							lineHeight: 1.6,
							width: "100%",
							margin: 0,
						}}
					>
						{description}
					</p> : null}

				{/* Import path and ADS link */}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						gap: token("space.075"),
					}}
				>
					{importPaths.map(path => (
						<code
							key={path}
							style={{
								display: "block",
								maxWidth: "100%",
								fontSize: "13px",
								color: token("color.text.subtlest"),
								fontFamily: "monospace",
								overflowWrap: "anywhere",
								wordBreak: "break-word",
							}}
						>
							{path}
						</code>
					))}
					{resolvedAdsLinks.map(link => (
						<a
							key={link.href}
							href={link.href}
							target="_blank"
							rel="noopener noreferrer"
							className="no-underline hover:underline decoration-text-subtlest w-fit"
						>
							<code
								style={{
									fontSize: "13px",
									color: token("color.text.subtlest"),
									fontFamily: "monospace",
								}}
							>
								{link.label}
							</code>
						</a>
					))}
				</div>
			</div>
		</div>
	);
}
