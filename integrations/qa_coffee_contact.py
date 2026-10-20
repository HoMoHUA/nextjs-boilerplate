"""Close-up visual fixture, disabled in production unless STUDIO_PREVIEW_ENABLED=1.
No Office store or network/model messages; all API requests fail this check.
"""
import argparse,asyncio,json,shutil
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 p=argparse.ArgumentParser();p.add_argument('--base-url',default='http://127.0.0.1:3010');p.add_argument('--output',default='/workspace/artifacts/coffee-contact');p.add_argument('--pose',choices=['press','brew','sip','replace']);p.add_argument('--front',action='store_true');a=p.parse_args();out=Path(a.output);out.mkdir(parents=True,exist_ok=True);checks=[]
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  context=await browser.new_context(viewport={'width':1100,'height':900},device_scale_factor=1)
  async def no_api(route):raise AssertionError('Contact preview must never contact an API')
  await context.route('**/api/**',no_api)
  for pose,build in [('press','average'),('brew','average'),('sip','average'),('replace','average'),('sip','compact'),('sip','tall')]:
   if a.pose and pose!=a.pose:continue
   page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   await page.goto(f'{a.base_url}/studio-preview?pose={pose}&build={build}',wait_until='domcontentloaded');await page.locator('[data-contact-ready=true]').wait_for(state='visible',timeout=180000)
   if a.front:
    await page.mouse.move(850,450);await page.mouse.down();await page.mouse.move(600,450,steps=8);await page.mouse.up()
    await page.evaluate('new Promise(resolve=>{let n=0;function frame(){if(++n>=12)resolve();else requestAnimationFrame(frame);}requestAnimationFrame(frame);})')
   suffix='-front'if a.front else ''
   await page.screenshot(path=str(out/f'{pose}-{build}{suffix}.png'));assert not errors,errors
   checks.append({'pose':pose,'build':build,'pageErrors':errors});print(f'{pose}/{build} captured',flush=True);await page.close()
  (out/('results-front.json'if a.front else 'results.json')).write_text(json.dumps({'checks':checks,'browser':browser.version,'limitation':'Authored-pose close-up fixture; not proof of live backend work, real-device FPS or acceptance of every appearance combination.'},indent=2));await browser.close()
if __name__=='__main__':asyncio.run(main())
