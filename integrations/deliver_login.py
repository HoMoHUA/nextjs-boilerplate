"""Deliver generated Office login only to the owner's private Telegram chat."""
import asyncio
import json
from pathlib import Path
import urllib.request
from telethon import TelegramClient
from bridge import copy_session, read_env, USER_ID

async def main():
    env=read_env('/etc/arklyn-office/web.env')
    token=read_env('/root/.hermes/.env')['TELEGRAM_BOT_TOKEN']
    text='Arklyn Office\nhttps://office.arklyn.ir\n\nرمز ورود خصوصی شما:\n'+env['OFFICE_PASSWORD']+'\n\nاین رمز فقط برای ورود به Office است؛ آن را در گروه منتشر نکنید.'
    req=urllib.request.Request('https://api.telegram.org/bot'+token+'/sendMessage',
        data=json.dumps({'chat_id':USER_ID,'text':text,'disable_web_page_preview':True,'protect_content':True}).encode(),
        headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=20) as res: result=json.load(res)
    assert result.get('ok') and result['result']['chat']['id']==USER_ID
    mid=result['result']['message_id']
    auth=json.loads(Path('/root/.telegram_sessions/auth_state.json').read_text())
    path=Path('/var/lib/arklyn-office/verify-credentials.session')
    copy_session('/root/.telegram_sessions/telethon_user.session',path)
    client=TelegramClient(str(path),int(auth['api_id']),auth['api_hash'],receive_updates=False)
    async with client:
        me=await client.get_me(); assert me.id==USER_ID
        bot=await client.get_entity('HoMoExBot')
        delivered=await client.get_messages(bot,ids=mid)
        assert delivered and delivered.raw_text==text and delivered.sender_id==bot.id
    for suffix in ['', '-journal','-wal','-shm']: Path(str(path)+suffix).unlink(missing_ok=True)
    Path('/opt/arklyn-office/integrations/credential-delivery.json').write_text(json.dumps({'ownerId':USER_ID,'messageId':mid,'verified':True}))
    print('PASS login credentials delivered and read back in owner private Telegram chat; messageId',mid)

asyncio.run(main())
