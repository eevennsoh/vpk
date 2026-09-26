import Image from "next/image";

export function AgentLanyardTemplateAvatar({ iconSrc }: Readonly<{ iconSrc: string }>) {
	return (
		<div className="absolute top-7 left-1/2 z-10 size-14 -translate-x-1/2" data-slot="agent-lanyard-template-avatar">
			<Image alt="" src="/illustration/agent-lanyard-template/shape.png" width={108} height={121} className="absolute -top-[2.05px] left-[1.04px]" style={{ width: 53.921, height: 60.107 }} />
			<Image alt="" src={iconSrc} width={42} height={42} className="absolute top-[7px] left-[7px]" />
		</div>
	);
}
