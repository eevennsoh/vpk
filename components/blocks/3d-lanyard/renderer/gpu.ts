import { pushQuad } from "./mesh";
import type { Face, LanyardSurface } from "./types";

export interface GpuRenderer {
	surface: HTMLCanvasElement;
	draw(faces: Face[], width: number, height: number, ox: number, oy: number, zoom: number, ribbonCount: number): void;
	dispose(): void;
}

export function backdropDepth(faces: Face[]) {
	let z=-48;
	for(const face of faces)for(const v of face.v)z=Math.min(z,v.z-24);
	return z;
}

export function makeGPU(): GpuRenderer | null {
	const surface = document.createElement('canvas');
	const context = surface.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: true });
	if (!context) return null;
	const gl: WebGL2RenderingContext = context;
	function shader(kind: number, source: string) {
		const s = gl.createShader(kind)!; gl.shaderSource(s, source); gl.compileShader(s);
		if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "Shader compile failed");
		return s;
	}
	const program = gl.createProgram();
	gl.attachShader(program, shader(gl.VERTEX_SHADER, `#version 300 es
		layout(location=0) in vec3 a_position; layout(location=1) in vec2 a_uv;
		layout(location=2) in float a_shade; layout(location=3) in vec3 a_normal; layout(location=4) in float a_metal;
		uniform vec2 u_resolution; uniform vec2 u_origin; uniform float u_scale;
		uniform highp int u_shadowPass;
		out vec2 v_uv; out float v_shade; out vec3 v_normal; out vec3 v_world; out float v_metal;
		void main(){
			v_uv=a_uv; v_shade=a_shade; v_normal=a_normal; v_world=a_position; v_metal=a_metal;
			if(u_shadowPass==1){
				vec2 light=a_position.xy+a_position.z*vec2(.65,.45);
				vec2 uv=(light-vec2(-700.,-1400.))/vec2(1800.,2600.);
				gl_Position=vec4(uv*2.-1.,-a_position.z/1024.,1.); return;
			}
			float w=1850.0-a_position.z;
			vec2 point=vec2(210.,450.)+(a_position.xy-vec2(210.,450.))*1850.0/w;
			vec2 pixel=point*u_scale+u_origin;
			vec2 clip=vec2(pixel.x/u_resolution.x*2.-1.,1.-pixel.y/u_resolution.y*2.);
			float depth=(5200.+180.)/(5200.-180.)*w-2.*5200.*180./(5200.-180.);
			gl_Position=vec4(clip*w,depth,w); v_uv=a_uv; v_shade=a_shade; v_normal=a_normal; v_world=a_position; v_metal=a_metal;
		}`));
	gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `#version 300 es
		precision highp float; in vec2 v_uv; in float v_shade; in vec3 v_normal; in vec3 v_world; in float v_metal;
		uniform sampler2D u_image; uniform highp sampler2D u_shadowMap; uniform sampler2D u_backdrop;
		uniform vec2 u_resolution;
		uniform int u_pass; uniform highp int u_shadowPass; uniform int u_backdropPass; out vec4 color;
		const vec2 disk[12]=vec2[12](vec2(-.326,-.406),vec2(-.840,-.074),vec2(-.696,.457),vec2(-.203,.621),
			vec2(.962,-.195),vec2(.473,-.480),vec2(.519,.767),vec2(.185,-.893),
			vec2(.507,.064),vec2(.896,.412),vec2(-.322,-.933),vec2(-.792,-.598));
		const vec2 softDisk[48]=vec2[48](${Array.from({length:48},(_,i)=>{const r=Math.sqrt((i+.5)/48),a=i*2.39996323;return `vec2(${(r*Math.cos(a)).toFixed(7)},${(r*Math.sin(a)).toFixed(7)})`;}).join(',')});
		float blocker(vec2 uv){return 1024.-texture(u_shadowMap,uv).r*2048.;}
		float shadowAmount(vec3 world, bool backdrop){
			vec2 uv=(world.xy+world.z*vec2(.65,.45)-vec2(-700.,-1400.))/vec2(1800.,2600.);
			if(any(lessThan(uv,vec2(.001)))||any(greaterThan(uv,vec2(.999))))return 0.;
			float bias=backdrop?.25:1.1;
			float receiver=world.z+bias, total=0., count=0.;
			float search=backdrop?80.:5.;
			// Blocker distance controls softness: a close card casts a tight contact
			// shadow; the farther background receives a broader penumbra.
			float center=blocker(uv);
			if(center>receiver){total+=center;count+=1.;}
			for(int i=0;i<12;i++){
				if(!backdrop&&i>=4)break;
				vec2 offset=backdrop?disk[i]:vec2(cos(float(i)*1.5707963),sin(float(i)*1.5707963));
				float z=blocker(uv+offset*search/vec2(1800.,2600.));
				if(z>receiver){total+=z;count+=1.;}
			}
			if(count==0.)return 0.;
			float separation=max(0.,total/count-world.z);
			float radius=clamp(separation*.20,.8,backdrop?80.:6.);
			float shade=0.;
			if(backdrop){
				for(int i=0;i<48;i++)shade+=step(receiver,blocker(uv+softDisk[i]*radius/vec2(1800.,2600.)));
				return shade/48.*180./(180.+separation);
			}
			for(int i=0;i<12;i++)shade+=step(receiver,blocker(uv+disk[i]*radius/vec2(1800.,2600.)));
			return shade/12.;
		}
		// Brushed stainless / dark nickel, shared by every metal component.
		// Broad studio reflections soften the cast faces and pick out the bevels.
		vec3 metal(vec3 n, vec3 view){
			vec3 key=normalize(vec3(-.65,-.45,1.)), fill=normalize(vec3(.8,-.2,.8));
			float spec=pow(max(dot(n,normalize(key+view)),0.),48.);
			float sheen=pow(max(dot(n,normalize(fill+view)),0.),10.);
			float diffuse=max(dot(n,key),0.);
			return vec3(.105,.108,.115)+vec3(.21)*diffuse+vec3(.75)*spec+vec3(.19)*sheen;
		}
		void main(){
			if(u_shadowPass==1){if(texture(u_image,v_uv).a<.5)discard; color=vec4(1.);return;}
			if(v_metal>1.5){color=u_backdropPass==1?vec4(0.,0.,0.,shadowAmount(v_world,true)*.19):texture(u_backdrop,gl_FragCoord.xy/u_resolution);return;}
			vec4 c=texture(u_image,v_uv); if(c.a<.001 || (u_pass==1 && c.a<.98) || (u_pass==2 && c.a>=.98)) discard;
			float lighting=1.-shadowAmount(v_world,false)*.30;
			if(v_metal>.5){vec3 n=normalize(v_normal); vec3 view=normalize(vec3(210.,450.,1850.)-v_world); if(dot(n,view)<0.) n=-n; color=vec4(metal(n,view)*lighting,1.); return;}
			color=vec4(c.rgb*(1.-v_shade*.92)*lighting,c.a);}`));
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "Program link failed");
	const buffer = gl.createBuffer(), cache = new Map<LanyardSurface, WebGLTexture>();
	const position = gl.getAttribLocation(program, 'a_position'), uv = gl.getAttribLocation(program, 'a_uv'), shade = gl.getAttribLocation(program, 'a_shade');
	const normalAttribute = gl.getAttribLocation(program, 'a_normal'), metalAttribute = gl.getAttribLocation(program, 'a_metal');
	const passUniform = gl.getUniformLocation(program, 'u_pass');
	const shadowPass = gl.getUniformLocation(program, 'u_shadowPass');
	const backdropPass = gl.getUniformLocation(program, 'u_backdropPass');
	const imageUniform=gl.getUniformLocation(program,'u_image'), shadowUniform=gl.getUniformLocation(program,'u_shadowMap'), backdropUniform=gl.getUniformLocation(program,'u_backdrop');
	const resolution = gl.getUniformLocation(program, 'u_resolution'), origin = gl.getUniformLocation(program, 'u_origin'), scale = gl.getUniformLocation(program, 'u_scale');
	const shadowTexture = gl.createTexture(), shadowBuffer = gl.createFramebuffer(), shadowSize = 2048;
	gl.bindTexture(gl.TEXTURE_2D, shadowTexture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, shadowSize, shadowSize, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.bindFramebuffer(gl.FRAMEBUFFER, shadowBuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowTexture, 0);
	gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
	if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE){gl.getExtension('WEBGL_lose_context')?.loseContext();return null;}
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	const backdropTexture=gl.createTexture(), backdropBuffer=gl.createFramebuffer();
	let backdropWidth=0,backdropHeight=0;
	gl.bindTexture(gl.TEXTURE_2D,backdropTexture);
	gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
	function draw(faces: Face[], width: number, height: number, ox: number, oy: number, zoom: number, ribbonCount: number) {
		// Multisample depth extrapolation on subpixel-thin card walls can leak
		// rear edges through the front. Supersample instead, then resolve in 2D.
		const samples = Math.min(2, 4096 / Math.max(width, height));
		width = Math.round(width * samples); height = Math.round(height * samples);
		ox *= samples; oy *= samples; zoom *= samples;
		if (surface.width !== width) surface.width = width;
		if (surface.height !== height) surface.height = height;
		gl.viewport(0, 0, width, height); gl.clearColor(0, 0, 0, 0); gl.depthMask(true); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.useProgram(program); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.uniform1i(imageUniform,0); gl.uniform1i(shadowUniform,1);gl.uniform1i(backdropUniform,2);
		gl.uniform2f(resolution, width, height); gl.uniform2f(origin, ox, oy); gl.uniform1f(scale, zoom);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 40, 0);
		gl.enableVertexAttribArray(uv); gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 40, 12);
		gl.enableVertexAttribArray(shade); gl.vertexAttribPointer(shade, 1, gl.FLOAT, false, 40, 20);
		gl.enableVertexAttribArray(normalAttribute); gl.vertexAttribPointer(normalAttribute, 3, gl.FLOAT, false, 40, 24);
		gl.enableVertexAttribArray(metalAttribute); gl.vertexAttribPointer(metalAttribute, 1, gl.FLOAT, false, 40, 36);
		// Keep the matte backdrop behind the complete moving assembly.
		const groundZ=backdropDepth(faces);
		const unproject=(x: number,y: number)=>({x:210+((x-ox)/zoom-210)*(1850-groundZ)/1850,y:450+((y-oy)/zoom-450)*(1850-groundZ)/1850,z:groundZ});
		const ground: Face[]=[];
		pushQuad(ground,faces[0].image,[unproject(0,0),unproject(width,0),unproject(width,height),unproject(0,height)],
			[{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}]);
		ground.forEach(face=>face.backdrop=2);
		// Upload moving geometry once and reuse the same vertex ranges for the
		// light, opaque, and alpha passes instead of rebuilding it for each pass.
		const geometry=[...faces,...ground], offsets=new Map<Face, number>(), vertices=new Float32Array(geometry.length*30);
		let cursor=0;
		for(const face of geometry){
			offsets.set(face,cursor/10);
			for(let j=0;j<3;j++){
				const v=face.v[j],s=face.s[j],n=face.n?face.n[j]:{x:0,y:0,z:1};
				vertices[cursor++]=v.x;vertices[cursor++]=v.y;vertices[cursor++]=v.z;
				vertices[cursor++]=s.x/face.image.width;vertices[cursor++]=s.y/face.image.height;vertices[cursor++]=face.shade;
				vertices[cursor++]=n.x;vertices[cursor++]=n.y;vertices[cursor++]=n.z;vertices[cursor++]=face.backdrop||(face.n?1:0);
			}
		}
		gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.DYNAMIC_DRAW);
		function batch(faces: Face[]) {
		for (let i = 0; i < faces.length;) {
			const image = faces[i].image, start=offsets.get(faces[i])!;let count=0;
			while(i<faces.length&&faces[i].image===image&&offsets.get(faces[i])===start+count){count+=3;i++;}
			let texture = cache.get(image);
			if (!texture) {
				texture = gl.createTexture()!; cache.set(image, texture); gl.bindTexture(gl.TEXTURE_2D, texture);
				gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			} else gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.drawArrays(gl.TRIANGLES,start,count);
		}
		}
		// All opaque geometry, including the woven straps and punched holes,
		// participates in one light-space depth map. Overlapping silhouettes do
		// not stack identical drop shadows on the background.
		gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,null); gl.activeTexture(gl.TEXTURE0);
		gl.bindFramebuffer(gl.FRAMEBUFFER,shadowBuffer); gl.viewport(0,0,shadowSize,shadowSize);
		gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT);
		gl.uniform1i(shadowPass,1); batch(faces);
		gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.viewport(0,0,width,height); gl.uniform1i(shadowPass,0);
		gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,shadowTexture); gl.activeTexture(gl.TEXTURE0);
		gl.enable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.uniform1i(passUniform,0);
		// Soft background shadows need fewer pixels than card artwork. Render
		// them at half display resolution, then resolve with linear filtering.
		// Contact shadows and geometry retain the full supersampled resolution.
		const bw=Math.ceil(width/4),bh=Math.ceil(height/4);
		gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,null);gl.activeTexture(gl.TEXTURE0);
		if(bw!==backdropWidth||bh!==backdropHeight){
			backdropWidth=bw;backdropHeight=bh;gl.bindTexture(gl.TEXTURE_2D,backdropTexture);
			gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,bw,bh,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
		}
		gl.bindFramebuffer(gl.FRAMEBUFFER,backdropBuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,backdropTexture,0);
		gl.viewport(0,0,bw,bh);gl.disable(gl.BLEND);gl.clear(gl.COLOR_BUFFER_BIT);
		gl.uniform1i(backdropPass,1);batch(ground);
		gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,width,height);gl.enable(gl.BLEND);
		gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,backdropTexture);gl.activeTexture(gl.TEXTURE0);
		gl.uniform1i(backdropPass,2);batch(ground);
		// Cloth order is fixed at its clamp. Solid hardware and cards use real depth.
		gl.disable(gl.DEPTH_TEST); gl.uniform1i(passUniform, 0); batch(faces.slice(0, ribbonCount));
		const solids = faces.slice(ribbonCount);
		gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
		gl.uniform1i(passUniform, 1); batch(solids);
		gl.depthMask(false); gl.uniform1i(passUniform, 2);
		// Only artwork textures contain partial alpha. Opaque metal and card
		// walls were already resolved; redrawing them would waste most GPU work.
		batch(solids.filter(face => face.image.width > 2).sort((a,b)=>a.z-b.z)); gl.depthMask(true);
		// Presenter edits replace the card texture; release superseded GPU resources.
		const live = new Set<LanyardSurface>(faces.map((f) => f.image));
		for (const [image, texture] of cache) if (!live.has(image)) { gl.deleteTexture(texture); cache.delete(image); }
	}
	return { surface, draw, dispose() { gl.getExtension('WEBGL_lose_context')?.loseContext(); } };
}
