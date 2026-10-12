"""Real deployed UI: topic-named avatars and browser-local topic visibility."""
import asyncio,base64,hashlib,hmac,json,time
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    env=dict(line.split('=',1) for line in Path('/etc/arklyn-office/web.env').read_text().splitlines() if '=' in line)
    expiry=str(int(time.time()*1000)+600000)
    signature=base64.urlsafe_b64encode(hmac.new(env['OFFICE_SESSION_SECRET'].encode(),expiry.encode(),hashlib.sha256).digest()).decode().rstrip('=')
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path='/root/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--host-resolver-rules=MAP office.arklyn.ir 127.0.0.1','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        context=await browser.new_context(viewport={'width':390,'height':844})
        await context.add_cookies([{'name':'office_session','value':expiry+'.'+signature,'domain':'office.arklyn.ir','path':'/','secure':True,'httpOnly':True,'sameSite':'Lax'}])
        page=await context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
        async def state():return await page.evaluate("JSON.parse(localStorage.getItem('arklyn-office-v3')||'null')")
        async def sync():await page.wait_for_function("()=>JSON.parse(localStorage.getItem('arklyn-office-v3')||'null')?.integrations?.phase==='synced'",timeout=60000)
        await page.goto('https://office.arklyn.ir/',wait_until='domcontentloaded');await sync()
        live=await page.evaluate("fetch('/api/integrations').then(r=>r.json())")
        names={r['id']:r['name'] for r in live['rooms']}
        async def check_avatars(expected=None):
            await page.wait_for_function("()=>{let nodes=[...document.querySelectorAll('[data-topic-room]')];return nodes.length>0 && nodes.every(n=>n.innerText.trim().length>0);}",timeout=30000)
            labels=await page.locator('[data-topic-room]').evaluate_all("nodes=>nodes.map(n=>({id:n.dataset.topicRoom,name:n.innerText.trim()}))")
            assert len(labels)==len({r['id'] for r in labels}) and len(labels)<=12,labels
            for row in labels:assert row['name']==names[row['id']],row
            if expected is not None:assert {r['id'] for r in labels}==set(expected)
            return labels
        await check_avatars()
        print('PASS actual topic names on scene, one avatar per topic, no duplicated seats',flush=True)
        await page.get_by_role('button',name='انتخاب تاپیک ها',exact=True).first.click()
        dialog=page.get_by_role('dialog')
        assert await dialog.locator('input[type=checkbox]').count()==len(names)
        await dialog.get_by_role('button',name='هیچ کدام',exact=True).click()
        for topic in ('23','7785'):await dialog.locator('[data-topic-choice="'+topic+'"]').check()
        assert await dialog.evaluate("n=>getComputedStyle(n).maxHeight!=='none' && n.getBoundingClientRect().bottom<=innerHeight"),'Picker must fit viewport and expose Save'
        await dialog.get_by_role('button',name='ذخیرهٔ انتخاب',exact=True).click(timeout=30000)
        await page.wait_for_function("()=>{let x=JSON.parse(localStorage.getItem('arklyn-office-v3'));return x?.visibleTopicIds?.length===2;}")
        await check_avatars(['tg-topic-23','tg-topic-7785'])
        await page.locator('[data-topic-room="tg-topic-23"]').click()
        await page.wait_for_function("()=>{let s=JSON.parse(localStorage.getItem('arklyn-office-v3'));return s.activeRoomId==='tg-topic-23' && s.rooms.find(r=>r.id===s.activeRoomId)?.telegram.historyLoaded;}",timeout=40000)
        s=await state();room=next(r for r in s['rooms'] if r['id']==s['activeRoomId'])
        assert len(room['messages'])>0 and s['targetAgentId'].startswith('tg-topic-23:')
        await page.get_by_role('button',name='Rooms',exact=True).click()
        shown=await page.locator('[data-room-id^="tg-topic-"]').evaluate_all("nodes=>nodes.map(n=>n.dataset.roomId)")
        assert set(shown)=={'tg-topic-23','tg-topic-7785'},shown
        await page.get_by_role('button',name='Close rooms',exact=True).click()
        print('PASS subset filters scene/room list; clicking topic avatar opens exact topic history and native send context',flush=True)
        await page.reload(wait_until='domcontentloaded');await sync()
        assert set((await state())['visibleTopicIds'])=={'23','7785'}
        await check_avatars(['tg-topic-23','tg-topic-7785'])
        for width,height in [(390,844),(1440,1000)]:
            await page.set_viewport_size({'width':width,'height':height});await page.wait_for_timeout(800)
            assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            await check_avatars(['tg-topic-23','tg-topic-7785'])
            await page.screenshot(path=f'/root/.hermes/cache/office-topic-selection-{width}.png')
        print('PASS preference retained after reload; desktop/mobile topic-name labels and no overflow',flush=True)
        await page.get_by_role('button',name='انتخاب تاپیک ها',exact=True).first.click()
        await page.get_by_role('dialog').get_by_role('button',name='هیچ کدام',exact=True).click()
        await page.get_by_role('dialog').get_by_role('button',name='ذخیرهٔ انتخاب',exact=True).click()
        await page.wait_for_function("()=>JSON.parse(localStorage.getItem('arklyn-office-v3')).visibleTopicIds?.length===0")
        assert await page.locator('[data-topic-room]').count()==0
        assert await page.locator('[data-testid=topic-thread]').count()==0
        assert await page.get_by_text('هیچ تاپیکی برای نمایش انتخاب نشده است.',exact=True).is_visible()
        s=await state();assert len([r for r in s['rooms'] if r.get('telegram')])==len(names)
        await page.reload(wait_until='domcontentloaded');await sync()
        assert (await state())['visibleTopicIds']==[]
        assert await page.locator('[data-topic-room]').count()==0
        print('PASS select-none is persistent and hides thread/composer without deleting topic data',flush=True)
        await page.get_by_role('button',name='انتخاب تاپیک ها',exact=True).first.click()
        await page.get_by_role('dialog').get_by_role('button',name='انتخاب همه',exact=True).click()
        await page.get_by_role('dialog').get_by_role('button',name='ذخیرهٔ انتخاب',exact=True).click()
        await page.wait_for_function("count=>JSON.parse(localStorage.getItem('arklyn-office-v3')).visibleTopicIds?.length===count",arg=len(names))
        await check_avatars()
        assert not errors,errors
        await browser.close();print('All topic representation/visibility checks passed.',flush=True)

asyncio.run(main())
