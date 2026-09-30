import { type CSSProperties } from "react";
import { token } from "@/lib/tokens";
import type { PropDefinition, SubComponentDoc } from "@/app/data/component-detail-types";
import { DocSection } from "./doc-section";
import { AnchorLinkButton } from "./doc-section";

function slugify(name: string) {
	return name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

interface DocPropsTableProps {
	componentName: string;
	props: PropDefinition[];
	subComponents?: SubComponentDoc[];
}

function PropsTable({ props }: Readonly<{ props: PropDefinition[] }>) {
	return (
		<div
			style={{
				overflow: "auto",
				border: `1px solid ${token("color.border")}`,
				borderRadius: token("radius.large"),
			}}
		>
			<table
				style={{
					width: "100%",
					borderCollapse: "collapse",
					fontSize: "13px",
				}}
			>
				<thead>
					<tr
						style={{
							borderBottom: `1px solid ${token("color.border")}`,
							backgroundColor: token("color.background.neutral"),
						}}
					>
						<th style={thStyle}>Prop</th>
						<th style={thStyle}>Type</th>
						<th style={thStyle}>Default</th>
						<th style={thStyle}>Description</th>
					</tr>
				</thead>
				<tbody>
					{props.map((prop, index) => (
						<tr
							key={prop.name}
							style={{
								...(index < props.length - 1 && { borderBottom: `1px solid ${token("color.border")}` }),
							}}
						>
							<td style={tdStyle}>
								<code
									style={{
										fontSize: "12px",
										fontWeight: 600,
										color: token("color.text"),
										fontFamily: "monospace",
									}}
								>
									{prop.name}
								</code>
								{prop.required ? <span
										style={{
											color: token("color.text.danger"),
											marginLeft: 4,
										}}
									>
										*
									</span> : null}
							</td>
							<td style={tdStyle}>
								<code
									style={{
										fontSize: "12px",
										color: token("color.text.subtle"),
										fontFamily: "monospace",
									}}
								>
									{prop.type}
								</code>
							</td>
							<td style={tdStyle}>
								{prop.default ? (
									<code
										style={{
											fontSize: "12px",
											color: token("color.text.subtle"),
											fontFamily: "monospace",
										}}
									>
										{prop.default}
									</code>
								) : (
									<span style={{ color: token("color.text.subtlest") }}>—</span>
								)}
							</td>
							<td style={{ ...tdStyle, color: token("color.text.subtle") }}>{prop.description}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

const thStyle: CSSProperties = {
	textAlign: "left",
	padding: "8px 12px",
	fontWeight: 500,
	fontSize: "12px",
	color: token("color.text.subtle"),
	textTransform: "uppercase",
	letterSpacing: "0.05em",
};

const tdStyle: CSSProperties = {
	padding: "8px 12px",
	verticalAlign: "top",
};

export function DocPropsTable({ componentName, props, subComponents }: Readonly<DocPropsTableProps>) {
	return (
		<DocSection id="api" title="API Reference">
			<div style={{ display: "flex", flexDirection: "column", gap: token("space.300") }}>
				{/* Primary component props */}
				<div id={slugify(componentName)} className="group">
					<div className="flex items-center gap-1" style={{ marginBottom: token("space.150") }}>
						<h3
							style={{
								fontSize: "14px",
								fontWeight: 600,
								color: token("color.text"),
								fontFamily: "monospace",
							}}
						>
							{componentName}
						</h3>
						<AnchorLinkButton id={slugify(componentName)} label={componentName} />
					</div>
					<PropsTable props={props} />
				</div>

				{/* Sub-component docs */}
				{subComponents?.map((sub) => (
					<div key={sub.name} id={slugify(sub.name)} className="group">
						<div className="flex items-center gap-1" style={{ marginBottom: token("space.100") }}>
							<h3
								style={{
									fontSize: "14px",
									fontWeight: 600,
									color: token("color.text"),
									fontFamily: "monospace",
								}}
							>
								{sub.name}
							</h3>
							<AnchorLinkButton id={slugify(sub.name)} label={sub.name} />
						</div>
						<p
							style={{
								fontSize: "13px",
								color: token("color.text.subtle"),
								marginBottom: token("space.150"),
							}}
						>
							{sub.description}
						</p>
						{sub.props ? <PropsTable props={sub.props} /> : null}
					</div>
				))}
			</div>
		</DocSection>
	);
}
