"""Isolated browser smoke test. Requires Python Playwright and Chromium.
Loads the actual HTML/CSS/JS, bridges fetch to a temporary real Node API and
leaves SSE transport to the separate Node HTTP tests. Never uses real secrets.
"""
from playwright.sync_api import sync_playwright
from pathlib import Path
import urllib.request, urllib.error, json, re, base64, os, shutil, socket, subprocess, tempfile, time
root=Path(__file__).resolve().parents[1]
output=root/'test-results'; output.mkdir(exist_ok=True)
with socket.socket() as sock:
 sock.bind(('127.0.0.1',0)); port=sock.getsockname()[1]
base=f'http://127.0.0.1:{port}'
runtime=tempfile.TemporaryDirectory(prefix='friendly-office-ui-')
server=subprocess.Popen(['node',str(root/'server.mjs')],cwd=root,env={'PATH':os.environ['PATH'],'NODE_ENV':'development','PORT':str(port),'DATA_DIR':runtime.name},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
for attempt in range(60):
 try:
  urllib.request.urlopen(base+'/healthz',timeout=1).close(); break
 except (OSError,urllib.error.URLError): time.sleep(.1)
else:
 server.terminate(); runtime.cleanup(); raise RuntimeError('Isolated practice server did not start.')
html=(root/'public/index.html').read_text()
html=re.sub(r'<script[^>]*src="/app.js"[^>]*></script>','',html)
html=html.replace('<link rel="stylesheet" href="/style.css">','<style>'+(root/'public/style.css').read_text()+'</style>')
html=html.replace('/icon.svg','data:image/svg+xml;base64,'+base64.b64encode((root/'public/icon.svg').read_bytes()).decode())
script=(root/'public/scene.js').read_text().replace('export class OfficeScene','class OfficeScene')+'\n'+(root/'public/app.js').read_text().replace("import { OfficeScene } from './scene.js';",'')
def request(_source,path,options):
 method=options.get('method','GET'); data=options.get('body');headers=options.get('headers',{})
 headers['Origin']=base
 req=urllib.request.Request(base+path,data=data.encode() if data else None,headers=headers,method=method)
 try:
  with urllib.request.urlopen(req,timeout=10) as r:return {'status':r.status,'text':r.read().decode()}
 except urllib.error.HTTPError as e:return {'status':e.code,'text':e.read().decode()}
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
  page=b.new_page(viewport={'width':1440,'height':1100},device_scale_factor=1)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda e:print('CONSOLE',e.type,e.text))
  page.expose_binding('localAPI',request)
  page.set_content(html,wait_until='domcontentloaded')
  page.add_script_tag(content="""window.fetch=async(path,options={})=>{const r=await window.localAPI(String(path),options);return new Response(r.text,{status:r.status,headers:{'content-type':'application/json'}})};window.EventSource=class{addEventListener(){}close(){}};""")
  page.add_script_tag(content='(()=>{'+script+'})();')
  page.wait_for_selector('#shell:not([hidden])')
  page.wait_for_timeout(1700)
  page.screenshot(path=str(output/'office-desktop.png'),full_page=True)
  assert not page.locator('#scene-fallback').is_visible()
  page.locator('#pause-all').click()
  page.wait_for_timeout(1800)
  # The test harness does not imitate SSE; trigger a real state refresh through the online handler.
  page.evaluate("window.dispatchEvent(new Event('online'))")
  page.wait_for_timeout(500)
  assert page.locator('.stat-number').nth(1).inner_text()=='3'
  page.locator('.desk-label[data-desk="email"]').click()
  page.wait_for_selector('#draft-editor')
  assert 'Avery' in page.locator('#inspector').inner_text()
  page.locator('[data-inspector-tab="evidence"]').click()
  assert 'Recorded' in page.locator('#inspector').inner_text() or 'recorded' in page.locator('#inspector').inner_text()
  page.locator('[data-inspector-tab="history"]').click()
  assert 'Work started' in page.locator('#inspector').inner_text()
  page.locator('[data-inspector-tab="work"]').click()
  page.locator('#draft-editor').fill('OWNER-REVIEWED PRACTICE DRAFT. Please share the event date and delivery address. No booking promise.')
  page.locator('[data-task-action="approve"]').click()
  assert 'Save your draft changes' in page.locator('#toast').inner_text()
  page.locator('[data-task-action="edit"]').click()
  page.wait_for_timeout(250)
  page.screenshot(path=str(output/'office-workspace.png'),full_page=True)
  page.locator('[data-task-action="approve"]').click()
  page.wait_for_timeout(250)
  assert 'Approved · not sent' in page.locator('#inspector').inner_text()
  assert 'Nothing was sent' in page.locator('#toast').inner_text()
  page.locator('#close-inspector').click()
  page.locator('.nav-item[data-view="tasks"]').click()
  page.locator('#task-filter').select_option('email')
  assert page.locator('.task-card').count()==1
  page.locator('.nav-item[data-view="handbook"]').click()
  page.locator('#rule-title').fill('Owner-approved practice procedure')
  page.locator('#rule-body').fill('Ask for the event date when it is missing. Do not guess a date.')
  page.locator('#rule-form button').click()
  page.wait_for_timeout(250)
  assert page.locator('[data-rule-approve]').count()==1
  page.locator('[data-rule-approve]').click()
  page.wait_for_timeout(250)
  assert page.locator('[data-rule-approve]').count()==0
  page.locator('.nav-item[data-view="connections"]').click()
  assert page.locator('#connection-cards').get_by_text('Not configured',exact=True).count()==5
  page.locator('#operating-mode').select_option('shadow')
  page.wait_for_timeout(250)
  assert 'Shadow workspace' in page.locator('#mode-badge').inner_text()
  page.locator('#operating-mode').select_option('practice')
  page.wait_for_timeout(250)
  page.locator('.nav-item[data-view="office"]').click()
  page.locator('[data-camera="owner"]').click()
  page.wait_for_timeout(350)
  page.screenshot(path=str(output/'office-owner-camera.png'),full_page=True)
  page.locator('[data-camera="overview"]').click()
  page.wait_for_timeout(350)
  page.locator('#pause-all').click()
  page.wait_for_timeout(250)
  assert 'Resume office' in page.locator('#pause-all').inner_text()
  page.set_viewport_size({'width':390,'height':844})
  page.wait_for_timeout(550)
  assert page.evaluate('document.body.scrollWidth')<=390
  page.screenshot(path=str(output/'office-mobile.png'),full_page=True)
  page.locator('.team-card[data-agent="tech"]').click()
  assert page.locator('#inspector').is_visible()
  assert page.locator('#inspector').bounding_box()['width']<=390
  page.screenshot(path=str(output/'office-mobile-workspace.png'),full_page=True)
  print(json.dumps({'passed':18,'errors':errors,'renderer':page.locator('#office-canvas').get_attribute('data-renderer'),'mobileBodyWidth':page.evaluate('document.body.scrollWidth')},indent=2))
  assert not errors
  b.close()
finally:
 server.terminate()
 try: server.wait(timeout=5)
 except subprocess.TimeoutExpired: server.kill(); server.wait()
 runtime.cleanup()
