"""v7-Test: Titel, Kampagne, Dialog, Boss-Intro, Boss-Phasen, Endlos-Mutatoren, Endscreen.
Aufruf: python tests/v7_test.py   (Screenshots in tests/screens/v7_*.png)"""
import asyncio, pathlib
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'index.html').as_uri() + '#dev'
OUT = ROOT / 'tests' / 'screens'
OUT.mkdir(exist_ok=True)

async def shot(pg, name):
    await pg.screenshot(path=f'{OUT}/v7_{name}.png')

async def main():
    async with async_playwright() as p:
        try:
            b = await p.chromium.launch()
        except Exception:
            b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
        pg = await b.new_page(viewport={'width': 1600, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'net::' not in m.text else None)
        await pg.goto(URL)
        await pg.wait_for_timeout(2000)
        await shot(pg, '01_title')
        # Kampagne
        await pg.click('#t-camp'); await pg.wait_for_timeout(500)
        await shot(pg, '02_camp')
        await pg.click('.clv >> nth=0'); await pg.wait_for_timeout(900)
        await shot(pg, '03_dialog')
        await pg.keyboard.press('Space'); await pg.keyboard.press('Space'); await pg.wait_for_timeout(700)
        await pg.keyboard.press('Space'); await pg.keyboard.press('Space'); await pg.wait_for_timeout(700)
        await shot(pg, '04_dialog2')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        st = await pg.evaluate("()=>{const S=window.__G.S;return {mode:S.mode,maxW:S.maxW,paused:S.paused,lock:document.querySelectorAll('.tile.banned').length}}")
        print('camp start', st)
        await shot(pg, '05_camp_play')
        # Mission gewinnen erzwingen
        await pg.evaluate("()=>{const S=window.__G.S;S.wave=S.maxW-1;window.__G.startWave();S.spawnQ=[];S.enemies.forEach(e=>e.dead=true);}")
        await pg.wait_for_timeout(2600)
        await shot(pg, '06_post_dialog')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(900)
        await shot(pg, '07_camp_end')
        # Boss-Test auf dem Vulkan, Kampagne 4-3 (Don Kralle)
        await pg.evaluate("()=>{const L=window.__G.CAMP[3].lv[2];window.__G.campStart(L);}")
        await pg.wait_for_timeout(500)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        await pg.evaluate("""()=>{const G=window.__G,S=G.S;
          const pts=[[300,240],[420,420],[700,600],[760,820],[950,330],[640,380],[200,560],[1000,620]];
          const ty=['huhn','eule','aal','frosch','lama','kuh','igel','biene'];
          pts.forEach(([x,y],i)=>{S.towers.push(G.makeTower(ty[i],x,y,2,null));});
          S.wave=24;G.startWave();S.spawnQ=[{t:S.waveT+.1,type:'pate'}];}""")
        await pg.wait_for_timeout(1300)
        await shot(pg, '08_boss_intro')
        await pg.wait_for_timeout(3500)
        await shot(pg, '09_boss_play')
        await pg.evaluate("()=>{const S=window.__G.S;const b=S.enemies.find(e=>e.boss);if(b){b.hp=b.maxHp*.6;}}")
        await pg.wait_for_timeout(500)
        await shot(pg, '10_boss_phase2')
        await pg.evaluate("()=>{const S=window.__G.S;const b=S.enemies.find(e=>e.boss);if(b){b.hp=b.maxHp*.3;}}")
        await pg.wait_for_timeout(2600)
        await shot(pg, '11_boss_phase3')
        info = await pg.evaluate("()=>{const S=window.__G.S;const b=S.enemies.find(e=>e.boss);return b?{phase:b.phase,id:b.bossId,hp:Math.round(b.hp)}:null}")
        print('boss', info)
        await pg.evaluate("()=>{const S=window.__G.S;const b=S.enemies.find(e=>e.boss);if(b){b.shield=0;window.__G.hurt(b,1e9,{pierce:true});}}")
        await pg.wait_for_timeout(400)
        await shot(pg, '12_boss_death')
        # Map-Bosse: Phasen-Fähigkeiten auf allen Maps auslösen
        for mi in range(4):
            await pg.evaluate(f"""()=>{{const G=window.__G;G.startMap({mi},{{}});const S=G.S;
              [[300,240],[420,420],[700,600],[950,330],[640,380]].forEach(([x,y],i)=>S.towers.push(G.makeTower(['huhn','eule','aal','frosch','lama'][i],x,y,2,null)));
              S.seenB={{hof:1,sumpf:1,alm:1,vulkan:1}};S.wave=9;G.startWave();S.spawnQ=[{{t:S.waveT+.05,type:'boss'}}];}}""")
            await pg.wait_for_timeout(1500)
            await pg.evaluate("()=>{const S=window.__G.S;const b=S.enemies.find(e=>e.boss);if(b){b.hp=b.maxHp*.5;}}")
            await pg.wait_for_timeout(4200)
            await pg.evaluate("()=>{const S=window.__G.S;const b=S.enemies.find(e=>e.boss);if(b){b.hp=b.maxHp*.2;b.shield=0;}}")
            await pg.wait_for_timeout(4500)
            await shot(pg, f'13_mapboss_{mi}')
            print('map', mi, await pg.evaluate("()=>{const S=window.__G.S;const b=S.enemies.find(e=>e.boss);return b?{ph:b.phase,under:b.under,dash:b.dash>0,enr:!!b.enr}:'tot/weg'}"))
        # Endlos
        await pg.evaluate("()=>{window.__G.titleScreen();}")
        await pg.click('#t-play'); await pg.wait_for_timeout(500)
        await pg.click('#mode button[data-m=\"1\"]'); await pg.wait_for_timeout(200)
        await shot(pg, '14_maps_mode')
        await pg.click('.mcard >> nth=1'); await pg.wait_for_timeout(500)
        await pg.evaluate("()=>{const G=window.__G,S=G.S;S.wave=9;G.startWave();S.spawnQ=[];S.enemies.forEach(e=>e.dead=true);}")
        await pg.wait_for_timeout(1500)
        await pg.evaluate("()=>{const G=window.__G,S=G.S;S.wave=14;G.startWave();S.spawnQ=[];S.enemies.forEach(e=>e.dead=true);}")
        await pg.wait_for_timeout(1500)
        await pg.evaluate("()=>{document.getElementById('cards').hidden=true;const S=window.__G.S;S.cardsOpen=false;S.lives=3;}")
        await pg.keyboard.press('Space'); await pg.wait_for_timeout(2500)
        await shot(pg, '15_endless')
        print('endless', await pg.evaluate("()=>{const S=window.__G.S;return {mode:S.mode,muts:S.muts,wave:S.wave}}"))
        await pg.evaluate("()=>{window.__G.S.lives=1;}")
        await pg.evaluate("()=>{const S=window.__G.S;S.lives=0;window.__G.gameOver();}")
        await pg.wait_for_timeout(1500)
        await shot(pg, '16_endless_end')
        await pg.evaluate("()=>{window.__G.titleScreen();}")
        await pg.click('#t-achs'); await pg.wait_for_timeout(400)
        await shot(pg, '17_achs')
        print('\n'.join(errs[:20]) or 'NO ERRORS')
        await b.close()
asyncio.run(main())
