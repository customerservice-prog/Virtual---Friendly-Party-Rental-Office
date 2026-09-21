"""Actual Chromium + disposable Node backend. Fictional instructions only."""
import json, os, socket, subprocess, tempfile, time, urllib.request
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
                browser=p.chromium.launch();ctx=browser.new_context(viewport={'width':1600,'height':1000},reduced_motion='reduce');page=ctx.new_page();errors=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                page.goto(origin);page.locator('#password').fill(env['OWNER_PASSWORD']);page.locator('#login-form button').click();expect(page.locator('#shell')).to_be_visible()

                expect(page.locator('#command-preview')).to_be_visible()
                check('showroom preview is one compact virtual-office entry point',page.locator('#command-preview [data-cmd-open]').count()==1)

                page.locator('#talk-to-team').click();expect(page.locator('#command-view')).to_be_visible()
                check('virtual office uses one room instead of dashboard columns',page.locator('.vo-room').count()==1 and page.locator('.vo-wall').count()==1)
                check('four employees are visible as desks in the room',page.locator('.cmd-person').count()==4)
                check('single owner message dock is visible',page.locator('.vo-owner-dock').count()==1 and page.locator('#cmd-message').is_visible())
                check('shared wall contains current huddle and conversation',page.locator('#cmd-huddle').count()==1 and page.locator('#cmd-board-stream').count()==1)
                check('technical duties are hidden behind settings',not page.locator('#cmd-settings-dialog').evaluate('e=>e.open'))
                check('owner decision list is hidden until Needs me is opened',not page.locator('#cmd-attention-dialog').evaluate('e=>e.open'))

                page.locator('#cmd-message').fill('This text must survive a connection drop.')
                ctx.set_offline(True);page.wait_for_timeout(700)
                check('reconnect state is simple and message box stays usable',page.locator('#cmd-live').inner_text().find('RECONNECTING')>=0 and not page.locator('#cmd-send').is_disabled())
                ctx.set_offline(False);page.evaluate("window.dispatchEvent(new Event('online'))")
                expect(page.locator('#cmd-live')).to_contain_text('LIVE',timeout=15000)
                check('office reconnects automatically without reload')
                check('typed owner message survives reconnect',page.locator('#cmd-message').input_value()=='This text must survive a connection drop.')
                page.locator('#cmd-message').fill('Team, what needs my attention?');page.locator('#cmd-send').click()
                page.wait_for_timeout(300)
                submit=page.locator('#cmd-submit-state').inner_text()
                check('owner assignment gives a plain-language status','team' in submit.lower() or 'office' in submit.lower() or 'saved' in submit.lower())

                if 'off' in submit.lower() or page.locator('#cmd-shift').get_attribute('aria-pressed')=='false':
                    page.locator('#cmd-shift').click()

                expect(page.locator('#cmd-chat-log')).to_contain_text('OFFICE BRIEF',timeout=20000)
                for _ in range(80):
                    if page.locator('.cmd-board-line').count()>=6:break
                    page.wait_for_timeout(250)
                check('wall visibly shows employee-to-employee collaboration',page.locator('.cmd-board-line').count()>=6)
                board=page.locator('#cmd-board-stream').inner_text()
                check('conversation shows multiple named employees','Morgan' in board and 'Avery' in board and 'Alex' in board and 'Riley' in board)
                check('huddle shows all four employees together',page.locator('#cmd-huddle [data-cmd-person]').count()==4)
                check('employee desks carry current speech/activity bubbles',page.locator('.vo-speech').count()>=3)
                check('owner conversation is separate and shorter than the wall discussion',page.locator('#cmd-chat-log .cmd-bubble').count()<page.locator('.cmd-board-line').count())

                page.locator('#cmd-message').fill('Unsaved owner request stays here.');page.wait_for_timeout(5000)
                check('live updates preserve owner typing',page.locator('#cmd-message').input_value()=='Unsaved owner request stays here.')

                page.locator('#cmd-message').fill('Avery, help me prepare a reply.');page.locator('#cmd-to').select_option('email');page.locator('#cmd-send').click()
                expect(page.locator('#cmd-chat-log')).to_contain_text('Avery → Bryan',timeout=20000)
                check('clicking or selecting one employee gives a direct line without leaving the room')

                page.locator('#cmd-board-all').click();expect(page.locator('#cmd-activity-dialog')).to_be_visible()
                check('full history appears only on demand');page.locator('[data-cmd-close-activity]').click()

                page.locator('#cmd-settings').click();expect(page.locator('#cmd-settings-dialog')).to_be_visible()
                check('24/7 duty machinery is hidden in settings by default',not page.locator('.cmd-duty-drawer').evaluate('e=>e.open'))
                page.locator('.cmd-duty-drawer summary').click();expect(page.locator('#cmd-duty-list')).to_be_visible()
                check('background duties remain inspectable when wanted')
                page.locator('[data-cmd-close-settings]').click()

                page.locator('#cmd-needs').click();expect(page.locator('#cmd-attention-dialog')).to_be_visible()
                check('Needs me is a dedicated simple owner queue');page.locator('[data-cmd-close-needs]').click()

                page.screenshot(path=str(OUT/'command-team-desktop.png'),full_page=True)

                page.locator('#cmd-settings').click();page.locator('#cmd-focus').click()
                check('optional full-screen mode hides app chrome',page.locator('body').evaluate("e=>e.classList.contains('command-focus')"))
                page.keyboard.press('Escape');check('Escape exits full-screen office',not page.locator('body').evaluate("e=>e.classList.contains('command-focus')"))

                page.locator('#cmd-new').click();page.locator('[data-cmd-quick="website"]').click()
                check('simple website shortcut picks Alex and website context',page.locator('#cmd-to').input_value()=='tech' and page.locator('#cmd-evidence').input_value()=='website')
                page.locator('#cmd-send').click();expect(page.locator('#cmd-chat-log')).to_contain_text('Practice mode: no live website',timeout=20000)
                check('practice cannot silently perform a live website check')

                page.locator('#cmd-open-case').click();expect(page.locator('#apprentice-view')).to_be_visible()
                check('advanced evidence stays one click away instead of cluttering the room')
                page.locator('#talk-to-team').click();expect(page.locator('#command-view')).to_be_visible()

                for w,h in [(1440,900),(1024,768),(768,1024),(390,844),(320,740)]:
                    page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(180)
                    check(f'no horizontal overflow at {w}px',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
                    check(f'all four employees remain visible at {w}px',page.locator('.cmd-person:visible').count()==4)
                    check(f'wall remains visible at {w}px',page.locator('#cmd-board-stream').is_visible())
                    check(f'owner message bar remains visible at {w}px',page.locator('#cmd-message').is_visible())
                    if w==390:page.screenshot(path=str(OUT/'command-team-mobile.png'),full_page=True)

                if page.locator('#cmd-conversation').evaluate("e=>e.classList.contains('open')"):
                    page.locator('#cmd-chat-close').click()
                page.locator('.cmd-person[data-cmd-person="phone"]').click()
                check('clicking Riley addresses Riley',page.locator('#cmd-to').input_value()=='phone')
                check('employee click opens direct conversation drawer',page.locator('#cmd-conversation').evaluate("e=>e.classList.contains('open')"))

                page.locator('#logout').click();expect(page.locator('#login')).to_be_visible()
                check('sign-out clears private owner conversation',page.locator('#cmd-chat-log').inner_text()=='')
                check('private command API denies signed-out request',ctx.request.get(origin+'/api/apprentice/command').status==401)
                check('no JavaScript errors',not errors)
                (OUT/'command-browser-checks.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'javascriptErrors':errors,'scope':'Real disposable app in Chromium; fictional data, no actual microphone or live providers.'},indent=2))
                browser.close()
        finally:
            proc.terminate()
            try:proc.wait(timeout=8)
            except subprocess.TimeoutExpired:proc.kill();proc.wait()
