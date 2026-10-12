"""Read-only projection of real workers under explicitly scoped parent sessions."""
import contextlib
import json
import re
import sqlite3
import time
from pathlib import Path
GROUP='-1004374108988'
OWNER='1763778996'

def collect_runtime_agents(hermes,claude,*,db_path=Path('/root/.hermes/state.db')):
    result={}
    try:
        with contextlib.closing(sqlite3.connect(Path(db_path).resolve().as_uri()+'?mode=ro',uri=True,timeout=2)) as db:
            db.row_factory=sqlite3.Row
            for topic,parent in hermes.items():
                sid=parent.get('sessionId')
                allowed=db.execute("SELECT id FROM sessions WHERE id=? AND source='telegram' AND CAST(chat_id AS TEXT)=? AND CAST(thread_id AS TEXT)=? AND CAST(user_id AS TEXT)=? AND COALESCE(hidden,0)=0",(sid,GROUP,str(topic),OWNER)).fetchone()
                if not allowed:continue
                rows=db.execute("SELECT id,title,ended_at,last_activity_at FROM sessions WHERE parent_session_id=? AND source='subagent' AND COALESCE(hidden,0)=0 ORDER BY started_at DESC LIMIT 8",(sid,)).fetchall()
                for row in rows:
                    result.setdefault(str(topic),[]).append({'id':'hermes-worker-'+row['id'],'name':'Worker '+row['id'].rsplit('_',1)[-1][-8:], 'title':'Hermes delegated task','backend':'hermes','kind':'subagent','status':'done' if row['ended_at'] is not None else 'working' if (row['last_activity_at'] or 0)>time.time()-1800 else 'idle','activity':'Delegated session ended' if row['ended_at'] is not None else 'Recorded delegated task'})
    except (sqlite3.Error,OSError):pass
    # Inspect only UUID parent traces assigned to this approved group/topic by the Claude bot.
    try:state=json.loads(Path('/root/claude_bot/session_state.json').read_text()).get('chat_sessions',{})
    except (OSError,ValueError):state={}
    for topic,parent in claude.items():
        sid=parent.get('sessionId','')
        if not re.fullmatch(r'[0-9a-fA-F-]{36}',sid):continue
        bound=state.get(GROUP+'_'+str(topic)) or (state.get(GROUP+'_0') if str(topic)=='1' else None)
        if bound!=sid:continue
        traces=list(Path('/root/.claude/projects').glob('*/'+sid+'.jsonl'))
        if not traces:continue
        agents={}
        try:
            with traces[0].open('rb') as f:
                size=f.seek(0,2);f.seek(max(0,size-524288));raw=f.read()
            for line in raw.decode('utf8','replace').splitlines():
                try:record=json.loads(line)
                except ValueError:continue
                if not isinstance(record,dict):continue
                blocks=(record.get('message') or {}).get('content',[])
                if not isinstance(blocks,list):continue
                for block in blocks:
                    if not isinstance(block,dict):continue
                    data=block.get('input') or {}
                    if block.get('type')=='tool_use' and block.get('name') in ('Agent','Task') and isinstance(data,dict) and isinstance(data.get('subagent_type'),str):
                        tid=block.get('id','')
                        if not isinstance(tid,str) or not re.fullmatch(r'[\w-]{1,150}',tid):continue
                        name=data['subagent_type']
                        if not re.fullmatch(r'[\w -]{1,80}',name):name='Claude worker'
                        agents[tid]={'id':'claude-worker-'+tid,'name':name,'title':'Claude Code delegated task','backend':'claude-code','kind':'subagent','status':'working' if traces[0].stat().st_mtime>time.time()-1800 else 'idle'}
                    elif block.get('type')=='tool_result' and block.get('tool_use_id') in agents:
                        content=block.get('content')
                        if not isinstance(content,str) or not content.startswith('Async agent launched'):
                            agents[block['tool_use_id']]['status']='done'
            result.setdefault(str(topic),[]).extend(list(agents.values())[-8:])
        except (OSError,TypeError):continue
    return result
