"""Private canonical Telegram cache. Only the broker writes approved group data."""
import json
import os
import sqlite3
from pathlib import Path

class ThreadCache:
    def __init__(self, path):
        path=Path(path)
        self.db=sqlite3.connect(str(path))
        if str(path) != ':memory:': os.chmod(path,0o600)
        self.db.execute('CREATE TABLE IF NOT EXISTS posts(id INTEGER PRIMARY KEY,topic TEXT NOT NULL,ts REAL NOT NULL,body TEXT NOT NULL)')
        self.db.execute('CREATE INDEX IF NOT EXISTS posts_topic ON posts(topic,id)')
        self.db.execute('CREATE TABLE IF NOT EXISTS removed(id INTEGER PRIMARY KEY,topic TEXT NOT NULL)')
        self.db.commit()
    def put(self,topic,message):
        mid=int(message['id'])
        previous=self.db.execute('SELECT body FROM posts WHERE id=?',(mid,)).fetchone()
        if previous:
            old=json.loads(previous[0])
            if old.get('editedAt',old['ts'])>message.get('editedAt',message['ts']):return
        if self.db.execute('SELECT 1 FROM removed WHERE id=?',(mid,)).fetchone():return
        self.db.execute('INSERT OR REPLACE INTO posts VALUES(?,?,?,?)',(mid,str(topic),message['ts'],json.dumps(message,ensure_ascii=False)))
        self.db.execute('DELETE FROM posts WHERE id NOT IN (SELECT id FROM posts ORDER BY id DESC LIMIT 20000)')
        self.db.commit()
    def delete(self,ids):
        topics=set()
        for mid in ids:
            row=self.db.execute('SELECT topic FROM posts WHERE id=?',(int(mid),)).fetchone()
            if row:topics.add(row[0])
            self.db.execute('INSERT OR REPLACE INTO removed VALUES(?,?)',(int(mid),row[0] if row else '*'))
            self.db.execute('DELETE FROM posts WHERE id=?',(int(mid),))
        self.db.execute('DELETE FROM removed WHERE id NOT IN (SELECT id FROM removed ORDER BY id DESC LIMIT 4000)')
        self.db.commit()
        return topics
    def messages(self,topic,limit=80):
        rows=self.db.execute('SELECT body FROM posts WHERE topic=? ORDER BY id DESC LIMIT ?',(str(topic),limit)).fetchall()
        return [json.loads(r[0]) for r in reversed(rows)]
    def removed(self,topic):
        return [str(r[0]) for r in self.db.execute('SELECT id FROM removed WHERE topic IN (?,?)',(str(topic),'*'))]
    def close(self):self.db.close()
