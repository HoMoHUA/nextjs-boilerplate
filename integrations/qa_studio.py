"""Local, isolated browser checks for the studio. Never contacts Telegram or models.

Uses an explicitly labelled six-person visual fixture in a fresh browser context;
it neither writes production data nor sends chat messages. Requires Playwright
and Chromium, for example CHROMIUM_BIN=/usr/bin/chromium python qa_studio.py.
"""
import argparse
import asyncio
import json
import os
from pathlib import Path
import shutil
import time

from playwright.async_api import async_playwright


def fixture():
    looks = [
        ("Ari", "#c99570", "#493428", "short", "#4b6450", True),
        ("Mina", "#ecc09b", "#292320", "bun", "#d9c6a5", False),
        ("Noah", "#805439", "#241f1b", "curly", "#5a6550", False),
        ("Sage", "#e6b48d", "#82432c", "bob", "#b67d5b", False),
        ("Rex", "#d7a879", "#a66a37", "fluffy", "#43574d", False),
        ("Uma", "#bc8663", "#302b27", "buzz", "#525b61", True),
    ]
    agents = [{"id": f"visual-{i}", "name": name, "title": "Visual fixture",
               "persona": "", "isLead": i == 0, "status": "idle",
               "look": {"skin": skin, "hair": hair, "hairStyle": style,
                        "shirt": shirt, "accent": "#e1d6bf", "pants": "#45473e", "glasses": glasses}}
              for i, (name, skin, hair, style, shirt, glasses) in enumerate(looks)]
    room = {"id": "studio-visual-fixture", "name": "Studio visual fixture", "emoji": "",
            "agents": agents, "messages": [], "steps": [], "approvals": [], "outputs": [],
            "startedAt": int(time.time() * 1000), "unread": False, "backend": "hermes"}
    return {"rooms": [room], "activeRoomId": room["id"], "view": "room", "selectedAgentId": agents[0]["id"],
            "targetAgentId": agents[0]["id"], "rightTab": "inspector", "schedules": [], "theme": "cream",
            "roomsCollapsed": True, "panelCollapsed": True, "focusOutputId": None, "fx": []}


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:3001")
    parser.add_argument("--output", default="/tmp/arklyn-studio-qa")
    args = parser.parse_args()
    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=os.environ.get("CHROMIUM_BIN") or shutil.which("chromium"),
            headless=True, args=["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        context = await browser.new_context(viewport={"width": 1600, "height": 1000}, device_scale_factor=1)
        await context.add_init_script("if (!localStorage.getItem('arklyn-office-v3')) localStorage.setItem('arklyn-office-v3', " + json.dumps(json.dumps(fixture())) + ");")
        async def api(route):
            path = route.request.url.split("/api/", 1)[1]
            if route.request.method != "GET":
                raise AssertionError("Visual QA must never send model or Telegram messages")
            if path == "integrations":
                body = {"group": {"id": "visual-only", "name": "Isolated visual fixture"}, "bots": [], "rooms": [], "updatedAt": int(time.time()*1000)}
            elif path == "hermes/health":
                body = {"ok": True, "mode": "demo"}
            elif path == "claude-code/agents":
                body = {"enabled": False, "agents": []}
            elif path == "integrations/stream":
                await route.fulfill(status=200, content_type="text/event-stream", body=": visual fixture\n\n")
                return
            else:
                body = {"ok": True}
            await route.fulfill(status=200, content_type="application/json", body=json.dumps(body))
        await context.route("**/api/**", api)
        page = await context.new_page()
        # First-time shader compilation is slow in CI's software renderer.
        page.set_default_timeout(60000)
        errors, console_errors, failed_assets, assets = [], [], [], set()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
        def response(r):
            if "/models/studio/" in r.url or "/textures/studio/" in r.url:
                assets.add(r.url.split("/", 3)[-1])
                if r.status != 200:
                    failed_assets.append((r.status, r.url))
        page.on("response", response)
        await page.goto(args.base_url, wait_until="domcontentloaded")
        await page.locator('canvas').wait_for(timeout=90000)
        await page.locator('button[title="Ari"]').wait_for(state="visible", timeout=120000)
        print("Studio models rendered", flush=True)
        await page.wait_for_timeout(1800)
        assert not failed_assets, failed_assets
        assert any(".glb" in asset for asset in assets), "Authored studio models were not loaded"
        assert any("oak.jpg" in asset for asset in assets), "Oak material was not loaded"
        assert await page.locator('button[title="Uma"]').is_visible()
        await page.screenshot(path=str(out / "desktop.png"))
        await page.locator("canvas").screenshot(path=str(out / "studio-scene.png"))
        results.append("Six articulated characters and local GLB/material assets rendered")
        print("Desktop captures saved", flush=True)

        await page.locator('button[title="Mina"]').click()
        await page.wait_for_function("JSON.parse(localStorage.getItem('arklyn-office-v3')).selectedAgentId === 'visual-1'")
        results.append("Character label selects its existing agent identity")
        await page.get_by_role("button", name="Manage team", exact=True).click()
        assert await page.get_by_placeholder("Name", exact=True).count() == 6
        await page.get_by_role("button", name="Close", exact=True).first.click()
        results.append("Existing team editor still opens with all six people")
        print("Selection and team editor passed", flush=True)

        await page.set_viewport_size({"width": 390, "height": 844})
        await page.locator('button[title="Mina"]').wait_for(state="visible")
        await page.wait_for_timeout(1200)
        assert await page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "Mobile horizontal overflow"
        assert await page.get_by_role("button", name="Rooms", exact=True).is_visible()
        assert await page.get_by_role("textbox").is_visible()
        for name in ["Ari", "Mina", "Noah", "Sage", "Rex", "Uma"]:
            bounds = await page.locator(f'button[title="{name}"]').bounding_box()
            assert bounds and bounds["x"] >= 0 and bounds["x"] + bounds["width"] <= 390, (name, bounds)
        await page.screenshot(path=str(out / "mobile.png"))
        await page.get_by_role("button", name="Rooms", exact=True).click()
        assert await page.get_by_role("button", name="Close rooms", exact=True).is_visible()
        await page.get_by_role("button", name="Close rooms", exact=True).click()
        results.append("Mobile scene, composer and room drawer fit and work at 390×844")
        print("Mobile layout and drawer passed", flush=True)
        await page.reload(wait_until="domcontentloaded")
        try:
            await page.locator('button[title="Mina"]').wait_for(state="visible", timeout=120000)
        except Exception:
            print(json.dumps({"page_errors": errors, "console_errors": console_errors, "failed_assets": failed_assets,
                              "visible_text": (await page.locator("body").inner_text())[-1200:]}, indent=2), flush=True)
            raise
        saved = await page.evaluate("JSON.parse(localStorage.getItem('arklyn-office-v3'))")
        assert saved["selectedAgentId"] == "visual-1"
        results.append("Selection and existing office state survive reload")
        assert not errors, errors
        assert not failed_assets, failed_assets
        report = {"fixture": "Isolated browser-only visual fixture, no real messages or credentials",
                  "checks": results, "page_errors": errors, "console_errors": console_errors, "failed_assets": failed_assets,
                  "loaded_assets": sorted(assets), "desktop": [1600, 1000], "mobile": [390, 844]}
        (out / "results.json").write_text(json.dumps(report, indent=2))
        print(json.dumps(report, indent=2))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
