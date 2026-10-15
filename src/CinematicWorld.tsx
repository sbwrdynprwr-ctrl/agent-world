import {useEffect,useRef} from 'react';
import * as THREE from 'three';

type AgentVisual={id:number;x:number;y:number;vx:number;vy:number;activity:string;mood:string;job:string};
type Props={playerX:number;playerY:number;angle:number;onMoveTarget:(target:{x:number;y:number})=>void;time:number;constructionProgress:number;constructionX:number;constructionY:number;constructionName:string;agents:AgentVisual[];onLook:(delta:number)=>void};

const CELL=180;
const RANGE=2;
const WORLD_SIZE=CELL*(RANGE*2+1);

const hash=(a:number,b:number)=>{
  const s=Math.sin(a*127.1+b*311.7+91.7)*43758.5453;
  return s-Math.floor(s);
};

const mat=(color:number,roughness=.55,metalness=.08,clearcoat=0)=>{
  return new THREE.MeshPhysicalMaterial({color,roughness,metalness,clearcoat,clearcoatRoughness:.12,envMapIntensity:1.15});
};

const glow=(color:number,intensity=2)=>{
  return new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:intensity,roughness:.28,metalness:.15});
};

function box(root:THREE.Group,w:number,h:number,d:number,color:number,x:number,y:number,z:number,material?:THREE.Material){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material||mat(color));
  m.position.set(x,y,z);
  m.castShadow=true;
  m.receiveShadow=true;
  root.add(m);
  return m;
}

function addBuilding(root:THREE.Group,x:number,z:number,seed:number){
  const hgt=22+hash(seed,1)*78;
  const w=13+hash(seed,2)*13;
  const d=13+hash(seed,3)*12;
  const base=[0x9b9a91,0xb3a58f,0x697b83,0xc1b9a8,0x7e8985,0x8b7770][Math.abs(seed)%6];
  box(root,w,hgt,d,base,x,hgt/2,z,mat(base,.78,.08,.04));
  box(root,w*1.05,.65,d*1.05,0x111a20,x,hgt+.32,z,mat(0x111a20,.35,.7,.2));
  const glass=mat(0x4e7786,.16,.42,.28);
  const rows=Math.floor(hgt/4);
  const cols=Math.max(2,Math.floor(w/3.2));
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      if((r+c+seed)%6===0) continue;
      const wx=x-w*.34+c*(w*.68/Math.max(1,cols-1));
      const wy=2.4+r*3.65;
      const win=box(root,1.18,1.05,.10,0x5bd9ee,wx,wy,z-d/2-.045,glass);
      if((r+c+seed)%3===0){
        (win.material as THREE.MeshPhysicalMaterial).emissive.set(0x45d9ff);
        (win.material as THREE.MeshPhysicalMaterial).emissiveIntensity=.45;
      }
    }
  }
  for(let r=0;r<Math.min(10,rows);r++){
    const win=box(root,.08,.72,.95,0x54c9dd,x+w/2+.045,2.4+r*3.65,z,glass);
    (win.material as THREE.MeshPhysicalMaterial).emissive.set(0x32b9d6);
    (win.material as THREE.MeshPhysicalMaterial).emissiveIntensity=.28;
  }
  const crown=box(root,w*.55,1.1,d*.55,0x4b5558,x,hgt+.95,z,mat(0x4b5558,.72,.18,.04));
  crown.rotation.y=hash(seed,8)*Math.PI;
  const antenna=new THREE.Mesh(new THREE.CylinderGeometry(.09,.16,5,10),mat(0x5c6263,.62,.5));
  antenna.position.set(x,hgt+5.8,z);
  root.add(antenna);
}

function addTower(root:THREE.Group,x:number,z:number,seed:number){
  const hgt=70+hash(seed,4)*75;
  const r=7+hash(seed,5)*6;
  const tower=new THREE.Mesh(new THREE.CylinderGeometry(r*.78,r,hgt,28),mat(0x687477,.72,.18,.08));
  tower.position.set(x,hgt/2,z);
  tower.castShadow=true;
  root.add(tower);
  const ringMat=mat(0x879294,.58,.32,.04);
  for(let y=8;y<hgt;y+=7){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(r*1.01,.09,8,28),ringMat);
    ring.rotation.x=Math.PI/2;
    ring.position.set(x,y,z);
    root.add(ring);
  }
  const cap=box(root,r*1.2,1.2,r*1.2,0x162a33,x,hgt+.6,z,mat(0x162a33,.2,.7,.3));
  cap.rotation.y=.25;
  const beacon=new THREE.PointLight(0x43ddff,7,65);
  beacon.position.set(x,hgt+3,z);
  root.add(beacon);
}

function addTree(root:THREE.Group,x:number,z:number,s:number,seed:number){
  const g=new THREE.Group();
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.16*s,.28*s,2.8*s,12),mat(0x493322,.92,.02));
  trunk.position.y=1.4*s;
  trunk.castShadow=true;
  g.add(trunk);
  const crownMat=mat([0x285c35,0x367545,0x477e43,0x2f6840,0x5c8144][Math.abs(seed)%5],.9,.01);
  for(let i=0;i<4;i++){
    const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(1.08*s,2),crownMat);
    crown.position.set((i-1.5)*.45*s,2.8*s+i*.16*s,Math.sin(i*1.7)*.35*s);
    crown.castShadow=true;
    g.add(crown);
  }
  g.position.set(x,0,z);
  root.add(g);
}

function addStreet(root:THREE.Group,x:number,z:number,vertical:boolean){
  const roadW=15;
  box(root,vertical?roadW:WORLD_SIZE,.2,vertical?WORLD_SIZE:roadW,0x343a3b,x,.02,z,mat(0x343a3b,.99,.0));
  const curb=mat(0x9ba5a5,.78,.08);
  const sidewalk=mat(0x68777a,.88,.04);
  for(const side of [-1,1]){
    box(root,vertical?3.8:WORLD_SIZE,.34,vertical?WORLD_SIZE:3.8,0x8b918d,x+(vertical?side*9.5:0),.17,z+(vertical?0:side*9.5),sidewalk);
    box(root,vertical?.34:WORLD_SIZE,.38,vertical?WORLD_SIZE:.34,0xb5bcb9,x+(vertical?side*6.55:0),.19,z+(vertical?0:side*6.55),curb);
    box(root,vertical?.08:WORLD_SIZE,.035,vertical?WORLD_SIZE:.08,0xe9dfb2,x+(vertical?side*2.8:0),.135,z+(vertical?0:side*2.8),mat(0x394348,.98,.01));
  }
  for(let i=-3;i<=3;i++){
    box(root,vertical?.09:11,.035,vertical?11:.09,0xd6d8d2,x+(vertical?0:i*23),.14,z+(vertical?i*23:0),mat(0xd6d8d2,.9,.02));
  }
  for(const cross of [-1,1])for(let i=-2;i<=2;i++){
    box(root,vertical?3.6:1.1,.045,vertical?1.1:3.6,0xe9efeb,x+(vertical?cross*0:i*2.1),.16,z+(vertical?i*2.1:cross*0),mat(0xe9efeb,.9,.01));
  }
}

function addCar(root:THREE.Group,x:number,z:number,seed:number,axis:'x'|'z'){
  const g=new THREE.Group();
  const paint=mat(new THREE.Color().setHSL(hash(seed,1),.62,.36),.16,.82,.35);
  const body=box(g,5.8,1,2.25,0x27343a,0,.85,0,paint);
  body.castShadow=true;
  box(g,3.2,.85,1.7,0x10232b,0,1.48,-.05,mat(0x10232b,.06,.4,.55));
  for(const sx of[-.92,.92])for(const sz of[-1.7,1.7]){
    const w=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.32,18),mat(0x07090b,.98,.02));
    w.rotation.x=Math.PI/2;
    w.position.set(sz,.45,sx);
    g.add(w);
  }
  box(g,.16,.18,.52,0xfff0c2,2.9,.9,-.7,glow(0xffe5a3,1.4));
  box(g,.16,.18,.52,0xfff0c2,2.9,.9,.7,glow(0xffe5a3,1.4));
  box(g,.12,.16,.38,0xe4483f,-2.92,.9,-.68,glow(0xe4483f,.55));
  box(g,.12,.16,.38,0xe4483f,-2.92,.9,.68,glow(0xe4483f,.55));
  g.position.set(x,.1,z);
  g.rotation.y=axis==='z'?Math.PI/2:0;
  g.userData={phase:hash(seed,8)*6.28,speed:5+hash(seed,9)*2.5,axis,originX:x,originZ:z,wheels:g.children.filter(o=>o instanceof THREE.Mesh && (o.geometry as THREE.CylinderGeometry).type==='CylinderGeometry')};
  root.add(g);
}

function addAgent(root:THREE.Group,x:number,z:number,seed:number,axis:'x'|'z'){
  const g=new THREE.Group();
  const s=.9+hash(seed,1)*.22;
  const skin=mat([0xb97855,0xd09a75,0x8d5d45,0xe0ad83][seed%4],.8,.02);
  const shirt=mat([0x355c67,0x704f3b,0x394c62,0x4c684e][seed%4],.6,.05,.12);
  const pants=mat([0x182530,0x243746,0x3a2e29][seed%3],.78,.04);
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.31*s,.68*s,8,14),shirt);
  torso.position.y=1.02*s;torso.castShadow=true;g.add(torso);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.105*s,.12*s,.18*s,12),skin);
  neck.position.y=1.58*s;g.add(neck);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.29*s,28,22),skin);
  head.position.y=1.8*s;head.castShadow=true;g.add(head);
  const eyeMat=mat(0x171b20,.35,.02);
  for(const side of[-1,1]){
    const eye=new THREE.Mesh(new THREE.SphereGeometry(.035*s,10,8),eyeMat);
    eye.position.set(side*.105*s,1.82*s,-.258*s);g.add(eye);
  }
  const nose=new THREE.Mesh(new THREE.SphereGeometry(.045*s,10,8),skin);
  nose.position.set(0,1.75*s,-.28*s);g.add(nose);
  const hair=new THREE.Mesh(new THREE.SphereGeometry(.30*s,18,14),mat(seed%2?0x171414:0x482c1e,.9,.01));
  hair.scale.y=.5;hair.position.y=1.98*s;g.add(hair);
  for(const side of[-1,1]){
    const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.085*s,.55*s,7,10),shirt);
    arm.position.set(side*.37*s,1.12*s,0);arm.name='arm'+side;g.add(arm);
    const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.105*s,.65*s,7,10),pants);
    leg.position.set(side*.15*s,.48*s,0);leg.name='leg'+side;g.add(leg);
    const shoe=box(g,.25*s,.12*s,.45*s,0x0a1015,side*.15*s,.11*s,-.08,mat(0x0a1015,.75,.15));
    shoe.castShadow=true;
  }
  const badge=box(g,.13,.2,.04,0x59eaff,0,1.2*s,-.31,glow(0x59eaff,2.2));
  badge.castShadow=false;
  g.position.set(x,0,z);
  g.userData={phase:hash(seed,20)*6.28,speed:1.25+hash(seed,21)*.35,axis,originX:x,originZ:z,arms:g.children.filter(o=>o.name.startsWith('arm')),legs:g.children.filter(o=>o.name.startsWith('leg'))};
  root.add(g);
}

function addLamp(root:THREE.Group,x:number,z:number,seed:number){
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.07,.1,5.5,10),mat(0x26333a,.65,.45));
  pole.position.set(x,2.75,z);root.add(pole);
  const light=new THREE.Mesh(new THREE.SphereGeometry(.16,12,8),glow(seed%2?0xffd88a:0x66eaff,5));
  light.position.set(x+.7,5.15,z);root.add(light);
  const lamp=new THREE.PointLight(seed%2?0xffc56b:0x57dfff,2.4,24);
  lamp.position.copy(light.position);root.add(lamp);
}

function addConstruction(root:THREE.Group,x:number,z:number,progress:number,name:string){
  const site=new THREE.Group();site.name='collaborative-construction';site.userData.isConstruction=true;site.position.set(x,0,z);
  const concrete=mat(0x9aa7a6,.9,.04),steel=mat(0x526a73,.48,.62),wood=mat(0xc18a4e,.82,.02),glass=mat(0x52cde7,.14,.38,.35);
  const piece=(mesh:THREE.Object3D,stage:number)=>{mesh.userData.buildStage=stage;mesh.visible=progress>=stage;site.add(mesh);};
  const box=(w:number,h:number,d:number,m:THREE.Material,px:number,py:number,pz:number,stage:number)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(px,py,pz);o.castShadow=true;o.receiveShadow=true;piece(o,stage);return o;};
  box(24,.7,20,concrete,0,.35,0,0);
  if(name.includes('مزرعه')){
    const soil=mat(0x76532e,.95,0),leaf=mat(0x4b8d45,.8,0),water=mat(0x4f9ca8,.25,.25);
    box(20,.16,16,soil,0,.78,0,.12);
    for(let row=0;row<6;row++){
      box(1.1,.16,15,water,-8+row*3.2,.9,0,.2);
      for(let col=0;col<7;col++){
        const crop=new THREE.Mesh(new THREE.ConeGeometry(.42,1.4,5),leaf);
        crop.position.set(-6.5+row*2.15,1.55,-6+col*2);crop.castShadow=true;piece(crop,.28+col*.055);
      }
    }
    const shed=box(5,3.4,4,wood,7,2.4,-7,.58);
    const roof=box(5.8,.35,4.8,steel,7,4.2,-7,.72);
  }else if(name.includes('کارخانه')){
    box(19,.35,15,steel,0,.8,0,.12);
    box(15,8,12,concrete,0,4.8,0,.28);
    box(16,.5,13,steel,0,9,0,.55);
    for(let i=0;i<3;i++){
      const chimney=new THREE.Mesh(new THREE.CylinderGeometry(.7,.95,8,12),steel);
      chimney.position.set(-5+i*5,13,2);chimney.castShadow=true;piece(chimney,.7+i*.07);
      const rim=new THREE.Mesh(new THREE.CylinderGeometry(1,1,.35,12),wood);
      rim.position.set(-5+i*5,17,2);piece(rim,.88);
    }
    for(let i=0;i<5;i++)box(1.2,2,.25,glass,-6+i*3,5.2,-6.13,.42);
  }else if(name.includes('خانه')){
    box(14,4.8,12,concrete,0,3.1,0,.2);
    for(let i=0;i<4;i++)box(.22,3.4,.22,wood,-5+i*3.3,2.8,6.1,.32);
    box(15,.35,13,wood,0,5.65,0,.52);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(10,4,4),mat(0x9b5140,.8,.02));
    roof.rotation.y=Math.PI/4;roof.position.set(0,7.6,0);roof.castShadow=true;piece(roof,.72);
    box(2.2,3.2,.25,wood,0,2.5,6.18,.4);
    for(let i=0;i<3;i++)box(1.5,1.3,.18,glass,-4+i*4,3.8,6.2,.58);
  }else{
    for(let i=0;i<8;i++){const xoff=i%2===0?-10:10,zoff=i<4?-8:8;box(.5,7,.5,steel,xoff,3.8,zoff,.18);}
    for(let level=0;level<3;level++){
      const y=2.2+level*2.2;
      for(const side of[-1,1])box(20,.24,.24,wood,0,y,side*8,.35+level*.18);
      for(const side of[-1,1])box(.24,.24,16,wood,side*10,y,0,.35+level*.18);
    }
    box(23,.55,19,mat(0x2b7180,.35,.25),0,8.7,0,.82);
    for(const side of[-1,1])box(.12,4,5,glass,side*10.12,5,0,.9);
  }
  site.visible=progress>0;
  root.add(site);
}
function buildWorld(px:number,pz:number,constructionProgress:number,constructionX:number,constructionY:number,constructionName:string,agents:AgentVisual[]){
  const root=new THREE.Group();
  const size=CELL*(RANGE*2+1);
  const groundGeo=new THREE.PlaneGeometry(size,size,96,96);
  const groundPos=groundGeo.attributes.position;
  const groundColors:number[]=[];
  const grassPalette=[new THREE.Color(0x47764b),new THREE.Color(0x527f4a),new THREE.Color(0x3e6b42),new THREE.Color(0x68864c)];
  for(let i=0;i<groundPos.count;i++){
    const variation=hash(i,7),v=grassPalette[Math.floor(variation*grassPalette.length)];
    groundPos.setZ(i,(hash(i,17)-.5)*.22);
    const shade=.92+hash(i,27)*.16;groundColors.push(v.r*shade,v.g*shade,v.b*shade);
  }
  groundGeo.attributes.position.needsUpdate=true;groundGeo.computeVertexNormals();
  groundGeo.setAttribute('color',new THREE.Float32BufferAttribute(groundColors,3));
  const groundMat=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1,metalness:0});
  const ground=new THREE.Mesh(groundGeo,groundMat);
  ground.rotation.x=-Math.PI/2;
  ground.position.set(px,0,pz);
  ground.receiveShadow=true;
  root.add(ground);

  const roadX=Math.round(px/60)*60;
  const roadZ=Math.round(pz/60)*60;
  addStreet(root,roadX,roadZ,true);
  addStreet(root,roadX,roadZ,false);

  const water=new THREE.Mesh(new THREE.PlaneGeometry(700,700,48,48),new THREE.MeshPhysicalMaterial({color:0x176c83,roughness:.16,metalness:.16,clearcoat:1,clearcoatRoughness:.08,transparent:true,opacity:.94}));
  water.rotation.x=-Math.PI/2;
  water.position.set(px+330,-1.8,pz-320);
  root.add(water);

  for(let gx=-RANGE;gx<=RANGE;gx++) for(let gz=-RANGE;gz<=RANGE;gz++){
    const baseX=px+(gx+.5)*CELL;
    const baseZ=pz+(gz+.5)*CELL;
    const worldGX=Math.floor(px/CELL)+gx;
    const worldGZ=Math.floor(pz/CELL)+gz;
    const seed=worldGX*97+worldGZ*131;
    if(hash(seed,7)>.28){
      for(let i=0;i<3;i++){
        const bx=baseX+(hash(seed,i)-.5)*110;
        const bz=baseZ+(hash(seed,i+10)-.5)*110;
        if(Math.abs(bx-roadX)>25&&Math.abs(bz-roadZ)>25) addBuilding(root,bx,bz,seed+i);
      }
    }else{
      for(let i=0;i<8;i++){
        const tx=baseX+(hash(seed,i)-.5)*130;
        const tz=baseZ+(hash(seed,i+20)-.5)*130;
        if(Math.abs(tx-roadX)>17&&Math.abs(tz-roadZ)>17) addTree(root,tx,tz,.8+hash(seed,i+30)*1.3,seed+i);
      }
    }
    const lane=(seed%2?-1:1)*3.25;
    if(gz===0) addCar(root,baseX+(hash(seed,50)-.5)*34,roadZ+lane,seed+100,'x');
    if(gx===0) addCar(root,roadX+lane,baseZ+(hash(seed,40)-.5)*34,seed+101,'z');
    addLamp(root,baseX+(gx%2)*18,baseZ+(gz%2)*18,seed);
  }

  for(let i=0;i<7;i++){
    const tx=px+(hash(i,300)-.5)*700;
    const tz=pz+(hash(i,330)-.5)*700;
    if(Math.abs(tx-roadX)>32&&Math.abs(tz-roadZ)>32) addTower(root,tx,tz,900+i);
  }
  const nearbyAgents=agents.filter(a=>Math.abs(a.x-px)<WORLD_SIZE*.52&&Math.abs(a.y-pz)<WORLD_SIZE*.52).slice(0,42);
  for(const a of nearbyAgents){
    addAgent(root,a.x,a.y,a.id,'x');
    const model=root.children[root.children.length-1] as THREE.Group;
    model.userData.agentId=a.id;
    model.userData.simulatedAgent=true;
  }
  addConstruction(root,constructionX,constructionY,constructionProgress/100,constructionName);
  return root;
}

export default function CinematicWorld({playerX,playerY,angle,onMoveTarget,time,constructionProgress,constructionX,constructionY,constructionName,agents,onLook}:Props){
  const hostRef=useRef<HTMLDivElement>(null);
  const latest=useRef({playerX,playerY,angle,time,constructionProgress,constructionX,constructionY,constructionName,agents});
  const look=useRef({active:false,lastX:0,startX:0,startY:0,startTime:0,moved:false});
  latest.current={playerX,playerY,angle,time,constructionProgress,constructionX,constructionY,constructionName,agents};

  useEffect(()=>{
    let alive=true;
    const host=hostRef.current;
    if(!host)return;

    let renderer:THREE.WebGLRenderer|null=null;
    let world:THREE.Group|null=null;
    let scene:THREE.Scene|null=null;
    let camera:THREE.PerspectiveCamera|null=null;

    const init=()=>{
      try{
        renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
        renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,window.innerWidth<800?1.5:2));
        renderer.setSize(host.clientWidth||window.innerWidth,host.clientHeight||window.innerHeight,false);
        renderer.setClearColor(0x78a9b7,1);
        renderer.outputColorSpace=THREE.SRGBColorSpace;
        renderer.toneMapping=THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure=1.34;
        renderer.shadowMap.enabled=true;
        renderer.shadowMap.type=THREE.PCFSoftShadowMap;
        renderer.info.autoReset=true;
        renderer.domElement.className='cinematic-canvas';
        renderer.domElement.style.touchAction='none';
        host.appendChild(renderer.domElement);

        scene=new THREE.Scene();
        scene.background=new THREE.Color(0x91c5df);
        scene.fog=new THREE.Fog(0x91c5df,520,2500);

        const hemi=new THREE.HemisphereLight(0xdff3ff,0x514538,3.15);
        scene.add(hemi);
        const sun=new THREE.DirectionalLight(0xfff0d8,8.2);
        sun.position.set(-260,420,220);
        sun.castShadow=true;
        sun.shadow.mapSize.set(window.innerWidth<800?1536:2048,window.innerWidth<800?1536:2048);
        sun.shadow.camera.near=1;
        sun.shadow.camera.far=1400;
        sun.shadow.camera.left=-500;
        sun.shadow.camera.right=500;
        sun.shadow.camera.top=500;
        sun.shadow.camera.bottom=-500;
        scene.add(sun);
        scene.add(sun.target);

        const cityGlow=new THREE.PointLight(0xffd7a0,1.4,220);
        cityGlow.position.set(0,45,0);
        scene.add(cityGlow);

        camera=new THREE.PerspectiveCamera(72,1,.06,2200);
        camera.position.set(0,1.72,.15);
        scene.add(camera);

        const hands=new THREE.Group();
        const handMat=mat(0xc48769,.74,.01);
        const sleeve=mat(0x263b48,.55,.08,.18);
        for(const side of[-1,1]){
          const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.11,.62,7,10),sleeve);
          arm.position.set(side*.52,-.58,-.78);
          arm.rotation.z=side*.25;
          hands.add(arm);
          const hand=new THREE.Mesh(new THREE.SphereGeometry(.14,16,12),handMat);
          hand.position.set(side*.63,-.93,-.98);
          hands.add(hand);
        }
        camera.add(hands);

        world=buildWorld(latest.current.playerX,latest.current.playerY,latest.current.constructionProgress,latest.current.constructionX,latest.current.constructionY,latest.current.constructionName,latest.current.agents);
        scene.add(world);

        const resize=()=>{
          if(!renderer||!camera)return;
          const w=host.clientWidth||window.innerWidth;
          const h=host.clientHeight||window.innerHeight;
          camera.aspect=w/Math.max(1,h);
          camera.updateProjectionMatrix();
          renderer.setSize(w,h,false);
        };
        resize();
        window.addEventListener('resize',resize);

        const down=(e:PointerEvent)=>{
          if(e.clientX<window.innerWidth*.40)return;
          look.current={active:true,lastX:e.clientX,startX:e.clientX,startY:e.clientY,startTime:performance.now(),moved:false};
          renderer?.domElement.setPointerCapture(e.pointerId);
        };
        const move=(e:PointerEvent)=>{
          if(!look.current.active)return;
          const total=Math.hypot(e.clientX-look.current.startX,e.clientY-look.current.startY);
          if(total>10)look.current.moved=true;
          if(look.current.moved){
            const dx=e.clientX-look.current.lastX;
            look.current.lastX=e.clientX;
            onLook(dx*.005);
          }
        };
        const up=(e:PointerEvent)=>{
          const tap=!look.current.moved && performance.now()-look.current.startTime<550;
          if(tap && camera && renderer){
            const rect=renderer.domElement.getBoundingClientRect();
            const pointer=new THREE.Vector2(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);
            const raycaster=new THREE.Raycaster();
            raycaster.setFromCamera(pointer,camera);
            const groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
            const hit=new THREE.Vector3();
            if(raycaster.ray.intersectPlane(groundPlane,hit)){
              onMoveTarget({x:hit.x+latest.current.playerX,y:hit.z+latest.current.playerY});
            }
          }
          look.current.active=false;
          if(renderer?.domElement.hasPointerCapture(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId);
        };
        renderer.domElement.addEventListener('pointerdown',down);
        renderer.domElement.addEventListener('pointermove',move);
        renderer.domElement.addEventListener('pointerup',up);
        renderer.domElement.addEventListener('pointercancel',up);

        let cellX=Math.floor(latest.current.playerX/CELL);
        let cellZ=Math.floor(latest.current.playerY/CELL);
        const loop=(now:number)=>{
          if(!alive||!renderer||!scene||!camera||!world)return;

          const s=latest.current;
          const nx=Math.floor(s.playerX/CELL);
          const nz=Math.floor(s.playerY/CELL);
          if(nx!==cellX||nz!==cellZ){
            scene.remove(world);
            world.traverse(o=>{
              const m=o as THREE.Mesh;
              if(m.geometry)m.geometry.dispose();
              if(Array.isArray(m.material))m.material.forEach(v=>v.dispose());
              else if(m.material)m.material.dispose();
            });
            world=buildWorld(s.playerX,s.playerY,s.constructionProgress,s.constructionX,s.constructionY,s.constructionName,s.agents);
            scene.add(world);
            cellX=nx;
            cellZ=nz;
          }

          world.position.set(-s.playerX,0,-s.playerY);
          const agentsById=new Map(s.agents.map(a=>[a.id,a]));
          const daylight=Math.max(.2,Math.sin(((s.time-6)/24)*Math.PI*2)*.5+.5);
          const sky=new THREE.Color().setHSL(.565,.48,.31+daylight*.43);
          scene.background=sky;
          (scene.fog as THREE.Fog).color.copy(sky);
          (scene.fog as THREE.Fog).near=daylight>.55?420:230;
          (scene.fog as THREE.Fog).far=daylight>.55?2200:1350;
          hemi.intensity=1.25+daylight*2.3;
          sun.intensity=1.5+daylight*6.1;
          sun.position.set(Math.cos(s.time/24*Math.PI*2)*420,260+daylight*420,Math.sin(s.time/24*Math.PI*2)*340);
          cityGlow.intensity=.8+(1-daylight)*7;

          world.traverse(o=>{
            const g=o as THREE.Group;
            if(g.userData?.isConstruction){g.position.x=s.constructionX;g.position.z=s.constructionY;g.visible=s.constructionProgress>0;g.children.forEach(child=>{if(child.userData.buildStage!==undefined)child.visible=s.constructionProgress/100>=child.userData.buildStage;});}
            const u=g.userData||{};
            if(u.agentId){
              const a=agentsById.get(u.agentId);
              if(a){g.position.set(a.x,0,a.y);if(Math.hypot(a.vx,a.vy)>.025)g.rotation.y=Math.atan2(a.vx,-a.vy);}
              const t=now*.0018*u.speed+u.phase;
              const stride=Math.sin(t)*(a&&Math.hypot(a.vx,a.vy)>.025?1:.18);
              u.legs[0].rotation.x=stride*.42;u.legs[1].rotation.x=-stride*.42;u.arms[0].rotation.x=-stride*.24;u.arms[1].rotation.x=stride*.24;
            }else if(u.arms&&u.legs){
              const t=now*.0018*u.speed+u.phase;
              const stride=Math.sin(t);
              u.legs[0].rotation.x=stride*.42;
              u.legs[1].rotation.x=-stride*.42;
              u.arms[0].rotation.x=-stride*.24;
              u.arms[1].rotation.x=stride*.24;
              const travel=Math.sin(t*.42)*18;
              const forward=Math.cos(t*.42)>=0;
              if(u.axis==='x'){
                g.position.x=u.originX+travel;
                g.position.z=u.originZ;
                g.rotation.y=forward?-Math.PI/2:Math.PI/2;
              }else{
                g.position.x=u.originX;
                g.position.z=u.originZ+travel;
                g.rotation.y=forward?Math.PI:0;
              }
            }else if(u.axis){
              const t=now*.001*u.speed+u.phase;
              const travel=Math.sin(t)*25;
              const forward=Math.cos(t)>=0;
              if(u.axis==='x'){
                g.position.x=u.originX+travel;
                g.rotation.y=forward?0:Math.PI;
              }else{
                g.position.z=u.originZ+travel;
                g.rotation.y=forward?-Math.PI/2:Math.PI/2;
              }
              if(u.wheels){const roll=0.035*u.speed*(forward?1:-1);for(const wheel of u.wheels as THREE.Object3D[]){if(u.axis==='x')wheel.rotation.z+=roll;else wheel.rotation.x+=roll;}}
            }
          });

          camera.position.set(0,1.72,.15);
          camera.rotation.order='YXZ';
          camera.rotation.y=-s.angle-Math.PI/2;
          camera.rotation.x=-.035;
          hands.rotation.z=Math.sin(now*.0018)*.016;
          renderer.render(scene,camera);
          requestAnimationFrame(loop);
        };

        requestAnimationFrame(loop);

        return()=>{
          window.removeEventListener('resize',resize);
          renderer?.domElement.removeEventListener('pointerdown',down);
          renderer?.domElement.removeEventListener('pointermove',move);
          renderer?.domElement.removeEventListener('pointerup',up);
          renderer?.domElement.removeEventListener('pointercancel',up);
          renderer?.dispose();
          if(renderer?.domElement.parentElement===host)host.removeChild(renderer.domElement);
        };
      }catch(error){
        console.error('cinematic_webgl_failed',error);
      }
    };

    const cleanup=init();
    return()=>{alive=false;cleanup?.();};
  },[]);

  return <div ref={hostRef} className='cinematic-world' aria-label='جهان سه بعدی نسل بعدی'/>;
}
