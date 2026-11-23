import asyncio, sys, math, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'index.html').as_uri() + '#dev'
OUT = ROOT / 'tests' / 'screens'
OUT.mkdir(exist_ok=True)
from playwright.async_api import async_playwright
MAP = int(sys.argv[1]) if len(sys.argv) > 1 else 2
PFX = sys.argv[2] if len(sys.argv) > 2 else 'a'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1600, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'net::' not in m.text else None)
        await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        await pg.goto(URL)
        await pg.wait_for_timeout(2500)
        if MAP == 2:
            await pg.screenshot(path=f'{OUT}/{PFX}0_title.png')
            await pg.click('#t-meta'); await pg.wait_for_timeout(400)
            await pg.screenshot(path=f'{OUT}/{PFX}1_meta.png')
            await pg.click('#me-back'); await pg.wait_for_timeout(300)
        await pg.click('#t-play'); await pg.wait_for_timeout(800)
        if MAP == 2:
            await pg.screenshot(path=f'{OUT}/{PFX}2_maps.png')
        await pg.click(f'.mcard >> nth={MAP}'); await pg.wait_for_timeout(600)
        # candidate spots along the path
        pts = await pg.evaluate("()=>{const S=window.__G.S;return null}")
        keys = ['h', '1', '9', '8', '0', '3', '7', '2', '5', '4', '6', '1', '9']
        pathpts = {2: [[160,300],[280,180],[460,140],[600,250],[560,420],[380,520],[330,690],[470,790],[690,780],[800,640],[760,470],[880,330],[1060,300],[1150,430]],
                   1: [[170,720],[300,620],[270,460],[170,340],[230,185],[430,140],[580,250],[540,420],[640,560],[820,600],[920,480],[860,320],[960,165],[1110,190]],
                   0: [[150,190],[290,240],[330,390],[250,530],[210,690],[330,800],[530,770],[610,610],[570,430],[650,265],[830,200],[970,280],[980,440]],
                   3: [[170,460],[300,320],[480,300],[570,470],[470,640],[620,770],[830,700],[870,520],[1010,400]]}[MAP]
        ki = 0
        for i, (x, y) in enumerate(pathpts):
            if ki >= len(keys): break
            for (dx, dy) in [(70, 0), (-70, 0), (0, 70), (0, -70), (60, 60), (-60, -60)]:
                before = await pg.evaluate("()=>window.__G.S.towers.length")
                await pg.keyboard.press(keys[ki])
                await pg.mouse.click(x + dx, y + dy)
                after = await pg.evaluate("()=>window.__G.S.towers.length")
                if after > before:
                    ki += 1; break
                await pg.keyboard.press('Escape')
        print('towers', await pg.evaluate("()=>window.__G.S.towers.map(t=>t.type).join(',')"))
        # evolve + myth a few
        towers = await pg.evaluate("()=>window.__G.S.towers.map(t=>[t.type,t.x,t.y])")
        evos = {'biene': 'a', 'aal': 'b', 'gans': 'b', 'huhn': 'a', 'eule': 'b', 'kuh': 'a', 'frosch': 'b', 'lama': 'a', 'schaf': 'b', 'igel': 'b'}
        n = 0
        for ty, x, y in towers:
            if ty not in evos: continue
            await pg.mouse.click(x, y); await pg.wait_for_timeout(80)
            for _ in range(2):
                if await pg.locator('#b-up').count(): await pg.click('#b-up')
            if await pg.locator(f'[data-evob="{evos[ty]}"]').count(): await pg.click(f'[data-evob="{evos[ty]}"]')
            if n < 3 and await pg.locator('#b-myth').count(): await pg.click('#b-myth')
            n += 1
            await pg.wait_for_timeout(60)
        await pg.evaluate("()=>{const S=window.__G.S;const h=S.towers.find(t=>t.type==='oma');if(h)window.__G.heroXP(h,2000);}")
        await pg.keyboard.press('Escape')
        await pg.wait_for_timeout(1500)
        if MAP != 2:
            await pg.evaluate("()=>{window.__G.S.wave=12}")
        await pg.keyboard.press('Space')
        await pg.click('#b-speed', force=True)
        await pg.wait_for_timeout(3500 if MAP!=2 else 7000)
        await pg.keyboard.press('q'); await pg.wait_for_timeout(300); await pg.keyboard.press('e')
        await pg.wait_for_timeout(1200)
        await pg.screenshot(path=f'{OUT}/{PFX}3_play.png')
        h = await pg.evaluate("()=>{const t=window.__G.S.towers.find(t=>t.type==='oma');return t?[t.x,t.y]:null}")
        if h:
            await pg.mouse.click(h[0], h[1]); await pg.wait_for_timeout(300)
            await pg.screenshot(path=f'{OUT}/{PFX}4_hero.png', clip={'x': 1320, 'y': 0, 'width': 280, 'height': 900})
            await pg.keyboard.press('Escape')
        await pg.evaluate("()=>window.__G.openCards()")
        await pg.wait_for_timeout(900)
        await pg.screenshot(path=f'{OUT}/{PFX}5_cards.png')
        await pg.keyboard.press('2'); await pg.wait_for_timeout(5000)
        await pg.screenshot(path=f'{OUT}/{PFX}6_play2.png')
        st = await pg.evaluate("()=>{const S=window.__G.S;return {wave:S.wave,kills:S.kills,lives:S.lives,enemies:S.enemies.length,bees:S.bees.length,state:S.state}}")
        print(st)
        print('\n'.join(errs[:20]) or 'NO ERRORS')
        await b.close()
asyncio.run(main())
