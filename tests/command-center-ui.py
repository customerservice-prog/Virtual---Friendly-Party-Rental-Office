"""Chromium test for the living-office experience. Fictional data only."""
import json, os, socket, subprocess, tempfile, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
checks=[]
def check(name,value=True):
    assert value,name;checks.append(name);print('PASS '+name,flush=True)
with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
origin=f'http://127.0.0.1:{port}'
with tempfile.TemporaryDirectory(prefix='living-office-') as tmp:
    env={**os.environ,'NODE_ENV':'development','DATA_DIR':tmp,'PORT':str(port),'OWNER_PASSWORD':'Fictional-living-office-password','PUBLIC_ORIGIN':origin,'INTEGRATION_ENCRYPTION_KEY':'BQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU=','OPENAI_API_KEY':'','OPENAI_MODEL':'','GOOGLE_CLIENT_ID':'','GOOGLE_CLIENT_SECRET':'','PHONE_WEBHOOK_SECRET':'','ENABLE_WEBSITE_CHECKS':'false','SHOWROOM_HOSTED_CHECK':'0','OFFICE_HOSTED_CHECK':'0'}
    with (OUT/'living-office-backend.log').open('w') as log:
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
                expect(page.locator('#talk-to-team')).to_be_visible();page.locator('#talk-to-team').click();expect(page.locator('#command-view')).to_be_visible()

                check('main experience is one living office room',page.locator('.sim-room').count()==1)
                check('old dashboard wall is gone',page.locator('.vo-wall').count()==0)
                check('four employee desks are visible',page.locator('.cmd-person:visible').count()==4)
                check('owner has one simple conversation desk',page.locator('.sim-owner-desk').count()==1 and page.locator('#cmd-message').is_visible())
                check('global dashboard chrome is hidden in the living office',not page.locator('.rail').is_visible() and not page.locator('.topbar').is_visible())
                check('advanced controls start hidden',not page.locator('#cmd-settings-dialog').evaluate('e=>e.open') and not page.locator('#cmd-business-dialog').evaluate('e=>e.open'))
                check('team huddle stays out of the way while nobody is collaborating',page.locator('#sim-huddle').is_hidden())

                page.locator('.cmd-person[data-cmd-person="email"]').click()
                check('clicking Avery immediately addresses Avery',page.locator('#cmd-to').input_value()=='email')
                check('employee click opens a direct conversation area',page.locator('#cmd-conversation').is_visible())
                page.locator('#cmd-chat-close').click()

                page.locator('#cmd-message').fill('This message must survive reconnect.')
                ctx.set_offline(True);page.wait_for_timeout(500)
                check('connection state becomes reconnecting without blocking typing','RECONNECTING' in page.locator('#cmd-live').inner_text() and not page.locator('#cmd-send').is_disabled())
                ctx.set_offline(False);page.evaluate("window.dispatchEvent(new Event('online'))");expect(page.locator('#cmd-live')).to_contain_text('LIVE',timeout=15000)
                check('office reconnects automatically')
                check('typed message survives reconnect',page.locator('#cmd-message').input_value()=='This message must survive reconnect.')

                page.locator('[data-sim-to="team"]').click();page.locator('#cmd-message').fill('Team, work together and figure out what needs my attention.');page.locator('#cmd-send').click()
                expect(page.locator('#cmd-chat-log')).to_contain_text('OFFICE BRIEF',timeout=20000)
                expect(page.locator('#sim-huddle')).to_be_visible(timeout=20000)
                check('explicit collaboration becomes visible in the room')
                check('huddle shows multiple employee messages',page.locator('#cmd-board-stream button').count()>=2)
                board=page.locator('#cmd-board-stream').inner_text()
                check('team discussion names multiple employees',sum(name in board for name in ['Morgan','Avery','Riley','Alex'])>=2)
                check('employees show real status/activity rather than dashboard metrics',page.locator('.sim-person-name em').count()==4)
                check('owner conversation remains separate from employee huddle',page.locator('#cmd-chat-log article').count()>0)

                page.locator('#cmd-message').fill('Unsaved text stays here.');page.wait_for_timeout(2500)
                check('background updates preserve owner typing',page.locator('#cmd-message').input_value()=='Unsaved text stays here.')

                page.locator('#cmd-board-all').click();expect(page.locator('#cmd-activity-dialog')).to_be_visible();check('history is hidden until requested');page.locator('[data-cmd-close-activity]').click()
                page.locator('#cmd-business').click();expect(page.locator('#cmd-business-dialog')).to_be_visible();check('orders and other back-office screens live behind one Business button');page.locator('[data-cmd-close-business]').click()
                page.locator('#cmd-settings').click();expect(page.locator('#cmd-settings-dialog')).to_be_visible();check('24/7 machinery is hidden in settings',not page.locator('.cmd-duty-drawer').evaluate('e=>e.open'));page.locator('[data-cmd-close-settings]').click()
                page.locator('#cmd-needs').click();expect(page.locator('#cmd-attention-dialog')).to_be_visible();check('owner decisions stay in one Needs me dialog');page.locator('[data-cmd-close-needs]').click()

                page.screenshot(path=str(OUT/'living-office-desktop.png'),full_page=True)

                for w,h in [(1440,900),(1024,768),(768,1024),(390,844),(320,740)]:
                    page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(180)
                    check(f'no horizontal overflow at {w}px',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
                    check(f'all four desks stay visible at {w}px',page.locator('.cmd-person:visible').count()==4)
                    check(f'owner message box stays visible at {w}px',page.locator('#cmd-message').is_visible())
                    if w==390:page.screenshot(path=str(OUT/'living-office-mobile.png'),full_page=True)

                if page.locator('#cmd-conversation').is_visible():page.locator('#cmd-chat-close').click()
                page.locator('.cmd-person[data-cmd-person="phone"]').click()
                check('Riley can be addressed directly on mobile',page.locator('#cmd-to').input_value()=='phone')
                check('direct chat stays in the same office scene',page.locator('#command-view').is_visible() and page.locator('#cmd-conversation').is_visible())

                page.locator('#cmd-settings').click();page.locator('#cmd-signout').click();expect(page.locator('#login')).to_be_visible()
                check('private office is protected after sign out',ctx.request.get(origin+'/api/apprentice/command').status==401)
                check('no JavaScript errors',not errors)
                (OUT/'living-office-checks.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'javascriptErrors':errors},indent=2))
                browser.close()
        finally:
            proc.terminate()
            try:proc.wait(timeout=8)
            except subprocess.TimeoutExpired:proc.kill();proc.wait()
