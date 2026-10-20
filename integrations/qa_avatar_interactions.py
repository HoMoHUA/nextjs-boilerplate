"""Isolated browser acceptance for appearance, LOD, coffee and context recovery.
No real messages, model calls, Telegram calls or production storage are used.
"""
import argparse,asyncio,json,os,shutil,time
from pathlib import Path
from playwright.async_api import async_playwright
from qa_studio import fixture

async def main():
 p=argparse.ArgumentParser();p.add_argument('--base-url',default='http://127.0.0.1:3010');p.add_argument('--output',default='/workspace/artifacts/avatar-interactions');p.add_argument('--skip-coffee',action='store_true',help='Run editor/reload/context checks; use separate contact fixture for pose evidence');args=p.parse_args();out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--remote-debugging-port=9320','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  context=await browser.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1)
  state=fixture();state['colorMode']='dark';state['qualityPreference']='low'
  await context.add_init_script('if(!localStorage.getItem("arklyn-office-v3"))localStorage.setItem("arklyn-office-v3",'+json.dumps(json.dumps(state))+');')
  requests=[]
  async def api(route):
   assert route.request.method=='GET','must not send messages'
   requests.append(route.request.url)
   path=route.request.url.split('/api/',1)[1]
   if path=='integrations/stream':await route.fulfill(status=200,content_type='text/event-stream',body=': isolated fixture\n\n');return
   body={'group':{'id':'visual-only','name':'Isolated fixture'},'bots':[],'rooms':[],'updatedAt':int(time.time()*1000)} if path=='integrations' else {'enabled':False,'agents':[],'ok':True,'mode':'demo'}
   await route.fulfill(status=200,content_type='application/json',body=json.dumps(body))
  await context.route('**/api/**',api)
  page=await context.new_page();page.set_default_timeout(90000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto(args.base_url,wait_until='domcontentloaded');await page.locator('button[title="Ari"]').wait_for(state='visible',timeout=180000)
  checks=[]
  print('Rendered authored LOD scene',flush=True)
  await page.get_by_role('button',name='Theme',exact=True).click()
  await page.get_by_role('button',name='Customize character',exact=True).click()
  dialog=page.get_by_role('dialog',name='Character appearance')
  await dialog.get_by_label('Top color',exact=True).fill('#123456')
  await dialog.get_by_role('button',name='Cancel',exact=True).click()
  saved=await page.evaluate('JSON.parse(localStorage.getItem("arklyn-office-v3"))')
  assert saved['rooms'][0]['agents'][0]['look']['shirt']!='#123456'
  await page.get_by_role('button',name='Customize character',exact=True).click()
  await dialog.get_by_label('Top color',exact=True).fill('oops')
  assert await dialog.get_by_role('button',name='Save appearance',exact=True).is_disabled()
  await dialog.get_by_label('Top color',exact=True).fill('#123456')
  for label,value in [('Hair','ponytail'),('Outfit','hoodie'),('Beard','short'),('Glasses','square'),('Desk item','tablet')]:await dialog.get_by_label(label,exact=True).select_option(value)
  await dialog.locator('[data-preview-ready=true]').wait_for(state='visible',timeout=180000)
  print('Independent appearance options selected and preview rendered',flush=True)
  await page.screenshot(path=str(out/'appearance-editor.png'))
  await dialog.get_by_role('button',name='Save appearance',exact=True).click()
  await page.wait_for_function('JSON.parse(localStorage.getItem("arklyn-office-v3")).rooms[0].agents[0].appearance?.outfit.topColor === "#123456"')
  await page.get_by_role('button',name='Close',exact=True).click()
  checks.append('Appearance Preview/Cancel, invalid HEX rejection, independent hair/outfit/beard/glasses/desk prop and Save persistence')
  print('Editor Save/Cancel and validation passed',flush=True)
  if not args.skip_coffee:
   # Watch a genuine full decorative cycle with the normal clock; never manufacture a processing event.
   scene=page.locator('[data-scene-quality]')
   async def hold_phase(phase):
    await page.evaluate("""phase => new Promise((resolve,reject)=>{
      let scheduled=false;
      const timer=setTimeout(()=>{observer.disconnect();reject(new Error('Coffee phase timeout: '+phase));},600000);
      const check=()=>{if(scheduled||document.querySelector('[data-coffee-phase]')?.dataset.coffeePhase!==phase)return;scheduled=true;observer.disconnect();let frames=0;function hold(){if(++frames<3){requestAnimationFrame(hold);return;}document.querySelector('button[aria-label="Pause scene animation"]').click();clearTimeout(timer);resolve(true);}requestAnimationFrame(hold);};
      const observer=new MutationObserver(check);observer.observe(document.querySelector('[data-coffee-phase]'),{attributes:true,attributeFilter:['data-coffee-phase']});check();
    })""",phase)
    await page.locator('[data-scene-paused=true]').wait_for(state='visible')
   await hold_phase('brew')
   await page.screenshot(path=str(out/'coffee-brew.png'))
   owner=await scene.get_attribute('data-coffee-owner');assert owner
   await page.get_by_role('button',name='Resume scene animation',exact=True).click()
   await hold_phase('sip')
   await page.screenshot(path=str(out/'coffee-sip.png'))
   await page.get_by_role('button',name='Resume scene animation',exact=True).click()
   await hold_phase('return')
   await page.screenshot(path=str(out/'coffee-return.png'))
   await page.get_by_role('button',name='Resume scene animation',exact=True).click()
   checks.append('Single reserved coffee visit reaches brew, sip and return in the normal scene clock, using Pause/Resume to capture each pose')
   print('Coffee brew/sip/return captured',flush=True)
  await page.get_by_role('button',name='Theme',exact=True).click()
  await page.get_by_label('Scene quality',exact=True).select_option('low')
  await page.get_by_role('button',name='Close',exact=True).click()
  await page.wait_for_function('document.querySelector("[data-scene-quality]")?.dataset.sceneQuality === "low"')
  await page.set_viewport_size({'width':390,'height':844})
  await page.screenshot(path=str(out/'studio-low-mobile.png'))
  assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  checks.append('Manual Low quality persists and mobile 390×844 fits without horizontal overflow')
  await page.reload(wait_until='domcontentloaded');await page.locator('button[title="Ari"]').wait_for(state='visible',timeout=180000)
  assert (await page.evaluate('JSON.parse(localStorage.getItem("arklyn-office-v3")).rooms[0].agents[0].appearance.hair.style'))=='ponytail'
  checks.append('Saved appearance survives reload')
  # Real WebGL extension triggers the explicit fallback; Retry mounts a fresh context.
  await page.evaluate('const c=document.querySelector("canvas");const gl=c.getContext("webgl2");gl.getExtension("WEBGL_lose_context").loseContext()')
  await page.get_by_role('button',name='Retry studio',exact=True).wait_for()
  await page.screenshot(path=str(out/'context-loss-fallback.png'))
  await page.get_by_role('button',name='Retry studio',exact=True).click()
  await page.locator('button[title="Ari"]').wait_for(state='visible',timeout=180000)
  checks.append('Actual WEBGL_lose_context enters accessible fallback; Retry restores selectable characters')
  expected=[e for e in errors if 'Studio WebGL context lost' not in e]
  assert not expected,expected
  report={'checks':checks,'pageErrors':errors,'apiRequests':len(requests),'browser':browser.version,'limitation':'Headless SwiftShader functional checks; screenshots need visual review, no physical-device FPS/install acceptance.'}
  (out/'results.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2),flush=True);await browser.close()
if __name__=='__main__':asyncio.run(main())
