"""Regression checks for narrowly scoped Claude bot integration routing."""
import asyncio
import importlib.util
from types import SimpleNamespace as NS
from unittest.mock import AsyncMock

spec=importlib.util.spec_from_file_location('claude_bot_live','/root/claude_bot/bot.py')
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

async def main():
    middleware=mod.ArklynRoutingMiddleware()
    def message(actor=1763778996, text='@ClaudeCode_pro_bot hello', group=-1004374108988, bot=False):
        return NS(chat=NS(id=group),from_user=NS(id=actor,is_bot=bot),text=text,reply_to_message=None)
    cases=[(message(),True),(message(text='@HoMoExBot hello'),False),
           (message(actor=999),False),(message(bot=True),False),
           (message(text='ordinary text'),False),
           (message(group=-1004381135749,text='existing group text'),True)]
    for event, expected in cases:
        handler=AsyncMock()
        await middleware(handler,event,{})
        assert bool(handler.await_count)==expected
    callback=NS(message=NS(chat=NS(id=-1004374108988)),from_user=NS(id=999,is_bot=False),data='new_session')
    handler=AsyncMock(); await middleware(handler,callback,{})
    assert not handler.await_count
    original=mod.STATE
    try:
        mod.STATE={'active_session_id':'other-group-session','chat_sessions':{}}
        assert mod.get_current_session_id(-1004374108988,7785)==''
        mod.STATE['chat_sessions']['-1004374108988_7785']='own-session'
        assert mod.get_current_session_id(-1004374108988,7785)=='own-session'
    finally: mod.STATE=original
    await mod.bot.session.close()
    print('PASS Claude routing: owner-only, explicit mention, callbacks, bot-loop exclusion, old group unchanged, isolated topic sessions')

asyncio.run(main())
