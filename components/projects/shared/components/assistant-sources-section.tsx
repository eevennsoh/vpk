import type { RovoSourcePart } from "@/lib/rovo-ui-messages";
import { Source, Sources, SourcesContent, SourcesTrigger } from "@/components/ui/sources";

interface AssistantSourcesSectionProps {
	messageId: string;
	sources: RovoSourcePart[];
}

function getSourceTitle(sourcePart: RovoSourcePart): string {
	if (sourcePart.type === "source-url") {
		return sourcePart.title ?? sourcePart.url;
	}

	return sourcePart.filename
		? `${sourcePart.title} (${sourcePart.filename})`
		: sourcePart.title;
}

export function AssistantSourcesSection({
	messageId,
	sources,
}: Readonly<AssistantSourcesSectionProps>): React.ReactElement {
	return (
		<div className="px-6 pt-2">
			<Sources>
				<SourcesTrigger count={sources.length} />
				<SourcesContent>
					{sources.map((sourcePart, index) => (
						<Source
							href={sourcePart.type === "source-url" ? sourcePart.url : undefined}
							key={`${messageId}-source-${sourcePart.sourceId}-${index}`}
							title={getSourceTitle(sourcePart)}
						/>
					))}
				</SourcesContent>
			</Sources>
		</div>
	);
}
