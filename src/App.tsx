import { useEffect, useMemo, useRef, useState } from 'react';
import CinematicWorld from './CinematicWorld';
import { runEconomyTick, type EconomyStock } from './autonomousEconomy';
import {
  Globe2, BrainCircuit, Users, Building2, Coins, Map, Compass, Sun, Moon,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Sparkles, Radio,
  Navigation, Eye, Home, Factory, HeartPulse, ShoppingCart, Wheat, MessageCircle,
  Send, X, Zap, Heart, BriefcaseBusiness, GraduationCap, Utensils, Car, SlidersHorizontal} from 'lucide-react';

const api = {
  get: (path: string) => fetch(path).then(async r => ({ data: await r.json() })),
  post: (path: string, body: unknown) => fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async r => ({ data: await r.json() }))
};

type Player = { x:number; y:number; angle:number };
type Agent = {
  id:number; x:number; y:number; vx:number; vy:number; job:string; goal:string;
  mood:string; energy:number; wealth:number; generation:number; age:number;
  personality:string; activity:string; home:string; hunger:number; social:number;
  intelligence:number; skills:string[]; partnerId?:number; children:number; reputation:number; vehicle:string;
};
type ChatMessage = { role:'user'|'assistant'; content:string };
type Site = { x:number; y:number; kind:'city'|'farm'|'factory'|'hospital'|'market'|'park'; seed:number };

const STORAGE_KEY = 'agent-world-explorer-v5';
const CELL = 120;
const names = ['آریا','نیما','رها','سام','لیا','کیان','مهسا','نوید','یونا','باران','پارسا','هلیا','آبتین','دانا','روناک','ماهان'];
const jobs = ['کشاورز','مهندس','پزشک','معمار','سازنده','تاجر','پژوهشگر','برنامه‌نویس','معلم','راننده','هنرمند','ماهیگیر'];
const goals = ['پیدا کردن کار بهتر','ساختن خانه','گسترش کسب‌وکار','یادگیری مهارت','کمک به جامعه','گسترش شهر','تشکیل خانواده','کشف منطقه جدید'];
const moods = ['آرام','کنجکاو','جاه‌طلب','اجتماعی','خوشحال','نگران','خسته'];
const personalities = ['منطقی و دقیق','خلاق و ماجراجو','اجتماعی و مهربان','رقابت‌جو و جاه‌طلب','آرام و محتاط','کنجکاو و دانش‌دوست'];
const activities = ['در حال کار','در مسیر خانه','خرید در بازار','در حال یادگیری','استراحت در پارک','گفت‌وگو با دیگران','در حال برنامه‌ریزی','در حال ساخت‌وساز'];

function hash(x:number,y:number) {
  const n = Math.sin(x * 127.1 + y * 311.7 + 91.7) * 43758.5453123;
  return n - Math.floor(n);
}
function cellAt(x:number,y:number) { return { cx:Math.floor(x / CELL), cy:Math.floor(y / CELL) }; }
function biome(cx:number,cy:number) {
  const n = hash(cx,cy);
  if (n < .08) return 'water';
  if (n < .17) return 'desert';
  if (n < .31) return 'forest';
  if (n > .91) return 'mountain';
  return 'grass';
}
function siteAt(cx:number,cy:number): Site | null {
  const n = hash(cx * 3 + 11, cy * 5 + 7);
  if (n > .94) return {x:cx*CELL+CELL/2,y:cy*CELL+CELL/2,kind:'city',seed:Math.floor(n*9999)};
  if (n > .86) return {x:cx*CELL+CELL/2,y:cy*CELL+CELL/2,kind:'farm',seed:Math.floor(n*9999)};
  if (n > .82) return {x:cx*CELL+CELL/2,y:cy*CELL+CELL/2,kind:'factory',seed:Math.floor(n*9999)};
  if (n > .79) return {x:cx*CELL+CELL/2,y:cy*CELL+CELL/2,kind:'market',seed:Math.floor(n*9999)};
  if (n > .77) return {x:cx*CELL+CELL/2,y:cy*CELL+CELL/2,kind:'hospital',seed:Math.floor(n*9999)};
  if (n > .75) return {x:cx*CELL+CELL/2,y:cy*CELL+CELL/2,kind:'park',seed:Math.floor(n*9999)};
  return null;
}
function siteName(seed:number) { return ['نوران','آریا','سپهر','مهرگان','آفتاب','رودان','پارسا','آرمان','ساحل‌نو','دریاکنار'][seed % 10]; }
function siteLabel(kind:Site['kind']) {
  return {city:'شهر',farm:'مزرعه',factory:'کارخانه',market:'بازار',hospital:'بیمارستان',park:'پارک'}[kind];
}
function startPremiumWebGL(canvas:HTMLCanvasElement,state:{current:{player:Player;time:number;driving:boolean}}){const fallback=document.querySelector('.world-canvas') as HTMLCanvasElement|null;const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,powerPreference:'high-performance'});if(!gl){canvas.style.display='none';if(fallback)fallback.style.opacity='1';return()=>{};}canvas.style.display='block';canvas.style.opacity='0';if(fallback)fallback.style.opacity='1';const vs='#version 300 es\nprecision highp float;in vec3 aP;in vec3 aN;in vec3 aC;uniform mat4 uVP;out vec3 vN;out vec3 vC;out vec3 vP;void main(){vN=aN;vC=aC;vP=aP;gl_Position=uVP*vec4(aP,1.0);}';const fs='#version 300 es\nprecision highp float;in vec3 vN;in vec3 vC;in vec3 vP;uniform vec3 uCam;uniform float uDay;uniform float uTime;out vec4 o;void main(){vec3 n=normalize(vN);vec3 sun=normalize(vec3(-.42,.72,.58));float nd=max(dot(n,sun),0.0);float l=.72+.30*uDay+nd*(.78+.32*uDay);vec3 viewDir=normalize(uCam-vP);vec3 halfDir=normalize(sun+viewDir);float micro=sin(vP.x*.22+sin(vP.y*.07))*sin(vP.y*.19+vP.x*.05)*.5+.5;float rough=.35+.45*micro;float spec=pow(max(dot(n,halfDir),0.0),mix(18.0,72.0,1.0-rough))*.16;float rim=pow(1.0-max(dot(n,viewDir),0.0),3.0)*.045;float d=distance(vP,uCam);float fog=clamp((d-430.0)/1050.0,0.0,.78);vec3 fogC=mix(vec3(.12,.17,.23),vec3(.74,.86,.90),max(uDay,.35));vec3 base=vC*(.82+.18*micro);vec3 col=base*l+vec3(spec)+vec3(rim*.72)+vec3(.035,.045,.055);col=mix(col,fogC,fog);col+=vec3(.018,.014,.010)*sin(uTime*.10+vP.x*.011+vP.y*.009);o=vec4(pow(max(col,vec3(0.0)),vec3(.88)),1.0);}';const compile=(type:number,src:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,src);gl.compileShader(s);return s};const prog=gl.createProgram()!;gl.attachShader(prog,compile(gl.VERTEX_SHADER,vs));gl.attachShader(prog,compile(gl.FRAGMENT_SHADER,fs));gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))return()=>{};const vao=gl.createVertexArray()!,buf=gl.createBuffer()!;gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buf);const lp=gl.getAttribLocation(prog,'aP'),ln=gl.getAttribLocation(prog,'aN'),lc=gl.getAttribLocation(prog,'aC');gl.enableVertexAttribArray(lp);gl.enableVertexAttribArray(ln);gl.enableVertexAttribArray(lc);gl.vertexAttribPointer(lp,3,gl.FLOAT,false,36,0);gl.vertexAttribPointer(ln,3,gl.FLOAT,false,36,12);gl.vertexAttribPointer(lc,3,gl.FLOAT,false,36,24);const uVP=gl.getUniformLocation(prog,'uVP'),uCam=gl.getUniformLocation(prog,'uCam'),uDay=gl.getUniformLocation(prog,'uDay'),uTime=gl.getUniformLocation(prog,'uTime');gl.useProgram(prog);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);const resize=()=>{const d=Math.min(devicePixelRatio||1,1.6);canvas.width=Math.floor(innerWidth*d);canvas.height=Math.floor(innerHeight*d);gl.viewport(0,0,canvas.width,canvas.height)};resize();addEventListener('resize',resize);const h=(x:number,y:number)=>Math.sin(x*12.9898+y*78.233)*43758.5453-Math.floor(Math.sin(x*12.9898+y*78.233)*43758.5453);const addBox=(v:number[],x:number,y:number,z:number,w:number,d:number,ht:number,c:number[])=>{const x0=x-w/2,x1=x+w/2,y0=y-d/2,y1=y+d/2,z1=z+ht;const faces=[[[x0,y0,z],[x1,y0,z],[x1,y1,z],[x0,y1,z],[0,0,-1]],[[x0,y0,z1],[x0,y1,z1],[x1,y1,z1],[x1,y0,z1],[0,0,1]],[[x1,y0,z],[x1,y0,z1],[x1,y1,z1],[x1,y1,z],[1,0,0]],[[x0,y1,z],[x0,y1,z1],[x0,y0,z1],[x0,y0,z],[-1,0,0]],[[x0,y0,z],[x0,y0,z1],[x1,y0,z1],[x1,y0,z],[0,-1,0]],[[x1,y1,z],[x1,y1,z1],[x0,y1,z1],[x0,y1,z],[0,1,0]]];for(const f of faces){const [A,B,C,D,N]=f as any;for(const tri of [[A,B,C],[A,C,D]])for(const P of tri)v.push(...P,...N,...c)}};const addBuilding=(v:number[],x:number,y:number,ht:number,w:number,d:number,seed:number)=>{const base=[[.27,.30,.30],[.34,.32,.29],[.22,.27,.30],[.38,.35,.31]][seed%4];addBox(v,x,y,.45,w,d,ht,base);addBox(v,x,y,.45+ht*.86,w*.94,d*.94,ht*.14,[base[0]*.7,base[1]*.7,base[2]*.72]);const rows=Math.max(2,Math.min(8,Math.floor(ht/4.5))),cols=Math.max(2,Math.min(7,Math.floor(w/3.2)));for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){if((r*7+c+seed)%5===0)continue;const wx=x-w*.37+c*(w*.74/Math.max(1,cols-1));const wz=.9+(r+.5)*(ht*.76/rows);addBox(v,wx,y-d*.505,wz,.62,.10,.85,((r+c+seed)&1)?[.16,.22,.25]:[.55,.62,.60]);}for(let r=0;r<Math.min(6,rows);r++)for(let c=0;c<Math.max(2,Math.floor(d/3.5));c++){if((r+c+seed)%4===1)continue;const wy=y-d*.37+c*(d*.74/Math.max(1,Math.floor(d/3.5)-1));addBox(v,x+w*.505,wy,.9+(r+.5)*(ht*.76/rows),.10,.62,.85,[.14,.19,.22]);}addBox(v,x+w*.18,y+d*.18,.45+ht+.2,1.4,1.0,.45,[.12,.13,.14]);};const addTree=(v:number[],x:number,y:number,s:number)=>{addBox(v,x,y,0,.45,.45,s*.9,[.22,.14,.08]);const z=s*.9,top=[x,y,z+s*1.9],p1=[x-s,y-s,z],p2=[x+s,y-s,z],p3=[x+s,y+s,z],p4=[x-s,y+s,z];const sides=[[top,p1,p2],[top,p2,p3],[top,p3,p4],[top,p4,p1]];for(const [A,B,C] of sides){const ux=B[0]-A[0],uy=B[1]-A[1],uz=B[2]-A[2],vx=C[0]-A[0],vy=C[1]-A[1],vz=C[2]-A[2];const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;for(const P of [A,B,C])v.push(...P,nx,ny,nz,.10,.26,.15)}};const addCar=(v:number[],x:number,y:number,t:number)=>{const dir=Math.sin(t+x*.004)*.7;addBox(v,x,y,.45,6,3,1.2,[.10,.13,.14]);addBox(v,x+dir*1.5,y,.95,3.2,2.6,.7,[.23,.30,.31]);addBox(v,x+dir*2.4,y,1.15,.08,2.2,.5,[.48,.63,.66])};const addHuman=(v:number[],x:number,y:number,s:number,seed:number)=>{const skin=.45+.18*h(seed,2),cloth=h(seed,4),shirt=cloth>.72?[.12,.28,.34]:cloth>.42?[.36,.20,.13]:[.22,.34,.25];addBox(v,x,y,.35,s*.22,s*.18,s*.72,[.08,.10,.11]);addBox(v,x,y,s*.76,s*.46,s*.28,s*.72,shirt);addBox(v,x,y+s*.03,s*1.5,s*.27,s*.27,s*.28,[skin,.55+skin*.15,.42+skin*.12]);addBox(v,x,y-s*.02,s*1.72,s*.17,s*.20,s*.12,[.05,.045,.04]);addBox(v,x-s*.16,y,.42,s*.12,s*.12,s*.55,[.10,.12,.13]);addBox(v,x+s*.16,y,.42,s*.12,s*.12,s*.55,[.10,.12,.13]);};let lastCell='';let verts=new Float32Array();let raf=0;const rebuild=(px:number,py:number,t:number)=>{const v:number[]=[];const cell=40,cx=Math.floor(px/cell),cy=Math.floor(py/cell);for(let gy=cy-15;gy<=cy+15;gy++)for(let gx=cx-15;gx<=cx+15;gx++){const x=(gx+.5)*cell,y=(gy+.5)*cell,n=h(gx,gy),bh=.25*Math.sin(gx*.7)+.2*Math.cos(gy*.5);const terrain=n<.07?[.08,.38,.52]:n<.16?[.68,.58,.38]:n>.91?[.43,.46,.43]:n>.70?[.16,.38,.22]:[.25,.48,.28];addBox(v,x,y,bh,cell+1,cell+1,.42,terrain);const r=h(gx+9,gy-7);if(r>.70){const count=r>.88?3:1;for(let tk=0;tk<count;tk++)addTree(v,x+(h(gx+tk,gy+3)-.5)*28,y+(h(gx+4,gy+tk)-.5)*28,1.0+r*1.7);}if(r<.075){const ht=10+r*34;addBuilding(v,x,y,ht,15+(h(gx+2,gy+8))*10,15+(h(gx-5,gy+1))*8,gx*31+gy);for(let w=-1;w<=1;w++)for(let q=0;q<Math.min(5,Math.floor(ht/5));q++)addBox(v,x+w*3.2,y-8.1,3+q*5,.9,.18,.75,((q+w)&1)?[.66,.53,.30]:[.035,.055,.06])}}for(let k=-14;k<=14;k++){addBox(v,(cx+k)*cell,cy*cell,.46,cell*.18,cell*31,.10,[.18,.19,.18]);addBox(v,cx*cell,(cy+k)*cell,.48,cell*31,cell*.18,.10,[.18,.19,.18]);addBox(v,(cx+k)*cell,cy*cell,.57,cell*.035,cell*31,.02,[.82,.72,.40]);addBox(v,cx*cell,(cy+k)*cell,.59,cell*31,cell*.035,.02,[.82,.72,.40])}for(let i=0;i<70;i++){const x=px+(h(i,1)-.5)*1000,y=py+(h(i,2)-.5)*1000;if(Math.abs(x-px)<120&&Math.abs(y-py)<120)continue;addCar(v,x,y,t)}for(let i=0;i<34;i++){const ax=px+(h(i,71)-.5)*760,ay=py+(h(i,73)-.5)*760;if(Math.abs(ax-px)<18&&Math.abs(ay-py)<18)continue;addHuman(v,ax,ay,.8+h(i,75)*.75,i+900);if(i%7===0){addBox(v,ax,ay,.35,.12,.12,1.8,[.16,.18,.18]);addBox(v,ax,ay,2.1,.38,.38,.06,[.86,.76,.42])}}verts=new Float32Array(v);lastCell=cx+':'+cy;gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,verts,gl.STATIC_DRAW)};const perspective=(f:number,a:number,n:number,z:number)=>{const q=1/Math.tan(f/2),o=new Float32Array(16);o[0]=q/a;o[5]=q;o[10]=(z+n)/(n-z);o[11]=-1;o[14]=2*z*n/(n-z);return o};const view=(e:number[],ang:number)=>{const fx=Math.cos(ang),fy=Math.sin(ang),fz=-.06;const fl=Math.hypot(fx,fy,fz),F=[fx/fl,fy/fl,fz/fl],S=[F[1],-F[0],0],sl=Math.hypot(S[0],S[1]);S[0]/=sl;S[1]/=sl;const U=[S[1]*F[2],-S[0]*F[2],S[0]*F[1]-S[1]*F[0]];return new Float32Array([S[0],U[0],-F[0],0,S[1],U[1],-F[1],0,S[2],U[2],-F[2],0,-(S[0]*e[0]+S[1]*e[1]),-(U[0]*e[0]+U[1]*e[1]+U[2]*e[2]),F[0]*e[0]+F[1]*e[1]+F[2]*e[2],1])};const mul=(A:Float32Array,B:Float32Array)=>{const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=A[r]*B[c*4]+A[4+r]*B[c*4+1]+A[8+r]*B[c*4+2]+A[12+r]*B[c*4+3];return o};const draw=(now:number)=>{const s=state.current,day=Math.max(.38,Math.sin(((s.time-6)/24)*Math.PI*2)*.5+.5),p=s.player,cc=Math.floor(p.x/40)+':'+Math.floor(p.y/40);if(cc!==lastCell||verts.length===0)rebuild(p.x,p.y,now*.001);gl.clearColor(.48+.24*day,.70+.22*day,.86+.12*day,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);const P=perspective(Math.PI/3,canvas.width/canvas.height,.2,1800),V=view([p.x,p.y,s.driving?4.5:3.2],p.angle),VP=mul(P,V);gl.useProgram(prog);gl.uniformMatrix4fv(uVP,false,VP);gl.uniform3f(uCam,p.x,p.y,s.driving?4.5:3.2);gl.uniform1f(uDay,day);gl.uniform1f(uTime,now*.001);gl.bindVertexArray(vao);gl.drawArrays(gl.TRIANGLES,0,verts.length/9);canvas.style.opacity='1';if(fallback)fallback.style.opacity='0';raf=requestAnimationFrame(draw)};raf=requestAnimationFrame(draw);return()=>{cancelAnimationFrame(raf);removeEventListener('resize',resize);gl.deleteBuffer(buf);gl.deleteVertexArray(vao);gl.deleteProgram(prog)}}

function makeAgents(): Agent[] {
  const list:Agent[] = [];
  for (let i=0;i<220;i++) {
    const cx = Math.floor((hash(i,71)-.5)*18), cy = Math.floor((hash(i,91)-.5)*18);
    const id=i+1;
    list.push({
      id, x:cx*CELL + hash(i,3)*CELL, y:cy*CELL + hash(i,5)*CELL,
      vx:(hash(i,7)-.5)*.5, vy:(hash(i,9)-.5)*.5,
      job:jobs[i%jobs.length], goal:goals[i%goals.length], mood:moods[i%moods.length],
      energy:55+Math.floor(hash(i,13)*45), wealth:250+Math.floor(hash(i,15)*3000),
      generation:1+Math.floor(hash(i,17)*5), age:18+Math.floor(hash(i,19)*55),
      personality:personalities[i%personalities.length], activity:activities[i%activities.length],
      home:siteName(Math.floor(hash(i,21)*9999)), hunger:20+Math.floor(hash(i,23)*70),
      social:25+Math.floor(hash(i,25)*75), intelligence:60+Math.floor(hash(i,27)*40),
      skills:[jobs[i%jobs.length], i%2?'تجارت':'حل مسئله', i%3?'ارتباطات':'فناوری'], partnerId:i%7===0?((i+1)%220)+1:undefined, children:i%5, reputation:45+Math.floor(hash(i,31)*55), vehicle:['سدان','وانت','موتورسیکلت','دوچرخه','خودروی برقی'][i%5]
    });
  }
  return list;
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const agentsRef = useRef<Agent[]>(makeAgents());
  const economyStockRef = useRef<EconomyStock>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('agent-world-economy-stock-v1') || 'null');
      if (saved && ['food','materials','tools','medicine','knowledge','culture'].every(k => Number.isFinite(saved[k]) && saved[k] >= 0)) return saved as EconomyStock;
    } catch {}
    return {food:120,materials:35,tools:18,medicine:14,knowledge:20,culture:12};
  }) as React.MutableRefObject<EconomyStock>;
  const keys = useRef<Record<string,boolean>>({});
  const touch = useRef({active:false,x:0,y:0,startX:0,startY:0});
  const lookTouch = useRef({active:false,lastX:0,lastY:0});
  const [entered,setEntered] = useState(false);
  const [player,setPlayer] = useState<Player>(() => {
    try { const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); return v?.x !== undefined ? v : {x:0,y:0,angle:0}; }
    catch { return {x:0,y:0,angle:0}; }
  });
  const [selected,setSelected] = useState<Agent|null>(null);
  const [time,setTime] = useState(10.2);
  const [population,setPopulation] = useState(8200000000);
  const [economy,setEconomy] = useState(84);
  const [labels,setLabels] = useState(true);
  const [run,setRun] = useState(false);
  const [eventText,setEventText] = useState('یک شهرک جدید در حال توسعه است');
  const [chatOpen,setChatOpen] = useState(false);
  const [chatInput,setChatInput] = useState('');
  const [chatBusy,setChatBusy] = useState(false);
  const [chat,setChat] = useState<ChatMessage[]>([]);
  const [aiStatus,setAiStatus] = useState('هوش فعال');
  const [insideSite,setInsideSite] = useState<Site|null>(null);
  const [decision,setDecision] = useState('منتظر تصمیم بعدی');
  const [memoryCount,setMemoryCount] = useState(0);
  const [driving,setDriving] = useState(false);
  const [farmAction,setFarmAction] = useState('آماده برای کشاورزی');
  const [farmProgress,setFarmProgress] = useState(0);
  const [fuel,setFuel] = useState(100);
  const [hudOpen,setHudOpen] = useState(false);
  const [worldMapOpen,setWorldMapOpen] = useState(false);
  const [rallyTarget,setRallyTarget] = useState<{x:number;y:number}|null>(null);
  const [agentCommand,setAgentCommand] = useState('');
  const [mapTarget,setMapTarget] = useState<{x:number;y:number}|null>(null);
  const [construction,setConstruction] = useState<{active:boolean;progress:number;x:number;y:number;name:string;materials:{wood:number;steel:number;stone:number}}>(()=>{try{const saved=JSON.parse(localStorage.getItem('agent-world-construction-v1')||'null');return saved?{...saved,materials:saved.materials||{wood:0,steel:0,stone:0}}:{active:false,progress:0,x:0,y:0,name:'مرکز اجتماع',materials:{wood:0,steel:0,stone:0}};}catch{return {active:false,progress:0,x:0,y:0,name:'مرکز اجتماع',materials:{wood:0,steel:0,stone:0}};}});
  useEffect(()=>{try{localStorage.setItem('agent-world-construction-v1',JSON.stringify(construction));}catch{}},[construction]);
  useEffect(() => {
    const saveEconomyStock = () => {
      try { localStorage.setItem('agent-world-economy-stock-v1', JSON.stringify(economyStockRef.current)); } catch {}
    };
    const timer = window.setInterval(saveEconomyStock, 5000);
    window.addEventListener('pagehide', saveEconomyStock);
    return () => { window.clearInterval(timer); window.removeEventListener('pagehide', saveEconomyStock); saveEconomyStock(); };
  }, []);
  const premiumCanvasRef = useRef<HTMLCanvasElement>(null);
  const premiumStateRef = useRef({player,time,driving});
  premiumStateRef.current={player,time,driving};

  const nearbySites = useMemo(() => {
    const {cx,cy} = cellAt(player.x,player.y);
    const result:Site[] = [];
    for(let y=cy-6;y<=cy+6;y++) for(let x=cx-6;x<=cx+6;x++) {
      const s=siteAt(x,y); if(s) result.push(s);
    }
    return result;
    }, [player.x,player.y]);

  const nearestFarm = useMemo(() => {
    let best:Site|null=null,bd=Infinity;
    nearbySites.filter(s=>s.kind==='farm').forEach(s=>{const d=Math.hypot(s.x-player.x,s.y-player.y);if(d<bd){bd=d;best=s;}});
    return best && bd<260 ? best : null;
  },[nearbySites,player.x,player.y]);

  const summonAllAgents=()=>{
    setRallyTarget({x:player.x,y:player.y});
    setAgentCommand('همه بیایند');
    setSelected(null);setChatOpen(false);setHudOpen(true);
    setEventText('فرمان سراسری صادر شد؛ Agentهای شبیه‌سازی‌شده به سمت تو می‌آیند');
  };
  const commandAgents=(command:string)=>{
    setAgentCommand(command);
    if(['کمک در ساخت','ساخت خانه','ساخت مزرعه','ساخت کارخانه'].includes(command)){
      if(construction.active){setEventText('یک پروژه ساخت در حال اجراست؛ ابتدا همان پروژه را تکمیل کن');return;}
      const projectName=command==='ساخت خانه'?'خانه مسکونی':command==='ساخت مزرعه'?'مزرعه تولیدی':command==='ساخت کارخانه'?'کارخانه تولیدی':'مرکز اجتماع';
      const materialCost=command==='ساخت خانه'?14:command==='ساخت مزرعه'?15:command==='ساخت کارخانه'?28:21;
      if(economyStockRef.current.materials<materialCost){setEventText('مصالح اقتصادی کافی نیست؛ نیاز پروژه '+materialCost+' واحد است و موجودی '+Math.floor(economyStockRef.current.materials)+' واحد است. از سازندگان و راننده‌ها بخواه تولید کنند.');return;}
      economyStockRef.current={...economyStockRef.current,materials:economyStockRef.current.materials-materialCost};
      const target={x:player.x+18,y:player.y+18};
      setConstruction({active:true,progress:0,x:target.x,y:target.y,name:projectName,materials:{wood:0,steel:0,stone:0}});
      setRallyTarget(target);
      agentsRef.current.forEach(a=>{a.goal='کمک به ساخت '+projectName;a.activity='در حال رفتن به محل ساخت';});
      setEventText('پروژه «'+projectName+'» آغاز شد؛ ایجنت‌ها برای جمع‌آوری مصالح و ساخت فراخوانده شدند');
    }else if(command==='همه بیایند'||command==='محافظت کنید'){
      setRallyTarget({x:player.x,y:player.y});
      agentsRef.current.forEach(a=>{a.goal=command==='کمک در ساخت'?'کمک به ساخت‌وساز':command==='محافظت کنید'?'محافظت از فرمانده':'کمک به جامعه';a.activity='در حال اجرای فرمان: '+command;});
    }else if(command==='دنبال من بیایید'){
      setRallyTarget({x:player.x,y:player.y});
      agentsRef.current.forEach(a=>{a.goal='همراهی با فرمانده';a.activity='در حال دنبال کردن فرمانده';});
    }else if(command==='کنار من بمانید'){
      setRallyTarget({x:player.x,y:player.y});
      agentsRef.current.forEach(a=>{a.x=player.x+(Math.random()-.5)*36;a.y=player.y+(Math.random()-.5)*36;a.activity='در کنار فرمانده';a.mood='آماده کمک';});
    }else if(command==='پراکنده شوید'){
      setRallyTarget(null);
      agentsRef.current.forEach(a=>{a.vx=(Math.random()-.5)*2;a.vy=(Math.random()-.5)*2;a.activity='در حال بازگشت به فعالیت روزانه';});
    }else if(command==='تجارت کنید'){
      agentsRef.current.forEach(a=>{a.goal='تجارت و بهبود اقتصاد';a.activity='در حال بررسی فرصت‌های تجاری';a.wealth+=Math.round(Math.random()*12);});
      setEconomy(v=>Math.min(100,v+1));
    }
    setEventText('فرمان «'+command+'» برای Agentهای فعال شبیه‌سازی ثبت شد');
  };
  const jumpToMapTarget=()=>{
    if(!mapTarget)return;
    setPlayer(p=>({...p,x:mapTarget.x,y:mapTarget.y}));
    setRallyTarget(null);setEventText('به منطقه انتخاب‌شده روی کره جهان منتقل شدی');setWorldMapOpen(false);
  };
  const chooseGlobePoint=(e:React.PointerEvent<HTMLDivElement>)=>{
    const r=e.currentTarget.getBoundingClientRect();
    const nx=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
    const ny=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));
    setMapTarget({x:(nx-.5)*10400,y:(.5-ny)*5580});
  };
  const nearestSite = useMemo(() => {
    let best:Site|null=null,bd=Infinity;
    nearbySites.forEach(s=>{const d=Math.hypot(s.x-player.x,s.y-player.y);if(d<bd){bd=d;best=s;}});
    return best && bd<210 ? best : null;
  },[nearbySites,player.x,player.y]);

  useEffect(() => {
    if(!entered) return;
    let active=true;
    void api.get('/api/world/state').then(res=>{
      const s=res.data?.state;
      if(active&&s){if(s.player)setPlayer(s.player);if(typeof s.time==='number')setTime(s.time);if(typeof s.population==='number')setPopulation(s.population);if(typeof s.economy==='number')setEconomy(s.economy);}
    }).catch(()=>undefined);
    const save=setInterval(()=>{void api.post('/api/world/state',{player,time,population,economy}).catch(()=>undefined);},30000);
    return()=>{active=false;clearInterval(save);};
  },[entered]);

  useEffect(() => {
    const down=(e:KeyboardEvent)=>{
      keys.current[e.key.toLowerCase()]=true;
      if(e.key.toLowerCase()==='e') {
        let best:Agent|null=null,bd=Infinity;
        agentsRef.current.forEach(a=>{const d=Math.hypot(a.x-player.x,a.y-player.y);if(d<bd){bd=d;best=a;}});
        if(best){setSelected(best);setChat([]);setChatOpen(false);}
      }
      if(e.key.toLowerCase()==='f' && selected) setChatOpen(true);
    };
    const up=(e:KeyboardEvent)=>{keys.current[e.key.toLowerCase()]=false;};
    addEventListener('keydown',down); addEventListener('keyup',up);
    return()=>{removeEventListener('keydown',down);removeEventListener('keyup',up);};
  },[player.x,player.y,selected]);

  useEffect(()=>{localStorage.setItem(STORAGE_KEY,JSON.stringify(player));},[player]);

  useEffect(()=>{
    if(!rallyTarget)return;
    const id=setInterval(()=>{
      agentsRef.current.forEach(a=>{
        const dx=rallyTarget.x-a.x,dy=rallyTarget.y-a.y,d=Math.hypot(dx,dy);
        if(d>24){const step=Math.min(38,d*.06);a.x+=(dx/d)*step;a.y+=(dy/d)*step;a.activity='در حال حرکت به سمت فرمانده';a.mood='متمرکز';}
        else{a.vx*=.7;a.vy*=.7;a.activity='در کنار فرمانده';a.mood='آماده کمک';a.social=Math.min(100,a.social+.25);}
      });
    },80);
    return()=>clearInterval(id);
  },[rallyTarget]);

  useEffect(()=>{
    if(!construction.active)return;
    const requirements=construction.name.includes('مزرعه')?{wood:5,steel:2,stone:8}:construction.name.includes('کارخانه')?{wood:12,steel:10,stone:6}:construction.name.includes('خانه')?{wood:6,steel:3,stone:5}:{wood:8,steel:5,stone:8};
    const id=setInterval(()=>{
      const team=agentsRef.current.filter(a=>Math.hypot(a.x-construction.x,a.y-construction.y)<110);
      if(construction.progress>=100){
        setConstruction(prev=>({...prev,active:false,progress:100}));
        setRallyTarget(null);
        const isFarm=construction.name.includes('مزرعه'),isFactory=construction.name.includes('کارخانه'),isHouse=construction.name.includes('خانه');
        const outcome=isFarm?'محصول غذایی و افزایش ذخیره غذا':isFactory?'تولید صنعتی و فرصت شغلی':isHouse?'مسکن جدید برای ساکنان':'مرکز اجتماع جدید';
        setEventText('ساخت '+construction.name+' کامل شد؛ '+outcome+' · '+team.length+' ایجنت همکاری کردند');
        team.forEach(a=>{a.activity=isFarm?'رسیدگی به مزرعه تکمیل‌شده':isFactory?'کار در کارخانه تکمیل‌شده':isHouse?'استفاده از خانه جدید':'نگهداری مرکز اجتماع';a.goal=isFarm?'تولید و برداشت محصول':isFactory?'تولید کالا و استخدام':'نگهداری و استفاده از '+construction.name;a.reputation=Math.min(100,a.reputation+2);});
        setEconomy(e=>Math.min(100,e+(isFarm?3:isFactory?4:isHouse?1:2)));
        if(isFarm)setPopulation(p=>p+2);
        return;
      }
      const gatherRate=Math.min(3,team.length*.09);
      const hasMaterials=construction.materials.wood>=requirements.wood&&construction.materials.steel>=requirements.steel&&construction.materials.stone>=requirements.stone;
      setConstruction(prev=>{
        const materials=hasMaterials
          ?{wood:Math.max(0,prev.materials.wood-.18),steel:Math.max(0,prev.materials.steel-.12),stone:Math.max(0,prev.materials.stone-.18)}
          :{wood:Math.min(100,prev.materials.wood+gatherRate*.55),steel:Math.min(100,prev.materials.steel+gatherRate*.25),stone:Math.min(100,prev.materials.stone+gatherRate*.45)};
        const contribution=hasMaterials?Math.max(.15,Math.min(1.8,team.length*.09)):0;
        return {...prev,materials,progress:Math.min(100,prev.progress+contribution)};
      });
      team.forEach((a,i)=>{
        a.activity=hasMaterials?(i%3===0?'در حال ساخت سازه':i%3===1?'در حال حمل مصالح':'در حال هماهنگی ساخت'):(i%3===0?'جمع‌آوری چوب':i%3===1?'آماده‌سازی فولاد':'جمع‌آوری سنگ');
        a.goal=hasMaterials?'تکمیل '+construction.name:'جمع‌آوری مصالح برای '+construction.name;
        if(Math.random()<.15)a.energy=Math.max(5,a.energy-1);
      });
      if(team.length)setEventText(hasMaterials?'مصالح آماده است؛ '+team.length+' ایجنت در حال ساخت '+construction.name+' هستند':'تیم '+team.length+' ایجنتی در حال جمع‌آوری مصالح برای '+construction.name+' است');
    },1000);
    return()=>clearInterval(id);
  },[construction.active,construction.progress,construction.x,construction.y,construction.name,construction.materials]);
 
  useEffect(()=>{
    const id=setInterval(()=>{
      setTime(t=>(t+.035)%24);
      setPopulation(p=>p+(Math.random()>.82?1:0));
      const residents=agentsRef.current;
      const economyTick=runEconomyTick(residents,economyStockRef.current);
      economyStockRef.current=economyTick.stock;
      economyTick.agents.forEach(sim=>{
        const target=residents.find(a=>a.id===sim.id);
        if(target){target.activity=sim.activity;target.wealth=sim.wealth;target.energy=sim.energy;target.hunger=sim.hunger;target.mood=sim.mood;target.skills=sim.skills;}
      });
      let economyDelta=economyTick.economyDelta+(Math.random()-.5)*.08;
      let visibleEvent=economyTick.events[0]||'';
      const events=['بازار شهر فعال شد','چند Agent مهارت جدید یاد گرفتند','ساخت یک خانه جدید آغاز شد','کاروان تجاری بین دو منطقه حرکت کرد','یک مزرعه محصول تازه برداشت کرد','بیمارستان منطقه در حال خدمت‌رسانی است','یک Agent کسب‌وکار تازه‌ای شروع کرد'];
      residents.forEach((a,index)=>{
        a.energy=Math.max(5,Math.min(100,a.energy-.12+(a.activity==='در حال استراحت'?1.2:0)));
        a.hunger=Math.max(0,Math.min(100,a.hunger+.22));
        a.social=Math.max(0,Math.min(100,a.social+(Math.random()-.5)*1.2));
        // Agents make their own small daily decisions instead of only changing stats.
        if(Math.random()<.075){
          if(a.hunger>76){
            a.activity='در جست‌وجوی غذا';a.goal='تأمین غذا و نیازهای روزانه';a.hunger=Math.max(15,a.hunger-24);a.wealth=Math.max(0,a.wealth-8);a.mood='متمرکز';
          }else if(a.energy<28){
            a.activity='در حال استراحت';a.energy=Math.min(100,a.energy+18);a.mood='خسته';
          }else if(a.social<32){
            const friend=residents[(index+1+Math.floor(Math.random()*(residents.length-1)))%residents.length];
            a.activity='در حال گفت‌وگو با Agent #'+friend.id;a.social=Math.min(100,a.social+10);friend.social=Math.min(100,friend.social+5);
            a.mood='اجتماعی';friend.activity='گفت‌وگو با Agent #'+a.id;
          }else{
            const plans=['در حال کار روی مهارت '+a.skills[1],'در حال انجام وظیفه شغلی','در حال رفتن به بازار','در حال بررسی فرصت همکاری','در حال حرکت به سمت خانه'];
            a.activity=plans[Math.floor(Math.random()*plans.length)];
            if(a.activity==='در حال انجام وظیفه شغلی'){a.wealth+=3+Math.floor(a.intelligence/25);a.energy=Math.max(5,a.energy-2);economyDelta+=.018;}
            if(a.activity==='در حال کار روی مهارت '+a.skills[1] && !a.skills.includes('یادگیری مداوم'))a.skills.push('یادگیری مداوم');
            a.mood=a.personality.includes('اجتماعی')?'خوشحال':a.mood;
          }
          if(Math.random()<.12){visibleEvent='Agent #'+a.id+' تصمیم گرفت: '+a.activity;}
        }
        if(a.energy<15)a.mood='خسته';
        else if(a.hunger>85)a.mood='نگران';
        else if(a.social>82)a.mood='اجتماعی';
        if(a.hunger<55 && a.energy>35 && Math.random()<.3){a.wealth+=Math.max(0,Math.round((a.intelligence-70)*.02));}
        if(a.social>88 && a.reputation>65 && Math.random()<.004){a.children=Math.min(5,a.children+1);a.generation=Math.max(a.generation,2);}
        // Lightweight autonomous movement around the current neighborhood.
        if(!rallyTarget && Math.random()<.32){a.x+=a.vx*7+(Math.random()-.5)*3;a.y+=a.vy*7+(Math.random()-.5)*3;}
        if(Math.random()<.08){a.vx=Math.max(-.6,Math.min(.6,a.vx+(Math.random()-.5)*.22));a.vy=Math.max(-.6,Math.min(.6,a.vy+(Math.random()-.5)*.22));}
      });
      setEconomy(e=>Math.max(60,Math.min(100,e+economyDelta)));
      if(visibleEvent)setEventText(visibleEvent);
      else if(Math.random()<.35)setEventText(events[Math.floor(Math.random()*events.length)]);
    },2200);
    return()=>clearInterval(id);
  },[rallyTarget]);

  useEffect(()=>{
    if(!entered) return;
    const premium=premiumCanvasRef.current;
    if(!premium) return;
    return startPremiumWebGL(premium,premiumStateRef);
  },[entered]);

  useEffect(()=>{
    if(!entered) return;
    const canvas=canvasRef.current; if(!canvas) return;
    const ctx=canvas.getContext('2d'); if(!ctx) return;
    let raf=0,last=performance.now();
    const resize=()=>{const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.floor(innerWidth*dpr);canvas.height=Math.floor(innerHeight*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);};
    resize(); addEventListener('resize',resize);

    const project=(wx:number,wy:number,h:number)=>{
      const dx=wx-player.x,dy=wy-player.y;
      const ca=Math.cos(player.angle),sa=Math.sin(player.angle);
      const forward=dx*ca+dy*sa,side=-dx*sa+dy*ca;
      if(forward<2) return null;
      const focal=Math.min(innerWidth,innerHeight)*.98;
      const horizonShift=Math.sin(time*.12)*2;
      return {x:innerWidth/2 + side*focal/forward,y:innerHeight*.46 - (h*focal/forward)+horizonShift,d:forward};
    };

    const draw=(now:number)=>{
      const dt=Math.min(.05,(now-last)/1000);last=now;
      let forward=0,strafe=0;
      if(keys.current['w']||keys.current['arrowup']) forward+=1;
      if(keys.current['s']||keys.current['arrowdown']) forward-=1;
      if(keys.current['a']) strafe-=1;
      if(keys.current['d']) strafe+=1;
      if(keys.current['arrowleft']) setPlayer(p=>({...p,angle:p.angle-.018}));
      if(keys.current['arrowright']) setPlayer(p=>({...p,angle:p.angle+.018}));
      if(touch.current.active){forward += -touch.current.y;strafe += touch.current.x;}
      const length=Math.hypot(forward,strafe)||1;
      const speed=(driving?245:(run?170:82));
      if(driving) setFuel(v=>Math.max(0,v-Math.abs(forward)*dt*.9));
      if(driving && fuel<=0) setDriving(false);
      if(forward||strafe){
        const f=forward/length*speed*dt,s=strafe/length*speed*dt;
        setPlayer(p=>({...p,x:p.x+Math.cos(p.angle)*f-Math.sin(p.angle)*s,y:p.y+Math.sin(p.angle)*f+Math.cos(p.angle)*s}));
      }

      ctx.clearRect(0,0,innerWidth,innerHeight);
      const daylight=Math.max(.08,Math.sin(((time-6)/24)*Math.PI*2)*.5+.5);
      const sky=ctx.createLinearGradient(0,0,0,innerHeight*.58);
      sky.addColorStop(0,daylight>.5?'#5faee0':'#050b1c'); sky.addColorStop(.55,daylight>.5?'#c7e5e9':'#15233c'); sky.addColorStop(1,daylight>.5?'#e7dfbd':'#1b293d');
      ctx.fillStyle=sky;ctx.fillRect(0,0,innerWidth,innerHeight);
      const horizon=innerHeight*.46;
      const ground=ctx.createLinearGradient(0,horizon,0,innerHeight);
      ground.addColorStop(0,daylight>.5?'#567260':'#17252b');
      ground.addColorStop(.42,daylight>.5?'#334f3d':'#142a29');
      ground.addColorStop(1,daylight>.5?'#17291f':'#08151a');
      ctx.fillStyle=ground;ctx.fillRect(0,horizon,innerWidth,innerHeight-horizon);

      const mountainGrad=ctx.createLinearGradient(0,horizon-170,0,horizon+20);
      mountainGrad.addColorStop(0,daylight>.5?'#344b4a':'#101923');
      mountainGrad.addColorStop(1,daylight>.5?'#61746b':'#23333a');
      ctx.fillStyle=mountainGrad;
      ctx.beginPath();ctx.moveTo(0,horizon);
      for(let x=0;x<=innerWidth;x+=28){const yy=horizon-18-hash(Math.floor(x/28),12)*175;ctx.lineTo(x,yy);}
      ctx.lineTo(innerWidth,horizon);ctx.closePath();ctx.fill();
      ctx.fillStyle='rgba(210,225,222,.09)';
      ctx.beginPath();ctx.moveTo(0,horizon-24);for(let x=0;x<=innerWidth;x+=36){ctx.lineTo(x,horizon-30-hash(Math.floor(x/36),77)*90);}ctx.lineTo(innerWidth,horizon+5);ctx.lineTo(0,horizon+5);ctx.closePath();ctx.fill();

      const {cx,cy}=cellAt(player.x,player.y);
      const tiles:{cx:number;cy:number;d:number}[]=[];
      for(let yy=cy-8;yy<=cy+8;yy++) for(let xx=cx-8;xx<=cx+8;xx++){
        const centerX=xx*CELL+CELL/2,centerY=yy*CELL+CELL/2,d=Math.hypot(centerX-player.x,centerY-player.y);
        if(d<1250) tiles.push({cx:xx,cy:yy,d});
      }
      tiles.sort((a,b)=>b.d-a.d);
      for(const t of tiles){
        const x=t.cx*CELL,y=t.cy*CELL;
        const corners=[project(x,y,0),project(x+CELL,y,0),project(x+CELL,y+CELL,0),project(x,y+CELL,0)];
        if(corners.some(v=>!v)) continue;
        const b=biome(t.cx,t.cy);
        const colors:{[key:string]:string}={grass:daylight>.5?'#2f6548':'#17372f',forest:daylight>.5?'#1b5138':'#102d28',desert:daylight>.5?'#a38353':'#4b4032',water:daylight>.5?'#0f5772':'#0b3048',mountain:daylight>.5?'#56696a':'#2b3942'};
        ctx.fillStyle=colors[b];ctx.beginPath();ctx.moveTo(corners[0]!.x,corners[0]!.y);corners.slice(1).forEach(v=>ctx.lineTo(v!.x,v!.y));ctx.closePath();ctx.fill();
        if(b==='water'){
          const p=project(x+CELL*.5,y+CELL*.5,0);
          if(p&&p.d<1050){ctx.strokeStyle='rgba(123,225,240,.32)';ctx.lineWidth=1.5;for(let w=-1;w<=1;w++){ctx.beginPath();ctx.moveTo(p.x-30+w*12,p.y+w*7);ctx.lineTo(p.x+30+w*12,p.y+w*7);ctx.stroke();}}
        }
      }

      // Roads, lanes and roadside shoulders.
      for(let i=-6;i<=6;i++){
        const a=project(player.x-1050,player.y+i*CELL,0),b=project(player.x+1050,player.y+i*CELL,0);
        if(a&&b){
          ctx.strokeStyle='rgba(0,0,0,.24)';ctx.lineWidth=16;ctx.beginPath();ctx.moveTo(a.x,a.y+3);ctx.lineTo(b.x,b.y+3);ctx.stroke();
          ctx.strokeStyle=daylight>.5?'#303733':'#1a2020';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
          ctx.strokeStyle=daylight>.5?'rgba(224,202,153,.85)':'rgba(183,167,125,.55)';ctx.lineWidth=1.4;ctx.setLineDash([22,18]);ctx.beginPath();ctx.moveTo(a.x,a.y-1);ctx.lineTo(b.x,b.y-1);ctx.stroke();ctx.setLineDash([]);
        }
      }

      // Dense vegetation, rocks and roadside props.
      for(let gy=cy-8;gy<=cy+8;gy++) for(let gx=cx-8;gx<=cx+8;gx++){
        const b=biome(gx,gy); if(b==='water') continue;
        const density=b==='forest'?6:(b==='mountain'?2:1);
        for(let k=0;k<density;k++){
          const rx=gx*CELL+hash(gx*19+k,gy*7+k)*CELL,ry=gy*CELL+hash(gx*11+k,gy*17+k)*CELL;
          const base=project(rx,ry,0),top=project(rx,ry,b==='forest'?26+hash(gx+k,gy+k)*45:11+hash(gx+k,gy+k)*16);
          if(!base||!top||base.d>1000) continue;
          const r=Math.max(2,Math.min(15,680/base.d));
          const foliage=b==='forest'?(daylight>.5?'#173f2d':'#0d2a25'):b==='mountain'?(daylight>.5?'#4e5d58':'#303d42'):(daylight>.5?'#536d42':'#2e4737');
          ctx.fillStyle='rgba(0,0,0,.2)';ctx.beginPath();ctx.ellipse(base.x,base.y,r*1.15,r*.3,0,0,Math.PI*2);ctx.fill();
          ctx.fillStyle='#463a2b';ctx.fillRect(base.x-r*.11,top.y,r*.22,Math.max(2,base.y-top.y));
          ctx.fillStyle=foliage;ctx.beginPath();ctx.arc(top.x,top.y,r*1.5,0,Math.PI*2);ctx.fill();
          ctx.fillStyle='rgba(255,255,255,.08)';ctx.beginPath();ctx.arc(top.x-r*.35,top.y-r*.35,r*.5,0,Math.PI*2);ctx.fill();
        }
      }

      for(const s of nearbySites){
        const p=project(s.x,s.y,0); if(!p||p.d>1100||Math.abs(p.x)>innerWidth*1.2) continue;
        if(s.kind==='city'){
          const count=18+(s.seed%15);
          for(let i=0;i<count;i++){
            const ox=(hash(s.seed,i)-.5)*150,oy=(hash(s.seed,i+20)-.5)*150;
            const height=42+hash(s.seed,i+40)*145;
            const base=project(s.x+ox,s.y+oy,0),top=project(s.x+ox,s.y+oy,height);
            if(!base||!top) continue;
            const bw=Math.max(5,Math.min(92,1750/p.d*25)),bh=Math.max(4,base.y-top.y);
            const wall=ctx.createLinearGradient(base.x-bw/2,0,base.x+bw/2,0);
            wall.addColorStop(0,i%4===0?'#26333a':i%4===1?'#4a5960':i%4===2?'#66757a':'#38484f');wall.addColorStop(.5,'#8b999d');wall.addColorStop(1,'#202a30');
            ctx.fillStyle='rgba(0,0,0,.28)';ctx.fillRect(base.x-bw*.54,top.y+bh*.04,bw*1.08,bh);
            ctx.fillStyle=wall;ctx.fillRect(base.x-bw/2,top.y,bw,bh);
            ctx.fillStyle='rgba(205,220,222,.3)';ctx.beginPath();ctx.moveTo(base.x-bw/2,top.y);ctx.lineTo(base.x-bw*.28,top.y-bw*.12);ctx.lineTo(base.x+bw*.45,top.y-bw*.12);ctx.lineTo(base.x+bw/2,top.y);ctx.closePath();ctx.fill();
            const rows=Math.max(2,Math.min(9,Math.floor(bh/20))),cols=Math.max(2,Math.min(6,Math.floor(bw/12)));
            for(let ry=0;ry<rows;ry++) for(let cxw=0;cxw<cols;cxw++){
              const lit=hash(s.seed+i,ry*17+cxw)>(.48+(daylight>.5?.28:0));
              ctx.fillStyle=lit?'rgba(238,196,112,.72)':'rgba(12,24,31,.5)';
              ctx.fillRect(base.x-bw*.38+cxw*(bw*.76/cols),top.y+8+ry*(bh*.78/rows),Math.max(1.5,bw*.07),Math.max(2,bh*.055));
            }
          }
          if(labels&&p.d<760){ctx.fillStyle='rgba(255,255,255,.9)';ctx.font='600 12px Tahoma';ctx.textAlign='center';ctx.fillText(siteName(s.seed),p.x,p.y-24);}
        } else {
          const colors:{[key:string]:string}={farm:'#668f42',factory:'#5b6468',market:'#8b6f45',hospital:'#795b63',park:'#356448'};
          const size=Math.max(5,Math.min(36,900/p.d));
          ctx.fillStyle='rgba(0,0,0,.22)';ctx.fillRect(p.x-size*1.08,p.y-size*.48,size*2.16,size*.7);
          ctx.fillStyle=colors[s.kind];ctx.fillRect(p.x-size,p.y-size*.5,size*2,size);
          if(s.kind==='farm'){
            ctx.strokeStyle='rgba(205,182,117,.5)';ctx.lineWidth=Math.max(1,size*.07);for(let k=-4;k<=4;k++){ctx.beginPath();ctx.moveTo(p.x+k*size*.45,p.y-size*.42);ctx.lineTo(p.x+k*size*.45,p.y+size*.42);ctx.stroke();}
          }
          if(s.kind==='farm'){ctx.strokeStyle='#5d8c26';ctx.lineWidth=2;for(let k=-3;k<=3;k++){ctx.beginPath();ctx.moveTo(p.x+k*size*.45,p.y-size*.4);ctx.lineTo(p.x+k*size*.45,p.y+size*.4);ctx.stroke();}}
          if(s.kind==='hospital'){ctx.fillStyle='#fff';ctx.fillRect(p.x-size*.12,p.y-size*.35,size*.24,size*.7);ctx.fillRect(p.x-size*.35,p.y-size*.12,size*.7,size*.24);}
          if(labels&&p.d<560){ctx.fillStyle='#fff';ctx.font='10px Tahoma';ctx.textAlign='center';ctx.fillText(siteLabel(s.kind),p.x,p.y-size-7);}
        }
      }

      // Civilian vehicles, buses and delivery traffic.
      for(let i=0;i<34;i++){
        const lane=Math.floor(hash(i,101)*10)-5, dist=260+hash(i,103)*760;
        const wx=player.x+Math.cos(player.angle)*dist+Math.sin(player.angle)*lane*CELL*.55;
        const wy=player.y+Math.sin(player.angle)*dist-Math.cos(player.angle)*lane*CELL*.55;
        const p=project(wx,wy,4); if(!p||p.d>1000) continue;
        const size=Math.max(3,Math.min(18,900/p.d));
        ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.ellipse(p.x,p.y+size*.34,size*1.05,size*.3,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle=i%7===0?'#6f6b55':i%5===0?'#a8b0ad':i%3===0?'#49626a':'#252d32';
        ctx.beginPath();ctx.roundRect(p.x-size,p.y-size*.34,size*2,size*.68,size*.16);ctx.fill();
        ctx.fillStyle='rgba(160,205,213,.72)';ctx.beginPath();ctx.roundRect(p.x-size*.5,p.y-size*.25,size,size*.2,size*.05);ctx.fill();
        ctx.fillStyle='#11181c';ctx.beginPath();ctx.arc(p.x-size*.58,p.y+size*.37,size*.2,0,Math.PI*2);ctx.arc(p.x+size*.58,p.y+size*.37,size*.2,0,Math.PI*2);ctx.fill();
      }

      // Human-like agents with shadows, bodies, heads and varied clothing.
      agentsRef.current.forEach((a,i)=>{
        const target=nearbySites.length?nearbySites[(i+Math.floor(now/9000))%nearbySites.length]:null;
        if(target){a.vx+=(target.x-a.x)*.0000012*dt;a.vy+=(target.y-a.y)*.0000012*dt;}
        a.vx+=(hash(a.id,Math.floor(now/2500))-.5)*.018;a.vy+=(hash(a.id+3,Math.floor(now/2500))-.5)*.018;
        a.x+=a.vx*dt*50;a.y+=a.vy*dt*50;
        const p=project(a.x,a.y,13);if(!p||p.d>950||p.x<-40||p.x>innerWidth+40)return;
        const size=Math.max(3,Math.min(25,1000/p.d));
        ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.ellipse(p.x,p.y,size*.8,size*.25,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='rgba(0,0,0,.32)';ctx.beginPath();ctx.ellipse(p.x,p.y+size*.57,size*.7,size*.22,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle=['#33454a','#705e4c','#4b5058','#5d6655','#6b4e4e'][i%5];ctx.beginPath();ctx.roundRect(p.x-size*.34,p.y-size*.78,size*.68,size*1.02,size*.18);ctx.fill();
        ctx.fillStyle=['#c9926d','#b77955','#d2a07d','#9c664b'][i%4];ctx.beginPath();ctx.arc(p.x,p.y-size*1.02,size*.33,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='rgba(24,25,26,.9)';ctx.beginPath();ctx.arc(p.x,p.y-size*1.13,size*.34,Math.PI,Math.PI*2);ctx.fill();
        ctx.strokeStyle='rgba(28,32,33,.9)';ctx.lineWidth=Math.max(1,size*.1);ctx.beginPath();ctx.moveTo(p.x-size*.2,p.y-size*.02);ctx.lineTo(p.x-size*.32,p.y+size*.54);ctx.moveTo(p.x+size*.2,p.y-size*.02);ctx.lineTo(p.x+size*.32,p.y+size*.54);ctx.stroke();
        if(labels&&p.d<360){ctx.fillStyle='#fff';ctx.font='9px Tahoma';ctx.textAlign='center';ctx.fillText(names[(a.id-1)%names.length],p.x,p.y-size*1.55);}
      });

      const sunX=innerWidth*(.72-.22*Math.cos((time/24)*Math.PI*2)),sunY=innerHeight*(.14+.07*Math.sin((time/24)*Math.PI*2));
      const sun=ctx.createRadialGradient(sunX,sunY,0,sunX,sunY,Math.min(innerWidth,innerHeight)*.24);
      sun.addColorStop(0,daylight>.55?'rgba(255,244,190,.62)':'rgba(100,145,230,.2)');sun.addColorStop(1,'rgba(255,244,190,0)');
      ctx.fillStyle=sun;ctx.fillRect(0,0,innerWidth,innerHeight*.75);
      const haze=ctx.createLinearGradient(0,horizon-100,0,horizon+170);
      haze.addColorStop(0,'rgba(205,230,230,0)');haze.addColorStop(.5,'rgba(205,230,230,.13)');haze.addColorStop(1,'rgba(205,230,230,0)');
      ctx.fillStyle=haze;ctx.fillRect(0,horizon-100,innerWidth,270);
      ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(innerWidth/2-8,innerHeight/2);ctx.lineTo(innerWidth/2+8,innerHeight/2);ctx.moveTo(innerWidth/2,innerHeight/2-8);ctx.lineTo(innerWidth/2,innerHeight/2+8);ctx.stroke();
      const fog=ctx.createLinearGradient(0,horizon-40,0,innerHeight*.72);
      fog.addColorStop(0,'rgba(214,228,224,.11)');fog.addColorStop(.35,'rgba(180,205,198,.025)');fog.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=fog;ctx.fillRect(0,horizon-40,innerWidth,innerHeight*.72);
      const grade=ctx.createLinearGradient(0,0,innerWidth,innerHeight);
      grade.addColorStop(0,'rgba(4,12,18,.12)');grade.addColorStop(.55,'rgba(0,0,0,0)');grade.addColorStop(1,'rgba(0,0,0,.2)');ctx.fillStyle=grade;ctx.fillRect(0,0,innerWidth,innerHeight);
      const vig=ctx.createRadialGradient(innerWidth/2,innerHeight/2,Math.min(innerWidth,innerHeight)*.18,innerWidth/2,innerHeight/2,Math.max(innerWidth,innerHeight)*.72);
      vig.addColorStop(0,'rgba(0,0,0,0)');vig.addColorStop(.72,'rgba(0,0,0,.08)');vig.addColorStop(1,'rgba(0,0,0,.58)');ctx.fillStyle=vig;ctx.fillRect(0,0,innerWidth,innerHeight);
      raf=requestAnimationFrame(draw);
    };
    raf=requestAnimationFrame(draw);
    return()=>{cancelAnimationFrame(raf);removeEventListener('resize',resize);};
  },[entered,player.x,player.y,player.angle,time,run,labels,nearbySites]);

  const toggleVehicle=()=>{
    if(!driving && fuel<=3){setEventText('سوخت خودرو کم است');return;}
    setDriving(v=>!v);
    setEventText(driving?'از خودرو پیاده شدی':'سوار خودرو شدی؛ حالت رانندگی فعال است');
  };
  const farm=()=>{
    if(!nearestFarm){setFarmAction('به یک مزرعه نزدیک شو');return;}
    setFarmProgress(v=>{
      const next=Math.min(100,v+25);
      setFarmAction(next>=100?'محصول برداشت شد و آماده فروش است':'در حال کاشت و رسیدگی به محصول');
      if(next>=100){setEconomy(e=>Math.min(100,e+.4));setEventText('محصول تازه از مزرعه برداشت شد');}
      return next>=100?0:next;
    });
  };

  const turn=(dir:number)=>setPlayer(p=>({...p,angle:p.angle+dir*.12}));
  const move=(f:number,s:number)=>setPlayer(p=>({...p,x:p.x+Math.cos(p.angle)*f-Math.sin(p.angle)*s,y:p.y+Math.sin(p.angle)*f+Math.cos(p.angle)*s}));
  const nearest=useMemo(()=>{
    let best:Agent|null=null,bd=Infinity;
    agentsRef.current.forEach(a=>{const d=Math.hypot(a.x-player.x,a.y-player.y);if(d<bd){bd=d;best=a;}});
    return best;
  },[player.x,player.y]);

  const thinkAgent=async()=>{
    if(!selected)return;
    const agentForThink=selected;
    setAiStatus('در حال تصمیم‌گیری عمیق…');
    try{
      const res=await api.post('/api/agent/think',{agent:agentForThink,world:{time,location:biome(cellAt(player.x,player.y).cx,cellAt(player.x,player.y).cy),economy,population}});
      const d=res.data?.decision;
      if(!d)throw new Error('empty_agent_decision');
      const action=String(d.action||'تصمیم جدید');
      const mode=res.data?.mode==='cloud-ai'?'تصمیم هوش ابری':'تصمیم شبیه‌سازی محلی';
      setDecision(action+' · '+String(d.destination||'مقصد نامشخص')+' · '+mode);
      setSelected(a=>a?({...a,activity:action,mood:String(d.mood||a.mood),goal:String(d.socialIntent||a.goal),social:Math.min(100,Math.max(0,a.social+Number(d.expectedReward||0)))}):a);
      const liveAgent=agentsRef.current.find(a=>a.id===agentForThink.id);
      if(liveAgent){liveAgent.activity=action;liveAgent.mood=String(d.mood||liveAgent.mood);liveAgent.goal=String(d.socialIntent||liveAgent.goal);liveAgent.social=Math.min(100,Math.max(0,liveAgent.social+Number(d.expectedReward||0)));}
      setEventText('Agent #'+agentForThink.id+' تصمیم گرفت: '+action);
      setAiStatus(mode);
      void api.post('/api/agent/memory',{agentId:agentForThink.id,memory:'تصمیم: '+action+'؛ دلیل: '+String(d.reason||'')+'؛ مقصد: '+String(d.destination||''),importance:65}).then(()=>setMemoryCount(c=>c+1)).catch(()=>undefined);
    }catch{setAiStatus('خطا در تصمیم‌گیری؛ تلاش دوباره لازم است');}
  };

  const localAgentReply=(a:Agent,message:string)=>{
    const q=message.toLowerCase();
    if(/سلام|درود|خوبی/.test(q))return 'سلام! من '+names[(a.id-1)%names.length]+' هستم. امروز به‌عنوان '+a.job+' مشغول کارم و می‌خواهم '+a.goal+' را جلو ببرم. تو چه کمکی از من می‌خواهی؟';
    if(/کمک|بساز|ساخت|ساختمان/.test(q))return 'حتماً، آماده کمک هستم. با توجه به تجربه‌ام در '+a.job+' می‌توانم برای ساخت‌وساز برنامه بریزم، منابع لازم را بررسی کنم و با Agentهای دیگر هماهنگ شوم.';
    if(/کار|شغل|پول|درآمد|تجارت/.test(q))return 'این روزها به‌عنوان '+a.job+' کار می‌کنم. دارایی شبیه‌سازی‌شده‌ام '+a.wealth+' است و هدف بعدی‌ام '+a.goal+' است. به نظرم باید مهارت‌ها و تجارت محلی را گسترش بدهیم.';
    if(/خانواده|دوست|احساس|حال/.test(q))return 'حال من الان '+a.mood+' است و وضعیت اجتماعی‌ام '+Math.round(a.social)+' از ۱۰۰ است. شخصیت من '+a.personality+' است؛ دوست دارم با دیگران همکاری کنم.';
    if(/شهر|جهان|کجا|منطقه/.test(q))return 'من در شهر '+a.home+' زندگی می‌کنم. این جهان در حال تغییر است و هدف من '+a.goal+' است. می‌توانیم منطقه را بررسی کنیم و برای بهتر شدنش برنامه بچینیم.';
    return 'جالب است که درباره «'+message.slice(0,100)+'» می‌پرسی. از دید من که '+a.personality+' هستم و به‌عنوان '+a.job+' کار می‌کنم، بهتر است قدم‌به‌قدم بررسی کنیم. هدف فعلی‌ام '+a.goal+' است. دوست داری از کدام بخش شروع کنیم؟';
  };
  useEffect(() => {
    let active = true;
    const checkAI = async () => {
      try {
        const res = await api.get('/api/ai/status');
        if (!active) return;
        setAiStatus(res.data?.configured ? 'هوش ابری آماده' : 'هوش محلی فعال');
      } catch {
        if (active) setAiStatus('اتصال هوش بررسی‌نشده');
      }
    };
    void checkAI();
    const timer = window.setInterval(() => { void checkAI(); }, 60000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const sendChat=async()=>{
    if(!selected||!chatInput.trim()||chatBusy)return;
    const agentForReply = selected;
    const userText=chatInput.trim();setChatInput('');
    const next=[...chat,{role:'user' as const,content:userText}];setChat(next);setChatBusy(true);setAiStatus('در حال فکر کردن…');
    try{
      const res=await api.post('/api/agent/chat',{agent:agentForReply,messages:next,time,location:biome(cellAt(player.x,player.y).cx,cellAt(player.x,player.y).cy)});
      const reply=String(res.data?.reply||'');
      if(!reply.trim())throw new Error('empty_agent_reply');
      setChat(v=>[...v,{role:'assistant',content:reply}]);
      setAiStatus(res.data?.mode==='cloud-ai'?'پاسخ از هوش ابری':'پاسخ شبیه‌سازی محلی');
    }catch{
      setChat(v=>[...v,{role:'assistant',content:localAgentReply(agentForReply,userText)+' (پاسخ پشتیبان محلی؛ اتصال سرور یا هوش ابری خطا داد.)'}]);
      setAiStatus('پاسخ پشتیبان محلی');
    }finally{
      void api.post('/api/agent/memory',{agentId:agentForReply.id,memory:'کاربر گفت: '+userText,importance:72}).then(()=>setMemoryCount(c=>c+1)).catch(()=>undefined);
      setChatBusy(false);
    }
  };

  if(!entered) return <main className='landing'>
    <div className='landing-art'><div className='sun-glow'/><div className='mountain-art'/><div className='city-art'/><div className='river-art'/><div className='farm-art'/></div>
    <header className='landing-header'><div className='brand'><div className='brand-mark'><Globe2/><div className='brand-pulse'/></div><div><b>AGENT WORLD</b><span>دنیای زنده و هوشمند</span></div></div><div className='live'><i/> شبیه‌سازی در حال اجرا · AI CORE</div></header>
    <section className='landing-copy'><small>نسخه پیشرفته جهان هوشمند</small><h1>یک جهان زنده که فقط بازی نمی‌کند؛ زندگی می‌کند</h1><p>وارد جهان شو، راه برو، شهرها را ببین و با Agentهایی حرف بزن که شخصیت، هدف، حافظه مکالمه و وضعیت زندگی دارند. این فقط یک صفحه نمایشی نیست؛ هسته شبیه‌سازی برای رشد به یک دنیای عظیم‌تر طراحی شده است.</p><button onClick={()=>setEntered(true)}><Compass/> ورود به جهان</button></section>
    <div className='landing-cards'><div><Home/><b>زندگی</b><span>خانه، کار، غذا، سلامت و روابط</span></div><div><Factory/><b>اقتصاد</b><span>تولید، بازار، تجارت و شهرسازی</span></div><div><BrainCircuit/><b>هوش عمیق</b><span>شخصیت، هدف، حافظه و گفت‌وگو</span></div><div><Globe2/><b>جهان بزرگ</b><span>مناطق رویه‌ای و قابل گسترش</span></div></div>
  </main>;

  return <main className='world-shell'>
    <CinematicWorld playerX={player.x} playerY={player.y} angle={player.angle} time={time} constructionProgress={construction.progress} constructionX={construction.x} constructionY={construction.y} constructionName={construction.name} onLook={delta=>setPlayer(p=>({...p,angle:p.angle+delta}))} />
    <canvas ref={canvasRef} className='world-canvas' onPointerDown={e=>{if(e.clientX>innerWidth*.42){lookTouch.current={active:true,lastX:e.clientX,lastY:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);}}} onPointerMove={e=>{if(!lookTouch.current.active)return;const dx=e.clientX-lookTouch.current.lastX;setPlayer(p=>({...p,angle:p.angle+dx*.006}));lookTouch.current.lastX=e.clientX;lookTouch.current.lastY=e.clientY;}} onPointerUp={e=>{lookTouch.current.active=false;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}} onPointerCancel={()=>{lookTouch.current.active=false;}} />
    <canvas ref={premiumCanvasRef} className='premium-canvas' aria-hidden='true' />\n    <header className='hud topbar'><div className='brand'><div className='brand-mark'><Globe2 size={20}/></div><div><b>AGENT WORLD</b><span>یک تمدن زنده که خودش ادامه پیدا می‌کند</span></div></div><div className='stats'><span><Users/> {population.toLocaleString('fa-IR')}<small>جمعیت</small></span><span><Building2/> {nearbySites.filter(s=>s.kind==='city').length}<small>شهر نزدیک</small></span><span><Coins/> {Math.round(economy)}%<small>اقتصاد</small></span><span><BrainCircuit/> 220<small>Agent هوشمند</small></span></div><div className='top-actions'><button className='summon-btn' onClick={summonAllAgents}><Users/> همه Agentها</button><button className='map-btn' onClick={()=>setWorldMapOpen(v=>!v)}><Globe2/> کره جهان</button><button className='hud-toggle' onClick={()=>setHudOpen(v=>!v)} aria-label='نمایش کنترل‌ها'><SlidersHorizontal/> {hudOpen?'بستن پنل‌ها':'کنترل‌ها'}</button></div></header>
    {hudOpen&&construction.progress>0&&<section className='hud construction-panel'><div><b>🏗️ پروژه ساخت: {construction.name}</b><span>{construction.active?'ایجنت‌ها در حال همکاری هستند':'پروژه تکمیل شده'}</span></div><strong>{Math.floor(construction.progress).toLocaleString('fa-IR')}٪</strong><div className='construction-track'><i style={{width:construction.progress+'%'}}/></div><small>مصالح: چوب {Math.floor(construction.materials.wood)} · فولاد {Math.floor(construction.materials.steel)} · سنگ {Math.floor(construction.materials.stone)}</small><small>ابتدا مصالح جمع‌آوری می‌شود؛ سپس تیم ساخت را پیش می‌برد.</small></section>}
    {hudOpen&&<section className='hud command-panel'><div className='command-title'><Users/><b>فرماندهی Agentها</b><small>{agentCommand||'یک فرمان انتخاب کن'}</small></div><div className='command-grid'>{['همه بیایند','دنبال من بیایید','کنار من بمانید','پراکنده شوید','کمک در ساخت','ساخت خانه','ساخت مزرعه','ساخت کارخانه','محافظت کنید','تجارت کنید'].map(c=><button key={c} className={agentCommand===c?'active':''} onClick={()=>commandAgents(c)}>{c}</button>)}</div></section>}
    {worldMapOpen&&<section className='hud global-map'><header><div><Globe2/><div><b>نقشه زنده جهان</b><small>کره جهانی · روی هر نقطه بزن و سپس حرکت کن</small></div></div><button onClick={()=>setWorldMapOpen(false)}><X/></button></header><div className='globe-stage' onPointerDown={chooseGlobePoint}><div className='globe-sphere'><div className='globe-lat lat1'/><div className='globe-lat lat2'/><div className='globe-lon lon1'/><div className='globe-lon lon2'/><i className='land land1'/><i className='land land2'/><i className='land land3'/><i className='land land4'/></div><b className='globe-you'>تو</b>{mapTarget&&<b className='globe-target' style={{left:(50+mapTarget.x/208)+'%',top:(50-mapTarget.y/111.6)+'%'}}>●</b>}</div><div className='map-readout'><span>جمعیت شبیه‌سازی: <b>{population.toLocaleString('fa-IR')}</b></span><span>Agentهای فعال: <b>۲۲۰</b></span></div><button className='jump-map-btn' disabled={!mapTarget} onClick={jumpToMapTarget}><Navigation/> رفتن به نقطه انتخاب‌شده</button></section>}

    {nearestSite&&<button className='hud enter-place' onClick={()=>setInsideSite(nearestSite)}><Home/> ورود به {siteLabel(nearestSite.kind)} · {siteName(nearestSite.seed)}</button>}
    {insideSite&&<section className='hud interior'><button onClick={()=>setInsideSite(null)}><X/></button><div className='room-light'/><h2>{siteName(insideSite.seed)}</h2><p>{siteLabel(insideSite.kind)} · محیط داخلی تعاملی</p><div className='room'><div className='room-window'/><div className='room-table'/><div className='room-person'>●</div></div><span>اینجا نقطه شروع سیستم ساختمان‌های قابل ورود است؛ Agentها در این مکان‌ها کار، خرید، درمان و زندگی می‌کنند.</span></section>}
    {(hudOpen || driving) && <aside className='hud vehicle-panel'><div className='vehicle-icon'><Car/></div><div><b>{driving?'در حال رانندگی':'خودرو آماده'}</b><small>سوخت {Math.round(fuel)}%</small></div><button onClick={toggleVehicle}>{driving?'پیاده شدن':'سوار شدن'}</button></aside>}
    {hudOpen && nearestFarm&&<button className='hud farm-action' onClick={farm}><Wheat/> {farmAction} {farmProgress>0&&<b>{farmProgress}%</b>}</button>}
    {hudOpen && <aside className='hud world-panel'><h3><Sparkles/> وضعیت جهان</h3><div className='event'><i/> {eventText}</div><p>منطقه: <b>{biome(cellAt(player.x,player.y).cx,cellAt(player.x,player.y).cy)==='water'?'آب':biome(cellAt(player.x,player.y).cx,cellAt(player.x,player.y).cy)==='forest'?'جنگل':'سرزمین'}</b></p><p>مختصات: <b>{Math.round(player.x)} / {Math.round(player.y)}</b></p><div className='resource-grid'><span>🍎 غذا <b>{Math.floor(economyStockRef.current.food).toLocaleString('fa-IR')}</b></span><span>🪵 مصالح <b>{Math.floor(economyStockRef.current.materials).toLocaleString('fa-IR')}</b></span><span>🛠 ابزار <b>{Math.floor(economyStockRef.current.tools).toLocaleString('fa-IR')}</b></span><span>💊 دارو <b>{Math.floor(economyStockRef.current.medicine).toLocaleString('fa-IR')}</b></span><span>📚 دانش <b>{Math.floor(economyStockRef.current.knowledge).toLocaleString('fa-IR')}</b></span><span>🎭 فرهنگ <b>{Math.floor(economyStockRef.current.culture).toLocaleString('fa-IR')}</b></span></div><div className='panel-buttons'><button onClick={()=>setLabels(v=>!v)}><Eye/> {labels?'برچسب‌ها':'بدون برچسب'}</button><button onClick={()=>setRun(v=>!v)}><Navigation/> {run?'دویدن':'راه رفتن'}</button></div></aside>}
    {hudOpen && <aside className='hud minimap'><h3><Map/> نقشه</h3><div className='map-world'><div className='map-ocean'/>{nearbySites.filter(s=>s.kind==='city').map(s=><i key={s.seed} style={{left:(50+(s.x-player.x)/40)+'%',top:(50+(s.y-player.y)/40)+'%'}}/>)}<b/></div><small>جهان رویه‌ای · قابل گسترش</small></aside>}
    {hudOpen && <div className='hud activity'><Radio/> <span>فید زنده</span><b>{eventText}</b></div>}
    {selected&&<aside className='hud agent-card'><button className='close' onClick={()=>{setSelected(null);setChatOpen(false);}}><X/></button><div className='agent-avatar'>{selected.id%10}</div><h3>{names[(selected.id-1)%names.length]} · Agent #{selected.id}</h3><span>{selected.job} · {selected.mood}</span><p>هدف: <b>{selected.goal}</b></p><p>شخصیت: <b>{selected.personality}</b></p><p>فعالیت: <b>{selected.activity}</b></p><p>سن / نسل: <b>{selected.age} / {selected.generation}</b></p><p>خانواده: <b>{selected.children} فرزند · {selected.partnerId?'رابطه فعال':'مجرد'}</b></p><p>وسیله: <b>{selected.vehicle}</b></p><p>اعتبار: <b>{selected.reputation}%</b></p><p>ثروت: <b>{selected.wealth.toLocaleString('fa-IR')}</b></p><div className='brain-row'><span><BrainCircuit/> هوش {selected.intelligence}%</span><span><Heart/> اجتماعی {Math.round(selected.social)}%</span></div><div className='meter'><i style={{width:Math.max(8,selected.intelligence)+'%'}}/></div><div className='agent-actions'><button className='talk-btn' onClick={()=>setChatOpen(true)}><MessageCircle/> گفت‌وگو</button><button className='think-btn' onClick={()=>void thinkAgent()}><Zap/> تصمیم هوشمند</button></div><small className='decision-text'>{decision} · {memoryCount} خاطره ثبت‌شده</small></aside>}
    {chatOpen&&selected&&<section className='hud chat-panel'><header><div><MessageCircle/><div><b>گفت‌وگو با {names[(selected.id-1)%names.length]}</b><small>{aiStatus} · Agent #{selected.id} · حافظه فعال</small></div></div><button onClick={()=>setChatOpen(false)}><X/></button></header><div className='chat-body'>{chat.length===0&&<div className='chat-welcome'><BrainCircuit/><b>ذهن {names[(selected.id-1)%names.length]} آماده است</b><span>درباره زندگی، کار، شهر، هدف‌ها یا اتفاقات جهان سؤال کن.</span><div className='chat-suggestions'>{['سلام، حالت چطوره؟','امروز چه برنامه‌ای داری؟','می‌توانی کمکم کنی؟'].map(q=><button key={q} onClick={()=>setChatInput(q)}>{q}</button>)}</div></div>}{chat.map((m,i)=><div className={'bubble '+m.role} key={i}>{m.content}</div>)}{chatBusy&&<div className='bubble assistant thinking'><Sparkles/> در حال فکر کردن…</div>}</div><div className='chat-input'><input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void sendChat();}} placeholder='پیامت را بنویس…'/><button onClick={()=>void sendChat()} disabled={chatBusy||!chatInput.trim()}><Send/></button></div></section>}
    <div className='mobile-joystick' onPointerDown={e=>{touch.current.active=true;touch.current.startX=e.clientX;touch.current.startY=e.clientY;e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(!touch.current.active)return;const max=54;const dx=Math.max(-max,Math.min(max,e.clientX-touch.current.startX));const dy=Math.max(-max,Math.min(max,e.clientY-touch.current.startY));touch.current.x=dx/max;touch.current.y=dy/max;}} onPointerUp={e=>{touch.current.active=false;touch.current.x=0;touch.current.y=0;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}} onPointerCancel={()=>{touch.current.active=false;touch.current.x=0;touch.current.y=0;}}><div className='joystick-knob' style={{transform:`translate(${touch.current.x*42}px,${touch.current.y*42}px)`}}/></div><div className='camera-zone'><span>برای چرخاندن دوربین بکش</span></div><section className='controls'><button className='move-up' onClick={()=>move(55,0)}><ChevronUp/></button><div><button onClick={()=>turn(-1)}><ChevronLeft/></button><button onClick={()=>move(-45,0)}><ChevronDown/></button><button onClick={()=>turn(1)}><ChevronRight/></button></div></section>
    <div className='hud hint'><span>{time>6&&time<18?<Sun size={14}/>:<Moon size={14}/>}</span> WASD حرکت · A/D حرکت جانبی · ←/→ چرخش · E انتخاب Agent · F گفت‌وگو · خودرو: رانندگی · نزدیک مزرعه: کشاورزی</div>
    {nearest&&<button className='hud quick-talk' onClick={()=>{setSelected(nearest);setChat([]);setChatOpen(true);}}><MessageCircle/> نزدیک‌ترین ذهن: {names[(nearest.id-1)%names.length]}</button>}
  </main>;
}
export default App;