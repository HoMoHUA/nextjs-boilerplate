"""Deployed topic UI and optional actual bot new/edit/delete probe; no model prompts."""
import asyncio,base64,hashlib,hmac,json,re,time,uuid,urllib.request
from pathlib import Path
from playwright.async_api import async_playwright
GROUP=-1004374108988

def env(path):return dict(line.split('=',1) for line in Path(path).read_text().splitlines() if '=' in line and not line.startswith('#'))
def bot_call(method,payload):
    token=env('/root/.hermes/.env')['TELEGRAM_BOT_TOKEN'].strip().strip('\"').strip("'")
    try:
        req=urllib.request.Request('https://api.telegram.org/bot'+token+'/'+method,data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'})
        with urllib.request.urlopen(req,timeout=30) as response:value=json.load(response)
    except Exception:raise RuntimeError('Bot API diagnostic request unavailable') from None
    if not value.get('ok'):raise RuntimeError('Bot API diagnostic operation refused')
    return value['result']

async def main():
    settings=env('/etc/arklyn-office/web.env')
    expires=str(int(time.time()*1000)+600000)
    sig=base64.urlsafe_b64encode(hmac.new(settings['OFFICE_SESSION_SECRET'].encode(),expires.encode(),hashlib.sha256).digest()).decode().rstrip('=')
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path='/root/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--host-resolver-rules=MAP office.arklyn.ir 127.0.0.1','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        context=await browser.new_context(viewport={'width':1440,'height':1000})
        await context.add_cookies([{'name':'office_session','value':expires+'.'+sig,'domain':'office.arklyn.ir','path':'/','secure':True,'httpOnly':True,'sameSite':'Lax'}])
        page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        await page.goto('https://office.arklyn.ir/',wait_until='domcontentloaded')
        await page.wait_for_function("()=>{let s=JSON.parse(localStorage.getItem('arklyn-office-v3')||'null');return s?.integrations?.phase==='synced' && s.rooms.find(r=>r.id===s.activeRoomId)?.telegram?.historyLoaded;}",timeout=60000)
        state=await page.evaluate("JSON.parse(localStorage.getItem('arklyn-office-v3'))")
        active=state['activeRoomId'];room=next(r for r in state['rooms'] if r['id']==active)
        live=await page.evaluate("fetch('/api/integrations').then(r=>r.json())")
        connected=[r for r in state['rooms'] if r.get('telegram')]
        assert len(connected)==len(live['rooms'])==len({r['telegram']['topicId'] for r in connected})
        assert [r['lastMessageAt'] for r in connected]==sorted((r['lastMessageAt'] for r in connected),reverse=True)
        assert room['name']=="Hojat's Team" and state['rightTab']=='thread' and len(room['agents'])>=2
        assert len(room['messages'])>0 and all(m['id'].isdigit() for m in room['messages'])
        assert await page.locator('[data-testid=topic-thread] [data-message-id]').count()==len(room['messages'])
        print('PASS actual topic count/order, canonical thread and runtime actors:',len(connected),len(room['messages']),len(room['agents']),flush=True)
        await page.get_by_role('button',name='@Hermes',exact=True).click()
        await page.get_by_role('button',name=re.compile('@Claude Code')).click()
        await page.wait_for_function("()=>JSON.parse(localStorage.getItem('arklyn-office-v3')).targetAgentId.endsWith(':claude-code')")
        print('PASS same-topic actual Claude target selection, no model request sent',flush=True)
        older=page.get_by_role('button',name='Load older messages',exact=True)
        pagination_room=active
        if not await older.count():
            candidate=next((r for r in live['rooms'] if r['topicId']=='23'),None)
            if candidate:
                pagination_room=candidate['id']
                await page.locator('[data-room-id="'+pagination_room+'"]').click()
                await page.wait_for_function("id=>{let s=JSON.parse(localStorage.getItem('arklyn-office-v3'));return s.activeRoomId===id && s.rooms.find(r=>r.id===id)?.telegram.historyLoaded;}",arg=pagination_room,timeout=40000)
                room=await page.evaluate("(()=>{let s=JSON.parse(localStorage.getItem('arklyn-office-v3'));return s.rooms.find(r=>r.id===s.activeRoomId)})()")
        if await older.count():
            count=len(room['messages']);await older.click()
            await page.wait_for_function("old=>{let s=JSON.parse(localStorage.getItem('arklyn-office-v3'));let r=s.rooms.find(r=>r.id===s.activeRoomId);return r.telegram.historyLoaded&&!r.telegram.historyLoading&&r.messages.length>old;}",arg=count,timeout=40000)
            loaded=await page.evaluate("(()=>{let s=JSON.parse(localStorage.getItem('arklyn-office-v3'));return s.rooms.find(r=>r.id===s.activeRoomId).messages})()")
            assert len(loaded)==len({m['id'] for m in loaded})
            print('PASS real older history pagination, stable canonical IDs:',len(loaded),flush=True)
        if pagination_room!=active:
            await page.locator('[data-room-id="'+active+'"]').click()
            await page.wait_for_function("id=>JSON.parse(localStorage.getItem('arklyn-office-v3')).activeRoomId===id",arg=active)
        for width,height in [(1440,1000),(768,1024),(390,844),(360,800)]:
            await page.set_viewport_size({'width':width,'height':height});await page.wait_for_timeout(700)
            assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            assert await page.locator('canvas').count()==1
            if width==1440:
                bounds=await page.locator('canvas').bounding_box()
                labels=page.get_by_role('button',name=re.compile(r'(?:LEAD|AGENT \d+)$'))
                for label in await labels.all():
                    box=await label.bounding_box()
                    assert box and box['x']>=bounds['x']-4 and box['x']+box['width']<=bounds['x']+bounds['width']+4, 'Agent label clipped outside the office canvas'
            if width in (1440,390):await page.screenshot(path=f'/root/.hermes/cache/office-topics-{width}.png')
        await page.set_viewport_size({'width':1440,'height':1000})
        print('PASS desktop/tablet/narrow mobile thread/scene: no horizontal overflow',flush=True)
        target=next(r for r in reversed(live['rooms']) if r['topicId'] not in ('1','7785'))
        text='[Office QA temporary live check] '+uuid.uuid4().hex
        mid=None
        try:
            result=await asyncio.to_thread(bot_call,'sendMessage',{'chat_id':GROUP,'message_thread_id':int(target['topicId']),'text':text,'disable_notification':True})
            mid=str(result['message_id'])
            await page.wait_for_function("p=>{let s=JSON.parse(localStorage.getItem('arklyn-office-v3'));return s.rooms[0].id===p.room && s.rooms.find(r=>r.id===p.room)?.messages.some(m=>m.id===p.mid&&m.content===p.text);}",arg={'room':target['id'],'mid':mid,'text':text},timeout=20000)
            assert await page.evaluate("JSON.parse(localStorage.getItem('arklyn-office-v3')).activeRoomId")==active
            print('PASS actual Telegram new message streamed and room moved to top without refresh or losing selection',flush=True)
            changed=text+' · edited'
            await asyncio.to_thread(bot_call,'editMessageText',{'chat_id':GROUP,'message_id':int(mid),'text':changed})
            await page.wait_for_function("p=>JSON.parse(localStorage.getItem('arklyn-office-v3')).rooms.find(r=>r.id===p.room)?.messages.some(m=>m.id===p.mid&&m.content===p.text)",arg={'room':target['id'],'mid':mid,'text':changed},timeout=20000)
            print('PASS actual Telegram edit streamed',flush=True)
        finally:
            if mid:
                deleted=await asyncio.to_thread(bot_call,'deleteMessage',{'chat_id':GROUP,'message_id':int(mid)})
                assert deleted is True
                await page.wait_for_function("p=>!JSON.parse(localStorage.getItem('arklyn-office-v3')).rooms.find(r=>r.id===p.room)?.messages.some(m=>m.id===p.mid)",arg={'room':target['id'],'mid':mid},timeout=20000)
                print('PASS actual Telegram delete streamed; temporary diagnostic message removed',flush=True)
        assert not errors,errors
        await browser.close();print('All topic live checks passed.',flush=True)

asyncio.run(main())
