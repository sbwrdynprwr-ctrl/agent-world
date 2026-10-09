import {useEffect,useRef} from 'react';
import * as THREE from 'three';

type Props={playerX:number;playerY:number;angle:number;time:number;constructionProgress:number;constructionX:number;constructionY:number;onLook:(delta:number)=>void};

const CELL=180;
const RANGE=2;
const WORLD_SIZE=CELL*(RANGE*2+1);

const hash=(a:number,b:number)=>{
  const s=Math.sin(a*127.1+b*311.7+91.7)*43758.5453;
  return s-Math.floor(s);
};

const mat=(color:number,roughness=.55,metalness=.08,clearcoat=0)=>{
  return new THREE.MeshPhysicalMaterial({color,roughness,metalness,clearcoat,clearcoatRoughness:.18});
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
  const hgt=18+hash(seed,1)*62;
  const w=13+hash(seed,2)*13;
  const d=13+hash(seed,3)*12;
  const base=[0x26343b,0x34434a,0x4b555a,0x2b414b][seed%4];
  box(root,w,hgt,d,base,x,hgt/2,z,mat(base,.2,.42,.32));
  box(root,w*1.05,.65,d*1.05,0x111a20,x,hgt+.32,z,mat(0x111a20,.35,.7,.2));
  const glass=mat(0x4aa8bf,.08,.68,.5);
  const rows=Math.floor(hgt/4);
  const cols=Math.max(2,Math.floor(w/3.2));
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      if((r+c+seed)%5===0) continue;
      const wx=x-w*.34+c*(w*.68/Math.max(1,cols-1));
      const wy=2.4+r*3.65;
      const win=box(root,.95,.72,.08,0x5bd9ee,wx,wy,z-d/2-.045,glass);
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
  const crown=box(root,w*.55,1.1,d*.55,0x6feaff,x,hgt+.95,z,glow(0x51ddff,2.8));
  crown.rotation.y=hash(seed,8)*Math.PI;
  const antenna=new THREE.Mesh(new THREE.CylinderGeometry(.09,.16,9,10),glow(0x5feaff,3));
  antenna.position.set(x,hgt+5.8,z);
  root.add(antenna);
}

function addTower(root:THREE.Group,x:number,z:number,seed:number){
  const hgt=70+hash(seed,4)*75;
  const r=7+hash(seed,5)*6;
  const tower=new THREE.Mesh(new THREE.CylinderGeometry(r*.78,r,hgt,28),mat(0x27404c,.1,.65,.55));
  tower.position.set(x,hgt/2,z);
  tower.castShadow=true;
  root.add(tower);
  const ringMat=glow(seed%2?0x49e7ff:0x8f7cff,1.8);
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
  const crownMat=mat(seed%2?0x1f7142:0x2f8450,.78,.02);
  for(let i=0;i<4;i++){
    const crown=new THREE.Mesh(new THREE.SphereGeometry(1.05*s,18,14),crownMat);
    crown.position.set((i-1.5)*.45*s,2.8*s+i*.16*s,Math.sin(i*1.7)*.35*s);
    crown.castShadow=true;
    g.add(crown);
  }
  g.position.set(x,0,z);
  root.add(g);
}

function addStreet(root:THREE.Group,x:number,z:number,vertical:boolean){
  const roadW=13;
  box(root,vertical?roadW:WORLD_SIZE,.2,vertical?WORLD_SIZE:roadW,0x20272b,x,.02,z,mat(0x20272b,.96,.01));
  const curb=mat(0x9ba5a5,.78,.08);
  const sidewalk=mat(0x68777a,.88,.04);
  for(const side of [-1,1]){
    box(root,vertical?3.8:WORLD_SIZE,.34,vertical?WORLD_SIZE:3.8,0x68777a,x+(vertical?side*8.6:0),.17,z+(vertical?0:side*8.6),sidewalk);
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
  box(g,.16,.18,.52,0x8deaff,2.9,.9,-.7,glow(0x8deaff,2.8));
  box(g,.16,.18,.52,0x8deaff,2.9,.9,.7,glow(0x8deaff,2.8));
  g.position.set(x,.1,z);
  g.rotation.y=axis==='z'?Math.PI/2:0;
  g.userData={phase:hash(seed,8)*6.28,speed:4+hash(seed,9)*3,axis,originX:x,originZ:z};
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
  g.userData={phase:hash(seed,20)*6.28,speed:.45+hash(seed,21)*.35,axis,originX:x,originZ:z,arms:g.children.filter(o=>o.name.startsWith('arm')),legs:g.children.filter(o=>o.name.startsWith('leg'))};
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

function addConstruction(root:THREE.Group,x:number,z:number,progress:number){
  const site=new THREE.Group();site.name='collaborative-construction';site.userData.isConstruction=true;site.position.set(x,0,z);
  const concrete=mat(0x9aa7a6,.9,.04),steel=mat(0x526a73,.48,.62),wood=mat(0xc18a4e,.82,.02),glass=mat(0x52cde7,.14,.38,.35);
  const piece=(mesh:THREE.Object3D,stage:number)=>{mesh.userData.buildStage=stage;mesh.visible=progress>=stage;site.add(mesh);};
  piece(box(new THREE.Group(),0,0,0,0,0,0,0),0); // stable group root for the staged build
  site.clear();
  const slab=new THREE.Mesh(new THREE.BoxGeometry(24,.7,20),concrete);slab.position.set(0,.35,0);slab.receiveShadow=true;piece(slab,0);
  for(let i=0;i<8;i++){const xoff=i%2===0?-10:10,zoff=i<4?-8:8;const col=new THREE.Mesh(new THREE.BoxGeometry(.5,7,.5),steel);col.position.set(xoff,3.8,zoff);col.castShadow=true;piece(col,.18);}
  for(let level=0;level<3;level++){
    const y=2.2+level*2.2;
    for(const side of[-1,1]){const beam=new THREE.Mesh(new THREE.BoxGeometry(20,.24,.24),wood);beam.position.set(0,y,side*8);piece(beam,.35+level*.18);}
    for(const side of[-1,1]){const beam=new THREE.Mesh(new THREE.BoxGeometry(.24,.24,16),wood);beam.position.set(side*10,y,0);piece(beam,.35+level*.18);}
  }
  const roof=new THREE.Mesh(new THREE.BoxGeometry(23,.55,19),mat(0x2b7180,.35,.25));roof.position.set(0,8.7,0);roof.castShadow=true;piece(roof,.82);
  for(const side of[-1,1]){const pane=new THREE.Mesh(new THREE.BoxGeometry(.12,4,5),glass);pane.position.set(side*10.12,5,0);piece(pane,.9);}
  root.add(site);
}

function buildWorld(px:number,pz:number,constructionProgress:number,constructionX:number,constructionY:number){
  const root=new THREE.Group();
  const size=CELL*(RANGE*2+1);
  const groundGeo=new THREE.PlaneGeometry(size,size,96,96);
  const groundPos=groundGeo.attributes.position;
  const groundColors:number[]=[];
  const grassPalette=[new THREE.Color(0x47764b),new THREE.Color(0x527f4a),new THREE.Color(0x3e6b42),new THREE.Color(0x68864c)];
  for(let i=0;i<groundPos.count;i++){const v=grassPalette[Math.floor(hash(i,7)*grassPalette.length)];groundColors.push(v.r,v.g,v.b);}
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
    const seed=Math.floor(px/CELL)*97+Math.floor(pz/CELL)*131+gx*31+gz*17;
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
    if(gz===0) addCar(root,baseX+lane,roadZ+(hash(seed,50)-.5)*120,seed+100,'x');
    if(gx===0) addCar(root,roadX+(hash(seed,40)-.5)*120,baseZ+lane,seed+101,'z');
    addLamp(root,baseX+(gx%2)*18,baseZ+(gz%2)*18,seed);
  }

  for(let i=0;i<7;i++){
    const tx=px+(hash(i,300)-.5)*700;
    const tz=pz+(hash(i,330)-.5)*700;
    if(Math.abs(tx-roadX)>32&&Math.abs(tz-roadZ)>32) addTower(root,tx,tz,900+i);
  }
  for(let i=0;i<55;i++){
    const axis=i%2===0?'z':'x';
    const side=hash(i,91)>.5?1:-1;
    const along=(hash(i,90)-.5)*(WORLD_SIZE-70);
    const ax=axis==='z'?roadX+side*10.4:along;
    const az=axis==='z'?along:roadZ+side*10.4;
    addAgent(root,ax,az,i+1000,axis);
  }
  if(constructionProgress>0)addConstruction(root,constructionX,constructionY,constructionProgress/100);
  return root;
}

export default function CinematicWorld({playerX,playerY,angle,time,constructionProgress,constructionX,constructionY,onLook}:Props){
  const hostRef=useRef<HTMLDivElement>(null);
  const latest=useRef({playerX,playerY,angle,time,constructionProgress,constructionX,constructionY});
  const look=useRef({active:false,lastX:0});
  latest.current={playerX,playerY,angle,time,constructionProgress,constructionX,constructionY};

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
        renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
        renderer.setSize(host.clientWidth||window.innerWidth,host.clientHeight||window.innerHeight,false);
        renderer.setClearColor(0x78a9b7,1);
        renderer.outputColorSpace=THREE.SRGBColorSpace;
        renderer.toneMapping=THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure=1.42;
        renderer.shadowMap.enabled=true;
        renderer.shadowMap.type=THREE.PCFSoftShadowMap;
        renderer.info.autoReset=true;
        renderer.domElement.className='cinematic-canvas';
        renderer.domElement.style.touchAction='none';
        host.appendChild(renderer.domElement);

        scene=new THREE.Scene();
        scene.background=new THREE.Color(0x9abfc7);
        scene.fog=new THREE.Fog(0x9abfc7,480,2200);

        const hemi=new THREE.HemisphereLight(0xeaf8ff,0x34462a,2.8);
        scene.add(hemi);
        const sun=new THREE.DirectionalLight(0xfff3dc,7.4);
        sun.position.set(-260,420,220);
        sun.castShadow=true;
        sun.shadow.mapSize.set(2048,2048);
        sun.shadow.camera.near=1;
        sun.shadow.camera.far=1400;
        sun.shadow.camera.left=-500;
        sun.shadow.camera.right=500;
        sun.shadow.camera.top=500;
        sun.shadow.camera.bottom=-500;
        scene.add(sun);
        scene.add(sun.target);

        const cityGlow=new THREE.PointLight(0x43dfff,4,300);
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

        world=buildWorld(latest.current.playerX,latest.current.playerY,latest.current.constructionProgress,latest.current.constructionX,latest.current.constructionY);
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
          look.current={active:true,lastX:e.clientX};
          renderer?.domElement.setPointerCapture(e.pointerId);
        };
        const move=(e:PointerEvent)=>{
          if(!look.current.active)return;
          const dx=e.clientX-look.current.lastX;
          look.current.lastX=e.clientX;
          onLook(dx*.005);
        };
        const up=(e:PointerEvent)=>{
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
            world=buildWorld(s.playerX,s.playerY,s.constructionProgress,s.constructionX,s.constructionY);
            scene.add(world);
            cellX=nx;
            cellZ=nz;
          }

          world.position.set(-s.playerX,0,-s.playerY);
          const daylight=Math.max(.2,Math.sin(((s.time-6)/24)*Math.PI*2)*.5+.5);
          const sky=new THREE.Color().setHSL(.56,.38,.34+daylight*.40);
          scene.background=sky;
          (scene.fog as THREE.Fog).color.copy(sky);
          (scene.fog as THREE.Fog).near=daylight>.55?420:230;
          (scene.fog as THREE.Fog).far=daylight>.55?2200:1350;
          hemi.intensity=1.05+daylight*2.15;
          sun.intensity=1.35+daylight*5.4;
          sun.position.set(Math.cos(s.time/24*Math.PI*2)*420,260+daylight*420,Math.sin(s.time/24*Math.PI*2)*340);
          cityGlow.intensity=.8+(1-daylight)*7;

          world.traverse(o=>{
            const g=o as THREE.Group;
            if(g.userData?.isConstruction){g.children.forEach(child=>{if(child.userData.buildStage!==undefined)child.visible=s.constructionProgress/100>=child.userData.buildStage;});}
            const u=g.userData||{};
            if(u.arms&&u.legs){
              const t=now*.0018*u.speed+u.phase;
              const stride=Math.sin(t);
              u.legs[0].rotation.x=stride*.42;
              u.legs[1].rotation.x=-stride*.42;
              u.arms[0].rotation.x=-stride*.24;
              u.arms[1].rotation.x=stride*.24;
              const travel=Math.sin(t*.16)*18;
              if(u.axis==='x'){
                g.position.x=u.originX+travel;
                g.position.z=u.originZ;
                g.rotation.y=travel>=0?Math.PI/2:-Math.PI/2;
              }else{
                g.position.x=u.originX;
                g.position.z=u.originZ+travel;
                g.rotation.y=travel>=0?0:Math.PI;
              }
            }else if(u.axis){
              const t=now*.001*u.speed+u.phase;
              const travel=Math.sin(t)*55;
              if(u.axis==='x')g.position.x=u.originX+travel;
              else g.position.z=u.originZ+travel;
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
