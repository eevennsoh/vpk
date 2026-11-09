import type { RovoSourcePart } from "@/lib/rovo-ui-messages";
import { SourceItem, Source, SourceContent, SourceTrigger } from "@/components/ui-custom/source";

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
		<Source className="px-6 pt-2">
			<SourceTrigger count={sources.length} />
			<SourceContent>
				{sources.map((sourcePart, index) => (
					<SourceItem
						href={sourcePart.type === "source-url" ? sourcePart.url : undefined}
						key={`${messageId}-source-${sourcePart.sourceId}-${index}`}
						title={getSourceTitle(sourcePart)}
					/>
				))}
			</SourceContent>
		</Source>
	);
}
