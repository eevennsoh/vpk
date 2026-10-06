import { clamp } from "./constants";
import { cross, dot, normalize, subtract, transform } from "./math";
import { pushQuad } from "./mesh";
import type { Axes, Face, LanyardSurface, Vec3 } from "./types";

interface MetalFace {
	quad: Vec3[];
	normal: Vec3;
	normals?: Vec3[];
}

const AXES = ["x", "y", "z"] as const;

interface Cut {
	x: number;
	y: number;
	slope: number;
}

interface CastPoint {
	x: number;
	y: number;
	nx: number;
	ny: number;
}

interface CastOptions {
	startCut?: Cut;
	endCut?: Cut;
	profile?: (p: { x: number; y: number }) => number;
}

/**
 * How finely to tessellate the hardware for a stage drawn at `scale` canvas
 * pixels per unit. Full detail suits the block's own stage; a small render (a
 * wall tile's clasp is a few dozen pixels tall) gets a third of the segments
 * each way, about a ninth of the triangles, none of them visible as facets.
 * The clasp is most of the lanyard's triangles and of each frame's work.
 */
export function hardwareDetail(scale: number): number {
	return scale >= 1.5 ? 1 : scale >= .75 ? .5 : 1 / 3;
}

const hookGeometries = new Map<number, MetalFace[]>();
export function hardwareMesh(list: Face[], material: LanyardSurface, origin: Vec3, axes: Axes, detail = 1) {
	const uv = [{x:0,y:0},{x:2,y:0},{x:2,y:2},{x:0,y:2}];
	const light = normalize({x:-.65,y:-.8,z:1}), half = normalize({x:-.45,y:-.4,z:1});
	function world(v: Vec3): Vec3 { const r = transform(v, axes); return {x:origin.x+r.x,y:origin.y+r.y,z:origin.z+r.z}; }
	function renderMetal(quad: Vec3[], normal: Vec3, normals?: Vec3[]) {
		const n = transform(normal, axes);
		const luminance = .22 + .25 * Math.max(0, dot(n,light)) + .5 * Math.max(0,dot(n,half)) ** 30;
		pushQuad(list, material, quad.map(world), uv, (1-luminance)/.92,
			(normals || [normal, normal, normal, normal]).map((v) => transform(v, axes)));
	}
	const known = hookGeometries.get(detail);
	if (known) {
		for (const face of known) renderMetal(face.quad, face.normal, face.normals);
		return;
	}
	const geometry: MetalFace[] = [];
	// A segment count at this detail, never below `least`.
	const seg = (count: number, least: number) => Math.max(least, Math.round(count * detail));
	// quad: four local points; normal: face normal; normals: optional per-vertex normals.
	function metal(quad: Vec3[], normal: Vec3, normals?: Vec3[]) { geometry.push({quad, normal, normals}); renderMetal(quad, normal, normals); }
	function smooth(points: Vec3[], perSegment = seg(6, 2)): Vec3[] {
		const result: Vec3[] = [];
		for (let i = 0; i < points.length - 1; i++) {
			const a=points[Math.max(0,i-1)], b=points[i], c=points[i+1], d=points[Math.min(points.length-1,i+2)];
			for(let k=0;k<perSegment;k++) {
				const t=k/perSegment,v={} as Vec3;
				for(const axis of AXES) v[axis]=.5*(2*b[axis]+(-a[axis]+c[axis])*t+(2*a[axis]-5*b[axis]+4*c[axis]-d[axis])*t*t+(-a[axis]+3*b[axis]-3*c[axis]+d[axis])*t*t*t);
				result.push(v);
			}
		}
		result.push(points.at(-1)!); return result;
	}
	function tube(points: Vec3[], radius: number | ((p: Vec3) => number), smoothPath = true) {
		const path = smoothPath ? smooth(points) : points, rings: { n: Vec3; v: Vec3 }[][]=[], around=seg(24, 6);
		let frame: Vec3 | undefined;
		for(let i=0;i<path.length;i++) {
			const tangent=normalize(subtract(path[Math.min(path.length-1,i+1)],path[Math.max(0,i-1)]));
			const reference=Math.abs(tangent.z)>.9?{x:0,y:1,z:0}:{x:0,y:0,z:1};
			// Transport the section frame along the curved jaw. Choosing a fresh
			// reference axis at each point produces a seam in the bottom bend.
			const along=frame?dot(frame,tangent):0;
			const a=frame?normalize({x:frame.x-tangent.x*along,y:frame.y-tangent.y*along,z:frame.z-tangent.z*along}):normalize(cross(tangent,reference));
			const b=normalize(cross(tangent,a));frame=a;
			const thickness = typeof radius === 'function' ? radius(path[i]) : radius;
			rings.push(Array.from({length:around},(_,j)=>{
				const theta=j/around*Math.PI*2,n={x:a.x*Math.cos(theta)+b.x*Math.sin(theta),y:a.y*Math.cos(theta)+b.y*Math.sin(theta),z:a.z*Math.cos(theta)+b.z*Math.sin(theta)};
				return {n,v:{x:path[i].x+n.x*thickness,y:path[i].y+n.y*thickness,z:path[i].z+n.z*thickness}};
			}));
		}
		for(let i=0;i<rings.length-1;i++) for(let j=0;j<around;j++) {
			const k=(j+1)%around, ns=[rings[i][j].n,rings[i][k].n,rings[i+1][k].n,rings[i+1][j].n];
			const normal=normalize(ns.reduce((r,n)=>({x:r.x+n.x,y:r.y+n.y,z:r.z+n.z}),{x:0,y:0,z:0}));
			metal([rings[i][j].v,rings[i][k].v,rings[i+1][k].v,rings[i+1][j].v],normal,ns);
		}
		if(Math.hypot(...AXES.map((k)=>path[0][k]-path.at(-1)![k]))>.1)for(const end of [0,path.length-1]) {
			const normal=normalize(subtract(path[end],path[end===0?1:end-1]));
			for(let j=0;j<around;j++)metal([path[end],rings[end][j].v,rings[end][(j+1)%around].v,path[end]],normal);
		}
	}
	const pts = (values: number[][]): Vec3[] => values.map(([x,y,z=0])=>({x,y,z}));
	// A true capsule: equal semicircles joined tangentially to parallel bars.
	// Analytic section normals keep the wire round, uniform and seamless.
	// The entire ring lies in one plane; its upper bar sits inside the fabric.
	const hardwareStroke=1.3;
	const ringSections: { n: Vec3; v: Vec3 }[][]=[], halfBar=24, bendRadius=15.9, ringY=-14, ringZ=-3, wireRadius=3.6*hardwareStroke;
	const wireAround=seg(32, 6), bar=seg(8, 2), bend=seg(32, 6);
	const section=(x: number,y: number,nx: number,ny: number)=>ringSections.push(Array.from({length:wireAround},(_,j)=>{
		const a=j/wireAround*Math.PI*2,n={x:nx*Math.cos(a),y:ny*Math.cos(a),z:Math.sin(a)};
		return {n,v:{x:x+n.x*wireRadius,y:y+n.y*wireRadius,z:ringZ+n.z*wireRadius}};
	}));
	for(let i=0;i<bar;i++)section(-halfBar+2*halfBar*i/bar,ringY-bendRadius,0,-1);
	for(let i=0;i<bend;i++){
		const a=-Math.PI/2+i/bend*Math.PI;
		section(halfBar+bendRadius*Math.cos(a),ringY+bendRadius*Math.sin(a),Math.cos(a),Math.sin(a));
	}
	for(let i=0;i<bar;i++)section(halfBar-2*halfBar*i/bar,ringY+bendRadius,0,1);
	for(let i=0;i<bend;i++){
		const a=Math.PI/2+i/bend*Math.PI;
		section(-halfBar+bendRadius*Math.cos(a),ringY+bendRadius*Math.sin(a),Math.cos(a),Math.sin(a));
	}
	for(let i=0;i<ringSections.length;i++)for(let j=0;j<wireAround;j++){
		const next=ringSections[(i+1)%ringSections.length],here=ringSections[i],k=(j+1)%wireAround;
		const vertices=[here[j],here[k],next[k],next[j]],normals=vertices.map(v=>v.n);
		metal(vertices.map(v=>v.v),normalize(normals.reduce((s,n)=>({x:s.x+n.x,y:s.y+n.y,z:s.z+n.z}),{x:0,y:0,z:0})),normals);
	}
	// Three rounded collars and a narrower axle form the stepped swivel.
	const profile=smooth(pts([[-10,0],[-10,8],[-9.5,10],[-8,10.7],[-4.5,10.7],[-3,10],
		[-2.5,13],[-1,14.8],[0,15.2],[6,15.2],[7.5,14],[8,9],
		[10.5,9],[11,13],[12,14.2],[15.5,14.2],[17,13],[18,10],[20,10],[20,0]]),seg(3, 1)).map(p=>[p.x,Math.max(0,p.y)]);
	const swivelAround=seg(40, 8);
	for(let i=0;i<profile.length-1;i++) for(let j=0;j<swivelAround;j++) {
		const a=j/swivelAround*Math.PI*2,b=(j+1)/swivelAround*Math.PI*2,[y0,r0]=profile[i],[y1,r1]=profile[i+1];
		const normal=(t: number,q=i)=>{const [ya,ra]=profile[Math.max(0,q-1)],[yb,rb]=profile[Math.min(profile.length-1,q+1)];return normalize({x:Math.cos(t)*(yb-ya),y:ra-rb,z:Math.sin(t)*(yb-ya)});};
		metal([{x:r0*Math.cos(a),y:y0,z:r0*Math.sin(a)},{x:r0*Math.cos(b),y:y0,z:r0*Math.sin(b)},
			{x:r1*Math.cos(b),y:y1,z:r1*Math.sin(b)},{x:r1*Math.cos(a),y:y1,z:r1*Math.sin(a)}],normal((a+b)/2),[normal(a,i),normal(b,i),normal(b,i+1),normal(a,i+1)]);
	}
	function closedContour(points: Vec3[], subdivisions=seg(5, 2)) {
		const c=smooth([points.at(-1)!,...points,points[0],points[1]],subdivisions);
		return c.slice(subdivisions,-subdivisions-1);
	}
	function solidBody(outline: Vec3[], back: number, front: number, bevel: number) {
		const contour=closedContour(outline), count=contour.length;
		const center=contour.reduce((a,p)=>({x:a.x+p.x/count,y:a.y+p.y/count,z:0}),{x:0,y:0,z:0});
		const outward=contour.map((p,i)=>{const tangent=subtract(contour[(i+1)%count],contour[(i+count-1)%count]);return normalize({x:tangent.y,y:-tangent.x,z:0});});
		const sections=[[back,bevel,-.8],[back+bevel,0,0],[front-bevel,0,0],[front,bevel,.8]];
		const rings=sections.map(([z,inset])=>contour.map((p,i)=>({x:p.x-outward[i].x*inset,y:p.y-outward[i].y*inset,z})));
		for(let k=0;k<rings.length-1;k++)for(let i=0;i<count;i++){
			const j=(i+1)%count,quad=[rings[k][i],rings[k][j],rings[k+1][j],rings[k+1][i]];
			const normals=[i,j,j,i].map((q,n)=>normalize({...outward[q],z:sections[k+(n>1?1:0)][2]}));
			metal(quad,normalize(cross(subtract(quad[1],quad[0]),subtract(quad[3],quad[0]))),normals);
		}
		for(const [ring,z,sign] of [[rings[0],back,-1],[rings[rings.length-1],front,1]] as [Vec3[], number, number][])for(let i=0;i<count;i++) {
			const c={...center,z},a=ring[i],b=ring[(i+1)%count];metal([c,a,b,c],{x:0,y:0,z:sign});
		}
	}
	// A flared casting with a concave lower arch and a real through-hole.
	// Radial strips triangulate around the opening without covering it.
	const outline=closedContour(pts([[-10,18],[10,18],[12,27],[17,46],[22,61],
		[17,60],[10,55],[0,52],[-10,55],[-17,62],[-21,60],[-18,46],[-13,27]]),seg(8, 3));
	const center={x:0,y:43},N=seg(128, 24),hole=3.45,bevel=1.35;
	const outside: Vec3[]=[];
	for(let i=0;i<N;i++) {
		const theta=i/N*Math.PI*2,dx=Math.cos(theta),dy=Math.sin(theta);let distance=Infinity;
		for(let j=0;j<outline.length;j++) {
			const a=outline[j],b=outline[(j+1)%outline.length],ex=b.x-a.x,ey=b.y-a.y;
			const ax=a.x-center.x,ay=a.y-center.y,det=dx*ey-dy*ex;
			if(Math.abs(det)<1e-8)continue;
			const t=(ax*ey-ay*ex)/det,u=(ax*dy-ay*dx)/det;
			if(t>0&&u>=0&&u<=1)distance=Math.min(distance,t);
		}
		outside.push({x:center.x+dx*distance,y:center.y+dy*distance,z:0});
	}
	const outNormals=outside.map((p,i)=>{const t=subtract(outside[(i+1)%N],outside[(i+N-1)%N]);return normalize({x:t.y,y:-t.x,z:0});});
	const outer=(i: number,z: number,inset: number)=>({x:outside[i].x-outNormals[i].x*inset,y:outside[i].y-outNormals[i].y*inset,z});
	const inner=(i: number,z: number,r=hole)=>({x:center.x+r*Math.cos(i/N*Math.PI*2),y:center.y+r*Math.sin(i/N*Math.PI*2),z});
	const layers=[[-7,bevel,.18,-1],[-6.8,.7,.65,-.76],[-6.3,.2,.9,-.43],[-5.65,0,1,0],
		[5.65,0,1,0],[6.3,.2,.9,.43],[6.8,.7,.65,.76],[7,bevel,.18,1]];
	const castNormal=(p: Vec3,sign: number)=>normalize({x:p.x*.006,y:(p.y-40)*.0016,z:sign});
	for(let i=0;i<N;i++) {
		const j=(i+1)%N;
		for(const [z,sign] of [[7,1],[-7,-1]])metal([inner(i,z),outer(i,z,bevel),outer(j,z,bevel),inner(j,z)],{x:0,y:0,z:sign},
			[inner(i,z),outside[i],outside[j],inner(j,z)].map(p=>castNormal(p,sign)));
		metal([inner(i,-7),inner(j,-7),inner(j,7),inner(i,7)],{x:-Math.cos(i/N*Math.PI*2),y:-Math.sin(i/N*Math.PI*2),z:0},
			[i,j,j,i].map(q=>({x:-Math.cos(q/N*Math.PI*2),y:-Math.sin(q/N*Math.PI*2),z:0})));
		for(let k=0;k<layers.length-1;k++) {
			const [z0,in0]=layers[k],[z1,in1]=layers[k+1];
			const ns=[i,j,j,i].map((q,v)=>{const layer=layers[k+(v>1?1:0)];return normalize({x:outNormals[q].x*layer[2],y:outNormals[q].y*layer[2],z:layer[3]});});
			metal([outer(i,z0,in0),outer(j,z0,in0),outer(j,z1,in1),outer(i,z1,in1)],ns[0],ns);
		}
	}
	// Raised rolled rims on the casting's small circular opening.
	for(const side of [-1,1]) {
		const rim=seg(64, 12), circle=Array.from({length:rim+1},(_,i)=>({x:4.55*Math.cos(i/rim*Math.PI*2),y:43+4.55*Math.sin(i/rim*Math.PI*2),z:side*7.2}));
		tube(circle,.85,false);
	}
	// The jaw has an exact circular lower outline and a tangent upper rail.
	// Sweep a round section in that outline's plane, then bend its depth through
	// the two holes. This preserves the smooth cast silhouette at the return.
	function castTube(path: CastPoint[], radius: number, depth: (x: number, y: number) => number, options: CastOptions={}) {
		const count=seg(32, 8),mitre=seg(8, 2),distances=[0];
		for(let i=1;i<path.length;i++)distances.push(distances.at(-1)!+Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y));
		const length=distances.at(-1)!,bevel=.75;
		function frame(s: number) {
			let lo=0,hi=path.length-1;
			while(hi-lo>1){const mid=(lo+hi)>>1;if(distances[mid]<s)lo=mid;else hi=mid;}
			const t=clamp((s-distances[lo])/(distances[hi]-distances[lo]),0,1),a=path[lo],b=path[hi];
			const nx=a.nx+(b.nx-a.nx)*t,ny=a.ny+(b.ny-a.ny)*t,n=Math.hypot(nx,ny);
			return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,nx:nx/n,ny:ny/n};
		}
		function point(s: number,j: number,r: number) {
			const p=frame(s),a=j/count*Math.PI*2;
			r*=options.profile?options.profile(p):1;
			const x=p.x+r*Math.cos(a)*p.nx,y=p.y+r*Math.cos(a)*p.ny;
			return{x,y,z:depth(x,y)+r*Math.sin(a)};
		}
		function boundary(cut: Cut | undefined,j: number,r: number,start: boolean) {
			if(!cut)return start?0:length;
			let lo=start?0:Math.max(0,length-20),hi=start?Math.min(20,length):length;
			const value=(s: number)=>{const p=point(s,j,r);return p.y-cut.y-cut.slope*(p.x-cut.x);};
			const sign=value(lo);
			for(let k=0;k<28;k++){const mid=(lo+hi)/2;if(value(mid)*sign>0)lo=mid;else hi=mid;}
			return(lo+hi)/2;
		}
		const rings: Vec3[][]=[];
		// Rounded, matching mitres replace the square ends of the spring gate.
		if(options.startCut)for(let i=mitre;i>0;i--){
			const a=i/mitre*Math.PI/2,r=radius-bevel+bevel*Math.cos(a);
			rings.push(Array.from({length:count},(_,j)=>point(boundary(options.startCut,j,r,true)+bevel*(1-Math.sin(a)),j,r)));
		}
		const starts=Array.from({length:count},(_,j)=>boundary(options.startCut,j,radius,true)+(options.startCut?bevel:0));
		const ends=Array.from({length:count},(_,j)=>boundary(options.endCut,j,radius,false)-(options.endCut?bevel:0));
		for(let i=0;i<path.length;i++)rings.push(Array.from({length:count},(_,j)=>point(starts[j]+(ends[j]-starts[j])*i/(path.length-1),j,radius)));
		if(options.endCut)for(let i=1;i<=mitre;i++){
			const a=i/mitre*Math.PI/2,r=radius-bevel+bevel*Math.cos(a);
			rings.push(Array.from({length:count},(_,j)=>point(boundary(options.endCut,j,r,false)-bevel*(1-Math.sin(a)),j,r)));
		}
		const normals=rings.map((ring,i)=>ring.map((v,j)=>{
			if(i===0&&options.startCut)return normalize({x:-options.startCut.slope,y:1,z:0});
			if(i===rings.length-1&&options.endCut)return normalize({x:options.endCut.slope,y:-1,z:0});
			const along=subtract(rings[Math.min(rings.length-1,i+1)][j],rings[Math.max(0,i-1)][j]);
			const around=subtract(ring[(j+1)%count],ring[(j+count-1)%count]);
			return normalize(cross(along,around));
		}));
		for(let i=0;i<rings.length-1;i++)for(let j=0;j<count;j++){
			const k=(j+1)%count,ns=[normals[i][j],normals[i][k],normals[i+1][k],normals[i+1][j]];
			metal([rings[i][j],rings[i][k],rings[i+1][k],rings[i+1][j]],ns[0],ns);
		}
		for(const end of [0,rings.length-1]){
			const center=rings[end].reduce((s,p)=>({x:s.x+p.x/count,y:s.y+p.y/count,z:s.z+p.z/count}),{x:0,y:0,z:0});
			const cut=end===0?options.startCut:options.endCut,sign=end===0?1:-1;
			const p=path[end===0?0:path.length-1],next=path[end===0?1:path.length-2];
			const normal=cut?normalize({x:-cut.slope*sign,y:sign,z:0}):normalize(subtract({x:p.x,y:p.y,z:depth(p.x,p.y)},{x:next.x,y:next.y,z:depth(next.x,next.y)}));
			for(let j=0;j<count;j++)metal([center,rings[end][j],rings[end][(j+1)%count],center],normal);
		}
	}
	function bezierRail(a: number[],b: number[],c: number[],d: number[],segments=seg(32, 6)): CastPoint[] {
		return Array.from({length:segments+1},(_,i)=>{
			const t=i/segments,u=1-t;
			const x=u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0];
			const y=u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1];
			const dx=3*u*u*(b[0]-a[0])+6*u*t*(c[0]-b[0])+3*t*t*(d[0]-c[0]);
			const dy=3*u*u*(b[1]-a[1])+6*u*t*(c[1]-b[1])+3*t*t*(d[1]-c[1]),length=Math.hypot(dx,dy);
			return{x,y,nx:dy/length,ny:-dx/length};
		});
	}
	const jawRadius=27,jawY=88.5,arcStart=-.28,arcEnd=Math.PI+.36,closureAngle=Math.PI+.12;
	const join=[jawRadius*Math.cos(arcStart),jawY+jawRadius*Math.sin(arcStart)];
	const jaw=bezierRail([10,19],[13,34],[join[0]+Math.sin(arcStart)*11,join[1]-Math.cos(arcStart)*11],join);
	const arc=seg(128, 16);
	for(let i=1;i<=arc;i++){
		const a=arcStart+(arcEnd-arcStart)*i/arc;
		jaw.push({x:jawRadius*Math.cos(a),y:jawY+jawRadius*Math.sin(a),nx:Math.cos(a),ny:Math.sin(a)});
	}
	const ease=(t: number)=>{t=clamp(t,0,1);return t*t*(3-2*t);};
	const closure={x:jawRadius*Math.cos(closureAngle),y:jawY+jawRadius*Math.sin(closureAngle),slope:.85};
	castTube(jaw,4.15*hardwareStroke,(x: number,y: number)=>(-4.75+13.25*Math.tanh(x/3))*ease((y-19)/56),{endCut:{...closure,y:closure.y+.2}});
	// The gate's hinge is recessed beneath the casting instead of ending in an
	// exposed flat cap. Its diagonal nose mates with the jaw's rounded seat.
	const gate=bezierRail([closure.x,closure.y],[closure.x+.95,closure.y-8],[-20.5,65],[-16,53]);
	const tangent={x:.119712,y:-.992809},first=gate[0];
	gate.unshift(...Array.from({length:8},(_,i)=>({...first,x:first.x-tangent.x*(8-i),y:first.y-tangent.y*(8-i)})));
	castTube(gate,3.9*hardwareStroke,()=>-18,{startCut:{...closure,y:closure.y-.2},profile:(p)=>.6+.4*ease((p.y-53)/8)});
	tube(pts([[-16,53,-18],[-16,53,0]]),2.8,false);
	// Thumb lever to the right of the casting; mirrored side faces give it depth.
	solidBody(pts([[17,43],[27,46],[37,49],[41,53],[41,57],[37,61],[31,61],[22,58]]),-3.5,3.5,1.4);
	// Pivot axle and spring visible from oblique/side views.
	tube(pts([[14,48,-8.5],[14,48,8.5]]),2.6,false);
	const coil=seg(80, 20), spring=Array.from({length:coil+1},(_,i)=>({x:14+2*Math.cos(i/coil*Math.PI*10),y:32+i/coil*10,z:2*Math.sin(i/coil*Math.PI*10)}));
	tube(spring,.65,false);
	hookGeometries.set(detail, geometry);
}
