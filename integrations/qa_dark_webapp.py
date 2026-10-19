"""Isolated production-browser checks. Never sends model or Telegram requests."""
import argparse
import asyncio
import json
import re
import shutil
import struct
import time
from pathlib import Path
from playwright.async_api import async_playwright
from qa_studio import fixture


def contrast(a, b):
    def luminance(color):
        if len(color) == 4:
            color = "#" + "".join(char * 2 for char in color[1:])
        parts = [int(color[i:i+2], 16)/255 for i in (1, 3, 5)]
        parts = [c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in parts]
        return sum(c*w for c, w in zip(parts, (.2126, .7152, .0722)))
    x, y = sorted([luminance(a), luminance(b)])
    return (y+.05)/(x+.05)


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:3005")
    parser.add_argument("--output", default="/tmp/arklyn-dark-webapp-qa")
    args = parser.parse_args()
    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    state = fixture()
    state.update(colorMode="dark", motionPreference="reduced")
    checks, errors, online_console_errors, ratios = [], [], [], {}
    offline_phase = False
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=shutil.which("chromium"), headless=True,
            args=["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        context = await browser.new_context(viewport={"width": 1600, "height": 1000}, device_scale_factor=1, color_scheme="light")
        await context.add_init_script("if (!localStorage.getItem('arklyn-office-v3')) localStorage.setItem('arklyn-office-v3', " + json.dumps(json.dumps(state)) + ");")
        async def api(route):
            assert route.request.method == "GET", "QA must never send model or Telegram requests"
            path = route.request.url.split("/api/", 1)[1]
            if path == "integrations":
                body = {"group": {"id": "visual-only", "name": "Isolated visual fixture"}, "bots": [], "rooms": [], "updatedAt": int(time.time()*1000)}
            elif path == "integrations/stream":
                await route.fulfill(status=200, content_type="text/event-stream", body=": visual fixture\n\n")
                return
            elif path == "hermes/health":
                body = {"ok": True, "mode": "demo"}
            elif path == "claude-code/agents":
                body = {"enabled": False, "agents": []}
            else:
                body = {"ok": True}
            await route.fulfill(status=200, content_type="application/json", body=json.dumps(body))
        await context.route("**/api/**", api)
        page = await context.new_page()
        page.set_default_timeout(90000)
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("console", lambda message: online_console_errors.append(message.text) if message.type == "error" and not offline_phase else None)
        await page.goto(args.base_url, wait_until="domcontentloaded")
        await page.locator('button[title="Ari"]').wait_for(state="visible", timeout=180000)
        await page.wait_for_function("document.documentElement.dataset.colorMode === 'dark'")
        assert await page.locator('[data-scene-mode="dark"]').count() == 1
        await page.screenshot(path=str(out / "dark-desktop.png"))
        await page.locator("canvas").screenshot(path=str(out / "dark-scene.png"))
        checks.append("Saved Dark overrides light OS; actual studio models render with night profile")
        print("Dark studio rendered and captured", flush=True)

        async def mode(name):
            await page.get_by_role("button", name=re.compile(f"^{name}$", re.I)).click()
        async def colors(label):
            palette = await page.evaluate("Object.fromEntries(['ink','muted','surface','inset','canvas'].map(k=>[k,getComputedStyle(document.documentElement).getPropertyValue('--'+k).trim()]))")
            values = {f"{a}/{b}": round(contrast(palette[a], palette[b]), 2) for a in ("ink", "muted") for b in ("surface", "inset", "canvas")}
            assert min(values.values()) >= 4.5, values
            ratios[label] = values
        await colors("dark")
        await page.get_by_role("button", name="Theme", exact=True).click()
        await page.get_by_role("dialog", name="Office theme").wait_for()
        await mode("light")
        await page.wait_for_function("document.documentElement.dataset.colorMode === 'light'")
        await colors("light")
        await page.emulate_media(color_scheme="dark")
        assert await page.locator('[data-scene-mode="light"]').count() == 1
        await mode("system")
        await page.wait_for_function("document.documentElement.dataset.colorMode === 'dark'")
        await page.emulate_media(color_scheme="light")
        await page.wait_for_function("document.documentElement.dataset.colorMode === 'light'")
        await mode("dark")
        await page.get_by_label("Motion preference").select_option("system")
        await page.emulate_media(reduced_motion="reduce")
        await page.wait_for_function("document.documentElement.dataset.reducedMotion === 'true'")
        await page.get_by_label("Motion preference").select_option("full")
        await page.wait_for_function("document.documentElement.dataset.reducedMotion === 'false'")
        await page.get_by_label("Motion preference").select_option("reduced")
        await page.keyboard.press("Escape")
        assert await page.get_by_role("button", name="Theme", exact=True).evaluate("e=>e===document.activeElement")
        await page.wait_for_function("JSON.parse(localStorage.getItem('arklyn-office-v3')).colorMode === 'dark'")
        checks.append("Light/Dark/System overrides, system change, reduced-motion override, keyboard Escape/focus and core text contrast")

        await page.set_viewport_size({"width": 390, "height": 844})
        await page.locator('button[title="Ari"]').wait_for(state="visible")
        await page.get_by_role("button", name="Theme", exact=True).click()
        dialog = page.get_by_role("dialog", name="Office theme")
        bounds = await dialog.bounding_box()
        assert bounds and bounds["y"] >= 0 and bounds["y"] + bounds["height"] <= 844, bounds
        await page.get_by_label("Motion preference").focus()
        await page.keyboard.press("Tab")
        assert await dialog.get_by_role("button", name="Close", exact=True).evaluate("e=>e===document.activeElement"), "dialog focus wraps"
        await page.keyboard.press("Escape")
        await page.get_by_role("button", name="Settings", exact=True).click()
        assert await page.get_by_role("heading", name="Install Arklyn Office").is_visible()
        await page.keyboard.press("Escape")
        assert await page.evaluate("document.documentElement.scrollWidth<=innerWidth")
        assert await page.get_by_role("textbox").is_visible()
        await page.screenshot(path=str(out / "dark-mobile.png"))
        checks.append("390×844 dark layout/composer/settings; theme dialog fits and traps keyboard focus")
        print("Theme, contrast, keyboard and mobile passed", flush=True)

        manifest = await (await context.request.get(args.base_url + "/manifest.webmanifest")).json()
        assert manifest["display"] == "standalone" and manifest["start_url"] == "/"
        for icon in manifest["icons"]:
            response = await context.request.get(args.base_url + icon["src"])
            data = await response.body()
            size = struct.unpack(">II", data[16:24])
            assert response.status == 200 and data[:8] == b"\x89PNG\r\n\x1a\n"
            assert icon["sizes"] == f"{size[0]}x{size[1]}"
        await page.evaluate("navigator.serviceWorker.ready")
        await page.wait_for_function("navigator.serviceWorker.controller !== null")
        assert await page.evaluate("caches.keys()") == []
        assert not errors, errors
        assert not online_console_errors, online_console_errors
        checks.append("Valid manifest/icons, active root service worker and empty Cache Storage")

        offline_phase = True
        await context.set_offline(True)
        await page.get_by_role("button", name="Send", exact=True).wait_for()
        await page.wait_for_function("document.querySelector('button[aria-label=Send]').disabled")
        textbox = page.get_by_role("textbox")
        await textbox.fill("Offline draft fixture")
        await textbox.press("Enter")
        assert await textbox.input_value() == "Offline draft fixture"
        await page.reload(wait_until="domcontentloaded")
        assert await page.get_by_role("heading", name="You’re offline").is_visible()
        await context.set_offline(False)
        # Re-enter directly into a saved non-scene view: global motion still applies.
        await page.evaluate("const s=JSON.parse(localStorage.getItem('arklyn-office-v3'));s.view='lounge';s.motionPreference='reduced';localStorage.setItem('arklyn-office-v3',JSON.stringify(s))")
        await page.get_by_role("link", name="Try again").click()
        await page.wait_for_function("document.documentElement.dataset.colorMode === 'dark'")
        await page.wait_for_function("document.documentElement.dataset.reducedMotion === 'true'")
        assert await page.evaluate("JSON.parse(localStorage.getItem('arklyn-office-v3')).colorMode") == "dark"
        checks.append("Offline disables sending without clearing draft; navigation fallback/retry preserve Dark and Reduced motion on a saved Lounge view")
        report = {"checks": checks, "page_errors": errors, "online_console_errors": online_console_errors,
                  "core_text_contrast": ratios, "browser": browser.version, "rendering": "Headless SwiftShader; functional QA, not physical-device FPS", "viewport": {"desktop": [1600,1000], "mobile": [390,844]}}
        (out / "results.json").write_text(json.dumps(report, indent=2))
        print(json.dumps(report, indent=2), flush=True)
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
