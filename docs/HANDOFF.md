# Hermes Office — Production Handoff (runbook for the hermes agent)

> **برای صاحب پروژه (فارسی):** این فایل دستورالعمل اجرایی برای بات hermes است. بات با خواندن آن، پیش‌نیازها را بررسی می‌کند، از شما دامنه و ایمیل می‌پرسد، اپ را با Docker و Caddy (HTTPS خودکار) روی دامنه بالا می‌آورد، API سرور hermes را وصل می‌کند و در پایان آدرس و رمز ورود را به شما می‌دهد. تنها کار دستی شما: ساختن رکورد DNS از نوع A برای دامنه که به IP سرور اشاره کند.

---

## 0. Your mission (agent)

You are deploying **Hermes Office** — a Next.js web app — on **this Linux server** (the one you, hermes-agent, run on) and putting it live on **HTTPS at the owner's domain**. The office talks to **your own API server** (hermes-agent's OpenAI-compatible API on `127.0.0.1:8642`), so the owner can chat with agent teams powered by you.

Done means: `https://<DOMAIN>` shows a login page, the owner can sign in with the password you give them, and `deploy/verify.sh` prints **All checks passed** including the "hermes-agent replies" check.

Rules:
* Work step by step, run the check after every step, and stop to ask the owner when a check fails and the fix needs their input (DNS, credentials, a paid server, deleting something).
* Never print or send secrets except the final office password to the owner. Never commit `deploy/.env.production`.
* Do not enable the Claude Code backend unless the owner explicitly asks (it executes code on the server; see §9).
* **Restarting your own gateway disconnects you from Telegram.** Do step 5 (hermes API server) last and warn the owner first (§5).

## 1. Ask the owner (one message)

Collect before touching the server:

1. **DOMAIN** — full hostname, e.g. `office.example.com`.
2. **EMAIL** — for Let's Encrypt certificate notices.
3. **Password** — or say "generate" and you will create a strong one.
4. Confirm they can create a **DNS A record** `DOMAIN → <server public IP>` (tell them the IP: `curl -4 https://api.ipify.org`). If they use Cloudflare, the record must be **DNS only (grey cloud)** during setup.

## 2. Preflight checks

Run and record the results:

```bash
uname -a; cat /etc/os-release | head -3        # need Debian 11+/Ubuntu 20.04+ (apt)
sudo -n true && echo "sudo ok"                   # need root or passwordless sudo
nproc; free -h; df -h /                          # need ≥1 vCPU, ≥2 GB RAM (or swap), ≥6 GB free disk
curl -4 -s https://api.ipify.org; echo           # public IPv4 (give it to the owner for DNS)
sudo ss -ltnp | grep -E ':(80|443|3000)\b' || echo "ports free"
```

* No sudo → ask the owner to grant it or run the commands themselves.
* < 2 GB RAM → add swap before building: `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab`.
* Ports 80/443 used by nginx/apache → ask the owner whether to stop it (`sudo systemctl disable --now nginx`) or to keep it and proxy the domain to `127.0.0.1:3000` themselves (then use `--mode bare` and skip Caddy).
* If this machine has **no public IP** (home PC, behind NAT) → stop: the owner needs a VPS (any $5 Linux VPS works) or a tunnel; tell them.

## 3. Put the code on the server

Target directory: `/opt/hermes-office`.

* **From the zip the owner sent you:** locate the file you received (`hermes-office.zip`), then:
  ```bash
  sudo mkdir -p /opt/hermes-office && sudo unzip -o <path-to>/hermes-office.zip -d /opt/hermes-office
  ls /opt/hermes-office   # expect: app components lib deploy docs Dockerfile package.json …
  ```
  If the zip extracted into a sub-folder, move its contents up so `/opt/hermes-office/package.json` exists. If you cannot find the attachment on disk, ask the owner to send it again or to give you a download link.
* **Or from Git** (if the owner gives access): `sudo git clone -b Office https://github.com/HoMoHUA/nextjs-boilerplate /opt/hermes-office`.

## 4. DNS

Ask the owner to create the A record, then verify (repeat until it matches; propagation can take a few minutes):

```bash
dig +short A <DOMAIN>          # must print the server public IP
```

## 5. Enable your API server (hermes-agent)

The office needs hermes-agent's OpenAI-compatible API server. Check first — it may already be on:

```bash
grep -E '^API_SERVER_' ~/.hermes/.env 2>/dev/null
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8642/v1/models
```

If it is not enabled:

1. Generate a key: `openssl rand -hex 24` → call it HERMES_KEY.
2. Add to `~/.hermes/.env` (keep the default local bind — do **not** expose 8642 publicly):
   ```
   API_SERVER_ENABLED=true
   API_SERVER_KEY=<HERMES_KEY>
   API_SERVER_HOST=127.0.0.1
   API_SERVER_PORT=8642
   ```
   (Variable names per hermes-agent's API-server docs; if your installed version uses different names, check `hermes --help` / its docs and adapt.)
3. The gateway reads this at start. **Before restarting it, message the owner:** "I'm restarting my gateway to enable the API server. I'll be offline for ~30 seconds. When I'm back, send me: *continue the Hermes Office deploy from step 6*." Find out how your gateway runs (systemd unit, `tmux`/`screen`, Docker, or a manual `hermes gateway`) and restart it that way. If you are unsure how to restart yourself safely, ask the owner to do it.
4. After restart verify: `curl -s -H "Authorization: Bearer <HERMES_KEY>" http://127.0.0.1:8642/v1/models` returns JSON.

Pass the key to setup with `--hermes-key` (it is stored only in `deploy/.env.production`, mode 600).

> If you prefer not to restart now, continue with step 6 anyway: the office runs and shows "offline" for hermes rooms until the API server is up; re-run `deploy/verify.sh` afterwards.

## 6. Deploy

Docker (recommended — Caddy gets the HTTPS certificate automatically):

```bash
cd /opt/hermes-office
sudo deploy/setup.sh --domain <DOMAIN> --email <EMAIL> \
     --password '<PASSWORD or omit to generate>' \
     --hermes-url http://127.0.0.1:8642/v1 --hermes-key '<HERMES_KEY>'
```

* First build takes 3–8 minutes. The script is idempotent — rerun it after fixing any error.
* Without Docker you can use `--mode bare` (Node 22 + systemd + Caddy from apt).
* What it does: writes `deploy/.env.production` (generates `OFFICE_SESSION_SECRET`, and the password if omitted), checks DNS and ports, installs Docker if missing, builds the image, starts `app` + `caddy` (host network), waits for `http://127.0.0.1:3000/api/health` and then `https://<DOMAIN>/api/health`.
* At the end it prints the URL and (if generated) the password.

## 7. Verify (must pass)

```bash
cd /opt/hermes-office
sudo deploy/verify.sh --domain <DOMAIN> --password '<PASSWORD>'
```

Expected:
```
  PASS  local app answers /api/health
  PASS  HTTPS certificate is valid
  PASS  login page loads
  PASS  office requires login (API returns 401)
  PASS  password signs in
  PASS  office page loads after sign-in
  PASS  hermes-agent replies through the office (streaming)
All checks passed.
```
`health` should show `"auth":true,"hermes":"live"`.

## 8. Report to the owner

Send one message:

* URL `https://<DOMAIN>` and the password (only now, only to the owner).
* "Works on phone too — add it to your home screen."
* The rooms are stored per browser (each device starts with its own office state).
* How to update / where the logs are (§10).

## 9. Optional: Claude Code backend (only if the owner asks)

Runs Claude Code with subagents on this server — it can read/edit files and run commands in `CLAUDE_CODE_CWD`. Requirements: a Claude Code login (`claude` CLI login or `ANTHROPIC_API_KEY`) for the app user, and a project directory to work in.

Docker: in `deploy/.env.production` set `WITH_CLAUDE_CODE=true`, `CLAUDE_CODE_ENABLED=true`, `CLAUDE_CODE_CWD=/srv/<repo>` and either `ANTHROPIC_API_KEY=...` or mount the login; uncomment the `volumes:` in `deploy/docker-compose.yml` (project dir + `/home/office/.claude`), then `sudo deploy/update.sh`. Keep `CLAUDE_CODE_PERMISSION_MODE=acceptEdits` (or `plan`), never `bypassPermissions` on a public server.

## 10. Operations

| Task | Command (from `/opt/hermes-office`) |
| --- | --- |
| Status | `cd deploy && sudo docker compose --env-file .env.production ps` |
| Logs | `cd deploy && sudo docker compose --env-file .env.production logs -f app` (or `caddy`) · bare: `journalctl -u hermes-office -f` |
| Restart | `cd deploy && sudo docker compose --env-file .env.production restart app` |
| Update to a new zip | unzip over `/opt/hermes-office` (keeps `deploy/.env.production`), then `sudo deploy/update.sh` |
| Change password | edit `OFFICE_PASSWORD` in `deploy/.env.production` → `sudo deploy/update.sh` (also change `OFFICE_SESSION_SECRET` to sign everyone out) |
| Backup | `deploy/.env.production` is the only server-side state |
| Uninstall | `cd deploy && sudo docker compose --env-file .env.production down -v && sudo rm -rf /opt/hermes-office` |

## 11. Troubleshooting

| Symptom | Cause → fix |
| --- | --- |
| setup stops at DNS | A record missing/wrong or Cloudflare proxy on → fix DNS, wait, rerun |
| HTTPS never becomes ready | port 80/443 blocked by cloud firewall (security group) or another web server → open ports / stop it; `docker compose logs caddy` |
| `npm ci` / build killed | out of memory → add swap (§2), rerun |
| Header shows **offline** for hermes rooms | API server not running or wrong key → §5; test with the curl in §5.4 |
| Replies cut off / arrive all at once | something buffers SSE (extra proxy/CDN) → disable buffering; Caddy already uses `flush_interval -1` |
| Login loops back to /login | not on HTTPS (secure cookie) → use the HTTPS URL |
| "Too many attempts" | 8 wrong passwords in 10 min from one IP → wait, or restart the app |
| 502 from Caddy | app crashed → `docker compose logs app`; check `.env.production` syntax |

## 12. Rollback

Keep the previous folder before updating (`sudo cp -a /opt/hermes-office /opt/hermes-office.prev`). To roll back: `sudo rm -rf /opt/hermes-office && sudo mv /opt/hermes-office.prev /opt/hermes-office && sudo deploy/update.sh`.
