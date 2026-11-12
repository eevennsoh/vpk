import { Source, SourceTrigger, SourceContent, SourceItem } from "@/components/ui-custom/source";
import { ChevronDownIcon, ExternalLinkIcon } from "@/components/ui/vpk-icons";

export default function SourceDemo() {
	return (
		<Source>
			<SourceTrigger count={3} />
			<SourceContent>
				<SourceItem href="#" title="React Documentation" />
				<SourceItem href="#" title="MDN Web Docs" />
				<SourceItem href="#" title="TypeScript Handbook" />
			</SourceContent>
		</Source>
	);
}

const customSources = [
	{ href: "https://stripe.com/docs/api", title: "Stripe API Documentation" },
	{ href: "https://docs.github.com/en/rest", title: "GitHub REST API" },
	{ href: "https://docs.aws.amazon.com/sdk-for-javascript/", title: "AWS SDK for JavaScript" },
];

export function SourceDemoCustomRendering() {
	return (
		<Source>
			<SourceTrigger count={customSources.length}>
				<p className="font-medium">Using {customSources.length} citations</p>
				<ChevronDownIcon size="small" />
			</SourceTrigger>
			<SourceContent>
				{customSources.map((source) => (
					<SourceItem href={source.href} key={source.href}>
						{source.title}
						<ExternalLinkIcon size="small" />
					</SourceItem>
				))}
			</SourceContent>
		</Source>
	);
}
