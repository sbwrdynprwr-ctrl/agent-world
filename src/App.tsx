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
  intelligence:number; skills:string[]; partnerId?:number; children:number; reputation:number; vehicle:string; targetX?:number; targetY?:number;
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
function isBuildingBlocked(x:number,y:number,originX:number,originY:number,radius:number) {
  const size=180, roadX=Math.round(originX/60)*60, roadY=Math.round(originY/60)*60;
  const cx=Math.floor(x/size), cy=Math.floor(y/size);
  for(let gx=cx-2;gx<=cx+2;gx++) for(let gy=cy-2;gy<=cy+2;gy++) {
    const seed=gx*97+gy*131;
    if(hash(seed,7)<=.28) continue;
    for(let i=0;i<3;i++) {
      const bx=(gx+.5)*size+(hash(seed,i)-.5)*110;
      const by=(gy+.5)*size+(hash(seed,i+10)-.5)*110;
      if(!(Math.abs(bx-roadX)>25&&Math.abs(by-roadY)>25)) continue;
      const w=13+hash(seed+i,2)*13, d=13+hash(seed+i,3)*12;
      if(Math.abs(x-bx)<w/2+radius&&Math.abs(y-by)<d/2+radius) return true;
    }
  }
  return false;
}
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
function agentTarget(a:Agent,preferred?:Site['kind'][]){
  const kinds=preferred|| (a.job==='کشاورز'?['farm']:a.job==='تاجر'?['market']:a.job==='پزشک'?['hospital']:a.job==='مهندس'||a.job==='معمار'||a.job==='سازنده'?['city','factory']:['park','market','city']);
  const cx=Math.floor(a.x/CELL),cy=Math.floor(a.y/CELL);let best:Site|null=null,bd=Infinity;
  for(let y=cy-4;y<=cy+4;y++)for(let x=cx-4;x<=cx+4;x++){const s=siteAt(x,y);if(!s||!kinds.includes(s.kind))continue;const d=Math.hypot(s.x-a.x,s.y-a.y);if(d<bd){bd=d;best=s;}}
  return best?{x:best.x,y:best.y}:{x:a.x+(hash(a.id,Math.floor(a.x/40)+7)-.5)*100,y:a.y+(hash(a.id,Math.floor(a.y/40)+13)-.5)*100};
}
function siteLabel(kind:Site['kind']) {
  return {city:'شهر',farm:'مزرعه',factory:'کارخانه',market:'بازار',hospital:'بیمارستان',park:'پارک'}[kind];
}
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
  const agentsRef = useRef<Agent[]>(makeAgents());
  const economyStockRef = useRef<EconomyStock>((() => {
    try {
      const saved = JSON.parse(localStorage.getItem('agent-world-economy-stock-v1') || 'null');
      if (saved && ['food','materials','tools','medicine','knowledge','culture'].every(k => Number.isFinite(saved[k]) && saved[k] >= 0)) return saved as EconomyStock;
    } catch {}
    return {food:120,materials:35,tools:18,medicine:14,knowledge:20,culture:12};
  })());
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
        // Agents now travel toward real simulated destinations instead of only jittering in place.
        if(!rallyTarget && Number.isFinite(a.targetX) && Number.isFinite(a.targetY)){
          const dx=(a.targetX as number)-a.x,dy=(a.targetY as number)-a.y,d=Math.hypot(dx,dy);
          if(d>9){a.vx=dx/d*.42;a.vy=dy/d*.42;a.x+=a.vx*5.5;a.y+=a.vy*5.5;}
          else{a.x=a.targetX as number;a.y=a.targetY as number;a.vx=0;a.vy=0;a.targetX=undefined;a.targetY=undefined;if(a.activity.includes('مسیر'))a.activity='در حال انجام وظیفه شغلی';}
        }else if(!rallyTarget && Math.random()<.24){
          if(Math.hypot(a.vx,a.vy)<.04){const t=agentTarget(a);a.targetX=t.x;a.targetY=t.y;a.activity='در مسیر '+(a.job==='کشاورز'?'مزرعه':a.job==='تاجر'?'بازار':'مقصد کاری');}
          a.x+=a.vx*6+(Math.random()-.5)*.8;a.y+=a.vy*6+(Math.random()-.5)*.8;
        }
        if(Math.random()<.05 && !Number.isFinite(a.targetX)){const t=agentTarget(a);a.targetX=t.x;a.targetY=t.y;}
      });
      setEconomy(e=>Math.max(60,Math.min(100,e+economyDelta)));
      if(visibleEvent)setEventText(visibleEvent);
      else if(Math.random()<.35)setEventText(events[Math.floor(Math.random()*events.length)]);
    },2200);
    return()=>clearInterval(id);
  },[rallyTarget]);

  const fuelRef=useRef(100);
  useEffect(()=>{
    if(!entered)return;
    let raf=0,last=performance.now();
    const tick=(now:number)=>{
      const dt=Math.min(.05,(now-last)/1000);last=now;
      let forward=0,strafe=0;
      if(keys.current['w']||keys.current['arrowup'])forward+=1;
      if(keys.current['s']||keys.current['arrowdown'])forward-=1;
      if(keys.current['a'])strafe-=1;
      if(keys.current['d'])strafe+=1;
      if(keys.current['arrowleft'])setPlayer(p=>({...p,angle:p.angle-.018}));
      if(keys.current['arrowright'])setPlayer(p=>({...p,angle:p.angle+.018}));
      if(touch.current.active){forward+=-touch.current.y;strafe+=touch.current.x;}
      const length=Math.hypot(forward,strafe)||1;
      if(driving&&Math.abs(forward)>0){
        fuelRef.current=Math.max(0,fuelRef.current-Math.abs(forward)*dt*.9);
        setFuel(Math.floor(fuelRef.current));
        if(fuelRef.current<=0)setDriving(false);
      }
      if(forward||strafe){
        const speed=driving?245:(run?170:82);
        const f=forward/length*speed*dt,s=strafe/length*speed*dt;
        setPlayer(p=>{
          const dx=Math.cos(p.angle)*f-Math.sin(p.angle)*s;
          const dy=Math.sin(p.angle)*f+Math.cos(p.angle)*s;
          const radius=driving?4.2:2.3;
          const nextX=p.x+dx,nextY=p.y+dy;
          const xBlocked=isBuildingBlocked(nextX,p.y,p.x,p.y,radius);
          const safeX=xBlocked?p.x:nextX;
          const yBlocked=isBuildingBlocked(safeX,nextY,p.x,p.y,radius);
          return {...p,x:safeX,y:yBlocked?p.y:nextY};
        });
      }
      raf=requestAnimationFrame(tick);
    };
    raf=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(raf);
  },[entered,driving,run]);

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
      if(liveAgent){
        liveAgent.activity=action;liveAgent.mood=String(d.mood||liveAgent.mood);liveAgent.goal=String(d.socialIntent||liveAgent.goal);liveAgent.social=Math.min(100,Math.max(0,liveAgent.social+Number(d.expectedReward||0)));
        const lower=action.toLowerCase();
        const preferred:Site['kind'][]=/غذا|خوراک|مزرعه/.test(lower)?['farm','market']:/گفت.?وگو|دوست|اجتماع/.test(lower)?['park','market','city']:/درمان|بیمار|سلامت/.test(lower)?['hospital']:/تجارت|بازار|فروش/.test(lower)?['market']:/ساخت|سازه|خانه/.test(lower)?['city','factory']:[];
        const target=agentTarget(liveAgent,preferred.length?preferred:undefined);liveAgent.targetX=target.x;liveAgent.targetY=target.y;
        if(/غذا|خوراک/.test(lower))liveAgent.hunger=Math.max(10,liveAgent.hunger-18);
        if(/گفت.?وگو|دوست|اجتماع/.test(lower))liveAgent.social=Math.min(100,liveAgent.social+8);
      }
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
    <CinematicWorld playerX={player.x} playerY={player.y} angle={player.angle} time={time} constructionProgress={construction.progress} constructionX={construction.x} constructionY={construction.y} constructionName={construction.name} agents={agentsRef.current.map(a=>({id:a.id,x:a.x,y:a.y,vx:a.vx,vy:a.vy,activity:a.activity,mood:a.mood,job:a.job}))} onLook={delta=>setPlayer(p=>({...p,angle:p.angle+delta}))} />
    \n    <header className='hud topbar'><div className='brand'><div className='brand-mark'><Globe2 size={20}/></div><div><b>AGENT WORLD</b><span>یک تمدن زنده که خودش ادامه پیدا می‌کند</span></div></div><div className='stats'><span><Users/> {population.toLocaleString('fa-IR')}<small>جمعیت</small></span><span><Building2/> {nearbySites.filter(s=>s.kind==='city').length}<small>شهر نزدیک</small></span><span><Coins/> {Math.round(economy)}%<small>اقتصاد</small></span><span><BrainCircuit/> 220<small>Agent هوشمند</small></span></div><div className='top-actions'><button className='summon-btn' onClick={summonAllAgents}><Users/> همه Agentها</button><button className='map-btn' onClick={()=>setWorldMapOpen(v=>!v)}><Globe2/> کره جهان</button><button className='hud-toggle' onClick={()=>setHudOpen(v=>!v)} aria-label='نمایش کنترل‌ها'><SlidersHorizontal/> {hudOpen?'بستن پنل‌ها':'کنترل‌ها'}</button></div></header>
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