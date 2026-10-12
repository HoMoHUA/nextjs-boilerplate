"""Bounded live adapter smoke test; never print secrets."""
import json
from pathlib import Path
import urllib.request

values = dict(line.split('=', 1) for line in Path('/etc/arklyn-office/web.env').read_text().splitlines() if '=' in line)
req = urllib.request.Request('http://127.0.0.1:8642/v1/chat/completions',
    data=json.dumps({'model': values['HERMES_MODEL'], 'provider': values['HERMES_PROVIDER'],
                    'messages': [{'role': 'user', 'content': 'This is a connectivity smoke test. Do not use any tools or edit anything. Reply exactly ARKLYN_HERMES_OK.'}],
                    'stream': False}).encode(),
    headers={'Authorization': 'Bearer ' + values['HERMES_API_KEY'], 'Content-Type': 'application/json'})
with urllib.request.urlopen(req, timeout=180) as res:
    data = json.load(res)
text = data['choices'][0]['message']['content']
assert 'ARKLYN_HERMES_OK' in text, text
print('PASS Hermes real response:', text)
print('Resolved runtime:', json.dumps(data.get('runtime'), ensure_ascii=False))
