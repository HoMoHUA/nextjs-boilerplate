"""Exercise the deployed client with isolated Chromium, no shared browser/config edits."""
import asyncio
import base64
import hashlib
import hmac
import json
from pathlib import Path
import time
from playwright.async_api import async_playwright

async def main():
    env=dict(l.split('=',1) for l in Path('/etc/arklyn-office/web.env').read_text().splitlines() if '=' in l)
    expires=str(int(time.time()*1000)+86400000)
    signature=base64.urlsafe_b64encode(hmac.new(env['OFFICE_SESSION_SECRET'].encode(),expires.encode(),hashlib.sha256).digest()).decode().rstrip('=')
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path='/root/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--host-resolver-rules=MAP office.arklyn.ir 127.0.0.1','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        context=await browser.new_context(viewport={'width':1440,'height':1000})
        await context.add_cookies([{'name':'office_session','value':expires+'.'+signature,'domain':'office.arklyn.ir','path':'/','secure':True,'httpOnly':True,'sameSite':'Lax'}])
        page=await context.new_page()
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        await page.goto('https://office.arklyn.ir/',wait_until='domcontentloaded')
        await page.wait_for_function("() => { const s=JSON.parse(localStorage.getItem('arklyn-office-v3')||'null'); return s?.integrations?.phase==='synced' && document.querySelector('canvas')?.clientWidth>0; }",timeout=60000)
        live=await page.evaluate("fetch('/api/integrations').then(r=>r.json())")
        expected=len(live['rooms'])
        assert expected==len({r['topicId'] for r in live['rooms']})
        for width,height,name in [(1440,1000,'desktop'),(390,844,'mobile')]:
            await page.set_viewport_size({'width':width,'height':height})
            await page.wait_for_timeout(1200)
            info=await page.evaluate("""() => {const s=JSON.parse(localStorage.getItem('arklyn-office-v3')); const c=document.querySelector('canvas'); return {title:document.title,roomCount:s.rooms.length,connected:s.rooms.filter(r=>r.telegram).length,active:s.activeRoomId,phase:s.integrations.phase,canvas:!!c&&c.clientWidth>0&&c.clientHeight>0,overflow:document.documentElement.scrollWidth>innerWidth,botConnected:s.integrations.bots.every(b=>b.ok),connectionText:document.body.innerText.includes('Telegram synced')};}""")
            assert info['title']=='Arklyn Office' and info['connected']==expected and info['canvas'] and not info['overflow'] and info['botConnected'] and info['connectionText'],info
            await page.screenshot(path=f'/opt/arklyn-office/integrations/qa-{name}.png')
            print('PASS browser '+name+': '+json.dumps(info),flush=True)
        assert not errors,errors
        print('PASS browser no uncaught client exceptions',flush=True)
        await browser.close()

asyncio.run(main())
