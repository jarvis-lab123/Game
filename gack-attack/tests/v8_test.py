"""v8-Test: Hof-Rang, neue Maps, Talente, Elite, Comic-FX, Speisekammer, Kampagne 6 Kapitel.
Aufruf: python tests/v8_test.py   (Screenshots in tests/screens/v8_*.png)"""
import asyncio, pathlib
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'index.html').as_uri() + '#dev'
OUT = ROOT / 'tests' / 'screens'
OUT.mkdir(exist_ok=True)

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
        shot = lambda n: pg.screenshot(path=f'{OUT}/v8_{n}.png')
        await pg.goto(URL); await pg.wait_for_timeout(1800)
        await shot('01_title')
        await pg.click('#t-play'); await pg.wait_for_timeout(500)
        await shot('02_maps_locked')
        # Rang hochsetzen -> Maps frei
        await pg.evaluate("()=>{localStorage.setItem('gack6-meta',JSON.stringify({crumbs:900,lv:{},xp:6000}));}")
        await pg.reload(); await pg.wait_for_timeout(1500)
        await shot('03_title_rank')
        await pg.click('#t-meta'); await pg.wait_for_timeout(400); await shot('04_meta')
        await pg.click('#me-back'); await pg.click('#t-camp'); await pg.wait_for_timeout(400); await shot('05_camp')
        await pg.click('#cb-back'); await pg.click('#t-play'); await pg.wait_for_timeout(400)
        await pg.click('#diff button[data-d="3"]'); await pg.wait_for_timeout(200); await shot('06_maps_open')
        await pg.click('#diff button[data-d="1"]')
        for mi in (4, 5):
            await pg.click(f'.mcard >> nth={mi}'); await pg.wait_for_timeout(1400)
            await pg.evaluate("()=>{const S=window.__G.S;S.paused=false;S.cardsOpen=false;document.getElementById('cards').hidden=true;}")
            await pg.evaluate("""()=>{const G=window.__G,S=G.S;const pts=[[330,160],[420,330],[700,470],[760,840],[1100,420],[330,560],[620,180]];
              const ty=['huhn','eule','aal','frosch','lama','igel','kuh'];pts.forEach(([x,y],i)=>{const t=G.makeTower(ty[i],x,y,3,'a');t.tal=i<3?['a','b','b']:['b','a'];S.towers.push(t);});
              S.wave=13;S.speed=1;G.startWave();}""")
            await pg.wait_for_timeout(5500)
            await shot(f'07_map{mi}_play')
            print('map', mi, await pg.evaluate("()=>{const S=window.__G.S;return {elite:S.enemies.filter(e=>e.elite).length,en:S.enemies.length,wave:S.wave}}"))
            await pg.evaluate("()=>{const G=window.__G;G.titleScreen();}"); await pg.click('#t-play'); await pg.wait_for_timeout(300)
        # Talente-UI
        await pg.click('.mcard >> nth=0'); await pg.wait_for_timeout(800)
        await pg.evaluate("()=>{const G=window.__G,S=G.S;const t=G.makeTower('huhn',330,330,3,'a');S.towers.push(t);}")
        await pg.mouse.click(330, 330); await pg.wait_for_timeout(300)
        await pg.click('[data-tal="0a"]'); await pg.wait_for_timeout(300)
        await shot('08_talents')
        print('tal', await pg.evaluate("()=>window.__G.S.towers.at(-1).tal"))
        # Endscreen mit EP
        await pg.evaluate("()=>{const S=window.__G.S;S.kills=400;S.wave=18;S.bossKills=1;S.lives=0;window.__G.gameOver();}")
        await pg.wait_for_timeout(1500); await shot('09_end_xp')
        print('\n'.join(errs[:20]) or 'NO ERRORS')
        await b.close()
asyncio.run(main())
