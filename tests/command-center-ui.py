"""Actual Chromium + disposable Node backend. Fictional instructions only."""
import json, os, re, socket, subprocess, tempfile, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
checks=[]
def check(name,value=True):
    assert value,name
    checks.append(name);print('PASS '+name,flush=True)
with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
origin=f'http://127.0.0.1:{port}'
with tempfile.TemporaryDirectory(prefix='command-ui-') as tmp:
    env={**os.environ,'NODE_ENV':'development','DATA_DIR':tmp,'PORT':str(port),'OWNER_PASSWORD':'Fictional-command-UI-password','PUBLIC_ORIGIN':origin,'INTEGRATION_ENCRYPTION_KEY':'BQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU=','OPENAI_API_KEY':'','OPENAI_MODEL':'','GOOGLE_CLIENT_ID':'','GOOGLE_CLIENT_SECRET':'','PHONE_WEBHOOK_SECRET':'','ENABLE_WEBSITE_CHECKS':'false','SHOWROOM_HOSTED_CHECK':'0','OFFICE_HOSTED_CHECK':'0'}
    with (OUT/'command-browser-backend.log').open('w') as log:
        proc=subprocess.Popen(['node','server.mjs'],cwd=ROOT,env=env,stdout=log,stderr=log)
        try:
            for _ in range(80):
                try:
                    if urllib.request.urlopen(origin+'/healthz',timeout=1).status==200:break
                except Exception:time.sleep(.15)
            else:raise AssertionError('Backend startup failed')
            with sync_playwright() as p:
                kwargs={}
                if os.getenv('CHROMIUM_EXECUTABLE'):kwargs['executable_path']=os.environ['CHROMIUM_EXECUTABLE']
                browser=p.chromium.launch(**kwargs);ctx=browser.new_context(viewport={'width':1600,'height':1000},reduced_motion='reduce');page=ctx.new_page();errors=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                page.goto(origin);page.locator('#password').fill(env['OWNER_PASSWORD']);page.locator('#login-form button').click();expect(page.locator('#shell')).to_be_visible()
                expect(page.locator('#command-preview')).to_be_visible();check('four employees are visible in the showroom live screen',page.locator('#command-preview [data-cmd-person]').count()==4)
                page.locator('#talk-to-team').click();expect(page.locator('#command-view')).to_be_visible();check('owner command room opens without replacing original showroom')
                check('shared wall has four real status monitors',page.locator('.cmd-monitor').count()==4)
                check('four visible worker avatars and individual desks',page.locator('.cmd-person').count()==4)
                page.locator('#cmd-message').fill('Team, what needs my attention?');page.locator('#cmd-send').click();expect(page.locator('#cmd-submit-state')).to_contain_text('Resume')
                check('owner message can wait safely while office paused')
                page.locator('#cmd-shift').click();expect(page.locator('#cmd-chat-log')).to_contain_text('OFFICE BRIEF',timeout=20000)
                check('resuming shift processes owner request and returns a recorded answer')
                check('owner sees inter-employee messages',page.locator('.cmd-feed-item').count()>5)
                check('missing model is stated instead of pretending to reason', 'not configured' in page.locator('#cmd-chat-log').inner_text())
                page.locator('#cmd-message').fill('Unsaved owner request stays here.');page.wait_for_timeout(10500)
                check('state refresh does not erase owner composition',page.locator('#cmd-message').input_value()=='Unsaved owner request stays here.')
                page.locator('#cmd-message').fill('Avery, help me prepare a reply.');page.locator('#cmd-to').select_option('email');page.locator('#cmd-send').click()
                expect(page.locator('#cmd-chat-log')).to_contain_text('Avery → Bryan',timeout=20000);check('follow-up can target one employee in same thread')
                page.screenshot(path=str(OUT/'command-team-desktop.png'),full_page=True)
                page.locator('#cmd-feed-filter').select_option('phone');check('Riley feed filtering works',all('Riley' in t for t in page.locator('.cmd-feed-item header').all_inner_texts()))
                page.locator('#cmd-feed-filter').select_option('all');page.locator('#cmd-focus').click();check('focus board hides navigation',page.locator('body').evaluate("e=>e.classList.contains('command-focus')"));page.keyboard.press('Escape');check('Escape exits focus board',not page.locator('body').evaluate("e=>e.classList.contains('command-focus')"))
                page.locator('#cmd-new').click();page.locator('[data-cmd-quick="website"]').click();check('website quick instruction selects evidence and Alex',page.locator('#cmd-to').input_value()=='tech' and page.locator('#cmd-evidence').input_value()=='website')
                page.locator('#cmd-send').click();expect(page.locator('#cmd-chat-log')).to_contain_text('Practice mode: no live website',timeout=20000);check('practice cannot silently perform a live website check')
                page.locator('#cmd-open-case').click();expect(page.locator('#apprentice-view')).to_be_visible();check('open exact evidence and approval workspace')
                page.locator('#talk-to-team').click();expect(page.locator('#command-view')).to_be_visible()
                for w,h in [(1440,900),(1024,768),(768,1024),(390,844),(320,740)]:
                    page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(150)
                    check(f'no horizontal overflow at {w}px',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
                    check(f'all four workers visible at {w}px',page.locator('.cmd-person:visible').count()==4)
                    if w==390:page.screenshot(path=str(OUT/'command-team-mobile.png'),full_page=True)
                page.locator('[data-cmd-person="phone"]').last.click();check('clicking Riley addresses the phone apprentice',page.locator('#cmd-to').input_value()=='phone')
                page.locator('#cmd-message').fill('Riley, tell me what source you need.');page.locator('#cmd-evidence').select_option('brief');page.locator('#cmd-send').click()
                expect(page.locator('#cmd-chat-log')).to_contain_text('Riley → Bryan',timeout=20000);check('mobile owner message receives reply')
                check('dictation remains inactive without owner action',page.locator('#cmd-mic').inner_text()=='🎙 Dictate')
                page.locator('#logout').click();expect(page.locator('#login')).to_be_visible();check('sign-out clears private command DOM',page.locator('#cmd-chat-log').inner_text()=='')
                check('private command API denies signed-out request',ctx.request.get(origin+'/api/apprentice/command').status==401)
                check('no JavaScript errors',not errors)
                (OUT/'command-browser-checks.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'javascriptErrors':errors,'scope':'Real disposable app in Chromium; fictional data, no actual microphone or model/Gmail/phone provider tested.'},indent=2))
                browser.close()
        finally:
            proc.terminate()
            try:proc.wait(timeout=8)
            except subprocess.TimeoutExpired:proc.kill();proc.wait()
