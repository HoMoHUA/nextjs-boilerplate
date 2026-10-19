"""Verify a missing 3D asset does not take the conversation UI down."""
import asyncio
import os
import shutil
import sys
from playwright.async_api import async_playwright


async def main():
    base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3002"
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=os.environ.get("CHROMIUM_BIN") or shutil.which("chromium"),
            args=["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        # This check must not query a real bridge, even when the app has keys.
        await page.route("**/api/**", lambda route: route.fulfill(status=503,
            content_type="application/json", body='{"error":"isolated_visual_test"}'))
        await page.route("**/models/studio/characters.glb", lambda route: route.fulfill(status=503, body="Unavailable"))
        await page.goto(base, wait_until="domcontentloaded")
        await page.get_by_text("The studio could not be loaded.", exact=True).wait_for(timeout=15000)
        assert await page.get_by_role("textbox").is_visible(), "Conversation composer was lost"
        assert await page.get_by_role("button", name="Retry studio", exact=True).is_visible()
        await page.get_by_role("button", name="Hermes", exact=True).click()
        assert await page.get_by_role("textbox").is_visible()
        await page.unroute("**/models/studio/characters.glb")
        await page.get_by_role("button", name="Retry studio", exact=True).click()
        await page.locator('button[title="Hermes"]').wait_for(state="visible", timeout=120000)
        assert await page.locator("canvas").is_visible()
        await browser.close()
        print("PASS missing asset preserves conversations and retry restores the actual studio")


asyncio.run(main())
