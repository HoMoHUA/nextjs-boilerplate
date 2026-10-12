"""Verify official logo and Hojat's Team label on the deployed UI."""
import asyncio
import base64
import hashlib
import hmac
from pathlib import Path
import time
from playwright.async_api import async_playwright

async def main():
    expected=Path('/root/.hermes/cache/arklyn-office-logo-source.svg').read_bytes()
    env=dict(l.split('=',1) for l in Path('/etc/arklyn-office/web.env').read_text().splitlines() if '=' in l)
    expires=str(int(time.time()*1000)+86400000)
    sig=base64.urlsafe_b64encode(hmac.new(env['OFFICE_SESSION_SECRET'].encode(),expires.encode(),hashlib.sha256).digest()).decode().rstrip('=')
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path='/root/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--host-resolver-rules=MAP office.arklyn.ir 127.0.0.1','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        context=await browser.new_context(viewport={'width':1440,'height':1000})
        page=await context.new_page()
        errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
        await page.goto('https://office.arklyn.ir/login',wait_until='domcontentloaded')
        for asset in ['arklyn-logo.svg','icon.svg']:
            response=await page.evaluate("async asset=>{let r=await fetch('/'+asset);return {status:r.status,bytes:Array.from(new Uint8Array(await r.arrayBuffer()))}}",asset)
            assert response['status']==200 and bytes(response['bytes'])==expected
            print('PASS exact original SVG anonymously served:',asset,flush=True)
        await page.goto('https://office.arklyn.ir/login',wait_until='domcontentloaded')
        await page.wait_for_function("() => {let i=document.querySelector('img[alt=\"Arklyn Office\"]'); return i?.complete&&i.naturalWidth>0;}")
        print('PASS official logo loaded on login',flush=True)
        await context.add_cookies([{'name':'office_session','value':expires+'.'+sig,'domain':'office.arklyn.ir','path':'/','secure':True,'httpOnly':True,'sameSite':'Lax'}])
        await page.goto('https://office.arklyn.ir/',wait_until='domcontentloaded')
        await page.wait_for_function("() => JSON.parse(localStorage.getItem('arklyn-office-v3')||'null')?.integrations?.phase==='synced'",timeout=60000)
        for width,height,name in [(1440,1000,'desktop'),(390,844,'mobile')]:
            await page.set_viewport_size({'width':width,'height':height})
            await page.wait_for_timeout(900)
            title=await page.locator('h1').inner_text()
            assert title=="Hojat's Team",title
            state=await page.evaluate("""() => {let i=document.querySelector('img[alt="Arklyn Office"]'); return {logo:i?.complete&&i.naturalWidth>0,fit:i&&getComputedStyle(i).objectFit,overflow:document.documentElement.scrollWidth>innerWidth,canvas:!!document.querySelector('canvas'),bg:i&&getComputedStyle(i.parentElement).backgroundColor};}""")
            assert state['logo'] and state['fit']=='contain' and not state['overflow'] and state['canvas'],state
            print('PASS '+name+': official logo visible, Hojat\'s Team title, no horizontal overflow',flush=True)
        assert not errors,errors
        await browser.close()
        print('All branding checks passed.',flush=True)

asyncio.run(main())
