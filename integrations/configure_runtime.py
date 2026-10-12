"""Provision only the named Office service account/directories and secrets."""
from pathlib import Path
import os
import pwd
import secrets
import subprocess

try:
    user = pwd.getpwnam('arklyn-office')
except KeyError:
    subprocess.run(['useradd', '--system', '--create-home', '--home-dir', '/var/lib/arklyn-office', '--shell', '/usr/sbin/nologin', 'arklyn-office'], check=True)
    user = pwd.getpwnam('arklyn-office')
base = Path('/etc/arklyn-office')
base.mkdir(mode=0o750, exist_ok=True)
for folder in ['/var/lib/arklyn-office/workspace', '/var/www/office.arklyn.ir/.well-known/acme-challenge']:
    Path(folder).mkdir(parents=True, exist_ok=True)
os.chown('/var/lib/arklyn-office/workspace', user.pw_uid, user.pw_gid)
if (base / 'web.env').exists():
    raise SystemExit('Existing runtime secrets: refusing overwrite')
password = secrets.token_urlsafe(24)
bridge = secrets.token_hex(32)
hermes = secrets.token_hex(32)
web = {
    'NODE_ENV': 'production', 'HOSTNAME': '127.0.0.1', 'PORT': '3101',
    'OFFICE_PUBLIC_URL': 'https://office.arklyn.ir',
    'OFFICE_PASSWORD': password, 'OFFICE_SESSION_SECRET': secrets.token_hex(48),
    'HERMES_API_URL': 'http://127.0.0.1:8642/v1', 'HERMES_API_KEY': hermes,
    'HERMES_MODEL': 'gpt-6.1-sol', 'HERMES_PROVIDER': 'openai-codex',
    'CLAUDE_CODE_ENABLED': 'true', 'CLAUDE_CODE_PERMISSION_MODE': 'default',
    'CLAUDE_CODE_CWD': '/var/lib/arklyn-office/workspace',
    'CLAUDE_CODE_MAX_TURNS': '40',
    'ARKLYN_BRIDGE_URL': 'http://127.0.0.1:8643', 'ARKLYN_BRIDGE_KEY': bridge,
}
backend = {
    'ARKLYN_BRIDGE_KEY': bridge, 'ARKLYN_HERMES_KEY': hermes,
    'HERMES_HOME': '/root/.hermes', 'HOME': '/root', 'PYTHONUNBUFFERED': '1',
    'CLAUDE_CODE_CWD': '/var/lib/arklyn-office/workspace',
    'CLAUDE_CODE_PERMISSION_MODE': 'default', 'CLAUDE_CODE_MAX_TURNS': '40',
}
for name, values in [('web.env', web), ('backend.env', backend)]:
    target = base / name
    with target.open('x') as f:
        f.write(''.join(f'{k}={v}\n' for k,v in values.items()))
    target.chmod(0o600)
print('Created service account, isolated workspace, and root-only runtime secrets. No secret values printed.')
