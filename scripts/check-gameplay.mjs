// Logic checks use a tiny Phaser double, not a browser or a replacement physics engine.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createRequire } from 'node:module';
import * as THREE from 'three';
const nativeRequire = createRequire(import.meta.url);
const root = process.cwd();
class Display {
  constructor(scene, x = 0, y = 0) { this.scene = scene; this.x = x; this.y = y; this.visible = true; this.active = true; this.frame = { width: 64 }; this.body = new Body(); this.alpha = 1; }
  setPosition(x, y) { this.x = x; this.y = y; return this; }
  setVisible(v) { this.visible = v; return this; }
  setActive(v) { this.active = v; return this; }
  setAlpha(v) { this.alpha = v; return this; }
  setText(v) { this.text = v; return this; }
  setRadius(v) { this.radius = v; return this; }
  setVelocity(x, y) { this.body.setVelocity(x, y); return this; }
  destroy() { this.active = false; }
}
for (const method of ['setDepth', 'setOrigin', 'setCircle', 'setOffset', 'setSize', 'setMaxVelocity', 'setCollideWorldBounds', 'setDisplaySize', 'setScale', 'setAngle', 'setTint', 'clearTint', 'setStrokeStyle', 'setFillStyle', 'setImmovable', 'clear', 'lineStyle', 'lineBetween', 'strokeCircle']) Display.prototype[method] = function () { return this; };
class Body {
  constructor() { this.velocity = { x: 0, y: 0 }; this.enable = true; }
  setVelocity(x, y) { this.velocity = { x, y }; return this; }
  setMaxVelocity(x, y) { this.max = { x, y }; return this; }
  stop() { return this.setVelocity(0, 0); }
}
for (const method of ['setCircle', 'setOffset', 'setSize', 'setCollideWorldBounds', 'setImmovable']) Body.prototype[method] = function () { return this; };
Body.prototype.updateFromGameObject = function () { return this; };
Body.prototype.reset = function (x,y) { this.resetPoint={x,y}; return this; };
const Phaser = { Scene: class {}, Physics: { Arcade: { Sprite: Display } }, Math: { Distance: { Between: (a,b,c,d) => Math.hypot(c-a,d-b) }, Angle: { Between: (a,b,c,d) => Math.atan2(d-b,c-a) }, Vector2: class { constructor(x,y) {this.x=x;this.y=y;} } } };
const cache = new Map();
Phaser.GameObjects = { Container: Display, Image: Display, Graphics: Display };
function load(relative) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file);
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const mod = {exports:{}}; cache.set(file,mod.exports);
  const localRequire = id => id === 'phaser' ? Phaser : id === 'three' ? THREE : !id.startsWith('.') ? nativeRequire(id) : load(path.relative(root,path.resolve(path.dirname(file),id+'.ts')));
  new Function('require','module','exports',code)(localRequire,mod,mod.exports);
  cache.set(file,mod.exports); return mod.exports;
}
function scene() {
  const s = { time:{now:0,delayedCall(){}}, registry:{get:()=>({value:{screenShake:false}})}, cameras:{main:{shake(){}}}, tweens:{add(){}}, physics:{add:{existing(){}}}, textures:{exists:()=>false} };
  s.add = {existing(){},circle:(x,y,r)=>{const o=new Display(s,x,y);o.radius=r;return o;},graphics:()=>new Display(s),text:(x,y)=>new Display(s,x,y)};
  return s;
}
const {Player}=load('src/game/entities/Player.ts');
const {Enemy}=load('src/game/entities/Enemy.ts');
const {Boss}=load('src/game/entities/Boss.ts');
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS '+name);}
check('dash retains direction after release; diagonal magnitude stays 420',()=>{
  const p=new Player(scene(),0,0);p.move(1,1,1/60,true);
  assert.equal(p.body.max.x,460);assert.ok(Math.abs(Math.hypot(...Object.values(p.body.velocity))-420)<.01);
  p.updateTimers(.05);p.move(0,0,.05,false);assert.ok(p.body.velocity.x>290 && p.body.velocity.y>290);
  p.updateTimers(.2);p.move(0,0,.2,false);assert.deepEqual(p.body.velocity,{x:0,y:0});
});
check('wisp locks a visible impact point; escaping its 58px warning avoids damage',()=>{
  const s=scene(),e=new Enemy(s,0,0,'wisp','test'),p=new Player(s,150,0);
  e.updateBrain(p,.01);assert.equal(e.warning.radius,58);assert.equal(e.warning.x,150);
  p.x=220;e.updateBrain(p,1.11);assert.equal(p.health,5);
  const e2=new Enemy(s,0,0,'wisp','test');p.x=150;e2.updateBrain(p,.01);e2.updateBrain(p,1.11);assert.equal(p.health,4);
});
check('idle enemies do not pursue until the player enters their actual alert radius',()=>{
  const s=scene(),e=new Enemy(s,0,0,'sentinel','test'),p=new Player(s,290,0);
  e.updateBrain(p,.016);assert.deepEqual(e.body.velocity,{x:0,y:0});
  p.x=240;e.updateBrain(p,.016);assert.ok(e.body.velocity.x>0);
});
check('safe-lamp retreat cancels enemy windup and moves it toward its home',()=>{
  const s=scene(),e=new Enemy(s,0,0,'moth','test'),p=new Player(s,20,0);
  e.x=100;p.x=110;e.updateBrain(p,.01);assert.equal(e.warning.visible,true);
  e.retreat();assert.equal(e.warning.visible,false);assert.ok(e.body.velocity.x<0);
});
check('all three boss phases damage inside their warning geometry at 30/60/120Hz',()=>{
  for(const hz of [30,60,120]) for(const phase of [1,2,3]){
    const s=scene(),b=new Boss(s,0,0),p=new Player(s,phase===3?100:70,0);b.health=phase===1?12:phase===2?8:4;
    for(let i=0;i<hz*4.5;i++){const dt=1/hz;p.updateTimers(dt);b.x+=b.body.velocity.x*dt;b.y+=b.body.velocity.y*dt;b.updateBoss(p,dt);}
    assert.ok(p.health<5,`phase ${phase} at ${hz}Hz did not damage`);
  }
});
check('early boss pulses rejected; gold warning opens a deterministic interrupt window',()=>{
  const b=new Boss(scene(),0,0),p=new Player(scene(),70,0);
  b.updateBoss(p,1.31);assert.equal(b.hitByPulse(),false);b.updateBoss(p,1);assert.equal(b.hitByPulse(),true);assert.equal(b.health,11);assert.equal(b.hitByPulse(),false);
});
check('boss pulse has matching health outcome across frame rates',()=>{
  const outcomes=[];for(const hz of [30,60,120]){
    const b=new Boss(scene(),0,0),p=new Player(scene(),70,0);for(let i=0;i<hz*4;i++) b.updateBoss(p,1/hz);outcomes.push(p.health);
  }assert.equal(new Set(outcomes).size,1);
});
check('legacy v1 saves keep progression and receive additive defaults',()=>{
  let text=JSON.stringify({version:1,started:true,unlockedLevel:3,currentLevel:2,checkpointLevel:2,checkpoint:'cp1',fragments:2,collected:['wick-01','wick-02'],settings:{},tutorialComplete:true});
  globalThis.localStorage={getItem:()=>text,setItem:(_,value)=>{text=value;}};
  const settings={toJSON:()=>({}),replace(){}};const {SaveManager}=load('src/game/systems/SaveManager.ts');const save=new SaveManager(settings);const data=save.load();
  assert.equal(data.unlockedLevel,3);assert.equal(data.checkpoint,'cp1');assert.equal(data.fragments,2);assert.deepEqual(data.journal,[]);
  save.rememberWorld('sunken-ruins','sunken-valve-1');save.discover('sunken-memory');save.recordJourney('sunken-ruins',15,4,1);
  const restored=new SaveManager(settings);restored.load();assert.ok(restored.worldFlags('sunken-ruins').includes('sunken-valve-1'));assert.equal(restored.value.lanternMemory,'sunken-memory');assert.equal(restored.value.journey['sunken-ruins'].pulses,4);
  text='{broken';assert.equal(restored.load().unlockedLevel,0);delete globalThis.localStorage;
});
check('authored collision walls avoid fixed quest objects and all five layouts build',()=>{
  const {LEVELS}=load('src/game/data/levels.ts'),{buildWorldLayout}=load('src/game/systems/WorldLayout.ts');
  LEVELS.forEach((level,index)=>{
    const layout=buildWorldLayout(level,index);assert.ok(layout.width>4000);
    for(const p of [...level.interactables,...level.collectibles]) for(const wall of layout.walls) assert.ok(Math.abs(p.x-wall.x)>wall.width/2+24 || Math.abs(p.y-wall.y)>wall.height/2+24,`${p.id} overlaps authored wall`);
  });
});
const {LevelScene}=load('src/game/scenes/LevelScene.ts');
const {LEVELS}=load('src/game/data/levels.ts');
function levelDouble(index){
  const s=scene(),value=Object.assign(Object.create(LevelScene.prototype),s);
  Object.assign(value,{level:LEVELS[index],levelIndex:index,player:new Player(s,0,640),worldFlags:new Set(),discovered:new Set(),valves:new Set(),checkpoints:new Set(),runeStep:0,pulseCooldown:0,pulseCount:0,enemies:[],fogPuffs:[],chaseElapsed:0,chaseStarted:false,stageFinished:false,settings:{value:{screenShake:false}},audio:{play(){}},feedback:{ring(){},connect(){}},ui:{showToast(){}},save:{rememberWorld(){},hasCollected:()=>false},inputManager:{clearTarget(){}},touch:{reset(){}}});
  value.gates=LEVELS[index].gateXs.map(x=>({x,opened:false,pieces:[new Display(s)]}));
  value.interactables=LEVELS[index].interactables.map(spec=>Object.assign(new Display(s,spec.x,spec.y),spec,{lit:false,setLit(v){this.lit=v;}}));
  return value;
}
check('grassland requires two separate lamp positions before the courtyard opens',()=>{
  const s=levelDouble(0);s.player.x=1470;s.player.y=470;s.pulseLamp();assert.equal(s.gates[1].opened,false);assert.ok(s.worldFlags.has('grass-beacon-north'));
  s.pulseCooldown=0;s.player.y=860;s.pulseLamp();assert.equal(s.gates[1].opened,true);
});
check('forest wrong sequence resets; branch/moon/tide completes the gate',()=>{
  const s=levelDouble(1),r=n=>s.interactables.find(i=>i.id==='forest-rune-'+n);
  s.activate(r(1));assert.equal(s.runeStep,0);s.activate(r(2));s.activate(r(1));s.activate(r(3));assert.equal(s.gates[0].opened,true);assert.ok(s.worldFlags.has('forest-sequence'));
});
check('boat crossing re-enables physics and east-bank lever recovers an expired door',()=>{
  const s=levelDouble(2);s.platform=new Display(s,2130,640);const transitions=[];s.tweens={add:t=>transitions.push(t)};
  s.activate(s.interactables.find(i=>i.id==='sunken-valve-1'));s.activate(s.interactables.find(i=>i.id==='sunken-valve-2'));assert.equal(s.valves.size,2);
  s.activate(s.interactables.find(i=>i.id==='sunken-platform'));assert.equal(s.player.body.enable,false);
  const ride=transitions.find(t=>Array.isArray(t.targets));ride.targets.forEach(target=>target.setPosition(2510,640));ride.onComplete();assert.equal(s.player.body.enable,true);assert.deepEqual(s.player.body.resetPoint,{x:2510,y:640});
  s.updateTimedDoor(25);assert.equal(s.gates[0].opened,false);s.activate(s.interactables.find(i=>i.id==='sunken-door-reset'));assert.equal(s.gates[0].opened,true);assert.equal(s.timedDoorRemaining,12);
});
check('legacy checkpoints reopen every gate behind the saved spawn',()=>{
  const s=levelDouble(0);s.player.x=2520;s.restoreWorldProgress(1);assert.equal(s.gates[0].opened,true);assert.equal(s.gates[1].opened,true);assert.equal(s.gates[2].opened,false);
});
check('water deadline ignores wall-clock jumps and consumes only active scene delta',()=>{
  const s=levelDouble(2);s.player.x=2000;s.gates[0].opened=true;s.timedDoorRemaining=24;
  s.time.now+=120000;s.updateTimedDoor(0);assert.equal(s.timedDoorRemaining,24);assert.equal(s.gates[0].opened,true);
  s.updateTimedDoor(23);assert.equal(s.timedDoorRemaining,1);s.updateTimedDoor(1);assert.equal(s.gates[0].opened,false);
});
check('mine safe beacons pause chase pressure and resume outside their zone',()=>{
  const s=levelDouble(3);s.chaseStarted=true;s.chaseElapsed=42;s.chaseMarker=new Display(s,1100,640);s.hazard=new Display(s);s.player.x=1500;
  s.updateChase(10);assert.equal(s.chaseElapsed,42);s.player.x=1650;s.updateChase(1);assert.equal(s.chaseElapsed,43);
});
check('saved mine lever does not trigger an immediate entrance-respawn failure',()=>{
  const s=levelDouble(3);s.worldFlags.add('mine-switch-1');s.player.x=140;assert.equal(s.shouldStartChase(),false);
  s.player.x=700;assert.equal(s.shouldStartChase(),true);
});
check('all authored levels retain a traversable central doorway and reachable quest objects',()=>{
  const {buildWorldLayout}=load('src/game/systems/WorldLayout.ts');
  LEVELS.forEach((level,index)=>{
    const layout=buildWorldLayout(level,index);
    const solids=[...layout.solids,...level.interactables.filter(i=>i.kind!=='platform').map(i=>({x:i.x,y:i.y,width:i.kind==='npc'?34:38,height:i.kind==='npc'?30:32}))];
    const blocked=(x,y)=>solids.some(s=>x+32>s.x-s.width/2&&x-32<s.x+s.width/2&&y+36>s.y-s.height/2&&y-18<s.y+s.height/2);
    const grid=(x,y)=>[Math.round((x-128)/32),Math.round((y-128)/32)];
    const [startX,startY]=grid(level.start.x,level.start.y);const queue=[[startX,startY]],visited=new Set([startX+','+startY]);
    for(let head=0;head<queue.length;head++){
      const [gx,gy]=queue[head];for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=gx+dx,ny=gy+dy,key=nx+','+ny,x=128+nx*32,y=128+ny*32;
        if(x<128||y<128||x>layout.width-128||y>layout.height-128||visited.has(key)||blocked(x,y)) continue;
        visited.add(key);queue.push([nx,ny]);
      }
    }
    const points=[...level.interactables,...level.collectibles,{x:level.exitX-70,y:level.start.y,id:'exit'}];
    for(const point of points) assert.ok(queue.some(([gx,gy])=>Math.hypot(128+gx*32-point.x,128+gy*32-point.y)<78),`${level.id}: unreachable ${point.id}`);
  });
});
check('stationary Three.js world redraws once after a canvas resize, then remains idle',()=>{
  const {ThreeWorldView}=load('src/game/systems/ThreeWorldView.ts');
  const view=Object.create(ThreeWorldView.prototype);let width=1280,height=720,renders=0;
  const bounds={x:0,y:0,width:720,height:540};
  Object.assign(view,{disposed:false,needsRender:false,viewport:{...bounds},cssWidth:width,cssHeight:height,dpr:1,scene:{},camera:{},host:{getBoundingClientRect:()=>({width,height})},setQuality(){},updateCamera(){},renderer:{setPixelRatio(){},setSize(){},domElement:{style:{}},render(){renders++;}}});
  view.update({worldView:bounds},{});assert.equal(renders,0);
  width=1920;height=1080;view.update({worldView:bounds},{});assert.equal(renders,1);
  view.update({worldView:bounds},{});assert.equal(renders,1);
});
console.log(`${passed} logic checks passed. Browser physics and device performance are separate checks.`);
