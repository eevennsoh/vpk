import type { ComponentDetail } from "@/app/data/component-detail-types";

export const AGENT_USER_DETAIL: ComponentDetail = {
		description: "Users screen for managing who has access to a Rovo agent. Shows an access settings card (Owner, Author display name, and an Open-to-all-users switch) plus a selectable People table with role lozenges, and an Add user dialog for granting access at a chosen role.",
		importStatement: `import { AgentUser, AddUserDialog } from "@/components/blocks/agent-user";`,
		usage: `import { AgentUser } from "@/components/blocks/agent-user";

<AgentUser
  defaultOpenToAll
  learnMoreHref="https://support.atlassian.com/rovo/"
/>`,
		props: [
			{
				name: "owner",
				type: "AgentPerson",
				description: "Person shown in the Owner row. Defaults to the sample owner.",
			},
			{
				name: "authorDisplay",
				type: "AgentPerson",
				description: "Person or team shown in the Author display name row.",
			},
			{
				name: "people",
				type: "readonly AgentPerson[]",
				description: "Initial people list rendered in the table. The block manages additions locally.",
			},
			{
				name: "defaultOpenToAll",
				type: "boolean",
				description: "Initial state of the User access switch. Defaults to true.",
			},
			{
				name: "learnMoreHref",
				type: "string",
				description: "Destination for the “More about Rovo agent users and permissions” link.",
			},
		],
	};
