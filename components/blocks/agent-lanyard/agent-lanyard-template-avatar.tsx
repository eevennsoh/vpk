import Image from "next/image";
import type { ReactNode } from "react";

export function AgentLanyardTemplateAvatar({ iconSrc, icon }: Readonly<{ iconSrc: string; icon?: ReactNode }>) {
	return (
		<div className="relative z-10 size-14" data-slot="agent-lanyard-template-avatar">
			<Image alt="" src="/illustration/agent-lanyard-template/shape.png" width={108} height={121} className="absolute -top-[2.05px] left-[1.04px]" style={{ width: 53.921, height: 60.107 }} />
			{icon ? (
				<span className="absolute inset-0 flex items-center justify-center text-icon-disabled [&>span]:scale-200">{icon}</span>
			) : <Image alt="" src={iconSrc} width={42} height={42} className="absolute top-[7px] left-[7px]" />}
		</div>
	);
}
