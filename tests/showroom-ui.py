"""Real Chromium + real disposable backend checks. No production credentials."""
from pathlib import Path
import json, os, socket, subprocess, tempfile, time, urllib.request
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-results'; OUT.mkdir(exist_ok=True)
checks=[]
def check(name, condition=True):
    assert condition, name
    checks.append(name)
with socket.socket() as sock:
    sock.bind(('127.0.0.1',0)); port=sock.getsockname()[1]
origin=f'http://127.0.0.1:{port}'
with tempfile.TemporaryDirectory(prefix='showroom-ci-') as tmp:
    env={**os.environ,'NODE_ENV':'development','PORT':str(port),'DATA_DIR':tmp,'OWNER_PASSWORD':'Fictional-CI-owner-password-ONLY','PUBLIC_ORIGIN':origin,
         'ENABLE_WEBSITE_CHECKS':'false','OPENAI_API_KEY':'','OPENAI_MODEL':'','GOOGLE_CLIENT_ID':'','GOOGLE_CLIENT_SECRET':'','GITHUB_READ_TOKEN':'','FPR_READONLY_URL':'','FPR_READONLY_TOKEN':''}
    log=(OUT/'backend.log').open('w')
    server=subprocess.Popen(['node','server.mjs'],cwd=ROOT,env=env,stdout=log,stderr=log)
    try:
        for _ in range(80):
            try:
                with urllib.request.urlopen(origin+'/healthz',timeout=1) as r:
                    if r.status==200:break
            except Exception:time.sleep(.15)
        else:raise AssertionError('Backend did not become ready')
        with sync_playwright() as p:
            browser=p.chromium.launch(args=['--disable-dev-shm-usage'])
            ctx=browser.new_context(viewport={'width':1672,'height':941},reduced_motion='reduce')
            page=ctx.new_page(); errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(origin,wait_until='networkidle')
            expect(page.locator('#login')).to_be_visible(); check('private login shown')
            page.screenshot(path=str(OUT/'showroom-login.png'))
            page.locator('#password').fill(env['OWNER_PASSWORD'])
            page.locator('#login-form').get_by_role('button').click()
            expect(page.locator('#shell')).to_be_visible()
            page.wait_for_function("document.querySelector('#room-art').naturalWidth===1354")
            check('showroom asset decoded at full dimensions')
            expect(page.locator('#office-canvas')).to_be_hidden(); check('showroom is default, spatial renderer not eager')
            check('nine working navigation entries',page.locator('#navigation .nav-item').count()==9)
            check('no desktop horizontal overflow',page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
            page.screenshot(path=str(OUT/'showroom-desktop.png'))
            # Real API login and original worker, not mocked responses.
            page.locator('#pause-all').click()
            page.wait_for_function("[...document.querySelectorAll('#team-cards .team-task')].some(e=>e.textContent.includes('review'))",timeout=25000)
            check('practice shift ran actual backend tasks')
            page.locator('#team-cards [data-agent="email"]').click()
            expect(page.locator('#inspector')).to_be_visible()
            expect(page.locator('#draft-editor')).to_be_visible(timeout=10000)
            check('Avery desk opens actual prepared draft')
            editor=page.locator('#draft-editor'); old=editor.input_value()
            editor.fill(old+'\nOwner review correction: fictional browser check.')
            page.locator('[data-task-action="edit"]').click()
            expect(page.locator('#toast')).to_contain_text('correction saved')
            page.locator('[data-task-action="approve"]').click()
            expect(page.locator('#toast')).to_contain_text('Nothing was sent')
            check('edit and exact-revision approval still work')
            page.screenshot(path=str(OUT/'showroom-employee-desk.png'))
            page.locator('#close-inspector').click()
            page.locator('#pause-all').click()
            expect(page.locator('#pause-all')).to_contain_text('Resume office'); check('owner pause preserved')
            for room in ['door','concessions','storage','overview']:
                page.locator(f'button[data-room="{room}"]').click()
                expect(page.locator(f'button[data-room="{room}"]')).to_have_attribute('aria-pressed','true')
            check('all scenic room controls respond')
            page.locator('.owner-cta').click()
            expect(page.locator('#approvals-view')).to_be_visible(); check('owner control panel opens review')
            page.locator('#navigation [data-hq-route="team"]').click()
            expect(page.locator('#team-dialog')).to_be_visible()
            page.locator('#team-directory [data-agent="office"]').click()
            expect(page.locator('#inspector')).to_be_visible(); check('team directory opens same employee desk')
            page.locator('#close-inspector').click()
            for route in ['orders','inventory','schedule','customers','finances','reports']:
                page.locator(f'#navigation [data-hq-route="{route}"]').click()
                expect(page.locator('#records-view')).to_be_visible()
                expect(page.locator('#records-content h2').first).to_be_visible()
            check('six business sections provide task records or explicit unavailable source state')
            page.locator('#navigation [data-hq-route="settings"]').click()
            expect(page.locator('#connections-view')).to_be_visible()
            page.get_by_role('button',name='Company handbook',exact=True).click()
            expect(page.locator('#handbook-view')).to_be_visible(); check('settings and handbook remain functional')
            page.locator('#navigation [data-hq-route="overview"]').click()
            page.locator('button[data-scene-mode="spatial"]').click()
            expect(page.locator('#office-canvas')).to_be_visible()
            page.wait_for_timeout(1200)
            check('existing 3D renderer initializes',page.locator('#office-canvas').evaluate('(e)=>e.width>0&&e.height>0'))
            page.locator('[data-camera="owner"]').click()
            page.locator('button[data-scene-mode="showroom"]').first.click()
            expect(page.locator('#office-canvas')).to_be_hidden(); check('3D and showroom switch both directions')
            page.locator('#show-activity').click(); expect(page.locator('#activity-dialog')).to_be_visible()
            page.locator('[data-close="activity-dialog"]').click(); check('actual recorded activity accessible')
            page.locator('#open-command').click(); expect(page.locator('#command')).to_be_visible()
            page.locator('#command').fill('Prepare a fictional review checklist; do not contact customers.')
            page.locator('#command-role').select_option('office')
            page.locator('#command-form').get_by_role('button').click()
            expect(page.locator('#inspector')).to_be_visible(); check('instruction creates actual queued task')
            page.locator('#close-inspector').click()
            page.set_viewport_size({'width':390,'height':844})
            page.wait_for_timeout(350)
            check('no mobile horizontal overflow',page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
            expect(page.locator('#mobile-team [data-agent="email"]')).to_be_visible()
            page.screenshot(path=str(OUT/'showroom-mobile.png'),full_page=True)
            page.locator('#mobile-team [data-agent="email"]').click()
            expect(page.locator('#inspector')).to_be_visible(); check('mobile employee controls usable')
            page.locator('#close-inspector').click()
            page.set_viewport_size({'width':1672,'height':941})
            page.locator('#logout').click(); expect(page.locator('#login')).to_be_visible()
            check('logout denies authenticated records',ctx.request.get(origin+'/api/state').status==401)
            check('no browser JavaScript errors',not errors)
            (OUT/'showroom-checks.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'javascript_errors':errors,'scope':'Disposable real Node backend and Chromium, fictional practice data only'},indent=2))
            print(f'{len(checks)} real-browser checks passed')
            browser.close()
    finally:
        server.terminate()
        try:server.wait(timeout=8)
        except subprocess.TimeoutExpired:server.kill();server.wait()
        log.close()
