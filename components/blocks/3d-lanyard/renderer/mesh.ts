import { CRIMP, DEG, HOLE_R, LINKS, clamp } from "./constants";
import { cross, dot, normalize, subtract, transform } from "./math";
import type { Axes, Face, LanyardSurface, Pose, Strand, Vec2, Vec3 } from "./types";

const AXIS_KEYS = ["x", "y", "z"] as const;
const TRIANGLES: number[][] = [[0, 1, 2], [0, 2, 3]];

export function project(v: Vec3): Vec3 {
	const perspective = 1850 / (1850 - v.z);
	return { x: 210 + (v.x - 210) * perspective, y: 450 + (v.y - 450) * perspective, z: v.z };
}

export function pushQuad(list: Face[], image: LanyardSurface, points: Vec3[], uv: Vec2[], shade = 0, normals: Vec3[] | null = null) {
	const projected = points.map(project);
	for (const ids of TRIANGLES) {
		list.push({ image, s: ids.map((i) => uv[i]), d: ids.map((i) => projected[i]),
			v: ids.map((i) => points[i]), z: ids.reduce((sum, i) => sum + points[i].z, 0) / 3, shade,
			n: normals && ids.map((i) => normals[i]) });
	}
}
export function plane(list: Face[], image: LanyardSurface, rect: { x: number; y: number; w: number; h: number; z?: number }, origin: Vec3, rotation: Axes, cols: number, rows: number, shade = 0) {
	for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
		const uv = [[x / cols, y / rows], [(x + 1) / cols, y / rows], [(x + 1) / cols, (y + 1) / rows], [x / cols, (y + 1) / rows]];
		const points = uv.map(([u, v]) => {
			const rotated = transform({ x: rect.x + rect.w * u, y: rect.y + rect.h * v, z: rect.z || 0 }, rotation);
			return { x: origin.x + rotated.x, y: origin.y + rotated.y, z: origin.z + rotated.z };
		});
		pushQuad(list, image, points, uv.map(([u, v]) => ({ x: image.width * u, y: image.height * v })), shade);
	}
}
export function cardEdge(list: Face[], material: LanyardSurface, origin: Vec3, axes: Axes) {
	const outline: Vec2[] = [];
	for (const [x, y, start] of [[156, 112, -Math.PI / 2], [156, 544, 0], [-156, 544, Math.PI / 2], [-156, 112, Math.PI]]) {
		for (let i = 0; i <= 8; i++) {
			const angle = start + i / 8 * Math.PI / 2;
			outline.push({ x: x + 24 * Math.cos(angle), y: y + 24 * Math.sin(angle) });
		}
	}
	function vertex(p: Vec2, z: number) { const v = transform({ ...p, z }, axes); return { x: origin.x + v.x, y: origin.y + v.y, z: origin.z + v.z }; }
	for (let i = 0; i < outline.length; i++) {
		const a = outline[i], b = outline[(i + 1) % outline.length];
		pushQuad(list, material, [vertex(a, 0), vertex(b, 0), vertex(b, -3.4), vertex(a, -3.4)],
			[{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }], .03);
	}
}
export function holeWall(list: Face[], material: LanyardSurface, origin: Vec3, axes: Axes) {
	const world = (a: number, z: number): Vec3 => {
		const v = transform({ x: Math.cos(a) * HOLE_R, y: 113 + Math.sin(a) * HOLE_R, z }, axes);
		return { x: origin.x + v.x, y: origin.y + v.y, z: origin.z + v.z };
	};
	for (let i = 0; i < 48; i++) {
		const a = i / 48 * Math.PI * 2, b = (i + 1) / 48 * Math.PI * 2;
		pushQuad(list, material, [world(a, 0), world(a, -3.4), world(b, -3.4), world(b, 0)],
			[{x:0,y:0},{x:2,y:0},{x:2,y:2},{x:0,y:2}], .18 + .15 * Math.sin(a));
	}
}
// The folded return passes through the original silver crimp before the ring.
export function wovenReturn(list: Face[], material: LanyardSurface, origin: Vec3, axes: Axes) {
	const path = [[-137,2],[-34,3],[-27,2.6],[-24.5,-2.5],[-28,-8.5],[-70,-8.5]];
	let v = 0;
	for(let i=0;i<path.length-1;i++) {
		const [a,z0]=path[i],[b,z1]=path[i+1],next=v+Math.hypot(b-a,z1-z0)*96/58;
		const points=[{x:-29,y:a,z:z0},{x:29,y:a,z:z0},{x:29,y:b,z:z1},{x:-29,y:b,z:z1}].map(p=>{
			const r=transform(p,axes);return{x:origin.x+r.x,y:origin.y+r.y,z:origin.z+r.z};
		});
		pushQuad(list,material,points,[{x:0,y:v},{x:96,y:v},{x:96,y:next},{x:0,y:next}],i>1?.18:.04);v=next;
	}
}
// Retain the reference's brushed silver crimp, wrapped around a rounded sleeve
// so it stays attached and has real thickness throughout the drop and swing.
// The original lanyard asset supplies the finish; no extra export asset is needed.
export function crimpMesh(list: Face[], lanyard: LanyardSurface, origin: Vec3, axes: Axes) {
	const { top, bottom, halfWidth, radius, centerZ } = CRIMP;
	const xs = [-33,-32.5,-31,-29,-27,-24,0,24,27,29,31,32.5,33];
	const world = (v: Vec3): Vec3 => { const r = transform(v, axes); return { x: origin.x+r.x, y: origin.y+r.y, z: origin.z+r.z }; };
	for (const side of [1,-1]) {
		const normal = transform({x:0,y:0,z:side},axes);
		const shade = Math.min(.22, (1-Math.abs(normal.z))*.18 + Math.max(0,normal.x)*.05);
		for (let i=0;i<xs.length-1;i++) {
			const x0=xs[i],x1=xs[i+1];
			const depth = (x: number) => centerZ + side*Math.sqrt(Math.max(0,radius**2-Math.max(0,Math.abs(x)-(halfWidth-radius))**2));
			const points = [{x:x0,y:top,z:depth(x0)},{x:x1,y:top,z:depth(x1)},
				{x:x1,y:bottom,z:depth(x1)},{x:x0,y:bottom,z:depth(x0)}];
			const sourceX = (x: number) => 209 + (x/halfWidth+1)*.5*466;
			const sourceBottom = (x: number) => 1467 + 20*(Math.abs(x)/halfWidth)**8;
			pushQuad(list,lanyard,points.map(world),
				[{x:sourceX(x0),y:943},{x:sourceX(x1),y:943},{x:sourceX(x1),y:sourceBottom(x1)},{x:sourceX(x0),y:sourceBottom(x0)}],shade);
		}
	}
}

export function strapMesh(list: Face[], points: Vec3[], strand: Strand, time: number, p: Pose, image: LanyardSurface) {
	const smooth: Vec3[] = [];
	for (let i = 0; i < LINKS; i++) for (let sub = 0; sub < 3; sub++) {
		const q = sub / 3, a = points[Math.max(0, i - 1)], b = points[i], c = points[i + 1], d = points[Math.min(LINKS, i + 2)];
		const v = {} as Vec3;
		for (const k of AXIS_KEYS) v[k] = .5 * ((2 * b[k]) + (-a[k] + c[k]) * q + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * q * q + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * q * q * q);
		smooth.push(v);
	}
	smooth.push(points[LINKS]); points = smooth;
	const links = points.length - 1;
	const twistEnergy = Math.min(1, (Math.abs(p.yaw) * .6 + Math.abs(p.pitch) * .5 + Math.abs(p.strapYaw) * .3) * DEG);
	const origin = { x: 210+p.x, y: 306+p.y, z: p.z };
	const local = (v: Vec3) => { const d=subtract(v,origin); return {x:dot(d,p.collar[0]),y:dot(d,p.collar[1]),z:dot(d,p.collar[2])}; };
	const world = (v: Vec3): Vec3 => { const r=transform(v,p.collar); return {x:origin.x+r.x,y:origin.y+r.y,z:origin.z+r.z}; };
	function enterCrimp(quad: Vec3[], uv: Vec2[], shade: number) {
		let vertices = quad.map((v,i)=>({v:local(v),uv:uv[i]}));
		if (vertices.every(({v})=>v.y < CRIMP.top-70)) {
			pushQuad(list,image,quad,uv,shade); return;
		}
		// Trim against the actual rim in the assembly's local frame. Interpolate
		// UVs at the cut so no loose ribbon tip can show beside or through the clip.
		const clipped=[];
		for(let i=0;i<vertices.length;i++) {
			const a=vertices[i],b=vertices[(i+1)%vertices.length];
			const insideA=a.v.y<=CRIMP.top,insideB=b.v.y<=CRIMP.top;
			if(insideA)clipped.push(a);
			if(insideA!==insideB) {
				const t=(CRIMP.top-a.v.y)/(b.v.y-a.v.y);
				const mix=(a: number,b: number)=>a+(b-a)*t;
				clipped.push({v:{x:mix(a.v.x,b.v.x),y:CRIMP.top,z:mix(a.v.z,b.v.z)},
					uv:{x:mix(a.uv.x,b.uv.x),y:mix(a.uv.y,b.uv.y)}});
			}
		}
		vertices=clipped.map(({v,uv})=>{
			const progress=clamp((v.y-(CRIMP.top-70))/70,0,1),blend=progress*progress*(3-2*progress);
			const halfWidth=CRIMP.entryHalfWidth+Math.max(0,CRIMP.top-v.y)*.28;
			const x=v.x+(clamp(v.x,-halfWidth,halfWidth)-v.x)*blend;
			const z=v.z+((strand.rear?-1.5:1.5)-v.z)*blend;
			return {v:world({x,y:v.y,z}),uv};
		});
		for(let i=1;i<vertices.length-1;i++) {
			const triangle=[vertices[0],vertices[i],vertices[i+1],vertices[i+1]];
			pushQuad(list,image,triangle.map(p=>p.v),triangle.map(p=>p.uv),shade);
		}
	}
	const edges = points.map((point, i) => {
		const a = points[Math.max(0, i - 1)], b = points[Math.min(links, i + 1)];
		const tangent = normalize(subtract(b, a)), materialPosition = i / links;
		const flat = normalize({ x: 1 - tangent.x * tangent.x, y: -tangent.x * tangent.y, z: -tangent.x * tangent.z });
		const binormal = normalize(cross(tangent, flat));
		let collarTwist = Math.atan2(dot(p.collar[0], binormal), dot(p.collar[0], flat));
		if (collarTwist > Math.PI / 2) collarTwist -= Math.PI;
		if (collarTwist < -Math.PI / 2) collarTwist += Math.PI;
		const ripple = .35 * twistEnergy * Math.sin(materialPosition * 12 - time * 7 + (strand.rear ? 1.8 : 0)) * Math.sin(Math.PI * materialPosition);
		const twist = collarTwist * materialPosition ** 8 + ripple;
		let across = { x: flat.x * Math.cos(twist) + binormal.x * Math.sin(twist),
			y: flat.y * Math.cos(twist) + binormal.y * Math.sin(twist), z: flat.z * Math.cos(twist) + binormal.z * Math.sin(twist) };
		if (i === links) {
			const sign = dot(across, p.collar[0]) < 0 ? -1 : 1;
			across = { x: p.collar[0].x * sign, y: p.collar[0].y * sign, z: p.collar[0].z * sign };
		}
		const half = strand.width / 2;
		return [{ x: point.x - across.x * half, y: point.y - across.y * half, z: point.z - across.z * half },
			{ x: point.x + across.x * half, y: point.y + across.y * half, z: point.z + across.z * half }];
	});
	for (let i = 0; i < links; i++) {
		const v0 = i / links * image.height, v1 = (i + 1) / links * image.height;
		const quad = [edges[i][0], edges[i][1], edges[i + 1][1], edges[i + 1][0]];
		// Keep the complete strand: portions above the camera can still cast
		// shadows into view when the assembly turns toward the light.
		const shade = (strand.rear ? .08 : .015) + Math.min(.2, Math.abs(quad[0].z - quad[1].z) / strand.width * .18);
		enterCrimp(quad, [{ x: 0, y: v0 }, { x: image.width, y: v0 }, { x: image.width, y: v1 }, { x: 0, y: v1 }], shade);
	}
}
