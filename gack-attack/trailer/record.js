// Nimmt den Trailer auf: node trailer/record.js  -> trailer/raw/*.webm, danach trailer/make.sh
const {chromium}=require('playwright');const path=require('path');
const URL='file://'+path.resolve(__dirname,'../index.html')+'#dev';
(async()=>{const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1600,height:900},recordVideo:{dir:path.join(__dirname,'raw'),size:{width:1600,height:900}}});
const pg=await ctx.newPage();const w=ms=>pg.waitForTimeout(ms);const ev=(f,a)=>pg.evaluate(f,a);
const card=(big,small,ms)=>ev(([b,s])=>{let d=document.getElementById('tcard');if(!d){d=document.createElement('div');d.id='tcard';d.style.cssText='position:fixed;inset:0;z-index:2000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:radial-gradient(ellipse at 50% 40%,#1B3556,#05080F 75%);color:#fff;text-align:center;font-family:Fredoka,sans-serif';document.body.appendChild(d);}
 d.style.display='flex';d.innerHTML=`<div style="font-family:'Lilita One';font-size:110px;line-height:1;color:#FFC93C;text-shadow:0 8px 0 #B84A10">${b}</div><div style="font-size:34px;font-weight:700;color:#C9D8EC">${s}</div>`;},[big,small]).then(()=>w(ms)).then(()=>ev(()=>{document.getElementById('tcard').style.display='none';}));
await pg.goto(URL);await w(1800);
await ev(()=>{const d=document.createElement('div');d.id='mark';d.style.cssText='position:fixed;left:0;top:0;width:8px;height:8px;background:#f0f';document.body.appendChild(d);});await w(300);await ev(()=>document.getElementById('mark').remove());
await card('GACK ATTACK','Die Waschbär-Bande will Omas Kekse.',2200);
await w(2600); // Titel
await pg.click('#t-camp');await w(2200);
await ev(()=>{window.__G||0;});
await pg.click('.clv >> nth=0');await w(500);
await ev(()=>{const G=window.__G;G.campStart(G.CAMP[0].lv[2]);});await w(4200);
await pg.keyboard.press('Escape');await w(300);
await card('12 MISSIONEN','Eine Kampagne. Vier Kapitel. Ein Pate.',1800);
// Action-Szene
await ev(()=>{const G=window.__G,S=G.S;const T=[['huhn',300,300,'a'],['eule',420,450,'a'],['aal',700,600,'a'],['frosch',760,840,'a'],['kuh',640,380,'b'],['igel',200,560,'a'],['biene',1000,620,'a'],['schaf',950,330,'a'],['lama',470,250,'b']];
 for(const [t,x,y,e] of T)S.towers.push(G.makeTower(t,x,y,3,e));S.towers.push(G.makeTower('oma',540,520));S.towers.at(-1).hlv=10;S.seenB={hof:1};S.wave=12;S.speed=2;G.startWave();});
await w(6500);
await pg.keyboard.press('r');await w(3500);
await card('BOSSE MIT PHASEN','Sie werden wütend. Dann wütender.',1800);
// Boss
await ev(()=>{const G=window.__G,S=G.S;document.getElementById('cards').hidden=true;S.cardsOpen=false;S.paused=false;S.seenB={};S.speed=1;if(!S.waveActive)G.startWave();S.spawnQ.unshift({t:S.waveT+.05,type:'boss'});});
await w(3600);
await ev(()=>{const b=window.__G.S.enemies.find(e=>e.boss);if(b)b.hp=b.maxHp*.6;});await w(3000);
await ev(()=>{const b=window.__G.S.enemies.find(e=>e.boss);if(b)b.hp=b.maxHp*.3;});await w(3000);
await ev(()=>{const G=window.__G,b=G.S.enemies.find(e=>e.boss);if(b){b.shield=0;b.hp=1;G.hurt(b,50,{pierce:true});}});await w(3200);
// Don Kralle
await card('DON KRALLE','Der Pate hat einen Hut. Und Familie.',1800);
await ev(()=>{document.getElementById('cards').hidden=true;const G=window.__G;G.campStart(G.CAMP[3].lv[2]);});await w(5000);await pg.keyboard.press('Escape');await w(200);
await ev(()=>{const G=window.__G,S=G.S;const T=[['huhn',300,240,'a'],['eule',420,420,'b'],['aal',700,600,'b'],['frosch',950,330,'a'],['kuh',640,380,'a'],['igel',200,560,'b']];for(const [t,x,y,e] of T)S.towers.push(G.makeTower(t,x,y,3,e));S.wave=24;G.startWave();S.spawnQ=[{t:S.waveT+.1,type:'pate'}];});
await w(4200);await ev(()=>{const b=window.__G.S.enemies.find(e=>e.boss);if(b)b.hp=b.maxHp*.3;});await w(3500);
await card('ENDLOSMODUS','Mutatoren alle 5 Runden. Wie weit kommst du?',2000);
await card('GACK ATTACK','Jetzt am PC. Oma wartet.',2600);
await ctx.close();await b.close();})();
