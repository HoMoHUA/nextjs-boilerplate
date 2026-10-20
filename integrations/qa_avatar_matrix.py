"""Static 1/6/12-person LOD and mobile matrix, plus a mocked explicit meeting stream.
All API traffic is intercepted. The one POST uses a local fixture, never a model.
"""
import argparse,asyncio,json,shutil,time,math,statistics
from pathlib import Path
from playwright.async_api import async_playwright
from qa_studio import fixture

async def main():
 p=argparse.ArgumentParser();p.add_argument('--base-url',default='http://127.0.0.1:3010');p.add_argument('--output',default='/workspace/artifacts/avatar-matrix');p.add_argument('--sample-seconds',type=int,default=0,choices=range(0,121));p.add_argument('--characters',type=int,choices=[1,6,12]);p.add_argument('--skip-meeting',action='store_true');a=p.parse_args();out=Path(a.output);out.mkdir(parents=True,exist_ok=True);checks=[]
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  for count,quality,width,height in [(1,'high',1440,1000),(6,'medium',1440,1000),(12,'low',390,844)]:
   if a.characters and count!=a.characters:continue
   context=await browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1)
   state=fixture();base=state['rooms'][0]['agents'];state['rooms'][0]['agents']=[{**base[i%6],'id':f'matrix-{i}','name':f'Person {i+1}','isLead':i==0}for i in range(count)];state['selectedAgentId']='matrix-0';state['targetAgentId']='matrix-0';state['qualityPreference']=quality;state['motionPreference']='reduced';state['colorMode']='dark'
   await context.add_init_script('localStorage.setItem("arklyn-office-v3",'+json.dumps(json.dumps(state))+');')
   async def api(route):
    assert route.request.method=='GET';path=route.request.url.split('/api/',1)[1]
    if path=='integrations/stream':await route.fulfill(status=200,content_type='text/event-stream',body=': matrix\n\n');return
    body={'group':{'id':'visual-only','name':'Isolated fixture'},'bots':[],'rooms':[],'updatedAt':int(time.time()*1000)} if path=='integrations' else {'ok':True,'enabled':False,'agents':[],'mode':'demo'}
    await route.fulfill(status=200,content_type='application/json',body=json.dumps(body))
   await context.route('**/api/**',api);page=await context.new_page();page.set_default_timeout(180000);errors=[];console_errors=[];assets=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:console_errors.append(m.text)if m.type=='error'else None);page.on('response',lambda r:assets.append(r.url)if'characters-'in r.url else None)
   await page.goto(a.base_url,wait_until='domcontentloaded');await page.locator(f'button[title="Person {count}"]').wait_for(state='visible');assert await page.locator('[data-scene-quality]').get_attribute('data-scene-quality')==quality
   assert any(f'characters-{quality}.glb'in url for url in assets)
   assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors;assert not console_errors,console_errors
   window=None
   if a.sample_seconds:
    await page.wait_for_timeout(3500);started=time.monotonic();samples=[]
    while time.monotonic()-started<a.sample_seconds:
     data=await page.locator('[data-scene-quality]').evaluate('(el)=>({...el.dataset})')
     samples.append({k:int(data[k])for k in ['renderCalls','renderTriangles','renderGeometries','renderTextures']});await page.wait_for_timeout(1000)
    calls=sorted(s['renderCalls']for s in samples)
    window={'seconds':time.monotonic()-started,'samples':samples,'callsMedian':statistics.median(calls),'callsP95':calls[math.ceil(.95*len(calls))-1],'callsMax':max(calls),'method':'Latest renderer counters sampled about once per second; counters refresh every three seconds. These are draw-call samples, not frame-time/FPS percentiles.'}
   await page.screenshot(path=str(out/f'{count}-{quality}-{width}.png'))
   checks.append({'characters':count,'quality':quality,'viewport':[width,height],'motion':'reduced, static poses','pageErrors':errors,'consoleErrors':console_errors,'rendererSampleWindow':window,'rendererCounters':await page.locator('[data-scene-quality]').evaluate('(el)=>({...el.dataset})')});print(f'{count} people / {quality} / {width}px passed',flush=True);await context.close()
  if a.skip_meeting:
   (out/'results.json').write_text(json.dumps({'checks':checks,'browser':browser.version,'limitation':'Static SwiftShader matrix only; no physical-device FPS or meeting check in this filtered run'},indent=2));print(json.dumps(checks,indent=2),flush=True);await browser.close();return
  # Actual frontend stream handler consumes an explicit typed event from this local mock.
  context=await browser.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1);state=fixture();state['rooms'][0]['backend']='claude-code';state['qualityPreference']='low';state['motionPreference']='full'
  await context.add_init_script('window.__fixtureNow=Date.now();Date.now=()=>window.__fixtureNow;if(!localStorage.getItem("arklyn-office-v3"))localStorage.setItem("arklyn-office-v3",'+json.dumps(json.dumps(state))+');')
  posts=[]
  async def meeting_api(route):
   path=route.request.url.split('/api/',1)[1]
   if route.request.method=='POST':
    assert path=='claude-code';posts.append(path);now=await page.evaluate('Date.now()')
    event={'type':'planning_meeting','eventId':'fixture-start','meetingId':'fixture-meeting','issuedAt':now,'phase':'start','participants':['visual-0','visual-1'],'durationSeconds':120}
    events=[{'type':'session','id':'fixture','agents':[]},event,event,{'type':'text','agent':None,'parent':None,'delta':'Local fixture only.'},{'type':'done'}]
    await route.fulfill(status=200,content_type='text/event-stream',body=''.join('data: '+json.dumps(e)+'\n\n'for e in events));return
   if path=='integrations/stream':await route.fulfill(status=200,content_type='text/event-stream',body=': fixture\n\n');return
   body={'group':{'id':'visual-only','name':'Isolated fixture'},'bots':[],'rooms':[],'updatedAt':int(time.time()*1000)} if path=='integrations' else {'ok':True,'enabled':True,'agents':[],'mode':'demo'}
   await route.fulfill(status=200,content_type='application/json',body=json.dumps(body))
  await context.route('**/api/**',meeting_api);page=await context.new_page();page.set_default_timeout(180000);errors=[];console_errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:console_errors.append(m.text)if m.type=='error'else None)
  await page.goto(a.base_url,wait_until='domcontentloaded');await page.locator('button[title="Ari"]').wait_for(state='visible')
  await page.get_by_role('textbox').fill('Local mocked meeting acceptance fixture')
  await page.get_by_role('button',name='Send',exact=True).click()
  await page.wait_for_function('JSON.parse(localStorage.getItem("arklyn-office-v3")).rooms[0].meetingEventIds?.length === 1')
  assert posts==['claude-code'];assert not errors,errors;assert not console_errors,console_errors
  # Give normal decorative locomotion time to reach the meeting area.
  await page.wait_for_function('document.querySelector("[data-meeting-phase]")?.dataset.meetingPhase === "discussing"',timeout=600000)
  await page.get_by_role('button',name='Pause scene animation',exact=True).click()
  await page.screenshot(path=str(out/'explicit-meeting.png'))
  checks.append({'meeting':'frontend consumes explicit mocked stream; duplicate event stored once','producer':'local mock only with frozen wall clock; live broker producer still required','pageErrors':errors,'consoleErrors':console_errors})
  (out/'results.json').write_text(json.dumps({'checks':checks,'browser':browser.version,'limitation':'Functional/static SwiftShader matrix, not mobile GPU/FPS or live meeting producer evidence'},indent=2));print(json.dumps(checks,indent=2),flush=True);await browser.close()
if __name__=='__main__':asyncio.run(main())
