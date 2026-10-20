"""Bounded renderer-resource check across quality changes, using one local actor.
Counts are WebGL renderer objects, not measured GPU bytes or real-device FPS.
"""
import argparse,asyncio,json,shutil,time
from pathlib import Path
from playwright.async_api import async_playwright
from qa_studio import fixture

async def main():
 p=argparse.ArgumentParser();p.add_argument('--base-url',default='http://127.0.0.1:3013');p.add_argument('--output',default='/workspace/artifacts/quality-lifecycle');a=p.parse_args();out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  context=await browser.new_context(viewport={'width':900,'height':700},device_scale_factor=1);state=fixture();state['rooms'][0]['agents']=state['rooms'][0]['agents'][:1];state['motionPreference']='reduced';state['qualityPreference']='low'
  await context.add_init_script('localStorage.setItem("arklyn-office-v3",'+json.dumps(json.dumps(state))+');')
  async def api(route):
   assert route.request.method=='GET','No messages or models in lifecycle QA'
   path=route.request.url.split('/api/',1)[1]
   if path=='integrations/stream':await route.fulfill(status=200,content_type='text/event-stream',body=': local fixture\n\n');return
   body={'group':{'id':'visual-only','name':'Isolated fixture'},'bots':[],'rooms':[],'updatedAt':int(time.time()*1000)}if path=='integrations'else{'enabled':False,'agents':[],'ok':True,'mode':'demo'}
   await route.fulfill(status=200,content_type='application/json',body=json.dumps(body))
  await context.route('**/api/**',api);page=await context.new_page();page.set_default_timeout(180000);errors=[];console_errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:console_errors.append(m.text)if m.type=='error'else None)
  await page.goto(a.base_url,wait_until='domcontentloaded');await page.locator('button[title="Ari"]').wait_for(state='visible')
  await page.get_by_role('button',name='Theme',exact=True).click();samples=[]
  for level in ['low','medium','high','low','medium','high','low']:
   await page.get_by_label('Scene quality',exact=True).select_option(level)
   await page.wait_for_function('(level)=>document.querySelector("[data-scene-quality]")?.dataset.sceneQuality===level',arg=level)
   await page.evaluate('new Promise(resolve=>{let n=0;function frame(){if(++n>=4)resolve();else requestAnimationFrame(frame);}requestAnimationFrame(frame);})')
   await page.wait_for_timeout(3500)
   data=await page.locator('[data-scene-quality]').evaluate('(el)=>({...el.dataset})');assert int(data['renderCalls'])>0
   sample={k:data[k]for k in ['sceneQuality','renderCalls','renderTriangles','renderGeometries','renderTextures']};samples.append(sample);print(json.dumps(sample),flush=True)
  # The first round warms the three intentionally cached LODs. Subsequent visits
  # must reach a plateau, rather than adding resources on every quality change.
  assert int(samples[-1]['renderGeometries'])<=int(samples[3]['renderGeometries'])+2,samples
  assert int(samples[-1]['renderTextures'])<=int(samples[3]['renderTextures'])+1,samples
  assert not errors,errors;assert not console_errors,console_errors
  report={'samples':samples,'pageErrors':errors,'consoleErrors':console_errors,'browser':browser.version,'scope':'One reduced-motion character, 900x700, two visits per LOD plus final Low; bounded object counts after cache warmup. Not a long-duration leak test, GPU byte measurement or physical-device FPS.'}
  (out/'results.json').write_text(json.dumps(report,indent=2));await browser.close()
if __name__=='__main__':asyncio.run(main())
