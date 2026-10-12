"""Deliver generated Office login only to owner DM; verify without duplicate sends."""
import asyncio
import json
from pathlib import Path
import urllib.request
from telethon import TelegramClient
from bridge import copy_session, read_env, USER_ID

async def main():
    env=read_env('/etc/arklyn-office/web.env')
    text='Arklyn Office\nhttps://office.arklyn.ir\n\nرمز ورود خصوصی شما:\n'+env['OFFICE_PASSWORD']+'\n\nاین رمز فقط برای ورود به Office است؛ آن را در گروه منتشر نکنید.'
    auth=json.loads(Path('/root/.telegram_sessions/auth_state.json').read_text())
    path=Path('/var/lib/arklyn-office/verify-credentials.session')
    copy_session('/root/.telegram_sessions/telethon_user.session',path)
    client=TelegramClient(str(path),int(auth['api_id']),auth['api_hash'],receive_updates=False)
    async with client:
        me=await client.get_me(); assert me.id==USER_ID
        bot=await client.get_entity('HoMoExBot')
        async def find_delivery():
            recent=await client.get_messages(bot,limit=15)
            return next((m for m in recent if m.raw_text==text and m.sender_id==bot.id),None)
        delivered=await find_delivery()
        if delivered is None:
            token=read_env('/root/.hermes/.env')['TELEGRAM_BOT_TOKEN']
            req=urllib.request.Request('https://api.telegram.org/bot'+token+'/sendMessage',
                data=json.dumps({'chat_id':USER_ID,'text':text,'disable_web_page_preview':True,'protect_content':True}).encode(),
                headers={'Content-Type':'application/json'})
            with urllib.request.urlopen(req,timeout=20) as res: result=json.load(res)
            assert result.get('ok') and result['result']['chat']['id']==USER_ID
            # Private-dialog message IDs differ between the bot and owner accounts.
            # Read back by exact content/sender in the owner's authenticated dialog.
            delivered=await find_delivery()
        assert delivered and delivered.raw_text==text and delivered.sender_id==bot.id
        user_mid=delivered.id
    for suffix in ['', '-journal','-wal','-shm']: Path(str(path)+suffix).unlink(missing_ok=True)
    report=Path('/opt/arklyn-office/integrations/credential-delivery.json')
    report.write_text(json.dumps({'ownerId':USER_ID,'ownerMessageId':user_mid,'verified':True}))
    report.chmod(0o600)
    print('PASS login credentials verified in owner private Telegram chat; ownerMessageId',user_mid)

asyncio.run(main())
