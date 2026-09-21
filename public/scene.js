// Small purpose-built WebGL scene: no remote assets, game SDKs, CDN or npm runtime dependencies.
// The room is an interface, not a source of task state. All work indicators come from the server.
const V=(x=0,y=0,z=0)=>[x,y,z];
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const n=Math.hypot(...a)||1;return a.map(v=>v/n);};
function multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
function lookAt(eye,target){const z=norm(sub(eye,target)),x=norm(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
function perspective(aspect){const f=1/Math.tan(36*Math.PI/360),near=.1,far=120;return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);}
function color(hex,alpha=1){if(Array.isArray(hex))return hex.length===4?hex:[...hex,alpha];const n=parseInt(hex.replace('#',''),16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255,alpha];}
class Mesh {
  constructor(){this.data=[];}
  vertex(p,n,c){this.data.push(...p,...n,...c);}
  tri(a,b,c,col,normal){const n=normal||norm(cross(sub(b,a),sub(c,a)));for(const p of[a,b,c])this.vertex(p,n,color(col));}
  quad(a,b,c,d,col){this.tri(a,b,c,col);this.tri(a,c,d,col);}
  box(x,y,z,w,h,d,col,angle=0){const co=Math.cos(angle),si=Math.sin(angle);const p=(a,b,c)=>[x+a*co+c*si,y+b,z-a*si+c*co];const X=w/2,Y=h/2,Z=d/2;
    this.quad(p(-X,-Y,Z),p(X,-Y,Z),p(X,Y,Z),p(-X,Y,Z),col);
    this.quad(p(X,-Y,-Z),p(-X,-Y,-Z),p(-X,Y,-Z),p(X,Y,-Z),col);
    this.quad(p(X,-Y,Z),p(X,-Y,-Z),p(X,Y,-Z),p(X,Y,Z),col);
    this.quad(p(-X,-Y,-Z),p(-X,-Y,Z),p(-X,Y,Z),p(-X,Y,-Z),col);
    this.quad(p(-X,Y,Z),p(X,Y,Z),p(X,Y,-Z),p(-X,Y,-Z),col);
    this.quad(p(-X,-Y,-Z),p(X,-Y,-Z),p(X,-Y,Z),p(-X,-Y,Z),col);
  }
  cylinder(x,y,z,r,h,col,segments=16,rt=r){for(let i=0;i<segments;i++){const a=i*2*Math.PI/segments,b=(i+1)*2*Math.PI/segments,co=t=>Math.cos(t),si=t=>Math.sin(t);const p=[x+r*co(a),y-h/2,z+r*si(a)],q=[x+r*co(b),y-h/2,z+r*si(b)],s=[x+rt*co(b),y+h/2,z+rt*si(b)],t=[x+rt*co(a),y+h/2,z+rt*si(a)];this.quad(p,t,s,q,col);this.tri([x,y+h/2,z],s,t,col,[0,1,0]);this.tri([x,y-h/2,z],p,q,col,[0,-1,0]);}}
  sphere(x,y,z,rx,ry,rz,col,segments=12,rings=8){const p=(i,j)=>{const a=i*Math.PI/rings,b=j*2*Math.PI/segments;return[x+rx*Math.sin(a)*Math.cos(b),y+ry*Math.cos(a),z+rz*Math.sin(a)*Math.sin(b)];};for(let i=0;i<rings;i++)for(let j=0;j<segments;j++){const a=p(i,j),b=p(i+1,j),c=p(i+1,j+1),d=p(i,j+1);this.tri(a,b,c,col);this.tri(a,c,d,col);}}
  shadow(x,z,rx,rz){const c=[.24,.30,.24,.12];for(let i=0;i<28;i++){const a=i*Math.PI/14,b=(i+1)*Math.PI/14;this.tri([x,.037,z],[x+rx*Math.cos(a),.037,z+rz*Math.sin(a)],[x+rx*Math.cos(b),.037,z+rz*Math.sin(b)],c,[0,1,0]);}}
}
const desks=[{id:'office',x:-1.35,z:-1.7,color:'#59a891'},{id:'email',x:3.7,z:-1.7,color:'#d19b69'},{id:'tech',x:-1.35,z:2.15,color:'#9485bd'},{id:'owner',x:3.7,z:2.15,color:'#627a68'}];
function plant(m,x,z,scale=1){m.cylinder(x,.24*scale,z,.26*scale,.46*scale,'#dcd5bb',12,.32*scale);m.cylinder(x,.48*scale,z,.27*scale,.04*scale,'#4f5744');m.cylinder(x,.83*scale,z,.035*scale,.74*scale,'#7b8b58',8);for(let i=0;i<8;i++){const a=i*2.399,yy=.8+(i%3)*.19;const xx=x+Math.cos(a)*.2*scale,zz=z+Math.sin(a)*.2*scale;m.sphere(xx,yy*scale,zz,.20*scale,.27*scale,.12*scale,i%2?'#779b66':'#5e855c',8,5);}}
function furniture(m,d){const{x,z}=d;
  m.shadow(x,z+.5,1.6,1.2);
  // A quiet rug defines each desk without inventing a task or utilization metric.
  m.box(x,.024,z+.45,3.65,.02,2.95,d.id==='owner'?'#d3d9c8':'#e5e7d9');
  m.box(x,.87,z,2.65,.14,1.27,'#ccae81');m.box(x,.79,z,2.51,.06,1.15,'#b49166');
  for(const dx of[-1.12,1.12])for(const dz of[-.45,.45])m.box(x+dx,.40,z+dz,.065,.79,.065,'#59736b');
  m.box(x-.85,.42,z, .54,.69,.84,'#e6e5d5');for(let j=0;j<3;j++){m.box(x-.85,.22+j*.2,z+.43,.48,.18,.025,'#f7f2df');m.box(x-.85,.22+j*.2,z+.448,.13,.024,.021,'#a7b1a0');}
  m.box(x+.1,1.01,z-.2,.24,.22,.07,'#495e59');m.box(x+.1,.956,z-.2,.45,.035,.28,'#677b71');
  m.box(x+.1,1.33,z-.27,.98,.58,.08,'#334c4c');m.box(x+.1,1.33,z-.221,.90,.50,.015,'#163b3d');
  m.box(x+.1,.966,z+.23,.79,.035,.27,'#e5ebe0');for(let row=0;row<3;row++)for(let col=0;col<11;col++)m.box(x-.23+col*.066,.987,z+.15+row*.07,.047,.006,.046,'#bbcbbd');
  m.sphere(x+.73,.99,z+.24,.065,.032,.09,'#ecede1',8,4);
  m.box(x-.82,.967,z-.26,.31,.04,.34,'#f5f1d9',-.12);m.box(x-.82,.992,z-.26,.25,.006,.27,'#fffbed',-.12);
  for(let i=0;i<4;i++)m.box(x-.82,1.001,z-.35+i*.05,.18,.003,.006,'#b7bca2',-.12);
  m.cylinder(x+1.02,1.036,z-.3,.09,.19,'#f6f0d8',12);m.cylinder(x+1.02,1.137,z-.3,.074,.004,'#755b40',12);
  m.box(x,.54,z+1.03,.61,.14,.57,'#526c61');m.box(x,.85,z+1.28,.63,.55,.10,'#658174');
  m.cylinder(x,.3,z+1.03,.046,.42,'#86978a',10);for(let i=0;i<5;i++){const a=i*1.257;m.box(x+Math.sin(a)*.16,.09,z+1.03+Math.cos(a)*.16,.035,.04,.44,'#859589',a);}
  if(d.id!=='owner'){
    m.box(x,.77,z+1,.40,.38,.34,d.color);m.box(x,1.04,z+1.02,.45,.31,.31,d.color);
    m.cylinder(x,1.23,z+1.02,.065,.1,'#d2ad85',10);m.sphere(x,1.47,z+1.015,.19,.235,.18,'#e1ba91');
    m.sphere(x,1.595,z+1.035,.195,.135,.184,d.id==='office'?'#615443':d.id==='email'?'#705541':'#514e43');
    m.box(x-.135,.44,z+.85,.16,.40,.17,'#52616b');m.box(x+.135,.44,z+.85,.16,.40,.17,'#52616b');
    m.box(x-.135,.23,z+.77,.18,.09,.30,'#354848');m.box(x+.135,.23,z+.77,.18,.09,.30,'#354848');
    if(d.id==='email'){m.sphere(x-.19,1.46,z+1.01,.045,.065,.06,'#365659',8,5);m.sphere(x+.19,1.46,z+1.01,.045,.065,.06,'#365659',8,5);}
  }
}
function room(){const m=new Mesh();
  // Raised cutaway floor and staggered light oak boards.
  m.box(0,-.18,0,15.6,.36,11.5,'#c9cdbf');m.box(0,-.34,0,15.35,.08,11.27,'#b5c3b2');
  for(let ix=0;ix<24;ix++)for(let iz=0;iz<6;iz++)m.box(-7.45+ix*.647,.007,-4.55+iz*1.85,.636,.03,1.836,(ix+iz)%3===0?'#e4dac0':(ix+iz)%3===1?'#ece2c9':'#e7dfc7');
  m.box(0,1.7,-5.63,15.55,3.4,.17,'#efe9d5');m.box(-7.73,1.7,0,.17,3.4,11.35,'#e9e4d1');
  m.box(0,.13,-5.5,15.4,.22,.055,'#c4cfba');m.box(-7.62,.13,0,.055,.22,11.1,'#c4cfba');
  // Window, trees and architectural frames.
  m.box(-4.67,2.05,-5.505,4.7,1.91,.035,'#c3ded6');
  for(let i=0;i<9;i++){const xx=-6.7+i*.5;m.box(xx,1.47+(i%3)*.13,-5.47,.35,.45+(i%3)*.23,.015,i%2?'#b1c9bc':'#aec4bb');}
  for(let i=0;i<3;i++){m.sphere(-6+i*1.45,1.65,-5.43,.32,.41,.013,'#8ead92',8,6);m.box(-6+i*1.45,1.4,-5.415,.035,.40,.015,'#88a589');}
  for(const xx of[-7.07,-4.7,-2.3])m.box(xx,2.05,-5.40,.065,2.02,.15,'#f8f3df');
  for(const yy of[1.07,2.05,3.06])m.box(-4.68,yy,-5.4,4.88,.065,.15,'#f8f3df');
  m.box(-4.69,1.035,-5.31,4.98,.095,.35,'#d1c4a6');
  // Brand panel and warm shelving.
  m.box(2.46,2.02,-5.47,6.7,2.19,.16,'#2b6157');
  m.box(2.46,.81,-5.29,6.9,.08,.5,'#b69c71');
  m.box(6.7,.65,-4.72,1.02,1.2,.91,'#cccdb6');for(let i=0;i<3;i++){m.box(6.7,.3+i*.34,-4.25,.90,.29,.03,'#e1ddc7');m.box(6.7,.3+i*.34,-4.225,.21,.026,.02,'#94a18c');}
  // Lounge and samples corner.
  m.shadow(-5.65,-2.95,1.8,1.2);m.box(-5.69,.40,-3.35,2.7,.39,1.02,'#71927b');m.box(-5.69,.81,-3.73,2.65,.76,.21,'#749b83');
  m.box(-7.04,.72,-3.35,.24,.65,1.15,'#658b73');m.box(-4.33,.72,-3.35,.24,.65,1.15,'#658b73');
  for(let i=0;i<3;i++){m.box(-6.56+i*.87,.64,-3.35,.84,.16,.91,'#8eae91');m.box(-6.56+i*.87,.91,-3.58,.77,.46,.15,i===1?'#ddc39b':'#9cbaa1');}
  m.cylinder(-5.4,.47,-1.72,.62,.10,'#ccad7b',20);m.cylinder(-5.4,.24,-1.72,.19,.4,'#95a18c',12);m.box(-5.4,.531,-1.72,.31,.028,.26,'#ede9d0',.2);
  m.cylinder(-6.95,.07,-1.6,.26,.11,'#9ba792',18);m.cylinder(-6.95,1.14,-1.6,.03,2.13,'#768d7b',12);m.cylinder(-6.95,2.16,-1.6,.36,.47,'#f1e1b8',18,.20);
  // Warehouse-inspired sample shelving: bins, folded linens and rolled inventory.
  for(const z of[.48,3.3])m.box(-7.22,1.23,z,.055,2.45,.065,'#879c86');
  for(const y of[.22,1.04,1.87,2.49])m.box(-7.13,y,1.89,.99,.065,3.13,'#bfa87e');
  for(let i=0;i<4;i++){const z=.76+i*.75;m.box(-7.05,.54,z,.7,.55,.6,i%2?'#cb9976':'#bdc8ad');m.box(-6.688,.54,z,.014,.13,.24,'#f7edce');}
  for(let i=0;i<3;i++){m.box(-7.05,1.17+i*.13,1.03,.72,.11,.65,i%2?'#f5e8c4':'#ebe0c4');m.cylinder(-7.02,1.43,2.56,.14,.69,'#e2dbc3',10);m.cylinder(-7.0,1.43,2.2,.14,.69,'#f4ead1',10);}
  // A tent sample on the shelf, not a representation of current rental availability.
  m.box(-7.08,1.95,1.65,.76,.05,1.03,'#839b7c');for(const xx of[-7.42,-6.74])for(const zz of[1.2,2.1])m.box(xx,2.18,zz,.025,.44,.025,'#d7ddc7');
  m.quad([-7.5,2.37,1.13],[-6.66,2.37,1.13],[-7.08,2.65,1.65],[-7.08,2.65,1.65],'#fff6dd');m.quad([-6.66,2.37,1.13],[-6.66,2.37,2.18],[-7.08,2.65,1.65],[-7.08,2.65,1.65],'#f3e8cc');m.quad([-6.66,2.37,2.18],[-7.5,2.37,2.18],[-7.08,2.65,1.65],[-7.08,2.65,1.65],'#f8edcf');
  // Low dividers and task-zone details.
  m.box(-3.9,.46,.4,.28,.90,2.12,'#d4d9c3');m.box(-3.9,.98,.4,.4,.21,2.23,'#c4ccaf');
  for(let i=0;i<6;i++)m.sphere(-3.9,1.16,-.47+i*.35,.16,.20,.18,i%2?'#90a874':'#7a9867',8,5);
  plant(m,6.65,3.95,1.2);plant(m,-5.88,4.48,.95);plant(m,-1.61,-4.75,.72);
  for(const d of desks)furniture(m,d);
  // Soft ceiling-free pendant silhouettes at the back edge.
  for(const x of[-.1,4.8]){m.cylinder(x,3.5,-3.5,.013,.73,'#748c78',6);m.cylinder(x,3.05,-3.5,.32,.24,'#e6d8b6',20,.14);}
  return m;
}
function program(gl,vertex,fragment){const shaders=[];for(const[type,src]of[[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));shaders.push(s);}const p=gl.createProgram();for(const s of shaders)gl.attachShader(p,s);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));for(const s of shaders)gl.deleteShader(s);return p;}
export class OfficeScene {
  constructor(canvas,labels,onSelect,onFallback){this.canvas=canvas;this.labels=labels;this.onSelect=onSelect;this.onFallback=onFallback;this.state=null;this.selected=null;this.yaw=.69;this.pitch=.68;this.zoom=1;this.view='overview';this.dirty=true;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.labelNodes=new Map();
    try{this.gl=canvas.getContext('webgl',{antialias:true,alpha:true,powerPreference:'low-power'});if(this.gl)this.init();else{this.software=true;this.ctx=canvas.getContext('2d');if(!this.ctx)throw new Error('No canvas renderer available');this.initSoftware();}}catch(error){console.warn('3D view unavailable:',error.message);this.gl=null;this.software=false;onFallback();return;}
    const gl=this.gl;canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;this.labels.hidden=true;onFallback();});
    this.resize=new ResizeObserver(()=>{this.dirty=true;});this.resize.observe(canvas);
    let dragging=null;canvas.addEventListener('pointerdown',e=>{dragging={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY};canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{if(!dragging)return;this.view='overview';this.yaw=Math.max(.08,Math.min(1.48,this.yaw-(e.clientX-dragging.x)*.006));this.pitch=Math.max(.28,Math.min(1.4,this.pitch+(e.clientY-dragging.y)*.005));dragging.x=e.clientX;dragging.y=e.clientY;this.dirty=true;});
    canvas.addEventListener('pointerup',e=>{if(dragging && Math.hypot(e.clientX-dragging.startX,e.clientY-dragging.startY)<6){const rect=canvas.getBoundingClientRect();const pos={x:e.clientX-rect.left,y:e.clientY-rect.top};let closest=null,dist=55;for(const d of desks){const p=this.project([d.x,1.2,d.z+.45]);const dd=Math.hypot(pos.x-p.x,pos.y-p.y);if(dd<dist){closest=d;dist=dd;}}if(closest)onSelect(closest.id);}dragging=null;});
    canvas.addEventListener('pointercancel',()=>dragging=null);
    canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoom=Math.max(.65,Math.min(1.65,this.zoom+e.deltaY*.0006));this.dirty=true;},{passive:false});
    canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Home'].includes(e.key)){e.preventDefault();this.view='overview';if(e.key==='ArrowLeft')this.yaw=Math.max(.08,this.yaw-.1);if(e.key==='ArrowRight')this.yaw=Math.min(1.48,this.yaw+.1);if(e.key==='ArrowUp')this.pitch=Math.min(1.4,this.pitch+.08);if(e.key==='ArrowDown')this.pitch=Math.max(.28,this.pitch-.08);if(e.key==='+')this.setCamera('zoom');if(e.key==='-')this.setCamera('out');if(e.key==='Home')this.setCamera('overview');this.dirty=true;}});
    this.frame=t=>{if(!this.lost && !document.hidden && (this.dirty || (!this.reduced&&this.isWorking())) && (!this.last || t-this.last>(this.software?140:33))){this.render(t);this.last=t;this.dirty=false;}this.raf=requestAnimationFrame(this.frame);};this.raf=requestAnimationFrame(this.frame);
  }
  init(){const gl=this.gl;this.prog=program(gl,`attribute vec3 position;attribute vec3 normal;attribute vec4 color;uniform mat4 camera;varying vec4 vColor;varying vec3 vNormal;void main(){gl_Position=camera*vec4(position,1.);vColor=color;vNormal=normal;}`,`precision mediump float;varying vec4 vColor;varying vec3 vNormal;void main(){float light=.75+.25*max(dot(normalize(vNormal),normalize(vec3(-.5,.9,.7))),0.);gl_FragColor=vec4(vColor.rgb*light,vColor.a);}`);
    this.attributes=['position','normal','color'].map(n=>gl.getAttribLocation(this.prog,n));this.cameraUniform=gl.getUniformLocation(this.prog,'camera');
    this.buffer=gl.createBuffer();this.staticData=new Float32Array(room().data);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.staticData,gl.STATIC_DRAW);this.dynamic=gl.createBuffer();
    this.textureProgram=program(gl,`attribute vec3 position;attribute vec2 uv;uniform mat4 camera;varying vec2 vUv;void main(){gl_Position=camera*vec4(position,1.);vUv=uv;}`,`precision mediump float;uniform sampler2D map;varying vec2 vUv;void main(){gl_FragColor=texture2D(map,vUv);}`);
    const c=document.createElement('canvas');c.width=1024;c.height=320;const ctx=c.getContext('2d');ctx.fillStyle='#2b6157';ctx.fillRect(0,0,1024,320);ctx.textAlign='center';ctx.fillStyle='#f0eedb';ctx.font='600 84px "Segoe UI",Arial';ctx.fillText('FRIENDLY',512,132);ctx.font='400 35px "Segoe UI",Arial';ctx.fillText('P A R T Y   R E N T A L',512,195);ctx.fillStyle='#a8c7ac';ctx.font='400 19px "Segoe UI",Arial';ctx.fillText('S Y R A C U S E   •   V I R T U A L   H E A D Q U A R T E R S',512,265);
    this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    this.signBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.signBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-.72,.99,-5.377,0,1,5.64,.99,-5.377,1,1,5.64,3.00,-5.377,1,0,-.72,.99,-5.377,0,1,5.64,3.00,-5.377,1,0,-.72,3.00,-5.377,0,0]),gl.STATIC_DRAW);
    for(const d of desks){const b=document.createElement('button');b.className='desk-label';b.style.setProperty('--agent-color',d.color);b.dataset.desk=d.id;b.addEventListener('click',()=>this.onSelect(d.id));this.labels.append(b);this.labelNodes.set(d.id,b);}
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  }
  status(id){if(id==='owner')return {name:'Bryan',label:'Owner · review desk',running:false};const a=this.state?.agents.find(a=>a.id===id);const tasks=this.state?.tasks.filter(t=>t.role===id)||[];const running=tasks.some(t=>t.status==='running');let label=this.state?.settings.paused||a?.paused?'Paused':running?'Working':tasks.some(t=>t.status==='waiting_approval')?'Waiting for review':tasks.some(t=>t.status==='blocked')?'Needs your help':'Available';return {name:a?.name||id,label,running:running&&!this.state?.settings.paused&&!a?.paused};}
  isWorking(){return desks.some(d=>this.status(d.id).running);}
  update(state){this.state=state;this.dirty=true;if(!this.gl&&!this.software)return;for(const d of desks){const node=this.labelNodes.get(d.id),s=this.status(d.id);node.replaceChildren();const strong=document.createElement('strong'),i=document.createElement('i');strong.append(i,document.createTextNode(s.name));const span=document.createElement('span');span.textContent=s.label;node.append(strong,span);node.setAttribute('aria-label',`Open ${s.name}'s desk: ${s.label}`);}}
  select(id){this.selected=id;this.dirty=true;for(const [key,node]of this.labelNodes)node.classList.toggle('selected',key===id);}
  setCamera(view){if(view==='zoom')this.zoom=Math.max(.65,this.zoom-.12);else if(view==='out')this.zoom=Math.min(1.65,this.zoom+.12);else{this.view=view;this.zoom=1;this.yaw=.69;this.pitch=view==='top'?1.34:.68;}this.dirty=true;}
  project(p){if(!this.matrix)return{x:-100,y:-100,visible:false};const m=this.matrix,clip=[0,0,0,0];for(let r=0;r<4;r++)clip[r]=m[r]*p[0]+m[4+r]*p[1]+m[8+r]*p[2]+m[12+r];return{x:(clip[0]/clip[3]+1)*this.width/2,y:(1-clip[1]/clip[3])*this.height/2,visible:clip[3]>0};}
  bindMesh(buffer){const gl=this.gl;gl.useProgram(this.prog);gl.uniformMatrix4fv(this.cameraUniform,false,this.matrix);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);for(let i=0;i<3;i++){gl.enableVertexAttribArray(this.attributes[i]);gl.vertexAttribPointer(this.attributes[i],i===2?4:3,gl.FLOAT,false,40,i===0?0:i===1?12:24);}}
  render(time){if(this.software){this.renderSoftware(time);return;}const gl=this.gl;const rect=this.canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;this.width=rect.width;this.height=rect.height;const dpr=Math.min(devicePixelRatio||1,1.7);if(this.canvas.width!==Math.round(rect.width*dpr)||this.canvas.height!==Math.round(rect.height*dpr)){this.canvas.width=Math.round(rect.width*dpr);this.canvas.height=Math.round(rect.height*dpr);}
    const aspect=rect.width/rect.height,dist=Math.max(21,29/aspect)*this.zoom;let eye=[Math.sin(this.yaw)*Math.cos(this.pitch)*dist,Math.sin(this.pitch)*dist,Math.cos(this.yaw)*Math.cos(this.pitch)*dist],target=[0,.35,0];if(this.view==='owner'){eye=[3.7,1.54,3.57];target=[2.7,1.38,-4.2];}
    this.matrix=multiply(perspective(aspect),lookAt(eye,target));gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    this.bindMesh(this.buffer);gl.drawArrays(gl.TRIANGLES,0,this.staticData.length/10);
    const dynamic=new Mesh();for(const d of desks){const s=this.status(d.id),pulse=s.running&&!this.reduced?Math.sin(time*.025)*.018:0;
      if(d.id!=='owner'){for(const sign of[-1,1]){dynamic.box(d.x+sign*.265,.99,d.z+.81,.115,.16,.37,d.color);dynamic.box(d.x+sign*.265,1.055+pulse,d.z+.52,.102,.095,.26,'#e0b991');}}
      const screenColor=s.running?'#a5ddb2':s.label==='Waiting for review'?'#dac291':s.label==='Paused'?'#87998b':'#adc0b0';
      for(let j=0;j<4;j++)dynamic.box(d.x-.04,1.47-j*.087,d.z-.208,.48-(j%2)*.12,.021,.002,screenColor);
      dynamic.box(d.x+.39,1.33,d.z-.207,.095,.29,.002,d.color);
      if(this.selected===d.id){dynamic.box(d.x,.941,d.z+.641,2.68,.017,.025,d.color);dynamic.box(d.x-1.334,.941,d.z,.025,.017,1.3,d.color);dynamic.box(d.x+1.334,.941,d.z,.025,.017,1.3,d.color);}
      const node=this.labelNodes.get(d.id),p=this.project([d.x,2.14,d.z+.90]);node.style.left=`${p.x}px`;node.style.top=`${p.y}px`;node.hidden=this.view==='owner'||!p.visible||p.x<35||p.x>rect.width-35||p.y<58||p.y>rect.height-45;
    }
    const data=new Float32Array(dynamic.data);gl.bindBuffer(gl.ARRAY_BUFFER,this.dynamic);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);this.bindMesh(this.dynamic);gl.drawArrays(gl.TRIANGLES,0,data.length/10);
    for(const attr of this.attributes)gl.disableVertexAttribArray(attr);
    gl.useProgram(this.textureProgram);gl.bindBuffer(gl.ARRAY_BUFFER,this.signBuffer);const pos=gl.getAttribLocation(this.textureProgram,'position'),uv=gl.getAttribLocation(this.textureProgram,'uv');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,3,gl.FLOAT,false,20,0);gl.enableVertexAttribArray(uv);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,20,12);gl.uniformMatrix4fv(gl.getUniformLocation(this.textureProgram,'camera'),false,this.matrix);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.uniform1i(gl.getUniformLocation(this.textureProgram,'map'),0);gl.drawArrays(gl.TRIANGLES,0,6);gl.disableVertexAttribArray(pos);gl.disableVertexAttribArray(uv);
  }
  initSoftware(){
    this.staticData=new Float32Array(room().data);
    for(const d of desks){const b=document.createElement('button');b.className='desk-label';b.style.setProperty('--agent-color',d.color);b.dataset.desk=d.id;b.addEventListener('click',()=>this.onSelect(d.id));this.labels.append(b);this.labelNodes.set(d.id,b);}
    const c=document.createElement('canvas');c.width=1024;c.height=320;const ctx=c.getContext('2d');ctx.fillStyle='#2b6157';ctx.fillRect(0,0,1024,320);ctx.textAlign='center';ctx.fillStyle='#f0eedb';ctx.font='600 84px "Segoe UI",Arial';ctx.fillText('FRIENDLY',512,132);ctx.font='400 35px "Segoe UI",Arial';ctx.fillText('P A R T Y   R E N T A L',512,195);ctx.fillStyle='#a8c7ac';ctx.font='400 19px "Segoe UI",Arial';ctx.fillText('S Y R A C U S E   •   V I R T U A L   H E A D Q U A R T E R S',512,265);this.signCanvas=c;
    this.canvas.dataset.renderer='software-3d';
  }
  renderSoftware(time){
    const rect=this.canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;this.width=rect.width;this.height=rect.height;
    const dpr=Math.min(devicePixelRatio||1,1.5);if(this.canvas.width!==Math.round(rect.width*dpr)||this.canvas.height!==Math.round(rect.height*dpr)){this.canvas.width=Math.round(rect.width*dpr);this.canvas.height=Math.round(rect.height*dpr);}
    const aspect=rect.width/rect.height,dist=Math.max(21,29/aspect)*this.zoom;let eye=[Math.sin(this.yaw)*Math.cos(this.pitch)*dist,Math.sin(this.pitch)*dist,Math.cos(this.yaw)*Math.cos(this.pitch)*dist],target=[0,.35,0];if(this.view==='owner'){eye=[3.7,1.54,3.57];target=[2.7,1.38,-4.2];}
    this.matrix=multiply(perspective(aspect),lookAt(eye,target));const m=this.matrix,triangles=[],light=norm([-.5,.9,.7]);
    const dynamic=new Mesh();
    for(const d of desks){const status=this.status(d.id),pulse=status.running&&!this.reduced?Math.sin(time*.025)*.018:0;
      if(d.id!=='owner')for(const sign of[-1,1]){dynamic.box(d.x+sign*.265,.99,d.z+.81,.115,.16,.37,d.color);dynamic.box(d.x+sign*.265,1.055+pulse,d.z+.52,.102,.095,.26,'#e0b991');}
      const col=status.running?'#a5ddb2':status.label==='Waiting for review'?'#dac291':status.label==='Paused'?'#87998b':'#adc0b0';
      for(let j=0;j<4;j++)dynamic.box(d.x-.04,1.47-j*.087,d.z-.208,.48-(j%2)*.12,.021,.002,col);
      dynamic.box(d.x+.39,1.33,d.z-.207,.095,.29,.002,d.color);
      if(this.selected===d.id)dynamic.box(d.x,.944,d.z+.641,2.68,.021,.03,d.color);
      const node=this.labelNodes.get(d.id),p=this.project([d.x,2.14,d.z+.90]);node.style.left=`${p.x}px`;node.style.top=`${p.y}px`;node.hidden=this.view==='owner'||!p.visible||p.x<35||p.x>rect.width-35||p.y<58||p.y>rect.height-45;
    }
    for(const data of[this.staticData,dynamic.data])for(let i=0;i<data.length;i+=30){
      const points=[];let depth=0,skip=false;
      for(let v=0;v<3;v++){const k=i+v*10,x=data[k],y=data[k+1],z=data[k+2];const w=m[3]*x+m[7]*y+m[11]*z+m[15];if(w<.15){skip=true;break;}depth+=w;points.push([(m[0]*x+m[4]*y+m[8]*z+m[12])/w*this.width/2+this.width/2,this.height/2-(m[1]*x+m[5]*y+m[9]*z+m[13])/w*this.height/2,(m[2]*x+m[6]*y+m[10]*z+m[14])/w]);}
      if(skip)continue;
      const area=(points[1][0]-points[0][0])*(points[2][1]-points[0][1])-(points[1][1]-points[0][1])*(points[2][0]-points[0][0]);
      if(Math.abs(area)<.01)continue;
      if(points.every(p=>p[0]<-10)||points.every(p=>p[0]>this.width+10)||points.every(p=>p[1]<-10)||points.every(p=>p[1]>this.height+10))continue;
      const shade=.75+.25*Math.max(0,data[i+3]*light[0]+data[i+4]*light[1]+data[i+5]*light[2]);
      triangles.push({points,depth:depth/3,rgba:[data[i+6]*shade*255,data[i+7]*shade*255,data[i+8]*shade*255,data[i+9]]});
    }
    // Depth-buffered triangle rasterization avoids painter-order artifacts on large floor planes.
    const ctx=this.ctx,W=this.canvas.width,H=this.canvas.height;
    const image=ctx.createImageData(W,H),pixels=image.data,zbuffer=new Float32Array(W*H);zbuffer.fill(Infinity);
    const raster=t=>{
      const [a,b,c]=t.points.map(p=>[p[0]*dpr,p[1]*dpr,p[2]]),[red,green,blue,alpha]=t.rgba;
      const det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(det)<.01)return;
      const minX=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),maxX=Math.min(W-1,Math.ceil(Math.max(a[0],b[0],c[0])));
      const minY=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),maxY=Math.min(H-1,Math.ceil(Math.max(a[1],b[1],c[1])));
      const dxA=(b[1]-c[1])/det,dxB=(c[1]-a[1])/det;
      for(let y=minY;y<=maxY;y++){
        let wa=((b[1]-c[1])*(minX+.5-c[0])+(c[0]-b[0])*(y+.5-c[1]))/det;
        let wb=((c[1]-a[1])*(minX+.5-c[0])+(a[0]-c[0])*(y+.5-c[1]))/det;
        for(let x=minX;x<=maxX;x++,wa+=dxA,wb+=dxB){const wc=1-wa-wb;if(wa<-.00001||wb<-.00001||wc<-.00001)continue;
          const depth=wa*a[2]+wb*b[2]+wc*c[2],index=y*W+x;if(depth>zbuffer[index]+.0000001)continue;
          const k=index*4;if(alpha>=.99){zbuffer[index]=depth;pixels[k]=red;pixels[k+1]=green;pixels[k+2]=blue;pixels[k+3]=255;}
          else if(pixels[k+3]){pixels[k]=red*alpha+pixels[k]*(1-alpha);pixels[k+1]=green*alpha+pixels[k+1]*(1-alpha);pixels[k+2]=blue*alpha+pixels[k+2]*(1-alpha);}
        }
      }
    };
    for(const t of triangles)if(t.rgba[3]>=.99)raster(t);
    for(const t of triangles)if(t.rgba[3]<.99)raster(t);
    ctx.setTransform(1,0,0,1,0,0);ctx.putImageData(image,0,0);ctx.setTransform(dpr,0,0,dpr,0,0);
    const tl=this.project([-.72,3,-5.377]),tr=this.project([5.64,3,-5.377]),bl=this.project([-.72,.99,-5.377]),br=this.project([5.64,.99,-5.377]);
    if([tl,tr,bl,br].every(p=>p.visible)){ctx.save();ctx.beginPath();ctx.moveTo(tl.x,tl.y);ctx.lineTo(tr.x,tr.y);ctx.lineTo(br.x,br.y);ctx.lineTo(bl.x,bl.y);ctx.closePath();ctx.clip();ctx.transform((tr.x-tl.x)/1024,(tr.y-tl.y)/1024,(bl.x-tl.x)/320,(bl.y-tl.y)/320,tl.x,tl.y);ctx.drawImage(this.signCanvas,0,0);ctx.restore();}
  }
  dispose(){cancelAnimationFrame(this.raf);this.resize?.disconnect();if(this.gl){for(const b of[this.buffer,this.dynamic,this.signBuffer])this.gl.deleteBuffer(b);this.gl.deleteTexture(this.texture);this.gl.deleteProgram(this.prog);this.gl.deleteProgram(this.textureProgram);}}
}
