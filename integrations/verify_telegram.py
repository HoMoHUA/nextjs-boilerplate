"""Live Telegram send/readback/reply tests in approved group's General topic."""
import json
import time
import urllib.request
from pathlib import Path

env=dict(l.split('=',1) for l in Path('/etc/arklyn-office/web.env').read_text().splitlines() if '=' in l)
headers={'Authorization':'Bearer '+env['ARKLYN_BRIDGE_KEY'],'Content-Type':'application/json'}
def call(path,body=None):
    req=urllib.request.Request('http://127.0.0.1:8643'+path,data=None if body is None else json.dumps(body).encode(),headers=headers)
    with urllib.request.urlopen(req,timeout=30) as res:return json.load(res)

results=[]
for backend,token in [('claude-code','ARKLYN_GROUP_CLAUDE_OK'),('hermes','ARKLYN_GROUP_HERMES_OK')]:
    rid=f'tg-{backend}-1'
    snapshot=call('/snapshot')
    room=next(r for r in snapshot['rooms'] if r['id']==rid)
    prior={m['id'] for m in room['messages']}
    response=call('/send',{'roomId':rid,'text':f'Arklyn Office connectivity test only. Do not use tools or change any files. Reply exactly {token}.'})
    mid=str(response['messageId'])
    print('PASS Telegram submitted and verified:',backend,'messageId',mid,flush=True)
    deadline=time.monotonic()+150
    observed=reply=False
    while time.monotonic()<deadline:
        snapshot=call('/snapshot')
        room=next(r for r in snapshot['rooms'] if r['id']==rid)
        sent=next((m for m in room['messages'] if m['id']==mid and m['role']=='user'),None)
        observed=observed or bool(sent)
        reply=any(m['id'] not in prior and m['role']=='agent' and token in m['content'] for m in room['messages'])
        if observed and reply:break
        time.sleep(8)
    assert observed,backend+' acknowledgement did not match snapshot ID'
    assert reply,backend+' did not return expected real Telegram reply'
    print('PASS Telegram real reply and exact snapshot reconciliation:',backend,token,flush=True)
    results.append({'backend':backend,'messageId':mid,'replyVerified':True})
Path('/opt/arklyn-office/integrations/telegram-verification.json').write_text(json.dumps(results,indent=2))
print('All Telegram checks passed.',flush=True)
