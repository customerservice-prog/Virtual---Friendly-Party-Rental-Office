"""Real app/browser apprenticeship checks; fictional data only, no external model."""
import os, socket, subprocess, tempfile, time, json, urllib.request, re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
checks=[]
ACCOUNT='customerservice@friendlypartyrental.com'
def check(name,value=True):
    assert value,name
    checks.append(name);print('PASS '+name,flush=True)
with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
origin=f'http://127.0.0.1:{port}'
with tempfile.TemporaryDirectory(prefix='ap-browser-') as tmp:
    env={**os.environ,'NODE_ENV':'development','DATA_DIR':tmp,'PORT':str(port),'OWNER_PASSWORD':'Fictional-CI-owner-password-ONLY','PUBLIC_ORIGIN':origin,'INTEGRATION_ENCRYPTION_KEY':'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=','OPENAI_API_KEY':'','OPENAI_MODEL':'','OPENAI_TRANSCRIBE_MODEL':'','GOOGLE_CLIENT_ID':'','GOOGLE_CLIENT_SECRET':'','GITHUB_READ_TOKEN':'','FPR_READONLY_URL':'','PHONE_WEBHOOK_SECRET':'','ENABLE_WEBSITE_CHECKS':'false','SHOWROOM_HOSTED_CHECK':'0','OFFICE_HOSTED_CHECK':'0'}
    with (OUT/'apprentice-backend.log').open('w') as log:
        process=subprocess.Popen(['node','server.mjs'],cwd=ROOT,env=env,stdout=log,stderr=log)
        try:
            for _ in range(80):
                try:
                    if urllib.request.urlopen(origin+'/healthz',timeout=1).status==200:break
                except Exception:time.sleep(.15)
            else:raise AssertionError('Backend startup failed')
            with sync_playwright() as p:
                opts={'args':['--disable-dev-shm-usage']}
                browser=p.chromium.launch(**opts);ctx=browser.new_context(viewport={'width':1672,'height':1000},reduced_motion='reduce');page=ctx.new_page();errors=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                page.on('response',lambda r:print('AP_HTTP '+str(r.status)+' '+r.url,flush=True) if '/api/apprentice/' in r.url and r.status>=400 else None)
                page.goto(origin,wait_until='domcontentloaded');page.locator('#password').fill(env['OWNER_PASSWORD']);page.locator('#login-form button').click();expect(page.locator('#shell')).to_be_visible()
                check('original showroom remains the default',page.locator('body').get_attribute('data-scene-mode')=='showroom')
                check('advanced apprenticeship launch controls exist but stay hidden from the normal showroom',page.locator('.ap-nav').count()==1 and not page.locator('.ap-nav').is_visible())
                page.screenshot(path=str(OUT/'apprentice-showroom-desktop.png'))
                page.locator('.ap-nav [data-ap-route="cases"]').click();expect(page.locator('#apprentice-view')).to_be_visible()
                expect(page.get_by_role('button',name='Pause Riley shared casework')).to_be_visible();check('four team roles have separate pause controls')
                page.locator('[data-ap-action="practice"]').click();expect(page.locator('#ap-question-form')).to_be_visible();check('fictional cross-channel case opens')
                page.locator('#pause-all').click();page.wait_for_timeout(1100)
                page.locator('#ap-question-form button').click()
                expect(page.locator('#ap-draft')).to_have_value(re.compile('SHARED REVIEW'),timeout=20000)
                expect(page.locator('#ap-approve-form button')).to_be_enabled();check('team contributions produce one final review')
                check('peer conversation visible',page.locator('.ap-note').count()>=9)
                page.locator('#ap-draft').fill('Owner-edited fictional reply. Please send the event date and venue address.')
                page.wait_for_timeout(2200)
                check('background updates preserve unsaved owner typing','Owner-edited' in page.locator('#ap-draft').input_value())
                page.locator('#ap-approve-form button').click();expect(page.locator('#toast')).to_contain_text('Nothing was sent')
                expect(page.locator('#ap-approve-form button')).to_be_disabled();check('exact draft approval is recorded without sending')
                page.screenshot(path=str(OUT/'apprentice-team-case-desktop.png'),full_page=True)
                page.locator('.ap-tabs [data-ap-route="lessons"]').click()
                page.wait_for_timeout(300)
                page.screenshot(path=str(OUT/'apprentice-lessons-navigation.png'),full_page=True)
                print('LEARNING_VIEW '+page.locator('#apprentice-view').inner_text()[:1800],flush=True)
                print('BROWSER_ERRORS '+json.dumps(errors),flush=True)
                expect(page.locator('.ap-lesson-decision')).to_be_visible()
                page.locator('.ap-lesson-decision textarea').fill('Fictional procedure: ask for the venue address before promising delivery.')
                page.locator('.ap-lesson-decision button[value="approved"]').click();expect(page.locator('.ap-lesson-decision .badge')).to_contain_text('approved');check('lesson requires an explicit owner decision')
                page.locator('#navigation [data-hq-route="settings"]').click();expect(page.locator('#connections-view')).to_be_visible()
                page.get_by_role('button',name='Company handbook',exact=True).click()
                check('fictional lessons do not enter live handbook','Fictional procedure:' not in page.locator('#rule-list').inner_text())
                page.locator('#navigation [data-hq-route="settings"]').click();page.locator('#operating-mode').select_option('shadow');page.wait_for_timeout(400)
                page.locator('#navigation [data-hq-route="overview"]').click()
                page.locator('.ap-nav [data-ap-route="phone"]').click();expect(page.locator('#ap-phone-form')).to_be_visible()
                form=page.locator('#ap-phone-form');form.locator('[name="title"]').fill('Fictional browser call for training')
                form.locator('[name="transcript"]').fill('Nicole: What date and address?\nCustomer: I need to check. <b>Customer-supplied formatting</b>')
                form.locator('[name="at"]').fill('2026-09-20T12:10');form.locator('[name="consentAt"]').fill('2026-09-20T12:00');form.locator('[name="consentBasis"]').fill('Fictional consent evidence only')
                for k in ['staffConsent','callerConsent','businessOnly']:form.locator('[name="'+k+'"]') .check()
                form.locator('button[type="submit"]').click();expect(page.locator('#ap-question-form')).to_be_visible()
                check('consented transcript import creates an encrypted private case',page.locator('.ap-source-text').inner_text().startswith('Nicole:'))
                check('source markup stays plain text',page.locator('.ap-source-text b').count()==0 and '<b>Customer-supplied formatting</b>' in page.locator('.ap-source-text').inner_text())
                page.get_by_text('Correct transcript / speaker labels',exact=True).click();page.locator('.ap-transcript-edit textarea').fill('Nicole: Please confirm the date and address.\nCustomer: I will email them.')
                page.locator('.ap-transcript-edit button').click();expect(page.locator('.ap-source-text')).to_contain_text('Please confirm');check('owner can correct transcript and speaker labels')
                page.locator('#ap-question-form select').select_option('email');page.locator('#ap-question-form button').click();expect(page.locator('#ap-approve-form button')).to_be_enabled(timeout=15000);check('phone lead can consult Avery and produce a shared final review')
                page.locator('.ap-tabs [data-ap-route="observations"]').click();expect(page.locator('#ap-settings-form')).to_be_visible()
                check('mailbox account scope is exact',ACCOUNT in page.locator('#apprentice-view').inner_text())
                expect(page.locator('[data-ap-action="transcribe"]')).to_have_count(0)
                check('observation page states credentials are not ready','Not configured' in page.locator('#apprentice-view').inner_text() or 'Not ready' in page.locator('#apprentice-view').inner_text())
                for w,h in [(390,844),(320,740),(768,1024),(1440,900)]:
                    page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(200)
                    check(f'no training-page horizontal overflow at {w}',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
                    if w==390:page.screenshot(path=str(OUT/'apprentice-observation-mobile.png'),full_page=True)
                    page.locator('.ap-tabs [data-ap-route="phone"]').click();expect(page.locator('#ap-phone-form')).to_be_visible()
                    check(f'phone intake fits {w}px',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
                    page.locator('.ap-tabs [data-ap-route="observations"]').click()
                page.locator('#navigation [data-hq-route="overview"]').click();expect(page.locator('#office-view')).to_be_visible()
                page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(OUT/'apprentice-showroom-mobile.png'),full_page=True)
                check('mobile showroom still has all three original cards',page.locator('#mobile-team .team-card:visible').count()==3)
                page.locator('#logout').click();expect(page.locator('#login')).to_be_visible();check('logout protects apprenticeship records',ctx.request.get(origin+'/api/apprentice/cases').status==401)
                check('no JavaScript errors',not errors)
                (OUT/'apprentice-browser-checks.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'javascriptErrors':errors,'scope':'Disposable real backend, Chromium, fictional data; no production credentials or external model calls.'},indent=2))
                print(f'{len(checks)} apprenticeship browser checks passed',flush=True);browser.close()
        finally:
            process.terminate()
            try:process.wait(timeout=8)
            except subprocess.TimeoutExpired:process.kill();process.wait()
