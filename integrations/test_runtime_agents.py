"""Regression tests against scoped runtime records, not visual demo characters."""
import sqlite3
import tempfile
import time
import unittest
from pathlib import Path

try:
    from runtime_agents import collect_runtime_agents
except ImportError:
    def collect_runtime_agents(*args, **kwargs):
        return {}  # RED: production projection does not exist yet.

class RuntimeAgentTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.path=Path(self.tmp.name)/'state.db'
        self.db=sqlite3.connect(self.path)
        self.db.executescript('''CREATE TABLE sessions(id TEXT PRIMARY KEY,source TEXT,chat_id TEXT,
          thread_id TEXT,user_id TEXT,parent_session_id TEXT,hidden INTEGER,title TEXT,
          started_at REAL,ended_at REAL,end_reason TEXT,last_activity_at REAL);''')
        self.now=time.time()
        self.db.execute('INSERT INTO sessions VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
          ('parent','telegram','-1004374108988','11','1763778996',None,0,None,self.now,None,None,self.now))
        self.db.execute('INSERT INTO sessions VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
          ('actual-worker','subagent',None,None,None,'parent',0,'Research',self.now,None,None,self.now))
        self.db.commit()
    def tearDown(self):
        self.db.close();self.tmp.cleanup()
    def test_real_worker_inherits_only_approved_parent_topic(self):
        result=collect_runtime_agents({'11':{'sessionId':'parent'}},{},db_path=self.path)
        self.assertEqual(len(result.get('11',[])),1,'Actual scoped subagent must become an office character')
        agent=result['11'][0]
        self.assertEqual(agent['kind'],'subagent')
        self.assertEqual(agent['backend'],'hermes')
        self.assertEqual(agent['status'],'working')

if __name__=='__main__':unittest.main()
