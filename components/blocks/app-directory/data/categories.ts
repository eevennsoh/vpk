export interface AppDirectoryCategory {
	id: string;
	label: string;
	description: string;
}

export const APP_DIRECTORY_CATEGORIES: readonly AppDirectoryCategory[] = [
	{
		id: "project-management",
		label: "Project management",
		description: "Streamline, manage, and track project phases.",
	},
	{
		id: "administrative-tools",
		label: "Administrative tools",
		description: "Manage users, security, and settings with apps for admins.",
	},
	{
		id: "content-and-communication",
		label: "Content and communication",
		description:
			"Enhance communication with tools designed to efficiently share information and documentation among teams.",
	},
	{
		id: "data-and-analytics",
		label: "Data and analytics",
		description: "Unlock valuable insights with data visualization and analytics tools.",
	},
	{
		id: "software-development",
		label: "Software development",
		description: "Code, collaborate, and plan across every stage of the DevOps cycle.",
	},
	{
		id: "it-support-and-service",
		label: "IT support and service",
		description: "Improve IT support with service desk, ticketing, and automation tools.",
	},
	{
		id: "design-and-diagramming",
		label: "Design and diagramming",
		description: "Curate and visualize art, graphics, and digital design.",
	},
	{
		id: "security-and-compliance",
		label: "Security and compliance",
		description: "Apps to secure data, enforce policies, and meet compliance standards.",
	},
	{
		id: "hr-and-team-building",
		label: "HR and team building",
		description: "Build stronger teams with HR and engagement tools.",
	},
	{
		id: "sales-and-customer-relations",
		label: "Sales and customer relations",
		description: "Apps for CRM, lead tracking, and customer engagement.",
	},
] as const;
