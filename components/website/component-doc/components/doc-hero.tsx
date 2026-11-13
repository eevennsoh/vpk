import Link from "next/link";
import { token } from "@/lib/tokens";
import type { ExternalLinkDefinition } from "@/app/data/component-detail-types";
import type { DocImportReference } from "./source-links.server";

interface DocHeroProps {
	name: string;
	description?: string;
	category: "ui-charts" | "ui-custom" | "ui" | "blocks" | "projects" | "arts" | "utility" | "visual";
	importReferences: DocImportReference[];
	referenceLinks?: ExternalLinkDefinition[];
}

export function DocHero({ name, description, category, importReferences, referenceLinks = [] }: Readonly<DocHeroProps>) {
	const categoryLabel = category === "ui-charts" ? "UI — Charts" : category === "ui-custom" ? "UI — Custom" : category === "blocks" ? "Blocks" : category === "projects" ? "Projects" : category === "visual" ? "Visual" : category === "utility" ? "Utils" : category === "arts" ? "Arts" : "UI";
	const referenceTextStyle = {
		fontSize: "13px",
		color: token("color.text.subtlest"),
		fontFamily: "monospace",
	};

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

				{/* Import paths and source links */}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						gap: token("space.075"),
					}}
				>
					{importReferences.map(({ path, links }) => (
						<div key={path} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
							<code
								style={{
									...referenceTextStyle,
									display: "block",
									maxWidth: "100%",
									overflowWrap: "anywhere",
									wordBreak: "break-word",
								}}
							>
								{path}
							</code>
							{links.map(link => (
								<a
									key={link.href}
									href={link.href}
									aria-label={`${link.label} source for ${path}`}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex min-h-6 items-center no-underline decoration-text-subtlest underline-offset-2 hover:underline"
								>
									<code style={referenceTextStyle}>{link.label}</code>
								</a>
							))}
						</div>
					))}
					{referenceLinks.map(link => (
						<a
							key={link.url}
							href={link.url}
							target="_blank"
							rel="noopener noreferrer"
							className="no-underline hover:underline decoration-text-subtlest w-fit"
						>
							<code style={referenceTextStyle}>
								{link.label}
							</code>
						</a>
					))}
				</div>
			</div>
		</div>
	);
}
