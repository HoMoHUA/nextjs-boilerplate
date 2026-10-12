"""Live Office acceptance checks; credentials stay on disk and out of output."""
import http.client
import json
import ssl
from pathlib import Path
from urllib.parse import urlencode

ENV = dict(line.split('=',1) for line in Path('/etc/arklyn-office/web.env').read_text().splitlines() if '=' in line)
COOKIE = ''
RESULTS = []

class LocalTLS(http.client.HTTPSConnection):
    def connect(self):
        import socket
        sock = socket.create_connection(('127.0.0.1',443),timeout=self.timeout)
        self.sock = self._context.wrap_socket(sock,server_hostname=self.host)

def request(path, method='GET', data=None, content_type=None, auth=False, timeout=180):
    conn = LocalTLS('office.arklyn.ir', timeout=timeout, context=ssl.create_default_context())
    headers = {'Host':'office.arklyn.ir'}
    if content_type: headers['Content-Type'] = content_type
    if auth: headers['Cookie'] = COOKIE
    conn.request(method,path,body=data,headers=headers)
    res = conn.getresponse()
    result=(res.status,dict(res.getheaders()),res.read().decode())
    conn.close()
    return result

def check(name, condition):
    RESULTS.append({'check':name,'pass':bool(condition)})
    print(('PASS ' if condition else 'FAIL ') + name,flush=True)
    if not condition: raise AssertionError(name)

status,headers,text=request('/api/health')
health=json.loads(text)
check('HTTPS certificate and public health',status==200 and health['app']=='arklyn-office' and health['auth'] is True)
status,_,text=request('/login')
check('Arklyn Office branded login',status==200 and 'Arklyn Office' in text and 'Hermes Office' not in text)
for path in ['/api/integrations','/api/integrations/history?roomId=tg-topic-1','/api/integrations/stream','/api/claude-code/agents','/api/hermes/health']:
    status,_,_=request(path)
    check('Unauthorized denied: '+path,status==401)
status,headers,_=request('/api/login','POST',urlencode({'password':ENV['OFFICE_PASSWORD'],'next':'/'}),'application/x-www-form-urlencoded')
COOKIE=headers.get('set-cookie','').split(';',1)[0]
check('Password login yields HttpOnly Secure session',status==303 and COOKIE and 'HttpOnly' in headers.get('set-cookie','') and 'Secure' in headers.get('set-cookie',''))
status,_,text=request('/',auth=True)
check('Authenticated Office page',status==200 and 'Arklyn Office' in text)
status,_,text=request('/api/integrations',auth=True)
snapshot=json.loads(text)
check('Real Arklin Team topics',status==200 and str(snapshot['group']['id'])=='-1004374108988' and len(snapshot['rooms'])>0)
check('Scope excludes other groups',all(r['id']=='tg-topic-'+r['topicId'] for r in snapshot['rooms']))
check('One canonical room per topic',len(snapshot['rooms'])==len({r['topicId'] for r in snapshot['rooms']}))
check('Rooms ordered by real message recency', [r['lastMessageAt'] for r in snapshot['rooms']]==sorted((r['lastMessageAt'] for r in snapshot['rooms']),reverse=True))
status,_,history_text=request('/api/integrations/history?roomId=tg-topic-7785',auth=True)
history=json.loads(history_text)
check('Selected topic canonical history',status==200 and history['roomId']=='tg-topic-7785' and len(history['messages'])>0 and all(m['id'].isdigit() for m in history['messages']))
print('Connected rooms:',len(snapshot['rooms']),'Bots:',json.dumps(snapshot['bots'],ensure_ascii=False),flush=True)
status,_,text=request('/api/claude-code/agents',auth=True)
check('Claude backend discovery',status==200 and json.loads(text).get('enabled') is True)
status,_,text=request('/api/hermes','POST',json.dumps({'messages':[{'role':'user','content':'Connectivity test only. Do not use tools. Reply exactly ARKLYN_OFFICE_HERMES_OK.'}]}),'application/json',auth=True)
chunks=[json.loads(line[6:]) for line in text.splitlines() if line.startswith('data: ') and line!='data: [DONE]']
answer=''.join(c.get('choices',[{}])[0].get('delta',{}).get('content','') for c in chunks)
check('Hermes replies through Office streaming proxy',status==200 and 'ARKLYN_OFFICE_HERMES_OK' in answer)
print('Hermes reply:',answer,flush=True)
status,_,text=request('/api/claude-code','POST',json.dumps({'prompt':'Connectivity test only. Do not use tools or edit anything. Reply exactly ARKLYN_OFFICE_CLAUDE_OK.','systemAppend':'','subagents':{}}),'application/json',auth=True)
events=[json.loads(line[6:]) for line in text.splitlines() if line.startswith('data: ')]
results=[e for e in events if e.get('type')=='result']
check('Claude Code replies through Office streaming proxy',status==200 and any(e.get('ok') and 'ARKLYN_OFFICE_CLAUDE_OK' in e.get('text','') for e in results))
print('Claude reply:',results[-1]['text'],flush=True)
check('Claude SSE completion',any(e.get('type')=='done' for e in events))
Path('/opt/arklyn-office/integrations/verification.json').write_text(json.dumps({'health':health,'checks':RESULTS,'roomCount':len(snapshot['rooms'])},indent=2))
print('All checks passed.',flush=True)
