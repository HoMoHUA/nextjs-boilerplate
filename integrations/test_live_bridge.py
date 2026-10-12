"""Cache/history/live transport regressions. Fixtures never send Telegram messages."""
import asyncio
from datetime import datetime,timezone
from types import SimpleNamespace as NS
import unittest
from unittest.mock import AsyncMock
from aiohttp.test_utils import TestClient,TestServer
import bridge
from thread_cache import ThreadCache
import test_topic_bridge as fixtures

class LiveTests(unittest.IsolatedAsyncioTestCase):
    def make_broker(self):
        b=fixtures.TopicTests().broker();b.cache=ThreadCache(':memory:');return b
    def post(self,mid,body='message',topic='11',sender=300):
        return NS(id=mid,raw_text=body,sender_id=sender,sender=NS(first_name='Real member',last_name=None,bot=False),date=datetime.now(timezone.utc),reply_to=NS(forum_topic=True,reply_to_top_id=int(topic),reply_to_msg_id=int(topic)),photo=None,document=None)
    async def test_history_real_pagination_and_cache(self):
        b=self.make_broker();b.client.get_messages=AsyncMock(return_value=[self.post(i) for i in range(181,100,-1)])
        page=await b.history('tg-topic-11')
        self.assertEqual(len(page['messages']),80);self.assertTrue(page['hasMore']);self.assertEqual(page['before'],'102')
        self.assertEqual(page['messages'][0]['senderName'],'Real member')
        again=await b.history('tg-topic-11');self.assertEqual(again,page);b.client.get_messages.assert_awaited_once()
        b.client.get_messages=AsyncMock(return_value=[self.post(i) for i in range(101,95,-1)])
        older=await b.history('tg-topic-11','102');self.assertFalse(older['hasMore']);self.assertEqual(older['messages'][0]['id'],'96')
        self.assertEqual(b.client.get_messages.call_args.kwargs['offset_id'],102)
        b.cache.close()
    async def test_new_edit_delete_and_scope(self):
        b=self.make_broker();b.refresh_forum=AsyncMock()
        await b.on_message(NS(chat_id=bridge.GROUP_ID,message=self.post(99,'first')))
        self.assertEqual(b.cache.messages('11')[0]['content'],'first')
        await b.on_message(NS(chat_id=bridge.GROUP_ID,message=self.post(99,'edited')))
        self.assertEqual(b.cache.messages('11')[0]['content'],'edited')
        await b.on_message(NS(chat_id=-100123,message=self.post(100,'outside')))
        self.assertEqual(len(b.cache.messages('11')),1)
        await b.on_delete(NS(chat_id=bridge.GROUP_ID,deleted_ids=[99]))
        self.assertEqual(b.cache.messages('11'),[]);self.assertEqual(b.cache.removed('11'),['99'])
        b.store_post(self.post(99,'stale history'))
        self.assertEqual(b.cache.messages('11'),[])
        b.cache.close()
    async def test_stale_history_cannot_replace_newer_edit(self):
        b=self.make_broker()
        b.cache.put('11',{'id':'90','content':'edited','role':'user','ts':1000,'editedAt':2000})
        b.cache.put('11',{'id':'90','content':'stale','role':'user','ts':1000,'editedAt':1500})
        self.assertEqual(b.cache.messages('11')[0]['content'],'edited')
        b.cache.close()

    async def test_edit_of_older_loaded_history_is_in_live_snapshot(self):
        b=self.make_broker()
        for mid in range(100,221):b.store_post(self.post(mid,'original'))
        await b.snapshot()
        await b.on_message(NS(chat_id=bridge.GROUP_ID,message=self.post(120,'older edit')))
        snap=await b.snapshot()
        room=next(r for r in snap['rooms'] if r['topicId']=='11')
        self.assertTrue(any(m['id']=='120' and m['content']=='older edit' for m in room['messages']))
        b.cache.close()

    async def test_canonical_room_routes_selected_claude_backend(self):
        b=self.make_broker();b.client.send_message=AsyncMock(return_value=NS(id=200))
        post=self.post(200,'@claudebot hello');b.client.get_messages=AsyncMock(return_value=post)
        result=await b.send('tg-topic-11','hello','claude-code')
        self.assertEqual(result['messageId'],'200')
        self.assertTrue(b.client.send_message.call_args.args[1].startswith('@claudebot '))
        with self.assertRaises(bridge.BridgeError):await b.send('tg-topic-11','hello','other')
        b.cache.close()
    async def test_authenticated_sse_delivers_actual_new_snapshot(self):
        b=self.make_broker();key='x'*48
        async with TestClient(TestServer(bridge.make_app(b,key))) as client:
            response=await client.get('/stream');self.assertEqual(response.status,401)
            response=await client.get('/stream',headers={'Authorization':'Bearer '+key})
            self.assertEqual(response.status,200)
            async def next_snapshot():
                async with asyncio.timeout(4):
                    while True:
                        line=await response.content.readline()
                        if line.startswith(b'data: '):return line
            first=await next_snapshot();self.assertIn(b'tg-topic-11',first)
            await b.on_message(NS(chat_id=bridge.GROUP_ID,message=self.post(300,'live regression message')))
            update=await next_snapshot();self.assertIn(b'live regression message',update)
            response.close()
        b.cache.close()

if __name__=='__main__':unittest.main()
