"""Local deterministic topic regressions; no Telegram sends."""
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace as NS
import tempfile
import unittest
from unittest.mock import AsyncMock, patch
import bridge
import test_bridge


class TopicTests(unittest.IsolatedAsyncioTestCase):
    def broker(self):
        b = test_bridge.BrokerTests().make_broker()
        b.read_local = lambda: ({}, {})
        b.bots[1]['ok'] = True
        b.bot_ids = {'hermes': 100, 'claude-code': 200}
        b.recent_messages = AsyncMock(return_value=[])
        return b

    async def test_one_stable_room_per_topic_sorted_by_real_recency(self):
        b = self.broker()
        b.topics['1'].update(lastMessageAt=1000, lastMessageId='2')
        b.topics['11'].update(lastMessageAt=9000, lastMessageId='99')
        snap = await b.snapshot()
        self.assertEqual([r['id'] for r in snap['rooms']], ['tg-topic-11', 'tg-topic-1'])
        self.assertEqual(snap['rooms'][0]['lastMessageAt'], 9000)
        self.assertEqual([a['id'] for a in snap['rooms'][0]['agents']], ['hermes', 'claude-code'])
        b.recent_messages.assert_not_awaited()  # snapshots never poll every topic

    async def test_topic_recency_uses_top_message_not_creation(self):
        old = datetime(2020, 1, 1, tzinfo=timezone.utc)
        new = datetime(2026, 1, 1, tzinfo=timezone.utc)
        topic = NS(id=11, title='Design', date=old, top_message=900, closed=False)
        general = NS(id=1, title='General', date=old, top_message=800, closed=False)
        client = AsyncMock(side_effect=[NS(topics=[topic], messages=[NS(id=900, date=new, raw_text='latest')]),
                                        NS(topics=[general], messages=[NS(id=800, date=old, raw_text='general')])])
        topics = await bridge.list_topics(client, NS())
        self.assertEqual(topics['11']['lastMessageAt'], new.timestamp() * 1000)
        self.assertEqual(topics['11']['lastMessageId'], '900')
        self.assertEqual(topics['11']['preview'], 'latest')
        self.assertEqual(topics['1']['lastMessageId'], '800')
