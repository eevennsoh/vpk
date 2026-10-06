import Image from "next/image";

import { LANYARD_3D_ASSETS, type Lanyard3DAgent } from "../data";

/** Rovo's badge is a plain hexagon; its multicolor mark is a separate layer, as on the card. */
const ROVO_MARK = { left: 23 / 128, top: 28.2 / 137.387, size: 82 / 128 };

export function Lanyard3DAgentBadge({ agent, width }: Readonly<{ agent: Lanyard3DAgent; width: number }>) {
	const height = width * 137.387 / 128;
	return (
		<span aria-hidden className="relative block shrink-0" style={{ width, height }}>
			<Image alt="" height={Math.round(height)} src={LANYARD_3D_ASSETS.agents[agent.asset]} style={{ width, height }} unoptimized width={width} />
			{agent.asset === "rovo" ? (
				<Image
					alt="" className="absolute" height={Math.round(width * ROVO_MARK.size)} src={LANYARD_3D_ASSETS.rovoMark} unoptimized width={Math.round(width * ROVO_MARK.size)}
					style={{ left: width * ROVO_MARK.left, top: height * ROVO_MARK.top, width: width * ROVO_MARK.size, height: width * ROVO_MARK.size }}
				/>
			) : null}
		</span>
	);
}
